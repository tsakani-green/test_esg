// src/config/api.js

// Base API URL from environment variables
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

// API Endpoints
export const API_ENDPOINTS = {
  // ESG Endpoints
  ESG_ANALYSE: "/esg/analyse",
  ESG_DATA: "/api/esg-data",
  ESG_UPLOAD: "/api/esg-upload",
  ESG_MINI_REPORT: "/api/esg-mini-report",
  
  // Pillar Insights
  ENVIRONMENTAL_INSIGHTS: "/api/environmental-insights",
  SOCIAL_INSIGHTS: "/api/social-insights",
  GOVERNANCE_INSIGHTS: "/api/governance-insights",
  
  // Platform
  PLATFORM_OVERVIEW: "/platform/overview",
  
  // Invoice Management
  INVOICE_UPLOAD: "/api/invoice-upload",
  INVOICE_BULK_UPLOAD: "/api/invoice-bulk-upload",
  INVOICES_LIST: "/api/invoices",
  INVOICE_ENV_INSIGHTS: "/api/invoice-environmental-insights",
  
  // Logo Management
  COMPANY_LOGO: "/api/company-logo",
  UPLOAD_LOGO: "/api/upload-logo",
  
  // System
  HEALTH: "/api/health",
  
  // WebSocket (Live AI)
  WS_LIVE_AI: "/ws/live-ai",
};

// Full URL helper
export const getApiUrl = (endpoint) => {
  return `${API_BASE_URL}${endpoint}`;
};

// API Request helper with error handling
export const apiRequest = async (endpoint, options = {}) => {
  const url = getApiUrl(endpoint);
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'include', // Include cookies if needed
  };

  try {
    const response = await fetch(url, {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    });

    // Handle non-2xx responses
    if (!response.ok) {
      let errorMessage = `API Error: ${response.status} ${response.statusText}`;
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch (e) {
        // If response is not JSON, use text
        const errorText = await response.text();
        if (errorText) errorMessage += ` - ${errorText}`;
      }
      
      throw new Error(errorMessage);
    }

    // Parse JSON response
    return await response.json();
  } catch (error) {
    console.error(`API Request failed for ${endpoint}:`, error);
    
    // Check if it's a network/CORS error
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      throw new Error(
        `Cannot connect to backend at ${API_BASE_URL}. ` +
        `Please ensure the backend is running and CORS is properly configured.`
      );
    }
    
    throw error;
  }
};

// Specific API functions for your ESG app
export const api = {
  // ESG Analysis
  analyseESG: (data) => 
    apiRequest(API_ENDPOINTS.ESG_ANALYSE, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  getESGData: () => 
    apiRequest(API_ENDPOINTS.ESG_DATA),
  
  uploadESGFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    return apiRequest(API_ENDPOINTS.ESG_UPLOAD, {
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set Content-Type for FormData
    });
  },
  
  getMiniReport: () => 
    apiRequest(API_ENDPOINTS.ESG_MINI_REPORT),
  
  // Pillar Insights
  getEnvironmentalInsights: () => 
    apiRequest(API_ENDPOINTS.ENVIRONMENTAL_INSIGHTS),
  
  getSocialInsights: (metrics) => 
    apiRequest(API_ENDPOINTS.SOCIAL_INSIGHTS, {
      method: 'POST',
      body: JSON.stringify({ metrics }),
    }),
  
  getGovernanceInsights: () => 
    apiRequest(API_ENDPOINTS.GOVERNANCE_INSIGHTS),
  
  // Platform
  getPlatformOverview: () => 
    apiRequest(API_ENDPOINTS.PLATFORM_OVERVIEW),
  
  // Invoices
  uploadInvoice: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    return apiRequest(API_ENDPOINTS.INVOICE_UPLOAD, {
      method: 'POST',
      body: formData,
      headers: {},
    });
  },
  
  uploadBulkInvoices: (files) => {
    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append('files', file);
    });
    
    return apiRequest(API_ENDPOINTS.INVOICE_BULK_UPLOAD, {
      method: 'POST',
      body: formData,
      headers: {},
    });
  },
  
  getInvoices: (lastMonths) => {
    const params = lastMonths ? `?last_months=${lastMonths}` : '';
    return apiRequest(`${API_ENDPOINTS.INVOICES_LIST}${params}`);
  },
  
  getInvoiceEnvironmentalInsights: (lastN = 6) => 
    apiRequest(`${API_ENDPOINTS.INVOICE_ENV_INSIGHTS}?last_n=${lastN}`),
  
  // Logo
  getCompanyLogo: () => 
    apiRequest(API_ENDPOINTS.COMPANY_LOGO),
  
  uploadLogo: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    return apiRequest(API_ENDPOINTS.UPLOAD_LOGO, {
      method: 'POST',
      body: formData,
      headers: {},
    });
  },
  
  // System
  healthCheck: () => 
    apiRequest(API_ENDPOINTS.HEALTH),
};

// WebSocket connection for Live AI
export const createWebSocketConnection = () => {
  const wsUrl = API_BASE_URL.replace('http', 'ws') + API_ENDPOINTS.WS_LIVE_AI;
  return new WebSocket(wsUrl);
};

// Check if backend is available
export const checkBackendConnection = async () => {
  try {
    const health = await api.healthCheck();
    return {
      connected: true,
      url: API_BASE_URL,
      status: health,
    };
  } catch (error) {
    return {
      connected: false,
      url: API_BASE_URL,
      error: error.message,
    };
  }
};

export default api;