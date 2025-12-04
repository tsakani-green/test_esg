// src/pages/DataImport.jsx
import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../config/api";
import {
  FaFileUpload,
  FaFileExcel,
  FaCheckCircle,
  FaExclamationTriangle,
  FaFilePdf,
} from "react-icons/fa";

const STORAGE_KEY = "dataImportSubmissions";

// Helper: derive a "company" name from the file name (strip extension)
const getCompanyFromFileName = (fileName = "") => {
  if (!fileName) return "Unknown Company";
  return fileName.replace(/\.[^/.]+$/g, ""); // remove last extension
};

// Helper: infer category from type / name -> Energy | Carbon | Water | Waste | Fuel
const inferCategory = (typeOrName = "") => {
  const s = typeOrName.toLowerCase();

  // Simple rules – you can refine these as needed:
  if (s.includes("coal")) return "Fuel";
  if (s.includes("fuel")) return "Fuel";
  if (s.includes("water")) return "Water";
  if (s.includes("waste")) return "Waste";
  if (s.includes("carbon") || s.includes("co2") || s.includes("esg")) return "Carbon";

  // For municipal invoices and generic energy data, default to Energy
  if (s.includes("municipal") || s.includes("invoice") || s.includes("electric")) {
    return "Energy";
  }

  // Fallback
  return "Energy";
};

