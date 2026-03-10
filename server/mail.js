// ============================================================
// Mx — Email Sync Layer (IMAP + SMTP)
// Zoho Business, Zoho Website, Gmail
// Vault-aware: reads credentials from vault with env var fallback
// ============================================================

const Imap = require("imap");
const { simpleParser } = require("mailparser");
const nodemailer = require("nodemailer");
const { cred } = require("./vault");

// ---------- Account Configuration ----------
async function getAccounts() {
  const accounts = [];

  const zohoBizUser = await cred("mx-zoho-biz-user", "ZOHO_BIZ_USER");
  if (zohoBizUser) {
    accounts.push({
      id: "zoho-biz",
      name: "Zoho Business",
      email: zohoBizUser,
      color: "oklch(0.7162 0.1597 290.3962)",
      type: "imap",
    });
  }

  const zohoWebUser = await cred("mx-zoho-web-user", "ZOHO_WEB_USER");
  if (zohoWebUser) {
    accounts.push({
      id: "zoho-web",
      name: "Zoho Website",
      email: zohoWebUser,
      color: "oklch(0.7482 0.1235 244.7492)",
      type: "imap",
    });
  }

  const gmailUser = await cred("mx-gmail-user", "GMAIL_USER");
  if (gmailUser) {
    accounts.push({
      id: "gmail",
      name: "Gmail Personal",
      email: gmailUser,
      color: "oklch(0.6861 0.2061 14.9941)",
      type: "gmail",
    });
  }

  return accounts;
}

async function getAddress(accountId) {
  const map = {
    "zoho-biz": ["mx-zoho-biz-user", "ZOHO_BIZ_USER"],
    "zoho-web": ["mx-zoho-web-user", "ZOHO_WEB_USER"],
    gmail: ["mx-gmail-user", "GMAIL_USER"],
  };
  const pair = map[accountId];
  if (!pair) return "";
  return (await cred(pair[0], pair[1])) || "";
}

// ---------- IMAP Connection Helpers ----------
async function createImapConnection(accountId) {
  let config;

  if (accountId === "zoho-biz") {
    const user = await cred("mx-zoho-biz-user", "ZOHO_BIZ_USER");
    const password = await cred("mx-zoho-biz-pass", "ZOHO_BIZ_PASS");
    const host = (await cred("mx-zoho-biz-host", "ZOHO_BIZ_HOST")) || "imap.zoho.com";
    const port = parseInt((await cred("mx-zoho-biz-port", "ZOHO_BIZ_PORT")) || "993");
    if (!user) return null;
    config = { user, password, host, port, tls: true, tlsOptions: { rejectUnauthorized: false } };
  } else if (accountId === "zoho-web") {
    const user = await cred("mx-zoho-web-user", "ZOHO_WEB_USER");
    const password = await cred("mx-zoho-web-pass", "ZOHO_WEB_PASS");
    const host = (await cred("mx-zoho-web-host", "ZOHO_WEB_HOST")) || "imap.zoho.com";
    const port = parseInt((await cred("mx-zoho-web-port", "ZOHO_WEB_PORT")) || "993");
    if (!user) return null;
    config = { user, password, host, port, tls: true, tlsOptions: { rejectUnauthorized: false } };
  } else if (accountId === "gmail") {
    const user = await cred("mx-gmail-user", "GMAIL_USER");
    const password = await cred("mx-gmail-pass", "GMAIL_PASS");
    if (!user) return null;
    config = { user, password, host: "imap.gmail.com", port: 993, tls: true, tlsOptions: { rejectUnauthorized: false } };
  } else {
    return null;
  }

  return new Imap(config);
}

// ---------- Sync Emails via IMAP ----------
function syncAccount(accountId, db) {
  return new Promise(async (resolve, reject) => {
    let imap;
    try {
      imap = await createImapConnection(accountId);
    } catch (err) {
      return resolve({ account: accountId, synced: 0, error: err.message });
    }

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
  const accounts = await getAccounts();
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
async function createSmtpTransport(accountId) {
  let config;

  if (accountId === "zoho-biz") {
    const host = (await cred("mx-zoho-biz-smtp-host", "ZOHO_BIZ_SMTP_HOST")) || "smtp.zoho.com";
    const port = parseInt((await cred("mx-zoho-biz-smtp-port", "ZOHO_BIZ_SMTP_PORT")) || "465");
    const user = await cred("mx-zoho-biz-user", "ZOHO_BIZ_USER");
    const pass = await cred("mx-zoho-biz-pass", "ZOHO_BIZ_PASS");
    config = { host, port, secure: true, auth: { user, pass } };
  } else if (accountId === "zoho-web") {
    const host = (await cred("mx-zoho-web-smtp-host", "ZOHO_WEB_SMTP_HOST")) || "smtp.zoho.com";
    const port = parseInt((await cred("mx-zoho-web-smtp-port", "ZOHO_WEB_SMTP_PORT")) || "465");
    const user = await cred("mx-zoho-web-user", "ZOHO_WEB_USER");
    const pass = await cred("mx-zoho-web-pass", "ZOHO_WEB_PASS");
    config = { host, port, secure: true, auth: { user, pass } };
  } else if (accountId === "gmail") {
    const user = await cred("mx-gmail-user", "GMAIL_USER");
    const pass = await cred("mx-gmail-pass", "GMAIL_PASS");
    config = { host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } };
  } else {
    throw new Error(`Unknown account: ${accountId}`);
  }

  return nodemailer.createTransport(config);
}

async function sendEmail(accountId, { to, subject, body, attachments }) {
  const transport = await createSmtpTransport(accountId);
  const from = await getAddress(accountId);

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
