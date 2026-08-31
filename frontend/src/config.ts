const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  "http://127.0.0.1:5001";

export const config = {
  apiBaseUrl,
};
