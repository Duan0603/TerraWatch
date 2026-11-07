import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Cấu hình web app của dự án Firebase hiện tại (terrawatch-ac26f) lấy từ biến môi trường VITE_FIREBASE_*
// (Firebase console > Project settings > Your apps > Web app). Thiếu cấu hình thì không khởi tạo:
// xác thực số điện thoại báo "chưa cấu hình" thay vì dùng nhầm dự án cũ.
const env = import.meta.env;
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
export const app = firebaseConfigured ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;

export default auth;
