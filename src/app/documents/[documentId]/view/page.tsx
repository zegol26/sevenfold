import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DocumentViewerPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const session = await getSession();
  if (!session?.email) redirect("/");

  const { documentId } = await params;
  const document = await getDb().document.findFirst({
    where: { OR: [{ legacySourceId: documentId }, { id: documentId }] },
  });
  if (!document) notFound();
  const user = await getDb().user.findUnique({
    where: { email: session.email.toLowerCase() },
    include: { role: true, resource: true },
  });
  if (!user || user.status !== "ACTIVE" || !canViewDocument(user, document)) {
    redirect("/unauthorized");
  }

  return (
    <main className="grid min-h-screen grid-rows-[auto_1fr] bg-slate-950 text-white">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <div>
          <div className="text-sm text-slate-400">NEXUS SEVENFOLD</div>
          <h1 className="text-base font-semibold">{document.fileName}</h1>
        </div>
        <div className="rounded-md bg-slate-800 px-3 py-1 text-xs">{document.documentType}</div>
      </header>
      <iframe
        className="h-full w-full border-0 bg-white"
        src={`/api/documents/${encodeURIComponent(document.legacySourceId || document.id)}/pdf`}
        title={document.fileName}
      />
    </main>
  );
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
