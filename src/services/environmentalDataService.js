// src/services/environmentalDataService.js
/**
 * Environmental Data Service
 * Handles fetching, processing, and caching environmental metrics data
 * Mirrors the pattern from EnvironmentalCategory.jsx for data pulling
 */

import { API_BASE_URL } from "../config/api";
import { formatFetchError } from "../utils/fetchError";

/**
 * Fetch environmental metrics from backend API
 */
export async function fetchEnvironmentalMetrics() {
  try {
    console.log("Fetching environmental metrics from API...");

    const response = await fetch(
      `${API_BASE_URL}/api/environmental-metrics`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(
        `Failed to fetch environmental metrics: ${response.status} - ${errorText}`
      );
      return null;
    }

    const data = await response.json();
    console.log("Environmental metrics fetched successfully:", data);
    return data;
  } catch (error) {
    console.error("Error fetching environmental metrics:", error);
    return null;
  }
}

/**
 * Fetch environmental insights (AI-generated)
 */
export async function fetchEnvironmentalInsights(metrics) {
  try {
    console.log("Fetching environmental insights...");

    const response = await fetch(
      `${API_BASE_URL}/api/environmental-insights`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ metrics }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(
        `Failed to fetch environmental insights: ${response.status} - ${errorText}`
      );
      return null;
    }

    const data = await response.json();
    console.log("Environmental insights fetched successfully:", data);
    return data;
  } catch (error) {
    console.error("Error fetching environmental insights:", error);
    return null;
  }
}

/**
 * Fetch invoice environmental insights
 */
export async function fetchInvoiceEnvironmentalInsights(lastN = 6) {
  try {
    console.log(`Fetching invoice environmental insights (last ${lastN})...`);

    const response = await fetch(
      `${API_BASE_URL}/api/invoice-environmental-insights?last_n=${lastN}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(
        `Failed to fetch invoice environmental insights: ${response.status} - ${errorText}`
      );
      return null;
    }

    const data = await response.json();
    console.log("Invoice environmental insights fetched successfully:", data);
    return data;
  } catch (error) {
    console.error("Error fetching invoice environmental insights:", error);
    return null;
  }
}

/**
 * Fetch ESG data (can use GET or POST)
 */
export async function fetchESGData() {
  try {
    console.log("Fetching ESG data...");

    let response = await fetch(`${API_BASE_URL}/api/esg-data`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Fallback to POST if GET returns 405
    if (response.status === 405) {
      console.log("GET method not allowed, trying POST...");
      response = await fetch(`${API_BASE_URL}/api/esg-data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Failed to fetch ESG data: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    console.log("ESG data fetched successfully:", data);
    return data;
  } catch (error) {
    console.error("Error fetching ESG data:", error);
    return null;
  }
}

/**
 * Fetch invoices from backend
 */
export async function fetchInvoices() {
  try {
    console.log("Fetching invoices...");

    const response = await fetch(`${API_BASE_URL}/api/invoices`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Failed to fetch invoices: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    console.log("Invoices fetched successfully:", data);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return null;
  }
}

/**
 * Upload bulk invoices (PDF files)
 */
export async function uploadBulkInvoices(files) {
  try {
    if (!files || files.length === 0) {
      throw new Error("No files provided");
    }

    console.log(`Uploading ${files.length} invoice PDFs...`);

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      if (file.name.toLowerCase().endsWith(".pdf")) {
        formData.append("files", file);
      }
    });

    const response = await fetch(`${API_BASE_URL}/api/invoice-bulk-upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Invoice upload failed: ${response.status} ${errorText}`
      );
    }

    const summaries = await response.json();
    console.log("Invoices uploaded successfully:", summaries);
    return Array.isArray(summaries) ? summaries : [];
  } catch (error) {
    console.error("Error uploading invoices:", error);
    throw error;
  }
}

/**
 * Process and normalize environmental metrics data
 */
export function normalizeEnvironmentalMetrics(rawMetrics) {
  if (!rawMetrics) {
    return {
      energyUsage: [],
      co2Emissions: [],
      waste: [],
      fuelUsage: [],
    };
  }

  return {
    energyUsage: Array.isArray(rawMetrics.energyUsage)
      ? rawMetrics.energyUsage
      : [],
    co2Emissions: Array.isArray(rawMetrics.co2Emissions)
      ? rawMetrics.co2Emissions
      : [],
    waste: Array.isArray(rawMetrics.waste) ? rawMetrics.waste : [],
    fuelUsage: Array.isArray(rawMetrics.fuelUsage) ? rawMetrics.fuelUsage : [],
  };
}

/**
 * Calculate totals from metrics arrays
 */
export function calculateMetricsTotals(metrics) {
  const safe = normalizeEnvironmentalMetrics(metrics);

  return {
    totalEnergy: safe.energyUsage.reduce((s, v) => s + (v || 0), 0),
    totalCarbon: safe.co2Emissions.reduce((s, v) => s + (v || 0), 0),
    totalWaste: safe.waste.reduce((s, v) => s + (v || 0), 0),
    totalFuel: safe.fuelUsage.reduce((s, v) => s + (v || 0), 0),
    avgCarbon:
      safe.co2Emissions.length > 0
        ? safe.co2Emissions.reduce((s, v) => s + (v || 0), 0) /
          safe.co2Emissions.length
        : 0,
  };
}

/**
 * Local storage helpers for invoice persistence
 */
export function saveInvoiceSummariesToStorage(invoices) {
  try {
    localStorage.setItem("invoiceSummaries", JSON.stringify(invoices));
    return true;
  } catch (e) {
    console.warn("Failed to persist invoices to localStorage", e);
    return false;
  }
}

export function loadInvoiceSummariesFromStorage() {
  try {
    const stored = localStorage.getItem("invoiceSummaries");
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    console.warn("Failed to load invoices from localStorage", e);
  }
  return [];
}

/**
 * Clear cached invoice data
 */
export function clearInvoiceCache() {
  try {
    localStorage.removeItem("invoiceSummaries");
    return true;
  } catch (e) {
    console.warn("Failed to clear invoice cache", e);
    return false;
  }
}

/**
 * Format error messages for environmental data operations
 */
export function formatEnvironmentalError(error) {
  return formatFetchError(error);
}
