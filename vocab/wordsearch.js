// Clue-based puzzles. Every accepted grid contains every target word.
const wsDirections=[[0,1],[0,-1],[1,0],[-1,0],[1,1],[-1,-1],[1,-1],[-1,1]];
let wsAnchor=null,wsGesture=null,wsSelectionPath=[];
const searchSpelling=word=>word.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z]/g,'');
function openWordSearchSectionModal(){if(currentUser)$('modal-ws-section').showModal();}
function makeWordSearchClue(w,index,section){const choice=(index+w.unit+section)%3;if(choice===0)return 'Synonym: '+cleanRelation(w.synonyms);if(choice===1&&w.antonyms)return 'Antonym: '+cleanRelation(w.antonyms);return 'Definition: '+w.def;}
function tryBuildWordSearch(words,size){
  const ordered=[...words].sort((a,b)=>b.length-a.length);
  for(let restart=0;restart<60;restart++){
    const grid=Array.from({length:size},()=>Array(size).fill('')),placements=[];
    for(const word of ordered){
      const candidates=[];
      for(const d of wsDirections)for(let r=0;r<size;r++)for(let c=0;c<size;c++){
        const er=r+(word.length-1)*d[0],ec=c+(word.length-1)*d[1];if(er<0||ec<0||er>=size||ec>=size)continue;
        let valid=true,overlaps=0;
        for(let i=0;i<word.length;i++){const letter=grid[r+i*d[0]][c+i*d[1]];if(letter&&letter!==word[i]){valid=false;break;}if(letter)overlaps++;}
        if(valid)candidates.push({word,r,c,d,score:overlaps*8+Math.random()*4});
      }
      if(!candidates.length)break;candidates.sort((a,b)=>b.score-a.score);const p=candidates[Math.floor(Math.random()*Math.min(8,candidates.length))];
      for(let i=0;i<word.length;i++)grid[p.r+i*p.d[0]][p.c+i*p.d[1]]=word[i];placements.push(p);
    }
    if(placements.length!==words.length||placements.filter(p=>p.d[0]&&p.d[1]).length<3||placements.filter(p=>p.d[0]<0||(p.d[0]===0&&p.d[1]<0)).length<3)continue;
    const letters=words.join('')+'EEEEAAAARRRIIIOOONNNTTTSSSLLLCCDD';
    for(let r=0;r<size;r++)for(let c=0;c<size;c++)if(!grid[r][c])grid[r][c]=letters[Math.floor(Math.random()*letters.length)];
    return {size,grid,placements};
  }return null;
}
function startWordSearchSection(section){
  if(!currentUser||![1,2].includes(section))return;
  const entries=vocabData[currentUnit].slice((section-1)*10,section*10).map((w,index)=>({word:w.word,spelling:searchSpelling(w.word),clue:makeWordSearchClue(w,index,section)}));
  const requested=Number($('ws-difficulty').value)===17?17:15;
  let built=null;for(const size of [requested,requested+1,requested+2]){built=tryBuildWordSearch(entries.map(e=>e.spelling),size);if(built)break;}
  if(!built){alertCustom('This puzzle could not be arranged. Please try again or choose another grid size.');return;}
  prepareActivity();wsRun=makeAttempt('wordsearch','Word Search · Section '+section);Object.assign(wsRun,built,{section,entries,found:[],hints:[],foundCells:[]});
  $('modal-ws-section').close();$('ws-large').checked=false;renderWordSearchUI();navigate('game-wordsearch');
}
function renderWordSearchUI(){
  const run=wsRun;if(!run)return;cancelWordSelection();const grid=$('ws-grid');grid.classList.remove('large');grid.style.gridTemplateColumns=`repeat(${run.size},minmax(0,1fr))`;grid.setAttribute('aria-rowcount',run.size);grid.setAttribute('aria-colcount',run.size);
  grid.innerHTML=run.grid.map((row,r)=>`<div class="ws-row" role="row">${row.map((letter,c)=>`<button class="ws-cell" role="gridcell" data-r="${r}" data-c="${c}" tabindex="${r===0&&c===0?0:-1}" aria-label="Row ${r+1}, column ${c+1}, ${letter}" aria-selected="false">${letter}</button>`).join('')}</div>`).join('');
  $('ws-section-badge').textContent='Unit '+run.unit+' · Section '+run.section+' · '+run.size+' × '+run.size;$('ws-feedback').textContent='Solve a clue, then select its word.';$('ws-finish').hidden=true;renderWordSearchClues();
}
function renderWordSearchClues(){
  const run=wsRun;$('ws-count').textContent=run.found.length+' / '+run.entries.length;
  $('ws-word-list').innerHTML=run.entries.map((entry,index)=>{const found=run.found.includes(entry.spelling),hinted=run.hints.includes(entry.spelling);return `<div class="ws-clue ${found?'found':''}"><strong>${index+1}. ${found?'✓ '+escapeHTML(entry.word)+' — ':''}</strong>${escapeHTML(entry.clue)} <small>(${entry.spelling.length} letters)</small>${!found?(hinted?`<p class="small">Hint: ${escapeHTML(entry.word)}. Its first square has an amber border.</p>`:`<button data-action="ws-hint" data-index="${index}" aria-label="Hint for clue ${index+1}">Hint −3 XP</button>`):''}</div>`;}).join('');
}
function wsCell(r,c){return $('ws-grid').querySelector(`[data-r="${r}"][data-c="${c}"]`);}
function coord(cell){return cell?{r:Number(cell.dataset.r),c:Number(cell.dataset.c)}:null;}
function sameCoord(a,b){return a&&b&&a.r===b.r&&a.c===b.c;}
function clearWordSelection(){if($('ws-grid'))$('ws-grid').querySelectorAll('[aria-selected="true"]').forEach(cell=>cell.setAttribute('aria-selected','false'));wsSelectionPath=[];}
function cancelWordSelection(){clearWordSelection();wsAnchor=null;wsGesture=null;}
function setWordSelection(start,end){
  clearWordSelection();if(!start||!end||!wsRun)return false;
  const dr=end.r-start.r,dc=end.c-start.c;if(dr!==0&&dc!==0&&Math.abs(dr)!==Math.abs(dc))return false;
  const length=Math.max(Math.abs(dr),Math.abs(dc)),stepR=Math.sign(dr),stepC=Math.sign(dc);
  for(let i=0;i<=length;i++){const r=start.r+i*stepR,c=start.c+i*stepC,cell=wsCell(r,c);if(!cell){clearWordSelection();return false;}wsSelectionPath.push({r,c});cell.setAttribute('aria-selected','true');}
  return true;
}
function finishWordSelection(){
  if(!wsRun||wsRun.completed){cancelWordSelection();return;}
  const letters=wsSelectionPath.map(p=>wsRun.grid[p.r][p.c]).join(''),reverse=[...letters].reverse().join('');
  const entry=wsRun.entries.find(e=>e.spelling===letters||e.spelling===reverse);
  if(entry&&!wsRun.found.includes(entry.spelling)){
    wsRun.found.push(entry.spelling);for(const p of wsSelectionPath){wsCell(p.r,p.c).classList.add('found');wsRun.foundCells.push(p);}
    progressFor(entry.word).seen=true;saveUser();$('ws-feedback').textContent='Found '+entry.word+'. '+byWord.get(entry.word).def;renderWordSearchClues();
    if(wsRun.found.length===wsRun.entries.length){$('ws-finish').hidden=false;$('ws-feedback').textContent='All '+wsRun.entries.length+' words found. '+wsRun.hints.length+' hint(s) used. Select View puzzle results to finish.';}
  }else $('ws-feedback').textContent=entry?'You have already found that word.':'No new word found. Follow a straight line between the first and last letters.';
  cancelWordSelection();
}
function gridCellAtEvent(event){const cell=document.elementFromPoint(event.clientX,event.clientY)?.closest('.ws-cell');return cell&&$('ws-grid').contains(cell)?cell:null;}
function wsPointerDown(event){
  if(!wsRun||wsRun.completed||currentView!=='game-wordsearch'||(event.button!==undefined&&event.button!==0))return;
  const cell=event.target.closest('.ws-cell');if(!cell||!$('ws-grid').contains(cell))return;event.preventDefault();
  const point=coord(cell),hadAnchor=!!wsAnchor;wsGesture={start:wsAnchor||point,hadAnchor,moved:false};wsAnchor=wsGesture.start;setWordSelection(wsAnchor,point);
  focusGridCell(cell);try{$('ws-grid').setPointerCapture(event.pointerId);}catch{}
}
function wsPointerMove(event){if(!wsGesture)return;const cell=gridCellAtEvent(event);if(!cell)return;const point=coord(cell);if(!sameCoord(point,wsGesture.start))wsGesture.moved=true;setWordSelection(wsGesture.start,point);}
function wsPointerUp(event){if(!wsGesture)return;const gesture=wsGesture;wsGesture=null;try{$('ws-grid').releasePointerCapture(event.pointerId);}catch{}if(gesture.moved||gesture.hadAnchor)finishWordSelection();else $('ws-feedback').textContent='Start selected. Tap the final letter, or drag to it. Escape cancels.';}
function focusGridCell(cell){$('ws-grid').querySelectorAll('[tabindex="0"]').forEach(el=>el.tabIndex=-1);cell.tabIndex=0;cell.focus({preventScroll:true});}
function wsKeyDown(event){
  if(!wsRun||wsRun.completed||currentView!=='game-wordsearch')return;const cell=event.target.closest('.ws-cell');if(!cell)return;
  const p=coord(cell),moves={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]};
  if(event.key==='Escape'){event.preventDefault();cancelWordSelection();$('ws-feedback').textContent='Selection cancelled.';return;}
  if(event.key==='Enter'||event.key===' '){event.preventDefault();if(wsAnchor){setWordSelection(wsAnchor,p);finishWordSelection();}else{wsAnchor=p;setWordSelection(p,p);$('ws-feedback').textContent='Start selected. Move to the final letter and press Enter.';}return;}
  if(moves[event.key]||['Home','End'].includes(event.key)){event.preventDefault();let r=p.r,c=p.c;if(moves[event.key]){r=Math.max(0,Math.min(wsRun.size-1,r+moves[event.key][0]));c=Math.max(0,Math.min(wsRun.size-1,c+moves[event.key][1]));}else c=event.key==='Home'?0:wsRun.size-1;const target=wsCell(r,c);focusGridCell(target);if(wsAnchor)setWordSelection(wsAnchor,{r,c});}
}
function wordSearchHint(index){
  if(!wsRun||wsRun.completed)return;const entry=wsRun.entries[index];if(!entry||wsRun.found.includes(entry.spelling)||wsRun.hints.includes(entry.spelling))return;
  const p=wsRun.placements.find(p=>p.word===entry.spelling);wsRun.hints.push(entry.spelling);wsCell(p.r,p.c).classList.add('hint');const progress=progressFor(entry.word);progress.flagged=true;progress.due=Date.now();saveUser();renderWordSearchClues();$('ws-feedback').textContent='Hint: '+entry.word+'. Start at row '+(p.r+1)+', column '+(p.c+1)+'.';
}
function finishWordSearch(){if(!wsRun||wsRun.completed||wsRun.found.length!==wsRun.entries.length)return;finishRun(wsRun,{score:wsRun.found.length+' / '+wsRun.entries.length+' found',total:wsRun.entries.length,xp:Math.max(5,25-3*wsRun.hints.length),detail:wsRun.hints.length+' hint(s) used. Word search rewards completion; use quizzes to demonstrate meaning and context mastery.'});}
