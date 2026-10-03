import { db, doc, setDoc, getDoc, getDocs, collection, updateDoc, deleteDoc, arrayRemove, writeBatch } from './firebase.js';
import { currentUser } from './auth.js';

const ownerEmail = 'akshat124.am12@gmail.com';
let uploadedGroupIconBase64 = null;

export const userProfileCache = new Map();
export const profilePromiseCache = new Map();
export const getCachedUserProfile = async (uid, forceFresh = false) => {
    if (!uid) return { displayName: 'User', _cachedAt: Date.now() };
    const CACHE_TTL_MS = 60000;
    if (!forceFresh && userProfileCache.has(uid)) {
        const cached = userProfileCache.get(uid);
        if (cached) {
            if (!cached._cachedAt) {
                cached._cachedAt = Date.now();
                userProfileCache.set(uid, cached);
            }
            if (Date.now() - cached._cachedAt < CACHE_TTL_MS) {
                return cached;
            }
        }
    }

    if (!forceFresh && profilePromiseCache.has(uid)) {
        return profilePromiseCache.get(uid);
    }

    const fetchPromise = (async () => {
        try {
            const uDoc = await getDoc(doc(db, "users", uid));
            if (uDoc.exists()) {
                const data = uDoc.data();
                const safeEmail = String(data.email || '').toLowerCase().trim();
                const displayName = (data.nickname || data.fullName || data.name || data.firstName || (safeEmail ? safeEmail.split('@')[0] : 'User')).trim();
                const pic = data.customProfilePic || data.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=00a884&color=fff`;
                const profile = { ...data, displayName, pic, _cachedAt: Date.now() };
                userProfileCache.set(uid, profile);
                return profile;
            }
        } catch(e) { console.error(e); alert("Action failed: " + (e.message || "Unknown error")); }
        const fallback = userProfileCache.get(uid) || { displayName: 'User', _cachedAt: Date.now() };
        if (!fallback._cachedAt) fallback._cachedAt = Date.now();
        userProfileCache.set(uid, fallback);
        return fallback;
    })().finally(() => {
        profilePromiseCache.delete(uid);
    });

    profilePromiseCache.set(uid, fetchPromise);
    return fetchPromise;
};

export const validateGroupName = (name) => {
    if (typeof name !== 'string') return { valid: false, error: "Group name is required." };
    const trimmed = name.trim();
    if (trimmed.length === 0) return { valid: false, error: "Group name cannot be empty or whitespace only." };
    if (trimmed.length > 50) return { valid: false, error: "Group name cannot exceed 50 characters." };
    return { valid: true, name: trimmed };
};

export const initGroupEngine = () => {
    const headerInfo = document.getElementById('header-room-info');
    const infoPanel = document.getElementById('group-info-panel');
    const closeBtn = document.getElementById('btn-close-info');

    if (headerInfo && infoPanel && !headerInfo.dataset.bound) {
        headerInfo.dataset.bound = 'true';
        headerInfo.addEventListener('click', () => {
            const roomName = document.getElementById('active-room-name')?.innerText || 'Room Name';
            const iconBox = document.getElementById('active-room-icon-box');
            const infoAvatarBox = document.querySelector('#group-info-panel .global-icon-box');
            
            const infoNameEl = document.getElementById('info-room-name');
            if (infoNameEl) infoNameEl.innerText = roomName;
            
            if (iconBox && infoAvatarBox) {
                const imgInside = iconBox.querySelector('img');
                const spanInside = iconBox.querySelector('span');
                if (imgInside) {
                    infoAvatarBox.style.background = 'transparent';
                    infoAvatarBox.innerHTML = `<img src="${imgInside.src}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
                } else if (spanInside) {
                    infoAvatarBox.style.background = '';
                    infoAvatarBox.innerHTML = `<span id="info-avatar-icon" class="material-symbols-rounded">${spanInside.innerText}</span>`;
                } else {
                    infoAvatarBox.style.background = '';
                    infoAvatarBox.innerHTML = `<span id="info-avatar-icon" class="material-symbols-rounded">public</span>`;
                }
            }
            
            populateContactInfoPanel();
            infoPanel.style.display = 'flex';
        });
    }

    if (closeBtn && !closeBtn.dataset.bound) {
        closeBtn.dataset.bound = 'true';
        closeBtn.addEventListener('click', () => {
            infoPanel.style.display = 'none';
        });
    }
};

