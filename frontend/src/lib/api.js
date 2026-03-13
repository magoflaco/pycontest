// src/lib/api.js — Centralized API client with error handling and retry

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, body = null, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  let lastError;
  const maxRetries = method === "GET" ? 2 : 1;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/api${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new ApiError(data.error || `Error del servidor (${res.status})`, res.status);
      }

      return data;
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;

      if (err instanceof ApiError) {
        if (err.status < 500) throw err;
        if (attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        throw err;
      }

      if (err.name === "AbortError") {
        throw new ApiError("La solicitud tardó demasiado. Verifica tu conexión.", 0);
      }

      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      throw new ApiError("Error de conexión. Verifica tu internet e inténtalo de nuevo.", 0);
    }
  }

  throw lastError;
}

export const api = {
  get: (path, token) => request("GET", path, null, token),
  post: (path, body, token) => request("POST", path, body, token),
  patch: (path, body, token) => request("PATCH", path, body, token),
  delete: (path, token, body) => body ? request("DELETE", path, body, token) : request("DELETE", path, null, token),

  auth: {
    register: (data) => request("POST", "/auth/register", data),
    verifyEmail: (data) => request("POST", "/auth/verify-email", data),
    resendOtp: (data) => request("POST", "/auth/resend-otp", data),
    login: (data) => request("POST", "/auth/login", data),
    forgotPassword: (data) => request("POST", "/auth/forgot-password", data),
    resetPassword: (data) => request("POST", "/auth/reset-password", data),
    me: (token) => request("GET", "/auth/me", null, token),
    updateProfile: (data, token) => request("PATCH", "/auth/profile", data, token),
    deleteAccount: (password, token) => request("DELETE", "/auth/account", { password }, token),
    changePassword: (data, token) => request("POST", "/auth/change-password", data, token),
    changeEmail: (data, token) => request("POST", "/auth/change-email", data, token),
    verifyNewEmail: (data, token) => request("POST", "/auth/verify-new-email", data, token),
  },

  contests: {
    list: (token) => request("GET", "/contests", null, token),
    organized: (token) => request("GET", "/contests/organized", null, token),
    get: (id, token) => request("GET", `/contests/${id}`, null, token),
    create: (data, token) => request("POST", "/contests", data, token),
    update: (id, data, token) => request("PATCH", `/contests/${id}`, data, token),
    delete: (id, token) => request("DELETE", `/contests/${id}`, null, token),
    join: (token_, contestToken) => request("GET", `/contests/join/${contestToken}`, null, token_),
    invite: (id, emails, token) => request("POST", `/contests/${id}/invite`, { emails }, token),
    leaderboard: (id, token) => request("GET", `/contests/${id}/leaderboard`, null, token),
  },

  problems: {
    forContest: (contestId, token) => request("GET", `/problems/contest/${contestId}`, null, token),
    get: (id, token) => request("GET", `/problems/${id}`, null, token),
    create: (data, token) => request("POST", "/problems", data, token),
    update: (id, data, token) => request("PATCH", `/problems/${id}`, data, token),
    delete: (id, token) => request("DELETE", `/problems/${id}`, null, token),
  },

  submissions: {
    submit: (data, token) => request("POST", "/submissions", data, token),
    get: (id, token) => request("GET", `/submissions/${id}`, null, token),
    forProblem: (problemId, token) => request("GET", `/submissions/problem/${problemId}`, null, token),
    forContest: (contestId, token) => request("GET", `/submissions/contest/${contestId}`, null, token),
    update: (id, data, token) => request("PATCH", `/submissions/${id}`, data, token),
  },

  users: {
    stats: (token) => request("GET", "/users/stats", null, token),
  },
};

export { ApiError };
