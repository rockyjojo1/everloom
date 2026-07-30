import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import './App.css';

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const characterRef = useRef<THREE.Group | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const raFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Gradient sky background
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 0, 256);
      gradient.addColorStop(0, '#87CEEB'); // Light blue
      gradient.addColorStop(1, '#E0F6FF'); // Very light blue
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 256, 256);
    }
    const skyTexture = new THREE.CanvasTexture(canvas);
    scene.background = skyTexture;

    // Camera setup (per spec: FOV 45, pitch ~50° down, yaw 45°, distance ~14)
    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    cameraRef.current = camera;

    // Calculate camera position: yaw 45°, pitch ~50° down, distance ~14
    const distance = 14;
    const yaw = Math.PI / 4; // 45°
    const pitch = -Math.PI / 3.6; // ~50° down
    camera.position.set(
      distance * Math.cos(pitch) * Math.cos(yaw),
      distance * Math.sin(-pitch),
      distance * Math.cos(pitch) * Math.sin(yaw)
    );
    camera.lookAt(0, 1, 0); // Look at character center

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'low-power',
      preserveDrawingBuffer: true, // Enable for screenshot capture
    });
    rendererRef.current = renderer;
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2
    renderer.shadowMap.enabled = false; // No shadows in v1
    containerRef.current.appendChild(renderer.domElement);

    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(120, 120);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x7cb342,
      roughness: 0.8,
      metalness: 0,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Lighting
    // Hemisphere light for ambient
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8d7c7c, 1);
    scene.add(hemiLight);

    // Directional light
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 10, 5);
    scene.add(dirLight);

    // Load rigged character from KayKit
    const loader = new GLTFLoader();
    let characterGroup: THREE.Group | null = null;
    let mixer: THREE.AnimationMixer | null = null;

    loader.load(
      '/models/kaykit-adventurers/Character.glb',
      (gltf) => {
        characterGroup = gltf.scene;
        characterGroup.position.set(0, 0, 0);
        scene.add(characterGroup);
        characterRef.current = characterGroup;

        // Setup animation mixer
        mixer = new THREE.AnimationMixer(characterGroup);
        mixerRef.current = mixer;

        // Log available animations for debugging
        console.log('Available animations:', gltf.animations.map((a) => a.name));

        // Play idle animation if available
        if (gltf.animations && gltf.animations.length > 0) {
          // Prefer exact "Idle" clip, fallback to anything with idle
          let idleAnimation = gltf.animations.find((clip) => clip.name === 'Idle');
          if (!idleAnimation) {
            idleAnimation = gltf.animations.find((clip) =>
              clip.name.toLowerCase().includes('idle')
            );
          }
          if (!idleAnimation) {
            idleAnimation = gltf.animations[0];
          }

          if (idleAnimation) {
            console.log('Playing animation:', idleAnimation.name);
            const action = mixer.clipAction(idleAnimation);
            action.loop = THREE.LoopRepeat;
            action.play();
          }
        }
      },
      undefined,
      (error) => {
        console.error('Error loading character model:', error);
      }
    );

    // Clock for animation timing
    const clock = new THREE.Clock();

    // Animation loop
    const animate = () => {
      raFrameIdRef.current = requestAnimationFrame(animate);

      const delta = clock.getDelta();

      // Update mixer
      if (mixer) {
        mixer.update(delta);
      }

      // Smooth camera follow (lerp toward target position)
      if (characterRef.current) {
        const targetPos = characterRef.current.position.clone().add(
          new THREE.Vector3(
            distance * Math.cos(pitch) * Math.cos(yaw),
            distance * Math.sin(-pitch),
            distance * Math.cos(pitch) * Math.sin(yaw)
          )
        );
        camera.position.lerp(targetPos, 0.08);
        camera.lookAt(
          characterRef.current.position.x,
          characterRef.current.position.y + 1,
          characterRef.current.position.z
        );
      }

      renderer.render(scene, camera);
    };
    animate();

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (raFrameIdRef.current) {
        cancelAnimationFrame(raFrameIdRef.current);
      }
      containerRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
      groundGeometry.dispose();
      groundMaterial.dispose();
    };
  }, []);

  return <div ref={containerRef} className="app-container" />;
};

export default App;
