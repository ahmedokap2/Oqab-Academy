import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut,sendPasswordResetEmail,EmailAuthProvider,reauthenticateWithCredential,updatePassword,setPersistence,inMemoryPersistence,browserLocalPersistence} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {getFirestore,doc,getDoc,getDocs,setDoc,updateDoc,collection,query,where,orderBy,limit,serverTimestamp,onSnapshot} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js';
import {firebaseConfig,teacherUid} from './firebase-config.js';
import { clean, validId } from './utils.js';

const teacherPage=/\/admin(?:\.html)?\/?$/.test(location.pathname);
const app=initializeApp(firebaseConfig,teacherPage?'oqab-admin':'oqab-student');
const auth=getAuth(app),db=getFirestore(app),functions=getFunctions(app,'europe-west1');
const ready=setPersistence(auth,teacherPage?inMemoryPersistence:browserLocalPersistence).then(()=>new Promise(resolve=>{const stop=onAuthStateChanged(auth,u=>{stop();resolve(u);});}));
const studentEmail=id=>id.toLowerCase()+'@students.oqab-academy.invalid';
const call=(name,data={})=>httpsCallable(functions,name)(data).then(r=>r.data);
