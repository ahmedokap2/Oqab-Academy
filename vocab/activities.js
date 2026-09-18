// Study, flashcards, matching and assessment activities.
let studyRun=null,pendingVariantMode='quiz';
function prepareActivity(){pausePractice();activeRun=null;stopAudio();}
function getWordVisual(w){return `<div class="word-visual"><span class="symbol" aria-hidden="true">${escapeHTML(w.visual)}</span><p>${escapeHTML(w.cue)}</p></div>`;}
function relationHTML(w){return `<div class="relations"><p><strong>Synonyms</strong>${escapeHTML(w.synonyms)}</p><p><strong>Antonyms</strong>${escapeHTML(w.antonyms||'No standard direct antonym for this meaning.')}</p></div>`;}
function initStudyDeeply(){prepareActivity();studyRun=makeAttempt('study','Study Deeply');studyRun.reviewed=[];$('study-search').value='';$('study-active-unit-text').textContent='Unit '+currentUnit;renderStudy();navigate('study-deeply');}
function renderStudy(){
  const query=$('study-search').value.trim().toLowerCase(),words=vocabData[currentUnit].filter(w=>(w.word+' '+w.def).toLowerCase().includes(query));
  $('study-list-container').innerHTML=words.map(w=>`<article class="panel word-card"><div><div class="row"><div><span class="word-number">${vocabData[currentUnit].indexOf(w)+1} / 20</span><h2>${escapeHTML(w.word)}</h2><span class="pos">${escapeHTML(w.pos)}</span></div><button data-action="audio" data-word="${escapeHTML(w.word)}" aria-label="Listen to ${escapeHTML(w.word)}">🔊 Listen</button></div><p class="small muted">/${escapeHTML(dictionaryPronunciations.get(w.word)?.ipa||'')}/</p><p class="definition">${escapeHTML(w.def)}</p><p class="example">${escapeHTML(w.context)}</p><p class="phrase">Common phrase: ${escapeHTML(w.phrase)}</p><details><summary>Explore synonyms, antonyms, and usage</summary>${relationHTML(w)}${w.note?`<p class="note">${escapeHTML(w.note)}</p>`:''}</details><button data-action="study-reviewed" data-word="${escapeHTML(w.word)}" ${studyRun.reviewed.includes(w.word)?'disabled':''}>${studyRun.reviewed.includes(w.word)?'Reviewed ✓':'Mark as reviewed'}</button></div>${getWordVisual(w)}</article>`).join('')||'<p class="notice">No words match your search.</p>';
}
function markStudyReviewed(word){if(!studyRun||studyRun.completed||!vocabData[currentUnit].some(w=>w.word===word)||studyRun.reviewed.includes(word))return;studyRun.reviewed.push(word);progressFor(word).seen=true;saveUser();const button=document.querySelector(`[data-action="study-reviewed"][data-word="${word}"]`);if(button){button.disabled=true;button.textContent='Reviewed ✓';}}
function finishStudy(){if(!studyRun)return;const n=studyRun.reviewed.length;finishRun(studyRun,{score:n+' / 20 reviewed',xp:Math.floor(n/2),detail:'Study participation recorded. Try an activity to check your understanding.'});}
function initFlashcards(){prepareActivity();fcRun=makeAttempt('flashcards','Flashcards');Object.assign(fcRun,{words:vocabData[currentUnit].map(w=>w.word),index:0,flipped:false,ratings:{}});$('fc-direction').value='word';$('fc-show-visual').checked=false;renderFlashcard();navigate('flashcards');}
function currentFlashWord(){return fcRun?byWord.get(fcRun.words[fcRun.index]):null;}
function renderFlashcard(){
  const w=currentFlashWord();if(!w)return;const meaningFirst=$('fc-direction').value==='meaning';
  $('fc-counter').textContent=(fcRun.index+1)+' / '+fcRun.words.length+' · '+Object.keys(fcRun.ratings).length+' rated';
  $('fc-front').innerHTML=meaningFirst?`<p class="eyebrow">Recall the vocabulary word</p><p class="definition">${escapeHTML(w.def)}</p>`:`<p class="eyebrow">Recall the meaning</p><h2>${escapeHTML(w.word)}</h2>${$('fc-show-visual').checked?getWordVisual(w):''}`;
  $('fc-back').innerHTML=`<h2>${escapeHTML(w.word)}</h2><p class="pos">${escapeHTML(w.pos)}</p><p class="definition">${escapeHTML(w.def)}</p><p class="example">${escapeHTML(w.context)}</p><p class="phrase">${escapeHTML(w.phrase)}</p>${relationHTML(w)}${w.note?`<p class="note">${escapeHTML(w.note)}</p>`:''}`;
  $('fc-front').hidden=fcRun.flipped;$('fc-back').hidden=!fcRun.flipped;$('fc-rating').hidden=!fcRun.flipped||fcRun.completed;$('flashcard-inner').setAttribute('aria-expanded',String(fcRun.flipped));
  // In meaning-first recall, pronunciation is revealed only with the answer.
  const hideAnswer=meaningFirst&&!fcRun.flipped;$('fc-ipa').textContent=hideAnswer?'Flip to reveal the word and pronunciation.':'/'+(dictionaryPronunciations.get(w.word)?.ipa||'')+'/';
  document.querySelector('[data-action="fc-audio"]').disabled=hideAnswer;
  $('fc-prev').disabled=fcRun.index===0;$('fc-next').disabled=fcRun.index===fcRun.words.length-1;
  $('fc-feedback').textContent=fcRun.ratings[w.word]?(fcRun.ratings[w.word]==='again'?'Marked for another review.':'Marked as familiar. Test it in a quiz to build mastery.'):'Think first, then flip and rate your recall.';
}
function toggleFlashcard(){if(!fcRun)return;fcRun.flipped=!fcRun.flipped;renderFlashcard();}
function moveFlashcard(delta){if(!fcRun)return;fcRun.index=Math.min(fcRun.words.length-1,Math.max(0,fcRun.index+delta));fcRun.flipped=false;stopAudio();renderFlashcard();}
function rateFlashcard(rating){if(!fcRun||fcRun.completed||!fcRun.flipped)return;const w=currentFlashWord(),p=progressFor(w.word);fcRun.ratings[w.word]=rating;p.seen=true;if(rating==='again'){p.flagged=true;p.due=Date.now();}else if(!p.wrong)p.flagged=false;saveUser();renderFlashcard();}
function shuffleFlashcards(){if(!fcRun)return;shuffleArray(fcRun.words);fcRun.index=0;fcRun.flipped=false;renderFlashcard();}
function finishFlashcards(){if(!fcRun||fcRun.completed)return;const n=Object.keys(fcRun.ratings).length;if(n<fcRun.words.length){alertCustom('Flip and rate all '+fcRun.words.length+' cards before finishing. You have rated '+n+'.');return;}finishRun(fcRun,{score:n+' cards rated',xp:15,detail:'Self-check completed. Words marked “Review again” are ready in Review My Words.'});}
function initMatchingGame(){prepareActivity();matchRun=makeAttempt('matching','Word–Meaning Match');const words=shuffleArray(vocabData[currentUnit].map(w=>w.word));Object.assign(matchRun,{round:0,rounds:[words.slice(0,8),words.slice(8,16),words.slice(16)],matched:[],failures:{},selection:null});renderMatchRound();navigate('game-matching');}
function renderMatchRound(){
  const run=matchRun;if(!run)return;run.selection=null;run.cards=shuffleArray(run.rounds[run.round].flatMap(word=>[{word,type:'word'},{word,type:'def'}]));
  $('match-round').textContent='Unit '+run.unit+' · Round '+(run.round+1)+' of 3 · '+run.rounds[run.round].length+' pairs';
  $('match-grid').innerHTML=run.cards.map((c,index)=>`<button class="match-card ${c.type}" data-action="match-card" data-index="${index}" aria-pressed="false">${escapeHTML(c.type==='word'?c.word:byWord.get(c.word).def)}</button>`).join('');
  $('match-next').hidden=true;$('match-feedback').textContent='Choose a word and its definition.';updateMatchScore();
}
function updateMatchScore(){const run=matchRun;const n=run.rounds[run.round].filter(w=>run.matched.includes(w)).length;$('match-score').textContent=n+' / '+run.rounds[run.round].length+' pairs · '+run.matched.length+' / 20 words';}
function handleMatchClick(index){
  const run=matchRun;if(!run||run.completed||currentView!=='game-matching'||!Number.isInteger(index)||!run.cards[index])return;
  const card=run.cards[index],buttons=[...$('match-grid').children];if(run.matched.includes(card.word)||run.selection===index)return;
  buttons.forEach(b=>b.classList.remove('wrong'));buttons[index].classList.add('selected');buttons[index].setAttribute('aria-pressed','true');
  if(run.selection===null){run.selection=index;return;}
  const firstIndex=run.selection,first=run.cards[firstIndex];run.selection=null;
  for(const i of [firstIndex,index]){buttons[i].classList.remove('selected');buttons[i].setAttribute('aria-pressed','false');}
  if(first.word===card.word&&first.type!==card.type){
    run.matched.push(card.word);for(const i of [firstIndex,index]){buttons[i].classList.add('matched');buttons[i].disabled=true;buttons[i].setAttribute('aria-label',buttons[i].textContent+' — matched');}
    const clean=!run.failures[card.word],w=byWord.get(card.word);recordLearning(card.word,'meaning',clean,run.id);
    run.answers.push({word:card.word,prompt:w.def,chosen:clean?card.word:card.word+' (after another try)',correct:clean,explanation:(clean?'Matched on the first try. ':'Matched after an earlier mistake. ')+w.word+' means '+w.def});saveUser();
    $('match-feedback').textContent='Matched: '+card.word+'. '+w.def;updateMatchScore();
    if(run.rounds[run.round].every(w=>run.matched.includes(w))){$('match-next').hidden=false;$('match-next').textContent=run.round===2?'View results':'Next round →';}
  }else{for(const c of [first,card])run.failures[c.word]=(run.failures[c.word]||0)+1;for(const i of [firstIndex,index])buttons[i].classList.add('wrong');$('match-feedback').textContent='These do not match. Read the definition carefully and choose another pair.';}
}
function nextMatchRound(){const run=matchRun;if(!run||run.completed||!run.rounds[run.round].every(w=>run.matched.includes(w)))return;if(run.round<2){run.round++;renderMatchRound();$('match-grid').querySelector('button')?.focus();}else{const correct=run.answers.filter(a=>a.correct).length;finishRun(run,{score:correct+' / 20 first try',correct,total:20,xp:5+Math.round(correct*.75),detail:'You matched all 20 words. '+correct+' were matched without an earlier mistake.'});}}
function cleanRelation(text){return text.replace(/\([^)]*\)/g,'').split(/[;,]/)[0].trim();}
function makeQuestion(w,kind,variant){
  const position=vocabData[w.unit].findIndex(x=>x.word===w.word),type=kind==='context'?'context':['meaning','context','relationship'][(position+variant-1)%3];
  let prompt,instruction,explanation;
  if(type==='meaning'){prompt=w.def;instruction='Choose the word that matches this meaning:';explanation=w.word+' means '+w.def+' Example: '+w.context;}
  else if(type==='context'){prompt=w.contexts[(variant-1)%3];instruction='Complete the sentence with the best vocabulary word:';explanation=prompt.replace('______',w.word)+' Meaning: '+w.def;}
  else{const opposite=!!w.antonyms&&(position+variant)%2===0&&w.word!=='virtual';const clue=cleanRelation(opposite?w.antonyms:w.synonyms);prompt='Clue: “'+clue+'”';instruction=opposite?'Choose the opposite in the relevant listed meaning:':'Choose the closest meaning in the relevant listed sense:';explanation=w.word+' and “'+clue+'” have '+(opposite?'opposite':'similar')+' meanings here. '+w.def;}
  return {word:w.word,type,prompt,instruction,explanation,options:shuffleArray([w.word,...w.distractors])};
}
function buildCompleteQuestionSet(kind,variant,words=vocabData[currentUnit]){return shuffleArray(words.map(w=>makeQuestion(w,kind,variant)));}
function openVariantModal(mode){pendingVariantMode=mode;const quiz=mode==='quiz';$('variant-modal-title').textContent=quiz?'Choose a Homework Quiz':'Choose a Context Challenge';$('variant-description').textContent=quiz?'Each quiz tests all 20 words. Across A, B, and C, each word is tested through meaning, context, and relationships.':'Each practice tests all 20 words using a different set of new sentences. Read the explanation before moving on.';$('variant-buttons').innerHTML=[1,2,3].map(v=>`<button data-action="variant" data-variant="${v}">${quiz?'Quiz':'Practice'} ${'ABC'[v-1]}<small>${quiz?'20 mixed questions · reviewed distractors':'20 new context sentences · feedback at your pace'}</small></button>`).join('');$('modal-variant').showModal();}
function startSelectedVariant(variant){if(![1,2,3].includes(variant))return;$('modal-variant').close();startQuestionPractice(pendingVariantMode,variant);}
function startQuestionPractice(kind,variant=1,words=vocabData[currentUnit]){
  if(!currentUser||!words.length)return;prepareActivity();const label=kind==='quiz'?'Homework Quiz '+('ABC'[variant-1]):kind==='context'?'Context Challenge '+('ABC'[variant-1]):'Review My Words';
  activeRun=makeAttempt(kind,label);Object.assign(activeRun,{variant,index:0,questions:buildCompleteQuestionSet(kind,variant,words)});currentUser.resume=clone(activeRun);saveUser();renderQuestion();navigate('quiz');
}
function renderQuestion(){
  const run=activeRun;if(!run||run.completed)return;const q=run.questions[run.index],answer=run.answers[run.index];
  $('quiz-title').textContent=run.kind==='context'?'Context Challenge':run.kind==='review'?'Review My Words':'Homework Quiz';$('quiz-variant-label').textContent='Unit '+run.unit+' · '+run.label;$('banner-active-unit-text').textContent='Unit '+run.unit;
  $('quiz-counter').textContent=(run.index+1)+' / '+run.questions.length;$('quiz-progress-bar').max=run.questions.length;$('quiz-progress-bar').value=run.answers.length;$('quiz-instruction').textContent=q.instruction;$('quiz-question').textContent=q.prompt;
  $('quiz-options-container').innerHTML=q.options.map((opt,index)=>`<button data-action="answer" data-index="${index}" ${answer?'disabled':''} class="${answer?(opt===q.word?'correct':opt===answer.chosen?'incorrect':''):''}">${escapeHTML(opt)}${answer&&opt===q.word?' ✓':answer&&opt===answer.chosen?' ✗':''}</button>`).join('');
  $('quiz-feedback-area').className='feedback'+(answer?(answer.correct?' good':' bad'):'');$('quiz-feedback-area').innerHTML=answer?`<strong>${answer.correct?'Correct!':'The correct word is '+escapeHTML(q.word)+'.'}</strong><p>${escapeHTML(q.explanation)}</p>`:'';
  $('quiz-next-btn').hidden=!answer;$('quiz-next-btn').disabled=false;$('quiz-next-btn').textContent=run.index===run.questions.length-1?'Finish and view results':'Next question →';
}
function selectQuizOption(index){
  const run=activeRun;if(!run||run.completed||currentView!=='quiz'||run.answers[run.index]||!Number.isInteger(index))return;const q=run.questions[run.index],chosen=q.options[index];if(chosen===undefined)return;
  const correct=chosen===q.word;run.answers.push({word:q.word,prompt:q.prompt,chosen,correct,explanation:q.explanation,skill:q.type});recordLearning(q.word,q.type,correct,run.id);currentUser.resume=clone(run);saveUser();renderQuestion();$('quiz-next-btn').focus({preventScroll:true});
}
function nextQuizQuestion(){
  const run=activeRun;if(!run||run.completed||!run.answers[run.index])return;
  if(run.index<run.questions.length-1){run.index++;currentUser.resume=clone(run);saveUser();renderQuestion();$('quiz-question').setAttribute('tabindex','-1');$('quiz-question').focus({preventScroll:true});}
  else{$('quiz-next-btn').disabled=true;const correct=run.answers.filter(a=>a.correct).length,total=run.questions.length;finishRun(run,{score:correct+' / '+total+' ('+Math.round(correct/total*100)+'%)',correct,total,xp:correct*(run.kind==='quiz'?5:run.kind==='context'?2:3),detail:correct===total?'Every answer was correct. Revisit these words later to strengthen recall.':(total-correct)+' word'+(total-correct===1?' needs':'s need')+' another look. Read the explanations below, then practise the missed words.'});}
}
function startReview(fromResult=false){let words;if(fromResult&&lastResult){currentUnit=lastResult.unit;words=[...new Set(lastResult.answers.filter(a=>!a.correct).map(a=>a.word))].map(w=>byWord.get(w)).filter(Boolean);}else words=reviewWords();if(!words.length){alertCustom('No words are due for review in this unit. Try a new quiz or flag a flashcard.');return;}const variant=currentUser.sequence%3+1;startQuestionPractice('review',variant,words);}
