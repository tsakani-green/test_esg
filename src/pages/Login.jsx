import React, { useState } from "react";
import logo from "../assets/AfricaESG.AI.png";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === "admin" && password === "password123") {
      onLogin(username);
    } else {
      setError("Invalid username or password");
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
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
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
            className="w-full py-2 sm:py-3 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-md text-sm sm:text-base transition duration-200 shadow-md hover:shadow-lg"
          >
            Log In
          </button>
        </form>

        <p className="text-xs sm:text-sm text-gray-500 text-center mt-8">
          © GreenBDG Africa 2025
        </p>
      </div>
    </div>
  );
}
