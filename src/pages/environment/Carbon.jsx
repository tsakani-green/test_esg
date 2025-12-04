// src/pages/environment/Carbon.jsx
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
import { FaFilePdf, FaCloud } from "react-icons/fa";
import { jsPDF } from "jspdf";
import { SimulationContext } from "../../context/SimulationContext";
import AIInsightPanel from "../../components/AIInsightPanel";
import { API_BASE_URL } from "../../config/api";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
);

export default function Carbon() {
  const {
    environmentalMetrics,
    environmentalInsights,
    environmentalBenchmarks,
    loading,
    error,
  } = useContext(SimulationContext);

  const [emissionDataValues, setEmissionDataValues] = useState(
    new Array(12).fill(0)
  );
  const [productionDataValues, setProductionDataValues] = useState(
    new Array(12).fill(0)
  );
  const [carbonIntensityValues, setCarbonIntensityValues] = useState(
    new Array(12).fill(0)
  );
  const [topInsights, setTopInsights] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

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

  // Populate emissions + production + intensity from context
  useEffect(() => {
    if (environmentalMetrics) {
      const emissionsRaw =
        environmentalMetrics.co2Emissions ||
        environmentalMetrics.emissions ||
        [];
      const productionRaw =
        environmentalMetrics.production || environmentalMetrics.output || [];

      const emissions12 = toTwelve(emissionsRaw);
      const production12 = toTwelve(productionRaw);

      const intensity12 = emissions12.map((e, i) => {
        const p = production12[i] || 1;
        return Number((e / p).toFixed(4));
      });

      setEmissionDataValues(emissions12);
      setProductionDataValues(production12);
      setCarbonIntensityValues(intensity12);
    } else {
      setEmissionDataValues(new Array(12).fill(0));
      setProductionDataValues(new Array(12).fill(0));
      setCarbonIntensityValues(new Array(12).fill(0));
    }
  }, [environmentalMetrics]);

  // Load live carbon insights from backend with context fallback
  useEffect(() => {
    const topicKeywords = [
      "carbon",
      "co2",
      "emission",
      "emissions",
      "ghg",
      "scope",
    ];
    const matchesTopic = (text = "") => {
      const lower = String(text).toLowerCase();
      return topicKeywords.some((kw) => lower.includes(kw));
    };

    const fallbackInsights = Array.isArray(environmentalInsights)
      ? environmentalInsights
      : [];
    const fallbackFiltered = fallbackInsights.filter(matchesTopic);

    const loadInsights = async () => {
      try {
        setAiLoading(true);
        setAiError(null);

        const res = await fetch(`${API_BASE_URL}/api/environmental-insights`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(
            `Environmental insights request failed (${res.status}): ${text}`
          );
        }

        const data = await res.json();
        const incoming = Array.isArray(data.insights)
          ? data.insights
          : data.insights
          ? [data.insights]
          : [];

        const filtered = incoming.filter(matchesTopic);
        if (filtered.length > 0) {
          setTopInsights(filtered.slice(0, 5));
        } else {
          setTopInsights(
            (fallbackFiltered.length > 0
              ? fallbackFiltered
              : fallbackInsights
            ).slice(0, 5)
          );
        }
      } catch (err) {
        console.error("Carbon AI insights error:", err);
        setAiError(
          err.message || "Failed to load live AI insights for carbon."
        );
        setTopInsights(
          (fallbackFiltered.length > 0
            ? fallbackFiltered
            : fallbackInsights
          ).slice(0, 5)
        );
      } finally {
        setAiLoading(false);
      }
    };

    loadInsights();
  }, [environmentalInsights]);

  // ---------- AI-style baseline / benchmark calculations ----------

  const nonZeroIntensities = carbonIntensityValues.filter((v) => v > 0);

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
    environmentalBenchmarks?.carbonIntensity ?? baselineIntensity;

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
  const latestIndex = emissionDataValues.length - 1;
  const latestEmissions = emissionDataValues[latestIndex] || 0;
  const latestProduction = productionDataValues[latestIndex] || 0;
  const latestIntensity = carbonIntensityValues[latestIndex] || 0;

  const emissionData = {
    labels: monthlyLabels,
    datasets: [
      {
        label: "CO₂ Emissions (tCO₂e)",
        data: emissionDataValues,
        borderColor: "#ef4444",
        backgroundColor: "rgba(239,68,68,0.18)",
        tension: 0.35,
        pointRadius: 3,
      },
      {
        label: "Production Output (tonnes)",
        data: productionDataValues,
        borderColor: "#0ea5e9",
        backgroundColor: "rgba(14,165,233,0.18)",
        tension: 0.35,
        pointRadius: 3,
      },
    ],
  };

  const intensityData = {
    labels: monthlyLabels,
    datasets: [
      {
        label: "Carbon Intensity (tCO₂e per tonne)",
        data: carbonIntensityValues,
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
    doc.text("AfricaESG.AI Carbon Emissions Report", 14, y);

    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, y);

    y += 10;
    doc.text("Monthly CO₂ Emissions & Production:", 14, y);
    y += 8;

    monthlyLabels.forEach((label, idx) => {
      const line = `${label}: Emissions ${
        emissionDataValues[idx] || 0
      } tCO₂e, Production ${
        productionDataValues[idx] || 0
      } tonnes, Intensity ${
        carbonIntensityValues[idx] || 0
      } tCO₂e/tonne`;
      const wrapped = doc.splitTextToSize(line, 180);
      doc.text(wrapped, 14, y);
      y += wrapped.length * 6;
    });

    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("AI Analysis – Carbon Performance:", 14, y);
    y += 8;

    (topInsights.length > 0
      ? topInsights
      : ["No AI insights available for this dataset."]
    ).forEach((note) => {
      const wrapped = doc.splitTextToSize(`• ${note}`, 180);
      doc.setFont("helvetica", "normal");
      doc.text(wrapped, 14, y);
      y += wrapped.length * 6;
    });

    doc.save("AfricaESG_CarbonReport.pdf");
  };

  const showEmptyState =
    !loading &&
    !error &&
    emissionDataValues.every((v) => v === 0) &&
    productionDataValues.every((v) => v === 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-emerald-50/40 to-rose-50 py-10 font-sans flex justify-center">
      <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-rose-600 font-semibold mb-1">
              Environmental · Carbon
            </p>
            <h1 className="flex items-center gap-2 text-3xl sm:text-4xl font-extrabold text-rose-900 tracking-tight">
              <FaCloud className="text-rose-600 text-3xl sm:text-4xl" />
              Carbon Emissions & Intensity
            </h1>
            <p className="mt-2 text-sm text-gray-600 max-w-xl">
              Track emissions trends, production output and carbon intensity to
              support decarbonisation and carbon tax planning.
            </p>
            {loading && (
              <p className="mt-2 text-xs text-rose-700 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                Loading carbon metrics and AI insights…
              </p>
            )}
            {aiLoading && !loading && (
              <p className="mt-2 text-xs text-rose-700 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                Loading live AI insights for carbon…
              </p>
            )}
            {error && (
              <p className="mt-2 text-xs text-red-600">
                {error}
              </p>
            )}
            {aiError && (
              <p className="mt-1 text-xs text-red-500">{aiError}</p>
            )}
          </div>

          <button
            onClick={handleDownloadReport}
            className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-5 py-2.5 
              text-sm md:text-base font-semibold text-white shadow-md shadow-rose-600/30
              hover:bg-rose-700 hover:shadow-lg hover:shadow-rose-700/25
              active:scale-95 transition-all"
          >
            <FaFilePdf className="text-white text-base md:text-lg" />
            Download Carbon Report
          </button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white/80 backdrop-blur rounded-2xl border border-rose-100 shadow-sm px-4 py-3">
            <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide mb-1">
              Latest Emissions
            </p>
            <p className="text-2xl font-bold text-rose-900">
              {latestEmissions.toLocaleString()}{" "}
              <span className="text-xs font-medium text-gray-500">tCO₂e</span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Most recent month in your uploaded dataset.
            </p>
          </div>
          <div className="bg-white/80 backdrop-blur rounded-2xl border border-rose-100 shadow-sm px-4 py-3">
            <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide mb-1">
              Latest Production
            </p>
            <p className="text-2xl font-bold text-rose-900">
              {latestProduction.toLocaleString()}{" "}
              <span className="text-xs font-medium text-gray-500">tonnes</span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Output associated with current emissions.
            </p>
          </div>
          <div className="bg-white/80 backdrop-blur rounded-2xl border border-rose-100 shadow-sm px-4 py-3">
            <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide mb-1">
              Latest Carbon Intensity
            </p>
            <p className="text-2xl font-bold text-rose-900">
              {latestIntensity.toFixed(2)}{" "}
              <span className="text-xs font-medium text-gray-500">
                tCO₂e / tonne
              </span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Key KPI for decarbonisation pathways.
            </p>
          </div>
        </div>

        {showEmptyState ? (
          <div className="bg-white rounded-2xl shadow-lg border border-dashed border-rose-200 p-10 text-center text-gray-600">
            <p className="text-base font-medium mb-2">
              No carbon metrics available yet.
            </p>
            <p className="text-sm text-gray-500 max-w-lg mx-auto">
              Upload ESG data on the main dashboard to populate monthly CO₂
              emissions and intensity for the Carbon view.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Charts */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl shadow-lg border border-rose-100/70 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-800">
                    CO₂ Emissions vs Production (Monthly)
                  </h2>
                  <span className="text-[11px] px-2 py-1 rounded-full bg-rose-50 text-rose-700 font-semibold uppercase tracking-wide">
                    Uploaded dataset
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Monthly emissions profile compared with production volumes.
                </p>
                <div className="h-64 sm:h-72">
                  <Line
                    data={emissionData}
                    options={{
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: "bottom", labels: { boxWidth: 12 } },
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

              <div className="bg-white rounded-2xl shadow-lg border border-rose-100/70 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-800">
                    Carbon Intensity (tCO₂e per tonne)
                  </h2>
                  <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold uppercase tracking-wide">
                    Carbon KPI
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Emissions normalised by production – lower is better.
                </p>
                <div className="h-64 sm:h-72">
                  <Line
                    data={intensityData}
                    options={{
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: "bottom", labels: { boxWidth: 12 } },
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

            {/* AI Baseline / Benchmark / Comparison / Recommendations */}
            <AIInsightPanel
              topic="Carbon"
              baselineIntensity={baselineIntensity}
              benchmarkIntensity={benchmarkIntensityRaw}
              currentIntensity={currentIntensity}
              comparisonDelta={comparisonDelta}
              comparisonPercent={comparisonPercent}
              insights={topInsights}
              loading={loading || aiLoading}
              intensityUnit="tCO₂e/tonne"
              borderColor="rose-100"
            />
          </div>
        )}
      </div>
    </div>
  );
}
