const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const getSupabase = require("../lib/supabase");

// GET /api/analytics — aggregate stats for all agency bots
router.get("/", auth, async (req, res) => {
  try {
    const supabase = getSupabase();

    // Get all bots for this agency
    const { data: bots } = await supabase.from("bots").select("id").eq("agency_id", req.agency.id);
    const botIds = bots?.map(b => b.id) || [];

    if (botIds.length === 0) {
      return res.json({ total_bots: 0, active_bots: 0, total_messages: 0, total_documents: 0 });
    }

    // Active bots
    const { data: activeBots } = await supabase.from("bots").select("id").eq("agency_id", req.agency.id).eq("is_active", true);

    // Total messages
    const { count: messageCount } = await supabase.from("conversations").select("*", { count: "exact", head: true }).in("bot_id", botIds);

    // Total documents
    const { count: docCount } = await supabase.from("documents").select("*", { count: "exact", head: true }).in("bot_id", botIds);

    res.json({
      total_bots: botIds.length,
      active_bots: activeBots?.length || 0,
      total_messages: messageCount || 0,
      total_documents: docCount || 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/analytics/:botId — per-bot stats with ownership check
router.get("/:botId", auth, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { botId } = req.params;

    // Verify ownership
    const { data: bot } = await supabase.from("bots").select("id").eq("id", botId).eq("agency_id", req.agency.id).single();
    if (!bot) return res.status(404).json({ error: "Bot not found" });

    // Messages count
    const { count: messageCount } = await supabase.from("conversations").select("*", { count: "exact", head: true }).eq("bot_id", botId);

    // Unique sessions (conversations)
    const { data: sessions } = await supabase.from("conversations").select("session_id").eq("bot_id", botId);
    const uniqueSessions = new Set(sessions?.map(s => s.session_id) || []);

    // Documents count
    const { count: docCount } = await supabase.from("documents").select("*", { count: "exact", head: true }).eq("bot_id", botId);

    res.json({
      total_messages: messageCount || 0,
      total_conversations: uniqueSessions.size,
      total_documents: docCount || 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
