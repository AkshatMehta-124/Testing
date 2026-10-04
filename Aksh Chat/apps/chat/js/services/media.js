import { storage } from "../firebase-config.js";
import { state } from "../state.js";
import { ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-storage.js";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf", 
    "text/plain", "text/csv", 
    "application/msword", 
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];

export async function uploadAttachment(chatId, file, onProgress) {
    if (!state.currentUser) throw new Error("Not authenticated");
    
    if (file.size > MAX_SIZE) {
        throw new Error("File exceeds 5MB limit");
    }
    
    // Check if it's an allowed type (rough check, storage rules will enforce securely)
    if (!ALLOWED_TYPES.includes(file.type) && !file.type.startsWith("image/") && !file.type.startsWith("text/")) {
        throw new Error("File type not supported");
    }
    
    const ext = file.name.split('.').pop();
    const safeName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`;
    const storageRef = ref(storage, `chat_attachments/${chatId}/${safeName}`);
    
    const uploadTask = uploadBytesResumable(storageRef, file);
    
    return new Promise((resolve, reject) => {
        uploadTask.on('state_changed', 
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                if (onProgress) onProgress(progress);
            }, 
            (error) => reject(error), 
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                resolve({
                    url: downloadURL,
                    name: file.name,
                    size: file.size,
                    type: file.type
                });
            }
        );
    });
}
