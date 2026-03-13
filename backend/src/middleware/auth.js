const { verifyToken } = require("../utils/jwt");
const prisma = require("../utils/prisma");

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return res.status(401).json({ error: "Usuario no encontrado" });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

async function requireVerified(req, res, next) {
  if (!req.user.emailVerified) {
    return res.status(403).json({ error: "Verifica tu correo electrónico primero" });
  }
  next();
}

module.exports = { requireAuth, requireVerified };
