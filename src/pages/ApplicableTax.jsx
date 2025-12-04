import React, { useContext } from "react";
import { SimulationContext } from "../context/SimulationContext";
import { FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

export default function ApplicableTax() {
  const { taxAllowances } = useContext(SimulationContext);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-lime-50 py-10 font-sans flex justify-center">
      <div className="w-full max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-green-900">
              Applicable Tax Allowances
            </h1>
            <p className="mt-2 text-sm text-gray-600 max-w-lg">
              View estimated tax allowances derived from your carbon tax,
              energy and emissions profile.
            </p>
          </div>

          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 rounded-full border border-green-100 bg-white text-green-800 
            hover:text-green-600 hover:border-green-300 shadow-sm 
            transition-transform hover:-translate-y-0.5"
          >
            <FaArrowLeft size={18} />
          </button>
        </div>

        {/* Card */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-200">
          <p className="text-gray-700 text-base sm:text-lg">
            <span className="font-semibold text-green-900">
              Total Applicable Tax Allowances:
            </span>{" "}
            <span className="font-bold text-green-800">
              R {taxAllowances.toLocaleString()}
            </span>
          </p>
          <p className="mt-4 text-sm text-gray-600">
            These allowances consider reductions, offsets and qualifying
            activities aligned with current carbon tax regulations. Use this
            view together with the dashboard KPIs for strategic planning.
          </p>
        </div>
      </div>
    </div>
  );
}
