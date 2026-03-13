// src/pages/contests.js

import { api } from "../lib/api.js";
import { store } from "../lib/store.js";
import { toast } from "../lib/toast.js";
import { router } from "../lib/router.js";
import { highlightPython } from "../lib/highlight.js";

// ─── Contests List ────────────────────────────────────────────────────────────
export async function renderContests() {
  const page = ensurePage("page-contests");
  page.innerHTML = `
    <div class="container z1">
      <div class="page-header">
        <h2>⚔️ Mis concursos</h2>
        <p>Concursos a los que has sido invitado o te has unido.</p>
      </div>
      <div id="contests-list">
        <div class="skeleton" style="height:80px;border-radius:var(--radius-lg);margin-bottom:0.75rem"></div>
        <div class="skeleton" style="height:80px;border-radius:var(--radius-lg)"></div>
      </div>
    </div>`;

  try {
    const { contests } = await api.contests.list(store.token);
    const container = document.getElementById("contests-list");

    if (!contests.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">🎮</div>
          <h3>Aún no has entrado a ningún concurso</h3>
          <p>Usa un enlace de invitación para unirte a un concurso.</p>
          <button class="btn btn-primary" style="margin-top:1rem" onclick="window.showJoinModal()">+ Unirse con enlace</button>
        </div>`;
      return;
    }

    container.innerHTML = `<div class="contests-grid">${contests.map(contestCardHTML).join("")}</div>`;
    container.querySelectorAll(".contest-card").forEach((c) => {
      c.addEventListener("click", () => router.navigate(`contest/${c.dataset.id}`));
    });
  } catch (err) {
    toast(err.message, "error");
  }
}

function contestCardHTML(c) {
  const badge = c.myRole === "admin"
    ? `<span class="tag tag-cyan" style="margin-left:auto">Organizador</span>`
    : `<span class="tag tag-purple" style="margin-left:auto">Participante</span>`;
  return `
    <div class="contest-card" data-id="${c.id}">
      <div class="contest-card-label"><div class="live-dot"></div> ${c.isActive ? "ACTIVO" : "INACTIVO"} ${badge}</div>
      <h3>${c.name}</h3>
      <p>${c.description}</p>
      <div class="contest-meta">
        <span>📋 ${c.problems?.length || 0} problemas</span>
        <span>⏱ ${c.durationMin} min</span>
        <span>👥 ${c.memberCount} participantes</span>
      </div>
      <span class="btn btn-secondary btn-sm" style="display:inline-flex;margin-top:1rem">Ver concurso →</span>
    </div>`;
}

// ─── Contest Detail ───────────────────────────────────────────────────────────
export async function renderContestDetail(params = {}) {
  const contestId = params.id;
  const page = ensurePage("page-contest-detail");

  page.innerHTML = `
    <div class="container z1">
      <div class="breadcrumb">
        <span class="breadcrumb-link" onclick="router.navigate('contests')">Concursos</span>
        <span>›</span><span id="bc-contest-name">Cargando...</span>
      </div>
      <div class="page-header">
        <h2 id="cd-title">...</h2>
        <p id="cd-meta" style="display:flex;gap:1.25rem;flex-wrap:wrap;margin-top:0.5rem;font-size:0.8rem;font-family:var(--font-mono);color:var(--text3)"></p>
      </div>
      <div id="cd-problems"><div class="skeleton" style="height:60px;border-radius:var(--radius);margin-bottom:0.5rem"></div></div>
    </div>`;

  try {
    const [{ contest }, { problems }] = await Promise.all([
      api.contests.get(contestId, store.token),
      api.problems.forContest(contestId, store.token),
    ]);

    document.getElementById("bc-contest-name").textContent = contest.name;
    document.getElementById("cd-title").textContent = contest.name;
    const maxPts = problems.reduce((s, p) => s + p.points, 0);
    document.getElementById("cd-meta").innerHTML = `
      <span>📋 ${problems.length} problemas</span>
      <span>⏱ ${contest.durationMin} min</span>
      <span>🏆 ${maxPts} pts máximo</span>
      <span>👥 ${contest.memberCount} participantes</span>
      ${contest.isOrganizer ? `<span class="tag tag-cyan">Organizador</span>` : ""}`;

    const probContainer = document.getElementById("cd-problems");
    if (!problems.length) {
      probContainer.innerHTML = `<div class="empty-state"><div class="icon">📋</div><h3>No hay problemas aún</h3></div>`;
      return;
    }

    probContainer.innerHTML = `
      <div class="problems-list">
        ${problems.map((p, i) => `
          <div class="problem-row ${p.solved ? "solved" : ""}" data-id="${p.id}">
            <div class="prob-num">${String.fromCharCode(65 + i)}</div>
            <div class="prob-name">${p.title}</div>
            <span class="tag tag-${diffColor(p.difficulty)}">${diffLabel(p.difficulty)}</span>
            <div class="prob-pts">+${p.points} pts</div>
            <div class="prob-status ${p.solved ? "solved" : p.attempted ? "attempted" : ""}">
              ${p.solved ? "✓" : p.attempted ? "~" : ""}
            </div>
          </div>`).join("")}
      </div>
      <div style="margin-top:1.5rem;display:flex;gap:0.75rem;flex-wrap:wrap">
        <button class="btn btn-secondary" onclick="router.navigate('leaderboard/${contestId}')">🏆 Ver ranking</button>
        ${contest.isOrganizer ? `<button class="btn btn-primary" onclick="router.navigate('organize/${contestId}')">⚙️ Gestionar concurso</button>` : ""}
      </div>`;

    probContainer.querySelectorAll(".problem-row").forEach((row) => {
      row.addEventListener("click", () => router.navigate(`problem/${row.dataset.id}`));
    });
  } catch (err) {
    toast(err.message, "error");
  }
}

// ─── Problem Solving ──────────────────────────────────────────────────────────
let problemTimer = null;
let problemStartTime = null;
let currentPollInterval = null;
let isSubmitting = false; // FIX: global flag to prevent double submit

export async function renderProblem(params = {}) {
  const problemId = params.id;

  // FIX: Stop any running timers/polls from previous render
  clearInterval(problemTimer);
  clearInterval(currentPollInterval);
  isSubmitting = false;

  const page = ensurePage("page-problem");

  page.innerHTML = `
    <div class="breadcrumb container-lg z1">
      <span class="breadcrumb-link" onclick="router.navigate('contests')">Concursos</span>
      <span>›</span>
      <span class="breadcrumb-link" id="bc-p-contest">Concurso</span>
      <span>›</span>
      <span id="bc-p-name">Problema</span>
    </div>
    <div class="solve-layout">
      <div>
        <div class="card" id="statement-card">
          <div class="card-header">
            <span class="card-title" id="prob-header-title">Cargando...</span>
            <span id="prob-pts-badge" class="tag tag-gold">— pts</span>
          </div>
          <div class="card-body">
            <div id="prob-statement-body" style="min-height:200px">
              <div class="skeleton" style="height:20px;margin-bottom:0.75rem"></div>
              <div class="skeleton" style="height:20px;width:80%;margin-bottom:0.75rem"></div>
              <div class="skeleton" style="height:20px;width:60%;"></div>
            </div>
          </div>
        </div>
        <div id="past-subs" style="margin-top:1rem"></div>
      </div>

      <div>
        <div class="card editor-wrap" style="position:relative">
          <div class="editor-toolbar">
            <div class="editor-dot r"></div><div class="editor-dot y"></div><div class="editor-dot g"></div>
            <span class="editor-lang">Python 3 · UTF-8</span>
          </div>
          <div style="padding:0.75rem 1rem;border-bottom:1px solid var(--border)">
            <div class="file-upload-area" id="file-drop-area">
              📂 Arrastra un archivo <strong>.py</strong> aquí o
              <label style="color:var(--cyan);cursor:pointer;text-decoration:underline">
                haz clic para seleccionar
                <input type="file" id="file-input" accept=".py,.txt" style="display:none">
              </label>
            </div>
          </div>
          <textarea id="code-editor"
            placeholder="# Escribe tu solución aquí&#10;n = int(input())&#10;print(n * 2)"
            spellcheck="false"></textarea>
          <div class="ai-overlay" id="ai-overlay">
            <div class="spinner"></div>
            <p>Qwen3-Coder evaluando<span class="thinking-dots"><span></span><span></span><span></span></span></p>
          </div>
          <div class="editor-actions">
            <button class="btn btn-primary" id="submit-btn">▶ Enviar solución</button>
            <button class="btn btn-ghost btn-sm" id="clear-btn">↺ Limpiar</button>
            <div class="timer" id="timer">⏱ 00:00</div>
          </div>
        </div>
        <div id="result-container" style="margin-top:1rem"></div>
      </div>
    </div>`;

  setupFileUpload(page);

  try {
    const { problem } = await api.problems.get(problemId, store.token);

    document.getElementById("bc-p-contest").textContent = "Concurso";
    document.getElementById("bc-p-contest").onclick = () => router.navigate(`contest/${problem.contestId}`);
    document.getElementById("bc-p-name").textContent = problem.title;
    document.getElementById("prob-header-title").textContent = problem.title;
    document.getElementById("prob-pts-badge").textContent = `+${problem.points} pts`;

    document.getElementById("prob-statement-body").innerHTML = `
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1rem">
        <span class="tag tag-${diffColor(problem.difficulty)}">${diffLabel(problem.difficulty)}</span>
        <span class="tag tag-gold">+${problem.points} pts</span>
      </div>
      <div class="prob-statement">${problem.statement}</div>
      ${problem.exampleIn ? `
        <h4 style="margin-top:1.25rem">Ejemplo de entrada</h4>
        <div class="example-block"><div class="example-label">Input</div>${escHtml(problem.exampleIn)}</div>
        <div class="example-block" style="margin-top:0.5rem"><div class="example-label">Output esperado</div>${escHtml(problem.exampleOut)}</div>
      ` : ""}
      ${problem.aiNotes ? `<p style="margin-top:1rem;font-size:0.8rem;color:var(--text2);">💡 ${escHtml(problem.aiNotes)}</p>` : ""}`;

    loadPastSubmissions(problemId);

    // Timer
    problemStartTime = Date.now();
    problemTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - problemStartTime) / 1000);
      const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
      const s = String(elapsed % 60).padStart(2, "0");
      const el = document.getElementById("timer");
      if (el) el.textContent = `⏱ ${m}:${s}`;
      else clearInterval(problemTimer);
    }, 1000);

    // FIX: Use onclick instead of addEventListener to avoid stacking listeners
    document.getElementById("submit-btn").onclick = () => submitSolution(problem);
    document.getElementById("clear-btn").onclick = () => {
      document.getElementById("code-editor").value = "";
    };

    document.getElementById("code-editor").addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const s = e.target.selectionStart;
        const end = e.target.selectionEnd;
        e.target.value = e.target.value.substring(0, s) + "    " + e.target.value.substring(end);
        e.target.selectionStart = e.target.selectionEnd = s + 4;
      }
    });
  } catch (err) {
    toast(err.message, "error");
  }
}

async function loadPastSubmissions(problemId) {
  try {
    const { submissions } = await api.submissions.forProblem(problemId, store.token);
    const container = document.getElementById("past-subs");
    if (!container) return;
    if (!submissions.length) return;

    // Pre-fill editor with most recent submission code
    const editor = document.getElementById("code-editor");
    if (editor && !editor.value.trim()) {
      editor.value = submissions[0].code;
    }

    container.innerHTML = `
      <div class="card">
        <div class="card-header"><span class="card-title">Mis envíos anteriores</span></div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:0.8rem">
            <thead>
              <tr style="border-bottom:1px solid var(--border)">
                ${["#","Veredicto","Puntos","Tiempo",""].map(h =>
                  `<th style="padding:0.6rem 1rem;text-align:left;font-family:var(--font-mono);font-size:0.68rem;text-transform:uppercase;letter-spacing:0.8px;color:var(--text3)">${h}</th>`
                ).join("")}
              </tr>
            </thead>
            <tbody>
              ${submissions.slice(0, 8).map((s, i) => {
                const fbJson = JSON.stringify(typeof s.aiFeedback === 'object' ? s.aiFeedback : {});
                const bdJson = JSON.stringify(s.aiBreakdown || {});
                return `
                <tr style="border-bottom:1px solid var(--border);cursor:pointer" class="sub-row"
                  data-code="${btoa(encodeURIComponent(s.code))}"
                  data-feedback64="${btoa(encodeURIComponent(fbJson))}"
                  data-breakdown64="${btoa(encodeURIComponent(bdJson))}"
                  data-verdict="${escHtml(s.verdict)}"
                  data-score="${s.score}"
                  data-maxscore="${s.maxScore}"
                  data-elapsed="${s.elapsedSec}">
                  <td style="padding:0.6rem 1rem;font-family:var(--font-mono);color:var(--text3)">${i + 1}</td>
                  <td style="padding:0.6rem 1rem"><span class="tag tag-${verdictColor(s.verdict)}">${s.verdict}</span></td>
                  <td style="padding:0.6rem 1rem;font-family:var(--font-mono);color:var(--gold)">${s.score}/${s.maxScore}</td>
                  <td style="padding:0.6rem 1rem;font-family:var(--font-mono);color:var(--text2)">${formatTime(s.elapsedSec)}</td>
                  <td style="padding:0.6rem 1rem">
                    <button class="btn btn-ghost btn-sm load-code-btn" title="Cargar código y feedback">Cargar</button>
                  </td>
                </tr>`}).join("")}
            </tbody>
          </table>
        </div>
      </div>`;

    container.querySelectorAll(".load-code-btn").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const row = btn.closest(".sub-row");
        // Load code
        const code = decodeURIComponent(atob(row.dataset.code));
        const editor = document.getElementById("code-editor");
        if (editor) editor.value = code;

        // Load AI feedback and breakdown if present
        try {
          const fb = JSON.parse(decodeURIComponent(atob(row.dataset.feedback64 || btoa("{}"))));
          const bd = JSON.parse(decodeURIComponent(atob(row.dataset.breakdown64 || btoa("{}"))));
          const sub = {
            verdict: row.dataset.verdict || "—",
            score: parseInt(row.dataset.score) || 0,
            maxScore: parseInt(row.dataset.maxscore) || 100,
            elapsedSec: parseInt(row.dataset.elapsed) || 0,
            aiFeedback: fb,
            aiBreakdown: bd,
          };
          if (fb.feedback || fb.suggestions || Object.keys(bd).length) {
            displayResult(sub, true);
          }
        } catch (err) {
          console.warn("Error loading AI feedback from history:", err);
        }

        toast("Código y resumen IA cargados", "info");
      };
    });
  } catch {}
}

// FIX: isSubmitting flag prevents double submit
async function submitSolution(problem) {
  if (isSubmitting) return;

  const code = document.getElementById("code-editor")?.value?.trim();
  if (!code) { toast("Escribe tu solución primero", "error"); return; }

  isSubmitting = true;
  const elapsed = Math.floor((Date.now() - problemStartTime) / 1000);

  const overlay = document.getElementById("ai-overlay");
  const submitBtn = document.getElementById("submit-btn");
  const resultContainer = document.getElementById("result-container");

  if (overlay) overlay.classList.add("show");
  if (submitBtn) submitBtn.disabled = true;
  if (resultContainer) resultContainer.innerHTML = "";

  try {
    const { submission } = await api.submissions.submit(
      { problemId: problem.id, code, elapsedSec: elapsed },
      store.token
    );
    pollSubmission(submission.id);
  } catch (err) {
    isSubmitting = false;
    if (overlay) overlay.classList.remove("show");
    if (submitBtn) submitBtn.disabled = false;
    toast(err.message, "error");
  }
}

async function pollSubmission(submissionId) {
  clearInterval(currentPollInterval);
  let attempts = 0;

  currentPollInterval = setInterval(async () => {
    attempts++;
    try {
      const { submission } = await api.submissions.get(submissionId, store.token);

      if (submission.verdict !== "Pending" || attempts > 40) {
        clearInterval(currentPollInterval);
        isSubmitting = false;
        const overlay = document.getElementById("ai-overlay");
        const submitBtn = document.getElementById("submit-btn");
        if (overlay) overlay.classList.remove("show");
        if (submitBtn) submitBtn.disabled = false;
        displayResult(submission);
        // Refresh past submissions list
        loadPastSubmissions(submission.problemId);
      }
    } catch {
      clearInterval(currentPollInterval);
      isSubmitting = false;
      const overlay = document.getElementById("ai-overlay");
      const submitBtn = document.getElementById("submit-btn");
      if (overlay) overlay.classList.remove("show");
      if (submitBtn) submitBtn.disabled = false;
    }
  }, 2000);
}

function displayResult(sub, fromHistory = false) {
  const container = document.getElementById("result-container");
  if (!container) return;

  const verdictClass = {
    "Accepted": "accepted", "Partial Credit": "partial",
    "Wrong Answer": "wrong", "Syntax Error": "wrong", "Pending": "pending",
  }[sub.verdict] || "wrong";

  const verdictIcon = { "Accepted": "✅", "Partial Credit": "⚡", "Wrong Answer": "❌", "Syntax Error": "🚫", "Pending": "⏳" };
  const pct = sub.maxScore > 0 ? Math.round((sub.score / sub.maxScore) * 100) : 0;
  const fb = typeof sub.aiFeedback === "string" ? JSON.parse(sub.aiFeedback || "{}") : (sub.aiFeedback || {});
  const bd = sub.aiBreakdown || {};

  container.innerHTML = `
    <div class="result-panel">
      <div class="result-header ${verdictClass}">
        ${verdictIcon[sub.verdict] || "❓"} ${sub.verdict}
        &nbsp;·&nbsp; ${sub.score}/${sub.maxScore} pts
        ${!fromHistory ? `&nbsp;·&nbsp; ⏱ ${formatTime(sub.elapsedSec)}` : " (historial)"}
      </div>
      <div class="result-body">
        <div class="score-bar-container">
          <div class="score-bar-labels"><span>Puntaje</span><span>${sub.score}/${sub.maxScore} pts (${pct}%)</span></div>
          <div class="score-bar"><div class="score-bar-fill" id="sfill" style="width:0%"></div></div>
        </div>
        ${Object.keys(bd).length ? `
        <div class="breakdown-grid">
          ${breakdownCell("Lógica", bd.logicScore ?? "—")}
          ${breakdownCell("Output", bd.outputScore ?? "—")}
          ${breakdownCell("Input", bd.inputScore ?? "—")}
          ${breakdownCell("Calidad", bd.qualityScore ?? "—")}
        </div>` : ""}
        ${fb.feedback || fb.suggestions ? `
        <div class="ai-feedback-box">
          <div class="ai-label">🤖 Análisis Qwen3-Coder</div>
          ${fb.feedback ? `<p><strong>Feedback:</strong> ${fb.feedback}</p>` : ""}
          ${fb.outputAnalysis ? `<p style="margin-top:0.5rem"><strong>Output:</strong> ${fb.outputAnalysis}</p>` : ""}
          ${fb.suggestions ? `<p style="margin-top:0.5rem"><strong>Sugerencias:</strong> ${fb.suggestions}</p>` : ""}
          ${fb.detectedIssues?.length ? `<p style="margin-top:0.5rem;color:var(--red)"><strong>Problemas detectados:</strong> ${fb.detectedIssues.join(", ")}</p>` : ""}
        </div>` : ""}
      </div>
    </div>`;

  setTimeout(() => {
    const fill = document.getElementById("sfill");
    if (fill) fill.style.width = pct + "%";
  }, 80);

  if (!fromHistory) {
    toast(
      sub.verdict === "Accepted" ? `✅ ¡Aceptado! +${sub.score} pts` : `Puntaje: ${sub.score}/${sub.maxScore} pts`,
      sub.verdict === "Accepted" ? "success" : "info"
    );
  }
}

function breakdownCell(label, val) {
  return `<div class="breakdown-cell"><div class="b-label">${label}</div><div class="b-val">${val}</div></div>`;
}

// ─── Join Contest — FIX: handle all cases (logged in, not logged in) ──────────
export async function renderJoinContest(params = {}) {
  const token = params.token;

  // Always save the invite token so we can redirect after login/register
  if (token) sessionStorage.setItem("pc_invite_token", token);

  // Not logged in → show a nice landing page with login/register options
  if (!store.isLoggedIn()) {
    const page = ensurePage("page-join");
    page.innerHTML = `
      <div class="container-sm z1" style="padding-top:5rem;padding-bottom:4rem;text-align:center">
        <div style="font-size:3rem;margin-bottom:1rem">🎉</div>
        <div class="hero-eyebrow" style="justify-content:center;margin-bottom:1.25rem">Invitación a concurso</div>
        <h1 style="font-size:2rem;margin-bottom:0.75rem">¡Te invitaron a<br>un concurso de Python!</h1>
        <p style="color:var(--text2);font-size:0.9rem;margin-bottom:2rem;max-width:400px;margin-left:auto;margin-right:auto">
          Crea una cuenta o inicia sesión para unirte al concurso y comenzar a resolver problemas evaluados por IA.
        </p>
        <div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap">
          <button class="btn btn-primary btn-lg" onclick="router.navigate('register')">
            Crear cuenta gratis →
          </button>
          <button class="btn btn-secondary btn-lg" onclick="router.navigate('login')">
            Ya tengo cuenta
          </button>
        </div>
        <p style="margin-top:2rem;font-size:0.75rem;color:var(--text3);font-family:var(--font-mono)">
          Token: ${token}
        </p>
      </div>`;
    return;
  }

  // Logged in → join immediately
  const page = ensurePage("page-join");
  page.innerHTML = `
    <div class="container-sm z1" style="padding-top:5rem;text-align:center">
      <div class="spinner" style="margin:0 auto 1.5rem"></div>
      <p style="color:var(--text2)">Uniéndote al concurso...</p>
    </div>`;

  try {
    const { contest, alreadyMember } = await api.contests.join(store.token, token);
    sessionStorage.removeItem("pc_invite_token");
    toast(alreadyMember ? `Ya eres miembro de "${contest.name}"` : `¡Te uniste a "${contest.name}"! 🎉`, "success");
    // Go directly to the contest
    router.navigate(`contest/${contest.id}`);
  } catch (err) {
    page.innerHTML = `
      <div class="container-sm z1" style="padding-top:5rem">
        <div class="empty-state">
          <div class="icon">🔒</div>
          <h3>Enlace inválido</h3>
          <p>${err.message}</p>
          <button class="btn btn-primary" style="margin-top:1rem" onclick="router.navigate('home')">Ir al inicio</button>
        </div>
      </div>`;
  }
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────
export async function renderLeaderboard(params = {}) {
  const contestId = params.id;
  const page = ensurePage("page-leaderboard");

  page.innerHTML = `
    <div class="container z1">
      <div class="breadcrumb">
        <span class="breadcrumb-link" onclick="router.navigate('contests')">Concursos</span>
        <span>›</span>
        <span class="breadcrumb-link" onclick="router.navigate('contest/${contestId}')">Concurso</span>
        <span>›</span><span>Ranking</span>
      </div>
      <div class="page-header">
        <h2>🏆 Ranking del concurso</h2>
        <p>Ordenado por puntaje total. El tiempo de entrega desempata.</p>
      </div>
      <div id="lb-body-wrap">
        <div class="skeleton" style="height:60px;border-radius:var(--radius);margin-bottom:0.5rem"></div>
        <div class="skeleton" style="height:60px;border-radius:var(--radius);margin-bottom:0.5rem"></div>
      </div>
    </div>`;

  try {
    const { leaderboard, problems } = await api.contests.leaderboard(contestId, store.token);

    document.getElementById("lb-body-wrap").innerHTML = `
      <div style="overflow-x:auto">
        <table class="lb-table">
          <thead>
            <tr>
              <th>#</th><th>Participante</th><th>Puntaje</th>
              <th>Resueltos</th><th>Último envío</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${leaderboard.map((entry, i) => {
              const rankClass = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
              const isWinner = i === 0 && entry.totalScore > 0;
              return `
                <tr class="lb-row">
                  <td><div class="lb-rank ${rankClass}">${i + 1}</div></td>
                  <td>
                    <div class="lb-user-info">
                      <div class="lb-avatar">${entry.user.name[0].toUpperCase()}</div>
                      <div>
                        <div style="font-weight:600">${entry.user.name}</div>
                        <div style="font-size:0.73rem;color:var(--text3);font-family:var(--font-mono)">@${entry.user.username}</div>
                      </div>
                    </div>
                  </td>
                  <td style="font-family:var(--font-mono);font-weight:700;color:var(--cyan)">${entry.totalScore}</td>
                  <td style="font-family:var(--font-mono)">${entry.problemsSolved} / ${problems.length}</td>
                  <td style="font-family:var(--font-mono);color:var(--text2);font-size:0.8rem">
                    ${entry.lastSubmitTime ? new Date(entry.lastSubmitTime).toLocaleTimeString("es", {hour:"2-digit",minute:"2-digit"}) : "—"}
                  </td>
                  <td>${isWinner ? '<div class="winner-crown">🏆 Ganador</div>' : ""}</td>
                </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
      ${!leaderboard.some(e => e.totalScore > 0) ? '<p style="text-align:center;color:var(--text3);padding:2rem;font-family:var(--font-mono)">Aún no hay envíos</p>' : ""}`;
  } catch (err) {
    toast(err.message, "error");
  }
}

// ─── File upload setup ────────────────────────────────────────────────────────
function setupFileUpload(page) {
  const area = page.querySelector("#file-drop-area");
  const input = page.querySelector("#file-input");
  const editor = page.querySelector("#code-editor");
  if (!area || !input || !editor) return;

  const readFile = (file) => {
    if (!file?.name.match(/\.(py|txt)$/i)) { toast("Solo archivos .py o .txt", "error"); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      editor.value = e.target.result;
      toast(`"${file.name}" cargado`, "success");
    };
    reader.readAsText(file);
  };

  input.addEventListener("change", () => readFile(input.files[0]));
  area.addEventListener("dragover", (e) => { e.preventDefault(); area.classList.add("drag-over"); });
  area.addEventListener("dragleave", () => area.classList.remove("drag-over"));
  area.addEventListener("drop", (e) => {
    e.preventDefault();
    area.classList.remove("drag-over");
    readFile(e.dataTransfer.files[0]);
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function ensurePage(id) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  let page = document.getElementById(id);
  if (!page) {
    page = document.createElement("div");
    page.id = id;
    page.className = "page";
    document.getElementById("app").appendChild(page);
  }
  page.classList.add("active");
  return page;
}

function diffColor(d) { return { easy: "green", medium: "gold", hard: "red" }[d] || "gray"; }
function diffLabel(d) { return { easy: "Fácil", medium: "Medio", hard: "Difícil" }[d] || d; }
function verdictColor(v) { return { "Accepted": "green", "Partial Credit": "gold", "Wrong Answer": "red", "Syntax Error": "red" }[v] || "gray"; }
function formatTime(sec) { const s = Math.max(0, parseInt(sec) || 0); return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`; }
function escHtml(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
