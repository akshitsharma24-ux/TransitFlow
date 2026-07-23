import { TrainFront, AlertCircle } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center h-full min-h-[300px] rounded-2xl border border-dashed border-ink/15 p-10">
      <TrainFront size={28} className="text-ink/25 mb-3" strokeWidth={1.5} />
      <p className="font-display font-medium text-ink/70 text-sm mb-1">No routes yet</p>
      <p className="text-ink/40 text-xs max-w-[220px]">
        Enter a station to depart from and one to arrive at, then find routes.
      </p>
    </div>
  );
}

export function ErrorState({ message }) {
  return (
    <div className="flex items-start gap-3 bg-rust/5 border border-rust/20 text-rust rounded-xl p-4">
      <AlertCircle size={18} className="shrink-0 mt-0.5" />
      <div>
        <p className="font-display font-medium text-sm mb-0.5">Couldn't find routes</p>
        <p className="text-xs text-rust/80">{message}</p>
      </div>
    </div>
  );
}
