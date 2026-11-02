import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Weather } from '../world/indicators';

export type ColorMode = 'tw' | 'intl';

type FrameFn = (dt: number, t: number) => void;

interface Tween {
  start: number;
  ms: number;
  fn: (k: number) => void;
  resolve: () => void;
}

/** 渲染核心：renderer、正交相機、平移縮放、光影、海面、天氣、動畫迴圈與補間。 */
export interface Stage {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  labels: CSS2DRenderer;
  controls: OrbitControls;
  /** 每幀呼叫；回傳取消函式。 */
  onFrame(fn: FrameFn): () => void;
  /** 以 easeInOutCubic 執行 ms 毫秒的補間；cancelTweens() 會讓它立即完成。 */
  animate(ms: number, fn: (k: number) => void): Promise<void>;
  cancelTweens(): void;
  setWeather(w: Weather): void;
  /** 世界首頁視角（框住全圖）。 */
  readonly home: { x: number; z: number; zoom: number };
  setLowPower(on: boolean): void;
  readonly lowPower: boolean;
  /** 所有補間時長乘上此倍率（播放 2× 或測試加速用）。 */
  setTimeScale(s: number): void;
  /** 被 UI 遮住的右側與下方像素；相機會以剩下的可見區域為中心。 */
  setInsets(right: number, bottom: number): void;
  /** 讓相機看向 (x, z)，zoom 為正交縮放倍率。 */
  lookAt(x: number, z: number, zoom: number, ms: number): Promise<void>;
  dispose(): void;
}

/** 正北朝上（方位角 0°），俯角 50°，讓 3:1 的世界地圖左右展開。 */
const ELEVATION = THREE.MathUtils.degToRad(50);
const CAMERA_OFFSET = (() => {
  const elevation = ELEVATION;
  const azimuth = 0;
  const d = 140;
  return new THREE.Vector3(
    d * Math.cos(elevation) * Math.sin(azimuth),
    d * Math.sin(elevation),
    d * Math.cos(elevation) * Math.cos(azimuth),
  );
})();

/** 世界範圍：中心與半寬、半深（世界單位）。 */
export interface WorldExtent {
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
}

const WEATHER_TARGETS: Record<Weather, { sun: number; cloud: number; fog: number; rain: number; sky: THREE.Color }> = {
  sunny: { sun: 1, cloud: 0.15, fog: 0, rain: 0, sky: new THREE.Color('#9fd3f0') },
  cloudy: { sun: 0.75, cloud: 0.7, fog: 0.15, rain: 0, sky: new THREE.Color('#a9c3d3') },
  overcast: { sun: 0.5, cloud: 1, fog: 0.45, rain: 0, sky: new THREE.Color('#8e9aa4') },
  storm: { sun: 0.28, cloud: 1, fog: 0.7, rain: 1, sky: new THREE.Color('#4b535c') },
};

const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

