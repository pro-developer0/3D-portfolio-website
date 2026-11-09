import * as THREE from 'three';
import { NOISE } from './glsl.js';

const TYPES = { ocean: 0, ember: 1, gas: 2, crystal: 3 };
const ATMOSPHERE = { ocean: '#5fb6ff', ember: '#ff6a2a', gas: '#f0c48f', crystal: '#6fe6ff' };

const SURFACE = /* glsl */ `
uniform float uTime,uSeed; uniform vec3 uSun,uA,uB,uC,uAtm;
varying vec3 vObj,vN,vW;
${NOISE}
void main(){
  vec3 n0=normalize(vObj);
  vec3 p=n0+vec3(uSeed);
  vec3 N=normalize(vN),V=normalize(cameraPosition-vW);
  float ndl=dot(N,uSun);
  float day=smoothstep(-.12,.55,ndl);
  vec3 alb,glow=vec3(0.); float spec=0.;
#if TYPE==0
  float h=fbm(p*2.1);
  float land=smoothstep(.02,.07,h);
  alb=mix(uA,uB,land);
  alb=mix(alb,uC,smoothstep(.12,.38,h));
  alb=mix(alb,vec3(.9,.95,1.),smoothstep(.74,.9,abs(n0.y)+h*.2));
  spec=(1.-land)*.75;
  float lights=pow(clamp(.5+.5*snoise(p*130.),0.,1.),16.)*smoothstep(-.05,.35,snoise(p*9.))*land;
  glow=vec3(1.,.68,.32)*lights*(1.-day)*7.;
  vec3 q=p*3.+vec3(uTime*.012,0.,0.);
  float cloud=smoothstep(.08,.6,fbm(q+vec3(snoise(q*.9))*.22));
  alb=mix(alb,vec3(1.),cloud*.86);
  spec*=1.-cloud; glow*=1.-cloud;
#elif TYPE==1
  float f=fbm(p*2.6+vec3(0.,uTime*.01,0.));
  float crack=1.-smoothstep(0.,.05,abs(snoise(p*3.4+f*1.4)));
  alb=mix(uA,uA*3.5,f*.5+.5);
  glow=mix(uB,uC,crack*crack)*crack*crack*3.2+uB*pow(max(0.,f+.05),3.)*1.1;
#elif TYPE==2
  float w=fbm(p*vec3(1.6,5.,1.6)+vec3(uTime*.02,0.,0.));
  float b=n0.y*7.+w*1.25;
  alb=mix(uA,uB,.5+.5*sin(b*2.4));
  alb=mix(alb,uC,smoothstep(.55,1.,.5+.5*sin(b*5.1+1.3))*.72);
#else
  float r=pow(clamp(1.-abs(fbm(p*3.)),0.,1.),38.);
  alb=mix(uA,uB,fbm(p*5.)*.5+.5)*.5;
  glow=uC*r*(.9+1.8*(1.-day));
  spec=.55;
#endif
  vec3 H=normalize(uSun+V);
  float fres=pow(1.-max(dot(N,V),0.),3.2);
  vec3 col=alb*(.03+day*max(ndl+.12,0.)*1.05);
  col+=vec3(1.,.96,.9)*pow(max(dot(N,H),0.),70.)*spec*day*1.2;
  col+=glow;
  col+=uAtm*fres*(.08+day*.7);
  gl_FragColor=vec4(col,1.);
}`;

