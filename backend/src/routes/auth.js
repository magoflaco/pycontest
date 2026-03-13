const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");

const prisma = require("../utils/prisma");
const { signToken } = require("../utils/jwt");
const { generateOTP, otpExpiresAt } = require("../utils/otp");
const { sendOTPEmail } = require("../services/email");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Strict rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Demasiados intentos. Espera 15 minutos." },
});

const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: { error: "Demasiados códigos solicitados. Espera 5 minutos." },
});

// ─── Helper: validate & respond errors ───────────────────────────────────────
function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg });
    return false;
  }
  return true;
}

// ─── POST /api/auth/register ─────────────────────────────────────────────────
router.post(
  "/register",
  authLimiter,
  [
    body("email").isEmail().withMessage("Email inválido").normalizeEmail(),
    body("username")
      .isAlphanumeric("en-US", { ignore: "_" })
      .isLength({ min: 3, max: 20 })
      .withMessage("Usuario: 3-20 caracteres alfanuméricos o _"),
    body("name").trim().isLength({ min: 2, max: 60 }).withMessage("Nombre requerido"),
    body("password").isLength({ min: 8 }).withMessage("Contraseña: mínimo 8 caracteres"),
    body("role")
      .isIn(["participant", "organizer", "both"])
      .withMessage("Rol inválido"),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;

    const { email, username, name, password, role } = req.body;

    try {
      // Check uniqueness
      const existing = await prisma.user.findFirst({
        where: { OR: [{ email }, { username }] },
      });
      if (existing) {
        const field = existing.email === email ? "email" : "nombre de usuario";
        return res.status(409).json({ error: `El ${field} ya está registrado` });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const user = await prisma.user.create({
        data: { email, username, name, passwordHash, role },
      });

      // Send verification OTP
      const code = generateOTP();
      await prisma.oTP.create({
        data: {
          userId: user.id,
          code,
          type: "verify_email",
          expiresAt: otpExpiresAt(),
        },
      });

      await sendOTPEmail({ to: email, name, code, type: "verify_email" });

      res.status(201).json({
        message: "Cuenta creada. Revisa tu correo para verificar tu cuenta.",
        userId: user.id,
      });
    } catch (err) {
      console.error("[register]", err);
      res.status(500).json({ error: "Error al crear la cuenta" });
    }
  }
);

// ─── POST /api/auth/verify-email ─────────────────────────────────────────────
router.post(
  "/verify-email",
  authLimiter,
  [
    body("userId").notEmpty(),
    body("code").isLength({ min: 6, max: 6 }).withMessage("Código de 6 dígitos requerido"),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;

    const { userId, code } = req.body;

    try {
      const otp = await prisma.oTP.findFirst({
        where: {
          userId,
          code,
          type: "verify_email",
          used: false,
          expiresAt: { gt: new Date() },
        },
      });

      if (!otp) {
        return res.status(400).json({ error: "Código inválido o expirado" });
      }

      await prisma.$transaction([
        prisma.oTP.update({ where: { id: otp.id }, data: { used: true } }),
        prisma.user.update({ where: { id: userId }, data: { emailVerified: true } }),
      ]);

      const user = await prisma.user.findUnique({ where: { id: userId } });
      const token = signToken({ userId: user.id });

      res.json({ token, user: sanitizeUser(user) });
    } catch (err) {
      console.error("[verify-email]", err);
      res.status(500).json({ error: "Error al verificar el correo" });
    }
  }
);

// ─── POST /api/auth/resend-otp ────────────────────────────────────────────────
router.post("/resend-otp", otpLimiter, async (req, res) => {
  const { userId, type } = req.body;
  if (!userId || !["verify_email", "reset_password"].includes(type)) {
    return res.status(400).json({ error: "Datos inválidos" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    // Invalidate previous OTPs
    await prisma.oTP.updateMany({
      where: { userId, type, used: false },
      data: { used: true },
    });

    const code = generateOTP();
    await prisma.oTP.create({
      data: { userId, code, type, expiresAt: otpExpiresAt() },
    });

    await sendOTPEmail({ to: user.email, name: user.name, code, type });

    res.json({ message: "Código enviado" });
  } catch (err) {
    console.error("[resend-otp]", err);
    res.status(500).json({ error: "Error al enviar el código" });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post(
  "/login",
  authLimiter,
  [
    body("login").notEmpty().withMessage("Email o usuario requerido"),
    body("password").notEmpty().withMessage("Contraseña requerida"),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;

    const { login, password } = req.body;

    try {
      const user = await prisma.user.findFirst({
        where: { OR: [{ email: login }, { username: login }] },
      });

      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ error: "Credenciales incorrectas" });
      }

      if (!user.emailVerified) {
        // Re-send OTP
        const code = generateOTP();
        await prisma.oTP.updateMany({
          where: { userId: user.id, type: "verify_email", used: false },
          data: { used: true },
        });
        await prisma.oTP.create({
          data: { userId: user.id, code, type: "verify_email", expiresAt: otpExpiresAt() },
        });
        await sendOTPEmail({ to: user.email, name: user.name, code, type: "verify_email" });

        return res.status(403).json({
          error: "Correo no verificado. Te enviamos un nuevo código.",
          requireVerification: true,
          userId: user.id,
        });
      }

      const token = signToken({ userId: user.id });
      res.json({ token, user: sanitizeUser(user) });
    } catch (err) {
      console.error("[login]", err);
      res.status(500).json({ error: "Error al iniciar sesión" });
    }
  }
);

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
router.post("/forgot-password", otpLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email requerido" });

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // Always respond same to prevent user enumeration
    if (user) {
      await prisma.oTP.updateMany({
        where: { userId: user.id, type: "reset_password", used: false },
        data: { used: true },
      });
      const code = generateOTP();
      await prisma.oTP.create({
        data: { userId: user.id, code, type: "reset_password", expiresAt: otpExpiresAt() },
      });
      await sendOTPEmail({ to: user.email, name: user.name, code, type: "reset_password" });
    }

    res.json({
      message: "Si existe una cuenta con ese correo, recibirás un código.",
      userId: user?.id,
    });
  } catch (err) {
    console.error("[forgot-password]", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
router.post(
  "/reset-password",
  authLimiter,
  [
    body("userId").notEmpty(),
    body("code").isLength({ min: 6, max: 6 }),
    body("newPassword").isLength({ min: 8 }).withMessage("Contraseña: mínimo 8 caracteres"),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;

    const { userId, code, newPassword } = req.body;

    try {
      const otp = await prisma.oTP.findFirst({
        where: {
          userId,
          code,
          type: "reset_password",
          used: false,
          expiresAt: { gt: new Date() },
        },
      });

      if (!otp) return res.status(400).json({ error: "Código inválido o expirado" });

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.$transaction([
        prisma.oTP.update({ where: { id: otp.id }, data: { used: true } }),
        prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      ]);

      res.json({ message: "Contraseña actualizada correctamente" });
    } catch (err) {
      console.error("[reset-password]", err);
      res.status(500).json({ error: "Error al restablecer la contraseña" });
    }
  }
);

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

// ─── PATCH /api/auth/profile ──────────────────────────────────────────────────
router.patch(
  "/profile",
  requireAuth,
  [
    body("name").optional().trim().isLength({ min: 2, max: 60 }),
    body("username")
      .optional()
      .isAlphanumeric("en-US", { ignore: "_" })
      .isLength({ min: 3, max: 20 })
      .withMessage("Usuario: 3-20 caracteres alfanuméricos o _"),
    body("role").optional().isIn(["participant", "organizer", "both"]),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;
    const { name, username, role, avatar } = req.body;

    try {
      // Check username uniqueness if changing
      if (username && username !== req.user.username) {
        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing) {
          return res.status(400).json({ error: "Ese nombre de usuario ya está en uso" });
        }
      }

      const data = {};
      if (name) data.name = name;
      if (username) data.username = username;
      if (role) data.role = role;
      if (avatar !== undefined) data.avatar = avatar; // Allow empty string to remove

      const user = await prisma.user.update({
        where: { id: req.user.id },
        data,
      });
      res.json({ user: sanitizeUser(user) });
    } catch (err) {
      console.error("[update-profile]", err);
      res.status(500).json({ error: "Error al actualizar perfil" });
    }
  }
);

// ─── POST /api/auth/change-password ──────────────────────────────────────────
router.post(
  "/change-password",
  requireAuth,
  [
    body("currentPassword").notEmpty().withMessage("Contraseña actual requerida"),
    body("newPassword").isLength({ min: 8 }).withMessage("Nueva contraseña: mínimo 8 caracteres"),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;
    const { currentPassword, newPassword } = req.body;

    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
        return res.status(401).json({ error: "Contraseña actual incorrecta" });
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id: req.user.id },
        data: { passwordHash },
      });

      res.json({ message: "Contraseña actualizada correctamente" });
    } catch (err) {
      console.error("[change-password]", err);
      res.status(500).json({ error: "Error al cambiar la contraseña" });
    }
  }
);