export function createStage(canvas: HTMLCanvasElement, overlay: HTMLElement, extent: WorldExtent): Stage {
  const HOME = { x: extent.cx, z: extent.cz, zoom: 1 };
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const labels = new CSS2DRenderer();
  labels.domElement.className = 'world-labels';
  Object.assign(labels.domElement.style, { position: 'absolute', top: '0', left: '0', pointerEvents: 'none' });
  overlay.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  scene.background = WEATHER_TARGETS.cloudy.sky.clone();
  scene.fog = new THREE.Fog(scene.background.getHex(), 180, 420);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  camera.position.set(HOME.x, 0, HOME.z).add(CAMERA_OFFSET);
  camera.lookAt(HOME.x, 0, HOME.z);

  const controls = new OrbitControls(camera, canvas);
  controls.enableRotate = false;
  controls.screenSpacePanning = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minZoom = 0.8;
  controls.maxZoom = 8;
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.target.set(HOME.x, 0, HOME.z);

  // 光
  const hemi = new THREE.HemisphereLight('#fff6e5', '#3b5d75', 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff1d6', 2.2);
  sun.position.set(extent.cx - 30, 60, extent.cz + 30);
  sun.target.position.set(extent.cx, 0, extent.cz);
  scene.add(sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 50, bottom: -50, near: 1, far: 200 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  const flash = new THREE.AmbientLight('#dfe8ff', 0);
  scene.add(flash);

  // 海
  const seaGeo = new THREE.PlaneGeometry(extent.halfW * 2 + 120, extent.halfD * 2 + 100, 90, 54);
  seaGeo.translate(extent.cx, -extent.cz, 0);
  seaGeo.rotateX(-Math.PI / 2);
  const seaBase = Float32Array.from(seaGeo.attributes.position!.array as Float32Array);
  const sea = new THREE.Mesh(seaGeo, new THREE.MeshStandardMaterial({ color: '#3d86b0', roughness: 0.55, metalness: 0.05, flatShading: true }));
  sea.receiveShadow = true;
  scene.add(sea);

  // 雲
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#f4f6f8', transparent: true, opacity: 0, flatShading: true, depthWrite: false });
  const rand = mulberry32(7);
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + rand() * 0.5, 0), cloudMat);
      s.position.set(j * 0.7 - 1, rand() * 0.3, rand() * 0.5);
      c.add(s);
    }
    c.position.set(extent.cx - extent.halfW + rand() * extent.halfW * 2, 14 + rand() * 3, extent.cz - extent.halfD - 10 + rand() * extent.halfD * 2);
    c.scale.setScalar(1.6);
    c.userData.speed = 0.25 + rand() * 0.35;
    clouds.add(c);
  }
  scene.add(clouds);

  // 雨
  const RAIN = 3000;
  const rainPos = new Float32Array(RAIN * 6);
  for (let i = 0; i < RAIN; i++) {
    const x = extent.cx - extent.halfW + rand() * extent.halfW * 2, y = rand() * 20, z = extent.cz - extent.halfD + rand() * extent.halfD * 2;
    rainPos.set([x, y, z, x + 0.08, y - 0.55, z + 0.08], i * 6);
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: '#c9d6e3', transparent: true, opacity: 0 });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  scene.add(rain);


  let weather = { sun: 0.75, cloud: 0.7, fog: 0.15, rain: 0 };
  let weatherTarget = WEATHER_TARGETS.cloudy;
  let lowPower = false;
  let timeScale = 1;
  let insets = { right: 0, bottom: 0 };
  let nextFlash = 3;

  const frameFns = new Set<FrameFn>();
  const tweens = new Set<Tween>();
  const timer = new THREE.Timer();
  let raf = 0;

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    labels.setSize(w, h);
    // 可見區域 = 畫布扣掉 UI 遮住的部分；用 view offset 讓可見區域中心對準相機目標。
    const right = Math.min(insets.right, w * 0.6);
    const bottom = Math.min(insets.bottom, h * 0.6);
    const vw = w - right;
    const vh = h - bottom;
    const halfVisible = Math.max(extent.halfD * Math.sin(ELEVATION) + 3, (extent.halfW + 3) / (vw / vh));
    const fullW = w + right;
    const fullH = h + bottom;
    const halfH = (halfVisible * fullH) / vh;
    camera.left = (-halfH * fullW) / fullH;
    camera.right = (halfH * fullW) / fullH;
    camera.top = halfH;
    camera.bottom = -halfH;
    if (right > 0 || bottom > 0) camera.setViewOffset(fullW, fullH, right, bottom, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  function frame() {
    raf = requestAnimationFrame(frame);
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);
    const t = timer.getElapsed();
    const now = performance.now();

    for (const tw of [...tweens]) {
      const k = Math.min(1, (now - tw.start) / tw.ms);
      tw.fn(easeInOut(k));
      if (k >= 1) {
        tweens.delete(tw);
        tw.resolve();
      }
    }

    // 天氣漸變
    const r = Math.min(1, dt * 1.5);
    weather = {
      sun: weather.sun + (weatherTarget.sun - weather.sun) * r,
      cloud: weather.cloud + (weatherTarget.cloud - weather.cloud) * r,
      fog: weather.fog + (weatherTarget.fog - weather.fog) * r,
      rain: weather.rain + (weatherTarget.rain - weather.rain) * r,
    };
    (scene.background as THREE.Color).lerp(weatherTarget.sky, r);
    const fog = scene.fog as THREE.Fog;
    fog.color.copy(scene.background as THREE.Color);
    fog.near = 180 - weather.fog * 60;
    fog.far = 420 - weather.fog * 200;
    sun.intensity = 0.5 + 1.9 * weather.sun;
    hemi.intensity = 0.55 + 0.6 * weather.sun;
    cloudMat.opacity = 0.55 * weather.cloud;
    cloudMat.color.setScalar(0.62 + 0.36 * weather.sun);
    for (const c of clouds.children) {
      c.position.x += dt * (c.userData.speed as number);
      if (c.position.x > extent.cx + extent.halfW + 8) c.position.x = extent.cx - extent.halfW - 8;
    }
    rainMat.opacity = 0.55 * weather.rain;
    rain.visible = weather.rain > 0.02 && !lowPower;
    if (rain.visible) {
      rain.position.y -= dt * 24;
      if (rain.position.y < -8) rain.position.y += 8;
    }
    if (weather.rain > 0.5) {
      nextFlash -= dt;
      if (nextFlash <= 0) {
        flash.intensity = 3;
        nextFlash = 3 + Math.random() * 5;
      }
    }
    flash.intensity = Math.max(0, flash.intensity - dt * 9);


    if (!lowPower) {
      const pos = seaGeo.attributes.position!;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = seaBase[i]!, z = seaBase[i + 2]!;
        arr[i + 1] = Math.sin(x * 0.35 + t * 0.9) * 0.08 + Math.cos(z * 0.4 + t * 0.7) * 0.08 - 0.12;
      }
      pos.needsUpdate = true;
      seaGeo.computeVertexNormals();
    }

    for (const fn of frameFns) fn(dt, t);
    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  function animate(rawMs: number, fn: (k: number) => void): Promise<void> {
    const ms = rawMs * timeScale;
    if (ms <= 0) {
      fn(1);
      return Promise.resolve();
    }
    return new Promise((resolve) => tweens.add({ start: performance.now(), ms, fn, resolve }));
  }

  function cancelTweens() {
    for (const tw of tweens) {
      tw.fn(1);
      tw.resolve();
    }
    tweens.clear();
  }

  function lookAt(x: number, z: number, zoom: number, ms: number): Promise<void> {
    const fromT = controls.target.clone();
    const toT = new THREE.Vector3(x, 0, z);
    const fromZ = camera.zoom;
    return animate(ms, (k) => {
      controls.target.lerpVectors(fromT, toT, k);
      camera.position.copy(controls.target).add(CAMERA_OFFSET);
      camera.zoom = fromZ + (zoom - fromZ) * k;
      camera.updateProjectionMatrix();
    });
  }

  return {
    scene, camera, renderer, labels, controls,
    onFrame(fn) {
      frameFns.add(fn);
      return () => frameFns.delete(fn);
    },
    animate,
    cancelTweens,
    setWeather(w) {
      weatherTarget = WEATHER_TARGETS[w];
    },
    home: HOME,
    setLowPower(on) {
      lowPower = on;
      renderer.shadowMap.enabled = !on;
      renderer.setPixelRatio(on ? 1 : Math.min(window.devicePixelRatio, 2));
      resize();
    },
    setInsets(right, bottom) {
      if (right === insets.right && bottom === insets.bottom) return;
      insets = { right, bottom };
      resize();
    },
    setTimeScale(s) {
      timeScale = s;
    },
    get lowPower() {
      return lowPower;
    },
    lookAt,
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      labels.domElement.remove();
    },
  };
}

/** 可重現的亂數，讓島嶼形狀每次相同。 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
