// src/config/api.js

// Base API URL from environment variables
// ✅ Default now points to FastAPI on port 3001 using localhost
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://test-backend-blush.vercel.app";

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH_LOGIN: "/auth/login",
  AUTH_ME: "/auth/me",

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
  HEALTH: "/health",
  HEALTH_API: "/api/health",

  // WebSocket (Live AI)
  WS_LIVE_AI: "/ws/live-ai",
};

// Full URL helper
export const getApiUrl = (endpoint) => {
  return `${API_BASE_URL}${endpoint}`;
};

// ==================== SAFE DATA UTILITIES ====================

/**
 * Safely converts any value to an array
 * @param {any} data - The data to convert
 * @param {string} key - Optional key if data is an object
 * @returns {Array} Always returns an array
 */
export const safeArray = (data, key = null) => {
  // If data is undefined or null
  if (data === undefined || data === null) return [];
  
  // If key is provided and data is an object
  if (key && typeof data === 'object' && !Array.isArray(data)) {
    return safeArray(data[key]);
  }
  
  // If already an array
  if (Array.isArray(data)) return data;
  
  // If it's an object, convert to array of values
  if (typeof data === 'object') {
    return Object.values(data);
  }
  
  // If it's a single value, wrap in array
  return [data];
};

/**
 * Sanitizes API response to ensure safe data structures
 * @param {any} response - Raw API response
 * @returns {Object} Sanitized response with guaranteed arrays
 */
export const sanitizeApiResponse = (response) => {
  if (!response || typeof response !== 'object') {
    return { summaries: [], data: [] };
  }
  
  // Deep clone to avoid mutation
  const sanitized = JSON.parse(JSON.stringify(response));
  
  // List of fields that should always be arrays
  const arrayFields = [
    'summaries', 'data', 'items', 'results', 'list',
    'insights', 'reports', 'invoices', 'files',
    'environmental', 'social', 'governance'
  ];
  
  // Ensure each field is an array
  arrayFields.forEach(field => {
    if (sanitized[field] !== undefined && !Array.isArray(sanitized[field])) {
      console.warn(`🔧 Sanitizing ${field} from non-array to array`);
      sanitized[field] = safeArray(sanitized[field]);
    }
  });
  
  return sanitized;
};

/**
 * Validates if a response contains the expected array structure
 * @param {Object} response - API response
 * @param {string} arrayKey - The key that should contain an array
 * @returns {Object} Validated and sanitized response
 */
export const validateArrayResponse = (response, arrayKey = 'summaries') => {
  const sanitized = sanitizeApiResponse(response);
  
  // Extra validation for specific array key
  if (!Array.isArray(sanitized[arrayKey])) {
    console.error(`❌ Critical: ${arrayKey} is not an array after sanitization`);
    sanitized[arrayKey] = [];
  }
  
  return sanitized;
};

// ==================== API REQUEST HELPER ====================

