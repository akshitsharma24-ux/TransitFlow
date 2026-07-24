/*
  RouteCard — one route option. Left-edge color chip encodes the specific
  LINE where known (Western/Yellow/Red/Aqua), falling back to a generic
  mode color for bus/road. Click "Show itinerary" to expand the leg-by-leg
  breakdown (ride/walk steps) that the backend now provides.
*/

import { useState } from "react";
import { TrainFront, Bus, Car, TramFront, Users, IndianRupee, Clock, ChevronDown, Footprints } from "lucide-react";

const LINE_STYLES = {
  "Western Line": { color: "bg-signal", text: "text-signal", Icon: TrainFront },
  "Yellow Line": { color: "bg-gold", text: "text-gold", Icon: TramFront },
  "Red Line": { color: "bg-scarlet", text: "text-scarlet", Icon: TramFront },
  "Aqua Line": { color: "bg-monsoon", text: "text-monsoon", Icon: TramFront },
};

const MODE_FALLBACK_STYLES = {
  bus: { color: "bg-amber", text: "text-amber", Icon: Bus },
  road: { color: "bg-rust", text: "text-rust", Icon: Car },
  metro: { color: "bg-monsoon", text: "text-monsoon", Icon: TramFront },
  train: { color: "bg-signal", text: "text-signal", Icon: TrainFront },
};

function primaryLegStyle(legs) {
  const firstRide = legs.find((l) => l.type === "ride");
  if (!firstRide) return MODE_FALLBACK_STYLES.road;
  if (firstRide.line && LINE_STYLES[firstRide.line]) return LINE_STYLES[firstRide.line];
  return MODE_FALLBACK_STYLES[firstRide.mode] || MODE_FALLBACK_STYLES.road;
}

function legStyle(leg) {
  if (leg.line && LINE_STYLES[leg.line]) return LINE_STYLES[leg.line];
  return MODE_FALLBACK_STYLES[leg.mode] || MODE_FALLBACK_STYLES.road;
}

export default function RouteCard({ option, selected, onSelect, rank }) {
  const [expanded, setExpanded] = useState(false);
  const { color, text, Icon } = primaryLegStyle(option.legs);

  return (
    <div
      className={`rounded-xl overflow-hidden border transition-all bg-white ${
        selected ? "border-ink shadow-md ring-1 ring-ink" : "border-ink/10 hover:border-ink/30"
      }`}
    >
      <button onClick={onSelect} className="w-full text-left flex gap-0">
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

      {option.legs.length > 1 && (
        <div className="border-t border-ink/5">
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="w-full flex items-center justify-between px-4 py-2 text-[11px] font-mono uppercase tracking-wide text-ink/50 hover:text-ink/80 transition-colors"
          >
            <span>{expanded ? "Hide" : "Show"} itinerary ({option.legs.length} steps)</span>
            <ChevronDown size={13} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>

          {expanded && (
            <div className="px-4 pb-4 space-y-2">
              {option.legs.map((leg, i) => {
                const style = legStyle(leg);
                const isWalk = leg.type === "walk";
                return (
                  <div key={i} className="flex items-center gap-2.5 text-[12px]">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      isWalk ? "bg-ink/5" : style.color + "/15"
                    }`}>
                      {isWalk ? (
                        <Footprints size={12} className="text-ink/40" />
                      ) : (
                        <div className={`w-2 h-2 rounded-full ${style.color}`} />
                      )}
                    </div>
                    <div className="flex-1">
                      <span className="font-medium text-ink/80">
                        {isWalk ? "Walk" : (leg.line || leg.mode)}
                      </span>
                      <span className="text-ink/50">
                        {" "}
                        {leg.from_station.name === leg.to_station.name
                          ? `at ${leg.from_station.name}`
                          : `${leg.from_station.name} → ${leg.to_station.name}`}
                      </span>
                    </div>
                    <span className="font-mono text-ink/40 shrink-0">{leg.time_minutes} min</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
