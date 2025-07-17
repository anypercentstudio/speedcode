// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAMjctl5Bbz-6is99bsy0RIWbOr9u02yGo",
  authDomain: "speedcode-sv.firebaseapp.com",
  projectId: "speedcode-sv",
  storageBucket: "speedcode-sv.appspot.com",
  messagingSenderId: "562219924157",
  appId: "1:562219924157:web:79bdda577672142a2fd5d4",
  measurementId: "G-YK804CRGQ8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth, signInAnonymously, onAuthStateChanged };