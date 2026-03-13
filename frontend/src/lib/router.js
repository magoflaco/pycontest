// src/lib/router.js — Hash-based SPA router

const routes = {};
const dynamicHandlers = [];
let _suppressNext = false; // prevents double-dispatch from navigate() + hashchange

export const router = {
  register(path, handler) {
    routes[path] = handler;
  },

  dynamic(regex, handler) {
    dynamicHandlers.push({ regex, handler });
  },

  navigate(path, params = {}) {
    _suppressNext = true;          // tell hashchange listener to skip next fire
    window.location.hash = path;
    this._dispatch(path, params);
  },

  _dispatch(hash, params = {}) {
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    document.querySelectorAll(".nav-link").forEach((l) => {
      l.classList.toggle("active", l.dataset.route === hash.split("/")[0]);
    });

    if (routes[hash]) { routes[hash](params); return; }

    for (const { regex, handler } of dynamicHandlers) {
      const match = hash.match(regex);
      if (match) { handler(match); return; }
    }

    if (routes["404"]) routes["404"](params);
  },

  init() {
    window.addEventListener("hashchange", () => {
      if (_suppressNext) { _suppressNext = false; return; } // skip — already handled by navigate()
      const hash = window.location.hash.slice(1) || "home";
      this._dispatch(hash);
    });

    const initial = window.location.hash.slice(1) || "home";
    this._dispatch(initial);
  },
};
