// ============================================================
// Mx — AI Chief of Staff Module (Claude API via Anthropic SDK)
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

// ============================================================
// CHIEF_OF_STAFF_SYSTEM — Master system prompt
// ============================================================

const CHIEF_OF_STAFF_SYSTEM = `You are Mx, an AI Chief of Staff for email and productivity management.

Your role is to act as a trusted executive assistant — triaging communications,
drafting replies, tracking commitments, surfacing what matters, and filtering noise.

## Email GPS Categories (Dan Martel system)
- respond: Requires the user's personal reply (questions, direct requests, meeting invites, decisions needed)
- review: Needs to be read/acknowledged but no reply needed (reports, updates, PRs, shared docs)
- waiting: The user is awaiting someone else's reply or a follow-up is expected
- receipts: Financial/billing emails, invoices, payment confirmations, order updates
- newsletter: Newsletters, digests, marketing emails (anything with unsubscribe links)
- fyi: Informational, low priority, automated notifications, system alerts

## Urgency Levels
- urgent: Needs attention within the hour — time-sensitive, blocking others, or high-stakes
- action_needed: Should be handled today — important but not immediately critical
- fyi: Worth knowing about, handle when convenient
- auto_handle: Can be processed automatically (archive, label, file)
- filter_out: Noise — can be safely ignored or bulk-archived

## Principles
- Protect the user's focus: minimize interruptions, batch low-priority items
- Surface decisions and commitments: never let a promise slip through
- Learn preferences over time: tone, contacts, scheduling habits
- Be concise and direct: no filler, no over-explaining
- When uncertain, flag it rather than guess`;

// ============================================================
// Helper: call Claude and return raw text
// ============================================================
async function callClaude(system, userContent, maxTokens = 2000) {
  const c = getClient();
  const response = await c.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: userContent }],
  });
  return response.content[0].text;
}

// ============================================================
// Helper: call Claude and parse JSON from response
// ============================================================
async function callClaudeJSON(system, userContent, maxTokens = 2000, fallback = null) {
  const text = await callClaude(system, userContent, maxTokens);
  try {
    // Try to find JSON array or object in the response
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) return JSON.parse(arrayMatch[0]);
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) return JSON.parse(objMatch[0]);
    return fallback;
  } catch {
    return fallback;
  }
}


// ============================================================
// 1. triageEmails(emails)
// ============================================================
async function triageEmails(emails) {
  const emailSummaries = emails.map((e) => ({
    id: e.id,
    from: `${e.from_name} <${e.from_address}>`,
    subject: e.subject,
    snippet: (e.body || "").substring(0, 300),
    date: e.date,
  }));

  const system = `${CHIEF_OF_STAFF_SYSTEM}

Your task: Categorize each email using the GPS categories and urgency levels above.
Assign an importance score from 1–10 (10 = most urgent/important).

Respond ONLY with a JSON array:
[{
  "id": number,
  "category": "respond" | "review" | "waiting" | "receipts" | "newsletter" | "fyi",
  "score": number,
  "urgency": "urgent" | "action_needed" | "fyi" | "auto_handle" | "filter_out",
  "reason": "one-line explanation"
}]`;

  const result = await callClaudeJSON(
    system,
    `Categorize these emails:\n${JSON.stringify(emailSummaries, null, 2)}`,
    3000,
    []
  );
  return result;
}

// ============================================================
// 2. draftReply(email, tone, context)
// ============================================================
async function draftReply(email, tone, context) {
  const contactCtx = context && context.contactHistory
    ? `\n\nContact history with ${email.from_name}:\n${context.contactHistory}`
    : "";
  const memoryCtx = context && context.memory
    ? `\n\nRelevant memory/preferences:\n${context.memory}`
    : "";
  const instructionCtx = context && context.instructions
    ? `\n\nUser instructions: ${context.instructions}`
    : "";

  const system = `${CHIEF_OF_STAFF_SYSTEM}

Your task: Draft a reply to the email below.

Generate TWO drafts:
1. Primary — using the requested tone: ${tone || "professional"}
2. Alternate — a contrasting tone (e.g., if primary is formal, alternate is casual; if primary is brief, alternate is detailed)

Also analyze the email for:
- Any commitments the user would be making by sending this reply
- Any red flags or things to be cautious about
${contactCtx}${memoryCtx}${instructionCtx}

Respond ONLY with JSON:
{
  "analysis": "brief analysis of the incoming email and what it needs",
  "primary": {
    "tone": "${tone || "professional"}",
    "body": "the draft reply text"
  },
  "alternate": {
    "tone": "the alternate tone name",
    "body": "the alternate draft reply text"
  },
  "commitments": ["list of commitments this reply would make"],
  "flags": ["any red flags or cautions"]
}`;

  const userContent = `From: ${email.from_name} <${email.from_address}>\nSubject: ${email.subject}\nDate: ${email.date}\n\n${email.body}`;

  const result = await callClaudeJSON(system, userContent, 2000, {
    analysis: "",
    primary: { tone: tone || "professional", body: "" },
    alternate: { tone: "casual", body: "" },
    commitments: [],
    flags: [],
  });
  return result;
}

