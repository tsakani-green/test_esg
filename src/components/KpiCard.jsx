import React from "react";

const KpiCard = ({ icon, title, value, indicator }) => (
  <div
    className="
      bg-white rounded-2xl shadow-lg border border-gray-200 p-4
      transition-transform hover:scale-[1.02] hover:shadow-xl hover:bg-lime-100
      flex flex-col h-full
    "
  >
    {/* Icon + Title */}
    <div className="flex items-center gap-2 mb-2">
      <div className="text-green-600 text-xl">
        {icon}
      </div>
      <h3 className="text-gray-800 text-[11px] sm:text-xs font-semibold leading-snug">
        {title}
      </h3>
    </div>

    {/* Value + Indicator */}
    <div className="mt-auto flex items-center justify-between gap-2">
      <span className="text-[11px] sm:text-sm font-bold text-green-800 truncate">
        {value}
      </span>

      {indicator && (
        <span className="flex-shrink-0">{indicator}</span>
      )}
    </div>
  </div>
);

export default KpiCard;
