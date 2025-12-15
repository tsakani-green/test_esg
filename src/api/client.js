// src/api/client.js
import { API_BASE_URL } from "../config/api";

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (fetchError) {
    // Handle network-level errors (e.g., no internet, server unreachable)
    console.error("Network error during fetch:", fetchError);
    throw new Error(
      `Network error: Unable to reach the server. Please check your internet connection and try again.`
    );
  }

  if (res.status === 401 || res.status === 403) {
    // Optional: clear invalid token
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  if (!res.ok) {
    let data = {};
    try {
      data = await res.json();
    } catch (e) {}
    const message = data.detail || `Request failed: ${res.status}`;
    throw new Error(message);
  }

  return res.json();
}
