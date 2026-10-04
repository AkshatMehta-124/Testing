import { searchUsers } from "../services/users.js";
import { createDirectMessage, createGroup } from "../services/chats.js";
import { state } from "../state.js";
import { createElement, safeSrc } from "../utils/dom.js";

// Modal elements will be injected dynamically into body or we can construct them when needed
export function initModals() {
    document.getElementById("btn-new-chat")?.addEventListener("click", openNewChatModal);
    document.getElementById("btn-new-group")?.addEventListener("click", openNewGroupModal);
    document.getElementById("btn-settings")?.addEventListener("click", openSettingsModal);
}

function createModalOverlay(title, contentEl, onClose) {
    const overlay = createElement("div", "overlay flex-center", { zIndex: 2000 });
    const modal = createElement("div", "modal");
    
    const header = createElement("div", "modal-header");
    const h2 = createElement("h2", "", { textContent: title });
    const closeBtn = createElement("button", "icon-btn", { innerHTML: '<span class="material-symbols-rounded">close</span>' });
    
    const closeFn = () => {
        document.body.removeChild(overlay);
        if (onClose) onClose();
    };
    
    closeBtn.addEventListener("click", closeFn);
    
    header.appendChild(h2);
    header.appendChild(closeBtn);
    modal.appendChild(header);
    modal.appendChild(contentEl);
    overlay.appendChild(modal);
    
    document.body.appendChild(overlay);
    return { overlay, modal, closeFn };
}

async function openNewChatModal() {
    const content = createElement("div", "modal-content");
    const input = createElement("input", "modal-input", { placeholder: "Search users by name..." });
    const results = createElement("div", "search-results");
    
    input.addEventListener("input", async (e) => {
        const term = e.target.value;
        results.innerHTML = "Searching...";
        try {
            const users = await searchUsers(term);
            results.innerHTML = "";
            users.forEach(u => {
                if (u.uid === state.currentUser.uid) return;
                const row = createElement("div", "user-row");
                row.appendChild(createElement("img", "avatar small", { src: safeSrc(u.photoURL) }));
                row.appendChild(createElement("span", "", { textContent: u.nickname || u.fullName }));
                row.addEventListener("click", async () => {
                    try {
                        const chatId = await createDirectMessage(u.uid);
                        // The active listener will pick up the new chat and render it in sidebar
                        modalObj.closeFn();
                    } catch (err) {
                        alert("Failed to create chat");
                    }
                });
                results.appendChild(row);
            });
            if (users.length === 0 || (users.length === 1 && users[0].uid === state.currentUser.uid)) {
                results.textContent = "No users found.";
            }
        } catch (err) {
            results.textContent = "Error searching.";
        }
    });
    
    content.appendChild(input);
    content.appendChild(results);
    const modalObj = createModalOverlay("New Chat", content);
}

function openNewGroupModal() {
    const content = createElement("div", "modal-content");
    const nameInput = createElement("input", "modal-input", { placeholder: "Group Name" });
    const searchInput = createElement("input", "modal-input", { placeholder: "Search users to add..." });
    const results = createElement("div", "search-results");
    const selectedDiv = createElement("div", "selected-users");
    const createBtn = createElement("button", "btn btn-primary", { textContent: "Create Group", disabled: true });
    
    let selectedUids = new Set();
    
    function renderSelected() {
        selectedDiv.textContent = `Selected: ${selectedUids.size}`;
        createBtn.disabled = selectedUids.size === 0 || !nameInput.value.trim();
    }
    
    nameInput.addEventListener("input", renderSelected);
    
    searchInput.addEventListener("input", async (e) => {
        const term = e.target.value;
        if (!term) { results.innerHTML = ""; return; }
        const users = await searchUsers(term);
        results.innerHTML = "";
        users.forEach(u => {
            if (u.uid === state.currentUser.uid) return;
            const row = createElement("div", "user-row");
            const isSel = selectedUids.has(u.uid);
            row.style.background = isSel ? "var(--bg-tertiary)" : "";
            row.appendChild(createElement("img", "avatar small", { src: safeSrc(u.photoURL) }));
            row.appendChild(createElement("span", "", { textContent: u.nickname || u.fullName }));
            row.addEventListener("click", () => {
                if (selectedUids.has(u.uid)) selectedUids.delete(u.uid);
                else selectedUids.add(u.uid);
                renderSelected();
                // trigger search again to update highlight, or manually toggle class
                row.style.background = selectedUids.has(u.uid) ? "var(--bg-tertiary)" : "";
            });
            results.appendChild(row);
        });
    });
    
    createBtn.addEventListener("click", async () => {
        try {
            await createGroup(nameInput.value, Array.from(selectedUids));
            modalObj.closeFn();
        } catch (e) {
            alert("Failed to create group: " + e.message);
        }
    });
    
    content.appendChild(nameInput);
    content.appendChild(selectedDiv);
    content.appendChild(searchInput);
    content.appendChild(results);
    content.appendChild(createBtn);
    
    const modalObj = createModalOverlay("New Group", content);
}

function openSettingsModal() {
    const content = createElement("div", "modal-content");
    content.appendChild(createElement("p", "", { textContent: "Profile & Settings coming soon." }));
    // Add logout button
    const logoutBtn = createElement("button", "btn", { textContent: "Sign Out" });
    logoutBtn.style.background = "var(--error)";
    logoutBtn.style.color = "white";
    logoutBtn.style.marginTop = "16px";
    logoutBtn.addEventListener("click", async () => {
        const { logout } = await import("../auth.js");
        logout();
        modalObj.closeFn();
    });
    content.appendChild(logoutBtn);
    
    const modalObj = createModalOverlay("Settings", content);
}

