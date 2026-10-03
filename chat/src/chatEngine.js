import { db, collection, addDoc, onSnapshot, query, orderBy, where, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, Timestamp, writeBatch } from './firebase.js';
import { currentUser } from './auth.js';
import { encryptMessage, decryptMessage } from './siteCipher.js';
import { initChatOptions } from './advancedEngine.js';
import { injectGroupAdminModal, populateGroupManagement, userProfileCache, getCachedUserProfile } from './groupEngine.js';

const isSafeImageSource = (rawUrl) => {
    const value = String(rawUrl || '').trim();

    return (
        /^https?:\/\/[^\s"'<>\\]+$/i.test(value) ||
        /^data:image\/(?:jpeg|jpg|png|gif|webp);base64,[A-Za-z0-9+/=]+$/i.test(value)
    );
};

const setSafeAvatar = (container, rawUrl, fallbackIcon = 'person') => {
    if (!container) return;

    const value = String(rawUrl || '').trim();

    if (isSafeImageSource(value)) {
        const img = document.createElement('img');
        img.src = value;
        img.alt = '';
        img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;';

        container.style.background = 'transparent';
        container.replaceChildren(img);
        return true;
    }

    container.style.background = '#dfe5e7';

    const span = document.createElement('span');
    span.className = 'material-symbols-rounded';
    span.textContent = fallbackIcon;

    container.replaceChildren(span);
    return false;
};

let unsubscribeListener = null;
let roomStateListener = null;
let userBlockedListener = null;
let hiddenMessagesListener = null;
let pinExpiryTimer = null;
let myBlockedList = [];
let isInitialRoomLoad = false;

export let currentRoomId = null;
export let currentRoomData = null; 
export let currentRoomMeta = { name: '', icon: '', type: '' }; 
export let currentMessagesSnapshot = []; 
export const selectedMessageIds = new Set();
export const hiddenMessageIds = new Set();
window.hiddenMessageIds = hiddenMessageIds;
let replyContext = null; 
let messageToPin = null; 
let myLastReceiptUpdate = 0; 

export const getTimestampMillis = (ts) => {
    if (!ts) return 0;
    if (typeof ts === 'number') return ts;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.toDate === 'function') return ts.toDate().getTime();
    if (typeof ts.seconds === 'number') return ts.seconds * 1000;
    if (typeof ts === 'string') {
        const parsed = Date.parse(ts);
        if (!isNaN(parsed)) return parsed;
    }
    return 0;
};

window.getTimestampMillis = getTimestampMillis;

const parseWhatsAppFormatting = (text) => {
    if (!text) return "";
    let safeHtml = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    safeHtml = safeHtml.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    safeHtml = safeHtml.replace(/_(.*?)_/g, '<em>$1</em>');
    safeHtml = safeHtml.replace(/~(.*?)~/g, '<del>$1</del>');
    safeHtml = safeHtml.replace(/`(.*?)`/g, '<code style="background: rgba(0,0,0,0.06); padding: 2px 4px; border-radius: 4px; font-family: monospace;">$1</code>');
    safeHtml = safeHtml.replace(/^&gt;\s(.*)$/gm, '<blockquote style="border-left: 3px solid #00a884; padding-left: 8px; margin: 4px 0; color: var(--text-muted);">$1</blockquote>');
    return safeHtml;
};

let lastReadReceiptError = 0;

export const updateReadReceipt = async (roomId, uid) => {
    if (!roomId || !uid) return;
    if (roomId === 'global_channel' || roomId === 'aksh_help') return; // Avoid system rooms
    try {
        await updateDoc(doc(db, "chats", roomId), {
            [`readReceipts.${uid}`]: Date.now()
        });
    } catch (error) {
        const now = Date.now();
        if (now - lastReadReceiptError > 10000) { // Throttle to 1 log per 10 seconds
            console.error("Background read receipt update failed:", error);
            lastReadReceiptError = now;
        }
    }
};

export const leaveChatRoom = () => {
    currentRoomId = null;
    currentRoomData = null;
    window.currentRoomData = null;
    if (window.appState) {
        window.appState.activeChatId = null;
    }
    currentMessagesSnapshot = [];
    selectedMessageIds.clear();
    hiddenMessageIds.clear();
    messageToPin = null;
    replyContext = null;

    if (unsubscribeListener) { unsubscribeListener(); unsubscribeListener = null; }
    if (roomStateListener) { roomStateListener(); roomStateListener = null; }
    if (userBlockedListener) { userBlockedListener(); userBlockedListener = null; }
    if (hiddenMessagesListener) { hiddenMessagesListener(); hiddenMessagesListener = null; }
    if (pinExpiryTimer) { clearTimeout(pinExpiryTimer); pinExpiryTimer = null; }
    
    if (window.enableSelectionMode) window.enableSelectionMode(false);

    if (window.cancelReply) window.cancelReply();
    if (window.enableSelectionMode) window.enableSelectionMode(false);

    const banner = document.getElementById('pinned-message-banner');
    if (banner) banner.style.display = 'none';
    const pinModal = document.getElementById('pin-modal');
    if (pinModal) pinModal.style.display = 'none';
    const groupModal = document.getElementById('group-admin-modal');
    if (groupModal) groupModal.style.display = 'none';
    const optMenu = document.getElementById('chat-options-menu');
    if (optMenu) optMenu.style.display = 'none';
    const delModal = document.getElementById('delete-modal');
    if (delModal) delModal.style.display = 'none';

    const container = document.getElementById('chat-messages-container');
    if (container) container.innerHTML = '';
};
window.leaveChatRoom = leaveChatRoom;

export const loadHiddenMessages = (roomId) => {
    const curId = currentUser?.id || currentUser?.uid;
    if (!curId || !roomId) return;
    if (hiddenMessagesListener) { hiddenMessagesListener(); hiddenMessagesListener = null; }
    try {
        const q = query(collection(db, `users/${curId}/hiddenMessages`), where("roomId", "==", roomId));
        hiddenMessagesListener = onSnapshot(q, (snapshot) => {
            const newSet = new Set();
            snapshot.forEach(doc => newSet.add(doc.data().messageId));
            if (currentRoomId === roomId) {
                hiddenMessageIds.clear();
                newSet.forEach(id => hiddenMessageIds.add(id));
                if (currentMessagesSnapshot.length > 0) renderMessagesUI();
            }
        });
    } catch (e) {
        console.error("Failed to load hidden messages", e);
    }
};

