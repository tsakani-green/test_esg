import React from "react";
import { ErrorBoundary } from "react-error-boundary";

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div role="alert" className="p-6 bg-red-100 rounded-lg">
      <h2 className="text-xl font-bold text-red-700 mb-2">Something went wrong.</h2>
      <pre className="text-red-700">{error.message}</pre>
      <button
        onClick={resetErrorBoundary}
        className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        Try again
      </button>
    </div>
  );
}

export default function ErrorBoundaryWrapper({ children }) {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, info) => console.error("Uncaught error:", error, info)}
    >
      {children}
    </ErrorBoundary>
  );
}
