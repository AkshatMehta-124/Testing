import { db } from "../firebase-config.js";
import { state } from "../state.js";
import { 
    doc, getDoc, updateDoc, setDoc, serverTimestamp, 
    collection, query, getDocs, limit, where 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

export async function fetchProfile(uid) {
    if (state.profileCache.has(uid)) {
        return state.profileCache.get(uid);
    }
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
        const data = snap.data();
        state.profileCache.set(uid, data);
        return data;
    }
    // Fallback profile
    const fallback = { uid, nickname: "Unknown", fullName: "Unknown", photoURL: "/chat-logo.png" };
    state.profileCache.set(uid, fallback);
    return fallback;
}

export async function searchUsers(searchTerm) {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];
    
    // Simplistic search for demonstration (Firestore doesn't natively support full text search well)
    // We'll fetch all users or a limit, and filter locally. In real prod, use Algolia/Meilisearch.
    // For this build, we query users with email or name starting with term, or just fetch top 100.
    const q = query(collection(db, "users"), limit(50));
    const snap = await getDocs(q);
    const results = [];
    snap.forEach(docSnap => {
        const data = docSnap.data();
        if (
            (data.nickname && data.nickname.toLowerCase().includes(term)) ||
            (data.fullName && data.fullName.toLowerCase().includes(term)) ||
            (data.email && data.email.toLowerCase().includes(term))
        ) {
            results.push(data);
        }
    });
    return results;
}

export async function blockUser(targetUid) {
    if (!state.currentUser) return;
    const ref = doc(db, `users/${state.currentUser.uid}/blockedUsers`, targetUid);
    await setDoc(ref, { blockedAt: serverTimestamp() });
}

export async function unblockUser(targetUid) {
    if (!state.currentUser) return;
    const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js");
    const ref = doc(db, `users/${state.currentUser.uid}/blockedUsers`, targetUid);
    await deleteDoc(ref);
}

export async function updateProfile(data) {
    if (!state.currentUser) return;
    const ref = doc(db, "users", state.currentUser.uid);
    await updateDoc(ref, data);
    // Update local cache
    const current = state.profileCache.get(state.currentUser.uid) || {};
    state.profileCache.set(state.currentUser.uid, { ...current, ...data });
}
