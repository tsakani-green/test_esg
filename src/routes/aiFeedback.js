import express from "express";
import { AiEvent } from "../../server/models/AiEvent.js";

const router = express.Router();

/**
 * POST /api/ai/feedback
 * body: { userId, conversationId, feature, type, meta? }
 */
router.post("/feedback", async (req, res) => {
  try {
    const { userId, conversationId, feature, type, meta } = req.body;

    const event = new AiEvent({
      userId,
      conversationId,
      feature,
      type,
      meta,
    });

    await event.save();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save feedback" });
  }
});

export default router;
