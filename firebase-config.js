// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAAYJMpeVZ9z5XY6nm8m6kA1kVmCn-3x3I",
  authDomain: "pomocashodoro.firebaseapp.com",
  projectId: "pomocashodoro",
  storageBucket: "pomocashodoro.firebasestorage.app",
  messagingSenderId: "457045972057",
  appId: "1:457045972057:web:2da9c101f9ac4a2f978d48",
  measurementId: "G-J638W7V6KT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);