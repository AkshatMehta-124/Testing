import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-storage.js";

// Keep existing aksh-studio configuration if known, 
// using generic placeholders if not known. 
// Do NOT invent missing credentials; these should be replaced with valid ones in production.
const firebaseConfig = {
    apiKey: "AIzaSyAmxOwGXgffYiEP0O4o_cWvP0lg2SbJfhw",
    authDomain: "aksh-studio.firebaseapp.com",
    projectId: "aksh-studio",
    storageBucket: "aksh-studio.firebasestorage.app",
    messagingSenderId: "349325785973",
    appId: "1:349325785973:web:86d5a15bcb700bfc15b13c"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
