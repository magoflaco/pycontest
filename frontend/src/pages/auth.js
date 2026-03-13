// src/pages/auth.js — Auth forms rendered into #app

import { api } from "../lib/api.js";
import { store } from "../lib/store.js";
import { toast } from "../lib/toast.js";
import { router } from "../lib/router.js";

// ─── Register Page ──────────────────────────────────────────────────────────
export function renderRegister() {
  const page = getOrCreatePage("page-register");
  page.innerHTML = `
    <div class="container-sm z1" style="padding-top:4rem;padding-bottom:4rem">
      <div style="text-align:center;margin-bottom:2rem">
        <div class="hero-eyebrow" style="justify-content:center">🐍 PyContest</div>
        <h1 style="font-size:2rem;margin-bottom:0.5rem">Crear cuenta</h1>
        <p style="color:var(--text2);font-size:0.9rem">Únete a la plataforma de concursos de Python con IA</p>
      </div>
      <div class="card">
        <div class="card-body">
          <div class="form-group">
            <label>Nombre completo</label>
            <input id="reg-name" class="form-control" placeholder="Juan Pérez" autocomplete="name" />
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
            <div class="form-group">
              <label>Usuario</label>
              <input id="reg-username" class="form-control" placeholder="juanp_99" autocomplete="username" />
            </div>
            <div class="form-group">
              <label>Email</label>
              <input id="reg-email" class="form-control" type="email" placeholder="tu@email.com" autocomplete="email" />
            </div>
          </div>
          <div class="form-group">
            <label>Contraseña</label>
            <input id="reg-password" class="form-control" type="password" placeholder="Mínimo 8 caracteres" autocomplete="new-password" />
          </div>
          <div class="form-group">
            <label>¿Qué quieres hacer?</label>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.6rem;margin-top:0.25rem">
              <button class="role-btn" data-role="participant" style="background:var(--bg2);border:1.5px solid var(--border);border-radius:var(--radius);padding:0.9rem 0.6rem;cursor:pointer;transition:all 0.2s;text-align:center;font-family:var(--font-sans);color:var(--text2);">
                <div style="font-size:1.5rem;margin-bottom:0.3rem">🎮</div>
                <div style="font-weight:700;font-size:0.82rem;color:var(--text);margin-bottom:0.2rem">Participar</div>
                <div style="font-size:0.72rem;line-height:1.4">Resuelve problemas en concursos</div>
              </button>
              <button class="role-btn" data-role="organizer" style="background:var(--bg2);border:1.5px solid var(--border);border-radius:var(--radius);padding:0.9rem 0.6rem;cursor:pointer;transition:all 0.2s;text-align:center;font-family:var(--font-sans);color:var(--text2);">
                <div style="font-size:1.5rem;margin-bottom:0.3rem">🏗️</div>
                <div style="font-weight:700;font-size:0.82rem;color:var(--text);margin-bottom:0.2rem">Organizar</div>
                <div style="font-size:0.72rem;line-height:1.4">Crea concursos para otros</div>
              </button>
              <button class="role-btn" data-role="both" style="background:var(--bg2);border:1.5px solid var(--border);border-radius:var(--radius);padding:0.9rem 0.6rem;cursor:pointer;transition:all 0.2s;text-align:center;font-family:var(--font-sans);color:var(--text2);">
                <div style="font-size:1.5rem;margin-bottom:0.3rem">⚡</div>
                <div style="font-weight:700;font-size:0.82rem;color:var(--text);margin-bottom:0.2rem">Ambos</div>
                <div style="font-size:0.72rem;line-height:1.4">Participa y organiza</div>
              </button>
            </div>
          </div>
          <button class="btn btn-primary btn-full btn-lg" id="reg-btn" style="margin-top:0.5rem">
            Crear cuenta →
          </button>
          <div class="divider-text">¿Ya tienes cuenta?</div>
          <button class="btn btn-secondary btn-full" onclick="router.navigate('login')">Iniciar sesión</button>
        </div>
      </div>
    </div>`;

  let selectedRole = "participant";
  page.querySelectorAll(".role-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      page.querySelectorAll(".role-btn").forEach((b) => {
        b.style.borderColor = "var(--border)";
        b.style.background = "var(--bg2)";
        b.style.color = "var(--text2)";
      });
      btn.style.borderColor = "var(--accent)";
      btn.style.background = "var(--accent-dim)";
      btn.style.color = "var(--accent-light)";
      selectedRole = btn.dataset.role;
    });
  });
  // Default select participant
  const defBtn = page.querySelector('[data-role="participant"]');
  if (defBtn) {
    defBtn.style.borderColor = "var(--accent)";
    defBtn.style.background = "var(--accent-dim)";
    defBtn.style.color = "var(--accent-light)";
  }

  page.querySelector("#reg-btn").addEventListener("click", async () => {
    const name     = val("reg-name");
    const username = val("reg-username");
    const email    = val("reg-email");
    const password = val("reg-password");

    if (!name || !username || !email || !password) {
      toast("Completa todos los campos", "error");
      return;
    }

    setLoading("reg-btn", true, "Creando cuenta...");
    try {
      const res = await api.auth.register({ name, username, email, password, role: selectedRole });
      toast("¡Cuenta creada! Revisa tu correo.", "success");

      // FIX: persist userId + email in sessionStorage so they survive navigation
      sessionStorage.setItem("pc_verify_userId", res.userId);
      sessionStorage.setItem("pc_verify_email", email);

      router.navigate("verify-email");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setLoading("reg-btn", false, "Crear cuenta →");
    }
  });
}

