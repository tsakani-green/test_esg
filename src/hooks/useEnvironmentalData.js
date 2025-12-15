// src/hooks/useEnvironmentalData.js
/**
 * Custom Hook: useEnvironmentalData
 * Manages fetching and state management for environmental metrics and insights
 * Pattern inspired by Energy.jsx data loading
 */

import { useState, useEffect, useCallback } from "react";
import {
  fetchEnvironmentalMetrics,
  fetchEnvironmentalInsights,
  fetchInvoiceEnvironmentalInsights,
  fetchInvoices,
  normalizeEnvironmentalMetrics,
  calculateMetricsTotals,
  saveInvoiceSummariesToStorage,
  loadInvoiceSummariesFromStorage,
  formatEnvironmentalError,
} from "../services/environmentalDataService";

export function useEnvironmentalData() {
  // Metrics state
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState(null);

  // Insights state
  const [insights, setInsights] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState(null);
  const [insightsMeta, setInsightsMeta] = useState({ live: false, timestamp: null });

  // Invoice state
  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesError, setInvoicesError] = useState(null);

  // Invoice AI insights state
  const [invoiceInsights, setInvoiceInsights] = useState([]);
  const [invoiceInsightsLoading, setInvoiceInsightsLoading] = useState(false);
  const [invoiceInsightsError, setInvoiceInsightsError] = useState(null);

  // Calculated totals
  const [totals, setTotals] = useState({
    totalEnergy: 0,
    totalCarbon: 0,
    totalWaste: 0,
    totalFuel: 0,
    avgCarbon: 0,
  });

  /**
   * Load environmental metrics
   */
  const loadMetrics = useCallback(async () => {
    try {
      setMetricsLoading(true);
      setMetricsError(null);

      const data = await fetchEnvironmentalMetrics();

      if (data) {
        const normalized = normalizeEnvironmentalMetrics(data);
        setMetrics(normalized);
        const calculated = calculateMetricsTotals(normalized);
        setTotals(calculated);
      } else {
        setMetrics(null);
        setMetricsError("Failed to fetch environmental metrics");
      }
    } catch (err) {
      setMetrics(null);
      setMetricsError(formatEnvironmentalError(err));
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  /**
   * Load environmental insights
   */
  const loadInsights = useCallback(async () => {
    if (!metrics) return;

    try {
      setInsightsLoading(true);
      setInsightsError(null);

      const data = await fetchEnvironmentalInsights(metrics);

      if (data) {
        setInsights(Array.isArray(data.insights) ? data.insights : []);
        setInsightsMeta({
          live: !!data.live,
          timestamp: data.timestamp || null,
        });
      } else {
        setInsights([]);
        setInsightsMeta({ live: false, timestamp: null });
      }
    } catch (err) {
      setInsights([]);
      setInsightsMeta({ live: false, timestamp: null });
      setInsightsError(formatEnvironmentalError(err));
    } finally {
      setInsightsLoading(false);
    }
  }, [metrics]);

  /**
   * Load invoices
   */
  const loadInvoices = useCallback(async () => {
    try {
      setInvoicesLoading(true);
      setInvoicesError(null);

      // Try to fetch from backend first
      const backendData = await fetchInvoices();

      if (backendData && Array.isArray(backendData) && backendData.length > 0) {
        setInvoices(backendData);
        saveInvoiceSummariesToStorage(backendData);
      } else {
        // Fall back to localStorage
        const cached = loadInvoiceSummariesFromStorage();
        setInvoices(cached);
      }
    } catch (err) {
      // Fall back to localStorage on error
      const cached = loadInvoiceSummariesFromStorage();
      setInvoices(cached);
      setInvoicesError(formatEnvironmentalError(err));
    } finally {
      setInvoicesLoading(false);
    }
  }, []);

  /**
   * Load invoice AI insights
   */
  const loadInvoiceInsights = useCallback(async () => {
    if (!invoices || invoices.length === 0) return;

    try {
      setInvoiceInsightsLoading(true);
      setInvoiceInsightsError(null);

      const data = await fetchInvoiceEnvironmentalInsights(6);

      if (data) {
        setInvoiceInsights(Array.isArray(data.insights) ? data.insights : []);
      } else {
        setInvoiceInsights([]);
      }
    } catch (err) {
      setInvoiceInsights([]);
      setInvoiceInsightsError(formatEnvironmentalError(err));
    } finally {
      setInvoiceInsightsLoading(false);
    }
  }, [invoices]);

  /**
   * Retry failed operations
   */
  const retry = useCallback(() => {
    loadMetrics();
  }, [loadMetrics]);

  /**
   * Return state and actions
   */
  return {
    // Metrics
    metrics,
    metricsLoading,
    metricsError,
    loadMetrics,

    // Insights
    insights,
    insightsLoading,
    insightsError,
    insightsMeta,
    loadInsights,

    // Invoices
    invoices,
    invoicesLoading,
    invoicesError,
    loadInvoices,

    // Invoice insights
    invoiceInsights,
    invoiceInsightsLoading,
    invoiceInsightsError,
    loadInvoiceInsights,

    // Totals
    totals,

    // Actions
    retry,
  };
}

/**
 * Hook for managing chart data
 */
export function useEnvironmentalChartData(metrics) {
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    if (!metrics) {
      setChartData([]);
      return;
    }

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    const normalized = normalizeEnvironmentalMetrics(metrics);

    const data = months.map((m, idx) => ({
      name: m,
      energy: normalized.energyUsage[idx] ?? null,
      carbon: normalized.co2Emissions[idx] ?? null,
      waste: normalized.waste[idx] ?? null,
      fuel: normalized.fuelUsage[idx] ?? null,
    }));

    setChartData(data);
  }, [metrics]);

  return chartData;
}
