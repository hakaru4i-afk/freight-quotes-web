import * as T from './three.module.min.js';
import { OrbitControls } from './orbit-controls.js';
import { modes } from './route-model.mjs';

const rad = Math.PI / 180;
const vector = ({ lat, lng }) => new T.Vector3(
  Math.cos(lat * rad) * Math.cos(lng * rad), Math.sin(lat * rad),
  -Math.cos(lat * rad) * Math.sin(lng * rad)
);
const texture = name => new T.TextureLoader().loadAsync(new URL(name, import.meta.url).href);
let textures;
const surfaceVertex = `
  varying vec3 surface;
  void main() {
    surface = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  }
`;

export async function createGlobe(stage, route) {
  textures ??= Promise.all([texture('./earth-day.webp'), texture('./earth-night.webp')]).catch(error => {
    textures = null;
    throw error;
  });
  const [day, night] = await textures;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(38, 1, .01, 50);
  const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.domElement.setAttribute('aria-label', 'Интерактивный 3D-глобус');
  renderer.domElement.setAttribute('role', 'img');
  stage.append(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minDistance = 1.55;
  controls.maxDistance = 8;
  controls.rotateSpeed = .65;

  const sphere = new T.SphereGeometry(1, 96, 64);
  const focus = route.markers.reduce((sum, point) => sum.add(vector(point)), new T.Vector3());
  if (focus.lengthSq() < .0001) focus.copy(vector({ lat: 30, lng: 65 }));
  focus.normalize();
  const light = focus.clone().add(new T.Vector3(.25, .5, .9)).normalize();
  const earth = new T.ShaderMaterial({
    uniforms: { day: { value: day }, night: { value: night }, lightDir: { value: light } },
    vertexShader: surfaceVertex,
    fragmentShader: `
      uniform sampler2D day, night;
      uniform vec3 lightDir;
      varying vec3 surface;
      void main() {
        vec3 n = normalize(surface);
        vec2 uv = vec2(atan(-n.z, n.x) / 6.2831853 + .5, asin(n.y) / 3.14159265 + .5);
        vec3 daylight = texture2D(day, uv).rgb;
        vec3 lights = texture2D(night, uv).rgb;
        float lit = smoothstep(-.22, .95, dot(n, lightDir));
        vec3 viewDir = normalize(cameraPosition - surface);
        float rim = pow(1. - max(0., dot(viewDir, n)), 3.8);
        float city = max(lights.r, max(lights.g, lights.b));
        vec3 color = daylight * (.23 + .54 * lit) + vec3(.013,.027,.066);
        color += pow(city, 1.45) * vec3(1., .69, .32) * (.83 - .35 * lit);
        color += rim * vec3(.12, .40, .85);
        gl_FragColor = vec4(color, 1.);
      }
    `
  });
  scene.add(new T.Mesh(sphere, earth));
  const atmosphere = new T.ShaderMaterial({
    side: T.BackSide, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: surfaceVertex,
    fragmentShader: `
      varying vec3 surface;
      void main() {
        vec3 n = normalize(surface);
        float glow = pow(clamp(1. - abs(dot(n, normalize(cameraPosition - surface))), 0., 1.), 5.);
        gl_FragColor = vec4(.22, .50, 1., glow * .49);
      }
    `
  });
  const air = new T.Mesh(sphere, atmosphere);
  air.scale.setScalar(1.045);
  scene.add(air);

  const style = modes[route.mode];
  const line = new T.LineDashedMaterial({
    color: style.color, dashSize: .007 + style.dash[0] * .002, gapSize: .009
  });
  const aura = new T.MeshBasicMaterial({
    color: style.color, transparent: true, opacity: .23, depthWrite: false
  });
  for (const [start, end] of route.segments) {
    const a = vector(start);
    const b = vector(end);
    const angle = a.angleTo(b);
    const axis = a.clone().cross(b);
    if (axis.lengthSq() < 1e-12) axis.copy(a).cross(Math.abs(a.y) > .8 ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 1, 0));
    axis.normalize();
    const points = Array.from({ length: 65 }, (_, i) => {
      const t = i / 64;
      const lift = route.mode === 'air' ? .19 : .105;
      return a.clone().applyAxisAngle(axis, angle * t).multiplyScalar(1.006 + Math.sin(Math.PI * t) * Math.min(angle * .29, lift));
    });
    const path = new T.Line(new T.BufferGeometry().setFromPoints(points), line);
    path.computeLineDistances();
    scene.add(path, new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points), 64, .0026, 5, false), aura));
  }

  const markerGeometry = new T.SphereGeometry(.011, 14, 10);
  const markerMaterial = new T.MeshBasicMaterial({ color: '#ffe5a0' });
  const labels = route.markers.map(point => {
    const position = vector(point);
    const mark = new T.Mesh(markerGeometry, markerMaterial);
    mark.position.copy(position).multiplyScalar(1.012);
    scene.add(mark);
    const label = document.createElement('span');
    label.className = 'gv-globe-label';
    label.textContent = point.label;
    stage.append(label);
    return { position, label };
  });

  function render() {
    if (!stage.clientWidth || !stage.clientHeight) return;
    renderer.render(scene, camera);
    const placed = [];
    for (const { position, label } of labels) {
      const projected = position.clone().multiplyScalar(1.02).project(camera);
      const x = (projected.x + 1) * stage.clientWidth / 2;
      const y = (1 - projected.y) * stage.clientHeight / 2;
      label.hidden = position.dot(camera.position) <= 1.045 || Math.abs(projected.x) > .95 ||
        Math.abs(projected.y) > .9 || placed.some(([px, py]) => Math.abs(px - x) < 55 && Math.abs(py - y) < 21);
      if (label.hidden) continue;
      placed.push([x, y]);
      label.style.left = x + 'px';
      label.style.top = y + 'px';
      label.classList.toggle('gv-label-left', x > stage.clientWidth * .66);
    }
  }
  function reset() {
    camera.position.copy(focus).multiplyScalar(stage.clientWidth < 480 ? 3.95 : 3.65);
    controls.update();
    render();
  }
  function resize() {
    const { clientWidth: width, clientHeight: height } = stage;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  }
  controls.addEventListener('change', render);
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  reset();
  resize();
  return {
    resize, reset,
    destroy() {
      observer.disconnect();
      controls.dispose();
      const geometries = new Set([sphere, markerGeometry]);
      scene.traverse(object => { if (object.geometry) geometries.add(object.geometry); });
      geometries.forEach(geometry => geometry.dispose());
      [earth, atmosphere, line, aura, markerMaterial].forEach(material => material.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    }
  };
}
