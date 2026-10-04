import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

let currentUser = null;
let currentProfile = null;

export function initAuth(onUserChange) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await syncUserProfile(user);
            onUserChange(user, currentProfile);
        } else {
            currentUser = null;
            currentProfile = null;
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
        currentProfile = profile;
    } else {
        currentProfile = snap.data();
    }
}

export function getCurrentUser() {
    return currentUser;
}

export function getCurrentProfile() {
    return currentProfile;
}

export async function login() {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
}

export async function logout() {
    await signOut(auth);
}
