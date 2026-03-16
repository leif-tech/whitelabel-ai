const express = require("express");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");
const jwt = require("jsonwebtoken");

const getSupabase = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    req.agency = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

router.post("/", auth, async (req, res) => {
  const supabase = getSupabase();
  try {
    const { bot_name, client_name, greeting_message, primary_color } = req.body;
    if (!bot_name || !client_name) return res.status(400).json({ error: "Bot name and client name required" });
    const { data: bot, error } = await supabase.from("bots").insert([{ agency_id: req.agency.id, bot_name, client_name, greeting_message: greeting_message || "Hi! How can I help you today?", primary_color: primary_color || "#000000" }]).select().single();
    if (error) throw error;
    res.json({ message: "Bot created successfully", bot });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/", auth, async (req, res) => {
  const supabase = getSupabase();
  try {
    const { data: bots, error } = await supabase.from("bots").select("*").eq("agency_id", req.agency.id).order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ bots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id", auth, async (req, res) => {
  const supabase = getSupabase();
  try {
    const { data: bot, error } = await supabase.from("bots").select("*").eq("id", req.params.id).eq("agency_id", req.agency.id).single();
    if (error) throw error;
    if (!bot) return res.status(404).json({ error: "Bot not found" });
    res.json({ bot });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:id", auth, async (req, res) => {
  const supabase = getSupabase();
  try {
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
  const supabase = getSupabase();
  try {
    const { error } = await supabase.from("bots").delete().eq("id", req.params.id).eq("agency_id", req.agency.id);
    if (error) throw error;
    res.json({ message: "Bot deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
