const express = require("express");
const { body, validationResult } = require("express-validator");
const prisma = require("../utils/prisma");
const { requireAuth, requireVerified } = require("../middleware/auth");

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

// ─── Helper: check organizer access ─────────────────────────────────────────
async function isContestOrganizer(contestId, userId) {
  const contest = await prisma.contest.findUnique({ where: { id: contestId } });
  return contest?.organizerId === userId;
}

async function isContestMember(contestId, userId) {
  const member = await prisma.contestMember.findUnique({
    where: { contestId_userId: { contestId, userId } },
  });
  return !!member;
}

// ─── POST /api/problems — Create problem ─────────────────────────────────────
router.post(
  "/",
  requireAuth,
  requireVerified,
  [
    body("contestId").notEmpty().withMessage("contestId requerido"),
    body("title").trim().isLength({ min: 3, max: 100 }).withMessage("Título: 3-100 caracteres"),
    body("statement").trim().isLength({ min: 20 }).withMessage("Enunciado muy corto"),
    body("points").optional().isInt({ min: 10, max: 1000 }),
    body("difficulty").optional().isIn(["easy", "medium", "hard"]),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;

    const { contestId, title, statement, difficulty = "medium", points = 100, exampleIn = "", exampleOut = "", aiNotes = "" } = req.body;

    try {
      if (!(await isContestOrganizer(contestId, req.user.id))) {
        return res.status(403).json({ error: "Solo el organizador puede crear problemas" });
      }

      let slug = slugify(title);
      const existing = await prisma.contestProblem.count({ where: { contestId, slug } });
      if (existing > 0) slug = `${slug}-${Date.now().toString(36)}`;

      const count = await prisma.contestProblem.count({ where: { contestId } });

      const problem = await prisma.contestProblem.create({
        data: {
          contestId,
          title,
          slug,
          statement,
          difficulty,
          points: parseInt(points),
          exampleIn,
          exampleOut,
          aiNotes,
          order: count,
        },
      });

      res.status(201).json({ problem });
    } catch (err) {
      console.error("[create problem]", err);
      res.status(500).json({ error: "Error al crear el problema" });
    }
  }
);

// ─── GET /api/problems/contest/:contestId — All problems in contest ──────────
router.get("/contest/:contestId", requireAuth, async (req, res) => {
  try {
    if (!(await isContestMember(req.params.contestId, req.user.id))) {
      return res.status(403).json({ error: "No eres miembro de este concurso" });
    }

    const problems = await prisma.contestProblem.findMany({
      where: { contestId: req.params.contestId },
      orderBy: { order: "asc" },
    });

    // Add solved status per user
    const submissions = await prisma.submission.findMany({
      where: { contestId: req.params.contestId, userId: req.user.id },
      select: { problemId: true, verdict: true, score: true },
    });

    const bestByProblem = {};
    for (const s of submissions) {
      if (!bestByProblem[s.problemId] || s.score > bestByProblem[s.problemId].score) {
        bestByProblem[s.problemId] = s;
      }
    }

    const enriched = problems.map(p => ({
      ...p,
      solved: bestByProblem[p.id]?.verdict === "Accepted",
      bestScore: bestByProblem[p.id]?.score || 0,
      attempted: !!bestByProblem[p.id],
    }));

    res.json({ problems: enriched });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener los problemas" });
  }
});

// ─── GET /api/problems/:id — Single problem ───────────────────────────────────
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const problem = await prisma.contestProblem.findUnique({
      where: { id: req.params.id },
    });
    if (!problem) return res.status(404).json({ error: "Problema no encontrado" });

    if (!(await isContestMember(problem.contestId, req.user.id))) {
      return res.status(403).json({ error: "Sin acceso" });
    }

    res.json({ problem });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener el problema" });
  }
});

// ─── PATCH /api/problems/:id ──────────────────────────────────────────────────
router.patch("/:id", requireAuth, requireVerified, async (req, res) => {
  try {
    const problem = await prisma.contestProblem.findUnique({ where: { id: req.params.id } });
    if (!problem) return res.status(404).json({ error: "No encontrado" });

    if (!(await isContestOrganizer(problem.contestId, req.user.id))) {
      return res.status(403).json({ error: "Sin permiso" });
    }

    const { title, statement, difficulty, points, exampleIn, exampleOut, aiNotes, order } = req.body;

    const updated = await prisma.contestProblem.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(statement && { statement }),
        ...(difficulty && { difficulty }),
        ...(points && { points: parseInt(points) }),
        ...(exampleIn !== undefined && { exampleIn }),
        ...(exampleOut !== undefined && { exampleOut }),
        ...(aiNotes !== undefined && { aiNotes }),
        ...(order !== undefined && { order: parseInt(order) }),
      },
    });

    res.json({ problem: updated });
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar el problema" });
  }
});

// ─── DELETE /api/problems/:id ─────────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const problem = await prisma.contestProblem.findUnique({ where: { id: req.params.id } });
    if (!problem) return res.status(404).json({ error: "No encontrado" });

    if (!(await isContestOrganizer(problem.contestId, req.user.id))) {
      return res.status(403).json({ error: "Sin permiso" });
    }

    await prisma.contestProblem.delete({ where: { id: req.params.id } });
    res.json({ message: "Problema eliminado" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar" });
  }
});

module.exports = router;
