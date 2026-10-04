import { db } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";
import { 
    collection, doc, query, where, orderBy, onSnapshot, 
    addDoc, updateDoc, serverTimestamp, getDocs, getDoc,
    writeBatch, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const MAX_BATCH_SIZE = 400;

export function listenToChats(callback) {
    const user = getCurrentUser();
    if (!user) return () => {};

    const q = query(
        collection(db, "chats"),
        where("participants", "array-contains", user.uid),
        orderBy("updatedAt", "desc")
    );

    return onSnapshot(q, (snapshot) => {
        const chats = [];
        snapshot.forEach(doc => {
            chats.push({ id: doc.id, ...doc.data() });
        });
        callback(chats);
    }, (error) => {
        console.error("Error listening to chats:", error);
    });
}

export function listenToMessages(chatId, callback) {
    const user = getCurrentUser();
    if (!user) return () => {};

    const q = query(
        collection(db, `chats/${chatId}/messages`),
        orderBy("createdAt", "asc")
    );

    return onSnapshot(q, (snapshot) => {
        const messages = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // Filter delete-for-me conceptually (handled here or via separate query, 
            // but for simple structure we can fetch hidden messages separately or assume client filtering)
            messages.push({ id: doc.id, ...data });
        });
        callback(messages);
    }, (error) => {
        console.error("Error listening to messages:", error);
    });
}

export async function sendMessage(chatId, text, type = "text", attachment = null, replyTo = null) {
    const user = getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    const message = {
        senderId: user.uid,
        type,
        text,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedForEveryone: false
    };

    if (attachment) message.attachment = attachment;
    if (replyTo) message.replyTo = replyTo;

    const msgRef = await addDoc(collection(db, `chats/${chatId}/messages`), message);
    
    // Update chat metadata
    await updateDoc(doc(db, "chats", chatId), {
        lastMessage: text || (attachment ? "Attachment" : ""),
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    return msgRef.id;
}

export async function deleteForEveryone(chatId, messageIds) {
    const user = getCurrentUser();
    if (!user) return;

    // chunk arrays if > MAX_BATCH_SIZE
    const chunks = [];
    for (let i = 0; i < messageIds.length; i += MAX_BATCH_SIZE) {
        chunks.push(messageIds.slice(i, i + MAX_BATCH_SIZE));
    }

    for (const chunk of chunks) {
        const batch = writeBatch(db);
        for (const msgId of chunk) {
            const msgRef = doc(db, `chats/${chatId}/messages`, msgId);
            batch.update(msgRef, {
                deletedForEveryone: true,
                text: "This message was deleted",
                updatedAt: serverTimestamp()
            });
        }
        await batch.commit();
    }
}

export async function deleteForMe(chatId, messageIds) {
    const user = getCurrentUser();
    if (!user) return;

    const chunks = [];
    for (let i = 0; i < messageIds.length; i += MAX_BATCH_SIZE) {
        chunks.push(messageIds.slice(i, i + MAX_BATCH_SIZE));
    }

    for (const chunk of chunks) {
        const batch = writeBatch(db);
        for (const msgId of chunk) {
            const hiddenRef = doc(db, `users/${user.uid}/hiddenMessages`, msgId);
            batch.set(hiddenRef, { hiddenAt: serverTimestamp(), chatId });
        }
        await batch.commit();
    }
}

export function listenToHiddenMessages(callback) {
    const user = getCurrentUser();
    if (!user) return () => {};

    const q = query(collection(db, `users/${user.uid}/hiddenMessages`));
    return onSnapshot(q, (snapshot) => {
        const hidden = new Set();
        snapshot.forEach(doc => hidden.add(doc.id));
        callback(hidden);
    });
}
