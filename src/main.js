"use strict";

import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';

let container;

let camera, scene, renderer;
let controller;
let reticle;
let menuGroup;
let rulesGroup;
let isMenuVisible = false;
let isRulesVisible = false;

let cachedModel = null;
let baseModelGroup; // New group to contain the base model
let organGroups = new Map();

let timerElement; // Timer element
let timerInterval; // Timer interval
let timerValue = 0; // Initial timer value

let mainOrgans = [];
let originalOrganPositions = new Map();
let currentOrganIndex = 0;
let organDisplayMesh;
let font;
let baseModel;

let hitTestSource = null;
let hitTestSourceRequested = false;

let isVictoryAnimationPlaying = false;
let victoryAnimationDuration = 4000;
let gameMode = null;
let isGameActive = false;
let originalMaterials = new Map();

let menuShadow;

let gamepad;
let hapticActuator;

let audioListener; // Add this at the top with other declarations
let soundMap = new Map(); // Add this to cache loaded sounds
let menuMusic;

function create3DMenu() {
  menuGroup = new THREE.Group();

  // Create main panel
  const panelGeometry = new THREE.BoxGeometry(0.8, 1.2, 0.05);
  const panelMaterial = new THREE.MeshPhongMaterial({
    color: 0x2c3e50,
    transparent: true,
    opacity: 0.6,
    shininess: 100
  });
  const mainPanel = new THREE.Mesh(panelGeometry, panelMaterial);
  menuGroup.add(mainPanel);

  // Add title panel
  const titleGeometry = new THREE.BoxGeometry(0.7, 0.15, 0.07);
  const titleMaterial = new THREE.MeshPhongMaterial({
    color: 0x3498db,
    shininess: 100,
    transparent: true,
    opacity: 0.8,
  });
  const titlePanel = new THREE.Mesh(titleGeometry, titleMaterial);
  titlePanel.position.set(0, 0.5, 0.03);
  menuGroup.add(titlePanel);

  // Create buttons
  const buttonGeometry = new THREE.BoxGeometry(0.6, 0.12, 0.07);
  const buttonMaterials = {
    default: new THREE.MeshPhongMaterial({
      color: 0x27ae60,
      shininess: 100,
      transparent: true,
      opacity: 0.85
    }),
    rules: new THREE.MeshPhongMaterial({
      color: 0xe74c3c,
      shininess: 100,
      transparent: true,
      opacity: 0.85
    }),
    settings: new THREE.MeshPhongMaterial({
      color: 0xf39c12,
      shininess: 100,
      transparent: true,
      opacity: 0.85
    })
  };

  // Start Button
  const startButton = new THREE.Mesh(buttonGeometry, buttonMaterials.default);
  startButton.position.set(0, 0.2, 0.03);
  startButton.userData = { type: 'button', action: 'start' };
  menuGroup.add(startButton);

  // Rules Button
  const rulesButton = new THREE.Mesh(buttonGeometry, buttonMaterials.rules);
  rulesButton.position.set(0, 0, 0.03);
  rulesButton.userData = { type: 'button', action: 'rules' };
  menuGroup.add(rulesButton);

  // Settings Button
  const settingsButton = new THREE.Mesh(buttonGeometry, buttonMaterials.settings);
  settingsButton.position.set(0, -0.2, 0.03);
  settingsButton.userData = { type: 'button', action: 'settings' };
  menuGroup.add(settingsButton);

  // Add decorative elements
  const edgeGeometry = new THREE.BoxGeometry(0.03, 1.2, 0.03);
  const edgeMaterial = new THREE.MeshPhongMaterial({
    color: 0x3498db,
    shininess: 100,
    transparent: true,
    opacity: 0.7,
  });

  // Left edge
  const leftEdge = new THREE.Mesh(edgeGeometry, edgeMaterial);
  leftEdge.position.set(-0.4, 0, 0.03);
  menuGroup.add(leftEdge);

  // Right edge
  const rightEdge = new THREE.Mesh(edgeGeometry, edgeMaterial);
  rightEdge.position.set(0.4, 0, 0.03);
  menuGroup.add(rightEdge);

  // Add text for all elements using FontLoader
  const loader = new FontLoader();
  loader.load('assets/fonts/DynaPuff_Regular.json', function (font) {
    // Title text
    const titleTextGeometry = new TextGeometry('Menu du jeu', {
      font: font,
      size: 0.05,
      depth: 0.01,
    });
    titleTextGeometry.computeBoundingBox();
    const titleTextWidth = titleTextGeometry.boundingBox.max.x - titleTextGeometry.boundingBox.min.x;

    const titleTextMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const titleText = new THREE.Mesh(titleTextGeometry, titleTextMaterial);
    titleText.position.set(-titleTextWidth / 2, 0.48, 0.07);
    menuGroup.add(titleText);

    // Button text configurations
    const buttonTexts = [
      { text: 'Jouer', y: 0.17, x: -0.1 },
      { text: 'Règles', y: -0.03, x: -0.12 },
      { text: 'Réglages', y: -0.23, x: -0.17 }
    ];

    buttonTexts.forEach(({ text, y, x }) => {
      const textGeometry = new TextGeometry(text, {
        font: font,
        size: 0.05,
        depth: 0.01,
      });
      const textMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
      const textMesh = new THREE.Mesh(textGeometry, textMaterial);
      textMesh.position.set(x, y, 0.07);
      menuGroup.add(textMesh);
    });
  });

  // Create shadow plane separately from menu group
  const shadowPlaneGeometry = new THREE.PlaneGeometry(1.2, 1.6);
  const canvas = createShadowTexture();
  if (!canvas) return;
  const shadowTexture = new THREE.CanvasTexture(canvas);
  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    depthWrite: false,
    opacity: 0.4
  });
  menuShadow = new THREE.Mesh(shadowPlaneGeometry, shadowMaterial);
  menuShadow.rotation.x = -Math.PI / 2;
  menuShadow.visible = false;
  scene.add(menuShadow);

  if (!menuMusic) {
    menuMusic = new THREE.PositionalAudio(audioListener);
    const audioLoader = new THREE.AudioLoader();
    audioLoader.load('assets/sounds/menu_music.mp3', (buffer) => {
      menuMusic.setBuffer(buffer);
      menuMusic.setRefDistance(2);
      menuMusic.setRolloffFactor(1);
      menuMusic.setVolume(0.4);
      menuMusic.setLoop(true);
      menuGroup.add(menuMusic);
    });
  }
  menuGroup.visible = false;
  return menuGroup;
}

