import { initAuth } from "./auth.js";
import { initAppUI, updateAuthState } from "./ui/app.js";

document.addEventListener("DOMContentLoaded", () => {
    initAppUI();
    
    initAuth((user, profile) => {
        updateAuthState(user, profile);
    });
});
