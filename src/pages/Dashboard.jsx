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
  FaChartLine,
  FaBolt,
  FaLeaf,
  FaWater,
  FaRecycle,
} from "react-icons/fa";
import { jsPDF } from "jspdf";
import { API_BASE_URL } from "../config/api";
import { SimulationContext } from "../context/SimulationContext";

// ✅ NEW: import static logos from assets (adjust paths/names as needed)
import MainLogo from "../assets/AfricaESG.AI.png";
import SecondaryLogo from "../assets/ethekwin.png";

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
    const hasInvoiceFields = Object.keys(sampleRow).some((key) =>
      key.toLowerCase().includes("kwh") ||
      key.toLowerCase().includes("electricity") ||
      key.toLowerCase().includes("energy") ||
      key.toLowerCase().includes("consumption") ||
      key.toLowerCase().includes("bill") ||
      key.toLowerCase().includes("invoice")
    );

    if (hasInvoiceFields) {
      return envMetrics.uploadedRows;
    }
  }

  return null;
};

// ---------- Invoice Utility Functions ----------
const getLastSixInvoices = (invoices) => {
  if (!invoices || !Array.isArray(invoices)) return [];
  return invoices.slice(0, 6);
};

const computeInvoiceEnergyAndCarbon = (invoices) => {
  if (!invoices || !Array.isArray(invoices)) {
    return { totalEnergyKwh: 0, totalCarbonTonnes: 0 };
  }

  let totalEnergyKwh = 0;
  let totalCarbonTonnes = 0;

  invoices.forEach((invoice) => {
    const energyFields = ["kwh", "electricity", "energy", "consumption", "usage"];
    for (const field of energyFields) {
      if (invoice[field] !== undefined && invoice[field] !== null) {
        const value = parseFloat(invoice[field]);
        if (!isNaN(value)) {
          totalEnergyKwh += value;
          break;
        }
      }
    }

    if (invoice.carbon_emissions !== undefined && invoice.carbon_emissions !== null) {
      const carbon = parseFloat(invoice.carbon_emissions);
      if (!isNaN(carbon)) {
        totalCarbonTonnes += carbon;
      }
    } else {
      const emissionFactor = 0.00085; // tCO2/kWh
      totalCarbonTonnes += totalEnergyKwh * emissionFactor;
    }
  });

  return { totalEnergyKwh, totalCarbonTonnes };
};

const calculateEnergyIntensity = (totalEnergy, revenue) => {
  if (!revenue || revenue === 0) return 0;
  return totalEnergy / revenue;
};

const calculateCarbonIntensity = (totalCarbon, revenue) => {
  if (!revenue || revenue === 0) return 0;
  return totalCarbon / revenue;
};

const calculateEmissions = (energyKwh, fuelType = "electricity") => {
  const emissionFactors = {
    electricity: 0.85,
    diesel: 2.68,
    petrol: 2.31,
    natural_gas: 0.2,
    coal: 2.9,
  };

  const factor = emissionFactors[fuelType.toLowerCase()] || emissionFactors.electricity;
  return energyKwh * factor;
};

// ✅ helper to load image from assets for jsPDF
const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

