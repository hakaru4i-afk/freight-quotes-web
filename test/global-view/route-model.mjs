const normal = value => String(value ?? '').normalize('NFKC').toLowerCase()
  .replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
const clean = value => typeof value === 'string' ? value.trim() : '';
const split = value => clean(value).split(/\s*(?:\r?\n|→|->|[;|]|\s+[–—-]\s+)\s*/).filter(Boolean);

const aliases = {
  'Шэньчжэнь': 'Shenzhen', 'Шенчжень': 'Shenzhen', '深圳': 'Shenzhen', '深圳市': 'Shenzhen',
  'Нинбо': 'Ningbo', '宁波': 'Ningbo', '宁波市': 'Ningbo',
  'Юйяо': 'Yuyao', 'Юяо': 'Yuyao', '余姚': 'Yuyao', '余姚市': 'Yuyao',
  'Минск': 'Minsk', 'Мінск': 'Minsk', '明斯克': 'Minsk',
  'Шанхай': 'Shanghai', '上海': 'Shanghai', 'Гуанчжоу': 'Guangzhou', '广州': 'Guangzhou',
  'Иу': 'Yiwu', '义乌': 'Yiwu', 'Сиань': 'Xian', '西安': 'Xian',
  'Чэнду': 'Chengdu', '成都': 'Chengdu', 'Чунцин': 'Chongqing', '重庆': 'Chongqing',
  'Циндао': 'Qingdao', '青岛': 'Qingdao', 'Линьи':'Linyi', '临沂':'Linyi','临沂市':'Linyi', 'Пекин': 'Beijing', '北京': 'Beijing',
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
        points.set(lat + ',' + lng, { lat, lng, approximate: true, queryScope: 'public-place-only' });
        index.set(key, points);
      }
    }
  }
  // Verified gazetteer supplement for a city missing from the bundled Natural Earth list.
  // Yuyao city centre: OSM node 244082817, 30.0403 N, 121.1501 E.
  // NEVER claim that these are the coordinates of the supplier's warehouse or Mazhu Road.
  for (const name of ['Yuyao', '余姚', '余姚市']) {
    const pts = new Map();
    pts.set('30.0403,121.1501', {lat:30.0403,lng:121.1501,approximate:true,precision:'city',confirmed:false,queryScope:'public-place-only',source:'OSM Yuyao city centre'});
    index.set(normal(name),pts);
    index.set(normal(name+' CN'),pts);
  }
  const aliasIndex = new Map(Object.entries(aliases).map(([key, value]) => [normal(key), normal(value)]));
  const lookup = key => {
    const points = index.get(aliasIndex.get(key) ?? key);
    return points?.size === 1 ? points.values().next().value : null;
  };
  // Generic address parser: extract *known* city names from mixed RU/EN/ZH
  // address hierarchies, instead of adding a hard-coded rule for every request.
  // A city centre is ALWAYS a provisional point, never a verified warehouse
  // or railway station. Ambiguous same-name settlements remain unresolved.
  const aliasesWithTargets = [...aliasIndex.entries()].map(([name, target])=>[name,target]);
  const isHan = name => /[\p{Script=Han}]/u.test(name);
  const hasName = (haystack, needle) => {
    if (isHan(needle)) return needle.length >= 2 && haystack.includes(needle);
    if (needle.length < 3) return false;
    let pos=haystack.indexOf(needle);
    while(pos>=0) {
      const before=pos===0?'':haystack[pos-1];
      const after=haystack[pos+needle.length]||'';
      if((!before||!/[\p{L}\p{N}]/u.test(before)) &&
         (!after||!/[\p{L}\p{N}]/u.test(after)))return true;
      pos=haystack.indexOf(needle,pos+1);
    }
    return false;
  };
  const countryIn = text => {
    if (/(?:中国|中华人民共和国|(?:^|\W)(?:china|cn|китай)(?:$|\W)|浙江|山东|广东|江苏|福建|河北|宁波|上海)/iu.test(text)) return 'cn';
    if (/(?:беларусь|белоруссия|白俄罗斯|(?:^|\W)(?:belarus|by)(?:$|\W))/iu.test(text)) return 'by';
    if (/(?:россия|俄罗斯|(?:^|\W)(?:russia|ru)(?:$|\W))/iu.test(text)) return 'ru';
    if (/(?:казахстан|哈萨克斯坦|(?:^|\W)(?:kazakhstan|kz)(?:$|\W))/iu.test(text)) return 'kz';
    if (/(?:монголия|蒙古国|(?:^|\W)(?:mongolia|mn)(?:$|\W))/iu.test(text)) return 'mn';
    return '';
  };
  const addressCountry = label => {
    const text=normal(label),known=countryIn(text);
    const codes=[...new Set(text.split(/[,，]/).map(x=>x.trim()).filter(x=>/^[a-z]{2}$/.test(x)))];
    if(codes.length>1||(codes[0]&&known&&codes[0]!==known))return null;
    return codes[0]||known;
  };
  const candidateNames = [...new Set([...index.keys(),...aliasesWithTargets.map(([name])=>name)])]
    .filter(name=>name.length>=2 && !/ (?:[a-z]{2})$/.test(name));
  const knownAddress = label => {
    const haystack=normal(label),country=addressCountry(label),found=[];
    if(country===null)return null;
    for(const name of candidateNames){
      if(!hasName(haystack,name))continue;
      const target=aliasIndex.get(name)||name;
      const point=country ? lookup(target+' '+country) : lookup(target);
      if(!point)continue;
      const last=haystack.lastIndexOf(name);
      // Later place names in hierarchical addresses generally identify the
      // more specific locality, e.g. Ningbo -> Yuyao. Prefer explicit Chinese
      // city suffix over bare region tokens.
      const suffix = isHan(name) && /(市|县|区)/u.test(haystack.slice(last+name.length,last+name.length+1));
      found.push({name,last,point,score:last*2 + (suffix?4:0)});
    }
    if(!found.length)return null;
    found.sort((a,b)=>b.score-a.score||b.name.length-a.name.length);
    const best=found[0];
    // Do not silently pick a location if equal-scoring candidates conflict.
    if(found.some(p=>p.score===best.score && (p.point.lat!==best.point.lat||p.point.lng!==best.point.lng)))return null;
    return {...best.point,approximate:true,precision:'city',confirmed:false,
      source:'gazetteer locality parsed from mixed-language address'};
  };
  return label => {
    if(addressCountry(label)===null)return null;
    const coordinate = label.match(/^([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)$/);
    if (coordinate) {
      const [, lat, lng] = coordinate.map(Number);
      return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng, approximate: false } : null;
    }
    // MAP50: validated city fallback for a mixed Chinese administrative pickup.
    // This is the center of Linyi (approximate), never the factory or village.
    if (/山东省临沂市/.test(label)) { const p=lookup('linyi cn');return p?{...p,precision:'city',confirmed:false}:null; }
    // Yuyao is a county-level city within Ningbo, Zhejiang: match the most
    // specific administrative name, never its parent Ningbo city centre.
    // The point is a city-centre estimate until an address-level geocoder succeeds.
    const yuyaoAddress=/(?:余姚市|余姚|\byuyao\b)/i.test(label);
    const zhejiangContext=/(?:浙江|宁波|\bzhejiang\b|\bningbo\b)/i.test(label);
    if(yuyaoAddress&&zhejiangContext){
      const located=lookup('yuyao cn');
      if(located)return {...located,precision:'city',approximate:true,confirmed:false,source:'verified Yuyao city-centre fallback'};
    }
    const key = normal(label);
    // A mixed-language pickup such as “QINGDAO Linyi shandong 山东省临沂市费县梁丘镇郝家村”
    // contains the actual administrative city. Use only a *verified gazetteer*
    // city-center fallback; never pretend this is the supplier's exact address.
    const cnHierarchy = String(label).normalize('NFKC').match(/(?:省|自治区|特别行政区)([\p{Script=Han}]{2,12})市/u);
    if(cnHierarchy){
      const verifiedCity=aliasIndex.get(normal(cnHierarchy[1]));
      const located=verifiedCity&&lookup(verifiedCity+' cn');
      if(located)return {...located,precision:'city',approximate:true,confirmed:false,source:'Chinese administrative city in local gazetteer'};
    }
    const exact = lookup(key);
    if (exact) return exact;
    // The bundled gazetteer only verifies a city and its ISO country code.
    // An unmatched qualifier may be a different country or a street address.
    const parts = key.split(/[,，]/).map(part => part.trim());
    if (parts.length === 1) return lookup(parts[0].replace(/^(?:г\.|город|city of)\s*/, '')) || knownAddress(label);
    if (parts.length !== 2) return knownAddress(label);
    const countryCode = value => ({
      'китай': 'cn', china: 'cn', '中国': 'cn',
      'беларусь': 'by', belarus: 'by', '白俄罗斯': 'by'
    })[value] ?? (/^[a-z]{2}$/.test(value) ? value : '');
    const [city, country] = countryCode(parts[0]) ? [...parts].reverse() : parts;
    const cityName = city.replace(/^(?:г\.|город|city of)\s*/, '');
    const code = countryCode(country);
    // An explicit ISO country is a constraint, never a hint that may be dropped.
    if (code) return lookup((aliasIndex.get(cityName) ?? cityName) + ' ' + code);
    return knownAddress(label);
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
