// src/components/AIInsightPanel.jsx
import React from "react";

/**
 * Shared AI Insight Panel component for Environmental pages
 * Displays baseline, benchmark, performance comparison, and AI recommendations
 * 
 * @param {Object} props
 * @param {string} props.topic - Topic name (e.g., "Carbon", "Energy", "Water", "Waste", "Coal")
 * @param {number|null} props.baselineIntensity - Baseline intensity value
 * @param {number|null} props.benchmarkIntensity - Benchmark/target intensity value
 * @param {number|null} props.currentIntensity - Current intensity value
 * @param {number|null} props.comparisonDelta - Difference between current and benchmark
 * @param {number|null} props.comparisonPercent - Percentage difference
 * @param {string[]} props.insights - Array of AI insight strings
 * @param {boolean} props.loading - Loading state
 * @param {string} props.intensityUnit - Unit for intensity (e.g., "tCO₂e/tonne", "MWh/tonne")
 * @param {string} props.baselineLabel - Label for baseline (optional, defaults to "Average early-period {topic} intensity")
 * @param {string} props.benchmarkLabel - Label for benchmark (optional)
 * @param {string} props.borderColor - Tailwind border color class (e.g., "rose-100", "teal-100")
 */
export default function AIInsightPanel({
  topic,
  baselineIntensity,
  benchmarkIntensity,
  currentIntensity,
  comparisonDelta,
  comparisonPercent,
  insights = [],
  loading = false,
  intensityUnit,
  baselineLabel,
  benchmarkLabel,
  borderColor = "gray-100",
}) {
  const formatNumber = (value, decimals = 1) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "N/A";
    }
    return Number(value).toFixed(decimals);
  };

  const defaultBaselineLabel = baselineLabel || 
    `Average early-period ${topic.toLowerCase()} intensity`;
  const defaultBenchmarkLabel = benchmarkLabel || 
    `Target / benchmark ${topic.toLowerCase()} intensity`;

  // Map border color names to full Tailwind classes
  const borderColorMap = {
    "rose-100": "border-rose-100/80",
    "teal-100": "border-teal-100/80",
    "sky-100": "border-sky-100/80",
    "amber-100": "border-amber-100/80",
    "slate-100": "border-slate-100/80",
    "gray-100": "border-gray-100/80",
  };
  
  const borderClass = borderColorMap[borderColor] || "border-gray-100/80";

  return (
    <div className={`bg-white rounded-2xl shadow-lg border ${borderClass} p-6 flex flex-col`}>
      <h2 className="text-xl font-semibold text-gray-800 mb-2">
        AI Analysis – {topic}
      </h2>
      <p className="text-xs text-gray-500 mb-3">
        Baseline, benchmark and performance vs target for {topic.toLowerCase()}{" "}
        intensity, plus AI recommendations.
      </p>

      {/* 1. Baseline */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">
          1. Baseline
        </h3>
        {baselineIntensity == null ? (
          <p className="text-xs text-gray-500">
            Upload at least one month of data to establish a baseline{" "}
            {topic.toLowerCase()} intensity.
          </p>
        ) : (
          <p className="text-sm text-gray-700">
            {defaultBaselineLabel} is{" "}
            <span className="font-semibold">
              {formatNumber(baselineIntensity)} {intensityUnit}
            </span>
            {!baselineLabel && ", based on the first non-zero months in your dataset."}
          </p>
        )}
      </div>

      {/* 2. Benchmark */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">
          2. Benchmark
        </h3>
        {benchmarkIntensity == null ? (
          <p className="text-xs text-gray-500">
            No benchmark provided yet. The baseline is currently used as a proxy
            benchmark for {topic.toLowerCase()} intensity.
          </p>
        ) : (
          <p className="text-sm text-gray-700">
            {defaultBenchmarkLabel} is{" "}
            <span className="font-semibold">
              {formatNumber(benchmarkIntensity)} {intensityUnit}
            </span>
            .
          </p>
        )}
      </div>

      {/* 3. Performance vs benchmark */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">
          3. Performance vs benchmark
        </h3>
        {comparisonDelta == null ? (
          <p className="text-xs text-gray-500">
            Once both current and benchmark values are available, we will show
            how far your {topic.toLowerCase()} intensity is above or below target.
          </p>
        ) : (
          <p className="text-sm text-gray-700">
            Latest {topic.toLowerCase()} intensity is{" "}
            <span className="font-semibold">
              {formatNumber(currentIntensity)} {intensityUnit}
            </span>
            , which is{" "}
            <span
              className={`font-semibold ${
                comparisonDelta > 0 ? "text-red-600" : "text-emerald-600"
              }`}
            >
              {formatNumber(Math.abs(comparisonPercent), 1)}%
              {comparisonDelta > 0 ? " above" : " below"}
            </span>{" "}
            the benchmark.
          </p>
        )}
      </div>

      {/* 4. AI Recommendations */}
      <div className="mt-2">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          4. AI Recommendations
        </h3>
        <ul className="list-disc list-inside text-gray-700 space-y-2 text-sm sm:text-base leading-relaxed max-h-[260px] overflow-y-auto pr-1">
          {loading ? (
            <li className="text-gray-400">
              Loading AI insights for {topic.toLowerCase()} performance…
            </li>
          ) : insights.length > 0 ? (
            insights.map((note, idx) => <li key={idx}>{note}</li>)
          ) : (
            <li className="text-gray-400">
              No AI insights available for this dataset yet.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

