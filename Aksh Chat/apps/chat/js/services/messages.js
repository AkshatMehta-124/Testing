import { db } from "../firebase-config.js";
import { state } from "../state.js";
import { 
    collection, doc, query, orderBy, onSnapshot, 
    addDoc, updateDoc, serverTimestamp, 
    writeBatch 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const MAX_BATCH_SIZE = 400;

export function listenToMessages(chatId, callback) {
    if (!state.currentUser) return () => {};

    const q = query(
        collection(db, `chats/${chatId}/messages`),
        orderBy("createdAt", "asc")
    );

    return onSnapshot(q, (snapshot) => {
        const messages = [];
        snapshot.forEach(docSnap => {
            messages.push({ id: docSnap.id, ...docSnap.data() });
        });
        callback(messages);
    }, (error) => {
        console.error("Error listening to messages:", error);
    });
}

export async function sendMessage(chatId, text, type = "text", attachment = null, replyTo = null) {
    if (!state.currentUser) throw new Error("Not authenticated");

    const message = {
        senderId: state.currentUser.uid,
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
    if (!state.currentUser) return;

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
                attachment: null, // Clear attachment reference
                updatedAt: serverTimestamp()
            });
        }
        await batch.commit();
    }
}

export async function deleteForMe(chatId, messageIds) {
    if (!state.currentUser) return;

    const chunks = [];
    for (let i = 0; i < messageIds.length; i += MAX_BATCH_SIZE) {
        chunks.push(messageIds.slice(i, i + MAX_BATCH_SIZE));
    }

    for (const chunk of chunks) {
        const batch = writeBatch(db);
        for (const msgId of chunk) {
            const hiddenRef = doc(db, `users/${state.currentUser.uid}/hiddenMessages`, msgId);
            batch.set(hiddenRef, { hiddenAt: serverTimestamp(), chatId });
        }
        await batch.commit();
    }
}

export async function editMessage(chatId, messageId, newText) {
    if (!state.currentUser) return;
    const msgRef = doc(db, `chats/${chatId}/messages`, messageId);
    await updateDoc(msgRef, {
        text: newText,
        edited: true,
        updatedAt: serverTimestamp()
    });
}
