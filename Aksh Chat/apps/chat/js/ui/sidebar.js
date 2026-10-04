import { state } from "../state.js";
import { fetchProfile } from "../services/users.js";
import { formatTime } from "../utils/timestamps.js";
import { escapeHtml, createElement, safeSrc } from "../utils/dom.js";
import { openChat } from "./chat.js";

const chatListEl = document.getElementById("chat-list");
const searchInput = document.getElementById("search-input");

export let currentChats = [];

export function initSidebar() {
    searchInput.addEventListener("input", renderChatList);
}

export async function updateChats(chats) {
    currentChats = chats;
    state.chats = chats;
    await renderChatList();
}

export async function renderChatList() {
    if (!chatListEl) return;
    const term = searchInput.value.toLowerCase().trim();
    chatListEl.innerHTML = "";
    
    // Sort logic usually done by firestore, but we ensure stable display
    
    for (const chat of currentChats) {
        let title = chat.name || "Unknown Chat";
        let avatar = chat.icon || "/chat-logo.png";
        
        // Handle DM profile
        if (chat.type === "dm") {
            const otherUid = chat.participants.find(uid => uid !== state.currentUser.uid);
            if (otherUid) {
                const profile = await fetchProfile(otherUid);
                title = profile.nickname || profile.fullName || "User";
                avatar = profile.photoURL || "/chat-logo.png";
            }
        }
        
        // Filter by term
        if (term && !title.toLowerCase().includes(term)) {
            continue;
        }
        
        const isActive = state.activeChatId === chat.id;
        
        const div = createElement("div", `chat-item ${isActive ? 'active' : ''}`);
        
        const img = createElement("img", "avatar", { src: safeSrc(avatar), alt: "" });
        
        const infoDiv = createElement("div", "chat-info");
        const titleRow = createElement("div", "chat-title-row");
        const titleEl = createElement("span", "chat-title", { textContent: title });
        const timeEl = createElement("span", "chat-time", { textContent: formatTime(chat.lastMessageTime) });
        
        titleRow.appendChild(titleEl);
        titleRow.appendChild(timeEl);
        
        const previewRow = createElement("div", "chat-preview-row", { style: "display: flex; justify-content: space-between; align-items: center;" });
        const previewEl = createElement("div", "chat-preview", { textContent: chat.lastMessage || "", style: "flex: 1;" });
        previewRow.appendChild(previewEl);

        // Unread badge logic
        if (chat.lastMessageTime && state.currentUser) {
            import("../utils/timestamps.js").then(({ normalizeTimestamp }) => {
                const myReadTime = chat.readReceipts && chat.readReceipts[state.currentUser.uid];
                const myReadDate = normalizeTimestamp(myReadTime);
                const lastMsgDate = normalizeTimestamp(chat.lastMessageTime);
                const myReadMs = myReadDate ? myReadDate.getTime() : 0;
                const lastMsgMs = lastMsgDate ? lastMsgDate.getTime() : 0;
                if (lastMsgMs > myReadMs && state.activeChatId !== chat.id) {
                    const badge = createElement("div", "unread-badge", { textContent: "•", style: "color: var(--primary); font-size: 20px; line-height: 1;" });
                    previewRow.appendChild(badge);
                }
            });
        }
        
        infoDiv.appendChild(titleRow);
        infoDiv.appendChild(previewRow);
        
        div.appendChild(img);
        div.appendChild(infoDiv);
        
        div.addEventListener("click", () => {
            document.querySelectorAll(".chat-item").forEach(el => el.classList.remove("active"));
            div.classList.add("active");
            openChat(chat.id, { title, avatar, ...chat });
        });
        
        chatListEl.appendChild(div);
    }
}
