const data = window.CAMPAIGN;
const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const asset = (folder, file) => 'assets/' + folder + '/' + encodeURIComponent(file);
const buttons = [...document.querySelectorAll('.nav')];

function show(id) {
  document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === id));
  buttons.forEach(button => button.classList.toggle('active', button.dataset.view === id));
  window.scrollTo({top: 0, behavior: 'smooth'});
}
buttons.forEach(button => button.addEventListener('click', () => show(button.dataset.view)));

function selectPlace(index) {
  const place = data.places[index];
  const picture = place.image
    ? `<img class="detail-figure" src="${asset('locations', place.image)}" alt="Игровая карта: ${esc(place.name)}">`
    : `<div class="detail-figure detail-map-image" role="img" aria-label="Фрагмент городской карты у отметки ${esc(place.name)}" style="background-position:${place.x}% ${place.y}%"></div>`;
  $('#detail').innerHTML = `${picture}<div class="detail-body"><div class="detail-kicker">МЕСТО ${String(index + 1).padStart(2, '0')} / РОСТОВ-НА-ДОНУ</div><h2>${esc(place.name)}</h2><p>${esc(place.text)}</p></div>`;
  document.querySelectorAll('.marker').forEach((button, i) => button.classList.toggle('selected', i === index));
  if (innerWidth < 1050) $('#detail').scrollIntoView({behavior: 'smooth', block: 'nearest'});
}

$('#placeCount').textContent = `${data.places.length} МЕСТ НА КАРТЕ`;
$('#markers').innerHTML = data.places.map((place, i) => `<button class="marker" type="button" style="left:${place.x}%;top:${place.y}%" aria-label="Открыть место: ${esc(place.name)}" data-index="${i}">${place.icon ? `<img src="${asset('tokens', place.icon)}" alt="">` : `<span class="marker-symbol" aria-hidden="true">${esc(place.symbol)}</span>`}<span class="tooltip">${esc(place.name)}</span></button>`).join('');
document.querySelectorAll('.marker').forEach(button => button.addEventListener('click', () => selectPlace(Number(button.dataset.index))));
const mapFrame = $('#mapFrame');
const baseMapWidth = Math.max(mapFrame.clientWidth, window.innerWidth < 640 ? 900 : 0);
let zoom = 1;
function changeZoom(step) {
  const next = Math.max(1, Math.min(2.2, Math.round((zoom + step) * 10) / 10));
  const centerX = (mapFrame.scrollLeft + mapFrame.clientWidth / 2) / $('#mapStage').clientWidth;
  const centerY = (mapFrame.scrollTop + mapFrame.clientHeight / 2) / $('#mapStage').clientHeight;
  zoom = next;
  $('#mapStage').style.width = `${Math.round(baseMapWidth * zoom)}px`;
  mapFrame.scrollLeft = centerX * $('#mapStage').clientWidth - mapFrame.clientWidth / 2;
  mapFrame.scrollTop = centerY * $('#mapStage').clientHeight - mapFrame.clientHeight / 2;
  $('#zoomOut').disabled = zoom === 1;
  $('#zoomIn').disabled = zoom === 2.2;
}
$('#zoomOut').addEventListener('click', () => changeZoom(-0.2));
$('#zoomIn').addEventListener('click', () => changeZoom(0.2));
$('#zoomOut').disabled = true;
if (window.innerWidth < 640) mapFrame.scrollLeft = (baseMapWidth - mapFrame.clientWidth) * .46;

const dossier = $('#characterDialog');
function openDossier(index) {
  const character = data.characters[index];
  $('#dossierBody').innerHTML = `<div class="dossier-heading"><img class="dossier-portrait" src="${asset('characters', character.portrait)}" alt="Портрет: ${esc(character.name)}"><div><span class="eyebrow">ДОСЬЕ / ${String(index + 1).padStart(2, '0')}</span><h2 id="dossierName">${esc(character.name)}</h2><span class="dossier-role">${esc(character.role)}</span></div></div><div class="dossier-line"></div><h3>Что известно</h3><p>${esc(character.background)}</p><h3>Черта</h3><p>${esc(character.trait)}</p>`;
  dossier.showModal();
  $('#closeDossier').focus();
}
$('#closeDossier').addEventListener('click', () => dossier.close());
dossier.addEventListener('click', event => { if (event.target === dossier) dossier.close(); });
$('#characterCards').innerHTML = data.characters.map((character, i) => `<button class="card character-card" type="button" data-index="${i}" aria-label="Открыть досье: ${esc(character.name)}"><span class="card-num">${String(i + 1).padStart(2, '0')} / ПЕРСОНАЖ</span><img class="card-portrait" src="${asset('characters', character.portrait)}" alt=""><h2>${esc(character.name)}</h2><span class="role">${esc(character.role)}</span><p>${esc(character.text)}</p><span class="card-action">Открыть досье ↗</span></button>`).join('');
document.querySelectorAll('.character-card').forEach(button => button.addEventListener('click', () => openDossier(Number(button.dataset.index))));

$('#timeline').innerHTML = data.chronicle.map((entry, i) => `<article class="entry"><small>ЗАПИСЬ ${String(i + 1).padStart(2, '0')}</small><h2>${esc(entry.title)}</h2><p>${esc(entry.text)}</p></article>`).join('');
$('#chronicleEmpty').hidden = data.chronicle.length > 0;
$('#placeGrid').innerHTML = data.places.map((place, i) => `<button type="button" class="place-card" data-index="${i}">${place.image ? `<img src="${asset('locations', place.image)}" alt="">` : `<div class="place-card-map" role="img" aria-label="Фрагмент городской карты" style="background-position:${place.x}% ${place.y}%"></div>`}<span>${esc(place.name)}</span></button>`).join('');
document.querySelectorAll('.place-card').forEach(button => button.addEventListener('click', () => {show('map'); selectPlace(Number(button.dataset.index));}));
$('#mapGallery').innerHTML = (data.mapGallery || []).map(map => `<a class="map-card" href="${asset('locations', map.image)}" target="_blank" rel="noopener" aria-label="Открыть карту: ${esc(map.name)}"><img src="${asset('locations', map.image)}" alt="${esc(map.name)}" loading="lazy" decoding="async"><span class="map-card-meta"><strong>${esc(map.name)}</strong><small>Открыть карту ↗</small></span></a>`).join('');
