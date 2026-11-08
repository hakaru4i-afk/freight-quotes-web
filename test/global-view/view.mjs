import { modes, placeIndex, routeModel } from './route-model.mjs';

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

  connectedCallback() { this.#mount(); }
  disconnectedCallback() { this.#cleanup?.(); }
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
    const [request, offer] = JSON.parse(this.dataset.route ?? '[{},null]');
    const header = node('div', 'gv-header');
    const title = node('strong', 'gv-title', 'Global View');
    const buttons = node('div', 'gv-controls');
    const globe = node('button', '', '3D-глобус');
    const flat = node('button', '', '2D-карта');
    const reset = node('button', '', 'К маршруту');
    for (const button of [globe, flat, reset]) button.type = 'button';
    buttons.append(globe, flat, reset);
    header.append(title, buttons);
    const frame = node('div', 'gv-frame');
    const stages = { '3d': node('div', 'gv-stage'), '2d': node('div', 'gv-stage') };
    stages['2d'].hidden = true;
    frame.append(stages['3d'], stages['2d']);
    const message = node('p', 'gv-message', 'Загружаем карту…');
    message.setAttribute('role', 'status');
    frame.append(message);
    const info = node('section', 'gv-info');
    this.replaceChildren(header, frame, info);
    let places = [];
    let lookupFailed = false;
    try { places = await loadCities(); } catch { lookupFailed = true; }
    if (signal.aborted) return;
    const route = routeModel(request, offer, placeIndex(places));
    const mode = modes[route.mode];
    const heading = node('h3', '', 'Маршрут перевозки');
    const badge = node('span', 'gv-mode', icons[route.mode] + '  ' +
      (route.mode === 'unknown' && route.transport ? route.transport : mode.label));
    const infoHeader = node('div', 'gv-info-header');
    infoHeader.append(heading, badge);
    const list = node('ol', 'gv-stops');
    for (const stop of route.stops) {
      const item = node('li', '');
      const precision = !stop.position ? ' · нет координат' : stop.position.approximate ? ' · центр города' : '';
      item.append(node('strong', '', stop.label), node('small', '', stop.role + precision));
      list.append(item);
    }
    const warning = node('p', 'gv-warning',
      'Пунктир показывает схему между пунктами. Точная трасса и GPS-позиция не подтверждены.');
    info.append(infoHeader, list, warning);
    if (route.missingEndpoints) info.append(node('p', 'gv-warning', 'Заполните адреса погрузки и доставки для полного маршрута.'));
    if (route.stops.some(stop => !stop.position)) {
      info.append(node('p', 'gv-warning', 'Часть пунктов не найдена. Для них нужны однозначные названия или координаты. Разрывы маршрута оставлены на карте.'));
    }
    if (route.mode === 'multi') info.append(node('p', 'gv-warning', 'Вид транспорта на отдельных участках не указан.'));
    if (route.deferred.length) {
      info.append(node('p', 'gv-warning', 'Пункты владельца без подтверждённого места в маршруте перевозчика: ' + route.deferred.join(' · ') + '.'));
    }
    if (lookupFailed) info.append(node('p', 'gv-warning', 'Справочник городов временно недоступен.'));

    const loading = {};
    let revision = 0;
    let fallback = false;
    const show = async name => {
      const current = ++revision;
      this.dataset.mode = name;
      for (const [key, stage] of Object.entries(stages)) stage.hidden = key !== name;
      globe.setAttribute('aria-pressed', String(name === '3d'));
      flat.setAttribute('aria-pressed', String(name === '2d'));
      reset.disabled = !instances[name];
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
            ? (await import('./globe.mjs')).createGlobe
            : (await import('./map.mjs')).createMap;
          const instance = await renderer(stages[name], route, places);
          if (signal.aborted) instance.destroy();
          else instances[name] = instance;
        })();
        await loading[name];
        if (signal.aborted || current !== revision) return;
        instances[name].resize();
        message.hidden = !fallback;
        if (fallback) message.textContent = '3D недоступен. Маршрут открыт на 2D-карте.';
        reset.disabled = false;
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
    reset.onclick = () => instances[this.dataset.mode]?.reset();
    show(previousMode);
  }
}
customElements.define('global-route-view', GlobalRouteView);
