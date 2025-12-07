import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAgPyZtroqjbYzapY_Co1gDefV2rDCL2no",
  authDomain: "maker3d-rootiy.firebaseapp.com",
  projectId: "maker3d-rootiy",
  storageBucket: "maker3d-rootiy.firebasestorage.app",
  messagingSenderId: "357662818384",
  appId: "1:357662818384:web:5b8e7db4ffd96f8df41155",
  measurementId: "G-TEGGF39W0D"
};
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;





