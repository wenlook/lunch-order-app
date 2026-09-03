// ---------------------------------------------------------------
// PASTE YOUR FIREBASE CONFIG HERE
// ---------------------------------------------------------------
// Get this from: Firebase console → ⚙️ Project settings → scroll
// to "Your apps" → click the web app → "SDK setup and configuration"
//
// It's safe for this to be visible in your deployed site's code —
// these are public frontend identifiers, not secret keys. Real
// protection comes from the Firestore security rules
// (see firestore.rules in this project).
// ---------------------------------------------------------------

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAq1RZoBahUbXTIHgljq_Nnjrv95gTV4qU",
  authDomain: "lunch-order-2b920.firebaseapp.com",
  projectId: "lunch-order-2b920",
  storageBucket: "lunch-order-2b920.firebasestorage.app",
  messagingSenderId: "29845937620",
  appId: "1:29845937620:web:86ff3d21ebe71f6cdc0a41"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
