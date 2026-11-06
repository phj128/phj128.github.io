'use strict';
let methodStep = 0;
const METHOD_ROUNDS = 2;
let completedRounds = 0;
let touring = !reducedMotion.matches;
let methodState;

const methodStages = [
  {category:'01 / Grasp bank construction',title:'Similar interactions become grasp modes.',description:'Describe hand pose, orientation, and hand–object relationships with a 170-D descriptor. Group similar grasps by descriptor distance, then select representative seeds and assign a shared description to each mode.',output:'Human interactions → Grasp modes → Selected interaction seed',outro:4,
    cards:[['apple','Apple'],['water_bottle','Water bottle'],['torus','Torus'],['eyeglasses','Eyeglasses']].map(([file,label])=>presentationVideo('human/'+file+'_01.mp4',label,{shape:'pose'})),build:buildClusters},
  {category:'02 / InteractionMesh retargeting',title:'Carry the interaction across hands and shapes.',description:'Select an apple interaction from the grasp bank. InteractionMesh preserves local hand–object relationships while adapting it to the robot hand, resized objects, and compatible new geometries.',output:'Selected human seed → Geometry-conditioned robot references',intro:2,
    cards:[presentationVideo('human/apple_01.mp4','Human seed',{shape:'pose'}),...['Original','Smaller','Larger','New geometry','New geometry'].map((label,i)=>presentationVideo('retargeting/apple_G1_0'+(i+1)+'.mp4',label,{shape:'pose'}))],build:buildRetarget},
  {category:'03 / Trajectory augmentation',title:'One grasp branches into whole-arm motions.',description:'Vary the initial wrist pose, object position, and placement target. Connect the grasp with approach, transport, placement, and retreat, then solve arm inverse kinematics.',output:'Geometry-conditioned references → Augmented kinematic trajectories',intro:1.2,
    cards:[1,2,3].map(i=>presentationVideo('kinematic/apple_G1_0'+i+'.mp4','Trajectory '+i,{shape:'scene'})),build:buildAugmentation},
  {category:'04 / Physics-based realization',title:'Learn the finger corrections that make it work.',description:'The arm tracks precomputed joint references with PD control. An RL finger policy learns across augmented references, and successful physical rollouts are retained as demonstrations.',output:'Kinematic references → Physically executable demonstrations',intro:1.2,
    cards:[1,2,3].map(i=>presentationVideo('rl/apple_G1_0'+i+'.mp4','Physical rollout '+i,{shape:'scene'})),build:buildPhysics},
  {category:'05 / Gaussian splatting rendering',title:'Turn robot motion into robot training data.',description:'Replay successful rollouts in the reconstructed workspace. Pair augmented head and wrist observations with proprioception, robot actions, and the grasp description to fine-tune a VLA.',output:'Visual observations + Actions + Grasp description → VLA learning',intro:0.6,
    cards:[['3d','3D interaction'],['head_view','Head view'],['wrist_view','Wrist view']].map(([folder,label])=>presentationVideo('vla/'+folder+'/apple_G1_01.mp4',label,{shape:'scene'})),build:buildRendering},
];

function panel(markup,className) {
  const node=element('div',className);node.innerHTML=markup;return node;
}
function ease(value) {const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);}
function seedRibbon(){return panel('<span>SELECTED SEED</span><strong>Apple · G1</strong><q>Oblique side whole-hand grasp</q>','seed-ribbon');}
function insertScene(root,scene){const controls=root.querySelector('.group-controls');root.replaceChildren(scene,controls);}

