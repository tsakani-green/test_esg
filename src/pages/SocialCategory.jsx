import React, { useContext, useMemo, useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { 
  FiActivity, 
  FiUsers, 
  FiBriefcase, 
  FiGlobe,
  FiTrendingUp,
  FiTarget,
  FiShield,
  FiHeart,
  FiAward,
  FiDollarSign,
  FiCalendar
} from "react-icons/fi";
import { 
  FaFilePdf,
  FaChartLine,
  FaHandshake,
  FaHandsHelping,
  FaBalanceScale
} from "react-icons/fa";
import { jsPDF } from "jspdf";
import { SimulationContext } from "../context/SimulationContext";
import { API_BASE_URL } from "../config/api";

// Fixed: Clean color palette without duplicates
const chartTheme = {
  // Primary theme colors
  grid: "#e5e7eb",
  axis: "#9ca3af",
  tick: "#6b7280",
  supplierPrimary: "#2563eb",
  supplierOther: "#e5e7eb",
  engaged: "#22c55e",
  neutral: "#e5e7eb", // Only one neutral key
  csi: "#0ea5e9",
  stakeholder: "#6366f1",
  supplierDev: "#f97316",
};

const SUPPLIER_COLORS = [chartTheme.supplierPrimary, chartTheme.supplierOther];
const ENGAGED_COLORS = [chartTheme.engaged, chartTheme.neutral];
const COMMUNITY_COLORS = [
  chartTheme.csi,
  chartTheme.stakeholder,
  chartTheme.supplierDev,
];

const TABS = ["Overview", "Supplier", "Human Capital", "Community"];
const TAB_ICONS = {
  Overview: FiActivity,
  Supplier: FiBriefcase,
  "Human Capital": FiUsers,
  Community: FiGlobe,
};

// Enhanced Custom Tooltip with glass morphism
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
          <div
            key={entry.name}
            className="flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: entry.color || entry.payload?.fill }}
              />
              <span className="text-sm font-medium text-slate-700">
                {entry.name}
              </span>
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

// Enhanced Progress Bar with animation
const ProgressBar = ({ value, max = 100, color = "primary", showLabel = true }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  
  const colorClasses = {
    primary: "from-sky-500 via-emerald-500 to-lime-500",
    success: "from-emerald-500 to-emerald-600",
    community: "from-cyan-500 to-cyan-600",
    premium: "from-violet-500 to-violet-600",
  };

  return (
    <div className="space-y-2">
      {showLabel && (
        <div className="flex justify-between text-xs">
          <span className="font-medium text-slate-700">Progress</span>
          <span className="font-bold text-slate-900">{pct.toFixed(1)}%</span>
        </div>
      )}
      <div className="relative w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${colorClasses[color]} transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

// New Metric Card Component
const MetricCard = ({ title, value, icon: Icon, color = "primary", trend, subtitle }) => {
  const colorClasses = {
    primary: "bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200",
    success: "bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200",
    community: "bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200",
    premium: "bg-gradient-to-br from-violet-50 to-violet-100 border-violet-200",
  };

  return (
    <div className={`relative rounded-2xl border-2 p-5 ${colorClasses[color]} group hover:scale-[1.02] transition-all duration-300`}>
      <div className="absolute top-4 right-4 opacity-20 group-hover:opacity-30 transition-opacity">
        <Icon className="h-8 w-8" />
      </div>
      
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
            {title}
          </p>
          <p className="text-2xl font-bold text-slate-900">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-slate-600 mt-1">{subtitle}</p>
          )}
        </div>
        
        {trend && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            trend > 0 
              ? "bg-emerald-100 text-emerald-700" 
              : "bg-rose-100 text-rose-700"
          }`}>
            <FiTrendingUp className={`h-3 w-3 ${trend < 0 ? "transform rotate-180" : ""}`} />
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default function SocialCategory() {
  const { socialMetrics, socialInsights, loading, error } =
    useContext(SimulationContext);

  const [activeTab, setActiveTab] = useState("Overview");
  const [isHovered, setIsHovered] = useState({});

  const metrics = socialMetrics || {};
  const supplierDiversity = metrics.supplierDiversity ?? 0;
  const employeeEngagement = metrics.employeeEngagement ?? 0;
  const communityPrograms = metrics.communityPrograms ?? 0;

  const hasAnyData =
    supplierDiversity !== 0 ||
    employeeEngagement !== 0 ||
    communityPrograms !== 0;

  // --- derived data for charts / badges ---
  const supplierData = useMemo(
    () => [
      { name: "Diverse Suppliers", value: supplierDiversity },
      { name: "Other Suppliers", value: Math.max(0, 100 - supplierDiversity) },
    ],
    [supplierDiversity]
  );

  const humanCapitalData = useMemo(
    () => [
      { group: "Engaged", value: employeeEngagement },
      {
        group: "At-risk / Neutral",
        value: Math.max(0, 100 - employeeEngagement),
      },
    ],
    [employeeEngagement]
  );

  const communityEngagementRevenuePct = useMemo(() => {
    const base = communityPrograms / 8;
    const clamped = Math.max(0, Math.min(10, base));
    return Number.isFinite(clamped) ? clamped : 0;
  }, [communityPrograms]);

  const communityAllocationData = useMemo(() => {
    const base = communityPrograms || 0;
    const csi = Math.round(base * 0.5);
    const stakeholder = Math.round(base * 0.3);
    const supplierDev = Math.max(0, base - csi - stakeholder);
    return [
      { name: "CSI / SED Projects", value: csi },
      { name: "Stakeholder Engagement", value: stakeholder },
      { name: "Supplier Development", value: supplierDev },
    ];
  }, [communityPrograms]);

  const stakeholderSurveyScore = useMemo(
    () => Math.round(employeeEngagement * 0.9),
    [employeeEngagement]
  );

  const supplierSurveyScore = useMemo(
    () => Math.round((supplierDiversity + employeeEngagement) / 2),
    [supplierDiversity, employeeEngagement]
  );

  // --- static sample data for "audit chart" style view ---
  const auditScoreData = [
    { year: "2022", initial: 100, final: 165 },
    { year: "2023", initial: 80, final: 145 },
    { year: "2024", initial: 110, final: 160 },
  ];

  const auditNonConformanceData = [
    { name: "Management Systems", value: 30 },
    { name: "Labour", value: 20 },
    { name: "Health & Safety", value: 25 },
    { name: "Environment", value: 15 },
    { name: "Ethics", value: 10 },
  ];

  // ------------ AI Social Insights ------------
  const [socialAiInsights, setSocialAiInsights] = useState([]);
  const [socialAiLoading, setSocialAiLoading] = useState(false);
  const [socialAiError, setSocialAiError] = useState(null);

  useEffect(() => {
    if (!metrics || Object.keys(metrics).length === 0) return;

    const loadSocialAI = async () => {
      try {
        setSocialAiLoading(true);
        setSocialAiError(null);

        const res = await fetch(`${API_BASE_URL}/api/social-insights`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ metrics }),
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`/api/social-insights error: ${res.status} ${txt}`);
        }

        const data = await res.json();
        const insights = Array.isArray(data)
          ? data
          : Array.isArray(data.insights)
          ? data.insights
          : [];

        setSocialAiInsights(insights);
      } catch (err) {
        setSocialAiError(err.message);
      } finally {
        setSocialAiLoading(false);
      }
    };

    loadSocialAI();
  }, [metrics]);

  const finalLoading = socialAiLoading || loading;
  const finalError = socialAiError || error;
  const finalInsights =
    socialAiInsights && socialAiInsights.length > 0
      ? socialAiInsights
      : socialInsights || [];

  // ------------ Simple PDF Download Function ------------
  const handleDownloadSocialReport = () => {
    const doc = new jsPDF();
    let y = 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("AfricaESG.AI – ESG Social Progress", 14, y);
    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const add = (label, val) => {
      const line = `${label}: ${val}`;
      const lines = doc.splitTextToSize(line, 180);
      doc.text(lines, 14, y);
      y += lines.length * 5;
    };

    add("Supplier Diversity (%)", supplierDiversity.toFixed(1));
    add("Employee Engagement (0–100)", employeeEngagement.toFixed(1));
    add(
      "Community Engagement (% of revenue – proxy)",
      communityEngagementRevenuePct.toFixed(1)
    );
    add("Community Programmes Index", communityPrograms);

    // Add AI insights if available
    if (finalInsights.length > 0) {
      y += 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("AI Social Insights", 14, y);
      y += 10;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      finalInsights.forEach((insight, idx) => {
        const lines = doc.splitTextToSize(`${idx + 1}. ${insight}`, 180);
        doc.text(lines, 14, y);
        y += lines.length * 5 + 2;
      });
    }

    doc.save("AfricaESG_Social_Report.pdf");
  };

  const renderNoData = (title) => (
    <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-sky-200 bg-sky-50/40">
      <div className="text-center px-6">
        <p className="text-sm font-semibold text-sky-900 mb-1">
          No {title} data yet
        </p>
        <p className="text-xs text-sky-800">
          Upload or refresh your ESG dataset on the Data Import page.
        </p>
      </div>
    </div>
  );

  // ------------ TABS CONTENT ------------
  const renderTabContent = () => {
    switch (activeTab) {
      case "Overview":
      default:
        return (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Left: Main content */}
            <div className="xl:col-span-2 space-y-8">
              {/* Header Card - Reverted to original style */}
              <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                <p className="text-xs font-semibold text-sky-700 uppercase tracking-[0.18em]">
                  Social
                </p>
                <h2 className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900">
                  ESG Social Progress
                </h2>
                <p className="mt-3 text-sm text-slate-600 max-w-3xl">
                  Snapshot of your human rights, people, supply chain and
                  community performance, inspired by the company ESG
                  disclosures but tailored to AfricaESG.AI dataset.
                </p>
              </section>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-lg bg-blue-100">
                      <FiBriefcase className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase">Supplier Diversity</p>
                      <p className="text-2xl font-bold text-slate-900">{supplierDiversity.toFixed(1)}%</p>
                      <p className="text-xs text-slate-500">of total spend</p>
                    </div>
                  </div>
                  <ProgressBar value={supplierDiversity} color="primary" />
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-lg bg-emerald-100">
                      <FiUsers className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase">Employee Engagement</p>
                      <p className="text-2xl font-bold text-slate-900">{employeeEngagement.toFixed(1)}/100</p>
                      <p className="text-xs text-slate-500">index score</p>
                    </div>
                  </div>
                  <ProgressBar value={employeeEngagement} color="success" />
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-lg bg-cyan-100">
                      <FiGlobe className="h-4 w-4 text-cyan-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase">Community Impact</p>
                      <p className="text-2xl font-bold text-slate-900">{communityEngagementRevenuePct.toFixed(1)}%</p>
                      <p className="text-xs text-slate-500">of revenue</p>
                    </div>
                  </div>
                  <ProgressBar value={communityEngagementRevenuePct * 10} color="community" />
                </div>
              </div>

              {/* Detailed Cards Grid - Reverted to original style */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-3xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-sky-800 mb-2">
                    Human Rights
                  </h3>
                  <p className="text-xs text-slate-600 mb-2">
                    Policies and practices to prevent forced labour, child
                    labour and other abuses across operations and the supply
                    chain.
                  </p>
                  <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
                    <li>Commitment to recognised international standards.</li>
                    <li>Screening of high-risk operations and suppliers.</li>
                    <li>Grievance and remediation channels for workers.</li>
                  </ul>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-sky-800 mb-2">
                    Human Capital & Engagement
                  </h3>
                  <p className="text-xs text-slate-600 mb-2">
                    Engagement and wellbeing of employees, reflected in internal
                    survey scores and talent indicators.
                  </p>
                  <p className="text-xs font-semibold text-slate-900 mb-1">
                    Engagement index:{" "}
                    <span className="text-sky-700">
                      {employeeEngagement.toFixed(1)}/100
                    </span>
                  </p>
                  <ProgressBar value={employeeEngagement} />
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-sky-800 mb-2">
                    Ethical & Sustainable Supply Chain
                  </h3>
                  <p className="text-xs text-slate-600 mb-2">
                    Due diligence on high-risk suppliers and responsible
                    sourcing of key materials.
                  </p>
                  <p className="text-xs font-semibold text-slate-900 mb-1">
                    Diverse supplier share:{" "}
                    <span className="text-sky-700">
                      {supplierDiversity.toFixed(1)}%
                    </span>
                  </p>
                  <ProgressBar value={supplierDiversity} />
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-sky-800 mb-2">
                    Data Privacy
                  </h3>
                  <p className="text-xs text-slate-600 mb-2">
                    Governance to protect customer and employee data and manage
                    AI and digital risks.
                  </p>
                  <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
                    <li>Clear data privacy policy and disclosure.</li>
                    <li>Controls for responsible data use and AI.</li>
                    <li>Training and awareness for employees.</li>
                  </ul>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-sky-800 mb-2">
                    Safety
                  </h3>
                  <p className="text-xs text-slate-600 mb-2">
                    Health and safety performance and culture across operations
                    and value chain.
                  </p>
                  <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
                    <li>Focus on workplace injury prevention.</li>
                    <li>Safety leadership and training programmes.</li>
                    <li>
                      Integration of safety into product and service design.
                    </li>
                  </ul>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-sky-800 mb-2">
                    Strengthening Communities
                  </h3>
                  <p className="text-xs text-slate-600 mb-2">
                    Corporate citizenship, philanthropy and shared-value
                    initiatives in priority communities.
                  </p>
                  <p className="text-xs font-semibold text-slate-900 mb-1">
                    Community engagement (proxy):{" "}
                    <span className="text-sky-700">
                      {communityEngagementRevenuePct.toFixed(1)}% revenue
                    </span>
                  </p>
                  <ProgressBar value={communityEngagementRevenuePct * 10} />
                </div>
              </section>
            </div>

            {/* Right: AI Insights Panel - FIXED: Container with proper height management */}
            <aside className="bg-white rounded-3xl shadow border border-slate-200 p-5 flex flex-col h-full">
              <h2 className="text-lg font-semibold text-slate-900">
                ESG Social – AI Narrative
              </h2>
              <p className="text-xs text-slate-500 mt-1 mb-3">
                Generated commentary based on your uploaded ESG social metrics,
                mirroring the narrative style of listed-company ESG reports.
              </p>

              <div className="flex-1 min-h-0"> {/* Changed: min-h-0 for proper flex child sizing */}
                {finalLoading && (
                  <p className="text-xs text-sky-700">Loading insights…</p>
                )}

                {finalError && (
                  <p className="text-xs text-red-600">{finalError}</p>
                )}

                {!finalLoading && !finalError && (
                  <div className="h-full overflow-hidden"> {/* Added: Container with fixed height management */}
                    <ul className="h-full overflow-y-auto pr-2 space-y-2"> {/* Changed: Added height and overflow control */}
                      {(finalInsights || []).map((line, idx) => (
                        <li key={idx} className="text-sm text-slate-700 leading-relaxed">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </aside>
          </div>
        );

      case "Supplier":
        return (
          <div className="space-y-6">
            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              <p className="text-xs font-semibold text-sky-700 uppercase tracking-[0.18em]">
                Social – Supply Chain
              </p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">
                Ethical & Sustainable Supply Chain
              </h2>
              <p className="mt-3 text-sm text-slate-600 max-w-3xl">
                View how diverse suppliers, responsible sourcing and audit
                programmes support social performance in your value chain.
              </p>
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* left: "battery supply chain" style text */}
              <div className="xl:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
                <h3 className="text-lg font-semibold text-slate-900">
                  Supply Chain Due Diligence Journey
                </h3>
                <p className="text-xs text-slate-600">
                  Map high-risk materials and suppliers, conduct risk
                  assessments and implement corrective actions across the
                  lifecycle of key products and services.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-[11px] text-slate-700">
                  {[
                    "Raw material extraction",
                    "Processing & refining",
                    "Component production",
                    "Assembly & logistics",
                    "Customer use & end-of-life",
                  ].map((stage) => (
                    <div
                      key={stage}
                      className="rounded-2xl border border-sky-100 bg-sky-50/40 px-3 py-2 text-center"
                    >
                      <p>{stage}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-700 uppercase">
                      Diverse Supplier Share
                    </p>
                    <p className="text-lg font-bold text-slate-900">
                      {supplierDiversity.toFixed(1)}% of spend
                    </p>
                    <ProgressBar value={supplierDiversity} />
                    <p className="mt-2 text-[11px] text-slate-600">
                      Higher shares indicate better inclusion of small, local
                      and historically disadvantaged suppliers.
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-700 uppercase">
                      Supplier Engagement (Proxy)
                    </p>
                    <p className="text-lg font-bold text-slate-900">
                      {supplierSurveyScore}/100
                    </p>
                    <ProgressBar value={supplierSurveyScore} />
                    <p className="mt-2 text-[11px] text-slate-600">
                      Synthesised from supplier-facing social metrics and
                      survey-style indicators in your dataset.
                    </p>
                  </div>
                </div>
              </div>

              {/* right: audit chart & donut like slide 28 */}
              <div className="space-y-4">
                <div className="bg-white rounded-3xl border border-slate-200 p-4">
                  <h4 className="text-xs font-semibold text-sky-800 uppercase mb-2">
                    Supplier Audit Scores (Example)
                  </h4>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={auditScoreData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey="initial" name="Initial Audit" fill="#1d4ed8" />
                        <Bar dataKey="final" name="Final Audit" fill="#60a5fa" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-4">
                  <h4 className="text-xs font-semibold text-sky-800 uppercase mb-2">
                    Audit Non-Conformances (Example)
                  </h4>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={auditNonConformanceData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={2}
                        >
                          {auditNonConformanceData.map((entry, index) => (
                            <Cell
                              key={entry.name}
                              fill={
                                COMMUNITY_COLORS[index % COMMUNITY_COLORS.length]
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "Human Capital":
        return (
          <div className="space-y-6">
            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              <p className="text-xs font-semibold text-sky-700 uppercase tracking-[0.18em]">
                Social – People
              </p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">
                Human Rights, Inclusion & Workforce Experience
              </h2>
              <p className="mt-3 text-sm text-slate-600 max-w-3xl">
                Connect human rights commitments with everyday people
                experience, engagement and inclusion in your organisation.
              </p>
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Human rights + saliency text */}
              <div className="xl:col-span-2 space-y-4">
                <div className="bg-white rounded-3xl border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Human Rights
                  </h3>
                  <p className="mt-2 text-xs text-slate-600">
                    Your social metrics can be used to evidence a commitment to
                    respecting human rights across operations and the value
                    chain.
                  </p>
                  <ul className="mt-3 list-disc list-inside text-xs text-slate-600 space-y-1">
                    <li>Protect and respect human rights in all activities.</li>
                    <li>Promote health, safety and wellbeing of workers.</li>
                    <li>Foster inclusion and fair treatment for everyone.</li>
                    <li>Support a just transition in affected communities.</li>
                    <li>
                      Partner with communities and stakeholders on shared
                      priorities.
                    </li>
                  </ul>

                  <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50/40 px-4 py-3">
                    <p className="text-[11px] font-semibold text-sky-800 uppercase mb-1">
                      Sustainability Aspirations (Examples)
                    </p>
                    <ul className="list-disc list-inside text-[11px] text-slate-700 space-y-1">
                      <li>
                        Human Rights: source from suppliers with robust human
                        rights controls.
                      </li>
                      <li>
                        Safety: aim for continuous reduction in workplace
                        incidents.
                      </li>
                      <li>
                        Diversity, Equity & Inclusion: build a respectful,
                        inclusive culture where every person is valued.
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Saliency Assessment
                  </h3>
                  <p className="mt-2 text-xs text-slate-600">
                    Prioritise the most significant human-rights and social
                    risks, and link them to your metrics and action plans.
                  </p>
                  <ul className="mt-3 list-disc list-inside text-xs text-slate-600 space-y-1">
                    <li>Identify high-risk issues across operations and value chain.</li>
                    <li>Prioritise topics with the greatest potential impact.</li>
                    <li>Validate with stakeholders and experts.</li>
                    <li>Report annually on progress and outcomes.</li>
                  </ul>
                </div>
              </div>

              {/* Right: numeric + engagement index (re-using bar chart) */}
              <div className="space-y-4">
                <div className="bg-white rounded-3xl border border-emerald-100 p-5">
                  <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-1">
                    Engagement Index
                  </p>
                  <p className="text-3xl font-extrabold text-slate-900">
                    {employeeEngagement.toFixed(1)}/100
                  </p>
                  <div className="mt-3">
                    <ProgressBar value={employeeEngagement} />
                  </div>
                  <p className="mt-2 text-[11px] text-slate-600">
                    Derived from your social dataset as a proxy for how valued
                    and included employees feel.
                  </p>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-5">
                  <p className="text-xs font-semibold text-slate-800 uppercase mb-2">
                    Engagement Split
                  </p>
                  {hasAnyData ? (
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={humanCapitalData}
                          layout="vertical"
                          margin={{ top: 5, right: 20, bottom: 5, left: 40 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" domain={[0, 100]} />
                          <YAxis dataKey="group" type="category" />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="value" barSize={22}>
                            {humanCapitalData.map((entry, index) => (
                              <Cell
                                key={index}
                                fill={
                                  ENGAGED_COLORS[index % ENGAGED_COLORS.length]
                                }
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    renderNoData("engagement")
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case "Community":
        return (
          <div className="space-y-6">
            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              <p className="text-xs font-semibold text-sky-700 uppercase tracking-[0.18em]">
                Social – Communities
              </p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">
                Strengthening Communities & Indigenous Rights
              </h2>
              <p className="mt-3 text-sm text-slate-600 max-w-3xl">
                Reflect how your organisation partners with communities, respects
                Indigenous Peoples and channels CSI / SED investments.
              </p>
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* left: community engagement card like "Building Together" */}
              <div className="xl:col-span-2 space-y-4">
                <div className="bg-white rounded-3xl border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Strengthening Communities
                  </h3>
                  <p className="mt-2 text-xs text-slate-600">
                    Capture enterprise-wide initiatives that support local
                    communities through volunteering, philanthropy and shared
                    value projects.
                  </p>
                  <ul className="mt-3 list-disc list-inside text-xs text-slate-600 space-y-1">
                    <li>
                      Multi-year community programmes aligned with local needs.
                    </li>
                    <li>
                      Partnerships with NGOs, social enterprises and community
                      organisations.
                    </li>
                    <li>
                      Employee volunteering and skills-based support for
                      community projects.
                    </li>
                  </ul>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
                    <div className="rounded-2xl border border-sky-100 bg-sky-50/40 px-3 py-2">
                      <p className="font-semibold text-sky-800 uppercase">
                        Community Index
                      </p>
                      <p className="text-slate-900 text-lg">
                        {communityPrograms}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 px-3 py-2">
                      <p className="font-semibold text-emerald-800 uppercase">
                        Engagement Proxy
                      </p>
                      <p className="text-slate-900 text-lg">
                        {communityEngagementRevenuePct.toFixed(1)}% revenue
                      </p>
                    </div>
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 px-3 py-2">
                      <p className="font-semibold text-indigo-800 uppercase">
                        Stakeholder Score
                      </p>
                      <p className="text-slate-900 text-lg">
                        {stakeholderSurveyScore}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Indigenous Peoples & Local Communities
                  </h3>
                  <p className="mt-2 text-xs text-slate-600">
                    Use ESG data and qualitative inputs to demonstrate respect
                    for the rights of Indigenous Peoples and local communities.
                  </p>
                  <ul className="mt-3 list-disc list-inside text-xs text-slate-600 space-y-1">
                    <li>Identify projects that may affect Indigenous lands.</li>
                    <li>Engage early and seek free, prior and informed consent.</li>
                    <li>
                      Build long-term relationships through co-created
                      programmes and benefit sharing.
                    </li>
                  </ul>
                </div>
              </div>

              {/* right: investment mix + proxy surveys - FIXED: Reverted to original background color */}
              <div className="space-y-4">
                <div className="bg-white rounded-3xl border border-slate-200 p-5">
                  <h4 className="text-xs font-semibold text-sky-800 uppercase mb-2">
                    Community Investment Mix
                  </h4>
                  {hasAnyData ? (
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={communityAllocationData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={70}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {communityAllocationData.map((entry, index) => (
                              <Cell
                                key={index}
                                fill={
                                  COMMUNITY_COLORS[
                                    index % COMMUNITY_COLORS.length
                                  ]
                                }
                              />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    renderNoData("community investment")
                  )}
                </div>

                <div className="rounded-3xl border border-indigo-100 bg-indigo-50 p-4">
                  <p className="text-xs font-semibold text-indigo-800 uppercase">
                    Stakeholder Survey (Proxy)
                  </p>
                  <p className="text-2xl font-bold text-indigo-900">
                    {stakeholderSurveyScore}
                  </p>
                  <p className="text-[11px] text-indigo-700 mt-1">
                    Indicates how external stakeholders perceive your community
                    and social programmes.
                  </p>
                </div>

                <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-xs font-semibold text-blue-800 uppercase">
                    Supplier Survey (Proxy)
                  </p>
                  <p className="text-2xl font-bold text-blue-900">
                    {supplierSurveyScore}
                  </p>
                  <p className="text-[11px] text-blue-700 mt-1">
                    Reflects supplier experience of your social and community
                    commitments.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-sky-50 to-slate-100 py-10 font-sans flex justify-center">
      <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-sky-700 uppercase">
              AfricaESG.AI
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              ESG – Social
            </h1>
            <p className="mt-2 text-sm text-gray-600 max-w-2xl">
              Human rights, people, ethical supply chain and community
              performance laid out in an ESG social format similar to listed
              company disclosures.
            </p>
          </div>

          {/* Download Button - matches Dashboard's Download ESG Report */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadSocialReport}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-full shadow flex items-center gap-2 text-sm font-semibold transition-colors duration-200"
            >
              <svg 
                stroke="currentColor" 
                fill="currentColor" 
                strokeWidth="0" 
                viewBox="0 0 384 512" 
                height="1em" 
                width="1em" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M181.9 256.1c-5-16-4.9-46.9-2-46.9 8.4 0 7.6 36.9 2 46.9zm-1.7 47.2c-7.7 20.2-17.3 43.3-28.4 62.7 18.3-7 39-17.2 62.9-21.9-12.7-9.6-24.9-23.4-34.5-40.8zM86.1 428.1c0 .8 13.2-5.4 34.9-40.2-6.7 6.3-29.1 24.5-34.9 40.2zM248 160h136v328c0 13.3-10.7 24-24 24H24c-13.3 0-24-10.7-24-24V24C0 10.7 10.7 0 24 0h200v136c0 13.2 10.8 24 24 24zm-8 171.8c-20-12.2-33.3-29-42.7-53.8 4.5-18.5 11.6-46.6 6.2-64.2-4.7-29.4-42.4-26.5-47.8-6.8-5 18.3-.4 44.1 8.1 77-11.6 27.6-28.7 64.6-40.8 85.8-.1 0-.1.1-.2.1-27.1 13.9-73.6 44.5-54.5 68 5.6 6.9 16 10 21.5 10 17.9 0 35.7-18 61.1-61.8 25.8-8.5 54.1-19.1 79-23.2 21.7 11.8 47.1 19.5 64 19.5 29.2 0 31.2-32 19.7-43.4-13.9-13.6-54.3-9.7-73.6-7.2zM377 105L279 7c-4.5-4.5-10.6-7-17-7h-6v128h128v-6.1c0-6.3-2.5-12.4-7-16.9zm-74.1 255.3c4.1-2.7-2.5-11.9-42.8-9 37.1 15.8 42.8 9 42.8 9z"></path>
              </svg>
              Download Social Report
            </button>
          </div>
        </header>

        {/* TABS – navigation unchanged */}
        <div className="bg-white/80 backdrop-blur rounded-full border border-sky-100 shadow-sm inline-flex p-1 gap-1">
          {TABS.map((tab) => {
            const Icon = TAB_ICONS[tab];
            const active = activeTab === tab;

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition ${
                  active
                    ? "bg-sky-600 text-white shadow"
                    : "text-sky-700 hover:bg-sky-50"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab}
              </button>
            );
          })}
        </div>

        {/* MAIN CONTENT */}
        {renderTabContent()}

        {/* FOOTER - FIXED: Removed extra items */}
        <footer className="mt-8 pt-6 border-t border-slate-200 text-center">
          <div className="text-sm text-slate-600">
            <p>Powered by AfricaESG.AI</p>
          </div>
        </footer>
      </div>
    </div>
  );
}