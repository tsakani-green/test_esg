// src/context/SimulationContext.jsx
import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { API_BASE_URL } from "../config/api";

export const SimulationContext = createContext(null);

export const SimulationProvider = ({ children }) => {
  const [environmentalMetrics, setEnvironmentalMetrics] = useState(null);
  const [socialMetrics, setSocialMetrics] = useState(null);
  const [governanceMetrics, setGovernanceMetrics] = useState(null);

  // High-level summary & KPI metrics from mockData
  const [summary, setSummary] = useState(null);
  const [kpiMetrics, setKpiMetrics] = useState(null);

  // Combined insights array from ESGDataResponse.insights
  const [insights, setInsights] = useState([]);

  // If you later expose logo via API, we’re ready for it
  const [companyLogoUrl, setCompanyLogoUrl] = useState(null);

  const [uploadedDate, setUploadedDate] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Core loader: fetch the current ESG state from /api/esg-data
   * FastAPI response model: ESGDataResponse
   * {
   *   mockData: {
   *     summary,
   *     metrics,
   *     environmentalMetrics,
   *     socialMetrics,
   *     governanceMetrics,
   *     last_updated
   *   },
   *   insights: string[],
   *   uploaded_date
   * }
   */
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/esg-data`);
      if (!res.ok) {
        throw new Error(`/api/esg-data ${res.status}`);
      }

      const data = await res.json();

      const mock = data.mockData || {};
      const env = mock.environmentalMetrics || {};
      const soc = mock.socialMetrics || {};
      const gov = mock.governanceMetrics || {};

      setEnvironmentalMetrics(env);
      setSocialMetrics(soc);
      setGovernanceMetrics(gov);

      setSummary(mock.summary || {});
      setKpiMetrics(mock.metrics || {});

      setInsights(Array.isArray(data.insights) ? data.insights : []);

      // dates
      setUploadedDate(data.uploaded_date || null);
      setLastUpdated(mock.last_updated || data.uploaded_date || null);

      // try to infer logo if backend later adds it
      const logoFromResponse =
        data.companyLogoUrl ||
        mock.companyLogoUrl ||
        mock.logoUrl ||
        (mock.metrics && mock.metrics.companyLogoUrl) ||
        null;
      setCompanyLogoUrl(logoFromResponse || null);
    } catch (err) {
      console.error("SimulationContext loadAll error:", err);
      setError(err.message || "Failed to load ESG simulation data.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /**
   * WebSocket: /ws/dashboard
   * Backend sends WebSocketMessage:
   * {
   *   type: "esg_update",
   *   data: { ...snapshot... },
   *   timestamp: ...
   * }
   * On esg_update, we refresh data from /api/esg-data.
   */
  useEffect(() => {
    let wsUrl;

    try {
      const url = new URL(API_BASE_URL);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      url.pathname = "/ws/dashboard";
      wsUrl = url.toString();
    } catch {
      // If API_BASE_URL is not a full URL, best-effort replacement
      wsUrl = API_BASE_URL.replace(/^https?/, "ws") + "/ws/dashboard";
    }

    let socket;

    try {
      socket = new WebSocket(wsUrl);
    } catch (e) {
      console.warn("[SimulationContext] Failed to open WebSocket:", e);
      return;
    }

    socket.onopen = () => {
      console.log("[SimulationContext] WebSocket connected:", wsUrl);
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        // FastAPI push_live_ai_update wraps snapshot inside WebSocketMessage
        if (msg?.type === "esg_update") {
          console.log("[SimulationContext] esg_update received, refreshing ESG data");
          loadAll();
        }
      } catch (e) {
        // It might also be the echo "Message received: ..." string
        console.warn("[SimulationContext] Failed to parse WebSocket message:", e);
      }
    };

    socket.onerror = (event) => {
      console.warn("[SimulationContext] WebSocket error:", event);
    };

    socket.onclose = () => {
      console.log("[SimulationContext] WebSocket disconnected");
    };

    return () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [loadAll]);

  const value = useMemo(
    () => ({
      // Raw pillar metrics from backend
      environmentalMetrics,
      socialMetrics,
      governanceMetrics,

      // High-level ESG summary + KPI metrics from mockData
      summary,
      kpiMetrics,

      // Combined AI insights array
      insights,

      // Meta
      companyLogoUrl,
      uploadedDate,
      lastUpdated,
      loading,
      error,

      // Public refresh hook (e.g. after /api/esg-upload, /api/invoice-upload)
      refreshSimulation: loadAll,
    }),
    [
      environmentalMetrics,
      socialMetrics,
      governanceMetrics,
      summary,
      kpiMetrics,
      insights,
      companyLogoUrl,
      uploadedDate,
      lastUpdated,
      loading,
      error,
      loadAll,
    ]
  );

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
};
