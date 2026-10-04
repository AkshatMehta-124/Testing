import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, collection } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { state, clearAllState } from "./state.js";

export function initAuth(onUserChange) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            state.currentUser = user;
            await syncUserProfile(user);
            initUserListeners(user);
            onUserChange(user, state.currentProfile);
        } else {
            clearAllState();
            onUserChange(null, null);
        }
    });
}

async function syncUserProfile(user) {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
        const profile = {
            uid: user.uid,
            email: user.email,
            fullName: user.displayName || "User",
            nickname: user.displayName || "User",
            photoURL: user.photoURL || "/chat-logo.png",
            createdAt: serverTimestamp(),
            lastSeen: serverTimestamp()
        };
        await setDoc(userRef, profile, { merge: true });
        state.currentProfile = profile;
    } else {
        const data = snap.data();
        state.currentProfile = data;
        // Update last seen
        setDoc(userRef, { lastSeen: serverTimestamp() }, { merge: true });
    }
    state.profileCache.set(user.uid, state.currentProfile);
}

function initUserListeners(user) {
    // Listen to hidden messages
    const hiddenRef = collection(db, `users/${user.uid}/hiddenMessages`);
    state.unsubscribers.hiddenMessages = onSnapshot(hiddenRef, (snap) => {
        state.hiddenMessageIds.clear();
        snap.forEach(doc => {
            state.hiddenMessageIds.add(doc.id);
        });
        document.dispatchEvent(new Event('hiddenMessagesUpdated'));
    });

    // Listen to blocked users
    const blockedRef = collection(db, `users/${user.uid}/blockedUsers`);
    state.unsubscribers.blockedUsers = onSnapshot(blockedRef, (snap) => {
        state.blockedUserIds.clear();
        snap.forEach(doc => {
            state.blockedUserIds.add(doc.id);
        });
        document.dispatchEvent(new Event('blockedUsersUpdated'));
    });

    // Listen to chatMeta
    import("./services/chats.js").then(({ listenToChatMeta }) => {
        state.unsubscribers.chatMeta = listenToChatMeta((meta) => {
            state.chatMeta = meta;
            // Optionally dispatch event or directly re-render active chat
            document.dispatchEvent(new Event('chatMetaUpdated'));
        });
    });
}

export async function login() {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
}

export async function logout() {
    await signOut(auth);
}
