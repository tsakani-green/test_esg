// src/INDEX_ENVIRONMENTAL_DATA.js
/**
 * Environmental Data System - Master Index
 * 
 * This file serves as a reference point for all environmental data
 * fetching, state management, and utility functions.
 * 
 * All exports are re-exported from their source modules for convenience.
 */

// ============================================================================
// SERVICES - Core API Communication
// ============================================================================

export {
  // Fetch functions
  fetchEnvironmentalMetrics,
  fetchEnvironmentalInsights,
  fetchInvoiceEnvironmentalInsights,
  fetchESGData,
  fetchInvoices,
  uploadBulkInvoices,

  // Processing functions
  normalizeEnvironmentalMetrics,
  calculateMetricsTotals,

  // Storage functions
  saveInvoiceSummariesToStorage,
  loadInvoiceSummariesFromStorage,
  clearInvoiceCache,

  // Error formatting
  formatEnvironmentalError,
} from "./services/environmentalDataService";

// ============================================================================
// HOOKS - React State Management
// ============================================================================

export {
  // Main hook for environmental data
  useEnvironmentalData,

  // Hook for chart data
  useEnvironmentalChartData,
} from "./hooks/useEnvironmentalData";

// ============================================================================
// UTILITIES - Data Processing & Formatting
// ============================================================================

export {
  // Invoice data extraction
  getCompanyName,
  getCompanyNameFromFilename,
  getInvoiceCategoriesText,
  parseInvoiceDate,
  getLastNInvoices,
  getInvoiceSixMonthEnergy,

  // Invoice data grouping & aggregation
  groupInvoicesByCompany,
  calculateInvoiceAggregates,
  sortInvoicesChronologically,

  // Value formatting
  formatCurrency,
  formatEnergy,

  // File utilities
  isValidInvoicePDF,
  extractPDFFiles,
} from "./utils/invoiceHelpers";

export {
  // Error formatting
  formatFetchError,
  isFetchError,
  createFetchErrorHandler,
} from "./utils/fetchError";

// ============================================================================
// TYPE DEFINITIONS & CONSTANTS
// ============================================================================

/**
 * Environmental Metrics Object Structure
 * @typedef {Object} EnvironmentalMetrics
 * @property {number[]} energyUsage - Energy consumption in kWh (6 months)
 * @property {number[]} co2Emissions - CO2 emissions in tCO₂e (6 months)
 * @property {number[]} waste - Waste in tonnes (6 months)
 * @property {number[]} fuelUsage - Fuel consumption in liters (6 months)
 */

/**
 * Invoice Summary Object Structure
 * @typedef {Object} InvoiceSummary
 * @property {string} id - Unique identifier
 * @property {string} company_name - Company name
 * @property {string} filename - Original filename
 * @property {string} tax_invoice_number - Invoice number
 * @property {string} invoice_date - Invoice date
 * @property {string} due_date - Due date
 * @property {number} total_current_charges - Current charges in currency
 * @property {number} total_amount_due - Amount due in currency
 * @property {number} six_month_energy_kwh - 6-month energy total
 * @property {string[]} categories - Invoice categories
 */

/**
 * Metrics Totals Object Structure
 * @typedef {Object} MetricsTotals
 * @property {number} totalEnergy - Sum of energy usage
 * @property {number} totalCarbon - Sum of carbon emissions
 * @property {number} totalWaste - Sum of waste
 * @property {number} totalFuel - Sum of fuel usage
 * @property {number} avgCarbon - Average carbon per period
 */

/**
 * Hook Return Value Structure
 * @typedef {Object} UseEnvironmentalDataReturn
 * @property {EnvironmentalMetrics} metrics - Environmental metrics data
 * @property {boolean} metricsLoading - Loading state
 * @property {string|null} metricsError - Error message if any
 * @property {Function} loadMetrics - Function to load metrics
 * @property {string[]} insights - AI insights array
 * @property {boolean} insightsLoading - Insights loading state
 * @property {string|null} insightsError - Insights error message
 * @property {Object} insightsMeta - Insights metadata {live, timestamp}
 * @property {Function} loadInsights - Function to load insights
 * @property {InvoiceSummary[]} invoices - Invoice data array
 * @property {boolean} invoicesLoading - Invoices loading state
 * @property {string|null} invoicesError - Invoices error message
 * @property {Function} loadInvoices - Function to load invoices
 * @property {string[]} invoiceInsights - Invoice insights array
 * @property {boolean} invoiceInsightsLoading - Invoice insights loading state
 * @property {string|null} invoiceInsightsError - Invoice insights error
 * @property {Function} loadInvoiceInsights - Function to load invoice insights
 * @property {MetricsTotals} totals - Calculated metric totals
 * @property {Function} retry - Function to retry failed operations
 */

// ============================================================================
// COMMON PATTERNS
// ============================================================================

