const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "..", "mx.db");
let db;

function init() {
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT UNIQUE,
      thread_id TEXT,
      from_name TEXT,
      from_address TEXT,
      to_address TEXT,
      cc TEXT,
      bcc TEXT,
      in_reply_to TEXT,
      references_header TEXT,
      subject TEXT,
      body TEXT,
      html TEXT,
      date TEXT,
      read INTEGER DEFAULT 0,
      starred INTEGER DEFAULT 0,
      folder TEXT DEFAULT 'inbox',
      account TEXT,
      category TEXT,
      ai_score INTEGER,
      priority TEXT DEFAULT 'normal',
      snoozed_until TEXT,
      has_attachments INTEGER DEFAULT 0,
      ai_summary TEXT,
      ai_category TEXT,
      ai_priority TEXT,
      ai_sentiment TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON emails(thread_id);
    CREATE INDEX IF NOT EXISTS idx_emails_from ON emails(from_address);
    CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date);
    CREATE INDEX IF NOT EXISTS idx_emails_category ON emails(category);
    CREATE INDEX IF NOT EXISTS idx_emails_folder ON emails(folder);
    CREATE INDEX IF NOT EXISTS idx_emails_account ON emails(account);
    CREATE INDEX IF NOT EXISTS idx_emails_snoozed ON emails(snoozed_until);
    CREATE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id);

    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_id INTEGER,
      filename TEXT,
      content_type TEXT,
      size INTEGER,
      path TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      subject TEXT,
      body TEXT,
      category TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vip_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      priority TEXT DEFAULT 'high',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT,
      location TEXT,
      meeting_url TEXT,
      reminder_minutes INTEGER DEFAULT 15,
      status TEXT DEFAULT 'confirmed',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_calendar_start ON calendar_events(start_time);
    CREATE INDEX IF NOT EXISTS idx_calendar_status ON calendar_events(status);

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_id INTEGER,
      remind_at TEXT NOT NULL,
      message TEXT,
      completed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS thread_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id TEXT UNIQUE NOT NULL,
      summary TEXT,
      participants TEXT,
      message_count INTEGER DEFAULT 0,
      last_activity TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_thread_summaries_thread ON thread_summaries(thread_id);

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_id INTEGER,
      project_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'normal',
      due_date TEXT,
      assigned_to TEXT,
      created_from TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE SET NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active',
      priority TEXT DEFAULT 'normal',
      deadline TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

    CREATE TABLE IF NOT EXISTS project_emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      email_id INTEGER NOT NULL,
      linked_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
      UNIQUE(project_id, email_id)
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      organization TEXT,
      role TEXT,
      relationship TEXT DEFAULT 'unknown',
      last_contacted TEXT,
      contact_count INTEGER DEFAULT 0,
      notes TEXT,
      tags TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
    CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(organization);
    CREATE INDEX IF NOT EXISTS idx_contacts_last ON contacts(last_contacted);

    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_id INTEGER,
      project_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      decided_by TEXT,
      decided_at TEXT DEFAULT (datetime('now')),
      context TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE SET NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_decisions_project ON decisions(project_id);

    CREATE TABLE IF NOT EXISTS commitments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_id INTEGER,
      from_contact TEXT,
      to_contact TEXT,
      description TEXT NOT NULL,
      due_date TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_commitments_status ON commitments(status);
    CREATE INDEX IF NOT EXISTS idx_commitments_due ON commitments(due_date);

    CREATE TABLE IF NOT EXISTS ai_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      category TEXT DEFAULT 'general',
      importance INTEGER DEFAULT 5,
      expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_memory_key ON ai_memory(key);
    CREATE INDEX IF NOT EXISTS idx_memory_category ON ai_memory(category);

    CREATE TABLE IF NOT EXISTS briefings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      content TEXT,
      type TEXT DEFAULT 'daily',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_briefings_date ON briefings(date);

    CREATE TABLE IF NOT EXISTS scheduling_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      rule_type TEXT NOT NULL,
      config TEXT,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      endpoint TEXT UNIQUE NOT NULL,
      keys_p256dh TEXT,
      keys_auth TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  return db;
}

// ─── Email Functions ───────────────────────────────────────────────

