"use strict";

import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';

let container;

let camera, scene, renderer;
let controller;
let reticle;
let skeletonModel;

let hitTestSource = null;
let hitTestSourceRequested = false;

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

  const onSelect = () => {
    if (reticle.visible && scene.children.indexOf(skeletonModel) === -1) {
      reticle.matrix.decompose(skeletonModel.position, skeletonModel.quaternion, skeletonModel.scale);
      scene.add(skeletonModel);

      const light = new THREE.DirectionalLight(0xfdfbd3, 15);
      light.position.set(0, 5, 0);
      scene.add(light);
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

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}