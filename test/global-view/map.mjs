import './leaflet.js';
import './topojson.js';
import { modes, shortestLongitude } from './route-model.mjs?v=c9d86882b1e4';

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
  for (const [index, point] of route.markers.entries()) {
    const coordinates = [point.lat, shortestLongitude(point.lng, reference)];
    points.push(coordinates);
    const label = document.createElement('span');
    label.dataset.stopNumber = point.number;label.dataset.current=String(!!point.current);
    label.textContent = point.number + ' · ' + point.label.split(' / ')[0];
    label.title = point.label;
    const nearPrevious = index > 0 && map.distance(coordinates, points[index - 1]) < 190000;
    const nearNext = index < route.markers.length - 1 &&
      map.distance(coordinates, [route.markers[index + 1].lat, shortestLongitude(route.markers[index + 1].lng, reference)]) < 190000;
    const direction = nearPrevious ? 'bottom' : nearNext ? 'top' : 'auto';
    L.circleMarker(coordinates, { radius: point.current?8:point.endpoint ? 6 : 4, color:point.current?'#75efaf':'#ffedbd', weight: 2, fillColor:point.current?'#75efaf':style.color, fillOpacity: 1 })
      .bindTooltip(label, { permanent: true, direction, offset: [0, nearPrevious ? 7 : -8], className: 'gv-map-stop', opacity: 1 })
      .addTo(map);
  }
  function reset() {
    map.invalidateSize();
    if (points.length > 1) map.fitBounds(points, { padding: [40, 44], maxZoom: 7, animate: false });
    else map.setView(points[0] ?? [28, 40], points.length ? 6 : 2, { animate: false });
    updateCaps();
  }
  let fittedWidth = 0;
  function resize() {
    if (!stage.clientWidth || !stage.clientHeight) return;
    if (fittedWidth === stage.clientWidth) map.invalidateSize({ pan: false });
    else {
      fittedWidth = stage.clientWidth;
      reset();
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
