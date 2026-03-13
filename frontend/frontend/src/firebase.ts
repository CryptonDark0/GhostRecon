import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: "AIzaSyD7GwolkRw6yIiEr2IBt8ahzSUqpoYG9JA",
  authDomain: "ghostrecon-9c294.firebaseapp.com",
  projectId: "ghostrecon-9c294",
  storageBucket: "ghostrecon-9c294.appspot.com",
  messagingSenderId: "325419022469",
  appId: "1:325419022469:web:8c1de9b1c46be85d6811ec",
  measurementId: "G-4QWD6GYQKQ"
};

// Initialize Firebase App safely
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with persistence correctly for both mobile and web
let auth;
if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage)
    });
  } catch (e) {
    auth = getAuth(app);
  }
}

const db = getFirestore(app);

export { auth, db, app };