// API Request helper with error handling + JWT support + data sanitization
export const apiRequest = async (endpoint, options = {}) => {
  const url = getApiUrl(endpoint);

  const token = localStorage.getItem("token");
  const isFormData = options.body instanceof FormData;

  const baseHeaders = {
    Accept: "application/json",
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
  };

  // ✅ Attach JWT if present
  if (token) {
    baseHeaders.Authorization = `Bearer ${token}`;
  }

  const headers = {
    ...baseHeaders,
    ...(options.headers || {}),
  };

  console.log(`🌐 API Request: ${options.method || "GET"} ${url}`);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });

    console.log(`📊 Response status: ${response.status} ${response.statusText}`);
    console.log(`📋 Endpoint: ${endpoint}`);

    // Handle unauthorized
    if (response.status === 401 || response.status === 403) {
      console.warn("⚠️ Unauthorized access - clearing local storage");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }

    // Handle non-2xx responses
    if (!response.ok) {
      let errorMessage = `API Error: ${response.status} ${response.statusText}`;

      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
      } catch (e) {
        const errorText = await response.text();
        if (errorText) errorMessage += ` - ${errorText}`;
      }

      throw new Error(errorMessage);
    }

    // Parse JSON response
    const data = await response.json();
    
    // ✅ AUTO-SANITIZATION: Apply sanitization to known endpoints
    const endpointsNeedingSanitization = [
      'overview', 'summar', 'insights', 'data', 'list'
    ];
    
    let sanitizedData = data;
    
    // Check if this endpoint likely returns array data
    const needsSanitization = endpointsNeedingSanitization.some(keyword => 
      endpoint.toLowerCase().includes(keyword)
    );
    
    if (needsSanitization) {
      console.log(`🛡️ Auto-sanitizing response for ${endpoint}`);
      sanitizedData = sanitizeApiResponse(data);
      
      // Log warning if we had to fix something
      if (data.summaries && !Array.isArray(data.summaries)) {
        console.warn(`⚠️ Auto-fixed non-array 'summaries' in ${endpoint}`);
      }
    }
    
    console.log(`✅ API Success: ${endpoint}`, sanitizedData);
    return sanitizedData;
  } catch (error) {
    console.error(`❌ API Request failed for ${endpoint}:`, error);

    // Network / CORS-like error
    if (error.name === "TypeError" && error.message.includes("Failed to fetch")) {
      const detailedError = new Error(
        `🚫 Cannot connect to backend at ${API_BASE_URL}\n\n` +
        `Troubleshooting Steps:\n` +
        `1. Ensure the backend server is running: python -m uvicorn main:app --reload --host 0.0.0.0 --port 3001\n` +
        `2. Check if CORS is properly configured in FastAPI\n` +
        `3. Verify no firewall is blocking port 3001\n` +
        `4. Try: http://127.0.0.1:3001 instead of localhost\n` +
        `5. Check if backend is running on a different port\n`
      );
      throw detailedError;
    }

    throw error;
  }
};

// ==================== SPECIFIC API FUNCTIONS ====================

