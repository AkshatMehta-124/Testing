import { createElement } from "../utils/dom.js";

let currentMenu = null;

export function showMessageMenu(e, msg, isMine, onAction) {
    if (currentMenu) closeMenu();
    
    const menu = createElement("div", "context-menu");
    menu.style.position = "fixed";
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    menu.style.zIndex = "10000";
    
    const actions = [
        { label: "Reply", action: "reply" },
        { label: "Forward", action: "forward" },
        { label: "Star", action: "star" },
        { label: "Pin", action: "pin" },
        { label: "Delete for Me", action: "delete_me" }
    ];
    
    if (isMine) {
        // Edit is only for text messages
        if (msg.text && !msg.deletedForEveryone) {
            actions.unshift({ label: "Edit", action: "edit" });
        }
        actions.push({ label: "Delete for Everyone", action: "delete_everyone" });
    }
    
    actions.forEach(act => {
        const item = createElement("div", "context-menu-item", { textContent: act.label });
        item.addEventListener("click", () => {
            onAction(act.action, msg);
            closeMenu();
        });
        menu.appendChild(item);
    });
    
    document.body.appendChild(menu);
    currentMenu = menu;
    
    // Close on outside click
    setTimeout(() => {
        document.addEventListener("click", outsideClickListener);
    }, 10);
}

function outsideClickListener(e) {
    if (currentMenu && !currentMenu.contains(e.target)) {
        closeMenu();
    }
}

export function closeMenu() {
    if (currentMenu) {
        document.body.removeChild(currentMenu);
        currentMenu = null;
        document.removeEventListener("click", outsideClickListener);
    }
}

export function showChatMenu(e, onAction) {
    if (currentMenu) closeMenu();
    
    const menu = createElement("div", "context-menu");
    menu.style.position = "fixed";
    
    // Position menu to the bottom-left of the click
    menu.style.right = `${window.innerWidth - e.clientX}px`;
    menu.style.top = `${e.clientY + 10}px`;
    menu.style.zIndex = "10000";
    
    const actions = [
        { label: "Clear Chat", action: "clear" },
        { label: "Export Chat", action: "export" },
        { label: "Group Info (coming soon)", action: "info" }
    ];
    
    actions.forEach(act => {
        const item = createElement("div", "context-menu-item", { textContent: act.label });
        item.addEventListener("click", () => {
            onAction(act.action);
            closeMenu();
        });
        menu.appendChild(item);
    });
    
    document.body.appendChild(menu);
    currentMenu = menu;
    
    setTimeout(() => {
        document.addEventListener("click", outsideClickListener);
    }, 10);
}
