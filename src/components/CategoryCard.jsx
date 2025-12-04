import React from "react";
import {
  FaLeaf,
  FaUsers,
  FaBalanceScale,
  FaChartLine,
} from "react-icons/fa";

export default function CategoryCard({ category, onClick }) {
  const categoryStyles = {
    Environmental: {
      bg: "from-emerald-50/90 via-white to-emerald-100/70",
      border: "border-emerald-100",
      accent: "text-emerald-800",
      chipBg: "bg-emerald-50 text-emerald-700 border-emerald-100",
      icon: <FaLeaf className="text-emerald-600 text-2xl" />,
    },
    Social: {
      bg: "from-sky-50/90 via-white to-sky-100/70",
      border: "border-sky-100",
      accent: "text-sky-800",
      chipBg: "bg-sky-50 text-sky-700 border-sky-100",
      icon: <FaUsers className="text-sky-600 text-2xl" />,
    },
    Governance: {
      bg: "from-amber-50/90 via-white to-amber-100/70",
      border: "border-amber-100",
      accent: "text-amber-900",
      chipBg: "bg-amber-50 text-amber-700 border-amber-100",
      icon: <FaBalanceScale className="text-amber-600 text-2xl" />,
    },
  };

  const style =
    categoryStyles[category.category] || categoryStyles.Environmental;

  const metrics = category.metrics || [];

  return (
    <div
      onClick={onClick}
      className={`
        bg-gradient-to-br ${style.bg} 
        rounded-2xl border ${style.border} shadow-md
        hover:shadow-lg hover:-translate-y-[2px]
        transition-all duration-200 cursor-pointer
        flex flex-col h-full p-4
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-full bg-white/80 flex items-center justify-center shadow-sm">
            {style.icon}
          </div>
          <div className="min-w-0">
            <h2
              className={`${style.accent} text-sm sm:text-base font-semibold truncate`}
            >
              {category.category}
            </h2>
            <p className="text-[11px] text-slate-500 leading-snug">
              Key {category.category.toLowerCase()} performance signals
            </p>
          </div>
        </div>

        <span
          className={`
            hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium
            border ${style.chipBg}
          `}
        >
          View details
        </span>
      </div>

      {/* Metrics */}
      {metrics.length > 0 && (
        <div className="bg-white/80 rounded-xl p-3 shadow-inner border border-slate-100 flex-1">
          <ul className="space-y-2 text-[11px] sm:text-xs text-slate-700 leading-snug">
            {metrics.slice(0, 4).map((metric, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1.5 last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FaChartLine className="text-slate-300 text-xs flex-shrink-0" />
                  <span className="font-medium truncate">
                    {metric.title}
                  </span>
                </div>

                <span className="font-semibold text-slate-900 whitespace-nowrap text-[10px] sm:text-xs">
                  {typeof metric.value === "number"
                    ? metric.value.toLocaleString()
                    : metric.value}{" "}
                  {metric.unit && (
                    <span className="text-slate-500 text-[9px] ml-0.5">
                      {metric.unit}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
