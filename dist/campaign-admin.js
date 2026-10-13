(() => {
  'use strict';
  const data=window.CAMPAIGN;
  const $=selector=>document.querySelector(selector);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const panel=document.createElement('section');
  panel.className='campaign-admin';
  panel.innerHTML="<details id='campaignAdminGate'><summary><span class='chronicle-builder-mark' aria-hidden='true'>✎</span><span class='chronicle-builder-summary-copy'><strong>Редактор кампании</strong><small>Мастер · персонажи, места, правила и настройки</small></span><span class='chronicle-builder-toggle' aria-hidden='true'>+</span></summary><div class='campaign-admin-body'><p class='campaign-admin-intro'>Изменения сохраняются отдельно от Хроники. Скрытые записи можно вернуть из редактора. Карточки и текст останутся в архиве.</p><nav class='campaign-admin-tabs' aria-label='Разделы редактора'><button type='button' data-admin-tab='campaign' aria-pressed='true'>Кампания</button><button type='button' data-admin-tab='characters'>Игроки</button><button type='button' data-admin-tab='npcs'>Другие лица</button><button type='button' data-admin-tab='places'>Места</button><button type='button' data-admin-tab='mapGallery'>Атлас</button><button type='button' data-admin-tab='guide'>Правила</button><button type='button' data-admin-tab='preparation'>Подготовка</button><button type='button' data-admin-tab='specializations'>Специализации</button></nav><div id='campaignAdminPane'></div><div class='campaign-admin-footer'><button type='button' class='button small' id='campaignExport'>Скачать конфигурацию</button><span id='campaignAdminStatus' role='status' aria-live='polite'>Доступ открыт мастеру.</span></div></div></details>";
  const chronicle=$('#chronicle');
  chronicle.insertBefore(panel,$('#chronicleBuilder'));
  const gate=$('#campaignAdminGate'),pane=$('#campaignAdminPane'),status=$('#campaignAdminStatus');
  let unlocked=false,activeTab='campaign',entityIndex=-1,busy=false;
  const labels={characters:'Игровые персонажи',npcs:'Другие лица',places:'Места',mapGallery:'Иллюстрации атласа',guide:'Правила',preparation:'Подготовка',specializations:'Специализации'};
  const campaignFields=[
    ['party.label','Название кампании'],['party.edition','Номер пачки или сезона'],['campaignInfo.brand','Короткое название'],
    ['campaignInfo.system','Игровая система'],['campaignInfo.location','Место действия'],['campaignInfo.coordinates','Координаты или ориентир'],
    ['campaignInfo.sidebarNote','Заметка в боковой панели',1],['campaignInfo.heroEyebrow','Подзаголовок главной'],
    ['campaignInfo.heroTitle','Заголовок главной',1],['campaignInfo.heroIntro','Вступление на главной',1],
    ['campaignInfo.heroLocation','Подпись под главным изображением'],['campaignInfo.heroPhase','Подпись статуса кампании'],['campaignInfo.charactersLabel','Подпись раздела персонажей'],['campaignInfo.prepLabel','Подпись подготовки'],['campaignInfo.atlasTitle','Название атласа'],
    ['campaignInfo.atlasIntro','Вступление к атласу',1],['campaignInfo.mapLabel','Подпись карты'],
    ['campaignInfo.moodTitle','Заголовок настроения',1],['campaignInfo.moodText','Описание настроения',1],
    ['campaignInfo.mapImage','Файл или ссылка фона карты']
  ];
  function getPath(obj,path){return path.split('.').reduce((value,key)=>value&&value[key],obj);}
  function setPath(obj,path,value){const parts=path.split('.'),last=parts.pop(),target=parts.reduce((o,k)=>o[k]||(o[k]={}),obj);target[last]=value;}
  function ensureIds(){
    for(const pair of [['characters','character'],['npcs','npc'],['places','place'],['mapGallery','gallery'],['guide','guide'],['preparation','prep'],['specializations','spec']]){
      data[pair[0]]=Array.isArray(data[pair[0]])?data[pair[0]]:[];
      data[pair[0]].forEach((item,index)=>{if(!item.id)item.id=pair[1]+'-'+String(index+1).padStart(3,'0');});
    }
    data.campaignInfo=data.campaignInfo||{};
    data.party=data.party||{id:'campaign',label:'Новая кампания',edition:'01'};
  }
  function setStatus(message,error){status.textContent=message;status.dataset.error=String(!!error);}
  function field(name,label,value,multiline,rows){
    const input=multiline?'<textarea name="'+esc(name)+'" rows="'+(rows||3)+'">'+esc(value)+'</textarea>':'<input name="'+esc(name)+'" type="text" value="'+esc(value)+'">';
    return '<label class="campaign-field">'+esc(label)+input+'</label>';
  }
  function snapshot(){
    const keys=['party','campaignInfo','characters','npcs','places','mapGallery','preparation','guide','specializations'];
    return Object.fromEntries(keys.map(key=>[key,data[key]]));
  }
  function download(name,content,type){
    const url=URL.createObjectURL(new Blob([content],{type})),link=document.createElement('a');
    link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function persist(reload){
    if(busy)throw new Error('Сохранение уже выполняется.');
    busy=true;setStatus('Сохраняю содержимое кампании…');
    try{
      const response=await fetch('/api/campaign-content',{method:'POST',cache:'no-store',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:snapshot()})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.content)throw new Error(result.error||'Не удалось сохранить изменения.');
      Object.assign(data,result.content);window.CAMPAIGN=data;
      if(reload!==false){setStatus('Сохранено. Обновляю архив…');location.reload();}
      return result.content;
    }finally{busy=false;}
  }
  function renderCampaign(){
    const fields=campaignFields.map(row=>field(row[0],row[1],getPath(data,row[0])||'',!!row[2],3)).join('');
    pane.innerHTML='<form id="campaignSettingsForm" class="campaign-editor-grid">'+fields+
      '<label class="campaign-field campaign-field-wide">Загрузить фон карты<input type="file" accept="image/png,image/jpeg,image/webp" data-upload-target="campaignInfo.mapImage"></label>'+
      '<div class="campaign-form-actions campaign-field-wide"><button class="button primary" type="submit">Сохранить настройки</button><span class="small-text muted">Экспортируйте файл конфигурации после правок, чтобы сохранить их также в репозитории.</span></div></form>';
  }
  function schema(kind){
    if(kind==='characters'||kind==='npcs')return [['name','Имя'],['shortName','Короткое имя'],['role','Роль или занятие'],['portrait','Файл или ссылка на портрет'],['text','Краткое описание',1],['background','Краткое знакомство',1],['prompt','Вопросы для разговора',1],['note','Заметка',1]];
    if(kind==='places')return [['name','Название места'],['category','Категория'],['aliases','Другие названия через запятую'],['icon','Файл или ссылка на знак'],['image','Файл или ссылка на изображение'],['text','Описание места',1]];
    if(kind==='mapGallery')return [['name','Название иллюстрации'],['category','Категория'],['image','Файл или ссылка на изображение'],['text','Подпись',1]];
    if(kind==='guide')return [['title','Название правила'],['category','Раздел памятки'],['paragraphs','Текст: один абзац на строку',1],['example','Пример',1]];
    if(kind==='preparation')return [['text','Пункт подготовки',1]];
    return [['name','Название специализации'],['examples','Идеи через запятую',1]];
  }
  function getItemValue(item,key){
    if(key==='aliases'||key==='examples')return (item[key]||[]).join(', ');
    if(key==='paragraphs')return (item[key]||[]).join('\n');
    return item[key]||'';
  }
  function itemName(item){return item.name||item.title||item.text||'Без названия';}
  function renderEntity(){
    const kind=activeTab,list=data[kind]||[],item=entityIndex>=0?list[entityIndex]:null;
    const inputs=schema(kind).map(row=>field(row[0],row[1],item?getItemValue(item,row[0]):'',!!row[2],row[0]==='text'?4:3)).join('');
    const imageKey=(kind==='characters'||kind==='npcs')?'portrait':(kind==='places'||kind==='mapGallery')?'image':'';
    const upload=imageKey?'<label class="campaign-field campaign-field-wide">Загрузить изображение<input type="file" accept="image/png,image/jpeg,image/webp" data-upload-target="'+imageKey+'"></label>':'';
    const extra=kind==='places'?'<label class="campaign-field campaign-field-wide">Загрузить круглый знак места<input type="file" accept="image/png,image/jpeg,image/webp" data-upload-target="icon"></label>':'';
    const rows=list.map((entry,index)=>{
      const title=itemName(entry),hidden=entry.hidden===true;
      const toggle=hidden?'Вернуть':'Скрыть';
      const onMap=entry.onMap===false?'Разместить':'Снять с карты';
      return '<article class="campaign-admin-row '+(hidden?'is-hidden':'')+'"><div><strong>'+esc(title)+'</strong><small>'+(hidden?'Скрыто':'Опубликовано')+' · '+esc(entry.category||entry.role||'')+'</small></div><div class="campaign-row-actions"><button type="button" class="button small" data-edit-index="'+index+'">Изменить</button><button type="button" class="button small" data-toggle-hidden="'+index+'">'+toggle+'</button>'+
        (kind==='places'?'<button type="button" class="button small" data-map-toggle="'+index+'">'+onMap+'</button>':'')+'</div></article>';
    }).join('')||'<p class="empty-search">Записей пока нет. Добавьте первую.</p>';
    pane.innerHTML='<div class="campaign-entity-layout"><div class="campaign-admin-list"><div class="campaign-admin-list-head"><h3>'+esc(labels[kind])+'</h3><button type="button" class="button small" data-new-entry>＋ Добавить</button></div><div class="campaign-admin-rows">'+rows+'</div></div>'+
      '<form id="campaignEntityForm" class="campaign-editor-grid campaign-entity-form" data-kind="'+kind+'"><h3 class="campaign-field-wide">'+(item?'Редактирование записи':'Новая запись')+'</h3>'+inputs+upload+extra+
      '<div class="campaign-form-actions campaign-field-wide"><button class="button primary" type="submit">'+(item?'Сохранить запись':'Добавить запись')+'</button><button type="button" class="button" data-cancel-edit>Очистить форму</button><span class="small-text muted">'+(kind==='places'?'Новое место попадёт в список неразмещённых. Перетащите его на карту в Атласе.':'Скрытые записи можно вернуть позже.')+'</span></div></form></div>';
  }
  function switchTab(tab){
    activeTab=tab;entityIndex=-1;
    document.querySelectorAll('[data-admin-tab]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.adminTab===tab)));
    if(tab==='campaign')renderCampaign();else renderEntity();
  }
  async function unlockAccess(){
    try{
      const response=await fetch('/api/chronicle-access',{cache:'no-store',credentials:'same-origin'});
      const result=await response.json().catch(()=>({}));
      if(response.ok&&result.enabled&&result.authorized){unlock();return;}
      $('#campaignAdminPasswordStatus').textContent=result.error||'Введите пароль мастера.';
    }catch{$('#campaignAdminPasswordStatus').textContent='Не удалось проверить пароль. Попробуйте ещё раз.';}
    $('#campaignAdminPasswordDialog').showModal();$('#campaignAdminPassword').focus();
  }
  async function unlock(){
    try {
      const response=await fetch('/api/campaign-content?includeHidden=1',{cache:'no-store',credentials:'same-origin'});
      const result=await response.json().catch(()=>({}));
      if(response.ok&&result.content)Object.assign(data,result.content);
    } catch {}
    unlocked=true;window.CAMPAIGN_ADMIN_UNLOCKED=true;ensureIds();gate.open=true;switchTab(activeTab);setStatus('Доступ мастера открыт.');renderMapEditor();attachMapEditor();
  }
  function renderMapEditor(){
    let host=$('#campaignMapEditor');
    if(!host){host=document.createElement('section');host.id='campaignMapEditor';host.className='campaign-map-editor';const foot=document.querySelector('.map-foot');if(foot)foot.insertAdjacentElement('afterend',host);}
    const unplaced=data.places.filter(place=>!place.hidden&&place.onMap===false);
    host.innerHTML='<div class="campaign-admin-list-head"><div><span class="eyebrow">РАССТАНОВКА МЕСТ</span><h2>Перетащите место на карту</h2></div><span class="small-text muted">Отпустите место в нужной точке.</span></div><div class="campaign-map-unplaced">'+
      (unplaced.map(place=>'<button type="button" class="campaign-map-unplaced-item" draggable="true" data-place-id="'+esc(place.id)+'"><span class="map-admin-grip">⠿</span><strong>'+esc(place.name)+'</strong><small>Перетащить на карту</small></button>').join('')||'<p class="small-text muted">Все места размещены. Добавьте новое в редакторе.</p>')+'</div>';
    host.hidden=!unlocked;attachMapEditor();
  }
  async function savePosition(place,x,y,onMap){
    const old={x:place.x,y:place.y,onMap:place.onMap};
    place.x=Math.round(Math.max(0,Math.min(100,x))*100)/100;
    place.y=Math.round(Math.max(0,Math.min(100,y))*100)/100;
    place.onMap=onMap;
    try{
      await persist(false);window.dispatchEvent(new Event('campaign:map-changed'));renderMapEditor();
      setStatus(place.name+(onMap?' размещено на карте.':' снято с карты.'));return true;
    }catch(error){
      place.x=old.x;place.y=old.y;place.onMap=old.onMap;
      window.dispatchEvent(new Event('campaign:map-changed'));renderMapEditor();
      setStatus(error.message||'Не удалось сохранить карту.',true);return false;
    }
  }
  function attachMapEditor(){
    const stage=$('#mapStage'),markers=$('#markers');
    if(!stage||stage.dataset.adminMapBound)return;
    stage.dataset.adminMapBound='true';
    stage.addEventListener('dragover',event=>{if(unlocked&&[...event.dataTransfer.types].includes('text/campaign-place'))event.preventDefault();});
    stage.addEventListener('drop',event=>{
      if(!unlocked)return;
      const id=event.dataTransfer.getData('text/campaign-place'),place=data.places.find(item=>item.id===id);
      if(!place)return;
      event.preventDefault();const rect=stage.getBoundingClientRect();
      savePosition(place,(event.clientX-rect.left)/rect.width*100,(event.clientY-rect.top)/rect.height*100,true);
    });
    if(markers&&!markers.dataset.adminMapBound){
      markers.dataset.adminMapBound='true';
      markers.addEventListener('dragstart',event=>{
        if(!unlocked)return;const marker=event.target.closest('[data-place]');if(!marker)return;
        event.dataTransfer.setData('text/campaign-place',marker.dataset.place);event.dataTransfer.effectAllowed='move';
      });
    }
    if(markers&&!window.campaignAdminMapObserver){
      window.campaignAdminMapObserver=new MutationObserver(()=>{
        if(unlocked)markers.querySelectorAll('[data-place]').forEach(marker=>{marker.draggable=true;marker.classList.add('admin-draggable-marker');});
      });
      window.campaignAdminMapObserver.observe(markers,{childList:true});
    }
    if(unlocked&&markers)markers.querySelectorAll('[data-place]').forEach(marker=>{marker.draggable=true;marker.classList.add('admin-draggable-marker');});
    $('#campaignMapEditor')?.querySelectorAll('[data-place-id]').forEach(item=>{
      if(item.dataset.adminBound)return;item.dataset.adminBound='true';
      item.addEventListener('dragstart',event=>{event.dataTransfer.setData('text/campaign-place',item.dataset.placeId);event.dataTransfer.effectAllowed='move';});
    });
  }
  async function compressImage(file){
    if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Выберите PNG, JPG или WebP.');
    if(file.size>20*1024*1024)throw new Error('Файл больше 20 МБ.');
    let bitmap;try{bitmap=await createImageBitmap(file);}catch{throw new Error('Не удалось открыть изображение.');}
    const scale=Math.min(1,2200/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
    let blob=null;
    for(const quality of [.9,.84,.78,.7]){blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));if(blob&&blob.size<=3*1024*1024)break;}
    if(!blob||blob.size>3*1024*1024)throw new Error('Не удалось уменьшить изображение до 3 МБ.');
    const reader=new FileReader();
    const encoded=await new Promise((resolve,reject)=>{reader.onerror=()=>reject(new Error('Не удалось прочитать изображение.'));reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.readAsDataURL(blob);});
    const response=await fetch('/api/campaign-content',{method:'POST',cache:'no-store',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'upload-image',contentType:'image/webp',data:encoded})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok||!result.image||!result.image.url)throw new Error(result.error||'Не удалось загрузить изображение.');
    return result.image.url;
  }
  function entityValue(value,key){
    if(key==='aliases'||key==='examples')return value.split(',').map(item=>item.trim()).filter(Boolean);
    if(key==='paragraphs')return value.split(/\n+/).map(item=>item.trim()).filter(Boolean);
    return value;
  }
  async function submitEntity(form){
    const kind=form.dataset.kind,list=data[kind]||[],previous=entityIndex>=0?list[entityIndex]:{};
    const values={};new FormData(form).forEach((value,key)=>values[key]=String(value).trim());
    const item={...previous,id:previous.id||kind+'-'+Date.now(),hidden:false};
    schema(kind).forEach(row=>item[row[0]]=entityValue(values[row[0]]||'',row[0]));
    if(kind==='places'){
      item.x=Number.isFinite(Number(previous.x))?previous.x:50;item.y=Number.isFinite(Number(previous.y))?previous.y:50;
      item.onMap=entityIndex>=0?previous.onMap!==false:false;
    }
    const priorIndex=entityIndex;
    if(entityIndex<0){list.push(item);entityIndex=list.length-1;}else list[entityIndex]=item;
    data[kind]=list;
    try{await persist(true);}catch(error){entityIndex=priorIndex<0?list.length-1:priorIndex;renderEntity();setStatus(error.message||'Не удалось сохранить запись.',true);}
  }
  async function toggleHidden(index){
    const item=data[activeTab][index];if(!item)return;item.hidden=!item.hidden;
    try{await persist(true);}catch(error){item.hidden=!item.hidden;setStatus(error.message||'Не удалось сохранить.',true);}
  }
  async function toggleMap(index){
    const place=data.places[index];if(!place)return;
    await savePosition(place,place.x||50,place.y||50,place.onMap===false);
    renderEntity();
  }
  panel.addEventListener('click',event=>{
    const tab=event.target.closest('[data-admin-tab]');if(tab){switchTab(tab.dataset.adminTab);return;}
    if(event.target.closest('#campaignExport')){
      const source='// Конфигурация кампании. Сохраните файл в dist/campaign-config.js.\nwindow.CAMPAIGN_CONFIG = '+JSON.stringify(snapshot(),null,2)+';\n';
      download('campaign-config.js',source,'text/javascript;charset=utf-8');setStatus('Файл конфигурации скачан.');return;
    }
    if(event.target.closest('[data-new-entry]')){entityIndex=-1;renderEntity();return;}
    const edit=event.target.closest('[data-edit-index]');if(edit){entityIndex=Number(edit.dataset.editIndex);renderEntity();return;}
    const hide=event.target.closest('[data-toggle-hidden]');if(hide){toggleHidden(Number(hide.dataset.toggleHidden));return;}
    const map=event.target.closest('[data-map-toggle]');if(map){toggleMap(Number(map.dataset.mapToggle));return;}
    if(event.target.closest('[data-cancel-edit]')){entityIndex=-1;renderEntity();}
  });
  panel.addEventListener('submit',async event=>{
    if(event.target.id==='campaignSettingsForm'){
      event.preventDefault();new FormData(event.target).forEach((value,key)=>setPath(data,key,String(value).trim()));
      try{await persist(true);}catch(error){setStatus(error.message||'Не удалось сохранить настройки.',true);}
    }else if(event.target.id==='campaignEntityForm'){event.preventDefault();await submitEntity(event.target);}
  });
  panel.addEventListener('change',async event=>{
    const file=event.target,target=file.dataset.uploadTarget;
    if(!target||!file.files||!file.files[0])return;
    const input=file.closest('form')?.elements.namedItem(target);
    if(!input){setStatus('Не найдено поле для адреса изображения.',true);return;}
    try{setStatus('Загружаю и уменьшаю изображение…');input.value=await compressImage(file.files[0]);setStatus('Изображение загружено. Сохраните форму, чтобы добавить его в кампанию.');}
    catch(error){setStatus(error.message||'Не удалось загрузить изображение.',true);}
    finally{file.value='';}
  });
  gate.querySelector('summary').addEventListener('click',event=>{
    event.preventDefault();if(unlocked){gate.open=!gate.open;return;}unlockAccess();
  });
  const passwordDialog=document.createElement('dialog');
  passwordDialog.id='campaignAdminPasswordDialog';passwordDialog.className='chronicle-password-dialog';
  passwordDialog.innerHTML="<form id='campaignAdminPasswordForm' class='chronicle-password-form' autocomplete='off'><span class='eyebrow'>ДОСТУП МАСТЕРА</span><h2>Редактор кампании</h2><p>Введите пароль, чтобы редактировать материалы и настройки кампании.</p><label for='campaignAdminPassword'>Пароль мастера<input id='campaignAdminPassword' type='password' maxlength='512' autocomplete='off' required></label><p id='campaignAdminPasswordStatus' class='chronicle-password-status' role='status' aria-live='polite'>Введите пароль мастера.</p><div class='chronicle-password-actions'><button class='button' type='button' data-admin-close>Отмена</button><button class='button primary' type='submit'>Открыть редактор</button></div></form>";
  document.body.append(passwordDialog);
  passwordDialog.addEventListener('click',event=>{if(event.target.closest('[data-admin-close]'))passwordDialog.close();});
  passwordDialog.querySelector('form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;busy=true;
    const password=$('#campaignAdminPassword').value;$('#campaignAdminPasswordStatus').textContent='Проверяю пароль…';
    try{
      const response=await fetch('/api/chronicle-access',{method:'POST',cache:'no-store',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||result.authorized!==true)throw new Error(result.error||'Пароль не подошёл.');
      $('#campaignAdminPassword').value='';passwordDialog.close();await unlock();
    }catch(error){$('#campaignAdminPasswordStatus').textContent=error.message||'Не удалось проверить пароль.';$('#campaignAdminPassword').value='';}
    finally{busy=false;}
  });
  fetch('/api/chronicle-access',{cache:'no-store',credentials:'same-origin'}).then(response=>response.json()).then(result=>{if(result.authorized)unlock();}).catch(()=>{});
})();
