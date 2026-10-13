(() => {
  'use strict';
  const data = window.CAMPAIGN;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = value => String(value ?? '').toLocaleLowerCase('ru').replace(/ё/g,'е');
  const asset = (folder, file) => 'assets/' + folder + '/' + encodeURIComponent(file) + '?v=20261013-portrait-fix2';
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
  $('#npcCards').innerHTML = (data.npcs || []).map((c,i) => `<button class="character-card" type="button" data-npc-character="${i}" aria-label="Открыть карточку: ${esc(c.name)}"><div class="portrait-frame"><span class="character-index">${String(i+1).padStart(2,'0')} / ДРУГИЕ ЛИЦА</span><img src="${asset('characters',c.portrait)}" alt="Портрет: ${esc(c.name)}" loading="lazy"></div><div class="character-body"><h2>${esc(c.shortName || c.name)}</h2><span class="role">${esc(c.role)}</span><p>${esc(c.text)}</p><span class="card-action">Познакомиться ↗</span></div></button>`).join('');
  function dossier(index, group = 'characters') {
    const list = group === 'npcs' ? (data.npcs || []) : data.characters;
    const c = list[index]; if (!c) return;
    const pickAction = group === 'characters' ? `<button type="button" class="button small" data-pick-character="${esc(c.name)}">Выбрать в своём блокноте ↗</button>` : '';
    const eyebrow = group === 'npcs' ? 'ДРУГИЕ ЛИЦА' : data.party.label.toLocaleUpperCase('ru');
    $('#dossierBody').innerHTML = `<div class="dossier-layout"><img class="dossier-portrait" src="${asset('characters',c.portrait)}" alt="Портрет: ${esc(c.name)}"><div class="dossier-content"><span class="eyebrow">${esc(eyebrow)}</span><h2 id="dossierName">${esc(c.name)}</h2><span class="role">${esc(c.role)}</span><h3>Краткое знакомство</h3><p>${esc(c.background)}</p><h3>В разговоре</h3><p>${esc(c.prompt)}</p>${c.note ? `<p class="small-text" style="margin-top:20px">${esc(c.note)}</p>` : ''}${pickAction}</div></div>`;
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
    const url = p.image ? asset('locations',p.image) : 'assets/city-map.jpg?v=20261010-images2';
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

  let notes = read('notes',{playerName:'',character:'',facts:'',theories:'',questions:''});
  if (!notes || typeof notes !== 'object' || Array.isArray(notes)) notes = {};
  const fields = {facts:'#noteFacts',theories:'#noteTheories',questions:'#noteQuestions'};
  $('#notebookCharacter').innerHTML += data.characters.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
  function fillNotes() {$('#notebookPlayer').value=typeof notes.playerName==='string'?notes.playerName:'';$('#notebookCharacter').value = data.characters.some(c=>c.name===notes.character)?notes.character:'';for(const [k,s] of Object.entries(fields))$(s).value=typeof notes[k]==='string'?notes[k]:'';}
  let saveTimer;
  function saveNotes() {notes={playerName:$('#notebookPlayer').value.trim(),character:$('#notebookCharacter').value,facts:$('#noteFacts').value,theories:$('#noteTheories').value,questions:$('#noteQuestions').value,updatedAt:new Date().toISOString()};const ok=write('notes',notes);$('#saveStatus').textContent=ok?'Сохранено на устройстве':'Не удалось сохранить. Скачайте копию.';return notes;}
  Object.values(fields).concat('#notebookPlayer').forEach(s=>$(s).addEventListener('input',()=>{$('#saveStatus').textContent='Сохраняю…';clearTimeout(saveTimer);saveTimer=setTimeout(saveNotes,350);}));
  $('#notebookCharacter').addEventListener('change',saveNotes);
  window.addEventListener('pagehide',saveNotes);

  let journalDeliveryReady = false;
  let journalSending = false;
  const sendQuestionButton = $('#sendQuestion');
  const journalSendStatus = $('#journalSendStatus');
  async function checkJournalDelivery() {
    try {
      const response = await fetch('/api/submit-question', {cache:'no-store'});
      const result = await response.json();
      journalDeliveryReady = response.ok && result.enabled === true;
      sendQuestionButton.disabled = !journalDeliveryReady;
      journalSendStatus.textContent = journalDeliveryReady
        ? 'Подключение готово. Мастеру отправятся имя, персонаж и вопрос.'
        : 'Отправка пока не подключена мастером.';
    } catch {
      journalDeliveryReady = false;
      sendQuestionButton.disabled = true;
      journalSendStatus.textContent = 'Не удалось проверить подключение. Попробуйте позже.';
    }
  }
  sendQuestionButton.addEventListener('click', async () => {
    if (!journalDeliveryReady || journalSending) return;
    const n = saveNotes();
    if (!n.playerName) {
      journalSendStatus.textContent = 'Укажите имя игрока.';
      $('#notebookPlayer').focus();
      return;
    }
    if (!n.character) {
      journalSendStatus.textContent = 'Выберите персонажа.';
      $('#notebookCharacter').focus();
      return;
    }
    const question = n.questions.trim();
    if (!question) {
      journalSendStatus.textContent = 'Сначала напишите вопрос мастеру.';
      $('#noteQuestions').focus();
      return;
    }
    journalSending = true;
    sendQuestionButton.disabled = true;
    journalSendStatus.textContent = 'Отправляю вопрос мастеру…';
    try {
      const response = await fetch('/api/submit-question', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          party:data.party.label,
          player:n.playerName,
          character:n.character,
          question,
          website:$('#journalTrap').value
        })
      });
      const result = await response.json().catch(()=>({}));
      if (!response.ok || !result.ok) {
        if (response.status === 503) journalDeliveryReady = false;
        throw new Error(result.error || 'Не удалось отправить вопрос. Попробуйте позже.');
      }
      journalSendStatus.textContent = 'Вопрос отправлен мастеру. Он остался в блокноте.';
    } catch (error) {
      journalSendStatus.textContent = error.message || 'Не удалось отправить вопрос. Попробуйте позже.';
    } finally {
      journalSending = false;
      sendQuestionButton.disabled = !journalDeliveryReady;
    }
  });
  checkJournalDelivery();
  function download(name,content,type) {const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $('#exportNotes').addEventListener('click',()=>{const n=saveNotes();const md='# Зеркалье · '+data.party.label+'\n\nИгрок: '+(n.playerName||'не указано')+'\n\nПерсонаж: '+(n.character||'не выбран')+'\n\n## Что я заметил\n\n'+n.facts+'\n\n## Мои версии\n\n'+n.theories+'\n\n## Спросить мастера\n\n'+n.questions+'\n';download('zerkalie-'+data.party.id+'-notes.md',md,'text/markdown;charset=utf-8');});
  $('#backupNotes').addEventListener('click',()=>{download('zerkalie-'+data.party.id+'-backup.json',JSON.stringify({version:1,party:data.party.id,notes:saveNotes()},null,2),'application/json');});
  $('#importNotes').addEventListener('click',()=>$('#importFile').click());
  $('#importFile').addEventListener('change',async e=>{
    const f=e.target.files[0];if(!f)return;
    try {if(f.size>2000000)throw new Error('Файл слишком большой.');const o=JSON.parse(await f.text());if(o.version!==1||o.party!==data.party.id||!o.notes||typeof o.notes!=='object')throw new Error('Нужна резервная копия блокнота этой пачки.');for(const k of ['character','facts','theories','questions'])if(typeof o.notes[k]!=='string')throw new Error('Формат записей повреждён.');if(o.notes.playerName!==undefined&&typeof o.notes.playerName!=='string')throw new Error('Формат записей повреждён.');if(!confirm('Восстановить записи из файла? Текущий блокнот будет заменён.'))return;notes={...o.notes,playerName:typeof o.notes.playerName==='string'?o.notes.playerName:''};fillNotes();saveNotes();toast('Блокнот восстановлен.');}catch(error){toast(error.message || 'Не удалось прочитать файл.');}finally{e.target.value='';}
  });

  const staticChronicleEntries = data.chronicle.map((entry, index) => ({
    ...entry,
    sessionNumber:index + 1,
    source:'static'
  }));
  let savedChronicleEntries = [];
  let chronicleLoadComplete = false;
  let chronicleLoadFailed = false;
  let builtChronicleSessionNumber = null;
  const chronicleDraftOutput = $('#chronicleDraftOutput');
  const chronicleDraftStatus = $('#chronicleDraftStatus');
  const chronicleDraftSave = $('#chronicleDraftSave');
  const chronicleMemoryInput = $('#chronicleDraftMemories');
  const chronicleMemoryPreview = $('#chronicleMemoryPreview');
  const chronicleMemoryCount = $('#chronicleMemoryCount');
  let chronicleMemoryFiles = [];
  let chronicleMemoryProcessing = false;
  const chronicleDraftInputIds = [
    'chronicleDraftChapter',
    'chronicleDraftName',
    'chronicleDraftDate',
    'chronicleDraftSummary',
    'chronicleDraftKnown',
    'chronicleDraftNew',
    'chronicleDraftQuestions',
    'chronicleDraftEnding'
  ];
  function chronicleEntries() {
    return [...staticChronicleEntries, ...savedChronicleEntries]
      .sort((a,b) => (Number(a.sessionNumber) || 0) - (Number(b.sessionNumber) || 0));
  }
  function nextChronicleSessionNumber() {
    return chronicleEntries().reduce((max, entry) => Math.max(max, Number(entry.sessionNumber) || 0), 0) + 1;
  }
  function renderMemoryGallery(memories) {
    if (!Array.isArray(memories) || !memories.length) return '';
    return `<div class="entry-section memories-section"><h3>Воспоминания <span class="memory-total">${memories.length}</span></h3><div class="memory-gallery">${memories.slice(0,20).map(memory => `<button class="memory-card" type="button" data-memory-title="${esc(memory.title)}" data-memory-url="${esc(memory.url)}" aria-label="Открыть журнал: ${esc(memory.title)}"><img src="${esc(memory.url)}" alt="${esc(memory.title)}" loading="lazy" decoding="async"><span>${esc(memory.title)}</span></button>`).join('')}</div></div>`;
  }
  function renderChronicleEntry(entry, index) {
    const session = String(Number(entry.sessionNumber) || index + 1).padStart(2, '0');
    if (!entry.id) {
      return `<article class="entry"><span class="eyebrow">${entry.chapter ? 'ГЛАВА ' + esc(entry.chapter) + ' · ' : ''}СЕССИЯ ${session}</span><h2>${esc(entry.title)}</h2><p>${esc(entry.text)}</p>${renderMemoryGallery(entry.memories)}</article>`;
    }
    const sections = [
      ['Что герои узнали или увидели', entry.known],
      ['Новые места и лица', entry.newDetails],
      ['Открытые вопросы героев', entry.questions],
      ['Где остановились', entry.ending]
    ].filter(([, value]) => typeof value === 'string' && value.trim());
    return `<article class="entry" data-chronicle-entry="${esc(entry.id)}">
      <button class="chronicle-delete" type="button" data-chronicle-delete="${esc(entry.id)}" aria-label="Удалить запись «${esc(entry.title)}»" title="Удалить запись">×</button>
      <span class="eyebrow">ГЛАВА ${esc(entry.chapter)} · СЕССИЯ ${session}</span>
      ${entry.date ? `<p class="entry-date">${esc(entry.date)}</p>` : ''}
      <h2>${esc(entry.title)}</h2>
      <p class="entry-summary">${esc(entry.summary)}</p>
      ${sections.map(([title, value]) => `<div class="entry-section"><h3>${esc(title)}</h3><p>${esc(value)}</p></div>`).join('')}
      ${renderMemoryGallery(entry.memories)}
    </article>`;
  }
  function renderChronicle() {
    const entries = chronicleEntries();
    $('#timeline').innerHTML = entries.map(renderChronicleEntry).join('');
    $('#chronicleEmpty').hidden = entries.length > 0;
  }
  renderChronicle();

  async function loadSavedChronicle() {
    try {
      const response = await fetch('/api/chronicle', {cache:'no-store', credentials:'same-origin'});
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(result.entries)) throw new Error(result.error || 'Не удалось загрузить Хронику.');
      savedChronicleEntries = result.entries;
      renderChronicle();
    } catch (error) {
      chronicleLoadFailed = true;
      chronicleDraftStatus.textContent = error.message || 'Не удалось загрузить Хронику. Попробуйте позже.';
    } finally {
      chronicleLoadComplete = true;
    }
  }
  loadSavedChronicle();

  let chronicleDraftIsCurrent = false;
  function clearChronicleMemories() {
    chronicleMemoryFiles.forEach(memory => URL.revokeObjectURL(memory.previewUrl));
    chronicleMemoryFiles = [];
    chronicleMemoryInput.value = '';
    renderChronicleMemoryPreviews();
  }
  function renderChronicleMemoryPreviews() {
    chronicleMemoryCount.textContent = `${chronicleMemoryFiles.length} из 20 журналов`;
    chronicleMemoryPreview.innerHTML = chronicleMemoryFiles.map((memory,index) => `<figure class="chronicle-memory-preview-item"><button class="memory-remove" type="button" data-chronicle-memory-remove="${index}" aria-label="Убрать журнал: ${esc(memory.title)}" title="Убрать журнал">×</button><img src="${memory.previewUrl}" alt=""><figcaption>${esc(memory.title)}</figcaption></figure>`).join('');
  }
  function memoryTitleFromFile(file, index) {
    const title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0,120);
    return !title || /^[a-f0-9-]{30,}$/i.test(title) ? `Журнал ${index + 1}` : title;
  }
  async function optimizeChronicleImage(file) {
    if (!['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('Выбери PNG, JPG или WebP.');
    if (file.size > 20 * 1024 * 1024) throw new Error('Файл больше 20 МБ. Выбери изображение поменьше.');
    let bitmap;
    try { bitmap = await createImageBitmap(file); }
    catch { throw new Error('Не удалось открыть один из файлов.'); }
    const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    let result = null;
    for (const quality of [.9,.84,.78,.7]) {
      result = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
      if (result && result.size <= 3 * 1024 * 1024) return result;
    }
    throw new Error('Не удалось ужать журнал до допустимого размера.');
  }
  function imageBlobToBase64(blob) {
    return new Promise((resolve,reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Не удалось прочитать журнал.'));
      reader.onload = () => {
        const value = String(reader.result || '');
        const comma = value.indexOf(',');
        if (comma < 0) reject(new Error('Не удалось подготовить журнал к загрузке.'));
        else resolve(value.slice(comma + 1));
      };
      reader.readAsDataURL(blob);
    });
  }
  chronicleMemoryInput.addEventListener('change', async () => {
    chronicleDraftIsCurrent = false;
    chronicleDraftSave.disabled = true;
    chronicleDraftOutput.value = '';
    const files = [...chronicleMemoryInput.files];
    clearChronicleMemories();
    if (!files.length) {
      chronicleDraftStatus.textContent = 'Журналы не выбраны. Можно сохранить запись без изображений.';
      return;
    }
    if (files.length > 20) {
      chronicleDraftStatus.textContent = 'Можно добавить не больше 20 журналов за одну сессию.';
      return;
    }
    chronicleMemoryProcessing = true;
    chronicleMemoryInput.disabled = true;
    const prepared = [];
    chronicleDraftStatus.textContent = `Подготавливаю ${files.length} изображений…`;
    try {
      for (let i = 0; i < files.length; i++) {
        const blob = await optimizeChronicleImage(files[i]);
        prepared.push({title:memoryTitleFromFile(files[i],i), blob, previewUrl:URL.createObjectURL(blob), uploadedUrl:''});
        chronicleMemoryFiles = prepared;
        renderChronicleMemoryPreviews();
        chronicleDraftStatus.textContent = `Подготовлено ${i + 1} из ${files.length} изображений…`;
      }
      chronicleDraftStatus.textContent = `${prepared.length} журналов готовы. Собери черновик перед сохранением.`;
    } catch (error) {
      prepared.forEach(memory => URL.revokeObjectURL(memory.previewUrl));
      chronicleMemoryFiles = [];
      renderChronicleMemoryPreviews();
      chronicleMemoryInput.value = '';
      chronicleDraftStatus.textContent = error.message || 'Не удалось подготовить изображения.';
    } finally {
      chronicleMemoryProcessing = false;
      chronicleMemoryInput.disabled = false;
    }
  });
  function buildChronicleDraft() {
    if (chronicleMemoryProcessing) {
      chronicleDraftStatus.textContent = 'Подожди, пока изображения подготовятся.';
      return false;
    }
    if (!chronicleLoadComplete || chronicleLoadFailed) {
      chronicleDraftStatus.textContent = chronicleLoadFailed
        ? 'Не удалось загрузить Хронику. Обнови страницу и попробуй снова.'
        : 'Загружаю Хронику. Через пару секунд можно будет собрать черновик.';
      return false;
    }
    const chapter = $('#chronicleDraftChapter').value.trim();
    const chapterNumber = Number(chapter);
    const title = $('#chronicleDraftName').value.trim();
    const summary = $('#chronicleDraftSummary').value.trim();
    if (!Number.isInteger(chapterNumber) || chapterNumber < 1 || !title || !summary) {
      chronicleDraftIsCurrent = false;
      chronicleDraftSave.disabled = true;
      chronicleDraftOutput.value = '';
      chronicleDraftStatus.textContent = 'Заполни главу, короткое название и краткий итог сессии.';
      const missingField = !Number.isInteger(chapterNumber) || chapterNumber < 1
        ? $('#chronicleDraftChapter')
        : (!title ? $('#chronicleDraftName') : $('#chronicleDraftSummary'));
      missingField.focus();
      return false;
    }
    builtChronicleSessionNumber = nextChronicleSessionNumber();
    const sessionNumber = String(builtChronicleSessionNumber).padStart(2, '0');
    const lines = [
      'Обнови Хронику второй пачки по итогам сыгранной сессии ' + sessionNumber + '. Публикуй только то, что персонажи пережили, увидели или узнали. Не добавляй планы мастера, скрытые мотивы и будущие события.',
      '',
      '# Глава ' + chapterNumber + ' · Сессия ' + sessionNumber + ' · ' + title
    ];
    const date = $('#chronicleDraftDate').value;
    const known = $('#chronicleDraftKnown').value.trim();
    const newDetails = $('#chronicleDraftNew').value.trim();
    const questions = $('#chronicleDraftQuestions').value.trim();
    const ending = $('#chronicleDraftEnding').value.trim();
    if (date) lines.push('', '**Дата:** ' + date);
    lines.push('', '## Краткий итог', summary);
    if (known) lines.push('', '## Что герои узнали или увидели', known);
    if (newDetails) lines.push('', '## Новые места и лица для архива', newDetails);
    if (questions) lines.push('', '## Открытые вопросы героев', questions);
    if (ending) lines.push('', '## Где остановились', ending);
    if (chronicleMemoryFiles.length) lines.push('', '## Воспоминания', ...chronicleMemoryFiles.map(memory => '- ' + memory.title));
    chronicleDraftOutput.value = lines.join('\n');
    chronicleDraftIsCurrent = true;
    chronicleDraftSave.disabled = false;
    chronicleDraftStatus.textContent = 'Черновик собран. Проверь текст и нажми «Сохранить в Хронику», когда будешь готов.';
    return true;
  }
  $('#chronicleDraftBuild').addEventListener('click', buildChronicleDraft);
  $('#chronicleDraftCopy').addEventListener('click', async () => {
    if (!buildChronicleDraft()) return;
    try {
      await navigator.clipboard.writeText(chronicleDraftOutput.value);
      chronicleDraftStatus.textContent = 'Текст скопирован. Проверь его и сохрани в Хронику, когда будешь готов.';
    } catch {
      chronicleDraftOutput.focus();
      chronicleDraftOutput.select();
      chronicleDraftStatus.textContent = 'Автокопирование недоступно. Текст выделен: нажми Ctrl+C или ⌘C.';
    }
  });
  chronicleDraftInputIds.forEach(id => {
    $('#' + id).addEventListener('input', () => {
      chronicleDraftIsCurrent = false;
      chronicleDraftSave.disabled = true;
      chronicleDraftOutput.value = '';
      chronicleDraftStatus.textContent = 'Поля изменены. Собери черновик заново перед сохранением.';
    });
  });

  chronicleDraftSave.addEventListener('click', async () => {
    if (!chronicleDraftIsCurrent || chronicleDraftSave.disabled) return;
    if (builtChronicleSessionNumber !== nextChronicleSessionNumber()) {
      chronicleDraftIsCurrent = false;
      chronicleDraftSave.disabled = true;
      chronicleDraftStatus.textContent = 'Пока проверяли черновик, в Хронике появилась новая запись. Собери черновик заново и проверь его.';
      return;
    }
    const entry = {
      chapter:Number($('#chronicleDraftChapter').value),
      sessionNumber:nextChronicleSessionNumber(),
      title:$('#chronicleDraftName').value.trim(),
      date:$('#chronicleDraftDate').value,
      summary:$('#chronicleDraftSummary').value.trim(),
      known:$('#chronicleDraftKnown').value.trim(),
      newDetails:$('#chronicleDraftNew').value.trim(),
      questions:$('#chronicleDraftQuestions').value.trim(),
      ending:$('#chronicleDraftEnding').value.trim(),
      memories:[]
    };
    chronicleDraftSave.disabled = true;
    chronicleMemoryInput.disabled = true;
    $$('#chronicleMemoryPreview .memory-remove').forEach(button => { button.disabled = true; });
    try {
      for (let i = 0; i < chronicleMemoryFiles.length; i++) {
        const memory = chronicleMemoryFiles[i];
        if (!memory.uploadedUrl) {
          chronicleDraftStatus.textContent = `Загружаю журнал ${i + 1} из ${chronicleMemoryFiles.length}…`;
          const data = await imageBlobToBase64(memory.blob);
          const uploadResponse = await fetch('/api/chronicle', {
            method:'POST',
            cache:'no-store',
            credentials:'same-origin',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({action:'upload-memory', contentType:'image/webp', data})
          });
          const uploadResult = await uploadResponse.json().catch(() => ({}));
          if (!uploadResponse.ok || !uploadResult.memory || typeof uploadResult.memory.url !== 'string') {
            throw new Error(uploadResult.error || 'Не удалось загрузить журнал.');
          }
          memory.uploadedUrl = uploadResult.memory.url;
        }
        entry.memories.push({title:memory.title, url:memory.uploadedUrl});
      }
      chronicleDraftStatus.textContent = 'Сохраняю запись…';
      const response = await fetch('/api/chronicle', {
        method:'POST',
        cache:'no-store',
        credentials:'same-origin',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({entry})
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(result.entries)) {
        throw new Error(result.error || 'Не удалось сохранить запись.');
      }
      savedChronicleEntries = result.entries;
      renderChronicle();
      chronicleDraftInputIds.forEach(id => { $('#' + id).value = ''; });
      clearChronicleMemories();
      chronicleDraftOutput.value = '';
      chronicleDraftIsCurrent = false;
      chronicleDraftStatus.textContent = 'Запись опубликована в Хронике.';
      toast('Запись добавлена в Хронику.');
      requestAnimationFrame(() => {
        const card = document.querySelector('[data-chronicle-entry="' + CSS.escape(result.entry.id) + '"]');
        if (card) card.scrollIntoView({behavior:'smooth', block:'center'});
      });
    } catch (error) {
      chronicleDraftSave.disabled = false;
      chronicleDraftStatus.textContent = error.message || 'Не удалось сохранить запись. Попробуй ещё раз.';
    } finally {
      chronicleMemoryInput.disabled = false;
      $$('#chronicleMemoryPreview .memory-remove').forEach(button => { button.disabled = false; });
    }
  });

  const chronicleBuilder = $('#chronicleBuilder');
  const chroniclePasswordDialog = $('#chroniclePasswordDialog');
  const chroniclePasswordForm = $('#chroniclePasswordForm');
  const chroniclePasswordInput = $('#chroniclePasswordInput');
  const chroniclePasswordStatus = $('#chroniclePasswordStatus');
  const chroniclePasswordIntro = $('#chroniclePasswordIntro');
  const chroniclePasswordTitle = $('#chroniclePasswordTitle');
  const chroniclePasswordSubmit = $('#chroniclePasswordSubmit');
  let chronicleAccessChecking = false;
  let chroniclePasswordSubmitting = false;
  let chroniclePasswordMode = 'unlock';
  let pendingChronicleDeleteId = '';

  function openChroniclePasswordDialog(mode, message) {
    chroniclePasswordMode = mode;
    chroniclePasswordForm.reset();
    chroniclePasswordTitle.textContent = mode === 'delete' ? 'Удалить запись?' : 'Итоги сессии';
    chroniclePasswordIntro.textContent = mode === 'delete'
      ? 'Введите пароль мастера, чтобы удалить эту запись из Хроники.'
      : 'Введите пароль, чтобы открыть шаблон публикации.';
    chroniclePasswordSubmit.textContent = mode === 'delete' ? 'Удалить запись' : 'Открыть шаблон';
    chroniclePasswordStatus.textContent = message || 'Введите пароль мастера.';
    chroniclePasswordDialog.showModal();
    chroniclePasswordInput.focus();
  }
  async function checkChronicleAccess() {
    try {
      const response = await fetch('/api/chronicle-access', {cache:'no-store', credentials:'same-origin'});
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.enabled !== true) {
        return {authorized:false, message:result.error || 'Не удалось проверить доступ. Попробуйте позже.'};
      }
      return {authorized:result.authorized === true, message:''};
    } catch {
      return {authorized:false, message:'Не удалось проверить доступ. Попробуйте позже.'};
    }
  }
  chronicleBuilder.querySelector('summary').addEventListener('click', async event => {
    if (chronicleBuilder.open) return;
    event.preventDefault();
    if (chronicleAccessChecking) return;
    chronicleAccessChecking = true;
    try {
      const access = await checkChronicleAccess();
      if (access.authorized) {
        chronicleBuilder.open = true;
        return;
      }
      openChroniclePasswordDialog('unlock', access.message || 'Введите пароль мастера.');
    } finally {
      chronicleAccessChecking = false;
    }
  });
  chroniclePasswordForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (chroniclePasswordSubmitting) return;
    chroniclePasswordSubmitting = true;
    chroniclePasswordSubmit.disabled = true;
    chroniclePasswordStatus.textContent = 'Проверяю пароль…';
    try {
      const password = chroniclePasswordInput.value;
      if (chroniclePasswordMode === 'delete') {
        const response = await fetch('/api/chronicle', {
          method:'DELETE',
          cache:'no-store',
          credentials:'same-origin',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({id:pendingChronicleDeleteId, password})
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(result.entries)) {
          throw new Error(result.error || 'Не удалось удалить запись.');
        }
        savedChronicleEntries = result.entries;
        renderChronicle();
        chroniclePasswordInput.value = '';
        pendingChronicleDeleteId = '';
        chroniclePasswordDialog.close();
        toast('Запись удалена из Хроники.');
        return;
      }

      const response = await fetch('/api/chronicle-access', {
        method:'POST',
        cache:'no-store',
        credentials:'same-origin',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({password})
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.authorized === true) {
        chroniclePasswordInput.value = '';
        chroniclePasswordDialog.close();
        chronicleBuilder.open = true;
        chronicleBuilder.querySelector('summary').focus();
      } else {
        throw new Error(response.status === 401
          ? 'Пароль не подошёл. Проверьте раскладку и попробуйте ещё раз.'
          : result.error || 'Не удалось проверить пароль. Попробуйте позже.');
      }
    } catch (error) {
      chroniclePasswordStatus.textContent = error.message || 'Не удалось выполнить действие. Попробуйте ещё раз.';
      chroniclePasswordInput.value = '';
      chroniclePasswordInput.focus();
    } finally {
      chroniclePasswordSubmitting = false;
      chroniclePasswordSubmit.disabled = false;
    }
  });
  chroniclePasswordDialog.addEventListener('close', () => {
    chroniclePasswordInput.value = '';
    if (chroniclePasswordMode === 'delete') pendingChronicleDeleteId = '';
    chroniclePasswordMode = 'unlock';
  });

  function openSearch() {$('#searchDialog').showModal();$('#globalSearch').value='';renderSearch('');$('#globalSearch').focus();}
  $('#searchOpen').addEventListener('click',openSearch);
  const searchIndex=[...data.characters.map((c,i)=>({title:c.name,text:c.role+' '+c.text,type:'Персонаж',action:'character',id:String(i)})),...(data.npcs||[]).map((c,i)=>({title:c.name,text:c.role+' '+c.text,type:'Другие лица',action:'npc',id:String(i)})),...data.places.map(p=>({title:p.name,text:p.text+' '+(p.aliases||[]).join(' '),type:'Место в Ростове',action:'place',id:p.id})),...data.guide.map(g=>({title:g.title,text:g.paragraphs.join(' '),type:'Памятка игрока',action:'guide',id:g.id})),{title:'Мой блокнот',text:'заметки факты версии вопросы экспорт резервная копия',type:'Личный архив',action:'route',id:'notebook'},{title:'Подготовка к первой игре',text:'foundry связь звук карточка',type:'До игры',action:'route',id:'guide'}];
  function renderSearch(value) {const q=norm(value.trim());const rows=q?searchIndex.filter(x=>norm(x.title+' '+x.text).includes(q)).slice(0,18):searchIndex.filter(x=>x.action==='route');$('#searchResults').innerHTML=rows.length?rows.map(x=>`<button class="search-result" type="button" data-search-action="${x.action}" data-search-id="${esc(x.id)}"><small>${esc(x.type.toLocaleUpperCase('ru'))}</small><strong>${esc(x.title)} ↗</strong></button>`).join(''):'<p class="search-empty">Совпадений нет. Попробуйте другое название.</p>';}
  $('#globalSearch').addEventListener('input',e=>renderSearch(e.target.value));
  document.addEventListener('keydown',e=>{const tag=e.target.tagName;const typing=['INPUT','TEXTAREA','SELECT'].includes(tag)||e.target.isContentEditable;if((e.key==='/'&&!typing)||(e.key.toLowerCase()==='k'&&(e.ctrlKey||e.metaKey))){if($$('dialog[open]').length)return;e.preventDefault();openSearch();}});
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.chronicleDelete){pendingChronicleDeleteId=b.dataset.chronicleDelete;openChroniclePasswordDialog('delete');return;}
    if(b.dataset.chronicleMemoryRemove!==undefined){const index=Number(b.dataset.chronicleMemoryRemove);if(Number.isInteger(index)&&chronicleMemoryFiles[index]){URL.revokeObjectURL(chronicleMemoryFiles[index].previewUrl);chronicleMemoryFiles.splice(index,1);renderChronicleMemoryPreviews();chronicleDraftIsCurrent=false;chronicleDraftSave.disabled=true;chronicleDraftOutput.value='';chronicleDraftStatus.textContent='Список воспоминаний изменён. Собери черновик заново.';}return;}
    if(b.dataset.memoryUrl){imageDialog(b.dataset.memoryTitle||'Воспоминание',b.dataset.memoryUrl);return;}
    if(b.dataset.close){$('#'+b.dataset.close).close();return;}
    if(b.dataset.character!==undefined){dossier(Number(b.dataset.character));return;}
    if(b.dataset.npcCharacter!==undefined){dossier(Number(b.dataset.npcCharacter),'npcs');return;}
    if(b.dataset.pickCharacter){$('#notebookCharacter').value=b.dataset.pickCharacter;saveNotes();$('#characterDialog').close();go('notebook');return;}
    if(b.dataset.category){category=b.dataset.category;$$('[data-category]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.category===category)));renderAtlas();return;}
    if(b.dataset.place){selectPlace(b.dataset.place);return;}
    if(b.dataset.favorite){const id=b.dataset.favorite;favorites.has(id)?favorites.delete(id):favorites.add(id);write('favorites',[...favorites]);selectPlace(id,false);return;}
    if(b.dataset.notePlace){const p=data.places.find(x=>x.id===b.dataset.notePlace);if(p){$('#noteFacts').value+=($('#noteFacts').value?'\n\n':'')+p.name+'\n';saveNotes();go('notebook');setTimeout(()=>$('#noteFacts').focus(),100);}return;}
    if(b.dataset.imagePlace){const p=data.places.find(x=>x.id===b.dataset.imagePlace);if(p)imageDialog(p.name,p.image?asset('locations',p.image):'assets/city-map.jpg?v=20261010-images2');return;}
    if(b.dataset.gallery){const p=data.mapGallery.find(x=>x.id===b.dataset.gallery);if(p)imageDialog(p.name,asset('locations',p.image));return;}
    if(b.dataset.guideFilter){guideCategory=b.dataset.guideFilter;$$('[data-guide-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.guideFilter===guideCategory)));renderGuide();return;}
    if(b.dataset.searchAction){const action=b.dataset.searchAction,id=b.dataset.searchId;$('#searchDialog').close();if(action==='character')dossier(Number(id));else if(action==='npc')dossier(Number(id),'npcs');else if(action==='place'){query='';category='all';onlyFavorites=false;$('#placeSearch').value='';$('#favoriteFilter').setAttribute('aria-pressed','false');$$('[data-category]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.category==='all')));go('atlas');selectPlace(id,false);setTimeout(()=>$('#detail').scrollIntoView({block:'nearest'}),100);}else if(action==='guide'){guideCategory='Все';$$('[data-guide-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.guideFilter==='Все')));renderGuide();go('guide');setTimeout(()=>{const card=$('#guide-'+id);if(card){card.open=true;card.scrollIntoView({block:'nearest'});}},100);}else go(id);}
  });
  renderAtlas();updatePrep();renderGuide();specializationSearch();fillNotes();route();
  if(!storageAvailable)$('#saveStatus').textContent='Хранилище недоступно. Скачивайте копии.';
})();