export const api = {
  // 🔐 Auth
  login: ({ email, password }) => {
    console.log(`🔑 Attempting login for: ${email}`);
    return apiRequest(API_ENDPOINTS.AUTH_LOGIN, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  getCurrentUser: () => apiRequest(API_ENDPOINTS.AUTH_ME),

  // ESG Analysis
  analyseESG: (data) =>
    apiRequest(API_ENDPOINTS.ESG_ANALYSE, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getESGData: () => apiRequest(API_ENDPOINTS.ESG_DATA),

  uploadESGFile: (file) => {
    console.log(`📤 Uploading ESG file: ${file.name}`);
    const formData = new FormData();
    formData.append("file", file);

    return apiRequest(API_ENDPOINTS.ESG_UPLOAD, {
      method: "POST",
      body: formData,
      headers: {},
    });
  },

  getMiniReport: () => apiRequest(API_ENDPOINTS.ESG_MINI_REPORT),

  // Pillar Insights
  getEnvironmentalInsights: () =>
    apiRequest(API_ENDPOINTS.ENVIRONMENTAL_INSIGHTS),

  getSocialInsights: (metrics) =>
    apiRequest(API_ENDPOINTS.SOCIAL_INSIGHTS, {
      method: "POST",
      body: JSON.stringify({ metrics }),
    }),

  getGovernanceInsights: () =>
    apiRequest(API_ENDPOINTS.GOVERNANCE_INSIGHTS),

  // Platform Overview - FIXED VERSION
  getPlatformOverview: async () => {
    try {
      console.log("📊 Fetching platform overview...");
      const data = await apiRequest(API_ENDPOINTS.PLATFORM_OVERVIEW);
      
      // ✅ Double-sanitize to ensure summaries is an array
      const validatedData = validateArrayResponse(data, 'summaries');
      
      // Log if we fixed something
      if (data.summaries && !Array.isArray(data.summaries)) {
        console.log(`🔄 Fixed platform overview: converted summaries to array`);
      }
      
      return validatedData;
    } catch (error) {
      console.error("❌ Error fetching platform overview:", error);
      // Return safe default structure
      return { 
        summaries: [], 
        metrics: {}, 
        lastUpdated: new Date().toISOString(),
        message: "Using fallback data due to API error"
      };
    }
  },

  // Invoices
  uploadInvoice: (file) => {
    console.log(`🧾 Uploading invoice: ${file.name}`);
    const formData = new FormData();
    formData.append("file", file);

    return apiRequest(API_ENDPOINTS.INVOICE_UPLOAD, {
      method: "POST",
      body: formData,
      headers: {},
    });
  },

  uploadBulkInvoices: (files) => {
    console.log(`📦 Uploading ${files.length} invoices`);
    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append("files", file);
    });

    return apiRequest(API_ENDPOINTS.INVOICE_BULK_UPLOAD, {
      method: "POST",
      body: formData,
      headers: {},
    });
  },

  getInvoices: (lastMonths) => {
    const params = lastMonths ? `?last_months=${lastMonths}` : "";
    return apiRequest(`${API_ENDPOINTS.INVOICES_LIST}${params}`);
  },

  getInvoiceEnvironmentalInsights: (lastN = 6) =>
    apiRequest(`${API_ENDPOINTS.INVOICE_ENV_INSIGHTS}?last_n=${lastN}`),

  // Logo
  getCompanyLogo: () => apiRequest(API_ENDPOINTS.COMPANY_LOGO),

  uploadLogo: (file) => {
    console.log(`🖼️ Uploading logo: ${file.name}`);
    const formData = new FormData();
    formData.append("file", file);

    return apiRequest(API_ENDPOINTS.UPLOAD_LOGO, {
      method: "POST",
      body: formData,
      headers: {},
    });
  },

  // System - try multiple health endpoints
  healthCheck: async () => {
    try {
      return await apiRequest(API_ENDPOINTS.HEALTH);
    } catch (error) {
      console.log("Primary health check failed, trying alternative...");
      try {
        return await apiRequest(API_ENDPOINTS.HEALTH_API);
      } catch (altError) {
        console.log("Testing basic backend connectivity...");
        try {
          const response = await fetch(API_BASE_URL, {
            method: "GET",
            mode: "cors",
          });
          if (response.ok) {
            return { status: "connected", message: "Backend is running but health endpoint not found" };
          }
          throw new Error(`Backend not responding (HTTP ${response.status})`);
        } catch (connectError) {
          throw new Error(`Cannot connect to ${API_BASE_URL}: ${connectError.message}`);
        }
      }
    }
  },
};

// ==================== WEB SOCKET ====================

// WebSocket connection for Live AI
export const createWebSocketConnection = () => {
  const wsUrl = API_BASE_URL.replace("http", "ws") + API_ENDPOINTS.WS_LIVE_AI;
  console.log(`🔌 Creating WebSocket connection to: ${wsUrl}`);
  return new WebSocket(wsUrl);
};

// ==================== CONNECTION UTILITIES ====================

// Check if backend is available with detailed diagnostics
export const checkBackendConnection = async () => {
  console.log(`🔍 Checking backend connection to: ${API_BASE_URL}`);
  
  try {
    const startTime = Date.now();
    const health = await api.healthCheck();
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`✅ Backend connected in ${responseTime}ms:`, health);
    
    return {
      connected: true,
      url: API_BASE_URL,
      responseTime: `${responseTime}ms`,
      status: health,
    };
  } catch (error) {
    console.error(`❌ Backend connection failed:`, error.message);
    
    return {
      connected: false,
      url: API_BASE_URL,
      error: error.message,
      timestamp: new Date().toISOString(),
      suggestions: [
        "Start backend: python -m uvicorn main:app --reload --host 0.0.0.0 --port 3001",
        "Check if port 3001 is in use: netstat -ano | findstr :3001",
        "Try: http://127.0.0.1:3001 instead of localhost",
        "Check CORS configuration in FastAPI",
      ]
    };
  }
};