export const populateContactInfoPanel = async () => {
    const targetRoomId = window.appState?.activeChatId;
    const membersListEl = document.getElementById('group-members-list');
    if (!membersListEl) return;
    membersListEl.innerHTML = '<p style="color:var(--text-muted); font-size:13px; text-align:center;">Loading participants...</p>';

    const currentRoomData = window.currentRoomData;
    const curId = currentUser?.id || currentUser?.uid;
    const isOwner = currentUser?.isOwner || String(currentUser?.email || '').toLowerCase().trim() === ownerEmail;
    const isAdmin = Array.isArray(currentRoomData?.admins) && currentRoomData.admins.includes(curId);
    const canKick = isOwner || isAdmin;

    const safeParticipants = Array.isArray(currentRoomData?.participants) ? currentRoomData.participants : [];

    if (safeParticipants.length === 0) {
        membersListEl.innerHTML = '<p style="color:var(--text-muted); font-size:13px; text-align:center;">Direct Chat</p>';
        return;
    }

    const memberItems = [];
    for (const uid of safeParticipants) {
        try {
            const u = await getCachedUserProfile(uid);
            if (window.appState?.activeChatId !== targetRoomId) return;
            const name = u.displayName || u.fullName || u.name || 'User';
            const safeName = (name || "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
            const isMemAdmin = Array.isArray(currentRoomData?.admins) && currentRoomData.admins.includes(uid);
            
            const kickBtn = (uid !== curId && canKick && currentRoomData?.type === 'group') 
                ? `<button onclick="window.removeGroupMember('${uid}')" style="background: #ea0038; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer;">Remove</button>` 
                : '';

            memberItems.push(`
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border);">
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-size: 14px; font-weight: 600; color: var(--text-main);">${safeName}</span>
                        <span style="font-size: 11px; color: var(--primary);">${isMemAdmin ? 'Admin' : 'Member'}</span>
                    </div>
                    ${kickBtn}
                </div>
            `);
        } catch(e) { console.error(e); alert("Action failed: " + (e.message || "Unknown error")); }
    }
    if (window.appState?.activeChatId === targetRoomId) {
        membersListEl.innerHTML = memberItems.join('');
    }
};

export const injectGroupAdminModal = () => {
    if (document.getElementById('group-admin-modal')) return;
    const modalHTML = `
        <div id="group-admin-modal" class="guest-overlay" style="display: none; z-index: 10002;">
            <div class="guest-modal" style="padding: 25px; width: 90%; max-width: 400px; max-height: 90vh; overflow-y: auto;">
                <h3 style="margin-bottom: 15px; color: var(--primary);">Group Settings</h3>
                <div id="group-edit-section">
                    <input type="text" id="edit-group-name" placeholder="Group Name" style="width: 100%; padding: 12px; margin-bottom: 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--input-bg); color: var(--text-main);">
                    <input type="text" id="edit-group-icon" placeholder="Or paste Logo URL here..." style="width: 100%; padding: 12px; margin-bottom: 15px; border-radius: 8px; border: 1px solid var(--border); background: var(--input-bg); color: var(--text-main);">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                        <img id="group-icon-preview" src="https://cdn-icons-png.flaticon.com/512/149/149071.png" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;">
                        <button id="btn-upload-group-icon" style="flex: 1; padding: 10px; background: transparent; color: var(--primary); border: 1px dashed var(--primary); border-radius: 8px; cursor: pointer; font-size: 12px;">Upload Image</button>
                        <input type="file" id="hidden-group-icon-input" accept="image/*" style="display: none;">
                    </div>
                </div>
                <div id="add-member-section">
                    <h4 style="font-size: 13px; text-align: left; margin-bottom: 8px; color: var(--text-muted);">Add Member</h4>
                    <input type="text" id="search-member-input" placeholder="Search by name or email..." style="width: 100%; padding: 12px; margin-bottom: 5px; border-radius: 8px; border: 1px solid var(--border); background: var(--input-bg); color: var(--text-main);" autocomplete="off">
                    <div id="search-member-results" style="max-height: 180px; overflow-y: auto; margin-bottom: 15px; border: 1px solid var(--border); border-radius: 8px; padding: 5px; display: none;"></div>
                </div>
                <div id="manage-members-section">
                    <h4 style="font-size: 13px; text-align: left; margin-bottom: 8px; color: var(--text-muted);">Participants</h4>
                    <div id="admin-member-list" style="max-height: 150px; overflow-y: auto; margin-bottom: 15px; border: 1px solid var(--border); border-radius: 8px; padding: 5px;"></div>
                </div>
                <div id="transfer-admin-section">
                    <h4 style="font-size: 13px; text-align: left; margin-bottom: 8px; color: var(--text-muted);">Transfer Admin Status</h4>
                    <select id="transfer-admin-select" style="width: 100%; padding: 12px; margin-bottom: 20px; border-radius: 8px; border: 1px solid var(--border); background: var(--app-bg); color: var(--text-main);">
                        <option value="">Select a member...</option>
                    </select>
                </div>
                <button id="btn-save-group" style="width: 100%; padding: 12px; background: var(--primary); color: white; border: none; border-radius: 8px; margin-bottom: 10px; cursor: pointer; font-weight: 600;">Save Changes</button>
                <button id="btn-delete-group" style="width: 100%; padding: 12px; background: #ea0038; color: white; border: none; border-radius: 8px; margin-bottom: 10px; cursor: pointer; font-weight: 600;">Delete Group</button>
                <button id="btn-cancel-group" style="width: 100%; padding: 12px; background: transparent; color: var(--text-muted); border: none; cursor: pointer;">Close</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('btn-cancel-group').addEventListener('click', () => { 
        document.getElementById('group-admin-modal').style.display = 'none'; 
        uploadedGroupIconBase64 = null; 
    });

    document.getElementById('btn-upload-group-icon').addEventListener('click', () => document.getElementById('hidden-group-icon-input').click());
    document.getElementById('hidden-group-icon-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file || !file.type.startsWith('image/')) return alert("Only images allowed.");
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 300;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                uploadedGroupIconBase64 = canvas.toDataURL('image/jpeg', 0.8);
                document.getElementById('group-icon-preview').src = uploadedGroupIconBase64;
                document.getElementById('edit-group-icon').value = ''; 
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('btn-save-group').addEventListener('click', async () => {
        const targetRoomId = window.appState?.activeChatId;
        if (!targetRoomId) return;

        const updates = {};
        const urlIcon = document.getElementById('edit-group-icon')?.value.trim();
        const newAdminId = document.getElementById('transfer-admin-select')?.value;

        const nameInput = document.getElementById('edit-group-name');
        if (nameInput) {
            const validation = validateGroupName(nameInput.value);
            if (!validation.valid) {
                return alert(validation.error);
            }
            updates.name = validation.name;
        }

        if (urlIcon) updates.icon = urlIcon; 
        else if (uploadedGroupIconBase64) updates.icon = uploadedGroupIconBase64;
        if (newAdminId) updates.admins = [newAdminId]; 
        
        if (Object.keys(updates).length > 0) {
            try { 
                await updateDoc(doc(db, "chats", targetRoomId), updates); 
                if (window.appState?.activeChatId === targetRoomId) {
                    alert("Group settings saved."); 
                    const groupModal = document.getElementById('group-admin-modal');
                    if (groupModal) groupModal.style.display = 'none';
                    uploadedGroupIconBase64 = null;
                }
            } catch(e) { 
                console.error("Save group settings error:", e);
                if (window.appState?.activeChatId === targetRoomId) {
                    alert("Error saving settings: " + (e.message || "Permission denied")); 
                }
            }
        } else {
            if (window.appState?.activeChatId === targetRoomId) {
                const groupModal = document.getElementById('group-admin-modal');
                if (groupModal) groupModal.style.display = 'none';
                uploadedGroupIconBase64 = null;
            }
        }
    });

    document.getElementById('btn-delete-group').addEventListener('click', async () => {
        const operationRoomId = window.appState?.activeChatId;
        if (!operationRoomId) return;

        if (confirm("WARNING: This will permanently delete this group and all messages. Proceed?")) {
            try {
                // Fresh authorization check (Bug 8)
                const groupDoc = await getDoc(doc(db, "chats", operationRoomId));
                if (!groupDoc.exists()) {
                    alert("Group does not exist.");
                    return;
                }
                const data = groupDoc.data();
                if (data.type !== 'group') {
                    alert("This is not a group.");
                    return;
                }
                const curId = currentUser?.id || currentUser?.uid;
                const isCurrentOwner = currentUser?.isOwner || String(currentUser?.email || '').toLowerCase().trim() === 'akshat124.am12@gmail.com';
                const isParticipant = Array.isArray(data.participants) && data.participants.includes(curId);
                const isAdmin = Array.isArray(data.admins) && data.admins.includes(curId);

                if (!isParticipant && !isCurrentOwner) {
                    alert("You are not a participant of this group.");
                    return;
                }
                if (!isCurrentOwner && !isAdmin) {
                    alert("Only the Owner or group Admins can delete the group.");
                    return;
                }

                const msgsSnap = await getDocs(collection(db, `chats/${operationRoomId}/messages`));
                const docsArray = msgsSnap.docs;
                for (let i = 0; i < docsArray.length; i += 400) {
                    const chunk = docsArray.slice(i, i + 400);
                    const batch = writeBatch(db);
                    chunk.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                }
                await deleteDoc(doc(db, "chats", operationRoomId));
                const modal = document.getElementById('group-admin-modal');
                if (modal) modal.style.display = 'none';
                
                if (window.appState && window.appState.activeChatId === operationRoomId) {
                    window.appState.activeChatId = null;
                    document.getElementById('main-layout')?.classList.remove('mobile-chat-active');
                    if (window.leaveChatRoom) window.leaveChatRoom();
                } else {
                    window.location.reload(); 
                }
            } catch(e) { 
                console.error("Delete group error:", e);
                alert("Insufficient Permissions to delete group: " + (e.message || "Failed")); 
            }
        }
    });
};

export const populateGroupManagement = async (participants, admins) => {
    const targetRoomId = window.appState?.activeChatId;
    const listEl = document.getElementById('admin-member-list');
    const transferSelectEl = document.getElementById('transfer-admin-select');
    const searchInput = document.getElementById('search-member-input');
    const searchResults = document.getElementById('search-member-results');
    
    if (!listEl || !transferSelectEl || !searchInput) return;
    
    listEl.innerHTML = '';
    transferSelectEl.innerHTML = '<option value="">Select a member to make Admin...</option>';
    searchResults.innerHTML = '<p style="font-size:12px; color:var(--text-muted); padding: 5px;">Loading network...</p>';
    searchResults.style.display = 'block';
    searchInput.value = '';

    const curId = currentUser?.id || currentUser?.uid;
    const isOwner = currentUser?.isOwner || String(currentUser?.email || '').toLowerCase().trim() === ownerEmail;
    const isAdmin = Array.isArray(admins) && admins.includes(curId);
    const canEdit = isOwner || isAdmin;

    const safeParticipants = Array.isArray(participants) ? participants : [];

    for (const uid of safeParticipants) {
        try {
            const u = await getCachedUserProfile(uid);
            if (window.appState?.activeChatId !== targetRoomId) return;
            const safeEmail = String(u.email || '');
            const name = u.displayName || u.fullName || u.firstName || (safeEmail ? safeEmail.split('@')[0] : 'User');
            const safeName = (name || "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
            const isMemAdmin = Array.isArray(admins) && admins.includes(uid);
            
            if (!isMemAdmin) transferSelectEl.innerHTML += `<option value="${uid}">${safeName}</option>`;

            const kickBtnHTML = (uid !== curId && canEdit) ? `<button onclick="window.removeGroupMember('${uid}')" style="background: #ea0038; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer;">Remove</button>` : '';

            listEl.innerHTML += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid var(--app-bg);">
                    <span style="font-size: 13px; color: var(--text-main);">${safeName} <span style="color:var(--primary); font-size:10px;">${isMemAdmin ? '(Admin)' : ''}</span></span>
                    ${kickBtnHTML}
                </div>
            `;
        } catch(e) { console.error(e); alert("Action failed: " + (e.message || "Unknown error")); }
    }

    let allUsers = [];
    try {
        const snap = await getDocs(collection(db, "users"));
        if (window.appState?.activeChatId !== targetRoomId) return;
        snap.forEach(d => {
            const u = d.data();
            const safeEmail = u.email ? String(u.email).trim() : '';
            const safeName = (u.nickname || u.fullName || u.name || u.firstName || (safeEmail ? safeEmail.split('@')[0] : 'Unknown User')).trim();
            if (!safeName || (safeName === 'Unknown User' && !safeEmail)) return;
            const searchStr = `${safeName.toLowerCase()} ${safeEmail.toLowerCase()}`;
            allUsers.push({ id: d.id, name: safeName, email: safeEmail, searchStr: searchStr });
        });
        allUsers.sort((a, b) => a.name.localeCompare(b.name));
    } catch(e) { console.error(e); alert("Action failed: " + (e.message || "Unknown error")); }

    if (window.appState?.activeChatId !== targetRoomId) return;

    const renderSearch = (term = '') => {
        searchResults.style.display = 'block';
        const cleanTerms = term.trim().toLowerCase().split(' ').filter(Boolean);

        const filtered = allUsers.filter(u => {
            if (cleanTerms.length === 0) return true; 
            return cleanTerms.every(t => u.searchStr.includes(t));
        });

        if (filtered.length === 0) {
            searchResults.innerHTML = '<p style="font-size:12px; color:var(--text-muted); padding: 5px;">No network users found.</p>';
            return;
        }

        let htmlString = '';
        filtered.forEach(u => {
            const isAlreadyInGroup = safeParticipants.includes(u.id);
            const btnHTML = isAlreadyInGroup 
                ? `<button disabled style="background: transparent; color: var(--text-muted); border: 1px solid var(--border); border-radius: 4px; padding: 4px 10px; font-size: 11px; cursor: not-allowed;">Added</button>`
                : `<button onclick="window.addGroupMember('${u.id}')" style="background: var(--primary); color: white; border: none; border-radius: 4px; padding: 4px 10px; font-size: 11px; cursor: pointer;">Add</button>`;

            const escapedName = (u.name || "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
            const escapedEmail = (u.email || "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
            htmlString += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid var(--border);">
                    <div style="display: flex; flex-direction: column; text-align: left; overflow: hidden; max-width: 70%;">
                        <span style="font-size: 13px; color: var(--text-main); font-weight: 600; white-space: nowrap; text-overflow: ellipsis;">${escapedName}</span>
                        <span style="font-size: 11px; color: var(--text-muted); white-space: nowrap; text-overflow: ellipsis;">${escapedEmail}</span>
                    </div>
                    ${btnHTML}
                </div>
            `;
        });
        searchResults.innerHTML = htmlString;
    };

    renderSearch(); 
    const newInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newInput, searchInput);
    newInput.addEventListener('input', (e) => renderSearch(e.target.value));
};

window.addGroupMember = async (newMemberId) => {
    const targetRoomId = window.appState?.activeChatId;
    const currentRoomData = window.currentRoomData;
    if (!targetRoomId) return;

    try {
        const safeParticipants = Array.isArray(currentRoomData?.participants) ? currentRoomData.participants : [];
        if (safeParticipants.includes(newMemberId)) return;
        const updatedParticipants = [...safeParticipants, newMemberId];
        await updateDoc(doc(db, "chats", targetRoomId), { participants: updatedParticipants });
        
        // After await: Check if user is still in the target room! (Bug 28)
        if (window.appState?.activeChatId !== targetRoomId) return;

        if (window.currentRoomData) {
            window.currentRoomData.participants = updatedParticipants;
        }
        populateGroupManagement(updatedParticipants, currentRoomData?.admins || []);
        populateContactInfoPanel();

        const searchInput = document.getElementById('search-member-input');
        if (searchInput) searchInput.value = '';
        const searchResults = document.getElementById('search-member-results');
        if (searchResults) {
            searchResults.innerHTML = '';
            searchResults.style.display = 'none';
        }
    } catch(e) { 
        console.error("Add member error:", e);
        if (window.appState?.activeChatId === targetRoomId) {
            alert("Failed to add member: " + (e.message || "Permission denied")); 
        }
    }
};

window.removeGroupMember = async (uidToRemove) => {
    const targetRoomId = window.appState?.activeChatId;
    const activeChatData = window.currentRoomData;
    const curId = currentUser?.id || currentUser?.uid;
    const isOwner = currentUser?.isOwner || currentUser?.email === ownerEmail;
    
    if (!targetRoomId || !activeChatData || !curId) return;

    const isAdmin = activeChatData.admins?.includes(curId);

    if (!isAdmin && !isOwner) {
        alert("Only group admins or the Owner can remove members.");
        return;
    }
    
    if (confirm("Remove user from group?")) {
        try {
            await updateDoc(doc(db, "chats", targetRoomId), {
                participants: arrayRemove(uidToRemove),
                admins: arrayRemove(uidToRemove)
            });
            // After await: Check if user is still in the target room! (Bug 28)
            if (window.appState?.activeChatId !== targetRoomId) return;

            const newParticipants = (activeChatData.participants || []).filter(p => p !== uidToRemove);
            const newAdmins = (activeChatData.admins || []).filter(a => a !== uidToRemove);
            if (window.currentRoomData) {
                window.currentRoomData.participants = newParticipants;
                window.currentRoomData.admins = newAdmins;
            }
            populateGroupManagement(newParticipants, newAdmins);
            populateContactInfoPanel();
            alert("User removed successfully.");
        } catch(e) {
            console.error("Remove member error:", e);
            if (window.appState?.activeChatId === targetRoomId) {
                alert("Failed to remove user: " + (e.message || "Permission denied"));
            }
        }
    }
};
