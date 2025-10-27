// 💬 app.js — AI Study Buddy
// ------------------------------------------------------
// Handles all frontend logic: UI rendering, local storage, and backend chat communication.

/* ------------------------------------------------------------------ */
/*                            DOM ELEMENTS                            */
/* ------------------------------------------------------------------ */
let currentChatId = null;
const chatList = document.getElementById("chatList");
const chatBox = document.getElementById("chatBox");
const input = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");

/* ------------------------------------------------------------------ */
/*                         INITIALIZATION                             */
/* ------------------------------------------------------------------ */
// Set up textarea auto-resize and load sidebar chat list from localStorage
enableAutoGrow(input);
loadChatList();

// Send message when button clicked
sendBtn.onclick = (e) => {
    e.preventDefault();
    void sendMessage();
};

// Start a new chat when "New Chat" button clicked
newChatBtn.onclick = newChat;

// Allow "Enter" to send messages, Shift+Enter for newline
input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) void sendMessage();
    }
});
// Update live stats bar
updateStatsBar();

/* ------------------------------------------------------------------ */
/*                          MAIN CHAT LOGIC                           */
/* ------------------------------------------------------------------ */
// Start a brand-new conversation
function newChat() {
    if(sendBtn.disabled) return;
    currentChatId = null;
    clearChatBox("New chat started. Type your first message!");
    deactivateAllChats(); // Remove highlight from sidebar
}

// Handles sending messages from the user to the backend AI
async function sendMessage() {
    const msg = input.value.trim();
    if (!msg) return; // Ignore empty input

    // Display user's message
    appendMessage("user", msg);
    input.value = "";
    input.style.height = "auto";

    // Remove placeholder ("new chat" text)
    removePlaceholder();
    // Disable Send button during AI processing
    sendBtn.disabled = true;
    // Create new chat id if one doesn't exist yet
    if (!currentChatId) {
        currentChatId = generateChatId();
        const chats = getChatsSafe();
        const title = formatTitle(msg);
        chats.push({ id: currentChatId, title, renamed: true });
        saveChats(chats);
        loadChatList(); // Refresh sidebar
    }

    // Send message to backend (Durable Object / AI)
    const reply = await safeFetch(`/chat/${currentChatId}`, {
        method: "POST",
        body: msg,
        headers: { "Content-Type": "text/plain" },
    });
    if (!reply) return;

    // Add delay to simulate AI "thinking"
    await delay(1000 + Math.random() * 500);

    // Show AI reply
    appendMessage("ai", reply);

    // Update rewards
    await updateStats();

    // Update chat title automatically if user hasn’t renamed it
    renameChat(currentChatId, formatTitle(msg));

    // Re-enable Send button after AI reply
    sendBtn.disabled = false;

}

/* ------------------------------------------------------------------ */
/*                         SIDEBAR MANAGEMENT                         */
/* ------------------------------------------------------------------ */
// Load chat list from localStorage into sidebar
function loadChatList() {
    chatList.innerHTML = "";
    const chats = getChatsSafe();
    for (const chat of chats) chatList.appendChild(createChatListItem(chat));
}

// Creates a sidebar chat item (title + delete button)
function createChatListItem({ id, title }) {
    const li = createElement("li");
    li.classList.toggle("active", id === currentChatId);
    li.style.cursor = "pointer"; // Make entire row clickable

    const span = createElement("span", "chat-title", title);
    const btn = createElement("button", "delete-btn", "🗑");

    // Clicking row opens chat (except delete button)
    li.onclick = (e) => {
        const target = e.target instanceof Element ? e.target : null;
        if (target && isInsideDeleteButton(target)) return;
        void handleOpenChat(id);
    };

    // Double-click title to rename
    span.ondblclick = (e) => handleRenameChat(e, id);

    // Click bin icon to delete
    btn.onclick = (e) => handleDeleteChat(e, id);

    li.append(span, btn);
    return li;
}

/* ------------------------------------------------------------------ */
/*                         EVENT HANDLERS                             */
/* ------------------------------------------------------------------ */
// Opens selected chat from sidebar
async function handleOpenChat(id) {
    if (sendBtn.disabled) return;
    if (id === currentChatId) return; // Already open
    currentChatId = id;
    await openChat(id);
    loadChatList(); // Refresh highlight
}

// Handles double-click rename on chat titles
function handleRenameChat(e, id) {
    e.stopPropagation();
    const span = e.target;
    const li = getListItem(span);
    if (!li) return;
    if (hasRenameInput(li)) return;// Avoid duplicate inputs

    // Replace title span with input field
    const currentTitle = span.textContent || "";
    const renameInputEl = replaceWithInput(span, currentTitle);

    setupRenameListeners(renameInputEl, id, currentTitle);
}

