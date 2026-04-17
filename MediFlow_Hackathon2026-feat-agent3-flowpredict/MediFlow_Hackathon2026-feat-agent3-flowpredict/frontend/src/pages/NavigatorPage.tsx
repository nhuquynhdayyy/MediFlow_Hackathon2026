import { useCallback, useEffect, useState } from "react";

import type { ChatMessage } from "@/App";
import { Panel } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { getDepartments, optimizeRoute, type Department, type OptimizeRouteResult } from "@/services/api";

const defaultDepartments = ["Laboratory", "Radiology", "Internal Medicine", "Pharmacy"];
const constraints = [
  { id: "avoid_overloaded", label: "Avoid red zones" },
  { id: "prioritize_low_load", label: "Prioritize low load" },
  { id: "lab_first", label: "Lab first" },
  { id: "pharmacy_last", label: "Pharmacy last" },
];

export function NavigatorPage({
  pushMessage,
}: {
  pushMessage: (message: Omit<ChatMessage, "id">) => void;
}) {
  const [departmentData, setDepartmentData] = useState<Department[]>([]);
  const [selected, setSelected] = useState<string[]>(defaultDepartments);
  const [selectedConstraints, setSelectedConstraints] = useState<string[]>([
    "avoid_overloaded",
    "prioritize_low_load",
    "pharmacy_last",
  ]);
  const [hour, setHour] = useState(9);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OptimizeRouteResult | null>(null);

  useEffect(() => {
    void getDepartments(hour).then((payload) => setDepartmentData(payload.departments));
  }, [hour]);

  const runOptimize = useCallback(async () => {
    setLoading(true);
    try {
      const data = await optimizeRoute({
        departments: selected,
        constraints: selectedConstraints,
        hour,
      });
      setResult(data);
      pushMessage({
        role: "assistant",
        title: "Navigator route update",
        lines: data.reasoning,
      });
    } finally {
      setLoading(false);
    }
  }, [hour, pushMessage, selected, selectedConstraints]);

  useEffect(() => {
    void runOptimize();
  }, [runOptimize]);

  function toggleDepartment(name: string) {
    setSelected((current) => {
      if (current.includes(name)) {
        return current.filter((item) => item !== name);
      }
      if (current.length >= 6) {
        return current;
      }
      return [...current, name];
    });
  }

  function toggleConstraint(id: string) {
    setSelectedConstraints((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <Panel title="Navigator AI" subtitle="Build the fastest clinical route based on live wait and load.">
        <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-5">
            <div className="rounded-3xl bg-slate-950 p-4 text-white">
              <label className="text-xs uppercase tracking-[0.24em] text-cyan-300">Scenario hour</label>
              <div className="mt-3 flex items-center gap-3">
                <input
                  className="w-full accent-cyan-400"
                  max={17}
                  min={8}
                  onChange={(event) => setHour(Number(event.target.value))}
                  type="range"
                  value={hour}
                />
                <div className="rounded-2xl bg-white/10 px-3 py-2 text-lg font-semibold">{hour}:00</div>
              </div>
            </div>

            <div>
              <div className="mb-3 text-sm font-semibold text-slate-700">Select departments</div>
              <div className="grid gap-3 md:grid-cols-2">
                {departmentData.map((department) => (
                  <button
                    key={department.id}
                    className={`rounded-3xl border px-4 py-4 text-left transition ${
                      selected.includes(department.name)
                        ? "border-sky-500 bg-sky-50"
                        : "border-slate-200 bg-slate-50 hover:bg-white"
                    }`}
                    onClick={() => toggleDepartment(department.name)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{department.name}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          Floor {department.floor} • {department.zone}
                        </div>
                      </div>
                      <StatusBadge status={department.status} />
                    </div>
                    <div className="mt-3 text-sm text-slate-600">
                      Load {department.current_load}% • Wait {department.wait_time} min
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-3 text-sm font-semibold text-slate-700">Constraints</div>
              <div className="flex flex-wrap gap-3">
                {constraints.map((constraint) => (
                  <button
                    key={constraint.id}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      selectedConstraints.includes(constraint.id)
                        ? "bg-slate-950 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                    onClick={() => toggleConstraint(constraint.id)}
                    type="button"
                  >
                    {constraint.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="rounded-2xl bg-sky-600 px-5 py-3 font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={selected.length < 2 || loading}
              onClick={() => void runOptimize()}
              type="button"
            >
              {loading ? "Optimizing..." : "Optimize Route"}
            </button>
          </div>

          <div className="rounded-[28px] bg-[linear-gradient(145deg,_#0f172a,_#112d57)] p-5 text-white">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Route output</p>
                <h4 className="mt-2 text-2xl font-semibold">Patient path</h4>
              </div>
              <div className="rounded-2xl bg-white/10 px-3 py-2 text-sm">Live cost engine</div>
            </div>

            {result ? (
              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-3">
                  <Metric label="Total time" value={`${result.estimated_time} min`} />
                  <Metric label="Time saved" value={`${result.time_saved} min`} />
                  <Metric label="Alternative" value={`${result.alternative_time} min`} />
                </div>

                <RouteLine route={result.optimal_route} />
                <div className="rounded-3xl bg-white/5 p-4">
                  <div className="text-sm font-semibold text-cyan-300">Alternative route</div>
                  <div className="mt-2 text-base">{result.alternative_route.join(" → ")}</div>
                </div>

                <div className="space-y-3">
                  {result.route_breakdown.map((step) => (
                    <div
                      key={step.department}
                      className="flex items-center justify-between rounded-3xl bg-white/7 px-4 py-3"
                    >
                      <div>
                        <div className="font-medium">{step.department}</div>
                        <div className="text-sm text-slate-300">
                          {step.zone} • Floor {step.floor}
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div>Wait {step.wait_time} min</div>
                        <div>Load {step.current_load}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </Panel>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white/7 px-4 py-4">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-300">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function RouteLine({ route }: { route: string[] }) {
  return (
    <div className="rounded-3xl bg-white/7 p-4">
      <div className="mb-3 text-sm font-semibold text-cyan-300">Optimal route</div>
      <div className="flex flex-wrap items-center gap-3">
        {route.map((department, index) => (
          <div key={department} className="flex items-center gap-3">
            <span className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-900">{department}</span>
            {index < route.length - 1 ? <span className="text-cyan-300">→</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
