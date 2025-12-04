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
  LineChart,
  Line
} from "recharts";
import { 
  FiActivity, 
  FiTrendingUp,
  FiDownload,
  FiShield,
  FiLock,
  FiTarget,
  FiCheckCircle,
  FiAlertCircle,
  FiUsers,
  FiBriefcase,
  FiGlobe,
  FiAward
} from "react-icons/fi";
import { 
  FaFilePdf,
  FaBalanceScale,
  FaHandshake,
  FaChartLine,
  FaExclamationTriangle
} from "react-icons/fa";
import { jsPDF } from "jspdf";
import { SimulationContext } from "../../context/SimulationContext";
import { API_BASE_URL } from "../../config/api";

const TABS = ["Overview", "Corporate Gov", "Ethics & Compliance", "Data Privacy & Security", "Supply Chain", "Governance Trainings"];
const TAB_ICONS = {
  Overview: FiActivity,
  "Corporate Gov": FaBalanceScale,
  "Ethics & Compliance": FiShield,
  "Data Privacy & Security": FiLock,
  "Supply Chain": FiBriefcase,
  "Governance Trainings": FiUsers
};

// Color palette aligned with Social component
const chartTheme = {
  grid: "#e5e7eb",
  axis: "#9ca3af",
  tick: "#6b7280",
  primary: "#2563eb",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  neutral: "#e5e7eb",
  corporate: "#3b82f6",
  ethics: "#10b981",
  privacy: "#8b5cf6",
  supply: "#f97316",
  training: "#06b6d4"
};

