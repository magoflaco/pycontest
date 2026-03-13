// src/pages/organize.js

import { api } from "../lib/api.js";
import { store } from "../lib/store.js";
import { toast } from "../lib/toast.js";
import { router } from "../lib/router.js";
import { highlightPython } from "../lib/highlight.js";

export async function renderOrganize(params = {}) {
  if (params.id) return renderManageContest(params.id);

  const page = ensurePage("page-organize");

  if (!store.canOrganize()) {
    page.innerHTML = `
      <div class="container-sm z1" style="padding-top:4rem">
        <div class="empty-state">
          <div class="icon">🔒</div>
          <h3>Sin permiso</h3>
          <p>Solo los organizadores pueden acceder a este panel.</p>
          <button class="btn btn-primary" style="margin-top:1rem" onclick="router.navigate('home')">Ir al inicio</button>
        </div>
      </div>`;
    return;
  }

  page.innerHTML = `
    <div class="container z1">
      <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem">
        <div>
          <h2>🏗️ Mis concursos</h2>
          <p>Crea y gestiona concursos para tus participantes.</p>
        </div>
        <button class="btn btn-primary" id="new-contest-btn">+ Nuevo concurso</button>
      </div>
      <div id="org-contests-list"></div>
    </div>

    <div class="modal-overlay" id="new-contest-modal">
      <div class="modal" style="max-width:520px">
        <button class="modal-close" onclick="document.getElementById('new-contest-modal').classList.remove('show')">✕</button>
        <h2>Nuevo concurso</h2>
        <p class="modal-sub">Los participantes entrarán mediante enlace de invitación.</p>
        <div class="form-group">
          <label>Nombre del concurso</label>
          <input id="nc-name" class="form-control" placeholder="Olimpiada Python — Abril 2025" />
        </div>
        <div class="form-group">
          <label>Descripción</label>
          <textarea id="nc-desc" class="form-control" placeholder="Breve descripción..." style="min-height:80px"></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
          <div class="form-group">
            <label>Duración (minutos)</label>
            <input id="nc-dur" class="form-control" type="number" value="90" min="10" max="480" />
          </div>
          <div class="form-group">
            <label>Estado inicial</label>
            <select id="nc-active" class="form-control">
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>
        </div>
        <button class="btn btn-primary btn-full" id="nc-submit-btn">Crear concurso →</button>
      </div>
    </div>`;

  document.getElementById("new-contest-btn").onclick = () => {
    document.getElementById("new-contest-modal").classList.add("show");
  };

  document.getElementById("new-contest-modal").onclick = (e) => {
    if (e.target.id === "new-contest-modal") {
      document.getElementById("new-contest-modal").classList.remove("show");
    }
  };

  document.getElementById("nc-submit-btn").onclick = createContest;

  loadOrgContests();
}

async function loadOrgContests() {
  const container = document.getElementById("org-contests-list");
  if (!container) return;
  try {
    const { contests } = await api.contests.organized(store.token);
    if (!contests.length) {
      container.innerHTML = `<div class="empty-state"><div class="icon">🏗️</div><h3>Aún no has creado concursos</h3><p>Haz clic en "Nuevo concurso" para empezar.</p></div>`;
      return;
    }

    container.innerHTML = `<div class="contests-grid">${contests.map(c => `
      <div class="contest-card" data-id="${c.id}">
        <div class="contest-card-label">
          <div class="live-dot" style="${!c.isActive ? "background:var(--text3);box-shadow:none" : ""}"></div>
          ${c.isActive ? "ACTIVO" : "INACTIVO"}
          <span class="tag tag-cyan" style="margin-left:auto">${c.problems?.length || 0} problemas</span>
        </div>
        <h3>${c.name}</h3>
        <p>${c.description}</p>
        <div class="contest-meta">
          <span>👥 ${c.members?.length || 0} participantes</span>
          <span>⏱ ${c.durationMin} min</span>
        </div>
        <div style="display:flex;gap:0.5rem;margin-top:1rem;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm manage-btn" data-id="${c.id}">⚙️ Gestionar</button>
          <button class="btn btn-secondary btn-sm copy-btn" data-url="${c.inviteUrl}">🔗 Copiar enlace</button>
        </div>
      </div>`).join("")}</div>`;

    container.querySelectorAll(".manage-btn").forEach(btn => {
      btn.onclick = (e) => { e.stopPropagation(); router.navigate(`organize/${btn.dataset.id}`); };
    });
    container.querySelectorAll(".copy-btn").forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(btn.dataset.url).catch(() => {});
        toast("Enlace copiado al portapapeles", "success");
      };
    });
  } catch (err) {
    toast(err.message, "error");
  }
}