// Handles Enter/Escape/blur for renaming input
function setupRenameListeners(inputEl, id, oldTitle) {
    let canceled = false;
    let done = false;
    // Save or cancel rename
    const finishRename = (save) => {
        if(done) return;
        done = true;
        const newTitle = save ? inputEl.value.trim() : oldTitle;
        const span = createElement("span", "chat-title", newTitle);
        span.ondblclick = (ev) => handleRenameChat(ev, id);
        if(inputEl.isConnected) inputEl.replaceWith(span);

        if (save && newTitle && newTitle !== oldTitle) {
            renameChat(id, newTitle, true);
            loadChatList(); // Refresh sidebar
        }
    };

    inputEl.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") finishRename(true);
        else if (ev.key === "Escape") {
            canceled = true;
            finishRename(false);
            inputEl.blur();
        }
    });

    inputEl.addEventListener("blur", () => {
        if (!canceled) finishRename(true);
    });
}

// Handles deletion of a chat (both backend + local)
async function handleDeleteChat(e, id) {
    e.stopPropagation();
    if (!confirm("Delete this chat?")) return;

    // Reset conversation in Durable Object
    const reply = await safeFetch(`/chat/${id}/reset`, { method: "POST" });
    if (reply === null) return;

    // Remove locally
    deleteChatLocal(id);

    // If currently open chat deleted, clear UI
    if (currentChatId === id) {
        currentChatId = null;
        clearChatBox("Chat deleted. Start a new one!");
    }

    loadChatList();
}

/* ------------------------------------------------------------------ */
/*                         CHAT MANAGEMENT                            */
/* ------------------------------------------------------------------ */
// Loads chat history from backend and displays it
async function openChat(id) {
    clearChatBox("Loading chat...");
    const historyText = await safeFetch(`/chat/${id}`, { method: "GET" });
    if (!historyText) return;

    chatBox.innerHTML = "";
    const lines = historyText.split("\n").filter((l) => l.trim());
    if (!lines.length) {
        clearChatBox("No history yet.");
        return;
    }

    // Parse stored lines as user/AI messages
    for (const line of lines) {
        if (line.startsWith("User: ")) appendMessage("user", line.slice(6));
        else if (line.startsWith("AI: ")) appendMessage("ai", line.slice(4));
    }

    scrollToBottom();
}

/* ------------------------------------------------------------------ */
/*                            CHAT STORAGE                            */
/* ------------------------------------------------------------------ */
// Safe localStorage read (avoids broken JSON)
function getChatsSafe() {
    try {
        return JSON.parse(localStorage.getItem("chats") || "[]");
    } catch {
        localStorage.removeItem("chats");
        return [];
    }
}

// Save all chats to localStorage
function saveChats(chats) {
    localStorage.setItem("chats", JSON.stringify(chats));
}

// Find chat by ID
function findChatById(id) {
    const chats = getChatsSafe();
    const idx = chats.findIndex((c) => c.id === id);
    const chat = idx !== -1 ? chats[idx] : null;
    return { chats, idx, chat };
}

// Rename chat (manual or automatic)
function renameChat(id, title, manual = false) {
    const { chats, idx, chat } = findChatById(id);
    if (idx === -1) {
        chats.push({ id, title, renamed: manual ? true : true });
    } else {
        if (manual) {
            chat.title = title;
            chat.renamed = true;
        } else if (!chat.renamed) {
            chat.title = title;
            chat.renamed = true;
        }
    }
    saveChats(chats);
}

// Delete chat record locally
function deleteChatLocal(id) {
    const { chats, idx } = findChatById(id);
    if (idx !== -1) {
        chats.splice(idx, 1);
        saveChats(chats);
    }
}

/* ------------------------------------------------------------------ */
/*                        Rewards                                     */
/* ------------------------------------------------------------------ */

// get current stats or create new
function getStats() {
    try {
        return JSON.parse(localStorage.getItem("stats")) || { points: 0, streak: 0, lastActive: null };
    } catch {
        return { points: 0, streak: 0, lastActive: null };
    }
}

// save stats back to localStorage
function saveStats(stats) {
    localStorage.setItem("stats", JSON.stringify(stats));
}

