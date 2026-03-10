// ============================================================
// Spodee — AI Chief of Staff Email Server
// Express + IMAP + Claude API + SQLite
// ============================================================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const db = require("./db");
const ai = require("./ai");
const mail = require("./mail");
const auth = require("./auth");
const vault = require("./vault");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "..")));

// Auth middleware — protects all /api/* routes except auth endpoints
app.use(auth.requireAuth(db));

// ============================================================
// Auth Endpoints
// ============================================================

// Check if any user exists (first-run setup)
app.get("/api/auth/setup-check", (req, res) => {
  const user = db.getUserByUsername("admin");
  res.json({ needsSetup: !user, hasUsers: !!user });
});

// Register (only allowed if no users exist yet — first-run setup)
app.post("/api/auth/register", (req, res) => {
  try {
    const existingUser = db.getUserByUsername("admin");
    if (existingUser) return res.status(403).json({ error: "Setup already completed. Use login." });

    const { password, displayName } = req.body;
    if (!password || password.length < 4) return res.status(400).json({ error: "Password must be at least 4 characters" });

    const hash = auth.hashPassword(password);
    const result = db.createUser("admin", hash, displayName || "John");
    const token = auth.createAuthSession(db, res, result.lastInsertRowid);

    res.json({ ok: true, token, user: { username: "admin", displayName: displayName || "John" } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post("/api/auth/login", (req, res) => {
  try {
    const { password } = req.body;
    const user = db.getUserByUsername("admin");
    if (!user) return res.status(404).json({ error: "No account set up yet" });

    if (!auth.verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "Wrong password" });
    }

    const token = auth.createAuthSession(db, res, user.id);
    res.json({ ok: true, token, user: { username: user.username, displayName: user.display_name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Logout
app.post("/api/auth/logout", (req, res) => {
  const token = req.cookies?.mx_session || req.headers["x-auth-token"];
  if (token) db.deleteSession(token);
  res.clearCookie("mx_session");
  res.json({ ok: true });
});

// Get current user
app.get("/api/auth/me", (req, res) => {
  res.json({ user: req.user });
});

// ============================================================
// Email Endpoints
// ============================================================

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

// ============================================================
// AI Endpoints
// ============================================================

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

// AI draft reply (enhanced with contact + memory context)
app.post("/api/ai/draft-reply", async (req, res) => {
  try {
    const { emailId, tone } = req.body;
    const email = db.getEmail(emailId);
    if (!email) return res.status(404).json({ error: "Email not found" });

    // Enhance with contact and memory context
    let contactContext = null;
    let memoryContext = [];
    try {
      contactContext = db.getContact(email.from_address);
    } catch (e) { /* contact may not exist */ }
    try {
      memoryContext = db.getMemories({ limit: 20 });
    } catch (e) { /* memory may be empty */ }

    const draft = await ai.draftReply(email, tone || "professional", {
      contact: contactContext,
      memory: memoryContext,
    });
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

// AI chat (enhanced with tasks/events/staleContacts context)
app.post("/api/ai/chat", async (req, res) => {
  try {
    const { message } = req.body;

    // Build enhanced context
    let tasks = [];
    let todayEvents = [];
    let staleContacts = [];
    try { tasks = db.getTasks({ status: "pending", limit: 10 }); } catch (e) { /* */ }
    try { todayEvents = db.getCalendarEventsToday(); } catch (e) { /* */ }
    try { staleContacts = db.getStaleContacts(30); } catch (e) { /* */ }

    const context = {
      emailCount: db.getEmailCount(),
      unreadCount: db.getUnreadCount(),
      categories: db.getCategoryCounts(),
      recentEmails: db.getEmails({ folder: "inbox", limit: 10 }),
      tasks,
      todayEvents,
      staleContacts,
    };
    const response = await ai.chat(message, context);
    res.json({ response });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI detect calendar events (auto-saves to DB)
app.post("/api/ai/detect-events", async (req, res) => {
  try {
    const { emailId } = req.body;
    const email = db.getEmail(emailId);
    if (!email) return res.status(404).json({ error: "Email not found" });
    const events = await ai.detectCalendarEvents(email);

    // Auto-save detected events to the database
    const saved = [];
    for (const event of events) {
      try {
        const id = db.insertCalendarEvent({
          email_id: emailId,
          title: event.title,
          description: event.description || "",
          start_time: event.date + (event.time ? "T" + event.time : "T00:00"),
          end_time: event.end_date || null,
          location: event.location || null,
          meeting_url: event.meeting_url || null,
        });
        saved.push({ ...event, id });
      } catch (e) {
        saved.push({ ...event, save_error: e.message });
      }
    }
    res.json({ events: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI extract tasks from email
app.post("/api/ai/extract-tasks", async (req, res) => {
  try {
    const { emailId } = req.body;
    const email = db.getEmail(emailId);
    if (!email) return res.status(404).json({ error: "Email not found" });

    const extracted = await ai.extractTasks(email);
    const saved = [];
    for (const task of extracted) {
      try {
        const id = db.insertTask({
          email_id: emailId,
          title: task.title,
          description: task.description || "",
          priority: task.priority || "normal",
          due_date: task.due_date || null,
          assigned_to: task.assigned_to || null,
          created_from: "ai_extract",
        });
        saved.push({ ...task, id });
      } catch (e) {
        saved.push({ ...task, save_error: e.message });
      }
    }
    res.json({ tasks: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI suggest schedule
app.post("/api/ai/suggest-schedule", async (req, res) => {
  try {
    const { date } = req.body;
    const targetDate = date || new Date().toISOString().split("T")[0];

    let tasks = [];
    let events = [];
    let rules = [];
    try { tasks = db.getTasks({ status: "pending" }); } catch (e) { /* */ }
    try { events = db.getCalendarEvents({ startAfter: targetDate + "T00:00", startBefore: targetDate + "T23:59" }); } catch (e) { /* */ }
    try { rules = db.getSchedulingRules(); } catch (e) { /* */ }

    // suggestSchedule expects (email, rules, existingEvents) but here we use it for day scheduling
    const emailId = req.body.emailId;
    const email = emailId ? db.getEmail(emailId) : { from_name: "Schedule", from_address: "", subject: "Day scheduling", date: targetDate, body: `Schedule request for ${targetDate}` };
    const suggestion = await ai.suggestSchedule(email, rules, events);
    res.json({ suggestion });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI learn (store learned preferences/facts in memory)
app.post("/api/ai/learn", async (req, res) => {
  try {
    const { text } = req.body;
    const learned = await ai.learnFromFeedback({ type: "feedback", text }, {});

    // Save extracted preferences to memory
    const saved = [];
    if (learned && learned.preferences && Array.isArray(learned.preferences)) {
      for (const item of learned.preferences) {
        try {
          db.upsertMemory(item.rule, item.observation, item.type || "learned", Math.round((item.confidence || 0.5) * 10));
          saved.push(item);
        } catch (e) {
          saved.push({ ...item, save_error: e.message });
        }
      }
    }
    res.json({ learned: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Thread Endpoints
// ============================================================

// Get thread emails + summary + decisions + commitments
app.get("/api/threads/:threadId", (req, res) => {
  try {
    const { threadId } = req.params;
    const emails = db.getEmailsByThread(threadId);
    let summary = null;
    let decisions = [];
    let commitments = [];
    try { summary = db.getThreadSummary(threadId); } catch (e) { /* */ }
    try { decisions = db.getDecisionsByThread(threadId); } catch (e) { /* */ }
    try { commitments = db.getCommitmentsByThread(threadId); } catch (e) { /* */ }

    res.json({ threadId, emails, summary, decisions, commitments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI analyze thread — save decisions + commitments
app.post("/api/threads/:threadId/analyze", async (req, res) => {
  try {
    const { threadId } = req.params;
    const emails = db.getEmailsByThread(threadId);
    if (!emails.length) return res.status(404).json({ error: "No emails in thread" });

    const analysis = await ai.analyzeThread(emails);

    // Save thread summary
    try {
      db.upsertThreadSummary(
        threadId,
        analysis.summary || analysis.topic || "",
        JSON.stringify(analysis.participants || []),
        emails.length,
        emails[emails.length - 1].date,
        analysis.health || analysis.status || "active"
      );
    } catch (e) { /* */ }

    // Save decisions
    const savedDecisions = [];
    if (analysis.decisions && Array.isArray(analysis.decisions)) {
      for (const d of analysis.decisions) {
        try {
          const id = db.insertDecision({
            email_id: d.email_id || null,
            title: d.title,
            description: d.description || "",
            decided_by: d.decided_by || null,
            decided_at: d.decided_at || new Date().toISOString(),
            context: threadId,
          });
          savedDecisions.push({ ...d, id });
        } catch (e) { /* */ }
      }
    }

    // Save commitments
    const savedCommitments = [];
    if (analysis.commitments && Array.isArray(analysis.commitments)) {
      for (const c of analysis.commitments) {
        try {
          const id = db.insertCommitment({
            email_id: c.email_id || null,
            from_contact: c.from_contact || null,
            to_contact: c.to_contact || null,
            description: c.description,
            due_date: c.due_date || null,
            status: "pending",
          });
          savedCommitments.push({ ...c, id });
        } catch (e) { /* */ }
      }
    }

    res.json({
      summary: analysis.summary,
      participants: analysis.participants,
      status: analysis.status,
      decisions: savedDecisions,
      commitments: savedCommitments,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Task Endpoints
// ============================================================

app.get("/api/tasks", (req, res) => {
  try {
    const { status, project_id, limit } = req.query;
    const tasks = db.getTasks({
      status: status || null,
      projectId: project_id ? parseInt(project_id) : null,
      limit: limit ? parseInt(limit) : 100,
    });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/tasks/today", (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const tasks = db.getTasksDueBy(today);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/tasks", (req, res) => {
  try {
    const { title, description, priority, due_date, assigned_to, email_id, project_id } = req.body;
    const id = db.insertTask({
      title,
      description: description || "",
      priority: priority || "normal",
      due_date: due_date || null,
      assigned_to: assigned_to || null,
      email_id: email_id || null,
      project_id: project_id || null,
      created_from: "manual",
    });
    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/tasks/:id", (req, res) => {
  try {
    db.updateTask(req.params.id, req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Project Endpoints
// ============================================================

app.get("/api/projects", (req, res) => {
  try {
    const projects = db.getProjects();
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/projects", (req, res) => {
  try {
    const { name, description, priority, deadline } = req.body;
    const id = db.insertProject({
      name,
      description: description || "",
      priority: priority || "normal",
      deadline: deadline || null,
    });
    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/projects/:id", (req, res) => {
  try {
    db.updateProject(req.params.id, req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/projects/:id/emails", (req, res) => {
  try {
    const emails = db.getProjectEmails(req.params.id);
    res.json(emails);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/projects/:id/link", (req, res) => {
  try {
    const { email_id } = req.body;
    db.linkProjectEmail(req.params.id, email_id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Contact Endpoints
// ============================================================

app.get("/api/contacts", (req, res) => {
  try {
    const contacts = db.getContacts();
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/contacts/stale/:days", (req, res) => {
  try {
    const days = parseInt(req.params.days) || 30;
    const contacts = db.getStaleContacts(days);
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/contacts/:email", (req, res) => {
  try {
    const contact = db.getContact(req.params.email);
    if (!contact) return res.status(404).json({ error: "Contact not found" });
    res.json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/contacts/:email", (req, res) => {
  try {
    db.updateContact(req.params.email, req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/contacts/:email/analyze", async (req, res) => {
  try {
    const contactEmail = req.params.email;
    const emails = db.getEmailsByContact(contactEmail);
    const existingContact = db.getContact(contactEmail) || {};
    const analysis = await ai.analyzeContact(emails, { email: contactEmail, name: existingContact.name, company: existingContact.organization, role: existingContact.role });

    // Update contact with analysis results
    try {
      db.upsertContact({
        email: contactEmail,
        name: analysis.name || null,
        organization: analysis.organization || null,
        role: analysis.role || null,
        relationship: analysis.relationship || "unknown",
        notes: analysis.notes || null,
        tags: analysis.tags ? JSON.stringify(analysis.tags) : null,
      });
    } catch (e) { /* */ }

    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Calendar Endpoints
// ============================================================

app.get("/api/calendar", (req, res) => {
  try {
    const { start, end } = req.query;
    const events = db.getCalendarEvents({ startAfter: start || null, startBefore: end || null });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/calendar/today", (req, res) => {
  try {
    const events = db.getCalendarEventsToday();
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/calendar", (req, res) => {
  try {
    const { title, description, start_time, end_time, location, meeting_url, reminder_minutes } = req.body;
    const id = db.insertCalendarEvent({
      title,
      description: description || "",
      start_time,
      end_time: end_time || null,
      location: location || null,
      meeting_url: meeting_url || null,
      reminder_minutes: reminder_minutes || 15,
    });
    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/calendar/:id", (req, res) => {
  try {
    db.updateCalendarEvent(req.params.id, req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Briefing Endpoints (cached per day)
// ============================================================

app.get("/api/briefing", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    // Check cache
    let briefing = null;
    try { briefing = db.getBriefing(today); } catch (e) { /* */ }
    if (briefing) return res.json(briefing);

    // Generate fresh briefing
    const context = {
      emails: db.getEmails({ folder: "inbox", limit: 50 }),
      unreadCount: db.getUnreadCount(),
      categories: db.getCategoryCounts(),
    };

    let tasks = [];
    let events = [];
    let commitments = [];
    let staleContacts = [];
    try { tasks = db.getTasks({ status: "pending" }); } catch (e) { /* */ }
    try { events = db.getCalendarEventsToday(); } catch (e) { /* */ }
    try { commitments = db.getCommitments({ status: "pending" }); } catch (e) { /* */ }
    try { staleContacts = db.getStaleContacts(14); } catch (e) { /* */ }

    context.tasks = tasks;
    context.todayEvents = events;
    context.pendingCommitments = commitments;
    context.staleContacts = staleContacts;

    const content = await ai.generateBriefing(context);

    // Cache the briefing
    try {
      db.insertBriefing({ date: today, content, type: "daily" });
    } catch (e) { /* */ }

    res.json({ date: today, content, type: "daily" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/briefing/refresh", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    // Delete cached briefing
    try { db.deleteBriefing(today); } catch (e) { /* */ }

    // Generate fresh
    const context = {
      emails: db.getEmails({ folder: "inbox", limit: 50 }),
      unreadCount: db.getUnreadCount(),
      categories: db.getCategoryCounts(),
    };

    let tasks = [];
    let events = [];
    let commitments = [];
    let staleContacts = [];
    try { tasks = db.getTasks({ status: "pending" }); } catch (e) { /* */ }
    try { events = db.getCalendarEventsToday(); } catch (e) { /* */ }
    try { commitments = db.getCommitments({ status: "pending" }); } catch (e) { /* */ }
    try { staleContacts = db.getStaleContacts(14); } catch (e) { /* */ }

    context.tasks = tasks;
    context.todayEvents = events;
    context.pendingCommitments = commitments;
    context.staleContacts = staleContacts;

    const content = await ai.generateBriefing(context);

    try {
      db.insertBriefing({ date: today, content, type: "daily" });
    } catch (e) { /* */ }

    res.json({ date: today, content, type: "daily" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Memory Endpoints
// ============================================================

app.get("/api/memory", (req, res) => {
  try {
    const memory = db.getMemories();
    res.json(memory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/memory", (req, res) => {
  try {
    const { key, value, category, importance } = req.body;
    db.upsertMemory(key, value, category || "general", importance || 5);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/memory/:key", (req, res) => {
  try {
    db.deleteMemory(req.params.key);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Decisions & Commitments Endpoints
// ============================================================

app.get("/api/decisions", (req, res) => {
  try {
    const { project_id } = req.query;
    const decisions = db.getDecisions({ projectId: project_id ? parseInt(project_id) : null });
    res.json(decisions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/commitments", (req, res) => {
  try {
    const { status } = req.query;
    const commitments = db.getCommitments({ status: status || null });
    res.json(commitments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Templates
// ============================================================

app.get("/api/templates", (req, res) => {
  res.json(db.getTemplates());
});

app.post("/api/templates", (req, res) => {
  const { name, subject, body } = req.body;
  db.insertTemplate({ name, subject, body });
  res.json({ ok: true });
});

// ============================================================
// VIP Contacts
// ============================================================

app.get("/api/vip", (req, res) => {
  res.json(db.getVipContacts());
});

// ============================================================
// Vault Proxy Routes (browser → Mx server → Mac mini vault)
// ============================================================

app.get("/api/vault/health", async (req, res) => {
  try {
    const status = await vault.health();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/vault/list", async (req, res) => {
  try {
    const pin = req.headers["x-vault-pin"] || "";
    const data = await vault.proxyRequest("GET", "/vault/credentials", null, pin);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post("/api/vault/verify-pin", async (req, res) => {
  try {
    const { pin } = req.body;
    const data = await vault.proxyRequest("POST", "/vault/verify-pin", { pin }, pin);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post("/api/vault/credentials", async (req, res) => {
  try {
    const pin = req.headers["x-vault-pin"] || req.body.pin || "";
    const data = await vault.proxyRequest("POST", "/vault/credentials", req.body, pin);
    vault.clearCache();
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.delete("/api/vault/credentials/:name", async (req, res) => {
  try {
    const pin = req.headers["x-vault-pin"] || "";
    const data = await vault.proxyRequest("DELETE", `/vault/credentials/${encodeURIComponent(req.params.name)}`, null, pin);
    vault.clearCache();
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post("/api/vault/credentials/:name/reveal", async (req, res) => {
  try {
    const pin = req.headers["x-vault-pin"] || "";
    const data = await vault.proxyRequest("POST", `/vault/credentials/${encodeURIComponent(req.params.name)}/reveal`, null, pin);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get("/api/vault/audit", async (req, res) => {
  try {
    const pin = req.headers["x-vault-pin"] || "";
    const qs = new URLSearchParams(req.query).toString();
    const path = "/vault/audit" + (qs ? `?${qs}` : "");
    const data = await vault.proxyRequest("GET", path, null, pin);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ============================================================
// Accounts
// ============================================================

app.get("/api/accounts", async (req, res) => {
  try {
    const accounts = await mail.getAccounts();
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Sync
// ============================================================

app.post("/api/sync", async (req, res) => {
  try {
    const results = await mail.syncAll(db);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/sync/:account", async (req, res) => {
  try {
    const result = await mail.syncAccount(req.params.account, db);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Scheduling Rules
// ============================================================

app.get("/api/scheduling-rules", (req, res) => {
  try {
    const rules = db.getSchedulingRules();
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Push Notification Endpoints
// ============================================================

app.post("/api/push/subscribe", (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint) return res.status(400).json({ error: "Missing endpoint" });
    const userId = req.user ? req.user.id : null;
    db.savePushSubscription(userId, endpoint, keys?.p256dh || "", keys?.auth || "");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/push/unsubscribe", (req, res) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) db.deletePushSubscription(endpoint);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Snooze wakeup (check every 60 seconds)
// ============================================================

setInterval(() => {
  try {
    db.wakeSnoozedEmails();
  } catch (e) {
    // Silently handle snooze check errors
  }
}, 60000);

// ============================================================
// Start Server
// ============================================================

db.init();

// Clean expired sessions periodically
setInterval(() => {
  try { db.cleanExpiredSessions(); } catch (e) { /* */ }
}, 3600000); // every hour

// Async boot: initialize vault, then start server
(async () => {
  // Initialize vault connection (non-blocking — falls back to env vars)
  await vault.initVault(
    process.env.VAULT_URL,
    process.env.VAULT_PIN,
    process.env.VAULT_TOKEN
  );

  // Bind to 0.0.0.0 for network access (mobile on same WiFi + deployment)
  const HOST = process.env.HOST || "0.0.0.0";
  app.listen(PORT, HOST, () => {
    console.log(`Mx server running on http://${HOST}:${PORT}`);
    console.log(`  Vault: ${vault.isAvailable() ? "connected" : "env-var fallback"}`);
    if (HOST === "0.0.0.0") {
      const os = require("os");
      const nets = os.networkInterfaces();
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          if (net.family === "IPv4" && !net.internal) {
            console.log(`  Mobile access: http://${net.address}:${PORT}`);
          }
        }
      }
    }
  });
})();
