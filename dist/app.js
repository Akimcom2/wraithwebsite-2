(() => {
  'use strict';
  const data = window.CAMPAIGN;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = value => String(value ?? '').toLocaleLowerCase('ru').replace(/ё/g,'е');
  const asset = (folder, file) => 'assets/' + folder + '/' + encodeURIComponent(file);
  const prefix = 'zerkalie:' + data.party.id + ':v2:';
  let storageAvailable = true;
  const read = (key, fallback) => {
    try { const raw = localStorage.getItem(prefix + key); return raw ? JSON.parse(raw) : fallback; }
    catch { storageAvailable = false; return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(prefix + key, JSON.stringify(value)); return true; }
    catch { storageAvailable = false; return false; }
  };
  let toastTimer;
  function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4200); }
  const routes = {home:'Начало',characters:'Персонажи',atlas:'Атлас Ростова',guide:'За игровым столом',notebook:'Мой блокнот',chronicle:'Хроника'};
  let currentRoute = 'home';
  $('#partyLabel').textContent = data.party.label;
  $('#footerParty').textContent = data.party.label.toLocaleUpperCase('ru');
  $('.edition').textContent = data.party.edition;
  $('.hero-caption span:last-child').textContent = data.party.edition + ' · ДО ПЕРВОЙ ИГРЫ';
  function route() {
    let id = location.hash.slice(1) || 'home';
    if (id === 'map' || id === 'places') id = 'atlas';
    if (!routes[id]) id = 'home';
    const changed = id !== currentRoute;
    currentRoute = id;
    $$('.view').forEach(section => { section.hidden = section.id !== id; });
    $$('[data-nav]').forEach(link => { if (link.dataset.nav === id) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current'); });
    $('#currentSection').textContent = routes[id].toLocaleUpperCase('ru');
    document.title = 'Зеркалье · ' + data.party.label.toLocaleLowerCase('ru') + ' · ' + routes[id];
    if (id === 'atlas') requestAnimationFrame(() => { layoutMap(); });
    if (changed) { window.scrollTo({top:0,behavior:'auto'}); $('#main').focus({preventScroll:true}); }
  }
  window.addEventListener('hashchange', route);
  function go(id) { if (location.hash === '#' + id) route(); else location.hash = id; }
  const themeValue = read('theme','night');
  function theme(value) { const next = value === 'day' ? 'day' : 'night'; document.documentElement.dataset.theme = next; $('#themeToggle').setAttribute('aria-label', next === 'night' ? 'Включить светлую тему' : 'Включить тёмную тему'); $('#themeToggle').title = next === 'night' ? 'Светлая тема' : 'Тёмная тема'; write('theme',next); }
  theme(themeValue);
  $('#themeToggle').addEventListener('click', () => theme(document.documentElement.dataset.theme === 'day' ? 'night' : 'day'));

  $('#homePlacesCount').textContent = data.places.length + ' мест в атласе';
  $('#homeCharacters').innerHTML = data.characters.map((c,i) => `<button class="home-character" type="button" data-character="${i}" aria-label="Открыть карточку: ${esc(c.name)}"><img src="${asset('characters',c.portrait)}" alt="" loading="lazy"><span><h3>${esc(c.shortName || c.name)}</h3><small>${esc(c.role)} <span class="character-arrow">↗</span></small></span></button>`).join('');
  $('#characterCards').innerHTML = data.characters.map((c,i) => `<button class="character-card" type="button" data-character="${i}" aria-label="Открыть карточку: ${esc(c.name)}"><div class="portrait-frame"><span class="character-index">${String(i+1).padStart(2,'0')} / ${esc(data.party.label.toLocaleUpperCase('ru'))}</span><img src="${asset('characters',c.portrait)}" alt="Портрет: ${esc(c.name)}" loading="lazy"></div><div class="character-body"><h2>${esc(c.shortName || c.name)}</h2><span class="role">${esc(c.role)}</span><p>${esc(c.text)}</p><span class="card-action">Познакомиться ↗</span></div></button>`).join('');
  function dossier(index) {
    const c = data.characters[index]; if (!c) return;
    $('#dossierBody').innerHTML = `<div class="dossier-layout"><img class="dossier-portrait" src="${asset('characters',c.portrait)}" alt="Портрет: ${esc(c.name)}"><div class="dossier-content"><span class="eyebrow">${esc(data.party.label.toLocaleUpperCase('ru'))}</span><h2 id="dossierName">${esc(c.name)}</h2><span class="role">${esc(c.role)}</span><h3>Краткое знакомство</h3><p>${esc(c.background)}</p><h3>В разговоре</h3><p>${esc(c.prompt)}</p>${c.note ? `<p class="small-text" style="margin-top:20px">${esc(c.note)}</p>` : ''}<button type="button" class="button small" data-pick-character="${esc(c.name)}">Выбрать в своём блокноте ↗</button></div></div>`;
    $('#characterDialog').showModal();
  }
  $$('dialog').forEach(dialog => {
    dialog.addEventListener('click', e => {
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
    });
  });
  function imageDialog(name, url) { $('#imageTitle').textContent = name; $('#largeImage').src = url; $('#largeImage').alt = name; $('#downloadImage').href = url; $('#imageDialog').showModal(); }

  let query = '', category = 'all', onlyFavorites = false, selectedPlace = null;
  const favRead = read('favorites',[]);
  const favorites = new Set(Array.isArray(favRead) ? favRead.filter(id => data.places.some(p => p.id === id)) : []);
  const categories = ['Все', ...new Set(data.places.map(p => p.category))];
  $('#categoryFilters').innerHTML = categories.map((c,i) => `<button type="button" data-category="${esc(i === 0 ? 'all' : c)}" aria-pressed="${i === 0}">${esc(c)}</button>`).join('');
  function matchingPlaces() { return data.places.filter(p => (!query || norm(p.name + ' ' + p.text + ' ' + (p.aliases || []).join(' ')).includes(query)) && (category === 'all' || p.category === category) && (!onlyFavorites || favorites.has(p.id))); }
  function renderAtlas() {
    const visible = matchingPlaces();
    $('#placeCount').textContent = visible.length + ' / ' + data.places.length;
    $('#markers').innerHTML = visible.map(p => `<button class="marker ${selectedPlace === p.id ? 'selected' : ''}" type="button" style="left:${p.x}%;top:${p.y}%" data-place="${esc(p.id)}" aria-label="Открыть: ${esc(p.name)}"><img src="${asset('tokens',p.icon)}" alt=""><span class="tooltip">${esc(p.name)}</span></button>`).join('');
    $('#placeList').innerHTML = visible.map(p => `<button type="button" data-place="${esc(p.id)}" aria-pressed="${selectedPlace === p.id}"><img src="${asset('tokens',p.icon)}" alt=""><span>${esc(p.name)}</span><span class="list-arrow">${favorites.has(p.id) ? '★' : '↗'}</span></button>`).join('');
    $('#placeEmpty').hidden = visible.length > 0;
    const gallery = data.mapGallery.filter(p => (!query || norm(p.name + ' ' + p.text).includes(query)) && (category === 'all' || category === p.category) && !onlyFavorites);
    $('#mapGallery').innerHTML = gallery.map(p => `<button class="map-card" type="button" data-gallery="${esc(p.id)}" aria-label="Открыть иллюстрацию: ${esc(p.name)}"><img src="${asset('locations',p.image)}" alt="${esc(p.name)}" loading="lazy" decoding="async"><span class="map-card-meta"><strong>${esc(p.name)}</strong><small>Рассмотреть изображение ↗</small></span></button>`).join('');
    $('#galleryEmpty').hidden = gallery.length > 0;
    $('#favoriteFilter').innerHTML = (onlyFavorites ? '★' : '☆') + ' Избранное' + (favorites.size ? ' · ' + favorites.size : '');
  }
  function selectPlace(id, scroll = true) {
    const p = data.places.find(x => x.id === id); if (!p) return;
    selectedPlace = id;
    const url = p.image ? asset('locations',p.image) : 'assets/city-map.jpg';
    $('#detail').innerHTML = `<div class="detail-picture"><button type="button" data-image-place="${esc(id)}" aria-label="Рассмотреть изображение: ${esc(p.name)}"><img src="${url}" alt="${esc(p.name)}"><span class="image-hint">Рассмотреть ↗</span></button></div><div class="detail-body"><span class="eyebrow">${esc(p.category.toLocaleUpperCase('ru'))} / РОСТОВ-НА-ДОНУ</span><h2>${esc(p.name)}</h2><p>${esc(p.text)}</p><div class="detail-actions"><button type="button" class="button small" data-favorite="${esc(id)}" aria-pressed="${favorites.has(id)}">${favorites.has(id) ? '★ В избранном' : '☆ Сохранить место'}</button><button type="button" class="button small" data-note-place="${esc(id)}">✎ В блокнот</button></div></div>`;
    renderAtlas();
    if (scroll && innerWidth <= 950) $('#detail').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',block:'start'});
  }
  $('#placeSearch').addEventListener('input', e => { query = norm(e.target.value.trim()); renderAtlas(); });
  $('#favoriteFilter').addEventListener('click', () => { onlyFavorites = !onlyFavorites; $('#favoriteFilter').setAttribute('aria-pressed',String(onlyFavorites)); renderAtlas(); });
  let zoom = 1, baseWidth = 690;
  function layoutMap(reset = false) {
    if (currentRoute !== 'atlas') return;
    const frame = $('#mapFrame'); const stage = $('#mapStage');
    baseWidth = Math.max(frame.clientWidth,690);
    if (reset) zoom = 1;
    stage.style.width = Math.round(baseWidth * zoom) + 'px';
    $('#zoomValue').textContent = Math.round(zoom*100) + '%';
    $('#zoomOut').disabled = zoom <= 1; $('#zoomIn').disabled = zoom >= 2.4;
  }
  function changeZoom(step) {
    const frame = $('#mapFrame'); const stage = $('#mapStage');
    const x = (frame.scrollLeft+frame.clientWidth/2)/stage.clientWidth;
    const y = (frame.scrollTop+frame.clientHeight/2)/stage.clientHeight;
    zoom = Math.max(1,Math.min(2.4,Math.round((zoom+step)*10)/10)); layoutMap();
    frame.scrollLeft = x*stage.clientWidth-frame.clientWidth/2;
    frame.scrollTop = y*stage.clientHeight-frame.clientHeight/2;
  }
  $('#zoomIn').addEventListener('click',() => changeZoom(.2));
  $('#zoomOut').addEventListener('click',() => changeZoom(-.2));
  $('#zoomReset').addEventListener('click',() => {layoutMap(true); $('#mapFrame').scrollTo({left:0,top:0});});
  window.addEventListener('resize',() => layoutMap());

  const prepRead = read('prep',[]);
  const prep = new Set(Array.isArray(prepRead) ? prepRead.filter(id => data.preparation.some(x => x.id === id)) : []);
  $('#prepChecklist').innerHTML = data.preparation.map(item => `<label class="${prep.has(item.id) ? 'checked' : ''}"><input type="checkbox" data-prep="${esc(item.id)}" ${prep.has(item.id) ? 'checked' : ''}><span>${esc(item.text)}</span></label>`).join('');
  function updatePrep() { const count = prep.size + ' / ' + data.preparation.length; const progress = Math.round(prep.size/data.preparation.length*100); $('#prepCount').textContent = count; $('#prepBar').style.width = progress + '%'; $('#homePrepProgress').innerHTML = `<span>${count} готово</span><div class="mini-progress-track"><span style="width:${progress}%"></span></div>`; }
  $('#prepChecklist').addEventListener('change',e => {const id=e.target.dataset.prep;if(!id)return;e.target.checked?prep.add(id):prep.delete(id);e.target.closest('label').classList.toggle('checked',e.target.checked);write('prep',[...prep]);updatePrep();});
  let guideCategory = 'Все';
  const guideCategories = ['Все',...new Set(data.guide.map(g=>g.category))];
  $('#guideFilters').innerHTML = guideCategories.map(c=>`<button type="button" data-guide-filter="${esc(c)}" aria-pressed="${c === 'Все'}">${esc(c)}</button>`).join('');
  function renderGuide() { $('#guideCards').innerHTML = data.guide.filter(g=>guideCategory==='Все'||g.category===guideCategory).map(g=>`<details class="guide-card" id="guide-${esc(g.id)}"><summary>${esc(g.title)}</summary><div class="guide-answer">${g.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}${g.example ? `<p class="guide-example">${esc(g.example)}</p>` : ''}</div></details>`).join(''); }
  function specializationSearch(value = '') {const q=norm(value.trim());const rows=data.specializations.filter(s=>norm(s.name+' '+s.examples.join(' ')).includes(q));$('#specializationList').innerHTML=rows.map(s=>`<article class="specialization-card"><h3>${esc(s.name)}</h3><p>${s.examples.map(esc).join(' · ')}</p></article>`).join('');$('#specializationEmpty').hidden=rows.length>0;}
  $('#specializationSearch').addEventListener('input',e=>specializationSearch(e.target.value));

  let notes = read('notes',{character:'',facts:'',theories:'',questions:''});
  if (!notes || typeof notes !== 'object' || Array.isArray(notes)) notes = {};
  const fields = {facts:'#noteFacts',theories:'#noteTheories',questions:'#noteQuestions'};
  $('#notebookCharacter').innerHTML += data.characters.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
  function fillNotes() {$('#notebookCharacter').value = data.characters.some(c=>c.name===notes.character)?notes.character:'';for(const [k,s] of Object.entries(fields))$(s).value=typeof notes[k]==='string'?notes[k]:'';}
  let saveTimer;
  function saveNotes() {notes={character:$('#notebookCharacter').value,facts:$('#noteFacts').value,theories:$('#noteTheories').value,questions:$('#noteQuestions').value,updatedAt:new Date().toISOString()};const ok=write('notes',notes);$('#saveStatus').textContent=ok?'Сохранено на устройстве':'Не удалось сохранить. Скачайте копию.';return notes;}
  Object.values(fields).forEach(s=>$(s).addEventListener('input',()=>{$('#saveStatus').textContent='Сохраняю…';clearTimeout(saveTimer);saveTimer=setTimeout(saveNotes,350);}));
  $('#notebookCharacter').addEventListener('change',saveNotes);
  window.addEventListener('pagehide',saveNotes);
  function download(name,content,type) {const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $('#exportNotes').addEventListener('click',()=>{const n=saveNotes();const md='# Зеркалье · '+data.party.label+'\n\nПерсонаж: '+(n.character||'не выбран')+'\n\n## Что я заметил\n\n'+n.facts+'\n\n## Мои версии\n\n'+n.theories+'\n\n## Спросить мастера\n\n'+n.questions+'\n';download('zerkalie-'+data.party.id+'-notes.md',md,'text/markdown;charset=utf-8');});
  $('#backupNotes').addEventListener('click',()=>{download('zerkalie-'+data.party.id+'-backup.json',JSON.stringify({version:1,party:data.party.id,notes:saveNotes()},null,2),'application/json');});
  $('#importNotes').addEventListener('click',()=>$('#importFile').click());
  $('#importFile').addEventListener('change',async e=>{
    const f=e.target.files[0];if(!f)return;
    try {if(f.size>2000000)throw new Error('Файл слишком большой.');const o=JSON.parse(await f.text());if(o.version!==1||o.party!==data.party.id||!o.notes||typeof o.notes!=='object')throw new Error('Нужна резервная копия блокнота этой пачки.');for(const k of ['character','facts','theories','questions'])if(typeof o.notes[k]!=='string')throw new Error('Формат записей повреждён.');if(!confirm('Восстановить записи из файла? Текущий блокнот будет заменён.'))return;notes=o.notes;fillNotes();saveNotes();toast('Блокнот восстановлен.');}catch(error){toast(error.message || 'Не удалось прочитать файл.');}finally{e.target.value='';}
  });

  $('#timeline').innerHTML = data.chronicle.map((entry,i)=>`<article class="entry"><span class="eyebrow">СЕССИЯ ${String(i+1).padStart(2,'0')}</span><h2>${esc(entry.title)}</h2><p>${esc(entry.text)}</p></article>`).join('');
  $('#chronicleEmpty').hidden=data.chronicle.length>0;

  function openSearch() {$('#searchDialog').showModal();$('#globalSearch').value='';renderSearch('');$('#globalSearch').focus();}
  $('#searchOpen').addEventListener('click',openSearch);
  const searchIndex=[...data.characters.map((c,i)=>({title:c.name,text:c.role+' '+c.text,type:'Персонаж',action:'character',id:String(i)})),...data.places.map(p=>({title:p.name,text:p.text+' '+(p.aliases||[]).join(' '),type:'Место в Ростове',action:'place',id:p.id})),...data.guide.map(g=>({title:g.title,text:g.paragraphs.join(' '),type:'Памятка игрока',action:'guide',id:g.id})),{title:'Мой блокнот',text:'заметки факты версии вопросы экспорт резервная копия',type:'Личный архив',action:'route',id:'notebook'},{title:'Подготовка к первой игре',text:'foundry связь звук карточка',type:'До игры',action:'route',id:'guide'}];
  function renderSearch(value) {const q=norm(value.trim());const rows=q?searchIndex.filter(x=>norm(x.title+' '+x.text).includes(q)).slice(0,18):searchIndex.filter(x=>x.action==='route');$('#searchResults').innerHTML=rows.length?rows.map(x=>`<button class="search-result" type="button" data-search-action="${x.action}" data-search-id="${esc(x.id)}"><small>${esc(x.type.toLocaleUpperCase('ru'))}</small><strong>${esc(x.title)} ↗</strong></button>`).join(''):'<p class="search-empty">Совпадений нет. Попробуйте другое название.</p>';}
  $('#globalSearch').addEventListener('input',e=>renderSearch(e.target.value));
  document.addEventListener('keydown',e=>{const tag=e.target.tagName;const typing=['INPUT','TEXTAREA','SELECT'].includes(tag)||e.target.isContentEditable;if((e.key==='/'&&!typing)||(e.key.toLowerCase()==='k'&&(e.ctrlKey||e.metaKey))){if($$('dialog[open]').length)return;e.preventDefault();openSearch();}});
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.close){$('#'+b.dataset.close).close();return;}
    if(b.dataset.character!==undefined){dossier(Number(b.dataset.character));return;}
    if(b.dataset.pickCharacter){$('#notebookCharacter').value=b.dataset.pickCharacter;saveNotes();$('#characterDialog').close();go('notebook');return;}
    if(b.dataset.category){category=b.dataset.category;$$('[data-category]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.category===category)));renderAtlas();return;}
    if(b.dataset.place){selectPlace(b.dataset.place);return;}
    if(b.dataset.favorite){const id=b.dataset.favorite;favorites.has(id)?favorites.delete(id):favorites.add(id);write('favorites',[...favorites]);selectPlace(id,false);return;}
    if(b.dataset.notePlace){const p=data.places.find(x=>x.id===b.dataset.notePlace);if(p){$('#noteFacts').value+=($('#noteFacts').value?'\n\n':'')+p.name+'\n';saveNotes();go('notebook');setTimeout(()=>$('#noteFacts').focus(),100);}return;}
    if(b.dataset.imagePlace){const p=data.places.find(x=>x.id===b.dataset.imagePlace);if(p)imageDialog(p.name,p.image?asset('locations',p.image):'assets/city-map.jpg');return;}
    if(b.dataset.gallery){const p=data.mapGallery.find(x=>x.id===b.dataset.gallery);if(p)imageDialog(p.name,asset('locations',p.image));return;}
    if(b.dataset.guideFilter){guideCategory=b.dataset.guideFilter;$$('[data-guide-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.guideFilter===guideCategory)));renderGuide();return;}
    if(b.dataset.searchAction){const action=b.dataset.searchAction,id=b.dataset.searchId;$('#searchDialog').close();if(action==='character')dossier(Number(id));else if(action==='place'){query='';category='all';onlyFavorites=false;$('#placeSearch').value='';$('#favoriteFilter').setAttribute('aria-pressed','false');$$('[data-category]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.category==='all')));go('atlas');selectPlace(id,false);setTimeout(()=>$('#detail').scrollIntoView({block:'nearest'}),100);}else if(action==='guide'){guideCategory='Все';$$('[data-guide-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.guideFilter==='Все')));renderGuide();go('guide');setTimeout(()=>{const card=$('#guide-'+id);if(card){card.open=true;card.scrollIntoView({block:'nearest'});}},100);}else go(id);}
  });
  renderAtlas();updatePrep();renderGuide();specializationSearch();fillNotes();route();
  if(!storageAvailable)$('#saveStatus').textContent='Хранилище недоступно. Скачивайте копии.';
})();

