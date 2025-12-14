// src/pages/Dashboard.jsx
import React, { useEffect, useState, useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaGlobeAfrica,
  FaFileAlt,
  FaShieldAlt,
  FaRobot,
  FaUsers,
  FaBalanceScaleLeft,
  FaExclamationTriangle,
  FaCloud,
  FaTint,
  FaTrash,
  FaIndustry,
  FaFilePdf,
  FaBuilding,
  FaEdit,
  FaCheck,
  FaTimes,
} from "react-icons/fa";
import { jsPDF } from "jspdf";
import { API_BASE_URL } from "../config/api";
import { SimulationContext } from "../context/SimulationContext";

// ✅ Logo imports
import MainLogoSrc from "../assets/AfricaESG.AI.png";
import SecondaryLogoSrc from "../assets/ethekwin.png";

const MainLogo = MainLogoSrc || null;
const SecondaryLogo = SecondaryLogoSrc || null;

// ---------- Company Name Helper Functions ----------
const getCompanyNameFromFilename = (filename) => {
  if (!filename) return "—";
  let base = filename.replace(/\.[^/.]+$/, "");
  base = base.replace(/[_-]+/g, " ");
  base = base.replace(/\b\d{6,}\b/g, "").trim();
  base = base.replace(/\s+/g, " ").trim();
  return base || filename;
};

const getCompanyNameFromInvoice = (inv) => {
  if (inv && typeof inv.company_name === "string" && inv.company_name.trim()) {
    return inv.company_name.trim();
  }
  return getCompanyNameFromFilename(inv?.filename);
};

// ---------- Helper to extract invoice data from EnvironmentalCategory ----------
const extractInvoiceDataFromSimulation = (simulation) => {
  if (!simulation?.environmentalMetrics) return null;

  const envMetrics = simulation.environmentalMetrics;

  if (envMetrics.uploadedInvoiceData && envMetrics.uploadedInvoiceData.length > 0) {
    return envMetrics.uploadedInvoiceData;
  }

  if (envMetrics.uploadedRows && envMetrics.uploadedRows.length > 0) {
    const sampleRow = envMetrics.uploadedRows[0] || {};
    const hasInvoiceFields = Object.keys(sampleRow).some(
      (key) =>
        key.toLowerCase().includes("kwh") ||
        key.toLowerCase().includes("electricity") ||
        key.toLowerCase().includes("energy") ||
        key.toLowerCase().includes("consumption") ||
        key.toLowerCase().includes("bill") ||
        key.toLowerCase().includes("invoice")
    );

    if (hasInvoiceFields) return envMetrics.uploadedRows;
  }

  return null;
};

// ---------- Emissions helper ----------
const calculateEmissionsTonnes = (energyKwh) => {
  // Align with backend: estimated_co2 = total_energy * 0.99 / 1000 (tCO2e)
  const kwh = Number(energyKwh || 0);
  return (kwh * 0.99) / 1000;
};

// ✅ Safe image -> Base64 loader for jsPDF
const loadImage = async (src) => {
  if (!src) throw new Error("No image source provided");

  const response = await fetch(src);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result); // Base64 data URL
    reader.onerror = () => reject(new Error(`Failed to convert image: ${src}`));
    reader.readAsDataURL(blob);
  });
};

