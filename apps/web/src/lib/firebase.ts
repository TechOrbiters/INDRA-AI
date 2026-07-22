import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCymLgxQbHw5M2DAcdFJcMDdCYfIxaHtqs",
  authDomain: "indra-ai-13ede.firebaseapp.com",
  databaseURL: "https://indra-ai-13ede-default-rtdb.firebaseio.com",
  projectId: "indra-ai-13ede",
  storageBucket: "indra-ai-13ede.firebasestorage.app",
  messagingSenderId: "921694799713",
  appId: "1:921694799713:web:841d1751f48bbde9abe720",
  measurementId: "G-QGHJGXK8BX"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Analytics is only supported in browser environments
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
