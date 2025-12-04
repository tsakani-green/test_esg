// src/App.jsx
import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Navbar from "./components/Navbar";
import { SimulationProvider } from "./context/SimulationContext";

// ESG Category pages
import EnvironmentalCategory from "./pages/EnvironmentalCategory";
import SocialCategory from "./pages/SocialCategory";
import GovernanceCategory from "./pages/GovernanceCategory";
import Insights from "./pages/Insights";

// Environmental sub-pages
import Energy from "./pages/environment/Energy";
import Carbon from "./pages/environment/Carbon";
import Water from "./pages/environment/Water";
import Waste from "./pages/environment/Waste";
import Coal from "./pages/environment/Coal";

// Governance sub-pages
import CorporateGovernance from "./pages/governance/CorporateGovernance";
import EthicsCompliance from "./pages/governance/EthicsCompliance";
import DataPrivacySecurity from "./pages/governance/DataPrivacySecurity";
import SupplyChainGovernance from "./pages/governance/SupplyChainGovernance";

// Data Import (currently unused but keeping import in case you use later)
import DataImport from "./pages/DataImport";

import ErrorBoundaryWrapper from "./components/ErrorBoundaryWrapper";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [bootstrapped, setBootstrapped] = useState(false);

  // Load auth state on app start
  useEffect(() => {
    try {
      const stored = localStorage.getItem("esgUser");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.username) {
          setUsername(parsed.username);
          setIsAuthenticated(true);
        }
      }
    } catch (err) {
      console.error("Failed to load saved auth:", err);
    } finally {
      setBootstrapped(true);
    }
  }, []);

  const handleLogin = (name) => {
    setUsername(name);
    setIsAuthenticated(true);
    localStorage.setItem("esgUser", JSON.stringify({ username: name }));
  };

  const handleLogout = () => {
    setUsername("");
    setIsAuthenticated(false);
    localStorage.removeItem("esgUser");
  };

  if (!bootstrapped) {
    return <div>Loading...</div>;
  }

  return (
    <SimulationProvider>
      <Router>
        {isAuthenticated && (
          <Navbar userName={username} onLogout={handleLogout} />
        )}

        <Routes>
          {/* LOGIN */}
          <Route
            path="/"
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Login onLogin={handleLogin} />
              )
            }
          />

          {/* DASHBOARD OVERVIEW */}
          <Route
            path="/dashboard"
            element={
              isAuthenticated ? (
                <ErrorBoundaryWrapper>
                  <Dashboard />
                </ErrorBoundaryWrapper>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          {/* INSIGHTS */}
          <Route
            path="/dashboard/esg"
            element={
              isAuthenticated ? (
                <ErrorBoundaryWrapper>
                  <Insights />
                </ErrorBoundaryWrapper>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          {/* SOCIAL MAIN */}
          <Route
            path="/dashboard/social"
            element={
              isAuthenticated ? (
                <ErrorBoundaryWrapper>
                  <SocialCategory />
                </ErrorBoundaryWrapper>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          {/* SOCIAL SUB-PAGES (handled inside SocialCategory if needed) */}
          <Route
            path="/dashboard/social/*"
            element={
              isAuthenticated ? (
                <ErrorBoundaryWrapper>
                  <SocialCategory />
                </ErrorBoundaryWrapper>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          {/* GOVERNANCE MAIN */}
          <Route
            path="/dashboard/governance"
            element={
              isAuthenticated ? (
                <ErrorBoundaryWrapper>
                  <GovernanceCategory />
                </ErrorBoundaryWrapper>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          {/* GOVERNANCE SUB-PAGES */}
          <Route
            path="/dashboard/governance/corporate"
            element={
              isAuthenticated ? (
                <ErrorBoundaryWrapper>
                  <CorporateGovernance />
                </ErrorBoundaryWrapper>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          <Route
            path="/dashboard/governance/ethic"
            element={
              isAuthenticated ? (
                <ErrorBoundaryWrapper>
                  <EthicsCompliance />
                </ErrorBoundaryWrapper>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          <Route
            path="/dashboard/governance/data"
            element={
              isAuthenticated ? (
                <ErrorBoundaryWrapper>
                  <DataPrivacySecurity />
                </ErrorBoundaryWrapper>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          <Route
            path="/dashboard/governance/supply"
            element={
              isAuthenticated ? (
                <ErrorBoundaryWrapper>
                  <SupplyChainGovernance />
                </ErrorBoundaryWrapper>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          {/* ENVIRONMENT MAIN — REDIRECT TO ENERGY */}
          <Route
            path="/dashboard/environment"
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard/environment/energy" replace />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          {/* ENVIRONMENT SUB-PAGES */}
          <Route
            path="/dashboard/environment/energy"
            element={
              isAuthenticated ? (
                <ErrorBoundaryWrapper>
                  <Energy />
                </ErrorBoundaryWrapper>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          <Route
            path="/dashboard/environment/carbon"
            element={
              isAuthenticated ? (
                <ErrorBoundaryWrapper>
                  <Carbon />
                </ErrorBoundaryWrapper>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          <Route
            path="/dashboard/environment/water"
            element={
              isAuthenticated ? (
                <ErrorBoundaryWrapper>
                  <Water />
                </ErrorBoundaryWrapper>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          <Route
            path="/dashboard/environment/waste"
            element={
              isAuthenticated ? (
                <ErrorBoundaryWrapper>
                  <Waste />
                </ErrorBoundaryWrapper>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          <Route
            path="/dashboard/environment/coal"
            element={
              isAuthenticated ? (
                <ErrorBoundaryWrapper>
                  <Coal />
                </ErrorBoundaryWrapper>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          {/* FALLBACK */}
          <Route
            path="*"
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
        </Routes>
      </Router>
    </SimulationProvider>
  );
}

export default App;
