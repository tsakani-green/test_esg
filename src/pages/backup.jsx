import React, { useContext, useMemo, useState } from "react";
import {
  FaFilePdf,
  FaBalanceScale,
  FaShieldAlt,
  FaTruck,
  FaCheckCircle,
  FaExclamationTriangle,
} from "react-icons/fa";
import {
  FiActivity,
  FiBookOpen,
  FiLock,
  FiTrendingUp,
  FiTrendingDown,
  FiTarget,
  FiDownload,
  FiUsers,
  FiUserCheck,
  FiGlobe,
  FiAward,
} from "react-icons/fi";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { SimulationContext } from "../context/SimulationContext";

const TABS = [
  { id: "overview", label: "Overview", icon: FiActivity },
  { id: "corporate", label: "Corporate Governance", icon: FaBalanceScale },
  { id: "ethics", label: "Ethics & Compliance", icon: FaShieldAlt },
  { id: "privacy", label: "Data Privacy", icon: FiLock },
  { id: "supply", label: "Supply Chain", icon: FaTruck },
  { id: "training", label: "Governance Training", icon: FiBookOpen },
];

// Color palette matching the social screenshots
const colors = {
  primary: "#1e40af", // Deep blue from headers
  secondary: "#3b82f6", // Medium blue
  accent: "#10b981", // Green for progress
  positive: "#22c55e", // Success green
  negative: "#ef4444", // Error red
  neutral: "#6b7280", // Gray
  background: "#f8fafc", // Light background
  card: "#ffffff", // White cards
};

// Progress Bar Component
const ProgressBar = ({ value = 0, label, showValue = true }) => {
  const percentage = Math.min(100, Math.max(0, value));
  
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-sm">
          <span className="font-medium text-gray-700">{label}</span>
          {showValue && (
            <span className="font-bold text-gray-900">{percentage.toFixed(1)}%</span>
          )}
        </div>
      )}
      <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// Metric Card Component (similar to social screenshots)
const MetricCard = ({ title, value, unit, description, icon: Icon, color = "blue" }) => {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    orange: "bg-orange-50 border-orange-200 text-orange-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
  };

  return (
    <div className={`rounded-lg border ${colorClasses[color]} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4" />}
          <span className="text-xs font-semibold uppercase tracking-wide">{title}</span>
        </div>
        {unit && <span className="text-xs text-gray-600">{unit}</span>}
      </div>
      <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
      {description && (
        <p className="text-xs text-gray-600">{description}</p>
      )}
    </div>
  );
};

// Governance Status Component
const GovernanceStatus = ({ status, label, description }) => {
  const statusColors = {
    compliant: "bg-green-100 text-green-800 border-green-300",
    "in-progress": "bg-blue-100 text-blue-800 border-blue-300",
    "needs-review": "bg-yellow-100 text-yellow-800 border-yellow-300",
    "non-compliant": "bg-red-100 text-red-800 border-red-300",
  };

  return (
    <div className="flex items-start justify-between p-3 bg-white rounded-lg border border-gray-200">
      <div className="flex-1">
        <h4 className="font-medium text-gray-900 mb-1">{label}</h4>
        {description && <p className="text-sm text-gray-600">{description}</p>}
      </div>
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColors[status] || statusColors['in-progress']}`}>
        {status === "compliant" && "Compliant"}
        {status === "in-progress" && "In Progress"}
        {status === "needs-review" && "Needs Review"}
        {status === "non-compliant" && "Non-Compliant"}
      </span>
    </div>
  );
};

