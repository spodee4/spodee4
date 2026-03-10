// ============================================================
// Mx — Email Sync Layer (IMAP + SMTP)
// Zoho Business, Zoho Website, Gmail
// ============================================================

const Imap = require("imap");
const { simpleParser } = require("mailparser");
const nodemailer = require("nodemailer");

// ---------- Account Configuration ----------
function getAccounts() {
  const accounts = [];

  if (process.env.ZOHO_BIZ_USER) {
    accounts.push({
      id: "zoho-biz",
      name: "Zoho Business",
      email: process.env.ZOHO_BIZ_USER,
      color: "oklch(0.7162 0.1597 290.3962)",
      type: "imap",
    });
  }

  if (process.env.ZOHO_WEB_USER) {
    accounts.push({
      id: "zoho-web",
      name: "Zoho Website",
      email: process.env.ZOHO_WEB_USER,
      color: "oklch(0.7482 0.1235 244.7492)",
      type: "imap",
    });
  }

  if (process.env.GMAIL_USER) {
    accounts.push({
      id: "gmail",
      name: "Gmail Personal",
      email: process.env.GMAIL_USER,
      color: "oklch(0.6861 0.2061 14.9941)",
      type: "gmail",
    });
  }

  return accounts;
}

function getAddress(accountId) {
  const accounts = {
    "zoho-biz": process.env.ZOHO_BIZ_USER,
    "zoho-web": process.env.ZOHO_WEB_USER,
    gmail: process.env.GMAIL_USER,
  };
  return accounts[accountId] || "";
}

// ---------- IMAP Connection Helpers ----------
function createImapConnection(accountId) {
  const configs = {
    "zoho-biz": {
      user: process.env.ZOHO_BIZ_USER,
      password: process.env.ZOHO_BIZ_PASS,
      host: process.env.ZOHO_BIZ_HOST || "imap.zoho.com",
      port: parseInt(process.env.ZOHO_BIZ_PORT) || 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    },
    "zoho-web": {
      user: process.env.ZOHO_WEB_USER,
      password: process.env.ZOHO_WEB_PASS,
      host: process.env.ZOHO_WEB_HOST || "imap.zoho.com",
      port: parseInt(process.env.ZOHO_WEB_PORT) || 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    },
    gmail: {
      user: process.env.GMAIL_USER,
      password: process.env.GMAIL_PASS,
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      // For OAuth2, use xoauth2 token instead of password
    },
  };

  const config = configs[accountId];
  if (!config || !config.user) return null;
  return new Imap(config);
}

// ---------- Sync Emails via IMAP ----------
function syncAccount(accountId, db) {
  return new Promise((resolve, reject) => {
    const imap = createImapConnection(accountId);
    if (!imap) {
      return resolve({ account: accountId, synced: 0, error: "Not configured" });
    }

    let synced = 0;

    imap.once("ready", () => {
      imap.openBox("INBOX", true, (err, box) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        // Fetch last 50 emails
        const total = box.messages.total;
        const from = Math.max(1, total - 49);
        const f = imap.seq.fetch(`${from}:*`, {
          bodies: "",
          struct: true,
        });

        f.on("message", (msg) => {
          msg.on("body", (stream) => {
            simpleParser(stream, (err, parsed) => {
              if (err) return;

              const fromAddr = parsed.from?.value?.[0]?.address || "";
              const fromName = parsed.from?.value?.[0]?.name || fromAddr;

              db.insertEmail({
                message_id: parsed.messageId,
                from_name: fromName,
                from_address: fromAddr,
                to: parsed.to?.text || "",
                subject: parsed.subject || "(No subject)",
                body: parsed.text || "",
                html: parsed.html || "",
                date: parsed.date?.toISOString() || new Date().toISOString(),
                read: false,
                folder: "inbox",
                account: accountId,
                has_attachments: (parsed.attachments?.length || 0) > 0,
              });
              synced++;
            });
          });
        });

        f.once("error", (err) => {
          imap.end();
          reject(err);
        });

        f.once("end", () => {
          imap.end();
          resolve({ account: accountId, synced });
        });
      });
    });

    imap.once("error", (err) => {
      reject(err);
    });

    imap.connect();
  });
}

async function syncAll(db) {
  const accounts = getAccounts();
  const results = [];

  for (const account of accounts) {
    try {
      const result = await syncAccount(account.id, db);
      results.push(result);
    } catch (err) {
      results.push({ account: account.id, synced: 0, error: err.message });
    }
  }

  return results;
}

// ---------- Send Email via SMTP ----------
function createSmtpTransport(accountId) {
  const configs = {
    "zoho-biz": {
      host: process.env.ZOHO_BIZ_SMTP_HOST || "smtp.zoho.com",
      port: parseInt(process.env.ZOHO_BIZ_SMTP_PORT) || 465,
      secure: true,
      auth: {
        user: process.env.ZOHO_BIZ_USER,
        pass: process.env.ZOHO_BIZ_PASS,
      },
    },
    "zoho-web": {
      host: process.env.ZOHO_WEB_SMTP_HOST || "smtp.zoho.com",
      port: parseInt(process.env.ZOHO_WEB_SMTP_PORT) || 465,
      secure: true,
      auth: {
        user: process.env.ZOHO_WEB_USER,
        pass: process.env.ZOHO_WEB_PASS,
      },
    },
    gmail: {
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    },
  };

  return nodemailer.createTransport(configs[accountId]);
}

async function sendEmail(accountId, { to, subject, body, attachments }) {
  const transport = createSmtpTransport(accountId);
  const from = getAddress(accountId);

  const mailOptions = {
    from,
    to,
    subject: subject || "(No subject)",
    text: body,
    attachments: attachments || [],
  };

  return transport.sendMail(mailOptions);
}

module.exports = {
  getAccounts,
  getAddress,
  syncAccount,
  syncAll,
  sendEmail,
};
