// Canonical document mapping shared verbatim with the staging API. No sample legal defaults.
export const hasValue = value => value !== undefined && value !== null && String(value).trim() !== '';
export const EXTRA_FIELDS = [
  ['destinationStation','Станция назначения','Destination station','text'],
  ['eta','Ожидаемая доставка (ETA)','Estimated arrival (ETA)','date'],
  ['temperature','Температурный режим','Temperature requirements','text'],
  ['loadingMode','Особый способ погрузки / выгрузки','Special loading / unloading mode','text'],
  ['equipmentCount','Количество машин / контейнеров','Vehicle / container count','text'],
  ['dimensions','Габариты груза','Cargo dimensions','text'],
  ['customsApplicable','Таможенное оформление','Customs clearance','customs'],
  ['customsReason','Причина неприменимости таможни','Reason customs does not apply','text'],
  ['insuranceRequired','Требуется страхование','Insurance required','yesno'],
];
export const IMMUTABLE = ['applicationDate','origin','destination','waypoints','cargo','weight','volume','dimensions','incoterm','incotermPlace','transport','ready_date','freightScope','extras','schedule','etd','customerDetails','carrierDetails','contract','serviceTerms','paymentBasis','paymentTerms'];
const sourceKeys = {incotermPlace:'incoterm_place', dangerousGoods:'dangerous_goods',dangerousDetails:'dangerous_details',loadingContact:'sender_contact'};
export function hydrateTransportApplication({item={}, order={}, company={}, carrier={}, template={}, defaults={}, details=item.booking?.details||{}, patch={}, etd={}}={}) {
  const values={}, sources={}, locked=[];
  function merge(data,source,overwrite=false) { for(const [key,value] of Object.entries(data||{})) if(hasValue(value)&&(overwrite||!hasValue(values[key]))) {values[key]=value;sources[key]=source;} }
  merge(details,'document');
  // Blank patches are omissions, not deletion commands. Existing legacy keys survive.
  merge(patch,'carrier',true);
  merge(defaults,'order');
  const bid=item.selected_offer?.bid||{};
  const orderValues={...order};
  for(const key of ['origin','destination','waypoints','cargo','weight','volume','dimensions','ready_date','incoterm','incotermPlace','dangerousGoods','dangerousDetails','loadingContact']) {
    const value=order[sourceKeys[key]||key]??item[key]; if(hasValue(value)) orderValues[key]=value;
  }
  merge(orderValues,'order');
  merge({customerDetails:company.legalDetails,consignee:company.consignee,deliveryContact:company.deliveryContact,contract:company.contract},'company');
  merge({carrierDetails:carrier.legalDetails},'carrier-profile');
  merge(template,'approved-template');
  const confirmed={...orderValues};
  for(const key of ['origin','destination','waypoints']) if(hasValue(bid[key])) confirmed[key]=bid[key];
  Object.assign(confirmed,{transport:bid.mode||item.transport,schedule:bid.pickup,etd:etd.date,freightScope:bid.includes,extras:bid.extras});
  for(const key of ['contract','serviceTerms','paymentBasis','paymentTerms']) if(hasValue(template[key])) confirmed[key]=template[key];
  if(hasValue(company.legalDetails)) confirmed.customerDetails=company.legalDetails;
  if(hasValue(carrier.legalDetails)) confirmed.carrierDetails=carrier.legalDetails;
  confirmed.applicationDate=details.applicationDate||String(item.booking?.taken_at||'').slice(0,10)||defaults.applicationDate;
  for(const key of IMMUTABLE) if(hasValue(confirmed[key])) {
    values[key]=confirmed[key]; locked.push(key);
    sources[key]=key==='applicationDate'?'server':hasValue(template[key])?'approved-template':hasValue(bid[key])||['schedule','etd','freightScope','extras'].includes(key)?'winning-offer':key==='carrierDetails'?'carrier-profile':key==='customerDetails'?'company':'order';
  }
  for(const [target,key] of Object.entries({customsShipper:'shipper',customsConsignee:'consignee',exportContact:'loadingContact',importContact:'deliveryContact'})) if(!hasValue(values[target])&&hasValue(values[key])) {values[target]=values[key];sources[target]=sources[key];}
  if(!hasValue(values.dangerousGoods)) values.dangerousGoods=bid.dangerous_goods||'unknown';
  if(!hasValue(values.insurance)&&hasValue(bid.insurance)) {values.insurance=bid.insurance;sources.insurance='winning-offer';}
  if(!hasValue(values.dangerousDetails)) values.dangerousDetails=bid.dangerous_details||'';
  if(!hasValue(values.customsApplicable)) values.customsApplicable=hasValue(values.exportCustoms)||hasValue(values.importCustoms)?'yes':'unknown';
  if(!hasValue(values.insuranceRequired)) values.insuranceRequired=['CIP','CIF'].includes(values.incoterm)?'yes':'no';
  const amount=item.selected_offer?.bid?.amount, currency=item.selected_offer?.bid?.currency;
  return {values,sources,locked,amount:hasValue(amount)?amount:item.booking?.amount,currency:hasValue(currency)?currency:item.booking?.currency,requestNumber:item.booking?.request_number||'',orderCode:item.order_code||'',bitrix:item.bitrix_tasks||item.bitrix_task||order.bitrix_task||'',layout:documentMode(values)==='rail'?'BEA47':'BDX99'};
}
export function documentMode(d) {return /ж[\s/.-]*д|желез|rail/i.test(d.transport||'')?'rail':/мульт|multi/i.test(d.transport||'')?'multi':/авто|road/i.test(d.transport||'')?'road':'other';}
export function requiredDocumentKeys(d) {
  const keys=['applicationDate','contract','customerDetails','carrierDetails','origin','destination','incoterm','incotermPlace','cargo','weight','transport','shipper','consignee','loadingContact','deliveryContact','schedule','dangerousGoods'];
  if(['rail','multi'].includes(documentMode(d))) keys.push('departureStation','destinationStation','vehicleType');
  if(d.customsApplicable==='yes') keys.push('exportCustoms','importCustoms');
  if(d.customsApplicable==='no') keys.push('customsReason');
  if(d.dangerousGoods==='yes') keys.push('dangerousDetails');
  if(d.insuranceRequired==='yes'||['CIP','CIF'].includes(d.incoterm)) keys.push('insurance','invoiceAmount','invoiceCurrency');
  if(d.temperatureRequired==='yes') keys.push('temperature');
  return [...new Set(keys)];
}
export function validateTransportApplication(d) {
  const errors=requiredDocumentKeys(d).filter(k=>!hasValue(d[k]));
  if(d.dangerousGoods==='unknown') errors.push('dangerousGoods');
  if((d.insuranceRequired==='yes'||['CIP','CIF'].includes(d.incoterm))&&/^(no|нет|не включено|not included)$/i.test(String(d.insurance||'').trim())) errors.push('insurance');
  for(const key of ['weight','volume','invoiceAmount','totalKm']) if(hasValue(d[key])&&(!Number.isFinite(Number(String(d[key]).replace(',','.')))||Number(String(d[key]).replace(',','.'))<=0)) errors.push(key);
  for(const key of ['applicationDate','ready_date','etd','eta']) if(hasValue(d[key])&&(!/^\d{4}-\d{2}-\d{2}$/.test(d[key])||!Number.isFinite(Date.parse(d[key]))||new Date(d[key]).toISOString().slice(0,10)!==d[key])) errors.push(key);
  if(d.etd&&d.ready_date&&d.etd<d.ready_date) errors.push('etd');
  if(d.containerNumber&&!/^[A-Z]{4}\d{7}$/.test(String(d.containerNumber).toUpperCase())) errors.push('containerNumber');
  if(d.customsApplicable&&!['unknown','yes','no'].includes(d.customsApplicable)) errors.push('customsApplicable');
  if(['FAS','FOB','CFR','CIF'].includes(d.incoterm)&&!['Море','Мультимодальная'].includes(d.transport)) errors.push('incoterm');
  if(d.transport==='Мультимодальная'&&d.containerized==='yes'&&!['yes','no'].includes(d.seaLeg)) errors.push('seaLeg');
  return [...new Set(errors)];
}
export function documentFieldPlan(model, current=model.values) {
  const required=requiredDocumentKeys(current), locked=new Set(model.locked);
  const inherited=k=>hasValue(model.values[k])&&model.sources[k]!=='document'&&model.sources[k]!=='carrier';
  const main=required.filter(k=>!locked.has(k)&&(!inherited(k)||!hasValue(current[k])));
  for(const key of ['schedule','etd','vehicleType','vehicleNumber',...(['rail','multi'].includes(documentMode(current))||current.containerized==='yes'?['containerNumber']:[]),'customsApplicable','trackingInstructions']) if(!locked.has(key)&&!inherited(key)&&!main.includes(key)) main.push(key);
  const suppressed=['customsShipper','customsConsignee','exportContact','importContact','serviceTerms','paymentTerms','paymentBasis'];
  return {main,required,locked:[...locked],suppressed};
}