/**
 * PATTERN 1: Basic Data Loading
 * 
 * import { useEnvironmentalData } from "@/hooks/useEnvironmentalData";
 * 
 * function Component() {
 *   const { metrics, metricsLoading, loadMetrics } = useEnvironmentalData();
 *   
 *   useEffect(() => {
 *     loadMetrics();
 *   }, [loadMetrics]);
 *   
 *   return metricsLoading ? <Spinner /> : <Display data={metrics} />;
 * }
 */

/**
 * PATTERN 2: With Charts
 * 
 * import { useEnvironmentalData, useEnvironmentalChartData } from "@/hooks/useEnvironmentalData";
 * 
 * function Component() {
 *   const { metrics, loadMetrics } = useEnvironmentalData();
 *   const chartData = useEnvironmentalChartData(metrics);
 *   
 *   useEffect(() => { loadMetrics(); }, [loadMetrics]);
 *   
 *   return <Chart data={chartData} />;
 * }
 */

/**
 * PATTERN 3: Invoice Processing
 * 
 * import { useEnvironmentalData } from "@/hooks/useEnvironmentalData";
 * import { getLastNInvoices, calculateInvoiceAggregates } from "@/utils/invoiceHelpers";
 * 
 * function Component() {
 *   const { invoices, loadInvoices } = useEnvironmentalData();
 *   
 *   useEffect(() => { loadInvoices(); }, [loadInvoices]);
 *   
 *   const lastSix = getLastNInvoices(invoices, 6);
 *   const stats = calculateInvoiceAggregates(lastSix);
 *   
 *   return <InvoiceTable stats={stats} />;
 * }
 */

/**
 * PATTERN 4: Error Handling
 * 
 * import { useEnvironmentalData } from "@/hooks/useEnvironmentalData";
 * 
 * function Component() {
 *   const { metricsError, metricsLoading, retry } = useEnvironmentalData();
 *   
 *   if (metricsError) {
 *     return (
 *       <div className="error">
 *         <p>{metricsError}</p>
 *         <button onClick={retry}>Retry</button>
 *       </div>
 *     );
 *   }
 *   
 *   return metricsLoading ? <Spinner /> : <Content />;
 * }
 */

// ============================================================================
// QUICK REFERENCE - API ENDPOINTS
// ============================================================================

/**
 * Expected Backend Endpoints
 * 
 * GET  /api/environmental-metrics
 *   Returns: EnvironmentalMetrics
 * 
 * POST /api/environmental-insights
 *   Body: { metrics: EnvironmentalMetrics }
 *   Returns: { insights: string[], live: boolean, timestamp: string }
 * 
 * GET  /api/invoice-environmental-insights?last_n=6
 *   Returns: { insights: string[], metrics: object }
 * 
 * GET  /api/esg-data
 *   Returns: ESG data object
 * 
 * POST /api/esg-data
 *   Body: {}
 *   Returns: ESG data object
 * 
 * GET  /api/invoices
 *   Returns: InvoiceSummary[]
 * 
 * POST /api/invoice-bulk-upload
 *   Body: FormData with files
 *   Returns: InvoiceSummary[]
 */

// ============================================================================
// DOCUMENTATION REFERENCES
// ============================================================================

/**
 * For detailed usage information, see:
 * 
 * 1. README_ENVIRONMENTAL_DATA.md
 *    - Quick overview
 *    - Feature list
 *    - Troubleshooting
 * 
 * 2. ENVIRONMENTAL_DATA_USAGE.md
 *    - Complete API reference
 *    - Hook documentation
 *    - Real-world examples
 * 
 * 3. IMPLEMENTATION_EXAMPLES.md
 *    - Working code examples
 *    - Common patterns
 *    - Complete dashboard example
 * 
 * 4. FETCH_ERROR_HANDLING.md
 *    - Error handling improvements
 *    - User-friendly messages
 * 
 * 5. USAGE_GUIDE.md
 *    - Service layer documentation
 *    - Utility function reference
 */

// ============================================================================
// VERSION INFO
// ============================================================================

export const ENVIRONMENTAL_DATA_VERSION = "1.0.0";
export const CREATED_DATE = "2025-12-15";

// This system provides:
// ✅ Core API service for environmental data
// ✅ React hook for state management
// ✅ Invoice processing utilities
// ✅ Error handling and formatting
// ✅ LocalStorage caching
// ✅ TypeScript-ready code structure

/**
 * Quick Start:
 * 
 * 1. Import the hook:
 *    import { useEnvironmentalData } from "@/hooks/useEnvironmentalData";
 * 
 * 2. Use in component:
 *    const { metrics, loadMetrics } = useEnvironmentalData();
 * 
 * 3. Load data on mount:
 *    useEffect(() => { loadMetrics(); }, [loadMetrics]);
 * 
 * 4. Display in UI:
 *    return <YourComponent data={metrics} />;
 */
