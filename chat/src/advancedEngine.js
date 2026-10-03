import { db, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, orderBy, limit, getDocs, arrayUnion, arrayRemove, writeBatch } from "./firebase.js";
import { decryptMessage } from "./siteCipher.js";
import { getCachedUserProfile, userProfileCache } from "./groupEngine.js";

const ownerEmail = 'akshat124.am12@gmail.com';

function showBackdrop(show) {
    const backdrop = document.getElementById('mobile-menu-backdrop');
    if (backdrop) {
        backdrop.style.display = show ? 'block' : 'none';
    }
}

export function initGlobalSettings(currentUser) {
    const curId = currentUser?.id || currentUser?.uid;
    if (!curId) return;

    const profilePic = document.getElementById('nav-profile-pic');
    const profileDropdown = document.getElementById('profile-dropdown-menu');
    const settingsToggle = document.getElementById('btn-settings-toggle');
    const settingsDropdown = document.getElementById('settings-dropdown-menu');
    const backdrop = document.getElementById('mobile-menu-backdrop');

    if (backdrop && !backdrop.dataset.bound) {
        backdrop.dataset.bound = 'true';
        backdrop.addEventListener('click', () => {
            if (profileDropdown) profileDropdown.style.display = 'none';
            if (settingsDropdown) settingsDropdown.style.display = 'none';
            const chatMenu = document.getElementById('chat-options-menu');
            if (chatMenu) chatMenu.style.display = 'none';
            showBackdrop(false);
        });
    }

    if (profilePic && !window.profileMenuAttached) {
        profilePic.addEventListener('click', (e) => {
            e.stopPropagation();
            if (settingsDropdown) settingsDropdown.style.display = 'none';
            const willOpen = profileDropdown && profileDropdown.style.display !== 'block';
            if (profileDropdown) profileDropdown.style.display = willOpen ? 'block' : 'none';
            showBackdrop(willOpen && window.innerWidth <= 900);
        });
        window.profileMenuAttached = true;
    }

    if (settingsToggle && !window.settingsMenuAttached) {
        settingsToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (profileDropdown) profileDropdown.style.display = 'none';
            const willOpen = settingsDropdown && settingsDropdown.style.display !== 'block';
            if (settingsDropdown) settingsDropdown.style.display = willOpen ? 'block' : 'none';
            showBackdrop(willOpen && window.innerWidth <= 900);
        });
        window.settingsMenuAttached = true;
    }

    if (!window.globalSettingsOutsideClickBound) {
        window.globalSettingsOutsideClickBound = true;
        window.addEventListener('click', () => {
            if (profileDropdown) profileDropdown.style.display = 'none';
            if (settingsDropdown) settingsDropdown.style.display = 'none';
            showBackdrop(false);
        });
    }

    const customModal = document.getElementById('customModal');
    const btnOpenCustom = document.getElementById('btn-open-customisation');
    if (btnOpenCustom) {
        btnOpenCustom.onclick = async () => {
            if (settingsDropdown) settingsDropdown.style.display = 'none';
            showBackdrop(false);
            const userDoc = await getDoc(doc(db, "users", curId));
            const data = userDoc.data() || {};
            const nickInput = document.getElementById('custom-nickname');
            const wallInput = document.getElementById('custom-wallpaper');
            
            if (nickInput) nickInput.value = data.nickname || currentUser.name || '';
            if (wallInput) wallInput.value = data.wallpaper || '';
            if (customModal) customModal.style.display = 'flex';
        };
    }

    const btnSaveCustom = document.getElementById('btn-save-custom');
    if (btnSaveCustom) {
        btnSaveCustom.onclick = async () => {
            const newNick = document.getElementById('custom-nickname')?.value.trim() || '';
            const newWall = document.getElementById('custom-wallpaper')?.value.trim() || '';
            
            try {
                await updateDoc(doc(db, "users", curId), {
                    nickname: newNick,
                    wallpaper: newWall
                });
                
                const userDoc = await getDoc(doc(db, "users", curId));
                const data = userDoc.data() || {};
                const fallbackName = newNick || data.fullName || data.name || data.firstName || (currentUser.email ? currentUser.email.split('@')[0] : 'User');
                
                if (currentUser) currentUser.name = fallbackName;
                const cached = userProfileCache.get(curId) || {};
                userProfileCache.set(curId, { ...cached, nickname: newNick, displayName: fallbackName, _cachedAt: Date.now() });
                const profileNameEl = document.getElementById('nav-profile-name');
                const safeFallback = String(fallbackName).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
                if (profileNameEl) profileNameEl.innerHTML = `Name: ${safeFallback} <span style="color:var(--primary); font-size:12px;">${currentUser.isOwner ? '(Owner)' : ''}</span>`;
                
                const chatMain = document.querySelector('.chat-main');
                if (chatMain) {
                    if (newWall) {
                        const lw = newWall.toLowerCase().trim();
                        if (lw.startsWith('http://') || lw.startsWith('https://') || lw.startsWith('data:image/')) {
                            const safeWall = newWall.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
                            chatMain.style.backgroundImage = `url('${safeWall}')`;
                            chatMain.style.backgroundSize = "cover";
                        } else {
                            chatMain.style.backgroundImage = "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')";
                        }
                    } else {
                        chatMain.style.backgroundImage = "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')";
                    }
                }
                if (customModal) customModal.style.display = 'none';
                alert("Customisation saved!");
            } catch(e) {
                console.error("Customisation save error:", e);
                alert("Failed to save customisation: " + (e.message || "Unknown error"));
            }
        };
    }
    
    const btnCloseCustom = document.getElementById('btn-close-custom');
    if (btnCloseCustom) btnCloseCustom.onclick = () => { if (customModal) customModal.style.display = 'none'; };

    const unblockModal = document.getElementById('unblockModal');
    const btnOpenUnblock = document.getElementById('btn-open-unblock');
    
    if (btnOpenUnblock) {
        btnOpenUnblock.onclick = async () => {
            if (settingsDropdown) settingsDropdown.style.display = 'none';
            showBackdrop(false);
            const listDiv = document.getElementById('blocked-users-list');
            if (!listDiv) return;
            
            listDiv.innerHTML = '<p style="color:var(--text-muted); padding:10px;">Loading...</p>';
            if (unblockModal) unblockModal.style.display = 'flex';

            let blocked = [];
            try {
                const userDoc = await getDoc(doc(db, "users", curId));
                blocked = userDoc.data()?.blockedUsers || [];
            } catch(e) { console.error(e); alert("Action failed: " + (e.message || "Unknown error")); }

            if (blocked.length === 0) {
                listDiv.innerHTML = '<p style="color:var(--text-muted); padding:10px;">No blocked users.</p>';
                return;
            }

            listDiv.innerHTML = '';
            for (const uid of blocked) {
                try {
                    const u = await getCachedUserProfile(uid);
                    const uName = u.displayName || u.fullName || u.name || 'User';
                    
                    const item = document.createElement('div');
                    item.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid var(--border);";
                    const safeUName = (uName || "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
                    item.innerHTML = `
                        <span style="color:var(--text-main); font-weight:500;">${safeUName}</span>
                        <button class="unblock-btn" style="padding:6px 12px; background:var(--primary); color:white; border:none; border-radius:6px; cursor:pointer;">Unblock</button>
                    `;
                    item.querySelector('.unblock-btn').onclick = async () => {
                        try { 
                            await updateDoc(doc(db, "users", curId), { blockedUsers: arrayRemove(uid) }); 
                            item.remove();
                            if (listDiv.children.length === 0) listDiv.innerHTML = '<p style="color:var(--text-muted); padding:10px;">No blocked users.</p>';
                        } catch(e) { 
                            console.error(e); 
                            alert("Action failed: " + (e.message || "Unknown error")); 
                        }
                    };
                    listDiv.appendChild(item);
                } catch(e) { console.error(e); alert("Action failed: " + (e.message || "Unknown error")); }
            }
        };
    }
    
    const btnCloseUnblock = document.getElementById('btn-close-unblock');
    if (btnCloseUnblock) btnCloseUnblock.onclick = () => { if (unblockModal) unblockModal.style.display = 'none'; };
}