// ============================================================
// 3. summarize(email)
// ============================================================
async function summarize(email) {
  const system = `${CHIEF_OF_STAFF_SYSTEM}

Your task: Summarize this email in 2–3 concise bullet points.
Focus on: what it's about, what (if anything) is being asked, and any deadlines.
Return only the bullet points, no preamble.`;

  const userContent = `From: ${email.from_name}\nSubject: ${email.subject}\nDate: ${email.date}\n\n${email.body}`;
  return await callClaude(system, userContent, 500);
}

// ============================================================
// 4. improveText(text, tone)
// ============================================================
async function improveText(text, tone) {
  const system = `${CHIEF_OF_STAFF_SYSTEM}

Your task: Improve the following email text.
Target tone: ${tone || "professional"}.
Fix grammar, improve clarity, make it more polished.
Return ONLY the improved text — no explanations, no preamble.`;

  return await callClaude(system, text, 1000);
}

// ============================================================
// 5. draftEmail(prompt, tone)
// ============================================================
async function draftEmail(prompt, tone) {
  const system = `${CHIEF_OF_STAFF_SYSTEM}

Your task: Draft a new email based on the user's request.
Tone: ${tone || "professional"}.
Return ONLY the email body — no subject line, no explanations.`;

  return await callClaude(system, prompt, 1000);
}


// ============================================================
// 6. chat(message, context)
// ============================================================
async function chat(message, context) {
  const ctx = context || {};
  const taskCtx = ctx.tasks && ctx.tasks.length
    ? `\n\nOpen tasks:\n${ctx.tasks.map((t) => `- [${t.priority || "normal"}] ${t.title} (due: ${t.due_date || "none"})`).join("\n")}`
    : "";
  const eventCtx = ctx.events && ctx.events.length
    ? `\n\nUpcoming events:\n${ctx.events.map((e) => `- ${e.title} on ${e.date} ${e.time || ""}`).join("\n")}`
    : "";
  const contactCtx = ctx.contacts && ctx.contacts.length
    ? `\n\nFrequent contacts:\n${ctx.contacts.map((c) => `- ${c.name} <${c.email}> (${c.role || "unknown role"})`).join("\n")}`
    : "";

  const system = `${CHIEF_OF_STAFF_SYSTEM}

You are in conversational mode. The user is chatting with you about their email and productivity.

Current inbox state:
- Total emails: ${ctx.emailCount || 0}
- Unread: ${ctx.unreadCount || 0}
- Categories: ${JSON.stringify(ctx.categories || {})}

Recent emails (last 10):
${(ctx.recentEmails || []).map((e) => `- "${e.subject}" from ${e.from_name} (${e.category || "uncategorized"}, score: ${e.importance_score || "?"})`).join("\n")}
${taskCtx}${eventCtx}${contactCtx}

You can help with:
- Summarizing inbox status and priorities
- Finding specific emails or patterns
- Drafting replies and new emails
- Triaging and categorizing
- Managing tasks and calendar events
- Analyzing contacts and relationships
- Generating morning briefings
- Answering questions about email patterns and workload

Be concise, direct, and actionable. If the user asks you to perform an action,
describe what you would do and confirm before proceeding.`;

  return await callClaude(system, message, 1000);
}

// ============================================================
// 7. detectCalendarEvents(email)
// ============================================================
async function detectCalendarEvents(email) {
  const system = `${CHIEF_OF_STAFF_SYSTEM}

Your task: Analyze this email for any scheduling signals — dates, meetings, deadlines, events, calls.

Respond ONLY with a JSON array of events found:
[{
  "title": "event title",
  "date": "YYYY-MM-DD",
  "time": "HH:MM" or null,
  "end_time": "HH:MM" or null,
  "location": "location or null",
  "meeting_url": "URL if found or null",
  "needs_prep": true/false,
  "description": "brief description"
}]

If no events found, return [].
Parse relative dates (e.g., "next Tuesday") using the email's sent date as reference.`;

  const userContent = `From: ${email.from_name}\nSubject: ${email.subject}\nDate: ${email.date}\n\n${email.body}`;

  const result = await callClaudeJSON(system, userContent, 1000, []);
  return result;
}

