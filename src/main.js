import * as THREE from 'three';
import { combineColorsAdditive } from './colorUtils.js'; // relative path

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

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      document.body.appendChild(renderer.domElement);

      window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });

      // ===================== 2. MUSIC / TIMING =====================
      const BPM = 107.333;
      const measureDuration = (4 * 60) / BPM; // ~2.243 seconds
      const spawnInterval = measureDuration;

      // ===================== 3. ELLIPSE GEOMETRY =====================
      function createEllipseGeometry(a, b, segments = 120) {
        const ellipseCurve = new THREE.EllipseCurve(
          0, 0, // center
          a, b, // radii
          0, 2 * Math.PI
        );
        const points = ellipseCurve.getPoints(segments);

        const geom = new THREE.BufferGeometry().setFromPoints(points);
        const arr = geom.attributes.position.array;
        for (let i = 0; i < arr.length; i += 3) {
          const oldY = arr[i + 1];
          arr[i + 1] = 0; // Flatten to Y=0
          arr[i + 2] = oldY; // Move old Y to Z
        }
        return geom;
      }
      const a = 10;
      const b = 7;
      const ellipseGeom = createEllipseGeometry(a, b);

      // ===================== 4. GLOBAL PATTERNS & UI =====================
      // Instead of a single array, let's store everything in an array of track objects:
      // Each track has:
      //   - color
      //   - numSteps
      //   - pattern (boolean array)
      //   - references to DOM elements (step input, pattern container)
      const tracks = [
        {
          color: 0xff0000,
          numSteps: 16,
          pattern: new Array(16).fill(false),
          stepsInput: document.getElementById("redStepsInput"),
          patternContainer: document.getElementById("redPattern"),
        },
        {
          color: 0xffff00,
          numSteps: 16,
          pattern: new Array(16).fill(false),
          stepsInput: document.getElementById("yellowStepsInput"),
          patternContainer: document.getElementById("yellowPattern"),
        },
        {
          color: 0x0000ff,
          numSteps: 16,
          pattern: new Array(16).fill(false),
          stepsInput: document.getElementById("blueStepsInput"),
          patternContainer: document.getElementById("bluePattern"),
        },
      ];

      // Utility function: build the checkboxes for a given track
      function buildTrackCheckboxes(track) {
        track.patternContainer.innerHTML = ""; // Clear
        for (let i = 0; i < track.numSteps; i++) {
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = track.pattern[i];
          checkbox.style.cursor = "pointer";
          checkbox.addEventListener("change", () => {
            // Update pattern array on every toggle
            track.pattern[i] = checkbox.checked;
          });
          track.patternContainer.appendChild(checkbox);
        }
      }

      // Create an event listener for each track's step input
      tracks.forEach((track) => {
        // Rebuild the checkboxes for the default 16 steps
        buildTrackCheckboxes(track);

        // On user changes step count
        track.stepsInput.addEventListener("change", () => {
          const val = parseInt(track.stepsInput.value, 10);
          if (isNaN(val) || val < 1 || val > 24) return;

          // Rebuild pattern array for the new length
          const newPattern = new Array(val).fill(false);
          for (let i = 0; i < Math.min(val, track.numSteps); i++) {
            newPattern[i] = track.pattern[i];
          }
          track.numSteps = val;
          track.pattern = newPattern;

          // Rebuild checkboxes
          buildTrackCheckboxes(track);
        });
      });

      // ===================== 5. CREATE ORBIT GROUPS =====================
      const vanishDistance = 1000;
      const recessionSpeed = 6;
      let lastSpawnTime = 0;

      const tiltAngle = -Math.PI / 4;
      let orbitRotationOffset = 0;
      let phaseOffset = 33; // degrees

      const allGroups = [];
      const clock = new THREE.Clock();

      function createOrbitGroup() {
        const group = new THREE.Group();

        // Ellipse line
        const lineMat = new THREE.LineBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.66,
          depthWrite: false,
        });
        const ellipseLine = new THREE.Line(ellipseGeom, lineMat);
        group.add(ellipseLine);

        // Build spheres based on the current track patterns
        const sphereGeom = new THREE.SphereGeometry(0.35, 12, 12);
        const spheres = []; // array of { sphere, offsetAngle }

        tracks.forEach((track) => {
          const { color, pattern, numSteps } = track;
          for (let step = 0; step < numSteps; step++) {
            if (!pattern[step]) continue; // skip if not active

            const sphereMat = new THREE.MeshBasicMaterial({
              color,
              transparent: true,
              opacity: 0.85,
            });
            const sphere = new THREE.Mesh(sphereGeom, sphereMat);

            // offsetAngle is 2π * (step / numSteps)
            const offsetAngle = 2 * Math.PI * (step / numSteps);

            spheres.push({ sphere, offsetAngle });
            group.add(sphere);
          }
        });

        group.userData = { spheres, birthTime: 0 };
        return group;
      }

      // ===================== 6. ANIMATION LOOP =====================
      function animate() {
        requestAnimationFrame(animate);
        const elapsedTime = clock.getElapsedTime();

        // Spawn a new measure group every measure
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

        // Update each measure group
        const toRemove = [];
        allGroups.forEach((group) => {
          const { spheres, birthTime } = group.userData;
          const age = elapsedTime - birthTime;

          // Recede
          group.position.z = -age * recessionSpeed;

          // measureFraction for this bar
          const measureFraction = (age / measureDuration) % 1;

          // Update each sphere
          spheres.forEach(({ sphere, offsetAngle }) => {
            const angle = 2 * Math.PI * measureFraction + offsetAngle;
            sphere.position.x = a * Math.cos(angle);
            sphere.position.y = 0;
            sphere.position.z = b * Math.sin(angle);
          });

          // Vanish check
          if (group.position.z < -vanishDistance) {
            toRemove.push(group);
          }
        });

        // Remove old groups
        toRemove.forEach((g) => {
          scene.remove(g);
          const idx = allGroups.indexOf(g);
          if (idx >= 0) {
            allGroups.splice(idx, 1);
          }
        });

        renderer.render(scene, camera);
      }

      // ===================== 7. AUDIO + START =====================

        // for testing purposes, remove audio player logic
        playerContainer.style.display = 'none';
        animate();

      // let animationStarted = false;
      // const audioElement = document.getElementById("audioPlayer");
      // const playerContainer = document.getElementById("playerContainer");

      // audioElement.addEventListener("play", () => {
      //   if (!animationStarted) {
      //     clock.start();
      //     animationStarted = true;
      //     animate();
      //   }
        
      //   // Hide the audio element if you want
      //   playerContainer.style.display = 'none';
      // });