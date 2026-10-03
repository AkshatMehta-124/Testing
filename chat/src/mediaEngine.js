import { db, collection, addDoc, doc, setDoc, Timestamp } from './firebase.js';
import { currentUser } from './auth.js';
import { encryptMessage } from './siteCipher.js';
import { updateReadReceipt } from './chatEngine.js';

export const initMediaEngine = () => {
    const mediaBtn = document.getElementById('btn-media-upload');
    const fileInput = document.getElementById('hidden-file-input');

    if (mediaBtn && fileInput && !fileInput.dataset.bound) {
        fileInput.dataset.bound = 'true';
        mediaBtn.addEventListener('click', () => fileInput.click()); 
        
        fileInput.addEventListener('change', (e) => {
            const operationRoomId = window.appState?.activeChatId;
            if (!operationRoomId) return;

            const file = e.target.files[0];
            if (!file) return;

            const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5 MB
            if (file.size > MAX_ATTACHMENT_SIZE) {
                alert("Attachment exceeds the 5 MB limit. Please select a smaller file.");
                fileInput.value = '';
                return;
            }

            const isImage = file.type.startsWith('image/');
            const isDoc = file.type === 'application/pdf' || file.type.startsWith('text/') || file.name.match(/\.(doc|docx|txt|pdf|csv)$/i);
            
            if (!isImage && !isDoc) {
                alert("Only Images, PDFs, and Text documents are supported.");
                fileInput.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = async (event) => {
                if (window.appState?.activeChatId !== operationRoomId) return;

                let fileData = event.target.result;
                const curId = currentUser?.id || currentUser?.uid;
                const isOwner = String(currentUser?.email || '').toLowerCase().trim() === 'akshat124.am12@gmail.com';
                
                const basePayload = {
                    senderId: curId, 
                    senderName: currentUser?.name || 'User', 
                    isOwner: isOwner,
                    timestamp: Date.now(), 
                    localTimestamp: Date.now(),
                    expireAt: Timestamp.fromMillis(Date.now() + 60 * 24 * 60 * 60 * 1000)
                };

                if (isImage) {
                    const img = new Image();
                    img.onload = async () => {
                        if (window.appState?.activeChatId !== operationRoomId) return;

                        const canvas = document.createElement('canvas');
                        const MAX_WIDTH = 800;
                        const scaleSize = MAX_WIDTH / img.width;
                        canvas.width = MAX_WIDTH;
                        canvas.height = img.height * scaleSize;
                        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                        
                        const payload = { 
                            ...basePayload, 
                            text: encryptMessage("📷 Image Attached"), 
                            fileUrl: encryptMessage(canvas.toDataURL('image/jpeg', 0.6)),
                            fileType: file.type, 
                            fileName: encryptMessage(file.name)
                        };

                        try { 
                            await addDoc(collection(db, `chats/${operationRoomId}/messages`), payload); 
                            if (window.appState?.activeChatId === operationRoomId) {
                                await updateReadReceipt(operationRoomId, curId);
                            }
                            await setDoc(doc(db, "chats", operationRoomId), { lastMessageTime: Date.now(), lastMessageSenderId: curId }, { merge: true });
                        } catch(error) { console.error(error); }
                    };
                    img.src = fileData;
                } else {
                    if (window.appState?.activeChatId !== operationRoomId) return;
                    try { 
                        await addDoc(collection(db, `chats/${operationRoomId}/messages`), { 
                            ...basePayload, 
                            text: encryptMessage(`📄 Document: ${file.name}`), 
                            fileUrl: encryptMessage(fileData), 
                            fileType: file.type, 
                            fileName: encryptMessage(file.name) 
                        }); 
                        if (window.appState?.activeChatId === operationRoomId) {
                            await updateReadReceipt(operationRoomId, curId);
                        }
                        await setDoc(doc(db, "chats", operationRoomId), { lastMessageTime: Date.now(), lastMessageSenderId: curId }, { merge: true });
                    } catch(error) { console.error(error); }
                }
                
                // Clear the input after processing
                fileInput.value = '';
            };
            reader.readAsDataURL(file); 
        });
    }
};
