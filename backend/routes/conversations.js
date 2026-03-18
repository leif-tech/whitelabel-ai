const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const getSupabase = require("../lib/supabase");

// Verify bot belongs to this agency
async function verifyBotOwnership(req, res, next) {
  try {
    const supabase = getSupabase();
    const { data: bot } = await supabase.from("bots").select("id").eq("id", req.params.botId).eq("agency_id", req.agency.id).single();
    if (!bot) return res.status(404).json({ error: "Bot not found" });
    next();
  } catch {
    res.status(404).json({ error: "Bot not found" });
  }
}

// GET all sessions for a bot (grouped)
router.get("/:botId", auth, verifyBotOwnership, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data: rows, error } = await supabase
      .from("conversations")
      .select("session_id, created_at, message, role")
      .eq("bot_id", req.params.botId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Group by session_id, get first user message + message count + latest timestamp
    const sessions = {};
    for (const row of rows) {
      if (!sessions[row.session_id]) {
        sessions[row.session_id] = {
          session_id: row.session_id,
          message_count: 0,
          last_message_at: row.created_at,
          preview: ""
        };
      }
      sessions[row.session_id].message_count++;
      if (row.role === "user" && !sessions[row.session_id].preview) {
        sessions[row.session_id].preview = row.message.substring(0, 100);
      }
    }

    const list = Object.values(sessions).sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
    res.json({ sessions: list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET full thread for a session
router.get("/:botId/:sessionId", auth, verifyBotOwnership, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data: messages, error } = await supabase
      .from("conversations")
      .select("role, message, created_at")
      .eq("bot_id", req.params.botId)
      .eq("session_id", req.params.sessionId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    res.json({ messages: messages || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
