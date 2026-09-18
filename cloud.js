import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut,sendPasswordResetEmail,EmailAuthProvider,reauthenticateWithCredential,updatePassword,setPersistence,inMemoryPersistence,browserLocalPersistence} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {getFirestore,doc,getDoc,getDocs,setDoc,updateDoc,collection,query,where,orderBy,limit,serverTimestamp,onSnapshot} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js';
import {firebaseConfig,teacherUid} from './firebase-config.js';

const teacherPage=/\/admin(?:\.html)?\/?$/.test(location.pathname);
const app=initializeApp(firebaseConfig,teacherPage?'oqab-admin':'oqab-student');
const auth=getAuth(app),db=getFirestore(app),functions=getFunctions(app,'europe-west1');
const ready=setPersistence(auth,teacherPage?inMemoryPersistence:browserLocalPersistence).then(()=>new Promise(resolve=>{const stop=onAuthStateChanged(auth,u=>{stop();resolve(u);});}));
const clean=s=>String(s||'').trim().replace(/\s+/g,' '),validId=s=>/^S\d{6}$/.test(String(s||'').trim().toUpperCase());
const studentEmail=id=>id.toLowerCase()+'@students.oqab-academy.invalid';
const call=(name,data={})=>httpsCallable(functions,name)(data).then(r=>r.data);

export async function recordPublicVisit(){
  let id=sessionStorage.getItem('oqab_visit_session');if(!id){id=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');sessionStorage.setItem('oqab_visit_session',id);}
  try{return await call('recordVisit',{sessionId:id});}catch{return getPublicMetrics();}
}
export async function getPublicMetrics(){const s=await getDoc(doc(db,'publicMetrics','global'));return s.exists()?s.data():{totalVisits:0,uniqueVisitors:0};}
export function watchPublicMetrics(callback){return onSnapshot(doc(db,'publicMetrics','global'),s=>callback(s.exists()?s.data():{totalVisits:0,uniqueVisitors:0}),()=>callback({totalVisits:'—',uniqueVisitors:'—'}));}
export async function getSiteSettings(){const s=await getDoc(doc(db,'settings','site'));return s.exists()?s.data():{accessMode:'restricted',siteName:'Oqab Academy'};}
export async function getActiveClasses(){const s=await getDocs(query(collection(db,'classes'),where('active','==',true)));return s.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>(a.name||a.id).localeCompare(b.name||b.id));}

