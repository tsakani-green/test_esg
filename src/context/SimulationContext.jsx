// src/context/SimulationContext.jsx
import React, { createContext, useEffect, useState } from "react";
import { API_BASE_URL } from "../config/api";

export const SimulationContext = createContext(null);

export const SimulationProvider = ({ children }) => {
  const [environmentalMetrics, setEnvironmentalMetrics] = useState(null);
  const [socialMetrics, setSocialMetrics] = useState(null);
  const [governanceMetrics, setGovernanceMetrics] = useState(null);

  const [environmentalInsights, setEnvironmentalInsights] = useState([]);
  const [socialInsights, setSocialInsights] = useState([]);
  const [governanceInsights, setGovernanceInsights] = useState([]);

  const [companyLogoUrl, setCompanyLogoUrl] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Reusable loader so other components can trigger a refresh after uploads
  const loadAll = async () => {
    setLoading(true);
    setError(null);

    try {
      const [envRes, socRes, govRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/environmental-insights`),
        fetch(`${API_BASE_URL}/api/social-insights`),
        fetch(`${API_BASE_URL}/api/governance-insights`),
      ]);

      if (!envRes.ok) {
        throw new Error(`/api/environmental-insights ${envRes.status}`);
      }
      if (!socRes.ok) {
        throw new Error(`/api/social-insights ${socRes.status}`);
      }
      if (!govRes.ok) {
        throw new Error(`/api/governance-insights ${govRes.status}`);
      }

      const [envData, socData, govData] = await Promise.all([
        envRes.json(),
        socRes.json(),
        govRes.json(),
      ]);

      // Environmental
      setEnvironmentalMetrics(envData.metrics || {});
      setEnvironmentalInsights(envData.insights || []);

      // Try to discover logo URL from environmental payload
      const logoFromEnv =
        envData.companyLogoUrl ||
        envData.logoUrl ||
        (envData.metrics && envData.metrics.companyLogoUrl) ||
        null;
      setCompanyLogoUrl(logoFromEnv);

      // Social
      setSocialMetrics(socData.metrics || {});
      setSocialInsights(socData.insights || []);

      // Governance
      setGovernanceMetrics(govData.metrics || {});
      setGovernanceInsights(govData.insights || []);
    } catch (err) {
      console.error("SimulationContext load error:", err);
      setError(err.message || "Failed to load ESG simulation data.");
    } finally {
      setLoading(false);
    }
  };

  // Initial load on mount
  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SimulationContext.Provider
      value={{
        environmentalMetrics,
        socialMetrics,
        governanceMetrics,
        environmentalInsights,
        socialInsights,
        governanceInsights,
        companyLogoUrl,
        loading,
        error,
        // expose refresh so pages can reload after /api/esg-upload, etc.
        refreshSimulation: loadAll,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
};
