// QUICK_START.md
# Environmental Data System - Quick Start (5 Minutes)

## Step 1: Copy Files to Your Project ✅

```
src/services/environmentalDataService.js      ← Copy this
src/hooks/useEnvironmentalData.js            ← Copy this  
src/utils/invoiceHelpers.js                 ← Copy this
src/INDEX_ENVIRONMENTAL_DATA.js              ← Copy this (optional reference)
```

## Step 2: Use the Hook in Your Component 🎯

```jsx
// src/pages/MyDashboard.jsx
import React, { useEffect } from "react";
import { useEnvironmentalData, useEnvironmentalChartData } from "../hooks/useEnvironmentalData";

export default function MyDashboard() {
  // Get everything you need from the hook
  const {
    metrics,           // Your environmental data
    metricsLoading,    // true while loading
    metricsError,      // Error message if it fails
    loadMetrics,       // Function to load data
    insights,          // AI-generated insights
    totals,            // Calculated totals
  } = useEnvironmentalData();

  // Get chart-ready data
  const chartData = useEnvironmentalChartData(metrics);

  // Load data when component mounts
  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  // Show loading state
  if (metricsLoading) {
    return <div className="p-4">Loading environmental data...</div>;
  }

  // Show error state
  if (metricsError) {
    return <div className="p-4 text-red-600">Error: {metricsError}</div>;
  }

  // Display your data
  return (
    <div className="p-6 space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard 
          label="Total Energy" 
          value={totals.totalEnergy.toLocaleString()} 
          unit="kWh"
        />
        <KPICard 
          label="Total Carbon" 
          value={totals.totalCarbon.toFixed(1)} 
          unit="tCO₂e"
        />
        <KPICard 
          label="Total Waste" 
          value={totals.totalWaste.toFixed(1)} 
          unit="tonnes"
        />
        <KPICard 
          label="Total Fuel" 
          value={totals.totalFuel.toLocaleString()} 
          unit="L"
        />
      </div>

      {/* Chart (if you have Recharts installed) */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow">
          <h2 className="text-lg font-semibold mb-4">Environmental Trends</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="energy" stroke="#16a34a" name="Energy (kWh)" />
              <Line type="monotone" dataKey="carbon" stroke="#ef4444" name="Carbon (tCO₂e)" />
              <Line type="monotone" dataKey="waste" stroke="#06b6d4" name="Waste (t)" />
              <Line type="monotone" dataKey="fuel" stroke="#f97316" name="Fuel (L)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* AI Insights */}
      {insights.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow">
          <h2 className="text-lg font-semibold mb-4">AI Environmental Insights</h2>
          <ul className="list-disc list-inside space-y-2 text-slate-700">
            {insights.map((insight, i) => (
              <li key={i}>{insight}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Simple KPI Card Component
function KPICard({ label, value, unit }) {
  return (
    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-4 border border-emerald-300">
      <p className="text-sm font-semibold text-emerald-700">{label}</p>
      <p className="text-2xl font-bold text-emerald-900 mt-1">{value}</p>
      <p className="text-xs text-emerald-600">{unit}</p>
    </div>
  );
}
```

## Step 3: Configure API Endpoint ⚙️

Update your `.env` file:

```env
VITE_API_BASE_URL=https://test-backend-blush.vercel.app
# or for local development:
VITE_API_BASE_URL=http://localhost:3001
```

## Step 4: With Invoices 📋

```jsx
import { getLastNInvoices, calculateInvoiceAggregates } from "../utils/invoiceHelpers";

function InvoiceView() {
  const { invoices } = useEnvironmentalData();

  // Get last 6 invoices
  const lastSix = getLastNInvoices(invoices, 6);

  // Calculate totals
  const stats = calculateInvoiceAggregates(lastSix);

  return (
    <div className="space-y-4">
      <div>Total Energy (6 invoices): {stats.totalEnergyKwh.toLocaleString()} kWh</div>
      <div>Total Charges: R{stats.totalCurrentCharges.toFixed(2)}</div>
      <div>Amount Due: R{stats.totalAmountDue.toFixed(2)}</div>
    </div>
  );
}
```

---

## What Each Part Does