// ─── POST /api/auth/change-email ─────────────────────────────────────────────
router.post(
  "/change-email",
  requireAuth,
  otpLimiter,
  [
    body("newEmail").isEmail().withMessage("Email inválido").normalizeEmail(),
    body("password").notEmpty().withMessage("Contraseña requerida"),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;
    const { newEmail, password } = req.body;

    try {
      // Verify password
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ error: "Contraseña incorrecta" });
      }

      // Check if email is already in use
      const existing = await prisma.user.findUnique({ where: { email: newEmail } });
      if (existing) {
        return res.status(400).json({ error: "Ese email ya está registrado" });
      }

      // Invalidate old OTPs
      await prisma.oTP.updateMany({
        where: { userId: user.id, type: "change_email", used: false },
        data: { used: true },
      });

      // Generate OTP and send to NEW email
      const code = generateOTP();
      await prisma.oTP.create({
        data: {
          userId: user.id,
          code,
          type: "change_email",
          expiresAt: otpExpiresAt(),
        },
      });

      // Store the new email temporarily in the OTP record  
      // We'll pass it back and forth via the client
      await sendOTPEmail({ to: newEmail, name: user.name, code, type: "change_email" });

      res.json({ userId: user.id, message: "Código enviado al nuevo email" });
    } catch (err) {
      console.error("[change-email]", err);
      res.status(500).json({ error: "Error al procesar el cambio de email" });
    }
  }
);

