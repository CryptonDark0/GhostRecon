// src/api.js
import { auth, db } from "../firebaseConfig";
import {
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

// Example wrapper functions
export async function apiCall() {
  return "Firebase SDK connected ✅";
}

export async function setUser(uid, email) {
  await setDoc(doc(db, "users", uid), {
    email,
    createdAt: new Date()
  });
}

export async function setToken(token) {
  // If you need token storage, you can save it in AsyncStorage or SecureStore
  return token;
}
