import { state } from "../state.js";
import { initSidebar, updateChats } from "./sidebar.js";
import { initChatUI } from "./chat.js";
import { initModals } from "./modals.js";
import { listenToChats } from "../services/chats.js";

const appRoot = document.getElementById("app-root");
const authOverlay = document.getElementById("auth-overlay");
const mainLayout = document.getElementById("main-layout");
const btnSignin = document.getElementById("btn-signin");
const chatArea = document.getElementById("chat-area");

export function initAppUI() {
    btnSignin.addEventListener("click", () => {
        import("../auth.js").then(({ login }) => login().catch(console.error));
    });
    
    initSidebar();
    initChatUI();
    initModals();
}

export function updateAuthState(user, profile) {
    if (user) {
        appRoot.classList.remove("loading");
        authOverlay.classList.add("hidden");
        mainLayout.classList.remove("hidden");
        
        state.unsubscribers.chats = listenToChats((chats) => {
            updateChats(chats);
        });
        
    } else {
        appRoot.classList.remove("loading");
        authOverlay.classList.remove("hidden");
        mainLayout.classList.add("hidden");
        
        chatArea.classList.add("empty");
    }
}
