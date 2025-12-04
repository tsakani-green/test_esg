import React from "react";
import { FaCheckCircle, FaExclamationTriangle, FaClock } from "react-icons/fa";

const PillarProgress = ({ label, score, color }) => (
  <div className="bg-[#0f172a] rounded-2xl p-4 sm:p-5 shadow hover:shadow-lg transition-shadow">
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-sm font-semibold text-slate-200">{label}</h3>
      <span className="text-sm font-semibold text-slate-300">{score}%</span>
    </div>
    <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
      <div
        className={`h-2 rounded-full ${color}`}
        style={{ width: `${score}%` }}
      />
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const base = "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium";
  if (status === "Compliant") {
    return (
      <span className={`${base} bg-emerald-500/10 text-emerald-300 border border-emerald-500/40`}>
        <FaCheckCircle className="text-[10px]" />
        Compliant
      </span>
    );
  }
  if (status === "In Progress") {
    return (
      <span className={`${base} bg-amber-500/10 text-amber-300 border border-amber-500/40`}>
        <FaClock className="text-[10px]" />
        In progress
      </span>
    );
  }
  return (
    <span className={`${base} bg-rose-500/10 text-rose-300 border border-rose-500/40`}>
      <FaExclamationTriangle className="text-[10px]" />
      Gap identified
    </span>
  );
};

