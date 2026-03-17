const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const getSupabase = require("../lib/supabase");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  next();
};

router.post("/register", [
  body("email").isEmail().withMessage("Valid email required"),
  body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  body("agency_name").notEmpty().withMessage("Agency name is required"),
], validate, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { email, password, agency_name } = req.body;
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

router.post("/login", [
  body("email").isEmail().withMessage("Valid email required"),
  body("password").notEmpty().withMessage("Password is required"),
], validate, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { email, password } = req.body;
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
