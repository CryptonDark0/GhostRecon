import { auth, db } from "../firebaseConfig";
import {
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  query,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

// --------------------
// Generic API call wrapper
// --------------------
export async function apiCall(endpoint, options = {}) {
  const baseUrl = "https://your-backend-api.com"; // replace with your API base
  const res = await fetch(`${baseUrl}${endpoint}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "API call failed");
  }
  return res.json();
}

// --------------------
// Authentication helpers
// --------------------
export async function registerAnonymous() {
  const userCredential = await signInAnonymously(auth);
  return userCredential.user.uid;
}

export async function registerUser(email, password) {
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );
  await setUser(userCredential.user);
  return userCredential.user.uid;
}

export async function loginUser(email, password) {
  const userCredential = await signInWithEmailAndPassword(
    auth,
    email,
    password
  );
  return userCredential.user.uid;
}

// --------------------
// User profile handling
// --------------------
export async function setUser(user) {
  await setDoc(doc(db, "users", user.uid), {
    email: user.email,
    createdAt: new Date(),
  });
}

export async function getUser(uid) {
  const userDoc = await getDoc(doc(db, "users", uid));
  return userDoc.exists() ? userDoc.data() : null;
}

// --------------------
// Chat/message handling
// --------------------
export async function sendMessage(chatId, text, userId) {
  await addDoc(collection(db, "chats", chatId, "messages"), {
    text,
    userId,
    timestamp: new Date(),
  });
}

export function subscribeMessages(chatId, callback) {
  const q = query(
    collection(db, "chats", chatId, "messages"),
    orderBy("timestamp")
  );
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(messages);
  });
}

// --------------------
// Token persistence
// --------------------
export async function setToken(token) {
  await AsyncStorage.setItem("authToken", token);
  return token;
}

export async function getToken() {
  return await AsyncStorage.getItem("authToken");
}
