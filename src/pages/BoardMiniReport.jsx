// src/pages/BoardMiniReport.jsx
import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../config/api";

export default function BoardMiniReport() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/api/esg-mini-report`);
        if (!res.ok) {
          throw new Error(`/api/esg-mini-report ${res.status}`);
        }
        const data = await res.json();
        setReport(data);
      } catch (err) {
        console.error("Error loading ESG mini report:", err);
        setError(err.message || "Failed to load ESG mini report.");
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, []);

  return (
    <div className="min-h-screen bg-lime-50 py-10 font-sans flex justify-center">
      <div className="w-full max-w-5xl px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Board ESG Mini Report
            </h1>
            <p className="mt-2 text-sm text-gray-600 max-w-2xl">
              Baseline, benchmark, performance vs benchmark and AI
              recommendations – generated from the latest ESG dataset and tuned
              for Board / EXCO discussions.
            </p>
            <p className="mt-1 text-[11px] text-emerald-700 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live AI – powered by AfricaESG.AI and your most recent upload
              (Excel / JSON).
            </p>
          </div>
        </header>

        {/* Loading / error states */}
        {loading && (
          <div className="bg-white border border-emerald-100 rounded-2xl shadow-sm p-4 text-sm text-emerald-700">
            Fetching live board mini report…
          </div>
        )}

        {error && !loading && (
          <div className="bg-white border border-red-100 rounded-2xl shadow-sm p-4 text-sm text-red-700">
            Failed to load mini report: {error}
          </div>
        )}

        {/* Content */}
        {!loading && !error && report && (
          <div className="space-y-5">
            {/* Top: Baseline + Benchmark */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Baseline */}
              <section className="bg-white rounded-2xl shadow-lg border border-slate-200 p-5 flex flex-col">
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  1. Baseline
                </h2>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {report.baseline}
                </p>
                <p className="mt-3 text-[11px] text-slate-400">
                  Describes the current ESG position using your latest scores
                  (E/S/G) and reporting period.
                </p>
              </section>

              {/* Benchmark */}
              <section className="bg-white rounded-2xl shadow-lg border border-slate-200 p-5 flex flex-col">
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  2. Benchmark
                </h2>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {report.benchmark}
                </p>
                <p className="mt-3 text-[11px] text-slate-400">
                  Positions your organisation against a realistic peer band for
                  African corporates (0–100 ESG score range).
                </p>
              </section>
            </div>

            {/* Middle: Performance vs Benchmark */}
            <section className="bg-white rounded-2xl shadow-lg border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-1">
                3. Performance vs Benchmark
              </h2>
              <p className="text-sm text-slate-700 leading-relaxed">
                {report.performance_vs_benchmark}
              </p>
              <p className="mt-3 text-[11px] text-slate-400">
                Highlights whether you are ahead, on par or behind the
                benchmark, and calls out E/S/G performance differences at a
                glance.
              </p>
            </section>

            {/* Bottom: AI Recommendations */}
            <section className="bg-white rounded-2xl shadow-lg border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                  4. AI Recommendations
                </h2>
                <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                  Actionable next steps
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                3–5 concise, action-oriented recommendations derived from your
                ESG position and benchmark – suitable for inclusion in Board /
                EXCO packs.
              </p>

              <ul className="list-decimal list-inside space-y-2 text-sm text-slate-700">
                {(report.ai_recommendations || []).map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
                {(!report.ai_recommendations ||
                  report.ai_recommendations.length === 0) && (
                  <li className="text-xs text-slate-400">
                    No AI recommendations returned.
                  </li>
                )}
              </ul>
            </section>

            {/* Footer note */}
            <p className="text-[11px] text-slate-400 text-right">
              Mini report generated live from{" "}
              <span className="font-medium text-slate-500">
                /api/esg-mini-report
              </span>{" "}
              using the latest ESG dataset.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
