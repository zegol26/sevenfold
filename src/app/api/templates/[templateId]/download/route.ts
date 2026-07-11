import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/session";
import { callGas } from "@/lib/gas-client";
import { getTemplateById } from "@/services/templateManagementService";
import { findUserByEmail } from "@/services/userService";
import { writeAudit } from "@/services/auditService";

type GasDriveDownload = {
  driveFileId: string;
  fileName: string;
  mimeType: string;
  base64: string;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const session = await getSession();
  if (!session?.email) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const user = await findUserByEmail(session.email);
  if (!user || user.status !== "ACTIVE" || !canDownloadTemplate(user.role.code)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (!user.organizationId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { templateId } = await params;
  const template = await getTemplateById(user.organizationId, templateId);
  if (!template) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const gasFile = await callGas<GasDriveDownload>("downloadDocument", { documentId: template.driveFileId }, session.email);
    const bytes = Buffer.from(gasFile.base64, "base64");
    await writeAudit({
      actorId: user.id,
      action: "TEMPLATE_DOWNLOADED",
      entityType: "template",
      entityId: template.templateId,
      metadata: { templateName: template.templateName, version: template.version },
    });
    return new NextResponse(bytes, {
      headers: {
        "Content-Disposition": `attachment; filename="${(gasFile.fileName || template.templateName).replace(/"/g, "")}"`,
        "Content-Type": gasFile.mimeType || template.mimeType || "application/octet-stream",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new NextResponse(`Unable to download template through Drive adapter. Detail: ${message}`, { status: 502 });
  }
}

function canDownloadTemplate(roleCode: string) {
  return [
    "ROLE_SUPER_ADMIN",
    "ROLE_NEXUS_ADMIN",
    "ROLE_FRAMEWORK_ADMIN",
    "ROLE_TEMPLATE_ADMIN",
    "ROLE_AUDITOR",
    "ROLE_PROJECT_MANAGER",
    "ROLE_PROGRAM_DIRECTOR",
  ].includes(roleCode);
}
