import { login, logout, getCurrentUser, getCurrentProfile } from "./auth.js";
import { listenToChats, listenToMessages, sendMessage, listenToHiddenMessages } from "./firestore.js";

// DOM Elements
const appRoot = document.getElementById("app-root");
const authOverlay = document.getElementById("auth-overlay");
const mainLayout = document.getElementById("main-layout");
const btnSignin = document.getElementById("btn-signin");

const chatListEl = document.getElementById("chat-list");
const chatArea = document.getElementById("chat-area");
const activeChatEl = document.getElementById("active-chat");
const messageListEl = document.getElementById("message-list");
const messageInput = document.getElementById("message-input");
const btnSend = document.getElementById("btn-send");
const chatHeaderTitle = document.getElementById("chat-header-title");
const chatHeaderAvatar = document.getElementById("chat-header-avatar");

// State
let activeChatId = null;
let chatsUnsubscribe = null;
let messagesUnsubscribe = null;
let hiddenUnsubscribe = null;
let hiddenMessageIds = new Set();
let cachedProfiles = {};

export function initUI() {
    btnSignin.addEventListener("click", () => login().catch(console.error));
    btnSend.addEventListener("click", handleSend);
    messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });
}

export function updateAuthState(user, profile) {
    if (user) {
        appRoot.classList.remove("loading");
        authOverlay.classList.add("hidden");
        mainLayout.classList.remove("hidden");
        
        // Start listening
        hiddenUnsubscribe = listenToHiddenMessages((hiddenSet) => {
            hiddenMessageIds = hiddenSet;
            if (activeChatId) renderMessagesCurrent();
        });

        chatsUnsubscribe = listenToChats((chats) => {
            renderChatList(chats);
        });
    } else {
        appRoot.classList.remove("loading");
        authOverlay.classList.remove("hidden");
        mainLayout.classList.add("hidden");
        
        // Cleanup listeners
        if (chatsUnsubscribe) chatsUnsubscribe();
        if (messagesUnsubscribe) messagesUnsubscribe();
        if (hiddenUnsubscribe) hiddenUnsubscribe();
        activeChatId = null;
        chatArea.classList.add("empty");
    }
}

function renderChatList(chats) {
    chatListEl.innerHTML = "";
    chats.forEach(chat => {
        const div = document.createElement("div");
        div.className = "chat-item";
        if (chat.id === activeChatId) div.classList.add("active");
        
        const title = chat.name || "Unknown Chat";
        const avatar = chat.icon || "/chat-logo.png";
        
        div.innerHTML = `
            <img src="${escapeHtml(avatar)}" class="avatar" alt="">
            <div class="chat-info">
                <div class="chat-title-row">
                    <span class="chat-title">${escapeHtml(title)}</span>
                    <span class="chat-time">${formatTime(chat.lastMessageTime)}</span>
                </div>
                <div class="chat-preview">${escapeHtml(chat.lastMessage || "")}</div>
            </div>
        `;
        div.addEventListener("click", () => openChat(chat));
        chatListEl.appendChild(div);
    });
}

function openChat(chat) {
    if (activeChatId === chat.id) return;
    
    // Cleanup old messages listener
    if (messagesUnsubscribe) messagesUnsubscribe();
    
    activeChatId = chat.id;
    chatArea.classList.remove("empty");
    
    chatHeaderTitle.textContent = chat.name || "Unknown Chat";
    chatHeaderAvatar.src = chat.icon || "/chat-logo.png";
    
    // Update active class in sidebar
    document.querySelectorAll(".chat-item").forEach(el => el.classList.remove("active"));
    // We would ideally re-render chat list or find the specific item
    
    messagesUnsubscribe = listenToMessages(chat.id, (messages) => {
        // Store messages in memory if needed, then render
        window.currentMessages = messages;
        renderMessagesCurrent();
    });
}

function renderMessagesCurrent() {
    const messages = window.currentMessages || [];
    messageListEl.innerHTML = "";
    
    const user = getCurrentUser();
    
    messages.forEach(msg => {
        if (hiddenMessageIds.has(msg.id)) return;
        
        const isMine = msg.senderId === user.uid;
        
        const div = document.createElement("div");
        div.style.display = "flex";
        div.style.flexDirection = "column";
        div.style.alignItems = isMine ? "flex-end" : "flex-start";
        div.style.marginBottom = "8px";
        
        const bubble = document.createElement("div");
        bubble.style.maxWidth = "75%";
        bubble.style.padding = "10px 14px";
        bubble.style.borderRadius = "12px";
        bubble.style.background = isMine ? "var(--message-out)" : "var(--message-in)";
        
        if (msg.deletedForEveryone) {
            bubble.style.fontStyle = "italic";
            bubble.style.color = "var(--text-muted)";
            bubble.textContent = "This message was deleted";
        } else {
            bubble.textContent = msg.text;
        }
        
        const time = document.createElement("div");
        time.style.fontSize = "10px";
        time.style.color = "var(--text-muted)";
        time.style.marginTop = "4px";
        time.textContent = formatTime(msg.createdAt);
        
        div.appendChild(bubble);
        div.appendChild(time);
        messageListEl.appendChild(div);
    });
    
    // Auto-scroll to bottom
    messageListEl.scrollTop = messageListEl.scrollHeight;
}

async function handleSend() {
    if (!activeChatId) return;
    const text = messageInput.value.trim();
    if (!text) return;
    
    messageInput.value = "";
    try {
        await sendMessage(activeChatId, text);
    } catch (e) {
        console.error("Failed to send:", e);
        // Restore text on failure
        messageInput.value = text;
        alert("Failed to send message. Check your connection.");
    }
}

function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function formatTime(timestamp) {
    if (!timestamp) return "";
    let date;
    if (timestamp.toDate) date = timestamp.toDate();
    else if (typeof timestamp === 'number') date = new Date(timestamp);
    else return "";
    
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
