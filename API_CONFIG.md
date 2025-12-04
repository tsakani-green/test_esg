# API Configuration Guide

## Overview

The frontend now uses a centralized API configuration located at `src/config/api.js`. This ensures all API calls use the correct backend URL for both development and production environments.

## Configuration

The API base URL is determined automatically based on the environment:

1. **Environment Variable** (highest priority): If `VITE_API_BASE_URL` is set, it will be used
2. **Development Mode**: Uses `http://localhost:5000` when running locally
3. **Production Mode**: Defaults to `https://esg-backend-beige.vercel.app`

## Setting the Backend URL

### For Local Development

Create a `.env.local` file in the project root:

```env
VITE_API_BASE_URL=http://localhost:5000
```

### For Production (Vercel)

Set the environment variable in Vercel Dashboard:

1. Go to your project settings
2. Navigate to **Environment Variables**
3. Add:
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: `https://your-backend-url.vercel.app`
   - **Environment**: Production, Preview, Development (as needed)

## Current Backend URL

**Production**: `https://esg-backend-beige.vercel.app`

**Note**: If your backend is deployed at a different URL, update the default in `src/config/api.js` or set the `VITE_API_BASE_URL` environment variable.

## Files Updated

All files now use the shared `API_BASE_URL` from `src/config/api.js`:

- ✅ `src/context/SimulationContext.jsx`
- ✅ `src/pages/Dashboard.jsx`
- ✅ `src/pages/DataImport.jsx`
- ✅ `src/pages/GovernanceCategory.jsx`

## Troubleshooting

### Error: "Failed to load ESG metrics and AI insights"

1. **Check Backend URL**: Verify the backend is deployed and accessible
2. **Check CORS**: Ensure the backend allows requests from your frontend domain
3. **Check Environment Variables**: Verify `VITE_API_BASE_URL` is set correctly in Vercel
4. **Check Browser Console**: Look for network errors or CORS issues

### Common Issues

- **CORS Error**: Backend needs to allow your frontend origin in `FRONTEND_ORIGIN` environment variable
- **404 Error**: Backend URL might be incorrect
- **Network Error**: Backend might not be deployed or accessible

## Testing

To test the API configuration:

1. Open browser console
2. In development, you should see: `API Base URL: http://localhost:5000`
3. Check Network tab for API requests
4. Verify requests are going to the correct URL

