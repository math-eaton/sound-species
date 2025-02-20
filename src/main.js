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

      // ===================== 3. ELLIPSE GEOMETRY (LOCAL XZ) =====================
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

      // ===================== 4. GLOBAL PATTERNS & UI LOGIC =====================
      // We store 3 separate pattern arrays, one for each "sphere/instrument"
      // Default to 16 steps. Each is an array of boolean: true=active step, false=inactive.
      let numSteps = 16;
      let patterns = [
        new Array(numSteps).fill(false), // Red
        new Array(numSteps).fill(false), // Yellow
        new Array(numSteps).fill(false), // Blue
      ];

      // Create some quick helpers for building & reading pattern checkboxes:
      function buildCheckboxes(containerId, instrumentIndex) {
        const container = document.getElementById(containerId);
        container.innerHTML = ""; // Clear existing

        for (let i = 0; i < numSteps; i++) {
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = patterns[instrumentIndex][i];
          checkbox.dataset["stepIndex"] = i;
          checkbox.dataset["instIndex"] = instrumentIndex;
          // For clarity, you can add a label if you want step numbers visible:
          // but the grid is small, so we’ll skip labeling each step.

          container.appendChild(checkbox);
        }
      }

      function rebuildAllCheckboxes() {
        buildCheckboxes("redPattern", 0);
        buildCheckboxes("yellowPattern", 1);
        buildCheckboxes("bluePattern", 2);
      }

      function readPatternsFromUI() {
        // For each instrument container, read all checkboxes
        ["redPattern","yellowPattern","bluePattern"].forEach((id, instIdx) => {
          const container = document.getElementById(id);
          const checkboxes = container.querySelectorAll("input[type='checkbox']");
          checkboxes.forEach((cb) => {
            const stepIndex = Number(cb.dataset["stepIndex"]);
            patterns[instIdx][stepIndex] = cb.checked;
          });
        });
      }

      // Initialize UI with 16 toggles each
      rebuildAllCheckboxes();

      const stepsInput = document.getElementById("stepsInput");
      const applyStepsBtn = document.getElementById("applyStepsBtn");
      const updatePatternBtn = document.getElementById("updatePatternBtn");

      applyStepsBtn.addEventListener("click", () => {
        // Use the new step count
        const newVal = parseInt(stepsInput.value, 10);
        if (isNaN(newVal) || newVal < 1 || newVal > 45) return;

        numSteps = newVal;
        // Rebuild the pattern arrays (preserving old data if smaller or larger)
        patterns = patterns.map(oldArr => {
          const newArr = new Array(numSteps).fill(false);
          for (let i = 0; i < Math.min(numSteps, oldArr.length); i++) {
            newArr[i] = oldArr[i];
          }
          return newArr;
        });
        rebuildAllCheckboxes();
      });

      updatePatternBtn.addEventListener("click", () => {
        readPatternsFromUI();
      });

      // ===================== 5. CREATE ONE ORBIT GROUP (PER MEASURE) =====================
      // Now, instead of just 3 spheres with fixed offsets, we’ll create one sphere
      // for each "active" step in each instrument. We’ll store them in userData for that group.
      const vanishDistance = 1000;  // once z < -N, remove
      const recessionSpeed = 6;     // how fast groups recede
      let lastSpawnTime = 0;

      //  each new measure group tilted forward by -45° towards viewer
      // + rotated out of phase from previous generation by +N°
      const tiltAngle = -Math.PI / 4;
      let orbitRotationOffset = 0;
      let phaseOffset = 45; // degrees

      const allGroups = [];
      const clock = new THREE.Clock();

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

        // For each instrument, for each step, if active => create sphere
        const sphereGeom = new THREE.SphereGeometry(0.35, 12, 12);
        const instrumentsColors = [0xff0000, 0xffff00, 0x0000ff];

        const spheres = []; 
        for (let inst = 0; inst < 3; inst++) {
          for (let step = 0; step < numSteps; step++) {
            if (!patterns[inst][step]) continue; // skip if inactive
            const sphereMat = new THREE.MeshBasicMaterial({
              color: instrumentsColors[inst],
              transparent: true,
              opacity: 0.85,
              alphaHash: 0.15,
              wireframe: false,
            });
            const sphere = new THREE.Mesh(sphereGeom, sphereMat);

            // offset = stepIndex * stepSize, plus maybe small instrument offset
            const stepFraction = step / numSteps;
            // 2 * Math.PI * measureFraction + offset => offset is 2 * Math.PI * stepFraction
            // If you want an additional offset per instrument, you can add something like:
            // + inst * (Math.PI / 6)
            const offsetAngle = 2 * Math.PI * stepFraction;

            spheres.push({ sphere, offsetAngle });
            group.add(sphere);
          }
        }

        group.userData = {
          spheres,       // array of { sphere, offsetAngle }
          birthTime: 0,  // set later
        };

        return group;
      }

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

          // measureFraction = [0..1] across the measure
          const measureFraction = (age / measureDuration) % 1;

          // Update each sphere position around the ellipse
          spheres.forEach(({ sphere, offsetAngle }) => {
            // angle = 2π * measureFraction + offsetAngle
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
          clock.start();
          animationStarted = true;
          animate();
        }
        // Hide the audio element if you want
        playerContainer.style.display = 'none';
      });