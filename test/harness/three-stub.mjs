// Tiruan Three.js SANGAT sederhana: hanya untuk memastikan alur kode game berjalan tanpa galat.
// Tidak memeriksa kebenaran API Three.js asli maupun tampilan.
export function any() {
  const f = function () {};
  return new Proxy(f, {
    get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : k in t ? t[k] : (t[k] = any())),
    set: (t, k, v) => { t[k] = v; return true; }, apply: () => any(), construct: () => any(),
  });
}
export class Vector3 { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; } add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; } }
export class Euler { constructor() { this.x = 0; this.y = 0; this.z = 0; } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } }
export class Color { constructor(r = 1, g = 1, b = 1) { this.r = r; this.g = g; this.b = b; }
  set() { return this; } setHex() { return this; } setRGB(r, g, b) { this.r = r; this.g = g; this.b = b; return this; }
  copy(c) { this.r = c.r; this.g = c.g; this.b = c.b; return this; } lerp(c, t) { this.r += (c.r - this.r) * t; this.g += (c.g - this.g) * t; this.b += (c.b - this.b) * t; return this; }
  multiplyScalar(s) { this.r *= s; this.g *= s; this.b *= s; return this; } }
export const MathUtils = { damp: (x, y, l, dt) => x + (y - x) * (1 - Math.exp(-l * dt)), clamp: (v, a, b) => Math.min(b, Math.max(a, v)) };
export class Object3D { constructor() { this.position = new Vector3(); this.rotation = new Euler(); this.scale = new Vector3(1, 1, 1); this.children = []; this.matrix = {}; this.visible = true; this.userData = {}; }
  add(...o) { this.children.push(...o); return this; } traverse(fn) { fn(this); for (const c of this.children) c.traverse?.(fn); } lookAt() {} updateMatrix() {} updateProjectionMatrix() {} }
export class Group extends Object3D {} export class Scene extends Object3D { constructor() { super(); this.fog = null; this.environment = null; } }
export class Mesh extends Object3D { constructor(g, m) { super(); this.geometry = g; this.material = m; this.isMesh = true; } }
export class InstancedMesh extends Mesh { constructor(g, m, n) { super(g, m); this.count = n; this.instanceMatrix = {}; } setMatrixAt() {} }
export class LineSegments extends Mesh {} export class Points extends Mesh {}
export class PerspectiveCamera extends Object3D { constructor(fov, aspect) { super(); this.fov = fov; this.aspect = aspect; } }
class Light extends Object3D { constructor() { super(); this.target = new Object3D(); this.shadow = { mapSize: { set() {} }, camera: { updateProjectionMatrix() {} }, bias: 0, normalBias: 0 }; this.color = new Color(); this.intensity = 1; } }
export class HemisphereLight extends Light {} export class DirectionalLight extends Light {} export class SpotLight extends Light {}
class Geo { translate() { return this; } rotateX() { return this; } rotateZ() { return this; } setAttribute(n, a) { (this.attributes ||= {})[n] = a; return this; } setIndex() { return this; } computeVertexNormals() {}
  get attributes() { return (this._a ||= { position: { needsUpdate: false }, color: { needsUpdate: false } }); } set attributes(v) { this._a = v; } }
export const BoxGeometry = class extends Geo {}, PlaneGeometry = class extends Geo {}, CylinderGeometry = class extends Geo {}, ConeGeometry = class extends Geo {}, SphereGeometry = class extends Geo {}, BufferGeometry = class extends Geo {};
export class Float32BufferAttribute { constructor(a) { this.array = a; } } export class BufferAttribute { constructor(a) { this.array = a; this.needsUpdate = false; } }
class Mat { constructor(o = {}) { Object.assign(this, o); if (typeof this.color !== 'object') this.color = new Color(); this.emissive = new Color(); } }
export const MeshStandardMaterial = class extends Mat {}, MeshPhysicalMaterial = class extends Mat {}, MeshBasicMaterial = class extends Mat {}, LineBasicMaterial = class extends Mat {}, PointsMaterial = class extends Mat {}, ShaderMaterial = class extends Mat {};
export class CanvasTexture { constructor(c) { this.image = c; } }
export class Fog { constructor(c) { this.color = new Color(); } }
export class PMREMGenerator { fromScene() { return { texture: {}, dispose() {} }; } }
export class WebGLRenderer { constructor() { this.shadowMap = {}; this.capabilities = { getMaxAnisotropy: () => 8 }; this.frames = 0; }
  setPixelRatio() {} setSize() {} render() { this.frames++; } setAnimationLoop(fn) { globalThis.__loop = fn; } }
export const SRGBColorSpace = 'srgb', RepeatWrapping = 1000, ACESFilmicToneMapping = 4, PCFShadowMap = 1, BackSide = 1, DoubleSide = 2, AdditiveBlending = 2;
