const express = require("express");
const { body, validationResult } = require("express-validator");
const { v4: uuid } = require("uuid");
const crypto = require("crypto");

const prisma = require("../utils/prisma");
const { requireAuth, requireVerified } = require("../middleware/auth");
const { sendContestInviteEmail } = require("../services/email");

const router = express.Router();

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg });
    return false;
  }
  return true;
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

// ─── POST /api/contests — Create ─────────────────────────────────────────────
router.post(
  "/",
  requireAuth,
  requireVerified,
  [
    body("name").trim().isLength({ min: 3, max: 100 }).withMessage("Nombre: 3-100 caracteres"),
    body("description").trim().isLength({ min: 10, max: 500 }).withMessage("Descripción: 10-500 caracteres"),
    body("durationMin").optional().isInt({ min: 10, max: 480 }),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;

    const user = req.user;
    if (!["organizer", "both"].includes(user.role)) {
      return res.status(403).json({ error: "Solo los organizadores pueden crear concursos" });
    }

    const { name, description, durationMin = 90, startAt, endAt } = req.body;

    try {
      let slug = slugify(name);
      // Ensure unique slug
      const existing = await prisma.contest.count({ where: { slug } });
      if (existing > 0) slug = `${slug}-${Date.now().toString(36)}`;

      const inviteToken = crypto.randomBytes(16).toString("hex");

      const contest = await prisma.contest.create({
        data: {
          name,
          description,
          slug,
          inviteToken,
          organizerId: user.id,
          durationMin: parseInt(durationMin),
          startAt: startAt ? new Date(startAt) : null,
          endAt: endAt ? new Date(endAt) : null,
        },
        include: { problems: true, members: { include: { user: true } } },
      });

      // Auto-add organizer as admin member
      await prisma.contestMember.create({
        data: { contestId: contest.id, userId: user.id, role: "admin" },
      });

      res.status(201).json({ contest: formatContest(contest, user.id) });
    } catch (err) {
      console.error("[create contest]", err);
      res.status(500).json({ error: "Error al crear el concurso" });
    }
  }
);

// ─── GET /api/contests — List my contests ────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  try {
    const members = await prisma.contestMember.findMany({
      where: { userId: req.user.id },
      include: {
        contest: {
          include: {
            problems: { select: { id: true, title: true, points: true, difficulty: true } },
            members: { select: { userId: true, role: true } },
            organizer: { select: { id: true, name: true, username: true } },
          },
        },
      },
    });

    const contests = members.map(m => ({
      ...formatContest(m.contest, req.user.id),
      myRole: m.role,
    }));

    res.json({ contests });
  } catch (err) {
    console.error("[list contests]", err);
    res.status(500).json({ error: "Error al obtener los concursos" });
  }
});

// ─── GET /api/contests/organized — My organized contests ─────────────────────
router.get("/organized", requireAuth, async (req, res) => {
  try {
    const contests = await prisma.contest.findMany({
      where: { organizerId: req.user.id },
      include: {
        problems: { orderBy: { order: "asc" } },
        members: { include: { user: { select: { id: true, name: true, username: true, email: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ contests: contests.map(c => formatContest(c, req.user.id)) });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener los concursos" });
  }
});

// ─── GET /api/contests/join/:token — Join via invite ─────────────────────────
router.get("/join/:token", requireAuth, requireVerified, async (req, res) => {
  try {
    const contest = await prisma.contest.findUnique({
      where: { inviteToken: req.params.token },
      include: {
        organizer: { select: { name: true, username: true } },
        problems: { select: { id: true, title: true, points: true, difficulty: true, order: true } },
        members: { where: { userId: req.user.id } },
      },
    });

    if (!contest) return res.status(404).json({ error: "Enlace de invitación inválido" });

    const alreadyMember = contest.members.length > 0;

    if (!alreadyMember) {
      await prisma.contestMember.create({
        data: { contestId: contest.id, userId: req.user.id, role: "participant" },
      });
    }

    res.json({ contest: formatContest(contest, req.user.id), alreadyMember });
  } catch (err) {
    console.error("[join contest]", err);
    res.status(500).json({ error: "Error al unirse al concurso" });
  }
});

// ─── GET /api/contests/:id ────────────────────────────────────────────────────
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const contest = await prisma.contest.findUnique({
      where: { id: req.params.id },
      include: {
        problems: { orderBy: { order: "asc" } },
        members: {
          include: {
            user: { select: { id: true, name: true, username: true } },
          },
        },
        organizer: { select: { id: true, name: true, username: true } },
      },
    });

    if (!contest) return res.status(404).json({ error: "Concurso no encontrado" });

    // Must be a member
    const isMember = contest.members.some(m => m.userId === req.user.id);
    if (!isMember) return res.status(403).json({ error: "No tienes acceso a este concurso" });

    res.json({ contest: formatContest(contest, req.user.id) });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener el concurso" });
  }
});

// ─── PATCH /api/contests/:id ──────────────────────────────────────────────────
router.patch("/:id", requireAuth, requireVerified, async (req, res) => {
  try {
    const contest = await prisma.contest.findUnique({ where: { id: req.params.id } });
    if (!contest) return res.status(404).json({ error: "No encontrado" });
    if (contest.organizerId !== req.user.id) return res.status(403).json({ error: "Sin permiso" });

    const { name, description, durationMin, isActive, startAt, endAt } = req.body;
    const updated = await prisma.contest.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(durationMin && { durationMin: parseInt(durationMin) }),
        ...(isActive !== undefined && { isActive }),
        ...(startAt !== undefined && { startAt: startAt ? new Date(startAt) : null }),
        ...(endAt !== undefined && { endAt: endAt ? new Date(endAt) : null }),
      },
    });
    res.json({ contest: updated });
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar el concurso" });
  }
});

