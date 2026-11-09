import * as THREE from 'three';
import { NOISE } from './glsl.js';

// The nebula is expensive, so it is rendered once into a cubemap at startup.
export function bakeSky(renderer) {
  const target = new THREE.WebGLCubeRenderTarget(768, {
    type: THREE.HalfFloatType,
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
  });
  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(50, 48, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: `varying vec3 vP; void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `
        varying vec3 vP;
        ${NOISE}
        void main(){
          vec3 d=normalize(vP);
          float warp=fbm(d*1.4+4.);
          float a=smoothstep(-.1,.75,fbm(d*1.9+warp*.9));
          float b=smoothstep(.0,.8,fbm(d*2.6-warp*1.1+9.));
          vec3 col=vec3(.006,.010,.024);
          col+=vec3(.015,.075,.13)*a;
          col+=vec3(.15,.055,.03)*b*b;
          gl_FragColor=vec4(col,1.);
        }`,
    }),
  );
  scene.add(mesh);
  new THREE.CubeCamera(1, 100, target).update(renderer, scene);
  mesh.geometry.dispose();
  mesh.material.dispose();
  return target;
}

export function createStars(count) {
  const position = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const dir = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    dir.randomDirection().multiplyScalar(1800).toArray(position, i * 3);
    seed[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

  const uniforms = { uTime: { value: 0 }, uPixel: { value: 1 } };
  const points = new THREE.Points(
    geometry,
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aSeed; uniform float uTime,uPixel; varying float vB; varying float vWarm;
        void main(){
          float big=pow(aSeed,9.);
          vB=(.35+big*3.)*(.75+.25*sin(uTime*(.6+aSeed*2.)+aSeed*90.));
          vWarm=fract(aSeed*37.);
          gl_PointSize=(1.3+big*3.4)*uPixel;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
        }`,
      fragmentShader: `
        varying float vB; varying float vWarm;
        void main(){
          float d=length(gl_PointCoord-.5);
          float a=smoothstep(.5,.05,d);
          vec3 c=mix(vec3(.72,.85,1.),vec3(1.,.82,.62),step(.72,vWarm));
          gl_FragColor=vec4(c*vB,a);
        }`,
    }),
  );
  points.frustumCulled = false;

  return {
    object: points,
    update({ time, camera, pixel }) {
      points.position.copy(camera.position);
      uniforms.uTime.value = time;
      uniforms.uPixel.value = pixel;
    },
  };
}

// Dust that wraps around the camera and stretches into streaks at speed.
export function createStreaks(count) {
  const SIZE = 240;
  const position = new Float32Array(count * 6);
  const end = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * SIZE;
    const y = (Math.random() - 0.5) * SIZE;
    const z = (Math.random() - 0.5) * SIZE;
    position.set([x, y, z, x, y, z], i * 6);
    end[i * 2 + 1] = 1;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));

  const uniforms = {
    uCam: { value: new THREE.Vector3() },
    uTrail: { value: new THREE.Vector3() },
    uGlow: { value: 0 },
  };
  const lines = new THREE.LineSegments(
    geometry,
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aEnd; uniform vec3 uCam,uTrail; varying float vA;
        void main(){
          float S=${SIZE}.;
          vec3 p=mod(position-uCam+S*.5,S)-S*.5+uCam;
          float d=length(p-uCam);
          vA=smoothstep(S*.5,S*.25,d)*smoothstep(3.,14.,d);
          p-=uTrail*aEnd;
          gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
        }`,
      fragmentShader: `
        uniform float uGlow; varying float vA;
        void main(){gl_FragColor=vec4(vec3(.62,.85,1.)*(.28+uGlow*1.6),vA);}`,
    }),
  );
  lines.frustumCulled = false;

  const forward = new THREE.Vector3();
  return {
    object: lines,
    update({ camera, velocity }) {
      uniforms.uCam.value.copy(camera.position);
      camera.getWorldDirection(forward);
      uniforms.uTrail.value.copy(velocity).multiplyScalar(0.05).addScaledVector(forward, 0.12);
      uniforms.uTrail.value.clampLength(0, 42);
      uniforms.uGlow.value = Math.min(velocity.length() / 240, 1);
    },
  };
}
