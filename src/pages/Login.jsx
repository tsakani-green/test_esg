// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/AfricaESG.AI.png";
import api from "../config/api"; // ✅ use the shared API helper

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("tsakani@greenbdgafrica.com");
  const [password, setPassword] = useState("ChangeMe123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // ✅ use api.login (POST /auth/login on http://127.0.0.1:3001)
      const data = await api.login({ email, password });

      // Expected FastAPI response: { access_token, token_type, user }
      if (!data?.access_token) {
        throw new Error("Login response missing access token");
      }

      // Save token + user to localStorage
      localStorage.setItem("token", data.access_token);
      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      }

      // optional callback for parent
      if (onLogin) {
        onLogin(data.user || null);
      }

      // Redirect to main ESG page
      navigate("/environment/energy"); // change if your main route is different
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4 sm:px-6 md:px-8 font-inter">
      <div className="bg-white w-full max-w-md p-8 sm:p-10 rounded-2xl shadow-lg border border-gray-100 transition-all">
        <div className="flex flex-col items-center mb-8">
          <img
            src={logo}
            alt="AfricaESG.AI Logo"
            className="w-36 h-36 sm:w-40 sm:h-40 mb-3 object-contain"
          />
          <h1 className="text-2xl sm:text-3xl font-semibold text-green-800 tracking-tight text-center">
            ESG REPORTING <br /> PLATFORM
          </h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-gray-700 font-medium text-sm sm:text-base mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              className="w-full px-3 py-2 sm:py-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-700 text-gray-800 text-sm sm:text-base placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium text-sm sm:text-base mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your secure password"
              required
              className="w-full px-3 py-2 sm:py-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-700 text-gray-800 text-sm sm:text-base placeholder-gray-400"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 sm:py-3 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-md text-sm sm:text-base transition duration-200 shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <p className="text-xs sm:text-sm text-gray-500 text-center mt-8">
          © GreenBDG Africa 2025
        </p>
      </div>
    </div>
  );
}
