import * as THREE from 'three';

// ================== 1. BASIC SCENE SETUP ==================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});


// ================== 2. CREATE ELLIPSE GEOMETRY (XZ plane) ==================
function createEllipseGeometry(a, b, segments = 100) {
  const ellipseCurve = new THREE.EllipseCurve(
    0, 0,     // center (x, y)
    a, b,     // xRadius, yRadius
    0, 2 * Math.PI
  );
  const points = ellipseCurve.getPoints(segments);

  const geom = new THREE.BufferGeometry().setFromPoints(points);
  const arr = geom.attributes.position.array;
  for (let i = 0; i < arr.length; i += 3) {
    const oldY = arr[i + 1];
    arr[i + 1] = 0;        // Force local Y=0
    arr[i + 2] = oldY;     // Move old Y -> Z
  }
  return geom;
}

const a = 5;
const b = 3.5;
const ellipseGeom = createEllipseGeometry(a, b, 120);


// ================== 3. CREATE A SINGLE ORBIT GROUP ==================
function createOrbitGroup(color, orbitalPeriod) {
  const group = new THREE.Group();

  // Ellipse
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
  const ellipseLine = new THREE.Line(ellipseGeom, lineMat);
  group.add(ellipseLine);

  // Orbiting sphere
  const sphereGeom = new THREE.SphereGeometry(0.3, 16, 16);
  const sphereMat = new THREE.MeshBasicMaterial({ color });
  const orbitingSphere = new THREE.Mesh(sphereGeom, sphereMat);
  group.add(orbitingSphere);

  // Store data for animation
  group.userData = {
    orbitalPeriod,
    orbitingSphere
  };

  return group;
}


// ================== 4. INSTRUMENT DEFINITIONS (2:3 Polyrhythm) ==================
// If 6s is the "full measure", then
//   Instrument A: 2 orbits in 6s => 3s per orbit
//   Instrument B: 3 orbits in 6s => 2s per orbit
const instruments = [
  { color: 0xff0000, orbitalPeriod: 3.0 }, // 2 orbits
  { color: 0xffff00, orbitalPeriod: 2.0 },  // 3 orbits
  // { color: 0x0000ff, orbitalPeriod: 5.0 }  // 3 orbits
];


// ================== 5. SPAWNING SUCCESSIVE COPIES ==================
const spawnInterval   = 2.0;   // new sets every 2 seconds
const vanishDistance  = 60;    // remove once z < -60
const recessionSpeed  = 6;     // how fast each orbit recedes in Z
const tiltAngle       = -Math.PI / 4; // tilt about X (toward camera)
let lastSpawnTime     = 0;
let orbitRotationOffset = 0;   // increments 10° each spawn

const allOrbitGroups = [];
const clock = new THREE.Clock();


// ================== 6. ANIMATION LOOP ==================
function animate() {
  requestAnimationFrame(animate);
  const elapsedTime = clock.getElapsedTime();

  // 6a) Spawn new orbits every N seconds
  if (elapsedTime - lastSpawnTime >= spawnInterval) {
    lastSpawnTime = elapsedTime;
    orbitRotationOffset += THREE.MathUtils.degToRad(10);

    // For each instrument, spawn a new orbit group
    instruments.forEach((instr) => {
      const { color, orbitalPeriod } = instr;
      const group = createOrbitGroup(color, orbitalPeriod);

      // (1) Tilt entire group so ellipse faces camera
      group.rotation.x = tiltAngle;
      // (2) Fan out each new spawn around Y by an additional 10°
      group.rotation.y = orbitRotationOffset;

      // Start near camera
      group.position.z = 0;

      scene.add(group);

      allOrbitGroups.push({
        group,
        spawnTime: elapsedTime,
      });
    });
  }

  // 6b) Update each active orbit group
  const toRemove = [];

  allOrbitGroups.forEach((entry) => {
    const { group, spawnTime } = entry;
    const { orbitalPeriod, orbitingSphere } = group.userData;
    const age = elapsedTime - spawnTime;

    // Recede group in Z
    group.position.z = -age * recessionSpeed;

    // Animate the orbiting sphere in local coords
    const orbitFraction = (age / orbitalPeriod) % 1;
    const angle = orbitFraction * 2 * Math.PI;

    // Because ellipseGeom is in XZ plane with local y=0,
    // set sphere's x,z in the group's local coords:
    orbitingSphere.position.x = a * Math.cos(angle);
    orbitingSphere.position.y = 0;
    orbitingSphere.position.z = b * Math.sin(angle);

    // Mark for removal if too far
    if (group.position.z < -vanishDistance) {
      toRemove.push(entry);
    }
  });

  // 6c) Remove old orbits
  toRemove.forEach((entry) => {
    scene.remove(entry.group);
    const idx = allOrbitGroups.indexOf(entry);
    if (idx >= 0) {
      allOrbitGroups.splice(idx, 1);
    }
  });

  // 6d) Render
  renderer.render(scene, camera);
}
animate();
