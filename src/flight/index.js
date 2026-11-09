import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { projects } from '../content.js';
import { planetLayout, gateCentres, hallZ, buildBeats, buildTimeline, buildCurves } from './layout.js';
import { bakeSky, createStars, createStreaks } from './backdrop.js';
import { createPortal } from './portal.js';
import { createStation } from './station.js';
import { createPlanet } from './planet.js';
import { createReactor } from './reactor.js';
import { createUI } from './ui.js';

const LensShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uSpeed: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime,uSpeed; varying vec2 vUv;
    float rand(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+uTime)*43758.5453);}
    void main(){
      vec2 c=vUv-.5; float d=dot(c,c);
      vec2 o=c*d*(.012+uSpeed*.1);
      vec3 col=vec3(texture2D(tDiffuse,vUv+o).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-o).b);
      col*=1.-d*.8;
      col+=(rand(vUv)-.5)*.028;
      gl_FragColor=vec4(col,1.);
    }`,
};

// Bloom smears its input, so one invalid pixel would black out the whole frame.
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
  fragmentShader: `
    uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){
      gl_FragColor=min(max(texture2D(tDiffuse,vUv),vec4(0.)),vec4(2048.));
    }`,
};

const isPortrait = () => window.innerWidth / window.innerHeight < 1;
const damp = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const nextFrame = () => new Promise((resolve) => setTimeout(resolve, 30));

export async function start() {
  const low = matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 8) <= 4;
  const quality = { low, particles: low ? 0.4 : 1, maxDpr: low ? 1.3 : 1.75 };

  const planets = planetLayout(projects);
  let beats = buildBeats(planets, isPortrait());
  let curves = buildCurves(beats);
  const timeline = buildTimeline(beats);
  const ui = createUI({ beats, total: timeline.total });

  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  let dpr = Math.min(window.devicePixelRatio || 1, quality.maxDpr);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 5000);

  ui.setBoot('Charting the nebula');
  await nextFrame();
  const sky = bakeSky(renderer);
  scene.background = sky.texture;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromCubemap(sky.texture).texture;
  scene.environmentIntensity = 2.5;
  pmrem.dispose();

  scene.add(new THREE.AmbientLight(0x31405e, 0.5));
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.2);
  sun.position.set(0.6, 0.45, 0.7);
  scene.add(sun);

  ui.setBoot('Opening the gates');
  await nextFrame();

  const hall = hallZ(planets);
  const parts = [
    createStars(low ? 3500 : 8000),
    createStreaks(low ? 700 : 1600),
    createStation(),
    createPortal({
      position: new THREE.Vector3(0, 0, 0),
      radius: 20,
      count: Math.round(60000 * quality.particles),
      colors: ['#57dfff', '#ffb454'],
      tunnel: 100,
    }),
    ...gateCentres(planets).map((position, i) =>
      createPortal({
        position,
        radius: 15,
        count: Math.round(9000 * quality.particles),
        colors: [projects[i + 1].accent, '#ffffff'],
        veil: 0.5,
      }),
    ),
    ...planets.map((entry) => createPlanet(entry, quality)),
    createReactor(hall, quality),
    createPortal({
      position: new THREE.Vector3(0, 0, hall - 310),
      radius: 31,
      count: Math.round(38000 * quality.particles),
      colors: ['#ffb454', '#ff5a36'],
      veil: 0.32,
    }),
  ];
  parts.forEach((part) => scene.add(part.object));

  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: low ? 0 : 4,
  });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new ShaderPass(SanitizeShader));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.55, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const lens = new ShaderPass(LensShader);
  composer.addPass(lens);

  const applySize = () => {
    renderer.setPixelRatio(dpr);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    composer.setPixelRatio(dpr);
    composer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  applySize();

  ui.setBoot('Compiling planets');
  await nextFrame();
  await renderer.compileAsync(scene, camera).catch(() => {});

  // ── Flight state ──
  const pointer = new THREE.Vector2();
  const pointerSoft = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const sphere = new THREE.Sphere();
  const velocity = new THREE.Vector3();
  const railPos = new THREE.Vector3();
  const railLook = new THREE.Vector3();
  const prevPos = new THREE.Vector3();
  const landPos = new THREE.Vector3();
  const landLook = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const railQuat = new THREE.Quaternion();
  const landQuat = new THREE.Quaternion();
  const worldUp = new THREE.Vector3(0, 1, 0);

  let focus = 0;
  let focusTarget = 0;
  let landed = null; // planet the camera is on or heading to
  let pending = null; // planet waiting for the camera to take off first
  let hovered = null;
  let current = 0;
  let speed = 0;
  let roll = 0;
  let width = window.innerWidth;
  let frames = 0;
  let slowMs = 0;

  function land(planet) {
    landed = planet;
    focusTarget = 1;
    ui.goto(planet.beatId, 'instant');
    ui.openCase(planet.project);
  }

  function route() {
    const slug = location.hash.match(/^#\/project\/(.+)$/)?.[1];
    const planet = planets.find((p) => p.project.slug === slug);
    if (planet) {
      if (landed && landed !== planet && focus > 0.001) {
        pending = planet;
        focusTarget = 0;
        ui.closeCase();
      } else {
        land(planet);
      }
    } else {
      pending = null;
      focusTarget = 0;
      ui.closeCase();
    }
  }
  window.addEventListener('hashchange', route);
  route();
  current = ui.scrollX();

  window.addEventListener('pointermove', (event) => {
    pointer.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
  });

  window.addEventListener('click', (event) => {
    if (hovered && !event.target.closest('a, button, .panel, #case')) {
      location.hash = `#/project/${hovered.project.slug}`;
    }
  });

  window.addEventListener('resize', () => {
    // Mobile URL bars resize the window on scroll; only react to real changes.
    if (low && window.innerWidth === width) return;
    width = window.innerWidth;
    beats = buildBeats(planets, isPortrait());
    curves = buildCurves(beats);
    applySize();
  });

  let lastFrame = performance.now();
  let time = 0;
  let intro = 0;

  function frame(now = lastFrame) {
    requestAnimationFrame(frame);
    const dt = Math.min(Math.max(now - lastFrame, 0) / 1000, 0.05);
    lastFrame = now;
    time += dt;
    intro = Math.min(intro + dt / 2.6, 1);

    const before = current;
    current = damp(current, ui.scrollX(), 4.5, dt);
    speed = damp(speed, Math.abs(current - before) / Math.max(dt, 0.001), 6, dt);
    pointerSoft.x = damp(pointerSoft.x, pointer.x, 3, dt);
    pointerSoft.y = damp(pointerSoft.y, pointer.y, 3, dt);

    // Take-off and landing.
    if (focus !== focusTarget) {
      const step = dt / 1.5;
      focus = focusTarget > focus ? Math.min(focus + step, 1) : Math.max(focus - step, 0);
    }
    if (focus === 0 && focusTarget === 0) {
      landed = null;
      if (pending) {
        const next = pending;
        pending = null;
        land(next);
      }
    }

    // Camera on the rail.
    const u = timeline.kAt(current) / (beats.length - 1);
    curves.position.getPoint(u, railPos);
    curves.look.getPoint(u, railLook);
    const settle = 1 - focus;
    railPos.x += pointerSoft.x * 1.8 * settle;
    railPos.y += pointerSoft.y * 1.1 * settle;
    railPos.z += (1 - easeInOut(intro)) * 46;

    camera.position.copy(railPos);
    camera.up.copy(worldUp);
    camera.lookAt(railLook);

    if (focus > 0 && landed) {
      railQuat.copy(camera.quaternion);
      normal.subVectors(railPos, landed.P).normalize().lerp(landed.sun, 0.3).normalize();
      tangent.copy(worldUp).addScaledVector(normal, -worldUp.dot(normal)).normalize();
      landPos.copy(landed.P).addScaledVector(normal, landed.R * 1.2);
      landLook.copy(landPos).addScaledVector(tangent, 0.93 * landed.R).addScaledVector(normal, -0.37 * landed.R);
      camera.position.copy(landPos);
      camera.lookAt(landLook);
      landQuat.copy(camera.quaternion);

      const e = easeInOut(focus);
      camera.position.lerpVectors(railPos, landPos, e);
      camera.quaternion.slerpQuaternions(railQuat, landQuat, e);
    }

    velocity.subVectors(camera.position, prevPos).divideScalar(Math.max(dt, 0.001));
    prevPos.copy(camera.position);
    tangent.setFromMatrixColumn(camera.matrixWorld, 0);
    const lateral = THREE.MathUtils.clamp(velocity.dot(tangent) * -0.0028, -0.3, 0.3);
    roll = damp(roll, lateral * (1 - focus), 3.5, dt);
    camera.rotateZ(roll);

    const baseFov = isPortrait() ? 62 : 50;
    camera.fov = damp(camera.fov, baseFov + Math.min(speed * 7, 20), 5, dt);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    // Click a parked planet to land on it.
    hovered = null;
    if (focusTarget === 0) {
      const stop = beats.find((b) => b.planet && current >= b.a - 0.05 && current <= b.b + 0.05);
      if (stop) {
        raycaster.setFromCamera(pointer, camera);
        sphere.set(stop.planet.P, stop.planet.R);
        if (raycaster.ray.intersectsSphere(sphere)) hovered = stop.planet;
      }
    }
    document.documentElement.style.cursor = hovered ? 'pointer' : '';

    const pixel = (dpr * window.innerHeight) / 900;
    const context = { time, dt, camera, pixel, pointer: pointerSoft, velocity };
    for (const part of parts) part.update(context);

    lens.uniforms.uTime.value = time % 10;
    lens.uniforms.uSpeed.value = Math.min(speed * 0.8, 1);

    ui.update(current, focus, pointerSoft.x * 2.5, pointerSoft.y * 2);
    composer.render(dt);

    // Lower the resolution on devices that cannot hold a smooth frame rate.
    frames++;
    slowMs += dt * 1000;
    if (frames === 50) {
      if (slowMs / frames > 25 && dpr > 0.8) {
        dpr = Math.max(dpr - 0.15, 0.8);
        applySize();
      }
      frames = 0;
      slowMs = 0;
    }
  }

  prevPos.copy(camera.position);
  frame();
  ui.setBoot('All systems nominal');
  setTimeout(ui.finishBoot, 350);
}
