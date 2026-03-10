// ============================================================
// Spodee Mail — AI-Powered Email App (Native JS)
// ============================================================

(function () {
  "use strict";

  // ---------- Sample Data ----------
  const sampleEmails = [
    {
      id: 1,
      from: "Sarah Chen <sarah@techcorp.io>",
      to: "me@spodee.mail",
      subject: "Q1 Product Roadmap Review",
      body: `Hi team,

I wanted to share the updated Q1 product roadmap for everyone's review. We've made some significant changes based on customer feedback from last quarter.

Key highlights:
- AI-powered search is moving to priority 1
- Mobile redesign pushed to Q2
- New onboarding flow launching Feb 15
- API v3 deprecation timeline extended to March

Please review the attached document and share your feedback by end of week. We'll have a final review meeting next Monday at 2pm.

Let me know if you have any questions.

Best,
Sarah`,
      date: "2026-03-10T09:30:00",
      read: false,
      starred: true,
      folder: "inbox",
    },
    {
      id: 2,
      from: "GitHub <noreply@github.com>",
      to: "me@spodee.mail",
      subject: "[spodee4] Pull Request #42: Add real-time notifications",
      body: `@devops-bot opened a pull request in spodee4/spodee4:

#42 Add real-time notifications

This PR adds WebSocket-based real-time notifications to the platform. Changes include:

- New NotificationService class with WebSocket connection management
- Client-side notification center component
- Push notification integration for mobile
- Database migration for notification preferences
- Unit and integration tests (94% coverage)

Reviewers: @sarah-chen, @mike-johnson
Labels: feature, needs-review
CI: All checks passing

View pull request: https://github.com/spodee4/spodee4/pull/42`,
      date: "2026-03-10T08:15:00",
      read: false,
      starred: false,
      folder: "inbox",
    },
    {
      id: 3,
      from: "Mike Johnson <mike@designlab.co>",
      to: "me@spodee.mail",
      subject: "Re: Brand refresh concepts",
      body: `Hey!

I've finished the three brand refresh concepts we discussed. Here's a quick summary:

Concept A — "Modern Minimal"
Clean lines, lots of whitespace, monochrome with a single accent color. Feels very premium and tech-forward.

Concept B — "Vibrant Energy"
Bold color palette, dynamic shapes, energetic typography. Great for standing out but might feel too playful for enterprise clients.

Concept C — "Trust & Clarity"
Professional blue tones, structured layout, clear hierarchy. Safe choice that resonates with B2B audience.

My recommendation is Concept A with some warmth borrowed from Concept C. I think it strikes the right balance.

Want to hop on a call tomorrow to walk through them?

Cheers,
Mike`,
      date: "2026-03-09T16:45:00",
      read: true,
      starred: false,
      folder: "inbox",
    },
    {
      id: 4,
      from: "me@spodee.mail",
      to: "team@spodee.mail",
      subject: "Sprint planning notes — Week 11",
      body: `Team,

Here are the notes from today's sprint planning:

Completed last sprint:
- User authentication refactor ✓
- Dashboard performance optimization ✓
- Bug fix: CSV export timeout ✓

This sprint's priorities:
1. AI mail assistant integration
2. Email template builder v2
3. Analytics dashboard redesign
4. Performance monitoring setup

Blockers:
- Waiting on API keys from the AI provider
- Design specs for template builder still in review

Let's aim to have daily standups at 9:30am this week.

Thanks,
Me`,
      date: "2026-03-09T11:00:00",
      read: true,
      starred: false,
      folder: "sent",
    },
    {
      id: 5,
      from: "AWS <no-reply@aws.amazon.com>",
      to: "me@spodee.mail",
      subject: "Your February billing statement is ready",
      body: `Hello,

Your AWS billing statement for February 2026 is now available.

Account: spodee-production
Period: February 1 - 28, 2026
Total charges: $1,247.83

Top services by cost:
- EC2: $523.40
- RDS: $312.15
- S3: $189.22
- CloudFront: $98.50
- Lambda: $67.30
- Other: $57.26

This represents a 12% increase from January, primarily driven by increased EC2 usage.

View your detailed billing dashboard in the AWS Console.

Amazon Web Services`,
      date: "2026-03-08T06:00:00",
      read: true,
      starred: true,
      folder: "inbox",
    },
  ];

  // ---------- State ----------
  const state = {
    emails: JSON.parse(JSON.stringify(sampleEmails)),
    activeFolder: "inbox",
    selectedId: null,
    searchQuery: "",
    filterMode: "all",
    nextId: 100,
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
    // Detail
    mailDetail: $("#mail-detail"),
    detailSubject: $("#detail-subject"),
    detailFrom: $("#detail-from"),
    detailDate: $("#detail-date"),
    detailBody: $("#detail-body"),
    starBtn: $("#star-btn"),
    replyBtn: $("#reply-btn"),
    deleteBtn: $("#delete-btn"),
    backBtn: $("#back-btn"),
    // AI bar
    aiSummaryBar: $("#ai-summary-bar"),
    aiSummarizeBtn: $("#ai-summarize-btn"),
    aiReplySuggestBtn: $("#ai-reply-suggest-btn"),
    aiResult: $("#ai-result"),
    // Compose
    composePanel: $("#compose-panel"),
    composeForm: $("#compose-form"),
    composeTo: $("#compose-to"),
    composeSubject: $("#compose-subject"),
    composeBody: $("#compose-body"),
    closeCompose: $("#close-compose"),
    saveDraftBtn: $("#save-draft-btn"),
    discardBtn: $("#discard-btn"),
    aiDraftBtn: $("#ai-draft-btn"),
    aiImproveBtn: $("#ai-improve-btn"),
    // Empty state
    emptyState: $("#empty-state"),
    // AI chat
    aiInput: $("#ai-input"),
    aiSendBtn: $("#ai-send-btn"),
    aiMessages: $("#ai-messages"),
    // Counts
    inboxCount: $("#inbox-count"),
    // Detail panel
    detailPanel: $("#detail-panel"),
  };

  // ---------- Helpers ----------
  function formatDate(iso) {
    const d = new Date(iso);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function getVisibleEmails() {
    let emails = state.emails.filter((e) => e.folder === state.activeFolder);

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      emails = emails.filter(
        (e) =>
          e.subject.toLowerCase().includes(q) ||
          e.from.toLowerCase().includes(q) ||
          e.body.toLowerCase().includes(q)
      );
    }

    if (state.filterMode === "unread") {
      emails = emails.filter((e) => !e.read);
    } else if (state.filterMode === "read") {
      emails = emails.filter((e) => e.read);
    }

    emails.sort((a, b) => new Date(b.date) - new Date(a.date));
    return emails;
  }

  function updateInboxCount() {
    const count = state.emails.filter(
      (e) => e.folder === "inbox" && !e.read
    ).length;
    dom.inboxCount.textContent = count;
    dom.inboxCount.classList.toggle("hidden", count === 0);
  }

  // ---------- Render: Mail List ----------
  function renderMailList() {
    const emails = getVisibleEmails();
    dom.mailList.innerHTML = "";

    if (emails.length === 0) {
      dom.mailList.innerHTML = `<li style="padding:40px 16px;text-align:center;color:var(--text-dim);">No messages</li>`;
      return;
    }

    emails.forEach((email) => {
      const li = document.createElement("li");
      li.className = "mail-item";
      if (!email.read) li.classList.add("unread");
      if (email.id === state.selectedId) li.classList.add("active");

      li.innerHTML = `
        <div class="mail-item-row">
          <span class="mail-item-from">${escapeHtml(email.from.split("<")[0].trim())}</span>
          <span class="mail-item-date">${formatDate(email.date)}</span>
        </div>
        <div class="mail-item-row">
          <span class="mail-item-subject">${escapeHtml(email.subject)}</span>
          <span class="mail-item-star ${email.starred ? "starred" : ""}" data-id="${email.id}">&#9733;</span>
        </div>
        <span class="mail-item-snippet">${escapeHtml(email.body.substring(0, 80))}...</span>
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

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- Render: Detail ----------
  function selectEmail(id) {
    state.selectedId = id;
    const email = state.emails.find((e) => e.id === id);
    if (!email) return;

    email.read = true;

    dom.detailSubject.textContent = email.subject;
    dom.detailFrom.textContent = "From: " + email.from;
    dom.detailDate.textContent = formatDate(email.date);
    dom.detailBody.textContent = email.body;
    dom.starBtn.innerHTML = email.starred ? "&#9733; Starred" : "&#9734; Star";
    dom.starBtn.style.color = email.starred ? "var(--star)" : "";

    dom.aiResult.classList.add("hidden");
    dom.aiResult.textContent = "";

    showPanel("detail");
    updateInboxCount();
    renderMailList();
  }

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
    if (email) {
      email.starred = !email.starred;
      if (state.selectedId === id) {
        dom.starBtn.innerHTML = email.starred
          ? "&#9733; Starred"
          : "&#9734; Star";
        dom.starBtn.style.color = email.starred ? "var(--star)" : "";
      }
      renderMailList();
    }
  }

  function deleteEmail(id) {
    const email = state.emails.find((e) => e.id === id);
    if (email) {
      if (email.folder === "trash") {
        state.emails = state.emails.filter((e) => e.id !== id);
      } else {
        email.folder = "trash";
      }
      state.selectedId = null;
      showPanel("empty");
      updateInboxCount();
      renderMailList();
    }
  }

  function sendEmail(to, subject, body) {
    const email = {
      id: state.nextId++,
      from: "me@spodee.mail",
      to: to,
      subject: subject,
      body: body,
      date: new Date().toISOString(),
      read: true,
      starred: false,
      folder: "sent",
    };
    state.emails.push(email);
    updateInboxCount();
    renderMailList();
  }

  function saveDraft(to, subject, body) {
    const email = {
      id: state.nextId++,
      from: "me@spodee.mail",
      to: to,
      subject: subject || "(No subject)",
      body: body,
      date: new Date().toISOString(),
      read: true,
      starred: false,
      folder: "drafts",
    };
    state.emails.push(email);
  }

  // ---------- AI Engine (Simulated) ----------
  const aiEngine = {
    async summarize(body) {
      await delay(800);
      const sentences = body
        .split(/[.!?\n]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 20);
      const keyPoints = sentences.slice(0, 3);
      return (
        "Summary:\n" +
        keyPoints.map((s, i) => `${i + 1}. ${s}`).join("\n") +
        (sentences.length > 3
          ? `\n\n(${sentences.length - 3} more points in full email)`
          : "")
      );
    },

    async suggestReply(email) {
      await delay(1000);
      const name = email.from.split("<")[0].trim().split(" ")[0];
      const replies = [
        `Hi ${name},\n\nThanks for sending this over. I've reviewed everything and it looks great. Let me know if you need anything else from my end.\n\nBest regards`,
        `Hi ${name},\n\nAppreciate the update! I have a few thoughts:\n\n1. [Your first point]\n2. [Your second point]\n\nLet's discuss further when you have a moment.\n\nThanks`,
        `Hi ${name},\n\nGot it — thanks for the heads up. I'll take a closer look and follow up by end of day.\n\nCheers`,
      ];
      return replies[Math.floor(Math.random() * replies.length)];
    },

    async draftEmail(prompt) {
      await delay(900);
      return `Subject: ${prompt}\n\nHi,\n\nI'm writing to follow up on ${prompt.toLowerCase()}. I wanted to check in and see if there are any updates or next steps we should discuss.\n\nPlease let me know your availability for a quick call this week.\n\nBest regards`;
    },

    async improveText(text) {
      await delay(700);
      let improved = text;
      // Capitalize first letter of sentences
      improved = improved.replace(/(^|[.!?]\s+)([a-z])/g, (m, p, c) =>
        p + c.toUpperCase()
      );
      // Clean up extra spaces
      improved = improved.replace(/  +/g, " ");
      // Add greeting if missing
      if (
        !improved.toLowerCase().startsWith("hi") &&
        !improved.toLowerCase().startsWith("hello") &&
        !improved.toLowerCase().startsWith("dear")
      ) {
        improved = "Hi,\n\n" + improved;
      }
      // Add sign-off if missing
      if (
        !improved.includes("regards") &&
        !improved.includes("thanks") &&
        !improved.includes("cheers") &&
        !improved.toLowerCase().includes("best")
      ) {
        improved += "\n\nBest regards";
      }
      return improved;
    },

    async chat(question, emails) {
      await delay(600);
      const q = question.toLowerCase();

      if (q.includes("unread") || q.includes("new")) {
        const unread = emails.filter(
          (e) => !e.read && e.folder === "inbox"
        );
        return `You have ${unread.length} unread email(s) in your inbox.${
          unread.length > 0
            ? " From: " + unread.map((e) => e.from.split("<")[0].trim()).join(", ")
            : ""
        }`;
      }

      if (q.includes("summary") || q.includes("summarize") || q.includes("overview")) {
        const inbox = emails.filter((e) => e.folder === "inbox");
        return `Inbox overview: ${inbox.length} total emails, ${inbox.filter((e) => !e.read).length} unread, ${inbox.filter((e) => e.starred).length} starred. Most recent from ${inbox[0]?.from.split("<")[0].trim() || "N/A"}.`;
      }

      if (q.includes("starred") || q.includes("important")) {
        const starred = emails.filter((e) => e.starred);
        return `You have ${starred.length} starred email(s): ${starred.map((e) => `"${e.subject}"`).join(", ")}`;
      }

      if (q.includes("find") || q.includes("search")) {
        const terms = q
          .replace(/find|search|for|about|email|mail/gi, "")
          .trim();
        const matches = emails.filter(
          (e) =>
            e.subject.toLowerCase().includes(terms) ||
            e.body.toLowerCase().includes(terms) ||
            e.from.toLowerCase().includes(terms)
        );
        if (matches.length > 0) {
          return `Found ${matches.length} email(s) matching "${terms}": ${matches.map((e) => `"${e.subject}"`).join(", ")}`;
        }
        return `No emails found matching "${terms}".`;
      }

      return `I can help you with your email! Try asking me:\n- "How many unread emails?"\n- "Give me an inbox summary"\n- "Find emails about [topic]"\n- "Show starred emails"`;
    },
  };

  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ---------- Event Listeners ----------

  // Folder navigation
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

  // Compose
  dom.composeBtn.addEventListener("click", () => {
    dom.composeTo.value = "";
    dom.composeSubject.value = "";
    dom.composeBody.value = "";
    state.selectedId = null;
    renderMailList();
    showPanel("compose");
  });

  dom.closeCompose.addEventListener("click", () => {
    showPanel("empty");
  });

  dom.composeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    sendEmail(
      dom.composeTo.value,
      dom.composeSubject.value || "(No subject)",
      dom.composeBody.value
    );
    showPanel("empty");
  });

  dom.saveDraftBtn.addEventListener("click", () => {
    saveDraft(
      dom.composeTo.value,
      dom.composeSubject.value,
      dom.composeBody.value
    );
    showPanel("empty");
  });

  dom.discardBtn.addEventListener("click", () => {
    showPanel("empty");
  });

  // Search & Filter
  dom.searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    renderMailList();
  });

  dom.filterSelect.addEventListener("change", (e) => {
    state.filterMode = e.target.value;
    renderMailList();
  });

  dom.refreshBtn.addEventListener("click", () => {
    renderMailList();
  });

  // Detail actions
  dom.starBtn.addEventListener("click", () => {
    if (state.selectedId) toggleStar(state.selectedId);
  });

  dom.replyBtn.addEventListener("click", () => {
    const email = state.emails.find((e) => e.id === state.selectedId);
    if (!email) return;
    dom.composeTo.value = email.from.match(/<(.+)>/)?.[1] || email.from;
    dom.composeSubject.value = "Re: " + email.subject;
    dom.composeBody.value = "";
    showPanel("compose");
  });

  dom.deleteBtn.addEventListener("click", () => {
    if (state.selectedId) deleteEmail(state.selectedId);
  });

  dom.backBtn.addEventListener("click", () => {
    state.selectedId = null;
    showPanel("empty");
    renderMailList();
  });

  // AI: Summarize
  dom.aiSummarizeBtn.addEventListener("click", async () => {
    const email = state.emails.find((e) => e.id === state.selectedId);
    if (!email) return;
    dom.aiResult.classList.remove("hidden");
    dom.aiResult.innerHTML = '<div class="ai-loading"></div> Summarizing...';
    const summary = await aiEngine.summarize(email.body);
    dom.aiResult.textContent = summary;
  });

  // AI: Suggest Reply
  dom.aiReplySuggestBtn.addEventListener("click", async () => {
    const email = state.emails.find((e) => e.id === state.selectedId);
    if (!email) return;
    dom.aiResult.classList.remove("hidden");
    dom.aiResult.innerHTML =
      '<div class="ai-loading"></div> Generating reply suggestion...';
    const reply = await aiEngine.suggestReply(email);
    dom.aiResult.textContent = reply;

    // Allow user to use the suggestion
    const useBtn = document.createElement("button");
    useBtn.className = "btn-ai";
    useBtn.style.marginTop = "8px";
    useBtn.textContent = "Use this reply";
    useBtn.addEventListener("click", () => {
      dom.composeTo.value =
        email.from.match(/<(.+)>/)?.[1] || email.from;
      dom.composeSubject.value = "Re: " + email.subject;
      dom.composeBody.value = reply;
      showPanel("compose");
    });
    dom.aiResult.appendChild(document.createElement("br"));
    dom.aiResult.appendChild(useBtn);
  });

  // AI: Draft email
  dom.aiDraftBtn.addEventListener("click", async () => {
    const topic = dom.composeSubject.value || "general follow-up";
    dom.composeBody.value = "Generating draft...";
    dom.composeBody.disabled = true;
    const draft = await aiEngine.draftEmail(topic);
    dom.composeBody.value = draft;
    dom.composeBody.disabled = false;
  });

  // AI: Improve text
  dom.aiImproveBtn.addEventListener("click", async () => {
    const text = dom.composeBody.value;
    if (!text.trim()) return;
    dom.composeBody.disabled = true;
    const improved = await aiEngine.improveText(text);
    dom.composeBody.value = improved;
    dom.composeBody.disabled = false;
  });

  // AI Chat
  function addAiMessage(text, role) {
    const div = document.createElement("div");
    div.className = "ai-msg " + role;
    div.textContent = text;
    dom.aiMessages.appendChild(div);
    dom.aiMessages.scrollTop = dom.aiMessages.scrollHeight;
  }

  async function handleAiChat() {
    const question = dom.aiInput.value.trim();
    if (!question) return;
    addAiMessage(question, "user");
    dom.aiInput.value = "";

    const loadingDiv = document.createElement("div");
    loadingDiv.className = "ai-msg assistant";
    loadingDiv.innerHTML = '<div class="ai-loading"></div>';
    dom.aiMessages.appendChild(loadingDiv);

    const answer = await aiEngine.chat(question, state.emails);
    dom.aiMessages.removeChild(loadingDiv);
    addAiMessage(answer, "assistant");
  }

  dom.aiSendBtn.addEventListener("click", handleAiChat);
  dom.aiInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleAiChat();
  });

  // ---------- Keyboard Shortcuts ----------
  document.addEventListener("keydown", (e) => {
    // Don't trigger shortcuts when typing in inputs
    if (
      e.target.tagName === "INPUT" ||
      e.target.tagName === "TEXTAREA" ||
      e.target.tagName === "SELECT"
    )
      return;

    if (e.key === "c") {
      dom.composeBtn.click();
    } else if (e.key === "Escape") {
      showPanel("empty");
      state.selectedId = null;
      renderMailList();
    } else if (e.key === "/" ) {
      e.preventDefault();
      dom.searchInput.focus();
    }
  });

  // ---------- Init ----------
  updateInboxCount();
  renderMailList();
  showPanel("empty");
})();
