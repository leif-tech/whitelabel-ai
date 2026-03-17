const express = require("express");
const router = express.Router();
const multer = require("multer");
// Lazy-load pdf-parse (uses DOMMatrix which isn't available in all serverless runtimes)
let pdfParse;
const getPdfParse = () => {
  if (!pdfParse) pdfParse = require("pdf-parse");
  return pdfParse;
};
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const auth = require("../middleware/auth");
const getSupabase = require("../lib/supabase");

const upload = multer({
  dest: process.env.VERCEL === '1' ? '/tmp' : path.join(__dirname, "..", "uploads"),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"), false);
  }
});

// Middleware: verify the bot belongs to this agency
async function verifyBotOwnership(req, res, next) {
  try {
    const supabase = getSupabase();
    const { data: bot } = await supabase.from("bots").select("id").eq("id", req.params.botId).eq("agency_id", req.agency.id).single();
    if (!bot) return res.status(404).json({ error: "Bot not found or not owned by you" });
    next();
  } catch {
    res.status(404).json({ error: "Bot not found" });
  }
}

// Upload PDF
router.post("/:botId/upload", auth, verifyBotOwnership, (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "File too large. Max 10MB." });
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const supabase = getSupabase();
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await getPdfParse()(dataBuffer);
    fs.unlinkSync(req.file.path);
    const { error } = await supabase.from("documents").insert([{
      bot_id: req.params.botId,
      file_name: req.file.originalname,
      content: pdfData.text
    }]);
    if (error) throw error;
    res.json({ message: "PDF uploaded and learned successfully", characters: pdfData.text.length });
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Add text directly
router.post("/:botId/text", auth, verifyBotOwnership, async (req, res) => {
  try {
    const supabase = getSupabase();
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
router.post("/:botId/url", auth, verifyBotOwnership, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL required" });
    if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: "URL must start with http:// or https://" });
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
router.get("/:botId", auth, verifyBotOwnership, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data: docs, error } = await supabase.from("documents").select("id, file_name, created_at").eq("bot_id", req.params.botId);
    if (error) throw error;
    res.json({ documents: docs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete document
router.delete("/:botId/:docId", auth, verifyBotOwnership, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from("documents").delete().eq("id", req.params.docId).eq("bot_id", req.params.botId);
    if (error) throw error;
    res.json({ message: "Document deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
