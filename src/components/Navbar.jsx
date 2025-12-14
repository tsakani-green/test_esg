// src/components/Navbar.jsx
import React from "react";
import { FaBell, FaUserCircle } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import logo from "../assets/AfricaESG.AI.png";

export default function Navbar({ userName, userEmail, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Safely extract display name from userName prop
  const getDisplayName = () => {
    if (!userName) return "User";
    
    // If userName is an object, extract name or email
    if (typeof userName === 'object' && userName !== null) {
      return userName.name || userName.email || "User";
    }
    
    // If userName is already a string, use it
    if (typeof userName === 'string') {
      return userName;
    }
    
    // Fallback for any other type
    return "User";
  };

  const displayName = getDisplayName();

  // Get initials for avatar
  const getInitials = () => {
    if (!displayName || displayName === "User") return "U";
    
    const nameParts = displayName.split(" ");
    if (nameParts.length >= 2) {
      return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
    }
    return displayName[0].toUpperCase();
  };

  const handleNavClick = (path) => navigate(path);

  // Highlight active tab + its sub-routes
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
        
        {/* User Profile with Avatar */}
        <div className="flex items-center gap-3">
          {/* Avatar with dropdown */}
          <div className="relative group">
            <div className="flex items-center gap-2 cursor-pointer">
              {/* Avatar */}
              <div className="h-9 w-9 rounded-full bg-emerald-600 flex items-center justify-center text-white font-semibold text-sm">
                {getInitials()}
              </div>
              
              {/* User info - hidden on small screens */}
              <div className="hidden sm:flex flex-col items-start leading-tight">
                <span className="text-xs text-slate-500">Signed in as</span>
                <span className="text-sm font-semibold text-slate-800">
                  {displayName}
                </span>
              </div>
            </div>
            
            {/* Dropdown menu */}
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-800">{displayName}</p>
                <p className="text-xs text-slate-500 truncate">
                  {userEmail || "tsakani@greenbdgafrica.com"}
                </p>
              </div>
              
              <button
                onClick={() => handleNavClick("/dashboard/profile")}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-emerald-700 transition-colors"
              >
                <FaUserCircle className="inline mr-2" size={14} />
                My Profile
              </button>
              
              <button
                onClick={() => handleNavClick("/dashboard/settings")}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-emerald-700 transition-colors"
              >
                <svg className="inline mr-2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </button>
              
              <div className="border-t border-slate-100 pt-1">
                <button
                  onClick={onLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
          <button
          className="hidden sm:flex items-center justify-center text-emerald-700 hover:text-emerald-900 relative"
          onClick={() => handleNavClick("/dashboard/notifications")}
        >
          <FaBell size={18} />
          {/* Notification badge */}
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
            3
          </span>
        </button>

          {/* Logout button - visible on all screens */}
          <button
            onClick={onLogout}
            className="px-4 py-1.5 text-sm font-medium rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition-all hidden sm:block"
          >
            Logout
          </button>
          
          {/* Mobile logout icon */}
          <button
            onClick={onLogout}
            className="sm:hidden p-2 text-emerald-600 hover:text-emerald-800"
            title="Logout"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}