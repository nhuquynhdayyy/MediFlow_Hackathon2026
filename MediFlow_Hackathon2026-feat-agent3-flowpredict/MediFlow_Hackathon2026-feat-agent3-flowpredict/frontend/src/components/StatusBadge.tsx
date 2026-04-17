const classes: Record<"green" | "yellow" | "red", string> = {
  green: "bg-emerald-100 text-emerald-700",
  yellow: "bg-amber-100 text-amber-700",
  red: "bg-rose-100 text-rose-700",
};

export function StatusBadge({ status }: { status: "green" | "yellow" | "red" }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${classes[status]}`}>
      {status}
    </span>
  );
}
