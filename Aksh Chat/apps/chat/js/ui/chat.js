import { state, clearRoomState } from "../state.js";
import { listenToMessages, sendMessage, deleteForMe, deleteForEveryone, editMessage } from "../services/messages.js";
import { fetchProfile } from "../services/users.js";
import { uploadAttachment } from "../services/media.js";
import { formatTime } from "../utils/timestamps.js";
import { escapeHtml, createElement, safeSrc } from "../utils/dom.js";

const chatArea = document.getElementById("chat-area");
const chatHeaderTitle = document.getElementById("chat-header-title");
const chatHeaderSubtitle = document.getElementById("chat-header-subtitle");
const chatHeaderAvatar = document.getElementById("chat-header-avatar");
const messageListEl = document.getElementById("message-list");
const messageInput = document.getElementById("message-input");
const btnSend = document.getElementById("btn-send");
const fileInput = document.getElementById("file-input");
const btnAttach = document.getElementById("btn-attach");

let currentMessages = [];

export function initChatUI() {
    btnSend.addEventListener("click", handleSend);
    messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });
    
    btnAttach.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", handleFileSelected);
    
    document.getElementById("btn-mobile-back")?.addEventListener("click", () => {
        clearRoomState();
        state.activeChatId = null;
        chatArea.classList.add("empty");
        document.querySelectorAll(".chat-item").forEach(el => el.classList.remove("active"));
    });
    
    document.getElementById("btn-chat-menu")?.addEventListener("click", (e) => {
        import("./menus.js").then(({ showChatMenu }) => {
            showChatMenu(e, handleChatMenuAction);
        });
    });
    
    document.querySelector(".chat-header-info")?.addEventListener("click", () => {
        handleChatMenuAction("info");
    });
    document.querySelector(".chat-header-info").style.cursor = "pointer";
}

async function handleChatMenuAction(action) {
    if (!state.activeChatId) return;
    try {
        if (action === "clear") {
            if (confirm("Clear this chat? This deletes it for you only.")) {
                const { clearChat } = await import("../services/chats.js");
                await clearChat(state.activeChatId);
                // Trigger re-render by clearing messages array locally
                currentMessages = [];
                renderMessages();
            }
        } else if (action === "export") {
            alert("Export feature coming soon.");
        } else if (action === "info") {
            if (state.activeChatData.type === "group") {
                const { openGroupInfoModal } = await import("./modals.js");
                openGroupInfoModal(state.activeChatData);
            } else {
                const { openContactInfoModal } = await import("./modals.js");
                openContactInfoModal(state.activeChatData);
            }
        }
    } catch (e) {
        console.error(e);
        alert("Action failed.");
    }
}

export async function openChat(chatId, metadata) {
    if (state.activeChatId === chatId) return;
    
    clearRoomState();
    
    state.activeChatId = chatId;
    state.activeChatData = metadata;
    
    chatArea.classList.remove("empty");
    chatHeaderTitle.textContent = metadata.title;
    chatHeaderAvatar.src = safeSrc(metadata.avatar);
    
    if (metadata.type === "group") {
        chatHeaderSubtitle.textContent = `${metadata.participants.length} participants`;
    } else {
        chatHeaderSubtitle.textContent = "Direct Message";
    }
    
    const pinContainer = document.getElementById("pin-container");
    if (pinContainer) pinContainer.innerHTML = "";
    
    if (metadata.pinnedMessage && metadata.pinExpiry > Date.now()) {
        if (pinContainer) {
            const banner = createElement("div", "pin-banner");
            banner.style.padding = "8px 16px";
            banner.style.background = "var(--bg-tertiary)";
            banner.style.borderBottom = "1px solid var(--border)";
            banner.style.display = "flex";
            banner.style.justifyContent = "space-between";
            banner.style.alignItems = "center";
            
            const textDiv = createElement("div", "", { textContent: `📌 Pinned: ${metadata.pinnedMessage.text}` });
            textDiv.style.fontSize = "13px";
            textDiv.style.overflow = "hidden";
            textDiv.style.textOverflow = "ellipsis";
            textDiv.style.whiteSpace = "nowrap";
            
            const unpinBtn = createElement("button", "icon-btn small", { textContent: "✖" });
            unpinBtn.style.padding = "2px 6px";
            unpinBtn.onclick = async () => {
                const { unpinMessage } = await import("../services/chats.js");
                await unpinMessage(chatId);
                pinContainer.innerHTML = ""; // Optimistic UI
            };
            
            banner.appendChild(textDiv);
            banner.appendChild(unpinBtn);
            pinContainer.appendChild(banner);
        }
    }
    
    messageListEl.innerHTML = '<div class="loading-messages">Loading...</div>';
    
    // Mark as read
    const { updateReadReceipt } = await import("../services/chats.js");
    updateReadReceipt(chatId).catch(console.error);

    state.unsubscribers.messages = listenToMessages(chatId, (messages) => {
        // Async safety check: is this still the active chat?
        if (state.activeChatId !== chatId) return;
        currentMessages = messages;
        renderMessages();
        
        // Update read receipt if new messages arrived
        updateReadReceipt(chatId).catch(console.error);
    });
}

