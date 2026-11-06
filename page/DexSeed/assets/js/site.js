'use strict';
const data = window.DEXSEED;
const $ = selector => document.querySelector(selector);
const states = new Set();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let globallyPaused = reducedMotion.matches;
let dialogOpen = false;
const SYNC_TOLERANCE_SECONDS = 0.25;
const END_HOLD_SECONDS = 0.05;
const CLOCK_INTERVAL_MS = 100;

const oldVideo = (file, label, extra = {}) => ({
  src: 'assets/videos/' + file,
  poster: 'assets/posters/' + file.replaceAll('/', '--').replace(/\.mp4$/, '.jpg'),
  label, ...extra,
});
const presentationVideo = (file, label, extra = {}) => ({
  src: 'assets/presentation/' + file,
  poster: 'assets/presentation-posters/' + file.replaceAll('/', '--').replace(/\.mp4$/, '.jpg'),
  label, ...extra,
});

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function disposeWithin(container) {
  for (const state of [...states]) {
    if (!container.contains(state.root)) continue;
    visibility.unobserve(state.root);
    state.videos.forEach(video => { video.pause(); video.removeAttribute('src'); video.load(); });
    states.delete(state);
  }
}

function pauseState(state) {
  state.last = null;
  state.videos.forEach(video => video.pause());
}

function resetState(state) {
  state.elapsed = 0;
  state.last = null;
  state.videos.forEach(video => { if (video.readyState >= 1) video.currentTime = 0; });
  if (state.onReset) state.onReset();
}

const visibility = new IntersectionObserver(entries => {
  for (const entry of entries) {
    const state = [...states].find(s => s.root === entry.target);
    if (!state) continue;
    state.visible = entry.isIntersecting;
    if (state.visible) {
      state.videos.forEach(video => {
        if (!video.getAttribute('src')) { video.src = video.dataset.src; video.load(); }
      });
    } else pauseState(state);
  }
}, { threshold: 0.04 });

function group(container, cards, columns = 4, options = {}) {
  disposeWithin(container);
  container.replaceChildren();
  const root = element('div', 'media-group');
  const state = { root, videos: [], visible: false, paused: false, elapsed: 0, last: null, onCycle: options.onCycle, onFrame: options.onFrame, cycleDuration: options.cycleDuration, mediaTime: options.mediaTime };
  const rows = options.rows || [{ cards, columns }];
  for (const row of rows) {
    if (row.label) root.append(element('p', 'bank-row-label', row.label));
    const grid = element('div', 'video-grid' + (row.columns === 1 ? ' single' : ''));
    grid.style.setProperty('--cols', row.columns);
    for (const card of row.cards) {
      const article = element('article', 'video-card ' + (card.shape || ''));
      const button = element('button', 'video-open');
      button.type = 'button';
      button.setAttribute('aria-label', 'Enlarge: ' + card.label);
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'none';
      video.poster = card.poster;
      video.dataset.src = card.src;
      video.setAttribute('aria-label', card.label);
      video.addEventListener('error', () => {
        button.classList.add('is-error');
        console.error('Media could not load:', card.src, video.error?.message);
      });
      button.append(video);
      button.addEventListener('click', () => openVideo(card, video.currentTime));
      article.append(button);
      if (card.label && !options.hideLabels) {
        const label = element('div', 'video-label');
        label.append(element('strong', '', card.label));
        if (card.tag) label.append(element('span', '', card.tag));
        article.append(label);
      }
      if (card.note) article.append(element('p', 'video-note', card.note));
      state.videos.push(video);
      grid.append(article);
    }
    root.append(grid);
  }
  const controls = element('div', 'group-controls');
  const toggle = element('button', '', 'Ⅱ Pause group');
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Pause or play this video group');
  toggle.addEventListener('click', () => {
    state.paused = !state.paused;
    if (!state.paused && globallyPaused) setGlobalPause(false);
    if (state.paused) pauseState(state);
    toggle.textContent = state.paused ? '▶ Play group' : 'Ⅱ Pause group';
    if (state.onPause) state.onPause(state.paused);
  });
  const replay = element('button', '', '↺ Replay together');
  replay.type = 'button';
  replay.addEventListener('click', () => {
    resetState(state);
    state.paused = false;
    setGlobalPause(false);
    toggle.textContent = 'Ⅱ Pause group';
  });
  controls.append(toggle, replay);
  root.append(controls);
  state.toggle = toggle;
  states.add(state);
  container.append(root);
  visibility.observe(root);
  return state;
}