// ─── OTP Verify Page ─────────────────────────────────────────────────────────
export function renderVerifyEmail(params = {}) {
  const page = getOrCreatePage("page-verify-email");

  // FIX: always read from sessionStorage — params only survive in-memory navigate()
  const userId = sessionStorage.getItem("pc_verify_userId") || params.userId || "";
  const email  = sessionStorage.getItem("pc_verify_email")  || params.email  || "";

  if (!userId) {
    toast("Sesión de verificación expirada. Regístrate de nuevo.", "error");
    router.navigate("register");
    return;
  }

  page.innerHTML = `
    <div class="container-sm z1" style="padding-top:4rem;padding-bottom:4rem">
      <div style="text-align:center;margin-bottom:2rem">
        <div style="font-size:3rem;margin-bottom:1rem">📧</div>
        <h1 style="font-size:2rem;margin-bottom:0.5rem">Verifica tu correo</h1>
        <p style="color:var(--text2);font-size:0.9rem">
          Ingresa el código de 6 dígitos enviado a<br>
          <strong style="color:var(--cyan)">${email || "tu correo"}</strong>
        </p>
      </div>
      <div class="card">
        <div class="card-body" style="text-align:center">
          <div class="otp-inputs" id="otp-inputs">
            <input class="otp-input" id="otp-0" maxlength="1" inputmode="numeric" pattern="[0-9]" />
            <input class="otp-input" id="otp-1" maxlength="1" inputmode="numeric" pattern="[0-9]" />
            <input class="otp-input" id="otp-2" maxlength="1" inputmode="numeric" pattern="[0-9]" />
            <input class="otp-input" id="otp-3" maxlength="1" inputmode="numeric" pattern="[0-9]" />
            <input class="otp-input" id="otp-4" maxlength="1" inputmode="numeric" pattern="[0-9]" />
            <input class="otp-input" id="otp-5" maxlength="1" inputmode="numeric" pattern="[0-9]" />
          </div>
          <button class="btn btn-primary btn-lg" id="verify-btn" style="margin-top:1.5rem;width:100%">
            Verificar código
          </button>
          <button class="btn btn-ghost btn-sm" id="resend-btn" style="margin-top:0.75rem;width:100%">
            ↺ Reenviar código
          </button>
          <p style="margin-top:1rem;font-size:0.75rem;color:var(--text3)">
            El código expira en 10 minutos.
          </p>
        </div>
      </div>
    </div>`;

  setupOTPInputs(page);

  page.querySelector("#verify-btn").addEventListener("click", () => doVerify(page, userId));

  page.querySelectorAll(".otp-input").forEach(input => {
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") doVerify(page, userId);
    });
  });

  page.querySelector("#resend-btn").addEventListener("click", async () => {
    try {
      await api.auth.resendOtp({ userId, type: "verify_email" });
      toast("Código reenviado — revisa tu correo", "info");
    } catch (err) {
      toast(err.message, "error");
    }
  });
}