// Add this new function to create the shadow texture
function createShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) {
    console.error('Could not create 2D canvas context');
    return;
  }

  // Create radial gradient for soft shadow
  const gradient = context.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    0,
    canvas.width / 2,
    canvas.height / 2,
    canvas.width / 2
  );
  gradient.addColorStop(0, 'rgba(0,0,0,0.4)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  // Apply gradient
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  return canvas;
}

function createRulesDisplay() {
  const rulesGroup = new THREE.Group();

  // Background panel for rules
  const panelGeometry = new THREE.BoxGeometry(1.2, 1.5, 0.05);
  const panelMaterial = new THREE.MeshPhongMaterial({
    color: 0x2c3e50,
    transparent: true,
    opacity: 0.8,
  });
  const rulesPanel = new THREE.Mesh(panelGeometry, panelMaterial);
  rulesGroup.add(rulesPanel);

  // Add decorative border
  const borderGeometry = new THREE.BoxGeometry(1.25, 1.55, 0.03);
  const borderMaterial = new THREE.MeshPhongMaterial({
    color: 0x3498db,
    transparent: true,
    opacity: 0.6,
  });
  const border = new THREE.Mesh(borderGeometry, borderMaterial);
  border.position.z = -0.01;
  rulesGroup.add(border);

  // Add back button
  const buttonGeometry = new THREE.BoxGeometry(0.3, 0.1, 0.07);
  const buttonMaterial = new THREE.MeshPhongMaterial({
    color: 0xe74c3c,
    transparent: true,
    opacity: 0.85,
  });
  const backButton = new THREE.Mesh(buttonGeometry, buttonMaterial);
  backButton.position.set(0, -0.65, 0.03);
  backButton.userData = { type: 'button', action: 'back' };
  rulesGroup.add(backButton);

  // Add text using FontLoader
  const loader = new FontLoader();
  loader.load('assets/fonts/DynaPuff_Regular.json', function (font) {
    // Title
    const titleGeometry = new TextGeometry('Règles', {
      font: font,
      size: 0.1,
      depth: 0.02,
    });
    const titleMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const titleText = new THREE.Mesh(titleGeometry, titleMaterial);
    titleText.position.set(-0.23, 0.6, 0.03);
    rulesGroup.add(titleText);

    // Rules content
    const rulesContent = [
      "1. Regardez l'organe affiché",
      "2. Cliquez sur la position adéquate",
      "de l'organe sur le squelette",
      "3. Apprenez l'anatomie en RA",
    ];

    rulesContent.forEach((rule, index) => {
      const ruleGeometry = new TextGeometry(rule, {
        font: font,
        size: 0.04,
        depth: 0.01,
      });
      const ruleText = new THREE.Mesh(ruleGeometry, titleMaterial);
      if (index === 0) {
        ruleText.position.set(-0.55, 0.45, 0.03);
      }
      else if (index === 1) {
        ruleText.position.set(-0.55, 0.35, 0.03);
      }
      else if (index === 2) {
        ruleText.position.set(-0.55, 0.30, 0.03);
      }
      else if (index === 3) {
        ruleText.position.set(-0.55, 0.20, 0.03);
      }
      rulesGroup.add(ruleText);
    });

    // Back button text
    const backTextGeometry = new TextGeometry('Retour', {
      font: font,
      size: 0.05,
      depth: 0.01,
    });
    const backText = new THREE.Mesh(backTextGeometry, titleMaterial);
    backText.position.set(-0.13, -0.67, 0.07);
    rulesGroup.add(backText);
  });

  rulesGroup.visible = false;
  return rulesGroup;
}

