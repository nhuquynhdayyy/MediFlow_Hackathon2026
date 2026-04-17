export function Header() {
  return (
    <header className="rounded-[32px] border border-white/60 bg-white/70 px-6 py-6 shadow-[0_25px_60px_rgba(65,101,142,0.15)] backdrop-blur-xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-sky-700">Navigator AI</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            Smart Hospital Navigation and FlowPredict dashboard for live patient routing.
          </h1>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm text-slate-700 md:grid-cols-3">
          <Metric label="Decision engine" value="Deterministic" />
          <Metric label="Prediction window" value="8h-17h" />
          <Metric label="Alert tiers" value="Green / Yellow / Red" />
        </div>
      </div>
    </header>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-950 px-4 py-3 text-white">
      <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-300">{label}</div>
      <div className="mt-1 text-base font-semibold">{value}</div>
    </div>
  );
}
