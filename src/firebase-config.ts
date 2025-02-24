import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  getToken,
  AppCheck,
} from "firebase/app-check";

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env
    .VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services first
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);
const functions = getFunctions(app);

// Initialize App Check with debug token in development
if (process.env.NODE_ENV === "development") {
  console.log("Initializing App Check debug token");
  (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

// Initialize App Check after services
const appCheck: AppCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(
    import.meta.env.VITE_RECAPTCHA_SITE_KEY as string
  ),
  isTokenAutoRefreshEnabled: true,
});

// Initialize App Check token immediately and export a promise
const appCheckInitialized: Promise<boolean> = getToken(
  appCheck,
  /* forceRefresh */ true
)
  .then(() => {
    console.log("Initial App Check token acquired");
    return true;
  })
  .catch((error) => {
    console.error("Error getting initial App Check token:", error);
    return false;
  });

// Export everything
export { db, storage, auth, functions, appCheck, appCheckInitialized };
