export const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const API_PREFIX = import.meta.env.API_PREFIX || "/api/v1"; // New environment variable
export const FULL_API_URL = `${BASE_URL}${API_PREFIX}`;
