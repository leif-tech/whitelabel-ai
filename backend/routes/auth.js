const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

router.post("/register", async (req, res) => {
  try {
    const { email, password, agency_name } = req.body;
    if (!email || !password || !agency_name) return res.status(400).json({ error: "All fields required" });
    const { data: existing } = await supabase.from("agencies").select("id").eq("email", email).single();
    if (existing) return res.status(400).json({ error: "Email already registered" });
    const password_hash = await bcrypt.hash(password, 10);
    const { data: agency, error } = await supabase.from("agencies").insert([{ email, password_hash, agency_name }]).select().single();
    if (error) throw error;
    const token = jwt.sign({ id: agency.id, email: agency.email }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ message: "Agency registered successfully", token, agency: { id: agency.id, email: agency.email, agency_name: agency.agency_name, plan: agency.plan } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    const { data: agency, error } = await supabase.from("agencies").select("*").eq("email", email).single();
    if (error || !agency) return res.status(400).json({ error: "Invalid credentials" });
    const valid = await bcrypt.compare(password, agency.password_hash);
    if (!valid) return res.status(400).json({ error: "Invalid credentials" });
    const token = jwt.sign({ id: agency.id, email: agency.email }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ message: "Login successful", token, agency: { id: agency.id, email: agency.email, agency_name: agency.agency_name, plan: agency.plan } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;