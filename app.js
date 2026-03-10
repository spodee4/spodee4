// ============================================================
// Mx — AI Chief of Staff Email Client (Native JS)
// Frontend with API backend + offline fallback
// Auth + Mobile + Push Notifications
// ============================================================

(function () {
  "use strict";

  // ---------- Auth ----------
  let authToken = localStorage.getItem("mx_token") || null;

  const loginScreen = document.getElementById("login-screen");
  const appDiv = document.getElementById("app");
  const loginForm = document.getElementById("login-form");
  const loginBtn = document.getElementById("login-btn");
  const loginError = document.getElementById("login-error");
  const loginNameField = document.getElementById("login-setup-name");
  const loginNameInput = document.getElementById("login-name");
  const loginPasswordInput = document.getElementById("login-password");

  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/setup-check", { credentials: "include" });
      const data = await res.json();

      if (data.needsSetup) {
        // First run — show setup mode
        loginNameField.classList.remove("hidden");
        loginBtn.textContent = "Create Account";
        loginScreen._isSetup = true;
      }

      // Try existing session
      const meRes = await fetch("/api/auth/me", {
        credentials: "include",
        headers: authToken ? { "x-auth-token": authToken } : {},
      });
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.user) {
          showApp();
          return;
        }
      }
    } catch (e) {
      // Server not available — go to local mode
      showApp();
      return;
    }
    // Show login
    loginScreen.classList.remove("hidden");
    appDiv.classList.add("hidden");
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.classList.add("hidden");
    const password = loginPasswordInput.value;

    try {
      const isSetup = loginScreen._isSetup;
      const endpoint = isSetup ? "/api/auth/register" : "/api/auth/login";
      const body = isSetup
        ? { password, displayName: loginNameInput.value || "John" }
        : { password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        loginError.textContent = data.error || "Login failed";
        loginError.classList.remove("hidden");
        return;
      }

      authToken = data.token;
      localStorage.setItem("mx_token", authToken);
      showApp();
    } catch (err) {
      loginError.textContent = "Server unavailable";
      loginError.classList.remove("hidden");
    }
  });

  function showApp() {
    loginScreen.classList.add("hidden");
    appDiv.classList.remove("hidden");
    initApp();
  }

  function logout() {
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    localStorage.removeItem("mx_token");
    authToken = null;
    appDiv.classList.add("hidden");
    loginScreen.classList.remove("hidden");
    loginPasswordInput.value = "";
  }

  // ---------- API Layer ----------
  const API_BASE = "/api";
  const api = {
    async fetch(path, opts = {}) {
      try {
        const headers = { "Content-Type": "application/json" };
        if (authToken) headers["x-auth-token"] = authToken;

        const res = await fetch(`${API_BASE}${path}`, {
          headers,
          credentials: "include",
          ...opts,
          body: opts.body ? JSON.stringify(opts.body) : undefined,
        });
        if (res.status === 401) { logout(); return null; }
        if (!res.ok) throw new Error(`API ${res.status}`);
        return res.json();
      } catch (err) {
        console.warn("API unavailable, using local mode:", err.message);
        return null;
      }
    },
    getEmails(params) { const q = new URLSearchParams(params).toString(); return this.fetch(`/emails?${q}`); },
    patchEmail(id, path, body) { return this.fetch(`/emails/${id}/${path}`, { method: "PATCH", body }); },
    sendEmail(data) { return this.fetch("/emails/send", { method: "POST", body: data }); },
    aiTriage(emailIds) { return this.fetch("/ai/triage", { method: "POST", body: { emailIds } }); },
    aiDraftReply(emailId, tone) { return this.fetch("/ai/draft-reply", { method: "POST", body: { emailId, tone } }); },
    aiSummarize(emailId) { return this.fetch("/ai/summarize", { method: "POST", body: { emailId } }); },
    aiImprove(text, tone) { return this.fetch("/ai/improve", { method: "POST", body: { text, tone } }); },
    aiDraft(prompt, tone) { return this.fetch("/ai/draft", { method: "POST", body: { prompt, tone } }); },
    aiChat(message) { return this.fetch("/ai/chat", { method: "POST", body: { message } }); },
    aiDetectEvents(emailId) { return this.fetch("/ai/detect-events", { method: "POST", body: { emailId } }); },
    aiExtractTasks(emailId) { return this.fetch("/ai/extract-tasks", { method: "POST", body: { emailId } }); },
    aiSuggestSchedule(emailId) { return this.fetch("/ai/suggest-schedule", { method: "POST", body: { emailId } }); },
    getTemplates() { return this.fetch("/templates"); },
    sync() { return this.fetch("/sync", { method: "POST" }); },
    // New Chief of Staff endpoints
    getThread(threadId) { return this.fetch(`/threads/${threadId}`); },
    analyzeThread(threadId) { return this.fetch(`/threads/${threadId}/analyze`, { method: "POST" }); },
    getTasks(params) { const q = new URLSearchParams(params || {}).toString(); return this.fetch(`/tasks?${q}`); },
    createTask(data) { return this.fetch("/tasks", { method: "POST", body: data }); },
    updateTask(id, data) { return this.fetch(`/tasks/${id}`, { method: "PATCH", body: data }); },
    getTasksToday() { return this.fetch("/tasks/today"); },
    getProjects(params) { const q = new URLSearchParams(params || {}).toString(); return this.fetch(`/projects?${q}`); },
    createProject(data) { return this.fetch("/projects", { method: "POST", body: data }); },
    getContacts(params) { const q = new URLSearchParams(params || {}).toString(); return this.fetch(`/contacts?${q}`); },
    getContact(email) { return this.fetch(`/contacts/${encodeURIComponent(email)}`); },
    analyzeContact(email) { return this.fetch(`/contacts/${encodeURIComponent(email)}/analyze`, { method: "POST" }); },
    getCalendarEvents(params) { const q = new URLSearchParams(params || {}).toString(); return this.fetch(`/calendar?${q}`); },
    getCalendarToday() { return this.fetch("/calendar/today"); },
    createCalendarEvent(data) { return this.fetch("/calendar", { method: "POST", body: data }); },
    getBriefing() { return this.fetch("/briefing"); },
    refreshBriefing() { return this.fetch("/briefing/refresh", { method: "POST" }); },
    getMemory() { return this.fetch("/memory"); },
  };

  // ---------- initApp — called after auth ----------
  let _appInitialized = false;
  function initApp() {
    if (_appInitialized) return;
    _appInitialized = true;

  // ---------- Sample Data (offline fallback — preserved) ----------
  const sampleEmails = [
    { id: 1, from_name: "Sarah Chen", from_address: "sarah@techcorp.io", to_address: "john@akinsfreshmarkets.com", subject: "Q1 Product Roadmap Review", body: "Hi team,\n\nI wanted to share the updated Q1 product roadmap for everyone's review. We've made some significant changes based on customer feedback from last quarter.\n\nKey highlights:\n- AI-powered search is moving to priority 1\n- Mobile redesign pushed to Q2\n- New onboarding flow launching Feb 15\n- API v3 deprecation timeline extended to March\n\nPlease review the attached document and share your feedback by end of week. We'll have a final review meeting next Monday at 2pm.\n\nLet me know if you have any questions.\n\nBest,\nSarah", date: "2026-03-10T09:30:00", read: 0, starred: 1, folder: "inbox", account: "zoho-biz", category: null, ai_score: null, is_vip: false, thread_id: "thread-1" },
    { id: 2, from_name: "GitHub", from_address: "noreply@github.com", to_address: "john@akinsfreshmarkets.com", subject: "[spodee4] Pull Request #42: Add real-time notifications", body: "@devops-bot opened a pull request in spodee4/spodee4:\n\n#42 Add real-time notifications\n\nThis PR adds WebSocket-based real-time notifications to the platform.\n\nReviewers: @sarah-chen, @mike-johnson\nLabels: feature, needs-review\nCI: All checks passing", date: "2026-03-10T08:15:00", read: 0, starred: 0, folder: "inbox", account: "zoho-biz", category: null, ai_score: null, is_vip: false },
    { id: 3, from_name: "Mike Johnson", from_address: "mike@designlab.co", to_address: "john@akinsfreshmarkets.com", subject: "Re: Brand refresh concepts", body: "Hey!\n\nI've finished the three brand refresh concepts we discussed. Here's a quick summary:\n\nConcept A - Modern Minimal\nConcept B - Vibrant Energy\nConcept C - Trust & Clarity\n\nMy recommendation is Concept A with some warmth borrowed from C.\n\nWant to hop on a call tomorrow to walk through them?\n\nCheers,\nMike", date: "2026-03-09T16:45:00", read: 1, starred: 0, folder: "inbox", account: "zoho-biz", category: null, ai_score: null, is_vip: true, thread_id: "thread-2" },
    { id: 4, from_name: "John Akins", from_address: "john@akinsfreshmarkets.com", to_address: "team@akinsfreshmarkets.com", subject: "Sprint planning notes - Week 11", body: "Team,\n\nHere are the notes from today's sprint planning:\n\nCompleted last sprint:\n- User authentication refactor\n- Dashboard performance optimization\n\nThis sprint's priorities:\n1. AI mail assistant integration\n2. Email template builder v2\n3. Analytics dashboard redesign\n\nThanks,\nJohn", date: "2026-03-09T11:00:00", read: 1, starred: 0, folder: "sent", account: "zoho-biz" },
    { id: 5, from_name: "AWS", from_address: "no-reply@aws.amazon.com", to_address: "john@akinsfreshmarkets.com", subject: "Your February billing statement is ready", body: "Hello,\n\nYour AWS billing statement for February 2026 is now available.\n\nAccount: akins-production\nTotal charges: $1,247.83\n\nView your detailed billing dashboard in the AWS Console.\n\nAmazon Web Services", date: "2026-03-08T06:00:00", read: 1, starred: 1, folder: "inbox", account: "zoho-biz" },
    { id: 6, from_name: "Indie Hackers", from_address: "digest@indiehackers.com", to_address: "john@gmail.com", subject: "Weekly Digest: Top stories from the community", body: "This week on Indie Hackers:\n\n1. How I grew my SaaS to $10K MRR\n2. The SEO strategy that tripled our traffic\n3. Why I switched from React to HTMX\n\nTo unsubscribe from this digest, click here.", date: "2026-03-07T14:00:00", read: 1, starred: 0, folder: "inbox", account: "gmail" },
    { id: 7, from_name: "Lisa Park", from_address: "lisa@clientco.com", to_address: "john@akinsfreshmarkets.com", subject: "Re: Project timeline update", body: "Hi,\n\nThanks for the update. We're aligned on the new dates.\n\nOne thing - we're still waiting on the API documentation from your side. Could you have someone send that over by Wednesday?\n\nBest,\nLisa", date: "2026-03-09T10:20:00", read: 0, starred: 0, folder: "inbox", account: "zoho-biz", thread_id: "thread-3" },
    { id: 8, from_name: "Stripe", from_address: "receipts@stripe.com", to_address: "john@akinsfreshmarkets.com", subject: "Your receipt from Akins Fresh Markets - $299.00", body: "Receipt from Stripe\n\nAmount: $299.00\nDate: March 7, 2026\nDescription: Pro Plan - Monthly subscription\nCard: Visa ending in 4242", date: "2026-03-07T09:00:00", read: 1, starred: 0, folder: "inbox", account: "zoho-biz" },
    { id: 9, from_name: "Contact Form", from_address: "contact@akinsfreshmarkets.com", to_address: "info@akinsfreshmarkets.com", subject: "New inquiry from website", body: "New contact form submission:\n\nName: David Kim\nEmail: david@startup.io\nMessage: Hi, I'm interested in your enterprise plan. Can we schedule a demo call this week?\n\nSubmitted via akinsfreshmarkets.com contact form", date: "2026-03-10T07:00:00", read: 0, starred: 0, folder: "inbox", account: "zoho-web" },
    { id: 10, from_name: "Mom", from_address: "mom@gmail.com", to_address: "john@gmail.com", subject: "Dinner Sunday?", body: "Hey sweetie,\n\nAre you free for dinner this Sunday? Dad wants to try that new Italian place on Main Street.\n\nLet me know!\nLove, Mom", date: "2026-03-09T19:30:00", read: 0, starred: 0, folder: "inbox", account: "gmail" },
  ];

  // ---------- Sample Tasks (offline) ----------
  const sampleTasks = [
    { id: 1, title: "Review Q1 product roadmap", priority: "high", status: "pending", due_date: "2026-03-14", assigned_to: "John", source: "Email: Q1 Product Roadmap Review" },
    { id: 2, title: "Send API documentation to Lisa", priority: "high", status: "pending", due_date: "2026-03-12", assigned_to: "John", source: "Email: Re: Project timeline update" },
    { id: 3, title: "Schedule demo call with David Kim", priority: "medium", status: "pending", due_date: "2026-03-14", assigned_to: "John", source: "Email: New inquiry from website" },
    { id: 4, title: "Review brand refresh concepts with Mike", priority: "medium", status: "pending", due_date: "2026-03-11", assigned_to: "John", source: "Email: Re: Brand refresh concepts" },
    { id: 5, title: "Review PR #42 notifications", priority: "low", status: "pending", due_date: null, assigned_to: "John", source: "Email: Pull Request #42" },
  ];

  // ---------- Sample Contacts (offline) ----------
  const sampleContacts = [
    { email: "sarah@techcorp.io", name: "Sarah Chen", role: "Product Manager", company: "TechCorp", relationship_score: 82, email_count: 24, last_contact: "2026-03-10T09:30:00", is_vip: 0, topics: ["roadmap", "product", "features"] },
    { email: "mike@designlab.co", name: "Mike Johnson", role: "Creative Director", company: "DesignLab", relationship_score: 91, email_count: 45, last_contact: "2026-03-09T16:45:00", is_vip: 1, topics: ["branding", "design", "refresh"] },
    { email: "lisa@clientco.com", name: "Lisa Park", role: "Account Manager", company: "ClientCo", relationship_score: 68, email_count: 15, last_contact: "2026-03-09T10:20:00", is_vip: 0, topics: ["project", "timeline", "API docs"] },
    { email: "david@startup.io", name: "David Kim", role: "Founder", company: "Startup.io", relationship_score: 20, email_count: 1, last_contact: "2026-03-10T07:00:00", is_vip: 0, topics: ["enterprise", "demo"] },
    { email: "mom@gmail.com", name: "Mom", role: "Family", company: null, relationship_score: 99, email_count: 120, last_contact: "2026-03-09T19:30:00", is_vip: 1, topics: ["family", "dinner"] },
  ];

  // ---------- Sample Calendar Events ----------
  const sampleEvents = [
    { id: 1, title: "Roadmap Review Meeting", date: "2026-03-10", time: "14:00", end_time: "15:00", description: "Final Q1 roadmap review with Sarah", location: null, meeting_url: null },
    { id: 2, title: "Brand Concepts Call", date: "2026-03-11", time: "10:00", end_time: "11:00", description: "Walk through brand refresh concepts with Mike", location: null, meeting_url: null },
    { id: 3, title: "Deep Work Block", date: "2026-03-10", time: "09:00", end_time: "11:00", description: "Protected deep work time", location: null, meeting_url: null },
  ];


  // ---------- Category Config (Dan Martel Email GPS — preserved) ----------
  const CATEGORIES = {
    respond:    { label: "Respond",    color: "var(--star)",    icon: "!" },
    review:     { label: "Review",     color: "var(--chart-1)", icon: "?" },
    waiting:    { label: "Waiting On", color: "var(--chart-3)", icon: "\u23F3" },
    receipts:   { label: "Receipts",   color: "var(--chart-2)", icon: "$" },
    newsletter: { label: "Newsletter", color: "var(--text-dim)", icon: "\u2709" },
    fyi:        { label: "FYI",        color: "var(--chart-4)", icon: "i" },
  };

  // ---------- Email Templates (preserved) ----------
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
    tasks: JSON.parse(JSON.stringify(sampleTasks)),
    contacts: JSON.parse(JSON.stringify(sampleContacts)),
    calendarEvents: JSON.parse(JSON.stringify(sampleEvents)),
    activeFolder: "inbox",
    activeCategory: "all",
    activeAccount: "all",
    activeView: "mail",
    selectedId: null,
    selectedTaskId: null,
    selectedContactEmail: null,
    searchQuery: "",
    filterMode: "all",
    activeTone: "professional",
    nextId: 100,
    nextTaskId: 100,
    undoTimer: null,
    undoEmail: null,
    attachments: [],
    templates: defaultTemplates,
    vipContacts: new Set(["mike@designlab.co", "mom@gmail.com"]),
    isOnline: false,
    briefingData: null,
    calendarDate: new Date().toISOString().split("T")[0],
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
    aiExtractTasksBtn: $("#ai-extract-tasks-btn"),
    aiScheduleBtn: $("#ai-schedule-btn"),
    aiContactBtn: $("#ai-contact-btn"),
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
    themeToggle: $("#theme-toggle"),
    undoToast: $("#undo-toast"),
    undoSendBtn: $("#undo-send-btn"),
    undoProgressBar: $("#undo-progress-bar"),
    toneButtons: $$(".tone-btn"),
    // New views
    viewTabs: $$(".view-tab"),
    mailListPanel: $("#mail-list-panel"),
    briefingView: $("#briefing-view"),
    briefingContent: $("#briefing-content"),
    briefingGreeting: $("#briefing-greeting"),
    refreshBriefingBtn: $("#refresh-briefing-btn"),
    tasksView: $("#tasks-view"),
    tasksList: $("#tasks-list"),
    taskFilter: $("#task-filter"),
    addTaskBtn: $("#add-task-btn"),
    contactsView: $("#contacts-view"),
    contactsList: $("#contacts-list"),
    contactSort: $("#contact-sort"),
    calendarView: $("#calendar-view"),
    calendarEvents: $("#calendar-events"),
    calDateLabel: $("#cal-date-label"),
    calPrev: $("#cal-prev"),
    calNext: $("#cal-next"),
    // Thread
    threadSummaryCard: $("#thread-summary-card"),
    threadTopic: $("#thread-topic"),
    threadHealth: $("#thread-health"),
    threadStarted: $("#thread-started"),
    threadParticipants: $("#thread-participants"),
    threadDecisions: $("#thread-decisions"),
    threadDecisionsList: $("#thread-decisions-list"),
    threadOpenItems: $("#thread-open-items"),
    threadOpenItemsList: $("#thread-open-items-list"),
    threadSuggestedAction: $("#thread-suggested-action"),
    threadTimeline: $("#thread-timeline"),
    timelineMessages: $("#timeline-messages"),
    analyzeThreadBtn: $("#analyze-thread-btn"),
    detailContent: $("#detail-content"),
    // Task detail
    taskDetail: $("#task-detail"),
    taskBackBtn: $("#task-back-btn"),
    taskTitleInput: $("#task-title-input"),
    taskDescInput: $("#task-desc-input"),
    taskPriorityInput: $("#task-priority-input"),
    taskDueInput: $("#task-due-input"),
    taskAssignedInput: $("#task-assigned-input"),
    taskStatusInput: $("#task-status-input"),
    taskSource: $("#task-source"),
    saveTaskBtn: $("#save-task-btn"),
    completeTaskBtn: $("#complete-task-btn"),
    // Contact detail
    contactDetail: $("#contact-detail"),
    contactBackBtn: $("#contact-back-btn"),
    contactName: $("#contact-name"),
    contactAvatar: $("#contact-avatar"),
    contactEmailDisplay: $("#contact-email-display"),
    contactRole: $("#contact-role"),
    contactCompany: $("#contact-company"),
    contactScore: $("#contact-score"),
    contactEmailCount: $("#contact-email-count"),
    contactLastContact: $("#contact-last-contact"),
    contactFirstContact: $("#contact-first-contact"),
    contactTopics: $("#contact-topics"),
    contactNotes: $("#contact-notes"),
    contactRecentEmails: $("#contact-recent-emails"),
    analyzeContactBtn: $("#analyze-contact-btn"),
    contactVipToggle: $("#contact-vip-toggle"),
    // Notifications
    notificationToast: $("#notification-toast"),
    notificationTitle: $("#notification-title"),
    notificationMessage: $("#notification-message"),
    notificationClose: $("#notification-close"),
    triageSection: $("#triage-section"),
  };

  // ---------- Helpers ----------
  function formatDate(iso) {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function formatRelativeDate(iso) {
    if (!iso) return "--";
    const d = new Date(iso);
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
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

  function getInitials(name) {
    if (!name) return "?";
    return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  }

  function showNotification(title, message, duration) {
    dom.notificationTitle.textContent = title;
    dom.notificationMessage.textContent = message;
    dom.notificationToast.classList.remove("hidden");
    if (duration !== 0) {
      setTimeout(() => dom.notificationToast.classList.add("hidden"), duration || 4000);
    }
  }

  // ---------- Get Visible Emails (preserved) ----------
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

  // ---------- Update Counts (preserved) ----------
  function updateCounts() {
    const inbox = state.emails.filter((e) => e.folder === "inbox");
    const unread = inbox.filter((e) => !e.read).length;
    dom.inboxCount.textContent = unread;
    dom.inboxCount.classList.toggle("hidden", unread === 0);

    const snoozed = state.emails.filter((e) => e.folder === "snoozed").length;
    dom.snoozedCount.textContent = snoozed;
    dom.snoozedCount.classList.toggle("hidden", snoozed === 0);

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

  // ---------- Render Mail List (preserved) ----------
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
        if (e.target.classList.contains("mail-item-star")) { toggleStar(email.id); return; }
        selectEmail(email.id);
      });

      dom.mailList.appendChild(li);
    });
  }

  // ---------- Select Email (enhanced with thread support) ----------
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

    if (email.category && CATEGORIES[email.category]) {
      const cat = CATEGORIES[email.category];
      dom.detailCategoryBar.innerHTML = `<span class="detail-cat-tag mail-item-category" data-cat="${email.category}">${cat.icon} ${cat.label}</span>`;
    } else {
      dom.detailCategoryBar.innerHTML = "";
    }

    if (email.ai_score) {
      dom.detailScoreBar.innerHTML = `<span class="mail-item-score" style="font-size:12px;padding:3px 8px;">Importance: ${email.ai_score}/10</span>`;
    } else {
      dom.detailScoreBar.innerHTML = "";
    }

    // Thread handling
    if (email.thread_id) {
      const threadEmails = state.emails.filter(e => e.thread_id === email.thread_id).sort((a, b) => new Date(a.date) - new Date(b.date));
      if (threadEmails.length > 1) {
        renderThreadTimeline(threadEmails);
        dom.threadTimeline.classList.remove("hidden");
        dom.threadSummaryCard.classList.remove("hidden");
        dom.detailContent.classList.add("hidden");
      } else {
        dom.threadTimeline.classList.add("hidden");
        dom.threadSummaryCard.classList.add("hidden");
        dom.detailContent.classList.remove("hidden");
      }
    } else {
      dom.threadTimeline.classList.add("hidden");
      dom.threadSummaryCard.classList.add("hidden");
      dom.detailContent.classList.remove("hidden");
    }

    dom.aiResult.classList.add("hidden");
    dom.aiResult.textContent = "";
    showPanel("detail");
    // Show detail panel on mobile
    if (window.innerWidth <= 900) dom.detailPanel.classList.add("visible");
    updateCounts();
    renderMailList();
  }

  // ---------- Render Thread Timeline (NEW) ----------
  function renderThreadTimeline(emails) {
    dom.timelineMessages.innerHTML = "";
    const userAddress = "john@akinsfreshmarkets.com";
    const participantColors = {};
    const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
    let colorIdx = 0;

    // Thread summary card defaults
    dom.threadTopic.textContent = emails[0].subject.replace(/^(Re:|Fwd:)\s*/i, "");
    dom.threadHealth.innerHTML = "&#128994;";
    dom.threadStarted.textContent = `${formatDate(emails[0].date)} by ${emails[0].from_name}`;
    const participants = [...new Set(emails.map(e => e.from_name))];
    dom.threadParticipants.textContent = participants.join(", ");

    // Reset sections
    dom.threadDecisions.classList.add("hidden");
    dom.threadOpenItems.classList.add("hidden");
    dom.threadSuggestedAction.classList.add("hidden");
    dom.threadDecisionsList.innerHTML = "";
    dom.threadOpenItemsList.innerHTML = "";

    // Detect ack messages
    const ackPatterns = /^(thanks!?|thank you!?|sounds good!?|got it!?|ok!?|okay!?|perfect!?|great!?|will do!?)[\s.!]*$/i;
    let ackCount = 0;
    const ackIndices = [];

    emails.forEach((email, idx) => {
      const body = (email.body || "").trim();
      if (ackPatterns.test(body.split("\n")[0])) {
        ackIndices.push(idx);
        ackCount++;
      }
    });

    // Render messages
    emails.forEach((email, idx) => {
      const isSelf = email.from_address === userAddress;
      const addr = email.from_address;
      if (!participantColors[addr]) {
        participantColors[addr] = colors[colorIdx % colors.length];
        colorIdx++;
      }

      // Collapse ack messages
      if (ackIndices.includes(idx)) {
        if (ackIndices[0] === idx && ackCount > 0) {
          const pill = document.createElement("div");
          pill.className = "timeline-ack-pill";
          pill.textContent = `${ackCount} acknowledgment${ackCount > 1 ? "s" : ""} — click to expand`;
          pill.dataset.expanded = "false";
          pill.addEventListener("click", () => {
            const expanded = pill.dataset.expanded === "true";
            pill.dataset.expanded = expanded ? "false" : "true";
            pill.parentElement.querySelectorAll(".timeline-msg.ack-msg").forEach(m => {
              m.classList.toggle("hidden", expanded);
            });
            pill.textContent = expanded
              ? `${ackCount} acknowledgment${ackCount > 1 ? "s" : ""} — click to expand`
              : `${ackCount} acknowledgment${ackCount > 1 ? "s" : ""} — click to collapse`;
          });
          dom.timelineMessages.appendChild(pill);
        }

        const msgDiv = document.createElement("div");
        msgDiv.className = `timeline-msg ${isSelf ? "msg-self" : ""} ack-msg hidden`;
        msgDiv.style.borderLeftColor = participantColors[addr];
        msgDiv.innerHTML = `
          <div class="timeline-msg-header">
            <span class="timeline-sender" style="color:${participantColors[addr]}">${escapeHtml(email.from_name)}</span>
            <span class="timeline-time">${formatDate(email.date)}</span>
          </div>
          <div class="timeline-body">${escapeHtml(email.body || "")}</div>
        `;
        dom.timelineMessages.appendChild(msgDiv);
        return;
      }

      const roleBadge = isSelf ? "YOU" : "EXTERNAL";
      const roleClass = isSelf ? "role-you" : "role-external";

      // Strip quoted replies and signatures
      let body = email.body || "";
      body = body.replace(/^>.*$/gm, "").replace(/--\s*\n[\s\S]*$/, "").replace(/\n{3,}/g, "\n\n").trim();

      const msgDiv = document.createElement("div");
      msgDiv.className = `timeline-msg ${isSelf ? "msg-self" : ""}`;
      msgDiv.style.borderLeftColor = participantColors[addr];
      msgDiv.innerHTML = `
        <div class="timeline-msg-header">
          <span class="timeline-sender" style="color:${participantColors[addr]}">${escapeHtml(email.from_name)}</span>
          <span class="timeline-role-badge ${roleClass}">${roleBadge}</span>
          <span class="timeline-time">${formatDate(email.date)}</span>
        </div>
        <div class="timeline-body">${escapeHtml(body)}</div>
      `;
      dom.timelineMessages.appendChild(msgDiv);
    });
  }

  // ---------- Show Panel (enhanced) ----------
  function showPanel(panel) {
    dom.mailDetail.classList.add("hidden");
    dom.composePanel.classList.add("hidden");
    dom.emptyState.classList.add("hidden");
    dom.taskDetail.classList.add("hidden");
    dom.contactDetail.classList.add("hidden");

    if (panel === "detail") {
      dom.mailDetail.classList.remove("hidden");
      dom.aiSummaryBar.classList.remove("hidden");
      dom.detailPanel.classList.add("visible");
    } else if (panel === "compose") {
      dom.composePanel.classList.remove("hidden");
      dom.aiSummaryBar.classList.add("hidden");
      dom.detailPanel.classList.add("visible");
    } else if (panel === "task-detail") {
      dom.taskDetail.classList.remove("hidden");
      dom.aiSummaryBar.classList.add("hidden");
      dom.detailPanel.classList.add("visible");
    } else if (panel === "contact-detail") {
      dom.contactDetail.classList.remove("hidden");
      dom.aiSummaryBar.classList.add("hidden");
      dom.detailPanel.classList.add("visible");
    } else {
      dom.emptyState.classList.remove("hidden");
      dom.aiSummaryBar.classList.add("hidden");
      dom.detailPanel.classList.remove("visible");
    }
  }

  // ---------- Actions (preserved) ----------
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
    if (isVip) { state.vipContacts.delete(email.from_address); }
    else { state.vipContacts.add(email.from_address); }
    api.patchEmail(id, "vip", { vip: !isVip });
    dom.vipBtn.innerHTML = !isVip ? "&#9826; VIP" : "&#9826;";
    dom.vipBtn.style.color = !isVip ? "var(--star)" : "";
    renderMailList();
  }

  function deleteEmail(id) {
    const email = state.emails.find((e) => e.id === id);
    if (!email) return;
    if (email.folder === "trash") { state.emails = state.emails.filter((e) => e.id !== id); }
    else { email.folder = "trash"; }
    api.patchEmail(id, "move", { folder: "trash" });
    state.selectedId = null;
    showPanel("empty");
    updateCounts();
    renderMailList();
  }

  // ---------- Snooze (preserved) ----------
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
      btn.addEventListener("click", () => { snoozeEmail(state.selectedId, opt.hours); dropdown.remove(); });
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

  // ---------- Send with Undo (preserved) ----------
  function sendWithUndo(to, subject, body) {
    const email = {
      id: state.nextId++,
      from_name: "John Akins",
      from_address: "john@akinsfreshmarkets.com",
      to_address: to,
      subject: subject || "(No subject)",
      body: body,
      date: new Date().toISOString(),
      read: 1, starred: 0,
      folder: "sent",
      account: dom.composeFrom?.value || "zoho-biz",
    };
    state.undoEmail = email;
    dom.undoToast.classList.remove("hidden");
    dom.undoProgressBar.style.width = "100%";
    let elapsed = 0;
    const total = 10000;
    const interval = setInterval(() => {
      elapsed += 100;
      dom.undoProgressBar.style.width = `${100 - (elapsed / total) * 100}%`;
    }, 100);
    state.undoTimer = setTimeout(() => {
      clearInterval(interval);
      state.emails.push(email);
      api.sendEmail({ from_account: email.account, to: email.to_address, subject: email.subject, body: email.body, attachments: state.attachments });
      state.undoEmail = null;
      state.attachments = [];
      dom.undoToast.classList.add("hidden");
      updateCounts();
      renderMailList();
    }, total);
  }

  function undoSend() {
    if (state.undoTimer) { clearTimeout(state.undoTimer); state.undoTimer = null; }
    state.undoEmail = null;
    dom.undoToast.classList.add("hidden");
    showPanel("compose");
  }

  // ---------- File Attachments (preserved) ----------
  function renderAttachments() {
    dom.composeAttachments.innerHTML = "";
    state.attachments.forEach((file, i) => {
      const chip = document.createElement("span");
      chip.className = "attachment-chip";
      chip.innerHTML = `&#128206; ${escapeHtml(file.name)} (${(file.size / 1024).toFixed(1)}KB) <span class="remove-attachment" data-index="${i}">&times;</span>`;
      dom.composeAttachments.appendChild(chip);
    });
  }

  // ---------- Templates (preserved) ----------
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
      if (!dropdown.contains(e.target) && e.target !== dom.templateBtn) { dropdown.remove(); document.removeEventListener("click", close); }
    }), 0);
  }

  // ---------- AI Engine — Local Fallback (preserved + enhanced) ----------
  const localAi = {
    categorize(email) {
      const from = (email.from_address || "").toLowerCase();
      const subject = (email.subject || "").toLowerCase();
      const body = (email.body || "").toLowerCase();
      if (/receipt|invoice|billing|statement|payment|charge|subscription|stripe|paypal/.test(subject + " " + body) || /no-reply|noreply|receipts@|billing@|payments@/.test(from)) return "receipts";
      if (/unsubscribe|digest|weekly|newsletter|roundup/.test(body) || /newsletter|digest|weekly|substack|mailchimp/.test(from)) return "newsletter";
      if (/waiting on|waiting for|pending|follow up|following up|circle back/.test(body) && /could you|can you|send.*over|by (monday|tuesday|wednesday|thursday|friday|end of|eod|eow)/.test(body)) return "waiting";
      if (/\?/.test(subject) || /(could you|can you|would you|please.*send|please.*review|please.*confirm|let me know|what do you think|your thoughts|hop on a call|schedule|rsvp|action required)/i.test(body)) return "respond";
      if (/pull request|review|pr #|needs.review|code review|please review|take a look/.test(subject + " " + body) || /roadmap|update|report|summary|highlights|key changes/.test(body)) return "review";
      return "fyi";
    },
    async triageAll(emails) {
      const toTriage = emails.filter((e) => e.folder === "inbox" && !e.category);
      for (const email of toTriage) {
        await delay(150);
        email.category = this.categorize(email);
        email.ai_score = Math.floor(Math.random() * 4) + 5;
        if (email.category === "respond") email.ai_score = Math.floor(Math.random() * 2) + 8;
        if (email.category === "newsletter") email.ai_score = Math.floor(Math.random() * 3) + 1;
      }
      return toTriage.length;
    },
    async suggestReply(email, tone) {
      await delay(800);
      const name = (email.from_name || "").split(" ")[0];
      const tones = {
        professional: `Hi ${name},\n\nThank you for reaching out. I've reviewed your message and appreciate the update.\n\nI'll follow up with more details shortly.\n\nBest regards,\nJohn`,
        friendly: `Hey ${name}!\n\nThanks for sending this over! Looks great. Let me take a closer look and I'll get back to you.\n\nCheers,\nJohn`,
        formal: `Dear ${name},\n\nThank you for your correspondence. I acknowledge receipt and will review the matter at my earliest convenience.\n\nKind regards,\nJohn Akins`,
        brief: `Thanks ${name}, noted. Will follow up soon.\n\n— John`,
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
      if (q.includes("brief") || q.includes("morning")) {
        return "Opening your morning briefing now...";
      }
      if (q.includes("task")) {
        const pending = state.tasks.filter(t => t.status === "pending");
        return `You have ${pending.length} pending task(s):\n${pending.map(t => `- [${t.priority}] ${t.title}`).join("\n")}`;
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
      if (q.includes("schedule") || q.includes("calendar") || q.includes("meeting")) {
        return `Today's events:\n${state.calendarEvents.filter(e => e.date === new Date().toISOString().split("T")[0]).map(e => `- ${e.time || "TBD"}: ${e.title}`).join("\n") || "No events today."}`;
      }
      if (q.includes("contact") || q.includes("relationship")) {
        const stale = state.contacts.filter(c => {
          const days = Math.floor((Date.now() - new Date(c.last_contact).getTime()) / 86400000);
          return days > 7 && c.is_vip;
        });
        return stale.length ? `Relationship nudges:\n${stale.map(c => `- ${c.name}: last contact ${formatRelativeDate(c.last_contact)}`).join("\n")}` : "All key relationships look healthy.";
      }
      return "I can help with: inbox summary, triage status, tasks, calendar, contacts, morning briefing. What do you need?";
    },
  };

  // ---------- AI Message Helper (preserved) ----------
  function addAiMessage(text, role) {
    const div = document.createElement("div");
    div.className = "ai-msg " + role;
    div.textContent = text;
    dom.aiMessages.appendChild(div);
    dom.aiMessages.scrollTop = dom.aiMessages.scrollHeight;
  }

  // ============================================================
  // NEW VIEW RENDERERS
  // ============================================================

  // ---------- Switch View ----------
  function switchView(view) {
    state.activeView = view;

    // Toggle mail-list vs special views
    dom.mailList.classList.toggle("hidden", view !== "mail");
    $(".mail-list-header").classList.toggle("hidden", view !== "mail");
    dom.briefingView.classList.toggle("hidden", view !== "briefing");
    dom.tasksView.classList.toggle("hidden", view !== "tasks");
    dom.contactsView.classList.toggle("hidden", view !== "contacts");
    dom.calendarView.classList.toggle("hidden", view !== "calendar");
    dom.triageSection.classList.toggle("hidden", view !== "mail");

    dom.viewTabs.forEach(t => t.classList.toggle("active", t.dataset.view === view));

    if (view === "briefing") renderBriefing();
    else if (view === "tasks") renderTasks();
    else if (view === "contacts") renderContacts();
    else if (view === "calendar") renderCalendar();
    else { renderMailList(); }

    showPanel("empty");
  }

  // ---------- Render Morning Briefing ----------
  async function renderBriefing() {
    dom.briefingContent.innerHTML = '<div class="briefing-loading"><div class="ai-loading"></div><span>Preparing your briefing...</span></div>';

    const now = new Date();
    const dayName = now.toLocaleDateString([], { weekday: "long" });
    const dateStr = now.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });

    // Try API
    const data = await api.getBriefing();
    if (data && data.greeting) {
      state.briefingData = data;
    } else {
      // Build local briefing
      const inbox = state.emails.filter(e => e.folder === "inbox");
      const unread = inbox.filter(e => !e.read);
      const urgent = inbox.filter(e => e.category === "respond" && !e.read);
      const actionNeeded = inbox.filter(e => e.category === "review" && !e.read);
      const todayEvents = state.calendarEvents.filter(e => e.date === now.toISOString().split("T")[0]);
      const tasksDue = state.tasks.filter(t => t.status === "pending" && t.due_date && t.due_date <= now.toISOString().split("T")[0]);
      const staleContacts = state.contacts.filter(c => {
        const days = Math.floor((Date.now() - new Date(c.last_contact).getTime()) / 86400000);
        return days > 7 && (c.is_vip || c.relationship_score > 70);
      });

      state.briefingData = {
        greeting: `Good Morning \u2014 ${dayName}, ${dateStr}`,
        inbox: { new: unread.length, need_attention: urgent.length + actionNeeded.length },
        urgent: urgent.map(e => ({ from: e.from_name, subject: e.subject, summary: (e.body || "").substring(0, 80), action: "Review and respond" })),
        action_needed: actionNeeded.map(e => ({ from: e.from_name, subject: e.subject, summary: (e.body || "").substring(0, 80) })),
        schedule: todayEvents.map(e => ({ time: e.time || "TBD", title: e.title, with: e.description || "" })),
        tasks_due: tasksDue.map(t => ({ title: t.title, priority: t.priority })),
        nudges: staleContacts.map(c => ({ contact: c.name || c.email, reason: `Last contact: ${formatRelativeDate(c.last_contact)}` })),
        ai_suggestion: urgent.length > 0 ? `Prioritize responding to ${urgent[0].from_name}'s email about "${urgent[0].subject}"` : "Your inbox looks manageable today. Focus on deep work.",
      };
    }

    const b = state.briefingData;
    dom.briefingGreeting.textContent = b.greeting || `Good Morning \u2014 ${dayName}, ${dateStr}`;

    let html = "";

    // Inbox summary
    html += `<div class="briefing-section">
      <div class="briefing-section-header">
        <span class="briefing-section-icon">\u{1F4EC}</span>
        <span class="briefing-section-title">Inbox</span>
        <span class="briefing-section-count">${b.inbox?.new || 0} new \u2014 ${b.inbox?.need_attention || 0} need attention</span>
      </div>`;

    // Urgent
    if (b.urgent?.length) {
      html += `<div style="margin-bottom:8px;font-size:11px;font-weight:700;color:var(--danger);text-transform:uppercase;letter-spacing:0.5px;">Urgent (respond today)</div>`;
      b.urgent.forEach(item => {
        html += `<div class="briefing-item">
          <div class="briefing-item-content">
            <div class="briefing-item-from">${escapeHtml(item.from || "")}</div>
            <div class="briefing-item-subject">${escapeHtml(item.subject || "")}</div>
            <div class="briefing-item-action">\u2192 ${escapeHtml(item.action || item.summary || "")}</div>
          </div>
        </div>`;
      });
    }

    // Action needed
    if (b.action_needed?.length) {
      html += `<div style="margin-top:12px;margin-bottom:8px;font-size:11px;font-weight:700;color:var(--warning);text-transform:uppercase;letter-spacing:0.5px;">Action Needed (this week)</div>`;
      b.action_needed.forEach(item => {
        html += `<div class="briefing-item">
          <div class="briefing-item-content">
            <div class="briefing-item-from">${escapeHtml(item.from || "")}</div>
            <div class="briefing-item-subject">${escapeHtml(item.subject || "")}</div>
          </div>
        </div>`;
      });
    }
    html += `</div>`;

    // Schedule
    html += `<div class="briefing-section">
      <div class="briefing-section-header">
        <span class="briefing-section-icon">\u{1F4C5}</span>
        <span class="briefing-section-title">Today's Schedule</span>
      </div>`;
    if (b.schedule?.length) {
      b.schedule.forEach(item => {
        html += `<div class="briefing-item">
          <div class="briefing-item-content">
            <div class="briefing-item-from">${escapeHtml(item.time || "TBD")} \u2014 ${escapeHtml(item.title || "")}</div>
            <div class="briefing-item-subject">${escapeHtml(item.with || "")}</div>
          </div>
        </div>`;
      });
    } else {
      html += `<div style="padding:12px;color:var(--text-dim);font-size:13px;">No events scheduled for today.</div>`;
    }
    html += `</div>`;

    // Tasks
    if (b.tasks_due?.length) {
      html += `<div class="briefing-section">
        <div class="briefing-section-header">
          <span class="briefing-section-icon">\u2705</span>
          <span class="briefing-section-title">Tasks Due Today</span>
        </div>`;
      b.tasks_due.forEach(item => {
        html += `<div class="briefing-item">
          <div class="briefing-item-content">
            <div class="briefing-item-from"><span class="task-priority" data-priority="${item.priority}">${item.priority}</span> ${escapeHtml(item.title || "")}</div>
          </div>
        </div>`;
      });
      html += `</div>`;
    }

    // Nudges
    if (b.nudges?.length) {
      html += `<div class="briefing-section">
        <div class="briefing-section-header">
          <span class="briefing-section-icon">\u{1F514}</span>
          <span class="briefing-section-title">Relationship Nudges</span>
        </div>`;
      b.nudges.forEach(item => {
        html += `<div class="briefing-item">
          <div class="briefing-item-content">
            <div class="briefing-item-from">${escapeHtml(item.contact || "")}</div>
            <div class="briefing-item-subject">${escapeHtml(item.reason || "")}</div>
          </div>
        </div>`;
      });
      html += `</div>`;
    }

    // AI suggestion
    if (b.ai_suggestion) {
      html += `<div class="briefing-suggestion">\u{1F4A1} ${escapeHtml(b.ai_suggestion)}</div>`;
    }

    dom.briefingContent.innerHTML = html;
  }

  // ---------- Render Tasks ----------
  function renderTasks() {
    const filter = dom.taskFilter?.value || "pending";
    let tasks = state.tasks;
    if (filter === "pending") tasks = tasks.filter(t => t.status !== "completed");
    else if (filter === "completed") tasks = tasks.filter(t => t.status === "completed");

    tasks.sort((a, b) => {
      const p = { high: 0, medium: 1, low: 2 };
      if (p[a.priority] !== p[b.priority]) return (p[a.priority] || 1) - (p[b.priority] || 1);
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      return 1;
    });

    dom.tasksList.innerHTML = "";
    if (!tasks.length) {
      dom.tasksList.innerHTML = '<div style="padding:40px 0;text-align:center;color:var(--text-dim);">No tasks</div>';
      return;
    }

    tasks.forEach(task => {
      const div = document.createElement("div");
      div.className = `task-item ${task.status === "completed" ? "completed" : ""}`;
      div.innerHTML = `
        <div class="task-checkbox ${task.status === "completed" ? "checked" : ""}" data-id="${task.id}">${task.status === "completed" ? "\u2713" : ""}</div>
        <div class="task-content">
          <div class="task-title">${escapeHtml(task.title)}</div>
          <div class="task-meta">
            <span class="task-priority" data-priority="${task.priority}">${task.priority}</span>
            ${task.due_date ? `<span>Due: ${task.due_date}</span>` : ""}
            ${task.assigned_to ? `<span>@${escapeHtml(task.assigned_to)}</span>` : ""}
          </div>
        </div>
      `;

      div.querySelector(".task-checkbox").addEventListener("click", (e) => {
        e.stopPropagation();
        task.status = task.status === "completed" ? "pending" : "completed";
        api.updateTask(task.id, { status: task.status });
        renderTasks();
      });

      div.addEventListener("click", () => selectTask(task.id));
      dom.tasksList.appendChild(div);
    });
  }

  function selectTask(id) {
    state.selectedTaskId = id;
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    dom.taskTitleInput.value = task.title;
    dom.taskDescInput.value = task.description || "";
    dom.taskPriorityInput.value = task.priority;
    dom.taskDueInput.value = task.due_date || "";
    dom.taskAssignedInput.value = task.assigned_to || "John";
    dom.taskStatusInput.value = task.status;
    dom.taskSource.textContent = task.source ? `Source: ${task.source}` : "";

    showPanel("task-detail");
  }

  // ---------- Render Contacts ----------
  function renderContacts() {
    const sortBy = dom.contactSort?.value || "recent";
    let contacts = [...state.contacts];

    if (sortBy === "score") contacts.sort((a, b) => (b.relationship_score || 0) - (a.relationship_score || 0));
    else if (sortBy === "name") contacts.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    else contacts.sort((a, b) => new Date(b.last_contact || 0) - new Date(a.last_contact || 0));

    dom.contactsList.innerHTML = "";
    if (!contacts.length) {
      dom.contactsList.innerHTML = '<div style="padding:40px 0;text-align:center;color:var(--text-dim);">No contacts</div>';
      return;
    }

    contacts.forEach(contact => {
      const div = document.createElement("div");
      div.className = "contact-item";
      const score = contact.relationship_score || 50;
      const scoreColor = score >= 80 ? "var(--success)" : score >= 50 ? "var(--warning)" : "var(--danger)";
      div.innerHTML = `
        <div class="contact-item-avatar" style="background:${scoreColor}20;color:${scoreColor}">${getInitials(contact.name)}</div>
        <div class="contact-item-info">
          <div class="contact-item-name">${contact.is_vip ? '<span style="color:var(--star)">&#9826;</span> ' : ""}${escapeHtml(contact.name || contact.email)}</div>
          <div class="contact-item-email-text">${escapeHtml(contact.role ? `${contact.role} at ${contact.company || ""}` : contact.email)}</div>
        </div>
        <div class="contact-item-score" style="border-color:${scoreColor};color:${scoreColor}">${score}</div>
      `;
      div.addEventListener("click", () => selectContact(contact.email));
      dom.contactsList.appendChild(div);
    });
  }

  function selectContact(email) {
    state.selectedContactEmail = email;
    const contact = state.contacts.find(c => c.email === email);
    if (!contact) return;

    dom.contactName.textContent = contact.name || email;
    dom.contactAvatar.textContent = getInitials(contact.name);
    dom.contactEmailDisplay.textContent = email;
    dom.contactRole.textContent = contact.role || "";
    dom.contactCompany.textContent = contact.company || "";
    dom.contactScore.textContent = contact.relationship_score || 50;
    dom.contactEmailCount.textContent = contact.email_count || 0;
    dom.contactLastContact.textContent = formatRelativeDate(contact.last_contact);
    dom.contactFirstContact.textContent = formatRelativeDate(contact.first_contact || contact.last_contact);

    // Topics
    const topics = Array.isArray(contact.topics) ? contact.topics : [];
    dom.contactTopics.innerHTML = topics.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("") || '<span style="color:var(--text-dim);font-size:12px;">No topics yet</span>';

    dom.contactNotes.value = contact.private_notes || "";

    // Recent emails
    const emails = state.emails.filter(e => e.from_address === email || e.to_address === email).slice(0, 5);
    dom.contactRecentEmails.innerHTML = emails.length
      ? emails.map(e => `<div class="briefing-item" style="padding:6px 0"><div class="briefing-item-content"><div class="briefing-item-from" style="font-size:12px">${escapeHtml(e.subject)}</div><div class="briefing-item-subject">${formatDate(e.date)}</div></div></div>`).join("")
      : '<div style="color:var(--text-dim);font-size:12px;">No recent emails</div>';

    showPanel("contact-detail");
  }

  // ---------- Render Calendar ----------
  function renderCalendar() {
    const date = state.calendarDate;
    const d = new Date(date + "T12:00:00");
    dom.calDateLabel.textContent = d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });

    const events = state.calendarEvents.filter(e => e.date === date).sort((a, b) => (a.time || "").localeCompare(b.time || ""));

    dom.calendarEvents.innerHTML = "";
    if (!events.length) {
      dom.calendarEvents.innerHTML = '<div class="calendar-empty"><span style="font-size:48px;opacity:0.3;display:block;margin-bottom:12px;">\u{1F4C5}</span><p>No events scheduled</p></div>';
      return;
    }

    events.forEach(event => {
      const div = document.createElement("div");
      div.className = "calendar-event-item";
      div.innerHTML = `
        <div class="event-time">${event.time || "TBD"}${event.end_time ? ` - ${event.end_time}` : ""}</div>
        <div class="event-details">
          <div class="event-title">${escapeHtml(event.title)}</div>
          <div class="event-desc">${escapeHtml(event.description || "")}</div>
          ${event.location ? `<div class="event-location">\u{1F4CD} ${escapeHtml(event.location)}</div>` : ""}
          ${event.meeting_url ? `<div class="event-location" style="color:var(--primary);">\u{1F517} Meeting link</div>` : ""}
        </div>
      `;
      dom.calendarEvents.appendChild(div);
    });
  }

  // ============================================================
  // EVENT LISTENERS
  // ============================================================

  // Folders (preserved)
  dom.folders.forEach((folder) => {
    folder.addEventListener("click", () => {
      dom.folders.forEach((f) => f.classList.remove("active"));
      folder.classList.add("active");
      state.activeFolder = folder.dataset.folder;
      state.selectedId = null;
      if (state.activeView !== "mail") switchView("mail");
      else { showPanel("empty"); renderMailList(); }
    });
  });

  // Account tabs (preserved)
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

  // View switcher (NEW)
  dom.viewTabs.forEach(tab => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  // Compose (preserved)
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
      id: state.nextId++, from_name: "John Akins", from_address: "john@akinsfreshmarkets.com",
      to_address: dom.composeTo.value, subject: dom.composeSubject.value || "(No subject)",
      body: dom.composeBody.value, date: new Date().toISOString(), read: 1, starred: 0,
      folder: "drafts", account: dom.composeFrom?.value || "zoho-biz",
    });
    showPanel("empty");
    updateCounts();
  });

  dom.discardBtn.addEventListener("click", () => showPanel("empty"));
  dom.undoSendBtn.addEventListener("click", undoSend);

  // File attachments (preserved)
  dom.composeFile.addEventListener("change", (e) => {
    state.attachments.push(...Array.from(e.target.files));
    renderAttachments();
  });

  dom.composeAttachments.addEventListener("click", (e) => {
    if (e.target.classList.contains("remove-attachment")) {
      state.attachments.splice(parseInt(e.target.dataset.index), 1);
      renderAttachments();
    }
  });

  // Search & Filter (preserved)
  dom.searchInput.addEventListener("input", (e) => { state.searchQuery = e.target.value; renderMailList(); });
  dom.filterSelect.addEventListener("change", (e) => { state.filterMode = e.target.value; renderMailList(); });
  dom.refreshBtn.addEventListener("click", async () => {
    dom.refreshBtn.innerHTML = '<span class="ai-loading" style="width:12px;height:12px"></span>';
    const result = await api.sync();
    dom.refreshBtn.innerHTML = "&#8635;";
    if (result) addAiMessage(`Synced: ${JSON.stringify(result)}`, "assistant");
    renderMailList();
  });

  // Detail actions (preserved)
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

  // Templates (preserved)
  dom.templateBtn.addEventListener("click", (e) => { e.stopPropagation(); showTemplateDropdown(); });

  // Tone buttons (preserved)
  dom.toneButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      dom.toneButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.activeTone = btn.dataset.tone;
    });
  });

  // AI: Summarize (preserved)
  dom.aiSummarizeBtn.addEventListener("click", async () => {
    const email = state.emails.find((e) => e.id === state.selectedId);
    if (!email) return;
    dom.aiResult.classList.remove("hidden");
    dom.aiResult.innerHTML = '<div class="ai-loading"></div> Summarizing...';
    const result = await api.aiSummarize(email.id);
    dom.aiResult.textContent = result?.summary || await localAi.summarize(email);
  });

  // AI: Suggest Reply (enhanced with dual drafts)
  dom.aiReplySuggestBtn.addEventListener("click", async () => {
    const email = state.emails.find((e) => e.id === state.selectedId);
    if (!email) return;
    dom.aiResult.classList.remove("hidden");
    dom.aiResult.innerHTML = '<div class="ai-loading"></div> Generating dual drafts...';

    const result = await api.aiDraftReply(email.id, state.activeTone);

    if (result && result.primary) {
      // Dual draft display
      let html = "";
      if (result.analysis) {
        html += `<div style="font-size:12px;color:var(--text-dim);margin-bottom:10px;">${escapeHtml(result.analysis)}</div>`;
      }
      if (result.flags?.length) {
        html += `<div class="draft-flags">${result.flags.map(f => "&#9888; " + escapeHtml(f)).join("<br>")}</div>`;
      }
      html += `<div class="dual-draft">
        <div class="draft-option selected" data-draft="primary">
          <div class="draft-label">Primary (${state.activeTone})</div>
          <div class="draft-text">${escapeHtml(result.primary)}</div>
        </div>
        <div class="draft-option" data-draft="alternate">
          <div class="draft-label">Alternate</div>
          <div class="draft-text">${escapeHtml(result.alternate || "")}</div>
        </div>
      </div>`;

      dom.aiResult.innerHTML = html;

      // Click to select draft
      let selectedDraft = result.primary;
      dom.aiResult.querySelectorAll(".draft-option").forEach(opt => {
        opt.addEventListener("click", () => {
          dom.aiResult.querySelectorAll(".draft-option").forEach(o => o.classList.remove("selected"));
          opt.classList.add("selected");
          selectedDraft = opt.dataset.draft === "primary" ? result.primary : result.alternate;
        });
      });

      // Use button
      const useBtn = document.createElement("button");
      useBtn.className = "btn-ai";
      useBtn.style.marginTop = "10px";
      useBtn.textContent = "Use selected reply";
      useBtn.addEventListener("click", () => {
        dom.composeTo.value = email.from_address;
        dom.composeSubject.value = "Re: " + email.subject;
        dom.composeBody.value = selectedDraft;
        showPanel("compose");
      });
      dom.aiResult.appendChild(useBtn);
    } else {
      // Fallback to local
      const reply = await localAi.suggestReply(email, state.activeTone);
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
    }
  });

  // AI: Calendar detection (preserved)
  dom.aiCalendarBtn.addEventListener("click", async () => {
    const email = state.emails.find((e) => e.id === state.selectedId);
    if (!email) return;
    dom.aiResult.classList.remove("hidden");
    dom.aiResult.innerHTML = '<div class="ai-loading"></div> Scanning for events...';
    const result = await api.aiDetectEvents(email.id);
    if (result?.events?.length) {
      dom.aiResult.textContent = "Events found:\n" + result.events.map((e) => `- ${e.title} on ${e.date}${e.time ? " at " + e.time : ""}`).join("\n");
      // Auto-add to local calendar
      result.events.forEach(e => {
        if (!state.calendarEvents.find(ce => ce.title === e.title && ce.date === e.date)) {
          state.calendarEvents.push({ id: state.nextId++, ...e });
        }
      });
    } else {
      dom.aiResult.textContent = "No calendar events detected in this email.";
    }
  });

  // AI: Extract Tasks (NEW)
  dom.aiExtractTasksBtn.addEventListener("click", async () => {
    const email = state.emails.find((e) => e.id === state.selectedId);
    if (!email) return;
    dom.aiResult.classList.remove("hidden");
    dom.aiResult.innerHTML = '<div class="ai-loading"></div> Extracting tasks...';
    const result = await api.aiExtractTasks(email.id);
    if (result?.tasks?.length) {
      result.tasks.forEach(t => {
        state.tasks.push({ id: state.nextTaskId++, ...t, status: "pending", source: `Email: ${email.subject}` });
      });
      dom.aiResult.textContent = `Extracted ${result.tasks.length} task(s):\n` + result.tasks.map(t => `- [${t.priority}] ${t.title}${t.due_date ? ` (due: ${t.due_date})` : ""}`).join("\n");
      showNotification("Tasks Extracted", `${result.tasks.length} task(s) added from "${email.subject}"`);
    } else {
      // Local fallback
      const tasks = [];
      const body = (email.body || "").toLowerCase();
      if (/by (monday|tuesday|wednesday|thursday|friday|end of|eod|eow|\w+ \d+)/.test(body) || /could you|can you|please.*send|action required/.test(body)) {
        tasks.push({ title: `Follow up on: ${email.subject}`, priority: "medium", assigned_to: "John" });
      }
      if (/review|take a look|feedback/.test(body)) {
        tasks.push({ title: `Review: ${email.subject}`, priority: "medium", assigned_to: "John" });
      }
      if (tasks.length) {
        tasks.forEach(t => { state.tasks.push({ id: state.nextTaskId++, ...t, status: "pending", source: `Email: ${email.subject}` }); });
        dom.aiResult.textContent = `Extracted ${tasks.length} task(s):\n` + tasks.map(t => `- [${t.priority}] ${t.title}`).join("\n");
      } else {
        dom.aiResult.textContent = "No tasks detected in this email.";
      }
    }
  });

  // AI: Suggest Schedule (NEW)
  dom.aiScheduleBtn.addEventListener("click", async () => {
    const email = state.emails.find((e) => e.id === state.selectedId);
    if (!email) return;
    dom.aiResult.classList.remove("hidden");
    dom.aiResult.innerHTML = '<div class="ai-loading"></div> Analyzing scheduling...';
    const result = await api.aiSuggestSchedule(email.id);
    if (result?.is_scheduling_request) {
      let text = `Meeting requested: ${result.meeting_details?.topic || email.subject}\n`;
      text += `Duration: ${result.meeting_details?.duration_minutes || 30} min\n\n`;
      text += "Suggested slots:\n";
      (result.suggested_slots || []).forEach(s => {
        text += `- ${s.date} at ${s.time} (${s.reason})\n`;
      });
      if (result.draft_reply) {
        text += `\nDraft reply:\n${result.draft_reply}`;
      }
      dom.aiResult.textContent = text;
    } else {
      dom.aiResult.textContent = "No scheduling request detected in this email.";
    }
  });

  // AI: Contact Info (NEW)
  dom.aiContactBtn.addEventListener("click", async () => {
    const email = state.emails.find((e) => e.id === state.selectedId);
    if (!email) return;
    selectContact(email.from_address);
  });

  // AI: Thread Analysis (NEW)
  dom.analyzeThreadBtn.addEventListener("click", async () => {
    const email = state.emails.find((e) => e.id === state.selectedId);
    if (!email?.thread_id) return;

    dom.analyzeThreadBtn.innerHTML = '<span class="ai-loading" style="width:12px;height:12px"></span>';
    const result = await api.analyzeThread(email.thread_id);

    if (result) {
      dom.threadTopic.textContent = result.topic || dom.threadTopic.textContent;
      const healthMap = { resolved: "\u{1F7E2}", waiting: "\u{1F7E1}", stalled: "\u{1F534}", urgent: "\u26A1" };
      dom.threadHealth.textContent = healthMap[result.health] || "\u{1F7E2}";

      if (result.decisions_made?.length) {
        dom.threadDecisions.classList.remove("hidden");
        dom.threadDecisionsList.innerHTML = result.decisions_made.map(d => `<li>\u2713 ${escapeHtml(d.decision)} \u2014 ${escapeHtml(d.made_by || "")} ${d.timestamp ? `(${d.timestamp})` : ""}</li>`).join("");
      }
      if (result.open_items?.length) {
        dom.threadOpenItems.classList.remove("hidden");
        dom.threadOpenItemsList.innerHTML = result.open_items.map(i => `<li>\u23F3 ${escapeHtml(i.who)}: ${escapeHtml(i.what)}${i.due ? ` by ${i.due}` : ""}</li>`).join("");
      }
      if (result.suggested_action) {
        dom.threadSuggestedAction.classList.remove("hidden");
        dom.threadSuggestedAction.textContent = result.suggested_action;
      }
    }
    dom.analyzeThreadBtn.innerHTML = "&#10024; Analyze";
  });

  // AI: Draft (preserved)
  dom.aiDraftBtn.addEventListener("click", async () => {
    const topic = dom.composeSubject.value || "general follow-up";
    dom.composeBody.value = "Drafting...";
    dom.composeBody.disabled = true;
    const result = await api.aiDraft(topic, state.activeTone);
    dom.composeBody.value = result?.draft || `Hi,\n\nFollowing up on ${topic}. Let me know if you have any updates.\n\nBest regards,\nJohn`;
    dom.composeBody.disabled = false;
  });

  // AI: Improve (preserved)
  dom.aiImproveBtn.addEventListener("click", async () => {
    const text = dom.composeBody.value;
    if (!text.trim()) return;
    dom.composeBody.disabled = true;
    const result = await api.aiImprove(text, state.activeTone);
    dom.composeBody.value = result?.improved || text;
    dom.composeBody.disabled = false;
  });

  // AI Chat (enhanced)
  async function handleAiChat() {
    const question = dom.aiInput.value.trim();
    if (!question) return;
    addAiMessage(question, "user");
    dom.aiInput.value = "";

    // Check for view commands
    const q = question.toLowerCase();
    if (q.includes("brief") || q.includes("morning")) {
      switchView("briefing");
      addAiMessage("Opening your morning briefing.", "assistant");
      return;
    }
    if (q.includes("task") && (q.includes("show") || q.includes("list") || q.includes("view"))) {
      switchView("tasks");
      addAiMessage("Here are your tasks.", "assistant");
      return;
    }
    if (q.includes("calendar") || q.includes("schedule")) {
      switchView("calendar");
      addAiMessage("Opening calendar view.", "assistant");
      return;
    }
    if (q.includes("contact") && (q.includes("show") || q.includes("list") || q.includes("view"))) {
      switchView("contacts");
      addAiMessage("Here are your contacts.", "assistant");
      return;
    }

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

  // Triage (preserved)
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

  // Category filter (preserved)
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

  // Task events (NEW)
  if (dom.taskFilter) dom.taskFilter.addEventListener("change", () => renderTasks());
  if (dom.addTaskBtn) dom.addTaskBtn.addEventListener("click", () => {
    state.selectedTaskId = null;
    dom.taskTitleInput.value = "";
    dom.taskDescInput.value = "";
    dom.taskPriorityInput.value = "medium";
    dom.taskDueInput.value = "";
    dom.taskAssignedInput.value = "John";
    dom.taskStatusInput.value = "pending";
    dom.taskSource.textContent = "";
    showPanel("task-detail");
  });

  if (dom.saveTaskBtn) dom.saveTaskBtn.addEventListener("click", () => {
    const title = dom.taskTitleInput.value.trim();
    if (!title) return;
    if (state.selectedTaskId) {
      const task = state.tasks.find(t => t.id === state.selectedTaskId);
      if (task) {
        task.title = title;
        task.description = dom.taskDescInput.value;
        task.priority = dom.taskPriorityInput.value;
        task.due_date = dom.taskDueInput.value || null;
        task.assigned_to = dom.taskAssignedInput.value;
        task.status = dom.taskStatusInput.value;
        api.updateTask(task.id, task);
      }
    } else {
      const newTask = {
        id: state.nextTaskId++,
        title,
        description: dom.taskDescInput.value,
        priority: dom.taskPriorityInput.value,
        due_date: dom.taskDueInput.value || null,
        assigned_to: dom.taskAssignedInput.value,
        status: dom.taskStatusInput.value,
        source: "Manual",
      };
      state.tasks.push(newTask);
      api.createTask(newTask);
    }
    renderTasks();
    showPanel("empty");
  });

  if (dom.completeTaskBtn) dom.completeTaskBtn.addEventListener("click", () => {
    if (!state.selectedTaskId) return;
    const task = state.tasks.find(t => t.id === state.selectedTaskId);
    if (task) {
      task.status = "completed";
      api.updateTask(task.id, { status: "completed" });
    }
    renderTasks();
    showPanel("empty");
  });

  if (dom.taskBackBtn) dom.taskBackBtn.addEventListener("click", () => { showPanel("empty"); });

  // Contact events (NEW)
  if (dom.contactSort) dom.contactSort.addEventListener("change", () => renderContacts());
  if (dom.contactBackBtn) dom.contactBackBtn.addEventListener("click", () => { showPanel("empty"); });

  if (dom.analyzeContactBtn) dom.analyzeContactBtn.addEventListener("click", async () => {
    if (!state.selectedContactEmail) return;
    dom.analyzeContactBtn.innerHTML = '<span class="ai-loading" style="width:12px;height:12px"></span> Analyzing...';
    const result = await api.analyzeContact(state.selectedContactEmail);
    if (result?.analysis) {
      const a = result.analysis;
      if (a.role) dom.contactRole.textContent = a.role;
      if (a.company) dom.contactCompany.textContent = a.company;
      if (a.relationship_score) dom.contactScore.textContent = a.relationship_score;
      if (a.topics?.length) dom.contactTopics.innerHTML = a.topics.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("");
      showNotification("Contact Analyzed", a.summary || "Analysis complete");
    }
    dom.analyzeContactBtn.innerHTML = "&#10024; AI Analysis";
  });

  if (dom.contactVipToggle) dom.contactVipToggle.addEventListener("click", () => {
    if (!state.selectedContactEmail) return;
    const contact = state.contacts.find(c => c.email === state.selectedContactEmail);
    if (contact) {
      contact.is_vip = contact.is_vip ? 0 : 1;
      if (contact.is_vip) state.vipContacts.add(contact.email);
      else state.vipContacts.delete(contact.email);
    }
    selectContact(state.selectedContactEmail);
  });

  // Calendar nav (NEW)
  if (dom.calPrev) dom.calPrev.addEventListener("click", () => {
    const d = new Date(state.calendarDate + "T12:00:00");
    d.setDate(d.getDate() - 1);
    state.calendarDate = d.toISOString().split("T")[0];
    renderCalendar();
  });
  if (dom.calNext) dom.calNext.addEventListener("click", () => {
    const d = new Date(state.calendarDate + "T12:00:00");
    d.setDate(d.getDate() + 1);
    state.calendarDate = d.toISOString().split("T")[0];
    renderCalendar();
  });

  // Briefing refresh (NEW)
  if (dom.refreshBriefingBtn) dom.refreshBriefingBtn.addEventListener("click", async () => {
    dom.refreshBriefingBtn.innerHTML = '<span class="ai-loading" style="width:12px;height:12px"></span>';
    const result = await api.refreshBriefing();
    if (result) state.briefingData = result;
    await renderBriefing();
    dom.refreshBriefingBtn.innerHTML = "&#10024; Refresh Briefing";
  });

  // Notification close
  if (dom.notificationClose) dom.notificationClose.addEventListener("click", () => {
    dom.notificationToast.classList.add("hidden");
  });

  // Theme toggle (preserved)
  dom.themeToggle.addEventListener("click", () => {
    const html = document.documentElement;
    const isDark = html.classList.contains("dark");
    html.classList.toggle("dark", !isDark);
    html.classList.toggle("light", isDark);
    dom.themeToggle.innerHTML = isDark ? "&#9788;" : "&#9790;";
  });

  // Share target (preserved)
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

  // Keyboard shortcuts (preserved + enhanced)
  document.addEventListener("keydown", (e) => {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
    if (e.key === "c") dom.composeBtn.click();
    else if (e.key === "Escape") { showPanel("empty"); state.selectedId = null; renderMailList(); }
    else if (e.key === "/") { e.preventDefault(); dom.searchInput.focus(); }
    else if (e.key === "b") switchView("briefing");
    else if (e.key === "t") switchView("tasks");
    else if (e.key === "m") switchView("mail");
  });

  // Snooze wake-up check (every 30s — preserved)
  setInterval(() => {
    const now = new Date();
    state.emails.forEach((e) => {
      if (e.folder === "snoozed" && e.snoozed_until && new Date(e.snoozed_until) <= now) {
        e.folder = "inbox";
        e.snoozed_until = null;
      }
    });
    updateCounts();
    if (state.activeView === "mail") renderMailList();
  }, 30000);

  // ============================================================
  // MOBILE MENU
  // ============================================================
  const menuBtn = document.getElementById("menu-btn");
  const mobileComposeBtn = document.getElementById("mobile-compose-btn");
  const sidebarOverlay = document.getElementById("sidebar-overlay");
  const sidebar = document.getElementById("sidebar");

  function openSidebar() {
    sidebar.classList.add("open");
    sidebarOverlay.classList.remove("hidden");
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.add("hidden");
  }

  if (menuBtn) menuBtn.addEventListener("click", openSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeSidebar);
  if (mobileComposeBtn) mobileComposeBtn.addEventListener("click", () => {
    showPanel("compose");
    closeSidebar();
  });

  // Close sidebar when selecting a folder/view on mobile
  dom.folders.forEach((f) => f.addEventListener("click", closeSidebar));
  dom.viewTabs.forEach((t) => t.addEventListener("click", closeSidebar));
  dom.triageCategories.forEach((c) => c.addEventListener("click", closeSidebar));

  // Show detail panel on mobile when selecting an email
  const origSelectEmail = selectEmail;
  function mobileSelectEmail(id) {
    origSelectEmail(id);
    if (window.innerWidth <= 900) {
      dom.detailPanel.classList.add("visible");
    }
  }
  // Monkey-patch: re-bind mail list clicks handled in renderMailList

  // Back button hides detail on mobile
  const origBack = dom.backBtn.onclick;
  dom.backBtn.addEventListener("click", () => {
    if (window.innerWidth <= 900) {
      dom.detailPanel.classList.remove("visible");
    }
  });

  // ============================================================
  // PUSH NOTIFICATIONS
  // ============================================================
  async function requestPushPermission() {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      subscribeToPush();
      return;
    }
    if (Notification.permission !== "denied") {
      const result = await Notification.requestPermission();
      if (result === "granted") subscribeToPush();
    }
  }

  async function subscribeToPush() {
    if (!window._swRegistration) return;
    try {
      let sub = await window._swRegistration.pushManager.getSubscription();
      if (!sub) {
        // For demo: using a placeholder VAPID key
        // In production, generate real VAPID keys
        sub = await window._swRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: null, // Needs real VAPID key for production
        }).catch(() => null);
      }
      if (sub) {
        const keys = sub.toJSON().keys || {};
        await api.fetch("/push/subscribe", {
          method: "POST",
          body: { endpoint: sub.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
        });
      }
    } catch (e) {
      console.log("Push subscription not available:", e.message);
    }
  }

  // ============================================================
  // INIT
  // ============================================================
  updateCounts();
  renderMailList();
  showPanel("empty");
  handleShareTarget();

  // Check if backend is available
  api.fetch("/accounts").then((result) => {
    if (result) {
      state.isOnline = true;
      addAiMessage("Mx Chief of Staff online. Connected to backend.", "assistant");
      // Request push permission after a short delay
      setTimeout(requestPushPermission, 3000);
    } else {
      addAiMessage("Running in local mode. Start the server for full AI features.", "assistant");
    }
  });

  // Welcome message
  addAiMessage("Good morning, John. I'm Mx, your AI Chief of Staff. Press 'b' for your morning briefing, or ask me anything.", "assistant");

  } // end initApp

  // ============================================================
  // BOOT: Check auth then launch app
  // ============================================================
  checkAuth();

})();