// ─── POST /api/contests/:id/invite — Invite by email ─────────────────────────
router.post("/:id/invite", requireAuth, requireVerified, async (req, res) => {
  const { emails } = req.body; // array of emails
  if (!Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: "Lista de emails requerida" });
  }

  try {
    const contest = await prisma.contest.findUnique({ where: { id: req.params.id } });
    if (!contest) return res.status(404).json({ error: "Concurso no encontrado" });
    if (contest.organizerId !== req.user.id) return res.status(403).json({ error: "Sin permiso" });

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const inviteUrl = `${frontendUrl}/#join/${contest.inviteToken}`;

    const results = await Promise.allSettled(
      emails.map(async email => {
        const user = await prisma.user.findUnique({ where: { email } });
        await sendContestInviteEmail({
          to: email,
          name: user?.name || email,
          contestName: contest.name,
          inviteUrl,
        });
        return email;
      })
    );

    const sent = results.filter(r => r.status === "fulfilled").map(r => r.value);
    const failed = results.filter(r => r.status === "rejected").map((r, i) => emails[i]);

    res.json({ sent, failed, inviteUrl });
  } catch (err) {
    console.error("[invite]", err);
    res.status(500).json({ error: "Error al enviar invitaciones" });
  }
});

// ─── GET /api/contests/:id/leaderboard ───────────────────────────────────────
router.get("/:id/leaderboard", requireAuth, async (req, res) => {
  try {
    const contest = await prisma.contest.findUnique({
      where: { id: req.params.id },
      include: { members: { include: { user: { select: { id: true, name: true, username: true } } } } },
    });

    if (!contest) return res.status(404).json({ error: "No encontrado" });
    const isMember = contest.members.some(m => m.userId === req.user.id);
    if (!isMember) return res.status(403).json({ error: "Sin acceso" });

    const submissions = await prisma.submission.findMany({
      where: { contestId: contest.id },
      orderBy: { createdAt: "asc" },
    });

    const problems = await prisma.contestProblem.findMany({
      where: { contestId: contest.id },
      select: { id: true, title: true, points: true },
    });

    // Compute leaderboard
    const memberMap = {};
    for (const m of contest.members) {
      memberMap[m.userId] = {
        user: m.user,
        problems: {},
        totalScore: 0,
        problemsSolved: 0,
        lastSubmitTime: null,
      };
    }

    for (const sub of submissions) {
      const entry = memberMap[sub.userId];
      if (!entry) continue;

      const prev = entry.problems[sub.problemId];
      if (!prev || sub.score > prev.score) {
        entry.problems[sub.problemId] = {
          score: sub.score,
          maxScore: sub.maxScore,
          passed: sub.passed || sub.verdict === "Accepted",
          elapsedSec: sub.elapsedSec,
          submittedAt: sub.createdAt,
        };
      }
    }

    // Aggregate
    const leaderboard = Object.values(memberMap).map(entry => {
      const probEntries = Object.values(entry.problems);
      entry.totalScore = probEntries.reduce((s, p) => s + p.score, 0);
      entry.problemsSolved = probEntries.filter(p => p.passed).length;
      entry.lastSubmitTime = probEntries.length
        ? Math.max(...probEntries.map(p => new Date(p.submittedAt).getTime()))
        : null;
      return entry;
    });

    leaderboard.sort(
      (a, b) => b.totalScore - a.totalScore || (a.lastSubmitTime || 0) - (b.lastSubmitTime || 0)
    );

    res.json({ leaderboard, problems });
  } catch (err) {
    console.error("[leaderboard]", err);
    res.status(500).json({ error: "Error al obtener el ranking" });
  }
});

// ─── DELETE /api/contests/:id ─────────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const contest = await prisma.contest.findUnique({ where: { id: req.params.id } });
    if (!contest) return res.status(404).json({ error: "No encontrado" });
    if (contest.organizerId !== req.user.id) return res.status(403).json({ error: "Sin permiso" });
    await prisma.contest.delete({ where: { id: req.params.id } });
    res.json({ message: "Concurso eliminado" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar" });
  }
});

function formatContest(contest, userId) {
  return {
    ...contest,
    inviteUrl: `${process.env.FRONTEND_URL || "http://localhost:5173"}/#join/${contest.inviteToken}`,
    isOrganizer: contest.organizerId === userId,
    memberCount: contest.members?.length || 0,
  };
}

module.exports = router;
