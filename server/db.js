// ============================================================
// Massage Booking — SQLite Database
// ============================================================
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'booking.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ──────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name    TEXT NOT NULL,
    last_name     TEXT NOT NULL,
    email         TEXT,
    phone         TEXT,
    notes         TEXT DEFAULT '',
    intake_form   TEXT DEFAULT '{}',
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS services (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    description   TEXT DEFAULT '',
    duration_min  INTEGER NOT NULL DEFAULT 60,
    price_cents   INTEGER NOT NULL DEFAULT 0,
    color         TEXT DEFAULT '#6c5ce7',
    active        INTEGER DEFAULT 1,
    sort_order    INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS availability (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    day_of_week   INTEGER NOT NULL,
    start_time    TEXT NOT NULL,
    end_time      TEXT NOT NULL,
    active        INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS blocked_dates (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    date          TEXT NOT NULL UNIQUE,
    reason        TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id     INTEGER NOT NULL REFERENCES clients(id),
    service_id    INTEGER NOT NULL REFERENCES services(id),
    date          TEXT NOT NULL,
    start_time    TEXT NOT NULL,
    end_time      TEXT NOT NULL,
    status        TEXT DEFAULT 'confirmed',
    notes         TEXT DEFAULT '',
    paid          INTEGER DEFAULT 0,
    payment_method TEXT DEFAULT '',
    tip_cents     INTEGER DEFAULT 0,
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name  TEXT DEFAULT '',
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token         TEXT PRIMARY KEY,
    user_id       INTEGER REFERENCES users(id),
    expires_at    TEXT NOT NULL,
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key           TEXT PRIMARY KEY,
    value         TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_appt_date ON appointments(date);
  CREATE INDEX IF NOT EXISTS idx_appt_client ON appointments(client_id);
  CREATE INDEX IF NOT EXISTS idx_appt_status ON appointments(status);
  CREATE INDEX IF NOT EXISTS idx_client_email ON clients(email);
  CREATE INDEX IF NOT EXISTS idx_client_phone ON clients(phone);
  CREATE INDEX IF NOT EXISTS idx_sessions_exp ON sessions(expires_at);
`);

// ── Seed default services ───────────────────────────────────
const svcCount = db.prepare('SELECT COUNT(*) as c FROM services').get();
if (svcCount.c === 0) {
  const ins = db.prepare('INSERT INTO services (name, description, duration_min, price_cents, color, sort_order) VALUES (?,?,?,?,?,?)');
  ins.run('Swedish Massage',     'Classic relaxation massage',              60, 8000,  '#6c5ce7', 1);
  ins.run('Deep Tissue',         'Focused pressure on deep muscle layers',  60, 9500,  '#e17055', 2);
  ins.run('Sports Massage',      'Pre/post athletic performance',           60, 9500,  '#00b894', 3);
  ins.run('Hot Stone Massage',   'Heated basalt stones for deep relaxation',75, 11000, '#fdcb6e', 4);
  ins.run('30-Min Focused',      'Quick targeted session',                  30, 5000,  '#74b9ff', 5);
  ins.run('90-Min Full Body',    'Extended full body session',              90, 12000, '#a29bfe', 6);
}

// ── Seed default availability ───────────────────────────────
const availCount = db.prepare('SELECT COUNT(*) as c FROM availability').get();
if (availCount.c === 0) {
  const ins = db.prepare('INSERT INTO availability (day_of_week, start_time, end_time) VALUES (?,?,?)');
  for (let d = 1; d <= 5; d++) ins.run(d, '09:00', '17:00');
  ins.run(6, '10:00', '14:00');
}

module.exports = db;
