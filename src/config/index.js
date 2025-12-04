// src/config/index.js
export * from './api';

// App configuration
export const APP_CONFIG = {
  name: import.meta.env.VITE_APP_NAME || 'AfricaESG.AI Dashboard',
  version: '1.0.0',
  environment: import.meta.env.MODE,
  
  // Features
  features: {
    liveAI: true,
    pdfUpload: true,
    excelUpload: true,
    logoExtraction: true,
  },
  
  // Debug mode
  debug: import.meta.env.DEV,
  
  // Backend status
  getBackendStatus: async () => {
    const { checkBackendConnection } = await import('./api');
    return checkBackendConnection();
  },
};

// Development helpers
if (import.meta.env.DEV) {
  console.log('🔧 App Configuration:', APP_CONFIG);
  console.log('🌐 API Base URL:', import.meta.env.VITE_API_BASE_URL);
}