export const switchChatRoom = (roomId, passedName, passedIcon, passedType, passedParticipantCount) => {
    if (currentRoomId === roomId) return;
    
    // Clear previous room state & UI completely (Bug 6, 14, 15, 34)
    leaveChatRoom();

    currentRoomId = roomId;
    if (window.appState) window.appState.activeChatId = roomId;
    isInitialRoomLoad = true;
    currentRoomMeta = { name: passedName, icon: passedIcon, type: passedType };
    
    const titleEl = document.getElementById('active-room-name');
    const iconBox = document.getElementById('active-room-icon-box');
    const optBtn = document.getElementById('btn-chat-options');
    if (optBtn) optBtn.style.display = 'block';
    
    if (titleEl && passedName) titleEl.innerText = passedName;
   if (iconBox) {
    setSafeAvatar(
        iconBox,
        passedIcon,
        passedType === 'group' ? 'groups' : 'person'
    );
}
    const statusEl = document.getElementById('active-room-status');
    if (statusEl) {
        if (passedType === 'dm') {
            statusEl.innerText = 'Direct Message';
        } else if (passedType === 'group') {
            if (roomId === 'global_channel') {
                statusEl.innerText = 'Global Channel';
            } else if (roomId === 'aksh_help') {
                statusEl.innerText = 'Help Centre';
            } else if (typeof passedParticipantCount === 'number') {
                statusEl.innerText = `Group: ${passedParticipantCount} participants`;
            } else {
                statusEl.innerText = 'Group';
            }
        }
    }

    listenToUserState();
    listenToRoomState(roomId); 
    listenToMessages(roomId);
    loadHiddenMessages(roomId);
    
    try {
        const curId = currentUser?.id || currentUser?.uid;
        if (curId) updateReadReceipt(roomId, curId);
    } catch(e) { console.error(e); alert("Action failed: " + (e.message || "Unknown error")); }
};

