// src/pages/home.js — Landing page + Dashboard (v2 redesign)

import { store } from "../lib/store.js";
import { router } from "../lib/router.js";
import { api } from "../lib/api.js";

export async function renderHome() {
  const app = document.getElementById("app");
  let page = document.getElementById("page-home");
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  if (!page) {
    page = document.createElement("div");
    page.id = "page-home";
    page.className = "page";
    app.appendChild(page);
  }
  page.classList.add("active");

  if (store.isLoggedIn()) {
    await renderDashboard(page);
  } else {
    renderLanding(page);
  }
}

function renderLanding(page) {
  page.innerHTML = `
    <!-- HERO -->
    <section class="hero-section">
      <div class="hero-eyebrow">
        <span>🤖</span> Evaluado por Qwen3-Coder Plus
      </div>
      <h1 class="hero-title">
        Compite en Python.<br>
        <span class="gradient-text">Gana con inteligencia.</span>
      </h1>
      <p class="hero-subtitle">
        Plataforma de concursos de Python donde la IA entiende tu código.
        ¿Usaste <code style="font-family:var(--font-mono);background:var(--bg2);padding:0.15rem 0.4rem;border-radius:4px;font-size:0.85em">print("El resultado es:", x)</code>?
        No hay problema — la IA evalúa la <em>lógica</em>, no el formato.
      </p>
      <div class="hero-actions">
        <button class="btn btn-primary btn-lg" onclick="router.navigate('register')">
          Empezar gratis →
        </button>
        <button class="btn btn-secondary btn-lg" onclick="router.navigate('login')">
          Ya tengo cuenta
        </button>
      </div>
    </section>

    <!-- STATS -->
    <div class="container z1" style="margin-bottom:2rem">
      <div class="stats-bar">
        <div class="stat-item">
          <div class="stat-num" style="color:var(--accent)">98%</div>
          <div class="stat-label">Precisión IA</div>
        </div>
        <div class="stat-item">
          <div class="stat-num" style="color:var(--cyan)">Qwen3</div>
          <div class="stat-label">Coder Plus</div>
        </div>
        <div class="stat-item">
          <div class="stat-num" style="color:var(--gold)">∞</div>
          <div class="stat-label">Concursos</div>
        </div>
        <div class="stat-item">
          <div class="stat-num" style="color:var(--green)">OTP</div>
          <div class="stat-label">Seguro via Resend</div>
        </div>
      </div>
    </div>

    <!-- FEATURES -->
    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-icon">🧠</div>
        <h3>IA que entiende Python</h3>
        <p>Qwen3-Coder-Plus evalúa la lógica de tu código. Acepta <code style="font-family:var(--font-mono);font-size:0.85em;background:var(--bg2);padding:0.1rem 0.4rem;border-radius:3px">print</code> con texto adicional, variaciones de formato y más.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon" style="background:var(--cyan-dim)">🔒</div>
        <h3>Concursos privados</h3>
        <p>Accesibles solo mediante enlace de invitación. Los organizadores controlan quién puede participar.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon" style="background:var(--gold-dim)">🏆</div>
        <h3>Ranking en tiempo real</h3>
        <p>Sistema de puntaje por correctitud + tiempo. El ganador se determina por puntos totales, con tiempo como desempate.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon" style="background:var(--green-dim)">📁</div>
        <h3>Pega o sube archivos</h3>
        <p>Envía tu solución pegando el código directamente o subiendo un archivo <code style="font-family:var(--font-mono);font-size:0.85em;background:var(--bg2);padding:0.1rem 0.3rem;border-radius:3px">.py</code>.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon" style="background:var(--red-dim)">⚡</div>
        <h3>Feedback detallado</h3>
        <p>Después de cada envío, recibe feedback sobre lógica, output, calidad del código y sugerencias de mejora.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon" style="background:rgba(236,72,153,0.08)">🎓</div>
        <h3>Para docentes</h3>
        <p>Crea concursos, agrega problemas con enunciados HTML, invita alumnos por email y consulta todas las soluciones.</p>
      </div>
    </div>`;
}

