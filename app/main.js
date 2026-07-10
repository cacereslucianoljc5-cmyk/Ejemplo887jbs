import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { GLTFExporter } from './vendor/GLTFExporter.js';
import { loadImageToCanvas, extractMask, computeDepthField, estimateJoints } from './pipeline.js';
import { buildMesh, buildSkeleton, computeSkinning, buildCycleClip } from './rigbuilder.js';

const els = {
  fileInput: document.getElementById('fileInput'),
  dropZone: document.getElementById('dropZone'),
  preview: document.getElementById('preview'),
  generateBtn: document.getElementById('generateBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  viewport: document.getElementById('viewport'),
  hipSlider: document.getElementById('hipSlider'),
  shoulderSlider: document.getElementById('shoulderSlider'),
  kneeSlider: document.getElementById('kneeSlider'),
  puffSlider: document.getElementById('puffSlider'),
  animButtons: document.querySelectorAll('[data-anim]'),
  speedSlider: document.getElementById('speedSlider'),
  status: document.getElementById('status'),
};

let state = {
  canvas: null, width: 0, height: 0, mask: null, depth: null, joints: null,
};

let renderer, camera, scene, mixer, currentAction;
let clips = {};
let currentSkinnedMesh = null;
let currentSkeletonHelper = null;

function setStatus(msg) {
  els.status.textContent = msg;
}

function initViewer() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1c22);

  camera = new THREE.PerspectiveCamera(40, els.viewport.clientWidth / els.viewport.clientHeight, 0.01, 100);
  camera.position.set(0, 0.1, 2.2);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(els.viewport.clientWidth, els.viewport.clientHeight);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  els.viewport.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(1, 2, 3);
  scene.add(dir);
  const grid = new THREE.GridHelper(4, 16, 0x444444, 0x2a2a2a);
  scene.add(grid);

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    if (mixer) mixer.update(dt);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = els.viewport.clientWidth / els.viewport.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(els.viewport.clientWidth, els.viewport.clientHeight);
  });
}

async function handleFile(file) {
  setStatus('Cargando imagen...');
  const { canvas, width, height } = await loadImageToCanvas(file, 480);
  state.canvas = canvas; state.width = width; state.height = height;

  els.preview.width = width; els.preview.height = height;
  const pctx = els.preview.getContext('2d');
  pctx.clearRect(0, 0, width, height);
  pctx.drawImage(canvas, 0, 0);

  const mask = extractMask(canvas.getContext('2d'), width, height);
  const depth = computeDepthField(mask, width, height);
  const joints = estimateJoints(mask, width, height);
  state.mask = mask; state.depth = depth; state.joints = joints;

  syncSlidersFromJoints();
  drawJointOverlay();
  els.generateBtn.disabled = false;
  setStatus(`Imagen lista (${width}x${height}). Ajusta cadera/hombros/rodilla si hace falta y genera el modelo.`);
}

function syncSlidersFromJoints() {
  const { joints, height } = { joints: state.joints, height: state.height };
  els.shoulderSlider.value = Math.round((joints.shoulderY / height) * 100);
  els.hipSlider.value = Math.round((joints.hipY / height) * 100);
  els.kneeSlider.value = Math.round((joints.kneeY / height) * 100);
}

function jointsFromSliders() {
  const j = { ...state.joints };
  j.shoulderY = (els.shoulderSlider.value / 100) * state.height;
  j.hipY = (els.hipSlider.value / 100) * state.height;
  j.kneeY = (els.kneeSlider.value / 100) * state.height;
  return j;
}

function drawJointOverlay() {
  const pctx = els.preview.getContext('2d');
  pctx.clearRect(0, 0, state.width, state.height);
  pctx.drawImage(state.canvas, 0, 0);
  const j = jointsFromSliders();
  pctx.strokeStyle = '#4ade80';
  pctx.lineWidth = 2;
  for (const y of [j.headTopY, j.shoulderY, j.hipY, j.kneeY, j.feetY]) {
    pctx.beginPath();
    pctx.moveTo(0, y);
    pctx.lineTo(state.width, y);
    pctx.stroke();
  }
}

