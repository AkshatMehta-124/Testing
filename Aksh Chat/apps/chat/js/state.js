/**
 * Central state store.
 */

export const state = {
    currentUser: null,
    currentProfile: null,
    
    // Room state
    activeChatId: null,
    activeChatData: null,
    
    // User chats
    chats: [],
    
    // Selection state
    selectedMessageIds: new Set(),
    
    // Reply and Edit state
    replyMessageId: null,
    replyMessageData: null,
    editMessageId: null,
    
    // Hidden messages (delete for me)
    hiddenMessageIds: new Set(),
    
    // Blocked users
    blockedUserIds: new Set(),
    
    // Chat Metadata (clearTimestamp, etc.)
    chatMeta: {},
    
    // Cached profiles
    profileCache: new Map(),
    
    // Listeners
    unsubscribers: {
        chats: null,
        messages: null,
        hiddenMessages: null,
        blockedUsers: null,
        chatMeta: null
    }
};

export function clearRoomState() {
    state.selectedMessageIds.clear();
    state.replyMessageId = null;
    state.replyMessageData = null;
    state.editMessageId = null;
    
    document.querySelectorAll(".context-menu").forEach(m => m.remove());
    
    if (state.unsubscribers.messages) {
        state.unsubscribers.messages();
        state.unsubscribers.messages = null;
    }
}

export function clearAllState() {
    clearRoomState();
    state.currentUser = null;
    state.currentProfile = null;
    state.activeChatId = null;
    state.activeChatData = null;
    state.hiddenMessageIds.clear();
    state.blockedUserIds.clear();
    state.profileCache.clear();
    
    for (const key in state.unsubscribers) {
        if (state.unsubscribers[key]) {
            state.unsubscribers[key]();
            state.unsubscribers[key] = null;
        }
    }
    
    import("./services/users.js").then(({ unsubscribeAllProfiles }) => {
        unsubscribeAllProfiles();
    }).catch(() => {});
}
