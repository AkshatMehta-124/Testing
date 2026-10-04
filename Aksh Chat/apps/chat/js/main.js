import { initAuth } from "./auth.js";
import { initUI, updateAuthState } from "./ui.js";

document.addEventListener("DOMContentLoaded", () => {
    initUI();
    
    initAuth((user, profile) => {
        updateAuthState(user, profile);
    });
});
