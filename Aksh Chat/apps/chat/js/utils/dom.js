/**
 * Utility for safe DOM construction.
 * Avoids innerHTML with untrusted data.
 */

export function createElement(tag, className = "", attributes = {}) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    for (const [key, value] of Object.entries(attributes)) {
        if (key === 'textContent') {
            el.textContent = value;
        } else if (key === 'innerHTML') {
            el.innerHTML = value; // used cautiously internally
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(el.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            el.addEventListener(key.substring(2).toLowerCase(), value);
        } else if (value !== null && value !== undefined) {
            el.setAttribute(key, value);
        }
    }
    return el;
}

export function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe.toString()
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

export function safeSrc(url, fallback = "/chat-logo.png") {
    if (!url) return fallback;
    const trimmed = url.trim();
    if (trimmed.startsWith("javascript:") || trimmed.startsWith("vbscript:") || trimmed.startsWith("//")) {
        return fallback;
    }
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:image/") || trimmed.startsWith("/")) {
        return trimmed;
    }
    return fallback;
}
