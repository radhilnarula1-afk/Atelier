import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDNEnzcOsu0FKgdt8OUz-9RzYMZ8XV8CmI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "atelier-2645c.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "atelier-2645c",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "atelier-2645c.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "996189344923",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:996189344923:web:8a4aab661a87ed861ba23e",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-0RFCJX7NNB"
};

// Initialize Firebase only if the config values are set to avoid crash, or fallback gracefully
const hasFirebaseConfig = !!firebaseConfig.apiKey;

let app;
let auth: any = null;
const googleProvider = new GoogleAuthProvider();

if (hasFirebaseConfig) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
  } catch (error) {
    console.error("Failed to initialize Firebase Auth client SDK:", error);
  }
} else {
  console.warn("Firebase client configuration variables (VITE_FIREBASE_API_KEY) are missing in frontend .env.local. Google Sign-In will not function until they are set.");
}

export { auth, googleProvider, hasFirebaseConfig };

export async function signInWithGooglePopup() {
  if (!hasFirebaseConfig || !auth) {
    throw new Error(
      "Firebase client configuration is missing. Please add VITE_FIREBASE_API_KEY and other configuration keys to your frontend/.env.local file."
    );
  }
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Firebase Google Sign-In Error:", error);
    throw error;
  }
}
