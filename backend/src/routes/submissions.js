const express = require("express");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const prisma = require("../utils/prisma");
const { requireAuth, requireVerified } = require("../middleware/auth");
const { evaluatePythonSolution } = require("../services/ai");

const router = express.Router();

// Limit submissions: 10 per minute per user
const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: "Demasiados envíos. Espera un momento." },
});

/**
 * Generate a deterministic hash for code + problemId.
 * Same code for same problem always produces the same hash.
 */
function hashCode(code, problemId) {
  const normalized = code.replace(/\s+/g, " ").trim().toLowerCase();
  return crypto.createHash("sha256").update(normalized + "|" + problemId).digest("hex");
}

// ─── POST /api/submissions — Submit solution ──────────────────────────────────
router.post("/", requireAuth, requireVerified, submitLimiter, async (req, res) => {
  const { problemId, code, elapsedSec = 0 } = req.body;

  if (!problemId || !code?.trim()) {
    return res.status(400).json({ error: "problemId y código son requeridos" });
  }

  if (code.trim().length < 5) {
    return res.status(400).json({ error: "El código es demasiado corto" });
  }

  if (code.length > 50000) {
    return res.status(400).json({ error: "El código excede el límite (50,000 caracteres)" });
  }

  try {
    const problem = await prisma.contestProblem.findUnique({
      where: { id: problemId },
    });

    if (!problem) return res.status(404).json({ error: "Problema no encontrado" });

    // Check membership
    const member = await prisma.contestMember.findUnique({
      where: { contestId_userId: { contestId: problem.contestId, userId: req.user.id } },
    });
    if (!member) return res.status(403).json({ error: "No eres miembro de este concurso" });

    // Check contest is active
    const contest = await prisma.contest.findUnique({ where: { id: problem.contestId } });
    if (!contest.isActive) {
      return res.status(403).json({ error: "El concurso no está activo" });
    }

    // Deterministic evaluation: check if same code was already evaluated for this problem
    const codeHash = hashCode(code, problemId);
    const cachedSub = await prisma.submission.findFirst({
      where: {
        problemId,
        codeHash,
        verdict: { not: "Pending" },
      },
      orderBy: { createdAt: "desc" },
    });

    if (cachedSub) {
      // Reuse cached evaluation — create new submission with same results
      const submission = await prisma.submission.create({
        data: {
          userId: req.user.id,
          problemId,
          contestId: problem.contestId,
          code,
          codeHash,
          verdict: cachedSub.verdict,
          score: cachedSub.score,
          maxScore: problem.points,
          elapsedSec: parseInt(elapsedSec) || 0,
          aiFeedback: cachedSub.aiFeedback,
          aiBreakdown: cachedSub.aiBreakdown,
        },
      });

      console.log(`[submit] Cache hit for codeHash=${codeHash.slice(0, 8)}... — reusing evaluation`);
      return res.json({ submission, status: "cached" });
    }

    // Create pending submission
    const submission = await prisma.submission.create({
      data: {
        userId: req.user.id,
        problemId,
        contestId: problem.contestId,
        code,
        codeHash,
        verdict: "Pending",
        score: 0,
        maxScore: problem.points,
        elapsedSec: parseInt(elapsedSec) || 0,
      },
    });

    // Respond immediately, evaluate in background
    res.json({ submission, status: "evaluating" });

    // Evaluate in background after response sent
    setImmediate(async () => {
      try {
        const result = await evaluatePythonSolution({ code, problem });

        await prisma.submission.update({
          where: { id: submission.id },
          data: {
            verdict: result.verdict,
            score: result.score,
            aiFeedback: JSON.stringify({
              feedback: result.feedback,
              outputAnalysis: result.outputAnalysis,
              suggestions: result.suggestions,
              detectedIssues: result.detectedIssues,
            }),
            aiBreakdown: result.scoreBreakdown,
          },
        });
      } catch (err) {
        console.error("[eval background]", err);
        await prisma.submission.update({
          where: { id: submission.id },
          data: { verdict: "Pending", aiFeedback: JSON.stringify({ feedback: "Error en evaluación" }) },
        });
      }
    });
  } catch (err) {
    console.error("[submit]", err);
    res.status(500).json({ error: "Error al enviar la solución" });
  }
});

