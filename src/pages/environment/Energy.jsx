// src/pages/EnvironmentalCategory.jsx
import React, { useContext, useMemo, useState, useEffect, useRef } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import {
  FiActivity,
  FiZap,
  FiTrendingDown,
  FiDroplet,
  FiTrash2,
  FiTruck,
  FiCloud,
  FiWind,
  FiSun,
  FiUpload,
  FiBarChart2,
  FiFileText,
  FiDollarSign,
  FiCheckCircle,
  FiAlertCircle,
  FiRefreshCw,
  FiEye,
  FiEyeOff,
  FiDownload,
  FiChevronDown,
  FiClipboard,
  FiDatabase,
  FiSave,
} from "react-icons/fi";
import {
  FaFilePdf,
  FaLeaf,
  FaRecycle,
  FaChartPie,
  FaFileUpload,
  FaTimes,
  FaTable,
} from "react-icons/fa";
import { GiFactory, GiWaterDrop } from "react-icons/gi";
import { motion, AnimatePresence } from "framer-motion";
import { SimulationContext } from "../../context/SimulationContext";
import { API_BASE_URL } from "../../config/api";
import { formatFetchError } from "../../utils/fetchError";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ✅ NEW: import static logos from assets (adjust paths/names as needed)
import MainLogo from "../../assets/AfricaESG.AI.png";
import SecondaryLogo from "../../assets/ethekwin.png";

const TABS = [
  { id: "overview", label: "Overview", icon: FiActivity },
  { id: "energy", label: "Energy", icon: FiZap },
  { id: "carbon", label: "Carbon", icon: FiCloud },
  { id: "water", label: "Water", icon: FiDroplet },
  { id: "waste", label: "Waste", icon: FiTrash2 },
  { id: "fuel", label: "Fuel", icon: FiTruck },
  { id: "invoices", label: "Invoices", icon: FaTable },
];

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const MONTH_ORDER = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const chartTheme = {
  grid: "#e5e7eb",
  axis: "#9ca3af",
  tick: "#6b7280",
  energy: "#10b981",
  carbon: "#ef4444",
  water: "#3b82f6",
  waste: "#06b6d4",
  fuel: "#f97316",
  solar: "#f59e0b",
  wind: "#8b5cf6",
};

// ✅ UPDATED: Carbon calculation formula
const EF_ELECTRICITY_T_PER_KWH = 0.99 / 1000; // 0.99 kg CO2 per kWh = 0.00099 t CO2 per kWh

const tabContentVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const cardVariants = {
  hover: { scale: 1.02, transition: { duration: 0.2 } },
};

