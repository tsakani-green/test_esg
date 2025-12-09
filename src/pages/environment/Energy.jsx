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

const EF_ELECTRICITY_T_PER_KWH = 0.99 / 1000;

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

// Upload area (for overview invoice section)
const FileUploadArea = ({ onFileUpload, isLoading }) => {
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
            Supports multiple PDF invoices. Each should contain 6-month energy
            usage data.
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
            Extracting energy and cost data from PDFs
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
            Energy and cost data extracted and ready for analysis
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
            Processed Invoices
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
              const estimatedCarbon =
                sixMonthEnergy * EF_ELECTRICITY_T_PER_KWH;

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
            Monthly Breakdown
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
                    const monthCarbon =
                      monthEnergy * EF_ELECTRICITY_T_PER_KWH;

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
  onGenerateESGReport, // ✅ NEW: Added ESG report function
  onGenerateEnvironmentalReport // ✅ NEW: Added environmental report function
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
  );
};

// ✅ NEW: ESG Metric Card Component
const ESGMetricCard = ({ title, value, icon: Icon, color, unit }) => {
  const colors = {
    emerald: "from-emerald-500 to-teal-500",
    blue: "from-blue-500 to-cyan-500",
    red: "from-rose-500 to-pink-500",
    amber: "from-amber-500 to-orange-500",
    indigo: "from-indigo-500 to-purple-500",
    green: "from-green-500 to-emerald-500",
    purple: "from-purple-500 to-indigo-500",
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-gray-50 border border-gray-200 shadow-lg"
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
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">
            {value}{" "}
            {unit && <span className="text-sm font-normal text-gray-500">{unit}</span>}
          </p>
        </div>
      </div>
    </motion.div>
  );
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
    costSavingsPotential: "R 0",
  },
  aiAnalystInsights: [
    "Environmental performance baseline reflects current energy use, emissions, waste and fuel consumption derived from your latest ESG dataset.",
    "Comparable African industrial peers typically target steady reductions in energy intensity and emissions over a 3–5 year horizon, with growing use of renewables.",
    "Against this benchmark, your environmental profile shows clear opportunities to improve efficiency, reduce carbon exposure and strengthen waste and fuel management.",
    "Prioritise high-impact efficiency projects at the most energy-intensive sites to reduce both cost and carbon tax exposure.",
    "Investigate key waste streams for reduction, recycling or beneficiation opportunities that support circular economy outcomes.",
  ],
};