// ============================================================
// 8. analyzeThread(emails)
// ============================================================
async function analyzeThread(emails) {
  const threadMessages = emails.map((e, i) => ({
    index: i,
    from: `${e.from_name} <${e.from_address}>`,
    date: e.date,
    subject: e.subject,
    body: (e.body || "").substring(0, 500),
  }));

  const system = `${CHIEF_OF_STAFF_SYSTEM}

Your task: Analyze this email thread holistically.

Respond ONLY with JSON:
{
  "topic": "what this thread is about",
  "status": "brief status summary",
  "health": "resolved" | "waiting" | "stalled" | "urgent",
  "decisions_made": ["list of decisions reached in the thread"],
  "open_items": ["list of unresolved items or questions"],
  "participants": [
    {
      "name": "participant name",
      "email": "their email",
      "tone": "detected tone (e.g., frustrated, neutral, enthusiastic, formal)",
      "role": "their apparent role in the thread (initiator, responder, cc'd, decision-maker)"
    }
  ],
  "suggested_action": "what the user should do next",
  "ack_message_indices": [indices of messages that are simple acknowledgments like 'thanks', 'got it']
}`;

  const userContent = `Analyze this email thread:\n${JSON.stringify(threadMessages, null, 2)}`;

  const result = await callClaudeJSON(system, userContent, 2000, {
    topic: "",
    status: "",
    health: "waiting",
    decisions_made: [],
    open_items: [],
    participants: [],
    suggested_action: "",
    ack_message_indices: [],
  });
  return result;
}


// ============================================================
// 9. extractTasks(email)
// ============================================================
async function extractTasks(email) {
  const system = `${CHIEF_OF_STAFF_SYSTEM}

Your task: Extract actionable tasks from this email.
Look for: explicit requests, implied action items, deadlines, deliverables, promises made.

Respond ONLY with a JSON array:
[{
  "title": "concise task description",
  "assigned_to": "user" | "sender" | "other (name)",
  "due_date": "YYYY-MM-DD or null if not specified",
  "priority": "high" | "medium" | "low",
  "source": "quote or paraphrase from the email that implies this task"
}]

If no tasks found, return [].`;

  const userContent = `From: ${email.from_name} <${email.from_address}>\nSubject: ${email.subject}\nDate: ${email.date}\n\n${email.body}`;

  const result = await callClaudeJSON(system, userContent, 1000, []);
  return result;
}

// ============================================================
// 10. analyzeContact(emails, contactInfo)
// ============================================================
async function analyzeContact(emails, contactInfo) {
  const emailSnippets = emails.map((e) => ({
    subject: e.subject,
    date: e.date,
    direction: e.direction || (e.from_address === contactInfo.email ? "inbound" : "outbound"),
    snippet: (e.body || "").substring(0, 200),
  }));

  const system = `${CHIEF_OF_STAFF_SYSTEM}

Your task: Analyze the user's relationship with this contact based on their email history.

Contact info:
- Name: ${contactInfo.name || "Unknown"}
- Email: ${contactInfo.email}
${contactInfo.company ? `- Company: ${contactInfo.company}` : ""}
${contactInfo.role ? `- Known role: ${contactInfo.role}` : ""}

Respond ONLY with JSON:
{
  "role": "inferred role/title if not already known",
  "company": "inferred company if not already known",
  "tone": "typical tone of communication (e.g., formal, casual, terse, warm)",
  "topics": ["main topics discussed"],
  "relationship_score": 1-10 (10 = very close/frequent, 1 = rare/cold),
  "outstanding_items": ["any pending items between user and this contact"],
  "suggested_action": "any recommended follow-up or action",
  "summary": "2-3 sentence relationship summary"
}`;

  const userContent = `Analyze relationship based on these ${emailSnippets.length} emails:\n${JSON.stringify(emailSnippets, null, 2)}`;

  const result = await callClaudeJSON(system, userContent, 1500, {
    role: "",
    company: "",
    tone: "",
    topics: [],
    relationship_score: 5,
    outstanding_items: [],
    suggested_action: "",
    summary: "",
  });
  return result;
}

