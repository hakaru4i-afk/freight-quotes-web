import { calculateMapDistances } from './distance.mjs?v=7e04e523b956';
import { modes, placeIndex, routeModel } from './route-model.mjs?v=c9d86882b1e4';

const node = (tag, className, text) => {
  const element = document.createElement(tag);
  element.className = className;
  if (text) element.textContent = text;
  return element;
};
const icons = { rail: '▤', road: '▰', sea: '⚓', air: '✈', multi: '⇄', unknown: '◇' };
let cities;
function loadCities() {
  return cities ??= fetch(new URL('./places.json', import.meta.url)).then(response => {
    if (!response.ok) throw Error('City data unavailable');
    return response.json();
  }).catch(error => {
    cities = null;
    throw error;
  });
}

class GlobalRouteView extends HTMLElement {
  static observedAttributes = ['data-route'];
  #cleanup;
  #languageObserver;

  connectedCallback() { this.#mount();this.#languageObserver=new MutationObserver(()=>this.#mount());this.#languageObserver.observe(document.documentElement,{attributes:true,attributeFilter:["lang"]}); }
  disconnectedCallback() { this.#cleanup?.();this.#languageObserver?.disconnect(); }
  attributeChangedCallback() { if (this.isConnected) this.#mount(); }

  async #mount() {
    this.#cleanup?.();
    const controller = new AbortController();
    const { signal } = controller;
    const instances = {};
    this.#cleanup = () => {
      controller.abort();
      Object.values(instances).forEach(instance => instance.destroy());
    };
    const previousMode = this.dataset.mode ?? '3d';
    const [request, offer, inputTracking, distance, plannedGeocodes] = JSON.parse(this.dataset.route ?? '[{},null]');
    const tracking=Array.isArray(inputTracking)?[...inputTracking].sort((a,b)=>Date.parse(a.observed_at)-Date.parse(b.observed_at)||String(a.recorded_at||'').localeCompare(String(b.recorded_at||''))||String(a.id||'').localeCompare(String(b.id||''))):null;
    const hero = node('div', 'gv-hero');
    const header = node('header', 'gv-header');
    header.append(node('h2', 'gv-title', 'Global View'),
      node('p', 'gv-subtitle', 'Маршрут заявки'));
    const frame = node('div', 'gv-frame');
    const stages = { '3d': node('div', 'gv-stage gv-stage-globe'), '2d': node('div', 'gv-stage gv-stage-map') };
    stages['2d'].hidden = true;
    frame.append(stages['3d'], stages['2d']);
    const message = node('p', 'gv-message', 'Загружаем карту…');
    message.setAttribute('role', 'status');
    frame.append(message);
    const buttons = node('div', 'gv-controls');
    const modesControl = node('div', 'gv-switch');
    modesControl.setAttribute('role', 'group');
    modesControl.setAttribute('aria-label', 'Режим карты');
    const globe = node('button', '', '3D');
    const flat = node('button', '', '2D');
    globe.setAttribute('aria-label', '3D-глобус');
    flat.setAttribute('aria-label', '2D-карта');
    modesControl.append(globe, flat);
    const zoom = node('div', 'gv-zoom');
    const closer = node('button', '', '+');
    const farther = node('button', '', '−');
    const reset = node('button', 'gv-reset', '⌖');
    for (const [button, label] of [[closer, 'Приблизить'], [farther, 'Отдалить'], [reset, 'К маршруту']]) {
      button.setAttribute('aria-label', label);
      button.title = label;
    }
    for (const button of [globe, flat, closer, farther, reset]) button.type = 'button';
    zoom.append(closer, farther, reset);
    buttons.append(modesControl, zoom);
    hero.append(header, frame, buttons);
    const info = node('section', 'gv-info');
    this.replaceChildren(hero, info);
    let places = [];
    let lookupFailed = false;
    try { places = await loadCities(); } catch { lookupFailed = true; }
    if (signal.aborted) return;
    const resolve=plannedGeocodes?(label,role)=>{
      const source=/владелец/.test(role)?plannedGeocodes.owner:plannedGeocodes.offer;
      const point=(source||[]).find(p=>p.original_text===label||p.label===label);
      return point?.status==='resolved'&&Number.isFinite(point.lat)&&Number.isFinite(point.lon)?{lat:point.lat,lng:point.lon,approximate:point.precision==='city',precision:point.precision,confirmed:point.confirmed,queryScope:point.queryScope,provider:point.provider,sourceId:point.source_id}:null;
    }:placeIndex(places);
    const correction=(record,source)=>{
      const canChange=request.viewerRole==='owner'||request.viewerRole==='carrier'&&source!=='owner';
      if(!record?.id||!canChange)return null;
      const details=node('details','gv-geocode-edit'),form=node('form','gv-geocode-form');form.dataset.geoId=record.id;
      details.append(node('summary','','Уточнить геоточку'));form.append(node('small','','Исходный адрес сохраняется; уточнение и подтверждение записываются в аудит.'));
      if(record.candidates?.length){const select=node('select','');select.name='candidateId';select.setAttribute('aria-label','Выберите подтверждённый результат');select.append(new Option('Выберите подтверждённый результат',''));for(const c of record.candidates)select.append(new Option((c.label||c.candidateId)+(c.objectType?' · '+c.objectType:''),c.candidateId));form.append(select);}
      const query=node('input','');query.name='queryText';query.placeholder='Уточнение: страна, город, объект';query.maxLength=350;query.setAttribute('aria-label',query.placeholder);
      const reason=node('input','');reason.name='reason';reason.placeholder='Причина уточнения';reason.setAttribute('aria-label',reason.placeholder);reason.minLength=10;reason.maxLength=700;
      const label=node('label',''),check=node('input','');check.type='checkbox';check.name='confirmed';label.append(check,document.createTextNode(' Подтверждаю уточнение'));
      const save=node('button','','Сохранить уточнение');save.type='submit';const retry=node('button','','Повторить геокодирование');retry.type='button';retry.dataset.geoRetry=record.id;
      form.append(query,reason,label,save,retry);details.append(form);return details;
    };
    this.addEventListener('submit',async event=>{const form=event.target.closest('.gv-geocode-form');if(!form)return;event.preventDefault();const data=Object.fromEntries(new FormData(form));await updatePoint(form,{pointId:form.dataset.geoId,queryText:data.queryText,candidateId:data.candidateId,reason:data.reason,confirmed:data.confirmed==='on'});},{signal});
    this.addEventListener('click',async event=>{const button=event.target.closest('[data-geo-retry]');if(button){event.preventDefault();await updatePoint(button.closest('form'),{pointId:button.dataset.geoRetry});}},{signal});
    async function updatePoint(form,data){const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);let status=form.querySelector('[role="status"]');if(!status){status=node('p','');status.setAttribute('role','status');form.append(status);}status.textContent='Сохраняем…';try{const r=await fetch('/api/task2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'geocode_retry',order:request.orderCode,...data})});const result=await r.json();if(!r.ok)throw Error(result.error||'Ошибка геокодирования');status.textContent='Сохранено';window.dispatchEvent(new Event('map-geocodes-changed'));}catch(e){status.textContent=e.message;}finally{buttons.forEach(b=>b.disabled=false);}}
    const route = routeModel(request, offer, resolve);
    if(plannedGeocodes&&!plannedGeocodes.owner?.length&&['owner','carrier'].includes(request.viewerRole)){
      const button=node('button','','Определить координаты маршрута');button.type='button';button.addEventListener('click',async()=>{button.disabled=true;try{const r=await fetch('/api/task2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'geocode_route',order:request.orderCode})});const d=await r.json();if(!r.ok)throw Error(d.error);window.dispatchEvent(new Event('map-geocodes-changed'));}catch(e){button.textContent=e.message;button.disabled=false;}},{signal});info.append(button);
    }
    this.routeSnapshot=JSON.parse(JSON.stringify(route));
    this.dataset.coordinateSource=plannedGeocodes?'server':'city-preview';
    if (Array.isArray(tracking)) {
      const history = node('section', 'gv-tracking');
      history.append(node('h3', '', 'Сообщения о местонахождении груза'),node('p','','Еженедельный отчёт перевозчика, не GPS в реальном времени.'));
      const list = node('ol', 'gv-stops');
      for (const [index, entry] of tracking.entries()) {
        const latest = index === tracking.length - 1;
        const language=document.documentElement.lang.startsWith('zh')?'zh':document.documentElement.lang.startsWith('en')?'en':'ru';
        const label = (latest ? ({ru:'Последнее местонахождение груза · ',en:'Last reported cargo location · ',zh:'货物最后报告位置 · '})[language] : ({ru:'История · ',en:'History · ',zh:'历史 · '})[language]) + entry.location_text + ' · ' + String(entry.observed_at).slice(0, 10);
        const geo = entry.geocode;
        const located = geo?.status === 'resolved' && Number.isFinite(geo.lat) && Number.isFinite(geo.lon)
          && Math.abs(geo.lat) <= 90 && Math.abs(geo.lon) <= 180;
        const item=node('li','',label+(located?(geo.precision==='city'?' · Центр города, приблизительно':''):' · Нет координат'));const edit=correction({...geo,id:geo?.geoPointId},'tracking');if(edit)item.append(edit);list.append(item);
        if (located) route.markers.push({ lat: geo.lat, lng: geo.lon, label, number: latest ? '●' : '○', endpoint: latest,tracking:true,current:latest,observed_at:entry.observed_at,pointId:entry.id });
      }
      this.routeSnapshot=JSON.parse(JSON.stringify(route));this.dataset.trackingCount=String(tracking.length);this.dataset.latestObservedAt=tracking.at(-1)?.observed_at||'';
      history.append(list);
      info.append(history);
    }
    const mode = modes[route.mode];
    const activities = node('div', 'gv-activities');
    activities.append(node('h3', '', 'Маршрут перевозки'));
    const list = node('ol', 'gv-stops');
    for (const [index, stop] of route.stops.entries()) {
      const item = node('li', stop.position ? '' : 'gv-stop-unlocated');
      const detail = node('div', 'gv-stop-detail');
      const status = !stop.position ? 'Нет координат' : stop.position.approximate ? 'Центр города' : stop.position.precision==='facility'?'Объект':stop.position.precision==='address'?'Точный адрес':'Координаты';
      detail.append(node('strong', '', stop.label), node('small', '', stop.role));
      const source=/владелец/.test(stop.role)?'owner':'offer',record=plannedGeocodes?.[source]?.find(p=>p.label===stop.label),edit=correction(record,source);if(record?.clarification)detail.append(node('small','','Уточнение: '+record.clarification));if(edit)detail.append(edit);
      item.append(node('span', 'gv-stop-number', String(index + 1)), detail, node('span', 'gv-stop-status', status));
      list.append(item);
    }
    activities.append(list);
    if (route.deferred.length) {
      activities.append(node('h4', 'gv-unordered-title', 'Порядок не указан'));
      const unordered = node('ul', 'gv-unordered');
      for (const stop of route.deferred) {
        const status = stop.position ? 'на карте отдельно' : 'нет координат';
        unordered.append(node('li', '', stop.label + ' · ' + stop.role + ' · ' + status));
      }
      activities.append(unordered);
    }
    const summary = node('aside', 'gv-summary');
    const badge = node('span', 'gv-mode', icons[route.mode] + '  ' +
      (route.mode === 'unknown' && route.transport ? route.transport : mode.label));
    const located = [...route.stops, ...route.deferred].filter(stop => stop.position).length;
    const total = route.stops.length + route.deferred.length;
    summary.append(node('h3', '', 'Контроль перевозки'), badge,
      node('p', 'gv-coverage', located + ' / ' + total),
      node('p', 'gv-coverage-label', 'Пунктов с координатами'),
      node('p', 'gv-warning', 'На карте показана схема перевозки. Точная трасса и GPS-позиция не подтверждены.'));
    if (route.missingEndpoints) summary.append(node('p', 'gv-warning', 'Укажите адреса погрузки и доставки.'));
    if (located < total) summary.append(node('p', 'gv-warning', 'Для остальных пунктов нужны однозначные названия или координаты.'));
    if (route.mode === 'multi') summary.append(node('p', 'gv-warning', 'Вид транспорта на отдельных участках не указан.'));
    if (lookupFailed) summary.append(node('p', 'gv-warning', 'Справочник городов временно недоступен.'));
    const distancePanel = node('section', 'gv-distance');
    distancePanel.setAttribute('aria-live', 'polite');
    distancePanel.append(node('h3', '', 'Расстояние перевозки'), node('p', '', 'Рассчитываем расстояния…'));
    summary.append(distancePanel);
    if (Array.isArray(tracking)) {
      const km = value => {
        const number = typeof value === 'number' || (typeof value === 'string' && value.trim()) ? Number(value) : NaN;
        return Number.isFinite(number) && number >= 0 ? number.toLocaleString('ru-RU') + ' км' : 'не рассчитано';
      };
      distancePanel.replaceChildren(node('h3', '', 'Расстояние перевозки'),
        node('p', '', 'Общий километраж: ' + km(distance?.total)),
        node('p', '', 'Остаток на дату последнего сообщения: ' + km(distance?.remaining)));
    }
    else calculateMapDistances(route, { signal }).then(result => {
      if (signal.aborted) return;
      distancePanel.replaceChildren(node('h3', '', 'Расстояние перевозки'));
      const totalText = result.totalKm == null ? 'Общий километраж: нет точного расчёта' : 'Общий километраж: ' + result.totalKm.toLocaleString('ru-RU') + ' км' + (result.estimated ? ' (ориентировочно)' : '');
      distancePanel.append(node('p', 'gv-coverage-label', totalText));
      if (result.totalKm == null && result.knownKm > 0) distancePanel.append(node('p', '', 'Подтверждённые участки: ' + result.knownKm.toLocaleString('ru-RU') + ' км'));
      const legList = node('ol', 'gv-distance-legs');
      for (const leg of result.legs) {
        const label = leg.status === 'calculated' ? leg.km.toLocaleString('ru-RU') + ' км' + (leg.estimated ? ' (по центрам городов)' : '') : ({
          COORDINATES_MISSING: 'нет координат',
          EXACT_ADDRESS_REQUIRED: 'требуется точный адрес',
          LEG_MODES_REQUIRED: 'укажите транспорт каждого участка',
          NETWORK_ROUTER_REQUIRED: 'нет источника расчёта для этого транспорта',
          ROUTER_UNAVAILABLE: 'сервис маршрутизации недоступен'
        }[leg.reason] || 'расчёт недоступен');
        legList.append(node('li', '', leg.from + ' → ' + leg.to + ': ' + label));
      }
      distancePanel.append(legList, node('small', '', 'Автомобильные участки рассчитываются по дорожной сети. При координатах центра города километраж ориентировочный. Для других видов транспорта расстояние по прямой не подставляется.'));
    }).catch(() => { if (!signal.aborted) distancePanel.replaceChildren(node('h3', '', 'Расстояние перевозки'), node('p', '', 'Расчёт временно недоступен')); });
    if(Array.isArray(tracking)&&distance?.total==null){
      distancePanel.dataset.status='loading';
      calculateMapDistances(route,{signal}).then(result=>{if(signal.aborted)return;distancePanel.dataset.status=result.status;
        const value=result.totalKm??(result.knownKm>0?result.knownKm:null);
        distancePanel.append(node('p','',value==null?'Дорожная схема: не рассчитано':(result.totalKm==null?'Известные дорожные участки: ':'Дорожная схема: ')+value.toLocaleString('ru-RU')+' км (ориентировочно)'),node('small','','OSRM / OpenStreetMap · '+result.calculatedAt+' · Ориентировочная схема не подтверждает точный остаток и не запускает задачу ВЭД.'));
      }).catch(()=>{if(!signal.aborted){distancePanel.dataset.status='unavailable';distancePanel.append(node('p','','Дорожный сервис временно недоступен'));}});
    }
    info.append(activities, summary);

    const loading = {};
    let revision = 0;
    let fallback = false;
    const show = async name => {
      const current = ++revision;
      this.dataset.mode = name;
      for (const [key, stage] of Object.entries(stages)) stage.hidden = key !== name;
      globe.setAttribute('aria-pressed', String(name === '3d'));
      flat.setAttribute('aria-pressed', String(name === '2d'));
      for (const button of [closer, farther, reset]) button.disabled = !instances[name];
      message.hidden = !!instances[name] && !fallback;
      if (instances[name]) {
        instances[name].resize();
        if (fallback) message.textContent = '3D недоступен. Маршрут открыт на 2D-карте.';
        return;
      }
      message.textContent = 'Загружаем карту…';
      try {
        loading[name] ??= (async () => {
          const renderer = name === '3d'
            ? (await import('./globe.mjs?v=178e5ccacb5d')).createGlobe
            : (await import('./map.mjs?v=d6f76de05c08')).createMap;
          const instance = await renderer(stages[name], route, places);
          if (signal.aborted) instance.destroy();
          else instances[name] = instance;
        })();
        await loading[name];
        if (signal.aborted || current !== revision) return;
        instances[name].resize();
        message.hidden = !fallback;
        if (fallback) message.textContent = '3D недоступен. Маршрут открыт на 2D-карте.';
        for (const button of [closer, farther, reset]) button.disabled = false;
      } catch (error) {
        console.warn(`Global View ${name} initialization failed`, error);
        delete loading[name];
        if (signal.aborted || current !== revision) return;
        if (name === '3d') {
          fallback = true;
          await show('2d');
        } else {
          message.textContent = 'Не удалось загрузить географическую подложку. Нажмите «2D-карта», чтобы повторить.';
        }
      }
    };
    globe.onclick = () => { fallback = false; show('3d'); };
    flat.onclick = () => { fallback = false; show('2d'); };
    closer.onclick = () => instances[this.dataset.mode]?.zoom(1);
    farther.onclick = () => instances[this.dataset.mode]?.zoom(-1);
    reset.onclick = () => instances[this.dataset.mode]?.reset();
    show(previousMode);
  }
}
customElements.define('global-route-view', GlobalRouteView);