export function createMainScene() {
  if (renderer) {
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement = null;
  }

  init();

  timerValue = 0;

  // Create and style the loader element
  const loaderElement = document.createElement('div');
  loaderElement.id = 'loader';
  loaderElement.style.position = 'fixed';
  loaderElement.style.top = '0';
  loaderElement.style.left = '0';
  loaderElement.style.width = '100%';
  loaderElement.style.height = '100%';
  loaderElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  loaderElement.style.display = 'flex';
  loaderElement.style.justifyContent = 'center';
  loaderElement.style.alignItems = 'center';
  loaderElement.style.zIndex = '1000';

  loaderElement.innerHTML = `
  <div id="logo-container">
    <img src="./assets/loader/Rolling@1x-1.0s-200px-200px.svg" alt="Loading SVG" id="logo" />
    <div id="loading-text">Loading</div>
  </div>
  `;

  document.body.appendChild(loaderElement);

  const style = document.createElement('style');
  style.textContent = `
  #loader {
    backdrop-filter: blur(10px);
    display: flex;
  }

  #logo {
    width: 150px;
    height: 150px;
    animation: spin 1s linear infinite;
  }

  #loading-text {
    color: white;
    font-size: 24px;
    margin-top: 20px;
    text-align: center;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  `;

  document.head.appendChild(style);

  const objLoader = new OBJLoader();
  const mtlLoader = new MTLLoader();

  if (cachedModel) {
    // Use the cached model if it exists
    onModelLoaded(cachedModel.clone());
    loaderElement.style.display = 'none'; // Hide the loader
  } else {
    // Load the materials first
    mtlLoader.load('assets/models/source/Z-Anatomy-Layers1-7.mtl', (materials) => {
      materials.preload();
      objLoader.setMaterials(materials);
      // Load the model and cache it
      objLoader.load(
        'assets/models/source/Z-Anatomy-Layers1-7.obj',
        (object) => {
          cachedModel = object.clone(); // Cache the loaded model
          onModelLoaded(object);
          loaderElement.style.display = 'none'; // Hide the loader
        },
        (xhr) => {
          console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
        },
        (error) => {
          console.error('An error occurred:', error);
        }
      );
    });
  }
}

function onModelLoaded(object) {

  // Create a group and add the model to it
  baseModelGroup = new THREE.Group();
  baseModelGroup.add(object);
  processLoadedModel(object);
}

function processLoadedModel(object) {
  console.log("Processing loaded model");
  baseModel = object;

  // Define organ groups with their related parts
  const organDefinitions = {
    liver: ['liver', 'hepatic'],
    heart: ['heart', 'cardiac', 'atrium', 'ventricle'],
    lungs: ['lung', 'pulmonary'],
    kidneys: ['kidney', 'renal'],
    stomach: ['stomach', 'gastric'],
    brain: ['brain', 'cerebral', 'cerebellum'],
    intestines: ['intestine', 'bowel', 'colon', 'duodenum'],
    pancreas: ['pancreas', 'pancreatic'],
    spleen: ['spleen', 'splenic'],
    bladder: ['bladder', 'urinary']
  };

  const obstructParts = ['taenia', 'rib', 'mesocolon', 'sternum', 'cartilages', 'xiphoid', 'bronchi', 'mesocolic', 'thymus'];

  // Initialize organ groups
  Object.keys(organDefinitions).forEach(organName => {
    organGroups.set(organName, {
      parts: [],
      center: new THREE.Vector3(),
      visible: false
    });
  });

  function processObject(obj) {
    const name = obj.name.toLowerCase();

    // Check if object belongs to any organ group
    let belongsToOrgan = false;
    for (const [organName, keywords] of Object.entries(organDefinitions)) {
      if (keywords.some(keyword => name.includes(keyword.toLowerCase()))) {
        organGroups.get(organName).parts.push(obj);
        belongsToOrgan = true;
        break;
      }
    }

    // Handle obstruct parts
    if (!belongsToOrgan && obstructParts.some(part => name.includes(part.toLowerCase()))) {
      hideObjectAndChildren(obj);
    }

    // Process children recursively
    if (obj.children) {
      obj.children.forEach(processObject);
    }
  }

  function hideObjectAndChildren(obj) {
    obj.visible = false;
    if (obj.children) {
      obj.children.forEach(hideObjectAndChildren);
    }
  }

  // Process the model
  processObject(object);

  // Calculate center positions for each organ group
  organGroups.forEach((group, organName) => {
    if (group.parts.length > 0) {
      let centerSum = new THREE.Vector3();
      let totalPoints = 0;

      group.parts.forEach(part => {
        if (part.geometry) {
          part.geometry.computeBoundingBox();
          const center = new THREE.Vector3();
          part.geometry.boundingBox.getCenter(center);
          part.localToWorld(center);
          centerSum.add(center);
          totalPoints++;
        }
      });

      if (totalPoints > 0) {
        group.center.copy(centerSum.divideScalar(totalPoints));
        mainOrgans.push({
          name: organName,
          parts: group.parts,
          center: group.center
        });
        originalOrganPositions.set(organName, group.center.clone());
      }
    }
  });

  // Hide all organ parts initially
  mainOrgans.forEach(organ => {
    organ.parts.forEach(part => {
      part.visible = false;
    });
  });
}


