import { 
  collection, doc, addDoc, setDoc, getDoc, getDocs, onSnapshot,
  query, where, orderBy, serverTimestamp, deleteDoc, updateDoc,
  increment, arrayUnion
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "./firebase";
import { STORAGE_LIMITS } from "./constants";

// --- SYSTEM PRESENCE ---
export async function setUserStatus(userId: string, isOnline: boolean) {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, { isOnline, lastSeen: serverTimestamp() });
}

export function setTypingStatus(conversationId: string, userId: string, isTyping: boolean) {
  const typingRef = doc(db, "conversations", conversationId, "typing", userId);
  if (isTyping) {
    return setDoc(typingRef, { isTyping, updatedAt: serverTimestamp() });
  } else {
    return deleteDoc(typingRef);
  }
}

export function listenTypingStatus(conversationId: string, callback: (typingIds: string[]) => void) {
  const q = collection(db, "conversations", conversationId, "typing");
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => doc.id));
  });
}

// --- STORAGE QUOTA ENFORCEMENT ---
async function checkStorageLimit(userId: string, incomingBytes: number) {
  const userSnap = await getDoc(doc(db, "users", userId));
  const userData = userSnap.data();
  if (!userData) return true;

  const usedBytes = userData.storageUsedBytes || 0;
  const isPremium = userData.isSubscribed || false;
  const limitGb = isPremium ? STORAGE_LIMITS.PREMIUM_GB : STORAGE_LIMITS.NORMAL_GB;
  const limitBytes = limitGb * 1024 * 1024 * 1024;

  if (usedBytes + incomingBytes > limitBytes) {
    throw new Error(`STORAGE_FULL: Limit is ${limitGb}GB.`);
  }
  return true;
}

// --- CONVERSATION MANAGEMENT ---

export async function createConversation(participants: string[], name?: string, isGroup: boolean = false) {
  if (!isGroup && participants.length === 2) {
    const q = query(
      collection(db, "conversations"),
      where("isGroup", "==", false),
      where("participants", "array-contains", participants[0])
    );

    const snapshot = await getDocs(q);
    const existing = snapshot.docs.find(doc => {
      const data = doc.data();
      return data.participants.includes(participants[1]);
    });

    if (existing) return { id: existing.id, ...existing.data() };
  }

  const convRef = await addDoc(collection(db, "conversations"), {
    participants,
    name: name || null,
    isGroup,
    createdAt: serverTimestamp(),
    encryption_protocol: 'X25519_AES_GCM',
    lastMessage: '',
    lastMessageAt: serverTimestamp(),
    adminId: isGroup ? participants[0] : null,
    unreadCounts: participants.reduce((acc, uid) => ({ ...acc, [uid]: 0 }), {})
  });

  return { id: convRef.id, participants };
}

export async function markAsRead(conversationId: string, userId: string) {
  await updateDoc(doc(db, "conversations", conversationId), {
    [`unreadCounts.${userId}`]: 0
  });
}

// --- SECURE DISPATCH ---
export async function uploadMedia(userId: string, uri: string, type: 'image' | 'file', onProgress?: (prog: number) => void) {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();

    await checkStorageLimit(userId, blob.size);

    const filename = `${Date.now()}_ghost_${Math.random().toString(36).substring(7)}`;
    const path = `media/${type}s/${filename}`;
    const storageRef = ref(storage, path);

    const uploadTask = uploadBytesResumable(storageRef, blob);

    return new Promise<{url: string, path: string, size: number}>((resolve, reject) => {
      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        },
        (error) => { reject(error); },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          await updateDoc(doc(db, "users", userId), {
            storageUsedBytes: increment(blob.size)
          });
          resolve({ url, path, size: blob.size });
        }
      );
    });
  } catch (error) {
    console.error("[GHOST-STORAGE-FAILURE]", error);
    throw error;
  }
}

export async function deleteMedia(userId: string, path: string, size: number) {
  try {
    await deleteObject(ref(storage, path));
    await updateDoc(doc(db, "users", userId), {
      storageUsedBytes: increment(-size)
    });
  } catch (e) {
    console.warn("Purge failed:", path);
  }
}

// --- MESSAGE MANAGEMENT ---
export async function sendMessage(conversationId: string, senderId: string, senderAlias: string, text: string, options: any = {}) {
  const messageData = {
    conversation_id: conversationId, sender_id: senderId, sender_alias: senderAlias,
    content: text, type: options.type || 'text', fileUrl: options.fileUrl || null,
    filePath: options.filePath || null, fileSize: options.fileSize || 0,
    created_at: serverTimestamp(),
    status: 'sent',
    hiddenFor: [],
    reactions: {},
    self_destruct_seconds: options.self_destruct_seconds || null
  };

  const msgRef = await addDoc(collection(db, "conversations", conversationId, "messages"), messageData);
  const updates: any = {
    lastMessage: options.type === 'image' ? '📷 Photo' : (options.type === 'file' ? '📁 File' : text),
    lastMessageAt: serverTimestamp(),
  };

  const convSnap = await getDoc(doc(db, "conversations", conversationId));
  const participants = convSnap.data()?.participants || [];

  participants.forEach((uid: string) => {
    if (uid !== senderId) updates[`unreadCounts.${uid}`] = increment(1);
  });

  await updateDoc(doc(db, "conversations", conversationId), updates);
  return { id: msgRef.id, ...messageData };
}

export async function deleteMessageForEveryone(conversationId: string, messageId: string) {
  const msgRef = doc(db, "conversations", conversationId, "messages", messageId);
  await deleteDoc(msgRef);
}

export async function deleteMessageForMe(conversationId: string, messageId: string, userId: string) {
  const msgRef = doc(db, "conversations", conversationId, "messages", messageId);
  await updateDoc(msgRef, {
    hiddenFor: arrayUnion(userId)
  });
}

export async function addReaction(conversationId: string, messageId: string, userId: string, emoji: string) {
  const msgRef = doc(db, "conversations", conversationId, "messages", messageId);
  await updateDoc(msgRef, {
    [`reactions.${userId}`]: emoji
  });
}

export function listenMessages(conversationId: string, callback: (messages: any[]) => void) {
  const q = query(collection(db, "conversations", conversationId, "messages"), orderBy("created_at", "asc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), created_at: doc.data().created_at?.toDate() || new Date() })));
  });
}