// main update function
async function updateStats() {
    const stats = getStats();
    const today = getTodayDate();

    // Calculate streak
    let alreadyEarnedXP = stats.lastActive === today;
    if (alreadyEarnedXP) {
        saveStats(stats);
        return;
    }
     else if (isYesterday(stats.lastActive)) {
        stats.streak += 1; // consecutive day
        showPopup(`🔥 Streak ${stats.streak}!`, "white", "rgba(255,87,34,0.9)");

    } else {
        stats.streak = 1; // reset streak
        showPopup("🌅 New streak started!", "white", "rgba(0,150,255,0.9)");
    }

    stats.lastActive = today;

    // Points logic
    let bonus = 10;
    if (stats.streak === 2) bonus = 15;
    else if (stats.streak === 3) bonus = 20;
    else if (stats.streak >= 4) bonus = 25;

    stats.points += bonus;
    saveStats(stats);
    updateStatsBar();


    // XP popup
    await delay(1500);
    showPopup(`⭐ +${bonus} XP`, "#222", "rgba(255,215,0,0.9)");

    console.log(`🔥 Streak: ${stats.streak} days | ⭐ +${bonus} points | Total: ${stats.points}`);

}
// show animated popup text
function showPopup(text, color = "#222", bg = "rgba(255,215,0,0.9)") {
    const popup = document.createElement("div");
    popup.className = "xp-popup";
    popup.style.color = color;
    popup.style.background = bg;
    popup.textContent = text;

    chatBox.style.position = "relative";
    chatBox.appendChild(popup);

    // Trigger animation by forcing reflow (so CSS animation runs)
    void popup.offsetWidth;
    popup.classList.add("visible");

    // Remove after animation ends
    setTimeout(() => popup.remove(), 1500);
}


/* ------------------------------------------------------------------ */
/*                              HELPERS                               */
/* ------------------------------------------------------------------ */
// --- DOM helpers ---
function createElement(tag, className = "", text = "") {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
}

// Replace chat title <span> with editable <input>
function replaceWithInput(span, oldTitle) {
    const input = document.createElement("input");
    input.type = "text";
    input.value = oldTitle;
    input.className = "rename-input";
    span.replaceWith(input);
    input.focus();
    input.select();
    return input;
}

// --- Chat UI helpers ---
function appendMessage(sender, text) {
    const div = createMessageElement(sender, text);
    chatBox.appendChild(div);
    scrollToBottom();
    return div;
}

// Create formatted message element (user/AI/error)
function createMessageElement(sender, text) {
    const div = createElement("div", sender);
    div.innerHTML = `${text}`;
    return div;
}

// Scroll chat to latest message
function scrollToBottom() {
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Clear chat UI and show a placeholder message
function clearChatBox(message = "") {
    chatBox.innerHTML = message ? `<em>${message}</em>` : "";
}

// Remove placeholder message on request
function removePlaceholder() {
    const placeholder = chatBox.querySelector("em");
    if (placeholder) placeholder.remove();
}

// Remove “active” highlighting from all sidebar chats
function deactivateAllChats() {
    chatList.querySelectorAll("li").forEach((li) => li.classList.remove("active"));
}

// --- Logic helpers ---
// Create random chat ID
function generateChatId() {
    return Math.random().toString(36).substring(2, 10);
}

// Shorten long message into a readable chat title
function formatTitle(text) {
    return text.length > 30 ? text.slice(0, 15) + "..." : text;
}

// Promise-based delay (used for AI thinking effect)
async function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Safe wrapper for fetch with error handling + UI feedback
async function safeFetch(url, options) {
    try {
        const res = await fetch(url, options);
        if (!res.ok) {
            appendMessage("error", `⚠️ Server error (${res.status})`);
            return null;
        }
        return await res.text();
    } catch (err) {
        appendMessage("error", "⚠️ Network error. Try again later.");
        return null;
    }
}

// Automatically grow input textarea height as user types
function enableAutoGrow(el) {
    const resize = () => {
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
    };
    el.addEventListener("input", resize);
    resize();
}

// Checks if click target was inside delete button (prevents chat open)
function isInsideDeleteButton(el) {
    while (el && el instanceof Element) {
        if (el.classList.contains("delete-btn")) return true;
        el = el.parentElement;
    }
    return false;
}

// Find the parent <li> element
function getListItem(el) {
    while (el && el instanceof Element) {
        if (el.tagName === "LI") return el;
        el = el.parentElement;
    }
    return null;
}

// Detect if a chat item is already being renamed
function hasRenameInput(li) {
    return li.querySelector("input.rename-input") !== null;
}

// get today's date in YYYY-MM-DD
function getTodayDate() {
    return new Date().toISOString().slice(0, 10);
}

// check if a date string is yesterday
function isYesterday(dateStr) {
    if (!dateStr) return false;
    const d1 = new Date(dateStr);
    const d2 = new Date();
    d2.setDate(d2.getDate() - 1);
    return d1.toISOString().slice(0, 10) === d2.toISOString().slice(0, 10);
}
// Updates the stats bar with current XP and streak
function updateStatsBar() {
    const stats = getStats();
    const xpEl = document.getElementById("xpPoints");
    const streakEl = document.getElementById("streakDays");

    if (!xpEl || !streakEl) return;

    xpEl.textContent = `⭐ ${stats.points} XP`;
    streakEl.textContent = `🔥 ${stats.streak}-day streak`;
}