function createVictoryParticles() {
  const particleCount = 100;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);

  // Create particles around the model
  const box = new THREE.Box3().setFromObject(baseModelGroup);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  for (let i = 0; i < particleCount; i++) {
    // Position
    const radius = 1.5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;

    positions[i * 3] = center.x + radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = center.y + radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = center.z + radius * Math.cos(phi);

    // Color - golden particles
    colors[i * 3] = 1;  // R
    colors[i * 3 + 1] = 0.8 + Math.random() * 0.2;  // G
    colors[i * 3 + 2] = 0;  // B
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.05,
    vertexColors: true,
    transparent: true,
    opacity: 0.8
  });

  const particles = new THREE.Points(geometry, material);
  scene.add(particles);

  // Animate particles
  const startTime = Date.now();

  function animateParticles() {
    const elapsedTime = Date.now() - startTime;

    if (elapsedTime < victoryAnimationDuration) {
      const positions = geometry.attributes.position.array;

      for (let i = 0; i < particleCount; i++) {
        // Spiral upward movement
        const theta = elapsedTime * 0.001 + i;
        const radius = 1.5 + (elapsedTime / victoryAnimationDuration) * 0.5;

        positions[i * 3] = center.x + radius * Math.cos(theta);
        positions[i * 3 + 1] += 0.005; // Move up
        positions[i * 3 + 2] = center.z + radius * Math.sin(theta);
      }

      geometry.attributes.position.needsUpdate = true;
      material.opacity = 1 - (elapsedTime / victoryAnimationDuration);

      requestAnimationFrame(animateParticles);
    } else {
      scene.remove(particles);
      geometry.dispose();
      material.dispose();
    }
  }

  animateParticles();
}

function startTimer() {
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timerValue++;
    updateTimerDisplay();
  }, 1000);
}
function stopTimer() {
  clearInterval(timerInterval);
}

function updateTimerDisplay() {
  if (timerElement) {
    timerElement.textContent = `TIMER: ${timerValue}s`;
  }
}

function animate(timestamp, frame) {
  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const session = renderer.xr.getSession();

    if (hitTestSourceRequested === false) {
      session.requestReferenceSpace('viewer').then(function (referenceSpace) {
        session.requestHitTestSource({ space: referenceSpace }).then(function (source) {
          hitTestSource = source;
        });
      });

      session.addEventListener('end', function () {
        hitTestSourceRequested = false;
        hitTestSource = null;
      });

      hitTestSourceRequested = true;
    }

    if (hitTestSource) {
      const hitTestResults = frame.getHitTestResults(hitTestSource);

      if (hitTestResults.length) {
        const hit = hitTestResults[0];
        reticle.visible = true;
        reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
      } else {
        reticle.visible = false;
      }
    }

    // Update menu orientation to face user
    if ((isMenuVisible && menuGroup) || (isRulesVisible && rulesGroup)) {
      const cameraPosition = new THREE.Vector3();
      camera.getWorldPosition(cameraPosition);

      const direction = new THREE.Vector3();

      if (isMenuVisible && menuGroup) {
        direction.subVectors(cameraPosition, menuGroup.position);
        direction.y = 0;
        menuGroup.lookAt(menuGroup.position.clone().add(direction));
        menuGroup.rotation.y += Math.PI / 10;

        // Update shadow position
        updateMenuShadow();
      }

      if (isRulesVisible && rulesGroup) {
        direction.subVectors(cameraPosition, rulesGroup.position);
        direction.y = 0;
        rulesGroup.lookAt(rulesGroup.position.clone().add(direction));
        rulesGroup.rotation.y += Math.PI / 10;
      }
    }
  }

  // Make floating text face camera
  scene.traverse((object) => {
    if (object.userData.type === 'floatingText') {
      const cameraPosition = new THREE.Vector3();
      camera.getWorldPosition(cameraPosition);
      object.lookAt(cameraPosition);
    }
  });

  renderer.render(scene, camera);
}

