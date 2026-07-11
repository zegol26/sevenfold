import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

import { callGas } from "@/lib/gas-client";
import { getDb } from "@/lib/db";
import { getOrganizationDriveRootFolderId } from "@/lib/organization";
import type { TemplateManagementRegistry, TemplateMetadata } from "@/lib/types";
import { writeAudit } from "@/services/auditService";

export const TEMPLATE_MANAGEMENT_KEY = "sevenfold.template_management";
export const TEMPLATE_MANAGEMENT_CACHE_TAG = "template-management";

export const TEMPLATE_CATEGORIES = [
  "Statement of Work",
  "Solution Description",
  "BoQ",
  "Risk Register",
  "Cashflow Analysis",
  "SDS Summary",
  "SDOA Summary",
  "Project Plan",
  "Resource Plan",
  "Site Handler Tracker",
  "Acceptance Certificate",
  "Good Receipt",
  "Invoice",
  "Purchase Request",
  "Purchase Order",
  "Handover Document",
  "Lessons Learned",
  "Governance Report",
  "MBR Report",
  "Executive Dashboard Template",
] as const;

type DriveUploadResult = {
  driveFileId: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
};

type RegistrySetting = TemplateManagementRegistry & Record<string, unknown>;

export const getTemplateRegistry = unstable_cache(
  async (organizationId: string): Promise<TemplateManagementRegistry> => {
    const setting = await getDb().systemSetting.findUnique({ where: { organizationId_key: { organizationId, key: TEMPLATE_MANAGEMENT_KEY } } });
    if (!setting) return { templates: [] };
    const value = setting.value as Partial<RegistrySetting>;
    return {
      templates: Array.isArray(value.templates) ? value.templates as TemplateMetadata[] : [],
      updatedAt: setting.updatedAt.toISOString(),
    };
  },
  [TEMPLATE_MANAGEMENT_KEY],
  { revalidate: 300, tags: [TEMPLATE_MANAGEMENT_CACHE_TAG] },
);

export async function uploadTemplate(input: {
  organizationId: string;
  templateName: string;
  templateType: string;
  documentCategory: string;
  mimeType: string;
  fileSize: number;
  version: string;
  effectiveFrom: string;
  fileName: string;
  base64: string;
  actorEmail: string;
  actorId?: string;
}) {
  const now = new Date().toISOString();
  const rootFolderId = await getOrganizationDriveRootFolderId(input.organizationId);
  const drive = await callGas<DriveUploadResult>("uploadDocument", {
    metadata: {
      documentType: input.templateType,
      entityType: "TEMPLATE",
      entityId: input.documentCategory,
      folderPath: `NEXUS_SEVENFOLD/Templates/${input.documentCategory}`,
      fileName: input.fileName,
      mimeType: input.mimeType,
    },
    base64: input.base64,
    rootFolderId,
  }, input.actorEmail);

  const template: TemplateMetadata = {
    templateId: `TPL-${Date.now().toString(36).toUpperCase()}`,
    templateName: input.templateName,
    templateType: input.templateType,
    documentCategory: input.documentCategory,
    driveFileId: drive.driveFileId,
    mimeType: drive.mimeType || input.mimeType,
    fileSize: String(drive.fileSize || input.fileSize || 0),
    version: input.version,
    status: "draft",
    effectiveFrom: input.effectiveFrom || now.slice(0, 10),
    uploadedBy: input.actorEmail,
    createdAt: now,
    updatedAt: now,
  };

  const before = await getTemplateRegistryForMutation(input.organizationId);
  await saveTemplateRegistry(input.organizationId, {
    templates: [template, ...before.templates],
  });
  await writeAudit({
    actorId: input.actorId,
    action: "TEMPLATE_DRAFT_UPLOADED",
    entityType: "template",
    entityId: template.templateId,
    before,
    after: template,
    reason: "Template draft uploaded through GAS Drive adapter",
  });
  return template;
}

export async function transitionTemplate(input: {
  organizationId: string;
  templateId: string;
  action: "review" | "approve" | "publish" | "retire";
  actorEmail: string;
  actorId?: string;
  reason?: string;
}) {
  const before = await getTemplateRegistryForMutation(input.organizationId);
  const now = new Date().toISOString();
  const target = before.templates.find((template) => template.templateId === input.templateId);
  if (!target) throw new Error("Template not found");

  let nextStatus: TemplateMetadata["status"];
  if (input.action === "review") nextStatus = "review";
  else if (input.action === "approve") nextStatus = "approved";
  else if (input.action === "publish") nextStatus = "active";
  else nextStatus = "retired";

  const templates = before.templates.map((template) => {
    if (
      input.action === "publish" &&
      template.templateId !== target.templateId &&
      template.documentCategory === target.documentCategory &&
      template.templateType === target.templateType &&
      template.status === "active"
    ) {
      return { ...template, status: "retired" as const, effectiveTo: now.slice(0, 10), updatedAt: now };
    }
    if (template.templateId !== target.templateId) return template;
    return {
      ...template,
      status: nextStatus,
      approvedBy: input.action === "approve" || input.action === "publish" ? input.actorEmail : template.approvedBy,
      effectiveTo: input.action === "retire" ? now.slice(0, 10) : template.effectiveTo,
      updatedAt: now,
    };
  });

  const after = { templates };
  await saveTemplateRegistry(input.organizationId, after);
  await writeAudit({
    actorId: input.actorId,
    action: `TEMPLATE_${input.action.toUpperCase()}`,
    entityType: "template",
    entityId: input.templateId,
    before: target,
    after: templates.find((template) => template.templateId === input.templateId),
    reason: input.reason || `Template lifecycle transition: ${input.action}`,
  });
}

export async function getTemplateById(organizationId: string, templateId: string) {
  const registry = await getTemplateRegistry(organizationId);
  return registry.templates.find((template) => template.templateId === templateId) || null;
}

export async function getActiveTemplateSnapshot(organizationId: string) {
  const registry = await getTemplateRegistry(organizationId);
  return registry.templates
    .filter((template) => template.status === "active")
    .map((template) => ({
      templateId: template.templateId,
      templateName: template.templateName,
      templateType: template.templateType,
      documentCategory: template.documentCategory,
      version: template.version,
      driveFileId: template.driveFileId,
    }));
}

async function getTemplateRegistryForMutation(organizationId: string): Promise<TemplateManagementRegistry> {
  const setting = await getDb().systemSetting.findUnique({ where: { organizationId_key: { organizationId, key: TEMPLATE_MANAGEMENT_KEY } } });
  if (!setting) return { templates: [] };
  const value = setting.value as Partial<RegistrySetting>;
  return { templates: Array.isArray(value.templates) ? value.templates as TemplateMetadata[] : [] };
}

async function saveTemplateRegistry(organizationId: string, value: TemplateManagementRegistry) {
  await getDb().systemSetting.upsert({
    where: { organizationId_key: { organizationId, key: TEMPLATE_MANAGEMENT_KEY } },
    create: {
      organizationId,
      key: TEMPLATE_MANAGEMENT_KEY,
      value,
      description: "Sevenfold Template Management metadata registry. Binary files stay in Google Drive.",
      status: "active",
    },
    update: { value, status: "active" },
  });
  revalidateTag(TEMPLATE_MANAGEMENT_CACHE_TAG, "max");
}
