import { 
  collection, 
  doc, 
  addDoc, 
  setDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy 
} from "firebase/firestore";
import { db } from "./firebase";

export async function createConversation(participants: string[]) {
  const ref = await addDoc(collection(db, "conversations"), {
    participants,
    createdAt: new Date(),
  });
  return ref.id;
}

export async function sendMessage(conversationId: string, senderId: string, text: string) {
  await addDoc(collection(db, "conversations", conversationId, "messages"), {
    senderId,
    text,
    createdAt: new Date(),
  });
}

export function listenMessages(conversationId: string, callback: any) {
  const q = query(
    collection(db, "conversations", conversationId, "messages"),
    orderBy("createdAt")
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(messages);
  });
}

export async function getUserConversations(userId: string) {
  const q = query(
    collection(db, "conversations"),
    where("participants", "array-contains", userId)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}