export async function studentLogin({login,password,firstName,lastName}){
  await ready;const identifier=clean(login),id=identifier.toUpperCase(),email=identifier.includes('@')?identifier.toLowerCase():studentEmail(id);if(!identifier.includes('@')&&!validId(id))throw new Error('Enter a valid student ID such as S190256, or your registered email.');if(!password)throw new Error('Enter your password.');
  const credential=await signInWithEmailAndPassword(auth,email,password);await credential.user.getIdToken(true);
  const profile=await call('initializeStudentProfile',{firstName:clean(firstName),lastName:clean(lastName)});
  if(!identifier.includes('@')&&profile.studentId!==id){await signOut(auth);throw new Error('This account does not match that student ID.');}return {...profile,uid:credential.user.uid};
}
export async function changeStudentPassword(currentPassword,newPassword){await ready;const user=auth.currentUser;if(!user)throw new Error('Sign in again first.');await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,currentPassword));await call('changeOwnPassword',{newPassword});await user.getIdToken(true);return true;}
export async function sendStudentPasswordReset(email){const value=clean(email).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw new Error('Enter the accessible email registered with the account. Students without email should ask the teacher for a temporary reset password.');try{await sendPasswordResetEmail(auth,value);}catch(error){if(error?.code!=='auth/user-not-found')throw error;}return true;}
export async function restoreStudentProgress(){await ready;if(!auth.currentUser)return null;const s=await getDoc(doc(db,'practiceProgress',auth.currentUser.uid));return s.exists()?s.data():null;}
export async function restoreStudentSession(){await ready;if(!auth.currentUser||auth.currentUser.isAnonymous)return null;await auth.currentUser.getIdToken(true);const token=await auth.currentUser.getIdTokenResult();if(token.claims.role!=='student')return null;const s=await getDoc(doc(db,'students',auth.currentUser.uid));if(!s.exists()||!s.data().active)return null;return {...s.data(),uid:auth.currentUser.uid,...(await restoreStudentProgress()||{})};}
export async function syncStudentProgress(profile,result=null){
  await ready;if(!auth.currentUser||!profile?.studentId)return;const uid=auth.currentUser.uid,mastered=Object.values(profile.progress||{}).filter(p=>p?.streak>=3&&new Set((p.recent||[]).map(r=>r.skill)).size>=2).length;
  await setDoc(doc(db,'practiceProgress',uid),{uid,studentId:profile.studentId,classId:profile.classId,firstName:clean(profile.firstName).slice(0,40),lastName:clean(profile.lastName).slice(0,40),xp:Math.max(0,Math.trunc(Number(profile.xp)||0)),gamesCompleted:Math.max(0,Math.trunc(Number(profile.gamesCompleted)||0)),masteredWords:mastered,currentUnit:Math.min(15,Math.max(1,Math.trunc(Number(profile.unit)||1))),progress:profile.progress||{},updatedAt:serverTimestamp()},{merge:true});
  if(result)await setDoc(doc(db,'practiceActivityRecords',uid+'_'+result.id),{uid,studentId:profile.studentId,classId:profile.classId,label:clean(result.label).slice(0,80),kind:clean(result.kind).slice(0,30),unit:Math.min(15,Math.max(1,Math.trunc(Number(result.unit)||1))),score:clean(result.score).slice(0,30),correct:Math.max(0,Math.trunc(Number(result.correct)||0)),total:Math.min(300,Math.max(0,Math.trunc(Number(result.total)||0))),xp:Math.min(100000,Math.max(0,Math.trunc(Number(result.xp)||0))),trusted:false,completedAt:serverTimestamp()});
}
export async function studentLogout(){await ready;return signOut(auth);}
async function requireTeacher(){await ready;if(auth.currentUser?.uid!==teacherUid)throw new Error('Teacher access is required.');return auth.currentUser;}
export async function teacherLogin(email,password){await ready;const c=await signInWithEmailAndPassword(auth,clean(email),password);if(c.user.uid!==teacherUid){await signOut(auth);throw new Error('This account is not the approved teacher account.');}return c.user;}
export async function teacherLogout(){await ready;return signOut(auth);}
export async function resetTeacherPassword(email){return sendPasswordResetEmail(auth,clean(email));}
export async function changeTeacherPassword(currentPassword,newPassword){const user=await requireTeacher();await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,currentPassword));return updatePassword(user,newPassword);}
export async function getTeacher(){await ready;return auth.currentUser?.uid===teacherUid?auth.currentUser:null;}
export function watchTeacher(callback){let stop=()=>{};ready.then(()=>{stop=onAuthStateChanged(auth,u=>callback(u?.uid===teacherUid?u:null));});return()=>stop();}
export async function adminSnapshot(){await requireTeacher();const [settings,metrics,classes,students,progress,activities]=await Promise.all([getSiteSettings(),getPublicMetrics(),getDocs(collection(db,'classes')),getDocs(collection(db,'students')),getDocs(collection(db,'practiceProgress')),getDocs(query(collection(db,'practiceActivityRecords'),orderBy('completedAt','desc'),limit(300)))]);return {settings,metrics,classes:classes.docs.map(d=>({id:d.id,...d.data()})),students:students.docs.map(d=>({id:d.id,...d.data()})),stats:progress.docs.map(d=>({id:d.id,...d.data()})),activities:activities.docs.map(d=>({id:d.id,...d.data()}))};}
export async function setAccessMode(accessMode){await requireTeacher();if(!['public','restricted'].includes(accessMode))throw new Error('Invalid access mode.');return setDoc(doc(db,'settings','site'),{accessMode,updatedAt:serverTimestamp()},{merge:true});}
export async function saveClass(id,name,active=true){await requireTeacher();const cid=clean(id).toUpperCase();if(!/^[A-Z0-9_-]{1,16}$/.test(cid))throw new Error('Use letters and numbers for the class code.');return setDoc(doc(db,'classes',cid),{name:clean(name).slice(0,40)||cid,active:!!active,updatedAt:serverTimestamp()},{merge:true});}
export async function setClassActive(id,active){await requireTeacher();return updateDoc(doc(db,'classes',id),{active:!!active,updatedAt:serverTimestamp()});}
export async function addStudents(classId,entries){await requireTeacher();const accounts=[];for(const raw of entries){const line=clean(raw);if(!line)continue;if(line.includes(',')){const [studentId,email]=line.split(',',2);accounts.push({studentId:clean(studentId).toUpperCase(),email:clean(email).toLowerCase()});}else for(const studentId of line.split(/\s+/))accounts.push({studentId:studentId.toUpperCase(),email:''});}const invalid=accounts.filter(x=>!validId(x.studentId)).map(x=>x.studentId);if(invalid.length)throw new Error('Invalid IDs: '+invalid.join(', '));return call('provisionStudents',{classId,accounts});}
export async function setStudentActive(id,active){await requireTeacher();return call('setStudentActiveSecure',{studentId:id,active});}
export async function resetStudentPassword(id){await requireTeacher();return call('resetStudentPassword',{studentId:id});}
export {auth,db};
