// ============================================================
// Mx — AI Layer (Claude API via Anthropic SDK)
// ============================================================

const Anthropic = require("@anthropic-ai/sdk");

let client;
function getClient() {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

const MODEL = "claude-sonnet-4-20250514";

// ---------- Triage / Categorize ----------
async function triageEmails(emails) {
  const c = getClient();
  const emailSummaries = emails.map((e) => ({
    id: e.id,
    from: `${e.from_name} <${e.from_address}>`,
    subject: e.subject,
    snippet: (e.body || "").substring(0, 300),
  }));

  const response = await c.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: `You are Mx, an AI email assistant. Categorize each email using the Dan Martel Email GPS system.

Categories:
- respond: Requires the user's personal reply (questions, requests for action, meeting invites)
- review: Needs to be read/acknowledged but no reply needed (reports, updates, PRs)
- waiting: Awaiting someone else's reply or a follow-up is needed
- receipts: Financial/billing emails, invoices, payment confirmations
- newsletter: Newsletters, digests, marketing emails (anything with unsubscribe)
- fyi: Informational, low priority, automated notifications

Also assign an importance score from 1-10 (10 = most urgent/important).

Respond with a JSON array: [{"id": number, "category": string, "score": number}]`,
    messages: [
      {
        role: "user",
        content: `Categorize these emails:\n${JSON.stringify(emailSummaries, null, 2)}`,
      },
    ],
  });

  try {
    const text = response.content[0].text;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    return [];
  }
}

// ---------- Draft Reply ----------
async function draftReply(email, tone) {
  const c = getClient();
  const response = await c.messages.create({
    model: MODEL,
    max_tokens: 1000,
    system: `You are Mx, an AI email assistant. Draft a reply to the email below. Tone: ${tone}. Keep it concise and natural. Do not include subject line, just the body.`,
    messages: [
      {
        role: "user",
        content: `From: ${email.from_name} <${email.from_address}>\nSubject: ${email.subject}\n\n${email.body}`,
      },
    ],
  });
  return response.content[0].text;
}

// ---------- Summarize ----------
async function summarize(email) {
  const c = getClient();
  const response = await c.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: "You are Mx, an AI email assistant. Summarize this email in 2-3 bullet points. Be concise.",
    messages: [
      {
        role: "user",
        content: `From: ${email.from_name}\nSubject: ${email.subject}\n\n${email.body}`,
      },
    ],
  });
  return response.content[0].text;
}

// ---------- Improve Text ----------
async function improveText(text, tone) {
  const c = getClient();
  const response = await c.messages.create({
    model: MODEL,
    max_tokens: 1000,
    system: `You are Mx, an AI email assistant. Improve the following email text. Make it ${tone}. Fix grammar, improve clarity, and make it more polished. Return only the improved text, nothing else.`,
    messages: [{ role: "user", content: text }],
  });
  return response.content[0].text;
}

// ---------- Draft New Email ----------
async function draftEmail(prompt, tone) {
  const c = getClient();
  const response = await c.messages.create({
    model: MODEL,
    max_tokens: 1000,
    system: `You are Mx, an AI email assistant. Draft an email based on the user's request. Tone: ${tone}. Return only the email body (no subject line).`,
    messages: [{ role: "user", content: prompt }],
  });
  return response.content[0].text;
}

// ---------- Chat (Conversational Commands) ----------
async function chat(message, context) {
  const c = getClient();
  const response = await c.messages.create({
    model: MODEL,
    max_tokens: 1000,
    system: `You are Mx, an AI email assistant. The user can give you conversational commands about their email.

Current inbox state:
- Total emails: ${context.emailCount}
- Unread: ${context.unreadCount}
- Categories: ${JSON.stringify(context.categories)}

Recent emails (last 10):
${context.recentEmails.map((e) => `- "${e.subject}" from ${e.from_name} (${e.category || "uncategorized"})`).join("\n")}

You can help with:
- Summarizing inbox status
- Finding specific emails
- Drafting replies
- Triaging/categorizing
- Setting reminders
- Adding calendar events
- Answering questions about email patterns

Be concise and helpful. If the user asks you to perform an action (like "archive all newsletters"), respond with what you would do and confirm.`,
    messages: [{ role: "user", content: message }],
  });
  return response.content[0].text;
}

// ---------- Detect Calendar Events ----------
async function detectCalendarEvents(email) {
  const c = getClient();
  const response = await c.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: `You are Mx, an AI email assistant. Analyze this email for any dates, meetings, deadlines, or events. Return a JSON array of events found: [{"title": string, "date": "YYYY-MM-DD", "time": "HH:MM" or null, "description": string}]. If no events found, return [].`,
    messages: [
      {
        role: "user",
        content: `From: ${email.from_name}\nSubject: ${email.subject}\nDate: ${email.date}\n\n${email.body}`,
      },
    ],
  });

  try {
    const text = response.content[0].text;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    return [];
  }
}

module.exports = {
  triageEmails,
  draftReply,
  summarize,
  improveText,
  draftEmail,
  chat,
  detectCalendarEvents,
};