export function createPlanet(entry, quality) {
  const { P, R, sun, project } = entry;
  const { type, colors } = project.planet;
  const color = (hex) => new THREE.Color(hex);

  const group = new THREE.Group();
  group.position.copy(P);
  group.rotation.z = 0.28 * entry.side;

  const uniforms = {
    uTime: { value: 0 },
    uSeed: { value: entry.index * 3.7 + 1.3 },
    uSun: { value: sun },
    uA: { value: color(colors[0]) },
    uB: { value: color(colors[1]) },
    uC: { value: color(colors[2]) },
    uAtm: { value: color(ATMOSPHERE[type]) },
  };

  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(R, 96, 64),
    new THREE.ShaderMaterial({
      uniforms,
      defines: { TYPE: TYPES[type], OCTAVES: quality.low ? 4 : 5 },
      vertexShader: `
        varying vec3 vObj,vN,vW;
        void main(){
          vObj=position;
          vN=normalize(mat3(modelMatrix)*normal);
          vec4 w=modelMatrix*vec4(position,1.);
          vW=w.xyz;
          gl_Position=projectionMatrix*viewMatrix*w;
        }`,
      fragmentShader: SURFACE,
    }),
  );
  group.add(surface);

  // Atmosphere: an additive shell seen from the inside.
  group.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.13, 72, 48),
      new THREE.ShaderMaterial({
        uniforms: { uSun: uniforms.uSun, uAtm: uniforms.uAtm },
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `
          varying vec3 vN,vW;
          void main(){
            vN=normalize(mat3(modelMatrix)*normal);
            vec4 w=modelMatrix*vec4(position,1.);
            vW=w.xyz;
            gl_Position=projectionMatrix*viewMatrix*w;
          }`,
        fragmentShader: `
          uniform vec3 uSun,uAtm; varying vec3 vN,vW;
          void main(){
            vec3 N=normalize(vN),V=normalize(cameraPosition-vW);
            float rim=pow(smoothstep(0.,.46,-dot(N,V)),2.4);
            float lit=.16+.84*smoothstep(-.45,.55,dot(N,uSun));
            gl_FragColor=vec4(uAtm*1.1,rim*lit);
          }`,
      }),
    ),
  );

  if (type === 'gas') {
    const inner = R * 1.42;
    const outer = R * 1.95;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(inner, outer, 180, 1),
      new THREE.ShaderMaterial({
        uniforms: { uA: uniforms.uB, uIn: { value: inner }, uOut: { value: outer } },
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        vertexShader: `varying float vR; void main(){vR=length(position.xy);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `
          uniform vec3 uA; uniform float uIn,uOut; varying float vR;
          void main(){
            float t=(vR-uIn)/(uOut-uIn);
            float bands=.45+.55*sin(t*38.+sin(t*17.)*3.);
            float a=bands*smoothstep(0.,.05,t)*smoothstep(1.,.92,t)*(1.-smoothstep(.56,.6,t)*smoothstep(.68,.64,t));
            gl_FragColor=vec4(uA*.55,a*.6);
          }`,
      }),
    );
    ring.rotation.x = Math.PI / 2 - 0.3;
    group.add(ring);
  }

  // A thin belt of glowing debris echoing the portals.
  const count = Math.round(4200 * quality.particles);
  const position = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = R * (1.5 + Math.pow(Math.random(), 2) * 0.75);
    position.set(
      [Math.cos(angle) * radius, (Math.random() - 0.5) * R * 0.05, Math.sin(angle) * radius],
      i * 3,
    );
  }
  const beltGeometry = new THREE.BufferGeometry();
  beltGeometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  const beltUniforms = { uPixel: { value: 1 }, uColor: { value: color(project.accent) } };
  const belt = new THREE.Points(
    beltGeometry,
    new THREE.ShaderMaterial({
      uniforms: beltUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        uniform float uPixel;
        void main(){
          vec4 mv=modelViewMatrix*vec4(position,1.);
          gl_Position=projectionMatrix*mv;
          gl_PointSize=clamp(46.*uPixel/-mv.z,1.,5.*uPixel);
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        void main(){
          float a=smoothstep(.5,0.,length(gl_PointCoord-.5));
          gl_FragColor=vec4(uColor*1.5,a*.6);
        }`,
    }),
  );
  belt.frustumCulled = false;
  belt.rotation.x = 0.16 * entry.side;
  group.add(belt);

  return {
    object: group,
    update({ time, dt, camera, pixel }) {
      group.visible = camera.position.distanceTo(P) < 640;
      if (!group.visible) return;
      uniforms.uTime.value = time;
      beltUniforms.uPixel.value = pixel;
      surface.rotation.y += dt * 0.022;
      belt.rotation.y += dt * 0.03;
    },
  };
}
