import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDDXonp9zwGl28AgUZ2-FFq1et6nJoI2xg",
  authDomain: "meter-readings-app.firebaseapp.com",
  projectId: "meter-readings-app",
  storageBucket: "meter-readings-app.firebasestorage.app",
  messagingSenderId: "84436825138",
  appId: "1:84436825138:web:c9fe9d32ec91a04ffbf82b",
  measurementId: "G-37T39Y61Z0",
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
