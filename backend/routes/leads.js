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

// GET leads for a bot
router.get("/:botId", auth, verifyBotOwnership, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data: leads, error } = await supabase
      .from("leads")
      .select("*")
      .eq("bot_id", req.params.botId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ leads: leads || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST create lead (public — called from widget, no auth)
router.post("/:botId", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { name, email, phone, session_id } = req.body;

    if (!name && !email && !phone) {
      return res.status(400).json({ error: "At least one contact field required" });
    }

    // Verify bot exists and is active
    const { data: bot } = await supabase.from("bots").select("id").eq("id", req.params.botId).eq("is_active", true).single();
    if (!bot) return res.status(404).json({ error: "Bot not found" });

    const { error } = await supabase.from("leads").insert([{
      bot_id: req.params.botId,
      name: name || null,
      email: email || null,
      phone: phone || null,
      session_id: session_id || null
    }]);

    if (error) throw error;
    res.json({ message: "Lead captured" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE lead
router.delete("/:botId/:leadId", auth, verifyBotOwnership, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from("leads").delete().eq("id", req.params.leadId).eq("bot_id", req.params.botId);
    if (error) throw error;
    res.json({ message: "Lead deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
