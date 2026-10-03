import { auth, db, doc, getDoc, setDoc, onAuthStateChanged, signOut } from './firebase.js';

export const signOutUser = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    try {
        await signOut(auth);
    } catch (err) {
        console.error("Firebase sign-out error:", err);
    }
    try {
        localStorage.removeItem('aksh_user_email');
        localStorage.removeItem('aksh_user_id');
        localStorage.removeItem('aksh_user_name');
        localStorage.removeItem('aksh_photo_url');
        localStorage.removeItem('email');
        localStorage.removeItem('uid');
        localStorage.removeItem('name');
    } catch(err) { console.error(err); }
    window.location.href = '../../index.html';
};

export const currentUser = {
    id: null, name: 'Loading...', email: null, photoURL: '',
    
    get isOwner() { 
        const e = String(this.email).toLowerCase().trim();
        return e === 'akshat124.am12@gmail.com'; 
    },
    get isGuest() { return !this.id; }
};

export const initAuth = (onSuccessBoot) => {
    const overlay = document.getElementById('guest-overlay');
    const root = document.getElementById('app-root');

    const forceBoot = async (uid, email, name, photo) => {
        currentUser.id = uid;
        currentUser.email = email || '';
        currentUser.name = name || (email ? email.split('@')[0] : 'User');
        currentUser.photoURL = photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=00a884&color=fff`;

        // --- THE MASTER IDENTITY SYNC ---
        // Forces the authenticated user's profile into the public Firestore 'users' collection.
        // This completely fixes the bug where users were invisible to the Network Search.
        if (uid) {
            setDoc(doc(db, "users", uid), {
                uid: uid,
                email: String(currentUser.email).toLowerCase().trim(),
                fullName: currentUser.name,
                name: currentUser.name, 
                photoURL: currentUser.photoURL,
                lastLogin: Date.now()
            }, { merge: true }).catch(e => {
                console.error("Firestore Identity Sync Blocked by Permissions:", e);
            });
        }

        if (overlay) overlay.style.display = 'none';
        if (root) root.classList.remove('guest-blur');

        const nameEl = document.getElementById('nav-profile-name');
        const safeName = (currentUser.name || "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        if (nameEl) nameEl.innerHTML = `Name: ${safeName} <span style="color:var(--primary); font-size:12px;">${currentUser.isOwner ? '(Owner)' : ''}</span>`;
        
        const emailEl = document.getElementById('nav-profile-email');
        if (emailEl) emailEl.innerText = `Email: ${currentUser.email}`;
        
        const picEl = document.getElementById('nav-profile-pic');
        if (picEl) {
            picEl.src = currentUser.photoURL;
            picEl.onerror = () => { picEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=00a884&color=fff`; };
        }

        const signOutBtn = document.getElementById('btn-nav-sign-out');
        if (signOutBtn && !signOutBtn.dataset.bound) {
            signOutBtn.addEventListener('click', signOutUser);
            signOutBtn.dataset.bound = 'true';
        }

        if (onSuccessBoot) onSuccessBoot();
    };

    let hasBooted = false;

    onAuthStateChanged(auth, (user) => {
        if (user) {
            if (overlay) overlay.style.display = 'none';
            if (root) root.classList.remove('guest-blur');

            let dName = user.displayName || (user.email ? user.email.split('@')[0] : 'User');
            let pUrl = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(dName)}&background=00a884&color=fff`;
            
            if (!hasBooted) {
                forceBoot(user.uid, user.email, dName, pUrl);
                hasBooted = true;
            }

            // Sync profile in background
            getDoc(doc(db, "users", user.uid)).then(uDoc => {
                if (uDoc.exists()) {
                    const data = uDoc.data();
                    const newName = data.nickname || data.fullName || data.name || data.firstName || dName;
                    const newPic = data.customProfilePic || data.photoURL || data.profilePic || pUrl;
                    
                    currentUser.name = newName;
                    currentUser.photoURL = newPic;
                    
                    const nameEl = document.getElementById('nav-profile-name');
                    const safeName = (currentUser.name || "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
                    if (nameEl) nameEl.innerHTML = `Name: ${safeName} <span style="color:var(--primary); font-size:12px;">${currentUser.isOwner ? '(Owner)' : ''}</span>`;
                    
                    const picEl = document.getElementById('nav-profile-pic');
                    if (picEl) {
                        picEl.src = currentUser.photoURL;
                    }
                }
            }).catch(error => console.error("Profile fetch error:", error));
            
        } else {
            currentUser.id = null;
            hasBooted = false;
            if (overlay) overlay.style.display = 'flex';
            if (root) root.classList.add('guest-blur');
        }
    });
};
