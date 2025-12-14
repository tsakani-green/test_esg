// src/context/SimulationContext.jsx
import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { API_BASE_URL } from "../config/api";

export const SimulationContext = createContext(null);

export const SimulationProvider = ({ children }) => {
  // Pillar metrics from /api/esg-data
  const [environmentalMetrics, setEnvironmentalMetrics] = useState(null);
  const [socialMetrics, setSocialMetrics] = useState(null);
  const [governanceMetrics, setGovernanceMetrics] = useState(null);

  // Summary + KPI metrics
  const [summary, setSummary] = useState(null);
  const [kpiMetrics, setKpiMetrics] = useState(null);

  // Combined narrative insights from /api/esg-data (generic)
  const [insights, setInsights] = useState([]);

  // LIVE Environmental AI insights
  const [liveEnvironmentalInsights, setLiveEnvironmentalInsights] = useState([]);
  const [liveEnvironmentalInsightsMeta, setLiveEnvironmentalInsightsMeta] =
    useState({ live: false, timestamp: null, error: null });

  // ✅ NEW: LIVE Social AI insights
  const [liveSocialInsights, setLiveSocialInsights] = useState([]);
  const [liveSocialInsightsMeta, setLiveSocialInsightsMeta] = useState({
    live: false,
    timestamp: null,
    error: null,
  });

  // ✅ NEW: LIVE Governance AI insights
  const [liveGovernanceInsights, setLiveGovernanceInsights] = useState([]);
  const [liveGovernanceInsightsMeta, setLiveGovernanceInsightsMeta] = useState({
    live: false,
    timestamp: null,
    error: null,
  });

  // LIVE AI Mini Report
  const [aiMiniReport, setAiMiniReport] = useState({
    baseline: "",
    benchmark: "",
    performance_vs_benchmark: "",
    ai_recommendations: [],
  });
  const [aiMiniReportMeta, setAiMiniReportMeta] = useState({
    live: false,
    timestamp: null,
    error: null,
  });

  // Optional logo / meta
  const [companyLogoUrl, setCompanyLogoUrl] = useState(null);
  const [uploadedDate, setUploadedDate] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Load states
  const [loading, setLoading] = useState(false);
  const [loadingLiveAI, setLoadingLiveAI] = useState(false);
  const [error, setError] = useState(null);

  // Avoid overlapping refreshes on rapid WS messages
  const inFlightRef = useRef(false);

  // Abort controllers for LIVE calls (prevents overlap on WS spam)
  const liveAbortRef = useRef({
    env: null,
    soc: null,
    gov: null,
    mini: null,
  });

  const _abortLive = useCallback((key) => {
    try {
      liveAbortRef.current?.[key]?.abort?.();
    } catch {}
    liveAbortRef.current[key] = new AbortController();
    return liveAbortRef.current[key].signal;
  }, []);

  const resolveCompanyAndPeriod = useCallback(
    (res) => {
      const company =
        res?.mock?.summary?.company ||
        res?.mock?.summary?.company_name ||
        summary?.company ||
        summary?.company_name ||
        null;

      const period =
        res?.mock?.summary?.reportPeriod ||
        res?.mock?.summary?.period ||
        summary?.reportPeriod ||
        summary?.period ||
        null;

      return { company, period };
    },
    [summary]
  );

  /**
   * Load base ESG snapshot
   */
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/esg-data`, {
        credentials: "include",
      });

      if (!res.ok) throw new Error(`/api/esg-data ${res.status}`);

      const data = await res.json();
      const mock = data.mockData || {};
      const env = mock.environmentalMetrics || {};
      const soc = mock.socialMetrics || {};
      const gov = mock.governanceMetrics || {};

      // ✅ IMPORTANT: merge env metrics so invoice fields stay intact
      setEnvironmentalMetrics((prev) => ({
        ...(prev || {}),
        ...(env || {}),
      }));

      setSocialMetrics(soc);
      setGovernanceMetrics(gov);

      setSummary(mock.summary || {});
      setKpiMetrics(mock.metrics || {});
      setInsights(Array.isArray(data.insights) ? data.insights : []);

      const uploaded = data.uploaded_date || null;
      setUploadedDate(uploaded);

      const last =
        mock?.summary?.last_updated ||
        mock?.summary?.lastUpdated ||
        uploaded ||
        null;
      setLastUpdated(last);

      const logoFromResponse =
        data.companyLogoUrl ||
        mock.companyLogoUrl ||
        mock.logoUrl ||
        (mock.metrics && mock.metrics.companyLogoUrl) ||
        null;

      setCompanyLogoUrl(logoFromResponse || null);

      return { mock, data };
    } catch (err) {
      console.error("SimulationContext loadAll error:", err);
      setError(err.message || "Failed to load ESG simulation data.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * LIVE: Environmental AI insights
   */
  const loadLiveEnvironmentalInsights = useCallback(
    async ({ company_name, period, invoice_baseline } = {}) => {
      setLoadingLiveAI(true);
      setLiveEnvironmentalInsightsMeta((m) => ({ ...m, error: null }));

      const signal = _abortLive("env");

      try {
        const payload = {
          company_name:
            company_name || summary?.company || summary?.company_name || null,
          period: period || summary?.reportPeriod || summary?.period || null,
          summary: summary || {},
          metrics: kpiMetrics || {},
          invoice_baseline: invoice_baseline || {},
        };

        const res = await fetch(`${API_BASE_URL}/api/environmental-insights`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
          signal,
        });

        if (!res.ok) {
          const detail = await res.text();
          throw new Error(`/api/environmental-insights ${res.status}: ${detail}`);
        }

        const data = await res.json();
        setLiveEnvironmentalInsights(Array.isArray(data.insights) ? data.insights : []);
        setLiveEnvironmentalInsightsMeta({
          live: !!data.live,
          timestamp: data.timestamp || null,
          error: null,
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("LIVE environmental insights error:", err);
          setLiveEnvironmentalInsights([]);
          setLiveEnvironmentalInsightsMeta({
            live: false,
            timestamp: null,
            error: err.message || "Failed to load live environmental insights.",
          });
        }
      } finally {
        setLoadingLiveAI(false);
      }
    },
    [summary, kpiMetrics, _abortLive]
  );

  /**
   * ✅ NEW: LIVE Social AI insights (POST /api/social-insights)
   */
  const loadLiveSocialInsights = useCallback(
    async ({ metrics } = {}) => {
      setLoadingLiveAI(true);
      setLiveSocialInsightsMeta((m) => ({ ...m, error: null }));

      const signal = _abortLive("soc");

      try {
        // Prefer provided metrics, else use mock social metrics, else derive from KPI metrics
        const payloadMetrics =
          metrics ||
          socialMetrics ||
          {
            employeeSatisfaction: kpiMetrics?.employeeSatisfaction,
            supplierDiversity: kpiMetrics?.supplierDiversity,
            communityInvestment: kpiMetrics?.communityInvestment,
          };

        const res = await fetch(`${API_BASE_URL}/api/social-insights`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ metrics: payloadMetrics || {} }),
          signal,
        });

        if (!res.ok) {
          const detail = await res.text();
          throw new Error(`/api/social-insights ${res.status}: ${detail}`);
        }

        const data = await res.json();
        setLiveSocialInsights(Array.isArray(data.insights) ? data.insights : []);
        setLiveSocialInsightsMeta({
          live: !!data.live,
          timestamp: data.timestamp || null,
          error: null,
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("LIVE social insights error:", err);
          setLiveSocialInsights([]);
          setLiveSocialInsightsMeta({
            live: false,
            timestamp: null,
            error: err.message || "Failed to load live social insights.",
          });
        }
      } finally {
        setLoadingLiveAI(false);
      }
    },
    [socialMetrics, kpiMetrics, _abortLive]
  );

  /**
   * ✅ NEW: LIVE Governance AI insights (POST /api/governance-insights)
   */
  const loadLiveGovernanceInsights = useCallback(
    async ({ metrics } = {}) => {
      setLoadingLiveAI(true);
      setLiveGovernanceInsightsMeta((m) => ({ ...m, error: null }));

      const signal = _abortLive("gov");

      try {
        const payloadMetrics =
          metrics ||
          governanceMetrics ||
          {
            governanceScore: governanceMetrics?.governanceScore ?? 80,
            supplierCompliance: governanceMetrics?.supplierCompliance ?? 85,
            auditCompletion: governanceMetrics?.auditCompletion ?? 92,
            boardIndependence: governanceMetrics?.boardIndependence ?? "60%",
            transparencyScore: governanceMetrics?.transparencyScore ?? "82%",
            ethicsCompliance: governanceMetrics?.ethicsCompliance ?? 90,
            riskCoverage: governanceMetrics?.riskCoverage ?? 95,
          };

        const res = await fetch(`${API_BASE_URL}/api/governance-insights`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ metrics: payloadMetrics || {} }),
          signal,
        });

        if (!res.ok) {
          const detail = await res.text();
          throw new Error(`/api/governance-insights ${res.status}: ${detail}`);
        }

        const data = await res.json();
        setLiveGovernanceInsights(Array.isArray(data.insights) ? data.insights : []);
        setLiveGovernanceInsightsMeta({
          live: !!data.live,
          timestamp: data.timestamp || null,
          error: null,
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("LIVE governance insights error:", err);
          setLiveGovernanceInsights([]);
          setLiveGovernanceInsightsMeta({
            live: false,
            timestamp: null,
            error: err.message || "Failed to load live governance insights.",
          });
        }
      } finally {
        setLoadingLiveAI(false);
      }
    },
    [governanceMetrics, _abortLive]
  );

  /**
   * LIVE: AI Mini Report
   */
  const loadAIMiniReport = useCallback(
    async ({ company_name, period, invoice_baseline } = {}) => {
      setLoadingLiveAI(true);
      setAiMiniReportMeta((m) => ({ ...m, error: null }));

      const signal = _abortLive("mini");

      try {
        const payload = {
          company_name:
            company_name || summary?.company || summary?.company_name || null,
          period: period || summary?.reportPeriod || summary?.period || null,
          summary: summary || {},
          metrics: kpiMetrics || {},
          invoice_baseline: invoice_baseline || {},
        };

        const res = await fetch(`${API_BASE_URL}/api/ai-mini-report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
          signal,
        });

        if (!res.ok) {
          const detail = await res.text();
          throw new Error(`/api/ai-mini-report ${res.status}: ${detail}`);
        }

        const data = await res.json();

        setAiMiniReport({
          baseline: data.baseline || "",
          benchmark: data.benchmark || "",
          performance_vs_benchmark: data.performance_vs_benchmark || "",
          ai_recommendations: Array.isArray(data.ai_recommendations)
            ? data.ai_recommendations
            : [],
        });

        setAiMiniReportMeta({
          live: !!data.live,
          timestamp: data.timestamp || null,
          error: null,
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("AI mini report error:", err);
          setAiMiniReport({
            baseline: "",
            benchmark: "",
            performance_vs_benchmark: "",
            ai_recommendations: [],
          });
          setAiMiniReportMeta({
            live: false,
            timestamp: null,
            error: err.message || "Failed to load AI mini report.",
          });
        }
      } finally {
        setLoadingLiveAI(false);
      }
    },
    [summary, kpiMetrics, _abortLive]
  );

  /**
   * One-shot refresh:
   * - loads /api/esg-data
   * - then triggers LIVE environmental + social + governance + mini report
   */
  const refreshEverything = useCallback(
    async ({ invoice_baseline } = {}) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      try {
        const res = await loadAll();
        const { company, period } = resolveCompanyAndPeriod(res);

        await Promise.all([
          loadLiveEnvironmentalInsights({ company_name: company, period, invoice_baseline }),
          loadAIMiniReport({ company_name: company, period, invoice_baseline }),

          // NEW: live S + G
          loadLiveSocialInsights(),
          loadLiveGovernanceInsights(),
        ]);
      } finally {
        inFlightRef.current = false;
      }
    },
    [
      loadAll,
      resolveCompanyAndPeriod,
      loadLiveEnvironmentalInsights,
      loadAIMiniReport,
      loadLiveSocialInsights,
      loadLiveGovernanceInsights,
    ]
  );

  // Initial load on mount (base + live)
  useEffect(() => {
    refreshEverything();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * WebSocket: /ws/live-ai
   * On "live-esg-update" => refresh base + live AI
   */
  useEffect(() => {
    let wsUrl;

    try {
      const url = new URL(API_BASE_URL);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      url.pathname = "/ws/live-ai";
      wsUrl = url.toString();
    } catch {
      wsUrl = API_BASE_URL.replace(/^https?/, "ws") + "/ws/live-ai";
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
        if (msg?.type === "live-esg-update" || msg?.type === "esg_update") {
          refreshEverything();
        }
      } catch (e) {
        console.warn("[SimulationContext] WS parse error:", e);
      }
    };

    socket.onerror = (event) => {
      console.warn("[SimulationContext] WebSocket error:", event);
    };

    socket.onclose = () => {
      console.log("[SimulationContext] WebSocket disconnected");
    };

    return () => {
      try {
        if (socket && socket.readyState === WebSocket.OPEN) socket.close();
      } catch {}
      // abort any in-flight live calls on unmount
      ["env", "soc", "gov", "mini"].forEach((k) => {
        try {
          liveAbortRef.current?.[k]?.abort?.();
        } catch {}
      });
    };
  }, [refreshEverything]);

  /**
   * Compatibility outputs:
   * - SocialCategory expects: socialInsights
   * - GovernanceCategory expects: governanceInsights
   */
  const value = useMemo(
    () => ({
      environmentalMetrics,
      socialMetrics,
      governanceMetrics,

      summary,
      kpiMetrics,

      // base insights
      insights,

      // LIVE AI outputs
      liveEnvironmentalInsights,
      liveEnvironmentalInsightsMeta,

      // NEW: LIVE S + G
      liveSocialInsights,
      liveSocialInsightsMeta,

      liveGovernanceInsights,
      liveGovernanceInsightsMeta,

      aiMiniReport,
      aiMiniReportMeta,

      // compatibility aliases (keep your old behaviour)
      socialInsights: liveSocialInsights?.length ? liveSocialInsights : insights,
      governanceInsights: liveGovernanceInsights?.length ? liveGovernanceInsights : insights,
      governanceSummary: summary || {},

      // meta
      companyLogoUrl,
      uploadedDate,
      lastUpdated,

      loading,
      loadingLiveAI,
      error,

      // public actions
      refreshSimulation: loadAll,
      refreshEverything,

      loadLiveEnvironmentalInsights,
      loadLiveSocialInsights,
      loadLiveGovernanceInsights,
      loadAIMiniReport,
    }),
    [
      environmentalMetrics,
      socialMetrics,
      governanceMetrics,
      summary,
      kpiMetrics,
      insights,
      liveEnvironmentalInsights,
      liveEnvironmentalInsightsMeta,
      liveSocialInsights,
      liveSocialInsightsMeta,
      liveGovernanceInsights,
      liveGovernanceInsightsMeta,
      aiMiniReport,
      aiMiniReportMeta,
      companyLogoUrl,
      uploadedDate,
      lastUpdated,
      loading,
      loadingLiveAI,
      error,
      loadAll,
      refreshEverything,
      loadLiveEnvironmentalInsights,
      loadLiveSocialInsights,
      loadLiveGovernanceInsights,
      loadAIMiniReport,
    ]
  );

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
};
