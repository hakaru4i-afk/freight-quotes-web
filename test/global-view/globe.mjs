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
  const camera = new T.PerspectiveCamera(36, 1, .01, 50);
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
  const ordered = route.stops.flatMap(stop => stop.position ? [stop.position] : []);
  const focus = (ordered.length ? ordered : route.markers).reduce((sum, point) => sum.add(vector(point)), new T.Vector3());
  if (focus.lengthSq() < .0001) focus.copy(vector({ lat: 30, lng: 65 }));
  focus.normalize();
  const light = focus.clone().applyAxisAngle(new T.Vector3(0, 1, 0), 1.15).add(new T.Vector3(0, .35, 0)).normalize();
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
        vec3 color = daylight * vec3(.48,.62,.95) * (.20 + .51 * lit) + vec3(.010,.019,.050);
        color += pow(city, 1.15) * vec3(1., .77, .43) * (.98 - .28 * lit);
        color += rim * vec3(.11, .32, .64);
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
  air.scale.setScalar(1.023);
  scene.add(air);

  const style = modes[route.mode];
  const routeCore = new T.MeshBasicMaterial({ color: '#fff0a7' });
  const routeGlow = new T.MeshBasicMaterial({
    color: style.color, transparent: true, opacity: .36, depthWrite: false, blending: T.AdditiveBlending
  });
  const routeHalo = routeGlow.clone();
  routeHalo.opacity = .10;
  let modePosition;
  let longestArc = 0;
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
    const curve = new T.CatmullRomCurve3(points);
    if (angle > longestArc) {
      longestArc = angle;
      modePosition = curve.getPoint(.5);
    }
    for (const [radius, material] of [[.0033, routeCore], [.0075, routeGlow], [.014, routeHalo]]) {
      scene.add(new T.Mesh(new T.TubeGeometry(curve, 64, radius, 6, false), material));
    }
  }

  const markerGeometry = new T.SphereGeometry(1, 14, 10);
  const markerMaterial = new T.MeshBasicMaterial({ color: '#fff5c1' });
  const markerHalo = routeGlow.clone();
  markerHalo.opacity = .26;
  const labels = [...route.markers].sort((a, b) => Number(b.endpoint) - Number(a.endpoint)).map(point => {
    const position = vector(point);
    const mark = new T.Mesh(markerGeometry, markerMaterial);
    mark.position.copy(position).multiplyScalar(1.014);
    const radius = point.endpoint ? .015 : .010;
    mark.scale.setScalar(radius);
    const halo = new T.Mesh(markerGeometry, markerHalo);
    halo.position.copy(mark.position);
    halo.scale.setScalar(radius * 1.8);
    scene.add(mark, halo);
    const label = document.createElement('span');
    label.className = 'gv-globe-label' + (point.endpoint ? ' gv-label-endpoint' : '');
    label.dataset.stopNumber = point.number;
    label.textContent = point.number + ' · ' + point.label;
    stage.append(label);
    return { position, label };
  });

  const transport = document.createElement('span');
  transport.className = 'gv-globe-transport';
  transport.textContent = { rail: '▤', road: '▰', sea: '⚓', air: '✈', multi: '⇄', unknown: '◇' }[route.mode];
  transport.setAttribute('aria-hidden', 'true');
  transport.hidden = true;
  stage.append(transport);

  function render() {
    if (!stage.clientWidth || !stage.clientHeight) return;
    renderer.render(scene, camera);
    const placed = [];
    if (modePosition) {
      const projected = modePosition.clone().project(camera);
      transport.hidden = modePosition.clone().normalize().dot(camera.position) <= 1.04 ||
        Math.abs(projected.x) > .94 || Math.abs(projected.y) > .92;
      if (!transport.hidden) {
        transport.style.left = (projected.x + 1) * 50 + '%';
        transport.style.top = (1 - projected.y) * 50 + '%';
      }
    }
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
    camera.position.copy(focus).multiplyScalar(homeDistance());
    controls.update();
    render();
  }
  function homeDistance() {
    const aspect = stage.clientWidth / Math.max(1, stage.clientHeight);
    const radius = .84 * Math.min(1, aspect) * Math.tan(T.MathUtils.degToRad(camera.fov / 2));
    return Math.hypot(1.023, 1.023 / Math.max(.18, radius));
  }
  let fittedWidth = 0;
  function resize() {
    const { clientWidth: width, clientHeight: height } = stage;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (fittedWidth !== width) {
      fittedWidth = width;
      reset();
    }
    render();
  }
  controls.addEventListener('change', render);
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  resize();
  return {
    resize, reset,
    zoom(direction) {
      const distance = T.MathUtils.clamp(camera.position.length() * .80 ** direction, controls.minDistance, controls.maxDistance);
      camera.position.setLength(distance);
      controls.update();
      render();
    },
    destroy() {
      observer.disconnect();
      controls.dispose();
      const geometries = new Set([sphere, markerGeometry]);
      scene.traverse(object => { if (object.geometry) geometries.add(object.geometry); });
      geometries.forEach(geometry => geometry.dispose());
      [earth, atmosphere, routeCore, routeGlow, routeHalo, markerMaterial, markerHalo].forEach(material => material.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    }
  };
}
