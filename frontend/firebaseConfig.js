// frontend/firebaseConfig.js

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD7GwolkRw6yIiEr2IBt8ahzSUqpoYG9JA",
  authDomain: "ghostrecon-9c294.firebaseapp.com",
  projectId: "ghostrecon-9c294",
  storageBucket: "ghostrecon-9c294.appspot.com",   // corrected
  messagingSenderId: "325419022469",
  appId: "1:325419022469:web:8c1de9b1c46be85d6811ec",
  measurementId: "G-4QWD6GYQKQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const auth = getAuth(app);
export const db = getFirestore(app);
