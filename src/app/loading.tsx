export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 p-7 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 animate-ping rounded-full bg-teal-400" />
          <p className="text-sm uppercase tracking-[0.2em] text-teal-300">NEXUS SEVENFOLD</p>
        </div>
        <h1 className="mt-4 text-2xl font-semibold">Checking your workspace</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Loading your role, assignments, approvals, and resource status from the secure backend.
        </p>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full w-1/2 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-blue-500" />
        </div>
      </div>
    </main>
  );
}
