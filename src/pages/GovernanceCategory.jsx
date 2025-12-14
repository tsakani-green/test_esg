// src/pages/GovernanceCategory.jsx
import React, { useContext, useEffect, useMemo, useState } from "react";
import { FaBalanceScale, FaTruck } from "react-icons/fa";
import { FiActivity, FiLock, FiDownload } from "react-icons/fi";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { jsPDF } from "jspdf";
import { SimulationContext } from "../context/SimulationContext";
import { API_BASE_URL } from "../config/api";

// OPTIONAL: add logos like SocialCategory (ensure paths exist)
// import africaESGLogo from "../assets/AfricaESG.AI.png";
// import clientLogo from "../assets/ethekwin.png";

const chartTheme = {
  grid: "#e5e7eb",
  axis: "#9ca3af",
  tick: "#6b7280",
  green: "#16a34a",
  blue: "#3b82f6",
  amber: "#f59e0b",
  slate: "#9ca3af",
};

const PIE_COLORS = [chartTheme.green, chartTheme.blue, chartTheme.amber, chartTheme.slate];

const MetricCard = ({ title, value, unit, icon: Icon }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
    <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
      {Icon && <Icon className="w-4 h-4" />}
      {title}
    </div>
    <div className="text-2xl font-extrabold text-slate-900 mt-1">
      {value}
      {unit && <span className="text-sm text-slate-600 ml-1">{unit}</span>}
    </div>
  </div>
);

const LiveBadge = ({ live, timestamp }) => (
  <span
    className={`inline-flex items-center gap-2 text-[11px] px-3 py-1 rounded-full font-semibold border ${
      live
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-slate-50 text-slate-600 border-slate-200"
    }`}
    title={timestamp || ""}
  >
    <span className={`h-2 w-2 rounded-full ${live ? "bg-emerald-500" : "bg-slate-400"}`} />
    {live ? "LIVE AI" : "Fallback"}
    {timestamp ? <span className="text-slate-500">• {timestamp}</span> : null}
  </span>
);