// ─── GET /api/submissions/:id — Poll result ───────────────────────────────────
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const submission = await prisma.submission.findUnique({
      where: { id: req.params.id },
      include: { problem: { select: { title: true, points: true } } },
    });

    if (!submission) return res.status(404).json({ error: "No encontrado" });
    if (submission.userId !== req.user.id) {
      // Allow organizers to view any submission in their contest
      const contest = await prisma.contest.findUnique({ where: { id: submission.contestId } });
      if (!contest || contest.organizerId !== req.user.id) {
        return res.status(403).json({ error: "Sin acceso" });
      }
    }

    let aiFeedback = {};
    try {
      aiFeedback = JSON.parse(submission.aiFeedback || "{}");
    } catch {}

    res.json({ submission: { ...submission, aiFeedback } });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener el envío" });
  }
});

// ─── PATCH /api/submissions/:id — Organizer corrects grade ───────────────────
router.patch("/:id", requireAuth, requireVerified, async (req, res) => {
  try {
    const submission = await prisma.submission.findUnique({
      where: { id: req.params.id },
    });

    if (!submission) return res.status(404).json({ error: "No encontrado" });

    // Only contest organizer can correct grades
    const contest = await prisma.contest.findUnique({ where: { id: submission.contestId } });
    if (!contest || contest.organizerId !== req.user.id) {
      return res.status(403).json({ error: "Solo el organizador puede corregir calificaciones" });
    }

    const { verdict, score, feedback } = req.body;

    const updateData = {};
    if (verdict && ["Accepted", "Partial Credit", "Wrong Answer", "Syntax Error"].includes(verdict)) {
      updateData.verdict = verdict;
    }
    if (score !== undefined && !isNaN(parseInt(score))) {
      updateData.score = Math.max(0, Math.min(parseInt(score), submission.maxScore));
    }
    if (feedback !== undefined) {
      // Merge with existing feedback
      let existingFb = {};
      try { existingFb = JSON.parse(submission.aiFeedback || "{}"); } catch {}
      existingFb.organizerNote = feedback;
      updateData.aiFeedback = JSON.stringify(existingFb);
    }

    const updated = await prisma.submission.update({
      where: { id: req.params.id },
      data: updateData,
    });

    let aiFeedback = {};
    try { aiFeedback = JSON.parse(updated.aiFeedback || "{}"); } catch {}

    res.json({ submission: { ...updated, aiFeedback } });
  } catch (err) {
    console.error("[patch submission]", err);
    res.status(500).json({ error: "Error al corregir la calificación" });
  }
});

// ─── GET /api/submissions/problem/:problemId — My submissions for problem ─────
router.get("/problem/:problemId", requireAuth, async (req, res) => {
  try {
    const submissions = await prisma.submission.findMany({
      where: { problemId: req.params.problemId, userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const enriched = submissions.map(s => {
      let aiFeedback = {};
      try { aiFeedback = JSON.parse(s.aiFeedback || "{}"); } catch {}
      return { ...s, aiFeedback };
    });

    res.json({ submissions: enriched });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener los envíos" });
  }
});

// ─── GET /api/submissions/contest/:contestId — All submissions (organizer) ────
router.get("/contest/:contestId", requireAuth, async (req, res) => {
  try {
    const contest = await prisma.contest.findUnique({ where: { id: req.params.contestId } });
    if (!contest) return res.status(404).json({ error: "No encontrado" });
    if (contest.organizerId !== req.user.id) return res.status(403).json({ error: "Sin permiso" });

    const submissions = await prisma.submission.findMany({
      where: { contestId: req.params.contestId },
      include: {
        user: { select: { id: true, name: true, username: true } },
        problem: { select: { id: true, title: true, points: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Parse aiFeedback for each submission
    const enriched = submissions.map(s => {
      let aiFeedback = {};
      try { aiFeedback = JSON.parse(s.aiFeedback || "{}"); } catch {}
      return { ...s, aiFeedback };
    });

    res.json({ submissions: enriched });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener los envíos" });
  }
});

module.exports = router;
