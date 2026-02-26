// frontend/api.js

import { auth, db } from "./firebaseConfig";
import {
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "firebase/auth";
import {
  collection,
  addDoc,
  query,
  onSnapshot,
  orderBy,
  doc,
  getDoc
} from "firebase/firestore";

// Anonymous registration
export async function registerAnonymous() {
  const userCredential = await signInAnonymously(auth);
  return userCredential.user.uid;
}

// Register with email/password
export async function registerUser(email, password) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  return userCredential.user.uid;
}

// Login with email/password
export async function loginUser(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user.uid;
}

// Get user profile
export async function getUserProfile(userId) {
  const userDoc = await getDoc(doc(db, "users", userId));
  return userDoc.exists() ? userDoc.data() : null;
}

// Send a message
export async function sendMessage(chatId, text, userId) {
  await addDoc(collection(db, "chats", chatId, "messages"), {
    text,
    userId,
    timestamp: new Date()
  });
}

// Subscribe to messages
export function subscribeMessages(chatId, callback) {
  const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp"));
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(messages);
  });
}
