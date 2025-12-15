// README_ENVIRONMENTAL_DATA.md
# Environmental Data Fetching System

## Quick Overview

A comprehensive data fetching and management system for environmental metrics, AI insights, and invoice processing - inspired by the `EnvironmentalCategory.jsx` pattern.

## What Was Created

### 📦 New Modules

| Module | Purpose | Location |
|--------|---------|----------|
| **Environmental Data Service** | Core API communication | `src/services/environmentalDataService.js` |
| **Environmental Data Hook** | React state management | `src/hooks/useEnvironmentalData.js` |
| **Invoice Helpers** | Data processing utilities | `src/utils/invoiceHelpers.js` |

### 📚 Documentation

| Document | Content |
|----------|---------|
| **ENVIRONMENTAL_DATA_USAGE.md** | Complete API reference and usage guide |
| **IMPLEMENTATION_EXAMPLES.md** | Real-world code examples |
| **README_ENVIRONMENTAL_DATA.md** | This file |

---

## Quick Start

### 1. Basic Setup (Simplest)

```jsx
import { useEnvironmentalData } from "../hooks/useEnvironmentalData";

function MyComponent() {
  const { metrics, metricsLoading, loadMetrics } = useEnvironmentalData();

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  if (metricsLoading) return <div>Loading...</div>;
  
  return <div>Metrics: {JSON.stringify(metrics)}</div>;
}
```

### 2. With Charts and Insights

```jsx
import { useEnvironmentalData, useEnvironmentalChartData } from "../hooks/useEnvironmentalData";
import { LineChart, ... } from "recharts";

function Dashboard() {
  const { metrics, insights, loadMetrics, loadInsights, totals } = useEnvironmentalData();
  const chartData = useEnvironmentalChartData(metrics);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  return (
    <>
      <KPIDisplay totals={totals} />
      <Chart data={chartData} />
      <InsightsList insights={insights} />
    </>
  );
}
```

### 3. With Invoice Processing

```jsx
import { useEnvironmentalData } from "../hooks/useEnvironmentalData";
import { getLastNInvoices, calculateInvoiceAggregates } from "../utils/invoiceHelpers";

function InvoiceView() {
  const { invoices, loadInvoices } = useEnvironmentalData();

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const lastSix = getLastNInvoices(invoices, 6);
  const stats = calculateInvoiceAggregates(lastSix);

  return <InvoiceSummary stats={stats} />;
}
```

---

## Key Features

✅ **Comprehensive API Service**
- Fetch environmental metrics
- Get AI-generated insights
- Manage invoice data
- Upload bulk PDFs
- Handle errors gracefully

✅ **React Hooks for State Management**
- Loading states
- Error handling
- Data caching
- Retry functionality

✅ **Utility Functions**
- Date parsing
- Currency formatting
- Data aggregation
- File validation

✅ **Error Handling**
- Network-aware error messages
- Fallback to localStorage
- User-friendly error display

✅ **Performance**
- Memoized calculations
- LocalStorage caching
- Efficient state updates

---

## File Structure

```
src/
├── services/
│   └── environmentalDataService.js     (NEW) Core API service
├── hooks/
│   └── useEnvironmentalData.js         (NEW) React state hook
├── utils/
│   ├── invoiceHelpers.js              (NEW) Invoice utilities
│   └── fetchError.js                  (EXISTING) Error formatting
└── config/
    └── api.js                          (EXISTING) API configuration
```

---

## API Endpoints Required

The service expects these backend endpoints to exist:

```
GET  /api/environmental-metrics
POST /api/environmental-insights
GET  /api/invoice-environmental-insights?last_n=6
GET  /api/esg-data
POST /api/esg-data
GET  /api/invoices
POST /api/invoice-bulk-upload
```

---

## Data Flow

```
┌─────────────────────────────────────────┐
│  React Component                         │
│  (e.g., Dashboard.jsx)                  │
└────────────┬────────────────────────────┘
             │
             │ uses
             ▼
┌─────────────────────────────────────────┐
│  useEnvironmentalData Hook              │
│  (manages state & loading)              │
└────────────┬────────────────────────────┘
             │
             │ calls
             ▼
┌─────────────────────────────────────────┐
│  Environmental Data Service             │
│  (API communication)                    │
└────────────┬────────────────────────────┘
             │
             │ uses
             ▼
┌─────────────────────────────────────────┐
│  Invoice Helpers & Fetch Error Utils    │
│  (data processing)                      │
└─────────────────────────────────────────┘
```

---

## State Management Pattern

Each hook manages multiple related states:

```javascript
{
  // Primary data
  metrics,
  metricsLoading,
  metricsError,
  
  // Insights
  insights,
  insightsLoading,
  insightsError,
  insightsMeta: { live, timestamp },
  
  // Invoices
  invoices,
  invoicesLoading,
  invoicesError,
  
  // Invoice insights
  invoiceInsights,
  invoiceInsightsLoading,
  invoiceInsightsError,
  
  // Calculated values
  totals: { totalEnergy, totalCarbon, totalWaste, totalFuel, avgCarbon },
  
  // Actions
  loadMetrics,
  loadInsights,
  loadInvoices,
  loadInvoiceInsights,
  retry
}
```

---

## Common Use Cases

### Display KPI Cards
```jsx
<div className="grid grid-cols-4 gap-4">
  <KPICard label="Energy" value={totals.totalEnergy} unit="kWh" />
  <KPICard label="Carbon" value={totals.totalCarbon} unit="tCO₂e" />
  <KPICard label="Waste" value={totals.totalWaste} unit="t" />
  <KPICard label="Fuel" value={totals.totalFuel} unit="L" />
</div>
```

### Show Charts
```jsx
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={chartData}>
    <Line dataKey="energy" stroke="#16a34a" />
    <Line dataKey="carbon" stroke="#ef4444" />
  </LineChart>
</ResponsiveContainer>
```

### Process Invoices
```jsx
const lastSix = getLastNInvoices(invoices, 6);
const grouped = groupInvoicesByCompany(lastSix);
const stats = calculateInvoiceAggregates(lastSix);
```

### Display AI Insights
```jsx
<div>
  {insights.map((insight, i) => (
    <p key={i}>{insight}</p>
  ))}
</div>
```

---

## Error Handling

All errors are formatted for users:

```javascript
const { metricsError, retry } = useEnvironmentalData();

if (metricsError) {
  return (
    <ErrorBox 
      message={metricsError}
      onRetry={retry}
    />
  );
}
```

Common error messages:
- "Unable to connect to the server. Please check your internet connection..."
- "Server error. The service is temporarily unavailable..."
- "Authentication failed. Please log in again."
- "The requested resource was not found..."

---

## Caching Strategy

Invoice data is automatically persisted:

```javascript
// Automatically saved
saveInvoiceSummariesToStorage(invoices);

// Automatically loaded as fallback
const cached = loadInvoiceSummariesFromStorage();

// Manual clear
clearInvoiceCache();
```

---

## Performance Tips

1. **Memoize heavy calculations:**
```jsx
const totals = useMemo(() => calculateMetricsTotals(metrics), [metrics]);
```

2. **Lazy load insights:**
```jsx
useEffect(() => {
  if (metrics) loadInsights();
}, [metrics, loadInsights]);
```

3. **Use chart data hook:**
```jsx
const chartData = useEnvironmentalChartData(metrics); // Already memoized
```

4. **Debounce rapid requests:**
```jsx
const [searchTerm, setSearchTerm] = useState("");

useEffect(() => {
  const timer = setTimeout(() => {
    // Fetch after user stops typing
  }, 300);
  return () => clearTimeout(timer);
}, [searchTerm]);
```

---

## Testing

Mock the hook in tests:

```javascript
jest.mock("../hooks/useEnvironmentalData", () => ({
  useEnvironmentalData: () => ({
    metrics: { energyUsage: [100, 200, 300], ... },
    metricsLoading: false,
    metricsError: null,
    loadMetrics: jest.fn(),
    // ... other properties
  })
}));
```

---

## Environment Configuration

Ensure `.env` is set:

```env
# Production
VITE_API_BASE_URL=https://test-backend-blush.vercel.app

# Development
VITE_API_BASE_URL=http://localhost:3001
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Data not loading | Check API endpoints exist, verify network tab, check console |
| Metrics undefined | Ensure `loadMetrics()` is called in useEffect |
| Errors not displaying | Check `metricsError` state in component |
| Charts not rendering | Verify `chartData` has values, check Recharts setup |
| LocalStorage errors | Clear browser cache, check quota |

---

## Next Steps

1. ✅ Copy modules to your project
2. ✅ Test hook in a simple component
3. ✅ Implement backend API endpoints
4. ✅ Create full dashboard with charts
5. ✅ Add invoice PDF upload
6. ✅ Integrate AI insights display

---

## Support Files

- **ENVIRONMENTAL_DATA_USAGE.md** - Complete API documentation
- **IMPLEMENTATION_EXAMPLES.md** - Code examples for common patterns
- **FETCH_ERROR_HANDLING.md** - Error handling improvements

---

## Summary

This system provides a production-ready solution for:
- ✅ Fetching environmental metrics from backend
- ✅ Displaying metrics in charts and KPI cards
- ✅ Processing invoice data
- ✅ Showing AI-generated insights
- ✅ Handling errors gracefully
- ✅ Caching data locally

All code follows React best practices and includes comprehensive error handling.