### `useEnvironmentalData()` Hook
```javascript
const {
  // Metrics (Environmental data)
  metrics,                    // { energyUsage: [], co2Emissions: [], waste: [], fuelUsage: [] }
  metricsLoading,            // true | false
  metricsError,              // null | "error message"
  loadMetrics,               // () => void
  
  // Insights (AI-generated commentary)
  insights,                  // ["insight 1", "insight 2", ...]
  insightsLoading,           // true | false
  insightsError,             // null | "error message"
  insightsMeta,              // { live: boolean, timestamp: string }
  loadInsights,              // () => void
  
  // Invoices (PDF processing)
  invoices,                  // [{ id, company_name, six_month_energy_kwh, ... }, ...]
  invoicesLoading,           // true | false
  invoicesError,             // null | "error message"
  loadInvoices,              // () => void
  
  // Calculated values
  totals,                    // { totalEnergy, totalCarbon, totalWaste, totalFuel, avgCarbon }
  
  // Actions
  retry,                     // () => void
} = useEnvironmentalData();
```

### `useEnvironmentalChartData()` Hook
```javascript
// Converts metrics into Recharts-ready format
const chartData = useEnvironmentalChartData(metrics);
// Returns: [
//   { name: "Jan", energy: 1000, carbon: 50, waste: 10, fuel: 100 },
//   { name: "Feb", energy: 1200, carbon: 60, waste: 12, fuel: 110 },
//   ...
// ]
```

### Helper Functions
```javascript
import {
  getLastNInvoices,              // Get N most recent invoices
  calculateInvoiceAggregates,    // Sum up invoice totals
  groupInvoicesByCompany,        // Group for display
  formatCurrency,                // Format numbers as currency
  formatEnergy,                  // Format energy numbers
  getCompanyName,                // Extract company from invoice
  parseInvoiceDate,              // Parse various date formats
} from "../utils/invoiceHelpers";
```

---

## Common Patterns

### Pattern 1: Simple KPI Display
```jsx
useEffect(() => { loadMetrics(); }, [loadMetrics]);
return <div>Energy: {totals.totalEnergy} kWh</div>;
```

### Pattern 2: With Error Handling
```jsx
if (metricsError) return <Error msg={metricsError} onRetry={retry} />;
if (metricsLoading) return <Spinner />;
return <Content data={metrics} />;
```

### Pattern 3: Load Multiple Data Sources
```jsx
useEffect(() => {
  loadMetrics();
  loadInvoices();
}, [loadMetrics, loadInvoices]);
```

### Pattern 4: Create Chart
```jsx
const chartData = useEnvironmentalChartData(metrics);
return <LineChart data={chartData}> ... </LineChart>;
```

---

## What API Endpoints Do You Need?

Your backend should have these endpoints:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/environmental-metrics` | Get environmental data |
| POST | `/api/environmental-insights` | Get AI insights |
| GET | `/api/invoices` | Get invoice list |
| POST | `/api/invoice-bulk-upload` | Upload PDFs |

---

## Error Messages (User-Friendly)

The system automatically shows:
- ❌ "Unable to connect to the server. Please check your internet connection..."
- ❌ "Server error. The service is temporarily unavailable..."
- ❌ "Authentication failed. Please log in again."
- ❌ "The requested resource was not found..."

---

## Testing Your Setup

```jsx
// Simple test component
function TestEnvData() {
  const { metrics, metricsLoading, metricsError, loadMetrics } = useEnvironmentalData();

  useEffect(() => { loadMetrics(); }, [loadMetrics]);

  return (
    <pre>
      Loading: {metricsLoading ? "yes" : "no"}
      Error: {metricsError || "none"}
      Metrics: {JSON.stringify(metrics, null, 2)}
    </pre>
  );
}
```

---

## Next Steps

1. ✅ Read: `README_ENVIRONMENTAL_DATA.md` (quick overview)
2. ✅ Check: `ENVIRONMENTAL_DATA_USAGE.md` (complete reference)
3. ✅ Learn: `IMPLEMENTATION_EXAMPLES.md` (code samples)
4. ✅ Build: Your dashboard with the patterns above

---

## Need Help?

1. **API not found?** → Check backend has `/api/environmental-metrics`
2. **Data not showing?** → Check `.env` has correct `VITE_API_BASE_URL`
3. **Errors in console?** → Check `metricsError` state
4. **Want more examples?** → See `IMPLEMENTATION_EXAMPLES.md`

---

## That's It! 🎉

You now have a complete environmental data system ready to use!

**5 minutes to setup. Years of productivity gained. 📈**
