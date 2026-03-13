const express = require("express");
const prisma = require("../utils/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// GET /api/users/stats — My stats
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const [totalSubs, contestsJoined, accepted] = await Promise.all([
      prisma.submission.count({ where: { userId: req.user.id } }),
      prisma.contestMember.count({ where: { userId: req.user.id } }),
      prisma.submission.count({ where: { userId: req.user.id, verdict: "Accepted" } }),
    ]);

    const topScore = await prisma.submission.aggregate({
      where: { userId: req.user.id },
      _sum: { score: true },
      _max: { score: true },
    });

    res.json({
      totalSubmissions: totalSubs,
      contestsJoined,
      acceptedSolutions: accepted,
      totalScore: topScore._sum.score || 0,
    });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

module.exports = router;
