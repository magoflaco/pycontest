// src/pages/settings.js — User settings page

import { api } from "../lib/api.js";
import { store } from "../lib/store.js";
import { toast } from "../lib/toast.js";
import { router } from "../lib/router.js";

const AVATAR_COLORS = [
  ["#6366F1", "#818CF8"], ["#8B5CF6", "#A78BFA"], ["#EC4899", "#F472B6"],
  ["#EF4444", "#F87171"], ["#F59E0B", "#FBBF24"], ["#10B981", "#34D399"],
  ["#06B6D4", "#22D3EE"], ["#3B82F6", "#60A5FA"], ["#D946EF", "#E879F9"],
  ["#14B8A6", "#2DD4BF"], ["#F97316", "#FB923C"], ["#84CC16", "#A3E635"],
];

export function renderSettings() {
  const page = ensurePage("page-settings");
  const user = store.user;

  page.innerHTML = `
    <div class="container z1" style="padding-top:1.5rem;padding-bottom:3rem">
      <div class="page-header">
        <h2>⚙️ Configuración</h2>
        <p>Administra tu perfil, seguridad y preferencias.</p>
      </div>
      <div class="settings-layout">
        <div class="settings-nav" id="settings-nav">
          <div class="settings-nav-item active" data-section="profile">👤 Perfil</div>
          <div class="settings-nav-item" data-section="security">🔒 Seguridad</div>
          <div class="settings-nav-item" data-section="appearance">🎨 Apariencia</div>
          <div class="settings-nav-item" data-section="danger">⚠️ Zona peligrosa</div>
        </div>
        <div id="settings-content">
          <!-- Sections rendered here -->
        </div>
      </div>
    </div>`;

  // Nav items
  page.querySelectorAll(".settings-nav-item").forEach(item => {
    item.onclick = () => {
      page.querySelectorAll(".settings-nav-item").forEach(i => i.classList.remove("active"));
      item.classList.add("active");
      renderSection(item.dataset.section, user);
    };
  });

  renderSection("profile", user);
}

function renderSection(section, user) {
  const container = document.getElementById("settings-content");
  if (!container) return;

  switch (section) {
    case "profile":   return renderProfileSection(container, user);
    case "security":  return renderSecuritySection(container, user);
    case "appearance":return renderAppearanceSection(container);
    case "danger":    return renderDangerSection(container);
  }
}