function getEmails({ folder, account, category, read, starred, search, sort, order, limit, offset } = {}) {
  let sql = "SELECT * FROM emails WHERE 1=1";
  const params = [];

  if (folder) { sql += " AND folder = ?"; params.push(folder); }
  if (account) { sql += " AND account = ?"; params.push(account); }
  if (category) { sql += " AND category = ?"; params.push(category); }
  if (read !== undefined) { sql += " AND read = ?"; params.push(read ? 1 : 0); }
  if (starred !== undefined) { sql += " AND starred = ?"; params.push(starred ? 1 : 0); }
  if (search) {
    sql += " AND (subject LIKE ? OR body LIKE ? OR from_address LIKE ? OR from_name LIKE ?)";
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  sql += ` ORDER BY ${sort || "date"} ${order || "DESC"}`;
  if (limit) { sql += " LIMIT ?"; params.push(limit); }
  if (offset) { sql += " OFFSET ?"; params.push(offset); }

  return db.prepare(sql).all(...params);
}

function getEmail(id) {
  return db.prepare("SELECT * FROM emails WHERE id = ?").get(id);
}

function insertEmail(email) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO emails (message_id, thread_id, from_name, from_address, to_address, cc, bcc, in_reply_to, references_header, subject, body, html, date, read, starred, folder, account, category, ai_score, priority, has_attachments, ai_summary, ai_category, ai_priority, ai_sentiment)
    VALUES (@message_id, @thread_id, @from_name, @from_address, @to_address, @cc, @bcc, @in_reply_to, @references_header, @subject, @body, @html, @date, @read, @starred, @folder, @account, @category, @ai_score, @priority, @has_attachments, @ai_summary, @ai_category, @ai_priority, @ai_sentiment)
  `);
  const result = stmt.run({
    message_id: email.message_id || null,
    thread_id: email.thread_id || null,
    from_name: email.from_name || null,
    from_address: email.from_address || null,
    to_address: email.to_address || null,
    cc: email.cc || null,
    bcc: email.bcc || null,
    in_reply_to: email.in_reply_to || null,
    references_header: email.references_header || null,
    subject: email.subject || null,
    body: email.body || null,
    html: email.html || null,
    date: email.date || new Date().toISOString(),
    read: email.read ? 1 : 0,
    starred: email.starred ? 1 : 0,
    folder: email.folder || "inbox",
    account: email.account || null,
    category: email.category || null,
    ai_score: email.ai_score || null,
    priority: email.priority || "normal",
    has_attachments: email.has_attachments ? 1 : 0,
    ai_summary: email.ai_summary || null,
    ai_category: email.ai_category || null,
    ai_priority: email.ai_priority || null,
    ai_sentiment: email.ai_sentiment || null,
  });
  return result.lastInsertRowid;
}

function updateEmail(id, updates) {
  const fields = [];
  const params = [];
  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    params.push(value);
  }
  fields.push("updated_at = datetime('now')");
  params.push(id);
  db.prepare(`UPDATE emails SET ${fields.join(", ")} WHERE id = ?`).run(...params);
}

function getEmailCount(category) {
  if (category) {
    return db.prepare("SELECT COUNT(*) as count FROM emails WHERE category = ?").get(category).count;
  }
  return db.prepare("SELECT COUNT(*) as count FROM emails").get().count;
}

function getUnreadCount() {
  return db.prepare("SELECT COUNT(*) as count FROM emails WHERE read = 0").get().count;
}

function getCategoryCounts() {
  return db.prepare("SELECT category, COUNT(*) as count FROM emails GROUP BY category").all();
}

function wakeSnoozedEmails() {
  const now = new Date().toISOString();
  const result = db.prepare(`
    UPDATE emails SET category = 'inbox', snoozed_until = NULL, updated_at = datetime('now')
    WHERE snoozed_until IS NOT NULL AND snoozed_until <= ?
  `).run(now);
  return result.changes;
}

// ─── VIP & Template Functions ──────────────────────────────────────

function setVipContact(email, isVip, name, priority, notes) {
  if (!isVip) {
    return db.prepare("DELETE FROM vip_contacts WHERE email = ?").run(email);
  }
  return db.prepare(`
    INSERT INTO vip_contacts (email, name, priority, notes)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET name = excluded.name, priority = excluded.priority, notes = excluded.notes
  `).run(email, name || null, priority || "high", notes || null);
}

function getVipContacts() {
  return db.prepare("SELECT * FROM vip_contacts ORDER BY created_at DESC").all();
}

function getTemplates() {
  return db.prepare("SELECT * FROM templates ORDER BY name").all();
}

function insertTemplate(template) {
  const result = db.prepare(`
    INSERT INTO templates (name, subject, body, category)
    VALUES (@name, @subject, @body, @category)
  `).run({
    name: template.name,
    subject: template.subject || null,
    body: template.body || null,
    category: template.category || null,
  });
  return result.lastInsertRowid;
}

// ─── Thread Functions ──────────────────────────────────────────────

function getThread(threadId) {
  return db.prepare("SELECT * FROM emails WHERE thread_id = ? ORDER BY date ASC").all(threadId);
}

function getThreadSummary(threadId) {
  return db.prepare("SELECT * FROM thread_summaries WHERE thread_id = ?").get(threadId);
}

function upsertThreadSummary(threadId, summary, participants, messageCount, lastActivity, status) {
  return db.prepare(`
    INSERT INTO thread_summaries (thread_id, summary, participants, message_count, last_activity, status)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(thread_id) DO UPDATE SET
      summary = excluded.summary,
      participants = excluded.participants,
      message_count = excluded.message_count,
      last_activity = excluded.last_activity,
      status = excluded.status,
      updated_at = datetime('now')
  `).run(threadId, summary || null, participants || null, messageCount || 0, lastActivity || null, status || "active");
}

// ─── Task Functions ────────────────────────────────────────────────

function getTasks({ status, projectId, priority, limit, offset } = {}) {
  let sql = "SELECT * FROM tasks WHERE 1=1";
  const params = [];
  if (status) { sql += " AND status = ?"; params.push(status); }
  if (projectId) { sql += " AND project_id = ?"; params.push(projectId); }
  if (priority) { sql += " AND priority = ?"; params.push(priority); }
  sql += " ORDER BY due_date ASC, priority DESC";
  if (limit) { sql += " LIMIT ?"; params.push(limit); }
  if (offset) { sql += " OFFSET ?"; params.push(offset); }
  return db.prepare(sql).all(...params);
}

function insertTask(task) {
  const result = db.prepare(`
    INSERT INTO tasks (email_id, project_id, title, description, status, priority, due_date, assigned_to, created_from)
    VALUES (@email_id, @project_id, @title, @description, @status, @priority, @due_date, @assigned_to, @created_from)
  `).run({
    email_id: task.email_id || null,
    project_id: task.project_id || null,
    title: task.title,
    description: task.description || null,
    status: task.status || "pending",
    priority: task.priority || "normal",
    due_date: task.due_date || null,
    assigned_to: task.assigned_to || null,
    created_from: task.created_from || null,
  });
  return result.lastInsertRowid;
}

function updateTask(id, updates) {
  const fields = [];
  const params = [];
  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    params.push(value);
  }
  fields.push("updated_at = datetime('now')");
  params.push(id);
  db.prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`).run(...params);
}