export const updateBlockedStateUI = async () => {
    if (!currentRoomId || !currentRoomData) return;
    const capturedRoomId = currentRoomId;
    window.isTargetOwner = false; // Reset on every switch
    const curId = currentUser?.id || currentUser?.uid;
    const isGroup = currentRoomData.type === 'group';
    const isSystemGroup = capturedRoomId === 'global_channel' || capturedRoomId === 'aksh_help';

    let isBlocked = false;
    let theyBlockedMe = false;

    if (!isGroup && !isSystemGroup && curId) {
        const safeParticipants = Array.isArray(currentRoomData.participants) ? currentRoomData.participants : [];
        let targetUid = safeParticipants.find(id => id !== curId);
        if (!targetUid && capturedRoomId.startsWith('dm_')) {
            targetUid = capturedRoomId.replace('dm_', '').split('_').find(id => id !== curId);
        }
        if (targetUid) {
            if (myBlockedList.includes(targetUid)) isBlocked = true;
            try {
                const targetDoc = await getDoc(doc(db, "users", targetUid));
                if (currentRoomId !== capturedRoomId) return;
                if (targetDoc.exists()) {
                    const targetData = targetDoc.data();
                    if (targetData.blockedUsers?.includes(curId)) {
                        theyBlockedMe = true;
                        isBlocked = true;
                    }
                    if (String(targetData.email || '').toLowerCase().trim() === 'akshat124.am12@gmail.com') {
                        window.isTargetOwner = true;
                    }

                    const safeEmail = String(targetData.email || '').toLowerCase().trim();
                    const displayName = (targetData.nickname || targetData.fullName || targetData.name || targetData.firstName || (safeEmail ? safeEmail.split('@')[0] : 'User')).trim();
                    const pic = targetData.customProfilePic || targetData.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=00a884&color=fff`;
                    userProfileCache.set(targetUid, { ...targetData, displayName, pic, _cachedAt: Date.now() });

                    const activeTitle = document.getElementById('active-room-name');
                    if (activeTitle && currentRoomId === capturedRoomId) {
                        activeTitle.innerText = displayName;
                    }
                  const iconBox = document.getElementById('active-room-icon-box');
if (iconBox && currentRoomId === capturedRoomId) {
    setSafeAvatar(iconBox, pic, 'person');
}
                }
            } catch(e) { console.error(e); alert("Action failed: " + (e.message || "Unknown error")); }
        }
    }

    if (currentRoomId !== capturedRoomId) return;

    const inputWrapper = document.getElementById('chat-input-wrapper');
    const blockedWrapper = document.getElementById('blocked-state-wrapper');
    if (isBlocked) {
        if (inputWrapper) inputWrapper.style.display = 'none';
        if (blockedWrapper) {
            blockedWrapper.style.display = 'block';
            blockedWrapper.innerText = theyBlockedMe ? "You have been blocked by this contact." : "You have blocked this contact. Unblock them in settings to send a message.";
        }
    } else {
        if (inputWrapper) inputWrapper.style.display = 'flex';
        if (blockedWrapper) blockedWrapper.style.display = 'none';
    }
};

export const listenToUserState = () => {
    if (userBlockedListener) {
        userBlockedListener();
        userBlockedListener = null;
    }
    const curId = currentUser?.id || currentUser?.uid;
    if (!curId) return;

    userBlockedListener = onSnapshot(doc(db, "users", curId), (userDoc) => {
        if (userDoc.exists()) {
            myBlockedList = userDoc.data()?.blockedUsers || [];
            if (currentRoomId && currentRoomData) {
                updateBlockedStateUI();
            }
        }
    }, (error) => { console.error("userBlockedListener query error:", error); });
};

const renderMessagesUI = () => {
    if (!currentRoomId || !currentMessagesSnapshot) return;
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    let messagesHTML = `
        <div class="chat-disclaimer-wrapper">
            <div class="chat-disclaimer">
                <span class="material-symbols-rounded lock-icon" style="font-size: 13px; vertical-align: middle;">lock</span> 
                <strong>Secured Chat</strong><br>
                <span style="font-size: 11px;">Messages are obfuscated on the client side. <br>Note: Messages are stored for 60 days only. <br>For support: <a href="mailto:akshstudioofficial@gmail.com" style="color:var(--primary);">akshstudioofficial@gmail.com</a></span>
            </div>
        </div>`;    
    let previousSenderId = null; 
    
    const curId = currentUser?.id || currentUser?.uid;
    const isCurrentOwner = currentUser?.isOwner || String(currentUser?.email || '').toLowerCase().trim() === 'akshat124.am12@gmail.com';
    const readReceipts = currentRoomData?.readReceipts || {};
    
    const safeParticipants = Array.isArray(currentRoomData?.participants) ? currentRoomData.participants : [];
    let participantList = [...safeParticipants];
    
    if (currentRoomId.startsWith('dm_') && participantList.length === 0) {
        participantList = currentRoomId.replace('dm_', '').split('_');
    }
    const otherParticipants = participantList.filter(id => id !== curId);

    const clearTimestamp = currentRoomData ? (currentRoomData[`clearedAt_${curId}`] || 0) : 0;
    const clearMs = getTimestampMillis(clearTimestamp);
    const sixtyDaysAgo = Date.now() - (60 * 24 * 60 * 60 * 1000);
    const cutoff = Math.max(clearMs, sixtyDaysAgo);
    const isSystemGroup = currentRoomId === 'global_channel' || currentRoomId === 'aksh_help';

    // Prune IDs that no longer exist in the current valid message set (Bug 15)
    const validMessageIds = new Set();
    currentMessagesSnapshot.forEach((documentObj) => {
        const msgId = documentObj.id;
        const msg = documentObj.data();
        const msgTime = getTimestampMillis(msg.localTimestamp || msg.timestamp) || Date.now();
        if (msgTime > cutoff && !hiddenMessageIds.has(msgId)) {
            validMessageIds.add(msgId);
        }
    });

    let selectionPruned = false;
    for (const selId of Array.from(selectedMessageIds)) {
        if (!validMessageIds.has(selId)) {
            selectedMessageIds.delete(selId);
            selectionPruned = true;
        }
    }
    if (selectionPruned) {
        updateSelectionCount();
    }

    currentMessagesSnapshot.forEach((documentObj) => {
        const msgId = documentObj.id;
        const msg = documentObj.data();
        const msgTime = getTimestampMillis(msg.localTimestamp || msg.timestamp) || Date.now();
        
        if (msgTime <= cutoff || hiddenMessageIds.has(msgId)) return;

        const isMe = msg.senderId === curId; 
        const isFirstInGroup = previousSenderId !== msg.senderId;
        const isSystemAdminMsg = msg.isOwner === true && isSystemGroup;

        const decryptedText = msg.text ? decryptMessage(msg.text) : "";
        const formattedTextContent = parseWhatsAppFormatting(decryptedText);

        const msgMillis = getTimestampMillis(msg.timestamp || msg.localTimestamp);
        let timeString = "Sent";
        if (msgMillis > 0) {
            timeString = new Date(msgMillis).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        let tickHTML = "";

        if (isMe) {
            let allRead = false;
            if (otherParticipants.length > 0) {
                allRead = otherParticipants.every(pid => {
                    const recObj = readReceipts[pid];
                    let rTime = 0;
                    if (recObj) {
                        rTime = getTimestampMillis(recObj);
                    }
                    return rTime > 0 && rTime >= (msgTime - 30000);
                });
            }
            const tickColor = allRead ? "#53bdeb" : "#8696a0"; 
            tickHTML = `<span class="material-symbols-rounded tick-icon tick-read" style="color: ${tickColor}; font-size: 16px; margin-left: 2px;">done_all</span>`;
        }

        let roleBadge = '';
        if (msg.isOwner === true) {
            roleBadge = ' <span style="color:var(--primary); font-size:11px; font-weight:700;">(Owner)</span>';
        } else if (Array.isArray(currentRoomData?.admins) && currentRoomData.admins.includes(msg.senderId)) {
            roleBadge = ' <span style="color:var(--text-muted); font-size:11px; font-weight:700;">(Admin)</span>';
        }

        const showName = isSystemAdminMsg || (!isMe && isFirstInGroup);
        const nameAlign = isSystemAdminMsg ? 'text-align: center; width: 100%;' : '';
        const safeMsgId = String(msgId).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        const safeSenderId = String(msg.senderId || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        const safeSenderName = String(msg.senderName || 'Network User').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        const senderNameHTML = showName ? `<div class="msg-sender-name" style="${nameAlign}">${safeSenderName}${roleBadge}</div>` : '';
        const decryptedReplyText = msg.replyToText ? decryptMessage(msg.replyToText) : "";
        const replyToId = msg.replyToId || '';
        const safeReplyToId = String(replyToId).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        const replyClickAttr = replyToId ? `data-replyid="${safeReplyToId}"` : '';
        const safeReplyToName = String(msg.replyToName || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        const replyHTML = msg.replyToText ? `<div class="quoted-reply" ${replyClickAttr}><div class="quoted-name">${safeReplyToName}</div><div class="quoted-text">${parseWhatsAppFormatting(decryptedReplyText)}</div></div>` : '';

        // Pin Message Privileges
        let canPin = false;
        if (isSystemGroup) {
            canPin = isCurrentOwner;
        } else {
            const isAdmin = Array.isArray(currentRoomData?.admins) && currentRoomData.admins.includes(curId);
            canPin = isCurrentOwner || isAdmin;
        }
        
        const pinBtnHTML = canPin ? `<button class="msg-action-btn" data-action="pin" data-msgid="${safeMsgId}">Pin Message</button>` : '';

        const actionMenuHTML = `
            <div class="msg-action-trigger" data-msgid="${safeMsgId}">
                <span class="material-symbols-rounded" style="font-size: 20px;">keyboard_arrow_down</span>
            </div>
            <div class="msg-action-menu" id="menu-${safeMsgId}">
                <button class="msg-action-btn" data-action="reply" data-msgid="${safeMsgId}">Reply</button>
                <button class="msg-action-btn" data-action="forward" data-msgid="${safeMsgId}">Forward</button>
                <button class="msg-action-btn" data-action="delete" data-msgid="${safeMsgId}">Delete</button>
                ${pinBtnHTML}
            </div>
        `;

        const isChecked = selectedMessageIds.has(msgId);
        const checkboxHTML = `<div class="msg-checkbox-wrapper"><input type="checkbox" class="msg-checkbox" value="${safeMsgId}" data-sender="${safeSenderId}" ${isChecked ? 'checked' : ''}></div>`;
        const alignmentClass = isSystemAdminMsg ? 'admin' : (isMe ? 'me' : 'other');
        const bubbleClass = isSystemAdminMsg ? 'msg-admin' : (isMe ? 'msg-me' : 'msg-other');
        
        let mediaAttachmentHTML = '';
        if (msg.fileUrl) {
            const rawFileUrl = decryptMessage(msg.fileUrl);
            const rawFileName = msg.fileName ? decryptMessage(msg.fileName) : 'attachment';
            const safeFileName = String(rawFileName).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
         let safeFileUrl = '#';
const trimmedFileUrl = String(rawFileUrl || '').trim();
const fileType = String(msg.fileType || '').toLowerCase();

if (/^https?:\/\/\S+$/i.test(trimmedFileUrl)) {
    safeFileUrl = trimmedFileUrl
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
} else {
    const dataMatch = trimmedFileUrl.match(/^data:([^;,]+)[;,]/i);
    const dataMime = dataMatch ? dataMatch[1].toLowerCase() : '';

    const allowedDataUrl =
        (fileType.startsWith('image/') && dataMime.startsWith('image/')) ||
        (fileType === 'application/pdf' && dataMime === 'application/pdf') ||
        (fileType.startsWith('text/') && dataMime.startsWith('text/'));

    if (allowedDataUrl) {
        safeFileUrl = trimmedFileUrl
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
}

            if (msg.fileType && msg.fileType.startsWith('image')) {
                mediaAttachmentHTML = `
                    <div style="position:relative; margin-bottom: 5px;">
                        <img src="${safeFileUrl}" style="width: 100%; max-height: 250px; border-radius: 8px; object-fit: cover; display: block;">
                        <a href="${safeFileUrl}" download="${safeFileName}" target="_blank" style="position:absolute; bottom:10px; right:10px; background:rgba(0,0,0,0.6); color:white; padding:6px; border-radius:50%; display:flex; align-items:center; justify-content:center; text-decoration:none;">
                            <span class="material-symbols-rounded" style="font-size:16px;">download</span>
                        </a>
                    </div>`;
            } else {
                mediaAttachmentHTML = `
                    <div style="display: flex; align-items: center; gap: 10px; background: rgba(0,0,0,0.05); padding: 10px; border-radius: 8px; margin-bottom: 5px;">
                        <span class="material-symbols-rounded" style="font-size: 32px; color: var(--primary);">description</span>
                        <div style="flex: 1; overflow: hidden;">
                            <p style="font-size: 13px; font-weight: 600; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${safeFileName}</p>
                        </div>
                        <a href="${safeFileUrl}" download="${safeFileName}" target="_blank" style="color: var(--primary); text-decoration: none; display: flex; align-items: center; justify-content: center; background: rgba(0, 168, 132, 0.1); width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;">
                            <span class="material-symbols-rounded" style="font-size:16px;">download</span>
                        </a>
                    </div>`;
            }
        }

        messagesHTML += `
            <div class="msg-container ${isFirstInGroup ? 'first-in-group' : ''} ${alignmentClass}" id="container-${safeMsgId}">
                ${checkboxHTML}
                <div class="msg-bubble ${bubbleClass} ${isFirstInGroup ? '' : 'grouped'}">
                    ${actionMenuHTML} ${senderNameHTML} ${replyHTML}
                    ${mediaAttachmentHTML}
                    <span id="text-${safeMsgId}">${formattedTextContent}</span>
                    <div class="msg-meta"><span>${timeString}</span>${tickHTML}</div>
                </div>
            </div>
        `;
        previousSenderId = msg.senderId;
    });

    const isNearBottom = (container.scrollHeight - container.scrollTop - container.clientHeight) < 120;
    container.innerHTML = messagesHTML;

    // Attach delegated event listeners
    container.querySelectorAll('.msg-action-trigger').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            window.toggleActionMenu(el.dataset.msgid);
        });
    });
    container.querySelectorAll('.quoted-reply').forEach(el => {
        if (el.dataset.replyid) {
            el.addEventListener('click', () => window.scrollToMessage(el.dataset.replyid));
            el.style.cursor = 'pointer';
        }
    });
    container.querySelectorAll('.msg-action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.currentTarget.dataset.action;
            const msgId = e.currentTarget.dataset.msgid;
            if (action === 'reply') window.replyToMessage(msgId);
            else if (action === 'forward') window.startForwardSingleMessage(msgId);
            else if (action === 'delete') window.startDeleteSingleMessage(msgId);
            else if (action === 'pin') window.triggerPinModal(msgId);
        });
    });

    if (isInitialRoomLoad || isNearBottom || window.forceScrollToBottom) {
        container.scrollTop = container.scrollHeight;
        isInitialRoomLoad = false;
        window.forceScrollToBottom = false;
    }
};

const listenToRoomState = async (roomId) => {
    if (roomStateListener) roomStateListener();

    roomStateListener = onSnapshot(doc(db, "chats", roomId), async (documentObj) => {
        if (currentRoomId !== roomId) return;

        if (!documentObj.exists()) {
            alert("This chat has been deleted.");
            window.location.reload();
            return;
        }

        currentRoomData = documentObj.data(); 
        window.currentRoomData = currentRoomData;
        window.isTargetOwner = false; 

        if (roomId.startsWith('dm_') && (!Array.isArray(currentRoomData.participants) || currentRoomData.participants.length === 0)) {
            currentRoomData.participants = roomId.replace('dm_', '').split('_');
        }

        const isGroup = currentRoomData.type === 'group';
        const isSystemGroup = roomId === 'global_channel' || roomId === 'aksh_help';
        const isCurrentOwner = currentUser?.isOwner || String(currentUser?.email || '').toLowerCase().trim() === 'akshat124.am12@gmail.com';
        const curId = currentUser?.id || currentUser?.uid;

        if (isGroup && !isSystemGroup) {
            if (Array.isArray(currentRoomData.participants) && !currentRoomData.participants.includes(curId) && !isCurrentOwner) {
                alert("You have been removed from this group.");
                if (window.appState) window.appState.activeChatId = null;
                document.getElementById('main-layout')?.classList.remove('mobile-chat-active');
                leaveChatRoom();
                return;
            }
        }

        await updateBlockedStateUI();
        if (currentRoomId !== roomId) return;

        initChatOptions(currentUser, roomId, currentRoomData);
        
        if (pinExpiryTimer) {
            clearTimeout(pinExpiryTimer);
            pinExpiryTimer = null;
        }
        const banner = document.getElementById('pinned-message-banner');
        let pinExpiryMs = currentRoomData.pinExpiry || 0;
        if (typeof pinExpiryMs?.toMillis === 'function') pinExpiryMs = pinExpiryMs.toMillis();
        else if (typeof pinExpiryMs?.seconds === 'number') pinExpiryMs = pinExpiryMs.seconds * 1000;

        if (banner && currentRoomData.pinnedMessage && Date.now() < pinExpiryMs) {
            const decPin = decryptMessage(currentRoomData.pinnedMessage);
            const pinTextEl = document.getElementById('pinned-message-text');
            if (pinTextEl) pinTextEl.innerHTML = parseWhatsAppFormatting(decPin);
            banner.style.display = 'flex';
            banner.style.cursor = 'pointer';
            banner.onclick = () => {
                if (currentRoomData.pinnedMessageId) {
                    window.scrollToMessage(currentRoomData.pinnedMessageId);
                }
            };
            const unpinBtn = document.getElementById('btn-unpin');
            if (unpinBtn) {
                const isAdminUser = Array.isArray(currentRoomData.admins) && currentRoomData.admins.includes(curId);
                const canUnpin = isSystemGroup ? isCurrentOwner : (isGroup ? (isCurrentOwner || isAdminUser) : isCurrentOwner);
                unpinBtn.style.display = canUnpin ? 'inline-flex' : 'none';
            }
            const remainingTime = pinExpiryMs - Date.now();
            if (remainingTime > 0) {
                pinExpiryTimer = setTimeout(() => {
                    if (banner) banner.style.display = 'none';
                }, remainingTime);
            }
        } else if (banner) {
            banner.style.display = 'none';
        }

        const isAdmin = Array.isArray(currentRoomData.admins) && currentRoomData.admins.includes(curId);
        const canEditSystem = isSystemGroup ? isCurrentOwner : false; 
        const canEditCustom = isCurrentOwner || isAdmin;
        const canEdit = isSystemGroup ? canEditSystem : canEditCustom;
        
        const existingGear = document.getElementById('group-settings-btn');
        if (existingGear) {
            if ((isGroup || isSystemGroup) && canEdit) {
                existingGear.style.display = 'inline-flex';
                existingGear.onclick = (e) => {
                    e.stopPropagation();
                    injectGroupAdminModal(); 
                    
                    const groupEditSec = document.getElementById('group-edit-section');
                    const transferSec = document.getElementById('transfer-admin-section');
                    const btnSaveGroup = document.getElementById('btn-save-group');
                    const btnDeleteGroup = document.getElementById('btn-delete-group');
                    const addMemberSec = document.getElementById('add-member-section');
                    const manageMemberSec = document.getElementById('manage-members-section');

                    if (groupEditSec) groupEditSec.style.display = canEdit ? 'block' : 'none';
                    if (transferSec) transferSec.style.display = (canEdit && !isSystemGroup) ? 'block' : 'none';
                    if (btnSaveGroup) btnSaveGroup.style.display = canEdit ? 'block' : 'none';
                    if (btnDeleteGroup) btnDeleteGroup.style.display = (canEdit && !isSystemGroup) ? 'block' : 'none';
                    if (addMemberSec) addMemberSec.style.display = isSystemGroup ? 'none' : 'block';
                    if (manageMemberSec) manageMemberSec.style.display = isSystemGroup ? 'none' : 'block';

                    if (canEdit) {
                        document.getElementById('edit-group-name').value = currentRoomData.name || '';
                        document.getElementById('edit-group-icon').value = currentRoomData.icon?.startsWith('http') ? currentRoomData.icon : '';
                        document.getElementById('group-icon-preview').src = currentRoomData.icon?.startsWith('data:image') || currentRoomData.icon?.startsWith('http') ? currentRoomData.icon : 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
                    }
                    
                    populateGroupManagement(currentRoomData.participants || [], currentRoomData.admins || []);
                    const groupModal = document.getElementById('group-admin-modal');
                    if(groupModal) groupModal.style.display = 'flex';
                };
            } else {
                existingGear.style.display = 'none';
            }
        }

        const titleEl = document.getElementById('active-room-name');
        const iconBox = document.getElementById('active-room-icon-box');
        if (titleEl) {
            let displayRoomName = currentRoomData.name || 'Chat';
            if (currentRoomData.type === 'dm') {
                const otherId = currentRoomData.participants?.find(id => id !== curId);
                if (otherId) {
                    let cachedProfile = userProfileCache.get(otherId);
                    if (cachedProfile) {
                        if (!cachedProfile._cachedAt) {
                            cachedProfile._cachedAt = Date.now();
                            userProfileCache.set(otherId, cachedProfile);
                        }
                        if (cachedProfile.displayName) {
                            displayRoomName = cachedProfile.displayName;
                        }
                    } else if (currentRoomData.names?.[otherId]) {
                        displayRoomName = currentRoomData.names[otherId];
                        cachedProfile = {
                            displayName: displayRoomName,
                            pic: currentRoomData.avatars?.[otherId] || '',
                            _cachedAt: Date.now()
                        };
                        userProfileCache.set(otherId, cachedProfile);
                    }

                    if (iconBox) {
                        const dmPic = cachedProfile?.pic || cachedProfile?.customProfilePic || cachedProfile?.photoURL || currentRoomData.avatars?.[otherId];
                      if (dmPic) {
    setSafeAvatar(iconBox, dmPic, 'person');
}
                    }

                    const isStale = !cachedProfile || !cachedProfile._cachedAt || (Date.now() - cachedProfile._cachedAt > 60000);
                    if (isStale) {
                        getCachedUserProfile(otherId).then(p => {
                            if (p && p.displayName && currentRoomId === roomId) {
                                titleEl.innerText = p.displayName;
                              if (iconBox && (p.pic || p.customProfilePic || p.photoURL)) {
    const newPic = p.pic || p.customProfilePic || p.photoURL;
    setSafeAvatar(iconBox, newPic, 'person');
}
                            }
                        }).catch(e => console.error(e));
                    }
                }
            }
            if(displayRoomName !== 'Chat') titleEl.innerText = displayRoomName;
        }

        const statusEl = document.getElementById('active-room-status');
        if (statusEl) {
            if (currentRoomData.type === 'dm') {
                statusEl.innerText = 'Direct Message';
            } else if (currentRoomData.type === 'group') {
                if (roomId === 'global_channel') {
                    statusEl.innerText = 'Global Channel';
                } else if (roomId === 'aksh_help') {
                    statusEl.innerText = 'Help Centre';
                } else {
                    const count = Array.isArray(currentRoomData.participants) ? currentRoomData.participants.length : 0;
                    statusEl.innerText = `Group: ${count} participants`;
                }
            }
        }
        
        if (currentMessagesSnapshot.length > 0) renderMessagesUI();
    }, (error) => { 
        console.error("listenToRoomState query error for room", roomId, ":", error);
        if (error.code === 'permission-denied' && window.appState && window.appState.activeChatId === roomId) {
            window.appState.activeChatId = null;
            document.getElementById('main-layout')?.classList.remove('mobile-chat-active');
            if (window.leaveChatRoom) window.leaveChatRoom();
        }
    });
};

export const listenToMessages = (roomId) => {
    if (unsubscribeListener) {
        unsubscribeListener();
        unsubscribeListener = null;
    }
    const sixtyDaysAgo = Date.now() - (60 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgoTs = Timestamp.fromMillis(sixtyDaysAgo);
    const isSystemGroup = roomId === 'global_channel' || roomId === 'aksh_help';

    const qNum = query(
        collection(db, `chats/${roomId}/messages`), 
        where("timestamp", ">", sixtyDaysAgo),
        orderBy("timestamp", "asc")
    );

    const qTs = query(
        collection(db, `chats/${roomId}/messages`), 
        where("timestamp", ">", sixtyDaysAgoTs),
        orderBy("timestamp", "asc")
    );

    let numDocs = [];
    let tsDocs = [];

    const mergeAndRender = () => {
        if (currentRoomId !== roomId) return;

        const docMap = new Map();
        numDocs.forEach(d => docMap.set(d.id, d));
        tsDocs.forEach(d => docMap.set(d.id, d));

        const now = Date.now();
        const cutoff = now - (60 * 24 * 60 * 60 * 1000);

        const validDocs = Array.from(docMap.values()).filter(docObj => {
            const data = docObj.data();
            const t = getTimestampMillis(data.timestamp || data.localTimestamp);
            return t > 0 && t >= cutoff;
        });

        validDocs.sort((a, b) => {
            const tA = getTimestampMillis(a.data().timestamp || a.data().localTimestamp) || 0;
            const tB = getTimestampMillis(b.data().timestamp || b.data().localTimestamp) || 0;
            return tA - tB;
        });

        currentMessagesSnapshot = validDocs;

        const curId = currentUser?.id || currentUser?.uid;
        if (!isSystemGroup && validDocs.length > 0 && curId) {
            const lastMsg = validDocs[validDocs.length - 1].data();
            if (lastMsg.senderId !== curId && document.visibilityState === 'visible') {
                if (Date.now() - myLastReceiptUpdate > 2000) {
                    myLastReceiptUpdate = Date.now();
                    updateReadReceipt(roomId, curId);
                }
            }
        }

        renderMessagesUI();
    };

    const unsubNum = onSnapshot(qNum, (snapshot) => {
        if (currentRoomId !== roomId) return;
        numDocs = snapshot.docs;
        mergeAndRender();
    }, (error) => { 
        console.error("listenToMessages (numeric timestamp) query error:", error); 
    });

    const unsubTs = onSnapshot(qTs, (snapshot) => {
        if (currentRoomId !== roomId) return;
        tsDocs = snapshot.docs;
        mergeAndRender();
    }, (error) => { 
        console.error("listenToMessages (Firestore Timestamp) query error:", error); 
    });

    unsubscribeListener = () => {
        unsubNum();
        unsubTs();
    };
};

export const sendMessage = async () => {
    if (currentUser?.isGuest) return;
    const inputField = document.getElementById('chat-input');
    const text = inputField.value.trim();
    if (!text || !currentRoomId) return; 

    const targetRoomId = currentRoomId;
    const targetRoomData = currentRoomData;
    const isCurrentOwner = currentUser?.isOwner || String(currentUser?.email || '').toLowerCase().trim() === 'akshat124.am12@gmail.com';
    const curId = currentUser?.id || currentUser?.uid;
    const clearTimestamp = targetRoomData ? (targetRoomData[`clearedAt_${curId}`] || 0) : 0;
    const clearMs = getTimestampMillis(clearTimestamp);
    
    // Require the owner to have a visible message in history before replying
    if (window.isTargetOwner && !isCurrentOwner) {
        const ownerHasMessaged = currentMessagesSnapshot.some(docObj => {
            const msg = docObj.data();
            const msgTime = getTimestampMillis(msg.localTimestamp || msg.timestamp) || Date.now();
            if (msgTime <= clearMs) return false;
            return msg.isOwner === true || String(msg.senderName).includes('Owner');
        });
        
        if (!ownerHasMessaged) {
            alert("You cannot message the Owner until they initiate a conversation with you.");
            return;
        }
    }

    const scrambledText = encryptMessage(text);
    const payload = { 
        text: scrambledText, 
        senderId: curId, 
        senderName: currentUser?.name || 'User', 
        isOwner: isCurrentOwner, 
        timestamp: Date.now(),
        localTimestamp: Date.now(),
        expireAt: Timestamp.fromMillis(Date.now() + 60 * 24 * 60 * 60 * 1000)    
    };

    if (replyContext) {
        payload.replyToText = encryptMessage(replyContext.text);
        payload.replyToName = replyContext.senderName;
        payload.replyToId = replyContext.msgId;
    }
    
    try { 
        await addDoc(collection(db, `chats/${targetRoomId}/messages`), payload); 
        // addDoc succeeded: only clear composer and update UI if still in this room (Bug 28)
        if (currentRoomId === targetRoomId) {
            inputField.value = '';
            if (replyContext) {
                window.cancelReply(); 
            }
            window.forceScrollToBottom = true;
        }
    } catch (error) {
        console.error("sendMessage error:", error);
        // On failure, inputField.value was preserved and never cleared (Bug 10)
        if (currentRoomId === targetRoomId) {
            alert("Failed to send message: " + (error?.message || "Please check your connection and try again."));
        }
        return; // Don't proceed to update metadata if addDoc failed
    }

    try {
        myLastReceiptUpdate = Date.now();
        const targetUpdate = {};
        if (targetRoomData?.type === 'dm') {
            const otherParticipant = targetRoomData.participants?.find(id => id !== curId);
            if (otherParticipant) {
                targetUpdate[`deletedFor_${otherParticipant}`] = false;
            }
        }
        
        const isSystemGroup = targetRoomId === 'global_channel' || targetRoomId === 'aksh_help';
        const metadataUpdate = { 
            lastMessageTime: Date.now(), 
            lastMessageSenderId: curId,
            ...targetUpdate
        };
        if (!isSystemGroup) {
            metadataUpdate[`readReceipts.${curId}`] = Date.now();
        }

        await updateDoc(doc(db, "chats", targetRoomId), metadataUpdate);
    } catch (error) {
        console.error("Secondary metadata update failed silently:", error);
    }
};

// --- DIRECT SELECTION & MESSAGE ACTIONS (Bypass Header) ---
window.startForwardSingleMessage = (msgId) => {
    selectedMessageIds.clear();
    selectedMessageIds.add(msgId);
    window.toggleActionMenu(msgId);
    window.forwardSelectedMessages();
};

window.startDeleteSingleMessage = (msgId) => {
    selectedMessageIds.clear();
    selectedMessageIds.add(msgId);
    window.toggleActionMenu(msgId);
    window.openDeleteMessagesModal();
};

const updateSelectionCount = () => {
    const countTxt = document.getElementById('selection-count');
    if (countTxt) countTxt.innerText = `${selectedMessageIds.size} Selected`;
};

window.enableSelectionMode = (enable = true) => {
    const container = document.getElementById('chat-messages-container');
    const selectionHeader = document.getElementById('selection-chat-header');
    const stdHeader = document.getElementById('standard-chat-header');
    
    if (enable) {
        if (container) container.classList.add('selection-mode');
        if (stdHeader) stdHeader.style.display = 'none';
        if (selectionHeader) selectionHeader.style.display = 'flex';
        document.querySelectorAll('.msg-action-menu').forEach(m => m.classList.remove('active'));
    } else {
        selectedMessageIds.clear();
        if (container) container.classList.remove('selection-mode');
        if (stdHeader) stdHeader.style.display = 'flex';
        if (selectionHeader) selectionHeader.style.display = 'none';
        document.querySelectorAll('.msg-checkbox').forEach(box => box.checked = false);
        updateSelectionCount();
    }
};

window.openDeleteMessagesModal = () => {
    if (selectedMessageIds.size === 0) return alert("Select at least one message to delete.");

    const curId = currentUser?.id || currentUser?.uid;
    const isCurrentOwner = currentUser?.isOwner || String(currentUser?.email || '').toLowerCase().trim() === 'akshat124.am12@gmail.com';
    const isAdmin = Array.isArray(currentRoomData?.admins) && currentRoomData.admins.includes(curId);

    const allMine = Array.from(selectedMessageIds).every(id => {
        const box = document.querySelector(`.msg-checkbox[value="${id}"]`);
        return box && box.getAttribute('data-sender') === curId;
    });
    const canDeleteEveryone = allMine || isCurrentOwner || isAdmin;

    const btnEveryone = document.getElementById('btn-delete-everyone');
    if (btnEveryone) btnEveryone.style.display = canDeleteEveryone ? 'block' : 'none';

    const delModal = document.getElementById('delete-modal');
    if (delModal) delModal.style.display = 'flex';
};

window.forwardSelectedMessages = async () => {
    const idsToForward = Array.from(selectedMessageIds);
    if (idsToForward.length === 0) return alert("Select at least one message to forward.");
    const sourceRoomId = currentRoomId;

    if (!document.getElementById('forward-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="forward-modal" class="guest-overlay" style="display: none; z-index: 10003;">
                <div class="guest-modal" style="padding: 20px; width: 90%; max-width: 350px;">
                    <h3 style="margin-bottom: 15px; color: var(--primary);">Forward To:</h3>
                    <div id="forward-rooms-list" style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 15px;"></div>
                    <button id="btn-cancel-forward" style="width: 100%; padding: 10px; background: transparent; color: var(--text-muted); border: none; cursor: pointer;">Cancel</button>
                </div>
            </div>
        `);
        document.getElementById('btn-cancel-forward')?.addEventListener('click', () => {
            const fwdModal = document.getElementById('forward-modal');
            if (fwdModal) fwdModal.style.display = 'none';
        });
    }

    const listEl = document.getElementById('forward-rooms-list');
    listEl.innerHTML = '';
    
    const availableRooms = window.getAvailableRooms ? window.getAvailableRooms() : {};
    Object.keys(availableRooms).forEach(roomId => {
        const room = availableRooms[roomId];
        const item = document.createElement('div');
        item.style = "padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer; color: var(--text-main); font-weight: 600;";
        item.innerText = room.name || 'Chat';
        item.onclick = async () => {
            document.getElementById('forward-modal').style.display = 'none';
            const curId = currentUser?.id || currentUser?.uid;
            const isOwner = currentUser?.isOwner || String(currentUser?.email || '').toLowerCase().trim() === 'akshat124.am12@gmail.com';
            let successCount = 0;
            let failCount = 0;

            for (const msgId of idsToForward) {
                try {
                    const msgDoc = await getDoc(doc(db, `chats/${sourceRoomId}/messages`, msgId));
                    if (msgDoc.exists()) {
                        const originalData = msgDoc.data();
                        let finalizedText = originalData.text ? decryptMessage(originalData.text) : "";
                        if (!finalizedText.includes("Forwarded")) finalizedText = "_▶ Forwarded_\n" + finalizedText;

                        const fwdPayload = {
                            text: encryptMessage(finalizedText),
                            fileUrl: originalData.fileUrl || null,
                            fileType: originalData.fileType || null,
                            fileName: originalData.fileName || null,
                            senderId: curId,
                            senderName: currentUser?.name || 'User',
                            isOwner: isOwner,
                            timestamp: Date.now(),
                            localTimestamp: Date.now(),
                            expireAt: Timestamp.fromMillis(Date.now() + 60 * 24 * 60 * 60 * 1000)
                        };
                        await addDoc(collection(db, `chats/${roomId}/messages`), fwdPayload);
                        successCount++;
                    } else {
                        failCount++;
                    }
                } catch(e) {
                    failCount++;
                }
            }

            // Only update destination metadata if at least one message succeeded (Bug 24)
            if (successCount > 0) {
                try {
                    const targetUpdate = {};
                    if (room && room.type === 'dm') {
                        const otherParticipant = room.participants?.find(id => id !== curId);
                        if (otherParticipant) targetUpdate[`deletedFor_${otherParticipant}`] = false;
                    }
                    await updateDoc(doc(db, "chats", roomId), { 
                        lastMessageTime: Date.now(), 
                        lastMessageSenderId: curId,
                        ...targetUpdate
                    }); 
                } catch(e) {
                    console.error("Forwarding metadata update error:", e);
                }
            }

            // Only apply source-room UI updates if still in sourceRoomId (Bug 28)
            if (currentRoomId === sourceRoomId) {
                window.enableSelectionMode(false);
            } else {
                selectedMessageIds.clear();
            }

            if (failCount === 0) {
                alert("Messages forwarded successfully.");
            } else {
                alert(`Forwarded ${successCount} message(s). ${failCount} failed.`);
            }
        };
        listEl.appendChild(item);
    });
    document.getElementById('forward-modal').style.display = 'flex';
};

window.scrollToMessage = (msgId) => {
    if (!msgId) return;
    const targetEl = document.getElementById(`container-${msgId}`);
    if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetEl.classList.remove('message-highlight');
        void targetEl.offsetWidth;
        targetEl.classList.add('message-highlight');
        setTimeout(() => {
            targetEl.classList.remove('message-highlight');
        }, 2200);
    }
};

window.toggleActionMenu = (msgId) => { 
    const menu = document.getElementById(`menu-${msgId}`);
    if (!menu) return;
    const wasActive = menu.classList.contains('active');
    document.querySelectorAll('.msg-action-menu').forEach(m => m.classList.remove('active'));
    if (!wasActive) {
        menu.classList.add('active');
    }
};

window.triggerPinModal = (msgId) => { 
    messageToPin = msgId; 
    window.toggleActionMenu(msgId); 
    const pinModal = document.getElementById('pin-modal');
    if (pinModal) pinModal.style.display = 'flex'; 
};

// Event listeners
document.addEventListener('click', (e) => {
    if (!e.target.closest('.msg-bubble') && !e.target.closest('.msg-action-trigger')) {
        document.querySelectorAll('.msg-action-menu').forEach(m => m.classList.remove('active'));
    }
});

document.addEventListener('change', (e) => {
    if (e.target.classList.contains('msg-checkbox')) {
        const val = e.target.value;
        if (e.target.checked) {
            selectedMessageIds.add(val);
        } else {
            selectedMessageIds.delete(val);
        }
        updateSelectionCount();
    }
});

document.getElementById('btn-cancel-selection')?.addEventListener('click', () => { window.enableSelectionMode(false); });
document.getElementById('btn-action-delete')?.addEventListener('click', () => { window.openDeleteMessagesModal(); });
document.getElementById('btn-action-forward')?.addEventListener('click', () => { window.forwardSelectedMessages(); });

document.getElementById('btn-opt-select')?.addEventListener('click', () => {
    const optMenu = document.getElementById('chat-options-menu');
    if (optMenu) optMenu.style.display = 'none';
    window.enableSelectionMode(true);
});

document.getElementById('btn-cancel-delete')?.addEventListener('click', () => {
    const delModal = document.getElementById('delete-modal');
    if (delModal) delModal.style.display = 'none';
});

document.getElementById('btn-delete-me')?.addEventListener('click', async () => {
    const targetRoomId = currentRoomId;
    if (!targetRoomId || selectedMessageIds.size === 0) return;
    const curId = currentUser?.id || currentUser?.uid;
    if (!curId) return;

    const idsToDelete = Array.from(selectedMessageIds);
    const delModal = document.getElementById('delete-modal');
    
    const btn = document.getElementById('btn-delete-me');
    const originalText = btn.innerText;
    btn.innerText = "Deleting...";
    btn.disabled = true;

    try {
        for (let i = 0; i < idsToDelete.length; i += 400) {
            const chunk = idsToDelete.slice(i, i + 400);
            const batch = writeBatch(db);
            chunk.forEach(msgId => {
                const docRef = doc(db, `users/${curId}/hiddenMessages`, `${targetRoomId}_${msgId}`);
                batch.set(docRef, {
                    roomId: targetRoomId,
                    messageId: msgId,
                    hiddenAt: Date.now()
                });
            });
            await batch.commit();
            if (currentRoomId !== targetRoomId) break;
        }

        if (currentRoomId === targetRoomId) {
            idsToDelete.forEach(id => hiddenMessageIds.add(id));
            if (delModal) delModal.style.display = 'none';
            window.enableSelectionMode(false);
            renderMessagesUI();
        }
    } catch(err) {
        console.error("Delete for me error:", err);
        if (currentRoomId === targetRoomId) {
            alert("Failed to hide messages: " + (err.message || "Network error"));
        }
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
});

document.getElementById('btn-delete-everyone')?.addEventListener('click', async () => {
    const idsToDelete = Array.from(selectedMessageIds);
    if (idsToDelete.length === 0) return;
    const targetRoomId = currentRoomId;
    if (!targetRoomId) return;

    try {
        for (let i = 0; i < idsToDelete.length; i += 400) {
            const chunk = idsToDelete.slice(i, i + 400);
            const batch = writeBatch(db);
            chunk.forEach(id => {
                batch.delete(doc(db, `chats/${targetRoomId}/messages`, id));
            });
            await batch.commit();
            if (currentRoomId !== targetRoomId) return;
        }

        const delModal = document.getElementById('delete-modal');
        if (delModal) delModal.style.display = 'none';
        
        if (currentRoomId === targetRoomId) {
            window.enableSelectionMode(false);
        } else {
            selectedMessageIds.clear();
        }
    } catch(err) {
        console.error("Batch delete error:", err);
        if (currentRoomId === targetRoomId) {
            alert("Error deleting messages for everyone.");
        }
    }
});

document.getElementById('btn-cancel-pin')?.addEventListener('click', () => {
    const pinModal = document.getElementById('pin-modal');
    if (pinModal) pinModal.style.display = 'none';
});

document.querySelectorAll('.pin-duration-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        if (!messageToPin || !currentRoomId) return;
        const targetRoomId = currentRoomId;
        const targetMsgId = messageToPin;
        const textEl = document.getElementById(`text-${targetMsgId}`);
        if (!textEl) return;
        const hours = parseInt(e.target.getAttribute('data-hours'));
        try { 
            await updateDoc(doc(db, "chats", targetRoomId), { 
                pinnedMessage: encryptMessage(textEl.innerText), 
                pinnedMessageId: targetMsgId,
                pinExpiry: Date.now() + (hours * 60 * 60 * 1000) 
            }); 
            // After updateDoc() succeeds, only close the pin modal/reset room-specific UI if the user is still in that same room (Bug 28)
            if (currentRoomId === targetRoomId) {
                const pinModal = document.getElementById('pin-modal');
                if (pinModal) pinModal.style.display = 'none';
                messageToPin = null;
            }
        } catch (err) {
            console.error("Pin message failed:", err);
            if (currentRoomId === targetRoomId) {
                alert("Failed to pin message: " + (err.message || "Permission denied or network error"));
            }
        }
    });
});

