'use strict';
let bankMode = 0;
let bankStage = 'grasps';
let bankSequence = 0;
const BANK_COLUMNS = 5;
const bankDescriptions = {
  grasps: 'Human source interactions and their Wuji hand retargeting, grouped by grasp mode.',
  geometry: 'The original interaction transfers to resized objects and compatible new geometries.',
  reference: 'Kinematic references vary the initial wrist pose, object position, and placement target.',
  physics: 'Physical rollouts: the arm tracks its reference, while an RL policy controls the fingers.',
  rendering: 'Head and wrist observations rendered from the corresponding physical demonstrations.',
};
function showBankMedia() {
  $('#bank-stage-panel').setAttribute('aria-labelledby','data-stage-'+bankStage);
  $('#bank-cases').hidden = bankStage === 'grasps';
  $('#bank-description').textContent = bankDescriptions[bankStage];
  if (bankStage === 'grasps') {
    const rows = data.bank[bankMode];
    group($('#bank-media'), [], BANK_COLUMNS, {rows: [
      {label:'Human demonstration', columns:BANK_COLUMNS, cards:rows.map(row=>oldVideo(row.human,row.name,{shape:'pose'}))},
      {label:'Wuji retargeting', columns:BANK_COLUMNS, cards:rows.map(row=>oldVideo(row.robot,row.name,{shape:'pose'}))},
    ]});
  } else {
    const sequence = data.sequences[bankSequence];
    group($('#bank-media'),sequence[bankStage].map(video=>oldVideo(video.video,video.label,{shape:bankStage==='geometry'?'pose':'scene'})),BANK_COLUMNS);
  }
}
function showBank(index) {
  bankMode = index;
  selectTab($('#mode-tabs'),$('#bank-tab-'+index));
  $('#bank-panel').setAttribute('aria-labelledby','bank-tab-'+index);
  $('#bank-heading').textContent = 'G'+(index+1)+' · '+data.modeTitles[index];
  const sequences = data.sequences.map((sequence,i)=>({sequence,i})).filter(({sequence})=>sequence.mode===index+1);
  bankSequence = sequences[0].i;
  $('#bank-case-buttons').replaceChildren();
  sequences.forEach(({sequence,i})=>{
    const button = element('button','',sequence.name);
    button.type='button';
    button.setAttribute('aria-pressed',String(i===bankSequence));
    button.addEventListener('click',()=>{
      bankSequence=i;
      $('#bank-case-buttons').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      showBankMedia();
    });
    $('#bank-case-buttons').append(button);
  });
  showBankMedia();
}
data.modeTitles.forEach((title,index)=>{
  const button=element('button','','G'+(index+1));
  button.type='button';button.id='bank-tab-'+index;button.setAttribute('role','tab');
  button.setAttribute('aria-controls','bank-panel');button.setAttribute('aria-label','G'+(index+1)+' · '+title);
  button.addEventListener('click',()=>showBank(index));$('#mode-tabs').append(button);
});
$('#bank-stages').addEventListener('click',event=>{
  const button=event.target.closest('[data-stage]');
  if(!button)return;
  bankStage=button.dataset.stage;selectTab($('#bank-stages'),button);showBankMedia();
});
showBank(0);
