const express = require("express");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");
const Anthropic = require("@anthropic-ai/sdk");

const getSupabase = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const getAnthropic = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.post("/:botId", async (req, res) => {
  const supabase = getSupabase();
  const anthropic = getAnthropic();
  try {
    const { message, session_id } = req.body;
    const { botId } = req.params;

    if (!message) return res.status(400).json({ error: "Message required" });

    // Get bot details
    const { data: bot, error: botError } = await supabase.from("bots").select("*").eq("id", botId).eq("is_active", true).single();
    if (botError || !bot) return res.status(404).json({ error: "Bot not found" });

    // Get bot documents
    const { data: docs } = await supabase.from("documents").select("content").eq("bot_id", botId);
    const knowledge = docs?.map(d => d.content).join("\n\n") || "No documents uploaded yet.";

    // Get conversation history
    const { data: history } = await supabase.from("conversations").select("role, message").eq("bot_id", botId).eq("session_id", session_id || "default").order("created_at", { ascending: true }).limit(10);

    const messages = history?.map(h => ({ role: h.role, content: h.message })) || [];
    messages.push({ role: "user", content: message });

    // Call Claude
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `You are ${bot.bot_name}, a helpful AI assistant for ${bot.client_name}. 
      
Use ONLY the following knowledge base to answer questions. If the answer is not in the knowledge base, say you don't have that information and suggest they contact the business directly.

KNOWLEDGE BASE:
${knowledge}

Be friendly, concise, and helpful. Always stay in character as ${bot.bot_name}.`,
      messages
    });

    const reply = response.content[0].text;

    // Save conversation
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