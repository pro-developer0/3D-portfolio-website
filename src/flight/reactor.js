import * as THREE from 'three';
import { NOISE } from './glsl.js';
import { panelTexture } from './station.js';

const HALL_LENGTH = 150;
const HALL_RADIUS = 28;

// An octagonal engine hall with a living core at its centre.
export function createReactor(mouthZ, quality) {
  const group = new THREE.Group();

  const wallSkin = panelTexture();
  wallSkin.repeat.set(8, 12);
  const walls = new THREE.Mesh(
    new THREE.CylinderGeometry(HALL_RADIUS, HALL_RADIUS, HALL_LENGTH, 8, 1, true),
    new THREE.MeshStandardMaterial({
      map: wallSkin,
      color: 0x59627a,
      metalness: 0.7,
      roughness: 0.55,
      side: THREE.DoubleSide,
      flatShading: true,
    }),
  );
  walls.rotation.x = Math.PI / 2;
  walls.position.z = mouthZ - HALL_LENGTH / 2;
  group.add(walls);

  const RIBS = 13;
  const ribs = new THREE.InstancedMesh(
    new THREE.TorusGeometry(HALL_RADIUS - 0.6, 1, 6, 8),
    new THREE.MeshStandardMaterial({ color: 0x4b5366, metalness: 0.85, roughness: 0.4 }),
    RIBS,
  );
  const strips = new THREE.InstancedMesh(
    new THREE.TorusGeometry(HALL_RADIUS - 2, 0.13, 6, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.9, 0.3) }),
    RIBS,
  );
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < RIBS; i++) {
    matrix.makeTranslation(0, 0, mouthZ - (i * HALL_LENGTH) / (RIBS - 1));
    ribs.setMatrixAt(i, matrix);
    strips.setMatrixAt(i, matrix);
  }
  group.add(ribs, strips);

  const centre = new THREE.Vector3(0, 0, mouthZ - 70);
  const core = new THREE.Group();
  core.position.copy(centre);
  group.add(core);

  const light = new THREE.PointLight(0xffa860, 420, 120, 1.8);
  core.add(light);

  const coreUniforms = { uTime: { value: 0 }, uAgitate: { value: 0 } };
  core.add(
    new THREE.Mesh(
      new THREE.IcosahedronGeometry(8, 28),
      new THREE.ShaderMaterial({
        uniforms: coreUniforms,
        defines: { OCTAVES: 3 },
        vertexShader: `
          uniform float uTime,uAgitate; varying vec3 vW; varying float vH;
          ${NOISE}
          void main(){
            float h=fbm(normalize(position)*1.6+uTime*.22);
            vH=h;
            vec3 p=position*(1.+h*(.22+uAgitate*.3));
            vec4 w=modelMatrix*vec4(p,1.);
            vW=w.xyz;
            gl_Position=projectionMatrix*viewMatrix*w;
          }`,
        fragmentShader: `
          varying vec3 vW; varying float vH;
          void main(){
            vec3 N=normalize(cross(dFdx(vW),dFdy(vW)));
            vec3 V=normalize(cameraPosition-vW);
            float f=pow(1.-abs(dot(N,V)),2.);
            vec3 hot=mix(vec3(.5,.08,.02),vec3(1.7,.85,.25),smoothstep(-.1,.55,vH));
            gl_FragColor=vec4(hot*(.25+f*1.2),1.);
          }`,
      }),
    ),
  );

  const ringMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.2, 1.6) });
  const rings = [13, 16.5, 20].map((radius, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.09, 6, 120), ringMaterial);
    ring.rotation.set(i * 1.05 + 0.5, i * 0.7, 0);
    core.add(ring);
    return ring;
  });

  // A shell of particles that scatters away from the cursor.
  const count = Math.round(14000 * quality.particles);
  const dir = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const scratch = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    scratch.randomDirection().toArray(dir, i * 3);
    seed[i] = Math.random();
  }
  const cloudGeometry = new THREE.BufferGeometry();
  cloudGeometry.setAttribute('position', new THREE.BufferAttribute(dir, 3));
  cloudGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const cloudUniforms = {
    uTime: { value: 0 },
    uPixel: { value: 1 },
    uPointer: { value: new THREE.Vector3(999, 999, 999) },
  };
  const cloud = new THREE.Points(
    cloudGeometry,
    new THREE.ShaderMaterial({
      uniforms: cloudUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aSeed; uniform float uTime,uPixel; uniform vec3 uPointer; varying float vS;
        void main(){
          float r=11.+aSeed*aSeed*13.+sin(uTime*.5+aSeed*40.)*.7;
          float a=uTime*(.08+aSeed*.12);
          vec3 p=position*r;
          p.xz=mat2(cos(a),-sin(a),sin(a),cos(a))*p.xz;
          vec3 d=p-uPointer;
          p+=normalize(d)*exp(-dot(d,d)/42.)*11.;
          vec4 mv=modelViewMatrix*vec4(p,1.);
          gl_Position=projectionMatrix*mv;
          gl_PointSize=clamp(30.*uPixel/-mv.z,1.,9.*uPixel);
          vS=aSeed;
        }`,
      fragmentShader: `
        varying float vS;
        void main(){
          float a=smoothstep(.5,0.,length(gl_PointCoord-.5));
          vec3 c=mix(vec3(1.4,.7,.2),vec3(.25,.9,1.3),step(.68,fract(vS*7.)));
          gl_FragColor=vec4(c,a*.4);
        }`,
    }),
  );
  cloud.frustumCulled = false;
  core.add(cloud);

  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane();
  const normal = new THREE.Vector3();
  const hit = new THREE.Vector3();

  return {
    object: group,
    centre,
    update({ time, dt, camera, pixel, pointer }) {
      const dist = Math.abs(camera.position.z - centre.z);
      group.visible = dist < 310; // stays hidden while parked at the last planet
      if (!group.visible) return;
      coreUniforms.uTime.value = cloudUniforms.uTime.value = time;
      cloudUniforms.uPixel.value = pixel;
      rings.forEach((ring, i) => {
        ring.rotation.x += dt * (0.14 + i * 0.05);
        ring.rotation.y += dt * (0.09 - i * 0.03);
      });
      if (dist > 130) return;

      raycaster.setFromCamera(pointer, camera);
      camera.getWorldDirection(normal);
      plane.setFromNormalAndCoplanarPoint(normal, centre);
      if (raycaster.ray.intersectPlane(plane, hit)) {
        hit.sub(centre);
        cloudUniforms.uPointer.value.lerp(hit, 1 - Math.exp(-dt * 9));
        const closeness = 1 - Math.min(hit.length() / 24, 1);
        coreUniforms.uAgitate.value += (closeness - coreUniforms.uAgitate.value) * (1 - Math.exp(-dt * 4));
      }
    },
  };
}
