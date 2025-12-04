// src/pages/environment/Water.jsx
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
import { GiWaterDrop } from "react-icons/gi";
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

export default function Water() {
  const {
    environmentalMetrics,
    environmentalInsights,
    environmentalBenchmarks,
    loading,
    error,
  } = useContext(SimulationContext);

  const [waterUseValues, setWaterUseValues] = useState(new Array(12).fill(0));
  const [productionDataValues, setProductionDataValues] = useState(
    new Array(12).fill(0)
  );
  const [waterIntensityValues, setWaterIntensityValues] = useState(
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

  // Populate water + production + intensity from context
  useEffect(() => {
    if (environmentalMetrics) {
      // 🔁 Adjust field names if your backend uses different ones
      const waterRaw =
        environmentalMetrics.waterUse ||
        environmentalMetrics.waterConsumption ||
        [];
      const productionRaw =
        environmentalMetrics.production || environmentalMetrics.output || [];

      const water12 = toTwelve(waterRaw);
      const production12 = toTwelve(productionRaw);

      const intensity12 = water12.map((w, i) => {
        const p = production12[i] || 1;
        return Number((w / p).toFixed(4));
      });

      setWaterUseValues(water12);
      setProductionDataValues(production12);
      setWaterIntensityValues(intensity12);
    } else {
      setWaterUseValues(new Array(12).fill(0));
      setProductionDataValues(new Array(12).fill(0));
      setWaterIntensityValues(new Array(12).fill(0));
    }

    const insights =
      environmentalInsights && environmentalInsights.length > 0
        ? environmentalInsights.slice(0, 5)
        : [];
    setTopInsights(insights);
  }, [environmentalMetrics, environmentalInsights]);

  // ---------- AI-style baseline / benchmark calculations ----------

  const nonZeroIntensities = waterIntensityValues.filter((v) => v > 0);

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
    environmentalBenchmarks?.waterIntensity ?? baselineIntensity;

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
  const latestIndex = waterUseValues.length - 1;
  const latestWaterUse = waterUseValues[latestIndex] || 0;
  const latestProduction = productionDataValues[latestIndex] || 0;
  const latestIntensity = waterIntensityValues[latestIndex] || 0;

  const waterData = {
    labels: monthlyLabels,
    datasets: [
      {
        label: "Water Use (m³)",
        data: waterUseValues,
        borderColor: "#0ea5e9",
        backgroundColor: "rgba(14,165,233,0.18)",
        tension: 0.35,
        pointRadius: 3,
      },
      {
        label: "Production Output (tonnes)",
        data: productionDataValues,
        borderColor: "#10b981",
        backgroundColor: "rgba(16,185,129,0.18)",
        tension: 0.35,
        pointRadius: 3,
      },
    ],
  };

  const intensityData = {
    labels: monthlyLabels,
    datasets: [
      {
        label: "Water Intensity (m³ per tonne)",
        data: waterIntensityValues,
        borderColor: "#6366f1",
        backgroundColor: "rgba(99,102,241,0.18)",
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
    doc.text("AfricaESG.AI Water Use Report", 14, y);

    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, y);

    y += 10;
    doc.text("Monthly Water Use & Production:", 14, y);
    y += 8;

    monthlyLabels.forEach((label, idx) => {
      const line = `${label}: Water ${
        waterUseValues[idx] || 0
      } m³, Production ${
        productionDataValues[idx] || 0
      } tonnes, Intensity ${
        waterIntensityValues[idx] || 0
      } m³/tonne`;
      const wrapped = doc.splitTextToSize(line, 180);
      doc.text(wrapped, 14, y);
      y += wrapped.length * 6;
    });

    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("AI Analysis – Water Performance:", 14, y);
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

    doc.save("AfricaESG_WaterReport.pdf");
  };

  const showEmptyState =
    !loading &&
    !error &&
    waterUseValues.every((v) => v === 0) &&
    productionDataValues.every((v) => v === 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-emerald-50/40 to-sky-50 py-10 font-sans flex justify-center">
      <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-600 font-semibold mb-1">
              Environmental · Water
            </p>
            <h1 className="flex items-center gap-2 text-3xl sm:text-4xl font-extrabold text-sky-900 tracking-tight">
              <GiWaterDrop className="text-sky-600 text-3xl sm:text-4xl" />
              Water Use & Intensity
            </h1>
            <p className="mt-2 text-sm text-gray-600 max-w-xl">
              Monitor water abstraction, consumption and efficiency across your
              operations with AI baseline & benchmark insights.
            </p>
            {loading && (
              <p className="mt-2 text-xs text-sky-700 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
                Loading water metrics and AI insights…
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
            className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-5 py-2.5 
              text-sm md:text-base font-semibold text-white shadow-md shadow-sky-600/30
              hover:bg-sky-700 hover:shadow-lg hover:shadow-sky-700/25
              active:scale-95 transition-all"
          >
            <FaFilePdf className="text-white text-base md:text-lg" />
            Download Water Report
          </button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white/80 backdrop-blur rounded-2xl border border-sky-100 shadow-sm px-4 py-3">
            <p className="text-xs font-semibold text-sky-700 uppercase tracking-wide mb-1">
              Latest Water Use
            </p>
            <p className="text-2xl font-bold text-sky-900">
              {latestWaterUse.toLocaleString()}{" "}
              <span className="text-xs font-medium text-gray-500">m³</span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Most recent month in your uploaded dataset.
            </p>
          </div>
          <div className="bg-white/80 backdrop-blur rounded-2xl border border-sky-100 shadow-sm px-4 py-3">
            <p className="text-xs font-semibold text-sky-700 uppercase tracking-wide mb-1">
              Latest Production
            </p>
            <p className="text-2xl font-bold text-sky-900">
              {latestProduction.toLocaleString()}{" "}
              <span className="text-xs font-medium text-gray-500">tonnes</span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Output associated with current water footprint.
            </p>
          </div>
          <div className="bg-white/80 backdrop-blur rounded-2xl border border-sky-100 shadow-sm px-4 py-3">
            <p className="text-xs font-semibold text-sky-700 uppercase tracking-wide mb-1">
              Latest Water Intensity
            </p>
            <p className="text-2xl font-bold text-sky-900">
              {latestIntensity.toFixed(2)}{" "}
              <span className="text-xs font-medium text-gray-500">
                m³ / tonne
              </span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Core water efficiency KPI.
            </p>
          </div>
        </div>

        {showEmptyState ? (
          <div className="bg-white rounded-2xl shadow-lg border border-dashed border-sky-200 p-10 text-center text-gray-600">
            <p className="text-base font-medium mb-2">
              No water metrics available yet.
            </p>
            <p className="text-sm text-gray-500 max-w-lg mx-auto">
              Upload ESG data on the main dashboard to populate water use and
              intensity for the Water view.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Charts */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl shadow-lg border border-sky-100/70 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-800">
                    Water Use vs Production (Monthly)
                  </h2>
                  <span className="text-[11px] px-2 py-1 rounded-full bg-sky-50 text-sky-700 font-semibold uppercase tracking-wide">
                    Uploaded dataset
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Monthly water use profile compared with production volumes.
                </p>
                <div className="h-64 sm:h-72">
                  <Line
                    data={waterData}
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

              <div className="bg-white rounded-2xl shadow-lg border border-sky-100/70 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-800">
                    Water Intensity (m³ per tonne)
                  </h2>
                  <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold uppercase tracking-wide">
                    Water KPI
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Water use normalised by production – lower is better.
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
              topic="Water"
              baselineIntensity={baselineIntensity}
              benchmarkIntensity={benchmarkIntensityRaw}
              currentIntensity={currentIntensity}
              comparisonDelta={comparisonDelta}
              comparisonPercent={comparisonPercent}
              insights={topInsights}
              loading={loading}
              intensityUnit="m³/tonne"
              borderColor="sky-100"
            />
          </div>
        )}
      </div>
    </div>
  );
}
