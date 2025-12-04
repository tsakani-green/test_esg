// src/pages/governance/DataPrivacySecurity.jsx
import React, { useContext } from "react";
import { SimulationContext } from "../../context/SimulationContext";

export default function DataPrivacySecurity() {
  const { governanceInsights, loading, error } =
    useContext(SimulationContext) || {};

  const insights =
    governanceInsights && governanceInsights.dataPrivacy
      ? governanceInsights.dataPrivacy
      : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-slate-50 to-sky-50 py-10 font-sans flex justify-center">
      <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-700 font-semibold mb-1">
              Governance · Data Privacy & Security
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Data Privacy & Security
            </h1>
            <p className="mt-2 text-sm text-gray-600 max-w-xl">
              Manage data privacy, cybersecurity posture, incidents and
              regulatory compliance (e.g. POPIA / GDPR).
            </p>
            {error && (
              <p className="mt-2 text-xs text-red-600">
                {error}
              </p>
            )}
          </div>

          <div className="text-xs text-gray-500 space-y-1">
            <p>Track security incidents, privacy requests and control maturity.</p>
            <p>Supports ESG and IT governance disclosures.</p>
          </div>
        </div>

        {/* Top metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-sky-100 px-4 py-4">
            <p className="text-xs font-semibold text-sky-800 uppercase tracking-wide mb-1">
              Security Incidents (YTD)
            </p>
            <p className="text-2xl font-bold text-slate-900">
              0
              <span className="ml-1 text-xs font-medium text-gray-500">
                critical
              </span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Confirmed critical or major cybersecurity incidents this year.
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-sky-100 px-4 py-4">
            <p className="text-xs font-semibold text-sky-800 uppercase tracking-wide mb-1">
              Privacy Requests Closed
            </p>
            <p className="text-2xl font-bold text-slate-900">
              95%
              <span className="ml-1 text-xs font-medium text-gray-500">
                within SLA
              </span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Data subject access / deletion requests resolved on time.
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-sky-100 px-4 py-4">
            <p className="text-xs font-semibold text-sky-800 uppercase tracking-wide mb-1">
              Control Maturity
            </p>
            <p className="text-2xl font-bold text-slate-900">
              Level 3
              <span className="ml-1 text-xs font-medium text-gray-500">
                defined
              </span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Maturity of key cybersecurity & privacy controls (1–5 scale).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls & risks */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-lg border border-sky-100/70 p-6">
              <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-3">
                Security & Privacy Control Framework
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Capture your key controls, including governance, technical and
                operational safeguards.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-sky-50 rounded-xl p-4 border border-sky-100">
                  <h3 className="font-semibold text-sky-900 mb-2">
                    Governance & Processes
                  </h3>
                  <ul className="list-disc list-inside text-sky-900/90 space-y-1">
                    <li>Information security policy & standards</li>
                    <li>Data classification & retention schedules</li>
                    <li>Vendor / third-party risk management</li>
                  </ul>
                </div>
                <div className="bg-sky-50 rounded-xl p-4 border border-sky-100">
                  <h3 className="font-semibold text-sky-900 mb-2">
                    Technical Controls
                  </h3>
                  <ul className="list-disc list-inside text-sky-900/90 space-y-1">
                    <li>Network & endpoint security</li>
                    <li>Identity & access management (IAM)</li>
                    <li>Encryption & backup strategy</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-sky-100/70 p-6">
              <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-3">
                Incident & Breach Management
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Standardise how you log, classify and respond to security and
                privacy incidents.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                    Detection
                  </p>
                  <p className="text-sm text-gray-700">
                    Logging & monitoring, threat intelligence, user reporting
                    channels.
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                    Response
                  </p>
                  <p className="text-sm text-gray-700">
                    Playbooks, severity levels, internal & regulator
                    notifications.
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                    Recovery & Lessons
                  </p>
                  <p className="text-sm text-gray-700">
                    Root-cause analysis, control uplift, awareness campaigns.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* AI data/privacy insights */}
          <div className="bg-white rounded-2xl shadow-lg border border-sky-100/80 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold text-slate-900">
                AI Analysis – Data Privacy & Security
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700 uppercase tracking-wide">
                <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
                Live AI
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Insights on security posture, regulatory exposure and incident
              readiness.
            </p>

            <ul className="list-disc list-inside text-gray-700 space-y-2 text-sm leading-relaxed max-h-[360px] overflow-y-auto pr-1">
              {loading ? (
                <li className="text-gray-400">
                  Loading data privacy & security insights…
                </li>
              ) : insights.length > 0 ? (
                insights.map((note, idx) => <li key={idx}>{note}</li>)
              ) : (
                <li className="text-gray-400">
                  No AI insights available. Capture security incidents, privacy
                  requests and control assessments to unlock analytics.
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