function buildClusters(root,cards) {
  const scene=panel('<div class="cluster-phases"><span>Human interactions</span><i>→</i><span>Describe</span><i>→</i><span>Group</span><i>→</i><span>Select a seed</span></div><div class="descriptor-line"><span>Hand pose</span><span>Orientation</span><span>Hand–object relationship</span><b>→ 170-D descriptor → Distance grouping</b></div><div class="cluster-canvas"><div class="cluster-box cluster-one"><b>G1</b><span>Oblique side whole-hand grasp</span></div><div class="cluster-box cluster-two"><b>G8</b><span>Two-finger hook</span></div></div><div class="cluster-selection"><span class="seed-marker">↳ Selected seed: Apple · G1</span><span>Two example groups from the eight selected grasp modes</span></div>','cluster-scene');
  const canvas=scene.querySelector('.cluster-canvas');
  cards.forEach(card=>{card.classList.add('cluster-card');canvas.append(card);});
  insertScene(root,scene);
  const phaseNames=['Human interactions','Grasp descriptors','Grouping by grasp mode','Selecting a representative seed'];
  return (time,duration)=>{
    const p=time/duration;
    const motion=ease((p-.40)/.30);
    const mobile=window.matchMedia('(max-width:600px)').matches;
    const start=mobile?[[5,7],[55,53],[5,53],[55,7]]:[[9,0],[69,49],[9,49],[69,0]];
    const end=mobile?[[5,18],[5,54],[55,18],[55,54]]:[[3,28],[27,28],[53,28],[77,28]];
    cards.forEach((card,i)=>{
      card.style.left=(start[i][0]+(end[i][0]-start[i][0])*motion)+'%';
      card.style.top=(start[i][1]+(end[i][1]-start[i][1])*motion)+'%';
    });
    scene.querySelectorAll('.cluster-box').forEach(box=>box.style.opacity=ease((p-.42)/.20));
    scene.querySelector('.descriptor-line').classList.toggle('is-active',p>=.22&&p<.65);
    scene.querySelector('.cluster-selection').classList.toggle('seed-picked',p>=.76);
    cards[0].classList.toggle('selected-seed',p>=.76);
    const phase=p<.22?0:p<.42?1:p<.76?2:3;
    scene.querySelectorAll('.cluster-phases>span').forEach((node,i)=>node.classList.toggle('is-active',i===phase));
    scene.setAttribute('aria-label',phaseNames[phase]);
  };
}

function buildRetarget(root,cards) {
  const scene=panel('<div class="retarget-flow"><div class="human-seed"><span class="scene-label">Selected human interaction</span></div><div class="transfer-arrow"><span>InteractionMesh</span><i>→</i><small>Preserve local relationships</small></div><div class="retarget-output"><div class="geometry-labels"><span>Original</span><span>Resized</span><span>New geometry</span></div><div class="retarget-cards"></div></div></div>','retarget-scene');
  scene.prepend(seedRibbon());scene.querySelector('.human-seed').append(cards[0]);
  cards.slice(1).forEach(card=>scene.querySelector('.retarget-cards').append(card));
  insertScene(root,scene);
  return time=>{
    cards.slice(1).forEach((card,i)=>{const p=ease((time-i*.25)/1.0);card.style.opacity=.12+.88*p;card.style.transform='translateX('+((1-p)*-30)+'px)';});
    scene.querySelector('.transfer-arrow').classList.toggle('is-active',time<2);
  };
}

function branching(){return panel('<svg viewBox="0 0 900 48" preserveAspectRatio="none" aria-hidden="true"><path d="M450 0 V12 H150 V43 M450 12 V43 M450 12 H750 V43"/><path d="m144 36 6 7 6-7 m288 0 6 7 6-7 m288 0 6 7 6-7"/></svg>','branch-lines');}
function buildAugmentation(root,cards) {
  const scene=panel('<div class="augmentation-input"><span class="scene-label">Geometry-conditioned interaction</span><div class="parameter-row"><span>Initial wrist pose</span><span>Object position</span><span>Placement target</span></div></div><div class="trajectory-cards"></div><div class="motion-phases"><span>Approach</span><i>→</i><span>Grasp</span><i>→</i><span>Transport</span><i>→</i><span>Place</span><i>→</i><span>Retreat</span></div>','augmentation-scene');
  scene.prepend(seedRibbon());scene.querySelector('.augmentation-input').append(branching());
  cards.forEach(card=>scene.querySelector('.trajectory-cards').append(card));insertScene(root,scene);
  return time=>{cards.forEach((card,i)=>{const p=ease((time-i*.25)/.7);card.style.opacity=.15+.85*p;card.style.transform='translateY('+((1-p)*15)+'px)';});};
}

function buildPhysics(root,cards) {
  const scene=panel('<div class="physics-process"><div><span class="scene-label">Input</span><strong>Augmented references</strong><div class="reference-thumbnails"></div></div><i>→</i><div class="controller-split"><span>ARM <b>PD tracking</b></span><span>FINGERS <b>RL residual policy</b></span></div><i>→</i><div><span class="scene-label">Output</span><strong>Physical rollouts</strong><small>Retain successful executions</small></div></div><div class="trajectory-cards"></div>','physics-scene');
  scene.prepend(seedRibbon());
  [1,2,3].forEach(i=>{const img=document.createElement('img');img.src=presentationVideo('kinematic/apple_G1_0'+i+'.mp4','').poster;img.alt='Kinematic reference '+i;scene.querySelector('.reference-thumbnails').append(img);});
  cards.forEach(card=>scene.querySelector('.trajectory-cards').append(card));insertScene(root,scene);
  return time=>{scene.querySelector('.controller-split').classList.toggle('is-active',time>=.5);cards.forEach(card=>{card.style.opacity=.15+.85*ease(time/1.2);});};
}

