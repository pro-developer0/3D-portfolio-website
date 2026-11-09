import * as THREE from 'three';

function canvasTexture(size, width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

export const panelTexture = () =>
  canvasTexture(0, 512, 512, (g, w, h) => {
    g.fillStyle = '#6b7384';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      const shade = 90 + Math.random() * 45;
      g.fillStyle = `rgb(${shade},${shade + 6},${shade + 16})`;
      const x = Math.floor(Math.random() * 8) * 64;
      const y = Math.floor(Math.random() * 8) * 64;
      g.fillRect(x, y, 64 * (1 + Math.floor(Math.random() * 3)), 64);
    }
    g.strokeStyle = '#272c38';
    g.lineWidth = 3;
    for (let i = 0; i <= 8; i++) {
      g.beginPath();
      g.moveTo(i * 64, 0);
      g.lineTo(i * 64, h);
      g.moveTo(0, i * 64);
      g.lineTo(w, i * 64);
      g.stroke();
    }
  });

const windowTexture = () =>
  canvasTexture(0, 256, 128, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 14; col++) {
        if (Math.random() < 0.42) continue;
        g.fillStyle = Math.random() < 0.8 ? '#ffd9a0' : '#9fe8ff';
        g.fillRect(8 + col * 17, 12 + row * 22, 10, 11);
      }
    }
  });

const placeAroundRing = (mesh, index, angle, radius, z = 0) => {
  const m = new THREE.Matrix4().makeRotationZ(angle);
  m.setPosition(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
  mesh.setMatrixAt(index, m);
};

export function createStation() {
  const group = new THREE.Group();
  const spinning = new THREE.Group();
  group.add(spinning);

  const skin = panelTexture();
  skin.repeat.set(10, 1);
  const hull = new THREE.MeshStandardMaterial({
    color: 0x8791a6,
    map: skin,
    metalness: 0.72,
    roughness: 0.46,
  });
  const plain = new THREE.MeshStandardMaterial({ color: 0x8a93a6, metalness: 0.8, roughness: 0.38 });

  spinning.add(new THREE.Mesh(new THREE.TorusGeometry(26, 1.7, 18, 160), hull));
  group.add(new THREE.Mesh(new THREE.TorusGeometry(22, 0.75, 12, 128), plain));

  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(20.9, 0.16, 8, 160),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.6, 3.6) }),
  );
  group.add(collar);

  // Habitat modules with lit windows, around the spinning ring.
  const modules = new THREE.InstancedMesh(
    new THREE.BoxGeometry(3.6, 6, 7.5),
    new THREE.MeshStandardMaterial({
      color: 0x5d6577,
      metalness: 0.65,
      roughness: 0.5,
      emissive: 0xffffff,
      emissiveMap: windowTexture(),
      emissiveIntensity: 1.5,
    }),
    30,
  );
  for (let i = 0; i < 30; i++) placeAroundRing(modules, i, (i / 30) * Math.PI * 2, 29.6);
  spinning.add(modules);

  // Struts joining the fixed inner ring to the spinning outer ring.
  const struts = new THREE.InstancedMesh(new THREE.BoxGeometry(5, 0.5, 0.9), plain, 12);
  for (let i = 0; i < 12; i++) placeAroundRing(struts, i, (i / 12) * Math.PI * 2, 24.2);
  spinning.add(struts);

  // Four solar arms: truss plus paired panels.
  const solar = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: canvasTexture(0, 256, 256, (g, w, h) => {
      g.fillStyle = '#0a1a3e';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#3d6fb5';
      g.lineWidth = 2;
      for (let i = 0; i <= 8; i++) {
        g.strokeRect(i * 32, -2, 32, h + 4);
        g.strokeRect(-2, i * 32, w + 4, 32);
      }
    }),
    metalness: 0.9,
    roughness: 0.25,
  });
  const arms = new THREE.Group();
  group.add(arms);
  for (let a = 0; a < 4; a++) {
    const arm = new THREE.Group();
    arm.rotation.z = Math.PI / 4 + (a * Math.PI) / 2;
    arm.add(new THREE.Mesh(new THREE.BoxGeometry(56, 0.9, 0.9), plain).translateX(62));
    for (let p = 0; p < 4; p++) {
      for (const dir of [-1, 1]) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.12, 9), solar);
        panel.position.set(46 + p * 12.4, 0, dir * 5.4);
        arm.add(panel);
      }
    }
    arms.add(arm);
  }

  // Blinking navigation beacons on the arm tips.
  const beaconMats = [];
  for (let a = 0; a < 4; a++) {
    const material = new THREE.MeshBasicMaterial({ color: a % 2 ? 0xff5040 : 0x50ffa0 });
    beaconMats.push(material);
    const angle = Math.PI / 4 + (a * Math.PI) / 2;
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 12), material);
    beacon.position.set(Math.cos(angle) * 91, Math.sin(angle) * 91, 0);
    group.add(beacon);
  }
  const beaconBase = beaconMats.map((m) => m.color.clone());

  return {
    object: group,
    update({ time, camera, dt }) {
      group.visible = camera.position.z > -380;
      if (!group.visible) return;
      spinning.rotation.z += dt * 0.05;
      arms.rotation.z = Math.sin(time * 0.05) * 0.02;
      beaconMats.forEach((m, i) => {
        const on = Math.pow(0.5 + 0.5 * Math.sin(time * 2.2 + i * 1.6), 10);
        m.color.copy(beaconBase[i]).multiplyScalar(0.25 + on * 8);
      });
    },
  };
}