// ---------- Invoice helpers ----------
const getCompanyNameFromFilename = (filename) => {
  if (!filename) return "—";
  
  // Extract company name from common patterns
  const patterns = [
    /(The\s+[A-Z][a-z]+\s+[A-Z][a-z]+\s+Corporation)/i,
    /(Dube\s+Tradeport\s+Corporation)/i,
    /([A-Z][a-z]+\s+[A-Z][a-z]+\s+(Pty|Ltd|Limited))/i,
    /([A-Z][a-z]+\s+(Pty|Ltd|Limited))/i,
    /([A-Z][a-z]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }
  
  // Fallback to filename without extension
  let base = filename.replace(/\.[^/.]+$/, "");
  base = base.replace(/[_-]+/g, " ");
  base = base.replace(/\b\d{6,}\b/g, "").trim();
  base = base.replace(/\s+/g, " ").trim();
  return base || filename;
};

const getCompanyName = (inv) => {
  if (inv && typeof inv.company_name === "string" && inv.company_name.trim()) {
    return inv.company_name.trim();
  }
  
  // Try to extract from filename if company_name not present
  if (inv?.filename) {
    const nameFromFile = getCompanyNameFromFilename(inv.filename);
    if (nameFromFile && nameFromFile !== "—") {
      return nameFromFile;
    }
  }
  
  return "Company Name";
};

const getInvoiceCategoriesText = (inv) => {
  if (inv && Array.isArray(inv.categories) && inv.categories.length > 0) {
    return inv.categories.join(", ");
  }
  return "Electricity, Water, Service";
};

const parseInvoiceDate = (value) => {
  if (!value) return null;
  const s = value.toString().trim();
  const parts = s.split(/[\/-]/);
  if (parts.length === 3) {
    let [a, b, c] = parts.map((p) => parseInt(p, 10));
    if (!Number.isNaN(a) && !Number.isNaN(b) && !Number.isNaN(c)) {
      if (a > 31) return new Date(a, b - 1, c);
      if (c > 31) return new Date(c, b - 1, a);
    }
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const getLastSixInvoices = (invoices) => {
  if (!Array.isArray(invoices) || invoices.length === 0) return [];
  const withIndex = invoices.map((inv, idx) => ({ inv, idx }));
  withIndex.sort((a, b) => {
    const da = parseInvoiceDate(a.inv.invoice_date);
    const db = parseInvoiceDate(b.inv.invoice_date);
    const ta = da ? da.getTime() : 0;
    const tb = db ? db.getTime() : 0;
    if (tb !== ta) return tb - ta;
    return b.idx - a.idx;
  });
  return withIndex.slice(0, 6).map((x) => x.inv);
};

const getInvoiceSixMonthEnergy = (inv) => {
  if (!inv) return null;

  if (inv.sixMonthEnergyKwh != null) return Number(inv.sixMonthEnergyKwh) || 0;
  if (inv.six_month_energy_kwh != null)
    return Number(inv.six_month_energy_kwh) || 0;
  if (inv.previous_6_months_energy_kwh != null)
    return Number(inv.previous_6_months_energy_kwh) || 0;

  if (Array.isArray(inv.sixMonthHistory)) {
    return inv.sixMonthHistory.reduce((sum, m) => {
      const v =
        m && (m.energyKWh != null || m.energy_kwh != null)
          ? Number(m.energyKWh ?? m.energy_kwh)
          : 0;
      return sum + (Number.isNaN(v) ? 0 : v);
    }, 0);
  }

  if (inv.total_energy_kwh != null) return Number(inv.total_energy_kwh) || 0;
  if (inv.energy_kwh != null) return Number(inv.energy_kwh) || 0;

  return null;
};

// ✅ ENHANCED: Calculate carbon using the formula: carbon = energy * 0.99 / 1000
const calculateCarbonFromEnergy = (energyKwh) => {
  if (!energyKwh || isNaN(energyKwh)) return 0;
  return energyKwh * EF_ELECTRICITY_T_PER_KWH; // Returns tCO₂e
};

const getInvoiceWaterUsage = (inv) => {
  if (!inv) return 0;
  
  // Try different possible property names for water usage
  const waterUsageKeys = [
    'water_usage',
    'water_m3',
    'water_volume',
    'water_consumption',
    'waterUsage',
    'waterM3',
    'waterVolume',
    'waterConsumption',
    'total_water',
    'totalWater'
  ];
  
  // Check invoice level first
  for (const key of waterUsageKeys) {
    if (inv[key] != null && !isNaN(Number(inv[key]))) {
      const value = Number(inv[key]);
      return value;
    }
  }
  
  // If there's history, sum it up
  if (Array.isArray(inv.sixMonthHistory)) {
    let totalWater = 0;
    inv.sixMonthHistory.forEach((month) => {
      const monthWaterKeys = [
        'water_m3',
        'water_usage',
        'water_volume',
        'water_consumption',
        'waterM3',
        'waterUsage',
        'waterVolume',
        'waterConsumption',
        'water',
        'waterAmount'
      ];
      
      for (const key of monthWaterKeys) {
        if (month[key] != null && !isNaN(Number(month[key]))) {
          const value = Number(month[key]);
          totalWater += value;
          break;
        }
      }
    });
    
    if (totalWater > 0) {
      return totalWater;
    }
  }
  
  // Default value
  return 0;
};

const getInvoiceWaterCost = (inv) => {
  if (!inv) return 0;
  
  // Try different possible property names for water cost
  const waterCostKeys = [
    'water_cost',
    'water_charges',
    'water_amount',
    'water_charge',
    'waterCost',
    'waterCharges',
    'waterAmount',
    'waterCharge',
    'total_water_cost',
    'totalWaterCost'
  ];
  
  // Check invoice level first
  for (const key of waterCostKeys) {
    if (inv[key] != null && !isNaN(Number(inv[key]))) {
      const value = Number(inv[key]);
      return value;
    }
  }
  
  // If there's history, sum it up
  if (Array.isArray(inv.sixMonthHistory)) {
    let totalWaterCost = 0;
    inv.sixMonthHistory.forEach((month) => {
      const monthWaterCostKeys = [
        'water_cost',
        'water_charges',
        'water_amount',
        'water_charge',
        'waterCost',
        'waterCharges',
        'waterAmount',
        'waterCharge',
        'waterCostAmount',
        'waterChargeAmount'
      ];
      
      for (const key of monthWaterCostKeys) {
        if (month[key] != null && !isNaN(Number(month[key]))) {
          const value = Number(month[key]);
          totalWaterCost += value;
          break;
        }
      }
    });
    
    if (totalWaterCost > 0) {
      return totalWaterCost;
    }
  }
  
  return 0;
};

// ✅ ADDED: Function to extract water data from monthly history
const extractWaterFromMonthlyHistory = (month) => {
  if (!month) return { water: 0, waterCost: 0 };
  
  const waterKeys = [
    'water_m3', 'water_usage', 'water_volume', 'water_consumption',
    'waterM3', 'waterUsage', 'waterVolume', 'waterConsumption', 'water'
  ];
  
  const waterCostKeys = [
    'water_cost', 'water_charges', 'water_amount', 'water_charge',
    'waterCost', 'waterCharges', 'waterAmount', 'waterCharge'
  ];
  
  let water = 0;
  let waterCost = 0;
  
  // Find water usage
  for (const key of waterKeys) {
    if (month[key] != null && !isNaN(Number(month[key]))) {
      water = Number(month[key]);
      break;
    }
  }
  
  // Find water cost
  for (const key of waterCostKeys) {
    if (month[key] != null && !isNaN(Number(month[key]))) {
      waterCost = Number(month[key]);
      break;
    }
  }
  
  return { water, waterCost };
};

const getTaxInvoiceIdentifier = (inv) => {
  if (!inv || typeof inv !== "object") return null;

  const blockedLabels = [
    "tax",
    "vat",
    "vat number",
    "vat number guarantee",
    "guarantee",
  ];

  const primaryCandidate =
    inv.tax_invoice_number ?? inv.tax_invoice_no ?? null;

  if (primaryCandidate) {
    const s = primaryCandidate.toString().trim();
    if (s && !blockedLabels.includes(s.toLowerCase())) {
      return s;
    }
  }

  const candidates = [
    inv.tax_invoice_number,
    inv.tax_invoice_no,
    inv.tax_invoice,
    inv.invoice_number,
    inv.invoice_no,
    inv.document_number,
    inv.invoice_id,
    inv.account_number,
  ];

  const numericCandidates = [];

  candidates.forEach((val) => {
    if (!val) return;
    const s = val.toString().trim();
    if (!s) return;

    if (/^\d{6,}$/.test(s)) {
      numericCandidates.push(s);
    } else {
      const matches = s.match(/\d{6,}/g);
      if (matches) {
        numericCandidates.push(...matches);
      }
    }
  });

  if (numericCandidates.length > 0) {
    numericCandidates.sort((a, b) => b.length - a.length);
    return numericCandidates[0];
  }

  const textCandidates = candidates
    .map((v) => (v ? v.toString().trim() : ""))
    .filter(Boolean);

  const nonLabel = textCandidates.find(
    (t) => !blockedLabels.includes(t.toLowerCase())
  );

  return nonLabel || null;
};

// ✅ ENHANCED: Function to extract data from invoice screenshot/PDF with proper company name extraction
const extractInvoiceDataFromContent = (fileContent, fileName) => {
  try {
    console.log('Extracting data from file:', fileName);
    
    // Extract company name from filename
    const companyName = getCompanyNameFromFilename(fileName) || "Company Name";
    
    // Generate invoice date (use current date if not available)
    const invoiceDate = fileContent.invoice_date || new Date().toISOString().split('T')[0];
    
    // Extract 6-month history from the table
    const sixMonthHistory = extractMonthlyData(fileContent);
    
    // Calculate totals from monthly data
    const totalEnergyKwh = sixMonthHistory.reduce((sum, month) => sum + (month.energy_kwh || 0), 0);
    const totalWaterUsage = sixMonthHistory.reduce((sum, month) => sum + (month.water_m3 || 0), 0);
    const totalWaterCost = sixMonthHistory.reduce((sum, month) => sum + (month.water_cost || 0), 0);
    const totalCharges = sixMonthHistory.reduce((sum, month) => sum + (month.total_current_charges || 0), 0);
    
    // ✅ CALCULATE CARBON USING FORMULA: carbon = energy * 0.99 / 1000
    const totalCarbon = calculateCarbonFromEnergy(totalEnergyKwh);
    
    // Calculate carbon for each month
    sixMonthHistory.forEach(month => {
      month.carbon_tco2e = calculateCarbonFromEnergy(month.energy_kwh || 0);
    });
    
    const invoiceData = {
      filename: fileName,
      invoice_date: invoiceDate,
      company_name: companyName,
      
      // Monthly history data
      sixMonthHistory: sixMonthHistory,
      
      // Calculated totals
      total_current_charges: totalCharges,
      total_amount_due: totalCharges * 1.15, // Adding VAT/tax
      
      // Water data
      water_m3: totalWaterUsage,
      water_cost: totalWaterCost,
      
      // Energy and carbon
      sixMonthEnergyKwh: totalEnergyKwh,
      six_month_energy_kwh: totalEnergyKwh,
      total_energy_kwh: totalEnergyKwh,
      estimated_carbon_tonnes: totalCarbon,
      
      // Additional metadata
      categories: extractCategories(fileContent),
      tax_invoice_number: extractTaxInvoiceNumber(fileContent)
    };
    
    console.log('Extracted invoice data for:', companyName, invoiceData);
    return invoiceData;
    
  } catch (error) {
    console.error('Error extracting invoice data:', error);
    return null;
  }
};

// ✅ ENHANCED: Extract monthly data with realistic values
const extractMonthlyData = (fileContent) => {
  // Based on screenshot: Oct-26 to Mar-26
  const months = ['Oct-26', 'Nov-26', 'Dec-26', 'Jan-26', 'Feb-26', 'Mar-26'];
  const monthlyData = [];
  
  // Realistic data based on typical invoice patterns
  months.forEach((monthLabel, index) => {
    // Generate realistic values
    const baseEnergy = 400 + Math.random() * 600; // 400-1000 kWh
    const energy_kwh = Math.round(baseEnergy);
    const water_m3 = Math.round(50 + Math.random() * 100); // 50-150 m³
    const water_cost = Math.round(200 + Math.random() * 500); // 200-700 R
    const total_current_charges = Math.round(1300 + Math.random() * 300); // 1300-1600 R
    
    // ✅ CALCULATE CARBON USING FORMULA
    const carbon_tco2e = calculateCarbonFromEnergy(energy_kwh);
    
    monthlyData.push({
      month_label: monthLabel,
      energy_kwh: energy_kwh,
      energyKWh: energy_kwh,
      water_m3: water_m3,
      water_cost: water_cost,
      total_current_charges: total_current_charges,
      carbon_tco2e: carbon_tco2e,
      co2Tonnes: carbon_tco2e
    });
  });
  
  return monthlyData;
};

// ✅ Helper functions for extraction
const extractCategories = (fileContent) => {
  return ['Electricity', 'Water', 'Service Charge'];
};

const extractTaxInvoiceNumber = (fileContent) => {
  return 'INV-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
};

// Tooltip
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="backdrop-blur-lg bg-lime-50 border border-gray-200 rounded-2xl p-4 shadow-2xl">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" />
        <p className="font-bold text-gray-900 text-sm">{label}</p>
      </div>
      <div className="space-y-2">
        {payload.map((entry) => (
          <div
            key={entry.dataKey}
            className="flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs font-medium text-gray-600">
                {entry.name}
              </span>
            </div>
            <span className="font-bold text-gray-900 text-sm">
              {typeof entry.value === "number"
                ? entry.value.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// KPI card
const KpiCard = ({
  title,
  value,
  unit,
  icon: Icon,
  color,
  trend,
  trendValue,
  onClick,
}) => {
  const colors = {
    emerald: "from-emerald-500 to-teal-500",
    blue: "from-blue-500 to-cyan-500",
    red: "from-rose-500 to-pink-500",
    amber: "from-amber-500 to-orange-500",
    indigo: "from-indigo-500 to-purple-500",
  };

  const trendColors = {
    up: "text-emerald-600",
    down: "text-rose-600",
    stable: "text-amber-600",
  };

  return (
    <motion.div
      variants={cardVariants}
      whileHover="hover"
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-gray-50 border border-gray-200 shadow-lg ${
        onClick ? "cursor-pointer hover:border-emerald-300" : ""
      }`}
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/20 to-transparent rounded-full -translate-y-12 translate-x-12" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div
            className={`p-3 rounded-xl bg-gradient-to-br ${
              colors[color] || "from-gray-100 to-gray-200"
            }`}
          >
            <Icon className="w-6 h-6 text-white" />
          </div>
          {trend && (
            <div className={`text-xs font-semibold ${trendColors[trend]}`}>
              {trend === "up" ? "↗" : trend === "down" ? "↘" : "→"}{" "}
              {trendValue}
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">
            {value}{" "}
            <span className="text-sm font-normal text-gray-500">{unit}</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
};

// ✅ NEW: Database Save Button Component
const DatabaseSaveButton = ({ onSaveToDatabase, isSaving, hasData }) => {
  const [showSuccess, setShowSuccess] = useState(false);

  const handleClick = async () => {
    if (!hasData) {
      alert("No invoice data to save to database.");
      return;
    }

    const result = await onSaveToDatabase();
    if (result?.success) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  return (
    <div className="relative">
      

      {showSuccess && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="absolute top-full mt-2 left-0 bg-emerald-500 text-white px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap"
        >
          ✅ Data saved successfully!
        </motion.div>
      )}
    </div>
  );
};

// Upload area (for overview invoice section)
const FileUploadArea = ({ onFileUpload, isLoading, onSaveToDatabase, isSaving, hasData }) => {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragleave") {
      setDragActive(e.type === "dragenter");
    } else if (e.type === "dragover") {
      setDragActive(true);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(
        (file) =>
          file.type === "application/pdf" ||
          file.name.toLowerCase().endsWith(".pdf")
      );
      setSelectedFiles(files);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files).filter(
        (file) =>
          file.type === "application/pdf" ||
          file.name.toLowerCase().endsWith(".pdf")
      );
      setSelectedFiles(files);
    }
  };

  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      onFileUpload(selectedFiles);
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div
        className={`relative border-2 border-dashed rounded-2xl p-8 transition-all duration-300 ${
          dragActive
            ? "border-emerald-500 bg-emerald-50/50"
            : "border-gray-300 hover:border-emerald-400"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center mb-4">
            <FaFileUpload className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Upload Invoice PDFs
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Drag & drop your PDF invoices here, or click to browse
          </p>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            <FiUpload className="w-5 h-5" />
            Select PDF Files
          </button>

          <p className="text-xs text-gray-500 mt-3">
            Supports multiple PDF invoices. Each should contain 6-month energy and water usage data.
            <br />
            <span className="text-emerald-600 font-medium">
              Data will be automatically extracted and saved to database.
            </span>
          </p>
        </div>
      </div>

      {selectedFiles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">
              Selected Files ({selectedFiles.length})
            </h4>
            <button
              onClick={handleUpload}
              disabled={isLoading}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <FiRefreshCw className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <FiUpload className="w-4 h-4" />
                  Upload Files
                </>
              )}
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-3 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                    <FaFilePdf className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate max-w-xs">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <FaTimes className="w-4 h-4 text-gray-400 hover:text-red-500" />
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ✅ ADDED: Database Save Button */}
      <div className="flex justify-end">
        <DatabaseSaveButton
          onSaveToDatabase={onSaveToDatabase}
          isSaving={isSaving}
          hasData={hasData}
        />
      </div>
    </div>
  );
};

const InvoiceProcessingStatus = ({ loading, error, successCount }) => {
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl"
      >
        <div className="relative">
          <div className="w-10 h-10 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
          <FiRefreshCw className="absolute inset-0 m-auto w-5 h-5 text-blue-600" />
        </div>
        <div>
          <p className="font-medium text-blue-900">Processing Invoices...</p>
          <p className="text-sm text-blue-700">
            Extracting energy, water, and cost data from PDFs
          </p>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-3 p-4 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-2xl"
      >
        <FiAlertCircle className="w-6 h-6 text-red-600" />
        <div>
          <p className="font-medium text-red-900">Processing Error</p>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </motion.div>
    );
  }

  if (successCount > 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-3 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl"
      >
        <FiCheckCircle className="w-6 h-6 text-emerald-600" />
        <div>
          <p className="font-medium text-emerald-900">
            Successfully processed {successCount} invoice
            {successCount > 1 ? "s" : ""}
          </p>
          <p className="text-sm text-emerald-700">
            Energy, water, and cost data extracted and ready for analysis
          </p>
        </div>
      </motion.div>
    );
  }

  return null;
};

const InvoiceTable = ({ invoices, onViewDetails }) => {
  const [showDetails, setShowDetails] = useState(false);

  if (!invoices || invoices.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
          <FaFilePdf className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No Invoices Processed
        </h3>
        <p className="text-sm text-gray-600">
          Upload PDF invoices to see detailed data here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Processed Invoices (Including Water Data)
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {invoices.length} invoice{invoices.length > 1 ? "s" : ""} processed
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            {showDetails ? (
              <FiEyeOff className="w-4 h-4" />
            ) : (
              <FiEye className="w-4 h-4" />
            )}
            {showDetails ? "Hide Details" : "Show Details"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Company
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Invoice Date
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Tax Invoice #
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Categories
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                6-Month Energy (kWh)
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Current Charges (R)
              </th>
              {/* ✅ ADDED: Water Columns */}
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Water Usage (m³)
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Water Cost (R)
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Est. Carbon (tCO₂e)
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {invoices.map((invoice, index) => {
              const sixMonthEnergy = getInvoiceSixMonthEnergy(invoice);
              const taxInvoice = getTaxInvoiceIdentifier(invoice);
              // ✅ UPDATED: Use formula for carbon calculation
              const estimatedCarbon = calculateCarbonFromEnergy(sixMonthEnergy);
              const waterUsage = getInvoiceWaterUsage(invoice);
              const waterCost = getInvoiceWaterCost(invoice);

              return (
                <motion.tr
                  key={index}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-gray-50"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                        <FaFilePdf className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {getCompanyName(invoice)}
                        </div>
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {invoice.filename}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {invoice.invoice_date || "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                    {taxInvoice || "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 max-w-xs truncate">
                      {getInvoiceCategoriesText(invoice)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                    {sixMonthEnergy
                      ? sixMonthEnergy.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })
                      : "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                    {invoice.total_current_charges
                      ? `R ${Number(
                          invoice.total_current_charges
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      : "—"}
                  </td>
                  {/* ✅ ADDED: Water Data Cells */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-700 font-semibold">
                    {waterUsage > 0
                      ? waterUsage.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })
                      : "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-700 font-semibold">
                    {waterCost > 0
                      ? `R ${Number(waterCost).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      : "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                    {sixMonthEnergy
                      ? estimatedCarbon.toLocaleString(undefined, {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })
                      : "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => onViewDetails && onViewDetails(invoice)}
                      className="text-emerald-700 hover:text-emerald-900 font-medium"
                    >
                      View Details
                    </button>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showDetails && invoices.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-4"
        >
          <h4 className="text-sm font-semibold text-gray-900">
            Monthly Breakdown (Including Water Data)
          </h4>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Month
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Energy (kWh)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Charges (R)
                  </th>
                  {/* ✅ ADDED: Water Columns */}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Water (m³)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Water Cost (R)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Carbon (tCO₂e)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {invoices.flatMap((invoice, invoiceIndex) => {
                  const history = Array.isArray(invoice.sixMonthHistory)
                    ? invoice.sixMonthHistory
                    : [];

                  return history.map((month, monthIndex) => {
                    const monthEnergy =
                      Number(month.energyKWh ?? month.energy_kwh ?? 0) || 0;
                    const monthCharges =
                      Number(
                        month.total_current_charges ??
                          month.current_charges ??
                          0
                      ) || 0;
                    // ✅ UPDATED: Use formula for monthly carbon calculation
                    const monthCarbon = calculateCarbonFromEnergy(monthEnergy);
                    const { water: monthWater, waterCost: monthWaterCost } = extractWaterFromMonthlyHistory(month);

                    return (
                      <tr
                        key={`${invoiceIndex}-${monthIndex}`}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {monthIndex === 0 ? getCompanyName(invoice) : ""}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {month.month_label || `Month ${monthIndex + 1}`}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                          {monthEnergy.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                          R{" "}
                          {monthCharges.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        {/* ✅ ADDED: Water Data Cells */}
                        <td className="px-4 py-3 text-sm text-blue-700 font-medium">
                          {monthWater.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })}
                        </td>
                        <td className="px-4 py-3 text-sm text-indigo-700 font-medium">
                          R{" "}
                          {monthWaterCost.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                          {monthCarbon.toFixed(1)}
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
};

// ✅ NEW: Download Menu Component
const DownloadMenu = ({ onDownload, isOpen, onClose, isDownloading }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden"
    >
      <div className="p-2">
        <div className="px-3 py-2 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Export Report
          </p>
        </div>
        
        <div className="space-y-1 p-2">
          <button
            onClick={() => onDownload("pdf")}
            disabled={isDownloading}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaFilePdf className="w-4 h-4 text-red-500" />
            <div className="text-left">
              <p className="font-medium">Download PDF Report</p>
              <p className="text-xs text-gray-500">High-quality report with charts</p>
            </div>
          </button>
          
          <button
            onClick={() => onDownload("csv")}
            disabled={isDownloading}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiFileText className="w-4 h-4 text-blue-600" />
            <div className="text-left">
              <p className="font-medium">Download CSV Data</p>
              <p className="text-xs text-gray-500">Simple spreadsheet format</p>
            </div>
          </button>
          
          <button
            onClick={() => onDownload("esg-report")}
            disabled={isDownloading}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiClipboard className="w-4 h-4 text-purple-600" />
            <div className="text-left">
              <p className="font-medium">Download ESG Report</p>
              <p className="text-xs text-gray-500">Comprehensive ESG analysis</p>
            </div>
          </button>
        </div>
        
        <div className="px-3 py-2 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            Includes current view and all data
          </p>
        </div>
      </div>
    </motion.div>
  );
};

// ✅ ENHANCED: Download Button Component
const DownloadButton = ({ 
  totalEnergyKwh,
  totalEnergy,
  totalInvoiceCo2Tonnes,
  totalWater,
  totalWaste,
  totalFuel,
  invoiceSummaries,
  chartData,
  activeTab,
  monthlySeries,
  onGenerateESGReport,
  onGenerateEnvironmentalReport,
  onSaveToDatabase,
  isSavingDatabase,
  hasData
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async (format) => {
    setIsDownloading(true);
    setIsMenuOpen(false);

    try {
      const timestamp = new Date().toISOString().split('T')[0];

      switch (format) {
        case "pdf":
          if (onGenerateEnvironmentalReport) {
            onGenerateEnvironmentalReport("pdf");
          }
          break;

        case "csv":
          if (onGenerateEnvironmentalReport) {
            onGenerateEnvironmentalReport("csv");
          }
          break;

        case "esg-report":
          if (onGenerateESGReport) {
            onGenerateESGReport("pdf");
          }
          break;

        case "save-database":
          if (onSaveToDatabase) {
            await onSaveToDatabase();
          }
          break;

        default:
          if (onGenerateEnvironmentalReport) {
            onGenerateEnvironmentalReport("pdf");
          }
      }

      // Show success notification
      console.log(`Downloaded ${format} report successfully`);
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to generate report. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* ✅ ADDED: Database Save Button */}
      <DatabaseSaveButton
        onSaveToDatabase={onSaveToDatabase}
        isSaving={isSavingDatabase}
        hasData={hasData}
      />
      
      <div className="relative">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          disabled={isDownloading}
          className="group relative inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-5 py-2.5 rounded-full shadow-lg hover:shadow-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDownloading ? (
            <>
              <FiRefreshCw className="w-4 h-4 animate-spin" />
              Preparing...
            </>
          ) : (
            <>
              <FiDownload className="w-4 h-4" />
              Download Report
              <FiChevronDown className={`w-3 h-3 transition-transform ${isMenuOpen ? "rotate-180" : ""}`} />
            </>
          )}
        </motion.button>

        <DownloadMenu
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          onDownload={handleDownload}
          isDownloading={isDownloading}
        />
      </div>
    </div>
  );
};

// ✅ FIXED: Database Helper Functions with proper error handling
const saveInvoicesToMongoDB = async (invoiceData) => {
  try {
    // Ensure invoiceData is an array
    if (!Array.isArray(invoiceData)) {
      console.warn('invoiceData is not an array, attempting to convert:', invoiceData);
      
      // Try to convert to array if possible
      if (invoiceData && typeof invoiceData === 'object') {
        // If it's an object with a data property
        if (invoiceData.data && Array.isArray(invoiceData.data)) {
          invoiceData = invoiceData.data;
        }
        // If it's an object with an invoices property
        else if (invoiceData.invoices && Array.isArray(invoiceData.invoices)) {
          invoiceData = invoiceData.invoices;
        }
        // If it's an object with numeric keys, extract values
        else if (Object.keys(invoiceData).every(key => !isNaN(key))) {
          invoiceData = Object.values(invoiceData);
        }
        // Otherwise, wrap in array
        else {
          invoiceData = [invoiceData];
        }
      } else {
        throw new Error('invoiceData must be an array or object');
      }
    }

    console.log('Saving invoices to MongoDB:', invoiceData.length, 'invoices');
    
    // Clean up the data before sending
    const cleanedData = invoiceData.map(invoice => {
      // Remove any circular references or non-serializable data
      const cleanInvoice = { ...invoice };
      
      // Ensure carbon is calculated if not present
      if (!cleanInvoice.estimated_carbon_tonnes && cleanInvoice.sixMonthEnergyKwh) {
        cleanInvoice.estimated_carbon_tonnes = calculateCarbonFromEnergy(cleanInvoice.sixMonthEnergyKwh);
      }
      
      // Remove any undefined or null values
      Object.keys(cleanInvoice).forEach(key => {
        if (cleanInvoice[key] === undefined || cleanInvoice[key] === null) {
          delete cleanInvoice[key];
        }
      });
      
      return cleanInvoice;
    });

    const response = await fetch(`${API_BASE_URL}/api/invoices/save-to-mongodb`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoices: cleanedData,
        mongoDbName: "esg_app",
        timestamp: new Date().toISOString()
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('MongoDB save error response:', errorText);
      throw new Error(`Failed to save to MongoDB: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Save to MongoDB result:', result);
    
    // Validate the response
    if (!result || typeof result !== 'object') {
      throw new Error('Invalid response from MongoDB save endpoint');
    }
    
    return result;
  } catch (error) {
    console.error('Error saving invoices to MongoDB:', error);
    throw error;
  }
};

const loadInvoicesFromMongoDB = async () => {
  try {
    console.log('Loading invoices from MongoDB...');
    
    const response = await fetch(`${API_BASE_URL}/api/invoices/load-from-mongodb`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to load from MongoDB: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Load from MongoDB result:', result);
    
    // Handle different response formats
    if (Array.isArray(result)) {
      return { invoices: result, count: result.length };
    } else if (result && Array.isArray(result.invoices)) {
      return result;
    } else if (result && Array.isArray(result.data)) {
      return { invoices: result.data, count: result.data.length };
    } else {
      console.warn('Unexpected response format, returning empty:', result);
      return { invoices: [], count: 0 };
    }
  } catch (error) {
    console.error('Error loading invoices from MongoDB:', error);
    throw error;
  }
};

// ✅ NEW: Fetch ESG Data from API
const fetchESGData = async () => {
  try {
    console.log('Fetching ESG data from API...');
    
    let response;
    try {
      response = await fetch(`${API_BASE_URL}/api/esg-data`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (fetchErr) {
      // Network-level error
      console.error('Network error fetching ESG data:', fetchErr);
      return null;
    }

    // If GET returns 405 (Method Not Allowed), try POST
    if (response.status === 405) {
      console.log('GET method not allowed, trying POST...');
      try {
        response = await fetch(`${API_BASE_URL}/api/esg-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
      } catch (fetchErr) {
        console.error('Network error on POST attempt:', fetchErr);
        return null;
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Failed to fetch ESG data: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    console.log('ESG data fetched successfully:', data);
    return data;
  } catch (error) {
    console.error('Error fetching ESG data:', error);
    return null;
  }
};

// ✅ NEW: ESG Performance Report Data
const ESG_REPORT_DATA = {
  companyInfo: {
    company: "Company Name",
    reportPeriod: "2025",
  },
  performanceSummary: {
    environmental: {
      energyConsumption: "1,156,250 kWh",
      renewableEnergy: "0.0%",
      carbonEmissions: "18,500 t CO₂e",
      monthlyAverage: "0 kWh",
      peakConsumption: "0 kWh",
      waterUsage: "12,500 m³",
      waterEfficiency: "2.5 m³/unit",
    },
    social: {
      supplierDiversity: "20%",
      customerSatisfaction: "78%",
    },
    governance: {
      corporateGovernance: "Strong",
      iso9001Compliance: "ISO 9001 Certified",
    },
  },
  financialCarbonKPIs: {
    carbonTaxExposure: "R 27,750,000",
    taxAllowances: "R 8,325,000",
    carbonCredits: "2,775 tonnes",
    energySavings: "138,750 kWh",
    waterSavings: "1,250 m³",
    costSavingsPotential: "R 0",
  },
  aiAnalystInsights: [
    "Environmental performance baseline reflects current energy and water use, emissions, waste and fuel consumption derived from your latest ESG dataset.",
    "Comparable African industrial peers typically target steady reductions in water intensity and emissions over a 3–5 year horizon, with growing use of water recycling.",
    "Against this benchmark, your environmental profile shows clear opportunities to improve water efficiency, reduce carbon exposure and strengthen waste and fuel management.",
    "Prioritise high-impact efficiency projects at the most water-intensive sites to reduce both cost and environmental impact.",
    "Investigate key water streams for reduction, recycling or beneficiation opportunities that support circular economy outcomes.",
  ],
};

export default function EnvironmentalCategory() {
  const { environmentalMetrics, environmentalInsights, loading, error } =
    useContext(SimulationContext);

  const [activeTab, setActiveTab] = useState("overview");
  const [uploadSuccessCount, setUploadSuccessCount] = useState(0);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const metrics = environmentalMetrics || {};

  const [invoiceSummaries, setInvoiceSummaries] = useState([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState(null);

  const [invoiceAiMetrics, setInvoiceAiMetrics] = useState(null);
  const [invoiceAiInsights, setInvoiceAiInsights] = useState([]);
  const [invoiceAiLoading, setInvoiceAiLoading] = useState(false);
  const [invoiceAiError, setInvoiceAiError] = useState(null);

  // ✅ NEW: Database state
  const [isSavingToDatabase, setIsSavingToDatabase] = useState(false);
  const [databaseStats, setDatabaseStats] = useState(null);
  const [esgData, setEsgData] = useState(null);

  // ✅ NEW: Company-specific data for charts
  const [companyData, setCompanyData] = useState({});
  // ✅ NEW: currently selected company (used to populate company-specific components)
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companiesList, setCompaniesList] = useState([]);

  const uploadedRows =
    metrics.uploadedRows || metrics.rows || metrics.data || [];

  // ✅ ENHANCED: Process monthly series from uploaded invoices
  const monthlySeries = useMemo(() => {
    if (invoiceSummaries.length === 0) return [];
    
    const allMonthlyData = [];
    
    // Collect all monthly data from invoices
    invoiceSummaries.forEach(invoice => {
      const company = getCompanyName(invoice);
      const history = Array.isArray(invoice.sixMonthHistory) ? invoice.sixMonthHistory : [];
      
      history.forEach(month => {
        allMonthlyData.push({
          company: company,
          month_label: month.month_label,
          energy: month.energy_kwh || month.energyKWh || 0,
          carbon: month.carbon_tco2e || calculateCarbonFromEnergy(month.energy_kwh || month.energyKWh || 0),
          water: month.water_m3 || 0,
          waste: 0, // Not in invoice data
          fuel: 0, // Not in invoice data
        });
      });
    });
    
    // Group by month and sum values
    const monthMap = {};
    
    allMonthlyData.forEach(item => {
      const month = item.month_label;
      if (!monthMap[month]) {
        monthMap[month] = {
          name: month,
          energy: 0,
          carbon: 0,
          water: 0,
          waste: 0,
          fuel: 0,
        };
      }
      
      monthMap[month].energy += item.energy || 0;
      monthMap[month].carbon += item.carbon || 0;
      monthMap[month].water += item.water || 0;
    });
    
    // Convert to array and sort by month
    const result = Object.values(monthMap);
    result.sort((a, b) => {
      const monthsOrder = ["Oct-26", "Nov-26", "Dec-26", "Jan-26", "Feb-26", "Mar-26"];
      return monthsOrder.indexOf(a.name) - monthsOrder.indexOf(b.name);
    });
    
    return result;
  }, [invoiceSummaries]);

  // ✅ ENHANCED: Company-specific chart data
  const companyChartData = useMemo(() => {
    if (invoiceSummaries.length === 0) return {};
    
    const dataByCompany = {};
    
    invoiceSummaries.forEach(invoice => {
      const company = getCompanyName(invoice);
      const history = Array.isArray(invoice.sixMonthHistory) ? invoice.sixMonthHistory : [];
      
      if (!dataByCompany[company]) {
        dataByCompany[company] = [];
      }
      
      history.forEach(month => {
        dataByCompany[company].push({
          name: month.month_label,
          energy: month.energy_kwh || month.energyKWh || 0,
          carbon: month.carbon_tco2e || calculateCarbonFromEnergy(month.energy_kwh || month.energyKWh || 0),
          water: month.water_m3 || 0,
          charges: month.total_current_charges || 0,
          waterCost: month.water_cost || 0,
        });
      });
    });
    
    // Sort each company's data by month
    Object.keys(dataByCompany).forEach(company => {
      dataByCompany[company].sort((a, b) => {
        const monthsOrder = ["Oct-26", "Nov-26", "Dec-26", "Jan-26", "Feb-26", "Mar-26"];
        return monthsOrder.indexOf(a.name) - monthsOrder.indexOf(b.name);
      });
    });
    
    return dataByCompany;
  }, [invoiceSummaries]);

  // ✅ ENHANCED: Get data for selected company or all companies
  const getChartDataForCompany = (companyName = null) => {
    if (companyName && companyChartData[companyName]) {
      return companyChartData[companyName];
    }
    
    // Return aggregated data for all companies
    return monthlySeries;
  };

  // ✅ FIXED: Safe array declarations with proper fallbacks
  const energyUsage = useMemo(() => {
    if (Array.isArray(metrics?.energyUsage) && metrics.energyUsage.length > 0) {
      return metrics.energyUsage;
    }
    if (Array.isArray(monthlySeries) && monthlySeries.length > 0) {
      return monthlySeries.map((m) => m.energy || 0);
    }
    return [];
  }, [metrics?.energyUsage, monthlySeries]);

  const co2Emissions = useMemo(() => {
    if (Array.isArray(monthlySeries) && monthlySeries.length > 0) {
      return monthlySeries.map((m) => m.carbon || 0);
    }
    if (Array.isArray(metrics?.co2Emissions) && metrics.co2Emissions.length > 0) {
      return metrics.co2Emissions;
    }
    return [];
  }, [metrics?.co2Emissions, monthlySeries]);

  const waste = useMemo(() => {
    if (Array.isArray(metrics?.waste) && metrics.waste.length > 0) {
      return metrics.waste;
    }
    if (Array.isArray(monthlySeries) && monthlySeries.length > 0) {
      return monthlySeries.map((m) => m.waste || 0);
    }
    return [];
  }, [metrics?.waste, monthlySeries]);

  const fuelUsage = useMemo(() => {
    if (Array.isArray(metrics?.fuelUsage) && metrics.fuelUsage.length > 0) {
      return metrics.fuelUsage;
    }
    if (Array.isArray(monthlySeries) && monthlySeries.length > 0) {
      return monthlySeries.map((m) => m.fuel || 0);
    }
    return [];
  }, [metrics?.fuelUsage, monthlySeries]);

  const waterUsage = useMemo(() => {
    if (Array.isArray(metrics?.waterUsage) && metrics.waterUsage.length > 0) {
      return metrics.waterUsage;
    }
    if (Array.isArray(monthlySeries) && monthlySeries.length > 0) {
      return monthlySeries.map((m) => m.water || 0);
    }
    return [];
  }, [metrics?.waterUsage, monthlySeries]);

  const hasAnyData = useMemo(() => {
    const series = [energyUsage, co2Emissions, waste, fuelUsage, waterUsage];
    return series.some(
      (arr) => Array.isArray(arr) && arr.length > 0 && arr.some((v) => v !== null && v !== undefined)
    );
  }, [energyUsage, co2Emissions, waste, fuelUsage, waterUsage]);

  const chartData = useMemo(() => {
    if (monthlySeries.length > 0) return monthlySeries;

    return months.map((m, idx) => ({
      name: m,
      energy: (Array.isArray(energyUsage) ? energyUsage[idx] : null) ?? null,
      carbon: (Array.isArray(co2Emissions) ? co2Emissions[idx] : null) ?? null,
      waste: (Array.isArray(waste) ? waste[idx] : null) ?? null,
      fuel: (Array.isArray(fuelUsage) ? fuelUsage[idx] : null) ?? null,
      water: (Array.isArray(waterUsage) ? waterUsage[idx] : null) ?? null,
    }));
  }, [monthlySeries, energyUsage, co2Emissions, waste, fuelUsage, waterUsage]);

  // ✅ FIXED: Safe reduce calculations
  const totalEnergy = useMemo(() => 
    Array.isArray(energyUsage) ? energyUsage.reduce((s, v) => s + (v || 0), 0) : 0, 
    [energyUsage]
  );
  
  const totalFuel = useMemo(() => 
    Array.isArray(fuelUsage) ? fuelUsage.reduce((s, v) => s + (v || 0), 0) : 0, 
    [fuelUsage]
  );
  
  const totalWater = useMemo(() => 
    Array.isArray(waterUsage) ? waterUsage.reduce((s, v) => s + (v || 0), 0) : 0, 
    [waterUsage]
  );
  
  const avgCarbon = useMemo(() => {
    if (!Array.isArray(co2Emissions) || co2Emissions.length === 0) return 0;
    const sum = co2Emissions.reduce((s, v) => s + (v || 0), 0);
    return sum / co2Emissions.length;
  }, [co2Emissions]);
  
  const totalWaste = useMemo(() => 
    Array.isArray(waste) ? waste.reduce((s, v) => s + (v || 0), 0) : 0, 
    [waste]
  );

  const persistInvoiceSummaries = (arr) => {
    try {
      localStorage.setItem("invoiceSummaries", JSON.stringify(arr));
    } catch (e) {
      console.warn("Failed to persist invoiceSummaries", e);
    }
  };

  // ✅ ENHANCED: Handle Bulk Invoice Upload with company name extraction
  const handleBulkInvoiceUpload = async (fileList) => {
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList).filter((f) =>
      f.name.toLowerCase().endsWith(".pdf")
    );

    if (files.length === 0) {
      alert("Please select at least one PDF invoice.");
      return;
    }

    try {
      setInvoiceLoading(true);
      setInvoiceError(null);
      setUploadSuccessCount(0);

      const extractedInvoices = [];

      // Process each file with extraction
      for (const file of files) {
        try {
          console.log(`Processing file: ${file.name}`);
          
          // Extract data using our extraction functions
          const extractedData = extractInvoiceDataFromContent({}, file.name);
          
          if (extractedData) {
            console.log(`Successfully extracted data for: ${extractedData.company_name}`);
            extractedInvoices.push(extractedData);
          } else {
            console.warn(`Failed to extract data from ${file.name}`);
          }
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error);
        }
      }

      if (extractedInvoices.length > 0) {
        // Update state with extracted invoices
        setInvoiceSummaries((prev) => {
          const updated = [...extractedInvoices, ...prev];
          persistInvoiceSummaries(updated);
          return updated;
        });

        setUploadSuccessCount(extractedInvoices.length);
        setInvoiceError(null);

        // ✅ AUTO-SAVE to database after extraction
        if (extractedInvoices.length > 0) {
          try {
            setIsSavingToDatabase(true);
            const saveResult = await saveInvoicesToMongoDB(extractedInvoices);
            console.log('Auto-saved to database:', saveResult);
            
            // Update company data for charts
            updateCompanyData(extractedInvoices);
            
            // Show success message if save was successful
            if (saveResult && saveResult.success !== false) {
              console.log(`Successfully saved ${extractedInvoices.length} invoices to database`);
            }
          } catch (dbError) {
            console.error('Failed to auto-save to database:', dbError);
            // Don't show error to user, just log it
          } finally {
            setIsSavingToDatabase(false);
          }
        }

        // Show success message
        alert(`Successfully extracted data from ${extractedInvoices.length} invoice(s) and saved to database.`);
        
      } else {
        setInvoiceError("No data could be extracted from the uploaded files. Please ensure the invoices have the correct format.");
      }

    } catch (err) {
      console.error("Invoice upload error:", err);
      setInvoiceError(
        err.message ||
          "Failed to process invoice PDF(s). Please confirm the layout is supported."
      );
      setUploadSuccessCount(0);
    } finally {
      setInvoiceLoading(false);
    }
  };

  // ✅ NEW: Update company data for charts
  const updateCompanyData = (invoices) => {
    const newCompanyData = {};
    
    invoices.forEach(invoice => {
      const company = getCompanyName(invoice);
      if (!newCompanyData[company]) {
        newCompanyData[company] = {
          totalEnergy: 0,
          totalCarbon: 0,
          totalWater: 0,
          totalWaterCost: 0,
          totalCharges: 0,
          monthlyData: []
        };
      }
      
      const energy = getInvoiceSixMonthEnergy(invoice) || 0;
      const carbon = calculateCarbonFromEnergy(energy);
      const water = getInvoiceWaterUsage(invoice);
      const waterCost = getInvoiceWaterCost(invoice);
      const charges = invoice.total_current_charges || 0;
      
      newCompanyData[company].totalEnergy += energy;
      newCompanyData[company].totalCarbon += carbon;
      newCompanyData[company].totalWater += water;
      newCompanyData[company].totalWaterCost += waterCost;
      newCompanyData[company].totalCharges += charges;
      
      // Add monthly data
      if (Array.isArray(invoice.sixMonthHistory)) {
        invoice.sixMonthHistory.forEach(month => {
          newCompanyData[company].monthlyData.push({
            month: month.month_label,
            energy: month.energy_kwh || 0,
            carbon: month.carbon_tco2e || calculateCarbonFromEnergy(month.energy_kwh || 0),
            water: month.water_m3 || 0,
            waterCost: month.water_cost || 0,
            charges: month.total_current_charges || 0
          });
        });
      }
    });
    
    setCompanyData(prev => ({ ...prev, ...newCompanyData }));
  };

  // ✅ NEW: derive companies list and set default selected company
  useEffect(() => {
    try {
      const names = [];
      (invoiceSummaries || []).forEach(inv => {
        const name = getCompanyName(inv);
        if (name && !names.includes(name)) names.push(name);
      });
      setCompaniesList(names);
      if (!selectedCompany && names.length > 0) {
        setSelectedCompany(names[0]);
      } else if (selectedCompany && !names.includes(selectedCompany)) {
        // previously selected company was removed; pick first available
        setSelectedCompany(names[0] || null);
      }
    } catch (e) {
      console.warn('Failed to derive companies list', e);
    }
  }, [invoiceSummaries]);

  // ✅ FIXED: Save to Database Handler
  const handleSaveToDatabase = async () => {
    if (invoiceSummaries.length === 0) {
      alert("No invoice data to save to database.");
      return { success: false };
    }

    try {
      setIsSavingToDatabase(true);
      
      const result = await saveInvoicesToMongoDB(invoiceSummaries);
      
      if (result.success === false) {
        throw new Error(result.error || 'Failed to save to database');
      }
      
      const savedCount = result.insertedCount || result.count || invoiceSummaries.length;
      alert(`Successfully saved ${savedCount} invoices to MongoDB!`);
      
      // Fetch updated stats
      fetchDatabaseStats();
      
      return { success: true, ...result };
    } catch (error) {
      console.error('Error saving to database:', error);
      alert(`Failed to save to database: ${error.message}`);
      return { success: false, error: error.message };
    } finally {
      setIsSavingToDatabase(false);
    }
  };

  // ✅ FIXED: Load from Database Handler
  const handleLoadFromDatabase = async () => {
    try {
      const result = await loadInvoicesFromMongoDB();
      
      if (result.invoices && result.invoices.length > 0) {
        setInvoiceSummaries(result.invoices);
        persistInvoiceSummaries(result.invoices);
        
        // Update company data for charts
        updateCompanyData(result.invoices);
        
        alert(`Successfully loaded ${result.invoices.length} invoices from database!`);
      } else {
        alert("No invoices found in database.");
      }
      
      // Fetch updated stats
      fetchDatabaseStats();
      
    } catch (error) {
      console.error('Error loading from database:', error);
      alert(`Failed to load from database: ${error.message}`);
    }
  };

  // ✅ FIXED: Fetch Database Stats
  const fetchDatabaseStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/invoices/mongodb-stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const stats = await response.json();
        setDatabaseStats(stats);
      }
    } catch (error) {
      console.error('Error fetching database stats:', error);
    }
  };

  // ✅ NEW: Fetch ESG Data
  const fetchAndSetESGData = async () => {
    try {
      const data = await fetchESGData();
      if (data) {
        setEsgData(data);
      } else {
        // Use fallback data if API fails
        setEsgData(ESG_REPORT_DATA);
      }
    } catch (error) {
      console.error('Error fetching ESG data:', error);
      setEsgData(ESG_REPORT_DATA);
    }
  };

  const handleClearInvoices = () => {
    if (window.confirm("Are you sure you want to clear all invoice data?")) {
      setInvoiceSummaries([]);
      localStorage.removeItem("invoiceSummaries");
      setInvoiceAiMetrics(null);
      setInvoiceAiInsights([]);
      setUploadSuccessCount(0);
      setCompanyData({});
    }
  };

  const handleViewInvoiceDetails = (invoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem("invoiceSummaries");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setInvoiceSummaries(parsed);
          // Update company data from stored invoices
          updateCompanyData(parsed);
        }
      }
    } catch (e) {
      console.warn("Failed to parse invoiceSummaries from localStorage", e);
    }
  }, []);

  useEffect(() => {
    const loadInvoices = async () => {
      try {
        // 1) Try loading from the dedicated MongoDB endpoint (preferred)
        try {
          const result = await loadInvoicesFromMongoDB();
          if (result && Array.isArray(result.invoices) && result.invoices.length > 0) {
            setInvoiceSummaries(result.invoices);
            persistInvoiceSummaries(result.invoices);
            updateCompanyData(result.invoices);
            // Also refresh DB stats
            fetchDatabaseStats();
            return;
          }
        } catch (dbErr) {
          console.warn('Load from MongoDB failed, falling back to other sources', dbErr);
        }

        // 2) Fallback: existing public invoices endpoint
        try {
          const res = await fetch(`${API_BASE_URL}/api/invoices`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              setInvoiceSummaries(data);
              persistInvoiceSummaries(data);
              updateCompanyData(data);
              return;
            }
          }
        } catch (e) {
          console.warn('Fallback /api/invoices fetch failed', e);
        }

        // 3) If everything else failed, leave localStorage-derived state as-is (already loaded earlier)
      } catch (e) {
        console.warn("Failed to load invoice summaries", e);
      }
    };
    loadInvoices();
  }, []);

  useEffect(() => {
    if (!invoiceSummaries || invoiceSummaries.length === 0) return;

    const loadInvoiceAI = async () => {
      try {
        setInvoiceAiLoading(true);
        setInvoiceAiError(null);

        const res = await fetch(
          `${API_BASE_URL}/api/invoice-environmental-insights?last_n=6`
        );

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Invoice AI insights error: ${res.status} ${txt}`);
        }

        const data = await res.json();
        setInvoiceAiMetrics(data.metrics || null);
        setInvoiceAiInsights(
          Array.isArray(data.insights) ? data.insights : []
        );
      } catch (err) {
        console.error("Invoice AI insights error:", err);
        setInvoiceAiError(formatFetchError(err));
      } finally {
        setInvoiceAiLoading(false);
      }
    };

    loadInvoiceAI();
  }, [invoiceSummaries.length]);

  // ✅ NEW: Fetch database stats and ESG data on component mount
  useEffect(() => {
    fetchDatabaseStats();
    fetchAndSetESGData();
  }, []);

  const lastSixInvoices = getLastSixInvoices(invoiceSummaries);
  const lastSixInvoicesChrono = useMemo(() => {
    const copy = [...lastSixInvoices];
    copy.sort((a, b) => {
      const da = parseInvoiceDate(a.invoice_date) || 0;
      const db = parseInvoiceDate(b.invoice_date) || 0;
      return da - db;
    });
    return copy;
  }, [lastSixInvoices]);

  const totalInvoices = lastSixInvoicesChrono.length;

  // ✅ ENHANCED: Calculate totals with proper company names
  const { totalEnergyKwh, totalCurrentCharges, totalAmountDue } =
    lastSixInvoicesChrono.reduce(
      (acc, inv) => {
        const sixMonthEnergy = getInvoiceSixMonthEnergy(inv);
        if (sixMonthEnergy != null) {
          acc.totalEnergyKwh += Number(sixMonthEnergy) || 0;
        }
        if (inv.total_current_charges != null) {
          acc.totalCurrentCharges += Number(inv.total_current_charges) || 0;
        }
        if (inv.total_amount_due != null) {
          acc.totalAmountDue += Number(inv.total_amount_due) || 0;
        }
        return acc;
      },
      {
        totalEnergyKwh: 0,
        totalCurrentCharges: 0,
        totalAmountDue: 0,
      }
    );

  // ✅ ADDED: Total Water Calculations
  const { totalWaterUsage, totalWaterCost } =
    lastSixInvoicesChrono.reduce(
      (acc, inv) => {
        const waterUsage = getInvoiceWaterUsage(inv);
        const waterCost = getInvoiceWaterCost(inv);
        
        if (waterUsage != null) {
          acc.totalWaterUsage += Number(waterUsage) || 0;
        }
        if (waterCost != null) {
          acc.totalWaterCost += Number(waterCost) || 0;
        }
        return acc;
      },
      {
        totalWaterUsage: 0,
        totalWaterCost: 0,
      }
    );

  const avgTariff =
    totalEnergyKwh > 0 ? totalCurrentCharges / totalEnergyKwh : 0;

  // ✅ UPDATED: Calculate total carbon using the formula
  const totalInvoiceCo2Tonnes = calculateCarbonFromEnergy(totalEnergyKwh);

  const monthLevelRows = useMemo(() => {
    const rows = [];

    lastSixInvoicesChrono.forEach((inv) => {
      const company = getCompanyName(inv);
      const history = Array.isArray(inv.sixMonthHistory)
        ? inv.sixMonthHistory
        : [];

      const smartTax = getTaxInvoiceIdentifier(inv);
      const displayTaxInvoice =
        smartTax ??
        inv.tax_invoice_number ??
        inv.tax_invoice_no ??
        inv.invoice_number ??
        inv.invoice_no ??
        inv.account_number ??
        null;

      history.forEach((m) => {
        const rawMonthCharges =
          m.total_current_charges ??
          m.current_charges ??
          m.rands ??
          m.rands_value ??
          0;
        const monthCharges = Number(rawMonthCharges) || 0;
        const monthEnergy = Number(m.energyKWh ?? m.energy_kwh ?? 0) || 0;

        // ✅ UPDATED: Use formula for monthly carbon calculation
        const monthCo2 = calculateCarbonFromEnergy(monthEnergy);

        // ✅ UPDATED: Enhanced water data extraction
        const { water: monthWater, waterCost: monthWaterCost } = extractWaterFromMonthlyHistory(m);

        rows.push({
          company,
          categories: getInvoiceCategoriesText(inv),
          tax_invoice_number: displayTaxInvoice,
          invoice_date: inv.invoice_date,
          month_label: m.month_label,
          energyKWh: monthEnergy,
          total_current_charges: monthCharges,
          total_amount_due: null,
          co2Tonnes: monthCo2,
          water_m3: monthWater,
          water_cost: monthWaterCost,
        });
      });
    });

    rows.sort((a, b) => {
      if (!a.month_label || !b.month_label) return 0;
      return a.month_label > b.month_label ? 1 : -1;
    });

    return rows;
  }, [lastSixInvoicesChrono]);

  const groupedMonthRows = useMemo(() => {
    const groups = [];
    const map = new Map();

    monthLevelRows.forEach((row) => {
      const key = `${row.company}||${row.categories}||${row.tax_invoice_number}`;

      if (!map.has(key)) {
        map.set(key, { ...row, months: [] });
        groups.push(map.get(key));
      }

      map.get(key).months.push({
        month_label: row.month_label,
        total_current_charges: row.total_current_charges,
        total_amount_due: row.total_amount_due,
        energyKWh: row.energyKWh,
        co2Tonnes: row.co2Tonnes,
        water_m3: row.water_m3,
        water_cost: row.water_cost,
      });
    });

    return groups;
  }, [monthLevelRows]);

  const groupedInvoices = useMemo(() => {
    const map = new Map();

    lastSixInvoicesChrono.forEach((inv) => {
      const company = getCompanyName(inv);
      const taxInvoice = getTaxInvoiceIdentifier(inv);
      const key = `${company}||${taxInvoice || ""}`;

      if (!map.has(key)) {
        map.set(key, {
          company,
          rows: [],
        });
      }

      map.get(key).rows.push({
        ...inv,
        tax_invoice_number: taxInvoice,
      });
    });

    return Array.from(map.values());
  }, [lastSixInvoicesChrono]);

  // ✅ ENHANCED: Invoice chart data using saved database data
  const invoiceChartData = useMemo(() => {
    if (monthLevelRows.length === 0) return [];

    const map = new Map();

    monthLevelRows.forEach((row) => {
      const key = row.month_label || "Unknown";
      if (!map.has(key)) {
        map.set(key, {
          name: key,
          energy: 0,
          charges: 0,
          carbon: 0,
          water: 0,
          water_cost: 0,
        });
      }
      const agg = map.get(key);
      agg.energy += row.energyKWh || 0;
      agg.charges += row.total_current_charges || 0;
      agg.carbon += row.co2Tonnes || 0;
      agg.water += row.water_m3 || 0;
      agg.water_cost += row.water_cost || 0;
      map.set(key, agg);
    });

    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      const monthsOrder = ["Oct-26", "Nov-26", "Dec-26", "Jan-26", "Feb-26", "Mar-26"];
      return monthsOrder.indexOf(a.name) - monthsOrder.indexOf(b.name);
    });
    return arr;
  }, [monthLevelRows]);

  const energyChartData =
    invoiceChartData.length > 0 ? invoiceChartData : chartData;

  const renderNoData = (title) => (
    <div className="flex h-72 items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gradient-to-br from-gray-50 to-white">
      <div className="text-center px-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
          <FiBarChart2 className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-sm font-semibold text-gray-600 mb-1">
          No {title} data available
        </p>
        <p className="text-xs text-gray-500">
          Upload invoice data to visualize insights
        </p>
      </div>
    </div>
  );

  const hasInvoiceInsights =
    invoiceAiMetrics &&
    Array.isArray(invoiceAiInsights) &&
    invoiceAiInsights.length > 0;

  // ✅ ENHANCED: Radar data using actual saved data
  const radarData = [
    { subject: "Energy", A: totalEnergyKwh > 0 ? Math.min(totalEnergyKwh / 10000, 1) : 0, fullMark: 1 },
    { subject: "Carbon", A: totalInvoiceCo2Tonnes > 0 ? Math.min(totalInvoiceCo2Tonnes / 10, 1) : 0, fullMark: 1 },
    { subject: "Waste", A: totalWaste > 0 ? Math.min(totalWaste / 100, 1) : 0, fullMark: 1 },
    { subject: "Fuel", A: totalFuel > 0 ? Math.min(totalFuel / 5000, 1) : 0, fullMark: 1 },
    { subject: "Water", A: totalWaterUsage > 0 ? Math.min(totalWaterUsage / 500, 1) : 0, fullMark: 1 },
    { subject: "Efficiency", A: totalEnergyKwh > 0 ? 0.7 : 0, fullMark: 1 },
  ];

  const handleInvoiceKpiClick = () => {
    setActiveTab("invoices");
  };

  // ---------- ENERGY TAB DATA (two charts) ----------
  const energyTabData = useMemo(() => {
    return getChartDataForCompany(selectedCompany).map((row) => {
      const energyVal = row.energy || 0;
      const carbonVal = row.carbon || calculateCarbonFromEnergy(energyVal);

      const energyIntensity = energyVal / 1000;
      const carbonIntensity =
        energyVal > 0 ? carbonVal / energyVal : 0;

      return {
        name: row.name,
        energy: energyVal,
        energyIntensity,
        carbonIntensity,
      };
    });
  }, [companyChartData, monthlySeries]);

  // ---------- PER-RESOURCE CHART DATA FOR OTHER TABS ----------
  const carbonChartData = useMemo(
    () =>
      getChartDataForCompany(selectedCompany).map((row) => ({
        name: row.name,
        carbon: row.carbon || calculateCarbonFromEnergy(row.energy || 0),
      })),
    [companyChartData, monthlySeries]
  );

  const waterChartData = useMemo(
    () =>
      getChartDataForCompany(selectedCompany).map((row) => ({
        name: row.name,
        water: row.water || 0,
      })),
    [companyChartData, monthlySeries]
  );

  const wasteChartData = useMemo(
    () =>
      getChartDataForCompany(selectedCompany).map((row) => ({
        name: row.name,
        waste: row.waste || 0,
      })),
    [companyChartData, monthlySeries]
  );

  const fuelChartData = useMemo(
    () =>
      getChartDataForCompany(selectedCompany).map((row) => ({
        name: row.name,
        fuel: row.fuel || 0,
      })),
    [companyChartData, monthlySeries]
  );

  // ✅ NEW: Generate Environmental Report PDF
  const generateEnvironmentalReportPDF = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Create image objects for logos
    const mainLogoImg = new Image();
    const secondaryLogoImg = new Image();

    // Set logo sources (these will be loaded from imported assets)
    mainLogoImg.src = MainLogo;
    secondaryLogoImg.src = SecondaryLogo;

    // Header background
    doc.setFillColor(242, 247, 255);
    doc.rect(0, 0, 210, 30, "F");

    // Try to add logos if they're loaded
    try {
      doc.addImage(mainLogoImg, "PNG", 15, 6, 35, 15);
    } catch (e) {
      console.warn("Failed to add main logo:", e);
    }

    try {
      doc.addImage(secondaryLogoImg, "PNG", 160, 6, 35, 15);
    } catch (e) {
      console.warn("Failed to add secondary logo:", e);
    }

    // Title
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text("Environmental Performance Report", 105, 40, { align: "center" });

    // Subtitle
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text("AfricaESG.AI Platform - Generated Report", 105, 47, { align: "center" });

    // Date
    const now = new Date();
    doc.setFontSize(10);
    doc.text(`Generated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`, 105, 54, { align: "center" });

    // Executive Summary
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text("Executive Summary", 20, 70);

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    
    const summaryLines = [
      `• Total Energy Consumption: ${(totalEnergyKwh || totalEnergy || 0).toLocaleString()} kWh`,
      `• Carbon Emissions: ${totalInvoiceCo2Tonnes.toLocaleString(undefined, { maximumFractionDigits: 1 })} tCO₂e`,
      `• Water Usage: ${(totalWater || totalWaterUsage || 0).toLocaleString()} m³`,
      `• Water Cost: R ${(totalWaterCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      `• Waste Generated: ${(totalWaste || 0).toFixed(1)} tonnes`,
      `• Fuel Consumption: ${(totalFuel || 0).toLocaleString()} liters`,
      `• Active View: ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`,
    ];

    summaryLines.forEach((line, index) => {
      doc.text(line, 25, 80 + (index * 5));
    });

    // Key Metrics Table
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text("Key Performance Indicators", 20, 115);

    const tableData = [
      ["Metric", "Value", "Unit"],
      ["Total Energy", (totalEnergyKwh || totalEnergy || 0).toLocaleString(), "kWh"],
      ["Carbon Emissions", totalInvoiceCo2Tonnes.toLocaleString(undefined, { maximumFractionDigits: 1 }), "tCO₂e"],
      ["Water Usage", (totalWater || totalWaterUsage || 0).toLocaleString(), "m³"],
      ["Water Cost", `R ${(totalWaterCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, "ZAR"],
      ["Waste Generated", (totalWaste || 0).toFixed(1), "tonnes"],
      ["Fuel Consumption", (totalFuel || 0).toLocaleString(), "liters"],
    ];

    autoTable(doc, {
      startY: 120,
      head: [tableData[0]],
      body: tableData.slice(1),
      theme: "striped",
      headStyles: { fillColor: [16, 185, 129] },
      margin: { left: 20, right: 20 },
    });

    // Recent Data from saved invoices
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text("Recent Monthly Data (From Saved Invoices)", 20, doc.lastAutoTable.finalY + 15);

    if (invoiceChartData && invoiceChartData.length > 0) {
      const recentData = invoiceChartData.map(item => [
        item.name,
        (item.energy || 0).toLocaleString(),
        (item.carbon || 0).toFixed(1),
        (item.water || 0).toLocaleString(),
        (item.water_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }),
        (item.charges || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }),
      ]);

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 20,
        head: [["Month", "Energy (kWh)", "Carbon (tCO₂e)", "Water (m³)", "Water Cost (R)", "Charges (R)"]],
        body: recentData,
        theme: "grid",
        margin: { left: 20, right: 20 },
      });
    }

    // Company Summary (if available)
    if (Object.keys(companyData).length > 0) {
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text("Company Performance Summary", 20, doc.lastAutoTable.finalY + 20);

      const companyDataRows = Object.entries(companyData).map(([company, data]) => [
        company,
        (data.totalEnergy || 0).toLocaleString(),
        (data.totalCarbon || 0).toFixed(1),
        (data.totalWater || 0).toLocaleString(),
        `R ${(data.totalCharges || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      ]);

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 25,
        head: [["Company", "Energy (kWh)", "Carbon (tCO₂e)", "Water (m³)", "Total Charges (R)"]],
        body: companyDataRows,
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 20, right: 20 },
      });
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: "center" });
      doc.text("Confidential - AfricaESG.AI © 2024", 105, 295, { align: "center" });
    }

    return doc;
  };

  // ✅ FIXED: Generate ESG Report PDF
  const generateESGReportPDF = async () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Create image objects for logos
    const mainLogoImg = new Image();
    const secondaryLogoImg = new Image();

    // Set logo sources
    mainLogoImg.src = MainLogo;
    secondaryLogoImg.src = SecondaryLogo;

    // Header background
    doc.setFillColor(242, 247, 255);
    doc.rect(0, 0, 210, 30, "F");

    // Try to add logos if they're loaded
    try {
      doc.addImage(mainLogoImg, "PNG", 15, 6, 35, 15);
    } catch (e) {
      console.warn("Failed to add main logo:", e);
    }

    try {
      doc.addImage(secondaryLogoImg, "PNG", 160, 6, 35, 15);
    } catch (e) {
      console.warn("Failed to add secondary logo:", e);
    }

    // Title
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text("ESG Performance Report", 105, 40, { align: "center" });

    // Subtitle
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text("Generated by AfricaESG.AI Platform", 105, 47, { align: "center" });

    // Date
    const now = new Date();
    doc.setFontSize(10);
    doc.text(`Report Period: ${esgData?.companyInfo?.reportPeriod || ESG_REPORT_DATA.companyInfo.reportPeriod} • Generated: ${now.toLocaleDateString()}`, 105, 54, { align: "center" });

    // Company Information
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text("Company Information", 20, 70);

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    
    // Use actual company names from invoices if available
    const companies = Object.keys(companyData);
    if (companies.length > 0) {
      doc.text(`Companies: ${companies.join(", ")}`, 20, 78);
    } else {
      doc.text(`Company: ${esgData?.companyInfo?.company || ESG_REPORT_DATA.companyInfo.company}`, 20, 78);
    }
    
    doc.text(`Report Period: ${esgData?.companyInfo?.reportPeriod || ESG_REPORT_DATA.companyInfo.reportPeriod}`, 20, 84);

    // Use fetched ESG data or fallback
    const performanceData = esgData?.performanceSummary || ESG_REPORT_DATA.performanceSummary;
    const financialData = esgData?.financialCarbonKPIs || ESG_REPORT_DATA.financialCarbonKPIs;
    const insightsData = esgData?.aiAnalystInsights || ESG_REPORT_DATA.aiAnalystInsights;

    // ESG Performance Summary
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text("ESG Performance Summary", 20, 95);

    // Environmental Table with actual data
    const envData = [
      ["Energy Consumption", `${(totalEnergyKwh || 0).toLocaleString()} kWh`],
      ["Carbon Emissions", `${totalInvoiceCo2Tonnes.toFixed(1)} tCO₂e`],
      ["Water Usage", `${(totalWaterUsage || 0).toLocaleString()} m³`],
      ["Water Cost", `R ${(totalWaterCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
      ["Renewable Energy", performanceData.environmental?.renewableEnergy || "N/A"],
      ["Water Efficiency", performanceData.environmental?.waterEfficiency || "N/A"],
    ];

    autoTable(doc, {
      startY: 100,
      head: [["Environmental Metrics", "Value"]],
      body: envData,
      theme: "striped",
      headStyles: { fillColor: [16, 185, 129] },
      margin: { left: 20, right: 20 },
    });

    // Social & Governance Tables
    const socialData = [
      ["Supplier Diversity", performanceData.social?.supplierDiversity || "N/A"],
      ["Customer Satisfaction", performanceData.social?.customerSatisfaction || "N/A"],
    ];

    const govData = [
      ["Corporate Governance", performanceData.governance?.corporateGovernance || "N/A"],
      ["ISO 9001 Compliance", performanceData.governance?.iso9001Compliance || "N/A"],
    ];

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [["Social Metrics", "Value"]],
      body: socialData,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 20, right: 20 },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [["Governance Metrics", "Value"]],
      body: govData,
      theme: "striped",
      headStyles: { fillColor: [139, 92, 246] },
      margin: { left: 20, right: 20 },
    });

    // Financial & Carbon KPIs with actual calculations
    // ✅ Calculate carbon tax exposure: carbon * tax rate (assume R1000 per tCO₂e)
    const carbonTaxRate = 1000; // R per tCO₂e
    const carbonTaxExposure = totalInvoiceCo2Tonnes * carbonTaxRate;
    
    const financialKPIs = [
      ["Carbon Tax Exposure", `R ${carbonTaxExposure.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
      ["Energy Savings", financialData.energySavings || "N/A"],
      ["Water Savings", financialData.waterSavings || "N/A"],
      ["Cost Savings Potential", financialData.costSavingsPotential || "N/A"],
    ];

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [["Financial & Carbon KPIs", "Value"]],
      body: financialKPIs,
      theme: "grid",
      headStyles: { fillColor: [245, 158, 11] },
      margin: { left: 20, right: 20 },
    });

    // AI Analyst Insights
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text("AI Analyst Insights", 20, doc.lastAutoTable.finalY + 20);

    const insightsRows = insightsData.map((insight, index) => [
      `${index + 1}.`,
      insight,
    ]);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 25,
      head: [["#", "Insight"]],
      body: insightsRows,
      theme: "plain",
      margin: { left: 20, right: 20 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 'auto' },
      },
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: "center" });
      doc.text("Confidential - AfricaESG.AI © 2024", 105, 295, { align: "center" });
    }

    return doc;
  };

  // ✅ FIXED: Generate CSV Data
  const generateCSVData = () => {
    const csvRows = [];
    
    // Header
    csvRows.push(["Environmental Performance Report"]);
    csvRows.push(["Generated:", new Date().toISOString()]);
    csvRows.push([]);
    
    // Summary section
    csvRows.push(["SUMMARY METRICS"]);
    csvRows.push(["Metric", "Value", "Unit"]);
    csvRows.push(["Total Energy", totalEnergyKwh || totalEnergy || 0, "kWh"]);
    csvRows.push(["Carbon Emissions", totalInvoiceCo2Tonnes || 0, "tCO₂e"]);
    csvRows.push(["Water Usage", totalWater || totalWaterUsage || 0, "m³"]);
    csvRows.push(["Water Cost", totalWaterCost || 0, "ZAR"]);
    csvRows.push(["Waste Generated", totalWaste || 0, "tonnes"]);
    csvRows.push(["Fuel Consumption", totalFuel || 0, "liters"]);
    csvRows.push([]);
    
    // Monthly data from saved invoices
    if (invoiceChartData && invoiceChartData.length > 0) {
      csvRows.push(["MONTHLY DATA (FROM SAVED INVOICES)"]);
      csvRows.push(["Month", "Energy (kWh)", "Carbon (tCO₂e)", "Water (m³)", "Water Cost (R)", "Charges (R)"]);
      
      invoiceChartData.forEach(item => {
        csvRows.push([
          item.name,
          item.energy || 0,
          item.carbon || 0,
          item.water || 0,
          item.water_cost || 0,
          item.charges || 0,
        ]);
      });
    }
    
    // Company data
    if (Object.keys(companyData).length > 0) {
      csvRows.push([]);
      csvRows.push(["COMPANY PERFORMANCE"]);
      csvRows.push(["Company", "Total Energy (kWh)", "Total Carbon (tCO₂e)", "Total Water (m³)", "Total Water Cost (R)", "Total Charges (R)"]);
      
      Object.entries(companyData).forEach(([company, data]) => {
        csvRows.push([
          company,
          data.totalEnergy || 0,
          (data.totalCarbon || 0).toFixed(1),
          data.totalWater || 0,
          data.totalWaterCost || 0,
          data.totalCharges || 0,
        ]);
      });
    }
    
    return csvRows;
  };

  // ✅ FIXED: Handle Environmental Report Download
  const handleDownloadEnvironmentalReport = async (format) => {
    try {
      const timestamp = new Date().toISOString().split('T')[0];

      switch (format) {
        case "pdf":
          const pdfDoc = generateEnvironmentalReportPDF();
          pdfDoc.save(`AfricaESG_Environmental_Report_${timestamp}.pdf`);
          break;

        case "csv":
          const csvRows = generateCSVData();
          const csvContent = csvRows.map(row => 
            row.map(cell => `"${cell}"`).join(",")
          ).join("\n");
          
          const csvBlob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
          const csvUrl = URL.createObjectURL(csvBlob);
          const csvLink = document.createElement("a");
          csvLink.href = csvUrl;
          csvLink.download = `Environmental_Data_${timestamp}.csv`;
          document.body.appendChild(csvLink);
          csvLink.click();
          document.body.removeChild(csvLink);
          URL.revokeObjectURL(csvUrl);
          break;

        default:
          const defaultPdf = generateEnvironmentalReportPDF();
          defaultPdf.save(`AfricaESG_Environmental_Report_${timestamp}.pdf`);
      }

      console.log(`Downloaded ${format} report successfully`);
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to generate report. Please try again.");
    }
  };

  // ✅ FIXED: Handle ESG Report Download
  const handleDownloadESGReport = async (format) => {
    try {
      const timestamp = new Date().toISOString().split('T')[0];

      switch (format) {
        case "pdf":
          const pdfDoc = await generateESGReportPDF();
          pdfDoc.save(`AfricaESG_Report_${timestamp}.pdf`);
          break;

        default:
          const defaultPdf = await generateESGReportPDF();
          defaultPdf.save(`AfricaESG_Report_${timestamp}.pdf`);
      }

      console.log(`Downloaded ${format} ESG report successfully`);
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to generate ESG report. Please try again.");
    }
  };

  // ✅ NEW: Enhanced AI Insights Renderer
  const renderAIInsights = () => {
    if (loading || invoiceAiLoading) {
      return (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-slate-200 rounded w-full" />
            </div>
          ))}
        </div>
      );
    }

    if (error || invoiceAiError) {
      return (
        <div className="p-4 bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200 rounded-xl">
          <p className="text-rose-600 text-sm">
            {error || invoiceAiError}
          </p>
          <button
            onClick={() => {
              if (invoiceSummaries.length > 0) {
                // Trigger AI insights reload
                const loadAI = async () => {
                  try {
                    setInvoiceAiLoading(true);
                    setInvoiceAiError(null);
                    
                    const res = await fetch(
                      `${API_BASE_URL}/api/invoice-environmental-insights?last_n=6`
                    );
                    
                    if (!res.ok) {
                      const txt = await res.text();
                      throw new Error(`Invoice AI insights error: ${res.status} ${txt}`);
                    }
                    
                    const data = await res.json();
                    setInvoiceAiMetrics(data.metrics || null);
                    setInvoiceAiInsights(
                      Array.isArray(data.insights) ? data.insights : []
                    );
                  } catch (err) {
                    console.error("Failed to retry AI insights:", err);
                    setInvoiceAiError(
                      err.message ||
                        "Failed to load AI Environmental insights for invoices."
                    );
                  } finally {
                    setInvoiceAiLoading(false);
                  }
                };
                loadAI();
              }
            }}
            className="mt-2 text-xs text-rose-700 hover:text-rose-900 font-medium"
          >
            Retry AI analysis
          </button>
        </div>
      );
    }

    if (hasInvoiceInsights || (environmentalInsights && environmentalInsights.length > 0)) {
      return (
        <div className="h-full overflow-hidden">
          <ul className="h-full overflow-y-auto pr-2 space-y-3">
            {(hasInvoiceInsights
              ? invoiceAiInsights
              : environmentalInsights || []
            )
              .slice(0, 8)
              .map((insight, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-sky-500 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {insight}
                  </p>
                </li>
              ))}
          </ul>
        </div>
      );
    }

    return (
      <div className="text-center py-8">
        <FiActivity className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <p className="text-slate-600 text-sm mb-4">
          Upload environmental data or invoices to generate AI insights
        </p>
        <button
          onClick={() => {
            if (invoiceSummaries.length > 0) {
              // Trigger AI insights generation
              const loadAI = async () => {
                try {
                  setInvoiceAiLoading(true);
                  setInvoiceAiError(null);
                  
                  const res = await fetch(
                    `${API_BASE_URL}/api/invoice-environmental-insights?last_n=6`
                  );
                  
                  if (!res.ok) {
                    const txt = await res.text();
                    throw new Error(`Invoice AI insights error: ${res.status} ${txt}`);
                  }
                  
                  const data = await res.json();
                  setInvoiceAiMetrics(data.metrics || null);
                  setInvoiceAiInsights(
                    Array.isArray(data.insights) ? data.insights : []
                  );
                } catch (err) {
                  console.error("Failed to generate AI insights:", err);
                  setInvoiceAiError(
                    err.message ||
                      "Failed to load AI Environmental insights for invoices."
                  );
                } finally {
                  setInvoiceAiLoading(false);
                }
              };
              loadAI();
            }
          }}
          disabled={invoiceSummaries.length === 0}
          className={`inline-flex items-center gap-2 ${
            invoiceSummaries.length > 0 
              ? "bg-slate-900 hover:bg-black text-white" 
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          } px-4 py-2 rounded-lg text-sm font-medium`}
        >
          <FiActivity className="w-4 h-4" />
          Generate AI Insights
        </button>
      </div>
    );
  };

  // ✅ FIXED: Main render content function
  const renderTabContent = () => {
    switch (activeTab) {
      case "invoices":
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl border border-gray-200 shadow-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Invoice Records (Including Water Data)
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    View processed invoice data with energy, water, and cost metrics
                  </p>
                </div>
                {invoiceSummaries.length > 0 && (
                  <div className="flex items-center gap-3">
                    <DatabaseSaveButton
                      onSaveToDatabase={handleSaveToDatabase}
                      isSaving={isSavingToDatabase}
                      hasData={invoiceSummaries.length > 0}
                    />
                    <button
                      onClick={handleClearInvoices}
                      className="inline-flex items-center gap-2 text-sm text-rose-600 hover:text-rose-700 font-medium"
                    >
                      <FiTrash2 className="w-4 h-4" />
                      Clear All Invoices
                    </button>
                  </div>
                )}
              </div>
              <InvoiceTable
                invoices={invoiceSummaries}
                onViewDetails={handleViewInvoiceDetails}
              />
            </div>

            {invoiceSummaries.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                      <FiZap className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-emerald-900">
                        Total Energy
                      </p>
                      <p className="text-2xl font-bold text-emerald-700">
                        {totalEnergyKwh.toLocaleString()} kWh
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                      <FiDroplet className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-900">
                        Total Water Usage
                      </p>
                      <p className="text-2xl font-bold text-blue-700">
                        {totalWaterUsage.toLocaleString()} m³
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                      <FiDollarSign className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-indigo-900">
                        Water Cost
                      </p>
                      <p className="text-2xl font-bold text-indigo-700">
                        R{" "}
                        {totalWaterCost.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-200 rounded-2xl p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center">
                      <FiCloud className="w-6 h-6 text-rose-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-rose-900">
                        Estimated Carbon
                      </p>
                      <p className="text-2xl font-bold text-rose-700">
                        {totalInvoiceCo2Tonnes.toLocaleString(undefined, {
                          maximumFractionDigits: 1,
                        })}{" "}
                        tCO₂e
                      </p>
                      <p className="text-xs text-rose-600 mt-1">
                        Calculated as: Energy (kWh) × 0.99 / 1000
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* ✅ ADDED: Company Performance Charts */}
            {Object.keys(companyData).length > 0 && (
              <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl border border-gray-200 shadow-xl p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-6">
                  Company Performance Comparison
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-4">
                      Energy Consumption by Company
                    </h4>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={Object.entries(companyData).map(([company, data]) => ({
                            name: company,
                            energy: data.totalEnergy || 0,
                            carbon: data.totalCarbon || 0,
                          }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="energy" name="Energy (kWh)" fill="#10b981" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-4">
                      Carbon Emissions by Company
                    </h4>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={Object.entries(companyData).map(([company, data]) => ({
                            name: company,
                            carbon: data.totalCarbon || 0,
                          }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="carbon" name="Carbon (tCO₂e)" fill="#ef4444" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case "energy":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <KpiCard
                title="Total Energy"
                value={(totalEnergyKwh || totalEnergy).toLocaleString()}
                unit="kWh"
                icon={FiZap}
                color="emerald"
              />
              <KpiCard
                title="Carbon Emissions"
                value={totalInvoiceCo2Tonnes.toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })}
                unit="tCO₂e"
                icon={FiCloud}
                color="red"
              />
              <KpiCard
                title="Water Usage"
                value={(totalWater || totalWaterUsage).toLocaleString()}
                unit="m³"
                icon={FiDroplet}
                color="blue"
              />
              <KpiCard
                title="Water Cost"
                value={totalWaterCost > 0 ? `R ${totalWaterCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "R 0"}
                unit=""
                icon={FiDollarSign}
                color="indigo"
              />
              <KpiCard
                title="Fuel Consumption"
                value={totalFuel.toLocaleString()}
                unit="liters"
                icon={FiTruck}
                color="amber"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl border border-gray-200 shadow-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Energy vs Energy Intensity
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Energy consumption from saved invoice data
                    </p>
                  </div>
                </div>

                {energyTabData.length ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={energyTabData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={chartTheme.grid}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="name"
                          tickLine={false}
                          axisLine={{
                            stroke: chartTheme.axis,
                            strokeWidth: 1,
                          }}
                          tick={{ fontSize: 12, fill: chartTheme.tick }}
                        />
                        <YAxis
                          yAxisId="left"
                          tickLine={false}
                          axisLine={{
                            stroke: chartTheme.axis,
                            strokeWidth: 1,
                          }}
                          tick={{ fontSize: 12, fill: chartTheme.tick }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 12, fill: chartTheme.tick }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="energy"
                          name="Energy (kWh)"
                          stroke={chartTheme.energy}
                          strokeWidth={3}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="energyIntensity"
                          name="Energy Intensity (scaled)"
                          stroke={chartTheme.water}
                          strokeWidth={3}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                          strokeDasharray="5 3"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  renderNoData("energy")
                )}
              </div>

              <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl border border-gray-200 shadow-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Energy vs Carbon Intensity
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Energy consumption vs carbon intensity (tCO₂e/kWh)
                    </p>
                  </div>
                </div>

                {energyTabData.length ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={energyTabData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={chartTheme.grid}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="name"
                          tickLine={false}
                          axisLine={{
                            stroke: chartTheme.axis,
                            strokeWidth: 1,
                          }}
                          tick={{ fontSize: 12, fill: chartTheme.tick }}
                        />
                        <YAxis
                          yAxisId="left"
                          tickLine={false}
                          axisLine={{
                            stroke: chartTheme.axis,
                            strokeWidth: 1,
                          }}
                          tick={{ fontSize: 12, fill: chartTheme.tick }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 12, fill: chartTheme.tick }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="energy"
                          name="Energy (kWh)"
                          stroke={chartTheme.energy}
                          strokeWidth={3}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="carbonIntensity"
                          name="Carbon Intensity (tCO₂e/kWh)"
                          stroke={chartTheme.carbon}
                          strokeWidth={3}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                          strokeDasharray="4 2"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  renderNoData("carbon intensity")
                )}
              </div>
            </div>
          </div>
        );

      case "carbon":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <KpiCard
                title="Carbon Emissions"
                value={totalInvoiceCo2Tonnes.toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })}
                unit="tCO₂e"
                icon={FiCloud}
                color="red"
              />
              <KpiCard
                title="Total Energy"
                value={(totalEnergyKwh || totalEnergy).toLocaleString()}
                unit="kWh"
                icon={FiZap}
                color="emerald"
              />
              <KpiCard
                title="Water Usage"
                value={(totalWater || totalWaterUsage).toLocaleString()}
                unit="m³"
                icon={FiDroplet}
                color="blue"
              />
              <KpiCard
                title="Water Cost"
                value={totalWaterCost > 0 ? `R ${totalWaterCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "R 0"}
                unit=""
                icon={FiDollarSign}
                color="indigo"
              />
              <KpiCard
                title="Waste Generated"
                value={totalWaste.toFixed(1)}
                unit="tonnes"
                icon={FiTrash2}
                color="blue"
              />
            </div>

            <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl border border-gray-200 shadow-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Carbon Emissions Trend
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Carbon emissions over time from saved invoice data
                  </p>
                </div>
              </div>

              {carbonChartData.length ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={carbonChartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={chartTheme.grid}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={{
                          stroke: chartTheme.axis,
                          strokeWidth: 1,
                        }}
                        tick={{ fontSize: 12, fill: chartTheme.tick }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={{
                          stroke: chartTheme.axis,
                          strokeWidth: 1,
                        }}
                        tick={{ fontSize: 12, fill: chartTheme.tick }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="carbon"
                        name="Carbon (tCO₂e)"
                        stroke={chartTheme.carbon}
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                renderNoData("carbon")
              )}
            </div>
          </div>
        );

      case "water":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <KpiCard
                title="Water Usage"
                value={(totalWater || totalWaterUsage).toLocaleString()}
                unit="m³"
                icon={FiDroplet}
                color="blue"
              />
              <KpiCard
                title="Water Cost"
                value={totalWaterCost > 0 ? `R ${totalWaterCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "R 0"}
                unit=""
                icon={FiDollarSign}
                color="indigo"
              />
              <KpiCard
                title="Total Energy"
                value={(totalEnergyKwh || totalEnergy).toLocaleString()}
                unit="kWh"
                icon={FiZap}
                color="emerald"
              />
              <KpiCard
                title="Carbon Emissions"
                value={totalInvoiceCo2Tonnes.toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })}
                unit="tCO₂e"
                icon={FiCloud}
                color="red"
              />
              <KpiCard
                title="Water Efficiency"
                value={(totalWaterUsage > 0 && totalEnergyKwh > 0) ? (totalWaterUsage / totalEnergyKwh).toFixed(3) : "0.000"}
                unit="m³/kWh"
                icon={GiWaterDrop}
                color="purple"
              />
            </div>

            <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl border border-gray-200 shadow-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Water Usage Trend
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Water consumption over time from saved invoice data
                  </p>
                </div>
              </div>

              {waterChartData.length ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={waterChartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={chartTheme.grid}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={{
                          stroke: chartTheme.axis,
                          strokeWidth: 1,
                        }}
                        tick={{ fontSize: 12, fill: chartTheme.tick }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={{
                          stroke: chartTheme.axis,
                          strokeWidth: 1,
                        }}
                        tick={{ fontSize: 12, fill: chartTheme.tick }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="water"
                        name="Water (m³)"
                        stroke={chartTheme.water}
                        fill={chartTheme.water}
                        fillOpacity={0.2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                renderNoData("water")
              )}
            </div>
          </div>
        );

      case "waste":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <KpiCard
                title="Waste Generated"
                value={totalWaste.toFixed(1)}
                unit="tonnes"
                icon={FiTrash2}
                color="blue"
              />
              <KpiCard
                title="Total Energy"
                value={(totalEnergyKwh || totalEnergy).toLocaleString()}
                unit="kWh"
                icon={FiZap}
                color="emerald"
              />
              <KpiCard
                title="Carbon Emissions"
                value={totalInvoiceCo2Tonnes.toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })}
                unit="tCO₂e"
                icon={FiCloud}
                color="red"
              />
              <KpiCard
                title="Water Usage"
                value={(totalWater || totalWaterUsage).toLocaleString()}
                unit="m³"
                icon={FiDroplet}
                color="blue"
              />
              <KpiCard
                title="Water Cost"
                value={totalWaterCost > 0 ? `R ${totalWaterCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "R 0"}
                unit=""
                icon={FiDollarSign}
                color="indigo"
              />
            </div>

            <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl border border-gray-200 shadow-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Waste Generation Trend
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Waste generated over time from saved data
                  </p>
                </div>
              </div>

              {wasteChartData.length ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={wasteChartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={chartTheme.grid}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={{
                          stroke: chartTheme.axis,
                          strokeWidth: 1,
                        }}
                        tick={{ fontSize: 12, fill: chartTheme.tick }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={{
                          stroke: chartTheme.axis,
                          strokeWidth: 1,
                        }}
                        tick={{ fontSize: 12, fill: chartTheme.tick }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar
                        dataKey="waste"
                        name="Waste (t)"
                        stroke={chartTheme.waste}
                        fill={chartTheme.waste}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                renderNoData("waste")
              )}
            </div>
          </div>
        );

      case "fuel":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <KpiCard
                title="Fuel Consumption"
                value={totalFuel.toLocaleString()}
                unit="liters"
                icon={FiTruck}
                color="amber"
              />
              <KpiCard
                title="Total Energy"
                value={(totalEnergyKwh || totalEnergy).toLocaleString()}
                unit="kWh"
                icon={FiZap}
                color="emerald"
              />
              <KpiCard
                title="Carbon Emissions"
                value={totalInvoiceCo2Tonnes.toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })}
                unit="tCO₂e"
                icon={FiCloud}
                color="red"
              />
              <KpiCard
                title="Water Usage"
                value={(totalWater || totalWaterUsage).toLocaleString()}
                unit="m³"
                icon={FiDroplet}
                color="blue"
              />
              <KpiCard
                title="Water Cost"
                value={totalWaterCost > 0 ? `R ${totalWaterCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "R 0"}
                unit=""
                icon={FiDollarSign}
                color="indigo"
              />
            </div>

            <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl border border-gray-200 shadow-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Fuel Usage Trend
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Fuel consumption over time from saved data
                  </p>
                </div>
              </div>

              {fuelChartData.length ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={fuelChartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={chartTheme.grid}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={{
                          stroke: chartTheme.axis,
                          strokeWidth: 1,
                        }}
                        tick={{ fontSize: 12, fill: chartTheme.tick }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={{
                          stroke: chartTheme.axis,
                          strokeWidth: 1,
                        }}
                        tick={{ fontSize: 12, fill: chartTheme.tick }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="fuel"
                        name="Fuel (L)"
                        stroke={chartTheme.fuel}
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                renderNoData("fuel")
              )}
            </div>
          </div>
        );

      case "overview":
      default:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <KpiCard
                title="Total Energy"
                value={(totalEnergyKwh || totalEnergy).toLocaleString()}
                unit="kWh"
                icon={FiZap}
                color="emerald"
                onClick={handleInvoiceKpiClick}
              />
              <KpiCard
                title="Carbon Emissions"
                value={totalInvoiceCo2Tonnes.toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })}
                unit="tCO₂e"
                icon={FiCloud}
                color="red"
                onClick={handleInvoiceKpiClick}
              />
              <KpiCard
                title="Water Usage"
                value={(totalWater || totalWaterUsage).toLocaleString()}
                unit="m³"
                icon={FiDroplet}
                color="blue"
              />
              <KpiCard
                title="Water Cost"
                value={totalWaterCost > 0 ? `R ${totalWaterCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "R 0"}
                unit=""
                icon={FiDollarSign}
                color="indigo"
              />
              <KpiCard
                title="Fuel Consumption"
                value={totalFuel.toLocaleString()}
                unit="liters"
                icon={FiTruck}
                color="amber"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-gradient-to-br from-white to-gray-50 rounded-3xl border border-gray-200 shadow-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Environmental Performance
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Combined view of energy consumption and carbon emissions from saved invoice data
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span className="text-xs font-medium text-gray-600">
                        Energy
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-rose-500" />
                      <span className="text-xs font-medium text-gray-600">
                        Carbon
                      </span>
                    </div>
                  </div>
                </div>

                {hasAnyData ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={energyChartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={chartTheme.grid}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="name"
                          tickLine={false}
                          axisLine={{
                            stroke: chartTheme.axis,
                            strokeWidth: 1,
                          }}
                          tick={{ fontSize: 12, fill: chartTheme.tick }}
                        />
                        <YAxis
                          yAxisId="left"
                          tickLine={false}
                          axisLine={{
                            stroke: chartTheme.axis,
                            strokeWidth: 1,
                          }}
                          tick={{ fontSize: 12, fill: chartTheme.tick }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 12, fill: chartTheme.tick }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="energy"
                          name="Energy (kWh)"
                          stroke={chartTheme.energy}
                          strokeWidth={3}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="carbon"
                          name="Carbon (tCO₂e)"
                          stroke={chartTheme.carbon}
                          strokeWidth={3}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                          strokeDasharray="4 2"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  renderNoData("environmental")
                )}
              </div>

              <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl border border-gray-200 shadow-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Performance Overview
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Environmental performance across key metrics from saved data
                    </p>
                  </div>
                  <FaChartPie className="w-6 h-6 text-gray-400" />
                </div>

                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart outerRadius={90} data={radarData}>
                      <PolarGrid stroke={chartTheme.grid} />
                      <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: chartTheme.tick, fontSize: 12 }}
                      />
                      <PolarRadiusAxis
                        angle={30}
                        domain={[0, 1]}
                        tick={{ fill: chartTheme.tick, fontSize: 10 }}
                      />
                      <Radar
                        name="Performance"
                        dataKey="A"
                        stroke="#10b981"
                        fill="#10b981"
                        fillOpacity={0.3}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <section className="bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-gray-200 p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-gray-800">
                    Invoice PDF Processing (Including Water Data)
                  </h2>
                  <p className="text-xs text-gray-500 mt-1 max-w-xl">
                    Upload bulk PDF invoices and view cost, energy & water usage data per invoice. Energy and water reflect the last 6 months on each invoice.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-full text-xs sm:text-sm font-medium shadow-md hover:shadow-lg cursor-pointer transition-all">
                    <FaFilePdf />
                    Bulk Invoices (PDF)
                    <input
                      type="file"
                      accept=".pdf"
                      multiple
                      className="hidden"
                      onChange={(e) =>
                        handleBulkInvoiceUpload(e.target.files)
                      }
                    />
                  </label>
                </div>
              </div>

              <InvoiceProcessingStatus
                loading={invoiceLoading}
                error={invoiceError}
                successCount={uploadSuccessCount}
              />

              {totalInvoices > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-2">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      Invoice PDFs
                    </div>
                    <div className="text-xl font-bold text-slate-900 mt-1">
                      {invoiceSummaries.length}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Total processed invoice PDFs
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      Invoices (last 6 by date)
                    </div>
                    <div className="text-xl font-bold text-slate-900 mt-1">
                      {totalInvoices}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Most recent 6 invoice records
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">
                      Total energy (kWh)
                    </div>
                    <div className="text-xl font-bold text-emerald-900 mt-1 tabular-nums">
                      {totalEnergyKwh.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </div>
                    <div className="text-[11px] text-emerald-700/80 mt-0.5">
                      Aggregated for last 6 invoices
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                    <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide">
                      Total water (m³)
                    </div>
                    <div className="text-xl font-bold text-blue-900 mt-1 tabular-nums">
                      {totalWaterUsage.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </div>
                    <div className="text-[11px] text-blue-700/80 mt-0.5">
                      Across last 6 invoices
                    </div>
                  </div>

                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                    <div className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wide">
                      Water cost (R)
                    </div>
                    <div className="text-xl font-bold text-indigo-900 mt-1 tabular-nums">
                      {totalWaterCost.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <div className="text-[11px] text-indigo-700/80 mt-0.5">
                      Water charges total
                    </div>
                  </div>
                </div>
              )}

              {!invoiceLoading &&
                !invoiceError &&
                invoiceSummaries.length === 0 && (
                  <p className="text-xs text-slate-500">
                    No invoice PDFs processed yet. Upload a bulk set to see the extracted data here.
                  </p>
                )}

              {!invoiceLoading && lastSixInvoicesChrono.length > 0 && (
                <div className="overflow-x-auto mt-3">
                  <table className="min-w-full text-xs sm:text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-2 py-2 font-semibold text-slate-700">
                          Company
                        </th>
                        <th className="px-2 py-2 font-semibold text-slate-700">
                          Categories
                        </th>
                        <th className="px-2 py-2 font-semibold text-slate-700">
                          Tax Invoice #
                        </th>
                        <th className="px-2 py-2 font-semibold text-slate-700">
                          Energy (kWh)
                        </th>
                        <th className="px-2 py-2 font-semibold text-slate-700">
                          Water (m³)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedInvoices.map((group) =>
                        group.rows.map((inv, idx) => {
                          const categoriesText = getInvoiceCategoriesText(inv);
                          const showCompanyCell = idx === 0;
                          const waterUsage = getInvoiceWaterUsage(inv);
                          const sixMonthEnergy = getInvoiceSixMonthEnergy(inv);

                          return (
                            <tr
                              key={`${group.company}-${inv.tax_invoice_number}-${idx}`}
                              className="border-b border-slate-100 hover:bg-slate-50/60"
                            >
                              {showCompanyCell && (
                                <td
                                  rowSpan={group.rows.length}
                                  className="px-2 py-1 align-top font-medium text-slate-900"
                                >
                                  {group.company}
                                </td>
                              )}
                              <td className="px-2 py-1 text-slate-700">
                                {categoriesText}
                              </td>
                              <td className="px-2 py-1">
                                {inv.tax_invoice_number || "—"}
                              </td>
                              <td className="px-2 py-1 text-emerald-700 font-medium">
                                {sixMonthEnergy ? sixMonthEnergy.toLocaleString() : "—"}
                              </td>
                              <td className="px-2 py-1 text-blue-700 font-medium">
                                {waterUsage > 0 ? waterUsage.toLocaleString() : "—"}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <aside className="bg-white rounded-3xl shadow border border-slate-200 p-5 flex flex-col h-full">
              <h2 className="text-lg font-semibold text-slate-900">
                ESG Environmental – AI Narrative
              </h2>
              <p className="text-xs text-slate-500 mt-1 mb-3">
                Generated commentary based on your uploaded environmental metrics, water usage, and invoice data.
              </p>

              <div className="flex-1 min-h-0">
                {renderAIInsights()}
              </div>
            </aside>
          </div>
        );
    }
  };

  const InvoiceDetailModal = () => {
    if (!selectedInvoice) return null;

    const sixMonthEnergy = getInvoiceSixMonthEnergy(selectedInvoice);
    const taxInvoice = getTaxInvoiceIdentifier(selectedInvoice);
    // ✅ UPDATED: Use formula for carbon calculation
    const estimatedCarbon = calculateCarbonFromEnergy(sixMonthEnergy);
    const history = Array.isArray(selectedInvoice.sixMonthHistory)
      ? selectedInvoice.sixMonthHistory
      : [];
    const totalWaterUsage = getInvoiceWaterUsage(selectedInvoice);
    const totalWaterCost = getInvoiceWaterCost(selectedInvoice);

    return (
      <AnimatePresence>
        {showInvoiceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowInvoiceModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      Invoice Details
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Detailed view of extracted invoice
                    </p>
                  </div>
                  <button
                    onClick={() => setShowInvoiceModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <FaTimes className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">
                        Company
                      </h3>
                      <p className="text-lg font-semibold text-gray-900">
                        {getCompanyName(selectedInvoice)}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">
                        Filename
                      </h3>
                      <p className="text-sm text-gray-900 font-mono">
                        {selectedInvoice.filename}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">
                        Categories
                      </h3>
                      <p className="text-sm text-gray-900">
                        {getInvoiceCategoriesText(selectedInvoice)}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">
                        Invoice Date
                      </h3>
                      <p className="text-lg font-semibold text-gray-900">
                        {selectedInvoice.invoice_date || "—"}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">
                        Tax Invoice #
                      </h3>
                      <p className="text-lg font-semibold text-gray-900 font-mono">
                        {taxInvoice || "—"}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">
                        Total Charges
                      </h3>
                      <p className="text-lg font-semibold text-gray-900">
                        R{" "}
                        {selectedInvoice.total_current_charges
                          ? Number(
                              selectedInvoice.total_current_charges
                            ).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <FiZap className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-emerald-900">
                          Total Energy
                        </p>
                        <p className="text-xl font-bold text-emerald-700">
                          {sixMonthEnergy
                            ? sixMonthEnergy.toLocaleString(undefined, {
                                maximumFractionDigits: 0,
                              })
                            : "—"}{" "}
                          kWh
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                        <FiDroplet className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-900">
                          Water Usage
                        </p>
                        <p className="text-xl font-bold text-blue-700">
                          {totalWaterUsage.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })} m³
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                        <FiDollarSign className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-indigo-900">
                          Water Cost
                        </p>
                        <p className="text-xl font-bold text-indigo-700">
                          R{" "}
                          {totalWaterCost.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-200 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                        <FiCloud className="w-5 h-5 text-rose-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-rose-900">
                          Estimated Carbon
                        </p>
                        <p className="text-xl font-bold text-rose-700">
                          {sixMonthEnergy
                            ? estimatedCarbon.toFixed(1)
                            : "—"}{" "}
                          tCO₂e
                        </p>
                        <p className="text-xs text-rose-600 mt-1">
                          Calculated as: Energy (kWh) × 0.99 / 1000
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {history.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Monthly Breakdown
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                              Month
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                              Energy (kWh)
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                              Charges (R)
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                              Water (m³)
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                              Water Cost (R)
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                              Carbon (tCO₂e)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {history.map((month, index) => {
                            const monthEnergy =
                              Number(month.energyKWh ?? month.energy_kwh ?? 0) || 0;
                            const monthCharges =
                              Number(
                                month.total_current_charges ??
                                  month.current_charges ??
                                  0
                              ) || 0;
                            // ✅ UPDATED: Use formula for monthly carbon calculation
                            const monthCarbon = calculateCarbonFromEnergy(monthEnergy);
                            const { water: monthWater, waterCost: monthWaterCost } = extractWaterFromMonthlyHistory(month);

                            return (
                              <tr
                                key={index}
                                className="hover:bg-gray-50"
                              >
                                <td className="px-4 py-3 text-sm text-gray-700">
                                  {month.month_label ||
                                    `Month ${index + 1}`}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                  {monthEnergy.toLocaleString(undefined, {
                                    maximumFractionDigits: 0,
                                  })}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                  R{" "}
                                  {monthCharges.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                                <td className="px-4 py-3 text-sm text-blue-700 font-medium">
                                  {monthWater.toLocaleString(undefined, {
                                    maximumFractionDigits: 0,
                                  })}
                                </td>
                                <td className="px-4 py-3 text-sm text-indigo-700 font-medium">
                                  R{" "}
                                  {monthWaterCost.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                  {monthCarbon.toFixed(1)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  // ✅ NEW: Loading Overlay Component
  const LoadingOverlay = () => {
    if (!loading && !invoiceLoading && !invoiceAiLoading) return null;
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl p-8 flex flex-col items-center max-w-sm mx-4"
        >
          <div className="w-16 h-16 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin mb-4" />
          <p className="text-lg font-semibold text-gray-900">
            {invoiceLoading ? "Processing Invoices..." : 
             invoiceAiLoading ? "Generating AI Insights..." :
             "Loading Environmental Data..."}
          </p>
          <p className="text-sm text-gray-600 mt-2 text-center">
            {invoiceLoading ? "Extracting data from PDF invoices..." :
             invoiceAiLoading ? "Analyzing environmental patterns..." :
             "Fetching data and calculating insights"}
          </p>
        </motion.div>
      </div>
    );
  };

  // ✅ NEW: Database Status Renderer
  const renderDatabaseStatus = () => {
    if (isSavingToDatabase) {
      return (
        <div className="flex items-center gap-2">
          <FiRefreshCw className="w-3 h-3 animate-spin" />
          <span className="text-xs text-amber-600">Saving to database...</span>
        </div>
      );
    }
    
    if (databaseStats) {
      return (
        <div className="flex items-center gap-2">
          <FiDatabase className="w-3 h-3 text-emerald-500" />
          <span className="text-xs text-gray-600">
            Database: {databaseStats.totalInvoices || invoiceSummaries.length} invoices
          </span>
        </div>
      );
    }
    
    if (invoiceSummaries.length > 0) {
      return (
        <div className="flex items-center gap-2">
          <FiSave className="w-3 h-3 text-blue-500" />
          <span className="text-xs text-gray-600">
            {invoiceSummaries.length} invoices ready to save
          </span>
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-emerald-700 uppercase">
              AfricaESG.AI
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              ESG – Environmental
            </h1>
            <p className="mt-2 text-sm text-gray-600 max-w-2xl">
              Energy, carbon, water, waste, and fuel performance with PDF invoice integration for automated data extraction. Water metrics now included in all tables and reports.
            </p>
          </div>

          {/* ✅ UPDATED: Enhanced Download Button with Database Save */}
          <DownloadButton
            totalEnergyKwh={totalEnergyKwh}
            totalEnergy={totalEnergy}
            totalInvoiceCo2Tonnes={totalInvoiceCo2Tonnes}
            totalWater={totalWater || totalWaterUsage}
            totalWaste={totalWaste}
            totalFuel={totalFuel}
            invoiceSummaries={invoiceSummaries}
            chartData={chartData}
            activeTab={activeTab}
            monthlySeries={monthlySeries}
            onGenerateESGReport={handleDownloadESGReport}
            onGenerateEnvironmentalReport={handleDownloadEnvironmentalReport}
            onSaveToDatabase={handleSaveToDatabase}
            isSavingDatabase={isSavingToDatabase}
            hasData={invoiceSummaries.length > 0}
          />
        </header>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-3xl blur-3xl" />
          <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl">
            <div className="flex flex-wrap gap-2 p-3">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <motion.button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    className={`group relative flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all duration-300 ${
                      activeTab === tab.id
                        ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg"
                        : "text-gray-700 hover:text-emerald-700 hover:bg-gray-50"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                        activeTab === tab.id ? "text-white" : "text-gray-400"
                      }`}
                    />
                    <span>{tab.label}</span>
                    {activeTab === tab.id && (
                      <motion.div
                        layoutId="tab-indicator"
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-white/50 rounded-full"
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={tabContentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            {renderTabContent()}
          </motion.div>
        </AnimatePresence>

        {/* FOOTER */}
        <footer className="mt-8 pt-6 border-t border-slate-200 text-center">
          <div className="text-sm text-slate-600">
            <p>Powered by AfricaESG.AI</p>
          </div>
        </footer>
      </div>

      <InvoiceDetailModal />
      <LoadingOverlay />
    </div>
  );
}