// src/components/Navbar.jsx
import React from "react";
import { FaBell } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import logo from "../assets/AfricaESG.AI.png";

export default function Navbar({ userName, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavClick = (path) => navigate(path);

  // highlight active tab + its sub-routes
  const isActive = (basePath) => {
    const { pathname } = location;

    // Special case: Overview should ONLY be active on /dashboard
    if (basePath === "/dashboard") {
      return pathname === "/dashboard"
        ? "text-emerald-700 border-emerald-600"
        : "text-slate-700 border-transparent hover:text-emerald-700 hover:border-emerald-400";
    }

    // For sections (environment, social, governance) include subpaths
    if (pathname === basePath || pathname.startsWith(basePath + "/")) {
      return "text-emerald-700 border-emerald-600";
    }

    return "text-slate-700 border-transparent hover:text-emerald-700 hover:border-emerald-400";
  };

  return (
    <nav className="w-full bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between font-inter">
      {/* Left: Logo */}
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => handleNavClick("/dashboard")}
      >
        <img src={logo} alt="AfricaESG.AI Logo" className="h-10 w-10" />
        <div className="hidden sm:block leading-tight">
          <p className="text-base font-semibold text-emerald-800 tracking-tight">
            AfricaESG.AI
          </p>
          <p className="text-xs text-slate-500">ESG Reporting Platform</p>
        </div>
      </div>

      {/* Center Navigation */}
      <div className="hidden md:flex items-center gap-6">
        {/* Overview */}
        <button
          onClick={() => handleNavClick("/dashboard")}
          className={`text-base font-medium border-b-2 pb-1 transition-all ${isActive(
            "/dashboard"
          )}`}
        >
          Overview
        </button>

        {/* Environmental */}
        <button
          onClick={() => handleNavClick("/dashboard/environment/energy")}
          className={`text-base font-medium border-b-2 pb-1 transition-all ${isActive(
            "/dashboard/environment"
          )}`}
        >
          Environmental
        </button>

        {/* Social */}
        <button
          onClick={() => handleNavClick("/dashboard/social")}
          className={`text-base font-medium border-b-2 pb-1 transition-all ${isActive(
            "/dashboard/social"
          )}`}
        >
          Social
        </button>

        {/* Governance */}
        <button
          onClick={() => handleNavClick("/dashboard/governance/corporate")}
          className={`text-base font-medium border-b-2 pb-1 transition-all ${isActive(
            "/dashboard/governance"
          )}`}
        >
          Governance
        </button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        <button
          className="hidden sm:flex items-center justify-center text-emerald-700 hover:text-emerald-900"
          onClick={() => handleNavClick("/dashboard/notifications")}
        >
          <FaBell size={18} />
        </button>

        <div className="hidden sm:flex flex-col items-end leading-tight">
          <span className="text-xs text-slate-500">Signed in as</span>
          <span className="text-sm font-semibold text-slate-800">
            {userName}
          </span>
        </div>

        <button
          onClick={onLogout}
          className="px-4 py-1.5 text-sm font-medium rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
