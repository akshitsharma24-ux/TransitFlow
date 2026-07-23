/*
  RouteCard — one route option. Left-edge color chip encodes mode,
  echoing how Mumbai's rail lines are color-coded on real signage
  (this is the "structure encodes information" idea, not decoration).
*/

import { TrainFront, Bus, Car, TramFront, Users, IndianRupee, Clock } from "lucide-react";

const MODE_STYLES = {
  "Local Train": { color: "bg-signal", text: "text-signal", Icon: TrainFront },
  "Metro": { color: "bg-monsoon", text: "text-monsoon", Icon: TramFront },
  "Bus": { color: "bg-amber", text: "text-amber", Icon: Bus },
  "Car / Auto (Road)": { color: "bg-rust", text: "text-rust", Icon: Car },
};

function styleFor(modeLabel) {
  // Mixed-mode labels (e.g. "Local Train + Metro") fall back to the first mode's style
  const key = Object.keys(MODE_STYLES).find((k) => modeLabel.startsWith(k));
  return MODE_STYLES[key] || { color: "bg-ink", text: "text-ink", Icon: TrainFront };
}

export default function RouteCard({ option, selected, onSelect, rank }) {
  const { color, text, Icon } = styleFor(option.mode);

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left flex gap-0 rounded-xl overflow-hidden border transition-all ${
        selected ? "border-ink shadow-md ring-1 ring-ink" : "border-ink/10 hover:border-ink/30"
      } bg-white`}
    >
      <div className={`w-1.5 ${color} shrink-0`} />

      <div className="flex-1 p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Icon size={16} className={text} strokeWidth={2.2} />
            <h3 className="font-display font-semibold text-ink text-sm">{option.mode}</h3>
          </div>
          {rank === 0 && (
            <span className="font-mono text-[9px] tracking-wider uppercase bg-signal/10 text-signal px-2 py-0.5 rounded-full">
              Best match
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 font-mono text-[13px] text-ink/80 mb-2">
          <span className="flex items-center gap-1"><Clock size={13} /> {option.time_minutes} min</span>
          <span className="flex items-center gap-1"><IndianRupee size={13} /> {option.cost_rupees}</span>
          <span className="flex items-center gap-1"><Users size={13} /> {option.comfort_score}/5</span>
        </div>

        <p className="text-[13px] text-ink/60 leading-snug">{option.explanation}</p>

        {option.fare_pass && (
          <p className="text-[11px] font-mono text-monsoon/80 mt-2 border-t border-ink/5 pt-2">
            Monthly pass ₹{option.fare_pass.monthly_pass_cost} breaks even after ~{option.fare_pass.breakeven_commute_days} commute days
          </p>
        )}
      </div>
    </button>
  );
}