async function createContest() {
  const name        = document.getElementById("nc-name")?.value.trim();
  const description = document.getElementById("nc-desc")?.value.trim();
  const durationMin = document.getElementById("nc-dur")?.value;

  if (!name || !description) { toast("Completa nombre y descripción", "error"); return; }

  const btn = document.getElementById("nc-submit-btn");
  btn.disabled = true;
  btn.textContent = "Creando...";

  try {
    const { contest } = await api.contests.create({ name, description, durationMin }, store.token);
    document.getElementById("new-contest-modal").classList.remove("show");
    toast(`✅ Concurso "${contest.name}" creado`, "success");
    loadOrgContests();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Crear concurso →";
  }
}

async function renderManageContest(contestId) {
  const page = ensurePage("page-manage-contest");

  page.innerHTML = `
    <div class="container z1">
      <div class="breadcrumb">
        <span class="breadcrumb-link" onclick="router.navigate('organize')">Mis concursos</span>
        <span>›</span>
        <span id="mc-bc-name">Cargando...</span>
      </div>
      <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem">
        <div><h2 id="mc-title">...</h2><p id="mc-meta" style="margin-top:0.35rem;font-size:0.83rem;color:var(--text2)"></p></div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          <button class="btn btn-secondary" id="copy-link-btn">🔗 Copiar enlace</button>
          <button class="btn btn-secondary" id="view-lb-btn">🏆 Ver ranking</button>
          <button class="btn btn-primary" id="view-subs-btn">📊 Ver respuestas</button>
          <button class="btn btn-secondary" id="invite-email-btn">📧 Invitar</button>
        </div>
      </div>

      <div class="admin-grid">
        <div>
          <div class="card">
            <div class="card-header">
              <span class="card-title">Problemas</span>
              <button class="btn btn-primary btn-sm" id="add-prob-btn">+ Agregar</button>
            </div>
            <div id="mc-problems" style="padding:0.5rem"></div>
          </div>
        </div>
        <div>
          <div class="card" style="margin-bottom:1rem">
            <div class="card-header"><span class="card-title">Participantes</span></div>
            <div id="mc-members"></div>
          </div>
          <div class="card">
            <div class="card-header"><span class="card-title">Configuración</span></div>
            <div class="card-body" id="mc-settings"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="add-prob-modal">
      <div class="modal" style="max-width:600px">
        <button class="modal-close" onclick="document.getElementById('add-prob-modal').classList.remove('show')">✕</button>
        <h2>Agregar problema</h2>
        <div class="form-group">
          <label>Título</label>
          <input id="np-title" class="form-control" placeholder="Suma de dos números" />
        </div>
        <div class="form-group">
          <label>Enunciado (HTML permitido)</label>
          <textarea id="np-stmt" class="form-control" style="min-height:100px" placeholder="Dado un número N, calcula..."></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
          <div class="form-group">
            <label>Ejemplo entrada</label>
            <textarea id="np-in" class="form-control form-control-mono" style="min-height:60px" placeholder="5"></textarea>
          </div>
          <div class="form-group">
            <label>Ejemplo salida</label>
            <textarea id="np-out" class="form-control form-control-mono" style="min-height:60px" placeholder="10"></textarea>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem">
          <div class="form-group">
            <label>Puntos</label>
            <input id="np-pts" class="form-control" type="number" value="100" min="10" max="1000" />
          </div>
          <div class="form-group">
            <label>Dificultad</label>
            <select id="np-diff" class="form-control">
              <option value="easy">Fácil</option>
              <option value="medium" selected>Medio</option>
              <option value="hard">Difícil</option>
            </select>
          </div>
          <div class="form-group">
            <label>Orden</label>
            <input id="np-order" class="form-control" type="number" value="1" min="1" />
          </div>
        </div>
        <div class="form-group">
          <label>Notas para la IA (opcional)</label>
          <textarea id="np-notes" class="form-control" style="min-height:60px" placeholder="La IA debe aceptar cualquier formato de print()..."></textarea>
        </div>
        <button class="btn btn-primary btn-full" id="np-submit-btn">Crear problema →</button>
      </div>
    </div>

    <div class="modal-overlay" id="invite-modal">
      <div class="modal">
        <button class="modal-close" onclick="document.getElementById('invite-modal').classList.remove('show')">✕</button>
        <h2>Invitar por email</h2>
        <p class="modal-sub">Los usuarios recibirán un enlace de invitación por correo.</p>
        <div class="form-group">
          <label>Emails (uno por línea)</label>
          <textarea id="invite-emails" class="form-control form-control-mono" style="min-height:120px"
            placeholder="alumno1@escuela.edu&#10;alumno2@escuela.edu"></textarea>
        </div>
        <button class="btn btn-primary btn-full" id="invite-send-btn">Enviar invitaciones →</button>
      </div>
    </div>

    <div class="modal-overlay" id="subs-modal">
      <div class="modal" style="max-width:900px;max-height:90vh;overflow-y:auto">
        <button class="modal-close" onclick="document.getElementById('subs-modal').classList.remove('show')">✕</button>
        <h2>📊 Respuestas de participantes</h2>
        <p class="modal-sub">Todas las respuestas enviadas por los participantes. Puedes corregir calificaciones.</p>
        <div id="subs-list" style="margin-top:1rem">
          <div class="skeleton" style="height:50px;border-radius:var(--radius);margin-bottom:0.5rem"></div>
          <div class="skeleton" style="height:50px;border-radius:var(--radius)"></div>
        </div>
      </div>
    </div>`;

  try {
    const [{ contest }, { problems }] = await Promise.all([
      api.contests.get(contestId, store.token),
      api.problems.forContest(contestId, store.token),
    ]);

    document.getElementById("mc-bc-name").textContent = contest.name;
    document.getElementById("mc-title").textContent = contest.name;
    document.getElementById("mc-meta").textContent =
      `${contest.memberCount} participantes · ${contest.durationMin} min · ${contest.isActive ? "Activo" : "Inactivo"}`;

    document.getElementById("copy-link-btn").onclick = async () => {
      await navigator.clipboard.writeText(contest.inviteUrl).catch(() => {});
      toast("Enlace copiado", "success");
    };

    document.getElementById("view-lb-btn").onclick = () => router.navigate(`leaderboard/${contestId}`);

    document.getElementById("view-subs-btn").onclick = async () => {
      document.getElementById("subs-modal").classList.add("show");
      await loadContestSubmissions(contestId);
    };

    document.getElementById("add-prob-btn").onclick = () => {
      document.getElementById("add-prob-modal").classList.add("show");
    };

    document.getElementById("np-submit-btn").onclick = async () => {
      await createProblem(contestId);
      const { problems: updated } = await api.problems.forContest(contestId, store.token);
      renderMcProblems(updated, contestId);
    };

    document.getElementById("invite-email-btn").onclick = () => {
      document.getElementById("invite-modal").classList.add("show");
    };

    document.getElementById("invite-send-btn").onclick = async () => {
      const raw = document.getElementById("invite-emails")?.value || "";
      const emails = raw.split("\n").map(e => e.trim()).filter(Boolean);
      if (!emails.length) { toast("Agrega al menos un email", "error"); return; }
      const btn = document.getElementById("invite-send-btn");
      btn.disabled = true;
      btn.textContent = "Enviando...";
      try {
        const { sent, failed } = await api.contests.invite(contestId, emails, store.token);
        document.getElementById("invite-modal").classList.remove("show");
        document.getElementById("invite-emails").value = "";
        toast(`✅ Enviadas a ${sent.length} personas${failed.length ? `. Fallaron: ${failed.join(", ")}` : ""}`, "success");
      } catch (err) {
        toast(err.message, "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Enviar invitaciones →";
      }
    };

    renderMcProblems(problems, contestId);

    const membersEl = document.getElementById("mc-members");
    const participants = contest.members.filter(m => m.role !== "admin");
    if (!participants.length) {
      membersEl.innerHTML = `<p style="padding:0.75rem;font-size:0.82rem;color:var(--text3);font-family:var(--font-mono)">Sin participantes aún.</p>`;
    } else {
      membersEl.innerHTML = participants.map(m => `
        <div style="display:flex;align-items:center;gap:0.65rem;padding:0.6rem 0.75rem;border-bottom:1px solid var(--border)">
          <div class="lb-avatar" style="width:28px;height:28px;font-size:0.72rem">${m.user?.name?.[0] || "?"}</div>
          <div>
            <div style="font-size:0.85rem;font-weight:600">${m.user?.name || "—"}</div>
            <div style="font-size:0.72rem;color:var(--text3);font-family:var(--font-mono)">@${m.user?.username || "?"}</div>
          </div>
        </div>`).join("");
    }

    document.getElementById("mc-settings").innerHTML = `
      <div class="form-group">
        <label>Estado</label>
        <select id="mc-active-select" class="form-control">
          <option value="true" ${contest.isActive ? "selected" : ""}>Activo</option>
          <option value="false" ${!contest.isActive ? "selected" : ""}>Inactivo</option>
        </select>
      </div>
      <button class="btn btn-secondary btn-sm" id="save-settings-btn">Guardar cambios</button>`;

    document.getElementById("save-settings-btn").onclick = async () => {
      const isActive = document.getElementById("mc-active-select").value === "true";
      try {
        await api.contests.update(contestId, { isActive }, store.token);
        toast("Ajustes guardados", "success");
      } catch (err) {
        toast(err.message, "error");
      }
    };

  } catch (err) {
    toast(err.message, "error");
  }
}

// ─── Submissions Viewer for Organizer ─────────────────────────────────────────
async function loadContestSubmissions(contestId) {
  const container = document.getElementById("subs-list");
  if (!container) return;

  try {
    const { submissions } = await api.submissions.forContest(contestId, store.token);

    if (!submissions.length) {
      container.innerHTML = `<p style="text-align:center;color:var(--text3);padding:2rem;font-family:var(--font-mono)">Aún no hay respuestas.</p>`;
      return;
    }

    // Group by problem
    const byProblem = {};
    for (const s of submissions) {
      const key = s.problem?.id || s.problemId;
      if (!byProblem[key]) byProblem[key] = { title: s.problem?.title || "Problema", subs: [] };
      byProblem[key].subs.push(s);
    }

    container.innerHTML = Object.entries(byProblem).map(([pid, { title, subs }]) => `
      <div style="margin-bottom:1.5rem">
        <h4 style="font-size:0.85rem;font-family:var(--font-mono);color:var(--cyan);margin-bottom:0.5rem">${escHtml(title)}</h4>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
            <thead>
              <tr style="border-bottom:1px solid var(--border)">
                <th style="padding:0.5rem 0.75rem;text-align:left;color:var(--text3);font-family:var(--font-mono);font-size:0.68rem;text-transform:uppercase">Participante</th>
                <th style="padding:0.5rem 0.75rem;text-align:left;color:var(--text3);font-family:var(--font-mono);font-size:0.68rem;text-transform:uppercase">Veredicto</th>
                <th style="padding:0.5rem 0.75rem;text-align:left;color:var(--text3);font-family:var(--font-mono);font-size:0.68rem;text-transform:uppercase">Puntos</th>
                <th style="padding:0.5rem 0.75rem;text-align:left;color:var(--text3);font-family:var(--font-mono);font-size:0.68rem;text-transform:uppercase">Fecha</th>
                <th style="padding:0.5rem 0.75rem;text-align:left;color:var(--text3);font-family:var(--font-mono);font-size:0.68rem;text-transform:uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${subs.map(s => `
                <tr style="border-bottom:1px solid var(--border)" data-sub-id="${s.id}">
                  <td style="padding:0.5rem 0.75rem">
                    <div style="font-weight:600">${escHtml(s.user?.name || "—")}</div>
                    <div style="font-size:0.7rem;color:var(--text3);font-family:var(--font-mono)">@${escHtml(s.user?.username || "?")}</div>
                  </td>
                  <td style="padding:0.5rem 0.75rem">
                    <span class="tag tag-${verdictColor(s.verdict)}">${s.verdict}</span>
                  </td>
                  <td style="padding:0.5rem 0.75rem;font-family:var(--font-mono);color:var(--gold)">${s.score}/${s.maxScore}</td>
                  <td style="padding:0.5rem 0.75rem;font-family:var(--font-mono);color:var(--text2);font-size:0.72rem">
                    ${new Date(s.createdAt).toLocaleString("es", {day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}
                  </td>
                  <td style="padding:0.5rem 0.75rem">
                    <button class="btn btn-ghost btn-sm view-code-btn" data-sub-id="${s.id}" data-code="${btoa(encodeURIComponent(s.code))}"
                      data-verdict="${s.verdict}" data-score="${s.score}" data-maxscore="${s.maxScore}"
                      data-feedback="${escHtml(typeof s.aiFeedback === 'string' ? s.aiFeedback : JSON.stringify(s.aiFeedback || {}))}">👁 Ver</button>
                    <button class="btn btn-ghost btn-sm edit-grade-btn" data-sub-id="${s.id}" data-score="${s.score}" data-maxscore="${s.maxScore}" data-verdict="${s.verdict}">✏️ Corregir</button>
                  </td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>`).join("");

    // View code buttons
    container.querySelectorAll(".view-code-btn").forEach(btn => {
      btn.onclick = () => {
        const code = decodeURIComponent(atob(btn.dataset.code));
        let fb = {};
        try { fb = JSON.parse(btn.dataset.feedback || "{}"); } catch {}
        showCodeModal(code, btn.dataset.verdict, btn.dataset.score, btn.dataset.maxscore, fb);
      };
    });

    // Edit grade buttons
    container.querySelectorAll(".edit-grade-btn").forEach(btn => {
      btn.onclick = () => {
        showEditGradeModal(btn.dataset.subId, btn.dataset.verdict, btn.dataset.score, btn.dataset.maxscore, contestId);
      };
    });
  } catch (err) {
    container.innerHTML = `<p style="color:var(--red);padding:1rem">${err.message}</p>`;
  }
}

function showCodeModal(code, verdict, score, maxScore, feedback) {
  let modal = document.getElementById("code-view-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "code-view-modal";
    modal.className = "modal-overlay";
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("show"); });
  }

  modal.innerHTML = `
    <div class="modal" style="max-width:700px;max-height:90vh;overflow-y:auto">
      <button class="modal-close" onclick="document.getElementById('code-view-modal').classList.remove('show')">✕</button>
      <h2>Código del participante</h2>
      <div style="display:flex;gap:0.5rem;margin:0.75rem 0">
        <span class="tag tag-${verdictColor(verdict)}">${verdict}</span>
        <span class="tag tag-gold">${score}/${maxScore} pts</span>
      </div>
      <div class="code-highlight" style="max-height:350px;overflow-y:auto">${highlightPython(code)}</div>
      ${feedback.feedback ? `
        <div class="ai-feedback-box" style="margin-top:1rem">
          <div class="ai-label">🤖 Análisis IA</div>
          ${feedback.feedback ? `<p><strong>Feedback:</strong> ${escHtml(feedback.feedback)}</p>` : ""}
          ${feedback.outputAnalysis ? `<p style="margin-top:0.5rem"><strong>Output:</strong> ${escHtml(feedback.outputAnalysis)}</p>` : ""}
          ${feedback.organizerNote ? `<p style="margin-top:0.5rem;color:var(--gold)"><strong>Nota del organizador:</strong> ${escHtml(feedback.organizerNote)}</p>` : ""}
        </div>` : ""}
    </div>`;
  modal.classList.add("show");
}

function showEditGradeModal(subId, currentVerdict, currentScore, maxScore, contestId) {
  let modal = document.getElementById("edit-grade-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "edit-grade-modal";
    modal.className = "modal-overlay";
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("show"); });
  }

  modal.innerHTML = `
    <div class="modal" style="max-width:420px">
      <button class="modal-close" onclick="document.getElementById('edit-grade-modal').classList.remove('show')">✕</button>
      <h2>Corregir calificación</h2>
      <p class="modal-sub">Ajusta el veredicto y puntaje de este envío.</p>
      <div class="form-group">
        <label>Veredicto</label>
        <select id="eg-verdict" class="form-control">
          ${["Accepted","Partial Credit","Wrong Answer","Syntax Error"].map(v =>
            `<option value="${v}" ${v === currentVerdict ? "selected" : ""}>${v}</option>`
          ).join("")}
        </select>
      </div>
      <div class="form-group">
        <label>Puntaje (0-${maxScore})</label>
        <input id="eg-score" class="form-control" type="number" value="${currentScore}" min="0" max="${maxScore}" />
      </div>
      <div class="form-group">
        <label>Nota del organizador (opcional)</label>
        <textarea id="eg-feedback" class="form-control" style="min-height:60px" placeholder="Comentario sobre la corrección..."></textarea>
      </div>
      <button class="btn btn-primary btn-full" id="eg-save-btn">Guardar corrección →</button>
    </div>`;

  modal.classList.add("show");

  document.getElementById("eg-save-btn").onclick = async () => {
    const verdict = document.getElementById("eg-verdict").value;
    const score = parseInt(document.getElementById("eg-score").value);
    const feedback = document.getElementById("eg-feedback").value.trim();

    const btn = document.getElementById("eg-save-btn");
    btn.disabled = true;
    btn.textContent = "Guardando...";

    try {
      const data = { verdict, score };
      if (feedback) data.feedback = feedback;
      await api.submissions.update(subId, data, store.token);
      toast("✅ Calificación corregida", "success");
      modal.classList.remove("show");
      // Refresh submissions list
      await loadContestSubmissions(contestId);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Guardar corrección →";
    }
  };
}

function verdictColor(v) {
  return { "Accepted": "green", "Partial Credit": "gold", "Wrong Answer": "red", "Syntax Error": "red" }[v] || "gray";
}

function escHtml(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g, "&quot;");
}

function renderMcProblems(problems, contestId) {
  const container = document.getElementById("mc-problems");
  if (!container) return;

  if (!problems.length) {
    container.innerHTML = `<p style="padding:0.75rem;font-size:0.82rem;color:var(--text3);font-family:var(--font-mono)">Sin problemas. Agrega el primero.</p>`;
    return;
  }

  container.innerHTML = problems.map((p, i) => `
    <div style="display:flex;align-items:center;gap:0.65rem;padding:0.65rem 0.75rem;border-bottom:1px solid var(--border)">
      <div style="font-family:var(--font-display);font-weight:900;color:var(--accent-light);width:20px">${String.fromCharCode(65 + i)}</div>
      <div style="flex:1">
        <div style="font-size:0.88rem;font-weight:600">${p.title}</div>
        <div style="font-size:0.72rem;color:var(--text3);font-family:var(--font-mono)">${p.points} pts · ${p.difficulty}</div>
      </div>
      <button class="btn btn-ghost btn-sm del-prob-btn" data-id="${p.id}" title="Eliminar">🗑</button>
    </div>`).join("");

  container.querySelectorAll(".del-prob-btn").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm("¿Eliminar este problema?")) return;
      try {
        await api.problems.delete(btn.dataset.id, store.token);
        toast("Problema eliminado", "info");
        const { problems: updated } = await api.problems.forContest(contestId, store.token);
        renderMcProblems(updated, contestId);
      } catch (err) {
        toast(err.message, "error");
      }
    };
  });
}

async function createProblem(contestId) {
  const title      = document.getElementById("np-title")?.value.trim();
  const statement  = document.getElementById("np-stmt")?.value.trim();
  const exampleIn  = document.getElementById("np-in")?.value.trim();
  const exampleOut = document.getElementById("np-out")?.value.trim();
  const points     = document.getElementById("np-pts")?.value;
  const difficulty = document.getElementById("np-diff")?.value;
  const order      = document.getElementById("np-order")?.value;
  const aiNotes    = document.getElementById("np-notes")?.value.trim();

  if (!title || !statement) { toast("Título y enunciado requeridos", "error"); return; }

  const btn = document.getElementById("np-submit-btn");
  btn.disabled = true;
  btn.textContent = "Creando...";

  try {
    await api.problems.create({ contestId, title, statement, exampleIn, exampleOut, points, difficulty, order, aiNotes }, store.token);
    document.getElementById("add-prob-modal").classList.remove("show");
    toast(`✅ Problema "${title}" creado`, "success");
    ["np-title", "np-stmt", "np-in", "np-out", "np-notes"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
  } catch (err) {
    toast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Crear problema →";
  }
}

function ensurePage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
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
