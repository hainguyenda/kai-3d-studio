import * as THREE from 'three';
import { BeatEnv, TimeOfDay, WeatherType } from './visualTypes';

interface EnvPreset {
  sky: number;
  fog: number;
  fogDensity: number;
  sunColor: number;
  sunIntensity: number;
  sunPos: [number, number, number];
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  windowGlow: number;
}

const PRESETS: Record<TimeOfDay, EnvPreset> = {
  day: {
    sky: 0xa8c8e6, fog: 0xa8c8e6, fogDensity: 0.008,
    sunColor: 0xfff5e4, sunIntensity: 1.4, sunPos: [12, 22, 15],
    hemiSky: 0xffffff, hemiGround: 0x8d99ae, hemiIntensity: 0.85, windowGlow: 0.0,
  },
  sunset: {
    sky: 0xc95f3c, fog: 0x8f3f49, fogDensity: 0.012,
    sunColor: 0xff8c42, sunIntensity: 1.5, sunPos: [-18, 6, -10],
    hemiSky: 0xff9e6d, hemiGround: 0x3b2c4a, hemiIntensity: 0.65, windowGlow: 0.6,
  },
  night: {
    sky: 0x0d1629, fog: 0x0d1629, fogDensity: 0.015,
    sunColor: 0x8fb8ff, sunIntensity: 0.45, sunPos: [10, 18, -12],
    hemiSky: 0x243b6b, hemiGround: 0x0c111d, hemiIntensity: 0.45, windowGlow: 1.2,
  },
  scorching: {
    sky: 0xf4a259, fog: 0xe76f51, fogDensity: 0.014,
    sunColor: 0xffd166, sunIntensity: 2.2, sunPos: [4, 28, 8],
    hemiSky: 0xffe8a3, hemiGround: 0xa44a3f, hemiIntensity: 0.95, windowGlow: 0.0,
  },
  frozen: {
    sky: 0xcce3f5, fog: 0xb8d8f0, fogDensity: 0.016,
    sunColor: 0xdff2ff, sunIntensity: 1.1, sunPos: [10, 14, 14],
    hemiSky: 0xe6f4ff, hemiGround: 0x7b9bb8, hemiIntensity: 0.9, windowGlow: 0.35,
  },
};

export class WeatherEnvController {
  private group = new THREE.Group();
  private streaks: THREE.Mesh[] = [];
  private debris: THREE.Mesh[] = [];
  private rainLines: THREE.LineSegments | null = null;
  private snowPoints: THREE.Points | null = null;
  private currentWeather: WeatherType = 'clear';
  private baseCamPos = new THREE.Vector3();

  constructor(private scene: THREE.Scene) {
    this.group.name = 'weather_env_fx';
    this.scene.add(this.group);
    this.buildWindFX();
    this.buildRainFX();
    this.buildSnowFX();
    this.setWeatherVisibility('clear');
  }

