// src/utils/fetchError.js
/**
 * Utility to handle and format fetch errors consistently across the app
 */

export function isFetchError(error) {
  return error?.message?.includes("Failed to fetch");
}

export function formatFetchError(error) {
  if (!error) return "An unknown error occurred";

  const message = error.message || String(error);

  // Network-level errors
  if (message.includes("Failed to fetch")) {
    return "Unable to connect to the server. Please check your internet connection and try again.";
  }

  if (message.includes("Network error")) {
    return "Network error: Unable to reach the server. Please check your internet connection.";
  }

  if (message.includes("CORS")) {
    return "Cross-Origin Request Blocked. The server rejected the request. Please contact support.";
  }

  if (message.includes("401") || message.includes("403")) {
    return "Authentication failed. Please log in again.";
  }

  if (message.includes("404")) {
    return "The requested resource was not found. Please refresh and try again.";
  }

  if (message.includes("500") || message.includes("502") || message.includes("503")) {
    return "Server error. The service is temporarily unavailable. Please try again later.";
  }

  if (message.includes("timeout")) {
    return "Request timeout. The server took too long to respond. Please try again.";
  }

  // Return the original message if no specific match
  return message;
}

export function createFetchErrorHandler(setError) {
  return (error) => {
    console.error("Fetch error:", error);
    const formattedError = formatFetchError(error);
    if (setError) setError(formattedError);
  };
}
