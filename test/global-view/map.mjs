import './leaflet.js';
import './topojson.js';
import { modes, shortestLongitude } from './route-model.mjs';

let geography;
const topology = () => geography ??= fetch(new URL('./countries.json', import.meta.url))
  .then(response => {
    if (!response.ok) throw Error('Geography unavailable');
    return response.json();
  })
  .then(data => globalThis.topojson.feature(data, data.objects.countries))
  .catch(error => {
    geography = null;
    throw error;
  });

export async function createMap(stage, route, places) {
  const data = await topology();
  const L = globalThis.L;
  const map = L.map(stage, { minZoom: 1, maxZoom: 10, scrollWheelZoom: false, preferCanvas: true, zoomControl: false })
    .setView([28, 40], 2, { animate: false });
  map.attributionControl.setPrefix(false).addAttribution('Natural Earth · World Atlas');
  const countryStyle = { color: '#638492', weight: .65, fillColor: '#263e48', fillOpacity: 1 };
  const shift = (coordinates, offset) => typeof coordinates[0] === 'number'
    ? [coordinates[0] + offset, coordinates[1]]
    : coordinates.map(value => shift(value, offset));
  for (const offset of [-360, 0, 360]) {
    const features = offset ? data.features.map(feature => ({
      ...feature, geometry: { ...feature.geometry, coordinates: shift(feature.geometry.coordinates, offset) }
    })) : data.features;
    L.geoJSON(features, {
      style: countryStyle,
      onEachFeature(feature, layer) {
        const label = document.createElement('span');
        label.textContent = feature.properties.name;
        layer.bindTooltip(label, { sticky: true, className: 'gv-map-country' });
      }
    }).addTo(map);
  }
  const reference = route.markers[0]?.lng ?? 0;
  const style = modes[route.mode];
  const caps = L.layerGroup();
  for (const [names, , lat, lng, capital] of places) {
    if (!capital || Math.abs(lat) > 85) continue;
    const point = L.circleMarker([lat, shortestLongitude(lng, reference)], {
      radius: 2, color: '#9cbdc8', weight: 1, fillOpacity: .7, interactive: false
    });
    const label = document.createElement('span');
    label.textContent = names[0];
    point.bindTooltip(label, { permanent: true, direction: 'right', className: 'gv-map-capital', opacity: 1 });
    point.addTo(caps);
  }
  const updateCaps = () => {
    if (map.getZoom() >= 4) caps.addTo(map);
    else caps.remove();
  };
  map.on('zoomend', updateCaps);

  for (const [a, b] of route.segments) {
    const start = shortestLongitude(a.lng, reference);
    const end = shortestLongitude(b.lng, start);
    const path = [[a.lat, start], [b.lat, end]];
    L.polyline(path, { color: '#071522', weight: 6, opacity: .9, interactive: false }).addTo(map);
    L.polyline(path, { color: style.color, weight: 3, dashArray: style.dash.join(' '), interactive: false }).addTo(map);
  }
  const points = [];
  for (const point of route.markers) {
    const coordinates = [point.lat, shortestLongitude(point.lng, reference)];
    points.push(coordinates);
    const label = document.createElement('span');
    label.textContent = point.number + ' · ' + point.label;
    L.circleMarker(coordinates, { radius: point.endpoint ? 6 : 4, color: '#ffedbd', weight: 2, fillColor: style.color, fillOpacity: 1 })
      .bindTooltip(label, { permanent: true, direction: 'auto', offset: [0, -8], className: 'gv-map-stop', opacity: 1 })
      .addTo(map);
  }
  function reset() {
    map.invalidateSize();
    if (points.length > 1) map.fitBounds(points, { padding: [40, 44], maxZoom: 7, animate: false });
    else map.setView(points[0] ?? [28, 40], points.length ? 6 : 2, { animate: false });
    updateCaps();
  }
  let fitted = false;
  function resize() {
    if (!stage.clientWidth || !stage.clientHeight) return;
    if (fitted) map.invalidateSize({ pan: false });
    else {
      reset();
      fitted = true;
    }
  }
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  return {
    resize, reset, zoom: direction => map.setZoom(map.getZoom() + direction),
    destroy() { observer.disconnect(); map.remove(); }
  };
}
