import * as THREE from 'three';

// ===================== 1. SCENE SETUP =====================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 15);

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ===================== 2. MUSIC / TIMING =====================
// 4 beats per bar, ~107 BPM => measureDuration = 4 * (60/107) seconds
const BPM = 107.333;
const measureDuration = (4 * 60) / BPM; // ~2.243 seconds

// The next copy should generate every 4 beats => spawnInterval = measureDuration
const spawnInterval = measureDuration;

// The user wants 3 spheres on: beat 1 (time=0), & of 2 (time=1.5), beat 3 (time=2)
const beatTimes = [0, 1.5, 2];
const beatFractions = beatTimes.map((t) => t / 4); 
const spherePhaseOffsets = beatFractions.map((f) => -2 * Math.PI * f);

// ===================== 3. ELLIPSE GEOMETRY (LOCAL XZ) =====================
function createEllipseGeometry(a, b, segments = 120) {
  const ellipseCurve = new THREE.EllipseCurve(
    0, 0,   // center
    a, b,   // radii
    0, 2 * Math.PI
  );
  const points = ellipseCurve.getPoints(segments);

  const geom = new THREE.BufferGeometry().setFromPoints(points);
  const arr = geom.attributes.position.array;
  for (let i = 0; i < arr.length; i += 3) {
    const oldY = arr[i + 1];
    arr[i + 1] = 0;        // Flatten to Y=0
    arr[i + 2] = oldY;     // Move old Y to Z
  }
  return geom;
}

const a = 10;
const b = 7;
const ellipseGeom = createEllipseGeometry(a, b);

// ===================== 4. CREATE ONE ORBIT GROUP (PER MEASURE) =====================
function createOrbitGroup() {
  const group = new THREE.Group();

  // Ellipse line
  const lineMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.666,
    alphaHash: 0.666,
    depthWrite: false,
  });
  const ellipseLine = new THREE.Line(ellipseGeom, lineMat);
  group.add(ellipseLine);

  // One sphere for each placed beat
  const spheres = [];
  const sphereGeom = new THREE.SphereGeometry(0.35, 12, 12);

  spherePhaseOffsets.forEach((offset, idx) => {
    let color = 0xff0000;
    if (idx === 1) color = 0xffff00;
    if (idx === 2) color = 0x0000ff;


    const sphereMat = new THREE.MeshBasicMaterial({ 
      color,
      transparent: true,
      opacity: 0.85,
      alphaHash: 0.85,
      wireframe: true, 
      });
    const sphere = new THREE.Mesh(sphereGeom, sphereMat);
    spheres.push({ sphere, offset });
    group.add(sphere);
  });

  group.userData = {
    spheres,       // array of { sphere, offset }
    birthTime: 0,  // set later
  };

  return group;
}

// ===================== 5. RECEDING / SPAWN LOGIC =====================
const vanishDistance = 1000;  // once z < -N, remove
const recessionSpeed = 6;    // how fast groups recede
let lastSpawnTime = 0;

//  each new measure group tilted forward by -45° towards viewer
// + rotated out of phase from previous generation by +N°
const tiltAngle = -Math.PI / 4;
let orbitRotationOffset = 0; 
let phaseOffset = 33;

const allGroups = [];
const clock = new THREE.Clock();

// ===================== 6. ANIMATION LOOP =====================
function animate() {
  requestAnimationFrame(animate);
  const elapsedTime = clock.getElapsedTime();

  // 6a) Spawn a new measure group every measure
  if (elapsedTime - lastSpawnTime >= spawnInterval) {
    lastSpawnTime = elapsedTime;
    orbitRotationOffset += THREE.MathUtils.degToRad(phaseOffset);

    const group = createOrbitGroup();
    group.rotation.x = tiltAngle;
    group.rotation.y = orbitRotationOffset;
    group.position.z = 0;
    group.userData.birthTime = elapsedTime;

    scene.add(group);
    allGroups.push(group);
  }

  // 6b) Update each measure group
  const toRemove = [];
  allGroups.forEach((group) => {
    const { spheres, birthTime } = group.userData;
    const age = elapsedTime - birthTime;

    // Recede in Z
    group.position.z = -age * recessionSpeed;

    // measureFraction
    const measureFraction = (age / measureDuration) % 1;

    // Update each sphere
    spheres.forEach(({ sphere, offset }) => {
      const angle = 2 * Math.PI * measureFraction + offset;
      sphere.position.x = a * Math.cos(angle);
      sphere.position.y = 0;
      sphere.position.z = b * Math.sin(angle);
    });

    // Vanish check
    if (group.position.z < -vanishDistance) {
      toRemove.push(group);
    }
  });

  // 6c) Remove old measure groups
  toRemove.forEach((g) => {
    scene.remove(g);
    const idx = allGroups.indexOf(g);
    if (idx >= 0) {
      allGroups.splice(idx, 1);
    }
  });

  // 6d) Render
  renderer.render(scene, camera);
}

// ===================== 7. START ON AUDIO PLAY =====================

let animationStarted = false;
const audioElement = document.getElementById('audioPlayer');
const playerContainer = document.getElementById('playerContainer');

// When user presses play in the audio controls, start the clock + animation
audioElement.addEventListener('play', () => {
  if (!animationStarted) {
    // Reset the clock so it starts from 0
    clock.start();
    animationStarted = true;
    // Begin Three.js animation
    animate();
  }
  // Hide the audio element
  playerContainer.style.display = 'none';
});