import { db } from "../firebase-config.js";
import { state } from "../state.js";
import { 
    collection, doc, query, where, orderBy, onSnapshot, 
    addDoc, updateDoc, serverTimestamp, getDoc 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

export function listenToChats(callback) {
    if (!state.currentUser) return () => {};

    const q = query(
        collection(db, "chats"),
        where("participants", "array-contains", state.currentUser.uid),
        orderBy("updatedAt", "desc")
    );

    return onSnapshot(q, (snapshot) => {
        const chats = [];
        snapshot.forEach(docSnap => {
            chats.push({ id: docSnap.id, ...docSnap.data() });
        });
        callback(chats);
    }, (error) => {
        console.error("Error listening to chats:", error);
    });
}

export async function createDirectMessage(otherUserId) {
    if (!state.currentUser) throw new Error("Not signed in");
    
    const uid1 = state.currentUser.uid;
    const uid2 = otherUserId;
    
    // Check if DM already exists
    // Simple way: query where participants contains uid1, then filter in memory for length 2 and contains uid2
    const q = query(
        collection(db, "chats"),
        where("participants", "array-contains", uid1),
        where("type", "==", "dm")
    );
    
    // Actually, Firestore doesn't easily let us query array exact match without extra fields, 
    // but we can fetch and filter locally since one user won't have millions of DMs.
    // However, it's better if we have an API for this or consistent ID like `dm_${uid1}_${uid2}` sorted.
    const sortedIds = [uid1, uid2].sort();
    const dmId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
    
    const chatRef = doc(db, "chats", dmId);
    const snap = await getDoc(chatRef);
    
    if (!snap.exists()) {
        const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js");
        await setDoc(chatRef, {
            type: "dm",
            participants: [uid1, uid2],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastMessage: "",
            lastMessageTime: serverTimestamp()
        });
    }
    return dmId;
}

export async function createGroup(name, participants) {
    if (!state.currentUser) throw new Error("Not signed in");
    const nameTrimmed = name.trim();
    if (!nameTrimmed) throw new Error("Group name required");
    
    const allParticipants = Array.from(new Set([...participants, state.currentUser.uid]));
    
    const groupData = {
        type: "group",
        name: nameTrimmed.substring(0, 50),
        participants: allParticipants,
        admins: [state.currentUser.uid],
        ownerId: state.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: "Group created",
        lastMessageTime: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, "chats"), groupData);
    return docRef.id;
}

export async function clearChat(chatId) {
    if (!state.currentUser) return;
    // We store a clearTimestamp in users/{uid}/chatMeta/{chatId}
    const metaRef = doc(db, `users/${state.currentUser.uid}/chatMeta`, chatId);
    await updateDoc(metaRef, {
        clearTimestamp: serverTimestamp()
    });
}

export async function updateReadReceipt(chatId) {
    if (!state.currentUser) return;
    const ref = doc(db, "chats", chatId);
    // Update the readReceipts map dynamically using dot notation
    const fieldPath = `readReceipts.${state.currentUser.uid}`;
    await updateDoc(ref, {
        [fieldPath]: serverTimestamp()
    });
}

export function listenToChatMeta(callback) {
    if (!state.currentUser) return () => {};
    const q = query(collection(db, `users/${state.currentUser.uid}/chatMeta`));
    return onSnapshot(q, (snapshot) => {
        const meta = {};
        snapshot.forEach(docSnap => {
            meta[docSnap.id] = docSnap.data();
        });
        callback(meta);
    });
}
