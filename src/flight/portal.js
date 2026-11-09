import * as THREE from 'three';
import { NOISE } from './glsl.js';

// A gate made of three particle populations: rim, inward spiral, optional tunnel.
export function createPortal({ position, radius, count, colors, tunnel = 0, veil = 1 }) {
  const group = new THREE.Group();
  group.position.copy(position);

  const data = new Float32Array(count * 3);
  const mode = new Float32Array(count);
  const rimShare = tunnel ? 0.42 : 0.55;
  const spiralShare = tunnel ? 0.26 : 0.45;
  for (let i = 0; i < count; i++) {
    const roll = i / count;
    mode[i] = roll < rimShare ? 0 : roll < rimShare + spiralShare ? 1 : 2;
    data[i * 3] = Math.random() * Math.PI * 2;
    // Squaring biases particles toward the rim's centre line.
    const spread = Math.random() - 0.5;
    data[i * 3 + 1] = Math.sign(spread) * spread * spread * 4;
    data[i * 3 + 2] = Math.random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aData', new THREE.BufferAttribute(data, 3));
  geometry.setAttribute('aMode', new THREE.BufferAttribute(mode, 1));

  const c1 = new THREE.Color(colors[0]);
  const c2 = new THREE.Color(colors[1]);
  const uniforms = {
    uTime: { value: 0 },
    uPixel: { value: 1 },
    uR: { value: radius },
    uLen: { value: tunnel },
    uC1: { value: c1 },
    uC2: { value: c2 },
  };

  const points = new THREE.Points(
    geometry,
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute vec3 aData; attribute float aMode;
        uniform float uTime,uPixel,uR,uLen;
        varying float vFade; varying float vMix;
        void main(){
          float a=aData.x,o=aData.y,s=aData.z;
          vec3 p; float b=1.;
          if(aMode<.5){
            float ang=a+uTime*(.18+.3*s);
            float r=uR*(1.+o*.13)+sin(ang*5.+uTime*1.2+s*6.)*uR*.03;
            p=vec3(cos(ang)*r,sin(ang)*r,o*uR*.16*sin(ang*3.+uTime));
            b=1.25;
          }else if(aMode<1.5){
            float t=fract(s*7.+uTime*(.05+.07*s));
            float r=uR*pow(1.-t,.7);
            float ang=a*.25+floor(a*.95)*2.094+t*7.+uTime*.14;
            p=vec3(cos(ang)*r,sin(ang)*r,-t*uR*.3);
            b=smoothstep(0.,.14,t)*(1.-t*.6);
          }else{
            float t=fract(s*3.+uTime*.045);
            float r=uR*(.86+o*.2);
            float ang=a+t*5.+uTime*.16;
            p=vec3(cos(ang)*r,sin(ang)*r,-t*uLen);
            b=smoothstep(0.,.05,t)*smoothstep(1.,.86,t);
          }
          vec4 mv=modelViewMatrix*vec4(p,1.);
          gl_Position=projectionMatrix*mv;
          float d=-mv.z;
          gl_PointSize=clamp((26.+44.*s*s)*uPixel/max(d,1.),1.,24.*uPixel);
          vFade=b*smoothstep(1.,8.,d);
          vMix=fract(s*5.);
        }`,
      fragmentShader: `
        uniform vec3 uC1,uC2; varying float vFade; varying float vMix;
        void main(){
          float d=length(gl_PointCoord-.5);
          float a=smoothstep(.5,0.,d);
          gl_FragColor=vec4(mix(uC1,uC2,vMix)*1.5,a*a*vFade*.72);
        }`,
    }),
  );
  points.frustumCulled = false;
  group.add(points);

  const discUniforms = {
    uTime: { value: 0 },
    uC1: { value: c1 },
    uC2: { value: c2 },
    uFade: { value: 1 },
    uVeil: { value: veil },
  };
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 1.02, 96),
    new THREE.ShaderMaterial({
      uniforms: discUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      defines: { OCTAVES: 3 },
      vertexShader: `varying vec2 vU; void main(){vU=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `
        uniform float uTime,uFade,uVeil; uniform vec3 uC1,uC2; varying vec2 vU;
        ${NOISE}
        void main(){
          vec2 q=vU/${(radius * 1.02).toFixed(3)};
          float r=length(q), ang=atan(q.y,q.x);
          float twist=ang+1.8/(r+.25)-uTime*.3;
          float n=fbm(vec3(cos(twist)*1.5,sin(twist)*1.5,r*2.2-uTime*.14));
          float glow=smoothstep(-.25,.6,n)*(.25+pow(r,3.)*1.1);
          vec3 col=mix(uC2,uC1,smoothstep(.1,.95,r+n*.3));
          gl_FragColor=vec4(col*glow*.62,smoothstep(1.,.86,r)*uFade*uVeil);
        }`,
    }),
  );
  group.add(disc);

  return {
    object: group,
    update({ time, camera, pixel }) {
      const dist = camera.position.distanceTo(group.position);
      group.visible = dist < 640;
      if (!group.visible) return;
      uniforms.uTime.value = discUniforms.uTime.value = time;
      uniforms.uPixel.value = pixel;
      discUniforms.uFade.value = THREE.MathUtils.smoothstep(dist, 1, radius * 0.8);
    },
  };
}