function init() {
  container = document.createElement('div');
  document.body.appendChild(container);

  scene = new THREE.Scene();

  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 10); // meters
  camera.position.set(0, 1.6, 3);

  // Add audio listener to camera
  audioListener = new THREE.AudioListener();
  camera.add(audioListener);

  const light = new THREE.AmbientLight(0xffffff, 1.0); // soft white light
  scene.add(light);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(0, 5, 5);
  scene.add(directionalLight);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate); // requestAnimationFrame() replacement, compatible with XR
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  document.body.appendChild(ARButton.createButton(renderer));

  menuGroup = create3DMenu();
  if (menuGroup) {
    scene.add(menuGroup);
  }

  rulesGroup = createRulesDisplay();
  scene.add(rulesGroup);

  const onSelect = (event) => {
    if (isVictoryAnimationPlaying) return;

    if (reticle.visible && !baseModelGroup.parent) {
      // Place the model
      reticle.matrix.decompose(baseModelGroup.position, baseModelGroup.quaternion, baseModelGroup.scale);
      scene.add(baseModelGroup);

      if (menuMusic && !menuMusic.isPlaying) {
        console.log("Playing menu music");
        menuMusic.play();
      }

      // Show menu
      menuGroup.position.copy(baseModelGroup.position);
      menuGroup.position.x -= 1;
      menuGroup.position.y += 1.3;
      menuGroup.visible = true;
      isMenuVisible = true;
    } else if (isGameActive) {
      handleOrganPlacement(controller);
    } else {
      // Handle menu interactions
      const raycaster = new THREE.Raycaster();
      const tempMatrix = new THREE.Matrix4();
      tempMatrix.identity().extractRotation(controller.matrixWorld);
      raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

      let intersects = [];

      // Check for intersections with the active group
      if (isMenuVisible) {
        intersects = raycaster.intersectObjects(menuGroup.children, true);
      } else if (isRulesVisible) {
        intersects = raycaster.intersectObjects(rulesGroup.children, true);
      }

      if (intersects.length > 0) {
        // Find the first intersected object that has userData
        const selected = intersects.find(intersect => intersect.object.userData?.type === 'button')?.object;

        if (selected && selected.userData.type === 'button') {
          handleMenuAction(selected.userData.action);
        }
      }
    }
  };

  controller = renderer.xr.getController(0);
  controller.addEventListener('select', onSelect);
  controller.addEventListener('connected', (event) => {
    gamepad = event.data.gamepad;
    hapticActuator = gamepad?.vibrationActuator;
  });
  scene.add(controller);

  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial()
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  window.addEventListener('resize', onWindowResize, false);
}

// Ajouter la nouvelle fonction pour le retour haptique
function triggerHapticFeedback(strongFeedback = false) {
  if (hapticActuator) {
    if (strongFeedback) {
      // Fort retour haptique pour les succès
      hapticActuator.pulse(1.0, 100);
    } else {
      // Léger retour haptique pour les interactions
      hapticActuator.pulse(0.5, 50);
    }
  }
}

function handleMenuAction(action) {
  triggerHapticFeedback(); // Ajouter retour haptique
  switch (action) {
    case 'start':
      menuGroup.visible = false;
      menuShadow.visible = false; // Add this line
      isMenuVisible = false;
      createDifficultySelection();
      break;
    case 'rules':
      showRules();
      break;
    case 'settings':
      showSettings();
      break;
    case 'back':
      showMenu();
      break;
  }
}

function setupSimpleMode() {
  const organDefinitions = {
    liver: ['liver', 'hepatic'],
    heart: ['heart', 'cardiac', 'atrium', 'ventricle'],
    lungs: ['lung', 'pulmonary'],
    kidneys: ['kidney', 'renal'],
    stomach: ['stomach', 'gastric'],
    brain: ['brain', 'cerebral', 'cerebellum'],
    intestines: ['intestine', 'bowel', 'colon', 'duodenum'],
    pancreas: ['pancreas', 'pancreatic'],
    spleen: ['spleen', 'splenic'],
    bladder: ['bladder', 'urinary']
  };

  // Clear existing organ groups
  organGroups.clear();

  // Initialize organ groups
  Object.keys(organDefinitions).forEach(organName => {
    organGroups.set(organName, {
      parts: [],
      center: new THREE.Vector3(),
      visible: false
    });
  });

  // Process and group organs
  baseModel.traverse((obj) => {
    const name = obj.name.toLowerCase();

    for (const [organName, keywords] of Object.entries(organDefinitions)) {
      if (keywords.some(keyword => name.includes(keyword.toLowerCase()))) {
        const group = organGroups.get(organName);
        group.parts.push(obj);
        obj.visible = false;
        break;
      }
    }
  });

  // Calculate centers and create main organs
  organGroups.forEach((group, organName) => {
    if (group.parts.length > 0) {
      let centerSum = new THREE.Vector3();
      let totalPoints = 0;

      group.parts.forEach(part => {
        if (part.geometry) {
          part.geometry.computeBoundingBox();
          const center = new THREE.Vector3();
          part.geometry.boundingBox.getCenter(center);
          part.localToWorld(center);
          centerSum.add(center);
          totalPoints++;
        }
      });

      if (totalPoints > 0) {
        group.center.copy(centerSum.divideScalar(totalPoints));
        mainOrgans.push({
          name: organName,
          parts: group.parts,
          center: group.center
        });
        originalOrganPositions.set(organName, group.center.clone());
      }
    }
  });
}

function setupAdvancedMode() {
  const organNames = [
    'heart', 'liver', 'lung', 'kidney', 'stomach',
    'brain', 'intestine', 'pancreas', 'spleen', 'bladder',
    'esophagus', 'trachea', 'gallbladder', 'appendix', 'thyroid',
  ];

  baseModel.traverse((obj) => {
    const name = obj.name.toLowerCase();
    if (organNames.some(organName => name.includes(organName))) {
      mainOrgans.push(obj);
      const organPos = getobjectPos(obj);
      originalOrganPositions.set(obj, organPos.clone());
      obj.visible = false;
    }
  });

}

