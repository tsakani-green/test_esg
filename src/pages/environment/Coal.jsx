// src/pages/environment/Coal.jsx
import React, { useContext, useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";
import { FaFilePdf, FaIndustry } from "react-icons/fa";
import { jsPDF } from "jspdf";
import { SimulationContext } from "../../context/SimulationContext";
import AIInsightPanel from "../../components/AIInsightPanel";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
);

export default function Coal() {
  const {
    environmentalMetrics,
    environmentalInsights,
    environmentalBenchmarks,
    loading,
    error,
  } = useContext(SimulationContext);

  const [coalUseValues, setCoalUseValues] = useState(new Array(12).fill(0));
  const [emissionValues, setEmissionValues] = useState(new Array(12).fill(0));
  const [intensityValues, setIntensityValues] = useState(
    new Array(12).fill(0)
  );
  const [topInsights, setTopInsights] = useState([]);

  const monthlyLabels = [
    "Jan-24",
    "Feb-24",
    "Mar-24",
    "Apr-24",
    "May-24",
    "Jun-24",
    "Jul-24",
    "Aug-24",
    "Sep-24",
    "Oct-24",
    "Nov-24",
    "Dec-24",
  ];

  const toTwelve = (arr) =>
    monthlyLabels.map((_, i) => {
      const v = Array.isArray(arr) ? arr[i] : 0;
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    });

  // Populate coal use + emissions + intensity from context
  useEffect(() => {
    if (environmentalMetrics) {
      const coalRaw =
        environmentalMetrics.coalUse ||
        environmentalMetrics.coalConsumption ||
        [];
      const emissionsRaw =
        environmentalMetrics.co2Emissions ||
        environmentalMetrics.emissions ||
        [];

      const coal12 = toTwelve(coalRaw);
      const emissions12 = toTwelve(emissionsRaw);

      const intensity12 = coal12.map((c, i) => {
        const coalT = c || 1;
        const e = emissions12[i] || 0;
        return Number((e / coalT).toFixed(4));
      });

      setCoalUseValues(coal12);
      setEmissionValues(emissions12);
      setIntensityValues(intensity12);
    } else {
      setCoalUseValues(new Array(12).fill(0));
      setEmissionValues(new Array(12).fill(0));
      setIntensityValues(new Array(12).fill(0));
    }

    const insights =
      environmentalInsights && environmentalInsights.length > 0
        ? environmentalInsights.slice(0, 5)
        : [];
    setTopInsights(insights);
  }, [environmentalMetrics, environmentalInsights]);

  // ---------- AI-style baseline / benchmark like Water/Waste ----------

  const nonZeroIntensities = intensityValues.filter((v) => v > 0);

  let baselineIntensity = null;
  if (nonZeroIntensities.length > 0) {
    const baselineSlice = nonZeroIntensities.slice(0, 3);
    baselineIntensity =
      baselineSlice.reduce((sum, v) => sum + v, 0) / baselineSlice.length;
  }

  let currentIntensity = null;
  if (nonZeroIntensities.length > 0) {
    currentIntensity = nonZeroIntensities[nonZeroIntensities.length - 1];
  }

  const benchmarkIntensityRaw =
    environmentalBenchmarks?.coalIntensity ?? baselineIntensity;

  const comparisonDelta =
    currentIntensity != null && benchmarkIntensityRaw != null
      ? currentIntensity - benchmarkIntensityRaw
      : null;

  const comparisonPercent =
    currentIntensity != null &&
    benchmarkIntensityRaw != null &&
    benchmarkIntensityRaw !== 0
      ? (comparisonDelta / benchmarkIntensityRaw) * 100
      : null;

  // ---------- Charts ----------
  const latestIndex = coalUseValues.length - 1;
  const latestCoal = coalUseValues[latestIndex] || 0;
  const latestEmissions = emissionValues[latestIndex] || 0;
  const latestIntensity = intensityValues[latestIndex] || 0;

  const coalData = {
    labels: monthlyLabels,
    datasets: [
      {
        label: "Coal Consumption (tonnes)",
        data: coalUseValues,
        borderColor: "#334155",
        backgroundColor: "rgba(51,65,85,0.18)",
        tension: 0.35,
        pointRadius: 3,
      },
      {
        label: "CO₂ Emissions (tCO₂e)",
        data: emissionValues,
        borderColor: "#f97316",
        backgroundColor: "rgba(249,115,22,0.18)",
        tension: 0.35,
        pointRadius: 3,
      },
    ],
  };

  const intensityData = {
    labels: monthlyLabels,
    datasets: [
      {
        label: "Carbon Intensity (tCO₂e per tonne coal)",
        data: intensityValues,
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.18)",
        tension: 0.35,
        pointRadius: 3,
      },
    ],
  };

  const handleDownloadReport = () => {
    const doc = new jsPDF();
    let y = 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("AfricaESG.AI Coal Emissions Report", 14, y);

    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, y);

    y += 10;
    doc.text("Coal Consumption & CO₂ Emissions:", 14, y);
    y += 8;

    monthlyLabels.forEach((label, idx) => {
      const line = `${label}: Coal ${
        coalUseValues[idx] || 0
      } tonnes, Emissions ${
        emissionValues[idx] || 0
      } tCO₂e, Intensity ${intensityValues[idx] || 0} tCO₂e/t coal`;
      const wrapped = doc.splitTextToSize(line, 180);
      doc.text(wrapped, 14, y);
      y += wrapped.length * 6;
    });

    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("AI Analysis – Coal Emissions:", 14, y);
    y += 8;

    (topInsights.length > 0
      ? topInsights
      : ["No AI insights available for coal emissions."]
    ).forEach((note) => {
      const wrapped = doc.splitTextToSize(`• ${note}`, 180);
      doc.setFont("helvetica", "normal");
      doc.text(wrapped, 14, y);
      y += wrapped.length * 6;
    });

    doc.save("AfricaESG_CoalReport.pdf");
  };

  const showEmptyState =
    !loading &&
    !error &&
    coalUseValues.every((v) => v === 0) &&
    emissionValues.every((v) => v === 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-stone-50/40 to-slate-50 py-10 font-sans flex justify-center">
      <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-600 font-semibold mb-1">
              Environmental · Coal
            </p>
            <h1 className="flex items-center gap-2 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              <FaIndustry className="text-slate-700 text-3xl sm:text-4xl" />
              <span>Coal Consumption & Emissions</span>
            </h1>
            <p className="mt-2 text-sm text-gray-600 max-w-xl">
              Understand the relationship between coal usage and associated
              CO₂ emissions, including intensity per tonne of coal.
            </p>
            {(loading) && (
              <p className="mt-2 text-xs text-slate-700 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-slate-500 animate-pulse" />
                Loading coal metrics and AI insights…
              </p>
            )}
            {error && (
              <p className="mt-2 text-xs text-red-600">
                {error}
              </p>
            )}
          </div>

          <button
            onClick={handleDownloadReport}
            className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-5 py-2.5 
              text-sm md:text-base font-semibold text-white shadow-md shadow-slate-800/30
              hover:bg-slate-900 hover:shadow-lg hover:shadow-slate-900/25
              active:scale-95 transition-all"
          >
            <FaFilePdf className="text-white text-base md:text-lg" />
            Download Coal Report
          </button>
        </div>

        {/* Quick Stats */}
        {!showEmptyState && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-100 shadow-sm px-4 py-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                Latest Coal Use
              </p>
              <p className="text-2xl font-bold text-slate-900">
                {latestCoal.toLocaleString()}{" "}
                <span className="text-xs font-medium text-gray-500">tonnes</span>
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Coal consumed in the latest reporting month.
              </p>
            </div>
            <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-100 shadow-sm px-4 py-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                Latest CO₂ Emissions
              </p>
              <p className="text-2xl font-bold text-slate-900">
                {latestEmissions.toLocaleString()}{" "}
                <span className="text-xs font-medium text-gray-500">
                  tCO₂e
                </span>
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Emissions associated with coal combustion.
              </p>
            </div>
            <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-100 shadow-sm px-4 py-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                Latest Coal Intensity
              </p>
              <p className="text-2xl font-bold text-slate-900">
                {latestIntensity.toFixed(2)}{" "}
                <span className="text-xs font-medium text-gray-500">
                  tCO₂e / t coal
                </span>
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Emissions per tonne of coal consumed.
              </p>
            </div>
          </div>
        )}

        {showEmptyState ? (
          <div className="bg-white rounded-2xl shadow-lg border border-dashed border-slate-200 p-10 text-center text-gray-600">
            <p className="text-base font-medium mb-2">
              No coal metrics available yet.
            </p>
            <p className="text-sm text-gray-500 max-w-lg mx-auto">
              Upload ESG data on the main dashboard to populate coal use and
              emissions for this view.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Charts */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl shadow-lg border border-slate-100/70 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-800">
                    Coal Consumption vs CO₂ Emissions
                  </h2>
                  <span className="text-[11px] px-2 py-1 rounded-full bg-slate-50 text-slate-700 font-semibold uppercase tracking-wide">
                    Uploaded dataset
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Coal usage over time and the resulting emissions profile.
                </p>
                <div className="h-64 sm:h-72">
                  <Line
                    data={coalData}
                    options={{
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: "bottom",
                          labels: { boxWidth: 12 },
                        },
                      },
                      scales: {
                        x: { grid: { display: false } },
                        y: {
                          grid: { color: "#e5e7eb" },
                          beginAtZero: true,
                        },
                      },
                    }}
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-lg border border-slate-100/70 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-800">
                    Carbon Intensity (tCO₂e / tonne coal)
                  </h2>
                  <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold uppercase tracking-wide">
                    Intensity KPI
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Emissions efficiency of coal combustion, supporting fuel
                  switching and abatement decisions.
                </p>
                <div className="h-64 sm:h-72">
                  <Line
                    data={intensityData}
                    options={{
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: "bottom",
                          labels: { boxWidth: 12 },
                        },
                      },
                      scales: {
                        x: { grid: { display: false } },
                        y: {
                          grid: { color: "#e5e7eb" },
                          beginAtZero: true,
                        },
                      },
                    }}
                  />
                </div>
              </div>
            </div>

            {/* AI baseline / benchmark / comparison / recommendations */}
            <AIInsightPanel
              topic="Coal Emissions"
              baselineIntensity={baselineIntensity}
              benchmarkIntensity={benchmarkIntensityRaw}
              currentIntensity={currentIntensity}
              comparisonDelta={comparisonDelta}
              comparisonPercent={comparisonPercent}
              insights={topInsights}
              loading={loading}
              intensityUnit="tCO₂e/t coal"
              borderColor="slate-100"
            />
          </div>
        )}
      </div>
    </div>
  );
}
