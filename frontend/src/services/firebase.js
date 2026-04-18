import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; 

const firebaseConfig = {
  apiKey: "AIzaSyCoPYOPndh385rHVAPwWFypVTDCbERsfGQ",
  authDomain: "mediflow-ai-v2.firebaseapp.com",
  projectId: "mediflow-ai-v2",
  storageBucket: "mediflow-ai-v2.firebasestorage.app",
  messagingSenderId: "291284082681",
  appId: "1:291284082681:web:ff73730a80b2fc981ae728",
  measurementId: "G-PHQMTF65RS"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);