function tick() {
  const now = performance.now();
  for (const state of states) {
    if (!state.visible || state.paused || globallyPaused || document.hidden || dialogOpen || !state.root.getClientRects().length) {
      pauseState(state);
      continue;
    }
    const playable = state.videos.filter(video => !video.error);
    // Hold the shared clock while a view is loading, including the paired camera views.
    if (!playable.length || playable.some(video => video.readyState < 2 || video.seeking)) {
      pauseState(state);
      continue;
    }
    const mediaDuration = Math.max(...playable.map(video => video.duration));
    const duration = state.cycleDuration ? state.cycleDuration(mediaDuration) : mediaDuration;
    if (!Number.isFinite(duration) || duration <= 0) continue;
    if (state.last !== null) state.elapsed += (now - state.last) / 1000;
    state.last = now;
    if (state.elapsed >= duration) {
      if (state.onCycle && state.onCycle(duration)) continue;
      state.elapsed %= duration;
    }
    if (state.onFrame) state.onFrame(state.elapsed, duration);
    for (const [index, video] of playable.entries()) {
      const mediaTime = state.mediaTime ? state.mediaTime(state.elapsed, index) : state.elapsed;
      const end = Math.max(0, video.duration - END_HOLD_SECONDS);
      const target = Math.max(0, Math.min(mediaTime, end));
      if (Math.abs(video.currentTime - target) > SYNC_TOLERANCE_SECONDS || (video.ended && mediaTime < end)) video.currentTime = target;
      if (mediaTime < 0 || mediaTime >= end) video.pause();
      else if (video.paused) video.play().catch(error => {
        if (error.name === 'AbortError') return;
        state.paused = true;
        state.toggle.textContent = '▶ Play group';
        if (error.name !== 'NotAllowedError') console.error('Video playback:', error);
      });
    }
  }
}
setInterval(tick, CLOCK_INTERVAL_MS);
document.addEventListener('visibilitychange', () => states.forEach(pauseState));

function setGlobalPause(paused) {
  globallyPaused = paused;
  $('#motion-toggle').setAttribute('aria-pressed', String(paused));
  $('#motion-toggle').textContent = paused ? 'Play videos ▶' : 'Pause videos Ⅱ';
  if (paused) states.forEach(pauseState);
}
$('#motion-toggle').addEventListener('click', () => setGlobalPause(!globallyPaused));
setGlobalPause(globallyPaused);