export default function EnvironmentalCategory() {
  const { environmentalMetrics, environmentalInsights, loading, error } =
    useContext(SimulationContext);

  const [activeTab, setActiveTab] = useState("overview");
  const [uploadSuccessCount, setUploadSuccessCount] = useState(0);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // ✅ NEW: Local storage key for environmental data
  const ENVIRONMENTAL_DATA_KEY = "environmentalData";

  // ✅ NEW: Local storage for environmental data
  const [localEnvironmentalData, setLocalEnvironmentalData] = useState({
    uploadedRows: [],
    metrics: {},
    insights: []
  });

  // ✅ NEW: Load data from localStorage on mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(ENVIRONMENTAL_DATA_KEY);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        setLocalEnvironmentalData(parsedData);
        console.log("Loaded environmental data from localStorage:", parsedData);
      }
    } catch (e) {
      console.warn("Failed to parse environmental data from localStorage", e);
    }
  }, []);

  // ✅ NEW: Save data to localStorage whenever new data arrives
  const saveEnvironmentalData = (data) => {
    try {
      const dataToSave = {
        uploadedRows: data.uploadedRows || data.rows || data.data || [],
        metrics: {
          energyUsage: data.energyUsage || [],
          co2Emissions: data.co2Emissions || [],
          waste: data.waste || [],
          fuelUsage: data.fuelUsage || [],
          waterUsage: data.waterUsage || [],
          ...data
        },
        insights: data.insights || environmentalInsights || [],
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem(ENVIRONMENTAL_DATA_KEY, JSON.stringify(dataToSave));
      setLocalEnvironmentalData(dataToSave);
      console.log("Saved environmental data to localStorage:", dataToSave);
    } catch (e) {
      console.warn("Failed to save environmental data to localStorage", e);
    }
  };

  // ✅ MODIFIED: Save context data when it loads
  useEffect(() => {
    if (environmentalMetrics || environmentalInsights) {
      const data = {
        ...environmentalMetrics,
        insights: environmentalInsights || []
      };
      saveEnvironmentalData(data);
    }
  }, [environmentalMetrics, environmentalInsights]);

  // ✅ MODIFIED: Use local data as primary source, fallback to context
  const getCurrentMetrics = () => {
    // Always use the latest local data if it exists
    if (localEnvironmentalData.uploadedRows && localEnvironmentalData.uploadedRows.length > 0) {
      return {
        ...localEnvironmentalData.metrics,
        uploadedRows: localEnvironmentalData.uploadedRows,
        insights: localEnvironmentalData.insights
      };
    }
    
    // Fallback to context data
    return {
      ...(environmentalMetrics || {}),
      insights: environmentalInsights || []
    };
  };

  const currentMetrics = getCurrentMetrics();

  const [invoiceSummaries, setInvoiceSummaries] = useState([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState(null);

  const [invoiceAiMetrics, setInvoiceAiMetrics] = useState(null);
  const [invoiceAiInsights, setInvoiceAiInsights] = useState([]);
  const [invoiceAiLoading, setInvoiceAiLoading] = useState(false);
  const [invoiceAiError, setInvoiceAiError] = useState(null);

  // ✅ MODIFIED: Use currentMetrics which includes local data
  const uploadedRows = currentMetrics.uploadedRows || [];

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

      const rowEnergy =
        Number(
          row.energy_kwh ??
            row.energyKWh ??
            row["Energy (kWh)"] ??
            row["Electricity (kWh)"] ??
            row.energy
        ) || 0;
      agg.energy += rowEnergy;

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
        rowCarbon = rowEnergy * EF_ELECTRICITY_T_PER_KWH;
      }
      agg.carbon += Number.isFinite(rowCarbon) ? rowCarbon : 0;

      agg.waste +=
        Number(row.waste_tonnes ?? row["Waste (t)"] ?? row.waste) || 0;
      agg.fuel +=
        Number(row.fuel_litres ?? row.fuel_l ?? row["Fuel (L)"] ?? row.fuel) ||
        0;
      agg.water +=
        Number(row.water_m3 ?? row["Water (m³)"] ?? row.water) || 0;

      map.set(key, agg);
    });

    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      const ai = MONTH_ORDER.indexOf(a.name);
      const bi = MONTH_ORDER.indexOf(b.name);
      if (ai !== -1 && bi !== -1) return ai - bi;
      return a.name.localeCompare(b.name);
    });

    return arr.slice(-6);
  }, [uploadedRows]);

  // ✅ MODIFIED: Use currentMetrics
  const energyUsage =
    (currentMetrics.energyUsage && currentMetrics.energyUsage.length
      ? currentMetrics.energyUsage
      : monthlySeries.map((m) => m.energy)) || [];

  const co2Emissions =
    monthlySeries.length > 0
      ? monthlySeries.map((m) => m.carbon)
      : currentMetrics.co2Emissions && currentMetrics.co2Emissions.length
      ? currentMetrics.co2Emissions
      : [];

  const waste =
    (currentMetrics.waste && currentMetrics.waste.length
      ? currentMetrics.waste
      : monthlySeries.map((m) => m.waste)) || [];

  const fuelUsage =
    (currentMetrics.fuelUsage && currentMetrics.fuelUsage.length
      ? currentMetrics.fuelUsage
      : monthlySeries.map((m) => m.fuel)) || [];

  const waterUsage =
    (currentMetrics.waterUsage && currentMetrics.waterUsage.length
      ? currentMetrics.waterUsage
      : monthlySeries.map((m) => m.water)) || [];

  const hasAnyData = useMemo(() => {
    const series = [energyUsage, co2Emissions, waste, fuelUsage, waterUsage];
    return series.some(
      (arr) =>
        Array.isArray(arr) && arr.some((v) => v !== null && v !== undefined)
    );
  }, [energyUsage, co2Emissions, waste, fuelUsage, waterUsage]);

  const chartData = useMemo(() => {
    if (monthlySeries.length > 0) return monthlySeries;

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

  // ✅ MODIFIED: Save invoice summaries locally too
  const persistInvoiceSummaries = (arr) => {
    try {
      localStorage.setItem("invoiceSummaries", JSON.stringify(arr));
    } catch (e) {
      console.warn("Failed to persist invoiceSummaries", e);
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
      
      // ✅ NEW: Also extract and save environmental data from invoices
      if (summaries.length > 0) {
        const extractedData = extractEnvironmentalDataFromInvoices(summaries);
        if (extractedData) {
          saveEnvironmentalData(extractedData);
        }
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

  // ✅ NEW: Helper to extract environmental data from invoices
  const extractEnvironmentalDataFromInvoices = (summaries) => {
    if (!summaries || summaries.length === 0) return null;
    
    try {
      const monthlyData = {};
      
      summaries.forEach((inv) => {
        const history = Array.isArray(inv.sixMonthHistory) ? inv.sixMonthHistory : [];
        
        history.forEach((month) => {
          const monthLabel = month.month_label || month.month || "Unknown";
          if (!monthlyData[monthLabel]) {
            monthlyData[monthLabel] = {
              energy: 0,
              carbon: 0,
              waste: 0,
              fuel: 0,
              water: 0
            };
          }
          
          const energy = Number(month.energyKWh ?? month.energy_kwh ?? 0) || 0;
          const carbon = energy * EF_ELECTRICITY_T_PER_KWH;
          
          monthlyData[monthLabel].energy += energy;
          monthlyData[monthLabel].carbon += carbon;
          // Note: invoices may not contain waste/fuel/water data
        });
      });
      
      // Convert to array format
      const uploadedRows = Object.entries(monthlyData).map(([month, data]) => ({
        month,
        energy_kwh: data.energy,
        co2_tonnes: data.carbon,
        waste_tonnes: 0,
        fuel_litres: 0,
        water_m3: 0
      }));
      
      return {
        uploadedRows,
        energyUsage: uploadedRows.map(row => row.energy_kwh),
        co2Emissions: uploadedRows.map(row => row.co2_tonnes),
        waste: uploadedRows.map(() => 0),
        fuelUsage: uploadedRows.map(() => 0),
        waterUsage: uploadedRows.map(() => 0)
      };
    } catch (e) {
      console.warn("Failed to extract environmental data from invoices", e);
      return null;
    }
  };

  const handleClearInvoices = () => {
    if (window.confirm("Are you sure you want to clear all invoice data?")) {
      setInvoiceSummaries([]);
      localStorage.removeItem("invoiceSummaries");
      setInvoiceAiMetrics(null);
      setInvoiceAiInsights([]);
      setUploadSuccessCount(0);
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
        if (Array.isArray(parsed)) setInvoiceSummaries(parsed);
      }
    } catch (e) {
      console.warn("Failed to parse invoiceSummaries from localStorage", e);
    }
  }, []);

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

  const avgTariff =
    totalEnergyKwh > 0 ? totalCurrentCharges / totalEnergyKwh : 0;

  const totalInvoiceCo2Tonnes =
    invoiceAiMetrics && invoiceAiMetrics.estimated_co2_tonnes != null
      ? invoiceAiMetrics.estimated_co2_tonnes
      : totalEnergyKwh * EF_ELECTRICITY_T_PER_KWH;

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

  const radarData = [
    { subject: "Energy", A: totalEnergy / 10000, fullMark: 1 },
    { subject: "Carbon", A: avgCarbon / 10, fullMark: 1 },
    { subject: "Waste", A: totalWaste / 100, fullMark: 1 },
    { subject: "Fuel", A: totalFuel / 5000, fullMark: 1 },
    { subject: "Water", A: totalWater / 500, fullMark: 1 },
    { subject: "Efficiency", A: 0.7, fullMark: 1 },
  ];

  const handleInvoiceKpiClick = () => {
    setActiveTab("invoices");
  };

  // ---------- ENERGY TAB DATA (two charts) ----------
  const energyTabData = useMemo(() => {
    return chartData.map((row) => {
      const energyVal = row.energy || 0;
      const carbonVal =
        row.carbon != null
          ? row.carbon
          : energyVal * EF_ELECTRICITY_T_PER_KWH;

      // ✅ ENHANCED: Calculate Energy Intensity
      // Energy Intensity = Energy Consumption / Production Output
      // For now, using a default production output of 1000 units
      // You can modify this based on your actual production data
      const productionOutput = 1000; // Default base value
      const energyIntensity = energyVal > 0 ? energyVal / productionOutput : 0;
      
      // ✅ ENHANCED: Calculate Carbon Intensity
      const carbonIntensity = energyVal > 0 ? carbonVal / energyVal : 0;

      return {
        name: row.name,
        energy: energyVal,
        energyIntensity: parseFloat(energyIntensity.toFixed(4)),
        carbonIntensity: parseFloat(carbonIntensity.toFixed(6)),
      };
    });
  }, [chartData]);

  // ---------- PER-RESOURCE CHART DATA FOR OTHER TABS ----------
  const carbonChartData = useMemo(
    () =>
      chartData.map((row) => ({
        name: row.name,
        carbon: row.carbon || 0,
      })),
    [chartData]
  );

  const waterChartData = useMemo(
    () =>
      chartData.map((row) => ({
        name: row.name,
        water: row.water || 0,
      })),
    [chartData]
  );

  const wasteChartData = useMemo(
    () =>
      chartData.map((row) => ({
        name: row.name,
        waste: row.waste || 0,
      })),
    [chartData]
  );

  const fuelChartData = useMemo(
    () =>
      chartData.map((row) => ({
        name: row.name,
        fuel: row.fuel || 0,
      })),
    [chartData]
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
      `• Carbon Emissions: ${(totalInvoiceCo2Tonnes || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} tCO₂e`,
      `• Water Usage: ${(totalWater || 0).toLocaleString()} m³`,
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
      ["Carbon Emissions", (totalInvoiceCo2Tonnes || 0).toLocaleString(undefined, { maximumFractionDigits: 1 }), "tCO₂e"],
      ["Water Usage", (totalWater || 0).toLocaleString(), "m³"],
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

    // Recent Data
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text("Recent Monthly Data", 20, doc.lastAutoTable.finalY + 15);

    if (monthlySeries && monthlySeries.length > 0) {
      const recentData = monthlySeries.slice(-6).map(item => [
        item.name,
        (item.energy || 0).toLocaleString(),
        (item.carbon || 0).toFixed(1),
        (item.water || 0).toLocaleString(),
        (item.waste || 0).toFixed(1),
        (item.fuel || 0).toLocaleString(),
      ]);

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 20,
        head: [["Month", "Energy (kWh)", "Carbon (tCO₂e)", "Water (m³)", "Waste (t)", "Fuel (L)"]],
        body: recentData,
        theme: "grid",
        margin: { left: 20, right: 20 },
      });
    }

    // Invoice Summary (if available)
    if (invoiceSummaries && invoiceSummaries.length > 0) {
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text("Invoice Summary", 20, doc.lastAutoTable.finalY + 20);

      const invoiceData = [
        ["Company", "Invoice Date", "Energy (kWh)", "Charges (R)"],
        ...invoiceSummaries.slice(0, 5).map(inv => {
          const sixMonthEnergy = getInvoiceSixMonthEnergy(inv);
          return [
            getCompanyName(inv).substring(0, 30),
            inv.invoice_date || "—",
            sixMonthEnergy ? sixMonthEnergy.toLocaleString() : "—",
            inv.total_current_charges ? `R ${Number(inv.total_current_charges).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"
          ];
        })
      ];

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 25,
        head: [invoiceData[0]],
        body: invoiceData.slice(1),
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

  // ✅ NEW: Generate ESG Report PDF
  const generateESGReportPDF = () => {
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
    doc.text(`Report Period: ${ESG_REPORT_DATA.companyInfo.reportPeriod} • Generated: ${now.toLocaleDateString()}`, 105, 54, { align: "center" });

    // Company Information
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text("Company Information", 20, 70);

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Company: ${ESG_REPORT_DATA.companyInfo.company}`, 20, 78);
    doc.text(`Report Period: ${ESG_REPORT_DATA.companyInfo.reportPeriod}`, 20, 84);

    // ESG Performance Summary
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text("ESG Performance Summary", 20, 95);

    // Environmental Table
    const envData = [
      ["Energy Consumption", ESG_REPORT_DATA.performanceSummary.environmental.energyConsumption],
      ["Renewable Energy", ESG_REPORT_DATA.performanceSummary.environmental.renewableEnergy],
      ["Carbon Emissions", ESG_REPORT_DATA.performanceSummary.environmental.carbonEmissions],
      ["Monthly Average", ESG_REPORT_DATA.performanceSummary.environmental.monthlyAverage],
      ["Peak Consumption", ESG_REPORT_DATA.performanceSummary.environmental.peakConsumption],
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
      ["Supplier Diversity", ESG_REPORT_DATA.performanceSummary.social.supplierDiversity],
      ["Customer Satisfaction", ESG_REPORT_DATA.performanceSummary.social.customerSatisfaction],
    ];

    const govData = [
      ["Corporate Governance", ESG_REPORT_DATA.performanceSummary.governance.corporateGovernance],
      ["ISO 9001 Compliance", ESG_REPORT_DATA.performanceSummary.governance.iso9001Compliance],
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

    // Financial & Carbon KPIs
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text("Financial & Carbon KPIs", 20, doc.lastAutoTable.finalY + 15);

    const financialData = [
      ["Carbon Tax Exposure", ESG_REPORT_DATA.financialCarbonKPIs.carbonTaxExposure],
      ["Tax Allowances", ESG_REPORT_DATA.financialCarbonKPIs.taxAllowances],
      ["Carbon Credits", ESG_REPORT_DATA.financialCarbonKPIs.carbonCredits],
      ["Energy Savings", ESG_REPORT_DATA.financialCarbonKPIs.energySavings],
      ["Cost Savings Potential", ESG_REPORT_DATA.financialCarbonKPIs.costSavingsPotential],
    ];

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [["Financial & Carbon KPIs", "Value"]],
      body: financialData,
      theme: "grid",
      headStyles: { fillColor: [245, 158, 11] },
      margin: { left: 20, right: 20 },
    });

    // AI Analyst Insights
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text("AI Analyst Insights", 20, doc.lastAutoTable.finalY + 20);

    const insightsData = ESG_REPORT_DATA.aiAnalystInsights.map((insight, index) => [
      `${index + 1}.`,
      insight,
    ]);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 25,
      head: [["#", "Insight"]],
      body: insightsData,
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
    csvRows.push(["Water Usage", totalWater || 0, "m³"]);
    csvRows.push(["Waste Generated", totalWaste || 0, "tonnes"]);
    csvRows.push(["Fuel Consumption", totalFuel || 0, "liters"]);
    csvRows.push([]);
    
    // Monthly data
    if (monthlySeries && monthlySeries.length > 0) {
      csvRows.push(["MONTHLY DATA"]);
      csvRows.push(["Month", "Energy (kWh)", "Carbon (tCO₂e)", "Water (m³)", "Waste (t)", "Fuel (L)"]);
      
      monthlySeries.forEach(item => {
        csvRows.push([
          item.name,
          item.energy || 0,
          item.carbon || 0,
          item.water || 0,
          item.waste || 0,
          item.fuel || 0,
        ]);
      });
    }
    
    // Invoice data (if available)
    if (invoiceSummaries && invoiceSummaries.length > 0) {
      csvRows.push([]);
      csvRows.push(["INVOICE DATA"]);
      csvRows.push(["Company", "Invoice Date", "Tax Invoice #", "Categories", "6-Month Energy (kWh)", "Current Charges (R)", "Est. Carbon (tCO₂e)"]);
      
      invoiceSummaries.slice(0, 10).forEach(inv => {
        const sixMonthEnergy = getInvoiceSixMonthEnergy(inv);
        const estimatedCarbon = sixMonthEnergy * EF_ELECTRICITY_T_PER_KWH;
        
        csvRows.push([
          getCompanyName(inv),
          inv.invoice_date || "—",
          getTaxInvoiceIdentifier(inv) || "—",
          getInvoiceCategoriesText(inv),
          sixMonthEnergy || 0,
          inv.total_current_charges || 0,
          estimatedCarbon || 0,
        ]);
      });
    }
    
    return csvRows;
  };

  const generateTextReport = () => {
    const lines = [];
    
    lines.push("=".repeat(60));
    lines.push("ESG PERFORMANCE REPORT");
    lines.push("Generated by AfricaESG.AI Platform");
    lines.push("=".repeat(60));
    lines.push("");
    
    lines.push("COMPANY INFORMATION");
    lines.push(`Company: ${ESG_REPORT_DATA.companyInfo.company}`);
    lines.push(`Report Period: ${ESG_REPORT_DATA.companyInfo.reportPeriod}`);
    lines.push("");
    
    lines.push("ESG PERFORMANCE SUMMARY");
    lines.push("");
    lines.push("Environmental (from Invoice Analysis):");
    lines.push(`- Energy Consumption: ${ESG_REPORT_DATA.performanceSummary.environmental.energyConsumption}`);
    lines.push(`- Renewable Energy: ${ESG_REPORT_DATA.performanceSummary.environmental.renewableEnergy}`);
    lines.push(`- Carbon Emissions: ${ESG_REPORT_DATA.performanceSummary.environmental.carbonEmissions}`);
    lines.push(`- Monthly Average: ${ESG_REPORT_DATA.performanceSummary.environmental.monthlyAverage}`);
    lines.push(`- Peak Consumption: ${ESG_REPORT_DATA.performanceSummary.environmental.peakConsumption}`);
    lines.push("");
    
    lines.push("Social:");
    lines.push(`- Supplier Diversity: ${ESG_REPORT_DATA.performanceSummary.social.supplierDiversity}`);
    lines.push(`- Customer Satisfaction: ${ESG_REPORT_DATA.performanceSummary.social.customerSatisfaction}`);
    lines.push("");
    
    lines.push("Governance:");
    lines.push(`- Corporate Governance: ${ESG_REPORT_DATA.performanceSummary.governance.corporateGovernance}`);
    lines.push(`- ISO 9001 Compliance: ${ESG_REPORT_DATA.performanceSummary.governance.iso9001Compliance}`);
    lines.push("");
    
    lines.push("FINANCIAL & CARBON KPIs");
    lines.push(`- Carbon Tax Exposure: ${ESG_REPORT_DATA.financialCarbonKPIs.carbonTaxExposure}`);
    lines.push(`- Tax Allowances: ${ESG_REPORT_DATA.financialCarbonKPIs.taxAllowances}`);
    lines.push(`- Carbon Credits: ${ESG_REPORT_DATA.financialCarbonKPIs.carbonCredits}`);
    lines.push(`- Energy Savings: ${ESG_REPORT_DATA.financialCarbonKPIs.energySavings}`);
    lines.push(`- Cost Savings Potential: ${ESG_REPORT_DATA.financialCarbonKPIs.costSavingsPotential}`);
    lines.push("");
    
    lines.push("AI ANALYST INSIGHTS");
    ESG_REPORT_DATA.aiAnalystInsights.forEach((insight, index) => {
      lines.push(`${index + 1}. ${insight}`);
    });
    lines.push("");
    lines.push("=".repeat(60));
    lines.push(`Generated on: ${new Date().toLocaleString()}`);
    lines.push("AfricaESG.AI © 2024");
    
    return lines.join("\n");
  };

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

  const handleDownloadESGReport = async (format) => {
    try {
      const timestamp = new Date().toISOString().split('T')[0];

      switch (format) {
        case "pdf":
          const pdfDoc = generateESGReportPDF();
          pdfDoc.save(`AfricaESG_Report_${timestamp}.pdf`);
          break;

        case "txt":
          const textContent = generateTextReport();
          const textBlob = new Blob([textContent], { type: "text/plain;charset=utf-8;" });
          const textUrl = URL.createObjectURL(textBlob);
          const textLink = document.createElement("a");
          textLink.href = textUrl;
          textLink.download = `ESG_Report_${timestamp}.txt`;
          document.body.appendChild(textLink);
          textLink.click();
          document.body.removeChild(textLink);
          URL.revokeObjectURL(textUrl);
          break;

        default:
          const defaultPdf = generateESGReportPDF();
          defaultPdf.save(`AfricaESG_Report_${timestamp}.pdf`);
      }

      console.log(`Downloaded ${format} ESG report successfully`);
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to generate ESG report. Please try again.");
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "esg-report":
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">ESG Performance Report</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4">
                  <p className="text-sm font-medium text-emerald-700 mb-1">Company</p>
                  <p className="text-lg font-bold text-emerald-900">{ESG_REPORT_DATA.companyInfo.company}</p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4">
                  <p className="text-sm font-medium text-blue-700 mb-1">Report Period</p>
                  <p className="text-lg font-bold text-blue-900">{ESG_REPORT_DATA.companyInfo.reportPeriod}</p>
                </div>
              </div>
            </div>

            {/* ESG Performance Summary */}
            <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">ESG Performance Summary</h2>
              
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <FiZap className="text-emerald-600" />
                  Environmental Performance
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <ESGMetricCard
                    title="Energy Consumption"
                    value={ESG_REPORT_DATA.performanceSummary.environmental.energyConsumption}
                    icon={FiZap}
                    color="emerald"
                  />
                  <ESGMetricCard
                    title="Renewable Energy"
                    value={ESG_REPORT_DATA.performanceSummary.environmental.renewableEnergy}
                    icon={FaLeaf}
                    color="green"
                  />
                  <ESGMetricCard
                    title="Carbon Emissions"
                    value={ESG_REPORT_DATA.performanceSummary.environmental.carbonEmissions}
                    icon={FiCloud}
                    color="red"
                  />
                  <ESGMetricCard
                    title="Monthly Average"
                    value={ESG_REPORT_DATA.performanceSummary.environmental.monthlyAverage}
                    icon={FiActivity}
                    color="blue"
                  />
                  <ESGMetricCard
                    title="Peak Consumption"
                    value={ESG_REPORT_DATA.performanceSummary.environmental.peakConsumption}
                    icon={FiZap}
                    color="amber"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <FiActivity className="text-blue-600" />
                    Social Performance
                  </h3>
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4">
                      <p className="text-sm font-medium text-blue-700 mb-1">Supplier Diversity</p>
                      <p className="text-2xl font-bold text-blue-900">{ESG_REPORT_DATA.performanceSummary.social.supplierDiversity}</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4">
                      <p className="text-sm font-medium text-purple-700 mb-1">Customer Satisfaction</p>
                      <p className="text-2xl font-bold text-purple-900">{ESG_REPORT_DATA.performanceSummary.social.customerSatisfaction}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <FiCheckCircle className="text-indigo-600" />
                    Governance Performance
                  </h3>
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4">
                      <p className="text-sm font-medium text-indigo-700 mb-1">Corporate Governance</p>
                      <p className="text-2xl font-bold text-indigo-900">{ESG_REPORT_DATA.performanceSummary.governance.corporateGovernance}</p>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4">
                      <p className="text-sm font-medium text-emerald-700 mb-1">ISO 9001 Compliance</p>
                      <p className="text-2xl font-bold text-emerald-900">{ESG_REPORT_DATA.performanceSummary.governance.iso9001Compliance}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial & Carbon KPIs */}
            <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Financial & Carbon KPIs</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <ESGMetricCard
                  title="Carbon Tax Exposure"
                  value={ESG_REPORT_DATA.financialCarbonKPIs.carbonTaxExposure}
                  icon={FiDollarSign}
                  color="red"
                />
                <ESGMetricCard
                  title="Tax Allowances"
                  value={ESG_REPORT_DATA.financialCarbonKPIs.taxAllowances}
                  icon={FiDollarSign}
                  color="green"
                />
                <ESGMetricCard
                  title="Carbon Credits"
                  value={ESG_REPORT_DATA.financialCarbonKPIs.carbonCredits}
                  icon={FaLeaf}
                  color="emerald"
                  unit="tonnes"
                />
                <ESGMetricCard
                  title="Energy Savings"
                  value={ESG_REPORT_DATA.financialCarbonKPIs.energySavings}
                  icon={FiZap}
                  color="blue"
                />
                <ESGMetricCard
                  title="Cost Savings Potential"
                  value={ESG_REPORT_DATA.financialCarbonKPIs.costSavingsPotential}
                  icon={FiDollarSign}
                  color="amber"
                />
              </div>
            </div>

            {/* AI Analyst Insights */}
            <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">AI Analyst Insights</h2>
              <div className="space-y-4">
                {ESG_REPORT_DATA.aiAnalystInsights.map((insight, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-4 p-4 bg-gradient-to-r from-gray-50 to-white border border-gray-100 rounded-xl hover:border-emerald-200 transition-colors"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">{index + 1}</span>
                    </div>
                    <p className="text-gray-700 leading-relaxed">{insight}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Download Button for ESG Report */}
            <div className="flex justify-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleDownloadESGReport("pdf")}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-6 py-3 rounded-full shadow-lg hover:shadow-xl text-sm font-semibold transition-all"
              >
                <FiDownload className="w-5 h-5" />
                Download Full ESG Report (PDF)
              </motion.button>
            </div>
          </div>
        );

      case "invoices":
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl border border-gray-200 shadow-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Invoice Records
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    View processed invoice data with energy and cost metrics
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
              <InvoiceTable
                invoices={invoiceSummaries}
                onViewDetails={handleViewInvoiceDetails}
              />
            </div>

            {invoiceSummaries.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                      <FiDollarSign className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-900">
                        Total Charges
                      </p>
                      <p className="text-2xl font-bold text-blue-700">
                        R{" "}
                        {totalCurrentCharges.toLocaleString(undefined, {
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
                          maximumFractionDigits: 0,
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
                  maximumFractionDigits: 0,
                })}
                unit="tCO₂e"
                icon={FiCloud}
                color="red"
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl border border-gray-200 shadow-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Energy vs Energy Intensity
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Energy consumption alongside derived energy intensity
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
                  maximumFractionDigits: 0,
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
              <KpiCard
                title="Water Usage"
                value={totalWater.toLocaleString()}
                unit="m³"
                icon={FiDroplet}
                color="blue"
              />
            </div>

            <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl border border-gray-200 shadow-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Energy vs Carbon Intensity
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Energy consumption vs calculated carbon intensity (tCO₂e/kWh)
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
        );

      case "water":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <KpiCard
                title="Water Usage"
                value={totalWater.toLocaleString()}
                unit="m³"
                icon={FiDroplet}
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
                  maximumFractionDigits: 0,
                })}
                unit="tCO₂e"
                icon={FiCloud}
                color="red"
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

            <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl border border-gray-200 shadow-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Water Usage Trend
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Water consumption over time based on uploaded data
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
                  maximumFractionDigits: 0,
                })}
                unit="tCO₂e"
                icon={FiCloud}
                color="red"
              />
              <KpiCard
                title="Water Usage"
                value={totalWater.toLocaleString()}
                unit="m³"
                icon={FiDroplet}
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

            <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl border border-gray-200 shadow-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Waste Generation Trend
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Waste generated over time based on uploaded data
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
                  maximumFractionDigits: 0,
                })}
                unit="tCO₂e"
                icon={FiCloud}
                color="red"
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
            </div>

            <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl border border-gray-200 shadow-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Fuel Usage Trend
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Fuel consumption over time based on uploaded data
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-gradient-to-br from-white to-gray-50 rounded-3xl border border-gray-200 shadow-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Environmental Performance
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Combined view of energy consumption and carbon emissions
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
                      Environmental performance across key metrics
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
                    Invoice PDF Processing
                  </h2>
                  <p className="text-xs text-gray-500 mt-1 max-w-xl">
                    Upload bulk PDF invoices and view cost &amp; usage data per
                    invoice. Energy reflects the last 6 months on each invoice.
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
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

                  <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                    <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">
                      Total amount due (R)
                    </div>
                    <div className="text-xl font-bold text-amber-900 mt-1 tabular-nums">
                      {totalAmountDue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <div className="text-[11px] text-amber-700/80 mt-0.5">
                      Across last 6 invoices
                    </div>
                  </div>
                </div>
              )}

              {!invoiceLoading &&
                !invoiceError &&
                invoiceSummaries.length === 0 && (
                  <p className="text-xs text-slate-500">
                    No invoice PDFs processed yet. Upload a bulk set to see the
                    extracted data here.
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
                      </tr>
                    </thead>
                    <tbody>
                      {groupedInvoices.map((group) =>
                        group.rows.map((inv, idx) => {
                          const categoriesText = getInvoiceCategoriesText(inv);
                          const showCompanyCell = idx === 0;

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
                Generated commentary based on your uploaded environmental
                metrics and invoice data.
              </p>

              <div className="flex-1 min-h-0">
                {loading || invoiceAiLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
                        <div className="h-3 bg-slate-200 rounded w-full" />
                      </div>
                    ))}
                  </div>
                ) : error || invoiceAiError ? (
                  <div className="p-4 bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200 rounded-xl">
                    <p className="text-rose-600 text-sm">
                      {error || invoiceAiError}
                    </p>
                  </div>
                ) : hasInvoiceInsights ||
                  (currentMetrics.insights &&
                    currentMetrics.insights.length > 0) ? (
                  <div className="h-full overflow-hidden">
                    <ul className="h-full overflow-y-auto pr-2 space-y-3">
                      {(hasInvoiceInsights
                        ? invoiceAiInsights
                        : currentMetrics.insights || []
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
                ) : (
                  <div className="text-center py-8">
                    <FiActivity className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600 text-sm">
                      Upload environmental data or invoices to generate AI
                      insights
                    </p>
                  </div>
                )}
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
                    <h2 className="text-2xl font-bold text-gray-900">
                      Invoice Details
                    </h2>
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
                        <FiDollarSign className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-900">
                          Total Charges
                        </p>
                        <p className="text-xl font-bold text-blue-700">
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
                              Carbon (tCO₂e)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {history.map((month, index) => {
                            const monthEnergy =
                              Number(
                                month.energyKWh ?? month.energy_kwh ?? 0
                              ) || 0;
                            const monthCharges =
                              Number(
                                month.total_current_charges ??
                                  month.current_charges ??
                                  0
                              ) || 0;
                            const monthCarbon =
                              monthEnergy * EF_ELECTRICITY_T_PER_KWH;

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
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-emerald-700 uppercase">
              AfricaESG.AI
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              ESG – Environmental
            </h1>
            <p className="mt-2 text-sm text-gray-600 max-w-2xl">
              Energy, carbon, water, waste, and fuel performance with PDF
              invoice integration for automated data extraction.
            </p>
          </div>

          {/* ✅ UPDATED: Enhanced Download Button */}
          <DownloadButton
            totalEnergyKwh={totalEnergyKwh}
            totalEnergy={totalEnergy}
            totalInvoiceCo2Tonnes={totalInvoiceCo2Tonnes}
            totalWater={totalWater}
            totalWaste={totalWaste}
            totalFuel={totalFuel}
            invoiceSummaries={invoiceSummaries}
            chartData={chartData}
            activeTab={activeTab}
            monthlySeries={monthlySeries}
            onGenerateESGReport={handleDownloadESGReport}
            onGenerateEnvironmentalReport={handleDownloadEnvironmentalReport}
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

        <footer className="mt-8 pt-6 border-t border-gray-200 text-center">
          <div className="text-sm text-gray-600">
            <p>Powered by AfricaESG.AI</p>
          </div>
        </footer>
      </div>

      <InvoiceDetailModal />
    </div>
  );
}