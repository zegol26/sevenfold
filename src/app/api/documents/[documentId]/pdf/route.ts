import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { callGas } from "@/lib/gas-client";
import { getSession } from "@/lib/session";

type GasDriveDownload = {
  driveFileId: string;
  fileName: string;
  mimeType: string;
  base64: string;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const session = await getSession();
  if (!session?.email) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { documentId } = await params;
  const user = await getDb().user.findFirst({
    where: { email: session.email.toLowerCase() },
    include: { role: true, resource: true },
  });
  if (!user || user.status !== "ACTIVE" || !user.organizationId) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const document = await getDb().document.findFirst({
    where: { organizationId: user.organizationId, OR: [{ legacySourceId: documentId }, { id: documentId }] },
  });
  if (!document) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!canViewDocument(user, document)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const driveFileId = normalizeStoredDriveFileId(document.driveFileId);
  if (!driveFileId) {
    return new NextResponse("This document points to a Google Drive folder. Open the actual PDF/Doc inside that folder and save the file link in Document Management.", { status: 400 });
  }

  const response = await fetchFirstReadablePdf(driveFileId);
  if (response.ok && response.body) {
    return new NextResponse(response.body, {
      headers: {
        "Content-Disposition": `inline; filename="${document.fileName.replace(/"/g, "")}"`,
        "Content-Type": response.headers.get("content-type") || "application/pdf",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  try {
    const gasFile = await callGas<GasDriveDownload>("downloadDocument", { documentId: driveFileId }, session.email);
    const bytes = Buffer.from(gasFile.base64, "base64");
    return new NextResponse(bytes, {
      headers: {
        "Content-Disposition": `inline; filename="${(gasFile.fileName || document.fileName).replace(/"/g, "")}"`,
        "Content-Type": gasFile.mimeType || "application/pdf",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Nexus-Drive-Source": "gas-driveapp",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new NextResponse(
      `Unable to load document through Drive. Confirm the Apps Script owner can access file ${driveFileId}. Detail: ${message}`,
      { status: 502 },
    );
  }
}

function normalizeStoredDriveFileId(input: string) {
  const value = input.trim();
  if (!value || /\/drive\/folders\//.test(value)) return "";
  const filePathMatch = value.match(/\/file\/d\/([^/?#]+)/);
  if (filePathMatch?.[1]) return filePathMatch[1];
  const queryMatch = value.match(/[?&]id=([^&#]+)/);
  if (queryMatch?.[1]) return queryMatch[1];
  const appFileMatch = value.match(/\/document\/d\/([^/?#]+)|\/presentation\/d\/([^/?#]+)|\/spreadsheets\/d\/([^/?#]+)/);
  if (appFileMatch) return appFileMatch.slice(1).find(Boolean) || "";
  return value;
}

async function fetchFirstReadablePdf(fileId: string) {
  const urls = [
    `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`,
    `https://docs.google.com/document/d/${encodeURIComponent(fileId)}/export?format=pdf`,
    `https://docs.google.com/presentation/d/${encodeURIComponent(fileId)}/export/pdf`,
    `https://docs.google.com/spreadsheets/d/${encodeURIComponent(fileId)}/export?format=pdf`,
  ];

  for (const url of urls) {
    const response = await fetch(url, { cache: "no-store", redirect: "follow" });
    const contentType = response.headers.get("content-type") || "";
    const finalUrl = response.url || "";
    if (response.ok && response.body && !contentType.includes("text/html") && !finalUrl.includes("accounts.google.com")) {
      return response;
    }
  }
  return new Response(null, { status: 502 });
}

function canViewDocument(
  user: {
    role: { code: string };
    resource: { id: string; legacySourceId: string | null } | null;
  },
  document: { entityType: string; entityId: string },
) {
  if (["ROLE_SUPER_ADMIN", "ROLE_NEXUS_ADMIN", "ROLE_HR_ADMIN"].includes(user.role.code)) {
    return true;
  }
  if (user.role.code !== "ROLE_EMPLOYEE") {
    return false;
  }
  if (document.entityType === "ONBOARDING_TEMPLATE") {
    return true;
  }
  const employeeId = user.resource?.legacySourceId || user.resource?.id || "";
  return document.entityType === "EMPLOYEE" && document.entityId === employeeId;
}