export function initChatOptions(currentUser, activeChatId, activeChatData) {
    const curId = currentUser?.id || currentUser?.uid;
    if (!activeChatId || !activeChatData || !curId) return;

    const optionsBtn = document.getElementById('btn-chat-options');
    const optionsMenu = document.getElementById('chat-options-menu');

    if (!window.chatOptionsOutsideClickBound) {
        window.chatOptionsOutsideClickBound = true;
        window.addEventListener('click', (e) => {
            const menu = document.getElementById('chat-options-menu');
            const btn = document.getElementById('btn-chat-options');
            if (menu && menu.style.display === 'block') {
                if (!menu.contains(e.target) && (!btn || !btn.contains(e.target))) {
                    menu.style.display = 'none';
                    showBackdrop(false);
                }
            }
        });
    }
    const isGroup = activeChatData.type === 'group' || activeChatId === 'global_channel' || activeChatId === 'aksh_help';
    const isCurrentOwner = currentUser?.isOwner || String(currentUser.email).toLowerCase().trim() === ownerEmail;
    
    let targetUid = null;
    let targetName = 'Unknown User';
    let isTargetOwner = window.isTargetOwner || false; 
    
    if (!isGroup) {
        const safeParticipants = Array.isArray(activeChatData.participants) ? activeChatData.participants : [];
        targetUid = safeParticipants.find(id => id !== curId);
        
        if (targetUid && activeChatData.names && activeChatData.names[targetUid]) {
            targetName = activeChatData.names[targetUid];
        }
    }

    if (optionsBtn) {
        optionsBtn.style.display = 'block';
        optionsBtn.onclick = (e) => {
            e.stopPropagation();
            if (optionsMenu) {
                const willOpen = optionsMenu.style.display !== 'block';
                optionsMenu.style.display = willOpen ? 'block' : 'none';
                showBackdrop(willOpen && window.innerWidth <= 900);
            }
        };
    }
    
    const hideHarshOptions = isGroup || isTargetOwner || isCurrentOwner;
    const reportBtn = document.getElementById('btn-opt-report');
    const blockBtn = document.getElementById('btn-opt-block');
    const leaveGroupBtn = document.getElementById('btn-opt-leave');
    
    if (reportBtn) reportBtn.style.display = hideHarshOptions ? 'none' : 'block';
    if (blockBtn) blockBtn.style.display = hideHarshOptions ? 'none' : 'block';
    
    if (leaveGroupBtn) {
        leaveGroupBtn.style.display = (isGroup && activeChatId !== 'global_channel' && activeChatId !== 'aksh_help') ? 'block' : 'none';
        leaveGroupBtn.onclick = async () => {
            const operationRoomId = activeChatId;
            if (!confirm("Are you sure you want to leave this group?")) return;
            try {
             await updateDoc(doc(db, "chats", operationRoomId), {
    participants: arrayRemove(curId),
    admins: arrayRemove(curId)
});

if (window.appState?.activeChatId !== operationRoomId) return;

if (window.appState && window.appState.activeChatId === operationRoomId) {
                    window.appState.activeChatId = null;
                    document.getElementById('main-layout')?.classList.remove('mobile-chat-active');
                    if (window.leaveChatRoom) window.leaveChatRoom();
                }
            } catch(e) { 
                console.error("Leave group error:", e);
                alert("Failed to leave group: " + (e.message || "Failed")); 
            }
        };
    }

    const exportBtn = document.getElementById('btn-opt-export');
    if (exportBtn) {
        exportBtn.onclick = async () => {
            const operationRoomId = activeChatId;
            try {
                const q = query(collection(db, `chats/${operationRoomId}/messages`), orderBy("timestamp", "asc"));
               const snapshot = await getDocs(q);
if (window.appState?.activeChatId !== operationRoomId) return;

                const clearTimestamp = activeChatData ? (activeChatData[`clearedAt_${curId}`] || 0) : 0;
                const clearMs = window.getTimestampMillis ? window.getTimestampMillis(clearTimestamp) : (typeof clearTimestamp === 'number' ? clearTimestamp : (typeof clearTimestamp?.toMillis === 'function' ? clearTimestamp.toMillis() : (typeof clearTimestamp?.seconds === 'number' ? clearTimestamp.seconds * 1000 : 0)));

                const sixtyDaysAgo = Date.now() - (60 * 24 * 60 * 60 * 1000);
                const effectiveCutoff = Math.max(clearMs, sixtyDaysAgo);

                let logOutput = `=== Chat Export Logs [Room: ${activeChatData.name || 'Chat'}] ===\n\n`;
                snapshot.forEach(docObj => {
                    const msgId = docObj.id;
                    if (window.hiddenMessageIds && window.hiddenMessageIds.has(msgId)) return;
                    const m = docObj.data();
                    let msgTimeRaw = m.localTimestamp || m.timestamp || Date.now();
                    const msgTime = window.getTimestampMillis ? window.getTimestampMillis(msgTimeRaw) : (typeof msgTimeRaw === 'number' ? msgTimeRaw : (typeof msgTimeRaw?.toMillis === 'function' ? msgTimeRaw.toMillis() : (typeof msgTimeRaw?.seconds === 'number' ? msgTimeRaw.seconds * 1000 : (typeof msgTimeRaw === 'string' ? Date.parse(msgTimeRaw) : 0))));

                    if (msgTime <= effectiveCutoff) return;

                    const stamp = new Date(msgTime).toLocaleString();
                    const decText = m.text ? decryptMessage(m.text) : "";
                    logOutput += `[${stamp}] ${m.senderName || 'User'}: ${decText}\n`;
                });
                const fileBlob = new Blob([logOutput], { type: 'text/plain' });
                const fileUrl = URL.createObjectURL(fileBlob);
                const anchor = document.createElement('a');
                anchor.href = fileUrl;
                anchor.download = `Aksh-Chat_${String(activeChatData.name || 'Chat').replace(/\s+/g, '_')}.txt`;
                document.body.appendChild(anchor);
                anchor.click();
                document.body.removeChild(anchor);
                URL.revokeObjectURL(fileUrl);
                if (optionsMenu) optionsMenu.style.display = 'none';
                showBackdrop(false);
            } catch(err) { console.error(err); }
        };
    }

    if (reportBtn) {
        reportBtn.onclick = async () => {
            if (!targetUid) return;
            const operationRoomId = activeChatId;
            if (!confirm(`Are you sure you want to report ${targetName} to the Owner?`)) return;
            try {
                const q = query(collection(db, `chats/${operationRoomId}/messages`), orderBy("timestamp", "desc"), limit(10));
                const snap = await getDocs(q);
if (window.appState?.activeChatId !== operationRoomId) return;
                let historyStr = "";
                snap.forEach(d => {
                    const msg = d.data();
                    const time = new Date(msg.timestamp || Date.now()).toLocaleString();
                    const sender = msg.senderId === curId ? currentUser.name : targetName;
                    const decText = msg.text ? decryptMessage(msg.text) : "";
                    historyStr = `[${time}] ${sender}: ${decText}\n` + historyStr; 
                });
                const ticketId = `report_${Date.now()}`;
                await setDoc(doc(db, "help_complaints", ticketId), {
                    name: currentUser.name,
                    email: currentUser.email,
                    subject: `🚨 REPORT: ${currentUser.name} reported ${targetName}`,
                    details: `Target UID: ${targetUid}\n\n--- EVIDENCE (LAST 10 MESSAGES) ---\n${historyStr || 'No recent messages recorded.'}`,
                    date: Date.now(),
                    status: 'Unresolved'
                });
                if (window.appState?.activeChatId !== operationRoomId) return;
                alert("Report submitted successfully.");
                if (optionsMenu) optionsMenu.style.display = 'none';
                showBackdrop(false);
            } catch(err) { 
                console.error(err); 
                alert("Failed to submit report. Please try again.");
            }
        };
    }
    

    if (blockBtn) {
        blockBtn.onclick = async () => {
            if (!targetUid) return;
            if (!confirm(`Block ${targetName}? They will no longer be able to message you.`)) return;
            try {
                await updateDoc(doc(db, "users", curId), {
                    blockedUsers: arrayUnion(targetUid)
                });
                alert("User blocked.");
                window.location.reload();
            } catch(e) { console.error(e); alert("Action failed: " + (e.message || "Unknown error")); }
        };
    }

    const clearBtn = document.getElementById('btn-opt-clear');
    if (clearBtn) {
        clearBtn.onclick = async () => {
            const operationRoomId = activeChatId;
            if (!confirm("Clear your chat history? The chat will remain in your list.")) return;
            try {
                await updateDoc(doc(db, "chats", operationRoomId), {
                    [`clearedAt_${curId}`]: Date.now(),
                    [`readReceipts.${curId}`]: Date.now()
                });
                alert("Chat cleared.");
                if (window.appState && window.appState.activeChatId === operationRoomId) {
                    window.appState.activeChatId = null;
                    document.getElementById('main-layout')?.classList.remove('mobile-chat-active');
                    if (window.leaveChatRoom) window.leaveChatRoom();
                }
            } catch(e) { console.error(e); alert("Action failed: " + (e.message || "Unknown error")); }
        };
    }

    // FIX: Show Delete Chat for everyone. Hide the "Delete for Everyone" INSIDE the modal for non-admins.
    const deleteBtn = document.getElementById('btn-opt-delete');
    if (deleteBtn) {
        deleteBtn.style.display = 'block';
        deleteBtn.onclick = () => {
            const delModal = document.getElementById('deleteChatModal');
            if (delModal) delModal.style.display = 'flex';
            if (optionsMenu) optionsMenu.style.display = 'none';
            showBackdrop(false);
            
            const btnEveryone = document.getElementById('btn-del-chat-both');
            let canDeleteEveryone = false;
            if (isGroup) {
                const isAdmin = Array.isArray(activeChatData.admins) && activeChatData.admins.includes(curId);
                canDeleteEveryone = isCurrentOwner || isAdmin;
            } else {
                canDeleteEveryone = isCurrentOwner; 
            }
            if (btnEveryone) btnEveryone.style.display = canDeleteEveryone ? 'block' : 'none';
        };
    }
    
    const closeDelChat = document.getElementById('btn-close-del-chat');
    if (closeDelChat) closeDelChat.onclick = () => { 
        const delModal = document.getElementById('deleteChatModal');
        if(delModal) delModal.style.display = 'none'; 
    };

    const delMe = document.getElementById('btn-del-chat-me');
    if (delMe) {
        delMe.onclick = async () => {
            const operationRoomId = activeChatId;
            try {
            await updateDoc(doc(db, "chats", operationRoomId), {
    [`deletedFor_${curId}`]: true,
    [`clearedAt_${curId}`]: Date.now(),
    [`readReceipts.${curId}`]: Date.now()
});

if (window.appState?.activeChatId !== operationRoomId) return;

const delModal = document.getElementById('deleteChatModal');
                if (delModal) delModal.style.display = 'none';

                if (window.appState && window.appState.activeChatId === operationRoomId) {
                    window.appState.activeChatId = null;
                    document.getElementById('main-layout')?.classList.remove('mobile-chat-active');
                    if (window.leaveChatRoom) window.leaveChatRoom();
                }
            } catch(e) { console.error(e); alert("Action failed: " + (e.message || "Unknown error")); }
        };
    }

       const delBoth = document.getElementById('btn-del-chat-both');
    if (delBoth) {
        delBoth.onclick = async () => {
            const operationRoomId = activeChatId;
            if (!confirm("Permanently delete this chat and all messages for everyone?")) return;

            delBoth.textContent = "Deleting...";
            let deletedMessageCount = 0;

            try {
                const snap = await getDocs(
                    collection(db, `chats/${operationRoomId}/messages`)
                );

                if (window.appState?.activeChatId !== operationRoomId) return;

                const docsArray = snap.docs;

                for (let i = 0; i < docsArray.length; i += 400) {
                    if (window.appState?.activeChatId !== operationRoomId) return;

                    const chunk = docsArray.slice(i, i + 400);
                    const batch = writeBatch(db);

                    chunk.forEach(d => batch.delete(d.ref));

                    await batch.commit();
                    deletedMessageCount += chunk.length;

                    if (window.appState?.activeChatId !== operationRoomId) return;
                }

                if (window.appState?.activeChatId !== operationRoomId) return;

                await deleteDoc(doc(db, "chats", operationRoomId));

                if (window.appState?.activeChatId !== operationRoomId) return;

                const delModal = document.getElementById('deleteChatModal');
                if (delModal) delModal.style.display = 'none';

                window.appState.activeChatId = null;
                document.getElementById('main-layout')?.classList.remove('mobile-chat-active');

                if (window.leaveChatRoom) {
                    window.leaveChatRoom();
                }

            } catch (e) {
                console.error("Delete chat for everyone error:", e);

                if (window.appState?.activeChatId === operationRoomId) {
                    if (deletedMessageCount > 0) {
                        alert(
                            `Delete partially completed. ${deletedMessageCount} message(s) were deleted, but the operation did not finish.`
                        );
                    } else {
                        alert(
                            "Failed to delete chat: " +
                            (e.message || "Check database permissions.")
                        );
                    }
                }
                      } finally {
                delBoth.textContent = "Delete for Both";
            }
        };
    }
}
