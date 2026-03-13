// src/lib/store.js — Simple reactive state store with theme support

const TOKEN_KEY = "pc_token";
const USER_KEY = "pc_user";
const THEME_KEY = "pc_theme";

export const store = {
  get token() {
    return localStorage.getItem(TOKEN_KEY);
  },
  get user() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  },
  set(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    window.dispatchEvent(new CustomEvent("auth-change", { detail: { token, user } }));
  },
  updateUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    window.dispatchEvent(new CustomEvent("auth-change", { detail: { token: this.token, user } }));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.dispatchEvent(new CustomEvent("auth-change", { detail: null }));
  },
  isLoggedIn() {
    return !!this.token && !!this.user;
  },
  canOrganize() {
    return ["organizer", "both"].includes(this.user?.role);
  },
  canParticipate() {
    return ["participant", "both"].includes(this.user?.role);
  },

  // Theme
  get theme() {
    return localStorage.getItem(THEME_KEY) || "light";
  },
  setTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.setAttribute("data-theme", theme);
    window.dispatchEvent(new CustomEvent("theme-change", { detail: theme }));
  },
  toggleTheme() {
    this.setTheme(this.theme === "dark" ? "light" : "dark");
  },
  initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) {
      document.documentElement.setAttribute("data-theme", saved);
    } else if (window.matchMedia("(prefers-color-scheme:dark)").matches) {
      document.documentElement.setAttribute("data-theme", "dark");
    }
    // Enable transitions after initial paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.classList.add("theme-ready");
      });
    });
  },
};