// ─── Profile Section ─────────────────────────────────────────────────────────
function renderProfileSection(container, user) {
  container.innerHTML = `
    <div class="settings-card">
      <h3>Foto de perfil</h3>
      <p>Sube una foto o genera un avatar automático.</p>
      <div class="avatar-editor">
        <div class="avatar-preview" id="avatar-preview">
          ${user.avatar ? `<img src="${user.avatar}" alt="Avatar" />` : generateSVGAvatar(user.name, user.email)}
        </div>
        <div class="avatar-actions">
          <label class="btn btn-secondary btn-sm" style="cursor:pointer">
            📷 Subir foto
            <input type="file" id="avatar-file" accept="image/*" style="display:none" />
          </label>
          <button class="btn btn-ghost btn-sm" id="gen-avatar-btn">🎨 Generar avatar</button>
          ${user.avatar ? `<button class="btn btn-ghost btn-sm" id="remove-avatar-btn" style="color:var(--red)">✕ Quitar foto</button>` : ""}
        </div>
      </div>
      <div id="avatar-palette" style="display:none;margin-bottom:1rem">
        <p style="font-size:0.78rem;color:var(--text2);margin-bottom:0.4rem">Elige una paleta de colores:</p>
        <div class="color-grid">
          ${AVATAR_COLORS.map(([c1, c2], i) => `
            <div class="color-swatch" data-idx="${i}"
              style="background:linear-gradient(135deg,${c1},${c2})"
              title="Paleta ${i + 1}"></div>
          `).join("")}
        </div>
        <button class="btn btn-primary btn-sm" id="apply-gen-avatar" style="margin-top:0.6rem">Aplicar avatar generado</button>
      </div>
    </div>

    <div class="settings-card">
      <h3>Información personal</h3>
      <p>Tu nombre y usuario visibles a otros participantes.</p>
      <div class="form-group">
        <label>Nombre completo</label>
        <input id="set-name" class="form-control" value="${escHtml(user.name)}" />
      </div>
      <div class="form-group">
        <label>Nombre de usuario</label>
        <input id="set-username" class="form-control" value="${escHtml(user.username)}" />
        <div class="form-hint">3-20 caracteres alfanuméricos o _</div>
      </div>
      <div class="form-group">
        <label>Rol</label>
        <select id="set-role" class="form-control">
          <option value="participant" ${user.role === "participant" ? "selected" : ""}>🎮 Participante</option>
          <option value="organizer" ${user.role === "organizer" ? "selected" : ""}>🏗️ Organizador</option>
          <option value="both" ${user.role === "both" ? "selected" : ""}>⚡ Ambos</option>
        </select>
      </div>
      <button class="btn btn-primary" id="save-profile-btn">Guardar cambios</button>
    </div>`;

  // File upload
  const fileInput = container.querySelector("#avatar-file");
  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast("La imagen no puede superar 2MB", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result;
      try {
        const { user: updated } = await api.auth.updateProfile({ avatar: base64 }, store.token);
        store.updateUser(updated);
        const preview = document.getElementById("avatar-preview");
        if (preview) preview.innerHTML = `<img src="${base64}" alt="Avatar" />`;
        toast("Foto de perfil actualizada", "success");
      } catch (err) {
        toast(err.message, "error");
      }
    };
    reader.readAsDataURL(file);
  });

  // Generate avatar
  container.querySelector("#gen-avatar-btn")?.addEventListener("click", () => {
    const palette = container.querySelector("#avatar-palette");
    if (palette) palette.style.display = palette.style.display === "none" ? "block" : "none";
  });

  let selectedPaletteIdx = 0;
  container.querySelectorAll(".color-swatch").forEach(swatch => {
    swatch.onclick = () => {
      container.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("selected"));
      swatch.classList.add("selected");
      selectedPaletteIdx = parseInt(swatch.dataset.idx);
      // Preview
      const preview = document.getElementById("avatar-preview");
      const [c1, c2] = AVATAR_COLORS[selectedPaletteIdx];
      if (preview) preview.innerHTML = generateSVGAvatar(user.name, user.email + selectedPaletteIdx, c1, c2);
    };
  });

  container.querySelector("#apply-gen-avatar")?.addEventListener("click", async () => {
    const [c1, c2] = AVATAR_COLORS[selectedPaletteIdx];
    const svgStr = generateSVGAvatarRaw(user.name, user.email + selectedPaletteIdx, c1, c2);
    const base64 = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgStr)));
    try {
      const { user: updated } = await api.auth.updateProfile({ avatar: base64 }, store.token);
      store.updateUser(updated);
      toast("Avatar generado aplicado", "success");
    } catch (err) {
      toast(err.message, "error");
    }
  });

  container.querySelector("#remove-avatar-btn")?.addEventListener("click", async () => {
    try {
      const { user: updated } = await api.auth.updateProfile({ avatar: "" }, store.token);
      store.updateUser(updated);
      const preview = document.getElementById("avatar-preview");
      if (preview) preview.innerHTML = generateSVGAvatar(updated.name, updated.email);
      toast("Foto eliminada", "info");
    } catch (err) {
      toast(err.message, "error");
    }
  });

  // Save profile
  container.querySelector("#save-profile-btn")?.addEventListener("click", async () => {
    const name     = document.getElementById("set-name")?.value.trim();
    const username = document.getElementById("set-username")?.value.trim();
    const role     = document.getElementById("set-role")?.value;

    if (!name || name.length < 2) { toast("Nombre debe tener al menos 2 caracteres", "error"); return; }
    if (!username || username.length < 3) { toast("Usuario debe tener al menos 3 caracteres", "error"); return; }

    const btn = container.querySelector("#save-profile-btn");
    btn.disabled = true;
    btn.textContent = "Guardando...";

    try {
      const { user: updated } = await api.auth.updateProfile({ name, username, role }, store.token);
      store.updateUser(updated);
      toast("Perfil actualizado", "success");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Guardar cambios";
    }
  });
}