export default function Dashboard() {
  const navigate = useNavigate();
  const simulation = useContext(SimulationContext);

  // ✅ keep pulling from SimulationContext (do NOT change)
  const socialMetricsFromContext = simulation?.socialMetrics; // ✅ populated by SocialCategory
  const governanceMetricsFromContext = simulation?.governanceMetrics; // ✅ populated by GovernanceCategory
  const invoiceData = useMemo(
    () => extractInvoiceDataFromSimulation(simulation),
    [simulation]
  );

  const [companyName, setCompanyName] = useState("");
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [tempCompanyName, setTempCompanyName] = useState("");

  // ✅ invoice-derived baseline metrics for calculations
  const [invoiceMetrics, setInvoiceMetrics] = useState({
    totalEnergyKwh: 0,
    totalCarbonTonnes: 0,
    monthlyAverage: 0,
    peakConsumption: 0,
  });

  const [summaryData, setSummaryData] = useState({
    environmental: {},
    social: {},
    governance: {},
  });

  const [carbonTax, setCarbonTax] = useState(0);
  const [prevCarbonTax, setPrevCarbonTax] = useState(null);

  const [taxAllowances, setTaxAllowances] = useState(0);
  const [prevTaxAllowances, setPrevTaxAllowances] = useState(null);

  const [carbonCredits, setCarbonCredits] = useState(0);
  const [prevCarbonCredits, setPrevCarbonCredits] = useState(null);

  const [energySavings, setEnergySavings] = useState(0);
  const [prevEnergySavings, setPrevEnergySavings] = useState(null);

  const [aiInsights, setAIInsights] = useState([]);
  const [miniReport, setMiniReport] = useState({
    baseline: "",
    benchmark: "",
    performance_vs_benchmark: "",
    ai_recommendations: [],
  });

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const [platformStats] = useState({
    countries_supported: 50,
    esg_reports_generated: 10000,
    compliance_accuracy: 0.99,
    ai_support_mode: "24/7",
  });

  const [redFlags, setRedFlags] = useState([]);

  // ---------- Helpers ----------
  const extractNumericValue = (item, fieldNames) => {
    for (const fieldName of fieldNames) {
      for (const key in item) {
        if (key.toLowerCase().includes(String(fieldName).toLowerCase())) {
          const value = item[key];
          if (typeof value === "number") return value;
          if (typeof value === "string") {
            const num = parseFloat(value.replace(/[^\d.-]/g, ""));
            if (!isNaN(num)) return num;
          }
        }
      }
    }
    return 0;
  };

  const extractDate = (item) => {
    const dateFields = ["date", "period", "month", "invoice_date", "billing_date"];
    for (const fieldName of dateFields) {
      for (const key in item) {
        if (key.toLowerCase().includes(fieldName)) {
          const value = item[key];
          if (value) {
            try {
              return new Date(value);
            } catch {
              const dateMatch = String(value).match(/\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/);
              if (dateMatch) return new Date(dateMatch[0]);
            }
          }
        }
      }
    }
    return new Date();
  };

  // ---------- Process Invoice Data (for KPI calculations) ----------
  useEffect(() => {
    if (!invoiceData || !Array.isArray(invoiceData) || invoiceData.length === 0) return;

    let totalEnergy = 0;
    let peak = 0;
    const monthly = {};

    invoiceData.forEach((item) => {
      const energy = extractNumericValue(item, [
        "total_energy_kwh",
        "energy_kwh",
        "kwh",
        "electricity",
        "energy",
        "consumption",
      ]);

      if (energy) {
        totalEnergy += energy;
        peak = Math.max(peak, energy);

        const d = extractDate(item);
        const monthKey = `${d.getFullYear()}-${d.getMonth() + 1}`;
        monthly[monthKey] = (monthly[monthKey] || 0) + energy;
      }
    });

    const monthVals = Object.values(monthly);
    const monthlyAverage =
      monthVals.length > 0 ? monthVals.reduce((a, b) => a + b, 0) / monthVals.length : 0;

    const carbonTonnes = calculateEmissionsTonnes(totalEnergy);

    setInvoiceMetrics({
      totalEnergyKwh: totalEnergy,
      totalCarbonTonnes: carbonTonnes,
      monthlyAverage,
      peakConsumption: peak,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceData]);

  // ✅ calculate Carbon Tax / Allowances / Credits / Savings (keep layout unchanged)
  useEffect(() => {
    const energyKwh = Number(invoiceMetrics.totalEnergyKwh || 0);
    const emissionsT = Number(invoiceMetrics.totalCarbonTonnes || 0);

    if (!energyKwh && !emissionsT) return;

    // Simplified SA carbon tax model (illustrative)
    const CARBON_TAX_RATE = 190; // R / tCO2e
    const ALLOWANCE_RATE = 0.7; // 70%

    // Baseline proxy = 10% higher than current (replace with real baseline when available)
    const baselineEnergyKwh = energyKwh > 0 ? energyKwh * 1.1 : 0;
    const baselineEmissionsT = calculateEmissionsTonnes(baselineEnergyKwh);
    const actualEmissionsT = emissionsT > 0 ? emissionsT : calculateEmissionsTonnes(energyKwh);

    const taxableEmissionsT = Math.max(0, actualEmissionsT * (1 - ALLOWANCE_RATE));
    const carbonTaxValue = taxableEmissionsT * CARBON_TAX_RATE;

    const allowanceValue = Math.max(0, actualEmissionsT * ALLOWANCE_RATE * CARBON_TAX_RATE);

    const energySavedKwh = Math.max(0, baselineEnergyKwh - energyKwh);
    const creditsT = Math.max(0, baselineEmissionsT - actualEmissionsT);

    // ✅ robust "previous" tracking (prevents stale prev values)
    setCarbonTax((current) => {
      setPrevCarbonTax(current);
      return Math.round(carbonTaxValue);
    });

    setTaxAllowances((current) => {
      setPrevTaxAllowances(current);
      return Math.round(allowanceValue);
    });

    setCarbonCredits((current) => {
      setPrevCarbonCredits(current);
      return Number(creditsT.toFixed(2));
    });

    setEnergySavings((current) => {
      setPrevEnergySavings(current);
      return Math.round(energySavedKwh);
    });
  }, [invoiceMetrics.totalEnergyKwh, invoiceMetrics.totalCarbonTonnes]);

  // ---------- Trend indicator ----------
  const renderIndicator = (current, previous) => {
    if (previous === null || previous === undefined) return <div className="h-5" />;

    const diff = current - previous;
    const pctChange = previous === 0 ? (current === 0 ? 0 : 100) : (diff / previous) * 100;

    const formatted = (diff > 0 ? "+" : "") + pctChange.toFixed(1) + "%";
    const isUp = diff > 0;
    const isDown = diff < 0;
    const color = isUp ? "text-emerald-600" : isDown ? "text-red-600" : "text-gray-500";

    return (
      <div className={`flex items-center gap-1 text-[11px] font-semibold ${color} h-5`}>
        {isUp && (
          <svg width="12" height="12" viewBox="0 0 24 24" className="shrink-0">
            <path
              d="M4 16 L12 8 L20 16"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {isDown && (
          <svg width="12" height="12" viewBox="0 0 24 24" className="shrink-0">
            <path
              d="M4 8 L12 16 L20 8"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {!isUp && !isDown && (
          <svg width="12" height="12" className="opacity-40 shrink-0">
            <circle cx="6" cy="6" r="3" fill="currentColor" />
          </svg>
        )}
        <span className="leading-none">{formatted}</span>
      </div>
    );
  };

  // ✅ Social/Governance values: prefer context values (pulling stays)
  const socSummaryData = useMemo(() => {
    const s = summaryData.social || {};
    return {
      ...s,
      supplierDiversity:
        s.supplierDiversity ??
        simulation?.kpiMetrics?.supplierDiversity ??
        socialMetricsFromContext?.supplierDiversity ??
        socialMetricsFromContext?.supplierDiversityPct ??
        null,
      customerSatisfaction:
        s.customerSatisfaction ??
        socialMetricsFromContext?.customerSatisfaction ??
        socialMetricsFromContext?.customer_satisfaction ??
        null,
      humanCapital:
        s.humanCapital ??
        socialMetricsFromContext?.humanCapital ??
        socialMetricsFromContext?.employeeEngagement ??
        socialMetricsFromContext?.employee_engagement ??
        null,
    };
  }, [summaryData.social, simulation?.kpiMetrics, socialMetricsFromContext]);

  const govSummaryData = useMemo(() => {
    const g = summaryData.governance || {};
    return {
      ...g,
      corporateGovernance:
        g.corporateGovernance ??
        governanceMetricsFromContext?.corporateGovernance ??
        governanceMetricsFromContext?.governanceScore ??
        governanceMetricsFromContext?.governance_score ??
        null,
      iso9001Compliance:
        g.iso9001Compliance ??
        governanceMetricsFromContext?.iso9001Compliance ??
        governanceMetricsFromContext?.iso_9001 ??
        null,
      businessEthics:
        g.businessEthics ??
        governanceMetricsFromContext?.businessEthics ??
        governanceMetricsFromContext?.ethicsCompliance ??
        governanceMetricsFromContext?.ethics_compliance ??
        null,
    };
  }, [summaryData.governance, governanceMetricsFromContext]);

  // ---------- Red flags ----------
  const computeRedFlags = () => {
    const flags = [];
    const renewableShare =
      summaryData?.environmental?.renewableEnergyShare ??
      simulation?.kpiMetrics?.renewableEnergy ??
      null;

    if (renewableShare != null && Number(renewableShare) < 20) {
      flags.push(
        `Renewable energy share is only ${Number(renewableShare).toFixed(
          1
        )}%. This is below the 20% threshold.`
      );
    }

    if (carbonTax > 20000000) {
      flags.push(
        `Carbon tax exposure (R ${carbonTax.toLocaleString()}) is above the defined risk threshold.`
      );
    }

    if (
      invoiceMetrics.peakConsumption > invoiceMetrics.monthlyAverage * 1.5 &&
      invoiceMetrics.monthlyAverage > 0
    ) {
      flags.push(
        `Peak energy consumption (${invoiceMetrics.peakConsumption.toLocaleString()} kWh) is significantly above monthly average.`
      );
    }

    const supplierDiversity = socSummaryData.supplierDiversity;
    if (supplierDiversity != null && Number(supplierDiversity) < 5) {
      flags.push(
        `Supplier diversity (${Number(supplierDiversity)}%) is low – this may create concentration and social risk.`
      );
    }

    return flags;
  };

  useEffect(() => {
    setRedFlags(computeRedFlags());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carbonTax, invoiceMetrics, socSummaryData, summaryData, simulation?.kpiMetrics]);

  // ---------- Load base snapshot (keep existing behavior) ----------
  const applySnapshotFromBackend = (esgData) => {
    const mock = esgData?.mockData || {};
    const summary = mock.summary || {};

    setSummaryData({
      environmental: summary.environmental || summary.environment || {},
      social: summary.social || {},
      governance: summary.governance || {},
    });

    // best-effort company name
    const firstInvName =
      invoiceData && invoiceData.length > 0 ? getCompanyNameFromInvoice(invoiceData[0]) : "";
    const savedCompany = localStorage.getItem("companyName") || "";

    const name =
      summary.company_name ||
      summary.company ||
      firstInvName ||
      savedCompany ||
      companyName ||
      "";

    if (name) {
      setCompanyName(name);
      localStorage.setItem("companyName", name);
    }

    const combinedList = esgData?.insights || [];
    setAIInsights(Array.isArray(combinedList) ? combinedList : []);
  };

  const generateMiniReport = (esgData) => {
    const env = esgData.mockData?.summary?.environmental || {};
    const baseline = `Baseline energy consumption is ${
      invoiceMetrics.totalEnergyKwh
        ? invoiceMetrics.totalEnergyKwh.toLocaleString()
        : env.totalEnergyConsumption?.toLocaleString() || "--"
    } kWh with invoice-based carbon estimate of ${
      invoiceMetrics.totalCarbonTonnes
        ? invoiceMetrics.totalCarbonTonnes.toFixed(1)
        : env.carbonEmissions?.toLocaleString() || "--"
    } tCO₂e.`;

    const benchmark =
      "Indicative peer band: renewable share 20–35%, steady reductions in energy/water intensity over 3–5 years.";

    const perf =
      carbonTax > 0
        ? `Estimated carbon tax exposure is R ${carbonTax.toLocaleString()} (after allowances).`
        : "Performance vs benchmark will improve once a sector benchmark and denominators (revenue/production) are provided.";

    const recommendations = [
      "Confirm monthly baselines from invoices (energy kWh, water m³, charges) and lock the reporting boundary (sites/meters).",
      "Implement demand management and efficiency actions at peak-consumption sites (load shifting, HVAC optimisation, VSDs).",
      "Improve water efficiency through leak detection, metering, and reuse where feasible.",
      "Start a renewable pathway: on-site solar PV feasibility + green procurement options.",
    ];

    setMiniReport({
      baseline,
      benchmark,
      performance_vs_benchmark: perf,
      ai_recommendations: recommendations,
    });
  };

  const loadSnapshotFromBackend = async () => {
    setAiLoading(true);
    setAiError(null);

    try {
      const esgRes = await fetch(`${API_BASE_URL}/api/esg-data`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!esgRes.ok)
        throw new Error(`API error: ${esgRes.status} ${esgRes.statusText}`);

      const esgData = await esgRes.json();
      applySnapshotFromBackend(esgData);
      generateMiniReport(esgData);
    } catch (err) {
      console.error("Error loading ESG data:", err);
      setAiError("Failed to load ESG data.");
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshotFromBackend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Company Name Management ----------
  const handleCompanyNameEdit = () => {
    if (isEditingCompany && tempCompanyName.trim()) {
      const newName = tempCompanyName.trim();
      setCompanyName(newName);
      localStorage.setItem("companyName", newName);
      setIsEditingCompany(false);
    } else {
      setTempCompanyName(companyName || "");
      setIsEditingCompany(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingCompany(false);
    setTempCompanyName("");
  };

  const handleCompanyNameSave = () => {
    if (!tempCompanyName.trim()) return;
    const newName = tempCompanyName.trim();
    setCompanyName(newName);
    localStorage.setItem("companyName", newName);
    setIsEditingCompany(false);
  };

  // ✅ PDF report (unchanged layout on page, only uses computed values)
  const handleGenerateReport = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    let headerBottomY = 30;
    let yPosition;

    try {
      if (MainLogo) {
        const mainImgDataUrl = await loadImage(MainLogo);
        doc.addImage(mainImgDataUrl, "PNG", 14, 10, 40, 40);
      }

      if (SecondaryLogo) {
        try {
          const secondaryImgDataUrl = await loadImage(SecondaryLogo);
          doc.addImage(secondaryImgDataUrl, "PNG", pageWidth - 40, 28, 25, 25);
        } catch (e) {
          console.warn("Failed to load secondary logo:", e);
        }
      }

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("ESG Performance Report", pageWidth / 2, 25, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Generated by AfricaESG.AI Platform", pageWidth / 2, 32, { align: "center" });

      headerBottomY = 55;
    } catch (error) {
      console.warn("Failed to load logos:", error);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("AfricaESG.AI Overview Report", 14, 20);
      headerBottomY = 30;
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
      pageWidth - 14,
      20,
      { align: "right" }
    );

    doc.setDrawColor(200, 200, 200);
    doc.line(14, headerBottomY, pageWidth - 14, headerBottomY);

    yPosition = headerBottomY + 10;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Company Information", 14, yPosition);
    yPosition += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    const reportCompanyName = companyName || "Company Name";
    doc.text(`Company: ${reportCompanyName}`, 14, yPosition);
    yPosition += 7;

    if (invoiceData && invoiceData.length > 0) {
      doc.text(`Data Source: ${invoiceData.length} invoice records analyzed`, 14, yPosition);
      yPosition += 7;
    }

    doc.text(`Report Period: ${new Date().getFullYear()}`, 14, yPosition);
    yPosition += 10;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Financial & Carbon KPIs", 14, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`• Carbon Tax Exposure: R ${carbonTax.toLocaleString()}`, 20, yPosition);
    yPosition += 5;
    doc.text(`• Tax Allowances: R ${taxAllowances.toLocaleString()}`, 20, yPosition);
    yPosition += 5;
    doc.text(`• Carbon Credits: ${carbonCredits.toLocaleString()} tonnes`, 20, yPosition);
    yPosition += 5;
    doc.text(`• Energy Savings: ${energySavings.toLocaleString()} kWh`, 20, yPosition);
    yPosition += 10;

    if (aiInsights && aiInsights.length > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("AI Analyst Insights", 14, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      aiInsights.slice(0, 6).forEach((insight) => {
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          yPosition = 20;
        }
        const lines = doc.splitTextToSize(`• ${insight}`, pageWidth - 28);
        doc.text(lines, 20, yPosition);
        yPosition += lines.length * 5;
      });
    }

    const filename =
      reportCompanyName !== "Company Name"
        ? `${reportCompanyName.replace(/[^a-z0-9]/gi, "_").toUpperCase()}_ESG_Report_${new Date()
            .toISOString()
            .split("T")[0]}.pdf`
        : `AfricaESG_Report_${new Date().toISOString().split("T")[0]}.pdf`;

    doc.save(filename);
  };

  // UI cards (keep simple + same sections)
  const StatCard = ({ icon, label, value, sub }) => (
    <div className="flex items-center gap-3 rounded-2xl bg-white border border-slate-100 shadow-sm px-4 py-3 h-full">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 shrink-0">
        {icon}
      </div>
      <div className="leading-tight">
        <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
        <div className="text-xl font-semibold text-slate-900">{value}</div>
        {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
      </div>
    </div>
  );

  const MoneyCard = ({ icon, label, value, indicator, isFlagged }) => (
    <div
      className={`rounded-2xl border shadow-sm px-4 py-3 flex flex-col justify-between gap-2 h-full ${
        isFlagged ? "bg-red-50 border-red-300" : "bg-white border-slate-100"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 shrink-0">
            {icon}
          </span>
          <span className="text-xs text-slate-600 uppercase tracking-wide font-medium">
            {label}
          </span>
        </div>
        {indicator}
      </div>

      <div className="flex items-baseline gap-1 text-lg font-semibold text-slate-900 whitespace-nowrap tabular-nums">
        <span>{value}</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-lime-50 py-10 font-sans">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-green-900 tracking-tight">
              AfricaESG.AI Dashboard
            </h1>

            {/* Company Name Display - HIDDEN IN UI BUT STILL FUNCTIONAL */}
            <div style={{ display: "none" }}>
              {isEditingCompany ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 bg-white rounded-lg border border-emerald-200 shadow-sm mt-2">
                  <div className="flex items-center gap-2">
                    <FaBuilding className="text-gray-500" />
                    <input
                      type="text"
                      value={tempCompanyName}
                      onChange={(e) => setTempCompanyName(e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 rounded text-lg font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="Enter company name"
                      autoFocus
                      style={{ minWidth: "250px" }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCompanyNameSave}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-sm font-medium flex items-center gap-1"
                      disabled={!tempCompanyName.trim()}
                    >
                      <FaCheck size={12} />
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1.5 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm font-medium flex items-center gap-1"
                    >
                      <FaTimes size={12} />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : companyName ? (
                <div className="flex items-center gap-2 p-2 hover:bg-white/50 rounded-lg transition-colors mt-2">
                  <FaBuilding className="text-gray-500" />
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold text-gray-700">{companyName}</span>
                    <button
                      onClick={handleCompanyNameEdit}
                      className="text-gray-400 hover:text-emerald-600 transition-colors"
                      title="Edit company name"
                    >
                      <FaEdit size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2 mt-2">
                  <FaBuilding className="text-gray-400" />
                  <button
                    onClick={handleCompanyNameEdit}
                    className="text-gray-500 hover:text-emerald-600 text-sm font-medium flex items-center gap-1"
                  >
                    <span>Set Company Name</span>
                    <FaEdit size={12} />
                  </button>
                </div>
              )}
            </div>

            <p className="text-sm text-gray-600 max-w-xl mt-3">
              ESG performance overview with AI-enabled insights on carbon tax, energy savings, and strategic ESG levers.
            </p>

            <div className="mt-2 h-5">
              {aiLoading && (
                <p className="text-xs text-emerald-700 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Loading ESG metrics…
                </p>
              )}
              {!aiLoading && aiError && <p className="text-xs text-red-500">{aiError}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerateReport}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-full shadow flex items-center gap-2 text-sm font-semibold"
            >
              <FaFilePdf />
              Download ESG Report
            </button>
          </div>
        </header>

        {/* Red Flag Panel */}
        {redFlags.length > 0 && (
          <section className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex gap-3 items-start">
            <FaExclamationTriangle className="text-red-500 mt-1 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-red-800 mb-1">Red Flags Detected</h2>
              <ul className="list-disc list-inside text-xs sm:text-sm text-red-900 space-y-1">
                {redFlags.map((flag, idx) => (
                  <li key={idx}>{flag}</li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Headline stats row (kept) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
          <StatCard
            icon={<FaGlobeAfrica size={18} />}
            label="African countries supported"
            value={`${platformStats.countries_supported}+`}
            sub="Regional ESG coverage"
          />
          <StatCard
            icon={<FaFileAlt size={18} />}
            label="ESG reports generated"
            value={platformStats.esg_reports_generated.toLocaleString()}
            sub="Automated & AI-assisted"
          />
          <StatCard
            icon={<FaShieldAlt size={18} />}
            label="Compliance accuracy"
            value={(platformStats.compliance_accuracy * 100).toFixed(1) + "%"}
            sub="Templates for IFRS, GRI, JSE"
          />
          <StatCard
            icon={<FaRobot size={18} />}
            label="AI analyst support"
            value={platformStats.ai_support_mode}
            sub="Continuous ESG monitoring"
          />
        </section>

        {/* ESG Performance Overview */}
        <section>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-800">
                ESG Performance Overview
              </h2>
            </div>

            {/* Pillars row (layout kept) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 items-stretch">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FaCloud className="text-emerald-700" />
                      <span className="text-xs font-semibold text-emerald-900 uppercase tracking-wide">
                        Environmental
                      </span>
                    </div>
                    <button
                      className="text-[11px] text-emerald-700 font-semibold hover:underline"
                      onClick={() => navigate("/dashboard/environment/energy")}
                    >
                      View details
                    </button>
                  </div>

                  <ul className="text-xs sm:text-sm text-emerald-900/90 space-y-1.5">
                    <li>
                      <span className="font-semibold">Energy</span>{" "}
                      {invoiceMetrics.totalEnergyKwh
                        ? invoiceMetrics.totalEnergyKwh.toLocaleString()
                        : "--"}{" "}
                      kWh
                    </li>
                    <li>
                      <span className="font-semibold">Carbon</span>{" "}
                      {invoiceMetrics.totalCarbonTonnes
                        ? invoiceMetrics.totalCarbonTonnes.toFixed(1)
                        : "--"}{" "}
                      tCO₂e
                    </li>
                    <li>
                      <span className="font-semibold">Peak vs Avg</span>{" "}
                      {invoiceMetrics.monthlyAverage > 0
                        ? `${invoiceMetrics.peakConsumption.toLocaleString()} / ${invoiceMetrics.monthlyAverage.toLocaleString()} kWh`
                        : "--"}
                    </li>
                  </ul>
                </div>
              </div>

              <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FaUsers className="text-sky-700" />
                      <span className="text-xs font-semibold text-sky-900 uppercase tracking-wide">
                        Social
                      </span>
                    </div>
                    <button
                      className="text-[11px] text-sky-700 font-semibold hover:underline"
                      onClick={() => navigate("/dashboard/social")}
                    >
                      View details
                    </button>
                  </div>

                  <ul className="text-xs sm:text-sm text-sky-900/90 space-y-1.5">
                    <li>
                      <span className="font-semibold">Supplier Diversity</span>{" "}
                      {socSummaryData.supplierDiversity != null
                        ? `${socSummaryData.supplierDiversity}%`
                        : "--"}
                    </li>
                    <li>
                      <span className="font-semibold">Customer Satisfaction</span>{" "}
                      {socSummaryData.customerSatisfaction != null
                        ? `${socSummaryData.customerSatisfaction}%`
                        : "--"}
                    </li>
                    <li>
                      <span className="font-semibold">Human Capital</span>{" "}
                      {socSummaryData.humanCapital != null
                        ? `${socSummaryData.humanCapital}%`
                        : "--"}
                    </li>
                  </ul>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FaBalanceScaleLeft className="text-amber-700" />
                      <span className="text-xs font-semibold text-amber-900 uppercase tracking-wide">
                        Governance
                      </span>
                    </div>
                    <button
                      className="text-[11px] text-amber-700 font-semibold hover:underline"
                      onClick={() => navigate("/dashboard/governance/corporate")}
                    >
                      View details
                    </button>
                  </div>

                  <ul className="text-xs sm:text-sm text-amber-900/90 space-y-1.5">
                    <li>
                      <span className="font-semibold">Corporate Governance</span>{" "}
                      {govSummaryData.corporateGovernance ?? "--"}
                    </li>
                    <li>
                      <span className="font-semibold">ISO 9001</span>{" "}
                      {govSummaryData.iso9001Compliance ?? "--"}
                    </li>
                    <li>
                      <span className="font-semibold">Business Ethics</span>{" "}
                      {govSummaryData.businessEthics ?? "--"}
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Financial / carbon KPIs row (layout kept) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
              <MoneyCard
                icon={<FaIndustry size={15} />}
                label="Carbon Tax (2024/2025)"
                value={`R ${carbonTax.toLocaleString()}`}
                indicator={renderIndicator(carbonTax, prevCarbonTax)}
                isFlagged={carbonTax > 20000000}
              />
              <MoneyCard
                icon={<FaCloud size={15} />}
                label="Applicable Tax Allowances"
                value={`R ${taxAllowances.toLocaleString()}`}
                indicator={renderIndicator(taxAllowances, prevTaxAllowances)}
                isFlagged={false}
              />
              <MoneyCard
                icon={<FaTrash size={15} />}
                label="Carbon Credits Generated"
                value={`${carbonCredits.toLocaleString()} tonnes`}
                indicator={renderIndicator(carbonCredits, prevCarbonCredits)}
                isFlagged={false}
              />
              <MoneyCard
                icon={<FaTint size={15} />}
                label="Energy Savings"
                value={`${energySavings.toLocaleString()} kWh`}
                indicator={renderIndicator(energySavings, prevEnergySavings)}
                isFlagged={false}
              />
            </div>
          </div>
        </section>

        {/* AI Mini Report (layout kept) */}
        <section>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-semibold text-gray-800">
                AI Mini Report on ESG Summary
              </h2>
              <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                Live AI
              </span>
            </div>

            <div className="space-y-3 text-sm mt-3">
              <div>
                <h3 className="font-semibold text-slate-800 mb-0.5">1. Baseline</h3>
                <p className="text-xs text-slate-700">
                  {miniReport.baseline || "Baseline not available yet."}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-800 mb-0.5">2. Benchmark</h3>
                <p className="text-xs text-slate-700">
                  {miniReport.benchmark || "Benchmark not available yet."}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-800 mb-0.5">
                  3. Performance vs benchmark
                </h3>
                <p className="text-xs text-slate-700">
                  {miniReport.performance_vs_benchmark ||
                    "Performance vs benchmark not available yet."}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-800 mb-0.5">4. AI Recommendations</h3>
                {miniReport.ai_recommendations && miniReport.ai_recommendations.length > 0 ? (
                  <ul className="list-disc list-inside text-xs text-slate-700 space-y-1">
                    {miniReport.ai_recommendations.map((rec, idx) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500">
                    No AI recommendations generated yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
