import { useEffect, useState } from "react";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";

import type { ChatMessage } from "@/App";
import { Panel } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { predictLoad, type PredictLoadResult } from "@/services/api";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

export function FlowPredictPage({
  pushMessage,
}: {
  pushMessage: (message: Omit<ChatMessage, "id">) => void;
}) {
  const [data, setData] = useState<PredictLoadResult | null>(null);

  useEffect(() => {
    void predictLoad().then((payload) => {
      setData(payload);
      pushMessage({
        role: "assistant",
        title: "FlowPredict update",
        lines: payload.alerts.length ? payload.alerts : ["No hospital-wide peak hours detected today."],
      });
    });
  }, [pushMessage]);

  if (!data) {
    return <Panel title="FlowPredict" subtitle="Loading prediction engine..." />;
  }

  const chartData = {
    labels: data.hospital_timeline.map((point) => `${point.hour}:00`),
    datasets: [
      {
        label: "Average load",
        data: data.hospital_timeline.map((point) => point.average_load),
        borderColor: "#0284c7",
        backgroundColor: "rgba(2,132,199,0.18)",
        fill: true,
        tension: 0.35,
      },
    ],
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
      <Panel title="FlowPredict" subtitle="Predict hourly patient pressure from 8h to 17h.">
        <div className="rounded-[28px] bg-slate-950 p-5">
          <Line
            data={chartData}
            options={{
              responsive: true,
              plugins: { legend: { labels: { color: "#dbeafe" } } },
              scales: {
                x: { ticks: { color: "#bfdbfe" }, grid: { color: "rgba(191,219,254,0.12)" } },
                y: {
                  ticks: { color: "#bfdbfe" },
                  grid: { color: "rgba(191,219,254,0.12)" },
                  suggestedMax: 100,
                },
              },
            }}
          />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.departments.slice(0, 6).map((department) => (
            <div key={department.department} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-semibold text-slate-900">{department.department}</h4>
                <StatusBadge status={department.peak_load > 80 ? "red" : department.peak_load >= 50 ? "yellow" : "green"} />
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Peak at {department.peak_hour}:00 with {department.peak_load}% load
              </p>
              <div className="mt-4 flex gap-2">
                {department.timeline.map((point) => (
                  <div key={point.hour} className="flex-1">
                    <div className="rounded-t-2xl bg-sky-500" style={{ height: `${Math.max(18, point.load)}px` }} />
                    <div className="mt-2 text-center text-[11px] text-slate-500">{point.hour}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Heatmap" subtitle="Overload color by department and hour.">
        <div className="space-y-4">
          {data.departments.slice(0, 8).map((department) => (
            <div key={department.department}>
              <div className="mb-2 text-sm font-semibold text-slate-700">{department.department}</div>
              <div className="grid grid-cols-10 gap-2">
                {department.timeline.map((point) => (
                  <div
                    key={point.hour}
                    className={`rounded-2xl px-2 py-3 text-center text-xs font-semibold text-white ${
                      point.load > 80 ? "bg-rose-500" : point.load >= 50 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    title={`${point.hour}:00 • ${point.load}%`}
                  >
                    {point.hour}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="rounded-3xl bg-sky-50 p-4 text-sm text-sky-900">
            {data.alerts.map((alert) => (
              <p key={alert}>{alert}</p>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}
