// src/pages/governance/EthicsCompliance.jsx
import React, { useContext } from "react";
import { SimulationContext } from "../../context/SimulationContext";

export default function EthicsCompliance() {
  const { governanceInsights, loading, error } =
    useContext(SimulationContext) || {};

  const insights =
    governanceInsights && governanceInsights.ethics
      ? governanceInsights.ethics
      : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-slate-50 to-emerald-50 py-10 font-sans flex justify-center">
      <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-700 font-semibold mb-1">
              Governance · Ethics & Compliance
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Ethics & Compliance
            </h1>
            <p className="mt-2 text-sm text-gray-600 max-w-xl">
              Monitor integrity, anti-corruption controls, whistle-blowing,
              training and compliance incidents across your organisation.
            </p>
            {error && (
              <p className="mt-2 text-xs text-red-600">
                {error}
              </p>
            )}
          </div>

          <div className="text-xs text-gray-500 space-y-1">
            <p>Track policy coverage, training and incident response.</p>
            <p>Aligned with typical ESG & governance disclosures.</p>
          </div>
        </div>

        {/* Top metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 px-4 py-4">
            <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-1">
              Code of Ethics Coverage
            </p>
            <p className="text-2xl font-bold text-emerald-900">
              100%
              <span className="ml-1 text-xs font-medium text-gray-500">
                employees
              </span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Proportion of employees covered by the code of ethics.
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 px-4 py-4">
            <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-1">
              Ethics Training Completion
            </p>
            <p className="text-2xl font-bold text-emerald-900">
              85%
              <span className="ml-1 text-xs font-medium text-gray-500">
                YTD
              </span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Employees who completed mandatory ethics training this year.
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 px-4 py-4">
            <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-1">
              Reported Incidents
            </p>
            <p className="text-2xl font-bold text-emerald-900">
              3
              <span className="ml-1 text-xs font-medium text-gray-500">
                open cases
              </span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Whistle-blowing / ethics cases currently under investigation.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Policies & controls */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-lg border border-emerald-100/70 p-6">
              <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-3">
                Ethics & Compliance Framework
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Capture your ethics and compliance architecture, covering
                policies, controls and reporting mechanisms.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                  <h3 className="font-semibold text-emerald-900 mb-2">
                    Key Policies
                  </h3>
                  <ul className="list-disc list-inside text-emerald-900/90 space-y-1">
                    <li>Code of ethics & conduct</li>
                    <li>Anti-corruption & bribery policy</li>
                    <li>Gifts, hospitality & conflict-of-interest policy</li>
                  </ul>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                  <h3 className="font-semibold text-emerald-900 mb-2">
                    Reporting & Controls
                  </h3>
                  <ul className="list-disc list-inside text-emerald-900/90 space-y-1">
                    <li>Whistle-blowing channels</li>
                    <li>Case management & investigation process</li>
                    <li>Disciplinary & remediation procedures</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-emerald-100/70 p-6">
              <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-3">
                Training & Awareness
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Track ethics and compliance training across roles, regions and
                risk-exposed functions.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                    High-risk roles
                  </p>
                  <p className="text-2xl font-bold text-slate-900">95%</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Ethics training completion in high-risk positions.
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                    Third-party training
                  </p>
                  <p className="text-2xl font-bold text-slate-900">60%</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Suppliers exposed to ethics & compliance training.
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                    Refresher cycles
                  </p>
                  <p className="text-2xl font-bold text-slate-900">Annual</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Frequency of ethics training per employee group.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* AI ethics insights */}
          <div className="bg-white rounded-2xl shadow-lg border border-emerald-100/80 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold text-slate-900">
                AI Analysis – Ethics & Compliance
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Live AI
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Prioritised focus areas related to misconduct risk, training
              coverage and incident management.
            </p>

            <ul className="list-disc list-inside text-gray-700 space-y-2 text-sm leading-relaxed max-h-[360px] overflow-y-auto pr-1">
              {loading ? (
                <li className="text-gray-400">
                  Loading ethics & compliance insights…
                </li>
              ) : insights.length > 0 ? (
                insights.map((note, idx) => <li key={idx}>{note}</li>)
              ) : (
                <li className="text-gray-400">
                  No AI insights available. Upload ethics incidents, training
                  stats and policy coverage to unlock analytics.
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