async function renderDashboard(page) {
  const user = store.user;

  page.innerHTML = `
    <div class="container z1" style="padding-top:2rem;padding-bottom:3rem">
      <!-- Welcome -->
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;margin-bottom:1.75rem">
        <div>
          <h2 style="font-size:1.5rem">Hola, ${user.name.split(" ")[0]} 👋</h2>
          <p style="color:var(--text2);font-size:0.85rem;margin-top:0.2rem">
            ${getRoleMessage(user.role)}
          </p>
        </div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          ${store.canParticipate() ? `<button class="btn btn-secondary" onclick="router.navigate('contests')">Mis concursos</button>` : ""}
          ${store.canOrganize() ? `<button class="btn btn-primary" onclick="router.navigate('organize')">Crear concurso</button>` : ""}
        </div>
      </div>

      <!-- Stats -->
      <div id="user-stats" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:0.85rem;margin-bottom:2rem">
        <div class="skeleton" style="height:85px;border-radius:var(--radius-lg)"></div>
        <div class="skeleton" style="height:85px;border-radius:var(--radius-lg)"></div>
        <div class="skeleton" style="height:85px;border-radius:var(--radius-lg)"></div>
        <div class="skeleton" style="height:85px;border-radius:var(--radius-lg)"></div>
      </div>

      <!-- Quick actions -->
      ${store.canParticipate() ? `
      <div style="margin-bottom:0.85rem">
        <h3 style="font-size:1.1rem;font-weight:700">Acceso rápido</h3>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:0.85rem;margin-bottom:2rem">
        <div class="contest-card" onclick="router.navigate('contests')">
          <div class="contest-card-label"><div class="live-dot"></div> Participante</div>
          <h3>Mis concursos</h3>
          <p>Accede a los concursos a los que te uniste.</p>
          <span class="btn btn-secondary btn-sm" style="display:inline-flex;margin-top:0.5rem">Ver todos →</span>
        </div>
        <div class="contest-card" onclick="showJoinModal()">
          <div class="contest-card-label">🔗 Enlace</div>
          <h3>Unirse con código</h3>
          <p>¿Tienes un enlace de invitación? Únete aquí.</p>
          <span class="btn btn-secondary btn-sm" style="display:inline-flex;margin-top:0.5rem">Ingresar →</span>
        </div>
      </div>
      ` : ""}
    </div>`;

  try {
    const { totalSubmissions, contestsJoined, acceptedSolutions, totalScore } = await api.users.stats(store.token);
    document.getElementById("user-stats").innerHTML = `
      ${statCard("📤", "Envíos", totalSubmissions, "var(--accent)")}
      ${statCard("🏆", "Concursos", contestsJoined, "var(--cyan)")}
      ${statCard("✅", "Aceptadas", acceptedSolutions, "var(--green)")}
      ${statCard("⭐", "Puntos", totalScore, "var(--gold)")}
    `;
  } catch {}
}

function statCard(icon, label, value, color) {
  return `
    <div class="card" style="padding:1.1rem">
      <div style="font-size:1.3rem;margin-bottom:0.4rem">${icon}</div>
      <div style="font-size:1.5rem;font-weight:800;color:${color};line-height:1">${value}</div>
      <div style="font-size:0.7rem;color:var(--text2);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:0.5px;margin-top:0.25rem">${label}</div>
    </div>`;
}

function getRoleMessage(role) {
  return {
    participant: "Modo participante — encuentra un concurso para empezar.",
    organizer: "Modo organizador — crea concursos y gestiona participantes.",
    both: "Modo completo — organiza y participa en concursos.",
  }[role] || "";
}

function showJoinModal() {
  const modal = document.getElementById("join-modal");
  if (modal) { modal.classList.add("show"); return; }

  const el = document.createElement("div");
  el.id = "join-modal";
  el.className = "modal-overlay show";
  el.innerHTML = `
    <div class="modal">
      <button class="modal-close" onclick="document.getElementById('join-modal').classList.remove('show')">✕</button>
      <h2>Unirse con enlace</h2>
      <p class="modal-sub">Pega el enlace de invitación o el token.</p>
      <div class="form-group">
        <label>Enlace o token de invitación</label>
        <input id="join-token-input" class="form-control" placeholder="https://pycontest.app/join/abc123..." />
      </div>
      <button class="btn btn-primary btn-full" id="join-go-btn">Unirse →</button>
    </div>`;
  document.body.appendChild(el);

  el.addEventListener("click", (e) => { if (e.target === el) el.classList.remove("show"); });

  document.getElementById("join-go-btn").addEventListener("click", () => {
    let token = document.getElementById("join-token-input").value.trim();
    const match = token.match(/\/join\/([a-f0-9]+)/);
    if (match) token = match[1];
    if (!token) return;
    el.classList.remove("show");
    router.navigate(`join/${token}`);
  });
}

window.showJoinModal = showJoinModal;
