import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { SceneKit } from './kit';

export interface CameraSpec {
  position: [number, number, number];
  target?: [number, number, number];
  fov?: number;
  /** Restrict orbiting for predominantly 2D set-ups (still zoom/pan-able). */
  lockRotation?: boolean;
  minDistance?: number;
  maxDistance?: number;
  /** Aspect ratio the framing was designed for; narrower viewports zoom out to keep the width in view. */
  aspect?: number;
}

/**
 * Owns the WebGL renderer, label renderer, camera, controls and the animation loop
 * for exactly one mounted simulation. Everything is torn down in dispose().
 */
export class Engine {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly labels: CSS2DRenderer;
  readonly controls: OrbitControls;
  readonly kit: SceneKit;
  onFrame: ((dt: number) => void) | null = null;

  private raf = 0;
  private last = 0;
  private ro: ResizeObserver;
  private host: HTMLElement;
  private camSpec: CameraSpec;
  private raycaster = new THREE.Raycaster();
  private downAt: { x: number; y: number } | null = null;
  private disposed = false;

  constructor(host: HTMLElement, cam: CameraSpec) {
    this.host = host;
    this.camSpec = cam;
    this.camera = new THREE.PerspectiveCamera(cam.fov ?? 42, 1, 0.01, 5000);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.className = 'absolute inset-0 h-full w-full outline-none';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = 'pointer-events-none absolute inset-0 overflow-hidden';
    host.appendChild(this.labels.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = true;
    this.resetView();

    this.scene.add(new THREE.HemisphereLight(0xdbeafe, 0x334155, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(6, 10, 8);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x93c5fd, 0.5);
    rim.position.set(-8, 4, -6);
    this.scene.add(rim);

    this.kit = new SceneKit(this.camera);
    this.kit.controls = this.controls;
    this.scene.add(this.kit.root);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();

    this.renderer.domElement.addEventListener('pointerdown', this.onDown);
    this.renderer.domElement.addEventListener('pointerup', this.onUp);
    this.renderer.domElement.addEventListener('pointermove', this.onMove);

    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  /** Freeze the camera (no rotate / pan / zoom). While locked, touch drags scroll the page instead. */
  setViewLocked(locked: boolean) {
    this.controls.enabled = !locked;
    this.renderer.domElement.style.touchAction = locked ? 'pan-x pan-y pinch-zoom' : 'none';
  }

  resetView() {
    const c = this.camSpec;
    this.camera.position.set(...c.position);
    this.controls.target.set(...(c.target ?? [0, 0, 0]));
    this.controls.enableRotate = !c.lockRotation;
    this.controls.minDistance = c.minDistance ?? 0.5;
    this.controls.maxDistance = c.maxDistance ?? 400;
    this.controls.update();
  }

  private resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    const aspect = w / h;
    const design = this.camSpec.aspect ?? 1.5;
    this.camera.aspect = aspect;
    this.camera.zoom = aspect < design ? Math.max(0.35, aspect / design) : 1;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.labels.setSize(w, h);
  }

  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.onFrame?.(dt);
    this.kit.tick(dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  };

  /* ── picking: a click (not a drag) on a registered object fires its handler ── */
  private pick(ev: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const map = this.kit.getPickables();
    if (!map.size) return null;
    const hits = this.raycaster.intersectObjects([...map.keys()], true);
    for (const hit of hits) {
      let o: THREE.Object3D | null = hit.object;
      while (o) { if (map.has(o)) return map.get(o)!; o = o.parent; }
    }
    return null;
  }
  private onDown = (ev: PointerEvent) => { this.downAt = { x: ev.clientX, y: ev.clientY }; };
  private onUp = (ev: PointerEvent) => {
    if (!this.downAt) return;
    const moved = Math.hypot(ev.clientX - this.downAt.x, ev.clientY - this.downAt.y);
    this.downAt = null;
    if (moved < 5) this.pick(ev)?.();
  };
  private onMove = (ev: PointerEvent) => {
    if (!this.kit.getPickables().size) return;
    this.renderer.domElement.style.cursor = this.pick(ev) ? 'pointer' : '';
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.onDown);
    this.renderer.domElement.removeEventListener('pointerup', this.onUp);
    this.renderer.domElement.removeEventListener('pointermove', this.onMove);
    this.controls.dispose();
    this.kit.dispose();
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.labels.domElement.remove();
  }
}
