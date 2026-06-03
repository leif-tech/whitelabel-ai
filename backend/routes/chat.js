const express = require("express");
const router = express.Router();
const Anthropic = require("@anthropic-ai/sdk");
const getSupabase = require("../lib/supabase");

const getAnthropic = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Post-process bot replies to guarantee proper line breaks
function formatReply(text) {
  // Strip markdown bold/italic that Claude sometimes adds despite instructions
  text = text.replace(/\*\*/g, '');

  // If already well-formatted with 3+ paragraph breaks, just return
  if ((text.match(/\n\s*\n/g) || []).length >= 3) return text;

  // Count price patterns (₱ or P followed by digits)
  const prices = text.match(/[₱P]\d[\d,]+/g) || [];
  if (prices.length < 3) return text;

  // Common words that follow prices in normal sentences (NOT product names)
  const skipWords = /^(para|sa|ang|ug|og|kay|kung|pero|lang|ra|na|da|ba|man|pud|pod|sad|hangtod|gikan|each|per|for|and|or|the|is|are|to|in|of|with|from|up|but|not|so|if|at|by|as|on|naa|wala|dili|mao|kini|namo|nila|available|only|also|nga|tag|matag|every|all|this|that|our|your|its|we|you|they|it|has|have|can|will|may|just|more|less|about|around|between|both|which|what|when|how|free|total|price|worth|below|above|under|over|most|best|good|great|cheap|affordable|starting|ranging|range|priced|costs|cost|inclusive|plus|minus|off|discount)$/i;

  // After a price (+ optional punctuation), if next word is a product/brand name, add line break
  text = text.replace(/([₱P]\d[\d,]+[.,:;]?)\s+(\S+)/g, (match, price, next) => {
    if (skipWords.test(next)) return match;
    return price + '\n\n' + next;
  });

  return text;
}

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
    let knowledge = docs?.map(d => d.content).join("\n\n") || "No documents uploaded yet.";
    if (knowledge.length > 100000) knowledge = knowledge.substring(0, 100000) + "\n\n[Content truncated due to size]";

    const { data: history } = await supabase.from("conversations").select("role, message").eq("bot_id", botId).eq("session_id", session_id || "default").order("created_at", { ascending: true }).limit(10);

    const messages = history?.map(h => ({ role: h.role, content: h.message })) || [];
    messages.push({ role: "user", content: message });

    const response = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514",
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

CORRECT example (placeholders — use actual items from the KNOWLEDGE BASE, never these names):

Here are the options available:

[Item Name 1]
[Price 1]

[Item Name 2]
[Price 2]

[Item Name 3]
[Price 3]

WRONG example (NEVER do this — this is unreadable):
[Item 1] - [Price 1] - [Item 2] - [Price 2] - [Item 3] - [Price 3]

ALSO WRONG (no wall of text):
We have [Item 1] for [Price 1], [Item 2] for [Price 2], [Item 3] for [Price 3], and more.

Remember: readability is the top priority. Use blank lines generously to separate items.`,
      messages
    });

    const reply = formatReply(response.content[0].text);

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
