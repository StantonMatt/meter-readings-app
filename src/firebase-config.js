import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDDXonp9zwGl28AgUZ2-FFq1et6nJoI2xg",
  authDomain: "meter-readings-app.firebaseapp.com",
  projectId: "meter-readings-app",
  storageBucket: "meter-readings-app.appspot.com",
  messagingSenderId: "84436825138",
  appId: "1:84436825138:web:c9fe9d32ec91a04ffbf82b",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { db, storage, auth };
