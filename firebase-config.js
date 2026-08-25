// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAAYJMpeVZ9z5XY6nm8m6kA1kVmCn-3x3I",
  authDomain: "pomocashodoro.firebaseapp.com",
  projectId: "pomocashodoro",
  storageBucket: "pomocashodoro.firebasestorage.app",
  messagingSenderId: "457045972057",
  appId: "1:457045972057:web:2da9c101f9ac4a2f978d48",
  measurementId: "G-J638W7V6KT"
};

// Initialize Firebase (Compat mode)
firebase.initializeApp(firebaseConfig);

// Expose auth and db globally for app.js
const auth = firebase.auth();
const db = firebase.firestore();
