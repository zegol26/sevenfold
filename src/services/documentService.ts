import "server-only";

import { getDb } from "@/lib/db";
import { callDocumentGas } from "@/services/googleDriveGasClient";
import { writeAudit } from "@/services/auditService";

export type DocumentMetadataInput = {
  documentType: string;
  entityType: string;
  entityId: string;
  folderPath?: string;
  fileName: string;
  mimeType: string;
};

type DriveDocument = {
  driveFileId: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
  folderPath?: string;
};

export async function uploadDocument(metadata: DocumentMetadataInput, base64: string, actorId?: string) {
  const drive = await callDocumentGas<DriveDocument>("uploadDocument", { metadata, base64 });
  const document = await getDb().document.create({
    data: { ...metadata, ...drive, fileSize: drive.fileSize ? BigInt(drive.fileSize) : null, createdBy: actorId, updatedBy: actorId },
  });
  await writeAudit({ actorId, action: "DOCUMENT_UPLOADED", entityType: metadata.entityType, entityId: metadata.entityId, after: { documentId: document.id, driveFileId: drive.driveFileId } });
  return document;
}

export async function listDocuments(entityType: string, entityId: string) {
  return getDb().document.findMany({ where: { entityType, entityId, status: "active" }, orderBy: { createdAt: "desc" } });
}

export async function getDownload(documentId: string, actorId?: string) {
  const document = await getDb().document.findUniqueOrThrow({ where: { id: documentId } });
  const result = await callDocumentGas<{ base64: string; mimeType: string; fileName: string }>("downloadDocument", { documentId: document.driveFileId });
  await writeAudit({ actorId, action: "DOCUMENT_DOWNLOADED", entityType: document.entityType, entityId: document.entityId, metadata: { documentId } });
  return result;
}

export async function archiveDocument(documentId: string, actorId?: string) {
  const document = await getDb().document.findUniqueOrThrow({ where: { id: documentId } });
  await callDocumentGas("archiveDocument", { documentId: document.driveFileId });
  const archived = await getDb().document.update({ where: { id: documentId }, data: { status: "archived", updatedBy: actorId } });
  await writeAudit({ actorId, action: "DOCUMENT_ARCHIVED", entityType: document.entityType, entityId: document.entityId, metadata: { documentId } });
  return archived;
}
