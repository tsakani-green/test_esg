// src/hooks/useESGMiniReport.js
import { useEffect, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export function useESGMiniReport() {
  const [miniReport, setMiniReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchMiniReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/api/esg-mini-report`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (isMounted) {
          setMiniReport(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err?.message || "Failed to load ESG AI mini report from the API."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchMiniReport();

    return () => {
      isMounted = false;
    };
  }, []);

  return { miniReport, loading, error };
}