function getTasksDueToday() {
  const today = new Date().toISOString().split("T")[0];
  return db.prepare("SELECT * FROM tasks WHERE due_date LIKE ? AND status != 'completed' ORDER BY priority DESC").all(`${today}%`);
}

// ─── Project Functions ─────────────────────────────────────────────

function getProjects({ status } = {}) {
  let sql = "SELECT * FROM projects WHERE 1=1";
  const params = [];
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY updated_at DESC";
  return db.prepare(sql).all(...params);
}

function insertProject(project) {
  const result = db.prepare(`
    INSERT INTO projects (name, description, status, priority, deadline)
    VALUES (@name, @description, @status, @priority, @deadline)
  `).run({
    name: project.name,
    description: project.description || null,
    status: project.status || "active",
    priority: project.priority || "normal",
    deadline: project.deadline || null,
  });
  return result.lastInsertRowid;
}

function updateProject(id, updates) {
  const fields = [];
  const params = [];
  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    params.push(value);
  }
  fields.push("updated_at = datetime('now')");
  params.push(id);
  db.prepare(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?`).run(...params);
}

function linkEmailToProject(projectId, emailId) {
  return db.prepare(`
    INSERT OR IGNORE INTO project_emails (project_id, email_id) VALUES (?, ?)
  `).run(projectId, emailId);
}

function getProjectEmails(projectId) {
  return db.prepare(`
    SELECT e.* FROM emails e
    JOIN project_emails pe ON pe.email_id = e.id
    WHERE pe.project_id = ?
    ORDER BY e.date DESC
  `).all(projectId);
}

// ─── Contact Functions ─────────────────────────────────────────────

function getContact(email) {
  return db.prepare("SELECT * FROM contacts WHERE email = ?").get(email);
}

function getContacts({ organization, relationship, limit, offset } = {}) {
  let sql = "SELECT * FROM contacts WHERE 1=1";
  const params = [];
  if (organization) { sql += " AND organization = ?"; params.push(organization); }
  if (relationship) { sql += " AND relationship = ?"; params.push(relationship); }
  sql += " ORDER BY last_contacted DESC";
  if (limit) { sql += " LIMIT ?"; params.push(limit); }
  if (offset) { sql += " OFFSET ?"; params.push(offset); }
  return db.prepare(sql).all(...params);
}

function upsertContact(contact) {
  return db.prepare(`
    INSERT INTO contacts (email, name, organization, role, relationship, last_contacted, contact_count, notes, tags)
    VALUES (@email, @name, @organization, @role, @relationship, @last_contacted, @contact_count, @notes, @tags)
    ON CONFLICT(email) DO UPDATE SET
      name = COALESCE(excluded.name, contacts.name),
      organization = COALESCE(excluded.organization, contacts.organization),
      role = COALESCE(excluded.role, contacts.role),
      relationship = COALESCE(excluded.relationship, contacts.relationship),
      last_contacted = COALESCE(excluded.last_contacted, contacts.last_contacted),
      contact_count = COALESCE(excluded.contact_count, contacts.contact_count),
      notes = COALESCE(excluded.notes, contacts.notes),
      tags = COALESCE(excluded.tags, contacts.tags),
      updated_at = datetime('now')
  `).run({
    email: contact.email,
    name: contact.name || null,
    organization: contact.organization || null,
    role: contact.role || null,
    relationship: contact.relationship || "unknown",
    last_contacted: contact.last_contacted || null,
    contact_count: contact.contact_count || 0,
    notes: contact.notes || null,
    tags: contact.tags || null,
  });
}

function updateContactFromEmail(emailAddress, date) {
  return db.prepare(`
    INSERT INTO contacts (email, last_contacted, contact_count)
    VALUES (?, ?, 1)
    ON CONFLICT(email) DO UPDATE SET
      last_contacted = MAX(COALESCE(contacts.last_contacted, ''), ?),
      contact_count = contacts.contact_count + 1,
      updated_at = datetime('now')
  `).run(emailAddress, date || new Date().toISOString(), date || new Date().toISOString());
}

function getStaleContacts(daysSinceContact) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (daysSinceContact || 30));
  return db.prepare(`
    SELECT * FROM contacts
    WHERE last_contacted < ? AND relationship != 'unknown'
    ORDER BY last_contacted ASC
  `).all(cutoff.toISOString());
}

// ─── Decision Functions ────────────────────────────────────────────

function insertDecision(decision) {
  const result = db.prepare(`
    INSERT INTO decisions (email_id, project_id, title, description, decided_by, decided_at, context)
    VALUES (@email_id, @project_id, @title, @description, @decided_by, @decided_at, @context)
  `).run({
    email_id: decision.email_id || null,
    project_id: decision.project_id || null,
    title: decision.title,
    description: decision.description || null,
    decided_by: decision.decided_by || null,
    decided_at: decision.decided_at || new Date().toISOString(),
    context: decision.context || null,
  });
  return result.lastInsertRowid;
}

function getDecisions({ projectId, limit } = {}) {
  let sql = "SELECT * FROM decisions WHERE 1=1";
  const params = [];
  if (projectId) { sql += " AND project_id = ?"; params.push(projectId); }
  sql += " ORDER BY decided_at DESC";
  if (limit) { sql += " LIMIT ?"; params.push(limit); }
  return db.prepare(sql).all(...params);
}

// ─── Commitment Functions ──────────────────────────────────────────

function insertCommitment(commitment) {
  const result = db.prepare(`
    INSERT INTO commitments (email_id, from_contact, to_contact, description, due_date, status)
    VALUES (@email_id, @from_contact, @to_contact, @description, @due_date, @status)
  `).run({
    email_id: commitment.email_id || null,
    from_contact: commitment.from_contact || null,
    to_contact: commitment.to_contact || null,
    description: commitment.description,
    due_date: commitment.due_date || null,
    status: commitment.status || "pending",
  });
  return result.lastInsertRowid;
}

function getCommitments({ status, limit } = {}) {
  let sql = "SELECT * FROM commitments WHERE 1=1";
  const params = [];
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY due_date ASC";
  if (limit) { sql += " LIMIT ?"; params.push(limit); }
  return db.prepare(sql).all(...params);
}

// ─── Calendar Functions ────────────────────────────────────────────

function getCalendarEvents({ startAfter, startBefore, status, limit } = {}) {
  let sql = "SELECT * FROM calendar_events WHERE 1=1";
  const params = [];
  if (startAfter) { sql += " AND start_time >= ?"; params.push(startAfter); }
  if (startBefore) { sql += " AND start_time <= ?"; params.push(startBefore); }
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY start_time ASC";
  if (limit) { sql += " LIMIT ?"; params.push(limit); }
  return db.prepare(sql).all(...params);
}

function insertCalendarEvent(event) {
  const result = db.prepare(`
    INSERT INTO calendar_events (email_id, title, description, start_time, end_time, location, meeting_url, reminder_minutes, status)
    VALUES (@email_id, @title, @description, @start_time, @end_time, @location, @meeting_url, @reminder_minutes, @status)
  `).run({
    email_id: event.email_id || null,
    title: event.title,
    description: event.description || null,
    start_time: event.start_time,
    end_time: event.end_time || null,
    location: event.location || null,
    meeting_url: event.meeting_url || null,
    reminder_minutes: event.reminder_minutes != null ? event.reminder_minutes : 15,
    status: event.status || "confirmed",
  });
  return result.lastInsertRowid;
}

function updateCalendarEvent(id, updates) {
  const fields = [];
  const params = [];
  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    params.push(value);
  }
  fields.push("updated_at = datetime('now')");
  params.push(id);
  db.prepare(`UPDATE calendar_events SET ${fields.join(", ")} WHERE id = ?`).run(...params);
}

function getTodayEvents() {
  const today = new Date().toISOString().split("T")[0];
  return db.prepare("SELECT * FROM calendar_events WHERE start_time LIKE ? AND status != 'cancelled' ORDER BY start_time ASC").all(`${today}%`);
}

// ─── Scheduling Rules Functions ────────────────────────────────────

function getSchedulingRules() {
  return db.prepare("SELECT * FROM scheduling_rules WHERE enabled = 1 ORDER BY name").all();
}

// ─── AI Memory Functions ───────────────────────────────────────────

function getMemory(key) {
  return db.prepare("SELECT * FROM ai_memory WHERE key = ?").get(key);
}

function getMemories({ category, limit } = {}) {
  let sql = "SELECT * FROM ai_memory WHERE (expires_at IS NULL OR expires_at > datetime('now'))";
  const params = [];
  if (category) { sql += " AND category = ?"; params.push(category); }
  sql += " ORDER BY importance DESC, updated_at DESC";
  if (limit) { sql += " LIMIT ?"; params.push(limit); }
  return db.prepare(sql).all(...params);
}

function upsertMemory(key, value, category, importance, expiresAt) {
  return db.prepare(`
    INSERT INTO ai_memory (key, value, category, importance, expires_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      category = excluded.category,
      importance = excluded.importance,
      expires_at = excluded.expires_at,
      updated_at = datetime('now')
  `).run(key, value, category || "general", importance != null ? importance : 5, expiresAt || null);
}

function searchMemory(query) {
  return db.prepare(`
    SELECT * FROM ai_memory
    WHERE (key LIKE ? OR value LIKE ? OR category LIKE ?)
      AND (expires_at IS NULL OR expires_at > datetime('now'))
    ORDER BY importance DESC
  `).all(`%${query}%`, `%${query}%`, `%${query}%`);
}

function deleteMemory(key) {
  return db.prepare("DELETE FROM ai_memory WHERE key = ?").run(key);
}

// ─── Briefing Functions ────────────────────────────────────────────

function getBriefing(date) {
  return db.prepare("SELECT * FROM briefings WHERE date = ?").get(date);
}

function upsertBriefing(date, content, type) {
  return db.prepare(`
    INSERT INTO briefings (date, content, type)
    VALUES (?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      content = excluded.content,
      type = excluded.type,
      updated_at = datetime('now')
  `).run(date, content, type || "daily");
}

// ─── Additional Helper Functions ────────────────────────────────────

function getEmailsByThread(threadId) {
  return db.prepare("SELECT * FROM emails WHERE thread_id = ? ORDER BY date ASC").all(threadId);
}

function getEmailsByContact(contactEmail) {
  return db.prepare("SELECT * FROM emails WHERE from_address = ? OR to_address LIKE ? ORDER BY date DESC LIMIT 50").all(contactEmail, `%${contactEmail}%`);
}

function getDecisionsByThread(threadId) {
  return db.prepare("SELECT * FROM decisions WHERE context = ? ORDER BY decided_at DESC").all(threadId);
}

function getCommitmentsByThread(threadId) {
  return db.prepare(`
    SELECT c.* FROM commitments c
    JOIN emails e ON c.email_id = e.id
    WHERE e.thread_id = ?
    ORDER BY c.due_date ASC
  `).all(threadId);
}

function getCalendarEventsToday() {
  const today = new Date().toISOString().split("T")[0];
  return db.prepare("SELECT * FROM calendar_events WHERE start_time LIKE ? AND status != 'cancelled' ORDER BY start_time ASC").all(`${today}%`);
}

function getTasksDueBy(date) {
  return db.prepare("SELECT * FROM tasks WHERE due_date <= ? AND status != 'completed' ORDER BY priority DESC, due_date ASC").all(date);
}

function updateContact(email, updates) {
  const contact = db.prepare("SELECT * FROM contacts WHERE email = ?").get(email);
  if (!contact) return;
  const fields = [];
  const params = [];
  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    params.push(value);
  }
  fields.push("updated_at = datetime('now')");
  params.push(email);
  db.prepare(`UPDATE contacts SET ${fields.join(", ")} WHERE email = ?`).run(...params);
}

function insertBriefing(briefing) {
  return upsertBriefing(briefing.date, typeof briefing.content === 'string' ? briefing.content : JSON.stringify(briefing.content), briefing.type || "daily");
}

function deleteBriefing(date) {
  return db.prepare("DELETE FROM briefings WHERE date = ?").run(date);
}

function insertMemory(memory) {
  return upsertMemory(memory.key, memory.value, memory.category || "general", memory.importance || 5, memory.expires_at || null);
}

function linkProjectEmail(projectId, emailId) {
  return linkEmailToProject(projectId, emailId);
}

// ─── Exports ───────────────────────────────────────────────────────

module.exports = {
  init,
  getEmails,
  getEmail,
  insertEmail,
  updateEmail,
  getEmailCount,
  getUnreadCount,
  getCategoryCounts,
  setVipContact,
  getVipContacts,
  getTemplates,
  insertTemplate,
  wakeSnoozedEmails,
  getThread,
  getThreadSummary,
  upsertThreadSummary,
  getTasks,
  insertTask,
  updateTask,
  getTasksDueToday,
  getProjects,
  insertProject,
  updateProject,
  linkEmailToProject,
  getProjectEmails,
  getContact,
  getContacts,
  upsertContact,
  updateContactFromEmail,
  getStaleContacts,
  insertDecision,
  getDecisions,
  insertCommitment,
  getCommitments,
  getCalendarEvents,
  insertCalendarEvent,
  updateCalendarEvent,
  getTodayEvents,
  getSchedulingRules,
  getMemory,
  getMemories,
  upsertMemory,
  searchMemory,
  deleteMemory,
  getBriefing,
  upsertBriefing,
  getEmailsByThread,
  getEmailsByContact,
  getDecisionsByThread,
  getCommitmentsByThread,
  getCalendarEventsToday,
  getTasksDueBy,
  updateContact,
  insertBriefing,
  deleteBriefing,
  insertMemory,
  linkProjectEmail,
  // Auth
  createUser,
  getUserByUsername,
  createSession,
  getSession,
  deleteSession,
  cleanExpiredSessions,
  // Push subscriptions
  savePushSubscription,
  getPushSubscriptions,
  deletePushSubscription,
};

// ─── Auth Functions ───────────────────────────────────────────────

function createUser(username, passwordHash, displayName) {
  const stmt = db.prepare("INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)");
  return stmt.run(username, passwordHash, displayName || username);
}

function getUserByUsername(username) {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username);
}

function createSession(token, userId, expiresAt) {
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, expiresAt);
}

function getSession(token) {
  return db.prepare("SELECT s.*, u.username, u.display_name FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime('now')").get(token);
}

function deleteSession(token) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

function cleanExpiredSessions() {
  db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
}

// ─── Push Subscription Functions ──────────────────────────────────

function savePushSubscription(userId, endpoint, p256dh, auth) {
  db.prepare("INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth) VALUES (?, ?, ?, ?)").run(userId, endpoint, p256dh, auth);
}

function getPushSubscriptions(userId) {
  if (userId) return db.prepare("SELECT * FROM push_subscriptions WHERE user_id = ?").all(userId);
  return db.prepare("SELECT * FROM push_subscriptions").all();
}

function deletePushSubscription(endpoint) {
  db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint);
}
