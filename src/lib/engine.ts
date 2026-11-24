import * as THREE from "three";
import type { AspectRatio, CharacterId, CharacterLike, Episode, SceneId, ScenePrefab, Timeline } from "./types";
import { aspectOf } from "./types";
import { CharacterPrefab } from "./scenes/CharacterPrefab";
import { CharacterPrefab2 } from "./scenes/CharacterPrefab2";
import { inferEmotion } from "./emotion";
import { JapaneseStreet } from "./scenes/JapaneseStreet";
import { UndergroundTunnel } from "./scenes/UndergroundTunnel";
import { EarthGlobe } from "./scenes/EarthGlobe";
import { EarthCutaway } from "./scenes/EarthCutaway";
import { OceanSurface } from "./scenes/OceanSurface";
import { StageStudioPrefab } from "./scenes/StageStudioPrefab";
import { CityNYPrefab } from "./scenes/CityNYPrefab";
import { ExtraScenePrefab } from "./scenes/ExtraScenePrefab";
import { createNewScenes } from "./scenes/NewScenes";
import { WeatherEnvController } from "./envController";
import type { TimeOfDay } from "./visualTypes";
import { createSkyTexture } from "./textures";
import { applyExtraCharacterAction } from "./characterActions";
import { earthAssets } from "./earthAssets";
import { Compositor } from "./compositor";
import { frameAt } from "./timeline";

/** khung dọc: hệ số mở rộng tan(fov/2) so với góc máy gốc của khung ngang */
const PORTRAIT_ZOOM_OUT = 1.75;

const EXTRA = ["heavy_crouch", "blown_wind", "jump_low", "shiver", "point_explain"];

interface StreetHooks {
  sun?: THREE.DirectionalLight; hemi?: THREE.HemisphereLight;
  trees: THREE.Object3D[]; holeParts: THREE.Object3D[]; roadFull: THREE.Object3D; reset(): void;
}
/** tìm đèn, cây, hố trong cảnh phố Nhật để bộ thời tiết điều khiển (không phải sửa JapaneseStreet.ts) */
function streetHooks(root: THREE.Group): StreetHooks {
  const kids = root.children, geo = (o: THREE.Object3D) => (o as THREE.Mesh).geometry;
  const sun = kids.find(o => (o as THREE.DirectionalLight).isDirectionalLight) as THREE.DirectionalLight | undefined;
  const hemi = kids.find(o => (o as THREE.HemisphereLight).isHemisphereLight) as THREE.HemisphereLight | undefined;
  const trees = kids.filter(o => o.type === "Group" && o.children[0] && geo(o.children[0]) instanceof THREE.CylinderGeometry);
  const road = kids.find(o => geo(o) instanceof THREE.ShapeGeometry) as THREE.Mesh | undefined;
  const holeParts = kids.filter(o => o === road || (geo(o) instanceof THREE.CylinderGeometry && (geo(o) as THREE.CylinderGeometry).parameters.openEnded)
    || (geo(o) instanceof THREE.CircleGeometry && o.position.y < -1) || geo(o) instanceof THREE.TorusGeometry);
  // mặt đường liền (không hố) – cùng vật liệu, cùng toạ độ texture
  const shape = new THREE.Shape(); shape.moveTo(-3.5, -12); shape.lineTo(3.5, -12); shape.lineTo(3.5, 120); shape.lineTo(-3.5, 120); shape.closePath();
  const roadFull = new THREE.Mesh(new THREE.ShapeGeometry(shape, 4), road?.material); roadFull.rotation.x = -Math.PI / 2; roadFull.receiveShadow = true; roadFull.visible = false; root.add(roadFull);
  const d = { sc: sun?.color.getHex(), si: sun?.intensity, sp: sun?.position.clone(), hc: hemi?.color.getHex(), hg: hemi?.groundColor.getHex(), hi: hemi?.intensity };
  return { sun, hemi, trees, holeParts, roadFull, reset() {
    if (sun) { sun.color.setHex(d.sc!); sun.intensity = d.si!; sun.position.copy(d.sp!); }
    if (hemi) { hemi.color.setHex(d.hc!); hemi.groundColor.setHex(d.hg!); hemi.intensity = d.hi!; }
    holeParts.forEach(o => (o.visible = true)); roadFull.visible = false;
  } };
}

export interface RenderOptions {
  showHud: boolean;
  showSubs: boolean;
  /** 0..1 độ lớn giọng đọc lúc này (từ AnalyserNode); bỏ trống = nhép miệng theo nhịp âm tiết */
  voiceLevel?: number;
}

