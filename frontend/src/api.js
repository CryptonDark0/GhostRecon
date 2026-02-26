// src/api.js
import { auth, db } from "../firebaseConfig";
import {
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

// Simple API call test
export async function apiCall() {
  return "Firebase SDK connected ✅";
}

// Register anonymous user
export async function registerAnonymous() {
  const userCredential = await signInAnonymously(auth);
  return userCredential.user.uid;
}

// Register with email/password
export async function registerUser(email, password) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  await setUser(userCredential.user.uid, email);
  return userCredential.user.uid;
}

// Login with email/password
export async function loginUser(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user.uid;
}

// Save user profile
export async function setUser(uid, email) {
  await setDoc(doc(db, "users", uid), {
    email,
    createdAt: new Date()
  });
}

// Get user profile
export async function getUser(uid) {
  const userDoc = await getDoc(doc(db, "users", uid));
  return userDoc.exists() ? userDoc.data() : null;
}

// Token storage (optional, e.g. AsyncStorage)
export async function setToken(token) {
  return token;
}
