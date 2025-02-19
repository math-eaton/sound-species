import * as THREE from 'three';

// ===================== 1. SCENE SETUP =====================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
camera.position.set(0, 1, 18);

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ===================== 2. MUSIC / TIMING =====================
// 4 beats per bar, 107 BPM => measureDuration = 4 * (60/107) seconds
const BPM = 107;
const measureDuration = (4 * 60) / BPM; // ~2.243 seconds

// The next copy should generate every 4 beats => spawnInterval = measureDuration
const spawnInterval = measureDuration;

// Which beats do you want spheres to align with?
//  measure time in "beats from start of bar", so beat 1 = time 0, beat 2 = time 1, etc.
//
// The user wants: 
//   - Beat 1       => time=0
//   - "& of 2"     => time=1.5 (since beat 2 is time=1, plus 0.5 = 1.5)
//   - Beat 3       => time=2
//
// Each bar is 4 beats long, so the fraction for each is (timeInBeats / 4).
const beatTimes = [0, 1.5, 2];
const beatFractions = beatTimes.map((t) => t / 4); 
// e.g. => [0, 0.375, 0.5]

// convert each beat fraction into a phase offset so that
// each sphere crosses angle=0 at that moment in the measure:
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
const b = 9;
const ellipseGeom = createEllipseGeometry(a, b);

// ===================== 4. CREATE ONE ORBIT GROUP (PER MEASURE) =====================
function createOrbitGroup() {
  const group = new THREE.Group();

  // Ellipse line
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff,
    transparent: true,
    opacity: 0.5,
    alphaHash: 0.5,
    depthWrite: false,
  });
  const ellipseLine = new THREE.Line(ellipseGeom, lineMat);
  group.add(ellipseLine);

  // One sphere for each placed beat
  const spheres = [];
  const sphereGeom = new THREE.SphereGeometry(0.3, 16, 16);

  spherePhaseOffsets.forEach((offset, idx) => {
    let color = 0xff0000;
    if (idx === 1) color = 0xffff00;
    if (idx === 2) color = 0x0000ff;

    const sphereMat = new THREE.MeshBasicMaterial({ color });
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
const vanishDistance = 500; // once z < -N, remove
const recessionSpeed = 6;  // how fast groups recede
let lastSpawnTime = 0;

//  each new measure group tilted forward by -45° towards viewer
// + rotated out of phase from previous generation by +N°
const tiltAngle = -Math.PI / 4;
let orbitRotationOffset = 0; // this accumulates +phaseOffset° each spawn
let phaseOffset = 33;

//  track all measure groups in an array
const allGroups = [];

// Use a clock for global timing
const clock = new THREE.Clock();

// ===================== 6. ANIMATION LOOP =====================
function animate() {
  requestAnimationFrame(animate);
  const elapsedTime = clock.getElapsedTime();

  // 6a) Spawn a new measure group every 4 beats => spawnInterval = measureDuration
  if (elapsedTime - lastSpawnTime >= spawnInterval) {
    lastSpawnTime = elapsedTime;
    orbitRotationOffset += THREE.MathUtils.degToRad(phaseOffset); // +N degrees each measure

    // Create a new measure group
    const group = createOrbitGroup();

    // Tilt forward, then rotate about Y by the offset
    group.rotation.x = tiltAngle;
    group.rotation.y = orbitRotationOffset;

    // Start near camera
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

    // Determine how far along you are in this measure (0..1)
    // Each measure is measureDuration long
    const measureFraction = (age / measureDuration) % 1;

    // Update each sphere according to measureFraction + offset
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
animate();