export async function renderMessages() {
    if (!messageListEl) return;
    
    // Remember scroll position logic
    const isAtBottom = messageListEl.scrollHeight - messageListEl.scrollTop <= messageListEl.clientHeight + 50;
    
    messageListEl.innerHTML = "";
    
    for (const msg of currentMessages) {
        if (state.hiddenMessageIds.has(msg.id)) continue;
        
        const msgTimeMs = msg.createdAt?.toMillis ? msg.createdAt.toMillis() : Date.now();
        
        // 60-day retention logic (hide if older than 60 days)
        const ageInMs = Date.now() - msgTimeMs;
        if (ageInMs > 60 * 24 * 60 * 60 * 1000) continue;
        
        // Clear chat logic
        const meta = state.chatMeta[state.activeChatId];
        if (meta && meta.clearTimestamp) {
            const clearMs = meta.clearTimestamp.toMillis ? meta.clearTimestamp.toMillis() : 0;
            if (msgTimeMs <= clearMs) continue;
        }
        
        const isMine = msg.senderId === state.currentUser.uid;
        const profile = await fetchProfile(msg.senderId);
        
        const wrap = createElement("div", `msg-wrapper ${isMine ? 'mine' : 'theirs'}`);
        const bubble = createElement("div", "msg-bubble");
        
        if (!isMine && state.activeChatData?.type === "group") {
            const senderName = createElement("div", "msg-sender", { textContent: profile.nickname });
            bubble.appendChild(senderName);
        }
        
        if (msg.deletedForEveryone) {
            bubble.classList.add("deleted");
            bubble.appendChild(createElement("span", "", { textContent: "This message was deleted" }));
        } else {
            if (msg.replyTo) {
                const replyDiv = createElement("div", "msg-replied", { 
                    textContent: `Replying to: ${msg.replyTo.text || "attachment"}` 
                });
                replyDiv.style.fontSize = "12px";
                replyDiv.style.background = "rgba(0,0,0,0.05)";
                replyDiv.style.padding = "4px";
                replyDiv.style.borderRadius = "4px";
                replyDiv.style.marginBottom = "4px";
                replyDiv.style.borderLeft = "3px solid var(--primary)";
                bubble.appendChild(replyDiv);
            }
            if (msg.forwarded) {
                const fwdDiv = createElement("div", "msg-forwarded", { textContent: "➦ Forwarded" });
                fwdDiv.style.fontSize = "12px";
                fwdDiv.style.color = "var(--text-muted)";
                fwdDiv.style.fontStyle = "italic";
                fwdDiv.style.marginBottom = "4px";
                bubble.appendChild(fwdDiv);
            }
            if (msg.attachment) {
                const attachLink = createElement("a", "msg-attachment", { 
                    href: safeSrc(msg.attachment.url), 
                    target: "_blank",
                    textContent: `📄 ${msg.attachment.name}`
                });
                bubble.appendChild(attachLink);
            }
            if (msg.text) {
                const textNode = createElement("div", "msg-text", { textContent: msg.text });
                bubble.appendChild(textNode);
            }
        }
        
        const timeWrap = createElement("div", "msg-time-wrap", { style: "display: flex; gap: 4px; align-items: center; margin-top: 4px;" });
        const time = createElement("span", "msg-time", { textContent: formatTime(msg.createdAt) });
        timeWrap.appendChild(time);
        
        if (msg.edited) {
            const editedTag = createElement("span", "msg-edited", { textContent: "(edited)", style: "font-size: 10px; color: var(--text-muted); font-style: italic;" });
            timeWrap.appendChild(editedTag);
        }
        
        wrap.appendChild(bubble);
        wrap.appendChild(timeWrap);
        
        // Context menu
        bubble.style.cursor = "pointer";
        bubble.addEventListener("click", (e) => {
            import("./menus.js").then(({ showMessageMenu }) => {
                showMessageMenu(e, msg, isMine, handleMessageAction);
            });
        });
        
        messageListEl.appendChild(wrap);
    }
    
    if (isAtBottom) {
        messageListEl.scrollTop = messageListEl.scrollHeight;
    }
}