// Tooltip similar to SocialCategory
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white/90 backdrop-blur-xl px-4 py-3 shadow-2xl shadow-slate-900/10">
      {label && (
        <p className="text-sm font-semibold text-slate-800 mb-2 pb-2 border-b border-slate-100">
          {label}
        </p>
      )}
      <div className="space-y-2">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: entry.color || entry.payload?.fill }}
              />
              <span className="text-sm font-medium text-slate-700">{entry.name}</span>
            </div>
            <span className="text-sm font-bold text-slate-900">
              {entry.value ?? "—"}
              {entry.unit || ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const getFallbackInsights = (metrics) => {
  const g = metrics || {};
  return [
    `Governance score of ${Number(g.governanceScore ?? 0).toFixed(1)}/100 suggests stable controls with specific areas for enhancement through stronger assurance and disclosure.`,
    `Audit completion of ${Number(g.auditCompletion ?? 0).toFixed(1)}% indicates the current assurance cycle is progressing; focus on closing corrective actions to protect report credibility.`,
    `Supplier compliance at ${Number(g.supplierCompliance ?? 0).toFixed(1)}% highlights the importance of third-party governance and regular supplier code-of-conduct attestations.`,
    `Board independence of ${Number(g.boardIndependencePct ?? 0).toFixed(1)}% supports oversight; consider skills and diversity matrices to strengthen decision-making quality.`,
    `Transparency score of ${Number(g.transparencyScore ?? 0).toFixed(1)}% can be improved through clearer KPI definitions, audit trails, and more frequent stakeholder disclosure.`,
  ];
};

export default function GovernanceCategory() {
  const { governanceMetrics, loading, error, insights } = useContext(SimulationContext);

  // LIVE AI
  const [aiInsights, setAiInsights] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiMeta, setAiMeta] = useState({ live: false, timestamp: null });

  const parseNumber = (v, d = 0) => {
    if (v === null || v === undefined) return d;
    const s = String(v).replace("%", "").trim();
    const n = Number(s);
    return Number.isFinite(n) ? n : d;
  };

  // Clean numeric metrics payload for backend AI (prevents crashes)
  const metrics = useMemo(() => {
    const g = governanceMetrics || {};
    return {
      governanceScore: parseNumber(g.governanceScore, 80),
      supplierCompliance: parseNumber(g.supplierCompliance, 85),
      auditCompletion: parseNumber(g.auditCompletion, 92),
      boardIndependencePct: parseNumber(g.boardIndependence || g.boardIndependencePct || "60%", 60),
      transparencyScore: parseNumber(g.transparencyScore || "82%", 82),
      ethicsCompliance: parseNumber(g.ethicsCompliance ?? g.ethics_compliance, 90),
      riskCoverage: parseNumber(g.riskCoverage ?? g.risk_management_coverage, 95),
    };
  }, [governanceMetrics]);

  const metricsKey = useMemo(() => JSON.stringify(metrics), [metrics]);

  useEffect(() => {
    if (!metricsKey) return;

    const controller = new AbortController();

    const loadGovernanceAI = async () => {
      try {
        setAiLoading(true);
        setAiError(null);

        const res = await fetch(`${API_BASE_URL}/api/governance-insights`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ metrics }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || "Governance AI failed");
        }

        const data = await res.json();
        const lines = Array.isArray(data?.insights) ? data.insights : [];
        setAiInsights(lines);
        setAiMeta({ live: !!data?.live, timestamp: data?.timestamp || null });
      } catch (e) {
        if (e.name !== "AbortError") {
          setAiError(e.message || "Failed to load governance AI insights");
          setAiInsights([]);
          setAiMeta({ live: false, timestamp: null });
        }
      } finally {
        setAiLoading(false);
      }
    };

    const t = setTimeout(loadGovernanceAI, 200);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [metricsKey]);

  // Prefer AI insights; fallback to context insights (if any) else local fallback
  const finalLoading = aiLoading || loading;
  const finalError = aiError || error;

  const finalInsights = useMemo(() => {
    if (aiInsights && aiInsights.length > 0) return aiInsights;

    // optional: if your SimulationContext exposes combined insights similar to SocialCategory
    if (Array.isArray(insights) && insights.length > 0) return insights;

    return getFallbackInsights(metrics);
  }, [aiInsights, insights, metrics]);

  const complianceTrendData = useMemo(
    () => [
      { month: "Jan", audits: 85 },
      { month: "Feb", audits: 88 },
      { month: "Mar", audits: 82 },
      { month: "Apr", audits: 90 },
      { month: "May", audits: 87 },
      { month: "Jun", audits: metrics.auditCompletion },
    ],
    [metrics.auditCompletion]
  );

  const governanceSplit = [
    { name: "Compliant", value: 75 },
    { name: "In Progress", value: 15 },
    { name: "Needs Review", value: 8 },
    { name: "Not Started", value: 2 },
  ];

  // PDF Download (with optional logos)
  const handleDownload = () => {
    const doc = new jsPDF();

    const addBody = (startY = 20) => {
      let y = startY;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("AfricaESG.AI – ESG Governance Report", 14, y);
      y += 10;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      const aiLabel = aiMeta.live ? "LIVE AI" : "Fallback";
      const aiTime = aiMeta.timestamp ? ` (${aiMeta.timestamp})` : "";
      doc.text(`AI Mode: ${aiLabel}${aiTime}`, 14, y);
      y += 10;

      const addLine = (label, val) => {
        const line = `${label}: ${val}`;
        const lines = doc.splitTextToSize(line, 180);
        doc.text(lines, 14, y);
        y += lines.length * 5;
      };

      addLine("Governance Score", `${metrics.governanceScore.toFixed(1)}/100`);
      addLine("Supplier Compliance", `${metrics.supplierCompliance.toFixed(1)}%`);
      addLine("Audit Completion", `${metrics.auditCompletion.toFixed(1)}%`);
      addLine("Board Independence", `${metrics.boardIndependencePct.toFixed(1)}%`);
      addLine("Transparency", `${metrics.transparencyScore.toFixed(1)}%`);
      addLine("Ethics Compliance", `${metrics.ethicsCompliance.toFixed(1)}%`);
      addLine("Risk Coverage", `${metrics.riskCoverage.toFixed(1)}%`);

      y += 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("AI Governance Insights", 14, y);
      y += 8;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      (finalInsights || []).forEach((i, idx) => {
        const lines = doc.splitTextToSize(`${idx + 1}. ${i}`, 180);
        doc.text(lines, 14, y);
        y += lines.length * 5 + 2;
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
      });
    };

    // If you want logos like SocialCategory, uncomment imports and use this block:
    /*
    const drawWithLogos = () => {
      let loaded = 0;
      const total = 2;
      const onDone = () => {
        addBody(40);
        doc.save("ESG_Governance_Report.pdf");
      };

      const logos = [
        { src: africaESGLogo, x: 14, y: 10, w: 35, h: 12 },
        { src: clientLogo, x: 160, y: 10, w: 30, h: 10 },
      ];

      logos.forEach((logo) => {
        if (!logo.src) {
          loaded += 1;
          if (loaded === total) onDone();
          return;
        }
        const img = new Image();
        img.src = logo.src;
        img.onload = () => {
          try {
            doc.addImage(img, "PNG", logo.x, logo.y, logo.w, logo.h);
          } catch {}
          loaded += 1;
          if (loaded === total) onDone();
        };
        img.onerror = () => {
          loaded += 1;
          if (loaded === total) onDone();
        };
      });
    };

    try {
      drawWithLogos();
    } catch {
      addBody(20);
      doc.save("ESG_Governance_Report.pdf");
    }
    */

    // Default: no logos
    addBody(20);
    doc.save("ESG_Governance_Report.pdf");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-sky-50 to-slate-100 px-6 py-8 max-w-7xl mx-auto">
      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-sky-700 uppercase">
            AfricaESG.AI
          </p>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            ESG – Governance
          </h1>
          <p className="text-sm text-slate-600 mt-2 max-w-3xl">
            Corporate governance, ethics, compliance, data privacy and supply chain oversight.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <LiveBadge live={aiMeta.live} timestamp={aiMeta.timestamp} />
          <button
            onClick={handleDownload}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm"
          >
            <FiDownload />
            Download Report
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <MetricCard title="Governance Score" value={metrics.governanceScore.toFixed(1)} unit="/100" icon={FaBalanceScale} />
        <MetricCard title="Supplier Compliance" value={metrics.supplierCompliance.toFixed(1)} unit="%" icon={FaTruck} />
        <MetricCard title="Audit Completion" value={metrics.auditCompletion.toFixed(1)} unit="%" icon={FiActivity} />
        <MetricCard title="Board Independence" value={metrics.boardIndependencePct.toFixed(1)} unit="%" icon={FaBalanceScale} />
        <MetricCard title="Transparency" value={metrics.transparencyScore.toFixed(1)} unit="%" icon={FiLock} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-semibold mb-3 text-slate-900">Audit Completion Trend</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={complianceTrendData}>
                <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
                <XAxis dataKey="month" stroke={chartTheme.axis} />
                <YAxis stroke={chartTheme.axis} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="audits" name="Audit Completion" stroke={chartTheme.green} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-semibold mb-3 text-slate-900">Governance Status Distribution</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={governanceSplit} dataKey="value" nameKey="name" outerRadius={85} paddingAngle={2}>
                  {governanceSplit.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-xl font-extrabold mb-2 text-slate-900">ESG Governance – AI Narrative</h2>
        <p className="text-sm text-slate-600 mb-4">
          Generated commentary based on your uploaded governance metrics.
        </p>

        {finalLoading && <p className="text-sm text-sky-700">Generating insights…</p>}
        {finalError && <p className="text-sm text-red-600">{finalError}</p>}

        {!finalLoading && !finalError && (
          <ul className="space-y-3">
            {(finalInsights || []).map((i, idx) => (
              <li key={idx} className="text-slate-700 leading-relaxed">
                {i}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
