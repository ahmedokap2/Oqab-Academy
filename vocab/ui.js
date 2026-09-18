// Accessible UI bindings and progress reports; no inline event handlers.
function progressStatus(p){if(isMastered(p))return 'Mastered';if(p?.flagged)return 'Review needed';if(p&&(p.correct||p.wrong))return 'Learning';if(p?.seen)return 'Explored';return 'Not started';}
function reviewDate(p){if(!p||(!p.last&&!p.flagged))return 'After first practice';return p.due<=Date.now()?'Due now':new Date(p.due).toLocaleDateString();}
function renderProgress(){
  if(!currentUser)return;const words=vocabData[currentUnit],mastered=words.filter(w=>isMastered(currentUser.progress[w.word])).length,learning=words.filter(w=>{const p=currentUser.progress[w.word];return p&&(p.correct||p.wrong);}).length;
  $('progress-summary').innerHTML=`<div><strong>Unit ${currentUnit}</strong><span>Current unit</span></div><div><strong>${mastered} / 20</strong><span>Mastered</span></div><div><strong>${learning} / 20</strong><span>Practised</span></div><div><strong>${reviewWords().length}</strong><span>Ready for review</span></div>`;
  $('progress-words').innerHTML=words.map(w=>{const p=currentUser.progress[w.word];return `<tr><th scope="row">${escapeHTML(w.word)}</th><td>${progressStatus(p)}</td><td>${p?p.correct:0} / ${p?p.correct+p.wrong:0}</td><td>${escapeHTML(reviewDate(p))}</td></tr>`;}).join('');
  $('progress-history').innerHTML=currentUser.history.map((r,index)=>`<article class="panel history-item"><div><strong>Unit ${r.unit} · ${escapeHTML(r.label)}</strong><p class="small muted">${r.time?escapeHTML(new Date(r.time).toLocaleString()):'Earlier saved activity'} · ${escapeHTML(r.score)}</p></div><button data-action="history-result" data-index="${index}">View result</button></article>`).join('')||'<p class="notice">Complete an activity to see your results here.</p>';
}
function exportProgress(){exportCSV('Vocabulary-Progress.csv',[['Student',currentUser.firstName+' '+currentUser.lastName],['Exported',new Date().toISOString()],[],['Unit','Word','Status','Correct','Answered','Consecutive correct','Next review'],...catalog.map(w=>{const p=currentUser.progress[w.word];return [w.unit,w.word,progressStatus(p),p?.correct||0,(p?.correct||0)+(p?.wrong||0),p?.streak||0,reviewDate(p)];})]);}
function exportHistory(){exportCSV('Vocabulary-History.csv',[['Student',currentUser.firstName+' '+currentUser.lastName],[],['Date','Unit','Activity','Result','XP','Notes'],...currentUser.history.map(r=>[r.time?new Date(r.time).toISOString():'Earlier activity',r.unit,r.label,r.score,r.xp,r.detail||''])]);}
function showHistoryResult(index){const r=currentUser.history[index];if(!r)return;lastResult=r;showResults();}
const actions={
  home:handleLogoClick,back:goBack,logout,help:()=>navigate('help'),'account-password':()=>openStudentPasswordDialog({required:false}),'zoom-in':()=>changeZoom(.1),'zoom-out':()=>changeZoom(-.1),'zoom-reset':resetZoom,
  study:initStudyDeeply,'study-reviewed':b=>markStudyReviewed(b.dataset.word),'study-finish':finishStudy,flashcards:initFlashcards,
  'fc-flip':toggleFlashcard,'fc-prev':()=>moveFlashcard(-1),'fc-next':()=>moveFlashcard(1),'fc-shuffle':shuffleFlashcards,'fc-known':()=>rateFlashcard('known'),'fc-again':()=>rateFlashcard('again'),'fc-finish':finishFlashcards,
  'fc-audio':()=>{if(!$('fc-direction').value.includes('meaning')||fcRun?.flipped)playAudio(currentFlashWord()?.word);},audio:b=>playAudio(b.dataset.word),
  games:()=>{prepareActivity();$('arcade-unit-badge').textContent='Unit '+currentUnit;navigate('games-hub');},match:initMatchingGame,'match-card':b=>handleMatchClick(Number(b.dataset.index)),'match-next':nextMatchRound,
  'quiz-menu':()=>openVariantModal('quiz'),'context-menu':()=>openVariantModal('context'),variant:b=>startSelectedVariant(Number(b.dataset.variant)),answer:b=>selectQuizOption(Number(b.dataset.index)),'question-next':nextQuizQuestion,
  'ws-menu':openWordSearchSectionModal,'ws-start':b=>startWordSearchSection(Number(b.dataset.section)),'ws-hint':b=>wordSearchHint(Number(b.dataset.index)),'ws-finish':finishWordSearch,
  review:()=>startReview(false),'result-review':()=>startReview(true),progress:()=>navigate('progress'),resume:resumePractice,'result-copy':copyResult,'result-download':downloadResult,
  'export-progress':exportProgress,'export-history':exportHistory,'export-backup':()=>downloadFile('Vocabulary-Progress-Backup.json',JSON.stringify(currentUser,null,2),'application/json'),'history-result':b=>showHistoryResult(Number(b.dataset.index)),
  'close-dialog':b=>b.closest('dialog').close()
};
document.addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(!button||button.disabled)return;const action=button.dataset.action;if(!currentUser&&!['home','back','help','zoom-in','zoom-out','zoom-reset','close-dialog'].includes(action))return;if(actions[action])actions[action](button);});
$('login-form').addEventListener('submit',async event=>{event.preventDefault();await loginAsStudent();});
let passwordDialogResolve=null;
function validPrivatePassword(value){return value.length>=10&&/[a-z]/.test(value)&&/[A-Z]/.test(value)&&/[0-9]/.test(value)&&/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(value);}
function openStudentPasswordDialog({required=false,currentPassword=''}={}){
  const dialog=$('password-change-dialog');$('password-change-title').textContent=required?'Create your private password':'Change your password';$('password-change-note').textContent=required?'For security, replace the temporary password before entering the course. Your teacher cannot see the private password you create.':'Enter your current password and choose a new private password.';$('student-current-password').value=currentPassword;$('student-new-password').value='';$('student-confirm-password').value='';$('password-change-error').hidden=true;$('password-change-cancel').hidden=required;dialog.dataset.required=required?'true':'false';dialog.showModal();return new Promise(resolve=>{passwordDialogResolve=resolve;});
}
$('student-password-form').addEventListener('submit',async event=>{event.preventDefault();const error=$('password-change-error'),current=$('student-current-password').value,next=$('student-new-password').value,confirmPassword=$('student-confirm-password').value,button=event.submitter||event.currentTarget.querySelector('[type="submit"]');error.hidden=true;if(next!==confirmPassword){error.textContent='The new passwords do not match.';error.hidden=false;return;}if(!validPrivatePassword(next)){error.textContent='Use at least 10 characters with uppercase, lowercase, a number, and a symbol.';error.hidden=false;return;}button.disabled=true;try{await window.learningCloud.changeStudentPassword(current,next);$('password-change-dialog').close();passwordDialogResolve?.(true);passwordDialogResolve=null;alertCustom('Your private password has been saved.');}catch(x){error.textContent=x.message||'The password could not be changed.';error.hidden=false;}finally{button.disabled=false;}});
$('password-change-cancel').addEventListener('click',()=>{$('password-change-dialog').close();passwordDialogResolve?.(false);passwordDialogResolve=null;});
$('password-change-dialog').addEventListener('cancel',event=>{if(event.currentTarget.dataset.required==='true')event.preventDefault();else{passwordDialogResolve?.(false);passwordDialogResolve=null;}});
$('student-forgot-password').addEventListener('click',()=>{$('student-forgot-dialog').showModal();});
function configureCloudLogin(){
  const cloud=window.learningCloud;if(!cloud)return;const box=$('student-access-fields'),id=$('login-student-id'),password=$('login-password');
  if(cloud.status==='error'){box.hidden=true;id.required=false;password.required=false;$('login-submit').disabled=true;$('access-note').textContent='Access could not be verified. Check the internet connection and reload this page.';return;}
  if(cloud.status!=='ready'){box.hidden=true;$('login-submit').disabled=true;$('access-note').textContent='Checking website access…';return;}
  const restricted=cloud.settings?.accessMode==='restricted';box.hidden=!restricted;id.required=restricted;password.required=restricted;$('login-submit').disabled=false;$('access-note').textContent=restricted?'Enter your Student ID and password. You will stay signed in until you choose Sign out. If you forget your password, ask your teacher for a secure reset.':'Public access is open. Your learning session stays on this browser until you choose Sign out.';
  if(restricted)restoreSignedInStudent(cloud.session);else restorePublicProfile();
}
window.addEventListener('learning-cloud-ready',configureCloudLogin);if(window.learningCloud)setTimeout(configureCloudLogin,0);
$('dash-unit-select').addEventListener('change',event=>changeUnitFromDropdown(event.target.value));
$('study-search').addEventListener('input',renderStudy);
$('flashcard-inner').addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleFlashcard();}});
for(const id of ['fc-direction','fc-show-visual'])$(id).addEventListener('change',()=>{if(fcRun){fcRun.flipped=false;renderFlashcard();}});
$('ws-large').addEventListener('change',event=>$('ws-grid').classList.toggle('large',event.target.checked));
$('ws-grid').addEventListener('pointerdown',wsPointerDown);
$('ws-grid').addEventListener('pointermove',wsPointerMove);
$('ws-grid').addEventListener('pointerup',wsPointerUp);
$('ws-grid').addEventListener('pointercancel',cancelWordSelection);
$('ws-grid').addEventListener('keydown',wsKeyDown);
window.addEventListener('pagehide',()=>{pausePractice();saveUser();stopAudio();});
navigate('login',false);