  private buildWindFX() {
    const streakMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.38, depthWrite: false,
    });
    const streakGeo = new THREE.BoxGeometry(2.6, 0.035, 0.035);
    for (let i = 0; i < 45; i++) {
      const m = new THREE.Mesh(streakGeo, streakMat);
      m.position.set(
        (Math.random() - 0.5) * 26,
        0.5 + Math.random() * 6.5,
        (Math.random() - 0.5) * 18
      );
      m.userData.speed = 14 + Math.random() * 14;
      this.streaks.push(m);
      this.group.add(m);
    }

    const leafColors = [0x4c7c3e, 0x7a5c38, 0xb5833a, 0x3b6e34];
    const leafGeo = new THREE.BoxGeometry(0.18, 0.04, 0.12);
    for (let i = 0; i < 35; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: leafColors[i % leafColors.length], roughness: 0.85,
      });
      const leaf = new THREE.Mesh(leafGeo, mat);
      leaf.position.set(
        (Math.random() - 0.5) * 22,
        0.3 + Math.random() * 5.5,
        (Math.random() - 0.5) * 14
      );
      leaf.userData.speed = 10 + Math.random() * 12;
      leaf.userData.rotSpeed = 3 + Math.random() * 6;
      this.debris.push(leaf);
      this.group.add(leaf);
    }
  }

  private buildRainFX() {
    const count = 450;
    const pos = new Float32Array(count * 6);
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 24;
      const y = Math.random() * 12;
      const z = (Math.random() - 0.5) * 20;
      pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z;
      pos[i * 6 + 3] = x - 0.18; pos[i * 6 + 4] = y - 0.85; pos[i * 6 + 5] = z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xcbe4ff, transparent: true, opacity: 0.55 });
    this.rainLines = new THREE.LineSegments(geo, mat);
    this.group.add(this.rainLines);
  }

  private buildSnowFX() {
    const count = 400;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 24;
      pos[i * 3 + 1] = Math.random() * 12;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.85 });
    this.snowPoints = new THREE.Points(geo, mat);
    this.group.add(this.snowPoints);
  }

  private setWeatherVisibility(w: WeatherType) {
    this.currentWeather = w;
    const showWind = w === 'wind_storm';
    this.streaks.forEach(m => (m.visible = showWind));
    this.debris.forEach(m => (m.visible = showWind));
    if (this.rainLines) this.rainLines.visible = w === 'heavy_rain';
    if (this.snowPoints) this.snowPoints.visible = w === 'snow';
  }

  public applyLighting(
    env: BeatEnv | undefined,
    sunLight?: THREE.DirectionalLight,
    hemiLight?: THREE.HemisphereLight,
    holeObjects?: THREE.Object3D[],
    windowMaterials?: THREE.MeshStandardMaterial[]
  ) {
    const tod: TimeOfDay = env?.timeOfDay ?? 'day';
    const p = PRESETS[tod] ?? PRESETS.day;

    this.scene.background = new THREE.Color(p.sky);
    this.scene.fog = new THREE.FogExp2(p.fog, p.fogDensity);

    if (sunLight) {
      sunLight.color.setHex(p.sunColor);
      sunLight.intensity = p.sunIntensity;
      sunLight.position.set(...p.sunPos);
    }
    if (hemiLight) {
      hemiLight.color.setHex(p.hemiSky);
      hemiLight.groundColor.setHex(p.hemiGround);
      hemiLight.intensity = p.hemiIntensity;
    }

    const showHole = env?.showHole !== false;
    holeObjects?.forEach(obj => {
      obj.visible = showHole;
    });

    windowMaterials?.forEach(mat => {
      mat.emissive = new THREE.Color(0xffd27d);
      mat.emissiveIntensity = p.windowGlow;
    });

    const w: WeatherType = env?.weather ?? 'clear';
    if (w !== this.currentWeather) this.setWeatherVisibility(w);
  }

  public update(
    dt: number,
    elapsed: number,
    env: BeatEnv | undefined,
    camera: THREE.Camera,
    treeGroups?: THREE.Object3D[]
  ) {
    const w: WeatherType = env?.weather ?? 'clear';
    const speedMult = Math.max(0.4, env?.windSpeed ?? 1.0);

    if (w === 'wind_storm') {
      for (const m of this.streaks) {
        m.position.x += m.userData.speed * speedMult * dt;
        if (m.position.x > 13) m.position.x = -13;
      }
      for (const d of this.debris) {
        d.position.x += d.userData.speed * speedMult * dt;
        d.position.y += Math.sin(elapsed * 5 + d.position.z) * 0.02;
        d.rotation.x += d.userData.rotSpeed * dt;
        d.rotation.z += d.userData.rotSpeed * 0.8 * dt;
        if (d.position.x > 12) d.position.x = -12;
      }
      treeGroups?.forEach((tree, idx) => {
        tree.rotation.z = -0.32 - Math.sin(elapsed * 9 + idx) * 0.12 * speedMult;
      });
    } else {
      treeGroups?.forEach(tree => {
        tree.rotation.z *= 0.85;
      });
    }

    if (w === 'heavy_rain' && this.rainLines) {
      const attr = this.rainLines.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < attr.count; i += 2) {
        let x = attr.getX(i) - 4 * dt;
        let y = attr.getY(i) - 22 * dt;
        if (y < 0) { y = 12; x = (Math.random() - 0.5) * 24; }
        attr.setXYZ(i, x, y, attr.getZ(i));
        attr.setXYZ(i + 1, x - 0.18, y - 0.85, attr.getZ(i));
      }
      attr.needsUpdate = true;
    }

    if (w === 'snow' && this.snowPoints) {
      const attr = this.snowPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < attr.count; i++) {
        let y = attr.getY(i) - 1.6 * dt;
        let x = attr.getX(i) + Math.sin(elapsed + i) * 0.4 * dt;
        if (y < 0) { y = 12; x = (Math.random() - 0.5) * 24; }
        attr.setXYZ(i, x, y, attr.getZ(i));
      }
      attr.needsUpdate = true;
    }

    const shake = env?.cameraShake ?? 0;
    if (shake > 0) {
      this.baseCamPos.copy(camera.position);
      camera.position.x += Math.sin(elapsed * 43) * 0.08 * shake;
      camera.position.y += Math.cos(elapsed * 37) * 0.06 * shake;
    }
  }

  public dispose() {
    this.scene.remove(this.group);
    this.group.traverse(obj => {
      if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
      const mat = (obj as THREE.Mesh).material;
      if (Array.isArray(mat)) mat.forEach(m => m.dispose());
      else if (mat) mat.dispose();
    });
  }
}
