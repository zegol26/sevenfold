import "server-only";

import { getDb } from "@/lib/db";

// The Apps Script Web App deployment and Drive root folder ID are configured as a
// single global env var (NEXUS_GAS_WEB_APP_URL / GOOGLE_DRIVE_ROOT_FOLDER_ID) even
// though this is a multi-tenant app: one shared Apps Script deployment serves every
// tenant, but each tenant's documents must land in its own Drive folder tree. This
// resolves that per-tenant override to pass into every GAS document call.
export async function getOrganizationDriveRootFolderId(organizationId: string): Promise<string | undefined> {
  const organization = await getDb().organization.findUnique({
    where: { id: organizationId },
    select: { driveRootFolderId: true },
  });
  return organization?.driveRootFolderId || undefined;
}
