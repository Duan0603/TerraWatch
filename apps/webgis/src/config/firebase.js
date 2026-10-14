import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyALDwmbV7q5o4VQaej-7yxgAgChvr5xQcs",
  authDomain: "terrawatch-defense.firebaseapp.com",
  projectId: "terrawatch-defense",
  storageBucket: "terrawatch-defense.firebasestorage.app",
  messagingSenderId: "484674000797",
  appId: "1:484674000797:web:2074a82d82447af6e60174",
  measurementId: "G-ZY5KVM3HDF"
};

// Khởi tạo ứng dụng Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export default auth;
