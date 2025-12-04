// src/pages/governance/SupplyChainGovernance.jsx
import React, { useContext } from "react";
import { SimulationContext } from "../../context/SimulationContext";

export default function SupplyChainGovernance() {
  const { governanceInsights, loading, error } =
    useContext(SimulationContext) || {};

  const insights =
    governanceInsights && governanceInsights.supplyChain
      ? governanceInsights.supplyChain
      : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-emerald-50/40 to-amber-50 py-10 font-sans flex justify-center">
      <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-amber-700 font-semibold mb-1">
              Governance · Supply Chain
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-amber-900 tracking-tight">
              Supply Chain Governance
            </h1>
            <p className="mt-2 text-sm text-gray-700 max-w-xl">
              Manage supplier onboarding, ESG due diligence, contract
              commitments and risk across your value chain.
            </p>
            {error && (
              <p className="mt-2 text-xs text-red-600">
                {error}
              </p>
            )}
          </div>

          <div className="text-xs text-gray-500 space-y-1">
            <p>Link procurement practices with ESG expectations.</p>
            <p>Supports modern slavery, human rights and climate disclosures.</p>
          </div>
        </div>

        {/* Top metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-amber-100 px-4 py-4">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">
              Active Suppliers
            </p>
            <p className="text-2xl font-bold text-amber-900">
              120
              <span className="ml-1 text-xs font-medium text-gray-500">
                in scope
              </span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Suppliers included in ESG monitoring and reporting.
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-amber-100 px-4 py-4">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">
              ESG-Screened Suppliers
            </p>
            <p className="text-2xl font-bold text-amber-900">
              75%
              <span className="ml-1 text-xs font-medium text-gray-500">
                screened
              </span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Suppliers that have undergone ESG / risk due diligence.
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-amber-100 px-4 py-4">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">
              High-Risk Suppliers
            </p>
            <p className="text-2xl font-bold text-amber-900">
              8
              <span className="ml-1 text-xs font-medium text-gray-500">
                flagged
              </span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Suppliers flagged for elevated ESG or compliance risk.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Supplier governance model */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-lg border border-amber-100/70 p-6">
              <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-3">
                Supplier Governance Framework
              </h2>
              <p className="text-sm text-gray-700 mb-4">
                Define how ESG expectations are embedded into supplier
                onboarding, contracts and performance management.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                  <h3 className="font-semibold text-amber-900 mb-2">
                    Onboarding & Due Diligence
                  </h3>
                  <ul className="list-disc list-inside text-amber-900/90 space-y-1">
                    <li>Supplier code of conduct acknowledgement</li>
                    <li>ESG & compliance questionnaires</li>
                    <li>Sanctions, adverse media & KYC checks</li>
                  </ul>
                </div>
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                  <h3 className="font-semibold text-amber-900 mb-2">
                    Contracts & Performance
                  </h3>
                  <ul className="list-disc list-inside text-amber-900/90 space-y-1">
                    <li>ESG clauses in contracts</li>
                    <li>KPIs on safety, labour & climate</li>
                    <li>Corrective action & exit mechanisms</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-amber-100/70 p-6">
              <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-3">
                Supply Chain Risk Overview
              </h2>
              <p className="text-sm text-gray-700 mb-4">
                Map ESG and resilience risks across categories, geographies and
                critical suppliers.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                    Environmental
                  </p>
                  <p className="text-sm text-gray-700">
                    Emissions, resource use and climate transition risks in the
                    upstream value chain.
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                    Social & Human Rights
                  </p>
                  <p className="text-sm text-gray-700">
                    Health & safety, labour practices, modern slavery exposure.
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                    Governance & Compliance
                  </p>
                  <p className="text-sm text-gray-700">
                    Corruption, sanctions, licence-to-operate and tax risks.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* AI supply-chain insights */}
          <div className="bg-white rounded-2xl shadow-lg border border-amber-100/80 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold text-slate-900">
                AI Analysis – Supply Chain
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 uppercase tracking-wide">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Live AI
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Suggested focus areas for supplier engagement, risk mitigation and
              ESG uplift.
            </p>

            <ul className="list-disc list-inside text-gray-700 space-y-2 text-sm leading-relaxed max-h-[360px] overflow-y-auto pr-1">
              {loading ? (
                <li className="text-gray-400">
                  Loading supply chain insights…
                </li>
              ) : insights.length > 0 ? (
                insights.map((note, idx) => <li key={idx}>{note}</li>)
              ) : (
                <li className="text-gray-400">
                  No AI insights available. Upload supplier risk data, ESG
                  screening results and contract coverage to unlock analytics.
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
