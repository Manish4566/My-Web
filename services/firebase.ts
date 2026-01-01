
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBMjikuIOSBcjPKqMDqwWAEiSh-fBRHlL0",
  authDomain: "prompt-forge-439ea.firebaseapp.com",
  projectId: "prompt-forge-439ea",
  storageBucket: "prompt-forge-439ea.firebasestorage.app",
  messagingSenderId: "547951630512",
  appId: "1:547951630512:web:b799876899e97aaa398375",
  measurementId: "G-XHC527FTG9",
  databaseURL: "https://prompt-forge-439ea-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const rtdb = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();
