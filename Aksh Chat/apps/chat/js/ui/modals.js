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
