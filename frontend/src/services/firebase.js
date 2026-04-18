import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; 

const firebaseConfig = {
  apiKey: "AIzaSyAINveqFVzch_OEHY9u9UprIn-ehuxIhZ8",
  authDomain: "mediflow-ai-a1cc9.firebaseapp.com",
  projectId: "mediflow-ai-a1cc9",
  storageBucket: "mediflow-ai-a1cc9.firebasestorage.app",
  messagingSenderId: "126587419613",
  appId: "1:126587419613:web:e30c4aa3d0f7da15f65434",
  measurementId: "G-FKHJPKF8KP"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);