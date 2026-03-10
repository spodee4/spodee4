// ============================================================
// Mx — AI Email Server
// Express + IMAP + Claude API + SQLite
// ============================================================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./db");
const ai = require("./ai");
const mail = require("./mail");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "..")));

// ---------- Email Endpoints ----------

// Get all emails (with optional filters)
app.get("/api/emails", (req, res) => {
  const { folder, account, category, search, limit, offset } = req.query;
  const emails = db.getEmails({
    folder: folder || "inbox",
    account: account || null,
    category: category || null,
    search: search || null,
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0,
  });
  res.json(emails);
});

// Get single email
app.get("/api/emails/:id", (req, res) => {
  const email = db.getEmail(req.params.id);
  if (!email) return res.status(404).json({ error: "Not found" });
  res.json(email);
});

// Mark email read/unread
app.patch("/api/emails/:id/read", (req, res) => {
  db.updateEmail(req.params.id, { read: req.body.read });
  res.json({ ok: true });
});

// Star/unstar
app.patch("/api/emails/:id/star", (req, res) => {
  db.updateEmail(req.params.id, { starred: req.body.starred });
  res.json({ ok: true });
});

// Set VIP
app.patch("/api/emails/:id/vip", (req, res) => {
  const email = db.getEmail(req.params.id);
  if (email) {
    db.setVipContact(email.from_address, req.body.vip);
  }
  res.json({ ok: true });
});

// Move to folder
app.patch("/api/emails/:id/move", (req, res) => {
  db.updateEmail(req.params.id, { folder: req.body.folder });
  res.json({ ok: true });
});

// Snooze email
app.patch("/api/emails/:id/snooze", (req, res) => {
  db.updateEmail(req.params.id, {
    snoozed_until: req.body.until,
    folder: "snoozed",
  });
  res.json({ ok: true });
});

// Delete email
app.delete("/api/emails/:id", (req, res) => {
  db.updateEmail(req.params.id, { folder: "trash" });
  res.json({ ok: true });
});

// Send email
app.post("/api/emails/send", async (req, res) => {
  try {
    const { from_account, to, subject, body, attachments } = req.body;
    await mail.sendEmail(from_account, { to, subject, body, attachments });
    db.insertEmail({
      from_name: "Me",
      from_address: mail.getAddress(from_account),
      to,
      subject,
      body,
      folder: "sent",
      account: from_account,
      read: true,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- AI Endpoints ----------

// AI triage (categorize emails)
app.post("/api/ai/triage", async (req, res) => {
  try {
    const { emailIds } = req.body;
    const emails = emailIds
      ? emailIds.map((id) => db.getEmail(id)).filter(Boolean)
      : db.getEmails({ folder: "inbox", limit: 100 });

    const results = await ai.triageEmails(emails);
    for (const result of results) {
      db.updateEmail(result.id, {
        category: result.category,
        ai_score: result.score,
      });
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI draft reply
app.post("/api/ai/draft-reply", async (req, res) => {
  try {
    const { emailId, tone } = req.body;
    const email = db.getEmail(emailId);
    if (!email) return res.status(404).json({ error: "Email not found" });
    const draft = await ai.draftReply(email, tone || "professional");
    res.json({ draft });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI summarize
app.post("/api/ai/summarize", async (req, res) => {
  try {
    const { emailId } = req.body;
    const email = db.getEmail(emailId);
    if (!email) return res.status(404).json({ error: "Email not found" });
    const summary = await ai.summarize(email);
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI improve text
app.post("/api/ai/improve", async (req, res) => {
  try {
    const { text, tone } = req.body;
    const improved = await ai.improveText(text, tone || "professional");
    res.json({ improved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI draft new email
app.post("/api/ai/draft", async (req, res) => {
  try {
    const { prompt, tone } = req.body;
    const draft = await ai.draftEmail(prompt, tone || "professional");
    res.json({ draft });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI chat (conversational commands)
app.post("/api/ai/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const context = {
      emailCount: db.getEmailCount(),
      unreadCount: db.getUnreadCount(),
      categories: db.getCategoryCounts(),
      recentEmails: db.getEmails({ folder: "inbox", limit: 10 }),
    };
    const response = await ai.chat(message, context);
    res.json({ response });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI detect calendar events
app.post("/api/ai/detect-events", async (req, res) => {
  try {
    const { emailId } = req.body;
    const email = db.getEmail(emailId);
    if (!email) return res.status(404).json({ error: "Email not found" });
    const events = await ai.detectCalendarEvents(email);
    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Templates ----------

app.get("/api/templates", (req, res) => {
  res.json(db.getTemplates());
});

app.post("/api/templates", (req, res) => {
  const { name, subject, body } = req.body;
  db.insertTemplate({ name, subject, body });
  res.json({ ok: true });
});

// ---------- VIP Contacts ----------

app.get("/api/vip", (req, res) => {
  res.json(db.getVipContacts());
});

// ---------- Accounts ----------

app.get("/api/accounts", (req, res) => {
  res.json(mail.getAccounts());
});

// ---------- Sync ----------

// Trigger email sync for all accounts
app.post("/api/sync", async (req, res) => {
  try {
    const results = await mail.syncAll(db);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sync single account
app.post("/api/sync/:account", async (req, res) => {
  try {
    const result = await mail.syncAccount(req.params.account, db);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Snooze wakeup (check every minute) ----------
setInterval(() => {
  db.wakeSnoozedEmails();
}, 60000);

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`Mx server running on http://localhost:${PORT}`);
  db.init();
});