async function handleMessageAction(action, msg) {
    if (!state.activeChatId) return;
    try {
        if (action === "edit") {
            state.editMessageId = msg.id;
            messageInput.value = msg.text || "";
            messageInput.focus();
        } else if (action === "delete_me") {
            await deleteForMe(state.activeChatId, [msg.id]);
        } else if (action === "delete_everyone") {
            await deleteForEveryone(state.activeChatId, [msg.id]);
        } else if (action === "reply") {
            state.replyMessageId = msg.id;
            state.replyMessageData = msg;
            
            // Show reply banner
            const banner = document.getElementById("reply-banner");
            const textEl = document.getElementById("reply-text");
            const userEl = document.getElementById("reply-user");
            
            if (banner && textEl && userEl) {
                textEl.textContent = msg.text || "Attachment";
                const prof = state.profileCache.get(msg.senderId);
                userEl.textContent = prof ? (prof.nickname || prof.fullName) : "User";
                banner.classList.remove("hidden");
                
                document.getElementById("btn-cancel-reply").onclick = () => {
                    state.replyMessageId = null;
                    state.replyMessageData = null;
                    banner.classList.add("hidden");
                };
            }
        } else if (action === "pin") {
            const { pinMessage } = await import("../services/chats.js");
            await pinMessage(state.activeChatId, msg);
        } else if (action === "star") {
            const { starMessage } = await import("../services/messages.js");
            await starMessage(state.activeChatId, msg.id, msg);
            alert("Message starred!"); // Temporary feedback
        } else if (action === "forward") {
            const { openForwardModal } = await import("./modals.js");
            openForwardModal(msg);
        }
    } catch (err) {
        console.error(err);
        alert("Action failed.");
    }
}

async function handleSend() {
    const text = messageInput.value.trim();
    const chatId = state.activeChatId;
    if (!chatId || !text) return;
    
    messageInput.value = "";
    
    try {
        if (state.editMessageId) {
            await editMessage(chatId, state.editMessageId, text);
            state.editMessageId = null;
        } else {
            await sendMessage(chatId, text, "text", null, state.replyMessageData);
        }
        
        if (state.activeChatId === chatId) {
            messageListEl.scrollTop = messageListEl.scrollHeight;
            
            // clear reply
            state.replyMessageId = null;
            state.replyMessageData = null;
            document.getElementById("reply-banner")?.classList.add("hidden");
        }
    } catch (e) {
        console.error(e);
        messageInput.value = text;
        alert("Failed to send message.");
    }
}

async function handleFileSelected(e) {
    const file = e.target.files[0];
    const chatId = state.activeChatId;
    if (!file || !chatId) return;
    
    e.target.value = ''; // clear input
    
    try {
        // Show loading placeholder conceptually
        const meta = await uploadAttachment(chatId, file);
        if (state.activeChatId === chatId) {
            await sendMessage(chatId, "", "file", meta);
        }
    } catch (err) {
        console.error(err);
        alert(err.message || "Failed to upload file.");
    }
}