const getobjectPos = (bone) => {
  if (!bone.geometry) {
    console.error("L'os n'a pas de géométrie définie.");
    return new THREE.Vector3(0, 0, 0);
  }

  bone.geometry.computeBoundingBox();
  const boundingBox = bone.geometry.boundingBox;
  const center = new THREE.Vector3();
  boundingBox.getCenter(center);
  bone.localToWorld(center);

  return center;
};

function createDifficultySelection() {
  const difficultyGroup = new THREE.Group();

  // Create main panel
  const panelGeometry = new THREE.BoxGeometry(1.2, 0.8, 0.05);
  const panelMaterial = new THREE.MeshPhongMaterial({
    color: 0x2c3e50,
    transparent: true,
    opacity: 0.8
  });
  const mainPanel = new THREE.Mesh(panelGeometry, panelMaterial);
  difficultyGroup.add(mainPanel);

  // Create buttons
  const buttonGeometry = new THREE.BoxGeometry(0.5, 0.2, 0.07);
  const simpleMaterial = new THREE.MeshPhongMaterial({
    color: 0x27ae60,
    transparent: true,
    opacity: 0.9
  });
  const advancedMaterial = new THREE.MeshPhongMaterial({
    color: 0xe74c3c,
    transparent: true,
    opacity: 0.9
  });

  // Simple mode button
  const simpleButton = new THREE.Mesh(buttonGeometry, simpleMaterial);
  simpleButton.position.set(-0.3, 0, 0.03);
  simpleButton.userData = { type: 'button', action: 'simple' };
  difficultyGroup.add(simpleButton);

  // Advanced mode button
  const advancedButton = new THREE.Mesh(buttonGeometry, advancedMaterial);
  advancedButton.position.set(0.3, 0, 0.03);
  advancedButton.userData = { type: 'button', action: 'advanced' };
  difficultyGroup.add(advancedButton);

  // Add text using FontLoader
  const fontLoader = new FontLoader();
  fontLoader.load('assets/fonts/DynaPuff_Regular.json', (font) => {
    // Title text
    const titleGeometry = new TextGeometry('Select Difficulty', {
      font: font,
      size: 0.08,
      depth: 0.02
    });
    const titleMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const titleMesh = new THREE.Mesh(titleGeometry, titleMaterial);
    titleMesh.position.set(-0.5, 0.2, 0.03);
    difficultyGroup.add(titleMesh);

    // Button texts
    const simpleTextGeometry = new TextGeometry('Simple', {
      font: font,
      size: 0.06,
      depth: 0.01
    });
    const simpleTextMesh = new THREE.Mesh(simpleTextGeometry, titleMaterial);
    simpleTextMesh.position.set(-0.47, 0, 0.1);
    difficultyGroup.add(simpleTextMesh);

    const advancedTextGeometry = new TextGeometry('Advanced', {
      font: font,
      size: 0.06,
      depth: 0.01
    });
    const advancedTextMesh = new THREE.Mesh(advancedTextGeometry, titleMaterial);
    advancedTextMesh.position.set(0.08, 0, 0.1);
    difficultyGroup.add(advancedTextMesh);
  });

  // Position the difficulty selection relative to the menu
  difficultyGroup.position.copy(menuGroup.position);
  difficultyGroup.quaternion.copy(menuGroup.quaternion);
  scene.add(difficultyGroup);

  // Add event listener for difficulty selection
  const handleSelect = () => {
    const raycaster = new THREE.Raycaster();
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    const intersects = raycaster.intersectObjects(difficultyGroup.children);
    if (intersects.length > 0) {
      const selected = intersects[0].object;
      if (selected.userData.type === 'button') {
        scene.remove(difficultyGroup);
        controller.removeEventListener('select', handleSelect);
        selectDifficulty(selected.userData.action);
      }
    }
  };

  controller.addEventListener('select', handleSelect);
}

// Modify selectDifficulty function
function selectDifficulty(mode) {
  if (menuMusic && menuMusic.isPlaying) {
    menuMusic.stop();
  }
  triggerHapticFeedback(); // Ajouter retour haptique
  gameMode = mode;
  resetOrgansForMode();
  startGame();
}

function resetOrgansForMode() {
  for (const organ of mainOrgans) {
    if (Array.isArray(organ.parts)) {
      organ.parts.forEach(part => {
        part.visible = false;
      });
    } else {
      organ.visible = false;
    }
  }
  mainOrgans = []// Clear existing organs
  originalOrganPositions.clear();

  if (gameMode === 'simple') {
    setupSimpleMode();
  } else {
    setupAdvancedMode();
  }
}

function startGame() {
  if (!soundMap.has('assets/sounds/game_music.mp3')) {
    const music = new THREE.PositionalAudio(audioListener);
    const audioLoader = new THREE.AudioLoader();

    audioLoader.load('assets/sounds/game_music.mp3', (buffer) => {
      music.setBuffer(buffer);
      music.setRefDistance(3);
      music.setRolloffFactor(0.5); // Lower rolloff for background music
      music.setVolume(0.2);
      music.setLoop(true);
      soundMap.set('assets/sounds/game_music.mp3', music);
      if (isGameActive) {
        music.play();
      }
    });
  } else {
    const music = soundMap.get('assets/sounds/game_music.mp3');
    if (music && !music.isPlaying) {
      music.play();
    }
  }

  mainOrgans.sort(() => Math.random() - 0.5);
  currentOrganIndex = 0;
  createOrganDisplay();
  console.log('Game started!');
  timerValue = 0;
  startTimer();
  isGameActive = true;
}