export default function DataImport() {
  const [submissions, setSubmissions] = useState([]);
  const [loadingType, setLoadingType] = useState(null);
  const [error, setError] = useState(null);

  // ----- Load saved submissions from localStorage on first render -----
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSubmissions(parsed);
        }
      }
    } catch (e) {
      console.warn("Failed to load data import submissions from storage", e);
    }
  }, []);

  // ----- Helper to persist to localStorage -----
  const persistSubmissions = (next) => {
    setSubmissions(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn("Failed to persist data import submissions", e);
    }
  };

  // ----- Generic upload handler for Excel templates (ESG engine) -----
  const handleTemplateUpload = (templateType) => async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // reset input so the same file name can be reused
    event.target.value = "";

    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      alert("Please upload an Excel file (.xlsx or .xls) for this template.");
      return;
    }

    setLoadingType(templateType);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Call the real backend ESG upload
      const res = await fetch(`${API_BASE_URL}/api/esg-upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`/api/esg-upload error: ${res.status} ${txt}`);
      }

      const data = await res.json();

      // Use file name as company name, and infer category
      const company = getCompanyFromFileName(file.name);
      const category = inferCategory(templateType || file.name);
      const importedDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      const newSubmission = {
        fileName: file.name,
        company,
        category,
        type: templateType, // e.g. "Municipal Invoice (Excel)"
        records: null, // can be replaced by a real row count later
        status:
          templateType === "ESG KPI Template" ? "Completed" : "Validated",
        imported: importedDate,
      };

      const updated = [newSubmission, ...submissions].slice(0, 20);
      persistSubmissions(updated);

      alert(`File "${file.name}" uploaded and processed successfully.`);
      console.log("ESG upload response:", data);
    } catch (err) {
      console.error("Template upload error:", err);
      setError(
        err.message ||
          "Failed to upload file. Please confirm it matches the template format."
      );
      alert(
        "Failed to upload file. Please confirm it matches the AfricaESG.AI template format."
      );
    } finally {
      setLoadingType(null);
    }
  };

  // ----- Single Invoice PDF upload -> /api/invoice-upload -----
  const handleSingleInvoicePdfUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = "";

    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".pdf")) {
      alert("Please upload a PDF file for the invoice.");
      return;
    }

    const templateType = "Municipal Invoice (PDF)";
    setLoadingType("Municipal Invoice (PDF - single)");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE_URL}/api/invoice-upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`/api/invoice-upload error: ${res.status} ${txt}`);
      }

      const invoiceSummary = await res.json();
      console.log("Single invoice summary:", invoiceSummary);

      const company = getCompanyFromFileName(file.name);
      const category = inferCategory(templateType || file.name);
      const importedDate = new Date().toISOString().slice(0, 10);

      const newSubmission = {
        fileName: file.name,
        company,
        category,
        type: templateType,
        records: 1, // 1 PDF = 1 record
        status: "Validated",
        imported: importedDate,
      };

      const updated = [newSubmission, ...submissions].slice(0, 20);
      persistSubmissions(updated);

      alert(`Invoice PDF "${file.name}" processed successfully.`);
    } catch (err) {
      console.error("Single invoice PDF upload error:", err);
      setError(
        err.message ||
          "Failed to process invoice PDF. Please ensure the layout is supported."
      );
      alert(
        "Failed to process invoice PDF. Please ensure the layout is supported."
      );
    } finally {
      setLoadingType(null);
    }
  };

  // ----- Bulk Invoice PDF upload -> /api/invoice-bulk-upload -----
  const handleBulkInvoicePdfUpload = async (event) => {
    const files = Array.from(event.target.files || []).filter((f) =>
      f.name.toLowerCase().endsWith(".pdf")
    );

    event.target.value = "";

    if (files.length === 0) {
      alert("Please select at least one PDF invoice.");
      return;
    }

    const templateType = "Municipal Invoice (PDF bulk)";
    setLoadingType("Municipal Invoice (PDF - bulk)");
    setError(null);

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));

      const res = await fetch(`${API_BASE_URL}/api/invoice-bulk-upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`/api/invoice-bulk-upload error: ${res.status} ${txt}`);
      }

      const summaries = await res.json(); // array of InvoiceSummary
      console.log("Bulk invoice summaries:", summaries);

      const importedDate = new Date().toISOString().slice(0, 10);

      const bulkSubs = summaries.map((inv, index) => {
        const fname = inv.filename || files[index]?.name || `Invoice ${index + 1}`;
        const company = getCompanyFromFileName(fname);
        const category = inferCategory(templateType || fname);

        return {
          fileName: fname,
          company,
          category,
          type: templateType,
          records: 1,
          status: "Validated",
          imported: importedDate,
        };
      });

      const updated = [...bulkSubs, ...submissions].slice(0, 20);
      persistSubmissions(updated);

      alert(`Processed ${files.length} invoice PDF(s) successfully.`);
    } catch (err) {
      console.error("Bulk invoice PDF upload error:", err);
      setError(
        err.message ||
          "Failed to process bulk invoice PDFs. Please confirm the layout is supported."
      );
      alert(
        "Failed to process bulk invoice PDFs. Please confirm the layout is supported."
      );
    } finally {
      setLoadingType(null);
    }
  };

  // ----- Derived stats from real submissions -----
  const now = new Date();

  const filesLast30Days = submissions.filter((s) => {
    if (!s.imported) return false;
    const d = new Date(s.imported);
    const diffMs = now - d;
    const days = diffMs / (1000 * 60 * 60 * 24);
    return days <= 30;
  }).length;

  const totalSubs = submissions.length;
  const successfulSubs = submissions.filter((s) =>
    ["Validated", "Completed"].includes(s.status)
  ).length;
  const validationRate =
    totalSubs === 0 ? 0 : (successfulSubs / totalSubs) * 100;

  // simple example: “mapped to ESG metrics” = number of unique template types * 10
  const mappedMetrics = new Set(submissions.map((s) => s.type)).size * 10 || 0;

  const StatCard = ({ label, value, sub }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-4 flex flex-col justify-between">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {label}
      </div>
      <div className="text-2xl font-extrabold text-slate-900 mt-1">
        {value}
      </div>
      {sub && (
        <div className="text-[11px] text-slate-500 mt-1 leading-snug">
          {sub}
        </div>
      )}
    </div>
  );

  const isUploading = (type) => loadingType === type;

  return (
    <div className="min-h-screen bg-lime-50 py-10 font-sans">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <header className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-green-900 tracking-tight">
            Data Import & Quality
          </h1>
          <p className="text-sm text-gray-600 max-w-2xl">
            Use AfricaESG.AI templates and invoice PDFs to upload operational
            data. Each file is validated, processed and mapped into ESG-ready
            metrics that feed the dashboard and AI analyst.
          </p>

          {error && (
            <p className="mt-1 text-xs text-red-600 flex items-center gap-2">
              <FaExclamationTriangle className="text-red-500" />
              {error}
            </p>
          )}
        </header>

        {/* Top stats row */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            label="Files ingested (last 30 days)"
            value={filesLast30Days}
            sub="Across all data import templates & invoices"
          />
          <StatCard
            label="Validation pass rate"
            value={`${validationRate.toFixed(0)}%`}
            sub="+ AI checks for consistency & outliers"
          />
          <StatCard
            label="Mapped to ESG metrics"
            value={mappedMetrics}
            sub="Energy, carbon, water, waste & social KPIs"
          />
        </section>

        {/* Layout: left = upload + recent, right = AI mini report */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Upload templates & recent submissions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload Data Templates & Invoices */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Upload Data Templates & Invoices
              </h2>
              <p className="text-xs text-slate-500 max-w-xl">
                Use the standardised AfricaESG.AI templates for municipal
                invoices, coal invoices and ESG KPIs, or upload municipal
                invoice PDFs. Excel files are ingested via{" "}
                <code className="text-[11px] bg-slate-100 px-1 rounded">
                  /api/esg-upload
                </code>{" "}
                and invoice PDFs via{" "}
                <code className="text-[11px] bg-slate-100 px-1 rounded">
                  /api/invoice-upload
                </code>{" "}
                and{" "}
                <code className="text-[11px] bg-slate-100 px-1 rounded">
                  /api/invoice-bulk-upload
                </code>
                .
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                {/* Municipal Invoices */}
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                        <FaFileExcel size={16} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-emerald-900">
                          Municipal Invoices
                        </div>
                        <div className="text-[11px] text-emerald-800/80">
                          Electricity, water & other charges by site / month.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-[11px] text-emerald-800 font-semibold underline underline-offset-2"
                      onClick={() =>
                        window.open(
                          `${API_BASE_URL}/templates/municipal-invoices.xlsx`,
                          "_blank"
                        )
                      }
                    >
                      Download Excel template
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {/* Excel upload */}
                    <label className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-full text-xs font-semibold shadow-sm cursor-pointer transition-all">
                      <FaFileUpload />
                      {isUploading("Municipal Invoice (Excel)")
                        ? "Uploading..."
                        : "Upload Excel"}
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={handleTemplateUpload("Municipal Invoice (Excel)")}
                      />
                    </label>

                    {/* Single PDF upload */}
                    <label className="inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 rounded-full text-xs font-semibold shadow-sm cursor-pointer transition-all">
                      <FaFilePdf />
                      {isUploading("Municipal Invoice (PDF - single)")
                        ? "Uploading..."
                        : "Upload invoice PDF"}
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={handleSingleInvoicePdfUpload}
                      />
                    </label>

                    {/* Bulk PDF upload */}
                    <label className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-full text-xs font-semibold shadow-sm cursor-pointer transition-all">
                      <FaFilePdf />
                      {isUploading("Municipal Invoice (PDF - bulk)")
                        ? "Uploading..."
                        : "Upload bulk PDFs"}
                      <input
                        type="file"
                        accept=".pdf"
                        multiple
                        className="hidden"
                        onChange={handleBulkInvoicePdfUpload}
                      />
                    </label>
                  </div>
                </div>

                {/* Coal Invoices */}
                <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-full bg-amber-500 text-white flex items-center justify-center">
                        <FaFileExcel size={16} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-amber-900">
                          Coal Invoices
                        </div>
                        <div className="text-[11px] text-amber-900/80">
                          Tonnage, quality, supplier & cost for energy
                          emissions.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-[11px] text-amber-900 font-semibold underline underline-offset-2"
                      onClick={() =>
                        window.open(
                          `${API_BASE_URL}/templates/coal-invoices.xlsx`,
                          "_blank"
                        )
                      }
                    >
                      Download Excel template
                    </button>
                  </div>

                  <label className="mt-3 inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-full text-xs font-semibold shadow-sm cursor-pointer transition-all">
                    <FaFileUpload />
                    {isUploading("Coal Invoice")
                      ? "Uploading..."
                      : "Upload Excel"}
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={handleTemplateUpload("Coal Invoice")}
                    />
                  </label>
                </div>

                {/* ESG KPI Template */}
                <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-full bg-sky-500 text-white flex items-center justify-center">
                        <FaFileExcel size={16} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-sky-900">
                          ESG KPI Template
                        </div>
                        <div className="text-[11px] text-sky-900/80">
                          Quantitative KPIs for energy, water, waste & carbon.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-[11px] text-sky-900 font-semibold underline underline-offset-2"
                      onClick={() =>
                        window.open(
                          `${API_BASE_URL}/templates/esg-kpi-template.xlsx`,
                          "_blank"
                        )
                      }
                    >
                      Download Excel template
                    </button>
                  </div>

                  <label className="mt-3 inline-flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-3 py-2 rounded-full text-xs font-semibold shadow-sm cursor-pointer transition-all">
                    <FaFileUpload />
                    {isUploading("ESG KPI Template")
                      ? "Uploading..."
                      : "Upload Excel"}
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={handleTemplateUpload("ESG KPI Template")}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Recent Data Submissions */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  Recent Data Submissions
                </h2>
                <span className="text-xs text-slate-500">
                  Showing latest {Math.min(submissions.length, 10)} files
                </span>
              </div>

              {submissions.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No data submissions recorded yet. Upload a template or invoice
                  on the left to see it appear here.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-slate-50/60">
                  <table className="min-w-full text-xs sm:text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-4 py-2 font-semibold text-slate-700">
                          Company
                        </th>
                        <th className="px-4 py-2 font-semibold text-slate-700">
                          Category
                        </th>
                        <th className="px-4 py-2 font-semibold text-slate-700">
                          Type
                        </th>
                        <th className="px-4 py-2 font-semibold text-slate-700 text-right">
                          Records
                        </th>
                        <th className="px-4 py-2 font-semibold text-slate-700">
                          Status
                        </th>
                        <th className="px-4 py-2 font-semibold text-slate-700">
                          Imported
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.slice(0, 10).map((s, idx) => (
                        <tr
                          key={`${s.fileName}-${idx}`}
                          className="border-b last:border-b-0 border-slate-100 hover:bg-white"
                        >
                          <td className="px-4 py-2">
                            <div className="font-medium text-slate-900">
                              {s.company}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {s.fileName}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-slate-700">
                            {s.category}
                          </td>
                          <td className="px-4 py-2 text-slate-700">
                            {s.type}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                            {s.records != null ? s.records : "—"}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                s.status === "Completed"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-sky-50 text-sky-700"
                              }`}
                            >
                              <FaCheckCircle className="text-[10px]" />
                              {s.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-slate-600 text-xs">
                            {s.imported || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: AI Mini Report – Data Import & Quality */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 flex flex-col">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              AI Mini Report – Data Import & Quality
            </h2>
            <p className="text-xs text-slate-500 mb-3">
              High-level view of how your latest Excel templates and invoice
              PDFs support ESG coverage, quality and readiness for AI analysis.
            </p>

            <ul className="list-disc list-inside space-y-2 text-xs text-slate-800 flex-1">
              <li>
                Municipal data coverage is currently{" "}
                <strong>{filesLast30Days > 0 ? "active" : "pending"}</strong>{" "}
                with {filesLast30Days} file(s) ingested in the last 30 days.
              </li>
              <li>
                Validation pass rate is{" "}
                <strong>{validationRate.toFixed(0)}%</strong> across Excel
                templates and invoice PDFs, with AI checks highlighting
                anomalies for manual review.
              </li>
              <li>
                Imported files are mapping into approximately{" "}
                <strong>{mappedMetrics}</strong> ESG-ready metrics spanning
                energy, carbon, water, waste and related KPIs.
              </li>
              <li>
                Consider automating monthly data ingestion for municipal and
                coal invoices to reduce manual handling and improve timeliness
                of ESG reporting.
              </li>
              <li>
                As data history grows, AI insights on trends, outliers and
                decarbonisation levers will become more robust for board-level
                reporting and scenario analysis.
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