export function openForwardModal(messageData) {
    const content = createElement("div", "modal-content");
    const title = createElement("p", "", { textContent: `Forward: "${messageData.text || 'Attachment'}"` });
    content.appendChild(title);
    
    const searchInput = createElement("input", "modal-input", { placeholder: "Search chats to forward to..." });
    const results = createElement("div", "search-results");
    
    // Simple rendering of current chats for forwarding
    // In a real app, we might need a dedicated search over DMs/Groups
    const { currentChats } = import("./sidebar.js").then(m => {
        const chats = m.currentChats || [];
        chats.forEach(c => {
            const row = createElement("div", "user-row");
            let cName = c.name || "Chat";
            if (c.type === "dm") {
                // Approximate DM name (would ideally use profileCache)
                cName = "Direct Message";
            }
            row.appendChild(createElement("span", "", { textContent: cName }));
            row.addEventListener("click", async () => {
                try {
                    const { sendMessage } = await import("../services/messages.js");
                    // Add forwarded flag
                    await sendMessage(c.id, messageData.text || "", messageData.type || "text", messageData.attachment || null, null, true);
                    alert("Forwarded successfully");
                    modalObj.closeFn();
                } catch (e) {
                    alert("Failed to forward");
                }
            });
            results.appendChild(row);
        });
        if (chats.length === 0) results.textContent = "No chats available.";
    }).catch(() => {
        results.textContent = "Error loading chats.";
    });
    
    content.appendChild(searchInput);
    content.appendChild(results);
    
    const modalObj = createModalOverlay("Forward Message", content);
}

export function openGroupInfoModal(chatData) {
    const content = createElement("div", "modal-content");
    const title = createElement("p", "", { textContent: `Participants (${chatData.participants.length})` });
    content.appendChild(title);
    
    const results = createElement("div", "search-results");
    
    // Iterate through participants and fetch their profiles
    import("../services/users.js").then(async ({ fetchProfile }) => {
        const { safeSrc } = await import("../utils/dom.js");
        for (const uid of chatData.participants) {
            const prof = await fetchProfile(uid);
            const row = createElement("div", "user-row");
            row.appendChild(createElement("img", "avatar small", { src: safeSrc(prof.photoURL) }));
            
            const nameEl = createElement("span", "", { textContent: prof.nickname || prof.fullName });
            row.appendChild(nameEl);
            
            if (chatData.admins && chatData.admins.includes(uid)) {
                row.appendChild(createElement("span", "", { textContent: " (Admin)", style: "font-size: 10px; color: var(--primary)" }));
            }
            results.appendChild(row);
        }
    });
    
    content.appendChild(results);
    
    const leaveBtn = createElement("button", "btn", { textContent: "Leave Group" });
    leaveBtn.style.background = "var(--error)";
    leaveBtn.style.color = "white";
    leaveBtn.style.marginTop = "16px";
    leaveBtn.addEventListener("click", async () => {
        if (confirm("Are you sure you want to leave this group?")) {
            try {
                const { leaveGroup } = await import("../services/chats.js");
                await leaveGroup(chatData.id);
                modalObj.closeFn();
                // If it was the active chat, clear it
                const { state, clearRoomState } = await import("../state.js");
                if (state.activeChatId === chatData.id) {
                    clearRoomState();
                    state.activeChatId = null;
                    document.getElementById("chat-area").classList.add("empty");
                }
            } catch (err) {
                alert("Failed to leave group.");
            }
        }
    });
    content.appendChild(leaveBtn);
    
    const modalObj = createModalOverlay("Group Info", content);
}

export function openContactInfoModal(chatData) {
    const content = createElement("div", "modal-content");
    
    import("../state.js").then(async ({ state }) => {
        const otherUid = chatData.participants.find(uid => uid !== state.currentUser.uid);
        if (!otherUid) return;
        
        const { fetchProfile, blockUser, unblockUser } = await import("../services/users.js");
        const prof = await fetchProfile(otherUid);
        
        const img = createElement("img", "avatar", { src: import("../utils/dom.js").then(m => m.safeSrc(prof.photoURL)) });
        img.style.width = "100px";
        img.style.height = "100px";
        img.style.margin = "0 auto";
        img.style.display = "block";
        
        // Wait, fixing src Promise bug again...
        const { safeSrc } = await import("../utils/dom.js");
        img.src = safeSrc(prof.photoURL);
        
        content.appendChild(img);
        
        const nameEl = createElement("h3", "text-center", { textContent: prof.fullName || prof.nickname });
        content.appendChild(nameEl);
        
        const emailEl = createElement("p", "text-center", { textContent: prof.email || "" });
        emailEl.style.color = "var(--text-muted)";
        content.appendChild(emailEl);
        
        const isBlocked = state.blockedUserIds.has(otherUid);
        
        const blockBtn = createElement("button", "btn", { textContent: isBlocked ? "Unblock User" : "Block User" });
        blockBtn.style.background = isBlocked ? "var(--text-muted)" : "var(--error)";
        blockBtn.style.color = "white";
        blockBtn.style.marginTop = "20px";
        
        blockBtn.addEventListener("click", async () => {
            try {
                if (isBlocked) {
                    await unblockUser(otherUid);
                } else {
                    await blockUser(otherUid);
                }
                modalObj.closeFn();
            } catch (err) {
                alert("Action failed.");
            }
        });
        
        content.appendChild(blockBtn);
    });
    
    const modalObj = createModalOverlay("Contact Info", content);
}
