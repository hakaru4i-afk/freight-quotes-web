const normal = value => String(value ?? '').normalize('NFKC').toLowerCase()
  .replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
const clean = value => typeof value === 'string' ? value.trim() : '';
const split = value => clean(value).split(/\s*(?:\r?\n|→|->|;|\s+[–—-]\s+)\s*/).filter(Boolean);

const aliases = {
  'Шэньчжэнь': 'Shenzhen', 'Шенчжень': 'Shenzhen', '深圳': 'Shenzhen', '深圳市': 'Shenzhen',
  'Нинбо': 'Ningbo', '宁波': 'Ningbo', '宁波市': 'Ningbo',
  'Минск': 'Minsk', 'Мінск': 'Minsk', '明斯克': 'Minsk',
  'Шанхай': 'Shanghai', '上海': 'Shanghai', 'Гуанчжоу': 'Guangzhou', '广州': 'Guangzhou',
  'Иу': 'Yiwu', '义乌': 'Yiwu', 'Сиань': 'Xian', '西安': 'Xian',
  'Чэнду': 'Chengdu', '成都': 'Chengdu', 'Чунцин': 'Chongqing', '重庆': 'Chongqing',
  'Циндао': 'Qingdao', '青岛': 'Qingdao', 'Пекин': 'Beijing', '北京': 'Beijing',
  'Москва': 'Moscow', '莫斯科': 'Moscow', 'Брест': 'Brest BY', 'Брэст': 'Brest BY',
  'Варшава': 'Warsaw', 'Алматы': 'Almaty', 'Астана': 'Astana', 'Владивосток': 'Vladivostok',
  'Гамбург': 'Hamburg', 'Клайпеда': 'Klaipeda', 'Рига': 'Riga',

};

export const modes = {
  rail: { label: 'Железнодорожный', color: '#ffca52', dash: [8, 5] },
  road: { label: 'Автомобильный', color: '#ffd970', dash: [3, 5] },
  sea: { label: 'Морской', color: '#f6c153', dash: [13, 6] },
  air: { label: 'Авиационный', color: '#ffe498', dash: [2, 6] },
  multi: { label: 'Мультимодальный', color: '#ffbf4c', dash: [10, 4, 2, 4] },
  unknown: { label: 'Не указан', color: '#ffca52', dash: [6, 6] }
};

export function transportMode(value) {
  const mode = normal(value);
  if (/мульт|комбинир|multi|intermodal|多式联运/.test(mode)) return 'multi';
  const matches = [
    ['rail', /ж\s*[\/.-]?\s*д|железнодорож|rail|train|铁路/],
    ['road', /авто|road|truck|公路/],
    ['sea', /мор|sea|ocean|海运/],
    ['air', /авиа|air|空运/]
  ].filter(([, pattern]) => pattern.test(mode));
  return matches.length > 1 ? 'multi' : matches[0]?.[0] ?? 'unknown';
}

export function placeIndex(rows) {
  const index = new Map();
  for (const [names, country, lat, lng] of rows) {
    for (const name of names) {
      for (const key of [normal(name), ...(country ? [normal(name + ' ' + country)] : [])]) {
        const points = index.get(key) ?? new Map();
        points.set(lat + ',' + lng, { lat, lng, approximate: true });
        index.set(key, points);
      }
    }
  }
  const aliasIndex = new Map(Object.entries(aliases).map(([key, value]) => [normal(key), normal(value)]));
  const lookup = key => {
    const points = index.get(aliasIndex.get(key) ?? key);
    return points?.size === 1 ? points.values().next().value : null;
  };
  return label => {
    const coordinate = label.match(/^([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)$/);
    if (coordinate) {
      const [, lat, lng] = coordinate.map(Number);
      return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng, approximate: false } : null;
    }
    const key = normal(label);
    const exact = lookup(key);
    if (exact) return exact;
    // The bundled gazetteer only verifies a city and its ISO country code.
    // An unmatched qualifier may be a different country or a street address.
    const parts = key.split(/[,，]/).map(part => part.trim());
    if (parts.length === 1) return lookup(parts[0].replace(/^(?:г\.|город|city of)\s*/, ''));
    if (parts.length !== 2) return null;
    const countryCode = value => ({
      'китай': 'cn', china: 'cn', '中国': 'cn',
      'беларусь': 'by', belarus: 'by', '白俄罗斯': 'by'
    })[value] ?? (/^[a-z]{2}$/.test(value) ? value : '');
    const [city, country] = countryCode(parts[0]) ? [...parts].reverse() : parts;
    const cityName = city.replace(/^(?:г\.|город|city of)\s*/, '');
    const code = countryCode(country);
    return code ? lookup((aliasIndex.get(cityName) ?? cityName) + ' ' + code) : null;
  };
}

export function routeModel(request, offer, resolve) {
  const origin = clean(request.origin);
  const destination = clean(request.destination);
  const departure = clean(offer?.departure_station) || clean(offer?.incoterm_place);
  const arrival = clean(offer?.destination_station);
  const carrier = split(clean(offer?.waypoints) || offer?.route);
  const owner = split(request.waypoints);
  const transport = clean(offer?.mode) || clean(request.transport);
  const mode = transportMode(transport);
  const stops = [];
  const push = (label, role) => {
    if (label && normal(label) !== normal(stops.at(-1)?.label)) {
      stops.push({ label, role, position: resolve(label,role) });
    }
  };
  push(origin, 'Погрузка · владелец');
  push(departure, 'Станция / порт отправления · перевозчик');
  for (const label of carrier.length ? carrier : owner) {
    push(label, carrier.length ? 'Маршрут ставки · перевозчик' : 'Промежуточный пункт · владелец');
  }
  push(arrival, 'Станция / порт назначения · перевозчик');
  push(destination, 'Доставка · владелец');
  const deferred = [];
  const seen = new Set(stops.map(stop => normal(stop.label)));
  const collectUnordered = (labels, role) => {
    for (const label of labels) {
      const key = normal(label);
      if (seen.has(key)) continue;
      seen.add(key);
      deferred.push({ label, role, position: resolve(label,role) });
    }
  };
  if (carrier.length) collectUnordered(owner, 'Промежуточный пункт · владелец');
  if (clean(offer?.waypoints)) collectUnordered(split(offer?.route), 'Маршрут ставки · перевозчик');
  const markers = [];
  for (const [index, stop] of [...stops, ...deferred].entries()) {
    if (!stop.position) continue;
    const number = index < stops.length ? String(index + 1) : '◇';
    const endpoint = index === 0 || index === stops.length - 1;
    const match = markers.find(point => point.lat === stop.position.lat && point.lng === stop.position.lng);
    if (match) {
      match.number += ' / ' + number;
      match.label += ' / ' + stop.label;
      match.endpoint ||= endpoint;
    } else {
      markers.push({ label: stop.label, number, endpoint, ...stop.position });
    }
  }
  const segments = [];
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1].position;
    const b = stops[i].position;
    if (a && b && (a.lat !== b.lat || a.lng !== b.lng)) segments.push([a, b]);
  }
  return { stops, markers, segments, mode, transport, deferred, missingEndpoints: !origin || !destination };
}

export function shortestLongitude(lng, reference) {
  return lng + 360 * Math.round((reference - lng) / 360);
}