export default function Dashboard() {
  const navigate = useNavigate();

  const simulation = useContext(SimulationContext);
  const environmentalMetrics = simulation?.environmentalMetrics;

  const invoiceData = useMemo(
    () => extractInvoiceDataFromSimulation(simulation),
    [simulation]
  );

  const [companyName, setCompanyName] = useState("");
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [tempCompanyName, setTempCompanyName] = useState("");

  const [invoiceMetrics, setInvoiceMetrics] = useState({
    totalEnergyKwh: 0,
    totalCarbonTonnes: 0,
    monthlyAverage: 0,
    peakConsumption: 0,
    costSavingsPotential: 0,
    renewablePercentage: 0,
    waterConsumption: 0,
    wasteGenerated: 0,
    energyIntensity: 0,
    carbonIntensity: 0,
  });

  const [esgSummary, setEsGSummary] = useState({
    environmental: "Energy: -- kWh · Renewables: --% · Carbon: -- tCO₂e",
    social: "Supplier diversity: --% · Customer satisfaction: --% · Human capital: --%",
    governance: "Corporate governance: -- · ISO 9001: -- · Ethics: --",
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

  const [pillarAiLoading, setPillarAiLoading] = useState(false);
  const [pillarAiError, setPillarAiError] = useState(null);

  const [redFlags, setRedFlags] = useState([]);

  const [platformStats, setPlatformStats] = useState({
    countries_supported: 50,
    esg_reports_generated: 10000,
    compliance_accuracy: 0.99,
    ai_support_mode: "24/7",
  });

  const [invoiceSummaries, setInvoiceSummaries] = useState([]);

  const [invoiceEnvMetrics, setInvoiceEnvMetrics] = useState(null);
  const [invoiceEnvInsights, setInvoiceEnvInsights] = useState([]);
  const [invoiceEnvError, setInvoiceEnvError] = useState(null);

  // ---------- Process Invoice Data from EnvironmentalCategory ----------
  useEffect(() => {
    const processInvoiceData = () => {
      if (!invoiceData || invoiceData.length === 0) return;

      let totalEnergy = 0;
      let totalCost = 0;
      let peakConsumption = 0;
      let monthlyData = {};
      let waterConsumption = 0;
      let wasteGenerated = 0;

      invoiceData.forEach((item) => {
        const energy = extractNumericValue(item, [
          "kwh",
          "electricity",
          "energy",
          "consumption",
        ]);
        if (energy) {
          totalEnergy += energy;
          peakConsumption = Math.max(peakConsumption, energy);

          const date = extractDate(item);
          if (date) {
            const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
            monthlyData[monthKey] = (monthlyData[monthKey] || 0) + energy;
          }
        }

        const cost = extractNumericValue(item, ["cost", "amount", "total", "price"]);
        if (cost) totalCost += cost;

        const water = extractNumericValue(item, [
          "water",
          "water_usage",
          "water_consumption",
        ]);
        if (water) waterConsumption += water;

        const waste = extractNumericValue(item, [
          "waste",
          "waste_generated",
          "landfill",
        ]);
        if (waste) wasteGenerated += waste;
      });

      const monthlyAverage =
        Object.values(monthlyData).length > 0
          ? Object.values(monthlyData).reduce((a, b) => a + b, 0) /
            Object.values(monthlyData).length
          : totalEnergy / (invoiceData.length || 1);

      const carbonEmissions = calculateEmissions(totalEnergy, "electricity");

      const revenue = 1000000;
      const energyIntensity = calculateEnergyIntensity(totalEnergy, revenue);
      const carbonIntensity = calculateCarbonIntensity(carbonEmissions, revenue);

      const costSavingsPotential = totalCost * 0.1;

      const renewableEnergy = extractRenewableEnergy(invoiceData);
      const renewablePercentage =
        renewableEnergy > 0 ? (renewableEnergy / totalEnergy) * 100 : 0;

      setInvoiceMetrics({
        totalEnergyKwh: totalEnergy,
        totalCarbonTonnes: carbonEmissions / 1000,
        monthlyAverage,
        peakConsumption,
        costSavingsPotential,
        renewablePercentage,
        waterConsumption,
        wasteGenerated,
        energyIntensity,
        carbonIntensity,
      });

      updateEsgSummaryWithInvoiceData({
        totalEnergy,
        carbonEmissions,
        renewablePercentage,
        waterConsumption,
        wasteGenerated,
      });
    };

    processInvoiceData();
  }, [invoiceData]);

  const extractNumericValue = (item, fieldNames) => {
    for (const fieldName of fieldNames) {
      for (const key in item) {
        if (key.toLowerCase().includes(fieldName)) {
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
            } catch (e) {
              const dateMatch = String(value).match(/\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/);
              if (dateMatch) return new Date(dateMatch[0]);
            }
          }
        }
      }
    }
    return new Date();
  };

  const extractRenewableEnergy = (invoiceData) => {
    let totalRenewable = 0;
    invoiceData.forEach((item) => {
      const renewableFields = [
        "renewable",
        "solar",
        "wind",
        "hydro",
        "green_energy",
      ];
      for (const fieldName of renewableFields) {
        for (const key in item) {
          if (key.toLowerCase().includes(fieldName)) {
            const value = item[key];
            if (typeof value === "number") {
              totalRenewable += value;
            } else if (typeof value === "string") {
              const num = parseFloat(value.replace(/[^\d.-]/g, ""));
              if (!isNaN(num)) totalRenewable += num;
            }
          }
        }
      }
    });
    return totalRenewable;
  };

  const updateEsgSummaryWithInvoiceData = (data) => {
    const newSummary = {
      environmental: `Energy: ${data.totalEnergy.toLocaleString()} kWh · Renewables: ${data.renewablePercentage.toFixed(
        1
      )}% · Carbon: ${(data.carbonEmissions / 1000).toLocaleString()} tCO₂e`,
    };

    setEsGSummary((prev) => ({
      environmental: newSummary.environmental,
      social: prev.social,
      governance: prev.governance,
    }));

    setSummaryData((prev) => ({
      ...prev,
      environmental: {
        ...prev.environmental,
        totalEnergyConsumption: data.totalEnergy,
        carbonEmissions: data.carbonEmissions / 1000,
        renewableEnergyShare: data.renewablePercentage,
        waterConsumption: data.waterConsumption,
        wasteGenerated: data.wasteGenerated,
      },
    }));
  };

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

  const handleCompanyNameSave = async () => {
    if (!tempCompanyName.trim()) return;

    const newName = tempCompanyName.trim();
    setCompanyName(newName);
    localStorage.setItem("companyName", newName);

    try {
      await fetch(`${API_BASE_URL}/api/company-name`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ company_name: newName }),
      });
    } catch (error) {
      console.warn("Failed to save company name to backend:", error);
    }

    setIsEditingCompany(false);
  };

  useEffect(() => {
    const extractCompanyName = () => {
      if (invoiceData && invoiceData.length > 0) {
        const sample = invoiceData[0];

        const companyFields = [
          "company",
          "company_name",
          "client",
          "client_name",
          "customer",
          "customer_name",
        ];
        for (const field of companyFields) {
          if (sample[field] && typeof sample[field] === "string") {
            const name = sample[field].trim();
            if (name && name !== "—" && name !== "Company Name") {
              return name;
            }
          }
        }

        for (const key in sample) {
          if (
            key.toLowerCase().includes("company") ||
            key.toLowerCase().includes("client") ||
            key.toLowerCase().includes("customer")
          ) {
            const value = sample[key];
            if (typeof value === "string" && value.trim() && !value.match(/^\d+$/)) {
              return value.trim();
            }
          }
        }
      }

      const savedCompany = localStorage.getItem("companyName");
      if (savedCompany && savedCompany.trim() && savedCompany.trim() !== "Company Name") {
        return savedCompany.trim();
      }

      return "";
    };

    const name = extractCompanyName();
    if (name) {
      setCompanyName(name);
      localStorage.setItem("companyName", name);
    }
  }, [invoiceData, summaryData, environmentalMetrics, invoiceSummaries]);

  // ---------- Trend indicator ----------
  const renderIndicator = (current, previous) => {
    if (previous === null || previous === undefined) {
      return <div className="h-5" />;
    }

    const diff = current - previous;
    const pctChange =
      previous === 0 ? (current === 0 ? 0 : 100) : (diff / previous) * 100;

    const formatted = (diff > 0 ? "+" : "") + pctChange.toFixed(1) + "%";
    const isUp = diff > 0;
    const isDown = diff < 0;
    const color = isUp
      ? "text-emerald-600"
      : isDown
      ? "text-red-600"
      : "text-gray-500";

    return (
      <div
        className={`flex items-center gap-1 text-[11px] font-semibold ${color} h-5`}
      >
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

  // ---------- Red flag rules ----------
  const computeRedFlags = (summary, metrics, invoiceMetrics) => {
    const flags = [];

    const env = summary?.environmental ?? {};
    const soc = summary?.social ?? {};
    const gov = summary?.governance ?? {};

    const renewableShare =
      env.renewableEnergyShare !== undefined
        ? env.renewableEnergyShare
        : invoiceMetrics.renewablePercentage;

    if (renewableShare !== null && renewableShare < 20) {
      flags.push(
        `Renewable energy share is only ${renewableShare.toFixed(
          1
        )}%. This is below the 20% threshold.`
      );
    }

    const carbonTaxValue = metrics?.carbonTax ?? 0;
    if (carbonTaxValue > 20000000) {
      flags.push(
        `Carbon tax exposure (R ${carbonTaxValue.toLocaleString()}) is above the defined risk threshold.`
      );
    }

    const totalEnergy = env.totalEnergyConsumption ?? invoiceMetrics.totalEnergyKwh;
    if (totalEnergy > 0) {
      const savingsPct =
        (invoiceMetrics.costSavingsPotential / (totalEnergy * 0.15)) * 100;
      if (savingsPct > 10) {
        flags.push(
          `Significant cost savings potential (${savingsPct.toFixed(
            1
          )}%) identified from invoice analysis.`
        );
      }
    }

    if (invoiceMetrics.peakConsumption > invoiceMetrics.monthlyAverage * 1.5) {
      flags.push(
        `Peak energy consumption (${invoiceMetrics.peakConsumption.toLocaleString()} kWh) is significantly above monthly average.`
      );
    }

    if (soc.supplierDiversity !== undefined && soc.supplierDiversity < 5) {
      flags.push(
        `Supplier diversity (${soc.supplierDiversity}%) is low – this may create concentration and social risk.`
      );
    }

    if (gov.totalComplianceFindings && gov.totalComplianceFindings > 0) {
      flags.push(
        `There are ${gov.totalComplianceFindings} open compliance findings – review governance actions.`
      );
    }

    return flags;
  };

  const applySnapshotFromBackend = (esgData) => {
    const mock = esgData?.mockData || {};
    const summary = mock.summary || {};
    const metrics = mock.metrics || {};

    const envSummary = summary.environmental || {};
    const socSummary = summary.social || {};
    const govSummary = summary.governance || {};

    setSummaryData(summary);

    if (summary.company_name) {
      setCompanyName(summary.company_name);
    }

    setEsGSummary({
      environmental: `Energy: ${
        envSummary.totalEnergyConsumption ?? 0
      } kWh · Renewables: ${
        envSummary.renewableEnergyShare ?? "--"
      }% · Carbon: ${(envSummary.carbonEmissions ?? 0).toLocaleString()} tCO₂e`,
      social: `Supplier diversity: ${
        socSummary.supplierDiversity ?? "--"
      }% · Customer satisfaction: ${
        socSummary.customerSatisfaction ?? "--"
      }% · Human capital: ${socSummary.humanCapital ?? "--"}%`,
      governance: `Corporate governance: ${
        govSummary.corporateGovernance ?? "--"
      } · ISO 9001: ${govSummary.iso9001Compliance ?? "--"} · Ethics: ${
        govSummary.businessEthics ?? "--"
      }`,
    });

    setPrevCarbonTax(carbonTax);
    setPrevTaxAllowances(taxAllowances);
    setPrevCarbonCredits(carbonCredits);
    setPrevEnergySavings(energySavings);

    setCarbonTax(metrics.carbonTax || 0);
    setTaxAllowances(metrics.taxAllowances || 0);
    setCarbonCredits(metrics.carbonCredits || 0);
    setEnergySavings(metrics.energySavings || 0);

    setRedFlags(computeRedFlags(summary, metrics, invoiceMetrics));

    const combinedList = esgData?.insights || [];
    setAIInsights(combinedList);
  };

  const loadSnapshotFromBackend = async () => {
    setAiLoading(true);
    setAiError(null);

    try {
      const [esgRes, miniRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/esg-data`),
        fetch(`${API_BASE_URL}/api/esg-mini-report`),
      ]);

      if (!esgRes.ok) throw new Error("/api/esg-data error: " + esgRes.status);
      if (!miniRes.ok) throw new Error("/api/esg-mini-report error: " + miniRes.status);

      const [esgData, miniData] = await Promise.all([
        esgRes.json(),
        miniRes.json(),
      ]);

      applySnapshotFromBackend(esgData);
      setMiniReport({
        baseline: miniData.baseline || "",
        benchmark: miniData.benchmark || "",
        performance_vs_benchmark: miniData.performance_vs_benchmark || "",
        ai_recommendations: miniData.ai_recommendations || [],
      });
    } catch (err) {
      console.error("Error loading ESG snapshot from backend:", err);
      setAiError(err.message || "Failed to load ESG metrics and AI insights snapshot.");
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshotFromBackend();
  }, []);

  useEffect(() => {
    const loadPillarAI = async () => {
      setPillarAiLoading(true);
      setPillarAiError(null);

      try {
        const [envRes, socRes, govRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/environmental-insights`),
          fetch(`${API_BASE_URL}/api/social-insights`),
          fetch(`${API_BASE_URL}/api/governance-insights`),
        ]);

        const responses = [envRes, socRes, govRes];
        const bad = responses.find((r) => !r.ok);
        if (bad) throw new Error(bad.url + " error: " + bad.status);

        const [envData, socData, govData] = await Promise.all(
          responses.map((r) => r.json())
        );

        const combined = []
          .concat(envData.insights || [])
          .concat(socData.insights || [])
          .concat(govData.insights || []);

        if (combined.length > 0) {
          setAIInsights(combined);
        }
      } catch (err) {
        console.error("Pillar AI insights error:", err);
        setPillarAiError(err.message || "Failed to load live ESG AI insights.");
      } finally {
        setPillarAiLoading(false);
      }
    };

    loadPillarAI();
  }, []);

  useEffect(() => {
    const loadPlatformStats = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/platform/overview`);
        if (!res.ok) return;
        const data = await res.json();
        setPlatformStats((prev) => ({
          ...prev,
          ...data,
        }));
      } catch (e) {
        console.warn("Failed to load platform stats", e);
      }
    };

    loadPlatformStats();
  }, []);

  useEffect(() => {
    const loadInvoices = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/invoices?last_months=6`);
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          setInvoiceSummaries(data);
        }
      } catch (e) {
        console.warn("Failed to load invoice summaries for dashboard", e);
      }
    };

    loadInvoices();
  }, []);

  useEffect(() => {
    const loadInvoiceEnvInsights = async () => {
      setInvoiceEnvError(null);
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/invoice-environmental-insights?last_n=6`
        );
        if (!res.ok) {
          if (res.status === 404) return;
          throw new Error("/api/invoice-environmental-insights error: " + res.status);
        }

        const data = await res.json();
        const metrics = data.metrics || null;
        const insights = data.insights || [];

        setInvoiceEnvMetrics(metrics);
        setInvoiceEnvInsights(insights);

        if (insights && insights.length > 0) {
          setAIInsights((prev) => {
            const base = Array.isArray(prev) ? prev : [];
            const existing = new Set(base);
            const merged = [...base];
            insights.forEach((line) => {
              if (!existing.has(line)) {
                merged.push(line);
                existing.add(line);
              }
            });
            return merged;
          });
        }
      } catch (err) {
        console.warn("Invoice Environmental insights error:", err);
        setInvoiceEnvError(
          err.message || "Failed to load invoice-derived Environmental AI insights."
        );
      }
    };

    loadInvoiceEnvInsights();
  }, []);

  useEffect(() => {
    const newFlags = computeRedFlags(
      summaryData,
      {
        carbonTax,
        taxAllowances,
        carbonCredits,
        energySavings,
      },
      invoiceMetrics
    );

    setRedFlags(newFlags);
  }, [invoiceMetrics, summaryData, carbonTax, taxAllowances, carbonCredits, energySavings]);

  // ---- TOTAL ENERGY (kWh) FOR DASHBOARD CARD ----
  const dashboardEnergyKWh = useMemo(() => {
    if (invoiceMetrics.totalEnergyKwh > 0) return invoiceMetrics.totalEnergyKwh;

    if (invoiceSummaries.length > 0) {
      const { totalEnergyKwh } = computeInvoiceEnergyAndCarbon(invoiceSummaries);
      if (totalEnergyKwh) return totalEnergyKwh;
    }

    if (environmentalMetrics?.uploadedRows?.length > 0) {
      const rows = environmentalMetrics.uploadedRows;
      const sample = rows[0] || {};
      const candidateCols = ["Electricity (kWh)", "Energy (kWh)", "kWh"];
      const colName =
        candidateCols.find((c) => Object.prototype.hasOwnProperty.call(sample, c)) ||
        null;

      if (colName) {
        return rows.reduce((sum, row) => {
          const v = row[colName];
          if (v == null) return sum;
          const num =
            typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
          return sum + (Number.isNaN(num) ? 0 : num);
        }, 0);
      }
    }

    const env = summaryData.environmental || {};
    if (env.totalEnergyConsumption != null) return env.totalEnergyConsumption;

    return 0;
  }, [invoiceMetrics.totalEnergyKwh, invoiceSummaries, environmentalMetrics, summaryData]);

  // ---- TOTAL CARBON (tCO₂e) FOR DASHBOARD CARD ----
  const dashboardCarbonTonnes = useMemo(() => {
    if (invoiceMetrics.totalCarbonTonnes > 0) return invoiceMetrics.totalCarbonTonnes;

    if (invoiceSummaries.length > 0) {
      const { totalCarbonTonnes } = computeInvoiceEnergyAndCarbon(invoiceSummaries);
      if (totalCarbonTonnes) return totalCarbonTonnes;
    }

    const env = summaryData.environmental || {};
    if (env.carbonEmissions != null) return env.carbonEmissions;

    return 0;
  }, [invoiceMetrics.totalCarbonTonnes, invoiceSummaries, summaryData]);

  const envSummaryData = summaryData.environmental || {};
  const socSummaryData = summaryData.social || {};
  const govSummaryData = summaryData.governance || {};

  // ✅ Download ESG Report (PDF) with logos imported from assets
  const handleGenerateReport = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    let headerBottomY = 30;
    let yPosition;

    try {
      // Load main logo from assets and add to PDF
      const mainImg = await loadImage(MainLogo);
      doc.addImage(mainImg, "PNG", 14, 10, 40, 40);

      // Try secondary logo (optional)
      try {
        const secondaryImg = await loadImage(SecondaryLogo);
        doc.addImage(secondaryImg, "PNG", pageWidth - 40, 28, 25, 25);
      } catch (e) {
        console.warn("Failed to load secondary logo:", e);
      }

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("ESG Performance Report", pageWidth / 2, 25, {
        align: "center",
      });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Generated by AfricaESG.AI Platform", pageWidth / 2, 32, {
        align: "center",
      });

      headerBottomY = 55;
    } catch (error) {
      console.warn("Failed to load logos from assets:", error);
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
      doc.text(
        `Data Source: ${invoiceData.length} invoice records analyzed`,
        14,
        yPosition
      );
      yPosition += 7;
    }

    doc.text(`Report Period: ${new Date().getFullYear()}`, 14, yPosition);
    yPosition += 10;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("ESG Performance Summary", 14, yPosition);
    yPosition += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Environmental (from Invoice Analysis):", 14, yPosition);
    yPosition += 6;
    doc.setFontSize(10);
    doc.text(
      `• Energy Consumption: ${dashboardEnergyKWh.toLocaleString()} kWh`,
      20,
      yPosition
    );
    yPosition += 5;
    doc.text(
      `• Renewable Energy: ${invoiceMetrics.renewablePercentage.toFixed(1)}%`,
      20,
      yPosition
    );
    yPosition += 5;
    doc.text(
      `• Carbon Emissions: ${dashboardCarbonTonnes.toLocaleString()} tCO₂e`,
      20,
      yPosition
    );
    yPosition += 5;
    doc.text(
      `• Monthly Average: ${invoiceMetrics.monthlyAverage.toLocaleString()} kWh`,
      20,
      yPosition
    );
    yPosition += 5;
    doc.text(
      `• Peak Consumption: ${invoiceMetrics.peakConsumption.toLocaleString()} kWh`,
      20,
      yPosition
    );
    yPosition += 8;

    doc.setFontSize(11);
    doc.text("Social:", 14, yPosition);
    yPosition += 6;
    doc.setFontSize(10);
    doc.text(
      `• Supplier Diversity: ${
        socSummaryData.supplierDiversity != null
          ? `${socSummaryData.supplierDiversity}%`
          : "--"
      }`,
      20,
      yPosition
    );
    yPosition += 5;
    doc.text(
      `• Customer Satisfaction: ${
        socSummaryData.customerSatisfaction != null
          ? `${socSummaryData.customerSatisfaction}%`
          : "--"
      }`,
      20,
      yPosition
    );
    yPosition += 8;

    doc.setFontSize(11);
    doc.text("Governance:", 14, yPosition);
    yPosition += 6;
    doc.setFontSize(10);
    doc.text(
      `• Corporate Governance: ${govSummaryData.corporateGovernance || "--"}`,
      20,
      yPosition
    );
    yPosition += 5;
    doc.text(
      `• ISO 9001 Compliance: ${govSummaryData.iso9001Compliance || "--"}`,
      20,
      yPosition
    );
    yPosition += 10;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Financial & Carbon KPIs", 14, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`• Carbon Tax Exposure: R ${carbonTax.toLocaleString()}`, 20, yPosition);
    yPosition += 5;
    doc.text(
      `• Tax Allowances: R ${taxAllowances.toLocaleString()}`,
      20,
      yPosition
    );
    yPosition += 5;
    doc.text(
      `• Carbon Credits: ${carbonCredits.toLocaleString()} tonnes`,
      20,
      yPosition
    );
    yPosition += 5;
    doc.text(
      `• Energy Savings: ${energySavings.toLocaleString()} kWh`,
      20,
      yPosition
    );
    yPosition += 5;
    doc.text(
      `• Cost Savings Potential: R ${invoiceMetrics.costSavingsPotential.toLocaleString()}`,
      20,
      yPosition
    );
    yPosition += 10;

    if (aiInsights && aiInsights.length > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("AI Analyst Insights", 14, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      aiInsights.slice(0, 5).forEach((insight) => {
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
        ? `${reportCompanyName
            .replace(/[^a-z0-9]/gi, "_")
            .toUpperCase()}_ESG_Report_${new Date()
            .toISOString()
            .split("T")[0]}.pdf`
        : `AfricaESG_Report_${new Date().toISOString().split("T")[0]}.pdf`;

    doc.save(filename);
  };

  const StatCard = ({ icon, label, value, sub }) => (
    <div className="flex items-center gap-3 rounded-2xl bg-white border border-slate-100 shadow-sm px-4 py-3 h-full">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 shrink-0">
        {icon}
      </div>
      <div className="leading-tight">
        <div className="text-xs text-slate-500 uppercase tracking-wide">
          {label}
        </div>
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
        {typeof value === "string" && value.indexOf("R ") === 0 ? (
          <>
            <span className="text-sm text-slate-500">R</span>
            <span>{value.replace(/^R\s*/, "")}</span>
          </>
        ) : (
          <span>{value}</span>
        )}
      </div>
    </div>
  );

  const InvoiceDataCard = ({ icon, label, value, unit, trend }) => (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600">{icon}</div>
          <span className="text-sm font-semibold text-gray-700">{label}</span>
        </div>
        {trend && (
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${
              trend > 0
                ? "bg-red-100 text-red-800"
                : "bg-green-100 text-green-800"
            }`}
          >
            {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500">{unit}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-lime-50 py-10 font-sans">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header Row */}
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
                    <span className="text-lg font-semibold text-gray-700">
                      {companyName}
                    </span>
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

            {invoiceData && invoiceData.length > 0 && (
              <div className="mt-2 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                <FaChartLine />
                <span>
                  Analyzing {invoiceData.length} invoice records from
                  EnvironmentalCategory
                </span>
              </div>
            )}

            <p className="text-sm text-gray-600 max-w-xl mt-3">
              ESG performance overview with AI-enabled insights on carbon tax,
              energy savings, and strategic ESG levers. Baselines are derived
              from your latest uploaded ESG dataset and electricity invoices.
            </p>

            <div className="mt-2 h-5">
              {(aiLoading || pillarAiLoading) && (
                <p className="text-xs text-emerald-700 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Loading ESG metrics and live AI insights…
                </p>
              )}
              {!aiLoading && !pillarAiLoading && (aiError || pillarAiError) && (
                <p className="text-xs text-red-500">
                  {aiError || pillarAiError}
                </p>
              )}
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

        {/* Invoice Data Summary Section */}
        {invoiceData && invoiceData.length > 0 && (
          <section className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Invoice Data Analysis
              </h2>
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                From EnvironmentalCategory
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <InvoiceDataCard
                icon={<FaBolt />}
                label="Total Energy"
                value={invoiceMetrics.totalEnergyKwh.toLocaleString()}
                unit="kWh"
                trend={5.2}
              />
              <InvoiceDataCard
                icon={<FaLeaf />}
                label="Carbon Emissions"
                value={invoiceMetrics.totalCarbonTonnes.toFixed(1)}
                unit="tCO₂e"
                trend={-2.1}
              />
              <InvoiceDataCard
                icon={<FaCloud />}
                label="Monthly Average"
                value={invoiceMetrics.monthlyAverage.toLocaleString()}
                unit="kWh/month"
                trend={3.8}
              />
              <InvoiceDataCard
                icon={<FaChartLine />}
                label="Renewable Share"
                value={`${invoiceMetrics.renewablePercentage.toFixed(1)}%`}
                unit="of total energy"
                trend={15.5}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <InvoiceDataCard
                icon={<FaWater />}
                label="Water Consumption"
                value={invoiceMetrics.waterConsumption.toLocaleString()}
                unit="Liters"
                trend={-1.2}
              />
              <InvoiceDataCard
                icon={<FaRecycle />}
                label="Waste Generated"
                value={invoiceMetrics.wasteGenerated.toLocaleString()}
                unit="kg"
                trend={2.3}
              />
              <InvoiceDataCard
                icon={<FaIndustry />}
                label="Energy Intensity"
                value={invoiceMetrics.energyIntensity.toFixed(2)}
                unit="kWh/Revenue"
                trend={-4.7}
              />
              <InvoiceDataCard
                icon={<FaTrash />}
                label="Carbon Intensity"
                value={invoiceMetrics.carbonIntensity.toFixed(4)}
                unit="tCO₂e/Revenue"
                trend={-3.2}
              />
            </div>
          </section>
        )}

        {/* Red Flag Panel */}
        {redFlags.length > 0 && (
          <section className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex gap-3 items-start">
            <FaExclamationTriangle className="text-red-500 mt-1 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-red-800 mb-1">
                Red Flags Detected
              </h2>
              <ul className="list-disc list-inside text-xs sm:text-sm text-red-900 space-y-1">
                {redFlags.map((flag, idx) => (
                  <li key={idx}>{flag}</li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Headline stats row */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
          <StatCard
            icon={<FaGlobeAfrica size={18} />}
            label="African countries supported"
            value={platformStats.countries_supported + "+"}
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
              <div style={{ display: "none" }}>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-700">
                    Company: {companyName || "Company Name"}
                  </div>
                  <div className="text-xs text-gray-500">
                    Report Period: {new Date().getFullYear()}
                  </div>
                </div>
              </div>
            </div>

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
                      {dashboardEnergyKWh.toLocaleString()} kWh
                    </li>
                    <li>
                      <span className="font-semibold">Renewables</span>{" "}
                      {invoiceMetrics.renewablePercentage > 0
                        ? invoiceMetrics.renewablePercentage.toFixed(1) + "%"
                        : envSummaryData.renewableEnergyShare != null
                        ? envSummaryData.renewableEnergyShare + "%"
                        : "--"}
                    </li>
                    <li>
                      <span className="font-semibold">Carbon</span>{" "}
                      {dashboardCarbonTonnes.toLocaleString()} tCO₂e
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
                        ? socSummaryData.supplierDiversity + "%"
                        : "--"}
                    </li>
                    <li>
                      <span className="font-semibold">Customer Satisfaction</span>{" "}
                      {socSummaryData.customerSatisfaction != null
                        ? socSummaryData.customerSatisfaction + "%"
                        : "--"}
                    </li>
                    <li>
                      <span className="font-semibold">Human Capital</span>{" "}
                      {socSummaryData.humanCapital != null
                        ? socSummaryData.humanCapital + "%"
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
                      onClick={() =>
                        navigate("/dashboard/governance/corporate")
                      }
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

            {/* Financial / carbon KPIs row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
              <MoneyCard
                icon={<FaIndustry size={15} />}
                label="Carbon Tax (2024/2025)"
                value={"R " + carbonTax.toLocaleString()}
                indicator={renderIndicator(carbonTax, prevCarbonTax)}
                isFlagged={carbonTax > 20000000}
              />
              <MoneyCard
                icon={<FaCloud size={15} />}
                label="Applicable Tax Allowances"
                value={"R " + taxAllowances.toLocaleString()}
                indicator={renderIndicator(taxAllowances, prevTaxAllowances)}
                isFlagged={false}
              />
              <MoneyCard
                icon={<FaTrash size={15} />}
                label="Carbon Credits Generated"
                value={carbonCredits.toLocaleString() + " tonnes"}
                indicator={renderIndicator(carbonCredits, prevCarbonCredits)}
                isFlagged={false}
              />
              <MoneyCard
                icon={<FaTint size={15} />}
                label="Energy Savings"
                value={energySavings.toLocaleString() + " kWh"}
                indicator={renderIndicator(energySavings, prevEnergySavings)}
                isFlagged={false}
              />
            </div>
          </div>
        </section>

        {/* AI Mini Report */}
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
            <p className="text-xs text-gray-500 mb-2">
              Baseline position, benchmark band and AI recommendations based on
              the latest ESG scores and invoice-derived energy/carbon baselines.
            </p>

            <div className="space-y-3 text-sm">
              <div>
                <h3 className="font-semibold text-slate-800 mb-0.5">
                  1. Baseline
                </h3>
                <p className="text-xs text-slate-700">
                  {miniReport.baseline || "Baseline not available yet."}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-800 mb-0.5">
                  2. Benchmark
                </h3>
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
                <h3 className="font-semibold text-slate-800 mb-0.5">
                  4. AI Recommendations
                </h3>
                {miniReport.ai_recommendations &&
                miniReport.ai_recommendations.length > 0 ? (
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
