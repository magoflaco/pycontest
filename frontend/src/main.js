// src/main.js — App bootstrap v2

import { router } from "./lib/router.js";
import { store } from "./lib/store.js";
import { toast } from "./lib/toast.js";
import { api } from "./lib/api.js";
import { renderHome } from "./pages/home.js";
import { renderRegister, renderLogin, renderVerifyEmail, renderForgotPassword } from "./pages/auth.js";
import { renderContests, renderContestDetail, renderProblem, renderJoinContest, renderLeaderboard } from "./pages/contests.js";
import { renderOrganize } from "./pages/organize.js";
import { renderSettings } from "./pages/settings.js";
import { renderLegal } from "./pages/legal.js";

window.router = router;

// ─── Navigation bar ──────────────────────────────────────────────────────────
function buildNav() {
  const existing = document.getElementById("nav");
  if (existing) existing.remove();

  const nav = document.createElement("nav");
  nav.id = "nav";
  const user = store.user;
  const isDark = store.theme === "dark";

  nav.innerHTML = `
    <div class="nav-logo" onclick="router.navigate('home')">
      Py<span class="snake">Contest</span>
    </div>
    ${user ? `
    <div class="nav-links">
      <button class="nav-link" onclick="router.navigate('home')">Inicio</button>
      ${store.canParticipate() ? `<button class="nav-link" onclick="router.navigate('contests')">Concursos</button>` : ""}
      ${store.canOrganize() ? `<button class="nav-link" onclick="router.navigate('organize')">Organizar</button>` : ""}
    </div>` : ""}
    <div class="nav-spacer"></div>
    <button class="theme-toggle" id="theme-toggle" title="Cambiar tema">${isDark ? "☀️" : "🌙"}</button>
    <div class="nav-user" id="nav-user-area">
      ${renderNavUserArea(user)}
    </div>`;

  document.body.insertBefore(nav, document.body.firstChild);

  // Theme toggle
  document.getElementById("theme-toggle").onclick = () => {
    store.toggleTheme();
    const btn = document.getElementById("theme-toggle");
    if (btn) btn.textContent = store.theme === "dark" ? "☀️" : "🌙";
  };

  // Avatar dropdown
  const avatarWrap = nav.querySelector(".nav-avatar-wrap");
  if (avatarWrap) {
    avatarWrap.addEventListener("click", (e) => {
      e.stopPropagation();
      avatarWrap.querySelector(".profile-menu")?.classList.toggle("show");
    });
    document.addEventListener("click", () => {
      avatarWrap.querySelector(".profile-menu")?.classList.remove("show");
    });
  }
}

function renderNavUserArea(user) {
  if (!user) {
    return `
      <button class="btn btn-ghost btn-sm" onclick="router.navigate('login')">Entrar</button>
      <button class="btn btn-primary btn-sm" onclick="router.navigate('register')">Registrarse</button>`;
  }
  const roleTag = { participant: "Coder", organizer: "Org", both: "Full" }[user.role] || user.role;
  const avatarContent = user.avatar
    ? `<img src="${user.avatar}" alt="${user.name}" />`
    : user.name[0].toUpperCase();
  return `
    <span style="font-size:0.78rem;color:var(--text2);font-family:var(--font-mono)">${user.username}</span>
    <span class="tag tag-purple" style="font-size:0.65rem">${roleTag}</span>
    <div class="nav-avatar-wrap">
      <div class="nav-avatar" title="${user.name}">${avatarContent}</div>
      <div class="profile-menu">
        <div class="profile-menu-item" onclick="router.navigate('home')">🏠 Inicio</div>
        <div class="profile-menu-item" onclick="router.navigate('settings')">⚙️ Configuración</div>
        <div class="profile-menu-divider"></div>
        <div class="profile-menu-item danger" onclick="doLogout()">↩ Cerrar sesión</div>
      </div>
    </div>`;
}

function doLogout() {
  store.clear();
  buildNav();
  buildFooter();
  router.navigate("home");
  toast("Sesión cerrada", "info");
}
window.doLogout = doLogout;

// ─── Footer ──────────────────────────────────────────────────────────────────
function buildFooter() {
  const existing = document.getElementById("site-footer");
  if (existing) existing.remove();

  const footer = document.createElement("footer");
  footer.id = "site-footer";
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="footer-links">
      <a href="#terms" onclick="event.preventDefault();router.navigate('terms')">Términos de Servicio</a>
      <a href="#privacy" onclick="event.preventDefault();router.navigate('privacy')">Política de Privacidad</a>
      <a href="https://github.com/magoflaco" target="_blank" rel="noopener">GitHub</a>
      <a href="mailto:ghaviano@itb.edu.ec">Contacto</a>
    </div>
    <div>© ${new Date().getFullYear()} Wicca Inc. Todos los derechos reservados.</div>`;

  document.body.appendChild(footer);
}

function requireAuth(fn) {
  if (!store.isLoggedIn()) {
    toast("Inicia sesión para continuar", "info");
    router.navigate("login");
    return;
  }
  fn();
}

// ─── Static routes ───────────────────────────────────────────────────────────
router.register("home",             () => renderHome());
router.register("register",         () => renderRegister());
router.register("login",            () => renderLogin());
router.register("verify-email",     (p) => renderVerifyEmail(p));
router.register("forgot-password",  () => renderForgotPassword());
router.register("contests",         () => requireAuth(renderContests));
router.register("organize",         () => requireAuth(() => renderOrganize({})));
router.register("settings",         () => requireAuth(() => renderSettings()));
router.register("terms",            () => renderLegal("terms"));
router.register("privacy",          () => renderLegal("privacy"));

router.register("404", () => {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const app = document.getElementById("app");
  let page = document.getElementById("page-404");
  if (!page) {
    page = document.createElement("div");
    page.id = "page-404";
    page.className = "page";
    app.appendChild(page);
  }
  page.innerHTML = `
    <div class="container-sm z1" style="padding-top:5rem;text-align:center">
      <div style="font-size:3.5rem;margin-bottom:0.75rem">🐍</div>
      <h1 style="font-size:3rem;font-weight:800;color:var(--text3)">404</h1>
      <p style="color:var(--text2);margin-top:0.5rem">Página no encontrada</p>
      <button class="btn btn-primary" style="margin-top:1.25rem" onclick="router.navigate('home')">Ir al inicio</button>
    </div>`;
  page.classList.add("active");
});

// ─── Dynamic routes ──────────────────────────────────────────────────────────
router.dynamic(/^contest\/(.+)$/, ([, id]) =>
  requireAuth(() => renderContestDetail({ id }))
);

router.dynamic(/^problem\/(.+)$/, ([, id]) =>
  requireAuth(() => renderProblem({ id }))
);

router.dynamic(/^leaderboard\/(.+)$/, ([, id]) =>
  requireAuth(() => renderLeaderboard({ id }))
);

router.dynamic(/^join\/(.+)$/, ([, token]) =>
  renderJoinContest({ token })
);

router.dynamic(/^organize\/(.+)$/, ([, id]) =>
  requireAuth(() => renderOrganize({ id }))
);

// ─── Auth change ─────────────────────────────────────────────────────────────
window.addEventListener("auth-change", () => buildNav());

// ─── Handle legacy /join/TOKEN path URLs ─────────────────────────────────────
const _pathname = window.location.pathname;
const _joinMatch = _pathname.match(/^\/join\/(.+)$/);
if (_joinMatch) {
  window.history.replaceState(null, "", "/#join/" + _joinMatch[1]);
}

// ─── Init ────────────────────────────────────────────────────────────────────
store.initTheme();
buildNav();
buildFooter();
router.init();