['input'].forEach((evt) => {
  els.hipSlider.addEventListener(evt, drawJointOverlay);
  els.shoulderSlider.addEventListener(evt, drawJointOverlay);
  els.kneeSlider.addEventListener(evt, drawJointOverlay);
});

function clearModel() {
  if (currentSkinnedMesh) {
    scene.remove(currentSkinnedMesh.parent || currentSkinnedMesh);
    currentSkinnedMesh = null;
  }
  if (currentSkeletonHelper) {
    scene.remove(currentSkeletonHelper);
    currentSkeletonHelper = null;
  }
  mixer = null;
  clips = {};
}

function generateModel() {
  setStatus('Generando malla, esqueleto y animaciones...');
  clearModel();

  const joints = jointsFromSliders();
  const puff = Number(els.puffSlider.value) / 100;
  const { geometry, gridInfo, scale } = buildMesh(state.canvas, state.mask, state.depth, state.width, state.height, {
    gridStep: 4, puffFront: 0.25 * puff, puffBack: 0.14 * puff,
  });

  const { skeleton, bones, root } = buildSkeleton(joints, state.width, state.height, scale);
  computeSkinning(geometry, gridInfo, joints, bones);

  const texture = new THREE.CanvasTexture(state.canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 });

  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.add(root);
  mesh.bind(skeleton);
  mesh.frustumCulled = false;

  const group = new THREE.Group();
  group.add(mesh);
  scene.add(group);
  currentSkinnedMesh = group;

  mixer = new THREE.AnimationMixer(mesh);
  clips.idle = buildCycleClip('Idle', bones, { duration: 2, legAmplitude: 0.04, armAmplitude: 0.04, kneeBend: 0.05, hipBob: 0.005, intensity: 0.2 });
  clips.walk = buildCycleClip('Walk', bones, { duration: 1.0, legAmplitude: 0.5, armAmplitude: 0.4, kneeBend: 0.9, hipBob: 0.02, intensity: 1 });
  clips.run = buildCycleClip('Run', bones, { duration: 0.55, legAmplitude: 0.85, armAmplitude: 0.7, kneeBend: 1.3, hipBob: 0.05, intensity: 1.8 });

  playAnim('walk');
  els.downloadBtn.disabled = false;
  setStatus('Listo. Usa los botones de animación o descarga el .glb.');
}

function playAnim(name) {
  if (!mixer || !clips[name]) return;
  const clip = clips[name];
  const action = mixer.clipAction(clip);
  action.reset();
  if (currentAction && currentAction !== action) currentAction.crossFadeTo(action, 0.2, false);
  action.play();
  currentAction = action;
}

els.animButtons.forEach((btn) => {
  btn.addEventListener('click', () => playAnim(btn.dataset.anim));
});

els.speedSlider.addEventListener('input', () => {
  if (mixer) mixer.timeScale = Number(els.speedSlider.value) / 100;
});

function exportGLB() {
  if (!currentSkinnedMesh) return;
  setStatus('Exportando .glb...');
  const exporter = new GLTFExporter();
  exporter.parse(
    currentSkinnedMesh,
    (result) => {
      const blob = new Blob([result], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'personaje-3d-libre.glb';
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Descarga lista: personaje-3d-libre.glb (incluye animaciones Idle/Walk/Run).');
    },
    (err) => { console.error(err); setStatus('Error exportando el modelo.'); },
    { binary: true, animations: [clips.idle, clips.walk, clips.run] },
  );
}

els.generateBtn.addEventListener('click', generateModel);
els.downloadBtn.addEventListener('click', exportGLB);

els.fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});
els.dropZone.addEventListener('click', () => els.fileInput.click());
els.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); els.dropZone.classList.add('drag'); });
els.dropZone.addEventListener('dragleave', () => els.dropZone.classList.remove('drag'));
els.dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  els.dropZone.classList.remove('drag');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

initViewer();
