import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  getToken,
} from "firebase/app-check";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
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
  window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

// Initialize App Check after services
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(
    import.meta.env.VITE_RECAPTCHA_SITE_KEY
  ),
  isTokenAutoRefreshEnabled: true,
  silentMode: true,
});

// Initialize App Check token immediately and export a promise
const appCheckInitialized = getToken(appCheck, /* forceRefresh */ true)
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