// Test API endpoints for data structure issues
export const testApiDataStructures = async () => {
  console.log("🔬 Testing API Data Structures...\n");
  
  const tests = [
    { name: "Platform Overview", func: () => api.getPlatformOverview() },
    { name: "ESG Data", func: () => api.getESGData() },
    { name: "Environmental Insights", func: () => api.getEnvironmentalInsights() },
    { name: "Invoices", func: () => api.getInvoices() },
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      console.log(`\n🧪 Testing: ${test.name}...`);
      const data = await test.func();
      
      // Check for common array fields
      const arrayFields = ['summaries', 'data', 'items', 'insights'];
      const issues = [];
      
      arrayFields.forEach(field => {
        if (data[field] !== undefined && !Array.isArray(data[field])) {
          issues.push(`${field} is not an array (type: ${typeof data[field]})`);
        }
      });
      
      if (issues.length > 0) {
        console.warn(`⚠️ Issues found in ${test.name}:`, issues);
        results.push({ test: test.name, status: 'issues', issues });
      } else {
        console.log(`✅ ${test.name}: All arrays are valid`);
        results.push({ test: test.name, status: 'ok' });
      }
    } catch (error) {
      console.error(`❌ ${test.name} failed:`, error.message);
      results.push({ test: test.name, status: 'error', error: error.message });
    }
  }
  
  console.log("\n📋 Test Summary:");
  results.forEach(result => {
    console.log(`${result.status === 'ok' ? '✅' : result.status === 'issues' ? '⚠️' : '❌'} ${result.test}`);
  });
  
  return results;
};

// Quick test function for browser console
export const testBackendConnection = async () => {
  console.clear();
  console.log("🔄 Testing Backend Connection...\n");
  console.log(`Target URL: ${API_BASE_URL}\n`);
  
  const result = await checkBackendConnection();
  
  if (result.connected) {
    console.log(`🎉 SUCCESS: Backend is running!\n`);
    console.log(`Response Time: ${result.responseTime}`);
    console.log(`Status:`, result.status);
    
    // Automatically test data structures
    setTimeout(() => {
      testApiDataStructures();
    }, 1000);
  } else {
    console.log(`❌ FAILED: Cannot connect to backend\n`);
    console.log(`Error: ${result.error}\n`);
    console.log(`Troubleshooting Suggestions:`);
    result.suggestions?.forEach((suggestion, index) => {
      console.log(`${index + 1}. ${suggestion}`);
    });
  }
  
  return result;
};

// ==================== REACT HOOKS (Optional) ====================

/**
 * Custom hook for safe data fetching with automatic sanitization
 * @param {Function} fetchFunction - API function to call
 * @param {Array} dependencies - React dependencies array
 * @returns {Object} { data, loading, error }
 */
export const useSafeApiFetch = (fetchFunction, dependencies = []) => {
  const [data, setData] = useState({ summaries: [], data: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await fetchFunction();
        const sanitized = sanitizeApiResponse(result);
        setData(sanitized);
        setError(null);
      } catch (err) {
        console.error('API fetch error:', err);
        setError(err.message);
        setData({ summaries: [], data: [] }); // Safe fallback
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, dependencies);

  return { data, loading, error };
};

// ==================== GLOBAL ERROR PROTECTION ====================

// Protect against common iteration errors globally
if (typeof window !== 'undefined') {
  // Safe Array.prototype.map wrapper
  const originalMap = Array.prototype.map;
  Array.prototype.map = function(...args) {
    if (!Array.isArray(this)) {
      console.error('❌ Attempted to map on non-array:', this);
      console.trace();
      return [];
    }
    return originalMap.apply(this, args);
  };

  // Safe Array.prototype.forEach wrapper
  const originalForEach = Array.prototype.forEach;
  Array.prototype.forEach = function(...args) {
    if (!Array.isArray(this)) {
      console.error('❌ Attempted to forEach on non-array:', this);
      console.trace();
      return;
    }
    return originalForEach.apply(this, args);
  };

  console.log('🛡️ Global array protection enabled');
}

export default api;