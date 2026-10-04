/**
 * Central state store.
 */

export const state = {
    currentUser: null,
    currentProfile: null,
    
    // Room state
    activeChatId: null,
    activeChatData: null,
    
    // Selection state
    selectedMessageIds: new Set(),
    
    // Reply state
    replyMessageId: null,
    replyMessageData: null,
    
    // Hidden messages (delete for me)
    hiddenMessageIds: new Set(),
    
    // Blocked users
    blockedUserIds: new Set(),
    
    // Cached profiles
    profileCache: new Map(),
    
    // Listeners
    unsubscribers: {
        chats: null,
        messages: null,
        hiddenMessages: null,
        blockedUsers: null
    }
};

export function clearRoomState() {
    state.selectedMessageIds.clear();
    state.replyMessageId = null;
    state.replyMessageData = null;
    
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
}
