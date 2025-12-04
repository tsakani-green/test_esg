import React, { useContext } from "react";
import { SimulationContext } from "../context/SimulationContext";

export default function OperationalView() {
  const { esgSummary, aiInsights, carbonTax, taxAllowances, carbonCredits, energySavings } =
    useContext(SimulationContext);

  const kpis = [
    { label: "Carbon Tax (2024/2025)", value: `R ${carbonTax.toLocaleString()}` },
    { label: "Applicable Tax Allowances", value: `R ${taxAllowances.toLocaleString()}` },
    { label: "Carbon Credits Generated", value: `${carbonCredits.toLocaleString()} tonnes (CO2e)` },
    { label: "Energy Savings", value: `${energySavings.toLocaleString()} kWh` },
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-inter p-8">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-2xl sm:text-3xl font-semibold text-green-800 mb-2">
          Operational View
        </h1>
        <p className="text-gray-700 text-lg">
          Welcome <strong className="text-green-900 font-bold">Ms. Songo Didiza</strong> to your AI-Enabled ESG Platform
        </p>
      </div>

      {/* ESG Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-10">
        {Object.entries(esgSummary).map(([key, value]) => (
          <div key={key} className="bg-white shadow-md rounded-2xl p-6 border border-gray-100">
            <h3 className="text-green-700 font-semibold text-lg capitalize mb-2">{key}</h3>
            <p className="text-gray-700">{value}</p>
          </div>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-10">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="bg-white shadow-md rounded-2xl p-6 border border-gray-100 text-center">
            <p className="text-gray-500 text-sm">{kpi.label}</p>
            <p className="text-green-800 font-bold text-xl mt-2">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* AI Mini Report */}
      <div className="bg-white shadow-md rounded-2xl p-6 mb-10 border border-gray-100 max-w-3xl mx-auto">
        <h2 className="text-xl font-semibold text-green-700 mb-4">AI Mini Report on ESG Summary</h2>
        {aiInsights?.length > 0 ? (
          <ul className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed">
            {aiInsights.map((note, idx) => (
              <li key={idx}>{note}</li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 text-base">Loading AI insights...</p>
        )}
      </div>
    </div>
  );
}