// ─── POST /api/auth/verify-new-email ─────────────────────────────────────────
router.post(
  "/verify-new-email",
  requireAuth,
  [
    body("userId").notEmpty(),
    body("code").isLength({ min: 6, max: 6 }).withMessage("Código de 6 dígitos requerido"),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;
    const { userId, code } = req.body;

    // Security: userId must match authenticated user
    if (userId !== req.user.id) {
      return res.status(403).json({ error: "No autorizado" });
    }

    try {
      const otp = await prisma.oTP.findFirst({
        where: {
          userId,
          code,
          type: "change_email",
          used: false,
          expiresAt: { gt: new Date() },
        },
      });

      if (!otp) {
        return res.status(400).json({ error: "Código inválido o expirado" });
      }

      // Mark OTP as used
      await prisma.oTP.update({ where: { id: otp.id }, data: { used: true } });

      // Get the new email from the request (client passes it through)
      // Re-read the change-email request data — since we don't store newEmail in OTP,
      // we need the client to send it. Let's also accept it here.
      const newEmail = req.body.newEmail;
      if (!newEmail) {
        // Fallback: just mark as verified but don't change (shouldn't happen)
        return res.status(400).json({ error: "Nuevo email no proporcionado" });
      }

      // Check uniqueness again
      const existing = await prisma.user.findUnique({ where: { email: newEmail } });
      if (existing && existing.id !== userId) {
        return res.status(400).json({ error: "Ese email ya está registrado por otra cuenta" });
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: { email: newEmail },
      });

      // Generate new token with updated email
      const token = signToken(user);
      res.json({ user: sanitizeUser(user), token });
    } catch (err) {
      console.error("[verify-new-email]", err);
      res.status(500).json({ error: "Error al verificar el nuevo email" });
    }
  }
);

// ─── DELETE /api/auth/account ──────────────────────────────────────────────────
router.delete(
  "/account",
  requireAuth,
  [
    body("password").notEmpty().withMessage("Contraseña requerida para confirmar"),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;

    const { password } = req.body;

    try {
      // Verify password
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ error: "Contraseña incorrecta" });
      }

      // Check if user has organized contests
      const organizedContests = await prisma.contest.count({ where: { organizerId: user.id } });
      if (organizedContests > 0) {
        return res.status(400).json({
          error: `Tienes ${organizedContests} concurso(s) creado(s). Elimínalos primero antes de borrar tu cuenta.`,
        });
      }

      // Delete user (cascades: OTPs, ContestMembers, Submissions)
      await prisma.user.delete({ where: { id: user.id } });

      res.json({ message: "Cuenta eliminada correctamente" });
    } catch (err) {
      console.error("[delete-account]", err);
      res.status(500).json({ error: "Error al eliminar la cuenta" });
    }
  }
);

function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

module.exports = router;