async function doVerify(page, userId) {
  const code = ["otp-0","otp-1","otp-2","otp-3","otp-4","otp-5"]
    .map(id => document.getElementById(id)?.value || "")
    .join("");

  if (code.length !== 6) {
    toast("Ingresa los 6 dígitos del código", "error");
    return;
  }

  setLoading("verify-btn", true, "Verificando...");
  try {
    const res = await api.auth.verifyEmail({ userId, code });
    store.set(res.token, res.user);

    sessionStorage.removeItem("pc_verify_userId");
    sessionStorage.removeItem("pc_verify_email");

    toast("¡Correo verificado! Bienvenido 🎉", "success");
    navigateAfterAuth();
  } catch (err) {
    toast(err.message, "error");
    ["otp-0","otp-1","otp-2","otp-3","otp-4","otp-5"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    document.getElementById("otp-0")?.focus();
  } finally {
    setLoading("verify-btn", false, "Verificar código");
  }
}

// ─── Login Page ──────────────────────────────────────────────────────────────
export function renderLogin() {
  const page = getOrCreatePage("page-login");
  page.innerHTML = `
    <div class="container-sm z1" style="padding-top:5rem;padding-bottom:4rem">
      <div style="text-align:center;margin-bottom:2rem">
        <div class="hero-eyebrow" style="justify-content:center">🐍 PyContest</div>
        <h1 style="font-size:2rem;margin-bottom:0.5rem">Iniciar sesión</h1>
        <p style="color:var(--text2);font-size:0.9rem">Accede a tu cuenta</p>
      </div>
      <div class="card">
        <div class="card-body">
          <div class="form-group">
            <label>Usuario o email</label>
            <input id="login-id" class="form-control" placeholder="usuario o tu@email.com" autocomplete="username" />
          </div>
          <div class="form-group">
            <label>Contraseña</label>
            <input id="login-pass" class="form-control" type="password" placeholder="••••••••" autocomplete="current-password" />
          </div>
          <div style="text-align:right;margin-bottom:1rem">
            <button class="btn btn-ghost btn-sm" onclick="router.navigate('forgot-password')" style="font-size:0.8rem">
              ¿Olvidaste tu contraseña?
            </button>
          </div>
          <button class="btn btn-primary btn-full btn-lg" id="login-btn">Entrar →</button>
          <div class="divider-text">¿No tienes cuenta?</div>
          <button class="btn btn-secondary btn-full" onclick="router.navigate('register')">Registrarse gratis</button>
        </div>
      </div>
    </div>`;

  const doLogin = async () => {
    const login    = val("login-id");
    const password = val("login-pass");
    if (!login || !password) { toast("Completa los campos", "error"); return; }

    setLoading("login-btn", true, "Entrando...");
    try {
      const res = await api.auth.login({ login, password });
      store.set(res.token, res.user);
      toast("Bienvenido, " + res.user.name + "! 👋", "success");
      navigateAfterAuth();
    } catch (err) {
      if (err.status === 403) {
        toast(err.message, "info");
      } else {
        toast(err.message, "error");
      }
    } finally {
      setLoading("login-btn", false, "Entrar →");
    }
  };

  page.querySelector("#login-btn").addEventListener("click", doLogin);
  page.querySelector("#login-pass").addEventListener("keydown", e => {
    if (e.key === "Enter") doLogin();
  });
  page.querySelector("#login-id").addEventListener("keydown", e => {
    if (e.key === "Enter") page.querySelector("#login-pass").focus();
  });
}

// ─── Forgot Password ──────────────────────────────────────────────────────────
export function renderForgotPassword() {
  const page = getOrCreatePage("page-forgot-password");
  let userId = null;
  let step = 1;

  const render = () => {
    page.innerHTML = `
      <div class="container-sm z1" style="padding-top:5rem;padding-bottom:4rem">
        <div style="text-align:center;margin-bottom:2rem">
          <div style="font-size:2.5rem;margin-bottom:0.75rem">🔑</div>
          <h1 style="font-size:2rem;margin-bottom:0.5rem">Recuperar contraseña</h1>
          <p style="color:var(--text2);font-size:0.9rem">
            ${step === 1 ? "Ingresa tu email para recibir un código" : "Ingresa el código y tu nueva contraseña"}
          </p>
        </div>
        <div class="card">
          <div class="card-body">
            ${step === 1 ? `
              <div class="form-group">
                <label>Email</label>
                <input id="fp-email" class="form-control" type="email" placeholder="tu@email.com" />
              </div>
              <button class="btn btn-primary btn-full" id="fp-btn">Enviar código →</button>
            ` : `
              <p style="font-size:0.85rem;color:var(--text2);margin-bottom:1.25rem;text-align:center">
                Ingresa el código enviado a tu correo
              </p>
              <div class="otp-inputs" id="otp-inputs" style="margin-bottom:1.25rem">
                <input class="otp-input" id="otp-0" maxlength="1" inputmode="numeric" pattern="[0-9]" />
                <input class="otp-input" id="otp-1" maxlength="1" inputmode="numeric" pattern="[0-9]" />
                <input class="otp-input" id="otp-2" maxlength="1" inputmode="numeric" pattern="[0-9]" />
                <input class="otp-input" id="otp-3" maxlength="1" inputmode="numeric" pattern="[0-9]" />
                <input class="otp-input" id="otp-4" maxlength="1" inputmode="numeric" pattern="[0-9]" />
                <input class="otp-input" id="otp-5" maxlength="1" inputmode="numeric" pattern="[0-9]" />
              </div>
              <div class="form-group">
                <label>Nueva contraseña</label>
                <input id="fp-newpass" class="form-control" type="password" placeholder="Mínimo 8 caracteres" />
              </div>
              <button class="btn btn-primary btn-full" id="fp-btn">Cambiar contraseña →</button>
            `}
            <button class="btn btn-ghost btn-sm btn-full" style="margin-top:0.75rem"
              onclick="router.navigate('login')">← Volver al login</button>
          </div>
        </div>
      </div>`;

    if (step === 2) setupOTPInputs(page);

    page.querySelector("#fp-btn").addEventListener("click", async () => {
      if (step === 1) {
        const email = val("fp-email");
        if (!email) { toast("Ingresa tu email", "error"); return; }
        setLoading("fp-btn", true, "Enviando...");
        try {
          const res = await api.auth.forgotPassword({ email });
          userId = res.userId;
          if (!userId) {
            toast("Si existe esa cuenta, recibirás un código.", "info");
            return;
          }
          step = 2;
          render();
          toast("Código enviado a tu correo", "info");
        } catch (err) {
          toast(err.message, "error");
        } finally {
          setLoading("fp-btn", false, "Enviar código →");
        }
      } else {
        const code = ["otp-0","otp-1","otp-2","otp-3","otp-4","otp-5"]
          .map(id => document.getElementById(id)?.value || "")
          .join("");
        const newPassword = val("fp-newpass");

        if (code.length !== 6) { toast("Ingresa el código completo", "error"); return; }
        if (!newPassword) { toast("Ingresa la nueva contraseña", "error"); return; }

        setLoading("fp-btn", true, "Cambiando...");
        try {
          await api.auth.resetPassword({ userId, code, newPassword });
          toast("✅ Contraseña actualizada. Inicia sesión.", "success");
          router.navigate("login");
        } catch (err) {
          toast(err.message, "error");
          ["otp-0","otp-1","otp-2","otp-3","otp-4","otp-5"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = "";
          });
          document.getElementById("otp-0")?.focus();
        } finally {
          setLoading("fp-btn", false, "Cambiar contraseña →");
        }
      }
    });
  };

  render();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getOrCreatePage(id) {
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

function val(id) {
  return document.getElementById(id)?.value?.trim() || "";
}

function setLoading(id, loading, text) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = text;
}

function setupOTPInputs(page) {
  const inputs = page.querySelectorAll(".otp-input");
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

// ─── Post-auth redirect: go to pending invite or home ────────────────────────
function navigateAfterAuth() {
  const inviteToken = sessionStorage.getItem("pc_invite_token");
  if (inviteToken) {
    router.navigate(`join/${inviteToken}`);
  } else {
    router.navigate("home");
  }
}