// ============================================================
// 11. generateBriefing(context)
// ============================================================
async function generateBriefing(context) {
  const ctx = context || {};

  const system = `${CHIEF_OF_STAFF_SYSTEM}

Your task: Generate a morning briefing for the user — a concise, actionable overview of their day.

Respond ONLY with JSON:
{
  "greeting": "personalized morning greeting",
  "inbox_summary": {
    "total_unread": number,
    "by_category": { "respond": number, "review": number, ... },
    "highlight": "one-sentence inbox summary"
  },
  "urgent_items": [
    { "type": "email" | "task" | "event", "title": "description", "reason": "why it's urgent" }
  ],
  "action_needed": [
    { "type": "email" | "task" | "event", "title": "description", "suggested_action": "what to do" }
  ],
  "schedule": [
    { "time": "HH:MM", "title": "event title", "notes": "any prep notes" }
  ],
  "tasks_due": [
    { "title": "task title", "due": "due date/time", "priority": "high/medium/low" }
  ],
  "nudges": ["gentle reminders about stalled threads, overdue items, follow-ups"],
  "ai_suggestion": "one proactive suggestion to help the user be more productive today"
}`;

  const userContent = `Generate my morning briefing.

Inbox:
- Total emails: ${ctx.emailCount || 0}
- Unread: ${ctx.unreadCount || 0}
- Categories: ${JSON.stringify(ctx.categories || {})}

Recent unread emails:
${(ctx.recentEmails || []).map((e) => `- [${e.category || "?"}] "${e.subject}" from ${e.from_name} (score: ${e.importance_score || "?"})`).join("\n") || "None"}

Today's events:
${(ctx.events || []).map((e) => `- ${e.time || "TBD"}: ${e.title} ${e.location ? "@ " + e.location : ""}`).join("\n") || "None"}

Open tasks:
${(ctx.tasks || []).map((t) => `- [${t.priority || "normal"}] ${t.title} (due: ${t.due_date || "none"})`).join("\n") || "None"}

Stalled threads:
${(ctx.stalledThreads || []).map((t) => `- "${t.subject}" — last activity: ${t.lastDate}`).join("\n") || "None"}

Current date/time: ${new Date().toISOString()}`;

  const result = await callClaudeJSON(system, userContent, 2500, {
    greeting: "Good morning!",
    inbox_summary: { total_unread: 0, by_category: {}, highlight: "" },
    urgent_items: [],
    action_needed: [],
    schedule: [],
    tasks_due: [],
    nudges: [],
    ai_suggestion: "",
  });
  return result;
}


// ============================================================
// 12. suggestSchedule(email, rules, existingEvents)
// ============================================================
async function suggestSchedule(email, rules, existingEvents) {
  const ruleText = rules
    ? `\n\nUser's scheduling rules:\n${JSON.stringify(rules, null, 2)}`
    : "";
  const eventsText = existingEvents && existingEvents.length
    ? `\n\nExisting calendar events:\n${existingEvents.map((e) => `- ${e.date} ${e.time || ""}–${e.end_time || ""}: ${e.title}`).join("\n")}`
    : "";

  const system = `${CHIEF_OF_STAFF_SYSTEM}

Your task: Analyze a scheduling request from an email and suggest optimal time slots.
Respect the user's scheduling rules and avoid conflicts with existing events.
${ruleText}${eventsText}

Respond ONLY with JSON:
{
  "request_summary": "what is being requested (meeting type, duration, participants)",
  "detected_constraints": ["any constraints mentioned in the email (e.g., 'before Friday', 'morning preferred')"],
  "suggested_slots": [
    {
      "date": "YYYY-MM-DD",
      "start_time": "HH:MM",
      "end_time": "HH:MM",
      "reason": "why this slot works"
    }
  ],
  "conflicts": ["any potential conflicts to be aware of"],
  "draft_response": "a suggested reply accepting/proposing the meeting"
}`;

  const userContent = `Scheduling request email:\nFrom: ${email.from_name} <${email.from_address}>\nSubject: ${email.subject}\nDate: ${email.date}\n\n${email.body}`;

  const result = await callClaudeJSON(system, userContent, 2000, {
    request_summary: "",
    detected_constraints: [],
    suggested_slots: [],
    conflicts: [],
    draft_response: "",
  });
  return result;
}

// ============================================================
// 13. learnFromFeedback(action, context)
// ============================================================
async function learnFromFeedback(action, context) {
  const system = `${CHIEF_OF_STAFF_SYSTEM}

Your task: The user just took an action on an email or task. Analyze this action
to extract learnable preferences that can improve future suggestions.

Respond ONLY with JSON:
{
  "preferences": [
    {
      "type": "tone" | "category" | "priority" | "schedule" | "contact" | "workflow",
      "observation": "what we can learn from this action",
      "rule": "a concise rule to apply in the future",
      "confidence": 0.0–1.0
    }
  ],
  "pattern_notes": "any broader patterns observed if context is provided"
}`;

  const userContent = `User action: ${JSON.stringify(action, null, 2)}\n\nContext: ${JSON.stringify(context || {}, null, 2)}`;

  const result = await callClaudeJSON(system, userContent, 1000, {
    preferences: [],
    pattern_notes: "",
  });
  return result;
}

// ============================================================
// Exports
// ============================================================
module.exports = {
  CHIEF_OF_STAFF_SYSTEM,
  triageEmails,
  draftReply,
  summarize,
  improveText,
  draftEmail,
  chat,
  detectCalendarEvents,
  analyzeThread,
  extractTasks,
  analyzeContact,
  generateBriefing,
  suggestSchedule,
  learnFromFeedback,
};
