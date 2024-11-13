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
let skeletonModel;
let menuGroup;
let rulesGroup;
let isMenuVisible = false;
let isRulesVisible = false;

let hitTestSource = null;
let hitTestSourceRequested = false;

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
    titleText.position.set(-titleTextWidth/2, 0.48, 0.07);
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

  menuGroup.visible = false;
  return menuGroup;
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
      "sur le squelette",
      "3. Apprenez l'anatomie en RA",
    ];

    rulesContent.forEach((rule, index) => {
      const ruleGeometry = new TextGeometry(rule, {
        font: font,
        size: 0.05,
        depth: 0.01,
      });
      const ruleText = new THREE.Mesh(ruleGeometry, titleMaterial);
      ruleText.position.set(-0.55, 0.4 - (index * 0.15), 0.03);
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


init();

// Main loop
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
      }

      if (isRulesVisible && rulesGroup) {
        direction.subVectors(cameraPosition, rulesGroup.position);
        direction.y = 0;
        rulesGroup.lookAt(rulesGroup.position.clone().add(direction));
        rulesGroup.rotation.y += Math.PI / 10;
      }
    }
  }

  renderer.render(scene, camera);
}

function init() {
  container = document.createElement('div');
  document.body.appendChild(container);

  scene = new THREE.Scene();

  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 10); // meters
  camera.position.set(0, 1.6, 3);

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

  // Load and add the skeleton model
  const mtlLoader = new MTLLoader();
  mtlLoader.load('assets/models/source/Z-Anatomy-Layers1-7.mtl', (materials) => {
    materials.preload();
    const objLoader = new OBJLoader();
    objLoader.setMaterials(materials);
    objLoader.load('assets/models/source/Z-Anatomy-Layers1-7.obj', (object) => {
      skeletonModel = object;
      skeletonModel.scale.set(1, 1, 1);
    });
  });

  menuGroup = create3DMenu();
  scene.add(menuGroup);

  rulesGroup = createRulesDisplay();
  scene.add(rulesGroup);

  const onSelect = (event) => {
    if (reticle.visible && scene.children.includes(skeletonModel) === false) {
      // Place the model
      reticle.matrix.decompose(skeletonModel.position, skeletonModel.quaternion, skeletonModel.scale);
      scene.add(skeletonModel);

      // Show menu to the left of the model
      menuGroup.position.copy(skeletonModel.position);
      menuGroup.position.x -= 1; // Position to the left
      menuGroup.position.y += 1.3; // Raise it slightly
      menuGroup.visible = true;
      isMenuVisible = true;

    } else {
      // Handle interaction with both menu and rules
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

function handleMenuAction(action) {
  switch (action) {
    case 'start':
      startGame();
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

function startGame() {
  console.log('Starting game...');
  menuGroup.visible = false;
  isMenuVisible = false;
  // Add your game initialization code here
}

function showRules() {
  menuGroup.visible = false;
  isMenuVisible = false;
  rulesGroup.position.copy(menuGroup.position);
  rulesGroup.quaternion.copy(menuGroup.quaternion);
  rulesGroup.visible = true;
  isRulesVisible = true;
}

function showMenu() {
  rulesGroup.visible = false;
  isRulesVisible = false;
  menuGroup.visible = true;
  isMenuVisible = true;
}

function showSettings() {
  console.log('Showing settings...');
  // Implement settings display logic
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}