/** Bộ máy dựng hình: 1 renderer WebGL ẩn + các cảnh + nhân vật + bộ ghép HUD lên canvas xuất */
export class StudioEngine {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 2000);
  characters: Record<CharacterId, CharacterLike> = { nv1: new CharacterPrefab(), nv2: new CharacterPrefab2() };
  characterId: CharacterId = "nv2";
  get character(): CharacterLike { return this.characters[this.characterId]; }
  prefabs: Record<SceneId, ScenePrefab>;
  compositor: Compositor;
  /** xong khi ảnh bản đồ Trái Đất đã tải (hoặc hết thời gian chờ) */
  ready: Promise<void>;
  private tunnel: UndergroundTunnel;
  private last?: [Episode, Timeline, number, RenderOptions];
  private street: StreetHooks;
  private env: WeatherEnvController;
  private envT = 0;
  private skies = new Map<TimeOfDay, THREE.Texture>();
  /** ảnh beat tải lên (theo src) */
  private images = new Map<string, HTMLImageElement>();

  /** tỉ lệ khung hình hiện tại của canvas xuất */
  aspect: AspectRatio = "16:9";
  get portrait(): boolean { return this.aspect === "9:16"; }

  constructor(public out: HTMLCanvasElement, width = 1920, aspect: AspectRatio = "16:9") {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.localClippingEnabled = true;
    this.ready = earthAssets().ready;
    // ảnh vệ tinh tải xong → vẽ lại khung hình gần nhất
    this.ready.then(() => { if (this.last) this.renderAt(...this.last); });
    this.compositor = new Compositor(out);
    this.tunnel = new UndergroundTunnel();
    const street = new JapaneseStreet();
    this.street = streetHooks(street.root);
    this.prefabs = { japanese_street: street, underground_tunnel: this.tunnel, earth_globe: new EarthGlobe(),
      earth_cutaway: new EarthCutaway(), ocean_surface: new OceanSurface(), stage_studio: new StageStudioPrefab(), city_ny: new CityNYPrefab(),
      wind_storm_street: new ExtraScenePrefab("wind_storm_street"), mega_tsunami_coast: new ExtraScenePrefab("mega_tsunami_coast"),
      arctic_pole: new ExtraScenePrefab("arctic_pole"), space_iss_orbit: new ExtraScenePrefab("space_iss_orbit"),
      extreme_climate_zone: new ExtraScenePrefab("extreme_climate_zone"), science_museum_pendulum: new ExtraScenePrefab("science_museum_pendulum"),
      ...createNewScenes() };
    Object.values(this.prefabs).forEach(p => this.scene.add(p.root));
    Object.values(this.characters).forEach(c => this.scene.add(c.root));
    this.env = new WeatherEnvController(this.scene);
    this.setResolution(width, aspect);
  }

  /** ảnh của beat: tải 1 lần, tải xong thì vẽ lại khung hình */
  private image(src?: string): HTMLImageElement | undefined {
    if (!src) return undefined;
    let img = this.images.get(src);
    if (!img) {
      img = new Image(); img.onload = () => { if (this.last) this.renderAt(...this.last); };
      img.src = src; this.images.set(src, img);
    }
    return img;
  }

  private sky(tod: TimeOfDay): THREE.Texture {
    const C: Record<TimeOfDay, [string, string]> = {
      day: ["#6fa6d6", "#d4e6f3"], sunset: ["#3d2b52", "#e2794c"], night: ["#050a17", "#1c2c4c"],
      scorching: ["#d9662f", "#ffd38f"], frozen: ["#8fb6d8", "#eaf4fb"],
    };
    let t = this.skies.get(tod);
    if (!t) { const [a, b] = C[tod] ?? C.day; t = createSkyTexture(a, b); this.skies.set(tod, t); }
    return t;
  }

  /** đổi nhân vật (nv1 = cũ, nv2 = mới) */
  setCharacter(id: CharacterId): void { if (this.characters[id]) this.characterId = id; }

  /** long = cạnh dài (1920 → 1920x1080 hoặc 1080x1920) */
  setResolution(long: number, aspect: AspectRatio = this.aspect): void {
    const short = Math.round((long * 9) / 16);
    const [w, h] = aspect === "9:16" ? [short, long] : [long, short];
    this.aspect = aspect; this.compositor.portrait = aspect === "9:16";
    this.out.width = w; this.out.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  /** vẽ khung hình tại giây t */
  renderAt(ep: Episode, tl: Timeline, t: number, opts: RenderOptions): void {
    if (!ep.beats.length) return;
    // tập đổi tỉ lệ (JSON "aspect") → đổi khung canvas, giữ nguyên cạnh dài
    const want = aspectOf(ep);
    if (want !== this.aspect) this.setResolution(Math.max(this.out.width, this.out.height), want);
    this.last = [ep, tl, t, opts];
    const { ctx, fade } = frameAt(ep, tl, t), beat = ctx.beat, active = this.prefabs[beat.scene] ?? this.prefabs.japanese_street;
    for (const p of Object.values(this.prefabs)) p.root.visible = p === active;
    for (const [id, c] of Object.entries(this.characters)) c.root.visible = id === this.characterId;
    const ch = this.character;
    ch.setSpacesuit(!!beat.spacesuit);
    // 5 động tác mới (characterActions.ts): về tư thế gốc rồi đặt tư thế mới; không khớp thì dùng động tác cũ
    const rig = ch as unknown as Record<"body" | "head" | "armL" | "armR" | "legL" | "legR", THREE.Object3D>;
    const extra = (EXTRA as string[]).includes(beat.characterAction);
    ch.setAction(extra ? "idle" : beat.characterAction, ctx.lt, ctx.lp, ctx.t);
    if (extra) applyExtraCharacterAction({ root: rig.body, head: rig.head, leftArm: rig.armL, rightArm: rig.armR, leftLeg: rig.legL, rightLeg: rig.legR }, beat.characterAction, ctx.t);
    ch.setFace?.({
      t: ctx.t, lt: ctx.lt, lp: ctx.lp, emotion: inferEmotion(beat, ctx.hud.depthKm),
      voiceLevel: opts.voiceLevel, speaking: !!beat.ja_narration && ctx.lp < 0.97,
    });
    active.apply(this.scene); this.street.reset();
    // thời tiết / giờ trong ngày: chỉ ở phố Nhật (ánh sáng + mưa gió) và sân khấu (chỉ mưa/tuyết/gió)
    // phố New York: luôn dùng bộ thời tiết, mặc định ban đêm
    const ny = beat.scene === "city_ny" ? (active as CityNYPrefab) : null;
    const env = ny ? { ...beat.env, timeOfDay: (beat.env?.timeOfDay ?? "night") as TimeOfDay } : beat.env;
    const envOn = (beat.scene === "japanese_street" || beat.scene === "stage_studio" || !!ny) && !!env;
    if (envOn && beat.scene === "japanese_street") {
      this.env.applyLighting(env, this.street.sun, this.street.hemi, this.street.holeParts);
      this.street.roadFull.visible = env?.showHole === false;
      this.scene.background = this.sky(env?.timeOfDay ?? "day");
    } else if (ny && env) {
      this.env.applyLighting(env, ny.sun, ny.hemi, ny.holeObjects, ny.windowMaterials);
      this.scene.background = this.sky(env.timeOfDay ?? "night");
    } else {
      this.env.applyLighting(envOn ? env : undefined);
      active.apply(this.scene);
    }
    active.update(ctx, ch, this.camera);
    const fx = this.scene.getObjectByName("weather_env_fx");
    if (fx) fx.position.set(ch.root.position.x, 0, ch.root.position.z);
    const dt = Math.min(0.1, Math.max(0, ctx.t - this.envT)); this.envT = ctx.t;
    // rung camera (env.cameraShake) dùng được ở mọi cảnh, kể cả đường hầm
    const shakeOnly = !envOn && beat.env?.cameraShake ? { cameraShake: beat.env.cameraShake } : undefined;
    this.env.update(dt, ctx.t, envOn ? env : shakeOnly, this.camera, beat.scene === "japanese_street" ? this.street.trees : undefined);
    // có thẻ biểu đồ / ảnh nhỏ bên phải → dời khung hình để nhân vật nằm 1/3 bên trái
    const W = this.out.width, H = this.out.height, img = this.image(beat.imageOverlay?.src);
    const sideCard = !!beat.brandOverlay || (beat.visual && beat.visual.position !== "full") || (img && beat.imageOverlay?.mode === "pip_right");
    // khung dọc: thẻ nằm nửa trên → dời hình xuống để nhân vật nằm nửa dưới
    if (sideCard) this.camera.setViewOffset(W, H, this.portrait ? 0 : W * 0.17, this.portrait ? -H * 0.22 : 0, W, H);
    else if (this.camera.view) this.camera.clearViewOffset();
    // khung dọc: các góc máy được đặt cho khung ngang → mở rộng góc nhìn dọc để không chỉ là cắt giữa
    // (giữ ~55% bề ngang của khung ngang, lộ thêm trời / mặt đất phía trên và dưới nhân vật)
    const baseFov = this.camera.fov;
    if (this.portrait) {
      const half = Math.atan(Math.tan((baseFov * Math.PI) / 360) * PORTRAIT_ZOOM_OUT);
      this.camera.fov = Math.min(88, (half * 360) / Math.PI);
    }
    this.camera.aspect = W / H; this.camera.updateProjectionMatrix();
    this.scene.updateMatrixWorld(); this.camera.updateMatrixWorld();
    const labels = (active.labels?.(this.camera) ?? []).flatMap(l => {
      const v = l.pos.clone().project(this.camera);
      return v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 ? [{ x: (v.x + 1) / 2, y: (1 - v.y) / 2, text: l.text }] : [];
    });
    this.renderer.render(this.scene, this.camera);
    if (this.camera.fov !== baseFov) { this.camera.fov = baseFov; this.camera.updateProjectionMatrix(); }
    const showLayer = beat.scene === "underground_tunnel" || (beat.scene === "earth_cutaway" && ctx.hud.depthKm > 0.5);
    this.compositor.draw(this.renderer.domElement, ctx, {
      showHud: opts.showHud, showSubs: opts.showSubs, fade, labels,
      layerName: showLayer ? this.tunnel.layerName(ctx.hud.depthKm) : undefined,
      image: img, imageMode: beat.imageOverlay?.mode ?? "fullscreen_kenburns",
    });
  }

  dispose(): void {
    Object.values(this.prefabs).forEach(p => p.dispose());
    Object.values(this.characters).forEach(c => c.dispose());
    this.env.dispose(); this.skies.forEach(t => t.dispose());
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