// Add new function to create 3D organ display
function createOrganDisplay() {
  // Remove existing display if any
  if (organDisplayMesh) {
    scene.remove(organDisplayMesh);
    if (organDisplayMesh.geometry) organDisplayMesh.geometry.dispose();
    if (organDisplayMesh.material) organDisplayMesh.material.dispose();
  }

  const fontLoader = new FontLoader();
  fontLoader.load('assets/fonts/DynaPuff_Regular.json', function (loadedFont) {
    font = loadedFont;
    updateOrganDisplay();
  });
}

function updateOrganDisplay() {
  if (!font) return;

  if (organDisplayMesh) {
    scene.remove(organDisplayMesh);
    if (organDisplayMesh.geometry) organDisplayMesh.geometry.dispose();
    if (organDisplayMesh.material) organDisplayMesh.material.dispose();
  }

  let displayText;
  if (currentOrganIndex < mainOrgans.length) {
    const nextOrgan = mainOrgans[currentOrganIndex];
    const organName = gameMode === 'simple' ?
      nextOrgan.name :
      cutName(nextOrgan.name);

    // If text is longer than 20 characters, split it into two lines
    if ((`Place the ${organName}`).length > 15) {
      displayText = `Place the\n${organName}`;
    } else {
      displayText = `Place the ${organName}`;
    }
  } else {
    const modeText = gameMode === 'simple' ? 'Simple Mode' : 'Advanced Mode';
    displayText = `Congratulations!\n${modeText} completed in ${timerValue}s!`;
  }

  // Create text group to handle multiple lines
  const textGroup = new THREE.Group();

  // Split text into lines
  const lines = displayText.split('\n');
  let maxWidth = 0;

  // Create geometry for each line
  lines.forEach((line, index) => {
    const textGeometry = new TextGeometry(line, {
      font: font,
      size: 0.08,
      depth: 0.02,
      curveSegments: 12,
      bevelEnabled: false
    });

    textGeometry.computeBoundingBox();
    const lineWidth = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
    maxWidth = Math.max(maxWidth, lineWidth);

    const material = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      emissive: 0x555555,
      side: THREE.DoubleSide
    });

    const textMesh = new THREE.Mesh(textGeometry, material);
    textMesh.position.y = -index * 0.15; // Space between lines
    textMesh.position.x = -lineWidth / 2; // Center each line
    textGroup.add(textMesh);
  });

  organDisplayMesh = textGroup;

  // Position the text group above the model
  if (baseModelGroup && baseModelGroup.position) {
    const modelBoundingBox = new THREE.Box3().setFromObject(baseModelGroup);
    const modelHeight = modelBoundingBox.max.y - modelBoundingBox.min.y;

    organDisplayMesh.position.set(
      baseModelGroup.position.x,
      baseModelGroup.position.y + modelHeight + 0.3,
      baseModelGroup.position.z
    );

    // Make text always face the camera
    organDisplayMesh.userData.type = 'floatingText';
  }

  scene.add(organDisplayMesh);
}

function cutName(name) {
  let regex = name.split(/(_generated|_grp|_mesh|_Mesh)/);
  return regex.length > 1 ? regex[0] : name;
}

function handleOrganPlacement(controller) {
  const raycaster = new THREE.Raycaster();
  const tempMatrix = new THREE.Matrix4();
  tempMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

  // First check if we hit the model
  const modelIntersects = raycaster.intersectObject(baseModelGroup, true);
  if (modelIntersects.length === 0) {
    return;
  }

  const currentOrgan = mainOrgans[currentOrganIndex];
  const targetPosition = gameMode === 'simple' ?
    originalOrganPositions.get(currentOrgan.name) :
    originalOrganPositions.get(currentOrgan);

  // Create an invisible plane at the target position
  const targetPlane = new THREE.Plane();
  const targetNormal = new THREE.Vector3(0, 0, 1);
  targetNormal.applyQuaternion(baseModelGroup.quaternion);
  targetPlane.setFromNormalAndCoplanarPoint(targetNormal, targetPosition);

  // Get intersection point with the plane
  const intersectionPoint = new THREE.Vector3();
  raycaster.ray.intersectPlane(targetPlane, intersectionPoint);

  if (intersectionPoint) {
    const distance = intersectionPoint.distanceTo(targetPosition);
    const threshold = gameMode === 'simple' ? 0.08 : 0.09;

    if (distance < threshold) {
      triggerHapticFeedback(true); // Fort retour haptique pour le succès
      // Organ placed correctly
      if (gameMode === "simple") {
        currentOrgan.parts.forEach(part => {
          part.visible = true;
          createFlashingEffect(part);
        });
      } else {
        currentOrgan.visible = true;
        createFlashingEffect(currentOrgan);
      }

      playSound('assets/sounds/Success 1 Sound Effect.mp3', intersectionPoint);
      currentOrganIndex++;
      updateOrganDisplay();

      if (currentOrganIndex >= mainOrgans.length) {
        handleGameCompletion();
      }
    } else {
      triggerHapticFeedback(); // Léger retour haptique pour l'erreur
      showDebugPoint(intersectionPoint, 0x808080); // Show where ray hits
      playSound('assets/sounds/wrong_sound.mp3', intersectionPoint);
    }
  }
}

