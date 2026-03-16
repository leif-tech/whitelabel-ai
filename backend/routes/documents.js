const express = require("express");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const axios = require("axios");
const cheerio = require("cheerio");
const path = require("path");
const fs = require("fs");

const getSupabase = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const upload = multer({ dest: "uploads/" });

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

// Upload PDF
router.post("/:botId/upload", auth, upload.single("file"), async (req, res) => {
  const supabase = getSupabase();
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);
    fs.unlinkSync(req.file.path);
    const { error } = await supabase.from("documents").insert([{
      bot_id: req.params.botId,
      file_name: req.file.originalname,
      content: pdfData.text
    }]);
    if (error) throw error;
    res.json({ message: "PDF uploaded and learned successfully", characters: pdfData.text.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Add text directly
router.post("/:botId/text", auth, async (req, res) => {
  const supabase = getSupabase();
  try {
    const { content, file_name } = req.body;
    if (!content) return res.status(400).json({ error: "Content required" });
    const { error } = await supabase.from("documents").insert([{
      bot_id: req.params.botId,
      file_name: file_name || "Manual Text Entry",
      content
    }]);
    if (error) throw error;
    res.json({ message: "Text learned successfully", characters: content.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Scrape URL
router.post("/:botId/url", auth, async (req, res) => {
  const supabase = getSupabase();
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL required" });
    const { data } = await axios.get(url, { timeout: 10000 });
    const $ = cheerio.load(data);
    $("script, style, nav, footer, header").remove();
    const content = $("body").text().replace(/\s+/g, " ").trim();
    const { error } = await supabase.from("documents").insert([{
      bot_id: req.params.botId,
      file_name: url,
      content
    }]);
    if (error) throw error;
    res.json({ message: "URL scraped and learned successfully", characters: content.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get all documents for a bot
router.get("/:botId", auth, async (req, res) => {
  const supabase = getSupabase();
  try {
    const { data: docs, error } = await supabase.from("documents").select("id, file_name, created_at").eq("bot_id", req.params.botId);
    if (error) throw error;
    res.json({ documents: docs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete document
router.delete("/:botId/:docId", auth, async (req, res) => {
  const supabase = getSupabase();
  try {
    const { error } = await supabase.from("documents").delete().eq("id", req.params.docId).eq("bot_id", req.params.botId);
    if (error) throw error;
    res.json({ message: "Document deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;