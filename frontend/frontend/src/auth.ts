import { signInAnonymously } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

export async function registerAnonymous(alias: string) {
  const userCredential = await signInAnonymously(auth);
  const user = userCredential.user;

  await setDoc(doc(db, "users", user.uid), {
    alias: alias || "Ghost",
    createdAt: new Date(),
    isOnline: true,
  });

  return user;
}