const ESGCompliance = () => {
  const disclosures = [
    {
      framework: "GRI 302",
      title: "Energy consumption within the organization",
      pillar: "Environmental",
      status: "Compliant",
      owner: "Sustainability",
    },
    {
      framework: "GRI 305",
      title: "GHG emissions (Scope 1 & 2)",
      pillar: "Environmental",
      status: "In Progress",
      owner: "Environmental",
    },
    {
      framework: "GRI 401",
      title: "Employee turnover & hiring",
      pillar: "Social",
      status: "Compliant",
      owner: "HR",
    },
    {
      framework: "GRI 403",
      title: "Occupational health & safety",
      pillar: "Social",
      status: "Gap",
      owner: "HSE",
    },
    {
      framework: "GRI 205",
      title: "Anti-corruption and ethics training",
      pillar: "Governance",
      status: "In Progress",
      owner: "Compliance",
    },
  ];

  const upcoming = [
    {
      date: "30 Nov 2025",
      label: "Submit ESG report draft to Exco",
      type: "Internal milestone",
    },
    {
      date: "15 Dec 2025",
      label: "Finalize GHG inventory assurance",
      type: "External assurance",
    },
    {
      date: "31 Jan 2026",
      label: "Regulator ESG filing window opens",
      type: "Regulatory",
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-[#1e293b] min-h-screen text-slate-100">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 lg:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-emerald-400 tracking-tight">
            ESG Compliance
          </h1>
          <p className="mt-1 text-sm md:text-base text-slate-300 max-w-xl">
            Track your ESG reporting status across frameworks, identify gaps,
            and stay ahead of regulatory deadlines.
          </p>
        </div>

        <div className="flex gap-2 sm:gap-3">
          <select className="bg-[#0f172a] border border-slate-700 text-xs sm:text-sm rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/60">
            <option>Reporting year: 2025</option>
            <option>Reporting year: 2024</option>
            <option>Reporting year: 2023</option>
          </select>
          <div className="hidden sm:flex items-center gap-1 bg-[#0f172a] border border-slate-700 rounded-xl px-3 py-2 text-[11px] sm:text-xs text-slate-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Last synced: 5 min ago</span>
          </div>
        </div>
      </div>

      {/* Top KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#0f172a] rounded-2xl p-4 sm:p-5 shadow hover:shadow-lg transition-all">
          <p className="text-xs text-slate-400 uppercase tracking-wide">
            Overall ESG score
          </p>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-3xl font-bold text-emerald-400">82</span>
            <span className="text-xs text-slate-400 mb-1">/ 100</span>
          </div>
          <p className="mt-2 text-xs text-emerald-300">
            +5 pts vs last year
          </p>
        </div>

        <div className="bg-[#0f172a] rounded-2xl p-4 sm:p-5 shadow hover:shadow-lg transition-all">
          <p className="text-xs text-slate-400 uppercase tracking-wide">
            Disclosure coverage
          </p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-3xl font-bold text-sky-300">74%</span>
            <span className="text-xs text-slate-400">of required metrics</span>
          </div>
          <div className="mt-3 w-full h-2 rounded-full bg-slate-700 overflow-hidden">
            <div className="h-2 rounded-full bg-sky-400" style={{ width: "74%" }} />
          </div>
        </div>

        <div className="bg-[#0f172a] rounded-2xl p-4 sm:p-5 shadow hover:shadow-lg transition-all">
          <p className="text-xs text-slate-400 uppercase tracking-wide">
            Open compliance gaps
          </p>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-amber-300">7</span>
            <span className="text-xs text-slate-400">items to resolve</span>
          </div>
          <p className="mt-2 text-xs text-amber-300">
            Prioritise high-risk disclosures first.
          </p>
        </div>

        <div className="bg-[#0f172a] rounded-2xl p-4 sm:p-5 shadow hover:shadow-lg transition-all">
          <p className="text-xs text-slate-400 uppercase tracking-wide">
            On-track status
          </p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-3xl font-bold text-emerald-300">91%</span>
            <span className="text-xs text-slate-400">of milestones</span>
          </div>
          <p className="mt-2 text-xs text-slate-300">
            Most deliverables are on schedule.
          </p>
        </div>
      </div>

      {/* Middle: pillar progress + deadlines */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        {/* Pillars */}
        <div className="xl:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold text-slate-200 mb-1">
            Pillar compliance overview
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <PillarProgress label="Environmental (E)" score={86} color="bg-emerald-400" />
            <PillarProgress label="Social (S)" score={79} color="bg-sky-400" />
            <PillarProgress label="Governance (G)" score={75} color="bg-violet-400" />
          </div>

          <div className="mt-4 bg-[#0f172a] rounded-2xl p-4 sm:p-5 shadow flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-200">
                Frameworks in scope
              </p>
              <p className="text-xs text-slate-400 mt-1">
                You are currently tracking ESG alignment across 4 frameworks.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["GRI", "SASB", "TCFD", "Local regulation"].map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full bg-slate-800/80 text-[11px] text-slate-200 border border-slate-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Deadlines */}
        <div className="bg-[#0f172a] rounded-2xl p-4 sm:p-5 shadow flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-200">
              Upcoming deadlines
            </h2>
            <span className="text-[11px] text-slate-400">Next 90 days</span>
          </div>

          <div className="space-y-3">
            {upcoming.map((item, idx) => (
              <div
                key={idx}
                className="flex gap-3 border border-slate-800 rounded-xl px-3 py-3 bg-slate-900/60"
              >
                <div className="mt-1">
                  <FaClock className="text-amber-300 text-sm" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">
                    {item.label}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Due: {item.date}
                  </p>
                  <span className="inline-flex mt-1 px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 border border-slate-600">
                    {item.type}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <button className="mt-4 text-xs font-medium text-emerald-300 self-start hover:text-emerald-200">
            View full compliance calendar →
          </button>
        </div>
      </div>

      {/* Bottom: disclosures table */}
      <div className="bg-[#0f172a] rounded-2xl p-4 sm:p-5 shadow">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">
              Key disclosures & metrics
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Prioritised view of ESG topics with ownership and current status.
            </p>
          </div>
          <div className="flex gap-2">
            <button className="text-[11px] sm:text-xs px-3 py-1.5 rounded-full border border-slate-600 text-slate-200 hover:border-emerald-400 hover:text-emerald-300 transition-colors">
              Export matrix
            </button>
            <button className="text-[11px] sm:text-xs px-3 py-1.5 rounded-full bg-emerald-500 text-slate-900 font-semibold hover:bg-emerald-400 transition-colors">
              Add disclosure
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                <th className="py-2 pr-4">Framework</th>
                <th className="py-2 pr-4">Disclosure</th>
                <th className="py-2 pr-4">Pillar</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Owner</th>
              </tr>
            </thead>
            <tbody>
              {disclosures.map((item, idx) => (
                <tr
                  key={idx}
                  className="border-b border-slate-900/60 hover:bg-slate-900/40"
                >
                  <td className="py-3 pr-4 align-top text-[11px] text-slate-400 whitespace-nowrap">
                    {item.framework}
                  </td>
                  <td className="py-3 pr-4 align-top text-xs text-slate-100">
                    {item.title}
                  </td>
                  <td className="py-3 pr-4 align-top text-[11px] text-slate-300">
                    {item.pillar}
                  </td>
                  <td className="py-3 pr-4 align-top">
                    <StatusBadge
                      status={
                        item.status === "Gap"
                          ? "Gap"
                          : item.status
                      }
                    />
                  </td>
                  <td className="py-3 pr-4 align-top text-[11px] text-slate-300">
                    {item.owner}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ESGCompliance;
