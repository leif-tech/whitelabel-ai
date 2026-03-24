const express = require("express");
const router = express.Router();
const Anthropic = require("@anthropic-ai/sdk");
const getSupabase = require("../lib/supabase");

const getAnthropic = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// GET bot info (for widget init — no API call wasted)
router.get("/:botId/info", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data: bot } = await supabase.from("bots").select("bot_name, primary_color, greeting_message").eq("id", req.params.botId).eq("is_active", true).single();
    if (!bot) return res.status(404).json({ error: "Bot not found" });
    res.json({ bot_name: bot.bot_name, primary_color: bot.primary_color, greeting_message: bot.greeting_message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST chat message
router.post("/:botId", async (req, res) => {
  try {
    const supabase = getSupabase();
    const anthropic = getAnthropic();
    const { message, session_id } = req.body;
    const { botId } = req.params;

    if (!message) return res.status(400).json({ error: "Message required" });

    const { data: bot, error: botError } = await supabase.from("bots").select("*").eq("id", botId).eq("is_active", true).single();
    if (botError || !bot) return res.status(404).json({ error: "Bot not found" });

    const { data: docs } = await supabase.from("documents").select("content").eq("bot_id", botId);
    const knowledge = docs?.map(d => d.content).join("\n\n") || "No documents uploaded yet.";

    const { data: history } = await supabase.from("conversations").select("role, message").eq("bot_id", botId).eq("session_id", session_id || "default").order("created_at", { ascending: true }).limit(10);

    const messages = history?.map(h => ({ role: h.role, content: h.message })) || [];
    messages.push({ role: "user", content: message });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `You are ${bot.bot_name}, a helpful AI assistant for ${bot.client_name}.

Use ONLY the following knowledge base to answer questions. If the answer is not in the knowledge base, say you don't have that information and suggest they contact the business directly.

KNOWLEDGE BASE:
${knowledge}

Be friendly, concise, and helpful. Always stay in character as ${bot.bot_name}. Always reply in the same language the user is speaking. If they write in Bisaya, Tagalog, or any other language, respond in that language.

CRITICAL FORMATTING RULES — YOU MUST FOLLOW THESE EXACTLY:

1. NEVER use markdown syntax. No **, *, #, backticks, or bullet characters (-, •, *)
2. ALWAYS use real line breaks (newlines) to separate items. NEVER chain multiple items on one line separated by dashes, commas, or slashes.
3. When listing products, services, prices, or any multiple items: put EACH item on its own line, with ONE blank line between each item.
4. Start with a brief intro sentence, then leave a blank line before the list.
5. Keep each item to 1-2 lines (name + price on separate lines, or name and price on same line).
6. Separate different categories or sections with a blank line and a simple label.

CORRECT example:

Naa mi available nga DDR4 RAM:

Kingston Fury Beast 8GB DDR4 3200MHz
P1,590

OCPC XT II 8GB DDR4 3200MHz
P1,550

TeamGroup Elite+ 8GB DDR4 3200MHz
P1,335

WRONG example (NEVER do this — this is unreadable):
Kingston Fury Beast 8GB DDR4 3200MHz - P1,590 - OCPC XT II 8GB DDR4 3200MHz - P1,550 - TeamGroup Elite+ 8GB - P1,335

ALSO WRONG (no wall of text):
We have Kingston Fury Beast 8GB DDR4 3200MHz for P1,590, OCPC XT II 8GB DDR4 3200MHz for P1,550, TeamGroup Elite+ 8GB DDR4 3200MHz for P1,335, and more.

Remember: readability is the top priority. Use blank lines generously to separate items.`,
      messages
    });

    const reply = response.content[0].text;

    await supabase.from("conversations").insert([
      { bot_id: botId, session_id: session_id || "default", role: "user", message },
      { bot_id: botId, session_id: session_id || "default", role: "assistant", message: reply }
    ]);

    res.json({ reply, bot_name: bot.bot_name, primary_color: bot.primary_color });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
