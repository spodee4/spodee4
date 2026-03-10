// ============================================================
// Mx — AI Email Client (Native JS)
// Frontend with API backend + offline fallback
// ============================================================

(function () {
  "use strict";

  // ---------- API Layer ----------
  const API_BASE = "/api";
  const api = {
    async fetch(path, opts = {}) {
      try {
        const res = await fetch(`${API_BASE}${path}`, {
          headers: { "Content-Type": "application/json" },
          ...opts,
          body: opts.body ? JSON.stringify(opts.body) : undefined,
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        return res.json();
      } catch (err) {
        console.warn("API unavailable, using local mode:", err.message);
        return null;
      }
    },
    getEmails(params) {
      const q = new URLSearchParams(params).toString();
      return this.fetch(`/emails?${q}`);
    },
    patchEmail(id, path, body) {
      return this.fetch(`/emails/${id}/${path}`, { method: "PATCH", body });
    },
    sendEmail(data) {
      return this.fetch("/emails/send", { method: "POST", body: data });
    },
    aiTriage(emailIds) {
      return this.fetch("/ai/triage", { method: "POST", body: { emailIds } });
    },
    aiDraftReply(emailId, tone) {
      return this.fetch("/ai/draft-reply", { method: "POST", body: { emailId, tone } });
    },
    aiSummarize(emailId) {
      return this.fetch("/ai/summarize", { method: "POST", body: { emailId } });
    },
    aiImprove(text, tone) {
      return this.fetch("/ai/improve", { method: "POST", body: { text, tone } });
    },
    aiDraft(prompt, tone) {
      return this.fetch("/ai/draft", { method: "POST", body: { prompt, tone } });
    },
    aiChat(message) {
      return this.fetch("/ai/chat", { method: "POST", body: { message } });
    },
    aiDetectEvents(emailId) {
      return this.fetch("/ai/detect-events", { method: "POST", body: { emailId } });
    },
    getTemplates() {
      return this.fetch("/templates");
    },
    sync() {
      return this.fetch("/sync", { method: "POST" });
    },
  };

  // ---------- Sample Data (offline fallback) ----------
  const sampleEmails = [
    {
      id: 1,
      from_name: "Sarah Chen",
      from_address: "sarah@techcorp.io",
      to_address: "me@spodee.mail",
      subject: "Q1 Product Roadmap Review",
      body: "Hi team,\n\nI wanted to share the updated Q1 product roadmap for everyone's review. We've made some significant changes based on customer feedback from last quarter.\n\nKey highlights:\n- AI-powered search is moving to priority 1\n- Mobile redesign pushed to Q2\n- New onboarding flow launching Feb 15\n- API v3 deprecation timeline extended to March\n\nPlease review the attached document and share your feedback by end of week. We'll have a final review meeting next Monday at 2pm.\n\nLet me know if you have any questions.\n\nBest,\nSarah",
      date: "2026-03-10T09:30:00",
      read: 0,
      starred: 1,
      folder: "inbox",
      account: "zoho-biz",
      category: null,
      ai_score: null,
      is_vip: false,
      snoozed_until: null,
    },
    {
      id: 2,
      from_name: "GitHub",
      from_address: "noreply@github.com",
      to_address: "me@spodee.mail",
      subject: "[spodee4] Pull Request #42: Add real-time notifications",
      body: "@devops-bot opened a pull request in spodee4/spodee4:\n\n#42 Add real-time notifications\n\nThis PR adds WebSocket-based real-time notifications to the platform.\n\nReviewers: @sarah-chen, @mike-johnson\nLabels: feature, needs-review\nCI: All checks passing",
      date: "2026-03-10T08:15:00",
      read: 0,
      starred: 0,
      folder: "inbox",
      account: "zoho-biz",
      category: null,
      ai_score: null,
      is_vip: false,
    },
    {
      id: 3,
      from_name: "Mike Johnson",
      from_address: "mike@designlab.co",
      to_address: "me@spodee.mail",
      subject: "Re: Brand refresh concepts",
      body: "Hey!\n\nI've finished the three brand refresh concepts we discussed. Here's a quick summary:\n\nConcept A - Modern Minimal\nConcept B - Vibrant Energy\nConcept C - Trust & Clarity\n\nMy recommendation is Concept A with some warmth borrowed from C.\n\nWant to hop on a call tomorrow to walk through them?\n\nCheers,\nMike",
      date: "2026-03-09T16:45:00",
      read: 1,
      starred: 0,
      folder: "inbox",
      account: "zoho-biz",
      category: null,
      ai_score: null,
      is_vip: true,
    },
    {
      id: 4,
      from_name: "Me",
      from_address: "me@spodee.mail",
      to_address: "team@spodee.mail",
      subject: "Sprint planning notes - Week 11",
      body: "Team,\n\nHere are the notes from today's sprint planning:\n\nCompleted last sprint:\n- User authentication refactor\n- Dashboard performance optimization\n\nThis sprint's priorities:\n1. AI mail assistant integration\n2. Email template builder v2\n3. Analytics dashboard redesign\n\nThanks,\nMe",
      date: "2026-03-09T11:00:00",
      read: 1,
      starred: 0,
      folder: "sent",
      account: "zoho-biz",
    },
    {
      id: 5,
      from_name: "AWS",
      from_address: "no-reply@aws.amazon.com",
      to_address: "me@spodee.mail",
      subject: "Your February billing statement is ready",
      body: "Hello,\n\nYour AWS billing statement for February 2026 is now available.\n\nAccount: spodee-production\nTotal charges: $1,247.83\n\nView your detailed billing dashboard in the AWS Console.\n\nAmazon Web Services",
      date: "2026-03-08T06:00:00",
      read: 1,
      starred: 1,
      folder: "inbox",
      account: "zoho-biz",
    },
    {
      id: 6,
      from_name: "Indie Hackers",
      from_address: "digest@indiehackers.com",
      to_address: "me@gmail.com",
      subject: "Weekly Digest: Top stories from the community",
      body: "This week on Indie Hackers:\n\n1. How I grew my SaaS to $10K MRR\n2. The SEO strategy that tripled our traffic\n3. Why I switched from React to HTMX\n\nTo unsubscribe from this digest, click here.",
      date: "2026-03-07T14:00:00",
      read: 1,
      starred: 0,
      folder: "inbox",
      account: "gmail",
    },
    {
      id: 7,
      from_name: "Lisa Park",
      from_address: "lisa@clientco.com",
      to_address: "me@spodee.mail",
      subject: "Re: Project timeline update",
      body: "Hi,\n\nThanks for the update. We're aligned on the new dates.\n\nOne thing - we're still waiting on the API documentation from your side. Could you have someone send that over by Wednesday?\n\nBest,\nLisa",
      date: "2026-03-09T10:20:00",
      read: 0,
      starred: 0,
      folder: "inbox",
      account: "zoho-biz",
    },
    {
      id: 8,
      from_name: "Stripe",
      from_address: "receipts@stripe.com",
      to_address: "me@spodee.mail",
      subject: "Your receipt from Spodee Inc - $299.00",
      body: "Receipt from Stripe\n\nAmount: $299.00\nDate: March 7, 2026\nDescription: Pro Plan - Monthly subscription\nCard: Visa ending in 4242",
      date: "2026-03-07T09:00:00",
      read: 1,
      starred: 0,
      folder: "inbox",
      account: "zoho-biz",
    },
    {
      id: 9,
      from_name: "Contact Form",
      from_address: "contact@spodee.com",
      to_address: "info@spodee.com",
      subject: "New inquiry from website",
      body: "New contact form submission:\n\nName: David Kim\nEmail: david@startup.io\nMessage: Hi, I'm interested in your enterprise plan. Can we schedule a demo call this week?\n\nSubmitted via spodee.com contact form",
      date: "2026-03-10T07:00:00",
      read: 0,
      starred: 0,
      folder: "inbox",
      account: "zoho-web",
    },
    {
      id: 10,
      from_name: "Mom",
      from_address: "mom@gmail.com",
      to_address: "me@gmail.com",
      subject: "Dinner Sunday?",
      body: "Hey sweetie,\n\nAre you free for dinner this Sunday? Dad wants to try that new Italian place on Main Street.\n\nLet me know!\nLove, Mom",
      date: "2026-03-09T19:30:00",
      read: 0,
      starred: 0,
      folder: "inbox",
      account: "gmail",
    },
  ];

  // ---------- Category Config (Dan Martel Email GPS) ----------
  const CATEGORIES = {
    respond:    { label: "Respond",    color: "var(--star)",    icon: "!" },
    review:     { label: "Review",     color: "var(--chart-1)", icon: "?" },
    waiting:    { label: "Waiting On", color: "var(--chart-3)", icon: "\u23F3" },
    receipts:   { label: "Receipts",   color: "var(--chart-2)", icon: "$" },
    newsletter: { label: "Newsletter", color: "var(--text-dim)", icon: "\u2709" },
    fyi:        { label: "FYI",        color: "var(--chart-4)", icon: "i" },
  };

  // ---------- Email Templates ----------
  const defaultTemplates = [
    { id: 1, name: "Meeting Follow-up", subject: "Follow-up from our meeting", body: "Hi,\n\nThank you for taking the time to meet today. Here are the key takeaways:\n\n- \n- \n\nPlease let me know if I missed anything.\n\nBest regards" },
    { id: 2, name: "Quick Reply", subject: "", body: "Thanks for the update! I'll take a look and get back to you shortly." },
    { id: 3, name: "Introduction", subject: "Introduction", body: "Hi,\n\nI wanted to introduce myself. I'd love to connect and learn more about what you're working on.\n\nLooking forward to hearing from you.\n\nBest" },
    { id: 4, name: "Polite Decline", subject: "", body: "Hi,\n\nThank you for thinking of me. Unfortunately, I'm not able to take this on at this time.\n\nI appreciate the offer and wish you the best.\n\nKind regards" },
    { id: 5, name: "Thank You", subject: "Thank you!", body: "Hi,\n\nJust wanted to send a quick thank you. I really appreciate it.\n\nBest" },
  ];

  // ---------- State ----------
  const state = {
    emails: JSON.parse(JSON.stringify(sampleEmails)),
    activeFolder: "inbox",
    activeCategory: "all",
    activeAccount: "all",
    selectedId: null,
    searchQuery: "",
    filterMode: "all",
    activeTone: "professional",
    nextId: 100,
    undoTimer: null,
    undoEmail: null,
    attachments: [],
    templates: defaultTemplates,
    vipContacts: new Set(["mike@designlab.co"]),
    isOnline: false,
  };

  // ---------- DOM References ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    mailList: $("#mail-list"),
    folders: $$("#folders .folder"),
    composeBtn: $("#compose-btn"),
    searchInput: $("#search-input"),
    filterSelect: $("#filter-select"),
    refreshBtn: $("#refresh-btn"),
    mailDetail: $("#mail-detail"),
    detailSubject: $("#detail-subject"),
    detailFrom: $("#detail-from"),
    detailDate: $("#detail-date"),
    detailBody: $("#detail-body"),
    detailCategoryBar: $("#detail-category-bar"),
    detailScoreBar: $("#detail-score-bar"),
    starBtn: $("#star-btn"),
    vipBtn: $("#vip-btn"),
    snoozeBtn: $("#snooze-btn"),
    replyBtn: $("#reply-btn"),
    deleteBtn: $("#delete-btn"),
    backBtn: $("#back-btn"),
    aiSummaryBar: $("#ai-summary-bar"),
    aiSummarizeBtn: $("#ai-summarize-btn"),
    aiReplySuggestBtn: $("#ai-reply-suggest-btn"),
    aiCalendarBtn: $("#ai-calendar-btn"),
    aiResult: $("#ai-result"),
    composePanel: $("#compose-panel"),
    composeForm: $("#compose-form"),
    composeFrom: $("#compose-from"),
    composeTo: $("#compose-to"),
    composeSubject: $("#compose-subject"),
    composeBody: $("#compose-body"),
    composeFile: $("#compose-file"),
    composeAttachments: $("#compose-attachments"),
    closeCompose: $("#close-compose"),
    saveDraftBtn: $("#save-draft-btn"),
    discardBtn: $("#discard-btn"),
    aiDraftBtn: $("#ai-draft-btn"),
    aiImproveBtn: $("#ai-improve-btn"),
    templateBtn: $("#template-btn"),
    emptyState: $("#empty-state"),
    aiInput: $("#ai-input"),
    aiSendBtn: $("#ai-send-btn"),
    aiMessages: $("#ai-messages"),
    inboxCount: $("#inbox-count"),
    snoozedCount: $("#snoozed-count"),
    detailPanel: $("#detail-panel"),
    triageAllBtn: $("#triage-all-btn"),
    triageCategories: $$("#triage-categories .triage-cat"),
    accountTabs: $$("#account-switcher .account-tab, .account-tab"),
    themeToggle: $("#theme-toggle"),
    undoToast: $("#undo-toast"),
    undoSendBtn: $("#undo-send-btn"),
    undoProgressBar: $("#undo-progress-bar"),
    toneButtons: $$(".tone-btn"),
  };

  // ---------- Helpers ----------
  function formatDate(iso) {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ---------- Get Visible Emails ----------
  function getVisibleEmails() {
    let emails = state.emails.filter((e) => {
      if (state.activeFolder === "starred") return e.starred;
      return e.folder === state.activeFolder;
    });

    if (state.activeAccount && state.activeAccount !== "all") {
      emails = emails.filter((e) => e.account === state.activeAccount);
    }

    if (state.activeCategory && state.activeCategory !== "all") {
      emails = emails.filter((e) => e.category === state.activeCategory);
    }

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      emails = emails.filter(
        (e) =>
          (e.subject || "").toLowerCase().includes(q) ||
          (e.from_name || "").toLowerCase().includes(q) ||
          (e.from_address || "").toLowerCase().includes(q) ||
          (e.body || "").toLowerCase().includes(q)
      );
    }

    if (state.filterMode === "unread") emails = emails.filter((e) => !e.read);
    else if (state.filterMode === "read") emails = emails.filter((e) => e.read);
    else if (state.filterMode === "vip") emails = emails.filter((e) => state.vipContacts.has(e.from_address));

    // Sort: VIP first, then by category priority, then by date
    const catPriority = { respond: 0, review: 1, waiting: 2, fyi: 3, receipts: 4, newsletter: 5 };
    emails.sort((a, b) => {
      const aVip = state.vipContacts.has(a.from_address) ? 0 : 1;
      const bVip = state.vipContacts.has(b.from_address) ? 0 : 1;
      if (aVip !== bVip) return aVip - bVip;
      const pa = catPriority[a.category] ?? 3;
      const pb = catPriority[b.category] ?? 3;
      if (pa !== pb) return pa - pb;
      return new Date(b.date) - new Date(a.date);
    });

    return emails;
  }

  // ---------- Update Counts ----------
  function updateCounts() {
    const inbox = state.emails.filter((e) => e.folder === "inbox");
    const unread = inbox.filter((e) => !e.read).length;
    dom.inboxCount.textContent = unread;
    dom.inboxCount.classList.toggle("hidden", unread === 0);

    const snoozed = state.emails.filter((e) => e.folder === "snoozed").length;
    dom.snoozedCount.textContent = snoozed;
    dom.snoozedCount.classList.toggle("hidden", snoozed === 0);

    // Category counts
    const counts = { all: inbox.length };
    Object.keys(CATEGORIES).forEach((cat) => {
      counts[cat] = inbox.filter((e) => e.category === cat).length;
    });
    Object.entries(counts).forEach(([cat, count]) => {
      const badge = document.getElementById(`cat-${cat}-count`);
      if (badge) {
        badge.textContent = count;
        badge.classList.toggle("hidden", count === 0);
      }
    });
  }

  // ---------- Render Mail List ----------
  function renderMailList() {
    const emails = getVisibleEmails();
    dom.mailList.innerHTML = "";

    if (emails.length === 0) {
      dom.mailList.innerHTML = '<li style="padding:40px 16px;text-align:center;color:var(--text-dim);">No messages</li>';
      return;
    }

    emails.forEach((email) => {
      const li = document.createElement("li");
      li.className = "mail-item";
      if (!email.read) li.classList.add("unread");
      if (email.id === state.selectedId) li.classList.add("active");

      const catTag = email.category
        ? `<span class="mail-item-category" data-cat="${email.category}">${CATEGORIES[email.category]?.label || email.category}</span>`
        : "";

      const vipDot = state.vipContacts.has(email.from_address) ? '<span class="mail-item-vip"></span>' : "";
      const scoreTag = email.ai_score ? `<span class="mail-item-score">${email.ai_score}</span>` : "";
      const snoozeTag = email.snoozed_until ? '<span class="mail-item-snooze">&#9200;</span>' : "";

      li.innerHTML = `
        <div class="mail-item-row">
          <span class="mail-item-from">${vipDot}${escapeHtml(email.from_name || "")}</span>
          <span class="mail-item-date">${formatDate(email.date)}${snoozeTag}</span>
        </div>
        <div class="mail-item-row">
          <span class="mail-item-subject">${escapeHtml(email.subject || "")}</span>
          <span class="mail-item-star ${email.starred ? "starred" : ""}" data-id="${email.id}">&#9733;</span>
        </div>
        <div class="mail-item-row">
          <span class="mail-item-snippet">${escapeHtml((email.body || "").substring(0, 80))}...</span>
          ${scoreTag}${catTag}
        </div>
      `;

      li.addEventListener("click", (e) => {
        if (e.target.classList.contains("mail-item-star")) {
          toggleStar(email.id);
          return;
        }
        selectEmail(email.id);
      });

      dom.mailList.appendChild(li);
    });
  }

  // ---------- Select Email ----------
  function selectEmail(id) {
    state.selectedId = id;
    const email = state.emails.find((e) => e.id === id);
    if (!email) return;

    email.read = 1;
    api.patchEmail(id, "read", { read: true });

    dom.detailSubject.textContent = email.subject;
    dom.detailFrom.textContent = `From: ${email.from_name} <${email.from_address}>`;
    dom.detailDate.textContent = formatDate(email.date);
    dom.detailBody.textContent = email.body;

    dom.starBtn.innerHTML = email.starred ? "&#9733; Starred" : "&#9734; Star";
    dom.starBtn.style.color = email.starred ? "var(--star)" : "";

    const isVip = state.vipContacts.has(email.from_address);
    dom.vipBtn.innerHTML = isVip ? "&#9826; VIP" : "&#9826;";
    dom.vipBtn.style.color = isVip ? "var(--star)" : "";

    // Category tag
    if (email.category && CATEGORIES[email.category]) {
      const cat = CATEGORIES[email.category];
      dom.detailCategoryBar.innerHTML = `<span class="detail-cat-tag mail-item-category" data-cat="${email.category}">${cat.icon} ${cat.label}</span>`;
    } else {
      dom.detailCategoryBar.innerHTML = "";
    }

    // AI Score
    if (email.ai_score) {
      dom.detailScoreBar.innerHTML = `<span class="mail-item-score" style="font-size:12px;padding:3px 8px;">Importance: ${email.ai_score}/10</span>`;
    } else {
      dom.detailScoreBar.innerHTML = "";
    }

    dom.aiResult.classList.add("hidden");
    dom.aiResult.textContent = "";

    showPanel("detail");
    updateCounts();
    renderMailList();
  }

  // ---------- Show Panel ----------
  function showPanel(panel) {
    dom.mailDetail.classList.add("hidden");
    dom.composePanel.classList.add("hidden");
    dom.emptyState.classList.add("hidden");

    if (panel === "detail") {
      dom.mailDetail.classList.remove("hidden");
      dom.aiSummaryBar.classList.remove("hidden");
      dom.detailPanel.classList.add("visible");
    } else if (panel === "compose") {
      dom.composePanel.classList.remove("hidden");
      dom.aiSummaryBar.classList.add("hidden");
      dom.detailPanel.classList.add("visible");
    } else {
      dom.emptyState.classList.remove("hidden");
      dom.aiSummaryBar.classList.add("hidden");
      dom.detailPanel.classList.remove("visible");
    }
  }

  // ---------- Actions ----------
  function toggleStar(id) {
    const email = state.emails.find((e) => e.id === id);
    if (!email) return;
    email.starred = email.starred ? 0 : 1;
    api.patchEmail(id, "star", { starred: !!email.starred });
    if (state.selectedId === id) {
      dom.starBtn.innerHTML = email.starred ? "&#9733; Starred" : "&#9734; Star";
      dom.starBtn.style.color = email.starred ? "var(--star)" : "";
    }
    renderMailList();
  }

  function toggleVip(id) {
    const email = state.emails.find((e) => e.id === id);
    if (!email) return;
    const isVip = state.vipContacts.has(email.from_address);
    if (isVip) {
      state.vipContacts.delete(email.from_address);
    } else {
      state.vipContacts.add(email.from_address);
    }
    api.patchEmail(id, "vip", { vip: !isVip });
    dom.vipBtn.innerHTML = !isVip ? "&#9826; VIP" : "&#9826;";
    dom.vipBtn.style.color = !isVip ? "var(--star)" : "";
    renderMailList();
  }

  function deleteEmail(id) {
    const email = state.emails.find((e) => e.id === id);
    if (!email) return;
    if (email.folder === "trash") {
      state.emails = state.emails.filter((e) => e.id !== id);
    } else {
      email.folder = "trash";
    }
    api.patchEmail(id, "move", { folder: "trash" });
    state.selectedId = null;
    showPanel("empty");
    updateCounts();
    renderMailList();
  }

  // ---------- Snooze ----------
  function showSnoozeDropdown() {
    const existing = document.querySelector(".snooze-dropdown");
    if (existing) { existing.remove(); return; }

    const dropdown = document.createElement("div");
    dropdown.className = "snooze-dropdown";

    const options = [
      { label: "Later today (4 hours)", hours: 4 },
      { label: "Tomorrow morning", hours: 18 },
      { label: "Next week", hours: 168 },
      { label: "In 3 days", hours: 72 },
    ];

    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "snooze-option";
      btn.textContent = opt.label;
      btn.addEventListener("click", () => {
        snoozeEmail(state.selectedId, opt.hours);
        dropdown.remove();
      });
      dropdown.appendChild(btn);
    });

    dom.snoozeBtn.appendChild(dropdown);
    setTimeout(() => document.addEventListener("click", function close(e) {
      if (!dropdown.contains(e.target)) { dropdown.remove(); document.removeEventListener("click", close); }
    }), 0);
  }

  function snoozeEmail(id, hours) {
    const email = state.emails.find((e) => e.id === id);
    if (!email) return;
    const until = new Date(Date.now() + hours * 3600000).toISOString();
    email.snoozed_until = until;
    email.folder = "snoozed";
    api.patchEmail(id, "snooze", { until });
    state.selectedId = null;
    showPanel("empty");
    updateCounts();
    renderMailList();
    addAiMessage(`Snoozed "${email.subject}" for ${hours} hours.`, "assistant");
  }

  // ---------- Send with Undo ----------
  function sendWithUndo(to, subject, body) {
    const email = {
      id: state.nextId++,
      from_name: "Me",
      from_address: "me@spodee.mail",
      to_address: to,
      subject: subject || "(No subject)",
      body: body,
      date: new Date().toISOString(),
      read: 1,
      starred: 0,
      folder: "sent",
      account: dom.composeFrom?.value || "zoho-biz",
    };

    state.undoEmail = email;
    dom.undoToast.classList.remove("hidden");
    dom.undoProgressBar.style.width = "100%";

    let elapsed = 0;
    const total = 10000; // 10 seconds to undo
    const interval = setInterval(() => {
      elapsed += 100;
      dom.undoProgressBar.style.width = `${100 - (elapsed / total) * 100}%`;
    }, 100);

    state.undoTimer = setTimeout(() => {
      clearInterval(interval);
      state.emails.push(email);
      api.sendEmail({
        from_account: email.account,
        to: email.to_address,
        subject: email.subject,
        body: email.body,
        attachments: state.attachments,
      });
      state.undoEmail = null;
      state.attachments = [];
      dom.undoToast.classList.add("hidden");
      updateCounts();
      renderMailList();
    }, total);
  }

  function undoSend() {
    if (state.undoTimer) {
      clearTimeout(state.undoTimer);
      state.undoTimer = null;
    }
    state.undoEmail = null;
    dom.undoToast.classList.add("hidden");
    // Re-open compose with the content
    showPanel("compose");
  }

  // ---------- File Attachments ----------
  function renderAttachments() {
    dom.composeAttachments.innerHTML = "";
    state.attachments.forEach((file, i) => {
      const chip = document.createElement("span");
      chip.className = "attachment-chip";
      chip.innerHTML = `&#128206; ${escapeHtml(file.name)} (${(file.size / 1024).toFixed(1)}KB) <span class="remove-attachment" data-index="${i}">&times;</span>`;
      dom.composeAttachments.appendChild(chip);
    });
  }

  // ---------- Templates ----------
  function showTemplateDropdown() {
    const existing = document.querySelector(".template-dropdown");
    if (existing) { existing.remove(); return; }

    const dropdown = document.createElement("div");
    dropdown.className = "template-dropdown";

    state.templates.forEach((tpl) => {
      const btn = document.createElement("button");
      btn.className = "template-option";
      btn.innerHTML = `${escapeHtml(tpl.name)}<small>${escapeHtml((tpl.body || "").substring(0, 50))}...</small>`;
      btn.addEventListener("click", () => {
        if (tpl.subject) dom.composeSubject.value = tpl.subject;
        dom.composeBody.value = tpl.body;
        dropdown.remove();
      });
      dropdown.appendChild(btn);
    });

    dom.templateBtn.parentElement.appendChild(dropdown);
    setTimeout(() => document.addEventListener("click", function close(e) {
      if (!dropdown.contains(e.target) && e.target !== dom.templateBtn) {
        dropdown.remove();
        document.removeEventListener("click", close);
      }
    }), 0);
  }

  // ---------- AI Engine (Offline Fallback) ----------
  const localAi = {
    categorize(email) {
      const from = (email.from_address || "").toLowerCase();
      const subject = (email.subject || "").toLowerCase();
      const body = (email.body || "").toLowerCase();

      if (/receipt|invoice|billing|statement|payment|charge|subscription|stripe|paypal/.test(subject + " " + body) ||
          /no-reply|noreply|receipts@|billing@|payments@/.test(from)) return "receipts";
      if (/unsubscribe|digest|weekly|newsletter|roundup/.test(body) ||
          /newsletter|digest|weekly|substack|mailchimp/.test(from)) return "newsletter";
      if (/waiting on|waiting for|pending|follow up|following up|circle back/.test(body) &&
          /could you|can you|send.*over|by (monday|tuesday|wednesday|thursday|friday|end of|eod|eow)/.test(body)) return "waiting";
      if (/\?/.test(subject) ||
          /(could you|can you|would you|please.*send|please.*review|please.*confirm|let me know|what do you think|your thoughts|hop on a call|schedule|rsvp|action required)/i.test(body)) return "respond";
      if (/pull request|review|pr #|needs.review|code review|please review|take a look/.test(subject + " " + body) ||
          /roadmap|update|report|summary|highlights|key changes/.test(body)) return "review";
      return "fyi";
    },

    async triageAll(emails) {
      const toTriage = emails.filter((e) => e.folder === "inbox" && !e.category);
      for (const email of toTriage) {
        await delay(150);
        email.category = this.categorize(email);
        email.ai_score = Math.floor(Math.random() * 4) + 5; // 5-8
        if (email.category === "respond") email.ai_score = Math.floor(Math.random() * 2) + 8;
        if (email.category === "newsletter") email.ai_score = Math.floor(Math.random() * 3) + 1;
      }
      return toTriage.length;
    },

    async suggestReply(email, tone) {
      await delay(800);
      const name = (email.from_name || "").split(" ")[0];
      const tones = {
        professional: `Hi ${name},\n\nThank you for reaching out. I've reviewed your message and appreciate the update.\n\nI'll follow up with more details shortly.\n\nBest regards`,
        friendly: `Hey ${name}!\n\nThanks for sending this over! Looks great. Let me take a closer look and I'll get back to you.\n\nCheers`,
        formal: `Dear ${name},\n\nThank you for your correspondence. I acknowledge receipt and will review the matter at my earliest convenience.\n\nKind regards`,
        brief: `Thanks ${name}, noted. Will follow up soon.`,
      };
      return tones[tone] || tones.professional;
    },

    async summarize(email) {
      await delay(600);
      const sentences = (email.body || "").split(/[.!?\n]/).map((s) => s.trim()).filter((s) => s.length > 15);
      return "Summary:\n" + sentences.slice(0, 3).map((s, i) => `${i + 1}. ${s}`).join("\n");
    },

    async chat(question, emails) {
      await delay(500);
      const q = question.toLowerCase();
      if (q.includes("unread") || q.includes("new")) {
        const unread = emails.filter((e) => !e.read && e.folder === "inbox");
        return `You have ${unread.length} unread email(s).${unread.length > 0 ? " From: " + unread.map((e) => e.from_name).join(", ") : ""}`;
      }
      if (q.includes("triage") || q.includes("categor")) {
        const triaged = emails.filter((e) => e.folder === "inbox" && e.category);
        if (!triaged.length) return 'Click "Triage" to let me categorize your inbox.';
        return Object.keys(CATEGORIES).map((c) => { const n = triaged.filter((e) => e.category === c).length; return n ? `${CATEGORIES[c].label}: ${n}` : null; }).filter(Boolean).join(", ");
      }
      if (q.includes("respond") || q.includes("urgent")) {
        const respond = emails.filter((e) => e.folder === "inbox" && e.category === "respond");
        return respond.length ? `${respond.length} email(s) need your response:\n${respond.map((e) => `- "${e.subject}"`).join("\n")}` : "Nothing urgent right now.";
      }
      return "I can help with: inbox summary, triage status, finding emails, drafting replies. What do you need?";
    },
  };

  // ---------- AI Message Helper ----------
  function addAiMessage(text, role) {
    const div = document.createElement("div");
    div.className = "ai-msg " + role;
    div.textContent = text;
    dom.aiMessages.appendChild(div);
    dom.aiMessages.scrollTop = dom.aiMessages.scrollHeight;
  }

  // ---------- Event Listeners ----------

  // Folders
  dom.folders.forEach((folder) => {
    folder.addEventListener("click", () => {
      dom.folders.forEach((f) => f.classList.remove("active"));
      folder.classList.add("active");
      state.activeFolder = folder.dataset.folder;
      state.selectedId = null;
      showPanel("empty");
      renderMailList();
    });
  });

  // Account tabs
  document.querySelectorAll(".account-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".account-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      state.activeAccount = tab.dataset.account;
      state.selectedId = null;
      showPanel("empty");
      renderMailList();
    });
  });

  // Compose
  dom.composeBtn.addEventListener("click", () => {
    dom.composeTo.value = "";
    dom.composeSubject.value = "";
    dom.composeBody.value = "";
    state.attachments = [];
    renderAttachments();
    state.selectedId = null;
    renderMailList();
    showPanel("compose");
  });

  dom.closeCompose.addEventListener("click", () => showPanel("empty"));

  dom.composeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    sendWithUndo(dom.composeTo.value, dom.composeSubject.value || "(No subject)", dom.composeBody.value);
    showPanel("empty");
  });

  dom.saveDraftBtn.addEventListener("click", () => {
    state.emails.push({
      id: state.nextId++,
      from_name: "Me",
      from_address: "me@spodee.mail",
      to_address: dom.composeTo.value,
      subject: dom.composeSubject.value || "(No subject)",
      body: dom.composeBody.value,
      date: new Date().toISOString(),
      read: 1,
      starred: 0,
      folder: "drafts",
      account: dom.composeFrom?.value || "zoho-biz",
    });
    showPanel("empty");
    updateCounts();
  });

  dom.discardBtn.addEventListener("click", () => showPanel("empty"));

  // Undo send
  dom.undoSendBtn.addEventListener("click", undoSend);

  // File attachments
  dom.composeFile.addEventListener("change", (e) => {
    const files = Array.from(e.target.files);
    state.attachments.push(...files);
    renderAttachments();
  });

  dom.composeAttachments.addEventListener("click", (e) => {
    if (e.target.classList.contains("remove-attachment")) {
      state.attachments.splice(parseInt(e.target.dataset.index), 1);
      renderAttachments();
    }
  });

  // Search & Filter
  dom.searchInput.addEventListener("input", (e) => { state.searchQuery = e.target.value; renderMailList(); });
  dom.filterSelect.addEventListener("change", (e) => { state.filterMode = e.target.value; renderMailList(); });
  dom.refreshBtn.addEventListener("click", async () => {
    dom.refreshBtn.innerHTML = '<span class="ai-loading" style="width:12px;height:12px"></span>';
    const result = await api.sync();
    dom.refreshBtn.innerHTML = "&#8635;";
    if (result) addAiMessage(`Synced: ${JSON.stringify(result)}`, "assistant");
    renderMailList();
  });

  // Detail actions
  dom.starBtn.addEventListener("click", () => { if (state.selectedId) toggleStar(state.selectedId); });
  dom.vipBtn.addEventListener("click", () => { if (state.selectedId) toggleVip(state.selectedId); });
  dom.snoozeBtn.addEventListener("click", (e) => { e.stopPropagation(); showSnoozeDropdown(); });
  dom.deleteBtn.addEventListener("click", () => { if (state.selectedId) deleteEmail(state.selectedId); });
  dom.backBtn.addEventListener("click", () => { state.selectedId = null; showPanel("empty"); renderMailList(); });

  dom.replyBtn.addEventListener("click", () => {
    const email = state.emails.find((e) => e.id === state.selectedId);
    if (!email) return;
    dom.composeTo.value = email.from_address;
    dom.composeSubject.value = "Re: " + email.subject;
    dom.composeBody.value = "";
    state.attachments = [];
    renderAttachments();
    showPanel("compose");
  });

  // Templates
  dom.templateBtn.addEventListener("click", (e) => { e.stopPropagation(); showTemplateDropdown(); });

  // Tone buttons
  dom.toneButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      dom.toneButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.activeTone = btn.dataset.tone;
    });
  });

  // AI: Summarize
  dom.aiSummarizeBtn.addEventListener("click", async () => {
    const email = state.emails.find((e) => e.id === state.selectedId);
    if (!email) return;
    dom.aiResult.classList.remove("hidden");
    dom.aiResult.innerHTML = '<div class="ai-loading"></div> Summarizing...';
    const result = await api.aiSummarize(email.id);
    dom.aiResult.textContent = result?.summary || await localAi.summarize(email);
  });

  // AI: Suggest Reply
  dom.aiReplySuggestBtn.addEventListener("click", async () => {
    const email = state.emails.find((e) => e.id === state.selectedId);
    if (!email) return;
    dom.aiResult.classList.remove("hidden");
    dom.aiResult.innerHTML = '<div class="ai-loading"></div> Generating reply...';
    const result = await api.aiDraftReply(email.id, state.activeTone);
    const reply = result?.draft || await localAi.suggestReply(email, state.activeTone);
    dom.aiResult.textContent = reply;

    const useBtn = document.createElement("button");
    useBtn.className = "btn-ai";
    useBtn.style.marginTop = "8px";
    useBtn.textContent = "Use this reply";
    useBtn.addEventListener("click", () => {
      dom.composeTo.value = email.from_address;
      dom.composeSubject.value = "Re: " + email.subject;
      dom.composeBody.value = reply;
      showPanel("compose");
    });
    dom.aiResult.appendChild(document.createElement("br"));
    dom.aiResult.appendChild(useBtn);
  });

  // AI: Calendar detection
  dom.aiCalendarBtn.addEventListener("click", async () => {
    const email = state.emails.find((e) => e.id === state.selectedId);
    if (!email) return;
    dom.aiResult.classList.remove("hidden");
    dom.aiResult.innerHTML = '<div class="ai-loading"></div> Scanning for events...';
    const result = await api.aiDetectEvents(email.id);
    if (result?.events?.length) {
      dom.aiResult.textContent = "Events found:\n" + result.events.map((e) => `- ${e.title} on ${e.date}${e.time ? " at " + e.time : ""}`).join("\n");
    } else {
      dom.aiResult.textContent = "No calendar events detected in this email.";
    }
  });

  // AI: Draft
  dom.aiDraftBtn.addEventListener("click", async () => {
    const topic = dom.composeSubject.value || "general follow-up";
    dom.composeBody.value = "Drafting...";
    dom.composeBody.disabled = true;
    const result = await api.aiDraft(topic, state.activeTone);
    dom.composeBody.value = result?.draft || `Hi,\n\nFollowing up on ${topic}. Let me know if you have any updates.\n\nBest regards`;
    dom.composeBody.disabled = false;
  });

  // AI: Improve
  dom.aiImproveBtn.addEventListener("click", async () => {
    const text = dom.composeBody.value;
    if (!text.trim()) return;
    dom.composeBody.disabled = true;
    const result = await api.aiImprove(text, state.activeTone);
    dom.composeBody.value = result?.improved || text;
    dom.composeBody.disabled = false;
  });

  // AI Chat
  async function handleAiChat() {
    const question = dom.aiInput.value.trim();
    if (!question) return;
    addAiMessage(question, "user");
    dom.aiInput.value = "";

    const loadingDiv = document.createElement("div");
    loadingDiv.className = "ai-msg assistant";
    loadingDiv.innerHTML = '<div class="ai-loading"></div>';
    dom.aiMessages.appendChild(loadingDiv);

    const result = await api.aiChat(question);
    dom.aiMessages.removeChild(loadingDiv);
    addAiMessage(result?.response || await localAi.chat(question, state.emails), "assistant");
  }

  dom.aiSendBtn.addEventListener("click", handleAiChat);
  dom.aiInput.addEventListener("keydown", (e) => { if (e.key === "Enter") handleAiChat(); });

  // Triage
  dom.triageAllBtn.addEventListener("click", async () => {
    dom.triageAllBtn.disabled = true;
    dom.triageAllBtn.innerHTML = '<span class="ai-loading"></span>';
    const ids = state.emails.filter((e) => e.folder === "inbox" && !e.category).map((e) => e.id);
    const result = await api.aiTriage(ids);

    if (result) {
      result.forEach((r) => {
        const email = state.emails.find((e) => e.id === r.id);
        if (email) { email.category = r.category; email.ai_score = r.score; }
      });
    } else {
      await localAi.triageAll(state.emails);
    }

    dom.triageAllBtn.innerHTML = "&#10024; Triage";
    dom.triageAllBtn.disabled = false;
    updateCounts();
    renderMailList();
    addAiMessage("Inbox triaged! " + Object.keys(CATEGORIES).map((c) => {
      const n = state.emails.filter((e) => e.folder === "inbox" && e.category === c).length;
      return n ? `${CATEGORIES[c].label}: ${n}` : null;
    }).filter(Boolean).join(", "), "assistant");
  });

  // Category filter
  dom.triageCategories.forEach((el) => {
    el.addEventListener("click", () => {
      dom.triageCategories.forEach((c) => c.classList.remove("active"));
      el.classList.add("active");
      state.activeCategory = el.dataset.category;
      if (state.activeFolder !== "inbox") {
        state.activeFolder = "inbox";
        dom.folders.forEach((f) => f.classList.remove("active"));
        document.querySelector('[data-folder="inbox"]').classList.add("active");
      }
      state.selectedId = null;
      showPanel("empty");
      renderMailList();
    });
  });

  // Theme toggle
  dom.themeToggle.addEventListener("click", () => {
    const html = document.documentElement;
    const isDark = html.classList.contains("dark");
    html.classList.toggle("dark", !isDark);
    html.classList.toggle("light", isDark);
    dom.themeToggle.innerHTML = isDark ? "&#9788;" : "&#9790;";
  });

  // Share target
  function handleShareTarget() {
    const params = new URLSearchParams(window.location.search);
    const sharedTitle = params.get("title");
    const sharedText = params.get("text");
    const sharedUrl = params.get("url");
    if (sharedTitle || sharedText || sharedUrl) {
      let body = "";
      if (sharedText) body += sharedText;
      if (sharedUrl) body += (body ? "\n\n" : "") + sharedUrl;
      dom.composeTo.value = "";
      dom.composeSubject.value = sharedTitle || "Shared content";
      dom.composeBody.value = body;
      showPanel("compose");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
    if (e.key === "c") dom.composeBtn.click();
    else if (e.key === "Escape") { showPanel("empty"); state.selectedId = null; renderMailList(); }
    else if (e.key === "/") { e.preventDefault(); dom.searchInput.focus(); }
  });

  // Snooze wake-up check (every 30s)
  setInterval(() => {
    const now = new Date();
    state.emails.forEach((e) => {
      if (e.folder === "snoozed" && e.snoozed_until && new Date(e.snoozed_until) <= now) {
        e.folder = "inbox";
        e.snoozed_until = null;
      }
    });
    updateCounts();
    renderMailList();
  }, 30000);

  // ---------- Init ----------
  updateCounts();
  renderMailList();
  showPanel("empty");
  handleShareTarget();

  // Check if backend is available
  api.fetch("/accounts").then((result) => {
    if (result) {
      state.isOnline = true;
      addAiMessage("Mx online. Connected to backend.", "assistant");
    } else {
      addAiMessage("Running in local mode. Start the server for full features.", "assistant");
    }
  });
})();