export default function GovernanceCategory() {
  const [activeTab, setActiveTab] = useState("overview");

  const {
    governanceMetrics,
    governanceInsights,
    governanceSummary,
    loading,
    error,
  } = useContext(SimulationContext);

  const metrics = governanceMetrics || {};
  const insights = governanceInsights || [];
  const summary = governanceSummary || {};

  // Extract values from metrics
  const getMetric = (key, defaultValue = "N/A") => {
    return metrics[key] !== undefined ? metrics[key] : defaultValue;
  };

  const getSummary = (key, defaultValue = "N/A") => {
    return summary[key] !== undefined ? summary[key] : defaultValue;
  };

  // Calculate derived metrics
  const governanceScore = useMemo(() => {
    const baseScore = parseFloat(getMetric("governanceScore", "80"));
    const findings = parseFloat(getSummary("totalComplianceFindings", "0"));
    return Math.max(0, Math.min(100, baseScore - findings * 2));
  }, [metrics, summary]);

  const supplierCompliance = useMemo(() => {
    return parseFloat(getMetric("supplierCompliance", "85"));
  }, [metrics]);

  const auditCompletion = useMemo(() => {
    return parseFloat(getMetric("auditCompletion", "92"));
  }, [metrics]);

  const dataPrivacyCompliance = useMemo(() => {
    return getMetric("dataPrivacyCompliance", "Compliant");
  }, [metrics]);

  const ethicsCompliance = useMemo(() => {
    return getMetric("ethicsCompliance", "Compliant");
  }, [metrics]);

  // Chart data
  const complianceTrendData = [
    { month: "Jan", findings: 12, audits: 85 },
    { month: "Feb", findings: 8, audits: 88 },
    { month: "Mar", findings: 15, audits: 82 },
    { month: "Apr", findings: 6, audits: 90 },
    { month: "May", findings: 9, audits: 87 },
    { month: "Jun", findings: 5, audits: 92 },
  ];

  const governanceDistributionData = [
    { name: "Compliant", value: 75, color: colors.positive },
    { name: "In Progress", value: 15, color: colors.secondary },
    { name: "Needs Review", value: 8, color: colors.negative },
    { name: "Not Started", value: 2, color: colors.neutral },
  ];

  // AI Insights processing
  const aiInsights = insights.length > 0 ? insights : [
    "Governance performance baseline reflects current corporate structure, compliance status, and oversight mechanisms from your latest ESG upload.",
    "Comparable African corporates typically target steadily improving board effectiveness, compliance maturity, and stakeholder transparency as part of their broader ESG journey.",
    "Against this benchmark, your governance indicators show a mix of established frameworks and evolving compliance areas that can be enhanced through focused governance initiatives.",
    "Strengthen board committee charters with clear ESG oversight responsibilities and regular reporting cadence.",
    "Implement automated compliance tracking for regulatory changes and policy updates across all jurisdictions.",
    "Enhance stakeholder communication through regular governance disclosures and transparent reporting channels."
  ];

  // Handle report download
  const handleDownloadReport = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(24);
    doc.setTextColor(colors.primary);
    doc.text("ESG – Governance Performance", 20, 30);
    
    doc.setFontSize(12);
    doc.setTextColor(colors.neutral);
    doc.text("AfricaESG.AI", 20, 40);
    
    // Company Info
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Governance Performance Summary", 20, 60);
    
    doc.setFontSize(11);
    const metrics = [
      ["Governance Score", `${governanceScore.toFixed(1)}/100`],
      ["Supplier Compliance", `${supplierCompliance}%`],
      ["Audit Completion", `${auditCompletion}%`],
      ["Data Privacy", dataPrivacyCompliance],
      ["Ethics Compliance", ethicsCompliance],
    ];
    
    let y = 70;
    metrics.forEach(([label, value]) => {
      doc.text(`${label}: ${value}`, 20, y);
      y += 10;
    });
    
    // AI Insights
    y += 10;
    doc.setFontSize(14);
    doc.text("AI Governance Insights", 20, y);
    y += 10;
    
    doc.setFontSize(11);
    aiInsights.slice(0, 3).forEach((insight, idx) => {
      const lines = doc.splitTextToSize(`• ${insight}`, 170);
      lines.forEach(line => {
        doc.text(line, 25, y);
        y += 7;
      });
    });
    
    // Footer
    doc.setFontSize(10);
    doc.setTextColor(colors.neutral);
    doc.text("Powered by AfricaESG.AI", 20, doc.internal.pageSize.height - 20);
    doc.text(new Date().toLocaleDateString(), doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 20);
    
    doc.save("ESG_Governance_Report.pdf");
  };

  // Render content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case "corporate":
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-300 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Corporate Governance Framework</h3>
              
              <div className="space-y-4">
                <GovernanceStatus
                  status="compliant"
                  label="Board Structure & Independence"
                  description="Board composition, independent directors, and committee structure"
                />
                
                <GovernanceStatus
                  status="compliant"
                  label="Reporting Standards"
                  description={`${getMetric("reportingStandards", "IFRS, GRI Standards, King IV")}`}
                />
                
                <GovernanceStatus
                  status="compliant"
                  label="ISO Certification"
                  description={`${getMetric("isoCertification", "ISO 9001:2015 Certified")}`}
                />
                
                <div className="pt-4 border-t border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-3">Performance Metrics</h4>
                  <div className="space-y-3">
                    <ProgressBar value={98} label="Board Meeting Attendance" />
                    <ProgressBar value={92} label="Committee Effectiveness" />
                    <ProgressBar value={85} label="Stakeholder Engagement" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "ethics":
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-300 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Ethics & Compliance Program</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <MetricCard
                  title="Code of Conduct"
                  value="100%"
                  unit="adoption"
                  description="Annual certification completed"
                  icon={FaCheckCircle}
                  color="green"
                />
                
                <MetricCard
                  title="Whistleblower Reports"
                  value={getSummary("complianceFindings", "3")}
                  unit="cases"
                  description="Active investigations"
                  icon={FaExclamationTriangle}
                  color="orange"
                />
              </div>
              
              <div className="space-y-4">
                <GovernanceStatus
                  status="compliant"
                  label="Anti-Bribery Policy"
                  description="Comprehensive policy implemented and communicated"
                />
                
                <GovernanceStatus
                  status="in-progress"
                  label="Compliance Training"
                  description="Annual training program underway"
                />
                
                <GovernanceStatus
                  status="compliant"
                  label="Ethics Hotline"
                  description="24/7 confidential reporting available"
                />
              </div>
            </div>
          </div>
        );

      case "privacy":
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-300 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Data Privacy & Security</h3>
              
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-700">Privacy Compliance Status</span>
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                    {dataPrivacyCompliance}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {getMetric("privacyDescription", "GDPR, POPIA, and local data protection regulations compliance")}
                </p>
              </div>
              
              <div className="space-y-4">
                <GovernanceStatus
                  status="compliant"
                  label="Data Encryption"
                  description="End-to-end encryption for all sensitive data"
                />
                
                <GovernanceStatus
                  status="compliant"
                  label="Access Controls"
                  description="Role-based access control implemented"
                />
                
                <GovernanceStatus
                  status="in-progress"
                  label="Third-party Security"
                  description="Vendor security assessments ongoing"
                />
              </div>
            </div>
          </div>
        );

      case "supply":
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-300 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Supply Chain Governance</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-700">Supplier Compliance</span>
                    <span className="text-xl font-bold text-gray-900">{supplierCompliance}%</span>
                  </div>
                  <ProgressBar value={supplierCompliance} />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-700">Audit Completion</span>
                    <span className="text-xl font-bold text-gray-900">{auditCompletion}%</span>
                  </div>
                  <ProgressBar value={auditCompletion} />
                </div>
              </div>
              
              <div className="space-y-4">
                <GovernanceStatus
                  status="in-progress"
                  label="Supplier ESG Screening"
                  description="ESG criteria integrated into vendor selection"
                />
                
                <GovernanceStatus
                  status="compliant"
                  label="Contract Compliance"
                  description="ESG clauses in all major contracts"
                />
                
                <GovernanceStatus
                  status="needs-review"
                  label="Supply Chain Transparency"
                  description="Tier 2+ supplier visibility needs improvement"
                />
              </div>
            </div>
          </div>
        );

      case "training":
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-300 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Governance Training</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <MetricCard
                  title="Total Trainings"
                  value={getSummary("totalTrainings", "24")}
                  unit="sessions"
                  description="Annual program"
                  icon={FiBookOpen}
                  color="blue"
                />
                
                <MetricCard
                  title="Completion Rate"
                  value="98%"
                  unit="participation"
                  description="Mandatory courses"
                  icon={FiUsers}
                  color="green"
                />
                
                <MetricCard
                  title="Satisfaction"
                  value="4.7"
                  unit="/5 rating"
                  description="Participant feedback"
                  icon={FiAward}
                  color="purple"
                />
              </div>
              
              <div className="space-y-3">
                <ProgressBar value={95} label="Governance Training Completion" />
                <ProgressBar value={92} label="Compliance Training Completion" />
                <ProgressBar value={88} label="Leadership Training Completion" />
              </div>
            </div>
          </div>
        );

      case "overview":
      default:
        return (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                title="Governance Score"
                value={governanceScore.toFixed(1)}
                unit="/100"
                description="Overall effectiveness"
                icon={FaBalanceScale}
                color="blue"
              />
              
              <MetricCard
                title="Supplier Compliance"
                value={supplierCompliance}
                unit="%"
                description="ESG-compliant suppliers"
                icon={FaTruck}
                color="green"
              />
              
              <MetricCard
                title="Data Privacy"
                value={dataPrivacyCompliance}
                unit="status"
                description="Regulatory compliance"
                icon={FiLock}
                color="purple"
              />
              
              <MetricCard
                title="Ethics Compliance"
                value={ethicsCompliance}
                unit="status"
                description="Policy adherence"
                icon={FaShieldAlt}
                color="orange"
              />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Compliance Trends */}
              <div className="bg-white rounded-lg border border-gray-300 p-4">
                <h4 className="font-semibold text-gray-900 mb-4">Compliance Trends</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={complianceTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                      <YAxis stroke="#6b7280" fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="findings" 
                        name="Compliance Findings" 
                        stroke={colors.negative}
                        strokeWidth={2}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="audits" 
                        name="Audit Completion %" 
                        stroke={colors.positive}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Governance Status Distribution */}
              <div className="bg-white rounded-lg border border-gray-300 p-4">
                <h4 className="font-semibold text-gray-900 mb-4">Governance Status Distribution</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={governanceDistributionData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${entry.value}%`}
                        outerRadius={80}
                        dataKey="value"
                      >
                        {governanceDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Status Overview */}
            <div className="bg-white rounded-lg border border-gray-300 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Governance Status Overview</h3>
              <div className="space-y-3">
                <GovernanceStatus
                  status="compliant"
                  label="Corporate Governance Framework"
                  description="Board structure, reporting standards, and oversight mechanisms"
                />
                
                <GovernanceStatus
                  status="in-progress"
                  label="Ethics & Compliance Program"
                  description="Code of conduct, anti-bribery policy, and whistleblower system"
                />
                
                <GovernanceStatus
                  status="compliant"
                  label="Data Privacy & Security"
                  description="Data protection, encryption, and access controls"
                />
                
                <GovernanceStatus
                  status="needs-review"
                  label="Supply Chain Governance"
                  description="Supplier screening, audits, and ESG compliance"
                />
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Matching the social screenshot style */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">ESG – Governance</h1>
              <p className="text-sm text-gray-600 mt-2">
                Corporate governance, ethics, compliance, data privacy and supply chain oversight laid out in an ESG governance format similar to listed company disclosures.
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleDownloadReport}
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                <FiDownload className="w-4 h-4" />
                Download/Governance Report
              </button>
            </div>
          </div>
          
          {/* Tabs Navigation */}
          <div className="mt-6 flex space-x-1 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Governance Progress Summary */}
        <div className="mb-8">
          <div className="bg-white rounded-lg border border-gray-300 p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">GOVERNANCE</h2>
            <p className="text-gray-700 mb-6">
              Corporate governance, ethics, compliance, data privacy and supply chain oversight presented in a board-ready governance layout aligned with ESG reporting expectations.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">GOVERNANCE SCORE</h3>
                <div className="text-3xl font-bold text-gray-900">{governanceScore.toFixed(1)}/100</div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600"
                    style={{ width: `${governanceScore}%` }}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">SUPPLIER COMPLIANCE</h3>
                <div className="text-3xl font-bold text-gray-900">{supplierCompliance}%</div>
                <div className="text-sm text-gray-600">of suppliers</div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">AUDIT COMPLETION</h3>
                <div className="text-3xl font-bold text-gray-900">{auditCompletion}%</div>
                <div className="text-sm text-gray-600">annual target</div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">ETHICS RATING</h3>
                <div className="text-3xl font-bold text-gray-900">{getMetric("ethicsRating", "4.2")}/5</div>
                <div className="text-sm text-gray-600">compliance score</div>
              </div>
            </div>
          </div>

          {/* AI Narrative Section - Matching social screenshot style */}
          <div className="bg-white rounded-lg border border-gray-300 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">ESG Governance – AI Narrative</h2>
            <p className="text-sm text-gray-600 mb-4">
              Generated commentary based on your uploaded ESG governance metrics, mirroring the narrative style of listed company ESG reports.
            </p>
            
            <div className="space-y-4">
              {aiInsights.map((insight, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-gray-700 leading-relaxed">{insight}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {renderTabContent()}

        {/* Governance Sections */}
        <div className="mt-8 space-y-6">
          {/* Corporate Governance Section */}
          <div className="bg-white rounded-lg border border-gray-300 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Corporate Governance</h3>
            <p className="text-gray-700 mb-4">
              Framework compliance, board effectiveness, and reporting standards that ensure accountability and transparency.
            </p>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-700">Board Independence</span>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                  {getMetric("boardIndependence", "60%")}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-700">Committee Structure</span>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                  {getMetric("committeeStructure", "Established")}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-700">Reporting Framework</span>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                  {getMetric("reportingFramework", "Integrated")}
                </span>
              </div>
            </div>
          </div>

          {/* Ethics & Compliance Section */}
          <div className="bg-white rounded-lg border border-gray-300 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Ethics & Compliance</h3>
            <p className="text-gray-700 mb-4">
              Policies, training, and monitoring systems to prevent misconduct and ensure regulatory compliance.
            </p>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-700">Code of Conduct</span>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                  {getMetric("codeStatus", "Implemented")}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-700">Compliance Training</span>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                  {getMetric("trainingCompletion", "98%")}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-700">Whistleblower System</span>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                  {getMetric("whistleblowerStatus", "Active")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer - Matching the social screenshot style */}
      <footer className="bg-white border-t border-gray-200 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-gray-600">
            <p>Powered by AfricaESG.AI</p>
            <p className="mt-1">Governance metrics and insights based on your uploaded ESG data</p>
          </div>
        </div>
      </footer>

      {/* FOOTER - FIXED: Removed extra items */}
        <footer className="mt-8 pt-6 border-t border-slate-200 text-center">
          <div className="text-sm text-slate-600">
            <p>Powered by AfricaESG.AI</p>
          </div>
        </footer>
    </div>
  );
}