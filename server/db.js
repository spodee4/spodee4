// ============================================================
// Mx — Database Layer (SQLite via better-sqlite3)
// ============================================================

const path = require("path");
let db;

function getDb() {
  if (!db) {
    const Database = require("better-sqlite3");
    db = new Database(path.join(__dirname, "..", "mx.db"));
    db.pragma("journal_mode = WAL");
  }
  return db;
}

function init() {
  const d = getDb();

  d.exec(`
    CREATE TABLE IF NOT EXISTS emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT UNIQUE,
      from_name TEXT,
      from_address TEXT,
      to_address TEXT,
      subject TEXT,
      body TEXT,
      html TEXT,
      date TEXT DEFAULT (datetime('now')),
      read INTEGER DEFAULT 0,
      starred INTEGER DEFAULT 0,
      folder TEXT DEFAULT 'inbox',
      account TEXT,
      category TEXT,
      ai_score INTEGER,
      snoozed_until TEXT,
      has_attachments INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_id INTEGER,
      filename TEXT,
      content_type TEXT,
      size INTEGER,
      path TEXT,
      FOREIGN KEY (email_id) REFERENCES emails(id)
    );

    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      subject TEXT,
      body TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vip_contacts (
      email TEXT PRIMARY KEY,
      name TEXT,
      added_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_id INTEGER,
      title TEXT,
      date TEXT,
      time TEXT,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (email_id) REFERENCES emails(id)
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_id INTEGER,
      remind_at TEXT,
      message TEXT,
      completed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (email_id) REFERENCES emails(id)
    );

    CREATE TABLE IF NOT EXISTS ai_preferences (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_emails_folder ON emails(folder);
    CREATE INDEX IF NOT EXISTS idx_emails_account ON emails(account);
    CREATE INDEX IF NOT EXISTS idx_emails_category ON emails(category);
    CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date);
  `);

  // Insert default templates if none exist
  const count = d.prepare("SELECT COUNT(*) as c FROM templates").get().c;
  if (count === 0) {
    const insert = d.prepare(
      "INSERT INTO templates (name, subject, body) VALUES (?, ?, ?)"
    );
    insert.run("Meeting Follow-up", "Follow-up: {{subject}}", "Hi {{name}},\n\nThank you for taking the time to meet today. Here are the key takeaways:\n\n- {{point1}}\n- {{point2}}\n\nPlease let me know if I missed anything.\n\nBest regards");
    insert.run("Introduction", "Introduction: {{your_name}} <> {{their_name}}", "Hi {{name}},\n\nI wanted to introduce myself. I'm {{your_name}} and I {{context}}.\n\nI'd love to connect and learn more about {{topic}}.\n\nLooking forward to hearing from you.\n\nBest");
    insert.run("Thank You", "Thank you!", "Hi {{name}},\n\nJust wanted to send a quick thank you for {{reason}}. I really appreciate it.\n\nBest");
    insert.run("Quick Reply", "", "Thanks for the update! I'll take a look and get back to you shortly.");
    insert.run("Polite Decline", "Re: {{subject}}", "Hi {{name}},\n\nThank you for thinking of me. Unfortunately, I'm not able to {{action}} at this time.\n\nI appreciate the offer and wish you the best.\n\nKind regards");
  }

  console.log("Database initialized");
}

function getEmails({ folder, account, category, search, limit, offset }) {
  const d = getDb();
  let sql = "SELECT * FROM emails WHERE folder = ?";
  const params = [folder];

  if (account && account !== "all") {
    sql += " AND account = ?";
    params.push(account);
  }
  if (category && category !== "all") {
    sql += " AND category = ?";
    params.push(category);
  }
  if (search) {
    sql += " AND (subject LIKE ? OR body LIKE ? OR from_name LIKE ? OR from_address LIKE ?)";
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }

  sql += " ORDER BY date DESC LIMIT ? OFFSET ?";
  params.push(limit || 50, offset || 0);

  const emails = d.prepare(sql).all(...params);

  // Attach VIP status
  const vips = new Set(d.prepare("SELECT email FROM vip_contacts").all().map(r => r.email));
  return emails.map(e => ({ ...e, is_vip: vips.has(e.from_address) }));
}

function getEmail(id) {
  const d = getDb();
  const email = d.prepare("SELECT * FROM emails WHERE id = ?").get(id);
  if (email) {
    email.attachments = d.prepare("SELECT * FROM attachments WHERE email_id = ?").all(id);
    const vip = d.prepare("SELECT 1 FROM vip_contacts WHERE email = ?").get(email.from_address);
    email.is_vip = !!vip;
  }
  return email;
}

function insertEmail(data) {
  const d = getDb();
  const stmt = d.prepare(`
    INSERT OR IGNORE INTO emails (message_id, from_name, from_address, to_address, subject, body, html, date, read, starred, folder, account, category, ai_score, has_attachments)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(
    data.message_id || `mx-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    data.from_name || "",
    data.from_address || "",
    data.to || "",
    data.subject || "(No subject)",
    data.body || "",
    data.html || "",
    data.date || new Date().toISOString(),
    data.read ? 1 : 0,
    data.starred ? 1 : 0,
    data.folder || "inbox",
    data.account || null,
    data.category || null,
    data.ai_score || null,
    data.has_attachments ? 1 : 0
  );
}

function updateEmail(id, updates) {
  const d = getDb();
  const fields = Object.keys(updates);
  const sql = `UPDATE emails SET ${fields.map(f => `${f} = ?`).join(", ")} WHERE id = ?`;
  d.prepare(sql).run(...fields.map(f => updates[f]), id);
}

function getEmailCount() {
  return getDb().prepare("SELECT COUNT(*) as c FROM emails WHERE folder = 'inbox'").get().c;
}

function getUnreadCount() {
  return getDb().prepare("SELECT COUNT(*) as c FROM emails WHERE folder = 'inbox' AND read = 0").get().c;
}

function getCategoryCounts() {
  return getDb().prepare(
    "SELECT category, COUNT(*) as count FROM emails WHERE folder = 'inbox' AND category IS NOT NULL GROUP BY category"
  ).all();
}

function setVipContact(email, isVip) {
  const d = getDb();
  if (isVip) {
    d.prepare("INSERT OR REPLACE INTO vip_contacts (email) VALUES (?)").run(email);
  } else {
    d.prepare("DELETE FROM vip_contacts WHERE email = ?").run(email);
  }
}

function getVipContacts() {
  return getDb().prepare("SELECT * FROM vip_contacts").all();
}

function getTemplates() {
  return getDb().prepare("SELECT * FROM templates ORDER BY name").all();
}

function insertTemplate(data) {
  getDb().prepare("INSERT INTO templates (name, subject, body) VALUES (?, ?, ?)").run(data.name, data.subject, data.body);
}

function wakeSnoozedEmails() {
  const d = getDb();
  const now = new Date().toISOString();
  d.prepare("UPDATE emails SET folder = 'inbox', snoozed_until = NULL WHERE folder = 'snoozed' AND snoozed_until <= ?").run(now);
}

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
};
