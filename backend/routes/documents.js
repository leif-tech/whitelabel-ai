const express = require("express");
const router = express.Router();
const multer = require("multer");
const pdfParse = require("pdf-parse-new");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const auth = require("../middleware/auth");
const getSupabase = require("../lib/supabase");

const uploadsDir = process.env.VERCEL === '1' ? '/tmp' : path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
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
    if (content.length > 500000) return res.status(400).json({ error: "Content too large. Max 500KB of text." });
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

// Scrape URL — extracts both visible text and inline JS data (e.g. product arrays)
router.post("/:botId/url", auth, verifyBotOwnership, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL required" });
    if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: "URL must start with http:// or https://" });

    // Block SSRF: prevent scraping internal/private IPs
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254', '[::1]', '::1'];
      if (blockedHosts.includes(hostname) || /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname)) {
        return res.status(400).json({ error: "Cannot scrape internal URLs" });
      }
    } catch {
      return res.status(400).json({ error: "Invalid URL" });
    }

    const { data: html } = await axios.get(url, { timeout: 15000, maxContentLength: 5 * 1024 * 1024, maxRedirects: 3 });
    const $ = cheerio.load(html);

    // Extract structured data from inline scripts (product arrays, JSON-LD, etc.)
    let scriptData = "";
    $("script").each((_, el) => {
      const code = $(el).html() || "";
      // Look for product/data arrays in inline scripts
      const arrayMatches = code.match(/(?:const|let|var)\s+\w+\s*=\s*\[[\s\S]*?\];/g);
      if (arrayMatches) {
        for (const match of arrayMatches) {
          // Extract name/price/cat fields from JS object arrays
          const items = [];
          const itemRegex = /\{[^}]*name\s*:\s*"([^"]*)"[^}]*price\s*:\s*([\d.]+)[^}]*\}/g;
          let m;
          while ((m = itemRegex.exec(match)) !== null) {
            const catMatch = match.substring(m.index, m.index + m[0].length).match(/cat\s*:\s*"([^"]*)"/);
            const labelMatch = match.substring(m.index, m.index + m[0].length).match(/label\s*:\s*"([^"]*)"/);
            const category = labelMatch ? labelMatch[1] : (catMatch ? catMatch[1] : "");
            items.push(`${category}: ${m[1]} - ₱${Number(m[2]).toLocaleString()}`);
          }
          if (items.length > 0) {
            scriptData += "\n\nPRODUCT CATALOG:\n" + items.join("\n");
          }
        }
      }
      // Extract JSON-LD structured data
      if (code.includes('"@type"')) {
        try {
          const jsonLd = JSON.parse(code);
          scriptData += "\n\nStructured Data: " + JSON.stringify(jsonLd);
        } catch {}
      }
    });

    // Get visible text content
    $("script, style").remove();
    let textContent = $("body").text().replace(/\s+/g, " ").trim();

    let content = textContent + scriptData;
    if (content.length > 500000) content = content.substring(0, 500000);
    if (!content) return res.status(400).json({ error: "No content found on page" });

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

// Get all documents for a bot (with content preview)
router.get("/:botId", auth, verifyBotOwnership, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data: docs, error } = await supabase.from("documents").select("id, file_name, content, created_at").eq("bot_id", req.params.botId);
    if (error) throw error;
    // Include character count and a preview
    const documents = docs.map(d => ({
      id: d.id,
      file_name: d.file_name,
      char_count: d.content?.length || 0,
      preview: d.content?.substring(0, 200) || '',
      content: d.content || '',
      created_at: d.created_at
    }));
    res.json({ documents });
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
