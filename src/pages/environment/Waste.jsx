// src/pages/environment/Waste.jsx
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
import { FaFilePdf } from "react-icons/fa";
import { GiTrashCan } from "react-icons/gi";
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

export default function Waste() {
  const {
    environmentalMetrics,
    environmentalInsights,
    environmentalBenchmarks,
    loading,
    error,
  } = useContext(SimulationContext);

  const [wasteValues, setWasteValues] = useState(new Array(12).fill(0));
  const [productionDataValues, setProductionDataValues] = useState(
    new Array(12).fill(0)
  );
  const [wasteIntensityValues, setWasteIntensityValues] = useState(
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

  // Populate waste + production + intensity from context
  useEffect(() => {
    if (environmentalMetrics) {
      // 🔁 Adjust field names if needed
      const wasteRaw =
        environmentalMetrics.wasteGenerated ||
        environmentalMetrics.waste ||
        [];
      const productionRaw =
        environmentalMetrics.production || environmentalMetrics.output || [];

      const waste12 = toTwelve(wasteRaw);
      const production12 = toTwelve(productionRaw);

      const intensity12 = waste12.map((w, i) => {
        const p = production12[i] || 1;
        return Number((w / p).toFixed(4));
      });

      setWasteValues(waste12);
      setProductionDataValues(production12);
      setWasteIntensityValues(intensity12);
    } else {
      setWasteValues(new Array(12).fill(0));
      setProductionDataValues(new Array(12).fill(0));
      setWasteIntensityValues(new Array(12).fill(0));
    }

    const insights =
      environmentalInsights && environmentalInsights.length > 0
        ? environmentalInsights.slice(0, 5)
        : [];
    setTopInsights(insights);
  }, [environmentalMetrics, environmentalInsights]);

  // ---------- AI baseline / benchmark like Energy & Carbon ----------

  const nonZeroIntensities = wasteIntensityValues.filter((v) => v > 0);

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
    environmentalBenchmarks?.wasteIntensity ?? baselineIntensity;

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
  const latestIndex = wasteValues.length - 1;
  const latestWaste = wasteValues[latestIndex] || 0;
  const latestProduction = productionDataValues[latestIndex] || 0;
  const latestIntensity = wasteIntensityValues[latestIndex] || 0;

  const wasteData = {
    labels: monthlyLabels,
    datasets: [
      {
        label: "Waste Generated (tonnes)",
        data: wasteValues,
        borderColor: "#f97316",
        backgroundColor: "rgba(249,115,22,0.18)",
        tension: 0.35,
        pointRadius: 3,
      },
      {
        label: "Production Output (tonnes)",
        data: productionDataValues,
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.18)",
        tension: 0.35,
        pointRadius: 3,
      },
    ],
  };

  const intensityData = {
    labels: monthlyLabels,
    datasets: [
      {
        label: "Waste Intensity (tonnes per tonne output)",
        data: wasteIntensityValues,
        borderColor: "#4f46e5",
        backgroundColor: "rgba(79,70,229,0.18)",
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
    doc.text("AfricaESG.AI Waste Performance Report", 14, y);

    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, y);

    y += 10;
    doc.text("Monthly Waste & Production:", 14, y);
    y += 8;

    monthlyLabels.forEach((label, idx) => {
      const line = `${label}: Waste ${
        wasteValues[idx] || 0
      } tonnes, Production ${
        productionDataValues[idx] || 0
      } tonnes, Intensity ${
        wasteIntensityValues[idx] || 0
      } t/t`;
      const wrapped = doc.splitTextToSize(line, 180);
      doc.text(wrapped, 14, y);
      y += wrapped.length * 6;
    });

    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("AI Analysis – Waste & Circularity:", 14, y);
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

    doc.save("AfricaESG_WasteReport.pdf");
  };

  const showEmptyState =
    !loading &&
    !error &&
    wasteValues.every((v) => v === 0) &&
    productionDataValues.every((v) => v === 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-emerald-50/40 to-amber-50 py-10 font-sans flex justify-center">
      <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-amber-700 font-semibold mb-1">
              Environmental · Waste
            </p>
            <h1 className="flex items-center gap-2 text-3xl sm:text-4xl font-extrabold text-amber-900 tracking-tight">
              <GiTrashCan className="text-amber-700 text-3xl sm:text-4xl" />
              Waste & Circularity
            </h1>
            <p className="mt-2 text-sm text-gray-600 max-w-xl">
              Track waste generation, diversion and intensity to support
              circularity and zero-waste targets.
            </p>
            {loading && (
              <p className="mt-2 text-xs text-amber-700 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Loading waste metrics and AI insights…
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
            className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-5 py-2.5 
              text-sm md:text-base font-semibold text-white shadow-md shadow-amber-600/30
              hover:bg-amber-700 hover:shadow-lg hover:shadow-amber-700/25
              active:scale-95 transition-all"
          >
            <FaFilePdf className="text-white text-base md:text-lg" />
            Download Waste Report
          </button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white/80 backdrop-blur rounded-2xl border border-amber-100 shadow-sm px-4 py-3">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
              Latest Waste
            </p>
            <p className="text-2xl font-bold text-amber-900">
              {latestWaste.toLocaleString()}{" "}
              <span className="text-xs font-medium text-gray-500">tonnes</span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Most recent month in your uploaded dataset.
            </p>
          </div>
          <div className="bg-white/80 backdrop-blur rounded-2xl border border-amber-100 shadow-sm px-4 py-3">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
              Latest Production
            </p>
            <p className="text-2xl font-bold text-amber-900">
              {latestProduction.toLocaleString()}{" "}
              <span className="text-xs font-medium text-gray-500">tonnes</span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Output associated with current waste profile.
            </p>
          </div>
          <div className="bg-white/80 backdrop-blur rounded-2xl border border-amber-100 shadow-sm px-4 py-3">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
              Latest Waste Intensity
            </p>
            <p className="text-2xl font-bold text-amber-900">
              {latestIntensity.toFixed(2)}{" "}
              <span className="text-xs font-medium text-gray-500">
                t waste / t output
              </span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Core circularity and waste efficiency KPI.
            </p>
          </div>
        </div>

        {showEmptyState ? (
          <div className="bg-white rounded-2xl shadow-lg border border-dashed border-amber-200 p-10 text-center text-gray-600">
            <p className="text-base font-medium mb-2">
              No waste metrics available yet.
            </p>
            <p className="text-sm text-gray-500 max-w-lg mx-auto">
              Upload ESG data on the main dashboard to populate waste generation
              and intensity for the Waste view.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Charts */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl shadow-lg border border-amber-100/70 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-800">
                    Waste vs Production (Monthly)
                  </h2>
                  <span className="text-[11px] px-2 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold uppercase tracking-wide">
                    Uploaded dataset
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Monthly waste generation profile compared with production volumes.
                </p>
                <div className="h-64 sm:h-72">
                  <Line
                    data={wasteData}
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

              <div className="bg-white rounded-2xl shadow-lg border border-amber-100/70 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-800">
                    Waste Intensity (tonnes per tonne output)
                  </h2>
                  <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold uppercase tracking-wide">
                    Waste KPI
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Waste generated normalised by production – lower is better.
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
              topic="Waste"
              baselineIntensity={baselineIntensity}
              benchmarkIntensity={benchmarkIntensityRaw}
              currentIntensity={currentIntensity}
              comparisonDelta={comparisonDelta}
              comparisonPercent={comparisonPercent}
              insights={topInsights}
              loading={loading}
              intensityUnit="t/t"
              borderColor="amber-100"
            />
          </div>
        )}
      </div>
    </div>
  );
}
