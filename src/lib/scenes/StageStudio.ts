import * as THREE from 'three';

export function createStageStudioScene(): {
  group: THREE.Group;
  dispose: () => void;
} {
  const group = new THREE.Group();
  group.name = 'stage_studio';

  // Sàn studio có vòng sáng tỏa mềm bằng CanvasTexture
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(256, 256, 20, 256, 256, 250);
  grad.addColorStop(0, '#2a3c5c');
  grad.addColorStop(0.5, '#141e33');
  grad.addColorStop(1, '#0b101d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  const floorTex = new THREE.CanvasTexture(c);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(14, 48),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85, metalness: 0.05 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // Vòng sáng cam mảnh tạo chiều sâu sân khấu
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.4, 1.48, 48),
    new THREE.MeshBasicMaterial({ color: 0xe67e22, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(-1.35, 0.01, 0);
  group.add(ring);

  // Đèn rọi nhẹ phía sau nhân vật (Rim Spotlight)
  const rimLight = new THREE.PointLight(0x6fb1fc, 2.2, 12);
  rimLight.position.set(-2.5, 3.2, -2.2);
  group.add(rimLight);

  const warmKey = new THREE.PointLight(0xfff1dc, 1.6, 12);
  warmKey.position.set(-0.5, 3.5, 3.5);
  group.add(warmKey);

  return {
    group,
    dispose: () => {
      floorTex.dispose();
      group.traverse(obj => {
        if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
        const mat = (obj as THREE.Mesh).material;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else if (mat) mat.dispose();
      });
    },
  };
}
