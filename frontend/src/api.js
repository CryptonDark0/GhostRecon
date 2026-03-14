// frontend/src/api.js
import { auth, db } from "./firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { deleteUser, signOut } from "firebase/auth";

const PROFILE_CACHE_KEY = 'ghostrecon_user_profile';

/**
 * TOKEN MANAGEMENT
 */
export async function setToken(token) {
  try {
    await AsyncStorage.setItem("ghost_recon_token", token);
    return token;
  } catch (e) {
    console.error("Token save failed:", e);
    return null;
  }
}

export async function getToken() {
  try {
    return await AsyncStorage.getItem("ghost_recon_token");
  } catch (e) {
    return null;
  }
}

export async function clearToken() {
  try {
    await AsyncStorage.removeItem("ghost_recon_token");
    await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
  } catch (e) {}
}

/**
 * IDENTITY DESTRUCTION (WIPE)
 * Permanently deletes user from Auth and Firestore, releasing the codename.
 */
export async function destroyIdentity() {
  const user = auth.currentUser;
  if (!user) throw new Error("No active session found.");

  const uid = user.uid; // ⚡ CRITICAL: Capture UID before Auth deletion

  try {
    console.log("[GHOST-WIPE] Initiating identity termination for UID:", uid);

    // 1. Delete Firebase Auth User FIRST
    await deleteUser(user);
    console.log("[GHOST-WIPE] Auth identity terminated.");

    // 2. Delete Firestore Profile (This releases the alias for others)
    const userDocRef = doc(db, "users", uid);
    await deleteDoc(userDocRef);
    console.log("[GHOST-WIPE] Firestore document erased. Alias released.");

    // 3. Clear local storage
    await clearToken();

    return true;
  } catch (e) {
    console.error("[GHOST-WIPE] Purge failed:", e);

    if (e.code === 'auth/requires-recent-login') {
      await signOut(auth);
      await clearToken();
      throw new Error("SENSITIVE ACTION: Security token expired. Sign out and sign back in to authorize destruction.");
    }

    throw new Error(`Protocol Error: ${e.message}`);
  }
}

/**
 * USER PROFILE HELPERS
 */
export async function getUser(uid) {
  if (!uid && auth.currentUser) uid = auth.currentUser.uid;
  if (!uid) return null;

  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    return userDoc.exists() ? userDoc.data() : null;
  } catch (e) {
    console.error("Profile fetch failed:", e);
    return null;
  }
}

export async function apiCall(endpoint) {
  console.log(`[Firebase Link] Bypass legacy API for: ${endpoint}`);
  return { success: true };
}

export async function setUser(uid, data) {
  try {
    await setDoc(doc(db, "users", uid), data, { merge: true });
  } catch (e) {}
}
