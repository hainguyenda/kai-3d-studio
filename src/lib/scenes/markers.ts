import * as THREE from "three";

const disc = (draw: (g: CanvasRenderingContext2D, s: number) => void, size = 256): THREE.CanvasTexture => {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"); if (!g) throw new Error("Canvas 2D không khả dụng");
  draw(g, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
  return t;
};

/** Chấm vị trí nhân vật: lõi màu + viền trắng + vòng sóng nhấp nháy (luôn quay mặt về camera) */
export class PulseMarker {
  group = new THREE.Group();
  private core: THREE.Sprite;
  private ring: THREE.Sprite;
  private coreTex: THREE.CanvasTexture;
  private ringTex: THREE.CanvasTexture;
  private color = "";

  constructor(private size: number, color = "#ff7a3d", onTop = false) {
    this.coreTex = disc(() => undefined);
    this.ringTex = disc((g, s) => {
      g.strokeStyle = "rgba(255,255,255,0.95)"; g.lineWidth = s * 0.05;
      g.beginPath(); g.arc(s / 2, s / 2, s * 0.44, 0, Math.PI * 2); g.stroke();
    });
    const mk = (map: THREE.Texture) => new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, depthTest: !onTop, toneMapped: false });
    this.core = new THREE.Sprite(mk(this.coreTex));
    this.ring = new THREE.Sprite(mk(this.ringTex));
    this.core.renderOrder = 21; this.ring.renderOrder = 20;
    this.group.add(this.ring, this.core);
    this.setColor(color);
  }

  setColor(color: string): void {
    if (color === this.color) return;
    this.color = color;
    const c = this.coreTex.image as HTMLCanvasElement, g = c.getContext("2d"), s = c.width;
    if (!g) return;
    g.clearRect(0, 0, s, s);
    // vòng mờ ngoài
    g.fillStyle = "rgba(255,255,255,0.28)"; g.beginPath(); g.arc(s / 2, s / 2, s * 0.48, 0, Math.PI * 2); g.fill();
    // viền trắng
    g.fillStyle = "#ffffff"; g.beginPath(); g.arc(s / 2, s / 2, s * 0.34, 0, Math.PI * 2); g.fill();
    // lõi màu
    g.fillStyle = color; g.beginPath(); g.arc(s / 2, s / 2, s * 0.26, 0, Math.PI * 2); g.fill();
    this.coreTex.needsUpdate = true;
  }

  update(t: number): void {
    this.core.scale.setScalar(this.size);
    const k = (t * 0.9) % 1;
    this.ring.scale.setScalar(this.size * (1 + k * 1.6));
    (this.ring.material as THREE.SpriteMaterial).opacity = (1 - k) * 0.9;
  }

  dispose(): void {
    this.coreTex.dispose(); this.ringTex.dispose();
    (this.core.material as THREE.Material).dispose(); (this.ring.material as THREE.Material).dispose();
  }
}

/** hoạ tiết chấm tròn mềm cho Points (đường nét chấm) */
export const dotTexture = (): THREE.CanvasTexture => disc((g, s) => {
  g.fillStyle = "#ffffff"; g.beginPath(); g.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2); g.fill();
}, 64);

/** mũi tên 3D (thân trụ + đầu nón) dọc theo một đường cong */
export function arrowAlong(curve: THREE.Curve<THREE.Vector3>, radius: number, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, radius, 8, false), mat);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(radius * 2.6, radius * 6.5, 14), mat);
  tip.position.copy(curve.getPoint(1));
  tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangent(1).normalize());
  g.add(tube, tip);
  return g;
}

/** giải phóng mọi geometry trong một nhóm */
export const disposeGeometries = (o: THREE.Object3D): void => {
  o.traverse(x => { const m = x as THREE.Mesh; if (m.isMesh || (x as THREE.Points).isPoints) m.geometry.dispose(); });
};