function handleGameCompletion() {
  isGameActive = false;
  const music = soundMap.get('assets/sounds/game_music.mp3');
  if (music && music.isPlaying) {
    music.stop();
  }

  playSound('assets/sounds/Victory Sound Effect.mp3', baseModelGroup.position);
  createVictoryParticles();
  stopTimer();

  setTimeout(() => {
    if (organDisplayMesh) {
      scene.remove(organDisplayMesh);
    }
    menuGroup.position.copy(baseModelGroup.position);
    menuGroup.position.x -= 1;
    menuGroup.position.y += 1.3;
    menuGroup.visible = true;
    isMenuVisible = true;
    if (menuMusic && !menuMusic.isPlaying) {
      menuMusic.play();
    }
  }, victoryAnimationDuration);

}

function createFlashingEffect(organ) {
  // Store the original material if not already stored
  if (!originalMaterials.has(organ)) {
    originalMaterials.set(organ, organ.material.clone());
  }

  // Create a bright emissive material for the flash
  const flashMaterial = new THREE.MeshStandardMaterial({
    color: organ.material.color,
    emissive: new THREE.Color(0x00ff00),
    emissiveIntensity: 1,
    metalness: 0.5,
    roughness: 0.5
  });

  let flashCount = 0;
  const maxFlashes = 3;
  const flashDuration = 200; // milliseconds

  const flash = () => {
    if (flashCount >= maxFlashes * 2) {
      // Restore original material
      organ.material = originalMaterials.get(organ);
      return;
    }

    // Toggle between flash and original material
    organ.material = flashCount % 2 === 0 ? flashMaterial : originalMaterials.get(organ);
    flashCount++;

    setTimeout(flash, flashDuration);
  };

  // Start the flashing
  flash();
}

function playSound(soundPath, position) {
  if (!soundMap.has(soundPath)) {
    // Create and cache the audio
    const sound = new THREE.PositionalAudio(audioListener);
    const audioLoader = new THREE.AudioLoader();

    audioLoader.load(soundPath, (buffer) => {
      sound.setBuffer(buffer);
      sound.setRefDistance(1);
      sound.setRolloffFactor(1);
      if (soundPath.includes('Victory')) {
        sound.setVolume(0.45);
      }
      else {
        sound.setVolume(0.35);
      }
      // Add sound to a dummy object at the desired position
      const soundObject = new THREE.Object3D();
      if (position instanceof THREE.Vector3) {
        soundObject.position.copy(position);
      } else if (baseModelGroup) {
        soundObject.position.copy(baseModelGroup.position);
      }
      soundObject.add(sound);
      scene.add(soundObject);

      soundMap.set(soundPath, soundObject);
      sound.play();
    });
  } else {
    const soundObject = soundMap.get(soundPath);
    if (soundObject && soundObject.children[0]) {
      const sound = soundObject.children[0];
      if (position instanceof THREE.Vector3) {
        soundObject.position.copy(position);
      } else if (baseModelGroup) {
        soundObject.position.copy(baseModelGroup.position);
      }

      if (sound.isPlaying) {
        sound.stop();
      }
      sound.play();
    }
  }
}

function showDebugPoint(position, color) {
  const debugSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 16, 16),
    new THREE.MeshBasicMaterial({ color: color })
  );
  debugSphere.position.copy(position);
  scene.add(debugSphere);

  // Remove debug sphere after 2 seconds
  setTimeout(() => {
    scene.remove(debugSphere);
  }, 200);
}

function showRules() {
  triggerHapticFeedback(); // Ajouter retour haptique
  menuGroup.visible = false;
  isMenuVisible = false;
  rulesGroup.position.copy(menuGroup.position);
  rulesGroup.quaternion.copy(menuGroup.quaternion);
  rulesGroup.visible = true;
  isRulesVisible = true;
}

function showMenu() {
  triggerHapticFeedback(); // Ajouter retour haptique
  rulesGroup.visible = false;
  isRulesVisible = false;
  menuGroup.visible = true;
  menuShadow.visible = true;
  isMenuVisible = true;
  updateMenuShadow(); // Add this line

  if (menuMusic && !menuMusic.isPlaying) {
    menuMusic.play();
  }
}

function updateMenuShadow() {
  if (menuGroup && menuShadow) {
    // Project shadow directly below menu
    menuShadow.position.x = menuGroup.position.x;
    menuShadow.position.z = menuGroup.position.z;
    menuShadow.position.y = 0.01; // Slightly above the floor to avoid z-fighting
  }
}

function showSettings() {
  triggerHapticFeedback(); // Ajouter retour haptique
  console.log('Showing settings...');
  // Implement settings display logic
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}