import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as dat from 'dat.gui';

// todo: add dat.gui for interfacing:
// // - visibility: ellipses, intra lines, inter lines
// // - colors: ellipses, intra lines, inter lines
// // - speed: recession velocity
// // - beats per minute
// // 

      // ===================== 0. CONFIG =====================

      const config = {
        // Visibility
        showEllipses: true,
        showInterLines: true,
      
        // Ellipse appearance
        ellipseColor: '#ffffff',
        ellipseOpacity: 0.66,
      
        // Inter line appearance
        interLineColor: '#ffffff',
        interLineOpacity: 0.5,
      
        // Timing / Speed
        recessionVelocity: 4,
        BPM: 107.333,
      };
            

      // ===================== 1. SCENE SETUP =====================
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x20d0d);

      const camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        1500
      );

      // ortho cam settings
      // const aspect = window.innerWidth / window.innerHeight;
      // const frustumSize = 20;
      // const camera = new THREE.OrthographicCamera(
      //   frustumSize * aspect / -2,
      //   frustumSize * aspect / 2,
      //   frustumSize / 2,
      //   frustumSize / -2,
      //   0.1,
      //   1500
      // );

      camera.position.set(0, 0, 15);
      const renderer = new THREE.WebGLRenderer({ antialias: false });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.domElement.className = 'three-container';
      document.body.appendChild(renderer.domElement);

      let controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.5; // Slight inertia for smoothness
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.rotateSpeed = 0.05; // Reduce speed for a subtle effect
      
      // Restrict rotation to a narrow range (small tilts only)
      const maxTilt = THREE.MathUtils.degToRad(10); // Max N-degree tilt in any direction
      controls.minPolarAngle = Math.PI / 2 - maxTilt; // Prevent excessive up/down movement
      controls.maxPolarAngle = Math.PI / 2 + maxTilt;
      controls.minAzimuthAngle = -maxTilt; // Prevent excessive left/right rotation
      controls.maxAzimuthAngle = maxTilt;
      
      window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });

      // ===================== 1b. DAT.GUI SETUP =====================
      const gui = new dat.GUI();

      // --- Visibility folder ---
      const visibilityFolder = gui.addFolder('Visibility');
      visibilityFolder.add(config, 'showEllipses')
        .name('Show Ellipses')
        .onChange((value) => {
          // Toggle ellipse visibility across all groups
          allGroups.forEach((group) => {
            const ellipseLine = group.children[0]; // The ellipse line is the first child
            if (ellipseLine && ellipseLine.isLine) {
              ellipseLine.visible = value;
            }
          });
        });

      visibilityFolder.add(config, 'showInterLines')
        .name('Show Inter Lines')
        .onChange((value) => {
          connectionLines.forEach((line) => {
            line.visible = value;
          });
        });

      // --- Ellipse Appearance folder ---
      const ellipseFolder = gui.addFolder('Ellipse Appearance');
      ellipseFolder.addColor(config, 'ellipseColor')
        .name('Ellipse Color')
        .onChange((newColor) => {
          allGroups.forEach((group) => {
            const ellipseLine = group.children[0];
            if (ellipseLine && ellipseLine.material) {
              ellipseLine.material.color.set(newColor);
            }
          });
        });
      ellipseFolder.add(config, 'ellipseOpacity', 0, 1, 0.01)
        .name('Ellipse Opacity')
        .onChange((newOpacity) => {
          allGroups.forEach((group) => {
            const ellipseLine = group.children[0];
            if (ellipseLine && ellipseLine.material) {
              ellipseLine.material.opacity = newOpacity;
            }
          });
        });

      // --- Inter Lines Appearance folder ---
      const interLinesFolder = gui.addFolder('Inter Lines Appearance');
      interLinesFolder.addColor(config, 'interLineColor')
        .name('Inter Lines Color')
        .onChange((newColor) => {
          connectionLines.forEach((line) => {
            if (line && line.material) {
              line.material.color.set(newColor);
            }
          });
        });
      interLinesFolder.add(config, 'interLineOpacity', 0, 1, 0.01)
        .name('Inter Lines Opacity')
        .onChange((newOpacity) => {
          connectionLines.forEach((line) => {
            if (line && line.material) {
              line.material.opacity = newOpacity;
            }
          });
        });

      // --- Music / Timing folder ---
      const musicFolder = gui.addFolder('Music / Timing');
      musicFolder.add(config, 'recessionVelocity', 0, 20, 0.5)
        .name('Recession Speed');
      musicFolder.add(config, 'BPM', 60, 200, 1)
        .name('Beats per Minute')
        .onChange((newBPM) => {
          BPM = newBPM;
          measureDuration = (4 * 60) / BPM;
          spawnInterval = measureDuration;
        });

      // Optionally close folders
      visibilityFolder.close();
      ellipseFolder.close();
      interLinesFolder.close();
      musicFolder.close();

      // ===================== 2. MUSIC / TIMING =====================
      let BPM = config.BPM;
      let measureDuration = (4 * 60) / BPM; // ~2.243 seconds
      let spawnInterval = measureDuration;

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
          numSteps: 8,
          pattern: new Array(16).fill(false),
          stepsInput: document.getElementById("redStepsInput"),
          patternContainer: document.getElementById("redPattern"),
        },
        {
          color: 0xffff00,
          numSteps: 8,
          pattern: new Array(16).fill(false),
          stepsInput: document.getElementById("yellowStepsInput"),
          patternContainer: document.getElementById("yellowPattern"),
        },
        {
          color: 0x0000ff,
          numSteps: 8,
          pattern: new Array(16).fill(false),
          stepsInput: document.getElementById("blueStepsInput"),
          patternContainer: document.getElementById("bluePattern"),
        },
      ];

      // Set default patterns
      tracks[0].pattern[0] = true; // Step 1 of 8 for red pattern
      tracks[1].pattern[3] = true; // Step 4 of 8 for yellow pattern
      tracks[2].pattern[4] = true; // Step 5 of 8 for blue pattern

      // Utility function: build the checkboxes for a given track
      function buildTrackCheckboxes(track) {
        track.patternContainer.innerHTML = ""; // Clear
        for (let i = 0; i < track.numSteps; i++) {
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = track.pattern[i];
          checkbox.className = "ui-checkbox"; // Add a separate class for UI elements
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

      // Prevent pointer events on UI elements from affecting the 3D scene
      document.querySelectorAll(".ui-checkbox, input[type='number']").forEach((elem) => {
        elem.addEventListener("pointerdown", (event) => {
          event.stopPropagation();
        });
      });

      // ===================== 5. CREATE ORBIT GROUPS =====================
      const vanishDistance = 1500;
      let lastSpawnTime = 0;

      const tiltAngle = -Math.PI / 4;
      let orbitRotationOffset = 0;
      let phaseOffset = 11; // degrees

      const allGroups = [];
      const clock = new THREE.Clock();

      const previousSpheres = {};     // Stores the last generation's spheres by color
      const connectionLines = [];     // Stores the lines between generations

      function createOrbitGroup() {
        const group = new THREE.Group();

        // Ellipse line material
        const ellipseMat = new THREE.LineBasicMaterial({
          color: new THREE.Color(config.ellipseColor),
          transparent: true,
          opacity: config.ellipseOpacity,
        });

        // Ellipse line
        const ellipseLine = new THREE.Line(ellipseGeom, ellipseMat);
        ellipseLine.visible = config.showEllipses; // respect toggle
        group.add(ellipseLine);

        // Build spheres
        const sphereGeom = new THREE.SphereGeometry(0.35, 12, 12);
        const spheres = [];
        const newSpheresByColor = {};

        tracks.forEach((track) => {
          const { color, pattern, numSteps } = track;
          newSpheresByColor[color] = [];

          for (let step = 0; step < numSteps; step++) {
            if (!pattern[step]) continue; // skip if not active

            const sphereMat = new THREE.MeshBasicMaterial({
              color,
              transparent: true,
              opacity: 0.85,
              blending: THREE.AdditiveBlending,
            });

            const sphere = new THREE.Mesh(sphereGeom, sphereMat);
            const offsetAngle = 2 * Math.PI * (step / numSteps);
            sphere.userData = { color, generation: allGroups.length };

            spheres.push({ sphere, offsetAngle });
            newSpheresByColor[color].push(sphere);
            group.add(sphere);
          }
        });

        // Create inter lines between previous and new spheres of the same color
        Object.keys(newSpheresByColor).forEach((color) => {
          if (previousSpheres[color]) {
            previousSpheres[color].forEach((oldSphere, index) => {
              if (
                index < newSpheresByColor[color].length &&
                oldSphere &&
                newSpheresByColor[color][index]
              ) {
                const newSphere = newSpheresByColor[color][index];

                // Get positions of spheres
                const oldPos = oldSphere.getWorldPosition(new THREE.Vector3());
                const newPos = newSphere.getWorldPosition(new THREE.Vector3());

                const positions = new Float32Array([
                  oldPos.x, oldPos.y, oldPos.z,
                  newPos.x, newPos.y, newPos.z
                ]);

                const lineGeom = new THREE.BufferGeometry();
                lineGeom.setAttribute(
                  'position',
                  new THREE.BufferAttribute(positions, 3)
                );

                // Inter line material
                const interMat = new THREE.LineBasicMaterial({
                  color: new THREE.Color(config.interLineColor),
                  transparent: true,
                  opacity: config.interLineOpacity,
                  alphaHash: true,
                });

                const line = new THREE.Line(lineGeom, interMat);
                line.visible = config.showInterLines; // respect toggle

                line.userData = { sphereA: oldSphere, sphereB: newSphere };
                scene.add(line);
                connectionLines.push(line);
              }
            });
          }
        });

        // Update previous spheres for next generation
        Object.keys(newSpheresByColor).forEach((color) => {
          previousSpheres[color] = newSpheresByColor[color];
        });

        // Store in group data
        group.userData = { spheres, birthTime: 0 };
        return group;
      }

      // ===================== 6. ANIMATION LOOP =====================
      function animate() {
        requestAnimationFrame(animate);
        const elapsedTime = clock.getElapsedTime();

        // Use config.recessionVelocity
        const currentRecessionSpeed = config.recessionVelocity;

        // Spawn a new group every measure
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

        // Update groups
        const toRemove = [];
        allGroups.forEach((group) => {
          const { spheres, birthTime } = group.userData;
          const age = elapsedTime - birthTime;

          // Move group along Z axis
          group.position.z = -age * currentRecessionSpeed;

          // measureFraction
          const measureFraction = (age / measureDuration) % 1;

          // Position each sphere on its ellipse
          spheres.forEach(({ sphere, offsetAngle }) => {
            const angle = 2 * Math.PI * measureFraction + offsetAngle;
            sphere.position.x = a * Math.cos(angle);
            sphere.position.y = 0;
            sphere.position.z = b * Math.sin(angle);
          });
        });

        // Update inter lines
        connectionLines.forEach((line) => {
          // Respect showInterLines
          line.visible = config.showInterLines;

          if (!line.userData.sphereA || !line.userData.sphereB) return;
          const posA = line.userData.sphereA.getWorldPosition(new THREE.Vector3());
          const posB = line.userData.sphereB.getWorldPosition(new THREE.Vector3());
          const positions = line.geometry.attributes.position.array;
          positions[0] = posA.x;
          positions[1] = posA.y;
          positions[2] = posA.z;
          positions[3] = posB.x;
          positions[4] = posB.y;
          positions[5] = posB.z;
          line.geometry.attributes.position.needsUpdate = true;
        });

        // Remove old groups
        allGroups.forEach((group) => {
          if (group.position.z < -vanishDistance) {
            toRemove.push(group);
          }
        });
        toRemove.forEach((g) => {
          scene.remove(g);
          const idx = allGroups.indexOf(g);
          if (idx >= 0) allGroups.splice(idx, 1);
        });

        // Remove old connection lines
        for (let i = connectionLines.length - 1; i >= 0; i--) {
          const line = connectionLines[i];
          if (
            line.userData.sphereA.position.z < -vanishDistance ||
            line.userData.sphereB.position.z < -vanishDistance
          ) {
            scene.remove(line);
            connectionLines.splice(i, 1);
          }
        }

        controls.update();
        renderer.render(scene, camera);
      }
      // ===================== 7. AUDIO + START =====================

        // for testing purposes, remove audio player logic
        playerContainer.style.display = 'none';
        animate();

      // let animationStarted = false;
      // const audioElement = document.getElementById("audioPlayer");
      // const playerContainer = document.getElementById("playerContainer");
      // const uiContainer = document.getElementById("uiContainer");
      // uiContainer.style.display = 'none';


      // audioElement.addEventListener("play", () => {
      //   if (!animationStarted) {
      //     clock.start();
      //     animationStarted = true;
      //     animate();
      //   }
        
      //   uiContainer.style.display = 'block';
      //   playerContainer.style.display = 'none';
      // });