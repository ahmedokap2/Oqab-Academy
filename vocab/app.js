// Shared state and persistence. All learning data stays in this browser.
'use strict';

import { $, escapeHTML, clone, number } from '../utils.js';
import { CAMBRIDGE_MEDIA_ROOT, CAMBRIDGE_IRREGULAR_AUDIO_PATHS } from './audioData.js';

function cambridgeAudioPath(word){
  const key=String(word||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]/g,'');
  if(!key)return '';
  const firstThree=(key+'___').slice(0,3),firstFive=(key+'_____').slice(0,5);
  return `us_pron/${key[0]}/${firstThree}/${firstFive}/${key}.mp3`;
}
function cambridgeAudioUrl(word,path){return CAMBRIDGE_MEDIA_ROOT+(CAMBRIDGE_IRREGULAR_AUDIO_PATHS[word]||path||cambridgeAudioPath(word));}
const shuffleArray = array => { for(let i=array.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[array[i],array[j]]=[array[j],array[i]];}return array; };
const practiceData = new Map(practiceRows.map(r=>[r[0],{contexts:r[1],distractors:r[2]}]));
const dictionaryPronunciations = new Map(audioRows.map(r=>[r[0],{audio:cambridgeAudioUrl(r[0],r[1]),ipa:r[2]}]));
const catalog = vocabRows.map(r=>({unit:r[0],word:r[1],pos:r[2],def:r[3],context:r[4],synonyms:r[5],antonyms:r[6],visual:r[7],cue:r[8],phrase:r[9],note:r[10],...practiceData.get(r[1])}));
const byWord = new Map(catalog.map(w=>[w.word,w]));
const availableUnits = [...new Set(catalog.map(w=>w.unit))].sort((a,b)=>a-b);
const vocabData = Object.fromEntries(availableUnits.map(u=>[u,catalog.filter(w=>w.unit===u)]));
const day = 86400000;
let currentUser=null,currentUnit=1,currentView='login',historyStack=[],activeRun=null,lastResult=null,zoomLevel=1;
let fcRun=null,matchRun=null,wsRun=null,toastTimer=null,pronunciationPlayer=null,pronunciationRequest=0;
const naturalRecordingCache=new Map();
let storageOK=true;
const temporaryStorage=new Map();
function alertCustom(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,6500);}
function rawRead(key){if(temporaryStorage.has(key))return temporaryStorage.get(key);try{return localStorage.getItem(key);}catch{storageOK=false;return null;}}
function rawWrite(key,value){temporaryStorage.set(key,value);try{localStorage.setItem(key,value);return true;}catch{storageOK=false;return false;}}
function readJSON(key,fallback){const raw=rawRead(key);if(raw===null)return clone(fallback);try{return JSON.parse(raw);}catch{rawWrite(key+'_recovery',raw);alertCustom('A saved record could not be read. Your other words remain available.');return clone(fallback);}}
function newProgress(){return {correct:0,wrong:0,streak:0,recent:[],due:0,last:0,flagged:false,seen:false};}
function userProfile(saved,first,last,key){
  const s=saved&&typeof saved==='object'?saved:{};
  const progress={};
  for(const w of catalog){const p=s.progress?.[w.word];if(p&&typeof p==='object')progress[w.word]={...newProgress(),correct:number(p.correct),wrong:number(p.wrong),streak:number(p.streak),recent:Array.isArray(p.recent)?p.recent.filter(r=>r&&['meaning','context','relationship'].includes(r.skill)&&typeof r.attempt==='string').slice(-6):[],due:number(p.due),last:number(p.last),flagged:!!p.flagged,seen:!!p.seen};}
  return {version:4,firstName:first,lastName:last,userKey:key,studentId:s.studentId||'',classId:s.classId||'',personalVisits:number(s.personalVisits),xp:number(s.xp),gamesCompleted:number(s.gamesCompleted??s.gamesWon),unit:availableUnits.includes(Number(s.unit))?Number(s.unit):availableUnits[0],sequence:number(s.sequence),progress,history:Array.isArray(s.history)?s.history.filter(r=>r&&typeof r.id==='string'&&typeof r.label==='string').slice(0,200):[],resume:s.resume||null};
}
function saveUser(){if(!currentUser)return;currentUser.unit=currentUnit;const ok=rawWrite(currentUser.userKey,JSON.stringify(currentUser));if(!ok&&!currentUser.storageNotified){currentUser.storageNotified=true;alertCustom('Browser saving is unavailable or full. Keep this page open and download your progress.');}if(currentUser.studentId&&window.learningCloud)clearTimeout(saveUser.cloudTimer),saveUser.cloudTimer=setTimeout(()=>window.learningCloud.syncStudentProgress(currentUser).catch(()=>{}),800);}
async function loginAsStudent(){
  const first=$('login-fname').value.trim().replace(/\s+/g,' ').slice(0,40),last=$('login-lname').value.trim().replace(/\s+/g,' ').slice(0,40);
  if(!first||!last){$('login-error').textContent='Please enter your first and last names.';$('login-error').hidden=false;return false;}
  const cloud=window.learningCloud;
  if(!cloud||cloud.status!=='ready'){$('login-error').textContent=cloud?.status==='error'?'Access could not be verified. Check the internet connection and reload this page.':'Please wait while website access is checked.';$('login-error').hidden=false;return false;}
  const restricted=cloud.settings?.accessMode==='restricted',studentLoginValue=$('login-student-id')?.value.trim(),password=$('login-password')?.value;
  $('login-error').hidden=true;$('login-submit').disabled=true;$('login-submit').textContent='Checking…';
  try{
    let cloudRecord=null,restored=null;
    if(restricted){if(!cloud)throw new Error('The secure login is still loading. Please try again.');cloudRecord=await cloud.studentLogin({login:studentLoginValue,password,firstName:first,lastName:last});if(cloudRecord.mustChangePassword){const changed=await openStudentPasswordDialog({required:true,currentPassword:password});if(!changed)throw new Error('Create a private password before entering the course.');cloudRecord.mustChangePassword=false;}restored=await cloud.restoreStudentProgress();}
    const key=restricted?'ao_student_'+cloudRecord.studentId:'ao_user_'+first.toLowerCase()+'_'+last.toLowerCase();
    const local=readJSON(key,null),source=restored&&Number(restored.xp||0)>=Number(local?.xp||0)?{...local,...restored}:local;
    currentUser=userProfile(source,first,last,key);if(cloudRecord)Object.assign(currentUser,{studentId:cloudRecord.studentId,classId:cloudRecord.classId,personalVisits:cloudRecord.personalVisits});currentUnit=currentUser.unit;
  // Preserve legacy totals; migrate this student's earlier activity log once.
  if(!currentUser.history.length){const legacy=readJSON('ao_logs',[]);if(Array.isArray(legacy))currentUser.history=legacy.filter(r=>r?.student?.toLowerCase()===(first+' '+last).toLowerCase()).map((r,i)=>({id:'legacy-'+i,label:String(r.activity||'Earlier activity'),time:Number.isFinite(Date.parse(r.date))?Date.parse(r.date):0,unit:number(r.unit),score:String(r.score||''),xp:0,kind:'legacy',answers:[]})).slice(0,200);}
    rawWrite('ao_active_profile',JSON.stringify({key:currentUser.userKey,restricted:!!currentUser.studentId}));saveUser();navigate('student-dash');return true;
  }catch(error){$('login-error').textContent=error.message\vert{}\vert{}'Login could not be completed.';$('login-error').hidden=false;return false;}finally{$('login-submit').disabled=false;$('login-submit').textContent='Start Learning →';}
}
async function logout(){pausePractice();saveUser();stopAudio();activeRun=null;fcRun=null;matchRun=null;wsRun=null;lastResult=null;const wasStudent=!!currentUser?.studentId;currentUser=null;try{localStorage.removeItem('ao_active_profile');}catch{}temporaryStorage.delete('ao_active_profile');if(wasStudent&&window.learningCloud?.studentLogout)await window.learningCloud.studentLogout().catch(()=>{});$('login-fname').value='';$('login-lname').value='';$('login-student-id').value='';if($('login-password'))$('login-password').value='';navigate('login');}
async function restoreSignedInStudent(session){
  if(currentUser||!session?.studentId||!session.firstName||!session.lastName)return false;
  if(session.mustChangePassword){const changed=await openStudentPasswordDialog({required:true});if(!changed)return false;session.mustChangePassword=false;}
  const key='ao_student_'+session.studentId,local=readJSON(key,null),source=Number(session.xp||0)>=Number(local?.xp||0)?{...local,...session}:local;
  currentUser=userProfile(source,session.firstName,session.lastName,key);Object.assign(currentUser,{studentId:session.studentId,classId:session.classId,personalVisits:Number(session.personalVisits||session.visits)||1});currentUnit=currentUser.unit;
  rawWrite('ao_active_profile',JSON.stringify({key,restricted:true}));saveUser();navigate('student-dash');return true;
}
function restorePublicProfile(){
  if(currentUser)return false;const active=readJSON('ao_active_profile',null);if(!active?.key||active.restricted)return false;const saved=readJSON(active.key,null);if(!saved?.firstName||!saved?.lastName)return false;
  currentUser=userProfile(saved,saved.firstName,saved.lastName,active.key);currentUnit=currentUser.unit;navigate('student-dash');return true;
}
function stopAudio(){pronunciationRequest++;if(pronunciationPlayer){pronunciationPlayer.pause();pronunciationPlayer=null;}if('speechSynthesis' in window)window.speechSynthesis.cancel();}
function naturalRecordingUnavailable(request){
  if(request===pronunciationRequest)alertCustom('A natural recording is unavailable right now. Check your internet connection and try again.');
}
function playRecording(url,request,onFailure){
  if(request!==pronunciationRequest)return;
  let failed=false;const fail=()=>{if(!failed&&request===pronunciationRequest){failed=true;onFailure();}};
  try{const player=new Audio(url);pronunciationPlayer=player;player.preload='none';player.onerror=fail;player.onended=()=>{if(pronunciationPlayer===player)pronunciationPlayer=null;};const promise=player.play();if(promise?.catch)promise.catch(fail);}catch{fail();}
}
async function findNaturalRecording(word){
  if(naturalRecordingCache.has(word))return naturalRecordingCache.get(word);
  if(typeof fetch!=='function')return null;
  try{
    const response=await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/'+encodeURIComponent(word));
    if(!response.ok)throw new Error('Recording lookup failed.');
    const entries=await response.json(),urls=(Array.isArray(entries)?entries:[]).flatMap(entry=>Array.isArray(entry.phonetics)?entry.phonetics:[]).map(item=>String(item.audio||'').trim()).filter(Boolean).map(url=>url.startsWith('//')?'https:'+url:url);
    const url=urls.find(value=>/-us(?:[-.]|$)/i.test(value))||urls.find(value=>/us_pron|american/i.test(value))||urls[0]||null;
    if(url)naturalRecordingCache.set(word,url);return url;
  }catch{return null;}
}
async function playNaturalRecording(word,request){
  alertCustom('Loading a natural dictionary pronunciation…');
  const url=await findNaturalRecording(word);if(request!==pronunciationRequest)return;
  if(!url){naturalRecordingUnavailable(request);return;}
  playRecording(url,request,()=>naturalRecordingUnavailable(request));
}
function playAudio(word){
  if(!byWord.has(word))return;stopAudio();const request=pronunciationRequest,recording=dictionaryPronunciations.get(word);
  if(!navigator.onLine){naturalRecordingUnavailable(request);return;}
  if(recording?.audio){playRecording(recording.audio,request,()=>playNaturalRecording(word,request));return;}
  playNaturalRecording(word,request);
}
function changeZoom(delta){zoomLevel=Math.min(1.5,Math.max(.9,Math.round((zoomLevel+delta)*100)/100));document.documentElement.style.fontSize=(16*zoomLevel)+'px';$('zoom-reset').textContent=Math.round(zoomLevel*100)+'%';}
function resetZoom(){zoomLevel=1;changeZoom(0);}
function pausePractice(){if(currentUser&&activeRun&&!activeRun.completed){currentUser.resume=clone(activeRun);saveUser();}}
function navigate(view,push=true){
  if(!currentUser&&!['login','help'].includes(view))return;
  if(currentView==='quiz'&&view!=='quiz')pausePractice();stopAudio();cancelWordSelection();
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  document.querySelectorAll('main > .view').forEach(el=>el.hidden=el.id!=='view-'+view);
  currentView=view;if(view==='login'){historyStack=[];$('banner-active-unit-text').textContent='Units '+availableUnits[0]+'–'+availableUnits.at(-1);}else if(view==='student-dash')historyStack=['student-dash'];else if(push&&historyStack.at(-1)!==view)historyStack.push(view);
  $('global-back-btn').hidden=historyStack.length<2;$('nav-user-info').hidden=!currentUser;
  if(view==='student-dash')updateDashStats();if(view==='progress')renderProgress();
  $('main-container').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});
}
function handleLogoClick(){navigate(currentUser?'student-dash':'login');}
function goBack(){if(historyStack.length>1){historyStack.pop();navigate(historyStack.at(-1),false);}else handleLogoClick();}
function changeUnitFromDropdown(value){const unit=Number(value);if(!vocabData[unit])return;currentUnit=unit;saveUser();updateDashStats();}
function isMastered(p){return !!p&&p.streak>=3&&new Set(p.recent.map(r=>r.skill)).size>=2&&new Set(p.recent.map(r=>r.attempt)).size>=2;}
function progressFor(word){return currentUser.progress[word]||(currentUser.progress[word]=newProgress());}
function reviewWords(unit=currentUnit){return vocabData[unit].filter(w=>{const p=currentUser.progress[w.word];return p&&(p.flagged||(p.last&&p.due<=Date.now()));});}
function updateDashStats(){
  if(!currentUser)return;$('dash-greeting-name').textContent=currentUser.firstName;$('dash-unit-select').value=currentUnit;$('dash-xp').textContent=currentUser.xp;$('nav-xp').textContent=currentUser.xp;
  $('student-password-button').hidden=!currentUser.studentId;
  $('dash-mastered').textContent=vocabData[currentUnit].filter(w=>isMastered(currentUser.progress[w.word])).length+' / 20';$('dash-current-unit-badge').textContent='Unit '+currentUnit;$('banner-active-unit-text').textContent='Unit '+currentUnit;$('dash-games-won').textContent=currentUser.gamesCompleted;$('dash-personal-visits').textContent=currentUser.studentId?currentUser.personalVisits:'Guest';
  const n=reviewWords().length;$('review-description').textContent=n?n+' word'+(n===1?' is':'s are')+' ready for review in this unit.':'Your mistakes, flagged flashcards, and due words will appear here.';
  const resume=validResume(currentUser.resume);$('resume-box').hidden=!resume;$('resume-label').textContent=resume?currentUser.resume.label+' · Unit '+currentUser.resume.unit:'';
}
function makeAttempt(kind,label,unit=currentUnit){currentUser.sequence++;const run={id:Date.now().toString(36)+'-'+currentUser.sequence,kind,label,unit,completed:false,started:Date.now(),answers:[]};saveUser();return run;}
function recordLearning(word,skill,correct,attempt){
  const p=progressFor(word);p.seen=true;p.last=Date.now();
  if(correct){p.correct++;p.streak++;p.recent.push({skill,attempt});p.recent=p.recent.slice(-6);p.flagged=p.flagged&&p.streak<2;p.due=p.last+[1,3,7,14][Math.min(3,p.streak-1)]*day;}
  else{p.wrong++;p.streak=0;p.recent=[];p.flagged=true;p.due=p.last;}
}
function finishRun(run,{score,correct=0,total=0,xp=0,detail=''}){
  if(!currentUser||!run||run.completed)return false;
  const existing=currentUser.history.find(r=>r.id===run.id);run.completed=true;
  if(existing){lastResult=existing;showResults();return false;}
  const result={id:run.id,time:Date.now(),label:run.label,kind:run.kind,unit:run.unit,score,correct,total,xp:Math.round(Math.max(0,xp)),detail,answers:clone(run.answers||[])};
  currentUser.xp+=result.xp;if(['matching','wordsearch','context'].includes(run.kind))currentUser.gamesCompleted++;
  currentUser.history.unshift(result);currentUser.history=currentUser.history.slice(0,200);
  if(currentUser.resume?.id===run.id)currentUser.resume=null;
  lastResult=result;saveUser();if(currentUser.studentId&&window.learningCloud)window.learningCloud.syncStudentProgress(currentUser,result).catch(()=>alertCustom('Your result is saved on this browser and will sync when the connection returns.'));showResults();return true;
}
function showResults(){
  const r=lastResult;if(!r)return;$('results-unit').textContent='Unit '+r.unit;$('results-title').textContent=r.label+' complete';$('results-message').textContent=r.detail||'Your practice has been recorded.';$('results-score').textContent=r.score;$('results-xp').textContent='+'+r.xp;
  const missed=(r.answers||[]).filter(a=>!a.correct);$('results-review').hidden=!missed.length;$('result-copy-box').hidden=true;
  $('results-details').innerHTML=(r.answers||[]).length?'<h2>Answer review</h2>'+r.answers.map(a=>`<article class="panel result-detail ${a.correct?'':'missed'}"><h3>${a.correct?'✓':'Review'} · ${escapeHTML(a.word)}</h3><p>${escapeHTML(a.prompt)}</p><p>Your answer: <strong>${escapeHTML(a.chosen||'Not matched on the first try')}</strong></p><p>${escapeHTML(a.explanation)}</p></article>`).join(''):'';
  navigate('results');
}
function validResume(r){return !!r&&typeof r.id==='string'&&['quiz','context','review'].includes(r.kind)&&!r.completed&&vocabData[r.unit]&&Number.isInteger(r.index)&&Array.isArray(r.questions)&&r.index>=0&&r.index<r.questions.length&&Array.isArray(r.answers)&&r.questions.length<=100&&r.questions.every(q=>q&&byWord.has(q.word)&&typeof q.prompt==='string'&&Array.isArray(q.options)&&q.options.length===4&&new Set(q.options).size===4&&q.options.includes(q.word)&&q.options.every(x=>byWord.has(x)))&&r.answers.length>=r.index&&r.answers.length<=r.index+1;}
function resumePractice(){if(!validResume(currentUser?.resume)){alertCustom('No valid saved practice is available.');return;}activeRun=clone(currentUser.resume);currentUnit=activeRun.unit;saveUser();renderQuestion();navigate('quiz');}
function resultText(r=lastResult){return `Ahmed Oqab Vocab — ${currentUser.firstName} ${currentUser.lastName}\nUnit ${r.unit} · ${r.label}\nResult: ${r.score} · XP: ${r.xp}\n${new Date(r.time).toLocaleString()}\n${r.detail||''}`;}
function downloadFile(name,content,type='text/plain;charset=utf-8'){
  const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function csvCell(value){let s=String(value??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function exportCSV(name,rows){downloadFile(name,'\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');}
function copyResult(){const text=resultText();$('result-copy-text').value=text;$('result-copy-box').hidden=false;const finish=()=>{$('result-copy-text').focus();$('result-copy-text').select();};if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).then(()=>alertCustom('Result copied. Paste it into your message.')).catch(finish);else finish();}
function downloadResult(){const r=lastResult;exportCSV('Vocabulary-Unit-'+r.unit+'-Result.csv',[['Student',currentUser.firstName+' '+currentUser.lastName],['Activity',r.label],['Unit',r.unit],['Result',r.score],['XP',r.xp],['Date',new Date(r.time).toISOString()],[],['Word','Question','Your answer','Correct','Explanation'],...(r.answers||[]).map(a=>[a.word,a.prompt,a.chosen,a.correct?'Yes':'No',a.explanation])]);}

// --- GLOBAL EXPORTS ---
// Exposing functions and variables to the window object ensures that 
// inline HTML events and external exercise scripts continue to work 
// seamlessly now that this file is a module.

window.loginAsStudent = loginAsStudent;
window.logout = logout;
window.restoreSignedInStudent = restoreSignedInStudent;
window.restorePublicProfile = restorePublicProfile;
window.playAudio = playAudio;
window.changeZoom = changeZoom;
window.resetZoom = resetZoom;
window.navigate = navigate;
window.handleLogoClick = handleLogoClick;
window.goBack = goBack;
window.changeUnitFromDropdown = changeUnitFromDropdown;
window.resumePractice = resumePractice;
window.copyResult = copyResult;
window.downloadResult = downloadResult;
window.currentUser = currentUser;
window.currentUnit = currentUnit;
window.activeRun = activeRun;
window.lastResult = lastResult;
window.vocabData = vocabData;
window.byWord = byWord;
window.catalog = catalog;
window.availableUnits = availableUnits;
window.finishRun = finishRun;
window.recordLearning = recordLearning;
window.makeAttempt = makeAttempt;
window.shuffleArray = shuffleArray;
