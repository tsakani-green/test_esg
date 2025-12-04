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
import { jsPDF } from "jspdf";

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

// Modern color palette
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

// UPDATED: New emission factor - Carbon (tCO₂e) = Energy (kWh) * 0.99 / 1000
const EF_ELECTRICITY_T_PER_KWH = 0.99 / 1000; // 0.00099

// Animations
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
  return getCompanyNameFromFilename(inv?.filename);
};

const getInvoiceCategoriesText = (inv) => {
  if (inv && Array.isArray(inv.categories) && inv.categories.length > 0) {
    return inv.categories.join(", ");
  }
  return "—";
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

// Energy (kWh – last 6 months) per invoice
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

// Enhanced Custom Tooltip
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
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
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

// Modern KPI Card Component
const KpiCard = ({ title, value, unit, icon: Icon, color, trend, trendValue, onClick }) => {
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
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-gray-50 border border-gray-200 shadow-lg ${onClick ? 'cursor-pointer hover:border-emerald-300' : ''}`}
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/20 to-transparent rounded-full -translate-y-12 translate-x-12" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${colors[color] || 'from-gray-100 to-gray-200'}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          {trend && (
            <div className={`text-xs font-semibold ${trendColors[trend]}`}>
              {trend === "up" ? "↗" : trend === "down" ? "↘" : "→"} {trendValue}
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

// File Upload Component
const FileUploadArea = ({ onFileUpload, isLoading }) => {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(file => 
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
      );
      setSelectedFiles(files);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files).filter(file => 
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
      );
      setSelectedFiles(files);
    }
  };

  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      onFileUpload(selectedFiles);
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
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
            Supports multiple PDF invoices. Each should contain 6-month energy usage data.
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
    </div>
  );
};

// Invoice Processing Status Component
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
          <p className="text-sm text-blue-700">Extracting energy and cost data from PDFs</p>
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
            Successfully processed {successCount} invoice{successCount > 1 ? "s" : ""}
          </p>
          <p className="text-sm text-emerald-700">
            Energy and cost data extracted and ready for analysis
          </p>
        </div>
      </motion.div>
    );
  }

  return null;
};

// Invoice Table Component
const InvoiceTable = ({ invoices, onViewDetails }) => {
  const [showDetails, setShowDetails] = useState(false);

  if (!invoices || invoices.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
          <FaFilePdf className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Invoices Processed</h3>
        <p className="text-sm text-gray-600">Upload PDF invoices to see detailed data here</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Processed Invoices</h3>
          <p className="text-sm text-gray-600 mt-1">
            {invoices.length} invoice{invoices.length > 1 ? 's' : ''} processed
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            {showDetails ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
          <button
            onClick={() => {
              const csvContent = convertInvoicesToCSV(invoices);
              downloadCSV(csvContent, 'invoices.csv');
            }}
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800"
          >
            <FiDownload className="w-4 h-4" />
            Export CSV
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
              const estimatedCarbon = sixMonthEnergy * EF_ELECTRICITY_T_PER_KWH;
              
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
                    {invoice.invoice_date || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                    {taxInvoice || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 max-w-xs truncate">
                      {getInvoiceCategoriesText(invoice)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                    {sixMonthEnergy ? sixMonthEnergy.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    }) : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                    {invoice.total_current_charges ? 
                      `R ${Number(invoice.total_current_charges).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}` : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                    {sixMonthEnergy ? estimatedCarbon.toLocaleString(undefined, {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    }) : '—'}
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
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-4"
        >
          <h4 className="text-sm font-semibold text-gray-900">Monthly Breakdown</h4>
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
                    const monthEnergy = Number(month.energyKWh ?? month.energy_kwh ?? 0) || 0;
                    const monthCharges = Number(month.total_current_charges ?? month.current_charges ?? 0) || 0;
                    const monthCarbon = monthEnergy * EF_ELECTRICITY_T_PER_KWH;
                    
                    return (
                      <tr key={`${invoiceIndex}-${monthIndex}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {monthIndex === 0 ? getCompanyName(invoice) : ''}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {month.month_label || `Month ${monthIndex + 1}`}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                          {monthEnergy.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                          R {monthCharges.toLocaleString(undefined, {
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

// Helper functions for CSV export
const convertInvoicesToCSV = (invoices) => {
  const headers = [
    'Company',
    'Invoice Date',
    'Tax Invoice #',
    'Categories',
    '6-Month Energy (kWh)',
    'Current Charges (R)',
    'Estimated Carbon (tCO₂e)',
    'Filename'
  ];

  const rows = invoices.map(invoice => {
    const sixMonthEnergy = getInvoiceSixMonthEnergy(invoice);
    const taxInvoice = getTaxInvoiceIdentifier(invoice);
    const estimatedCarbon = sixMonthEnergy * EF_ELECTRICITY_T_PER_KWH;

    return [
      `"${getCompanyName(invoice).replace(/"/g, '""')}"`,
      `"${invoice.invoice_date || ''}"`,
      `"${taxInvoice || ''}"`,
      `"${getInvoiceCategoriesText(invoice).replace(/"/g, '""')}"`,
      sixMonthEnergy || '',
      invoice.total_current_charges || '',
      estimatedCarbon.toFixed(1),
      `"${invoice.filename || ''}"`
    ];
  });

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
};

const downloadCSV = (csvContent, fileName) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function EnvironmentalCategory() {
  const {
    environmentalMetrics,
    environmentalInsights,
    loading,
    error,
  } = useContext(SimulationContext);

  const [activeTab, setActiveTab] = useState("overview");
  const [hoveredCard, setHoveredCard] = useState(null);
  const [uploadSuccessCount, setUploadSuccessCount] = useState(0);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // ---- ESG METRICS FROM CONTEXT ----
  const metrics = environmentalMetrics || {};

  // ---------- INVOICE STATE ----------
  const [invoiceSummaries, setInvoiceSummaries] = useState([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState(null);

  // AI Environmental Insights for invoices
  const [invoiceAiMetrics, setInvoiceAiMetrics] = useState(null);
  const [invoiceAiInsights, setInvoiceAiInsights] = useState([]);
  const [invoiceAiLoading, setInvoiceAiLoading] = useState(false);
  const [invoiceAiError, setInvoiceAiError] = useState(null);

  // Raw rows coming from the ESG Excel/JSON upload.
  const uploadedRows =
    metrics.uploadedRows || metrics.rows || metrics.data || [];

  // ✅ Build monthly aggregated series from uploaded ESG rows
  const monthlySeries = useMemo(() => {
    if (!Array.isArray(uploadedRows) || uploadedRows.length === 0) return [];

    const map = new Map();

    uploadedRows.forEach((row) => {
      const label =
        row.month ||
        row.Month ||
        row.period ||
        row.Period ||
        row.month_label;

      if (!label) return;

      const key = label.toString().trim();

      if (!map.has(key)) {
        map.set(key, {
          name: key,
          energy: 0,
          carbon: 0,
          waste: 0,
          fuel: 0,
          water: 0,
        });
      }

      const agg = map.get(key);

      // Energy for this row
      const rowEnergy =
        Number(
          row.energy_kwh ??
            row.energyKWh ??
            row["Energy (kWh)"] ??
            row["Electricity (kWh)"] ??
            row.energy
        ) || 0;
      agg.energy += rowEnergy;

      // Carbon from file if available, otherwise estimate from energy
      let rowCarbonRaw =
        row.co2_tonnes ??
        row.co2Tonnes ??
        row.co2 ??
        row["CO2 (t)"] ??
        row.carbon ??
        row.emissions_tonnes ??
        row.emissions;

      let rowCarbon = rowCarbonRaw != null ? Number(rowCarbonRaw) : NaN;
      if (Number.isNaN(rowCarbon)) {
        // UPDATED: Estimate from energy using new formula
        rowCarbon = rowEnergy * EF_ELECTRICITY_T_PER_KWH;
      }
      agg.carbon += Number.isFinite(rowCarbon) ? rowCarbon : 0;

      // Waste
      agg.waste +=
        Number(row.waste_tonnes ?? row["Waste (t)"] ?? row.waste) || 0;

      // Fuel
      agg.fuel +=
        Number(row.fuel_litres ?? row.fuel_l ?? row["Fuel (L)"] ?? row.fuel) ||
        0;

      // Water
      agg.water +=
        Number(row.water_m3 ?? row["Water (m³)"] ?? row.water) || 0;

      map.set(key, agg);
    });

    const arr = Array.from(map.values());

    // Sort by month order if labels are typical month names, otherwise alphabetically
    arr.sort((a, b) => {
      const ai = MONTH_ORDER.indexOf(a.name);
      const bi = MONTH_ORDER.indexOf(b.name);

      if (ai !== -1 && bi !== -1) return ai - bi;
      return a.name.localeCompare(b.name);
    });

    return arr.slice(-6);
  }, [uploadedRows]);

  // ✅ For energy: prefer backend metrics if present, else monthlySeries
  const energyUsage =
    (metrics.energyUsage && metrics.energyUsage.length
      ? metrics.energyUsage
      : monthlySeries.map((m) => m.energy)) || [];

  // ✅ For carbon: ALWAYS prefer monthlySeries (uploaded file) if available
  const co2Emissions =
    monthlySeries.length > 0
      ? monthlySeries.map((m) => m.carbon)
      : (metrics.co2Emissions && metrics.co2Emissions.length
          ? metrics.co2Emissions
          : []);

  const waste =
    (metrics.waste && metrics.waste.length
      ? metrics.waste
      : monthlySeries.map((m) => m.waste)) || [];

  const fuelUsage =
    (metrics.fuelUsage && metrics.fuelUsage.length
      ? metrics.fuelUsage
      : monthlySeries.map((m) => m.fuel)) || [];

  const waterUsage =
    (metrics.waterUsage && metrics.waterUsage.length
      ? metrics.waterUsage
      : monthlySeries.map((m) => m.water)) || [];

  const hasAnyData = useMemo(() => {
    const series = [energyUsage, co2Emissions, waste, fuelUsage, waterUsage];
    return series.some(
      (arr) =>
        Array.isArray(arr) && arr.some((v) => v !== null && v !== undefined)
    );
  }, [energyUsage, co2Emissions, waste, fuelUsage, waterUsage]);

  const chartData = useMemo(() => {
    if (monthlySeries.length > 0) {
      return monthlySeries;
    }

    return months.map((m, idx) => ({
      name: m,
      energy: energyUsage[idx] ?? null,
      carbon: co2Emissions[idx] ?? null,
      waste: waste[idx] ?? null,
      fuel: fuelUsage[idx] ?? null,
      water: waterUsage[idx] ?? null,
    }));
  }, [monthlySeries, energyUsage, co2Emissions, waste, fuelUsage, waterUsage]);

  const totalEnergy = energyUsage.reduce((s, v) => s + (v || 0), 0);
  const totalFuel = fuelUsage.reduce((s, v) => s + (v || 0), 0);
  const totalWater = waterUsage.reduce((s, v) => s + (v || 0), 0);
  const avgCarbon =
    co2Emissions.length > 0
      ? co2Emissions.reduce((s, v) => s + (v || 0), 0) / co2Emissions.length
      : 0;
  const totalWaste = waste.reduce((s, v) => s + (v || 0), 0);

  // AI invoice helpers
  const persistInvoiceSummaries = (arr) => {
    try {
      localStorage.setItem("invoiceSummaries", JSON.stringify(arr));
    } catch (e) {
      console.warn("Failed to persist invoiceSummaries to localStorage", e);
    }
  };

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

      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const res = await fetch(`${API_BASE_URL}/api/invoice-bulk-upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Invoice upload error: ${res.status} ${txt}`);
      }

      const summaries = await res.json();
      const processedCount = summaries.length;

      setInvoiceSummaries((prev) => {
        const updated = [...summaries, ...prev];
        persistInvoiceSummaries(updated);
        return updated;
      });

      setUploadSuccessCount(processedCount);
      setInvoiceError(null);
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

  // Clear all invoices
  const handleClearInvoices = () => {
    if (window.confirm("Are you sure you want to clear all invoice data?")) {
      setInvoiceSummaries([]);
      localStorage.removeItem("invoiceSummaries");
      setInvoiceAiMetrics(null);
      setInvoiceAiInsights([]);
      setUploadSuccessCount(0);
    }
  };

  // View invoice details
  const handleViewInvoiceDetails = (invoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
  };

  // Load invoices from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("invoiceSummaries");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setInvoiceSummaries(parsed);
        }
      }
    } catch (e) {
      console.warn("Failed to parse invoiceSummaries from localStorage", e);
    }
  }, []);

  // Load existing invoices from backend
  useEffect(() => {
    const loadInvoices = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/invoices`);
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          setInvoiceSummaries(data);
          persistInvoiceSummaries(data);
        }
      } catch (e) {
        console.warn("Failed to load invoice summaries", e);
      }
    };

    loadInvoices();
  }, []);

  // Load AI environmental insights for invoices
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
          throw new Error(
            `Invoice AI insights error: ${res.status} ${txt}`
          );
        }

        const data = await res.json();
        setInvoiceAiMetrics(data.metrics || null);
        setInvoiceAiInsights(
          Array.isArray(data.insights) ? data.insights : []
        );
      } catch (err) {
        console.error("Invoice AI insights error:", err);
        setInvoiceAiError(
          err.message ||
            "Failed to load AI Environmental insights for invoices."
        );
      } finally {
        setInvoiceAiLoading(false);
      }
    };

    loadInvoiceAI();
  }, [invoiceSummaries.length]);

  // Last 6 invoices
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

  // Aggregated metrics using energy over last 6 months per invoice
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

  // Blended tariff based on last 6 invoices
  const avgTariff =
    totalEnergyKwh > 0 ? totalCurrentCharges / totalEnergyKwh : 0;

  // UPDATED: Use new formula for invoice carbon calculation
  const totalInvoiceCo2Tonnes =
    invoiceAiMetrics && invoiceAiMetrics.estimated_co2_tonnes != null
      ? invoiceAiMetrics.estimated_co2_tonnes
      : totalEnergyKwh * EF_ELECTRICITY_T_PER_KWH;

  // ---------- Flatten sixMonthHistory into month-level rows ----------
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

        let monthCo2Raw =
          m.carbonTco2e ??
          m.carbon_tco2e ??
          m.co2Tonnes ??
          m.co2_tonnes ??
          m.co2 ??
          m.co2_t ??
          m.emissions_tonnes ??
          null;

        let monthCo2 = monthCo2Raw != null ? Number(monthCo2Raw) : NaN;

        // UPDATED: Use new formula for carbon calculation
        if (Number.isNaN(monthCo2)) {
          monthCo2 = monthEnergy * EF_ELECTRICITY_T_PER_KWH;
        }

        monthCo2 = Number.isFinite(monthCo2) ? monthCo2 : 0;

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
      });
    });

    return groups;
  }, [monthLevelRows]);

  // ---------- Invoice chart data ----------
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
        });
      }
      const agg = map.get(key);
      agg.energy += row.energyKWh || 0;
      agg.charges += row.total_current_charges || 0;
      agg.carbon += row.co2Tonnes || 0;
      map.set(key, agg);
    });

    const arr = Array.from(map.values());
    arr.sort((a, b) => a.name.localeCompare(b.name));
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
          Upload environmental data to visualize insights
        </p>
      </div>
    </div>
  );

  const hasInvoiceInsights =
    invoiceAiMetrics &&
    Array.isArray(invoiceAiInsights) &&
    invoiceAiInsights.length > 0;

  // ---------- DOWNLOAD ENVIRONMENTAL REPORT (PDF) ----------
  const handleDownloadEnvReport = () => {
    const doc = new jsPDF();
    doc.text("AfricaESG Environmental Report", 20, 20);
    doc.save("AfricaESG_Environmental_Report.pdf");
  };

  // Radar chart data for environmental performance
  const radarData = [
    { subject: 'Energy', A: totalEnergy / 10000, fullMark: 1 },
    { subject: 'Carbon', A: avgCarbon / 10, fullMark: 1 },
    { subject: 'Waste', A: totalWaste / 100, fullMark: 1 },
    { subject: 'Fuel', A: totalFuel / 5000, fullMark: 1 },
    { subject: 'Water', A: totalWater / 500, fullMark: 1 },
    { subject: 'Efficiency', A: 0.7, fullMark: 1 },
  ];

  // Handle clicking on invoice-related KPI cards
  const handleInvoiceKpiClick = () => {
    setActiveTab('invoices');
  };

  // ---------- TAB CONTENT ----------
  const renderTabContent = () => {
    switch (activeTab) {
      case "invoices":
        return (
          <div className="space-y-6">
            {/* Invoice Processing Section */}
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl border border-gray-200 shadow-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Invoice Management</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Upload, view, and manage PDF invoices with extracted energy and cost data
                  </p>
                </div>
                {invoiceSummaries.length > 0 && (
                  <button
                    onClick={handleClearInvoices}
                    className="inline-flex items-center gap-2 text-sm text-rose-600 hover:text-rose-700 font-medium"
                  >
                    <FiTrash2 className="w-4 h-4" />
                    Clear All Invoices
                  </button>
                )}
              </div>

              <InvoiceProcessingStatus 
                loading={invoiceLoading}
                error={invoiceError}
                successCount={uploadSuccessCount}
              />

              <div className="mt-6">
                <FileUploadArea 
                  onFileUpload={handleBulkInvoiceUpload}
                  isLoading={invoiceLoading}
                />
              </div>
            </div>

            {/* Invoice Table */}
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl border border-gray-200 shadow-xl p-6">
              <InvoiceTable 
                invoices={invoiceSummaries}
                onViewDetails={handleViewInvoiceDetails}
              />
            </div>

            {/* Invoice Summary Cards */}
            {invoiceSummaries.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                      <FiZap className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-emerald-900">Total Energy</p>
                      <p className="text-2xl font-bold text-emerald-700">
                        {totalEnergyKwh.toLocaleString()} kWh
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                      <FiDollarSign className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-900">Total Charges</p>
                      <p className="text-2xl font-bold text-blue-700">
                        R {totalCurrentCharges.toLocaleString(undefined, {
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
                      <p className="text-sm font-medium text-rose-900">Estimated Carbon</p>
                      <p className="text-2xl font-bold text-rose-700">
                        {totalInvoiceCo2Tonnes.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })} tCO₂e
                      </p>
                      <p className="text-xs text-rose-600 mt-1">
                        Calculated as: Energy (kWh) × 0.99 / 1000
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case "overview":
      default:
        return (
          <div className="space-y-6">
            {/* Environmental Dashboard */}
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
                  maximumFractionDigits: 0,
                })}
                unit="tCO₂e"
                icon={FiCloud}
                color="red"
                onClick={handleInvoiceKpiClick}
              />
              <KpiCard
                title="Water Usage"
                value={totalWater.toLocaleString()}
                unit="m³"
                icon={FiDroplet}
                color="blue"
              />
              <KpiCard
                title="Waste Generated"
                value={totalWaste.toFixed(1)}
                unit="tonnes"
                icon={FiTrash2}
                color="blue"
              />
              <KpiCard
                title="Fuel Consumption"
                value={totalFuel.toLocaleString()}
                unit="liters"
                icon={FiTruck}
                color="amber"
              />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Energy & Carbon Chart */}
              <div className="lg:col-span-2 bg-gradient-to-br from-white to-gray-50 rounded-3xl border border-gray-200 shadow-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Environmental Performance</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Combined view of energy consumption and carbon emissions
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span className="text-xs font-medium text-gray-600">Energy</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-rose-500" />
                      <span className="text-xs font-medium text-gray-600">Carbon</span>
                    </div>
                  </div>
                </div>
                
                {hasAnyData ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                        <XAxis
                          dataKey="name"
                          tickLine={false}
                          axisLine={{ stroke: chartTheme.axis, strokeWidth: 1 }}
                          tick={{ fontSize: 12, fill: chartTheme.tick }}
                        />
                        <YAxis
                          yAxisId="left"
                          tickLine={false}
                          axisLine={{ stroke: chartTheme.axis, strokeWidth: 1 }}
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

              {/* Performance Radar */}
              <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl border border-gray-200 shadow-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Performance Overview</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Environmental performance across key metrics
                    </p>
                  </div>
                  <FaChartPie className="w-6 h-6 text-gray-400" />
                </div>
                
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart outerRadius={90} data={radarData}>
                      <PolarGrid stroke={chartTheme.grid} />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: chartTheme.tick, fontSize: 12 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 1]} tick={{ fill: chartTheme.tick, fontSize: 10 }} />
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

            {/* Invoice Processing Section */}
            <div id="invoice-processing-section" className="bg-gradient-to-br from-white to-gray-50 rounded-3xl border border-gray-200 shadow-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Invoice PDF Processing</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Upload bulk PDF invoices to extract energy, cost, and carbon data for analysis
                  </p>
                </div>
                {invoiceSummaries.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-emerald-700">
                      {invoiceSummaries.length} invoice{invoiceSummaries.length > 1 ? 's' : ''} processed
                    </span>
                    <button
                      onClick={handleInvoiceKpiClick}
                      className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800"
                    >
                      View All
                    </button>
                  </div>
                )}
              </div>

              <InvoiceProcessingStatus 
                loading={invoiceLoading}
                error={invoiceError}
                successCount={uploadSuccessCount}
              />

              <div className="mt-6">
                <FileUploadArea 
                  onFileUpload={handleBulkInvoiceUpload}
                  isLoading={invoiceLoading}
                />
              </div>

              {/* Invoice Summary Table */}
              {invoiceSummaries.length > 0 && (
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Recent Invoices</h3>
                    <button
                      onClick={handleInvoiceKpiClick}
                      className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800"
                    >
                      View All Invoices
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Company
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Invoice Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Energy (kWh)
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Charges (R)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {invoiceSummaries.slice(0, 5).map((invoice, index) => {
                          const sixMonthEnergy = getInvoiceSixMonthEnergy(invoice);
                          
                          return (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                                  {getCompanyName(invoice)}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                {invoice.invoice_date || '—'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 font-semibold">
                                {sixMonthEnergy ? sixMonthEnergy.toLocaleString(undefined, {
                                  maximumFractionDigits: 0,
                                }) : '—'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 font-semibold">
                                {invoice.total_current_charges ? 
                                  `R ${Number(invoice.total_current_charges).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}` : '—'}
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

            {/* AI Insights Panel - Using SocialCategory structure */}
            <aside className="bg-white rounded-3xl shadow border border-slate-200 p-5 flex flex-col h-full">
              <h2 className="text-lg font-semibold text-slate-900">
                ESG Environmental – AI Narrative
              </h2>
              <p className="text-xs text-slate-500 mt-1 mb-3">
                Generated commentary based on your uploaded environmental metrics and invoice data.
              </p>

              <div className="flex-1 min-h-0">
                {loading || invoiceAiLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-slate-200 rounded w-full"></div>
                      </div>
                    ))}
                  </div>
                ) : error || invoiceAiError ? (
                  <div className="p-4 bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200 rounded-xl">
                    <p className="text-rose-600 text-sm">{error || invoiceAiError}</p>
                  </div>
                ) : hasInvoiceInsights || (environmentalInsights && environmentalInsights.length > 0) ? (
                  <div className="h-full overflow-hidden">
                    <ul className="h-full overflow-y-auto pr-2 space-y-3">
                      {(hasInvoiceInsights ? invoiceAiInsights : environmentalInsights || [])
                        .slice(0, 8)
                        .map((insight, idx) => (
                          <li key={idx} className="flex items-start gap-3">
                            <div className="w-2 h-2 bg-sky-500 rounded-full mt-2 flex-shrink-0"></div>
                            <p className="text-sm text-slate-700 leading-relaxed">{insight}</p>
                          </li>
                        ))}
                    </ul>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FiActivity className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600 text-sm">
                      Upload environmental data or invoices to generate AI insights
                    </p>
                  </div>
                )}
              </div>
            </aside>
          </div>
        );
    }
  };

  // Invoice Detail Modal
  const InvoiceDetailModal = () => {
    if (!selectedInvoice) return null;

    const sixMonthEnergy = getInvoiceSixMonthEnergy(selectedInvoice);
    const taxInvoice = getTaxInvoiceIdentifier(selectedInvoice);
    const estimatedCarbon = sixMonthEnergy * EF_ELECTRICITY_T_PER_KWH;
    const history = Array.isArray(selectedInvoice.sixMonthHistory) 
      ? selectedInvoice.sixMonthHistory 
      : [];

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
              className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Invoice Details</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Detailed view of extracted invoice data
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
                {/* Invoice Header */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Company</h3>
                      <p className="text-lg font-semibold text-gray-900">
                        {getCompanyName(selectedInvoice)}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Filename</h3>
                      <p className="text-sm text-gray-900 font-mono">
                        {selectedInvoice.filename}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Categories</h3>
                      <p className="text-sm text-gray-900">
                        {getInvoiceCategoriesText(selectedInvoice)}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Invoice Date</h3>
                      <p className="text-lg font-semibold text-gray-900">
                        {selectedInvoice.invoice_date || '—'}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Tax Invoice #</h3>
                      <p className="text-lg font-semibold text-gray-900 font-mono">
                        {taxInvoice || '—'}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Total Charges</h3>
                      <p className="text-lg font-semibold text-gray-900">
                        R {selectedInvoice.total_current_charges ? 
                          Number(selectedInvoice.total_current_charges).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }) : '—'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <FiZap className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-emerald-900">Total Energy</p>
                        <p className="text-xl font-bold text-emerald-700">
                          {sixMonthEnergy ? sixMonthEnergy.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          }) : '—'} kWh
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                        <FiDollarSign className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-900">Total Charges</p>
                        <p className="text-xl font-bold text-blue-700">
                          R {selectedInvoice.total_current_charges ? 
                            Number(selectedInvoice.total_current_charges).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }) : '—'}
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
                        <p className="text-sm font-medium text-rose-900">Estimated Carbon</p>
                        <p className="text-xl font-bold text-rose-700">
                          {sixMonthEnergy ? estimatedCarbon.toFixed(1) : '—'} tCO₂e
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Monthly Breakdown */}
                {history.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Breakdown</h3>
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
                              Carbon (tCO₂e)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {history.map((month, index) => {
                            const monthEnergy = Number(month.energyKWh ?? month.energy_kwh ?? 0) || 0;
                            const monthCharges = Number(month.total_current_charges ?? month.current_charges ?? 0) || 0;
                            const monthCarbon = monthEnergy * EF_ELECTRICITY_T_PER_KWH;
                            
                            return (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-700">
                                  {month.month_label || `Month ${index + 1}`}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                  {monthEnergy.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                  R {monthCharges.toLocaleString(undefined, {
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* HEADER - Aligned with SocialCategory style */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-emerald-700 uppercase">
              AfricaESG.AI
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              ESG – Environmental
            </h1>
            <p className="mt-2 text-sm text-gray-600 max-w-2xl">
              Energy, carbon, water, waste, and fuel performance with PDF invoice integration for automated data extraction.
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleDownloadEnvReport}
            className="group relative inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-full shadow-md text-sm font-semibold"
          >
            <FaFilePdf className="w-4 h-4" />
            Download Report
          </motion.button>
        </header>

        {/* TABS - Original EnvironmentalCategory tabs */}
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
                    className={`group flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all duration-300 ${
                      activeTab === tab.id
                        ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg"
                        : "text-gray-700 hover:text-emerald-700 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                      activeTab === tab.id ? "text-white" : "text-gray-400"
                    }`} />
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

        {/* MAIN CONTENT */}
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

        {/* FOOTER - Original EnvironmentalCategory footer */}
        <footer className="mt-8 pt-6 border-t border-gray-200 text-center">
          <div className="text-sm text-gray-600">
            <p>Powered by AfricaESG.AI</p>
          </div>
        </footer>
      </div>

      {/* Invoice Detail Modal */}
      <InvoiceDetailModal />
    </div>
  );
}