function openVideo(card, time) {
  dialogOpen = true;
  states.forEach(pauseState);
  $('#dialog-title').textContent = card.label;
  $('#dialog-description').textContent = card.note || '';
  const video = $('#dialog-video');
  video.poster = card.poster;
  video.preload = 'auto';
  video.src = card.src;
  video.muted = true;
  video.loop = true;
  video.onloadedmetadata = () => { video.currentTime = Math.min(time, Math.max(0, video.duration - END_HOLD_SECONDS)); video.play().catch(error => { if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') console.error(error); }); };
  video.load();
  $('#video-dialog').showModal();
}
$('#dialog-close').addEventListener('click', () => $('#video-dialog').close());
$('#video-dialog').addEventListener('click', event => { if (event.target === $('#video-dialog')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
$('#video-dialog').addEventListener('close', () => {
  // A queued close event can arrive after another video has already opened.
  if ($('#video-dialog').open) return;
  const video = $('#dialog-video');
  video.pause(); video.removeAttribute('src'); video.load();
  dialogOpen = false;
  states.forEach(state => state.last = null);
});

function selectTab(list, button) {
  list.querySelectorAll('[role=tab]').forEach(tab => {
    const selected = tab === button;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
}
document.addEventListener('keydown', event => {
  if (event.target.getAttribute('role') !== 'tab') return;
  const tabs = [...event.target.closest('[role=tablist]').querySelectorAll('[role=tab]')];
  let next;
  const index = tabs.indexOf(event.target);
  if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
  if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
  if (event.key === 'Home') next = 0;
  if (event.key === 'End') next = tabs.length - 1;
  if (next !== undefined) { event.preventDefault(); tabs[next].click(); tabs[next].focus(); }
});

const realExamples = [
  ['water_bottle_G1_02','Water bottle'],['stapler_G2_01','Stapler'],['cube_G3_01','Cube'],['apple_G4_04','Apple'],
  ['mug_G5_01','Mug'],['bread_G6_01','Bread model'],['alarm_clock_G7_01','Alarm clock'],['torus_G8_01','Torus'],
];
const realTabs = {
  modes: { columns: 4, description: 'Real-robot executions across all eight grasp modes.', cards: realExamples.map(([file,name],i) => oldVideo('real_world/'+file+'.mp4',name,{tag:'G'+(i+1)})) },
  language: { columns: 2, description: 'The same apple is grasped in two different ways, conditioned on the grasp instruction.', cards: [
    ['apple_G1_01','G1 · Oblique side whole-hand',data.instructions[0]],['apple_G4_04','G4 · Top-down whole-hand',data.instructions[3]],
    ['apple_G1_02','G1 · Oblique side whole-hand',''],['apple_G4_10','G4 · Top-down whole-hand',''],
  ].map(([file,label,note]) => oldVideo('real_world/'+file+'.mp4',label,{note})) },
  objects: { columns: 3, description: 'One grasp mode transfers across an apple, a bottle, and a duck.', cards: [
    ['apple_G1_01','Apple'],['water_bottle_G1_01','Water bottle'],['duck_G1_01','Duck'],
  ].map(([file,label]) => oldVideo('real_world/'+file+'.mp4',label,{tag:'G1'})) },
  locations: { columns: 3, description: 'Nine apple rollouts vary the starting and placement locations.', cards: Array.from({length:9},(_,i) => oldVideo('real_world/apple_G4_'+String(i+1).padStart(2,'0')+'.mp4','Apple · '+String(i+1).padStart(2,'0'),{tag:'G4'})) },
  more: { columns: 3, description: 'Additional objects and grasp modes in real-robot execution.', cards: [
    ['cylinder_G1_01','Cylinder','G1'],['bread_G6_02','Bread model','G6'],['duck_G1_02','Duck','G1'],['eyeglasses_G8_01','Eyeglasses','G8'],['torus_G8_02','Torus','G8'],['yellow_pepper_G4_01','Yellow pepper','G4'],
  ].map(([file,label,tag]) => oldVideo('real_world/'+file+'.mp4',label,{tag})) },
};
function showReal(key) {
  const config = realTabs[key];
  selectTab($('#real-tabs'), $('[data-real="'+key+'"]'));
  $('#real-panel').setAttribute('aria-labelledby','real-tab-'+key);
  $('#real-description').textContent = config.description;
  group($('#real-grid'),config.cards,config.columns);
}
$('#real-tabs').addEventListener('click', event => { const button = event.target.closest('[data-real]'); if (button) showReal(button.dataset.real); });
showReal('modes');

group($('#dataset-media'),[presentationVideo('generated_demonstrations/00.mp4','Generated robot demonstrations')],1,{hideLabels:true});

const methods=['ManipTrans','Dexplore','w/o Arm','Ours'];
function showComparison(){const index=Number($('#comparison-select').value);group($('#comparison-media'),methods.map((name,i)=>oldVideo('comparison/case_'+String(index).padStart(2,'0')+'_'+String(i+1).padStart(2,'0')+'.mp4',name,{shape:'scene'})),4);}
$('#comparison-select').addEventListener('change',showComparison);showComparison();
const simExamples=[['water_bottle','Water bottle'],['stapler','Stapler'],['cube','Cube'],['apple','Apple'],['mug','Mug'],['banana','Banana'],['alarm_clock','Alarm clock'],['torus','Torus']];
group($('#simulation-media'),simExamples.map(([file,label],i)=>oldVideo('simulation/'+file+'_G'+(i+1)+'_01.mp4',label,{tag:'G'+(i+1),shape:'scene'})),4);
group($('#failure-media'),[oldVideo('failure/mug_G5_01.mp4','Mug · G5',{note:'Handle slip during real-robot execution.'})],1);

$('#copy-citation').addEventListener('click',async()=>{
  const text=$('#bibtex').textContent;
  try{
    if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(text);
    else {const area=element('textarea','');area.value=text;area.style.position='fixed';area.style.left='-9999px';document.body.append(area);area.select();const copied=document.execCommand('copy');area.remove();if(!copied)throw new Error('Clipboard unavailable');}
    $('#copy-status').textContent='Copied.';
  }catch{$('#copy-status').textContent='Select the citation above to copy it.';}
});
const sectionObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)document.querySelectorAll('.contents a').forEach(a=>a.classList.toggle('active',a.hash==='#'+entry.target.id));},{rootMargin:'-10% 0px -65% 0px'});
document.querySelectorAll('main>section[id]').forEach(section=>sectionObserver.observe(section));
