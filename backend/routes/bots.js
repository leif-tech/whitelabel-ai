const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const auth = require("../middleware/auth");
const getSupabase = require("../lib/supabase");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  next();
};

router.post("/", auth, [
  body("bot_name").notEmpty().withMessage("Bot name is required"),
  body("client_name").notEmpty().withMessage("Client name is required"),
], validate, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { bot_name, client_name, greeting_message, primary_color } = req.body;
    const { data: bot, error } = await supabase.from("bots").insert([{
      agency_id: req.agency.id,
      bot_name,
      client_name,
      greeting_message: greeting_message || "Hi! How can I help you today?",
      primary_color: primary_color || "#000000"
    }]).select().single();
    if (error) throw error;
    res.json({ message: "Bot created successfully", bot });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/", auth, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data: bots, error } = await supabase.from("bots").select("*").eq("agency_id", req.agency.id).order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ bots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id", auth, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data: bot, error } = await supabase.from("bots").select("*").eq("id", req.params.id).eq("agency_id", req.agency.id).single();
    if (error || !bot) return res.status(404).json({ error: "Bot not found" });
    res.json({ bot });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:id", auth, [
  body("bot_name").notEmpty().withMessage("Bot name is required"),
  body("client_name").notEmpty().withMessage("Client name is required"),
], validate, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { bot_name, client_name, greeting_message, primary_color, is_active } = req.body;
    const { data: bot, error } = await supabase.from("bots").update({ bot_name, client_name, greeting_message, primary_color, is_active }).eq("id", req.params.id).eq("agency_id", req.agency.id).select().single();
    if (error) throw error;
    res.json({ message: "Bot updated", bot });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from("bots").delete().eq("id", req.params.id).eq("agency_id", req.agency.id);
    if (error) throw error;
    res.json({ message: "Bot deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
