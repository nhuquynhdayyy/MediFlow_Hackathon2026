import { useEffect, useState } from "react";

import type { ChatMessage } from "@/App";
import { Panel } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { getNowVsLater, getOverloadAnalysis, type NowVsLaterResult, type OverloadResult } from "@/services/api";

const demoDepartments = ["Laboratory", "Radiology", "Internal Medicine", "Pharmacy"];

export function OperationsPage({
  pushMessage,
}: {
  pushMessage: (message: Omit<ChatMessage, "id">) => void;
}) {
  const [comparison, setComparison] = useState<NowVsLaterResult | null>(null);
  const [overload, setOverload] = useState<OverloadResult | null>(null);

  useEffect(() => {
    void Promise.all([
      getNowVsLater({
        department: "Internal Medicine",
        departments: demoDepartments,
        nowHour: 9,
        laterHour: 11,
      }),
      getOverloadAnalysis(9),
    ]).then(([comparisonPayload, overloadPayload]) => {
      setComparison(comparisonPayload);
      setOverload(overloadPayload);
      pushMessage({
        role: "assistant",
        title: "Operations AI alert",
        lines: [
          `At 9:00, waiting until 11:00 saves ${comparisonPayload.minutes_saved_if_wait} minutes for the demo route.`,
          ...overloadPayload.reasoning,
        ],
      });
    });
  }, [pushMessage]);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
      <Panel title="Now vs Later" subtitle="Hackathon demo scenario: Internal Medicine at 9h vs 11h.">
        {comparison ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <TimeCard color="rose" hour="9:00" route={comparison.now.optimal_route} time={comparison.now.estimated_time} headline="Rush hour" />
            <TimeCard color="emerald" hour="11:00" route={comparison.later.optimal_route} time={comparison.later.estimated_time} headline="Better window" />
            <div className="rounded-[28px] bg-slate-950 p-5 text-white lg:col-span-2">
              <div className="text-xs uppercase tracking-[0.24em] text-cyan-300">Savings</div>
              <div className="mt-3 text-4xl font-semibold">{comparison.minutes_saved_if_wait} minutes</div>
              <p className="mt-3 max-w-2xl text-sm text-slate-300">
                Internal Medicine drops from 90% load at 9:00 to 60% at 11:00, so Navigator AI recommends waiting
                when the visit is non-urgent.
              </p>
            </div>
          </div>
        ) : null}
      </Panel>

      <Panel title="Hospital Operations AI" subtitle="Detect overload and propose interventions.">
        {overload ? (
          <div className="space-y-4">
            <div className="rounded-3xl bg-slate-50 p-4">
              <div className="mb-2 text-sm text-slate-500">Average hospital load</div>
              <div className="text-3xl font-semibold text-slate-950">{overload.average_load}%</div>
            </div>

            <div className="grid gap-3">
              {overload.overloaded_departments.length ? (
                overload.overloaded_departments.map((department) => (
                  <div key={department.department} className="rounded-3xl border border-rose-200 bg-rose-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{department.department}</div>
                        <div className="text-sm text-slate-500">{department.zone}</div>
                      </div>
                      <StatusBadge status="red" />
                    </div>
                    <div className="mt-3 text-sm text-slate-700">
                      Load {department.load}% • Wait {department.wait_time} min
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  No red-zone departments at this hour.
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-slate-950 p-4 text-white">
              <div className="text-sm font-semibold text-cyan-300">Recommendations</div>
              <div className="mt-3 space-y-2 text-sm text-slate-200">
                {overload.recommendations.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Immediate actions</div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                {overload.actions.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

function TimeCard({
  color,
  headline,
  hour,
  route,
  time,
}: {
  color: "rose" | "emerald";
  headline: string;
  hour: string;
  route: string[];
  time: number;
}) {
  const background = color === "rose" ? "bg-rose-50 border-rose-200" : "bg-emerald-50 border-emerald-200";
  return (
    <div className={`rounded-[28px] border p-5 ${background}`}>
      <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{headline}</div>
      <div className="mt-2 flex items-center justify-between">
        <h4 className="text-2xl font-semibold text-slate-950">{hour}</h4>
        <div className="text-lg font-semibold text-slate-900">{time} min</div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-700">
        {route.map((department, index) => (
          <div key={department} className="flex items-center gap-3">
            <span className="rounded-full bg-white px-3 py-2">{department}</span>
            {index < route.length - 1 ? <span>→</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