// ─── Security Section ────────────────────────────────────────────────────────
function renderSecuritySection(container, user) {
  container.innerHTML = `
    <div class="settings-card">
      <h3>Cambiar contraseña</h3>
      <p>Usa una contraseña segura de al menos 8 caracteres.</p>
      <div class="form-group">
        <label>Contraseña actual</label>
        <input id="sec-current-pass" class="form-control" type="password" placeholder="Tu contraseña actual" />
      </div>
      <div class="form-group">
        <label>Nueva contraseña</label>
        <input id="sec-new-pass" class="form-control" type="password" placeholder="Mínimo 8 caracteres" />
      </div>
      <div class="form-group">
        <label>Confirmar nueva contraseña</label>
        <input id="sec-confirm-pass" class="form-control" type="password" placeholder="Repite la nueva contraseña" />
      </div>
      <button class="btn btn-primary" id="change-pass-btn">Cambiar contraseña</button>
    </div>

    <div class="settings-card">
      <h3>Cambiar email</h3>
      <p>Tu email actual: <strong style="color:var(--accent)">${escHtml(user.email)}</strong></p>
      <div id="email-step1">
        <div class="form-group">
          <label>Nuevo email</label>
          <input id="sec-new-email" class="form-control" type="email" placeholder="nuevo@email.com" />
        </div>
        <div class="form-group">
          <label>Contraseña (confirmación)</label>
          <input id="sec-email-pass" class="form-control" type="password" placeholder="Tu contraseña actual" />
        </div>
        <button class="btn btn-primary" id="change-email-btn">Enviar código de verificación</button>
      </div>
      <div id="email-step2" style="display:none">
        <p style="font-size:0.82rem;color:var(--text2);margin-bottom:0.75rem">Ingresa el código enviado a tu nuevo email:</p>
        <div class="otp-inputs" id="email-otp-inputs">
          <input class="otp-input" maxlength="1" inputmode="numeric" />
          <input class="otp-input" maxlength="1" inputmode="numeric" />
          <input class="otp-input" maxlength="1" inputmode="numeric" />
          <input class="otp-input" maxlength="1" inputmode="numeric" />
          <input class="otp-input" maxlength="1" inputmode="numeric" />
          <input class="otp-input" maxlength="1" inputmode="numeric" />
        </div>
        <button class="btn btn-primary" id="verify-new-email-btn" style="margin-top:0.75rem;width:100%">Verificar y cambiar email</button>
      </div>
    </div>`;

  // Change password
  container.querySelector("#change-pass-btn")?.addEventListener("click", async () => {
    const currentPassword = document.getElementById("sec-current-pass")?.value;
    const newPassword = document.getElementById("sec-new-pass")?.value;
    const confirmPassword = document.getElementById("sec-confirm-pass")?.value;

    if (!currentPassword || !newPassword) { toast("Completa todos los campos", "error"); return; }
    if (newPassword.length < 8) { toast("La nueva contraseña debe tener al menos 8 caracteres", "error"); return; }
    if (newPassword !== confirmPassword) { toast("Las contraseñas no coinciden", "error"); return; }

    const btn = container.querySelector("#change-pass-btn");
    btn.disabled = true;
    btn.textContent = "Cambiando...";

    try {
      await api.auth.changePassword({ currentPassword, newPassword }, store.token);
      toast("✅ Contraseña cambiada correctamente", "success");
      document.getElementById("sec-current-pass").value = "";
      document.getElementById("sec-new-pass").value = "";
      document.getElementById("sec-confirm-pass").value = "";
    } catch (err) {
      toast(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Cambiar contraseña";
    }
  });

  // Change email — step 1
  let emailChangeUserId = null;
  let emailChangeNewEmail = null;
  container.querySelector("#change-email-btn")?.addEventListener("click", async () => {
    const newEmail = document.getElementById("sec-new-email")?.value.trim();
    const password = document.getElementById("sec-email-pass")?.value;

    if (!newEmail || !password) { toast("Completa email y contraseña", "error"); return; }

    const btn = container.querySelector("#change-email-btn");
    btn.disabled = true;
    btn.textContent = "Enviando...";

    try {
      const { userId } = await api.auth.changeEmail({ newEmail, password }, store.token);
      emailChangeUserId = userId;
      emailChangeNewEmail = newEmail;
      document.getElementById("email-step1").style.display = "none";
      document.getElementById("email-step2").style.display = "block";
      setupOTPInputs(container.querySelector("#email-otp-inputs"));
      toast("Código enviado al nuevo email", "info");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Enviar código de verificación";
    }
  });

  // Change email — step 2
  container.querySelector("#verify-new-email-btn")?.addEventListener("click", async () => {
    const inputs = container.querySelectorAll("#email-otp-inputs .otp-input");
    const code = Array.from(inputs).map(i => i.value).join("");

    if (code.length !== 6) { toast("Ingresa el código completo", "error"); return; }

    const btn = container.querySelector("#verify-new-email-btn");
    btn.disabled = true;
    btn.textContent = "Verificando...";

    try {
      const { user: updated, token } = await api.auth.verifyNewEmail({ userId: emailChangeUserId, code, newEmail: emailChangeNewEmail }, store.token);
      if (token) store.set(token, updated);
      else store.updateUser(updated);
      toast("✅ Email actualizado correctamente", "success");
      renderSecuritySection(container, updated);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Verificar y cambiar email";
    }
  });
}

// ─── Appearance Section ──────────────────────────────────────────────────────
function renderAppearanceSection(container) {
  const currentTheme = store.theme;
  container.innerHTML = `
    <div class="settings-card">
      <h3>Tema de la interfaz</h3>
      <p>Elige cómo se ve PyContest.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-top:0.5rem">
        <button class="btn ${currentTheme === 'light' ? 'btn-primary' : 'btn-secondary'}" id="theme-light-btn">
          ☀️ Claro
        </button>
        <button class="btn ${currentTheme === 'dark' ? 'btn-primary' : 'btn-secondary'}" id="theme-dark-btn">
          🌙 Oscuro
        </button>
      </div>
    </div>`;

  container.querySelector("#theme-light-btn")?.addEventListener("click", () => {
    store.setTheme("light");
    renderAppearanceSection(container);
    const toggle = document.getElementById("theme-toggle");
    if (toggle) toggle.textContent = "🌙";
    toast("Tema claro activado", "info");
  });
  container.querySelector("#theme-dark-btn")?.addEventListener("click", () => {
    store.setTheme("dark");
    renderAppearanceSection(container);
    const toggle = document.getElementById("theme-toggle");
    if (toggle) toggle.textContent = "☀️";
    toast("Tema oscuro activado", "info");
  });
}

// ─── Danger Zone ─────────────────────────────────────────────────────────────
function renderDangerSection(container) {
  container.innerHTML = `
    <div class="settings-card danger-zone">
      <h3>⚠️ Eliminar cuenta</h3>
      <p>Esta acción es irreversible. Se eliminarán todos tus datos, concursos organizados y envíos.</p>
      <div class="form-group">
        <label>Confirma tu contraseña</label>
        <input id="del-pass" class="form-control" type="password" placeholder="Tu contraseña actual" />
      </div>
      <button class="btn btn-danger btn-full" id="del-account-btn">Eliminar mi cuenta permanentemente</button>
    </div>`;

  container.querySelector("#del-account-btn")?.addEventListener("click", async () => {
    const password = document.getElementById("del-pass")?.value?.trim();
    if (!password) { toast("Ingresa tu contraseña", "error"); return; }

    if (!confirm("¿Estás seguro? Esta acción NO se puede deshacer.")) return;

    const btn = container.querySelector("#del-account-btn");
    btn.disabled = true;
    btn.textContent = "Eliminando...";

    try {
      await api.auth.deleteAccount(password, store.token);
      store.clear();
      router.navigate("home");
      toast("Cuenta eliminada", "info");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Eliminar mi cuenta permanentemente";
    }
  });
}

// ─── GitHub-style SVG Avatar Generator ───────────────────────────────────────
function generateSVGAvatarRaw(name, seed, color1, color2) {
  const hash = simpleHash(seed || name);
  const c1 = color1 || AVATAR_COLORS[hash % AVATAR_COLORS.length][0];
  const c2 = color2 || AVATAR_COLORS[hash % AVATAR_COLORS.length][1];

  // Generate 5x5 symmetric pixel grid (like GitHub identicons)
  const grid = [];
  for (let row = 0; row < 5; row++) {
    grid[row] = [];
    for (let col = 0; col < 3; col++) {
      grid[row][col] = ((hash >> (row * 3 + col)) & 1) === 1;
    }
    // Mirror: col 3 = col 1, col 4 = col 0
    grid[row][3] = grid[row][1];
    grid[row][4] = grid[row][0];
  }

  let rects = "";
  const cellSize = 14;
  const padding = 8;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (grid[r][c]) {
        const x = padding + c * cellSize;
        const y = padding + r * cellSize;
        rects += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" fill="${c2}" opacity="0.9"/>`;
      }
    }
  }

  const size = cellSize * 5 + padding * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>
    <rect width="${size}" height="${size}" fill="url(#bg)" rx="4"/>
    ${rects}
  </svg>`;
}

function generateSVGAvatar(name, seed, color1, color2) {
  const svg = generateSVGAvatarRaw(name, seed, color1, color2);
  const base64 = btoa(unescape(encodeURIComponent(svg)));
  return `<img src="data:image/svg+xml;base64,${base64}" alt="Avatar" style="width:100%;height:100%;object-fit:cover" />`;
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & 0x7FFFFFFF; // Keep positive
  }
  return hash;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function setupOTPInputs(container) {
  if (!container) return;
  const inputs = container.querySelectorAll(".otp-input");
  inputs.forEach((input, i) => {
    input.addEventListener("input", e => {
      const v = e.target.value.replace(/\D/g, "");
      e.target.value = v.slice(-1);
      if (v && i < inputs.length - 1) inputs[i + 1].focus();
    });
    input.addEventListener("keydown", e => {
      if (e.key === "Backspace" && !e.target.value && i > 0) inputs[i - 1].focus();
    });
    input.addEventListener("paste", e => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
      pasted.split("").forEach((c, j) => { if (inputs[j]) inputs[j].value = c; });
      inputs[Math.min(pasted.length, inputs.length - 1)]?.focus();
    });
  });
  if (inputs[0]) inputs[0].focus();
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