document.getElementById('btn-unpin')?.addEventListener('click', async (e) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    if (!currentRoomId) return;
    const targetRoomId = currentRoomId;
    try { 
        await updateDoc(doc(db, "chats", targetRoomId), { 
            pinnedMessage: "", 
            pinnedMessageId: "",
            pinExpiry: 0 
        }); 
        if (currentRoomId === targetRoomId) {
            const banner = document.getElementById('pinned-message-banner');
            if (banner) banner.style.display = 'none';
        }
    } catch(err) {
        console.error("Unpin message failed:", err);
        if (currentRoomId === targetRoomId) {
            alert("Failed to unpin message: " + (err.message || "Permission denied or network error"));
        }
    }
});

window.replyToMessage = (msgId) => {
    const textEl = document.getElementById(`text-${msgId}`);
    const senderNameEl = document.getElementById(`container-${msgId}`)?.querySelector('.msg-sender-name');
    replyContext = { msgId, text: textEl ? textEl.innerText : '', senderName: senderNameEl ? senderNameEl.innerText : 'User' };
    
    const prevName = document.getElementById('reply-preview-name');
    const prevText = document.getElementById('reply-preview-text');
    const prevBanner = document.getElementById('reply-preview-banner');
    
    if (prevName) prevName.innerText = `Replying to ${replyContext.senderName}`;
    if (prevText) prevText.innerText = replyContext.text;
    if (prevBanner) prevBanner.style.display = 'block';
    
    window.toggleActionMenu(msgId);
    document.getElementById('chat-input')?.focus();
};

window.cancelReply = () => { 
    replyContext = null; 
    const banner = document.getElementById('reply-preview-banner');
    if (banner) banner.style.display = 'none'; 
};
document.getElementById('btn-cancel-reply')?.addEventListener('click', window.cancelReply);
