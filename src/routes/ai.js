// src/routes/ai.js
import express from "express";
import { openai } from "../../server/openaiClient.js";
import { Conversation } from "../../server/models/Conversation.js";

const router = express.Router();

/**
 * POST /api/ai/chat
 * body: { userId, feature, message, conversationId? }
 */
router.post("/chat", async (req, res) => {
  try {
    const { userId, feature = "default", message, conversationId } = req.body;
    const start = Date.now();

    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }

    // load existing conversation or start new
    let convo;
    if (conversationId) {
      convo = await Conversation.findById(conversationId);
    }
    if (!convo) {
      convo = new Conversation({
        userId,
        feature,
        messages: [],
      });
    }

    convo.messages.push({ role: "user", content: message });

    // Call OpenAI
    const response = await openai.responses.create({
      model: "gpt-5.1-mini", // pick your model :contentReference[oaicite:1]{index=1}
      input: convo.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const output = response.output[0];
    const assistantText =
      output.content?.find((c) => c.type === "output_text")?.text ??
      output.content?.[0]?.text ??
      "";

    const latencyMs = Date.now() - start;
    const usage = {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    };

    convo.messages.push({ role: "assistant", content: assistantText });
    convo.model = response.model;
    convo.usage = usage;
    convo.latencyMs = latencyMs;

    await convo.save();

    res.json({
      conversationId: convo._id,
      reply: assistantText,
      usage,
      latencyMs,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI request failed" });
  }
});

export default router;
