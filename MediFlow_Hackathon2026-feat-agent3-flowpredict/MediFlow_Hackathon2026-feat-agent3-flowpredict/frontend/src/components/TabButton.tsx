import type { ReactNode } from "react";

export function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition ${
        active ? "bg-slate-950 text-white shadow-lg" : "bg-white text-slate-700 hover:bg-sky-50"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="text-base">{icon}</span>
      {label}
    </button>
  );
}
