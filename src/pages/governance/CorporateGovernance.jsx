// src/pages/GovernanceCategory.jsx
import React, { useContext, useState } from "react";
import {
  FaFilePdf,
  FaBalanceScale,
  FaShieldAlt,
  FaUserShield,
  FaTruck,
} from "react-icons/fa";
import { jsPDF } from "jspdf";
import { SimulationContext } from "../../context/SimulationContext";

const TABS = [
  "Overview",
  "Corporate Gov",
  "Ethics & Compliance",
  "Data Privacy & Security",
  "Supply Chain",
  "Governance Trainings",
];

export default function GovernanceCategory() {
  const [activeTab, setActiveTab] = useState("Overview");

  // ---- LOAD FROM SIMULATION CONTEXT (LIVE AI + last uploaded ESG file) ----
  const {
    governanceMetrics,
    governanceInsights,
    governanceSummary,
    loading,
    error,
  } = useContext(SimulationContext);

  const metrics = governanceMetrics || {};
  const insights = governanceInsights || [];

  // The governance AI endpoint returns EXACTLY 6 lines in this order:
  // [0] Baseline, [1] Benchmark, [2] Performance vs benchmark, [3–5] Recommendations
  const baselineText = insights[0];
  const benchmarkText = insights[1];
  const performanceText = insights[2];
  const recommendationTexts = insights.slice(3);

  const metricsVal = (field, fallback = "N/A") =>
    metrics && metrics[field] != null ? metrics[field] : fallback;

  const summaryVal = (field, fallback = "N/A") =>
    governanceSummary && governanceSummary[field] != null
      ? governanceSummary[field]
      : fallback;

  const valueBadgeClass = (value) => {
    if (!value && value !== 0)
      return "bg-slate-50 text-slate-500 border border-slate-200";

    const v = String(value).toLowerCase();

    if (
      v.includes("yes") ||
      v.includes("compliant") ||
      v.includes("aligned") ||
      v.includes("iso") ||
      v.includes("strong") ||
      v.includes("high")
    )
      return "bg-emerald-50 text-emerald-800 border border-emerald-200";

    if (v.includes("no") || v.includes("incident") || v.includes("risk"))
      return "bg-red-50 text-red-700 border border-red-200";

    return "bg-amber-50 text-amber-800 border border-amber-200";
  };

  const governanceSections = [
    {
      key: "corporate",
      title: "Corporate Governance",
      description:
        "Board governance, reporting standards and governance-related training.",
      icon: <FaBalanceScale className="text-sky-800" />,
      accent: "bg-sky-700",
      rows: [
        {
          metric: "Reporting Standard / Framework",
          value: summaryVal(
            "corporateGovernance",
            metricsVal("corporateGovernance")
          ),
        },
        {
          metric: "ISO 9001 Compliance",
          value: summaryVal("iso9001Compliance", metricsVal("isoCompliance")),
        },
        {
          metric: "Governance Trainings Delivered",
          value: summaryVal("totalGovernanceTrainings", "0"),
        },
        {
          metric: "Environmental Trainings Delivered",
          value: summaryVal("totalEnvironmentalTrainings", "0"),
        },
      ],
    },

    {
      key: "ethics",
      title: "Business Ethics & Compliance",
      description:
        "Ethics rating, corruption controls and compliance performance.",
      icon: <FaShieldAlt className="text-indigo-800" />,
      accent: "bg-indigo-700",
      rows: [
        {
          metric: "Business Ethics Rating",
          value: summaryVal("businessEthics", metricsVal("businessEthics")),
        },
        {
          metric: "Compliance Findings (No.)",
          value: summaryVal("totalComplianceFindings", "0"),
        },
        {
          metric: "Code of Ethics / Anti-Bribery Policy",
          value: metricsVal("codeOfEthics", "Yes/No"),
        },
      ],
    },

    {
      key: "privacy",
      title: "Data Privacy & Cyber Security",
      description: "Data protection controls and security frameworks.",
      icon: <FaUserShield className="text-blue-800" />,
      accent: "bg-blue-700",
      rows: [
        {
          metric: "Data Privacy Status",
          value: metricsVal("dataPrivacy", "Compliant"),
        },
        {
          metric: "Information Security Policy",
          value: metricsVal("informationSecurityPolicy", "Yes/No"),
        },
      ],
    },

    {
      key: "supply-chain",
      title: "Supply Chain Governance",
      description:
        "Supplier sustainability compliance and ESG audit coverage.",
      icon: <FaTruck className="text-sky-900" />,
      accent: "bg-sky-800",
      rows: [
        {
          metric: "% Suppliers ESG-Compliant",
          value: metricsVal("supplierSustainabilityCompliance"),
        },
        {
          metric: "% Audited Suppliers Completed",
          value: metricsVal("supplierAuditsCompleted"),
        },
        {
          metric: "Supplier ESG Compliance Rating",
          value: metricsVal("supplierEsgCompliance"),
        },
      ],
    },
  ];

  const handleDownloadReport = () => {
    const doc = new jsPDF();
    let y = 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("AfricaESG.AI Governance Mini Report", 14, y);

    y += 12;

    // Governance metrics per section
    governanceSections.forEach((section) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(section.title, 14, y);
      y += 6;

      section.rows.forEach((row) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(`${row.metric}: ${row.value}`, 180);
        doc.text(lines, 14, y);
        y += lines.length * 6;
      });

      y += 4;
    });

    // AI governance insights: baseline, benchmark, performance, recommendations
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("AI Governance Insights", 14, y);
    y += 8;

    const addBlock = (label, text) => {
      if (!text) return;
      const lines = doc.splitTextToSize(`${label}: ${text}`, 180);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(lines, 14, y);
      y += lines.length * 6;
      y += 2;
    };

    addBlock("Baseline", baselineText);
    addBlock("Benchmark", benchmarkText);
    addBlock("Performance vs benchmark", performanceText);

    if (recommendationTexts.length) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("AI Recommendations:", 14, y);
      y += 6;

      recommendationTexts.forEach((note) => {
        const lines = doc.splitTextToSize(`• ${note}`, 180);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(lines, 18, y);
        y += lines.length * 6;
      });
    }

    doc.save("AfricaESG_Governance_Report.pdf");
  };

  // ---- Slide-like card renderer ----
  const slideCard = ({ heading, title, left, right, footer }) => (
    <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-8 pt-7 pb-10">
        <p className="text-xs font-semibold tracking-[0.18em] text-sky-700 uppercase mb-1">
          {heading}
        </p>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">
          {title}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div>{left}</div>
          <div>{right}</div>
        </div>
      </div>
      {footer && (
        <div className="bg-sky-900 text-sky-50 text-xs md:text-sm font-medium px-8 py-3">
          {footer}
        </div>
      )}
    </section>
  );

  const sectionTable = (rows) => (
    <div className="border border-slate-200 rounded-xl overflow-hidden text-xs md:text-sm">
      <div className="grid grid-cols-2 bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
        <div className="px-4 py-2 border-r border-slate-200">Area</div>
        <div className="px-4 py-2">Status / Metric</div>
      </div>
      {rows.map((r) => (
        <div
          key={r.metric}
          className="grid grid-cols-2 border-b border-slate-100 last:border-b-0"
        >
          <div className="px-4 py-2 border-r border-slate-100 text-slate-700">
            {r.metric}
          </div>
          <div className="px-4 py-2">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${valueBadgeClass(
                r.value
              )}`}
            >
              {r.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );

  // ---- Card renderer per section ----
  const card = (section) =>
    slideCard({
      heading: "Governance",
      title: section.title,
      left: (
        <>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 flex items-center justify-center rounded-full bg-sky-50 border border-sky-100">
              {section.icon}
            </div>
            <p className="text-sm text-slate-700 max-w-md">
              {section.description}
            </p>
          </div>
          <ul className="list-disc list-inside text-xs md:text-sm text-slate-700 space-y-1">
            <li>
              Oversight by board and senior management with clear allocation of
              responsibilities.
            </li>
            <li>
              Regular review of critical risks and governance performance
              indicators.
            </li>
            <li>
              Integration of governance trainings, policies and supplier
              controls into the broader ESG framework.
            </li>
          </ul>
        </>
      ),
      right: sectionTable(section.rows),
      footer:
        "Board and Management collaborate to maintain effective, transparent governance and risk oversight.",
    });

  // ---- TAB CONTENT ----
  const renderTabContent = () => {
    switch (activeTab) {
      case "Corporate Gov":
        return card(governanceSections[0]);

      case "Ethics & Compliance":
        return card(governanceSections[1]);

      case "Data Privacy & Security":
        return card(governanceSections[2]);

      case "Supply Chain":
        return card(governanceSections[3]);

      case "Governance Trainings":
        return slideCard({
          heading: "Governance",
          title: "Governance Training & Awareness",
          left: (
            <div className="space-y-4">
              <p className="text-sm text-slate-700">
                Training supports a culture of integrity, embedding governance,
                ethics, environmental stewardship and compliance into day-to-day
                decisions.
              </p>
              <ul className="list-disc list-inside text-xs md:text-sm text-slate-700 space-y-1">
                <li>
                  Regular governance and ethics training for directors,
                  executives and employees.
                </li>
                <li>
                  Targeted modules on anti-bribery, competition law, data
                  privacy and cyber security.
                </li>
                <li>
                  Supplier and business partner awareness on ESG expectations
                  and codes of conduct.
                </li>
              </ul>
            </div>
          ),
          right: (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <TrainingCard
                title="Governance Trainings"
                value={summaryVal("totalGovernanceTrainings", "0")}
                color="emerald"
              />
              <TrainingCard
                title="Environmental Trainings"
                value={summaryVal("totalEnvironmentalTrainings", "0")}
                color="sky"
              />
              <TrainingCard
                title="Compliance Findings"
                value={summaryVal("totalComplianceFindings", "0")}
                color="amber"
              />
            </div>
          ),
          footer:
            "Ongoing training and awareness underpin sound governance practices across the organisation and value chain.",
        });

      case "Overview":
      default:
        return (
          <div className="space-y-8">
            {/* Slide 1: Risk Management style */}
            {slideCard({
              heading: "Governance",
              title: "Risk Management",
              left: (
                <div className="space-y-3 text-sm text-slate-700">
                  <p>
                    Governance and risk management processes cover compliance,
                    reporting, and operating and strategic risks. Board and
                    senior management set a strong tone for risk oversight and
                    promote cross-functional participation across business
                    segments.
                  </p>
                  <p>
                    Critical risks are routinely reviewed by the Board and its
                    committees with formal updates linked to ESG metrics and
                    regulatory obligations.
                  </p>
                  <ul className="list-disc list-inside text-xs md:text-sm space-y-1">
                    <li>Formalised governance and reporting frameworks.</li>
                    <li>Structured risk identification and escalation.</li>
                    <li>Alignment of ESG risks with strategy and capital.</li>
                  </ul>
                </div>
              ),
              right: (
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs md:text-sm">
                  <div className="grid grid-cols-3 bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                    <div className="px-3 py-2 border-r border-slate-200">
                      Oversight of Risk Management
                    </div>
                    <div className="px-3 py-2 border-r border-slate-200">
                      Compliance &amp; Reporting
                    </div>
                    <div className="px-3 py-2">
                      Operating &amp; Strategic
                    </div>
                  </div>

                  <div className="grid grid-cols-3 border-b border-slate-100">
                    <div className="px-3 py-3 border-r border-slate-100 font-semibold text-slate-800">
                      Board Oversight
                    </div>
                    <div className="px-3 py-3 border-r border-slate-100 text-slate-700">
                      {summaryVal(
                        "corporateGovernance",
                        metricsVal("corporateGovernance")
                      )}
                    </div>
                    <div className="px-3 py-3 text-slate-700">
                      Strategy, capital allocation, executive oversight and
                      overall ESG risk appetite.
                    </div>
                  </div>

                  <div className="grid grid-cols-3">
                    <div className="px-3 py-3 border-r border-slate-100 font-semibold text-slate-800">
                      Management Day-to-Day
                    </div>
                    <div className="px-3 py-3 border-r border-slate-100 text-slate-700">
                      Operational compliance, data and reporting, controls and
                      internal audit.
                    </div>
                    <div className="px-3 py-3 text-slate-700">
                      Implementation of policies, supplier programmes and issue
                      management.
                    </div>
                  </div>
                </div>
              ),
              footer:
                "Board and Senior Management collaborate for effective risk management across the enterprise.",
            })}

            {/* Slide 2: Sound Governance Practices style */}
            {slideCard({
              heading: "Governance",
              title: "Sound Governance Practices",
              left: (
                <div className="grid grid-cols-1 gap-4 text-xs md:text-sm">
                  <div>
                    <h3 className="font-semibold text-sky-900 mb-2">
                      Board Independence
                    </h3>
                    <ul className="list-disc list-inside space-y-1 text-slate-700">
                      <li>Clear separation of oversight and management.</li>
                      <li>
                        Use of international reporting standards:{" "}
                        {summaryVal(
                          "corporateGovernance",
                          metricsVal("corporateGovernance")
                        )}
                        .
                      </li>
                      <li>
                        ISO certifications where applicable:{" "}
                        {summaryVal(
                          "iso9001Compliance",
                          metricsVal("isoCompliance")
                        )}
                        .
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sky-900 mb-2">
                      Compensation &amp; Incentives
                    </h3>
                    <ul className="list-disc list-inside space-y-1 text-slate-700">
                      <li>
                        Governance and environmental trainings delivered:{" "}
                        {summaryVal("totalGovernanceTrainings", "0")} /{" "}
                        {summaryVal("totalEnvironmentalTrainings", "0")}.
                      </li>
                      <li>
                        Variable pay aligned with risk, compliance and ESG
                        objectives.
                      </li>
                      <li>
                        Clawback provisions and malus mechanisms where
                        applicable.
                      </li>
                    </ul>
                  </div>
                </div>
              ),
              right: (
                <div className="grid grid-cols-1 gap-4 text-xs md:text-sm">
                  <div>
                    <h3 className="font-semibold text-sky-900 mb-2">
                      Board Practices
                    </h3>
                    <ul className="list-disc list-inside space-y-1 text-slate-700">
                      <li>Regular board and committee self-assessments.</li>
                      <li>
                        Independent directors meet without management when
                        needed.
                      </li>
                      <li>
                        Committee charters reviewed against evolving standards.
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sky-900 mb-2">
                      Accountability
                    </h3>
                    <ul className="list-disc list-inside space-y-1 text-slate-700">
                      <li>
                        Transparent reporting on compliance findings:{" "}
                        {summaryVal("totalComplianceFindings", "0")} recorded.
                      </li>
                      <li>
                        Supplier ESG compliance and audits tracked against
                        targets.
                      </li>
                      <li>
                        Clear escalation processes for material governance
                        issues.
                      </li>
                    </ul>
                  </div>
                </div>
              ),
              footer:
                "A robust governance framework supports building and maintaining effective, long-term strategies.",
            })}

            {/* Slide 3: Governance sections + AI insights */}
            <section className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Left: governance focus areas */}
              <div className="xl:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-8 pt-7 pb-6">
                  <p className="text-xs font-semibold tracking-[0.18em] text-sky-700 uppercase mb-1">
                    Governance
                  </p>
                  <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">
                    Governance Focus Areas
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {governanceSections.map((section) => (
                      <div
                        key={section.key}
                        className="border border-slate-200 rounded-xl p-4 text-xs md:text-sm"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="h-8 w-8 flex items-center justify-center rounded-full bg-sky-50 border border-sky-100">
                            {section.icon}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {section.title}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {section.description}
                            </p>
                          </div>
                        </div>
                        {section.rows.map((r) => (
                          <div
                            key={r.metric}
                            className="flex justify-between items-center gap-2 mb-1.5"
                          >
                            <span className="text-[11px] text-slate-600">
                              {r.metric}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${valueBadgeClass(
                                r.value
                              )}`}
                            >
                              {r.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-sky-900 text-sky-50 text-xs md:text-sm font-medium px-8 py-3">
                  Industry-aligned governance capabilities bring diverse
                  perspectives and specialised skills to oversight of strategy,
                  risk and ESG performance.
                </div>
              </div>

              {/* Right: AI Insights panel in slide style */}
              <aside className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <div className="px-6 pt-7 pb-4 border-b border-slate-200">
                  <p className="text-xs font-semibold tracking-[0.18em] text-sky-700 uppercase mb-1">
                    Governance
                  </p>
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900">
                      AI Governance Insights
                    </h2>
                    <span className="text-[10px] px-2 py-1 bg-sky-50 text-sky-700 border border-sky-200 rounded-full font-semibold uppercase tracking-wide">
                      Live AI
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Baseline, benchmark and recommendation narrative generated
                    from your latest ESG governance data.
                  </p>
                </div>

                <div className="flex-1 px-6 py-4">
                  {loading ? (
                    <p className="text-xs text-sky-700">Loading insights…</p>
                  ) : error ? (
                    <p className="text-xs text-red-600">{String(error)}</p>
                  ) : !insights.length ? (
                    <p className="text-xs text-slate-400">
                      No AI governance insights available yet. Upload or refresh
                      your ESG dataset to generate board-ready analytics.
                    </p>
                  ) : (
                    <div className="space-y-4 text-xs md:text-sm text-slate-700 max-h-80 overflow-y-auto pr-1">
                      {baselineText && (
                        <div>
                          <h3 className="text-[10px] font-semibold text-slate-500 tracking-wide uppercase mb-1">
                            Baseline
                          </h3>
                          <p>{baselineText}</p>
                        </div>
                      )}

                      {benchmarkText && (
                        <div>
                          <h3 className="text-[10px] font-semibold text-slate-500 tracking-wide uppercase mb-1">
                            Benchmark
                          </h3>
                          <p>{benchmarkText}</p>
                        </div>
                      )}

                      {performanceText && (
                        <div>
                          <h3 className="text-[10px] font-semibold text-slate-500 tracking-wide uppercase mb-1">
                            Performance vs Benchmark
                          </h3>
                          <p>{performanceText}</p>
                        </div>
                      )}

                      {recommendationTexts.length > 0 && (
                        <div>
                          <h3 className="text-[10px] font-semibold text-slate-500 tracking-wide uppercase mb-1">
                            AI Recommendations
                          </h3>
                          <ul className="list-disc list-inside space-y-1">
                            {recommendationTexts.map((rec, idx) => (
                              <li key={idx}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </aside>
            </section>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 py-10 flex justify-center">
      <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header – Ford slide style */}
        <header className="bg-white rounded-3xl border border-slate-200 shadow-sm px-8 py-7 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-sky-700 uppercase mb-1">
              Governance
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Governance Performance
            </h1>
            <p className="text-sm text-slate-600 mt-3 max-w-2xl">
              Governance, ethics, privacy and supply chain oversight – presented
              in a board-ready layout aligned with ESG reporting expectations.
            </p>
          </div>

          <button
            onClick={handleDownloadReport}
            className="inline-flex items-center gap-2 rounded-full bg-sky-700 hover:bg-sky-800 text-white px-6 py-3 text-sm font-semibold shadow-md transition-colors"
          >
            <FaFilePdf className="h-4 w-4" />
            Generate Governance Report
          </button>
        </header>

        {/* Tabs – keep navigation exactly the same, just restyled */}
        <div className="bg-white rounded-full border border-slate-200 shadow-sm inline-flex p-1 gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-sky-700 text-white shadow-sm"
                  : "text-sky-900 hover:bg-slate-50"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Main Content */}
        {renderTabContent()}
      </div>
    </div>
  );
}

// Small helper card
function TrainingCard({ title, value, color }) {
  const colors = {
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-900 shadow-sm rounded-2xl",
    sky: "border-sky-200 bg-sky-50 text-sky-900 shadow-sm rounded-2xl",
    amber: "border-amber-200 bg-amber-50 text-amber-900 shadow-sm rounded-2xl",
  };

  return (
    <div className={`border p-4 ${colors[color]}`}>
      <p className="text-[11px] font-semibold uppercase mb-1">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