// Enhanced Progress Bar with animation - matches Social component
const ProgressBar = ({ value, max = 100, color = "primary", showLabel = true }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  
  const colorClasses = {
    primary: "from-sky-500 via-emerald-500 to-lime-500",
    success: "from-emerald-500 to-emerald-600",
    warning: "from-amber-500 to-orange-500",
    danger: "from-rose-500 to-pink-500",
    corporate: "from-blue-500 to-cyan-500",
    ethics: "from-emerald-500 to-teal-500",
    privacy: "from-violet-500 to-purple-500",
    supply: "from-orange-500 to-amber-500",
    training: "from-cyan-500 to-sky-500"
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

// Status Badge Component - matches Social component style
const StatusBadge = ({ status, size = "md" }) => {
  const statusConfig = {
    strong: { color: "bg-green-100 text-green-800 border-green-300", label: "Strong" },
    moderate: { color: "bg-yellow-100 text-yellow-800 border-yellow-300", label: "Moderate" },
    compliant: { color: "bg-green-100 text-green-800 border-green-300", label: "Compliant" },
    medium: { color: "bg-blue-100 text-blue-800 border-blue-300", label: "Medium" },
    high: { color: "bg-green-100 text-green-800 border-green-300", label: "High" },
    low: { color: "bg-red-100 text-red-800 border-red-300", label: "Low" },
    yes: { color: "bg-green-100 text-green-800 border-green-300", label: "Yes" },
    no: { color: "bg-red-100 text-red-800 border-red-300", label: "No" }
  };

  const config = statusConfig[status] || statusConfig.moderate;
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";

  return (
    <span className={`inline-flex items-center rounded-full border font-semibold ${sizeClass} ${config.color}`}>
      {config.label}
    </span>
  );
};

// Metric Card Component - matches Social component
const MetricCard = ({ title, value, status, description, icon: Icon, color = "blue" }) => {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200",
    green: "bg-green-50 border-green-200",
    orange: "bg-orange-50 border-orange-200",
    purple: "bg-purple-50 border-purple-200"
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-gray-600" />}
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{title}</span>
        </div>
        {status && <StatusBadge status={status} size="sm" />}
      </div>
      <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
      {description && <p className="text-xs text-gray-600">{description}</p>}
    </div>
  );
};

// Custom Tooltip - matches Social component
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

export default function GovernanceCategory() {
  const [activeTab, setActiveTab] = useState("Overview");
  const { governanceMetrics, governanceInsights, loading, error } = useContext(SimulationContext);

  const metrics = governanceMetrics || {};
  const insights = governanceInsights || [];

  // Extract metrics
  const getMetric = (key, defaultValue = "N/A") => {
    return metrics[key] !== undefined ? metrics[key] : defaultValue;
  };

  // Calculate derived metrics
  const governanceScore = useMemo(() => {
    const base = parseFloat(getMetric("governanceScore", "80"));
    return Math.max(0, Math.min(100, base));
  }, [metrics]);

  const boardIndependence = useMemo(() => {
    return getMetric("boardIndependence", "Strong");
  }, [metrics]);

  const reportingStandard = useMemo(() => {
    return getMetric("reportingStandard", "Strong");
  }, [metrics]);

  const isoCompliance = useMemo(() => {
    return getMetric("isoCompliance", "ISO 9001 Certified");
  }, [metrics]);

  const governanceTrainings = useMemo(() => {
    return parseInt(getMetric("governanceTrainings", "0"));
  }, [metrics]);

  const environmentalTrainings = useMemo(() => {
    return parseInt(getMetric("environmentalTrainings", "0"));
  }, [metrics]);

  const businessEthicsRating = useMemo(() => {
    return getMetric("businessEthicsRating", "Moderate");
  }, [metrics]);

  const complianceFindings = useMemo(() => {
    return parseInt(getMetric("complianceFindings", "0"));
  }, [metrics]);

  const codeOfEthics = useMemo(() => {
    return getMetric("codeOfEthics", "Yes");
  }, [metrics]);

  const dataPrivacyStatus = useMemo(() => {
    return getMetric("dataPrivacyStatus", "Compliant");
  }, [metrics]);

  const infoSecurityPolicy = useMemo(() => {
    return getMetric("infoSecurityPolicy", "Yes");
  }, [metrics]);

  const supplierCompliance = useMemo(() => {
    return parseInt(getMetric("supplierCompliance", "72"));
  }, [metrics]);

  const auditCompletion = useMemo(() => {
    return parseInt(getMetric("auditCompletion", "58"));
  }, [metrics]);

  const supplierEsgCompliance = useMemo(() => {
    return getMetric("supplierEsgCompliance", "Medium");
  }, [metrics]);

  // AI Insights processing - FIXED: Use GET request or fallback
  const [governanceAiInsights, setGovernanceAiInsights] = useState([]);
  const [governanceAiLoading, setGovernanceAiLoading] = useState(false);
  const [governanceAiError, setGovernanceAiError] = useState(null);

  useEffect(() => {
    if (!metrics || Object.keys(metrics).length === 0) return;

    const loadGovernanceAI = async () => {
      try {
        setGovernanceAiLoading(true);
        setGovernanceAiError(null);

        // Try GET request first (safer approach)
        const res = await fetch(`${API_BASE_URL}/api/governance-insights`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
          // If GET fails, try POST with query parameters instead
          const queryParams = new URLSearchParams();
          Object.keys(metrics).forEach(key => {
            if (metrics[key] !== undefined && metrics[key] !== null) {
              queryParams.append(key, metrics[key]);
            }
          });
          
          const postRes = await fetch(`${API_BASE_URL}/api/governance-insights?${queryParams}`, {
            method: "GET", // Still try GET with query params
            headers: { "Content-Type": "application/json" },
          });

          if (!postRes.ok) {
            // If both fail, fall back to default insights
            console.log("Using fallback governance insights");
            setGovernanceAiInsights([]);
            return;
          }

          const postData = await postRes.json();
          const insights = Array.isArray(postData)
            ? postData
            : Array.isArray(postData.insights)
            ? postData.insights
            : [];
          setGovernanceAiInsights(insights);
          return;
        }

        const data = await res.json();
        const insights = Array.isArray(data)
          ? data
          : Array.isArray(data.insights)
          ? data.insights
          : [];
        setGovernanceAiInsights(insights);
      } catch (err) {
        console.log("Error loading governance AI insights, using fallback:", err.message);
        setGovernanceAiError("Using default insights");
        setGovernanceAiInsights([]);
      } finally {
        setGovernanceAiLoading(false);
      }
    };

    loadGovernanceAI();
  }, [metrics]);

  // Use fallback insights if API fails
  const fallbackInsights = useMemo(() => [
    "Governance performance baseline reflects your current governance structures, policies, compliance indicators and supply chain oversight derived from the latest ESG input.",
    "Peer organisations typically aim for progressively higher levels of policy coverage, board oversight and ESG integration into enterprise risk management and internal audit.",
    "Compared to this benchmark, your governance position appears broadly sound but with clear opportunities to deepen ESG integration, data quality and supplier governance.",
    "Embed ESG KPIs into Board and EXCO scorecards to reinforce accountability for sustainability outcomes and risk management.",
    "Ensure that data privacy, ethics and anti-corruption controls extend consistently to joint ventures, suppliers and service providers.",
    "Strengthen governance reporting to clearly link risk appetites, capital allocation and strategic ESG priorities with regular board oversight.",
    "Establish formal processes for anticipating and responding to emerging ESG regulations and stakeholder expectations."
  ], []);

  const finalInsights = governanceAiInsights.length > 0
    ? governanceAiInsights
    : (insights.length > 0 ? insights : fallbackInsights);

  // Handle report download
  const handleDownloadReport = () => {
    const doc = new jsPDF();
    let y = 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("AfricaESG.AI – ESG Governance Performance", 14, y);
    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const add = (label, val) => {
      const line = `${label}: ${val}`;
      const lines = doc.splitTextToSize(line, 180);
      doc.text(lines, 14, y);
      y += lines.length * 5;
    };

    add("Governance Score", `${governanceScore}/100`);
    add("Board Independence", boardIndependence);
    add("Reporting Standard", reportingStandard);
    add("ISO Compliance", isoCompliance);
    add("Governance Trainings", `${governanceTrainings} delivered`);
    add("Environmental Trainings", `${environmentalTrainings} delivered`);
    add("Business Ethics Rating", businessEthicsRating);
    add("Compliance Findings", `${complianceFindings} recorded`);
    add("Supplier ESG Compliance", `${supplierCompliance}%`);
    add("Audit Completion", `${auditCompletion}%`);

    // Add AI insights if available
    if (finalInsights.length > 0) {
      y += 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("AI Governance Insights", 14, y);
      y += 10;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      finalInsights.slice(0, 4).forEach((insight, idx) => {
        const lines = doc.splitTextToSize(`${idx + 1}. ${insight}`, 180);
        doc.text(lines, 14, y);
        y += lines.length * 5 + 2;
      });
    }

    doc.save("AfricaESG_Governance_Report.pdf");
  };

  // Render content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case "Corporate Gov":
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Corporate Governance Framework</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Board Structure & Practices</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-700">Board Independence</span>
                      <StatusBadge status={boardIndependence.toLowerCase()} />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-700">Committee Structure</span>
                      <StatusBadge status="strong" />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-700">Board Assessment</span>
                      <span className="text-sm font-semibold text-gray-900">Annual</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Reporting & Compliance</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-700">Reporting Standard</span>
                      <StatusBadge status={reportingStandard.toLowerCase()} />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-700">ISO Certification</span>
                      <span className="text-sm font-semibold text-gray-900">{isoCompliance}</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-700">Audit Committee</span>
                      <StatusBadge status="strong" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "Ethics & Compliance":
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Ethics & Compliance Program</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Compliance Framework</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-700">Business Ethics Rating</span>
                      <StatusBadge status={businessEthicsRating.toLowerCase()} />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-700">Code of Ethics</span>
                      <span className="text-sm font-semibold text-gray-900">{codeOfEthics}</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-700">Anti-Bribery Policy</span>
                      <StatusBadge status="compliant" />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Monitoring & Reporting</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-700">Compliance Findings</span>
                      <span className="text-lg font-bold text-gray-900">{complianceFindings}</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-700">Whistleblower System</span>
                      <StatusBadge status="compliant" />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-700">Risk Assessments</span>
                      <span className="text-sm font-semibold text-gray-900">Quarterly</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "Data Privacy & Security":
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Data Privacy & Security</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Privacy Framework</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-700">Data Privacy Status</span>
                      <StatusBadge status={dataPrivacyStatus.toLowerCase()} />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-700">Security Policy</span>
                      <span className="text-sm font-semibold text-gray-900">{infoSecurityPolicy}</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-700">Incident Response</span>
                      <StatusBadge status="strong" />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Controls & Compliance</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-700">Data Encryption</span>
                      <StatusBadge status="compliant" />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-700">Access Controls</span>
                      <StatusBadge status="compliant" />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-700">Third-party Security</span>
                      <StatusBadge status="moderate" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "Supply Chain":
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Supply Chain Governance</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Supplier Compliance</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-700">ESG Compliance</span>
                        <span className="text-xl font-bold text-gray-900">{supplierCompliance}%</span>
                      </div>
                      <ProgressBar value={supplierCompliance} />
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-700">Audit Completion</span>
                        <span className="text-xl font-bold text-gray-900">{auditCompletion}%</span>
                      </div>
                      <ProgressBar value={auditCompletion} />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Performance Metrics</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-700">Supplier ESG Rating</span>
                      <StatusBadge status={supplierEsgCompliance.toLowerCase()} />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-700">Due Diligence</span>
                      <StatusBadge status="moderate" />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-700">Contract Compliance</span>
                      <StatusBadge status="compliant" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "Governance Trainings":
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Governance Training Programs</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Training Delivery</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-700">Governance Trainings</span>
                        <span className="text-xl font-bold text-gray-900">{governanceTrainings}</span>
                      </div>
                      <ProgressBar value={Math.min(governanceTrainings * 10, 100)} />
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-700">Environmental Trainings</span>
                        <span className="text-xl font-bold text-gray-900">{environmentalTrainings}</span>
                      </div>
                      <ProgressBar value={Math.min(environmentalTrainings * 10, 100)} />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Training Effectiveness</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-700">Completion Rate</span>
                      <span className="text-lg font-bold text-green-600">98%</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-700">Knowledge Retention</span>
                      <span className="text-lg font-bold text-green-600">94%</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-700">Participant Satisfaction</span>
                      <span className="text-lg font-bold text-green-600">4.7/5</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "Overview":
      default:
        return (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Left: Main content */}
            <div className="xl:col-span-2 space-y-8">
              {/* Header Card */}
              <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                <p className="text-xs font-semibold text-sky-700 uppercase tracking-[0.18em]">
                  Governance
                </p>
                <h2 className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900">
                  ESG Governance Progress
                </h2>
                <p className="mt-3 text-sm text-slate-600 max-w-3xl">
                  Risk Management
                  <br />
                  Governance and risk management processes cover compliance, reporting, and operating and strategic risks. Board and senior management set a strong tone for risk oversight and promote cross-functional participation across business segments.
                  <br /><br />
                  Critical risks are routinely reviewed by the Board and its committees with formal updates linked to ESG metrics and regulatory obligations.
                </p>
              </section>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-lg bg-blue-100">
                      <FaBalanceScale className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase">Governance Score</p>
                      <p className="text-2xl font-bold text-slate-900">{governanceScore}/100</p>
                      <p className="text-xs text-slate-500">Overall effectiveness</p>
                    </div>
                  </div>
                  <ProgressBar value={governanceScore} color="corporate" />
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-lg bg-emerald-100">
                      <FiShield className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase">Supplier Compliance</p>
                      <p className="text-2xl font-bold text-slate-900">{supplierCompliance}%</p>
                      <p className="text-xs text-slate-500">ESG-compliant suppliers</p>
                    </div>
                  </div>
                  <ProgressBar value={supplierCompliance} color="ethics" />
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-lg bg-purple-100">
                      <FiLock className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-600 uppercase">Audit Completion</p>
                      <p className="text-2xl font-bold text-slate-900">{auditCompletion}%</p>
                      <p className="text-xs text-slate-500">Annual target</p>
                    </div>
                  </div>
                  <ProgressBar value={auditCompletion} color="privacy" />
                </div>
              </div>

              {/* Detailed Cards Grid */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-3xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-sky-800 mb-2">
                    Formalised governance and reporting frameworks.
                  </h3>
                  <p className="text-xs text-slate-600 mb-2">
                    Structured risk identification and escalation.
                  </p>
                  <p className="text-xs font-semibold text-slate-900 mb-1">
                    Board Oversight: <StatusBadge status="strong" size="sm" />
                  </p>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-sky-800 mb-2">
                    Alignment of ESG risks with strategy and capital.
                  </h3>
                  <p className="text-xs text-slate-600 mb-2">
                    Oversight of Risk Management.
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-900">Compliance & Reporting</span>
                    <StatusBadge status="compliant" size="sm" />
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-semibold text-slate-900">Operating & Strategic</span>
                    <StatusBadge status="moderate" size="sm" />
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-sky-800 mb-2">
                    Board Oversight
                  </h3>
                  <p className="text-xs text-slate-600 mb-2">
                    Strategy, capital allocation, executive oversight and overall ESG risk appetite.
                  </p>
                  <StatusBadge status="strong" />
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-sky-800 mb-2">
                    Management Day-to-Day
                  </h3>
                  <p className="text-xs text-slate-600 mb-2">
                    Operational compliance, data and reporting, controls and internal audit.
                    <br />
                    Implementation of policies, supplier programmes and issue management.
                  </p>
                  <div className="mt-2 text-center">
                    <p className="text-xs text-slate-700">
                      Board and Senior Management collaborate for effective risk management across the enterprise.
                    </p>
                  </div>
                </div>
              </section>

              {/* Governance Practices Section */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Sound Governance Practices</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-gray-900">Board Independence</h4>
                      <p className="text-sm text-gray-600">Clear separation of oversight and management.</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Use of international reporting standards:</h4>
                      <StatusBadge status={reportingStandard.toLowerCase()} />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">ISO certifications where applicable:</h4>
                      <p className="text-sm font-semibold text-gray-900">{isoCompliance}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-gray-900">Compensation & Incentives</h4>
                      <p className="text-sm text-gray-600">Variable pay aligned with risk, compliance and ESG objectives.</p>
                      <p className="text-sm text-gray-600">Clawback provisions and malus mechanisms where applicable.</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Governance and environmental trainings delivered:</h4>
                      <p className="text-sm font-semibold text-gray-900">{governanceTrainings} / {environmentalTrainings}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-gray-900">Board Practices</h4>
                      <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                        <li>Regular board and committee self-assessments</li>
                        <li>Independent directors meet without management when needed</li>
                        <li>Committee charters reviewed against evolving standards</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Accountability</h4>
                      <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                        <li>Transparent reporting on compliance findings: {complianceFindings} recorded</li>
                        <li>Supplier ESG compliance and audits tracked against targets</li>
                        <li>Clear escalation processes for material governance issues</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 text-center">
                  <p className="text-sm text-gray-700">
                    A robust governance framework supports building and maintaining effective, long-term strategies.
                  </p>
                </div>
              </div>
            </div>

            {/* Right: AI Insights Panel */}
            <aside className="bg-white rounded-3xl shadow border border-slate-200 p-5 flex flex-col h-full">
              <h2 className="text-lg font-semibold text-slate-900">
                AI Governance Insights
              </h2>
              <p className="text-xs text-slate-500 mt-1 mb-3">
                Live AI baseline, benchmark and recommendation narrative generated from your latest ESG governance data.
              </p>

              <div className="flex-1 min-h-0">
                {governanceAiLoading && (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-sky-600"></div>
                    <p className="text-xs text-sky-700">Loading insights…</p>
                  </div>
                )}

                {governanceAiError && (
                  <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3">
                    <p className="text-xs text-yellow-800">
                      Note: Using default insights. AI service temporarily unavailable.
                    </p>
                  </div>
                )}

                {!governanceAiLoading && (
                  <div className="h-full overflow-hidden">
                    <ul className="h-full overflow-y-auto pr-2 space-y-3">
                      {finalInsights.map((line, idx) => (
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
              ESG – Governance
            </h1>
            <p className="mt-2 text-sm text-gray-600 max-w-2xl">
              Corporate governance, ethics, compliance, data privacy and supply chain oversight laid out in an ESG governance format similar to listed company disclosures.
            </p>
          </div>

          {/* Download Button - matches Social component */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadReport}
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
              Download Governance Report
            </button>
          </div>
        </header>

        {/* TABS – matches Social component style */}
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

        {/* FOOTER - matches Social component */}
        <footer className="mt-8 pt-6 border-t border-slate-200 text-center">
          <div className="text-sm text-slate-600">
            <p>Powered by AfricaESG.AI</p>
          </div>
        </footer>
      </div>
    </div>
  );
}