function buildRendering(root,cards) {
  const scene=panel('<div class="render-views"><div class="render-source"></div><div class="camera-connector"><span>Render</span><i>↗</i><i>↘</i></div><div class="camera-views"></div></div><div class="learning-flow"><div><span>Head + wrist images</span><span>Proprioception + actions</span><span>Shared grasp description</span></div><i>→</i><strong>Fine-tune VLA</strong><i>→</i><div><b>7 arm + 20 finger joints</b><small>Coordinated, language-conditioned control</small></div></div>','rendering-scene');
  scene.prepend(seedRibbon());scene.querySelector('.render-source').append(cards[0]);
  cards[1].classList.add('head-view');cards[2].classList.add('wrist-view');
  scene.querySelector('.camera-views').append(cards[1],cards[2]);insertScene(root,scene);
  return (time,duration)=>{scene.querySelector('.camera-views').style.opacity=.2+.8*ease(time/.6);scene.querySelector('.learning-flow').classList.toggle('is-active',time/duration>.5);};
}

function updateMethodProgress(fraction) {
  const stepProgress=Math.min(1,(completedRounds+fraction)/METHOD_ROUNDS);
  document.querySelectorAll('.method-chapters li').forEach((node,i)=>{
    node.classList.toggle('is-current',i===methodStep);
    node.classList.toggle('is-past',i<methodStep);
    if(i===methodStep)node.querySelector('button').setAttribute('aria-current','step');
    else node.querySelector('button').removeAttribute('aria-current');
    node.querySelector('i').style.width=(i<methodStep?100:i===methodStep?stepProgress*100:0)+'%';
  });
}
function setTour(active) {
  touring=active;
  $('#method-tour').textContent=active?'Ⅱ Pause walkthrough':'▶ Play walkthrough';
  $('#method-tour').setAttribute('aria-pressed',String(active));
  if(methodState){methodState.paused=!active;methodState.last=null;methodState.toggle.textContent=active?'Ⅱ Pause group':'▶ Play group';if(!active)pauseState(methodState);}
}
function showMethod(index) {
  methodStep=index;completedRounds=0;
  const stage=methodStages[index];
  $('#method-category').textContent=stage.category;$('#method-heading').textContent=stage.title;
  $('#method-description').textContent=stage.description;$('#method-output').textContent=stage.output;
  $('#method-count').textContent=String(index+1).padStart(2,'0')+' / 05';$('#method-prev').disabled=index===0;
  // A round includes the illustrated transition and the complete media playback.
  // Advancement depends only on completed rounds; there is no dwell-time gate.
  const intro=stage.intro||0,outro=stage.outro||0;
  methodState=group($('#method-media'),stage.cards,stage.cards.length,{
    cycleDuration:mediaDuration=>intro+mediaDuration+outro,
    mediaTime:(time,i)=>index===1&&i===0?time:time-intro,
    onCycle:()=>{completedRounds++;if(touring&&completedRounds>=METHOD_ROUNDS){showMethod((methodStep+1)%methodStages.length);return true;}return false;},
  });
  const animate=stage.build(methodState.root,[...methodState.root.querySelectorAll('.video-card')]);
  methodState.onFrame=(time,duration)=>{animate(time,duration);updateMethodProgress(time/duration);};
  methodState.onReset=()=>{completedRounds=0;updateMethodProgress(0);};
  methodState.onPause=paused=>setTour(!paused);
  animate(0,1);updateMethodProgress(0);setTour(touring);
}
$('#method-tour').addEventListener('click',()=>{if(!touring)setGlobalPause(false);setTour(!touring);});
$('#method-replay').addEventListener('click',()=>{setGlobalPause(false);touring=true;showMethod(0);});
$('#method-prev').addEventListener('click',()=>showMethod(methodStep-1));
$('#method-next').addEventListener('click',()=>showMethod((methodStep+1)%methodStages.length));
$('#method-progress').addEventListener('click',event=>{
  const button=event.target.closest('[data-step]');if(button)showMethod(Number(button.dataset.step));
});
showMethod(0);
