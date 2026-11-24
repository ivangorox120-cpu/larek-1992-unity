import { createWorld, QUALITY, resolveQualityPreset } from './world.js';
import { createAudio } from './audio.js';
import { createControls } from './controls.js';

(() => {
'use strict';

// ============================================================
//  Утилиты
// ============================================================
const $ = s => document.querySelector(s);
const R = (a, b) => a + Math.random() * (b - a);
const RI = (a, b) => Math.floor(R(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = n => Math.round(n).toLocaleString('ru-RU');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function wpick(obj) {
  let tot = 0; for (const k in obj) tot += obj[k];
  let r = Math.random() * tot;
  for (const k in obj) { r -= obj[k]; if (r <= 0) return k; }
  return Object.keys(obj)[0];
}
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONTHS_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const yearOf = d => 1992 + Math.floor((d - 1) / 12);
const monthOf = d => (d - 1) % 12;
const dateStr = d => MONTHS[monthOf(d)] + ' ' + yearOf(d);
const LAST_STORY_DAY = 24;

// ============================================================
//  Данные
// ============================================================
// base — оптовая цена в рублях на январь 1992 (индекс цен = 1)
const GOODS = {
  gum:   { name:'Жвачка «Турбина»',       short:'Турбина',   icon:'🍬', base:12 },
  paper: { name:'Газета «Правда» / «Известия»', short:'Газета', icon:'📰', base:3 },
  soda:  { name:'Лимонад «Буратинка»',    short:'Лимонад',   icon:'🥤', base:8, cold:true },
  choc:  { name:'Батончик «Сникерсон»',   short:'Сникерсон', icon:'🍫', base:45 },
  cig:   { name:'Сигареты «Космонавт»',   short:'Космонавт', icon:'🚬', base:14 },
  beer:  { name:'Пиво «Заводское»',       short:'Пиво',      icon:'🍺', base:16, cold:true },
  batt:  { name:'Батарейки «Энерджи»',    short:'Батарейки', icon:'🔋', base:28 },
  vodka: { name:'Спирт «Король»',         short:'«Король»',  icon:'🍾', base:190 },
  tape:  { name:'Кассета «Хиты-92»',      short:'Кассета',   icon:'📼', base:130 },
  toy:   { name:'Электронная игра «Тетрис»', short:'Тетрис', icon:'🎮', base:900, from:13 },
  tushonka:{ name:'Тушёнка «Говядина»',    short:'Тушёнка',   icon:'🥫', base:42 },
  kilka: { name:'Килька в томате',        short:'Килька',    icon:'🐟', base:9 },
  bread: { name:'Хлеб «Дарницкий»',       short:'Хлеб',      icon:'🍞', base:4 },
  mag:   { name:'Журнал «Mode International»', short:'Журнал мод', icon:'📖', base:140, euro:true },
  mag2:  { name:'Журнал «Auto Welt»',     short:'Auto Welt', icon:'📘', base:160, euro:true },
};
// товары «из-под полы»: в обычном ассортименте и на витрине их нет, хранятся отдельно
const HIDDEN = {
  samogon: { name:'Самогон первач (бутылка)', short:'Самогон', base:45 },
  kontra:  { name:'Сигареты контрабандные (блок)', short:'Контрабанда', base:420 },
  royal:   { name:'Спирт «Royal» 96° (1 л)', short:'«Royal»', base:230 },
  anabol:  { name:'Анаболики «Метан» (уп.)', short:'Анаболики', base:280 },
  vhs:     { name:'Кассета VHS без обложки', short:'Пират. VHS', base:320 },
};
const hiddenPrice = id => Math.round(HIDDEN[id].base * S.idx);
const GOOD_IDS = Object.keys(GOODS);
// Сезонный спрос по месяцам (1 игровой день = 1 месяц): что берут чаще и охотнее платят
const SEASON_DEMAND = [
  { vodka: 1.8, cig: 1.3, choc: 1.4, toy: 1.6, batt: 1.3, tushonka: 1.5, soda: .5, beer: .6 },   // январь: праздники, мороз
  { vodka: 1.5, cig: 1.3, tushonka: 1.5, batt: 1.4, soda: .5, beer: .6, choc: 1.3 },              // февраль: 23 февраля, мороз
  { choc: 1.8, gum: 1.2, mag: 1.6, soda: .7, beer: .8, tushonka: 1.2 },                          // март: 8 марта
  { soda: 1.0, beer: 1.0, paper: 1.2, batt: 1.1 },                                              // апрель
  { beer: 1.4, soda: 1.4, cig: 1.1, tushonka: 1.3 },                                            // май: шашлыки, дачи
  { soda: 2.0, beer: 1.8, gum: 1.3, tushonka: .8, vodka: .8 },                                  // июнь: жара
  { soda: 2.2, beer: 2.0, gum: 1.3, kilka: 1.2, vodka: .8, tushonka: .8 },                      // июль
  { soda: 1.9, beer: 1.8, tape: 1.3, tushonka: 1.3 },                                           // август: дачи, консервация
  { gum: 1.6, paper: 1.3, batt: 1.3, tape: 1.2, choc: 1.2 },                                    // сентябрь: школа
  { vodka: 1.2, cig: 1.2, tushonka: 1.3, batt: 1.3, soda: .8 },                                 // октябрь
  { vodka: 1.4, cig: 1.3, batt: 1.5, tushonka: 1.4, soda: .6, beer: .7 },                       // ноябрь: темно, холодно
  { vodka: 2.0, choc: 1.8, toy: 2.2, tape: 1.6, soda: .8, beer: .9 },                           // декабрь: Новый год
];
const seasonK = id => (S ? (SEASON_DEMAND[monthOf(S.day)] || {})[id] : 1) || 1;
const isSummer = () => { const m = monthOf(S.day); return m >= 5 && m <= 7; };
const SHELF_LIFE = { bread: 1, paper: 1 }; // дней до порчи: хлеб черствеет, газета устаревает
const goodAvail = id => !GOODS[id].from || S.day >= GOODS[id].from;

const TYPES = {
  babka:   { name:'Бабушка',        wants:{paper:4, soda:2, choc:2, batt:1, bread:5, kilka:3, tushonka:2}, tol:.18, qty:[1,1], pat:9,  w:3 },
  school:  { name:'Школьник',       wants:{gum:5, soda:3, choc:3, toy:3},    tol:.35, qty:[1,3], pat:7,  w:3, young:true },
  worker:  { name:'Рабочий',        wants:{beer:4, cig:4, paper:1, batt:1, tushonka:3, kilka:2, bread:2},  tol:.45, qty:[1,3], pat:8,  w:4 },
  student: { name:'Студент',        wants:{tape:3, beer:2, gum:1, batt:2, mag2:2, mag:1},   tol:.40, qty:[1,2], pat:8,  w:2, young:true },
  chelnok: { name:'Челнок',         wants:{cig:3, gum:2, batt:2, vodka:2},   tol:.15, qty:[4,8], pat:10, w:1.2 },
  newrus:  { name:'«Новый русский»',wants:{vodka:3, tape:2, cig:2, choc:1, toy:2, mag:2, mag2:2}, tol:1.4, qty:[2,5], pat:6, w:.6 },
};

const OUTFITS = {
  none:     { name:'Старая куртка', usd:0,   icon:'🧥', desc:'Ничего особенного.' },
  sport:    { name:'Спортивный костюм и кепка', usd:15, icon:'🎽', desc:'Свой в районе: закупка −5%, «крыша» просит меньше.' },
  varenki:  { name:'Варёнки и кожанка', usd:30,  icon:'👖', desc:'Молодёжь платит охотнее (+15% к терпимости цены).' },
  raspberry:{ name:'Малиновый пиджак и цепь', usd:120, icon:'🥻', desc:'«Новые русские» ходят вдвое чаще и платят щедрее. Милиция просит больше.' },
  business: { name:'Деловой костюм', usd:90,  icon:'👔', desc:'Милиция заходит реже, проверки мягче.', from:13 },
};

const CLOTH_ITEMS = {
  head_beanie:    { id: 'head_beanie',    slot: 'head', slotLbl: 'голова', icon: '🧶', name: 'Шапка «Петушок»',         desc: 'Тёплая вязаная шапка.',                 outfitSet: 'none' },
  head_kepka:     { id: 'head_kepka',     slot: 'head', slotLbl: 'голова', icon: '🧢', name: 'Кепка-восьмиклинка',      desc: 'Пацанская кепка: свои узнают.',         outfitSet: 'sport' },
  head_ushanka:   { id: 'head_ushanka',   slot: 'head', slotLbl: 'голова', icon: '🪖', name: 'Меховая ушанка',          desc: 'Солидная зимняя шапка.',                outfitSet: 'business' },
  top_kurtka:     { id: 'top_kurtka',     slot: 'top',  slotLbl: 'торс',   icon: '🧥', name: 'Старая куртка',           desc: 'Стёганая зимняя куртка на молнии.',     outfitSet: 'none' },
  top_sport:      { id: 'top_sport',      slot: 'top',  slotLbl: 'торс',   icon: '🎽', name: 'Олимпийка «Адибас»',      desc: 'Свой в районе: закупка −5%.',           outfitSet: 'sport' },
  top_varenki:    { id: 'top_varenki',    slot: 'top',  slotLbl: 'торс',   icon: '🧥', name: 'Турецкая кожанка',        desc: 'Молодёжь платит охотнее (+15%).',       outfitSet: 'varenki' },
  top_raspberry:  { id: 'top_raspberry',  slot: 'top',  slotLbl: 'торс',   icon: '🥻', name: 'Малиновый пиджак',        desc: '«Новые русские» ходят вдвое чаще.',     outfitSet: 'raspberry' },
  top_business:   { id: 'top_business',   slot: 'top',  slotLbl: 'торс',   icon: '👔', name: 'Деловой пиджак',          desc: 'Милиция заходит реже, проверки мягче.', outfitSet: 'business' },
  legs_watnik:    { id: 'legs_watnik',    slot: 'legs', slotLbl: 'штаны',  icon: '👖', name: 'Тёмные зимние штаны',     desc: 'Простые тёплые брюки.',                 outfitSet: 'none' },
  legs_sport:     { id: 'legs_sport',     slot: 'legs', slotLbl: 'штаны',  icon: '🩳', name: 'Синие треники с полоской',desc: 'Спортивные штаны с лампасами.',         outfitSet: 'sport' },
  legs_varenki:   { id: 'legs_varenki',   slot: 'legs', slotLbl: 'штаны',  icon: '👖', name: 'Джинсы-варёнки «Мальвина»',desc: 'Модные варёные джинсы 1992 г.',        outfitSet: 'varenki' },
  legs_slacks:    { id: 'legs_slacks',    slot: 'legs', slotLbl: 'штаны',  icon: '👖', name: 'Чёрные брюки-слаксы',     desc: 'Широкие коммерческие слаксы.',          outfitSet: 'raspberry' },
  legs_business:  { id: 'legs_business',  slot: 'legs', slotLbl: 'штаны',  icon: '👖', name: 'Брюки со стрелками',      desc: 'Строгие костюмные брюки.',              outfitSet: 'business' },
  feet_boots:     { id: 'feet_boots',     slot: 'feet', slotLbl: 'обувь',  icon: '🥾', name: 'Зимние ботинки',          desc: 'Крепкие ботинки на толстой подошве.',   outfitSet: 'none' },
  feet_sneakers:  { id: 'feet_sneakers',  slot: 'feet', slotLbl: 'обувь',  icon: '👟', name: 'Кроссовки «Ромика»',      desc: 'Белые спортивные кроссовки.',           outfitSet: 'sport' },
  feet_kazaki:    { id: 'feet_kazaki',    slot: 'feet', slotLbl: 'обувь',  icon: '👞', name: 'Туфли «Саламандра»',      desc: 'Импортные кожаные туфли.',              outfitSet: 'varenki' },
};
const OUTFIT_TO_CLOTH = {
  none:      ['head_beanie', 'top_kurtka', 'legs_watnik', 'feet_boots'],
  sport:     ['head_kepka', 'top_sport', 'legs_sport', 'feet_sneakers'],
  varenki:   ['top_varenki', 'legs_varenki', 'feet_kazaki'],
  raspberry: ['top_raspberry', 'legs_slacks'],
  business:  ['head_ushanka', 'top_business', 'legs_business', 'feet_kazaki'],
};


const UPGRADES = {
  fridge:   { name:'Холодильник «ЗИЛ-Москва»', usd:40,  icon:'🧊', where:'Заказ по телефону в «Посылторге» (4-19-92)', desc:'3D-холодильник в ларьке: холодные лимонад, пиво и тушёнка продаются дороже и не портятся.' },
  sharp:    { name:'Двухкассетник «Sharp WF-939»', usd:35, icon:'📼', where:'Заказ по телефону в «Посылторге» (4-19-92)', desc:'3D-магнитофон на полке: перезапись кассет «Кино» и «Сектор Газа» с тройной выгодой!' },
  tv:       { name:'Телевизор «Рубин» + видик VHS', usd:55, icon:'📺', where:'Заказ по телефону в «Посылторге» (4-19-92)', desc:'3D-телевизор с видеомагнитофоном в ларьке: просмотр фильмов качает Интеллект и привлекает клиентов (+15%).' },
  shutters: { name:'Стальные решётки-ставни', usd:30, icon:'🔒', where:'Покупается у Марата за гаражами', desc:'Стальная решётка на витрине ларька: полностью защищает ларёк от ночного взлома и налётчиков.' },
  sign:     { name:'Неоновая вывеска',     usd:60,  icon:'💡', where:'Заказ по телефону в «Посылторге» (4-19-92)', desc:'+25% покупателей.' },
  pavilion: { name:'Павильон',             usd:500, icon:'🏬', where:'Заказ по телефону в «Посылторге» (4-19-92)', desc:'9 мест на витрине, склад 160, +20% покупателей.', from:13 },
};

const CARD_NAMES = ['Ламборджа','Феррано','Порше-911','Мерсо','БэМэВэ','Ауди-кватро','Тойота-Супра','Ниссан-Скай','Феррано F40','Додж-Вайпер',
  'Корветто','Мустанго','Ягуарро','Бентлей','Лотос','Альфа-Ромашка','Матра','Делорейн','Кадиллак-89','Шевроле-Камаро','Хонда-НСХ','Мазда-RX','Ситроен-СМ','Сааб-900'];

// ============================================================
//  Звук
// ============================================================
let actx = null;
function au() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(f, d, type = 'square', v = .08, slide = 0, delay = 0) {
  if (S && S.mute) return;
  const a = au(); if (!a) return;
  const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + .02);
}
const sfx = {
  ching() { tone(1320, .08, 'square', .06); tone(1760, .25, 'triangle', .07, 0, .07); },
  click() { tone(600, .04, 'square', .04); },
  bad()   { tone(220, .22, 'sawtooth', .06, -90); },
  door()  { tone(880, .1, 'sine', .05); tone(660, .15, 'sine', .05, 0, .1); },
  coin()  { tone(980, .06, 'square', .05); tone(1470, .1, 'square', .04, 0, .05); },
  tv() {
    if (S && S.mute) return; const a = au(); if (!a) return;
    const len = a.sampleRate * .35, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) * .25;
    const s = a.createBufferSource(); s.buffer = buf; s.connect(a.destination); s.start();
  },
  fanfare() { [523, 659, 784, 1046].forEach((f, i) => tone(f, .25, 'square', .05, 0, i * .12)); },
};

// ============================================================
//  Состояние
// ============================================================
const SAVE_KEY = 'larek-save-v1';
let S = null;      // сохраняемое состояние
let T = null;      // торговый день (не сохраняется)
let tab = 'hero';

function newGame(name, sex) {
  S = {
    v:1, name, sex, day:1, phase:'morning', money:5000, usd:0, debt:2500, debtNextCheckDay:7, alarmHour:7, alarmOn:true,
    idx:1, rate:110, rateHist:[110], prices:{}, prevPrices:{}, vprices:{}, stock:{}, slots:[null,null,null,null,null,null],
    markup:.4, rep:{street:0, law:0, folk:0}, sk:{trade:0, charm:0, sense:0}, sp:0, xp:0, lvl:0,
    outfit:'none', owned:['none'], up:{}, permit:false, seller:false, src:'market',
    wave:null, nextWaveDay:4, voucher:null, fundGone:false, pmp:0, pmpCrashDay:RI(18,21), pmpDead:false,
    cheap:0, fakeLoss:0, cards:[], gumBought:0, lastSeen:Date.now(), mute:false, free:false, ending:null,
    totalProfit:0, inflLast:0, flags:{}, gun:false, gunState:'wall', ammo:2, shells:0,
    order:{ lines:{}, hidden:{} }, deliveries:[], items:[], hidden:{}, butts:0, cigs:0, bottle:null,
  };
  genPrices();
  // наследство дяди: часть товара уже стоит поштучно на полках, а рядом лежат оптовые блоки/упаковки для распаковки
  addStock('gum', 6, S.prices.gum); addStock('soda', 5, S.prices.soda);
  addStock('paper', 5, S.prices.paper); addStock('cig', 5, S.prices.cig);
  S.slots = [null,null,null,null,null,null];
  S.slotCounts = [0,0,0,0,0,0];
  S.shelfPlacements = [];
  S.items = [
    { id: 'pk_start_cig',  kind: 'pack', x: -.82, y: 1.213, z: -1.03, ry: 0,           data: { goodId: 'cig',  count: 5, maxCount: 5, unitCost: S.prices.cig,  opened: false } },
    { id: 'pk_start_beer', kind: 'pack', x: -.24, y: 1.213, z: -1.03, ry: 0,           data: { goodId: 'beer', count: 5, maxCount: 5, unitCost: S.prices.beer, opened: false } },
    { id: 'pk_start_gum',  kind: 'pack', x: -1.33, y: .863, z: -.22,  ry: Math.PI / 2, data: { goodId: 'gum',  count: 5, maxCount: 5, unitCost: S.prices.gum,  opened: false } },
  ];
  ensureState();
}
function save() {
  if (!S) return;
  S.lastSeen = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.v === 1) return s; } catch (e) {}
  return null;
}

// значения по умолчанию для новых полей (и для старых сохранений)
function ensureState() {
  if (!S) return;
  S.flags = S.flags || {}; S.moves = S.moves || {}; S.visited = S.visited || {}; S.marks = S.marks || []; S.hasMap = true;
  if (S.hunger == null) S.hunger = 80;
  if (S.debt > 0 && S.debt <= 120 && !S.flags.debtUpgraded2500) { S.debt = 2500; S.flags.debtUpgraded2500 = true; }
  if (S.debtNextCheckDay == null) S.debtNextCheckDay = Math.max(7, (Math.floor((S.day || 1) / 7) + 1) * 7);
  if (S.alarmHour == null) S.alarmHour = 7;
  if (S.alarmMinute == null) S.alarmMinute = 0;
  if (S.alarmOn == null) S.alarmOn = true;
  S.free = true; // Философия бесконечного геймплея без финальных титров
  S.seller = false; // найма продавца больше нет: ларёк держится на самом герое
  S.regs = S.regs || {}; S.fresh = S.fresh || {};
  if (!S.flags.prisonCombatTrained) S.moves = { kick: true };
  else S.moves.kick = true;
  S.cassettes = S.cassettes || { may: true, vysotsky: true, carman: false };
  if (S.activeCassette === undefined) S.activeCassette = 'may';
  if (S.tapeChewed == null) S.tapeChewed = false;
  S.blackMarket = S.blackMarket || { dilutedStock: 0, relabeledVodka: 0, giftSets: 0, angryBuyerPending: false };
  S.visited.kiosk = true; S.visited.home = true;
  if (S.stashMoney) { S.money += S.stashMoney; S.stashMoney = 0; } if (S.stashUsd) { S.usd += S.stashUsd; S.stashUsd = 0; }
  if (S.stashHidden) { S.hidden = S.hidden || {}; for (const k of Object.keys(S.stashHidden)) { S.hidden[k] = (S.hidden[k] || 0) + (S.stashHidden[k] || 0); } S.stashHidden = null; }
  S.owned = S.owned || ['none'];
  S.clothOwned = S.clothOwned || ['head_beanie', 'top_kurtka', 'legs_watnik', 'feet_boots', 'head_kepka', 'legs_sport', 'feet_sneakers'];
  for (const ok of S.owned) {
    for (const cid of (OUTFIT_TO_CLOTH[ok] || [])) {
      if (!S.clothOwned.includes(cid)) S.clothOwned.push(cid);
    }
  }
  if (!S.equipped) {
    const o = S.outfit || 'none';
    S.equipped = {
      head: o === 'sport' ? 'head_kepka' : o === 'business' ? 'head_ushanka' : 'head_beanie',
      top:  o === 'sport' ? 'top_sport' : o === 'varenki' ? 'top_varenki' : o === 'raspberry' ? 'top_raspberry' : o === 'business' ? 'top_business' : 'top_kurtka',
      legs: o === 'sport' ? 'legs_sport' : o === 'varenki' ? 'legs_varenki' : o === 'raspberry' ? 'legs_slacks' : o === 'business' ? 'legs_business' : 'legs_watnik',
      feet: o === 'sport' ? 'feet_sneakers' : (o === 'varenki' || o === 'business') ? 'feet_kazaki' : 'feet_boots',
    };
  }
  const topCloth = S.equipped.top && CLOTH_ITEMS[S.equipped.top];
  const legsCloth = S.equipped.legs && CLOTH_ITEMS[S.equipped.legs];
  S.outfit = (topCloth && topCloth.outfitSet) || (legsCloth && legsCloth.outfitSet) || 'none';
  if (typeof window !== 'undefined') window.__larekEquipped = S.equipped;
  S.invGrid = Array.isArray(S.invGrid) ? S.invGrid : new Array(20).fill(null);
  while (S.invGrid.length < 20) S.invGrid.push(null);
  S.pockets = Array.isArray(S.pockets) ? S.pockets : [];
  if (!S.flags.aptKeyGiven) {
    S.flags.aptKeyGiven = true;
    if (!S.pockets.some(p => p && p.goodId === 'aptkey')) {
      S.pockets.push({ uid: 'pk_aptkey_init', kind: 'good', goodId: 'aptkey', count: 1 });
    }
  }
}
const ADMIN_CODE = 'larek1992';
// точки телепорта в админ-панели: [ключ, подпись, x, z, поворот взгляда]
const TP_POINTS = [['kiosk', 'Ларёк', 0, -.4, Math.PI], ['school', 'Школа № 3', -62, 39.6, Math.PI], ['sizo', 'СИЗО', 58.6, 90.5, Math.PI / 2], ['home', 'Дом героя', 42, 71.2, Math.PI],
  ['meat', 'Завод (мясокомбинат)', 211, -1.4, 0], ['police', 'Участок милиции', -44, 63.4, Math.PI], ['bakery', 'Хлебозавод', 164.6, 48, -Math.PI / 2], ['lvz', 'ЛВЗ', 93.6, 36, -Math.PI / 2],
  ['garages', 'Гаражи', 36, 2.6, 0]];
// места города: [ключ, подпись, x, z, радиус «побывал»]
const POIS = [['kiosk', 'Ларёк', 0, 0, 6], ['home', 'Комната у бабы Зины (Советская, 14)', 42, 76, 8], ['garages', 'ГСК «Советский» · Марат (7:00–8:30)', 26, -16, 13], ['yard', 'Детская площадка', -23, -8, 8],
  ['meat', 'Мясокомбинат · проходная', 211, -7, 11], ['bakery', 'Хлебозавод · магазин', 160, 48, 9], ['lvz', 'Ликёро-водочный · сбыт', 98, 36, 9], ['police', 'Участок милиции', -46, 66, 9], ['rovd', 'Заводской РОВД · ИВС', -130, 88, 11], ['sizo', 'СИЗО № 1', -130, 106, 9]];
const mapXY = (x, z) => [(30 + (z + 75) * 3.32) / 1024 * 100, (110 + (250 - x) * 3.32) / 1627 * 100]; // мир → проценты картинки схемы
function trackVisits() {
  if (!S || !W) return; const P = W.P;
  for (const [k, n, x, z, r] of POIS) if (!S.visited[k] && Math.hypot(P.x - x, P.z - z) < r) { S.visited[k] = true; if (S.hasMap) toast(`Отметили на карте: ${n}`, 'good'); }
}
function openMap() {
  if (!S) return;
  if (!S.hasMap) { S.hasMap = true; }
  const draw = box => {
    const P = W ? W.P : { x: 0, z: 0 }, [px, py] = mapXY(P.x, P.z);
    const pin = (x, z, html, title) => { const [a, b] = mapXY(x, z); return `<div title="${esc(title || '')}" style="position:absolute;left:${a}%;top:${b}%;transform:translate(-50%,-50%);pointer-events:none">${html}</div>`; };
    const seen = POIS.filter(p => S.visited[p[0]]);
    box.querySelector('#mapWrap').innerHTML = `<img src="assets/tex/city_map_1992.jpg" style="display:block;width:100%;height:auto;user-select:none" draggable="false">
      ${seen.map(p => pin(p[2], p[3], `<div style="width:18px;height:18px;border-radius:50%;border:3px solid #c0201a;box-shadow:0 0 0 1px #fff8;background:#c0201a33"></div>`, p[1])).join('')}
      ${S.marks.map((m, i) => pin(m[0], m[1], `<div style="color:#1b2f9a;font:900 20px/1 Arial;text-shadow:0 0 2px #fff">✕</div>`)).join('')}
      ${px >= 2 && px <= 98 && py >= 10 && py <= 77 ? `<div style="position:absolute;left:${px}%;top:${py}%;transform:translate(-50%,-50%);width:10px;height:10px;border-radius:50%;background:#1b6fd8;border:2px solid #fff;pointer-events:none"></div>` : ''}`;
    box.querySelector('#mapList').innerHTML = `<b>Обведено красным (вы там были):</b> ${seen.map(p => esc(p[1])).join(' · ') || '—'}<br><span class="muted">Синий крестик — ваша пометка: коснитесь карты, чтобы поставить, коснитесь крестика — стереть. Синяя точка — где вы сейчас.</span>`;
  };
  queueCard({ title: '🗺 Схема Краснозаводска', wide: true,
    html: `<div id="mapWrap" style="position:relative;border:1px solid var(--line2);touch-action:manipulation;cursor:crosshair"></div><p id="mapList" style="font-size:12px"></p>`,
    onShow(box) { draw(box);
      box.querySelector('#mapWrap').onclick = e => { const r = e.currentTarget.getBoundingClientRect(), u = (e.clientX - r.left) / r.width * 1024, v = (e.clientY - r.top) / r.height * 1627;
        if (u < 30 || u > 994 || v < 110 || v > 1537) return; const z = (u - 30) / 3.32 - 75, x = 250 - (v - 110) / 3.32;
        const near = S.marks.findIndex(m => Math.hypot(m[0] - x, m[1] - z) < 7); if (near >= 0) S.marks.splice(near, 1); else if (S.marks.length < 24) S.marks.push([Math.round(x), Math.round(z)]);
        sfx.click(); save(); draw(box); }; },
    buttons: [{ label: 'Сложить карту' }] });
}
function takeMap() { if (!S) return; if (!S.hasMap) { S.hasMap = true; save(); sfx.ching(); toast('Взяли карманную схему города. Она в инвентаре; места, где вы побывали, отмечаются сами.', 'good'); renderControls(); } openMap(); }
function openAdmin() {
  const row = (label, val, btns) => `<div class="row sp" style="padding:5px 0;border-bottom:1px solid #ffffff10"><span>${label}: <b>${val}</b></span><span>${btns.map(([t, k]) => `<button class="btn small" data-adm="${k}">${t}</button>`).join(' ')}</span></div>`;
  const draw = box => {
    S.flags = S.flags || {};
    const activeFx = [
      (S.sleepDeprived || S.flags.sleepDeprived) && '👁 Недосып',
      (W && W.life && W.life.fx && W.life.fx.drunk > .2) && '🍺 Опьянение',
      ((S.hunger ?? 100) < 20) && '🍖 Голод',
      (W && W.P && W.P.bleed > 0) && '🩸 Кровотечение',
      (W && W.P && W.P.stun > 0) && '💫 Контузия',
      (W && W.P && W.P.exh) && '😮‍💨 Истощение',
      (S.flags.anabolBuff && S.flags.anabolBuff >= S.day) && '💪 Сила «Метана»',
      (S.flags.energeticBuff && S.flags.energeticBuff >= S.day) && '⚡ Бодрость',
      (S.flags.nightmareInsight) && '🧠 Инсайт'
    ].filter(Boolean).join(', ') || 'нет';
    box.querySelector('#admBody').innerHTML =
      row('Улица', Math.round(S.rep.street), [['−10', 'street:-10'], ['+10', 'street:10']]) + row('Закон', Math.round(S.rep.law), [['−10', 'law:-10'], ['+10', 'law:10']]) + row('Народ', Math.round(S.rep.folk), [['−10', 'folk:-10'], ['+10', 'folk:10']]) +
      row('Интеллект', String((S.sk.charm || 0) * 25 + 25) + '/100', [['−', 'sk:charm:-1'], ['+', 'sk:charm:1']]) + row('Физкультура', '★'.repeat(S.sk.sense) || '0', [['−', 'sk:sense:-1'], ['+', 'sk:sense:1']]) + row('Торговля', '★'.repeat(S.sk.trade) || '0', [['−', 'sk:trade:-1'], ['+', 'sk:trade:1']]) +
      row('Рубли', fmt(S.money) + ' ₽', [['+1 000', 'rub:1000'], ['+10 000', 'rub:10000']]) + row('Доллары', '$' + fmt(S.usd), [['+10', 'usd:10'], ['+100', 'usd:100']]) +
      row('Способности', [S.moves.kick && 'нога', S.moves.hook && 'боковой', S.moves.upper && 'апперкот', S.flags.pickpocket && 'карманник', S.hasMap && 'карта'].filter(Boolean).join(', ') || 'нет', [['Открыть все', 'all']]) +
      row('Время', clockStr(), [['−1 ч', 'time:-1'], ['+1 ч', 'time:1'], ['07:00', 'at:7'], ['12:00', 'at:12'], ['18:00', 'at:18'], ['23:00', 'at:23']]) +
      `<div style="padding:6px 0;border-bottom:1px solid #ffffff10"><span><b>Негативные эффекты</b> (активно: <b style="color:var(--acc)">${activeFx}</b>):</span>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
          <button class="btn small red" data-adm="fx:insomnia">👁 Недосып (галлюцинации)</button>
          <button class="btn small red" data-adm="fx:drunk">🍺 Опьянение</button>
          <button class="btn small red" data-adm="fx:hunger">🍖 Сильный голод</button>
          <button class="btn small red" data-adm="fx:bleed">🩸 Кровотечение</button>
          <button class="btn small red" data-adm="fx:concuss">💫 Контузия</button>
          <button class="btn small red" data-adm="fx:exhaust">😮‍💨 Истощение</button>
          <button class="btn small red" data-adm="fx:stress">😰 Стресс кошмара</button>
        </div></div>` +
      `<div style="padding:6px 0;border-bottom:1px solid #ffffff10"><span><b>Позитивные эффекты:</b></span>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
          <button class="btn small green" data-adm="fx:energy">⚡ Бодрость (+выносливость)</button>
          <button class="btn small green" data-adm="fx:strength">💪 Сила «Метана» (+урон)</button>
          <button class="btn small green" data-adm="fx:insight">🧠 Вещий инсайт</button>
          <button class="btn small green" data-adm="fx:brass">🥊 Кастет (+40 урона)</button>
          <button class="btn small yellow" data-adm="fx:clear">🧹 Снять все негативные эффекты</button>
        </div></div>` +
      `<div style="padding:6px 0;border-bottom:1px solid #ffffff10"><span>Телепорт:</span><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${TP_POINTS.map(([k, n]) => `<button class="btn small" data-adm="tp:${k}">${n}</button>`).join('')}</div></div>` +
      row('Здоровье / сытость', Math.round(S.hp ?? 100) + ' / ' + Math.round(S.hunger), [['Восстановить', 'heal']]);
    box.querySelectorAll('[data-adm]').forEach(b => b.onclick = () => { const [k, a, c] = b.dataset.adm.split(':');
      if (k === 'street' || k === 'law' || k === 'folk') rep(k, +a);
      else if (k === 'sk') S.sk[a] = clamp(S.sk[a] + (+c), 0, 3);
      else if (k === 'rub') S.money += +a; else if (k === 'usd') S.usd += +a;
      else if (k === 'all') { S.moves = { kick: true, hook: true, upper: true }; S.flags.pickpocket = true; S.flags.prisonCombatTrained = true; S.hasMap = true; for (const p of POIS) S.visited[p[0]] = true; }
      else if (k === 'time' && W && W.setHour) W.setHour(W.hour + (+a));
      else if (k === 'at' && W && W.setHour) W.setHour(+a);
      else if (k === 'tp') { const pt = TP_POINTS.find(p => p[0] === a); if (pt && W && W.teleport) { W.teleport(pt[2], pt[3], pt[4]); toast('Телепорт: ' + pt[1], 'good'); sfx.click(); save(); nextCard(); render(); return; } }
      else if (k === 'heal') { S.hp = S.maxHp || 100; S.hunger = 100; if (W) { W.P.hp = S.hp; W.P.stam = 100; W.P.bleed = 0; } }
      else if (k === 'fx') {
        S.flags = S.flags || {};
        if (a === 'insomnia') {
          S.sleepDeprived = !S.sleepDeprived;
          S.flags.sleepDeprived = S.sleepDeprived;
          toast(S.sleepDeprived ? '👁 Наложен эффект «Недосып»: в зеркале ванной начнутся галлюцинации и скример!' : 'Эффект «Недосып» снят.', S.sleepDeprived ? 'bad' : 'good');
        } else if (a === 'drunk' && W && W.life && W.life.fx) {
          W.life.fx.drunk = 1.15; W.life.fx.drunkTarget = 1.15;
          toast('🍺 Наложен эффект «Сильное опьянение»!', 'bad');
        } else if (a === 'hunger') {
          S.hunger = 5;
          toast('🍖 Наложен эффект «Сильный голод»!', 'bad');
        } else if (a === 'bleed' && W && W.P) {
          W.P.bleed = 18; S.hp = Math.min(S.hp ?? 100, 42); W.P.hp = S.hp;
          toast('🩸 Наложен эффект «Кровотечение и ранение»!', 'bad');
        } else if (a === 'concuss' && W && W.P) {
          W.P.stun = 5.0; W.P.headHitDark = 0.78; W.P.headHitBlur = 0.65; W.P.shake = 0.9;
          toast('💫 Наложен эффект «Контузия и потемнение в глазах»!', 'bad');
        } else if (a === 'exhaust' && W && W.P) {
          W.P.stam = 0; W.P.exh = true;
          toast('😮‍💨 Наложен эффект «Полное истощение (одышка)»!', 'bad');
        } else if (a === 'stress') {
          S.flags.nightmareStressDay = S.day;
          toast('😰 Наложен эффект «Стресс после кошмара»!', 'bad');
        } else if (a === 'energy') {
          S.sleepDeprived = false; S.flags.sleepDeprived = false; S.flags.nightmareStressDay = -1;
          S.flags.energeticBuff = S.day + 2; S.maxHp = Math.max(S.maxHp || 100, 125); S.hp = S.maxHp;
          if (W && W.P) { W.P.hp = S.hp; W.P.stam = 100; W.P.exh = false; }
          toast('⚡ Наложен позитивный эффект «Бодрость и прилив сил»!', 'good');
        } else if (a === 'strength') {
          S.flags.anabolBuff = S.day + 3;
          if (W && W.P) W.P.punchK = 1.65;
          toast('💪 Наложен позитивный эффект «Сила Метана (+65% к удару)»!', 'good');
        } else if (a === 'insight') {
          S.flags.nightmareInsight = true;
          toast('🧠 Наложен позитивный эффект «Вещий инсайт»!', 'good');
        } else if (a === 'brass') {
          S.flags.hasBrassKnuckles = true;
          toast('🥊 Выдан свинцовый кастет (+40 к урону кулаком)!', 'good');
        } else if (a === 'clear') {
          S.sleepDeprived = false; S.flags.sleepDeprived = false; S.flags.nightmareStressDay = -1;
          S.hunger = 100; S.hp = S.maxHp || 100;
          if (W) {
            if (W.life && W.life.fx) { W.life.fx.drunk = 0; W.life.fx.drunkTarget = 0; W.life.fx.smoke = 0; }
            if (W.P) { W.P.hp = S.hp; W.P.stam = 100; W.P.exh = false; W.P.bleed = 0; W.P.stun = 0; W.P.headHitDark = 0; W.P.headHitBlur = 0; W.P.knuckleWear = 0; }
          }
          toast('🧹 Все негативные эффекты сняты, здоровье и бодрость восстановлены!', 'good');
        }
      }
      sfx.click(); save(); renderHud(); draw(box); }); };
  queueCard({ title: '🛠 Админ-панель', html: '<div id="admBody"></div><p class="muted">Изменения сохраняются сразу.</p>', onShow: draw, buttons: [{ label: 'Закрыть', fn() { render(); } }] });
}

// ---- вычисляемые ----
const chapter = () => S.day <= 12 ? 1 : 2;
const slotCount = () => S.up.pavilion ? 9 : 6;
const storeCap = () => S.up.pavilion ? 160 : 80;
const stockTotal = () => GOOD_IDS.reduce((a, id) => a + (S.stock[id] ? S.stock[id].q : 0), 0);
const qOf = id => S.stock[id] ? S.stock[id].q : 0;
const displayed = id => S.slots.includes(id);
const usdToRub = usd => Math.round(usd * S.rate);
const sellPrice = id => HIDDEN[id] ? Math.round(hiddenPrice(id) * 1.9) : Math.max(1, Math.round(S.prices[id] * (1 + S.markup))); // «из-под полы» — по цене подпольной продажи
const buyPrice = (id, src = S.src) => {
  let p = (src === 'station' ? S.vprices[id] : S.prices[id]);
  p *= 1 - .04 * S.sk.trade - (S.outfit === 'sport' ? .05 : 0) - (S.cheap > 0 ? .15 : 0) - (S.flags && S.flags.zhekaSupplyBonus ? .15 : 0);
  if (W && !W.nearMarket()) p *= (S.flags && S.flags.vitkaHelper) ? 1.07 : 1.15; // доставка (Витька носит ящики — дешевле)
  return Math.max(1, Math.round(p));
};
const stockValue = () => GOOD_IDS.reduce((a, id) => a + qOf(id) * S.prices[id], 0);
const capitalUsd = () => S.usd + looseCash('usd') + (S.money + looseCash('cash') + stockValue() + S.pmp) / S.rate - S.debt;
const waveItem = () => (S.wave && S.day <= S.wave.until) ? S.wave.item : null;

function addStock(id, q, cost) {
  const st = S.stock[id] || (S.stock[id] = { q:0, c:0 });
  if (SHELF_LIFE[id] && S.fresh) S.fresh[id] = q >= st.q ? 0 : (S.fresh[id] || 0); // свежая партия
  st.c = (st.c * st.q + cost * q) / (st.q + q); st.q += q;
}
function takeStock(id, q) {
  const st = S.stock[id]; if (!st) return 0;
  const n = Math.min(q, st.q); st.q -= n; return n * st.c;
}
function rep(k, d) { S.rep[k] = clamp(S.rep[k] + d, -100, 100); }

function genPrices() {
  S.prevPrices = { ...S.prices };
  const w = waveItem();
  for (const id of GOOD_IDS) {
    let p = GOODS[id].base * S.idx * R(.85, 1.2);
    if (id === w) p *= 1.5;
    S.prices[id] = Math.max(1, Math.round(p));
    const cheapAtStation = ['cig','vodka','beer','tape'].includes(id);
    S.vprices[id] = Math.max(1, Math.round(S.prices[id] * (cheapAtStation ? R(.65, .8) : R(1, 1.1))));
  }
}

// ============================================================
//  Интерфейс: общее
// ============================================================
function toast(msg, cls = '') {
  let mode = 2; try { if (SET.toasts != null) mode = +SET.toasts; } catch (e) {}
  if (mode === 0 || (mode === 1 && cls !== 'bad' && cls !== 'good')) return; // 0 — выключены, 1 — только важные (успех / беда)
  const d = document.createElement('div'); d.className = 'tst ' + cls; d.textContent = msg;
  $('#toast').appendChild(d); setTimeout(() => d.remove(), 2200);
  while ($('#toast').children.length > 3) $('#toast').firstChild.remove();
}
function floatText(txt, color) {
  // На экране ничего не всплывает — полный реализм
}
function repBar(k, label) { return ''; }
let sheetOpen = false, dialogOpen = false;
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
function clockStr() { const h = W ? W.hour : 9, hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60); return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); }
function renderHud() {
  // На экране ничего не отображается: ни здоровье, ни выносливость, ни сытость, ни деньги, ни уважение
  const el = $('#hud');
  if (el) el.innerHTML = '';
}
function updVitals() {
  // Полосок здоровья, выносливости и сытости на экране нет — всё определяется по внешнему виду рук/тела, синякам, дыханию и эффектам
}
let rdrInvOpen = false;
let rdrCashDenom = 100;
let rdrUsdDenom = 10;

function openRdrInventory() {
  if (!S) return;
  if (sheetOpen) sheetOpen = false;
  rdrInvOpen = true;
  document.body.classList.add('rdr-blur');
  sfx.click && sfx.click();
  render();
}
function closeRdrInventory() {
  if (!rdrInvOpen) return;
  rdrInvOpen = false;
  document.body.classList.remove('rdr-blur');
  sfx.click && sfx.click();
  render();
}
function toggleRdrInventory() {
  if (rdrInvOpen) closeRdrInventory();
  else openRdrInventory();
}

function renderTabs() {
  if (!S) { $('#tabs').innerHTML = ''; return; }
  const T_ = [['hero', '👤', 'Персонаж'], ['set', '⚙', 'Настройки']];
  if (!['hero', 'set'].includes(tab)) tab = 'hero';
  $('#tabs').innerHTML = T_.map(([k, i, n]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}"><span>${i}</span>${n}</button>`).join('');
}
function openSheet(t) {
  if (t === 'inv') { toggleRdrInventory(); return; }
  if (rdrInvOpen) { rdrInvOpen = false; document.body.classList.remove('rdr-blur'); }
  if (t === 'set') tab = 'set'; else tab = 'hero';
  sheetOpen = true; render(); $('#screen').scrollTop = 0;
}
function closeSheet() {
  if (!W) return;
  sheetOpen = false;
  if (rdrInvOpen) { rdrInvOpen = false; document.body.classList.remove('rdr-blur'); }
  render();
}
function renderControls() {
  const readyInGame = !!(S && W && worldReady && !cardOpen);
  $('#topBtns').style.display = (readyInGame && !alarmModalOpen) ? 'flex' : 'none';
  const fbHud = $('#fpsBadge'); if (fbHud) fbHud.style.display = (readyInGame && (SET.showFps ?? 1)) ? 'block' : 'none';
  const playing = !!(readyInGame && !sheetOpen && !rdrInvOpen && !npOpen && !npBusy && !paperOpen && !paperBusy && !alarmModalOpen);
  $('#cross').style.display = playing && !dialogOpen ? 'block' : 'none';
  $('#cross').classList.toggle('aim', !!(W && W.weapon.aiming));
  if (controls) controls.setVisible(playing || (controls && controls.editing));
  let hint = '';
  if (W && S && S.phase === 'morning' && playing && !dialogOpen) {
    if (!S.slots.some(id => id && qOf(id) > 0) && W.inKiosk()) hint = 'Возьмите товар с полок («Действие») и поставьте его на стеклянную витрину у окна, затем поднимите окошко выдачи — ларёк откроется.';
    else if (W.P.seated && !S.flags.stood && !(W.inPoliceCarRide && W.inPoliceCarRide())) hint = 'Свайп по экрану — осмотреться. «Действие» → «Встать», чтобы ходить.';
    else if (!W.P.seated && W.inKiosk() && !S.flags.wentOut) hint = 'Повернитесь к двери за спиной и откройте её. Выйти можно просто пройдя в проём.';
  }
  // Кнопки «Спать до утра» убраны по требованию пользователя — сон происходит через кровать и заведённый будильник
  if (W && W.prisonStatus && playing && !dialogOpen) {
    const pst = W.prisonStatus();
    if (pst === 'station_desk') hint = 'Кабинет следователя РОВД: сядьте на стул напротив стола («Действие») и распишитесь в протоколе на столе.';
    else if (pst === 'walk_to_cell') hint = 'Решётчатая дверь открыта: пройдите через тюремный коридор прямо в открытую Камеру № 3 ИВС.';
    else if (pst === 'in_cell') hint = 'Камера № 3 КПЗ: отсидите срок на левой шконке, поговорите с Михалычем, открутите вентиляцию ложкой со стола или постучите в «кормушку» двери.';
    else if (pst === 'escaping_yard') hint = 'Прогулочный дворик КПЗ: подойдите к железной калитке справа и выбейте засов для побега на волю!';
  }
  $('#hint').textContent = hint;
  if (controls) controls.refresh(true);
}
function onCtl() { renderControls(); }
function render() {
  renderHud(); renderTabs();
  const rdrEl = $('#rdrWheelOverlay');
  if (rdrEl) {
    if (!S || sheetOpen || cardOpen) {
      rdrInvOpen = false;
      document.body.classList.remove('rdr-blur');
    }
    rdrEl.classList.toggle('on', !!rdrInvOpen);
    document.body.classList.toggle('rdr-blur', !!rdrInvOpen);
    if (rdrInvOpen) rdrEl.innerHTML = rdrWheelHtml();
    else rdrEl.innerHTML = '';
  }
  $('#title').classList.toggle('on', !S);
  if (!S) { const tk = (load() ? 'c' : 'n') + (W ? 'w' : ''); if ($('#title').dataset.k !== tk) { $('#title').innerHTML = titleHtml(); $('#title').dataset.k = tk; } $('#sheet').classList.remove('on'); $('#tradePanel').classList.remove('on'); renderControls(); return; }
  $('#title').innerHTML = ''; $('#title').dataset.k = '';
  if (!W) sheetOpen = true;
  $('#closeSheet').style.display = W ? '' : 'none';
  const trade = S.phase === 'trade';
  if (!['hero', 'inv', 'set'].includes(tab)) tab = 'hero';
  $('#sheet').classList.toggle('on', sheetOpen);
  if (sheetOpen) {
    const scr = $('#screen');
    const keepScroll = scr.dataset.view === tab ? scr.scrollTop : 0;
    scr.dataset.view = tab;
    if (tab === 'set') scr.innerHTML = setHtml();
    else scr.innerHTML = heroHtml();
    scr.scrollTop = keepScroll;
    if (tab === 'exch') drawChart();
  }
  $('#tradePanel').classList.toggle('on', trade && !!T);
  if (trade && T) $('#tradePanel').innerHTML = tradePanelHtml();
  if (W) W.updateShelves();
  renderControls();
  if (S.phase === 'morning' || S.phase === 'night') save();
}

// ============================================================
//  Модальные карточки (очередь)
// ============================================================
let cards = [], cardOpen = false;
function queueCard(c) { cards.push(c); if (!cardOpen) nextCard(); }
function nextCard() {
  const c = cards.shift();
  if (!c) { cardOpen = false; $('#modal').classList.remove('on'); if (T) T.paused = false; render(); return; }
  if (controls) controls.setVisible(false);
  cardOpen = true; if (T) T.paused = true;
  const box = $('#mbox');
  box.style.width = c.wide ? 'min(820px, 100%)' : '';
  box.innerHTML = (c.title ? `<h2>${c.title}</h2>` : '') + c.html +
    `<div class="mbtns">${(c.buttons || [{ label:'Дальше' }]).map((b, i) => `<button class="btn ${b.cls || ''}" data-card="${i}" ${b.disabled ? 'disabled' : ''}>${b.label}</button>`).join('')}</div>`;
  box.querySelectorAll('[data-card]').forEach(el => el.onclick = () => {
    sfx.click();
    const b = (c.buttons || [{}])[+el.dataset.card];
    const keep = b.fn ? b.fn() : null;
    if (keep !== 'keep') nextCard();
  });
  $('#modal').classList.add('on');
  if (c.onShow) c.onShow(box);
}

// ============================================================
//  Титульный экран и новая игра
// ============================================================
function titleHtml() {
  const sv = load(), has = !!sv;
  const tag = (a, cls, big, small, i) => `<button class="mn-tag ${cls}" data-a="${a}" style="--i:${i}"><span class="mn-str" aria-hidden="true"></span><b>${big}</b>${small ? `<small>${small}</small>` : ''}</button>`;
  const loading = !!(W && !worldReady);
  if (audio && audio.startMenuAnthem) {
    try { audio.startMenuAnthem(); } catch (e) {}
  }
  return `<div class="mn-fade" id="menuFade"></div>
    <div class="mn-bars" aria-hidden="true"><i></i><i></i></div>
    <div class="mn-wrap">
      <div class="mn-y">РОССИЯ · КРАСНОЗАВОДСК · ЯНВАРЬ 1992</div>
      <h1 class="mn-logo" aria-label="Ларёк"><span style="--d:0">Л</span><span style="--d:1">А</span><span style="--d:2">Р</span><span class="flk" style="--d:3">Ё</span><span style="--d:4">К</span></h1>
      <p class="mn-sub">Индустриальная зима 1992-го. Огромный долг «заводским» ($2 500), криминальные качели и борьба за район.</p>
      <div class="mn-anthem-badge">🎺 Гимн РФ 1992 г. · М. И. Глинка «Патриотическая песня» (инструментал)</div>
      <div class="mn-tags ${loading ? 'hidden-until-loaded' : ''}" id="menuBtns" style="display:${loading ? 'none' : 'flex'}">
        ${has ? tag('continue', 'mn-cont', 'Продолжить', 'День ' + (sv.day || 1) + ' · ' + dateStr(sv.day || 1), 0) : ''}
        ${tag('new', 'mn-new', 'Новая игра', 'долг $2 500 · без финала', has ? 1 : 0)}
        ${tag('menuSettings', 'mn-cont', 'Настройки', 'графика · звук · управление', has ? 2 : 1)}
      </div>
      <div class="mn-load ${loading ? '' : 'done'}" id="loadBox"><div class="mn-bar"><i id="loadBar" style="width:${Math.round(loadP * 100)}%"></i></div><span id="loadInfo">${loading ? 'Подгрузка 3D-мира, заводов, ассетов и скриптов… ' + Math.round(loadP * 100) + '%' : ''}</span></div>
      ${W ? '' : '<p class="warn">WebGL недоступен — 3D выключено, игра идёт в режиме блокнота.' + (_worldInitErr ? ' (' + esc(_worldInitErr) + ')' : '') + '</p>'}
    </div>
    <div class="mn-cap"><span class="mn-rec">● <b id="menuClock">18:12</b></span><span id="menuCap" class="in">Ул. Советская · Промзона 1992</span></div>
    <div class="mn-foot">Бесконечная песочница 1992 г. · все персонажи, фирмы и бренды вымышлены</div>`;
}

function workFactoryShift(kind, workerTitle) {
  if (!S) return;
  const shiftPay = kind === 'lvz' ? RI(1150, 1450) : kind === 'meat' ? RI(1050, 1350) : RI(900, 1180);
  const bonusGood = kind === 'lvz' ? 'vodka' : kind === 'meat' ? 'tushonka' : 'bread';
  const bonusQty = kind === 'bread' ? 5 : 3;
  S.money += shiftPay;
  addStock(bonusGood, bonusQty, Math.round((S.prices[bonusGood] || 100) * 0.35));
  S.hunger = Math.max(10, (S.hunger ?? 100) - 22);
  if (W && W.P) W.P.stam = Math.max(15, (W.P.stam ?? 100) - 35);
  if (W && W.advanceClockHours) W.advanceClockHours(3.0);
  gainSkillXp('sense', 20, 'Смена в заводском цеху');
  rep('folk', 3);
  save(); renderHud();
  toast(`Отработали 3-часовую смену в цеху! Заработано +${fmt(shiftPay)} ₽ наличными и выдано ${bonusQty} шт. «${GOODS[bonusGood].name}» пайком!`, 'good');
}

function workerTalk(kind, workerTitle) {
  if (!S || !W) return;
  const lotMap = {
    meat:  { id: 'tushonka', id2: 'sausage', name1: 'Говяжья тушёнка ГОСТ (из автоклава)', name2: 'Колбаса «Докторская» (с конвейера)', disc: 0.36, qty: 10 },
    bread: { id: 'bread',    id2: 'choc',    name1: 'Горячий хлеб «Дарницкий» (с печи)',   name2: 'Пряники и вафли (из пекарни)',       disc: 0.34, qty: 15 },
    lvz:   { id: 'vodka',    id2: 'beer',    name1: 'Водка «Русская» (с линии розлива)',   name2: 'Пиво «Жигулёвское» (свежий розлив)', disc: 0.35, qty: 12 },
  };
  const cfg = lotMap[kind] || lotMap.meat;
  const p1 = Math.max(8, Math.round((S.prices[cfg.id] || 120) * cfg.disc));
  const p2 = Math.max(8, Math.round((S.prices[cfg.id2] || 90) * cfg.disc));
  const tot1 = p1 * cfg.qty, tot2 = p2 * cfg.qty;
  const speech = kind === 'meat'
    ? `Здорово, коммерсант! Нам на Мясокомбинате третью неделю зарплату банками тушёнки выдают. Директор с кладовщиком втридорога ломят, а мы, работяги из Цеха № 1, прямо от автоклава по-свойски отдадим за полцены! Или становись к конвейеру — поможешь партию закатать, заплатим живыми рублями и пайком.`
    : kind === 'bread'
    ? `Привет, милок! Жарко у печей с самого утра. Муку задерживают, начальство крутит наценку, а мы тебе прямо с горячих лотков свежий хлеб по рабочей цене уступим. Хочешь подзаработать — подсоби мешки с мукой у печи потаскать!`
    : `Тише ты, мастер цеха услышит! У нас на линии розлива ЛВЗ всегда неучтённый ящик имеется — без акциза и директорской накрутки. Забирай по заводской себестоимости или помоги тару на конвейере перебрать — хорошо заплатим!`;

  showDialog({
    title: `🏭 ${workerTitle}`,
    text: speech,
    choices: [
      {
        label: `📦 Купить у рабочего с рук: ${cfg.name1} (${cfg.qty} шт. за ${fmt(tot1)} ₽ — по ${fmt(p1)} ₽/шт.)`,
        fn() {
          if (S.money < tot1) { toast(`Не хватает наличных (${fmt(tot1)} ₽).`, 'bad'); return; }
          S.money -= tot1;
          addStock(cfg.id, cfg.qty, p1);
          gainSkillXp('trade', 15, 'Прямая закупка у рабочих в цеху');
          closeDialog(); save(); renderHud();
          toast(`Выкупили у рабочих ${cfg.qty} шт. товара по заводской цене (${fmt(p1)} ₽/шт.)!`, 'good');
        }
      },
      {
        label: `📦 Купить вторую позицию: ${cfg.name2} (${cfg.qty} шт. за ${fmt(tot2)} ₽ — по ${fmt(p2)} ₽/шт.)`,
        fn() {
          if (S.money < tot2) { toast(`Не хватает наличных (${fmt(tot2)} ₽).`, 'bad'); return; }
          S.money -= tot2;
          addStock(cfg.id2, cfg.qty, p2);
          gainSkillXp('trade', 15, 'Прямая закупка у рабочих в цеху');
          closeDialog(); save(); renderHud();
          toast(`Выкупили у рабочих ${cfg.qty} шт. товара по заводской цене (${fmt(p2)} ₽/шт.)!`, 'good');
        }
      },
      {
        label: `🛠 Поработать смену в цеху (3 часа: заработать ~1 100 ₽ + заводской паёк)`,
        fn() {
          closeDialog();
          workFactoryShift(kind, workerTitle);
        }
      },
      { label: 'Бывай, мужики, удачной смены!', fn() { closeDialog(); } }
    ]
  });
}

function startNewFlow() {
  const sex = 'm';
  queueCard({
    title: 'Как вас зовут?',
    html: `<p>Январь 1992 года, г. Краснозаводск. Вам 20 лет — завод, где работали родители, стоит, зарплату задерживают месяцами.</p>
      <p style="margin-top:10px;font-weight:700;color:var(--acc)">Введите ваше имя:</p>
      <input type="text" id="heroName" maxlength="16" value="Серёга" autocomplete="off">`,
    buttons: [{ label:'Начать игру', cls:'green', fn() {
      const nm = (($('#heroName') && $('#heroName').value) || '').trim() || 'Серёга';
      newGame(nm.slice(0, 16), sex); tab = 'kiosk'; if (W) W.reset(); syncAmmoToWeapon(); render(); introCards();
    } }],
  });
}
function introCards() {
  if (audio && audio.stopMenuAnthem) audio.stopMenuAnthem();
  queueCard({ title:'Январь 1992 · «Шоковая терапия и Счётчик»',
    html:`<p>Январь 1992-го. Цены отпустили — и страна проснулась в другой реальности. От дяди Толи вам достался старый ларёк на ул. Советской и просроченная квартплата Бабе Зине.</p>
      <p>Но главное — <b>огромный долг банде «Заводских»: $2 500</b> (свыше миллиона рублей по курсу!). Счётчик тикает каждую неделю: на одной честной наценке с хлеба и газировки такой долг не поднять никогда.</p>
      <p class="goal">Выживайте, крутитесь между цехами заводов, милицией и бандитами и поднимайтесь по Лестнице Влияния — от мелкого торговца до Теневого хозяина Краснозаводска!</p>` });
  queueCard({ title:'Как играть',
    html:`<p>👀 <b>Свайп по экрану</b> — крутить головой. Кнопка <b>«Действие»</b> показывает, что можно сделать: встать, открыть дверь, сесть, включить радио, поговорить.</p>
      <p>🕹 Джойстик слева — ходить, <b>«Бег»</b> — бежать, <b>«Присесть»</b>. На ПК: WASD, Shift, C, E — действие, F — дверь, Q — ружьё, R — перезарядка, ПКМ — прицел, ЛКМ — выстрел.</p>
      <p>🪟 Ларёк открыт, пока поднято <b>окошко выдачи</b> (наведитесь на него → «Действие»). Опустили — закрыто, даже если вы за прилавком.</p>
      <p>🍞 Следите за <b>сытостью</b> и <b>силами</b> под полоской здоровья: бег, драка и тяжести выматывают, а голодному и раны не заживают. Еду берут в руку и едят.</p>
      <p>🎒 В <b>инвентаре</b> — вещи, одежда, навыки и уважение. Схему города возьмите на стенде у остановки. Марат торгует за гаражами только с 7:00 до 8:30.</p>
      <p>🚪 Дверь за спиной открывается и закрывается. Выходите в город пешком: остановка, детская площадка, дворы. Товар заказывается через блокнот и телефон на прилавке.</p>
      <p>🔫 На стене — дядино охотничье ружьё, в стволах два патрона. Только чтобы пугать: наведите на хулиганов — кто-то отступит, кто-то нет. Выстрел в воздух распугает всех, но милиции это не понравится.</p>
      <p>⚙ Раскладку кнопок можно менять: <b>Блокнот → Опции → Редактор управления</b>.</p>` });
}

// ============================================================
//  Ларёк: утро
// ============================================================
function slotHtml(id, i, clickable = true) {
  const sc = slotCount();
  if (i >= sc) return '';
  if (!id) return `<button class="slot empty" data-slot="${i}">＋<small>пусто</small></button>`;
  if (HIDDEN[id]) return `<button class="slot" data-slot="${i}">🤫<small>${HIDDEN[id].short} · ${fmt(sellPrice(id))}₽</small><b>${(S.slotCounts && S.slotCounts[i]) || 1}</b></button>`;
  const q = qOf(id), hot = waveItem() === id;
  return `<button class="slot ${q ? '' : 'out'} ${hot ? 'hot' : ''}" data-slot="${i}">${GOODS[id].icon}<small>${GOODS[id].short} · ${fmt(sellPrice(id))}₽</small><b>${q}</b></button>`;
}
function vitrineHtml() {
  let h = '<div class="vit">';
  for (let i = 0; i < slotCount(); i++) h += slotHtml(S.slots[i], i);
  return h + '</div>';
}
function kioskHtml() {
  const ch = chapter();
  const goal = S.free ? 'Свободная торговля. Капитал: $' + fmt(capitalUsd())
    : ch === 1 ? (S.debt > 0 ? `Отдать долг $${S.debt} до декабря 1992` : 'Долг отдан. Доживите до 1993-го и копите.')
    : (S.up.pavilion ? 'Павильон открыт. Доживите до конца 1993 и наберите капитал.' : 'Открыть павильон ($500) до конца 1993');
  const mk = Math.round(S.markup * 100);
  const mkLabel = mk <= 25 ? 'по-честному' : mk <= 60 ? 'как все' : mk <= 100 ? 'дерзко' : 'грабёж';
  const ups = Object.entries(UPGRADES).filter(([k, u]) => !S.up[k] && (!u.from || S.day >= u.from));
  return `
    <div class="card goal"><b>Цель:</b> ${goal}</div>
    ${seasonHtml()}
    <h3>Витрина <span class="muted">(тап — сменить товар)</span></h3>
    ${vitrineHtml()}
    <div class="row sp" style="margin-top:6px"><span class="muted">Склад: ${stockTotal()}/${storeCap()}</span><span class="muted">Мест на витрине: ${slotCount()}</span></div>
    <h3>Наценка: ${mk}% <span class="chip">${mkLabel}</span></h3>
    <p class="muted">Наценка выставляется в бумажном блокноте на прилавке (возле телефона). Высокая наценка — больше денег, но покупатели чаще уходят.</p>
    <div class="mbtns">
      ${S.phase === 'morning' ? `<button class="btn green big" data-a="open">Сесть за прилавок и поднять окошко ▶</button>
` : '<p class="warn">Ларёк открыт — идёт продажа. Опустите окошко выдачи, чтобы закрыть его.</p>'}
      <button class="btn blue" data-a="nightKiosk">🌙 Ночной Ларёк (ночная смена до утра)</button>
      <button class="btn yellow" data-a="cassetteDeck">📼 Магнитофон «Весна-212» и кассеты</button>
      <button class="btn" data-a="blackMarketLab">🕵️ Чёрный Рынок (разбавить / переклеить этикетку / набор)</button>
      ${(S.ratInfestation || 0) > 0 ? `<button class="btn red" data-a="cleanRats">🐀 Вытравить крыс и убрать тухлятину со склада (уровень: ${S.ratInfestation})</button>` : ''}
    </div>
    <h3>Оборудование ларька</h3>
    <div class="card">
      <div class="muted" style="margin-bottom:6px">Оборудование заказывается по дисковому телефону на прилавке в <b>«Посылторге» (4-19-92)</b>, стальная решётка — у <b>Марата за гаражами</b>, а восковую свечу можно найти на полке в ларьке.</div>
      ${Object.entries(UPGRADES).filter(([, u]) => !u.from || S.day >= u.from).map(([k, u]) => `<div class="row sp" style="padding:4px 0;border-top:1px solid #ffffff12"><div><b>${u.icon} ${u.name}</b><div class="muted" style="font-size:11px">${S.up[k] ? u.desc : u.where}</div></div><span class="chip">${S.up[k] ? '✓ есть' : (u.usd ? fmt(usdToRub(u.usd)) + ' ₽' : 'на полке')}</span></div>`).join('')}
    </div>
    ${false ? `<div class="card row sp"><div><b>👩 Нанять тётю Любу</b><div class="muted">Торгует за вас целый день и пока вы не в игре (до 8 часов). Зарплата $3/день. Бывает, подворовывает.</div></div>
        <button class="btn small" data-a="hire">Нанять</button></div>` : ''}`;
}
function seasonHtml() {
  const d = SEASON_DEMAND[monthOf(S.day)] || {};
  const up = Object.entries(d).filter(([id, k]) => k > 1.15 && GOODS[id] && goodAvail(id)).sort((a, b) => b[1] - a[1]).map(([id]) => GOODS[id].icon + ' ' + GOODS[id].short);
  const dn = Object.entries(d).filter(([id, k]) => k < .9 && GOODS[id]).map(([id]) => GOODS[id].icon + ' ' + GOODS[id].short);
  const stale = Object.keys(SHELF_LIFE).filter(id => qOf(id) > 0 && ((S.fresh && S.fresh[id]) || 0) >= SHELF_LIFE[id]).map(id => GOODS[id].short);
  return `<div class="card"><b>📅 Спрос: ${MONTHS[monthOf(S.day)].toLowerCase()}</b>
    ${up.length ? `<div class="muted" style="margin-top:3px">Берут чаще: ${up.join(', ')}</div>` : ''}${dn.length ? `<div class="muted">Не сезон: ${dn.join(', ')}</div>` : ''}
    ${stale.length ? `<div class="warn" style="margin-top:3px">Залежалось: ${stale.join(', ')} — продаётся хуже, завтра спишется</div>` : ''}</div>`;
}
function openSlotPicker(i) {
  const items = GOOD_IDS.filter(id => qOf(id) > 0);
  queueCard({ title:'Что положить на витрину?',
    html: items.length ? items.map(id => `<div class="good"><div class="ic">${GOODS[id].icon}</div><div class="nm"><div>${GOODS[id].name}</div><div class="muted">на складе ${qOf(id)} · цена ${fmt(sellPrice(id))} ₽${displayed(id) ? ' · уже на витрине' : ''}</div></div>
      <button class="btn small" data-pick="${id}">Сюда</button></div>`).join('') : '<p>Склад пуст. Закажите товар через блокнот и телефон на прилавке.</p>',
    onShow(box) { box.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { S.slots[i] = b.dataset.pick; sfx.click(); nextCard(); }); },
    buttons: [{ label:'Убрать с витрины', fn() { S.slots[i] = null; } }, { label:'Отмена' }],
  });
}

// ============================================================
//  Торговый день
// ============================================================
function traffic() {
  return (1 + (S.up.sign ? .25 : 0) + (S.up.pavilion ? .2 : 0) + (S.flags && S.flags.olyaBandDay === S.day ? .45 : 0)) * (1 + S.rep.folk / 250);
}
function makeCustomer() {
  const w = {};
  for (const k in TYPES) {
    let x = TYPES[k].w;
    if (k === 'newrus') x *= (chapter() === 2 ? 1.8 : 1) * (S.outfit === 'raspberry' ? 2.5 : 1);
    if (k === 'chelnok' && chapter() === 2) x *= 1.5;
    w[k] = x;
  }
  const k = wpick(w), ty = TYPES[k], wi = waveItem();
  const wants = {};
  for (const id in ty.wants) if (goodAvail(id)) wants[id] = ty.wants[id] * seasonK(id);
  if (wi) wants[wi] = (wants[wi] || 2) * 4;
  const item = wpick(wants);
  let qty = RI(ty.qty[0], ty.qty[1]); if (item === wi) qty += 1;
  if (GOODS[item].base <= 10) qty += RI(1, 3); else if (GOODS[item].base <= 20) qty += RI(0, 2); // хлеб, газеты, лимонад, пиво, сигареты берут не по одной
  let tol = ty.tol + S.sk.charm * .06 + S.rep.folk / 300;
  if (S.up.fridge && GOODS[item].cold) tol += .2;
  else if (GOODS[item].cold && isSummer()) tol -= .18; // тёплое пиво летом без холодильника берут неохотно
  tol += (seasonK(item) - 1) * .25;
  const age = (S.fresh && S.fresh[item]) || 0;
  if (SHELF_LIFE[item] && age >= SHELF_LIFE[item]) tol -= .45; // чёрствый хлеб / вчерашняя газета
  if (item === wi) tol += .8;
  if (ty.young && S.outfit === 'varenki') tol += .15;
  if (k === 'newrus' && S.outfit === 'raspberry') tol += .25;
  const wtp = S.prices[item] * (1 + tol) * R(.9, 1.15);
  const pat = ty.pat * (1 + .12 * S.sk.sense);
  return { k, name: ty.name, item, qty, wtp, pat, patMax: pat, price: sellPrice(item), disc: 0, refused: 0, said: pickGreeting(k), mood: 'neutral', anim: 0 };
}
function pickGreeting(k) {
  return pick({
    babka: ['Внучек, почём нынче?', 'Ой, цены-то какие...', 'Мне бы только спросить...'],
    school: ['Здрасьте! А есть?..', 'Мне на сдачу от хлеба!', 'Вкладыши новые пришли?'],
    worker: ['Здорово, хозяин.', 'После смены — святое.', 'Зарплату опять не дали...'],
    student: ['Привет! Есть чё новенькое?', 'Стипуха пришла!', 'Слышал, новый альбом вышел?'],
    chelnok: ['Оптом возьму, если скинешь.', 'Только с поезда. Беру много.', 'Я из Польши, торопиться некуда... шучу, тороплюсь.'],
    newrus: ['Слышь, братан, давай лучшее.', 'Сдачи не надо. Шучу. Надо.', 'Мне по-быстрому, у меня стрелка.'],
  }[k] || ['Здрасьте.']);
}
function initTradeSession() {
  T = { t:0, len:900, queue:[], walking:[], cur:null, nextSpawn:.5, rev:0, cogs:0, sold:0, lost:0, specials:[], paused:false, startMoney:S.money };
  if (S.day >= 3 && (S.day === 3 || (S.debt > 0 && S.day % 2 === 1) || S.day % 4 === 3)) T.specials.push({ at: S.day === 3 ? R(28, 65) : R(50, 140), k:'racket' });
  const polChance = (S.permit ? .1 : .22) * (S.outfit === 'business' ? .5 : 1) * (S.rep.law > 30 ? .5 : 1);
  if (Math.random() < polChance) T.specials.push({ at: R(40, 250), k:'police' });
  if (Math.random() < .3) T.specials.push({ at: R(40, 250), k:'neighbor' });
  if (S.rep.folk < -40 && Math.random() < .5) T.specials.push({ at: R(20, 120), k:'boycott' });
  if (S.day >= 2 && Math.random() < .7) T.specials.push({ at: R(25, 220), k:'regular' });
  if (S.day >= 2 && Math.random() < .35) T.specials.push({ at: R(60, 300), k:'bottles' });
}
function onSitCounter() {
  if (!S || S.phase === 'night' || S.phase === 'evening') return;
  if (!T) initTradeSession();
  else T.paused = false;
  S.phase = 'trade';
  sheetOpen = false;
  sfx.door();
  if (!S.slots.some(id => id && qOf(id) > 0)) toast('Окошко поднято — ларёк открыт. Возьмите товар с полок и поставьте на стеклянную витрину у окна!');
  else toast('Окошко поднято — ларёк открыт, началась продажа', 'good');
  render();
}
function onStandCounter() {
  if (!S || S.phase !== 'trade') return;
  S.phase = 'morning';
  if (T) {
    T.paused = true;
    T.cur = null;
    T.queue = [];
    T.walking = [];
  }
  sfx.door();
  toast('Окошко опущено — ларёк закрыт');
  render();
}
function startTrade() {
  if (W) { sheetOpen = false; W.goCounter(false); }
  else onSitCounter();
}
// ---------- товар «из-под полы» на прилавке: участковый ----------
const isHidId = id => id === 'samogon' || id === 'kontra';
function contraWorldItems() {
  if (!W || !W.life) return [];
  return W.life.items.filter(it => { const g = it.data && it.data.goodId; const p = it.obj && it.obj.position;
    return (it.kind === 'good' || it.kind === 'pack') && isHidId(g) && it.state === 'rest' && p && p.y > .95 && p.z > .7 && Math.abs(p.x) < 1.5; }); // прилавок и витрина у окна
}
function contraOnDisplay() {
  let n = 0; (S.slots || []).forEach((id, i) => { if (isHidId(id)) n += (S.slotCounts && S.slotCounts[i]) || 1; });
  return n + contraWorldItems().length;
}
function contraNames() {
  const ids = new Set((S.slots || []).filter(isHidId)); for (const it of contraWorldItems()) ids.add(it.data.goodId);
  return [...ids].map(id => id === 'samogon' ? 'Самогон' : 'Контрабандные сигареты').join(' и ');
}
function confiscateDisplayed() {
  let n = 0;
  (S.slots || []).forEach((id, i) => { if (!isHidId(id)) return; const c = (S.slotCounts && S.slotCounts[i]) || 1; n += c; S.hidden[id] = Math.max(0, (S.hidden[id] || 0) - c); S.slots[i] = null; if (S.slotCounts) S.slotCounts[i] = 0; });
  for (const it of contraWorldItems()) { n += it.kind === 'pack' ? ((it.data && it.data.count) || 1) : 1; W.life.removeItem(it); }
  if (W) { W.life.persist && W.life.persist(); W.updateShelves(); }
  save(); return n;
}
function goToJail() {
  // КПЗ: весь товар «из-под полы» изымают, штраф, сутки потеряны
  let n = confiscateDisplayed();
  for (const id of Object.keys(S.hidden || {})) { n += S.hidden[id] || 0; S.hidden[id] = 0; }
  if (S.shelfPlacements) S.shelfPlacements = S.shelfPlacements.filter(p => !isHidId(p.id));
  if (W && W.life) for (const it of W.life.items.slice()) { const g = it.data && it.data.goodId; if ((it.kind === 'good' || it.kind === 'pack') && (isHidId(g) || HIDDEN[g]) && !SAFE_BOX(it)) { n++; W.life.removeItem(it); } }
  const fine = Math.round(S.money * .3);
  S.money -= fine; rep('law', -15); rep('folk', -4);
  if (T) { T = null; if (W) W.unlock(); }
  S.phase = 'evening';
  if (W) { W.P.x = 0; W.P.z = -.25; W.P.yaw = Math.PI; W.P.pitch = -.08; W.P.seated = false; W.P.locked = false; W.updateShelves(); }
  S.day++; // сутки в КПЗ
  queueCard({ title:'🚔 Ночь в КПЗ', html:`<p>Петрович составил протокол. Двое суток на нарах в отделении, пока «разбирались».</p>
    <p>Изъято товара «из-под полы»: <b>${n} шт.</b> Штраф: <b>${fmt(fine)} ₽</b>.</p><p class="muted">Закон −15, Народ −4. Ларёк всё это время стоял закрытым.</p>` });
  advanceDay(); save(); render && render();
}
// ============================================================
//  Постоянные покупатели: свои истории, которые идут от визита к визиту
// ============================================================
function regSell(id, n = 1, priceK = 1) { // быстрая продажа постоянному покупателю
  const q = Math.min(n, qOf(id)); if (q <= 0) return 0;
  const price = Math.round(sellPrice(id) * priceK), cost = takeStock(id, q), sum = price * q;
  S.money += sum; if (T) { T.rev += sum; T.cogs += cost; T.sold += q; }
  S.xp += q; sfx.ching(); floatText('+' + fmt(sum) + ' ₽'); return sum;
}
const REGULARS = {
  mihalych: { name: 'Дед Михалыч', k: 'worker', want: 'paper', steps: [
    r => ({ said: 'Здорово, сынок. Дядю Толю твоего знал — на заводе вместе сорок лет. «Правду» дай, посмотрю, что там опять наобещали.', opts: [
      { label: 'Продать газету', cls: 'green', fn() { regSell('paper'); r.rel++; } },
      { label: 'Отдать даром — «за дядю Толю»', fn() { if (qOf('paper')) { takeStock('paper', 1); } r.rel += 2; rep('folk', 2); toast('Михалыч растрогался. Народ +2', 'good'); } }] }),
    r => ({ said: 'Пенсию опять задержали на три месяца. Медаль «За отвагу» на рынке предлагали продать... Не продам. Дай хоть пачку «Космонавта» в долг?', opts: [
      { label: 'Дать в долг', cls: 'green', fn() { if (qOf('cig')) takeStock('cig', 1); r.rel += 2; r.owes = true; rep('folk', 2); toast('«Отдам, ей-богу». Народ +2', 'good'); } },
      { label: 'Продать за деньги', fn() { regSell('cig'); } },
      { label: 'Отказать', cls: 'red', fn() { r.rel -= 2; rep('folk', -1); } }] }),
    r => ({ said: r.owes ? 'Вот, держи за сигареты — пенсию дали. И слушай: вчера у гаражей ваши «заводские» говорили, что к тебе с проверкой придут. Будь начеку.' : 'Вчера у гаражей «заводские» шептались про твой ларёк. Не нравится мне это.', opts: [
      { label: 'Спасибо, Михалыч', cls: 'green', fn() { if (r.owes) { S.money += sellPrice('cig'); r.owes = false; } S.flags.racketWarned = true; r.rel++; toast('Предупреждён — значит вооружён. Рэкет будет просить меньше', 'good'); } }] }),
    r => ({ said: r.rel >= 4 ? 'Сынок, я тебе часы свои командирские принёс — мне уже ни к чему, а ты человек хороший. Носи.' : 'Ну, бывай. Газетку возьму.', opts: r.rel >= 4 ? [
      { label: 'Взять подарок', cls: 'green', fn() { S.usd += 15; rep('folk', 4); S.flags.mihalychWatch = true; toast('Командирские часы — на рынке за них дают $15. Народ +4', 'good'); } },
      { label: 'Отказаться: «Оставьте себе»', fn() { rep('folk', 6); toast('Михалыч прослезился и всем во дворе рассказал. Народ +6', 'good'); } }] : [
      { label: 'Продать газету', cls: 'green', fn() { regSell('paper'); } }] }),
  ] },
  olya: { name: 'Студентка Оля', k: 'student', female: true, want: 'tape', steps: [
    r => ({ said: 'Привет! А у вас «Кино» есть? Хоть что-нибудь... Я на гитаре учусь, разбираю «Звезду по имени Солнце».', opts: [
      { label: qOf('tape') ? 'Продать кассету' : 'Кассет пока нет', cls: 'green', fn() { if (regSell('tape')) r.rel += 2; else r.rel++; } },
      { label: '«Я тоже играю на гитаре»', fn() { r.rel += 2; r.guitar = true; toast('Оля оживилась: «Правда? Сыграешь как-нибудь?»'); } }] }),
    r => ({ said: r.guitar ? 'Слушай, я тебе самоучитель принесла — там бой «восьмёрка» и аккорды. Если играть в людном месте, народ кидает мелочь!' : 'Есть что новенькое из кассет? Стипуху дали!', opts: r.guitar ? [
      { label: 'Взять самоучитель', cls: 'green', fn() { S.flags.guitarBook = true; r.rel++; toast('Самоучитель гитары: за игру на улице подают больше', 'good'); } }] : [
      { label: 'Продать кассету', cls: 'green', fn() { regSell('tape'); r.rel++; } },
      { label: 'Нечего предложить', fn() {} }] }),
    r => ({ said: 'Мы с ребятами в субботу играем у остановки. Можно мы возле твоего ларька постоим? Народ соберётся — и тебе торговля!', opts: [
      { label: 'Конечно, играйте', cls: 'green', fn() { S.flags.olyaBandDay = S.day + 1; r.rel += 2; rep('folk', 2); toast('Завтра у ларька будут играть — покупателей станет больше. Народ +2', 'good'); } },
      { label: 'Не надо, милиция гонять будет', fn() { r.rel -= 1; } }] }),
    r => ({ said: 'Спасибо тебе! Вот, мы с ребятами скинулись на кассету со своими песнями — первая запись. Продавай, если захочешь.', opts: [
      { label: 'Взять кассеты', cls: 'green', fn() { addStock('tape', 5, 0); rep('folk', 3); toast('+5 кассет «Оля и Ко» на склад бесплатно. Народ +3', 'good'); } }] }),
  ] },
  serega: { name: 'Афганец Серёга', k: 'worker', want: 'beer', steps: [
    r => ({ said: 'Пивка дай. Завод третий месяц зарплату водкой да тушёнкой выдаёт... Ты не смотри, что я хмурый.', opts: [
      { label: 'Продать пиво', cls: 'green', fn() { regSell('beer', 2); r.rel++; } },
      { label: 'Продать со скидкой «для своих»', fn() { regSell('beer', 2, .8); r.rel += 2; } }] }),
    r => ({ said: 'Возьмёшь у меня тушёнку оптом? Нам на заводе ей зарплату дали. Отдам дёшево — деньги нужны, жена болеет.', opts: [
      { label: 'Купить 6 банок по себестоимости', cls: 'green', disabled: S.money < Math.round(S.prices.tushonka * 6 * .6), fn() { const cost = Math.round(S.prices.tushonka * .6); S.money -= cost * 6; addStock('tushonka', 6, cost); r.rel += 2; toast('Серёга благодарно кивнул: «Не забуду»', 'good'); } },
      { label: 'Не нужно', fn() { r.rel -= 1; } }] }),
    r => ({ said: 'Слышал, к тебе гопота с района цепляется. Если что — я рядом. Я в Кандагаре и не таких видел.', opts: [
      { label: '«Буду благодарен»', cls: 'green', fn() { if (r.rel >= 3) { S.flags.seregaGuard = S.day + 6; toast('Серёга присмотрит за ларьком: гопники будут обходить его стороной (6 дней)', 'good'); } else toast('Серёга пожал плечами: «Посмотрим»'); r.rel++; } }] }),
    r => ({ said: 'На вокзале вагоны разгружать надо, бригада ищет крепких. Платят сразу и в валюте. Если надумаешь — приходи к утру.', opts: [
      { label: 'Помочь Серёге с разгрузкой (весь вечер)', cls: 'green', fn() { const pay = 6 + Math.round(Math.random() * 6); S.usd += pay; S.hunger = Math.max(0, (S.hunger ?? 100) - 25); rep('street', 3); toast(`Разгрузили вагон с сахаром: +$${pay}. Устали и проголодались. Улица +3`, 'good'); } },
      { label: 'Некогда', fn() {} }] }),
  ] },
  nyura: { name: 'Баба Нюра', k: 'babka', female: true, want: 'bread', steps: [
    r => ({ said: 'Сыночек, буханочку «Дарницкого» да кильку. Внук Витька опять со шпаной у гаражей пропадает, сердце не на месте...', opts: [
      { label: 'Продать', cls: 'green', fn() { regSell('bread'); regSell('kilka'); r.rel++; } },
      { label: 'Продать и поговорить с Витькой', fn() { regSell('bread'); r.rel += 2; r.talkVitka = true; toast('Обещали присмотреть за Витькой'); } }] }),
    r => ({ said: r.talkVitka ? 'Витька говорит, ты ему сказал дело. Может, возьмёшь его ящики носить? Пусть при деле будет, а не по подворотням.' : 'Ох, Витьку вчера в милицию забирали... Хлебушка дай.', opts: r.talkVitka ? [
      { label: 'Взять Витьку в помощники', cls: 'green', fn() { S.flags.vitkaHelper = true; r.rel += 2; rep('folk', 3); toast('Витька будет приносить заказы с остановки: доставка дешевле. Народ +3', 'good'); } },
      { label: 'Отказать', fn() { r.rel--; } }] : [
      { label: 'Продать хлеб', cls: 'green', fn() { regSell('bread'); } }] }),
    r => ({ said: 'Я тебе пирожков с капустой напекла. Горяченькие ещё! Кушай, худой совсем.', opts: [
      { label: 'Взять пирожки', cls: 'green', fn() { S.hunger = Math.min(100, (S.hunger ?? 100) + 45); S.hp = Math.min(S.maxHp || 100, (S.hp ?? 100) + 15); rep('folk', 2); toast('Пирожки бабы Нюры — лучшие во дворе! Сытость +45, Здоровье +15', 'good'); } }] }),
    r => ({ said: 'Носки тебе связала, шерстяные, на зиму. В ларьке-то холодно сидеть. Бери-бери!', opts: [
      { label: 'Спасибо, баба Нюра!', cls: 'green', fn() { S.flags.woolSocks = true; rep('folk', 4); toast('Шерстяные носки: на морозе голод тратится медленнее. Народ +4', 'good'); } }] }),
  ] },
};
function regularVisitor() {
  S.regs = S.regs || {};
  const due = Object.keys(REGULARS).filter(id => { const r = S.regs[id]; return !r || (r.step < REGULARS[id].steps.length && S.day >= (r.next || 0)); });
  if (!due.length) return null;
  const id = pick(due), R0 = REGULARS[id];
  const r = S.regs[id] || (S.regs[id] = { step: 0, rel: 0, next: 0 });
  const st = R0.steps[r.step](r);
  const opts = st.opts.map(o => Object.assign({}, o, { fn() { o.fn(); r.step++; r.next = S.day + 1 + (Math.random() < .5 ? 1 : 0); save(); } }));
  return { special: 'regular', k: R0.k, regular: id, female: !!R0.female, name: R0.name + (r.step ? '' : ' (новый знакомый)'), mood: 'neutral', pat: 999, patMax: 999, anim: 0, said: st.said, opts };
}
function specialVisitor(k) {
  if (k === 'regular') return regularVisitor();
  if (k === 'bottles') { // приём стеклотары через окошко: берём дёшево, вечером сдаём в пункт приёма дороже
    const n = RI(4, 14), each = Math.max(1, Math.round(S.idx * .6));
    return { special: k, k: Math.random() < .5 ? 'worker' : 'babka', name: 'Сдатчик бутылок', mood: 'neutral', pat: 999, patMax: 999, anim: 0,
      said: `Хозяин, бутылки примешь? ${n} штук, чистые. По ${fmt(each)} ₽ отдам — до пункта приёма далеко, а он вечно «на переучёте».`,
      opts: [
        { label: `Принять ${n} шт. за ${fmt(n * each)} ₽`, cls: 'green', disabled: S.money < n * each, fn() { S.money -= n * each; S.bottles = (S.bottles || 0) + n; S.bottleCost = (S.bottleCost || 0) + n * each; rep('folk', .5); sfx.click(); toast(`+${n} бутылок в ящике под прилавком. Вечером сдадите в пункт приёма дороже`, 'good'); } },
        { label: 'Не принимаем', fn() {} }] };
  }
  if (k === 'racket') {
    if (S.debt > 0) {
      const rateRub = Math.round(S.rate * 1.04);
      const fullRub = S.debt * rateRub;
      const canUsd = Math.min(S.debt, S.usd + Math.floor(S.money / rateRub));
      const partUsd = Math.min(S.debt, Math.max(1, Math.min(40, canUsd)));
      const partNeedRub = Math.max(0, partUsd - S.usd) * rateRub;
      const fullNeedRub = Math.max(0, S.debt - S.usd) * rateRub;
      const opts = [];
      if (canUsd >= S.debt) {
        opts.push({
          label: `Отдать весь долг $${S.debt} (${fullNeedRub > 0 ? fmt(fullNeedRub) + ' ₽' : 'валютой'})`,
          cls: 'green',
          fn() {
            const u = Math.min(S.usd, S.debt), r = (S.debt - u) * rateRub;
            S.usd -= u; S.money -= r; S.debt = 0;
            sfx.ching(); rep('street', 8);
            toast('Колян пересчитал пачку: «Красава, долг дяди Толи полностью закрыт! Торгуй спокойно». Улица +8', 'good');
            save();
          }
        });
      }
      if (S.debt > 1) {
        opts.push({
          label: canUsd >= 1 ? `Отдать часть долга: $${partUsd} (${partNeedRub > 0 ? fmt(partNeedRub) + ' ₽' : 'валютой'})` : `Отдать часть долга (нет денег)`,
          cls: 'yellow',
          disabled: canUsd < 1,
          fn() {
            if (canUsd < 1) return;
            const u = Math.min(S.usd, partUsd), r = (partUsd - u) * rateRub;
            S.usd -= u; S.money -= r; S.debt -= partUsd;
            sfx.coin(); rep('street', 4);
            toast(S.debt > 0 ? `Колян спрятал деньги в кожанку: «Ладно, записал. За тобой ещё $${S.debt} — не тяни, коммерс!» Улица +4` : 'Долг полностью закрыт!', 'good');
            save();
          }
        });
      }
      opts.push(
        {
          label: 'Попросить отсрочку («Пока пусто в кассе, пацаны»)',
          fn() {
            rep('street', -6); S.flags.angryRacket = true;
            toast('Колян ударил кулаком по стеклу витрины: «Счётчик тикает! Не соберёшь бабки к следующему разу — ларёк спалим!» Улица −6', 'bad');
            save();
          }
        },
        {
          label: 'Послать («Ничего я вам не отдам!»)',
          cls: 'red',
          fn() {
            rep('street', -10); S.flags.angryRacket = true;
            toast('Колян: «Ты чё, фраер, берега попутал?! Пацаны, проучим коммерса!» Улица −10', 'bad');
            if (W && T && T.cur && T.cur.person) {
              T.cur.person.brawling = true; T.cur.person.state = 'brawl';
              if (T.cur.person.buddy) { T.cur.person.buddy.brawling = true; T.cur.person.buddy.state = 'brawl'; }
            }
            save();
          }
        }
      );
      return {
        special: k, k: 'racket', name: '«Заводские» бандиты (Колян и Бык)', mood: 'angry', pat: 999, patMax: 999, anim: 0,
        said: `Слышь, малой! За этот ларёк твоего покойного дяди Толи за тобой висит долг «заводским» — $${S.debt} (${fmt(fullRub)} ₽ по курсу). Гони бабки на бочку, или пеняй на себя — разговор короткий!`,
        opts
      };
    }
    const disc = (S.outfit === 'sport' ? .7 : 1) * (S.rep.street >= 40 ? .5 : 1) * (S.flags.racketWarned ? .8 : 1);
    const ask = Math.max(usdToRub(5), Math.round(S.money * .06 * disc));
    return { special:k, k:'racket', name:'«Заводские» бандиты (Колян и Бык)', mood:'angry', pat:999, patMax:999, anim:0,
      said: S.flags.underRoof ? `Ну что, свои люди. За крышу — ${fmt(ask)} ₽, как договаривались.` : `Слышь, ларёк у остановки — наша территория. С тебя ${fmt(ask)} ₽ за спокойствие.`,
      opts: [
        { label:`Заплатить ${fmt(ask)} ₽`, cls:'yellow', disabled: S.money < ask, fn() { if (S.money < ask) { toast('Не хватает денег!', 'bad'); rep('street', -5); S.flags.angryRacket = true; return; } S.money -= ask; rep('street', 4); toast('Колян доволен. Улица +4'); } },
        { label:'Отказать', cls:'red', fn() { rep('street', -8); S.flags.angryRacket = true; toast('Колян: «Ну смотри...» Улица −8', 'bad'); } },
        { label:'Позвать милицию', fn() {
          if (S.rep.law >= 0) { rep('law', 5); rep('street', -12); toast('Наряд спугнул Коляна. Закон +5, Улица −12'); }
          else { rep('street', -10); S.flags.angryRacket = true; toast('Милиция не приехала. Колян всё понял. Улица −10', 'bad'); }
        } },
      ] };
  }
  if (k === 'police') {
    const bribe = Math.round(usdToRub(5) * (S.outfit === 'raspberry' ? 1.6 : 1) * (S.outfit === 'business' ? .6 : 1));
    return { special:k, k:'police', name:'Участковый Петрович', mood:'neutral', pat:999, patMax:999, anim:0,
      said:'Здравия желаю. Документики на торговлю имеются? Санитарные нормы соблюдаем?',
      opts: [
        S.permit ? { label:'Показать разрешение', cls:'green', fn() { rep('law', 3); toast('Всё в порядке. Закон +3', 'good'); } }
                 : { label:'Показать разрешение', disabled:true },
        { label:`Дать «на чай» ${fmt(bribe)} ₽`, cls:'yellow', disabled: S.money < bribe, fn() { if (S.money < bribe) { toast('Денег нет — Петрович недоволен', 'bad'); rep('law', -5); return; } S.money -= bribe; rep('law', 2); toast('Петрович козырнул и ушёл. Закон +2'); } },
        { label:'Спорить', cls:'red', fn() {
          rep('law', -6);
          let lost = 0; for (const id of GOOD_IDS) { const n = Math.floor(qOf(id) * .2); if (n) { takeStock(id, n); lost += n; } }
          toast(`Изъяли «до выяснения» ${lost} шт. товара. Закон −6`, 'bad');
        } },
      ] };
  }
  if (k === 'contra') {
    const name = 'Участковый Петрович';
    if (!contraOnDisplay()) return { special:k, k:'police', name, mood:'neutral', pat:999, patMax:999, anim:0,
      said:'Сигнал был, что у тебя тут из-под полы торгуют... Ладно, вижу — чисто. Но смотри у меня.',
      opts: [{ label:'Всего доброго, товарищ лейтенант', cls:'green', fn() { rep('law', 1); } }] };
    const what = contraNames();
    const bribe = Math.round(Math.max(usdToRub(15), S.money * .12) * (S.outfit === 'business' ? .7 : 1) * (S.outfit === 'raspberry' ? 1.4 : 1));
    return { special:k, k:'police', name, mood:'angry', pat:999, patMax:999, anim:0,
      said:`Так-так, гражданин... ${what} — прямо на прилавке? Это, между прочим, статья. Самогон и контрабанда без накладных. Будем оформлять?`,
      opts: [
        { label:`Сунуть ${fmt(bribe)} ₽ «за беспокойство»`, cls:'yellow', disabled: S.money < bribe, fn() {
          if (S.money < bribe) { toast('Денег не хватило — Петрович обиделся. Пройдёмте…', 'bad'); setTimeout(goToJail, 0); return; }
          S.money -= bribe; rep('law', -3); sfx.ching();
          toast('Петрович убрал деньги в планшет: «Я ничего не видел. Но чтоб к вечеру этого на прилавке не было!» Закон −3', 'bad');
          T.contraDone = false; T.contraT = 0; T.contraAt = R(60, 110); // не убрал — придёт снова
        } },
        { label:'Договориться: «Это вам — на экспертизу»', fn() {
          const n = confiscateDisplayed(); rep('law', 1);
          toast(`Петрович забрал ${n} шт. «вещдоков» себе: «Протокол составлять не будем». Закон +1`);
        } },
        { label:'«Это не моё, подбросили!»', cls:'red', fn() {
          if (S.rep.law >= 25 && Math.random() < .55) { const n = confiscateDisplayed(); rep('law', -2); toast(`Петрович поверил на слово, но ${n} шт. изъял. Закон −2`, 'bad'); }
          else { toast('«Подбросили, говоришь? В отделении разберёмся.»', 'bad'); setTimeout(goToJail, 0); }
        } },
        { label:'Пройти в отделение', fn() { setTimeout(goToJail, 0); } },
      ] };
  }
  if (k === 'neighbor') {
    const id = pick(GOOD_IDS.filter(x => qOf(x) >= 2)) || null;
    if (!id) return null;
    return { special:k, k:'neighbor', name:'Соседка тётя Валя', mood:'neutral', pat:999, patMax:999, anim:0,
      said:`Милок, дай ${GOODS[id].short.toLowerCase()} пару штук в долг, а? Пенсию задерживают...`,
      opts: [
        { label:'Дать в долг (2 шт.)', cls:'green', fn() { takeStock(id, 2); rep('folk', 5); toast('Тётя Валя расскажет всему двору. Народ +5', 'good'); if (Math.random() < .5) S.flags.valyaPays = true; } },
        { label:'Отказать', fn() { rep('folk', -3); toast('Тётя Валя обиделась. Народ −3', 'bad'); } },
      ] };
  }
  if (k === 'boycott') {
    return { special:k, k:'babka', name:'Бабушки со двора', mood:'angry', pat:999, patMax:999, anim:0,
      said:'Спекулянт! Мы всем расскажем, какие у тебя цены! Не ходите сюда, люди!',
      opts: [
        { label:'Извиниться и скинуть цены (наценка 20%)', cls:'green', fn() { S.markup = Math.min(S.markup, .2); rep('folk', 6); toast('Бабушки смягчились. Народ +6', 'good'); } },
        { label:'Не обращать внимания', fn() { rep('folk', -4); T.boycott = true; toast('Покупателей сегодня будет меньше', 'bad'); } },
      ] };
  }
  return null;
}
function tradeTick(dt) {
  if (!T || T.paused || S.phase !== 'trade') return;
  T.t += dt;
  // особые
  for (const sp of T.specials) if (!sp.done && T.t >= sp.at && !T.cur) {
    sp.done = true; const v = specialVisitor(sp.k);
    if (v) { if (W) { T.walking.push(v); W.spawnCustomer(v); } else { T.cur = v; sfx.door(); renderTrade(); return; } }
  }
  // товар «из-под полы» выставлен на прилавок/витрину — через некоторое время заглянет участковый
  if (!T.contraDone) {
    if (contraOnDisplay() > 0) { T.contraT = (T.contraT || 0) + dt; if (!T.contraAt) T.contraAt = R(25, 55); if (T.contraT >= T.contraAt) { T.contraDone = true; T.specials.push({ at: T.t, k:'contra' }); } }
    else T.contraT = Math.max(0, (T.contraT || 0) - dt * .5);
  }
  // спавн
  T.nextSpawn -= dt;
  if (T.nextSpawn <= 0 && T.t < T.len - 4 && S.slots.some(id => id && qOf(id) > 0)) {
    if (T.queue.length + T.walking.length < 6) { const c = makeCustomer(); if (W) { T.walking.push(c); W.spawnCustomer(c); } else T.queue.push(c); }
    T.nextSpawn = (W ? R(10, 19) : R(6, 11)) / traffic() * (T.boycott ? 1.8 : 1);
  }
  if (!T.cur && T.queue.length) { T.cur = T.queue.shift(); T.cur.anim = 0; sfx.door(); renderTrade(); }
  // терпение
  const c = T.cur;
  if (c && !c.special) {
    c.pat -= dt;
    const pb = document.getElementById('patBar'); if (pb) pb.style.width = clamp(c.pat / c.patMax * 100, 0, 100) + '%';
    if (c.pat <= 0) { T.lost++; c.said = 'Ну и ладно!'; leave(); }
  }
  // Синдром Очереди, магнитофон («Звук как ресурс») и Коллективный разум очереди
  tickQueueAndSound(dt);
  const tb = document.getElementById('tBar'); if (tb) tb.style.width = clamp(100 - T.t / T.len * 100, 0, 100) + '%';
  if (T.t >= T.len && (!T.cur || !T.cur.special)) endTrade();
}
// покупатель дошёл до очереди у окна (сообщает 3D-мир)
function arrive(c) {
  if (!T) return; T.walking = T.walking.filter(x => x !== c);
  if (c.special) T.queue.unshift(c); else T.queue.push(c);
  if (c.special) sfx.door();
}
// покупателя напугали ружьём
function customerScared(c) {
  if (!T || !c) return;
  if (c.special) {
    if (c.k === 'racket') { rep('street', -10); S.flags.angryRacket = true; toast('Колян: «Ты чё, ствол на нас наставил? Ну, жди гостей…» Улица −10', 'bad'); }
    else if (c.k === 'police') { rep('law', -20); S.gun = false; S.gunState = 'gone'; if (W && W.weapon.forceHolster) W.weapon.forceHolster(); toast('Навести ружьё на участкового?! Ружьё изъяли. Закон −20', 'bad'); }
    else rep('folk', -3);
  } else { T.lost++; rep('folk', -2); c.lostAngry = true; }
  if (T.cur === c) T.cur = null; T.queue = T.queue.filter(q => q !== c); T.walking = T.walking.filter(q => q !== c);
  renderTrade();
}
function leave() { T.cur = null; renderTrade(); }
// субтитры в реальном времени: слова появляются синхронно с записью (тайминги по словам)
let subsRaf = 0;
function subtitles(name, words, start) {
  const el = document.getElementById('subs'); if (!el) return; cancelAnimationFrame(subsRaf);
  el.innerHTML = `<b>${name}:</b>` + words.map((w, i) => `<span class="w" data-i="${i}">${w[2]} </span>`).join(''); el.classList.add('on');
  const t0 = start != null ? start : null, p0 = performance.now(), spans = el.querySelectorAll('.w'), end = words[words.length - 1][1];
  const step = () => { const t = (performance.now() - p0) / 1000; // звук запущен в этот же момент
    words.forEach((w, i) => { spans[i].classList.toggle('on', t >= w[0] - .05); spans[i].classList.toggle('cur', t >= w[0] - .05 && t < w[1] + .1); });
    if (t > end + 1.8) { el.classList.remove('on'); return; } subsRaf = requestAnimationFrame(step); };
  step();
}
// человек вырублен в кулачном бою (нокаут без убийства)
function onPunchHit(hit, dmg, hpLeft, maxHp, isHeavy) {
  if (!S) return;
  const label = isHeavy ? `🥊 МОЩНЫЙ ХУК! −${dmg} HP` : `🥊 Удар! −${dmg} HP`;
  floatText(hpLeft > 0 ? `${label} (${hpLeft}/${maxHp})` : `🥊 НОКАУТ! −${dmg} HP`, isHeavy ? '#ffbb33' : '#ff7755');
}
function healPlayer(amount, reasonTxt) {
  if (!S) return;
  if (S.hp == null) S.hp = 100;
  if (!S.maxHp) S.maxHp = 100;
  const before = S.hp;
  S.hp = Math.min(S.maxHp, S.hp + amount);
  if (W && W.P) W.P.hp = S.hp;
  if (S.bodyParts) {
    for (const k of Object.keys(S.bodyParts)) {
      S.bodyParts[k] = Math.min(100, (S.bodyParts[k] ?? 100) + amount * 1.15);
    }
  }
  renderHud();
  save();
  if (reasonTxt) {
    toast(reasonTxt, 'good');
  }
}
function onPlayerPunched(attacker, hpLeft, forcedZone = null, isGunshot = false) {
  if (!S) return;
  const prevHp = S.hp ?? 100;
  S.hp = clamp(hpLeft, 0, S.maxHp || 100);
  const dmg = Math.max(4, prevHp - S.hp);
  S.bodyParts = S.bodyParts || { head: 100, torso: 100, armL: 100, armR: 100, legL: 100, legR: 100 };
  const hitTarget = forcedZone || pick(['head', 'torso', 'torso', 'armL', 'armR']);
  S.bodyParts[hitTarget] = clamp((S.bodyParts[hitTarget] ?? 100) - dmg * 2.2, 0, 100);
  renderHud();
  if (isGunshot && (hitTarget === 'legL' || hitTarget === 'legR')) {
    floatText(`Пуля попала в ногу! (${S.hp} HP)`, '#ff6644');
    toast(`Пуля попала в ногу — вы ранены, но остаётесь на ногах (${S.hp} HP)!`, 'bad');
  } else if (isGunshot && (hitTarget === 'armL' || hitTarget === 'armR')) {
    floatText(`Пуля задела руку! (${S.hp} HP)`, '#ff6644');
    toast(`Пуля попала в руку — ранение не смертельное (${S.hp} HP)!`, 'bad');
  } else {
    floatText(`Пропустили удар! Здоровье: ${S.hp}`, '#ff4444');
  }
}
function onPlayerBlocked(attacker, hpLeft) {
  if (!S) return;
  S.hp = clamp(hpLeft, 0, S.maxHp || 100);
  renderHud();
  floatText(`🛡 БЛОК! Удар отбит (${S.hp} HP)`, '#66ccff');
}
function onKnockout(role, c, kind) {
  if (!S) return;
  gainSkillXp('sense', 30, 'Победа в кулачном бою');
  if (role === 'gop' || (c && c.k === 'racket')) {
    const loot = RI(90, 320);
    S.money += loot;
    S.xp += 3; checkLevel();
    rep('street', 3);
    toast(`Нокаут! Противник вырублен, из карманов выпало +${fmt(loot)} ₽! Улица +3, Опыт +3`, 'good');
  } else if (kind === 'police' || (c && c.k === 'police')) {
    rep('law', -18);
    toast('Вырубили милиционера! По району объявлен розыск. Закон −18', 'bad');
  } else {
    rep('folk', -5); rep('law', -4);
    toast('Нокаут! Человек без сознания на снегу (скоро очнётся). Народ −5, Закон −4', 'bad');
  }
  if (T && c) { if (T.cur === c) T.cur = null; T.queue = T.queue.filter(q => q !== c); T.walking = (T.walking || []).filter(q => q !== c); T.lost++; renderTrade(); }
  save(); renderHud();
}
// человек убит (из ружья или добит повторным нокаутом после отключки): тяжёлые последствия, он мёртв окончательно
function onKill(role, c, kind, bySecondKo = false) {
  if (!S) return;
  S.flags.kills = (S.flags.kills || 0) + 1;
  if (bySecondKo) {
    rep('law', -30); rep('folk', -15);
    toast('Повторный нокаут после отключки оказался смертельным — человек умер окончательно! Закон −30, Народ −15', 'bad');
  } else if (role === 'gop') { rep('street', -6); rep('law', -10); toast('Гопник убит. Свидетели разбежались. Закон −10, Улица −6', 'bad'); }
  else if (c && c.k === 'police') { rep('law', -60); S.gun = false; S.gunState = 'gone'; if (W && W.weapon.forceHolster) W.weapon.forceHolster(); toast('Убит участковый. Ружьё конфисковано, по району ищут стрелка. Закон −60', 'bad'); }
  else if (role === 'marat') { rep('street', -25); rep('law', -15); toast('Марат убит. Улица этого не простит. Улица −25, Закон −15', 'bad'); }
  else { rep('law', -30); rep('folk', -15); toast('Убит человек. Закон −30, Народ −15', 'bad'); }
  sfx.bad && sfx.bad();
  if (T && c) { if (T.cur === c) T.cur = null; T.queue = T.queue.filter(q => q !== c); T.walking = (T.walking || []).filter(q => q !== c); T.lost++; renderTrade(); }
  save(); renderHud();
}
function custStatus(c) {
  const id = c.item, q = qOf(id), onVit = displayed(id);
  if (!onVit && q > 0) return { ok:false, msg:'Есть на полке, но нет на витрине! Возьмите с полки и поставьте на витрину.' };
  if (!onVit || q === 0) return { ok:false, msg:'Такого нет.' };
  return { ok:true, n: Math.min(q, c.qty), msg: q < c.qty ? `Есть только ${q} из ${c.qty}` : '' };
}
function moodOf(c) {
  const r = c.price / c.wtp;
  return r <= .85 ? 'happy' : r <= 1 ? 'neutral' : 'angry';
}
function tradePanelHtml() {
  return `<div class="tp"><div class="timer"><i id="tBar" style="width:${clamp(100 - T.t / T.len * 100, 0, 100)}%"></i></div>
    <div id="cust">${custHtml()}</div>
    <div class="tstat"><span>ВЫРУЧКА ${fmt(T.rev)} ₽ · ПРОДАНО ${T.sold} · УШЛИ ${T.lost}</span></div></div>`;
}
function custHtml() {
  const c = T.cur;
  if (!c) return `<div class="bubble"><div class="say">${T.t >= T.len - 4 ? 'Народ расходится. Скоро закрываться.' : 'Пока никого... Слышно, как едет автобус.'}</div></div>`;
  if (c.special) {
    return `<div class="bubble"><div class="who">${c.name}</div><div class="say">«${esc(c.said)}»</div></div>
      <div class="mbtns">${c.opts.map((o, i) => `<button class="btn ${o.cls || ''}" data-opt="${i}" ${o.disabled ? 'disabled' : ''}>${o.label}</button>`).join('')}</div>`;
  }
  const g = GOODS[c.item], st = custStatus(c);
  c.mood = moodOf(c);
  const moodIc = c.mood === 'happy' ? '😊' : c.mood === 'neutral' ? '🤔' : '😠';
  const sense = S.sk.sense >= 2 ? ` <span class="chip">готов дать ~${fmt(c.wtp)} ₽</span>` : '';
  return `<div class="bubble">
      <div class="who">${c.name} ${moodIc}</div>
      <div class="want">${g.icon} ${g.short} × ${c.qty}</div>
      <div class="say">«${esc(c.said)}»</div>
      <div class="row sp" style="margin-top:4px"><span>Ваша цена: <b>${fmt(c.price)} ₽</b>/шт${c.disc ? ` <span class="chip">−${c.disc * 10}%</span>` : ''}${sense}</span></div>
      ${st.msg ? `<div class="warn">${st.msg}</div>` : ''}
      <div class="pat"><i id="patBar" style="width:${clamp(c.pat / c.patMax * 100, 0, 100)}%"></i></div>
    </div>
    ${queueSyndromeHtml()}
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px">
      ${hiddenCount() > 0 ? '<button class="btn small" data-a="hiddenOffer">🤫 Из-под полы…</button>' : ''}
      ${((S.blackMarket && (S.blackMarket.dilutedStock > 0 || S.blackMarket.relabeledVodka > 0 || S.blackMarket.giftSets > 0))) ? '<button class="btn small yellow" data-a="sellBlackMarket">🕵️ Впарить самопал / набор</button>' : ''}
      ${(T.queue && T.queue.length > 0) ? `<button class="btn small" data-a="bribeLeave" title="Дать мелочь, чтобы не задерживал очередь">💸 Откупиться от задержки (25 ₽)</button><button class="btn small blue" data-a="swapQueue" title="Пропустить нетерпеливого покупателя из очереди вперёд">🔄 Поменять местами с очередью</button>` : ''}
      <button class="btn small" data-a="cassetteDeck">📼 Кассета: ${cassetteBadgeTxt()}</button>
    </div>
    <div class="acts">
      <button class="btn green" data-a="sell" ${st.ok ? '' : 'disabled'}>Продать${st.ok ? ' ' + st.n + ' шт' : ''}</button>
      <button class="btn yellow" data-a="discount" ${st.ok ? '' : 'disabled'}>Скинуть 10%</button>
      <button class="btn blue" data-a="credit" ${st.ok ? '' : 'disabled'} title="Записать в тетрадь долгов (+25% через 2 дня)">📓 В долг</button>
      <button class="btn" data-a="next">${st.ok ? 'Отказать' : 'Нету'}</button>
    </div>`;
}
function renderTrade() {
  if (!S || S.phase !== 'trade' || !T) return;
  $('#tradePanel').innerHTML = tradePanelHtml();
  renderHud();
  if (W) W.updateShelves();
  if (sheetOpen && tab === 'kiosk') { const vit = document.querySelector('#screen .vit'); if (vit) vit.outerHTML = vitrineHtml(); }
}
function act(a) {
  const c = T && T.cur; if (!c || c.special || T.paused) return;
  if (a === 'next') { T.lost++; c.said = 'Эх...'; sfx.click(); leave(); return; }
  const st = custStatus(c); if (!st.ok) return;
  if (a === 'discount') {
    const floor = Math.round(S.prices[c.item] * .7);
    c.price = Math.max(floor, Math.round(c.price * .9)); c.disc++;
    c.pat -= c.patMax * .12;
    c.said = c.price / c.wtp <= 1 ? 'О, другое дело!' : pick(['А чего так дорого-то?', 'Ещё скинь!', 'Да ну, на рынке дешевле.']);
    if (W) W.customerEvent(c, 'talk');
    sfx.click(); renderTrade(); return;
  }
  if (a === 'credit') {
    S.debtBook = S.debtBook || [];
    const sum = Math.round(c.price * st.n * 1.25);
    const cost = takeStock(c.item, st.n);
    T.cogs += cost; T.sold += st.n;
    S.debtBook.push({ who: c.name, item: GOODS[c.item].short, sum, dueDay: S.day + 2 });
    rep('folk', 2.5);
    S.xp += st.n + 1;
    sfx.click();
    toast(`Записали в Тетрадь долгов: ${c.name} вернёт ${fmt(sum)} ₽ через 2 дня! (Народ +3)`, 'good');
    c.said = 'Дай Бог здоровья! С получки сразу занесу с надбавкой!';
    if (W) W.customerEvent(c, 'sold');
    gainSkillXp('trade', 16, '');
    checkLevel();
    leave();
    return;
  }
  if (a === 'sell') {
    const r = c.price / c.wtp;
    if (r <= 1 || (r <= 1.12 && Math.random() < .35)) {
      if (Math.random() < 0.24 && c.price * st.n >= 20) { crumpledBillGame(c, st.n); return; }
      if (Math.random() < (c.k === 'chelnok' ? .14 : .06) && c.price * st.n > usdToRub(1)) { fakeBillGame(c, st.n); return; }
      if (SET.changeGame !== false && changeGameFits(c, st.n) && Math.random() < .45) { changeGame(c, st.n); return; }
      completeSale(c, st.n);
    } else {
      c.refused++; c.pat -= c.patMax * .3;
      c.said = pick(['Сколько?! Совсем обалдели!', 'Дорого! Скинь чуток.', 'За такие деньги я в Польшу съезжу.']);
      if (r > 1.4 && c.refused === 1) rep('folk', -1);
      if (W) W.customerEvent(c, 'refused');
      sfx.bad(); renderTrade();
    }
  }
}
function completeSale(c, n, fake = false) {
  const sum = c.price * n;
  const cost = takeStock(c.item, n);
  S.money += sum; T.rev += sum; T.cogs += cost; T.sold += n;
  if (fake) S.fakeLoss += sum;
  S.xp += n;
  if (c.price / c.wtp < .7) rep('folk', .4);
  floatText('+' + fmt(sum) + ' ₽');
  sfx.ching();
  c.said = pick(['Спасибо!', 'Бывай!', 'Ещё зайду.', 'Нормально.']);
  if (W) W.customerEvent(c, 'sold');
  gainSkillXp('trade', 14 * Math.max(1, Math.min(3, n)), '');
  checkLevel();
  leave();
}
// ---- сдача руками: покупатель даёт крупную купюру, сдачу отсчитываем из кассы сами ----
const CASH_DENOMS = [1, 3, 5, 10, 25, 50, 100, 200, 500, 1000, 5000, 10000, 50000];
function payBill(sum) { // купюра (или пара купюр), которой покупатель расплачивается
  const big = CASH_DENOMS.filter(d => d >= sum);
  if (big.length && Math.random() < .7) return big[0] === sum ? (big[1] || big[0] * 2) : big[Math.random() < .75 ? 0 : Math.min(1, big.length - 1)];
  const top = CASH_DENOMS.filter(d => d <= sum).pop() || 1; return top * (Math.floor(sum / top) + 1);
}
function changeGameFits(c, n) { const sum = c.price * n; return sum >= 3 && sum < 60000 && T && !T.paused; }
function changeGame(c, n) {
  T.paused = true;
  const sum = c.price * n, bill = payBill(sum), change = bill - sum;
  if (change <= 0) { T.paused = false; completeSale(c, n); return; }
  const denoms = CASH_DENOMS.filter(d => d <= Math.max(change, 1) * 1.01 && d >= Math.max(1, change / 400)).slice(-7);
  const time = 9 + S.sk.sense * 1.5 + (change > 1000 ? 4 : 0);
  let given = 0, done = false, timer;
  const finish = (how) => {
    if (done) return; done = true; clearTimeout(timer); T.paused = false; nextCard();
    const diff = given - change;
    if (how === 'timeout') { c.pat -= c.patMax * .3; rep('folk', -.5); toast('Покупатель устал ждать и сам отсчитал сдачу из вашей руки. Народ −0.5', 'bad'); completeSale(c, n); return; }
    if (diff === 0) { S.xp += 1; rep('folk', .4); gainSkillXp('trade', 10, ''); floatText('Сдача без ошибки!', '#7dff9a'); completeSale(c, n); return; }
    if (diff > 0) { S.money -= diff; T.rev -= diff;
      const honest = c.k === 'babka' || (c.k !== 'newrus' && Math.random() < .3);
      if (honest) { S.money += diff; T.rev += diff; rep('folk', .8); toast(`«Милок, ты лишнего дал ${fmt(diff)} ₽» — вернули переплату. Народ +1`, 'good'); }
      else toast(`Передали сдачи на ${fmt(diff)} ₽ — покупатель промолчал и быстро ушёл`, 'bad');
      completeSale(c, n); return; }
    const short = -diff;
    if (Math.random() < .85) { rep('folk', -1.5); c.said = 'Э, а сдачу?! Недодал!'; toast(`Обсчитали на ${fmt(short)} ₽ — покупатель заметил и потребовал додать. Народ −1.5`, 'bad'); completeSale(c, n); }
    else { S.money += short; T.rev += short; rep('folk', -.3); toast(`Недодали ${fmt(short)} ₽ — покупатель не заметил... (совесть −)`, ''); completeSale(c, n); }
  };
  queueCard({ title: 'Сдача',
    html: `<p>${esc(c.name)} берёт ${GOODS[c.item].icon} ×${n} на <b>${fmt(sum)} ₽</b> и протягивает купюру <b class="bill-in">${fmt(bill)} ₽</b>.</p>
      <p>Отсчитайте сдачу из кассы:</p>
      <div class="till" style="display:flex;flex-wrap:wrap;gap:6px">${denoms.map(d => `<button class="btn small" data-den="${d}">${fmt(d)}</button>`).join('')}</div>
      <p style="margin-top:6px">Отсчитано: <b id="chGiven">0</b> ₽ <button class="btn small" data-den="reset">Сбросить</button></p>
      <div class="pat"><i id="chBar" style="width:100%;transition:width ${time}s linear"></i></div>`,
    buttons: [{ label: 'Отдать сдачу', cls: 'green', fn() { finish('give'); return 'keep'; } }],
    onShow(box) {
      requestAnimationFrame(() => { const b = document.getElementById('chBar'); if (b) b.style.width = '0%'; });
      box.querySelectorAll('[data-den]').forEach(b => b.onclick = () => { if (b.dataset.den === 'reset') given = 0; else { given += +b.dataset.den; sfx.coin && sfx.coin(); } const g = document.getElementById('chGiven'); if (g) g.textContent = fmt(given); });
      timer = setTimeout(() => finish('timeout'), time * 1000);
    } });
}
function fakeBillGame(c, n) {
  T.paused = true;
  const denoms = S.idx < 3 ? [50, 100, 200, 500] : S.idx < 10 ? [200, 500, 1000, 5000] : [1000, 5000, 10000, 50000];
  const colors = { 50:'#c9b8d8', 100:'#d9c8a3', 200:'#c7a7a7', 500:'#b9c9b0', 1000:'#a8c3c9', 5000:'#c9b8a0', 10000:'#d0b3b3', 50000:'#b3c0d0' };
  const bills = Array.from({ length: 4 }, () => pick(denoms));
  const fakeI = RI(0, 3), kind = pick(['joke', 'nowm', 'color']);
  const time = 3.5 + S.sk.sense * .8;
  let done = false, timer;
  const finish = ok => {
    if (done) return; done = true; clearTimeout(timer);
    if (ok) {
      S.xp += 3; rep('law', 1); gainSkillXp('charm', 30, 'Распознали фальшивку'); gainSkillXp('trade', 20, '');
      S.fakeBills = (S.fakeBills || 0) + 1;
      toast('Распознали фальшивку на свет! Припрятали её — можно всучить вымогателям! (Чуйка +опыт)', 'good');
      sfx.coin(); c.said = 'Ой, обознался...'; nextCard(); T.cur = null; renderTrade();
    }
    else { toast('Взяли деньги... что-то с ними не так', 'bad'); nextCard(); completeSale(c, n, true); }
  };
  queueCard({ title:'Пересчёт денег',
    html:`<p>Покупатель суёт пачку купюр. <b>Найдите фальшивку!</b> (${time.toFixed(1)} с)</p>
      <div class="bills">${bills.map((d, i) => {
        const isF = i === fakeI;
        const col = isF && kind === 'color' ? '#e0d090' : colors[d];
        const label = isF && kind === 'joke' ? 'БИЛЕТ БАНКА ПРИКОЛОВ' : 'БИЛЕТ ГОСБАНКА';
        return `<button class="bill" data-bill="${i}" style="background:${col}"><small>${label}</small>${fmt(d)} РУБЛЕЙ${isF && kind === 'nowm' ? '' : '<div class="wm"></div>'}</button>`;
      }).join('')}</div><div class="pat"><i id="fakeBar" style="width:100%;transition:width ${time}s linear"></i></div>`,
    buttons: [{ label:'Всё нормально, беру', fn() { finish(false); return 'keep'; } }],
    onShow(box) {
      requestAnimationFrame(() => { const fb = $('#fakeBar'); if (fb) fb.style.width = '0%'; });
      box.querySelectorAll('[data-bill]').forEach(b => b.onclick = () => finish(+b.dataset.bill === fakeI));
      timer = setTimeout(() => finish(false), time * 1000);
    },
  });
}

// ============================================================
//  НОВЫЕ МЕХАНИКИ (СБОРКА 214):
//  - 3. «Синдром Очереди» и «Покупатели — один коллективный разум»
//  - 4. «Валюта на ощупь» (разглаживание мятых купюр 1992 г.)
//  - 9. «Чёрный Рынок» (разбавление, переклейка этикеток из 3 частей, подарочный набор) и Крысы/Порча
//  - 10. «Ночной Ларёк» (ночное выживание до утра)
//  - 13. «Звук как ресурс» (кассеты «Ласковый май», Высоцкий, «Кар-Мэн», зажёвывание плёнки)
// ============================================================

const CASSETTES_INFO = {
  may:      { id: 'may',      name: '«Ласковый май — Белые розы»',       short: 'Ласковый май', cost: 140, desc: 'Девчонки, студенты и молодёжь дольше ждут в очереди (+35% терпения) и охотнее берут сладкое и жвачку!' },
  vysotsky: { id: 'vysotsky', name: 'Владимир Высоцкий — «На Большом Каретном»', short: 'Высоцкий', cost: 180, desc: 'Мужики с завода и участковый добреют (+25% к терпимости цены, милиция не придирается по мелочам)!' },
  carman:   { id: 'carman',   name: '«Кар-Мэн — Вокруг света»',          short: 'Кар-Мэн',      cost: 220, desc: 'Привлекает челноков и «новых русских» с крупными купюрами и долларами (+30% к потоку богатых клиентов)!' },
};

function cassetteBadgeTxt() {
  if (!S) return 'выкл';
  if (S.tapeChewed) return '⚠️ ЗАЖЕВАЛО ПЛЁНКУ!';
  const c = S.activeCassette && CASSETTES_INFO[S.activeCassette];
  return c ? c.short : 'выкл';
}

function queueSyndromeHtml() {
  if (!T || !S) return '';
  const qLen = T.queue ? T.queue.length : 0;
  const rumorTxt = T.queueRumor === 'good'
    ? '<div style="color:#7dff9a;font-size:11px;margin-top:3px">🗣 Слух по очереди: «Хозяин честный, товар свежий — берите побольше!» (+спрос)</div>'
    : T.queueRumor === 'bad'
    ? '<div style="color:#ff7766;font-size:11px;margin-top:3px">🗣 Ропот в очереди: «Тут обсчитывают и просрочку суют!» (−терпение очереди)</div>'
    : '';
  const chewWarn = S.tapeChewed
    ? '<div class="warn" style="margin-top:4px">⚠️ Магнитофон зажевал плёнку и противно тянет звук! Очередь бесится — срочно перемотайте кассету карандашом!</div>'
    : '';
  if (!qLen && !rumorTxt && !chewWarn) return '';
  const qNames = (T.queue || []).slice(0, 4).map((q, idx) => {
    const pPct = Math.round(clamp((q.pat / Math.max(1, q.patMax)) * 100, 0, 100));
    const col = pPct > 55 ? '#8fc27a' : pPct > 25 ? '#f2c94c' : '#ff6655';
    return `<span style="display:inline-block;background:#ffffff12;border:1px solid ${col}66;border-radius:4px;padding:1px 6px;font-size:11px;margin-right:4px">${idx + 1}. ${esc(q.name)} <b style="color:${col}">${pPct}%</b></span>`;
  }).join('');
  return `<div class="card" style="margin-top:6px;padding:6px 8px;background:#10181c">
    <div style="font-size:11px;color:#b8c8d0;margin-bottom:3px">👥 <b>Очередь за окном (${qLen} чел.):</b> ${qNames || 'никого'}</div>
    ${T.babkaHold ? '<div style="color:#f5c86c;font-size:11px">👵 Бабка у окошка завела разговор про Горбачёва, а мужик сзади уже закипает!</div>' : ''}
    ${rumorTxt}${chewWarn}
  </div>`;
}

function tickQueueAndSound(dt) {
  if (!T || !S) return;
  const c = T.cur;
  const qLen = T.queue ? T.queue.length : 0;

  // Эффект кассеты в магнитофоне («Звук как ресурс»)
  let patDrainMult = 0.35;
  if (S.tapeChewed) {
    patDrainMult = 0.85; // зажёванная плёнка раздражает всех
  } else if (S.activeCassette === 'may') {
    patDrainMult = 0.22;
    if (c && (c.k === 'school' || c.k === 'student')) c.pat = Math.min(c.patMax, c.pat + dt * 0.25);
  } else if (S.activeCassette === 'vysotsky') {
    patDrainMult = 0.25;
    if (c && c.k === 'worker') c.pat = Math.min(c.patMax, c.pat + dt * 0.25);
  } else if (S.activeCassette === 'carman') {
    patDrainMult = 0.28;
  }

  // Случайное зажёвывание плёнки старым советским магнитофоном
  if (S.activeCassette && !S.tapeChewed && Math.random() < dt * 0.0045) {
    S.tapeChewed = true;
    sfx.bad && sfx.bad();
    toast('📼 Старый магнитофон зажевал плёнку! Звук плывёт и бесит очередь — перемотайте кассету карандашом!', 'bad');
    renderTrade();
  }

  // Синдром Очереди: бабка у окна заводит долгий разговор про Горбачёва, а мужик сзади начинает скандал
  if (c && !c.special && c.k === 'babka' && qLen >= 1 && !T.babkaHold && Math.random() < dt * 0.06) {
    T.babkaHold = true;
    c.said = 'Внучек, а ведь при Михаиле Сергеевиче талоны на сахар были, а сейчас что творится?..';
    const behind = T.queue[0];
    if (behind) {
      toast(`👵 Бабка у окошка завела речь про Горбачёва! ${behind.name} сзади кричит: «Мать, бери хлеб и не задерживай людей!»`, 'bad');
    }
    renderTrade();
  }
  if (T.babkaHold && (!c || c.k !== 'babka')) T.babkaHold = false;
  if (T.babkaHold) patDrainMult *= 1.65;

  // Коллективный разум очереди: если в очереди недовольны или ходят плохие слухи
  if (T.queueRumor === 'bad') patDrainMult *= 1.35;
  if (T.queueRumor === 'good') patDrainMult *= 0.72;

  for (const q of T.queue) {
    q.pat -= dt * patDrainMult;
  }
  const before = T.queue.length;
  if (before > 0) {
    const angryLeft = T.queue.filter(q => q.pat <= 0);
    if (angryLeft.length > 0) {
      T.queue = T.queue.filter(q => q.pat > 0);
      T.lost += angryLeft.length;
      rep('folk', -0.5 * angryLeft.length);
      T.queueRumor = 'bad';
      toast(`😠 ${angryLeft[0].name} не выдержал очереди, выругался на всю улицу и ушёл! Очередь загудела.`, 'bad');
      renderTrade();
    }
  }

  // Наказание за продажу разбавленного/переклеенного товара («Чёрный рынок»): обманутый мужик возвращается с разборкой!
  if (S.blackMarket && S.blackMarket.angryBuyerPending && !T.cur && Math.random() < dt * 0.035) {
    S.blackMarket.angryBuyerPending = false;
    const fine = Math.min(S.money, usdToRub(8));
    T.cur = {
      special: 'angry_buyer',
      k: 'worker',
      name: 'Обманутый покупатель с разборкой',
      mood: 'angry',
      pat: 999,
      patMax: 999,
      anim: 0,
      said: 'Ты чё мне за палёнку с переклеенной этикеткой впарил, коммерсант?! Мы с мужиками глотнули — чистая вода с сивухой! Гони деньги назад вдвойне или сейчас витрину разнесём!',
      opts: [
        {
          label: `Вернуть деньги с компенсацией (${fmt(fine)} ₽)`,
          cls: 'yellow',
          fn() {
            S.money = Math.max(0, S.money - fine);
            rep('folk', -2);
            T.queueRumor = 'bad';
            toast('Вернули деньги обманутому покупателю, но вся очередь услышала про палёнку! Народ −2', 'bad');
          }
        },
        {
          label: '🥊 Выйти из ларька и разобраться на кулаках!',
          cls: 'red',
          fn() {
            rep('folk', -5);
            rep('street', 2);
            T.queueRumor = 'bad';
            toast('Устроили драку прямо перед очередью! Половина покупателей разошлась. Народ −5, Улица +2', 'bad');
            T.queue = [];
          }
        }
      ]
    };
    sfx.bad && sfx.bad();
    renderTrade();
  }
}

function bribeCurrentCustomerToLeave() {
  if (!T || !T.cur || !S) return;
  const bribe = 25;
  if (S.money < bribe) { toast('Не хватает мелочи (25 ₽)!', 'bad'); return; }
  S.money -= bribe;
  T.babkaHold = false;
  sfx.coin && sfx.coin();
  toast(`Сунули ${T.cur.name} 25 ₽ на чай — место у окошка сразу освободилось! Очередь довольна.`, 'good');
  for (const q of T.queue) q.pat = Math.min(q.patMax, q.pat + q.patMax * 0.35);
  leave();
}

function swapCustomerWithQueue() {
  if (!T || !T.cur || !T.queue || !T.queue.length) return;
  // Находим самого нетерпеливого или богатого покупателя в очереди и пропускаем его вперёд
  let bestIdx = 0;
  for (let i = 1; i < T.queue.length; i++) {
    if (T.queue[i].pat / T.queue[i].patMax < T.queue[bestIdx].pat / T.queue[bestIdx].patMax) bestIdx = i;
  }
  const urgent = T.queue.splice(bestIdx, 1)[0];
  const prevCur = T.cur;
  prevCur.pat = Math.max(prevCur.pat, prevCur.patMax * 0.55);
  T.queue.unshift(prevCur);
  T.cur = urgent;
  T.babkaHold = false;
  urgent.pat = Math.min(urgent.patMax, urgent.pat + urgent.patMax * 0.3);
  sfx.click && sfx.click();
  toast(`🔄 Пропустили вперёд: ${urgent.name} («Мне только быстро взять!»).`, 'good');
  renderTrade();
}

// 4. «Валюта на ощупь»: покупатель протягивает мятую, грязную или надорванную купюру — нужно потереть её пальцем по экрану!
function crumpledBillGame(c, n) {
  T.paused = true;
  const sum = c.price * n;
  const bill = payBill(sum);
  const isFake = Math.random() < 0.25;
  const fakeReason = pick([
    'Надпись расплылась: «БИЛЕТ БАНКА ПРИКОЛОВ»',
    'Дорисованы лишние нули химическим карандашом (переделка из 10 ₽)',
    'Нет водяного знака, бумага газетная однослойная'
  ]);
  let rubProgress = 0;
  let revealed = false;

  queueCard({
    title: '💴 Валюта на ощупь · Мятая купюра 1992 г.',
    html: `<p>${esc(c.name)} берёт ${GOODS[c.item].icon} ×${n} на <b>${fmt(sum)} ₽</b> и суёт в окошко скомканную, засаленную купюру.</p>
      <p class="muted">Потрите купюру пальцем (или курсором) по экрану, чтобы разгладить складки, проверить плотность бумаги и водяные знаки:</p>
      <div id="crumpledBillArea" style="position:relative;margin:10px auto;width:min(310px,88vw);height:138px;border-radius:10px;background:linear-gradient(135deg,#b9ad8e 0%,#8f8264 50%,#c5b99b 100%);border:2px solid #4a402e;box-shadow:inset 0 0 28px rgba(0,0,0,0.65), 0 8px 20px rgba(0,0,0,0.6);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:grab;touch-action:none;user-select:none;overflow:hidden;">
        <div id="billTextInner" style="text-align:center;filter:blur(7px) contrast(0.65);transform:rotate(-4deg) scale(0.92);transition:filter 0.15s, transform 0.15s;">
          <div style="font-size:11px;font-weight:800;color:#2b2318;letter-spacing:0.8px;">${isFake ? 'БИЛЕТ БАНКА ПРИКОЛОВ · 1992' : 'БИЛЕТ ГОСУДАРСТВЕННОГО БАНКА СССР'}</div>
          <div style="font-size:28px;font-weight:900;color:#1c2d1e;font-family:Georgia,serif;margin:4px 0;">${fmt(bill)} РУБЛЕЙ</div>
          <div style="font-size:11px;font-weight:700;color:${isFake ? '#8a1c14' : '#1b4d26'};">${isFake ? '⚠️ ' + fakeReason : '✓ Водяной знак: профиль В. И. Ленина · Хрустящая бумага Гознака'}</div>
        </div>
        <div id="crumpleOverlay" style="position:absolute;inset:0;background:repeating-linear-gradient(37deg,rgba(30,22,12,0.58) 0px,rgba(210,195,165,0.28) 9px,rgba(25,18,10,0.62) 18px);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;color:#fff;text-shadow:0 2px 6px #000;">
          👋 ПОТРИТЕ ЭКРАН ПАЛЬЦЕМ (0%)
        </div>
      </div>
      <div class="pat"><i id="rubBar" style="width:0%;background:#6ad49e"></i></div>`,
    buttons: [
      {
        label: '✓ Принять купюру в кассу',
        cls: 'green',
        fn() {
          T.paused = false;
          if (isFake) {
            toast('Вы приняли поддельную мятую купюру не глядя! В кассе недостача.', 'bad');
            completeSale(c, n, true);
          } else {
            if (revealed) { S.xp += 1; gainSkillXp('trade', 10, ''); }
            completeSale(c, n, false);
            T.queueRumor = 'good';
          }
        }
      },
      {
        label: '✋ Вернуть: «Купюра фальшивая / рваная!»',
        cls: 'red',
        fn() {
          T.paused = false;
          if (isFake) {
            S.xp += 3;
            rep('street', 1);
            gainSkillXp('sense', 25, 'Распознали фальшивку на ощупь');
            S.fakeBills = (S.fakeBills || 0) + 1;
            toast('На ощупь распознали липу! Покупатель смутился и убежал, а фальшивка пригодится для гопников.', 'good');
            T.cur = null;
            renderTrade();
          } else {
            rep('folk', -2);
            T.lost++;
            T.queueRumor = 'bad';
            toast('Купюра была настоящей! Покупатель обиделся и пожаловался всей очереди (Народ −2).', 'bad');
            T.cur = null;
            renderTrade();
          }
        }
      }
    ],
    onShow(box) {
      const area = box.querySelector('#crumpledBillArea');
      const over = box.querySelector('#crumpleOverlay');
      const inner = box.querySelector('#billTextInner');
      const rBar = box.querySelector('#rubBar');
      let lastX = null, lastY = null, isDown = false;
      const stepRub = (x, y) => {
        if (lastX != null) {
          const dist = Math.hypot(x - lastX, y - lastY);
          rubProgress = clamp(rubProgress + dist * 0.42, 0, 100);
          const pct = Math.round(rubProgress);
          if (rBar) rBar.style.width = pct + '%';
          if (over) {
            over.style.opacity = String(Math.max(0, 1 - rubProgress / 92));
            over.textContent = pct >= 95 ? '' : `👋 РАЗГЛАЖИВАЕМ КУПЮРУ (${pct}%)`;
          }
          if (inner) {
            const blurPx = Math.max(0, (1 - rubProgress / 90) * 7).toFixed(1);
            inner.style.filter = `blur(${blurPx}px) contrast(${(0.65 + (rubProgress / 100) * 0.4).toFixed(2)})`;
            inner.style.transform = `rotate(${((-4 * (1 - rubProgress / 100))).toFixed(1)}deg) scale(${(0.92 + 0.08 * (rubProgress / 100)).toFixed(2)})`;
          }
          if (rubProgress >= 92 && !revealed) {
            revealed = true;
            sfx.click && sfx.click();
          }
        }
        lastX = x; lastY = y;
      };
      area.addEventListener('pointerdown', e => { isDown = true; lastX = e.clientX; lastY = e.clientY; stepRub(e.clientX, e.clientY); e.preventDefault(); });
      area.addEventListener('pointermove', e => { if (isDown) stepRub(e.clientX, e.clientY); });
      window.addEventListener('pointerup', () => { isDown = false; lastX = null; lastY = null; }, { once: false });
    }
  });
}

// 13. «Звук как ресурс»: Магнитофон «Весна-212», покупка/смена кассет и перемотка карандашом
function openCassetteDeckModal() {
  if (!S) return;
  S.cassettes = S.cassettes || { may: true, vysotsky: true, carman: false };
  const draw = box => {
    const cur = S.activeCassette && CASSETTES_INFO[S.activeCassette];
    box.querySelector('#cassDeckBody').innerHTML = `
      <div class="card" style="background:#141c20;border:1px solid #486472;margin-bottom:8px">
        <div class="row sp">
          <b>📼 Кассетный магнитофон «Весна-212»</b>
          <span class="chip">${S.tapeChewed ? '⚠️ Плёнка зажёвана' : (cur ? '▶ Играет: ' + cur.short : '⏹ Стоп')}</span>
        </div>
        <div class="muted" style="margin-top:4px">${S.tapeChewed ? 'Плёнка намоталась на тонвал! Возьмите гранёный карандаш и перемотайте бобину вручную.' : (cur ? cur.desc : 'Поставьте кассету, чтобы музыка управляла настроением очереди у ларька.')}</div>
        ${S.tapeChewed ? `<button class="btn yellow big" id="btnPencilRewind" style="margin-top:8px;width:100%">✏️ Перемотать зажёванную кассету карандашом</button>` : ''}
      </div>
      ${Object.values(CASSETTES_INFO).map(cs => {
        const owned = !!S.cassettes[cs.id];
        const active = S.activeCassette === cs.id && !S.tapeChewed;
        return `<div class="good">
          <div class="ic">📼</div>
          <div class="nm">
            <div><b>${cs.name}</b> ${active ? '<span class="chip" style="color:#7dff9a">В ДЕКЕ</span>' : ''}</div>
            <div class="muted">${cs.desc}</div>
          </div>
          <div>
            ${owned
              ? `<button class="btn small ${active ? '' : 'green'}" data-cass-play="${cs.id}">${active ? '⏹ Выкл' : '▶ Включить'}</button>`
              : `<button class="btn small yellow" data-cass-buy="${cs.id}" ${S.money < cs.cost ? 'disabled' : ''}>Купить (${fmt(cs.cost)} ₽)</button>`}
          </div>
        </div>`;
      }).join('')}
    `;
    const rw = box.querySelector('#btnPencilRewind');
    if (rw) rw.onclick = () => {
      S.tapeChewed = false;
      sfx.ching && sfx.ching();
      toast('✏️ Вы ловко провернули кассету на карандаше — плёнка спасена, музыка снова играет чисто!', 'good');
      save();
      draw(box);
      if (T) renderTrade();
    };
    box.querySelectorAll('[data-cass-play]').forEach(b => b.onclick = () => {
      const id = b.dataset.cassPlay;
      S.activeCassette = (S.activeCassette === id) ? null : id;
      S.tapeChewed = false;
      sfx.click && sfx.click();
      toast(S.activeCassette ? `📼 Включили кассету: ${CASSETTES_INFO[id].name}` : '⏹ Магнитофон остановлен.');
      save();
      draw(box);
      if (T) renderTrade();
    });
    box.querySelectorAll('[data-cass-buy]').forEach(b => b.onclick = () => {
      const id = b.dataset.cassBuy;
      const cs = CASSETTES_INFO[id];
      if (!cs || S.money < cs.cost) return;
      S.money -= cs.cost;
      S.cassettes[id] = true;
      S.activeCassette = id;
      sfx.coin && sfx.coin();
      toast(`Купили и поставили кассету ${cs.name}!`, 'good');
      save();
      draw(box);
      if (T) renderTrade();
    });
  };
  queueCard({
    title: '📼 Магнитофон и кассеты («Звук как ресурс»)',
    html: '<div id="cassDeckBody"></div>',
    onShow: draw,
    buttons: [{ label: 'Закрыть', fn() { if (T) renderTrade(); else render(); } }]
  });
}

// 9. «Чёрный Рынок»: Разбавление напитков, Переклейка этикеток (пазл из 3 полосок), Подарочный набор из просрочки
function openBlackMarketModal() {
  if (!S) return;
  S.blackMarket = S.blackMarket || { dilutedStock: 0, relabeledVodka: 0, giftSets: 0, angryBuyerPending: false };
  let stripShift = [RI(-2, 2) || 1, RI(-2, 2) || -1, RI(-2, 2) || 1];

  const draw = box => {
    const bm = S.blackMarket;
    const aligned = stripShift[0] === 0 && stripShift[1] === 0 && stripShift[2] === 0;
    box.querySelector('#bmBody').innerHTML = `
      <p class="muted">Подпольные хитрости 1992 года: сверхприбыль в один день, но если поймают за руку — ждите серьёзных разборок у окошка!</p>
      <div class="card" style="margin-bottom:8px">
        <div class="row sp"><span>🧪 Разбавленное пиво/спирт на продажу:</span><b>${bm.dilutedStock || 0} шт.</b></div>
        <div class="row sp"><span>🏷 «Элитная Столичная» (переклеенная):</span><b>${bm.relabeledVodka || 0} бут.</b></div>
        <div class="row sp"><span>🎁 «Подарочные наборы» (из залежалого):</span><b>${bm.giftSets || 0} шт.</b></div>
      </div>

      <div class="good">
        <div class="ic">🚰</div>
        <div class="nm">
          <div><b>1. Разбавить пиво водой или спирт «Король» чаем</b></div>
          <div class="muted">Из 1 бут. пива или спирта на складе получается 2 порции! Прибыль ×2, но есть риск разборки.</div>
        </div>
        <button class="btn small yellow" id="bmDiluteBtn" ${(qOf('beer') > 0 || qOf('vodka') > 0) ? '' : 'disabled'}>Разбавить (+2 шт.)</button>
      </div>

      <div class="good">
        <div class="ic">🎁</div>
        <div class="nm">
          <div><b>2. Собрать «Подарочный набор» из залежалого хлеба и кильки</b></div>
          <div class="muted">Красиво перевязать ленточкой вчерашний хлеб + банку кильки — уходит втридорога!</div>
        </div>
        <button class="btn small blue" id="bmGiftBtn" ${(qOf('bread') > 0 || qOf('kilka') > 0) ? '' : 'disabled'}>Собрать набор</button>
      </div>

      <div class="card" style="margin-top:8px;background:#191412;border:1px solid #7a5230">
        <b>🏷 3. Переклеить этикетку на дешёвой водке (Мини-игра: выровняйте 3 полосы по центру)</b>
        <div class="muted" style="margin:4px 0 8px">Нажимайте «◀ / ▶», чтобы совместить все три части экспортной этикетки «STOLICHNAYA EXPORT» без перекоса (0 / 0 / 0):</div>
        ${['ВЕРХ: ★ EXPORT QUALITY ★', 'СЕРЕДИНА: STOLICHNAYA VODKA', 'НИЗ: 40% ALC · MOSCOW 1992'].map((txt, idx) => `
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
            <button class="btn small" data-lbl-shift="${idx}:-1">◀</button>
            <div style="flex:1;background:#f3e9d2;color:#7a1814;border:1.5px solid ${stripShift[idx] === 0 ? '#2e8b57' : '#8a2a1e'};border-radius:4px;padding:4px 8px;font-weight:900;font-size:11.5px;text-align:center;transform:translateX(${stripShift[idx] * 14}px);transition:transform 0.12s;">
              ${txt} (${stripShift[idx] === 0 ? 'РОВНО' : (stripShift[idx] > 0 ? '+' + stripShift[idx] : stripShift[idx])})
            </div>
            <button class="btn small" data-lbl-shift="${idx}:1">▶</button>
          </div>
        `).join('')}
        <button class="btn green" id="bmGlueBtn" style="width:100%;margin-top:4px" ${aligned ? '' : 'disabled'}>${aligned ? '✨ Наклеить ровно (+1 бут. Элитной за 650 ₽)' : 'Выровняйте все 3 полосы в положение «РОВНО»'}</button>
      </div>
    `;

    const dilBtn = box.querySelector('#bmDiluteBtn');
    if (dilBtn) dilBtn.onclick = () => {
      if (qOf('vodka') > 0) takeStock('vodka', 1);
      else if (qOf('beer') > 0) takeStock('beer', 1);
      else return;
      bm.dilutedStock = (bm.dilutedStock || 0) + 2;
      sfx.ching && sfx.ching();
      toast('🧪 Разбавили напиток! Получено 2 порции самопала для продажи через кнопку «Впарить самопал».', 'good');
      save(); draw(box);
    };

    const giftBtn = box.querySelector('#bmGiftBtn');
    if (giftBtn) giftBtn.onclick = () => {
      if (qOf('bread') > 0) takeStock('bread', 1);
      if (qOf('kilka') > 0) takeStock('kilka', 1);
      bm.giftSets = (bm.giftSets || 0) + 1;
      if (S.fresh) { S.fresh.bread = 0; }
      sfx.ching && sfx.ching();
      toast('🎁 Собрали «Подарочный набор 1992»! Можно продать любому покупателю с высокой наценкой.', 'good');
      save(); draw(box);
    };

    box.querySelectorAll('[data-lbl-shift]').forEach(b => b.onclick = () => {
      const [i, d] = b.dataset.lblShift.split(':').map(Number);
      stripShift[i] = clamp(stripShift[i] + d, -3, 3);
      sfx.click && sfx.click();
      draw(box);
    });

    const glueBtn = box.querySelector('#bmGlueBtn');
    if (glueBtn) glueBtn.onclick = () => {
      if (!aligned) return;
      if (qOf('vodka') > 0) takeStock('vodka', 1);
      bm.relabeledVodka = (bm.relabeledVodka || 0) + 1;
      stripShift = [RI(-2, 2) || 1, RI(-2, 2) || -1, RI(-2, 2) || 1];
      sfx.fanfare && sfx.fanfare();
      toast('🏷 Этикетка «STOLICHNAYA EXPORT» наклеена идеально ровно! Теперь бутылку можно продать втридорога.', 'good');
      save(); draw(box);
    };
  };

  queueCard({
    title: '🕵️ Чёрный Рынок · Подпольный цех ларька',
    html: '<div id="bmBody"></div>',
    onShow: draw,
    buttons: [{ label: 'Готово', fn() { if (T) renderTrade(); else render(); } }]
  });
}

function sellBlackMarketToCustomer() {
  if (!T || !T.cur || !S || !S.blackMarket) return;
  const bm = S.blackMarket;
  const c = T.cur;
  let gain = 0, label = '', risk = 0.25;
  if (bm.relabeledVodka > 0) {
    bm.relabeledVodka--;
    gain = Math.round((S.prices.vodka || 220) * 2.8);
    label = 'переклеенную «Stolichnaya Export»';
    risk = 0.30;
  } else if (bm.giftSets > 0) {
    bm.giftSets--;
    gain = Math.round(((S.prices.bread || 10) + (S.prices.kilka || 25)) * 2.6);
    label = '«Подарочный набор» с ленточкой';
    risk = 0.18;
  } else if (bm.dilutedStock > 0) {
    bm.dilutedStock--;
    gain = Math.round((S.prices.beer || 30) * 2.2);
    label = 'разбавленный напиток';
    risk = 0.35;
  } else {
    return;
  }
  S.money += gain;
  T.rev += gain;
  T.sold += 1;
  sfx.ching && sfx.ching();
  if (Math.random() < risk) {
    bm.angryBuyerPending = true;
  }
  toast(`🕵️ Впарили покупателю (${c.name}) ${label} за +${fmt(gain)} ₽!`, 'good');
  leave();
}

// Система порчи продуктов и крыс на складе
function tickDailySpoilageAndRats() {
  if (!S) return;
  let floorFoodCount = 0;
  if (W && W.life && Array.isArray(W.life.items)) {
    for (const it of W.life.items) {
      const gid = it && it.data && it.data.goodId;
      if (it.kind === 'good' && ['bread', 'tushonka', 'kilka', 'sausage', 'choc'].includes(gid) && (it.y || 0) < 0.25) {
        floorFoodCount++;
      }
    }
  }
  const staleBread = (S.fresh && S.fresh.bread >= 1 && qOf('bread') > 0) ? qOf('bread') : 0;
  if (floorFoodCount > 0 || staleBread >= 4) {
    S.ratInfestation = Math.min(3, (S.ratInfestation || 0) + 1);
  }
  if ((S.ratInfestation || 0) > 0) {
    let chewed = 0;
    for (const id of ['bread', 'choc', 'gum', 'tushonka']) {
      if (qOf(id) > 0) {
        const take = Math.min(qOf(id), S.ratInfestation);
        takeStock(id, take);
        chewed += take;
      }
    }
    rep('folk', -2 * S.ratInfestation);
    queueCard({
      title: '🐀 Крысы и запах на складе!',
      html: `<p>Из-за продуктов на полу и вовремя не убранной просрочки в ларьке завелись <b>складские крысы (уровень: ${S.ratInfestation})</b>!</p>
        <p>За ночь крысы погрызли <b>${chewed} шт.</b> товара, а неприятный запах отпугивает брезгливых покупателей (Народ −${2 * S.ratInfestation}).</p>
        <p class="muted">Не бросайте еду на пол и проведите санитарную зачистку склада!</p>`,
      buttons: [
        { label: `🧹 Вытравить крыс и вымыть пол с хлоркой (${fmt(usdToRub(4))} ₽)`, cls: 'green', disabled: S.money < usdToRub(4), fn() { cleanWarehouseRats(); } },
        { label: 'Потом разберусь' }
      ]
    });
  }
}

function cleanWarehouseRats() {
  if (!S) return;
  const cost = usdToRub(4);
  if (S.money < cost) { toast(`Нужно ${fmt(cost)} ₽ на хлорку и крысоловки!`, 'bad'); return; }
  S.money -= cost;
  S.ratInfestation = 0;
  rep('folk', 3);
  sfx.ching && sfx.ching();
  toast('🧹 Вы вычистили склад с хлоркой и поставили крысоловки! Запах исчез, крысы выведены (Народ +3).', 'good');
  save();
  render();
}

// 10. «Ночной Ларёк»: Днём торгуешь, а ночью ларёк становится точкой притяжения (пьяные, менты, братки, влюблённые, беглые зэки — продержаться до утра)
function openNightKioskShift() {
  if (!S) return;
  const encounters = [
    {
      time: '00:40',
      who: '🥴 Пьяная компания с гитарой',
      text: 'В глухую полночь в окошко ларька колотят подвыпившие мужики: «Браток, выручай! Душа горит — дай две бутылки «Короля» и пачку «Космонавта», платим двойную цену наличными!»',
      opts: [
        {
          label: '🍾 Продать по двойному ночному тарифу (+850 ₽)',
          cls: 'green',
          fn(st) {
            if (qOf('vodka') > 0) takeStock('vodka', 1);
            if (qOf('cig') > 0) takeStock('cig', 1);
            st.earned += 850;
            S.money += 850;
            rep('folk', 2);
            return 'Пьяная компания расплатилась мятыми сотнями и с песнями ушла во дворы (+850 ₽)!';
          }
        },
        {
          label: '🔒 Захлопнуть стальную ставню перед носом',
          fn() { return 'Мужики попинали киоск, поругались, но скоро замёрзли и ушли.'; }
        }
      ]
    },
    {
      time: '02:15',
      who: '💑 Влюблённая парочка с дискотеки ДК',
      text: 'Замёрзший парень в кожанке обнимает девушку у вашего светящегося окошка: «Командир, не дай погибнуть романтике! Есть шоколадка «Сникерсон», жвачка и газировка? Заплачу щедро, лишь бы перед дамой не ударить в грязь лицом!»',
      opts: [
        {
          label: '🍫 Собрать ночной романтический набор (+620 ₽, Народ +3)',
          cls: 'green',
          fn(st) {
            if (qOf('choc') > 0) takeStock('choc', 1);
            if (qOf('gum') > 0) takeStock('gum', 1);
            st.earned += 620;
            S.money += 620;
            rep('folk', 3);
            return 'Девушка в восторге от импортного батончика, а парень оставил отличные чаевые (+620 ₽)!';
          }
        },
        {
          label: '☕ Налить им горячего чаю из термоса (+200 ₽, Народ +2)',
          fn(st) {
            st.earned += 200;
            S.money += 200;
            rep('folk', 2);
            return 'Парочка согрелась у окошка и тепло поблагодарила вас (+200 ₽).';
          }
        }
      ]
    },
    {
      time: '03:30',
      who: '🚓 Ночной милицейский УАЗик (Патруль ППС)',
      text: 'В три часа ночи в свете жёлтых фар тормозит милицейский «бобик». Сержант стучит дубинкой по раме: «Ночная проверка! Почему точка открыта после полуночи? Нарушаем или угостишь наряд сигаретами и горячим чаем?»',
      opts: [
        {
          label: '🚬 Угостить патруль пачкой «Космонавта» и дать 150 ₽ на бензин (Закон +4)',
          cls: 'yellow',
          fn(st) {
            if (qOf('cig') > 0) takeStock('cig', 1);
            S.money = Math.max(0, S.money - 150);
            st.earned -= 150;
            rep('law', 4);
            return 'Сержант козырнул: «Торгуй спокойно до утра, коммерсант, если шпана полезет — свисти!» (Закон +4)';
          }
        },
        {
          label: '📄 Показать разрешение администрации и сослаться на круглосуточный график',
          fn() {
            if (S.permit) { rep('law', 2); return 'Патрульный проверил печать исполкома и без вопросов уехал.'; }
            const f = Math.min(S.money, 350);
            S.money -= f;
            return `Без разрешения пришлось заплатить ночной штраф ${fmt(f)} ₽.`;
          }
        }
      ]
    },
    {
      time: '04:45',
      who: '⛓ Беглый зэк из ИВС и ночные братки на «девятке»',
      text: 'Перед самым рассветом из темноты выныривает человек в телогрейке со сбитыми костяшками: «Братишка, я с этапа ушёл, менты на хвосте! Дай банку тушёнки и курево, а я тебе воровской тайник с баксами сдам!» Следом у обочины тормозит тонированная «девятка» братков…',
      opts: [
        {
          label: '🥫 Дать беглому тушёнку и сигареты в обмен на тайник (+$25 и Улица +5)',
          cls: 'green',
          fn(st) {
            if (qOf('tushonka') > 0) takeStock('tushonka', 1);
            S.usd = (S.usd || 0) + 25;
            st.usdEarned += 25;
            rep('street', 5);
            return 'Беглый спрятал провизию за пазуху и шепнул место закладки у трубы — там лежало $25 наличными! Братки из «девятки» уважительно кивнули (Улица +5).';
          }
        },
        {
          label: '🔫 Передёрнуть затвор дедовской двустволки и держать оборону до рассвета',
          cls: 'red',
          fn() {
            rep('street', 3);
            return 'Увидев ствол в амбразуре ларька, ночные гости не рискнули связываться и растворились в предрассветном тумане!';
          }
        }
      ]
    }
  ];

  let stepIdx = 0;
  const shiftState = { earned: 0, usdEarned: 0, lastLog: 'За окном 00:15. Ваш ларёк — единственный островок света на всей заледеневшей улице Советской.' };

  const showStep = () => {
    if (stepIdx >= encounters.length) {
      S.xp += 6;
      checkLevel();
      gainSkillXp('trade', 35, '🌙 Выстояли смену в «Ночном Ларьке»');
      save();
      queueCard({
        title: '🌅 Рассвет! Вы продержались до утра в «Ночном Ларьке»',
        html: `<p>${esc(shiftState.lastLog)}</p>
          <p>Первые заводские автобусы выходят на маршрут — вы выстояли всю ночь за прилавком!</p>
          <div class="card">
            <div class="row sp"><span>Ночная выручка (чистыми):</span><b class="dn">${shiftState.earned >= 0 ? '+' : ''}${fmt(shiftState.earned)} ₽</b></div>
            ${shiftState.usdEarned ? `<div class="row sp"><span>Валютный подгон:</span><b class="dn">+$${shiftState.usdEarned}</b></div>` : ''}
            <div class="row sp"><span>Бонус опыта и авторитета:</span><b>+6 XP · Торговля +35</b></div>
          </div>`,
        buttons: [{ label: '☀️ Встретить новое утро', cls: 'green', fn() { sleep(true); } }]
      });
      return;
    }
    const enc = encounters[stepIdx];
    queueCard({
      title: `🌙 Ночной Ларёк · ${enc.time} (${stepIdx + 1}/${enc.length || encounters.length})`,
      html: `<p class="muted" style="margin-bottom:6px">${esc(shiftState.lastLog)}</p>
        <div class="bubble">
          <div class="who">${enc.who}</div>
          <div class="say">«${esc(enc.text)}»</div>
        </div>`,
      buttons: enc.opts.map(o => ({
        label: o.label,
        cls: o.cls || '',
        fn() {
          shiftState.lastLog = o.fn(shiftState) || '';
          stepIdx++;
          sfx.coin && sfx.coin();
          setTimeout(showStep, 20);
        }
      }))
    });
  };
  showStep();
}

function chooseOpt(i) {
  const c = T.cur; if (!c || !c.special) return;
  const o = c.opts[i]; if (!o || o.disabled) return;
  sfx.click(); o.fn(); T.cur = null; renderTrade();
}
function endTrade() {
  if (S.phase !== 'trade') return;
  const rep_ = { rev:T.rev, cogs:T.cogs, sold:T.sold, lost:T.lost, theft:0 };
  T = null;
  if (W) { W.unlock(); W.setHatch && W.setHatch(false); }
  eveningFlow(rep_);
}
// тётя Люба торгует сама
function autoDay(hours) {
  let rev = 0, cogs = 0, sold = 0;
  const n = hours ? Math.round(hours * 4 * traffic()) : Math.round(26 * traffic());
  for (let i = 0; i < n; i++) {
    const c = makeCustomer(); const st = custStatus(c);
    if (!st.ok || Math.random() < .2) continue;
    if (c.price / c.wtp > 1) { c.price = Math.max(Math.round(S.prices[c.item] * .9), Math.round(c.wtp * .95)); }
    const cost = takeStock(c.item, st.n); rev += c.price * st.n; cogs += cost; sold += st.n;
  }
  const theft = Math.round(rev * R(0, .12));
  S.money += rev - theft;
  return { rev, cogs, sold, lost:0, theft };
}

// ============================================================
//  Вечер: итоги, ТВ, события, переход к следующему дню
// ============================================================
function eveningFlow(r) {
  S.phase = 'evening';
  tab = 'kiosk'; render();
  // итоги дня
  let notes = [];
  if (S.bottles > 0) { const pay = Math.round(S.bottles * Math.max(1, S.idx * .6) * 1.7); S.money += pay; notes.push(`Сдали ${S.bottles} бутылок в пункт приёма стеклотары: +${fmt(pay)} ₽ (прибыль ${fmt(pay - (S.bottleCost || 0))} ₽)`); S.bottles = 0; S.bottleCost = 0; }
  if (S.fakeLoss > 0) { S.money -= S.fakeLoss; notes.push(`В кассе нашлись фальшивки: −${fmt(S.fakeLoss)} ₽`); S.fakeLoss = 0; }
  if (S.seller) { const wage = usdToRub(3); S.money -= wage; notes.push(`Зарплата тёте Любе: −${fmt(wage)} ₽`); }
  if (r.theft > 0) notes.push(`Тётя Люба, кажется, взяла себе ${fmt(r.theft)} ₽...`);
  if (S.markup <= .3) { rep('folk', 2); notes.push('Честные цены: Народ +2'); }
  if (S.markup >= 1) { rep('folk', -3); notes.push('Цены «грабёж»: Народ −3'); }
  if (S.debtBook && S.debtBook.length) {
    const due = S.debtBook.filter(d => S.day >= d.dueDay);
    S.debtBook = S.debtBook.filter(d => S.day < d.dueDay);
    for (const d of due) {
      S.money += d.sum;
      rep('folk', 1);
      notes.push(`Тетрадь долгов: ${d.who} вернул(а) долг за «${d.item}» с благодарностью: +${fmt(d.sum)} ₽`);
    }
  }
  if (S.flags.valyaPays) { S.flags.valyaPays = false; const v = usdToRub(2); S.money += v; notes.push(`Тётя Валя вернула долг с пирожками: +${fmt(v)} ₽`); }
  if (S.voucher === 'zavod') { const dv = usdToRub(1.5); S.money += dv; notes.push(`Дивиденды завода: +${fmt(dv)} ₽`); }
  if (S.money < 0) { notes.push('Касса в минусе — пришлось занять у соседей. Народ −2'); rep('folk', -2); S.money = 0; }
  const profit = r.rev - r.cogs - (r.theft || 0);
  S.totalProfit += profit / S.rate;
  queueCard({ title:`Итоги: ${dateStr(S.day)}`,
    html:`<div class="card">
      <div class="row sp"><span>Выручка</span><b>${fmt(r.rev)} ₽</b></div>
      <div class="row sp"><span>Себестоимость проданного</span><b>−${fmt(r.cogs)} ₽</b></div>
      <div class="row sp"><span>Прибыль</span><b class="${profit >= 0 ? 'dn' : 'up'}">${fmt(profit)} ₽ (≈ $${(profit / S.rate).toFixed(1)})</b></div>
      <div class="row sp"><span>Продано / ушли ни с чем</span><b>${r.sold} / ${r.lost}</b></div></div>
      ${notes.map(n => `<p class="muted">• ${n}</p>`).join('')}`,
    onShow: () => sfx.fanfare() });

  // ночь
  nightEvents();

  // глава 1 заканчивается: долг
  if (S.day === 12 && !S.free) debtDeadline();
  // конец сюжета
  if (S.day === LAST_STORY_DAY && !S.free) { finale(); return; }

  queueCard({ title:'🌙 Вечер', html:`<p>Дневная смена окончена. Ночью ларёк становится точкой притяжения района: пьяные компании, менты, братки, влюблённые парочки и беглые зэки.</p><p class="muted">Вы можете остаться в «Ночном Ларьке» и продержаться до утра с двойной выручкой, прогуляться по ночному городу или лечь спать.</p>`,
    buttons:[
      { label:'🏮 Выйти в «Ночной Ларёк» (до утра)', cls:'yellow', fn() { S.phase = 'night'; save(); setTimeout(openNightKioskShift, 60); } },
      { label:'Ночной город', cls:'green', fn() { S.phase = 'night'; save(); } },
      { label:'Сразу спать', fn() { setTimeout(sleep, 0); } }
    ] });
}
function sleep(fromBedWake = false) {
  if (!S) return;
  // Если игрок нажал «Спать» (в кровати, блокноте или карточке вечера), а анимация засыпания в кровати ещё не проиграна —
  // укладываем героя в его кровать в квартире № 4 со смыканием глаз и пробуждением в той же кровати!
  if (!fromBedWake && W && W.startBedSleep) {
    if (W.setHatch) W.setHatch(false);
    T = null;
    if (W.NP && W.NP.open) W.closeNotepadAnim && W.closeNotepadAnim();
    npOpen = false;
    sheetOpen = false;
    cards = [];
    render();
    W.startBedSleep();
    return;
  }
  S.hp = Math.min(S.maxHp || 100, (S.hp ?? 100) + ((S.hunger ?? 100) > 15 ? 60 : 20));
  S.hunger = Math.max(0, (S.hunger ?? 100) - 18);
  S.sleepDeprived = false;
  if (S.flags) S.flags.sleepDeprived = false;
  if (W && W.P) { W.P.hp = S.hp; W.P.stam = 100; W.P.bleed = 0; }
  if (W && W.setHatch) W.setHatch(false);
  T = null;
  S.phase = 'morning';
  advanceDay(true);
}
function nightEvents() {
  // ограбление
  const protectedByStreet = S.rep.street >= 30 || S.flags.underRoof;
  const robChance = S.up.shutters ? 0 : (S.flags.angryRacket ? .45 : .1) * (protectedByStreet ? .2 : 1);
  if (Math.random() < robChance) {
    let lost = 0; for (const id of GOOD_IDS) { const n = Math.floor(qOf(id) * (S.flags.angryRacket ? .5 : .3)); if (n) { takeStock(id, n); lost += n; } }
    if (lost) queueCard({ title:'🌙 Ночью ларёк вскрыли', html:`<p>Утром дверь висела на одной петле. Пропало ${lost} шт. товара.</p>
      <p class="muted">${S.flags.angryRacket ? 'Колян, проходя мимо, ухмыльнулся.' : 'Сигнализация бы не помешала.'}</p>` });
  }
  if (W && W.life && Math.random() < robChance * 1.5 + .04) { // пачки денег, брошенные вне сейфа, до утра не доживают
    let gone = 0; for (const it of W.life.items.slice()) if (it.kind === 'good' && it.data && it.data.goodId === 'cash' && !SAFE_BOX(it) && it !== W.life.held) { gone += it.data.amount || 0; W.life.removeItem(it); }
    if (gone > 0) { W.life.persist && W.life.persist(); queueCard({ title: '🌙 Пропали деньги', html: `<p>Пачки, оставленные в ларьке на виду, к утру исчезли: <b>−${fmt(gone)} ₽</b>.</p><p class="muted">В сейфе за плакатом их бы не нашли.</p>` }); }
  }
  S.flags.angryRacket = false;

  const pool = [];
  pool.push('press', 'helpYard');
  if (S.day >= 3) pool.push('palenka', 'chelnokDeal');
  if (S.day >= 5) pool.push('errand');
  if (S.day >= 2 && !S.permit) pool.push('permitOffer');
  if (Math.random() < .55) {
    const e = pick(pool);
    if (e === 'press') queueCard({ title:'📰 Местная пресса', html:'<p>Корреспондент «Краснозаводской правды» пишет про «новых предпринимателей». Дадите интервью?</p>',
      buttons:[{ label:'Дать интервью', cls:'green', fn() { if (S.markup <= .5) { rep('folk', 4); toast('«Честный торговец с остановки». Народ +4', 'good'); } else { rep('folk', -3); toast('Статья вышла под заголовком «Спекулянты»... Народ −3', 'bad'); } } },
        { label:'Нет уж' }] });
    if (e === 'helpYard') queueCard({ title:'🏚 Двор просит помощи', html:'<p>В доме прорвало трубу. Соседи скидываются на сантехника.</p>',
      buttons:[{ label:`Скинуться ${fmt(usdToRub(3))} ₽`, cls:'green', disabled: S.money < usdToRub(3), fn() { S.money -= usdToRub(3); rep('folk', 5); toast('Народ +5', 'good'); } }, { label:'Пройти мимо', fn() { rep('folk', -1); } }] });
    if (e === 'palenka') { const q = 15, cost = Math.round(S.prices.vodka * .4);
      queueCard({ title:'🍾 Выгодное предложение', html:`<p>Мужик в кожанке: «Есть ящик «Короля», почти настоящий. ${q} бутылок по ${fmt(cost)} ₽. Берёшь?»</p>`,
        buttons:[{ label:`Взять за ${fmt(cost * q)} ₽`, disabled: S.money < cost * q || stockTotal() + q > storeCap(), fn() { S.money -= cost * q; addStock('vodka', q, cost); rep('street', 3); rep('law', -3); rep('folk', -2); toast('Улица +3, Закон −3, Народ −2'); } },
          { label:'Не надо мне палёнки', fn() { rep('folk', 1); } }] }); }
    if (e === 'chelnokDeal') queueCard({ title:'🧳 Челнок Ашот', html:'<p>«Давай дружить: дашь $10 — два дня будешь брать на рынке через меня, на 15% дешевле».</p>',
      buttons:[{ label:`Дать ${fmt(usdToRub(10))} ₽`, disabled: S.money < usdToRub(10), fn() { S.money -= usdToRub(10); S.cheap = 2; toast('Скидка 15% на рынке на 2 дня', 'good'); } }, { label:'Сам справлюсь' }] });
    if (e === 'errand') queueCard({ title:'📦 Поручение от «заводских»', html:'<p>Колян: «Отвези пакетик на вокзал. Что внутри — не твоё дело. Заплатим».</p>',
      buttons:[{ label:'Отвезти', cls:'red', fn() {
          if (Math.random() < .2) { rep('law', -10); const f = Math.min(S.money, usdToRub(15)); S.money -= f; toast(`Остановил патруль. Штраф ${fmt(f)} ₽, Закон −10`, 'bad'); }
          else { S.money += usdToRub(20); rep('street', 8); rep('law', -6); toast('+$20 рублями. Улица +8, Закон −6'); } } },
        { label:'Отказаться', fn() { rep('street', -3); } }] });
    if (e === 'permitOffer') queueCard({ title:'📄 Разрешение на торговлю', html:`<p>В администрации можно оформить разрешение. С ним проверки проходят спокойно.</p>`,
      buttons:[{ label:`Оформить честно (${fmt(usdToRub(25))} ₽)`, cls:'green', disabled: S.money < usdToRub(25), fn() { S.money -= usdToRub(25); S.permit = true; rep('law', 5); toast('Разрешение есть! Закон +5', 'good'); } },
        { label:`Через знакомого (${fmt(usdToRub(12))} ₽)`, disabled: S.money < usdToRub(12), fn() { S.money -= usdToRub(12); S.permit = true; rep('law', -2); rep('street', 2); toast('Бумага есть, но «через знакомых». Закон −2'); } },
        { label:'Потом' }] });
  }
  // ВЕЧНЫЕ КАЧЕЛИ: МИЛИЦИЯ VS БАНДИТЫ И ПЕРМАНЕНТНЫЙ КРИЗИС
  if ((S.rep.law || 0) >= 35 && (S.rep.street || 0) <= -12 && Math.random() < .45) {
    const extort = usdToRub(65);
    queueCard({
      title: '🔥 Качели фракций: Залётные гастролёры!',
      html: `<p>Вы помогли милиции зачистить местных пацанов, и свято место пусто не бывает: в Краснозаводск заехали <b>отмороженные залётные гастролёры</b> с трассы. Даже участковый разводит руками — без связей на улице их не удержать!</p>`,
      buttons: [
        { label: `Откупиться (${fmt(extort)} ₽) и искать баланс с улицей`, cls: 'red', disabled: S.money < extort, fn() { S.money -= extort; rep('street', 10); toast('Гастролёры взяли дань. Придётся возвращать вес на улице!'); } },
        { label: 'Связаться со смотрящими и дать отпор (−25 HP, Улица +15)', fn() { S.hp = Math.max(20, (S.hp || 100) - 25); rep('street', 15); toast('Вместе с местными пацанами дали отпор гастролёрам! Улица +15', 'good'); } }
      ]
    });
  } else if ((S.rep.street || 0) >= 40 && (S.rep.law || 0) <= -12 && Math.random() < .45) {
    const obrok = usdToRub(80);
    queueCard({
      title: '⚖️ Качели фракций: Беспредел крыши!',
      html: `<p>Почувствовав полную безнаказанность и слабость милиции, блатные задрали неподъёмный оброк на все коммерческие точки района (<b>${fmt(obrok)} ₽</b>)!</p>`,
      buttons: [
        { label: `Заплатить оброк (${fmt(obrok)} ₽)`, disabled: S.money < obrok, fn() { S.money -= obrok; toast('Заплатили повышенный оброк братве.', 'bad'); } },
        { label: 'Тайно слить маршрут бригады оперативникам РОВД (Закон +16, Улица −18)', cls: 'green', fn() { rep('law', 16); rep('street', -18); toast('Оперативники приняли наводку и прижали вымогателей! Баланс сил восстановлен.', 'good'); } }
      ]
    });
  }
}
function debtDeadline() {
  if (S.debt <= 0) {
    queueCard({ title:'Декабрь 1992', html:'<p>Колян приходит, пересчитывает старые записи дяди и кивает: «Чисто. Уважаю». Долг закрыт.</p>', buttons:[{ label:'С наступающим!', fn() { rep('street', 5); } }] });
    return;
  }
  const debtRub = usdToRub(S.debt);
  queueCard({ title:'⏰ Срок долга вышел', html:`<p>Последний вечер 1992-го. Колян с двумя друзьями стоит у ларька. За вами ещё <b>$${S.debt}</b> (${fmt(debtRub)} ₽).</p>`,
    buttons:[
      { label:`Отдать всё сейчас (${fmt(debtRub)} ₽)`, cls:'green', disabled: S.money < debtRub, fn() { S.money -= debtRub; S.debt = 0; rep('street', 3); toast('Долг закрыт в последний момент!', 'good'); } },
      { label:'«Отработать» — стать своим у «заводских»', cls:'red', fn() { S.debt = 0; S.flags.underRoof = true; rep('street', 20); rep('law', -15); toast('Теперь вы под «крышей». Улица +20, Закон −15'); } },
      { label:'Отдать товаром и половиной кассы', fn() { S.debt = 0; S.money = Math.round(S.money / 2); for (const id of GOOD_IDS) if (S.stock[id]) S.stock[id].q = Math.floor(S.stock[id].q / 3); rep('street', -5); toast('Начинаем 1993-й почти с нуля...', 'bad'); } },
    ] });
}
function advanceDay(stayInBed = false) {
  const prevDay = S.day;
  S.day++;
  // инфляция и курс
  const y = yearOf(S.day);
  let infl = y === 1992 ? R(.09, .16) : R(.06, .11);
  if (prevDay === 1) infl = R(.3, .4); // январский шок 92-го
  S.inflLast = infl;
  S.idx *= 1 + infl;
  let rateMove = infl + R(-.03, .04);
  // «Чёрный вторник» в свободном режиме (октябрь 1994)
  const blackTuesday = yearOf(S.day) === 1994 && monthOf(S.day) === 9;
  if (blackTuesday) rateMove += .35;
  S.rate = Math.round(S.rate * (1 + rateMove));
  S.rateHist.push(S.rate); if (S.rateHist.length > 30) S.rateHist.shift();
  // волны моды
  if (S.day === S.nextWaveDay) {
    S.wave = { item: S.flags.nextWaveItem, until: S.day + 2 };
    S.nextWaveDay = S.day + RI(4, 5); S.flags.nextWaveItem = null;
  }
  if (S.day + 1 === S.nextWaveDay) {
    const cand = ['tape','gum','soda','choc','batt','beer'].concat(S.day + 1 >= 13 ? ['toy','toy'] : []);
    S.flags.nextWaveItem = pick(cand.filter(c => !S.wave || c !== S.wave.item));
  }
  genPrices();
  if (S.cheap > 0) S.cheap--;
  // 0) Хлеб черствеет, газеты устаревают: на следующий день продаются хуже, на второй — списываются
  S.fresh = S.fresh || {};
  { const gone = [];
    for (const id of Object.keys(SHELF_LIFE)) {
      if (qOf(id) <= 0) { S.fresh[id] = 0; continue; }
      S.fresh[id] = (S.fresh[id] || 0) + 1;
      if (S.fresh[id] > SHELF_LIFE[id]) { const n = qOf(id); takeStock(id, n); S.fresh[id] = 0; gone.push(`${GOODS[id].short} — ${n} шт.`); }
    }
    if (gone.length) queueCard({ title: '🗑 Списание', html: `<p>Не успели продать вовремя: <b>${gone.join(', ')}</b>.</p><p class="muted">Хлеб и газеты берите понемногу — они живут один день. Чёрствый хлеб и вчерашние газеты продаются хуже.</p>` });
  }
  // 1) Срок годности мясных продуктов с Мясокомбината без холодильника «ЗИЛ» (2 дня)
  if ((qOf('tushonka') > 0 || qOf('kilka') > 0) && !(S.up && S.up.fridge)) {
    S.meatUnchilledDays = (S.meatUnchilledDays || 0) + 1;
    if (S.meatUnchilledDays >= 2) {
      const spT = Math.min(qOf('tushonka'), Math.max(1, Math.ceil(qOf('tushonka') * .5)));
      const spK = Math.min(qOf('kilka'), Math.max(1, Math.ceil(qOf('kilka') * .5)));
      if (spT > 0) takeStock('tushonka', spT);
      if (spK > 0) takeStock('kilka', spK);
      S.meatUnchilledDays = 0;
      const sesFine = Math.min(S.money, usdToRub(8));
      S.money -= sesFine;
      rep('folk', -8);
      rep('law', -4);
      queueCard({
        title: '🤢 Протухшее мясо и проверка СЭС!',
        html: `<p>Без холодильника «ЗИЛ-Москва» мясные продукты с Мясокомбината испортились в тёплом ларьке за 2 дня! Пришлось списать <b>${spT + spK} шт.</b> товара.</p>
          <p class="muted">По жалобе покупателей на запах заглянул инспектор СЭС и выписал санитарный штраф <b>${fmt(sesFine)} ₽</b> (Народ −8, Закон −4). Купите холодильник «ЗИЛ» во вкладке «Герой»!</p>`
      });
    }
  } else {
    S.meatUnchilledDays = 0;
  }
  // 1б) Система порчи продуктов и крыс на складе (если хранить еду на полу или копить тухлятину)
  tickDailySpoilageAndRats();
  // 2) Квартирный вопрос: долг Бабе Зине за однушку (каждые 7 дней)
  if (S.day % 7 === 0 && !(S.flags && S.flags.rentPaidWeek === S.day)) {
    const rentCost = usdToRub(15);
    const intLv = (S.sk && S.sk.charm) || 0;
    queueCard({
      title: '👵 Хозяйка квартиры Баба Зина',
      html: `<p>В дверь стучит Баба Зина: <i>«Ты уже два месяца за однушку не платишь, квартирант! Гони <b>${fmt(rentCost)} ₽</b> за жильё, иначе выставлю чемоданы за дверь — будешь в своём холодном ларьке на полу ночевать!»</i></p>`,
      buttons: [
        ...(S.money >= rentCost ? [{
          label: `💴 Заплатить квартплату Бабе Зине (${fmt(rentCost)} ₽)`,
          cls: 'green',
          fn() { S.money -= rentCost; S.flags.rentPaidWeek = S.day; rep('folk', 4); toast('Баба Зина довольна и угостила вас горячим борщом! Народ +4', 'good'); save(); render(); }
        }] : []),
        ...(intLv >= 1 ? [{
          label: `🧠 [Интеллект ${intLv * 25 + 25}/100] Убедить Бабу Зину подождать недельку и подарить батон хлеба с чаем`,
          cls: 'yellow',
          fn() { S.flags.rentPaidWeek = S.day; rep('folk', 2); toast('Вы грамотно успокоили Бабу Зину — она согласилась подождать без скандала!', 'good'); save(); render(); }
        }] : []),
        {
          label: 'Поругаться и ночевать на полу в холодном ларьке (−Здоровье и −Народ)',
          cls: 'red',
          fn() { rep('folk', -6); S.hp = Math.max(45, (S.hp || 100) - 25); if (W && W.P) W.P.hp = S.hp; toast('Пришлось спать на холодном полу в ларьке — спину продуло (Здоровье −25, Народ −6)!', 'bad'); save(); render(); }
        }
      ]
    });
  }
  // 3) Выкуп штучного спецзаказа «Посылторга» клиентом у ларька
  if (S.posylSpecialOrder && S.day >= S.posylSpecialOrder.readyDay) {
    const ord = S.posylSpecialOrder;
    S.posylSpecialOrder = null;
    const payout = Math.round(ord.cost * 1.78);
    S.money += payout;
    rep('folk', 4);
    rep('street', 3);
    queueCard({
      title: `📦 Спецзаказ «Посылторга» выкуплен!`,
      html: `<p>К окошку ларька подошёл заказчик и забрал доставленный через «Посылторг» дефицит: <b>${ord.title}</b>.</p>
        <div class="card"><div class="row sp"><span>Закупочная цена</span><b>${fmt(ord.cost)} ₽</b></div>
        <div class="row sp"><span>Оплата от клиента</span><b class="dn">+${fmt(payout)} ₽</b></div>
        <div class="row sp"><span>Чистая прибыль</span><b class="dn">+${fmt(payout - ord.cost)} ₽</b></div></div>`,
      onShow: () => sfx.fanfare && sfx.fanfare()
    });
  }
  // пирамида
  let pmpNews = null;
  if (S.pmp > 0 && !S.pmpDead) {
    if (S.day >= S.pmpCrashDay) { pmpNews = `Офис «ПМП» закрыт. Вкладчики стоят у дверей. Ваши ${fmt(S.pmp)} ₽ пропали.`; S.pmp = 0; S.pmpDead = true; }
    else S.pmp = Math.round(S.pmp * 1.3);
  } else if (!S.pmpDead && S.day >= S.pmpCrashDay) { S.pmpDead = true; pmpNews = 'Фонд «ПМП» лопнул. Хорошо, что вас там не было.'; }
  // ваучерный фонд
  let fundNews = null;
  if (S.voucher === 'fund' && S.day >= 18 && !S.fundGone) { S.fundGone = true; fundNews = 'Чековый фонд «Золотой телёнок» исчез вместе с офисом и ваучерами вкладчиков.'; }

  // новости
  const news = [];
  news.push(`Наступил ${MONTHS[monthOf(S.day)].toLowerCase()} ${yearOf(S.day)}-го. Цены за месяц выросли на ${Math.round(infl * 100)}%.`);
  news.push(`Курс доллара в обменниках: ${fmt(S.rate)} ₽.${blackTuesday ? ' ОБВАЛ РУБЛЯ! «Чёрный вторник»!' : ''}`);
  if (S.flags.nextWaveItem) news.push(`В Москве ажиотаж: все сметают «${GOODS[S.flags.nextWaveItem].short}». Скоро докатится и до нас!`);
  if (waveItem()) news.push(`Мода дня: «${GOODS[waveItem()].short}». Дефицит, цены на опте подскочили.`);
  if (pmpNews) news.push(pmpNews);
  if (fundNews) news.push(fundNews);
  if (!S.pmpDead && S.day >= 14 && S.day + 1 >= S.pmpCrashDay && Math.random() < .6 + .2 * S.sk.sense) news.push('Налоговая инспекция заинтересовалась фондом «ПМП». Вкладчики волнуются.');
  if (yearOf(S.day) === 1994 && monthOf(S.day) === 8) news.push('Аналитики шепчутся: рубль перегрет, осенью возможны сюрпризы.');
  news.push(pick(['Краснозаводский завод снова задержал зарплату.', 'В ДК открылся видеосалон: «Терминатор-2» каждый вечер.', 'Синоптики обещают перемены погоды.',
    'Гороскоп от Глобы-младшего: Тельцам везёт в торговле.', 'На рынке поймали карманника. Будьте бдительны.', 'В городе открылся первый коммерческий банк «Красный капитал».',
    'Телемагазин: чудо-нож режет всё, даже консервную банку!', 'Депутаты горсовета спорят о новых налогах на ларьки.']));
  if (stayInBed) {
    S.phase = 'morning';
    tab = 'kiosk';
    syncAmmoToWeapon();
    save();
    renderHud();
    renderControls();
    toast(`☀️ Утро (${dateStr(S.day)}). Вы проснулись в своей кровати — нажмите «Встать с кровати», чтобы подняться!`, 'good');
    if (S.day === 13 && !S.free) chapter2Intro();
    return;
  }
  queueCard({ title:'📺 Новости', html:`<div class="tv"><div class="scr"><ul style="padding-left:18px;margin:0">${news.map(n => `<li>${n}</li>`).join('')}</ul></div><div class="brand">РУБИН</div></div>`,
    onShow: () => sfx.tv() });

  // начало главы 2
  if (S.day === 13 && !S.free) chapter2Intro();

  queueCard({ title:'☀️ Утро', html:`<p>${dateStr(S.day)}. Пора открывать ларёк.</p>${S.sp > 0 ? '<p class="warn">Есть очки навыков — загляните во вкладку «Герой».</p>' : ''}`,
    buttons:[{ label:'Вперёд', cls:'green', fn() { S.phase = 'morning'; tab = 'kiosk'; syncAmmoToWeapon(); save(); } }] });
}
function chapter2Intro() {
  queueCard({ title:'Глава 2 · 1993 «Ваучер»',
    html:`<p>Новый год вы встретили у телевизора. Страна делит заводы: каждому выдали по ваучеру — «две «Волги»», как обещали.</p>
      <p>В блокноте заказов появились новые товары и одежда 1993 года.</p>
      <p class="goal">Цель главы: открыть павильон ($500) и пережить 1993 год с хорошим капиталом.</p>` });
  const vsell = usdToRub(20);
  queueCard({ title:'🎫 Что делать с ваучером?',
    html:'<p>Ваучер можно вложить в чековый фонд, в акции родного завода или просто продать у метро.</p>',
    buttons:[
      { label:'Фонд «Золотой телёнок» (обещают ×10)', fn() { S.voucher = 'fund'; toast('Ваучер в фонде. Ждём ×10!'); } },
      { label:'Акции Краснозаводского завода', cls:'green', fn() { S.voucher = 'zavod'; rep('folk', 5); toast('Вы — совладелец завода! Народ +5', 'good'); } },
      { label:`Продать за ${fmt(vsell)} ₽`, fn() { S.voucher = 'sold'; S.money += vsell; } },
    ] });
}
function finale() {
  const cap = capitalUsd() + (S.voucher === 'zavod' ? 100 : 0);
  const r = S.rep;
  let end, text;
  if (r.street >= 40 && r.street >= r.law && r.street >= r.folk) {
    end = 'Хозяин района'; text = 'Вас знают все ларьки от остановки до вокзала. «Заводские» здороваются за руку, а милиция делает вид, что не замечает. Денег много, но спать приходится вполглаза.';
  } else if (r.law >= 20 && cap >= 600) {
    end = 'Легальный бизнесмен'; text = 'Разрешения, налоги, бухгалтер — всё по-взрослому. Банк «Красный капитал» предлагает кредит на сеть магазинов. Город уважает.';
  } else if (r.folk >= 20) {
    end = 'Свой человек'; text = 'Не олигарх, но весь двор покупает только у вас, бабушки приносят пирожки, а дети знают вас по имени. Скромный, но честный успех.';
  } else {
    end = 'Просто ларёчник'; text = 'Вы пережили два безумных года. Ни империи, ни славы — но ларёк стоит, и это уже немало.';
  }
  S.ending = end;
  queueCard({ title:'1993 · Итог', html:`<h2 style="color:var(--red)">${end}</h2><p>${text}</p>
    <div class="card"><div class="row sp"><span>Капитал</span><b>$${fmt(cap)}</b></div>
    <div class="row sp"><span>Улица / Закон / Народ</span><b>${Math.round(r.street)} / ${Math.round(r.law)} / ${Math.round(r.folk)}</b></div>
    <div class="row sp"><span>Вкладыши</span><b>${S.cards.length}/${CARD_NAMES.length}</b></div>
    <div class="row sp"><span>Павильон</span><b>${S.up.pavilion ? 'да' : 'нет'}</b></div></div>
    <p class="muted">Главы 3–8 (1994–1999: «Чёрный вторник», «Крыша», «Выборы», «Дефолт»...) — в следующих обновлениях. Можно продолжить в свободном режиме.</p>`,
    buttons:[{ label:'Продолжить торговать', cls:'green', fn() { S.free = true; S.phase = 'night'; save(); } }, { label:'Новая игра', fn() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} S = null; cards = []; render(); } }],
    onShow: () => sfx.fanfare() });
}

// ============================================================
//  Опыт и навыки
// ============================================================
const xpNeed = l => 30 + l * 35;
function checkLevel() {
  while (S.xp >= xpNeed(S.lvl)) { S.xp -= xpNeed(S.lvl); S.lvl++; toast(`Новый уровень героя: ${S.lvl + 1}!`, 'good'); }
}
const SKILL_NAMES = { sense: 'Физкультура', charm: 'Интеллект', trade: 'Торговля' };
function gainSkillXp(k, pts = 20, label = '') {
  if (!S) return;
  S.sk = S.sk || { trade: 0, charm: 0, sense: 0 };
  S.skXp = S.skXp || { trade: 0, charm: 0, sense: 0 };
  if ((S.sk[k] || 0) >= 3) { S.skXp[k] = 100; return; }
  S.skXp[k] = (S.skXp[k] || 0) + pts;
  if (S.skXp[k] >= 100) {
    S.skXp[k] -= 100;
    S.sk[k] = Math.min(3, (S.sk[k] || 0) + 1);
    if (S.sk[k] >= 3) S.skXp[k] = 100;
    if (k === 'sense') {
      S.maxHp = Math.min(160, (S.maxHp || 100) + 15);
      S.hp = Math.min(S.maxHp, (S.hp || 100) + 15);
      if (W && W.P) W.P.hp = S.hp;
    }
    sfx.fanfare && sfx.fanfare();
    toast(`${label ? label + ': ' : ''}навык «${SKILL_NAMES[k]}» вырос (уровень ${S.sk[k] * 30 + 10}/100)!`, 'good');
  } else if (label && pts >= 25) {
    toast(`${label} (${SKILL_NAMES[k]}: ${Math.round(S.skXp[k])}%)`, 'good');
  }
  save();
}



// ============================================================
//  Обменник
// ============================================================
function exchHtml() {
  const buyRate = Math.round(S.rate * 1.04), sellRate = Math.round(S.rate * .96);
  const trade = S.phase !== 'morning';
  const pmpOpen = (chapter() === 2 || S.free) && S.day >= 14 && !S.pmpDead;
  return `<h2>💱 Обменник «Валюта 24»</h2>
    <canvas class="chart" id="chart"></canvas>
    <div class="row sp" style="margin-top:6px"><span>Купить $: <b>${fmt(buyRate)} ₽</b></span><span>Продать $: <b>${fmt(sellRate)} ₽</b></span></div>
    <p class="muted">Рубли тают каждый месяц. Доллары под матрасом — классика эпохи.</p>
    <div class="card"><div class="row sp"><b>Купить доллары</b><span>
      <button class="btn small" data-usd="buy" data-n="1" ${trade ? 'disabled' : ''}>$1</button>
      <button class="btn small" data-usd="buy" data-n="10" ${trade ? 'disabled' : ''}>$10</button>
      <button class="btn small" data-usd="buy" data-n="all" ${trade ? 'disabled' : ''}>На все</button></span></div>
      <div class="row sp" style="margin-top:8px"><b>Продать доллары</b><span>
      <button class="btn small" data-usd="sell" data-n="1" ${trade ? 'disabled' : ''}>$1</button>
      <button class="btn small" data-usd="sell" data-n="10" ${trade ? 'disabled' : ''}>$10</button>
      <button class="btn small" data-usd="sell" data-n="all" ${trade ? 'disabled' : ''}>Все</button></span></div></div>

    ${pmpOpen || S.pmp > 0 ? `<div class="card"><b>🏦 Фонд «ПМП» — 30% в месяц!</b>
      <div class="muted">«Мы не летаем — мы растём!» Вложено сейчас: <b>${fmt(S.pmp)} ₽</b>. Выйти можно в любой момент... пока офис открыт.</div>
      <div class="row" style="margin-top:8px;gap:6px">
        <button class="btn small yellow" data-a="pmpIn" ${S.money < 100 || trade || S.pmpDead ? 'disabled' : ''}>Вложить ¼ кассы</button>
        <button class="btn small" data-a="pmpOut" ${S.pmp <= 0 || trade ? 'disabled' : ''}>Забрать всё</button></div></div>` : ''}
    ${S.voucher ? `<div class="card"><b>🎫 Ваучер:</b> ${{ fund: S.fundGone ? 'фонд «Золотой телёнок» исчез 🙃' : 'в фонде «Золотой телёнок» (обещают ×10)', zavod:'акции завода, дивиденды каждый месяц', sold:'продан' }[S.voucher]}</div>` : ''}`;
}
function drawChart() {
  const c = $('#chart'); if (!c) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2), w = c.clientWidth, h = c.clientHeight;
  c.width = w * dpr; c.height = h * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const d = S.rateHist, mx = Math.max(...d) * 1.05, mn = Math.min(...d) * .95;
  g.strokeStyle = '#2f4a4a'; g.lineWidth = 1;
  for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, h * i / 4); g.lineTo(w, h * i / 4); g.stroke(); }
  g.strokeStyle = '#7fe0a0'; g.lineWidth = 2; g.beginPath();
  d.forEach((v, i) => { const x = d.length === 1 ? w / 2 : 8 + i * (w - 16) / (d.length - 1), y = h - 10 - (v - mn) / (mx - mn || 1) * (h - 24); i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.stroke();
  g.fillStyle = '#d6f0e0'; g.font = '700 12px "Courier New", monospace'; g.fillText('USD/RUB  ' + fmt(S.rate), 8, 16);
}
function usdOp(kind, n) {
  const buyRate = Math.round(S.rate * 1.04), sellRate = Math.round(S.rate * .96);
  if (kind === 'buy') {
    const k = n === 'all' ? Math.floor(S.money / buyRate) : Math.min(+n, Math.floor(S.money / buyRate));
    if (k <= 0) { toast('Не хватает рублей', 'bad'); return; }
    S.money -= k * buyRate; S.usd += k;
  } else {
    const k = n === 'all' ? S.usd : Math.min(+n, S.usd);
    if (k <= 0) { toast('Нет долларов', 'bad'); return; }
    S.usd -= k; S.money += k * sellRate;
  }
  sfx.coin(); render();
}

// ============================================================
//  Герой
// ============================================================
// долг, фонд «ПМП» и ваучер (раньше были в обменнике, который убран)
const debtPayable = () => Math.min(S.debt, S.usd + Math.floor(S.money / Math.round(S.rate * 1.04)));
function financeHtml() {
  const trade = S.phase !== 'morning';
  const pmpOpen = (chapter() === 2 || S.free) && S.day >= 14 && !S.pmpDead;
  return `
    ${pmpOpen || S.pmp > 0 ? `<div class="card"><b>🏦 Фонд «ПМП» — 30% в месяц!</b>
      <div class="muted">«Мы не летаем — мы растём!» Вложено сейчас: <b>${fmt(S.pmp)} ₽</b>. Выйти можно в любой момент... пока офис открыт.</div>
      <div class="row" style="margin-top:8px;gap:6px">
        <button class="btn small yellow" data-a="pmpIn" ${S.money < 100 || trade || S.pmpDead ? 'disabled' : ''}>Вложить ¼ кассы</button>
        <button class="btn small" data-a="pmpOut" ${S.pmp <= 0 || trade ? 'disabled' : ''}>Забрать всё</button></div></div>` : ''}
    ${S.voucher ? `<div class="card"><b>🎫 Ваучер:</b> ${{ fund: S.fundGone ? 'фонд «Золотой телёнок» исчез 🙃' : 'в фонде «Золотой телёнок» (обещают ×10)', zavod:'акции завода, дивиденды каждый месяц', sold:'продан' }[S.voucher]}</div>` : ''}`;
}
let selectedInvKey = null;

const GOOD_ICON_MAP = {
  matches: '🔥', plug: '⚫', cig: '🚬', kontra: '🚬', beer: '🍺', vodka: '🍾', samogon: '🫙', soda: '🥤',
  bread: '🍞', choc: '🍫', gum: '🍬', seeds: '🌻', tea: '🍵', tushonka: '🥫', kilka: '🐟',
  paper: '📰', cassette: '📼', vhs: '📹', bottle: '🍾',
  weed: '🌿', meth: '💊', anabolics: '💉', pills: '💊'
};

// Формирует список предметов в карманах (максимум 10 слотов, только небольшие предметы!)
function buildPocketWheelList() {
  ensureState();
  const list = [];
  const pushSlot = obj => {
    if (list.length < MAX_POCKET_SLOTS) list.push(obj);
  };

  // 1. Наличные рубли в кармане (1 слот с выбором номинала купюры/монеты)
  const rub = Math.floor(S.money || 0);
  if (rub > 0) {
    pushSlot({
      key: 'item:rub', isRub: true, total: rub,
      icon: rub <= 10 ? '🪙' : '💴',
      short: fmt(rub) + ' ₽',
      count: fmt(rub) + '₽',
      name: `Наличные рубли в кармане (${fmt(rub)} ₽)`,
      desc: 'Наличные рубли Госбанка. Потяните в сторону слота, чтобы взять купюру в руку.'
    });
  }

  // 2. Доллары США в кармане (1 слот с выбором номинала)
  const usd = Math.floor(S.usd || 0);
  if (usd > 0) {
    pushSlot({
      key: 'item:usd', isUsd: true, total: usd,
      icon: '💵',
      short: '$' + fmt(usd),
      count: '$' + fmt(usd),
      name: `Доллары США в кармане ($${fmt(usd)})`,
      desc: 'Твёрдая американская валюта. Потяните в сторону слота, чтобы взять доллары в руку.'
    });
  }

  // 3. Пачка сигарет в кармане
  if ((S.cigs || 0) > 0) {
    pushSlot({
      key: 'item:cigs',
      icon: '🚬',
      short: 'Сигареты',
      count: '×' + S.cigs,
      name: `Пачка сигарет (${S.cigs} шт.)`,
      desc: 'Пачка сигарет с фильтром. Возьмите в руку, чтобы закурить.'
    });
  }

  // 4. Пачка патронов в кармане
  const ammoRes = W ? (W.weapon.reserve || 0) : (S.shells || 0);
  if (ammoRes > 0) {
    pushSlot({
      key: 'item:ammo',
      icon: '🧧',
      short: 'Патроны',
      count: '×' + ammoRes,
      name: `Пачка охотничьих патронов 12 кал. (${ammoRes} шт.)`,
      desc: 'Охотничьи патроны 12 калибра с картечью для двустволки.'
    });
  }

  // 5. Маленькое оружие: Свинцовый кастет
  if (S.flags && S.flags.hasBrassKnuckles) {
    pushSlot({
      key: 'item:knuckles',
      icon: '🥊',
      short: 'Кастет',
      count: '',
      name: 'Свинцовый кастет',
      desc: 'Тяжёлое компактное оружие в кармане — вдвое усиливает удар кулаком в драке.'
    });
  }

  // 6. Маленькое оружие за пазухой (Обрез / Ружьё при себе)
  if (S.gunState === 'carried') {
    const loaded = W ? (W.weapon.ammo || 0) : (S.ammo || 0);
    pushSlot({
      key: 'item:gun',
      icon: '🔫',
      short: 'Обрез 12к',
      count: loaded + '/2',
      name: `Оружие 12 кал. за пазухой (заряжено: ${loaded}/2)`,
      desc: 'Двуствольное ружьё 12 калибра под курткой. Потяните, чтобы достать в руки.'
    });
  }

  // 7. Фальшивые купюры
  if ((S.fakeBills || 0) > 0) {
    pushSlot({
      key: 'item:fake',
      icon: '🧾',
      short: 'Фальшивки',
      count: '×' + S.fakeBills,
      name: `Пачка фальшивых купюр (${S.fakeBills} шт.)`,
      desc: 'Липовые банкноты 1992 года. Потяните в сторону слота, чтобы взять в руку.'
    });
  }

  // 8. Препараты, наркотики, контрабанда, самогон в карманах (S.hidden)
  for (const hk of Object.keys(HIDDEN)) {
    const hq = (S.hidden && S.hidden[hk]) || 0;
    if (hq > 0) {
      pushSlot({
        key: 'hid:' + hk,
        isHid: true,
        hidId: hk,
        icon: GOOD_ICON_MAP[hk] || '💊',
        short: HIDDEN[hk].short,
        count: '×' + hq,
        name: `${HIDDEN[hk].name} (${hq} шт.)`,
        desc: 'Товар «из-под полы» в кармане куртки. Потяните, чтобы взять в руки.'
      });
    }
  }

  // 9. Небольшие предметы, положенные игроком в карман из рук (бутылки, пачки товаров, консервы, газеты, кассеты)
  S.pockets = Array.isArray(S.pockets) ? S.pockets : [];
  for (const pk of S.pockets) {
    if (!pk || !pk.uid) continue;
    const gid = pk.goodId || 'item';
    const gInfo = GOODS[gid] || HIDDEN[gid] || (W && W.aptItemInfo ? W.aptItemInfo(gid) : null) || null;
    const ic = pk.kind === 'bottle' ? '🍾' : gid === 'safekey' ? '🔑' : gid === 'aptkey' ? '🗝️' : (GOOD_ICON_MAP[gid] || '📦');
    const nm = pk.kind === 'bottle' ? 'Пустая стеклянная бутылка 0,5 л'
      : gid === 'safekey' ? 'Ключ от сейфа дяди Толи'
      : gid === 'aptkey' ? 'Ключ от квартиры № 4 (Советская, 14)'
      : gid === 'matches' ? 'Спички (коробок)'
      : gid === 'plug' ? 'Затычка для ванны'
      : pk.kind === 'pack' ? `Пачка: ${gInfo ? gInfo.name : gid} (${pk.count || 1} шт.)`
      : gInfo ? gInfo.name : 'Предмет в кармане';
    const ds = pk.kind === 'bottle' ? 'Пустая стеклянная бутылка 0,5 л. Потяните, чтобы взять в руку.'
      : gid === 'safekey' ? 'Латунный ключ с биркой «СЕЙФ» от потайного сейфа дяди Толи в ларьке.'
      : gid === 'aptkey' ? 'Ключ с биркой «КВ. 4» от квартиры на 2-м этаже дома № 14 по ул. Советской.'
      : gid === 'matches' ? 'Коробок спичек. С ним можно зажечь газовую плиту и духовку на кухне.'
      : gid === 'plug' ? 'Резиновая затычка на цепочке. Заткните ею слив ванны и откройте кран — ванна наберётся.'
      : pk.kind === 'pack' ? 'Небольшая упаковка товара в кармане. Потяните, чтобы взять в руки.'
      : (gid === 'cig' || gid === 'kontra') ? 'Пачка сигарет в кармане. Возьмите пачку в руки, чтобы закурить.'
      : (gInfo && gInfo.desc) ? gInfo.desc : 'Небольшой предмет в кармане. Потяните в сторону слота, чтобы взять в руки.';
    pushSlot({
      key: 'pkt:' + pk.uid,
      isPkt: true,
      pktUid: pk.uid,
      pktData: pk,
      icon: ic,
      short: gInfo ? (gInfo.short || gInfo.name) : 'Бутылка',
      count: (pk.count && pk.count > 1) ? ('×' + pk.count) : '',
      name: nm,
      desc: ds
    });
  }

  return list;
}

function buildInventoryMap() {
  const map = new Map();
  for (const it of buildPocketWheelList()) {
    map.set(it.key, it);
  }
  return map;
}

function actInvToHand(key) {
  if (!S || !W) return;
  const map = buildInventoryMap();
  const it = map.get(key);
  if (!it) return;
  if (W.life.held) {
    if (isHeldItemPocketable(W.life.held)) {
      pocketHeld();
    } else {
      sfx.bad && sfx.bad();
      toast('Руки уже заняты крупным предметом! Сначала поставьте его.', 'bad');
      return;
    }
  }

  if (it.isRub) {
    const avail = Math.floor(S.money || 0);
    const d = Math.min(avail, rdrCashDenom || 100);
    if (d <= 0) return;
    if (takeToHand(d <= 10 ? 'coin' : 'cash', d)) {
      S.money -= d;
      closeRdrInventory();
      sfx.coin(); save(); render();
      toast(d <= 10 ? `Достали из кармана монету ${d} ₽.` : `Достали из кармана купюру ${fmt(d)} ₽.`);
    }
    return;
  }

  if (it.isUsd) {
    const avail = Math.floor(S.usd || 0);
    const d = Math.min(avail, rdrUsdDenom || 10);
    if (d <= 0) return;
    if (takeToHand('usd', d)) {
      S.usd -= d;
      closeRdrInventory();
      sfx.coin(); save(); render();
      toast(`Достали из кармана $${fmt(d)}.`);
    }
    return;
  }

  if (key === 'item:cigs') {
    if (takeToHand('cig')) {
      S.cigs = Math.max(0, (S.cigs || 0) - 20);
      closeRdrInventory();
      sfx.click(); save(); render();
      toast('Достали пачку сигарет в руку.');
    }
    return;
  }

  if (key === 'item:ammo') {
    closeRdrInventory();
    if (S.gunState === 'carried' && !W.weapon.drawn) W.weapon.draw();
    sfx.click(); render();
    toast('Патроны наготове.');
    return;
  }

  if (key === 'item:knuckles') {
    closeRdrInventory();
    sfx.click(); render();
    toast('Свинцовый кастет надет на руку (урон кулаком ×2)!');
    return;
  }

  if (key === 'item:gun') {
    S.gunState = 'carried'; S.gun = true;
    closeRdrInventory();
    if (!W.weapon.drawn) W.weapon.draw();
    sfx.click(); save(); render();
    toast('Достали оружие в руки.');
    return;
  }

  if (key === 'item:fake') {
    if (takeToHand('cash', 1000)) {
      S.fakeBills = Math.max(0, (S.fakeBills || 1) - 1);
      closeRdrInventory();
      sfx.click(); save(); render();
      toast('Достали фальшивую купюру в руку.');
    }
    return;
  }

  if (it.isHid) {
    const hk = it.hidId;
    if ((S.hidden[hk] || 0) <= 0) return;
    if (takeToHand(hk)) {
      S.hidden[hk]--;
      closeRdrInventory();
      sfx.click(); W.updateShelves(); save(); render();
      toast(`Достали из кармана: ${HIDDEN[hk].name}.`);
    }
    return;
  }

  if (it.isPkt && it.pktData) {
    const pk = it.pktData;
    const P = W.P;
    let spawned = null;
    if (pk.kind === 'bottle') {
      spawned = W.life.addItem({ kind: 'bottle', x: P.x, y: 1.25, z: P.z, ry: P.yaw, data: {} });
    } else if (pk.kind === 'pack') {
      spawned = W.life.addItem({ kind: 'pack', x: P.x, y: 1.25, z: P.z, ry: P.yaw, data: { goodId: pk.goodId, count: pk.count || 1, maxCount: Math.max(5, pk.count || 1) } });
    } else {
      spawned = W.life.addItem({ kind: 'good', x: P.x, y: 1.25, z: P.z, ry: P.yaw, data: { goodId: pk.goodId, unitCost: pk.unitCost } });
    }
    if (spawned) {
      W.life.pick(spawned);
      W.life.persist && W.life.persist();
      S.pockets = (S.pockets || []).filter(x => x && x.uid !== pk.uid);
      closeRdrInventory();
      sfx.click(); save(); render();
      toast(`Достали из кармана: ${it.name}.`);
    }
    return;
  }
}

function actInvDropWorld(key) {
  if (!S || !W) return;
  const map = buildInventoryMap();
  const it = map.get(key);
  if (!it) return;
  const P = W.P;
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
  let dx = P.x + fx * .45, dz = P.z + fz * .45, dy = 1.12;
  if (W.inKiosk && W.inKiosk()) {
    dx = clamp(dx, -1.32, 1.32);
    dz = clamp(dz, -1.02, 1.02);
  }

  if (it.isRub) {
    const avail = Math.floor(S.money || 0);
    const d = Math.min(avail, rdrCashDenom || 100);
    if (d <= 0) return;
    S.money -= d;
    const dropped = W.life.addItem({ kind: 'good', x: dx, y: dy, z: dz, ry: P.yaw, data: { goodId: d <= 10 ? 'coin' : 'cash', amount: d } });
    dropped.state = 'ragdoll';
    dropped.vel = { x: fx * 2.2, y: 1.0, z: fz * 2.2 };
    W.life.persist && W.life.persist();
    sfx.coin(); save(); render();
    toast(d <= 10 ? `Выбросили из кармана монету ${d} ₽.` : `Выбросили из кармана купюру ${fmt(d)} ₽.`);
    return;
  }

  if (it.isUsd) {
    const avail = Math.floor(S.usd || 0);
    const d = Math.min(avail, rdrUsdDenom || 10);
    if (d <= 0) return;
    S.usd -= d;
    const dropped = W.life.addItem({ kind: 'good', x: dx, y: dy, z: dz, ry: P.yaw, data: { goodId: 'usd', amount: d } });
    dropped.state = 'ragdoll';
    dropped.vel = { x: fx * 2.2, y: 1.0, z: fz * 2.2 };
    W.life.persist && W.life.persist();
    sfx.coin(); save(); render();
    toast(`Выбросили из кармана $${fmt(d)}.`);
    return;
  }

  if (key === 'item:cigs') {
    S.cigs = Math.max(0, (S.cigs || 0) - 20);
    const dropped = W.life.addItem({ kind: 'good', x: dx, y: dy, z: dz, ry: P.yaw, data: { goodId: 'cig' } });
    dropped.state = 'ragdoll';
    dropped.vel = { x: fx * 2.0, y: .9, z: fz * 2.0 };
    W.life.persist && W.life.persist();
    sfx.click(); save(); render();
    toast('Выбросили пачку сигарет на землю.');
    return;
  }

  if (key === 'item:ammo') {
    if (W && W.weapon.reserve > 0) W.weapon.reserve = Math.max(0, W.weapon.reserve - 5);
    S.shells = Math.max(0, (S.shells || 0) - 5);
    syncAmmoFromWeapon();
    sfx.click(); save(); render();
    toast('Выбросили пачку патронов.');
    return;
  }

  if (key === 'item:knuckles') {
    S.flags.hasBrassKnuckles = false;
    sfx.click(); save(); render();
    toast('Выбросили свинцовый кастет.');
    return;
  }

  if (key === 'item:gun') {
    if (W.weapon.drawn) W.weapon.toggle();
    W.life.addItem({ kind: 'gun', x: dx, y: dy, z: dz, ry: P.yaw });
    S.gunState = 'world'; S.gun = false;
    W.life.persist && W.life.persist();
    sfx.click(); save(); render();
    toast('Выбросили оружие на землю.');
    return;
  }

  if (key === 'item:fake') {
    S.fakeBills = Math.max(0, (S.fakeBills || 1) - 1);
    const dropped = W.life.addItem({ kind: 'good', x: dx, y: dy, z: dz, ry: P.yaw, data: { goodId: 'cash', amount: 1000 } });
    dropped.state = 'ragdoll';
    dropped.vel = { x: fx * 2.2, y: 1.0, z: fz * 2.2 };
    W.life.persist && W.life.persist();
    sfx.click(); save(); render();
    toast('Выбросили фальшивую купюру на землю.');
    return;
  }

  if (it.isHid) {
    const hk = it.hidId;
    if ((S.hidden[hk] || 0) <= 0) return;
    S.hidden[hk]--;
    const dropped = W.life.addItem({ kind: 'good', x: dx, y: dy, z: dz, ry: P.yaw, data: { goodId: hk } });
    dropped.state = 'ragdoll';
    dropped.vel = { x: fx * 2.0, y: .9, z: fz * 2.0 };
    W.life.persist && W.life.persist();
    W.updateShelves(); sfx.click(); save(); render();
    toast(`Выбросили: ${HIDDEN[hk].name}.`);
    return;
  }

  if (it.isPkt && it.pktData) {
    const pk = it.pktData;
    let dropped = null;
    if (pk.kind === 'bottle') {
      dropped = W.life.addItem({ kind: 'bottle', x: dx, y: dy, z: dz, ry: P.yaw, data: {} });
    } else if (pk.kind === 'pack') {
      dropped = W.life.addItem({ kind: 'pack', x: dx, y: dy, z: dz, ry: P.yaw, data: { goodId: pk.goodId, count: pk.count || 1, maxCount: Math.max(5, pk.count || 1) } });
    } else {
      dropped = W.life.addItem({ kind: 'good', x: dx, y: dy, z: dz, ry: P.yaw, data: { goodId: pk.goodId, unitCost: pk.unitCost } });
    }
    if (dropped) {
      dropped.state = 'ragdoll';
      dropped.vel = { x: fx * 2.1, y: .95, z: fz * 2.1 };
      W.life.persist && W.life.persist();
    }
    S.pockets = (S.pockets || []).filter(x => x && x.uid !== pk.uid);
    sfx.click(); save(); render();
    toast(`Выбросили из кармана: ${it.name}.`);
    return;
  }
}

// Отрисовка центрального колеса инвентаря в стиле Red Dead Redemption 2 (по референсу 6390.webp:
// тёмное матовое кольцо с 10 секторами, информацией о предмете в центре без кнопок и взятием в руки наведением/оттягиванием в сторону)
function rdrWheelHtml() {
  const items = buildPocketWheelList();
  const itemMap = new Map(items.map(it => [it.key, it]));
  if (selectedInvKey && !itemMap.has(selectedInvKey)) selectedInvKey = items.length ? items[0].key : null;
  if (!selectedInvKey && items.length) selectedInvKey = items[0].key;
  const selItem = selectedInvKey ? itemMap.get(selectedInvKey) : null;
  const selIdx = selItem ? items.findIndex(it => it.key === selItem.key) : -1;

  // Генерируем SVG-разделители 10 секторов и подсветку выбранного сектора (как в RDR2 6390.webp)
  const R_IN = 68, R_OUT = 141.5, R_ARC = 142.5;
  const divLines = [];
  let activeWedgeSvg = '';
  for (let i = 0; i < MAX_POCKET_SLOTS; i++) {
    const a1 = (-108 + i * (360 / MAX_POCKET_SLOTS)) * Math.PI / 180;
    const a2 = (-72  + i * (360 / MAX_POCKET_SLOTS)) * Math.PI / 180;
    const x1 = (Math.cos(a1) * R_IN).toFixed(2),  y1 = (Math.sin(a1) * R_IN).toFixed(2);
    const x2 = (Math.cos(a1) * R_OUT).toFixed(2), y2 = (Math.sin(a1) * R_OUT).toFixed(2);
    divLines.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(255,255,255,0.09)" stroke-width="1.2"/>`);
    if (i === selIdx) {
      const wx1 = (Math.cos(a1) * R_IN).toFixed(2),  wy1 = (Math.sin(a1) * R_IN).toFixed(2);
      const wx2 = (Math.cos(a1) * R_OUT).toFixed(2), wy2 = (Math.sin(a1) * R_OUT).toFixed(2);
      const wx3 = (Math.cos(a2) * R_OUT).toFixed(2), wy3 = (Math.sin(a2) * R_OUT).toFixed(2);
      const wx4 = (Math.cos(a2) * R_IN).toFixed(2),  wy4 = (Math.sin(a2) * R_IN).toFixed(2);
      const ax1 = (Math.cos(a1) * R_ARC).toFixed(2), ay1 = (Math.sin(a1) * R_ARC).toFixed(2);
      const ax2 = (Math.cos(a2) * R_ARC).toFixed(2), ay2 = (Math.sin(a2) * R_ARC).toFixed(2);
      activeWedgeSvg = `
        <path d="M ${wx1} ${wy1} L ${wx2} ${wy2} A ${R_OUT} ${R_OUT} 0 0 1 ${wx3} ${wy3} L ${wx4} ${wy4} A ${R_IN} ${R_IN} 0 0 0 ${wx1} ${wy1} Z" fill="rgba(255,255,255,0.10)"/>
        <path d="M ${ax1} ${ay1} A ${R_ARC} ${R_ARC} 0 0 1 ${ax2} ${ay2}" fill="none" stroke="#c8241b" stroke-width="5.5" stroke-linecap="round"/>
      `;
    }
  }

  // 10 секторов по кругу (36 градусов шаг, радиус иконок 35.5% внутри тёмного кольца)
  const slotsHtml = [];
  for (let i = 0; i < MAX_POCKET_SLOTS; i++) {
    const it = items[i] || null;
    const ang = (-90 + i * (360 / MAX_POCKET_SLOTS)) * Math.PI / 180;
    const rx = 50 + Math.cos(ang) * 35.5;
    const ry = 50 + Math.sin(ang) * 35.5;
    if (!it) {
      slotsHtml.push(`
        <div class="rdr-slot empty" style="left:${rx.toFixed(2)}%;top:${ry.toFixed(2)}%" data-rdr-empty="${i}">
          <span class="rs-dot"></span>
        </div>`);
    } else {
      const isSel = selectedInvKey === it.key;
      slotsHtml.push(`
        <div class="rdr-slot filled ${isSel ? 'sel' : ''}" style="left:${rx.toFixed(2)}%;top:${ry.toFixed(2)}%" data-rdr-slot="${esc(it.key)}" data-rdr-idx="${i}">
          <span class="rs-dot"></span>
          <div class="rs-ic">${it.icon}</div>
          ${it.count ? `<span class="rs-cnt">${esc(it.count)}</span>` : ''}
        </div>`);
    }
  }

  let denomHtml = '';
  if (selItem && selItem.isRub) {
    const denoms = [5, 10, 25, 50, 100, 200, 500, 1000, 5000].filter(d => d <= selItem.total);
    if (!denoms.includes(selItem.total)) denoms.push(selItem.total);
    if (!denoms.includes(rdrCashDenom)) rdrCashDenom = denoms[Math.min(2, denoms.length - 1)] || selItem.total;
    denomHtml = `<div class="rdr-denom-row">` + denoms.slice(-5).map(d =>
      `<button class="rdr-denom-btn ${rdrCashDenom === d ? 'active' : ''}" data-rdr-rub="${d}">${d === selItem.total ? 'Все ' + fmt(d) + '₽' : fmt(d) + '₽'}</button>`
    ).join('') + `</div>`;
  } else if (selItem && selItem.isUsd) {
    const denoms = [1, 5, 10, 20, 50, 100].filter(d => d <= selItem.total);
    if (!denoms.includes(selItem.total)) denoms.push(selItem.total);
    if (!denoms.includes(rdrUsdDenom)) rdrUsdDenom = denoms[Math.min(1, denoms.length - 1)] || selItem.total;
    denomHtml = `<div class="rdr-denom-row">` + denoms.slice(-5).map(d =>
      `<button class="rdr-denom-btn ${rdrUsdDenom === d ? 'active' : ''}" data-rdr-usd="${d}">${d === selItem.total ? 'Все $' + fmt(d) : '$' + d}</button>`
    ).join('') + `</div>`;
  }

  const centerHtml = selItem ? `
    <div class="rdr-hub-title">${esc(selItem.short || selItem.name)}</div>
    <div class="rdr-red-line"></div>
    <div class="rdr-hub-desc">${esc(selItem.desc)}</div>
    ${denomHtml}
    <div class="rdr-hub-pull-hint">Потяните в сторону — взять в руки</div>
  ` : `
    <div class="rdr-hub-title">КАРМАНЫ ПУСТЫ</div>
    <div class="rdr-red-line"></div>
    <div class="rdr-hub-desc">Возьмите небольшой предмет в руки и нажмите «Положить в карман».</div>
  `;

  return `
    <div class="rdr-top-banner">
      <span class="rtb-dim">СНАРЯЖЕНИЕ</span>
      <span class="rtb-box">🎒</span>
      <span class="rtb-act">КАРМАНЫ (${items.length}/${MAX_POCKET_SLOTS})</span>
    </div>
    <div class="rdr-wheel-box" id="rdrWheelBox">
      <svg class="rdr-wheel-svg" viewBox="-150 -150 300 300">
        <!-- Матовое чёрное кольцо колеса с потёртым светло-серым внешним ободом как в RDR2 (6390.webp) -->
        <circle cx="0" cy="0" r="142.5" fill="rgba(10, 10, 10, 0.94)" stroke="rgba(198, 194, 180, 0.74)" stroke-width="4.5"/>
        <circle cx="0" cy="0" r="137.5" fill="none" stroke="rgba(255, 255, 255, 0.05)" stroke-width="1"/>
        ${activeWedgeSvg}
        ${divLines.join('')}
        <!-- Центральный чёрный круг с тонкой серой окантовкой -->
        <circle cx="0" cy="0" r="${R_IN}" fill="#070707" stroke="rgba(176, 172, 162, 0.58)" stroke-width="2.2"/>
      </svg>
      ${slotsHtml.join('')}
      <div class="rdr-center-hub">
        ${centerHtml}
      </div>
    </div>
  `;
}

// Расчёт состояния частей тела (0..100%) и подсветки: Зелёный (>=70%), Жёлтый (35..69%), Красный (<35%)
function getBodyPartsCondition() {
  ensureState();
  const hpRatio = clamp((S.hp ?? 100) / (S.maxHp || 100), 0, 1);
  S.bodyParts = S.bodyParts || { head: 100, torso: 100, armL: 100, armR: 100, legL: 100, legR: 100 };
  const kw = (W && W.P && W.P.knuckleWear) ? clamp(W.P.knuckleWear, 0, 1) : 0;
  // Синхронизируем с общим здоровьем и сбитыми костяшками кулаков
  const headVal  = Math.round(clamp(Math.min(S.bodyParts.head ?? 100,  hpRatio * 105), 0, 100));
  const torsoVal = Math.round(clamp(Math.min(S.bodyParts.torso ?? 100, hpRatio * 100), 0, 100));
  const armLVal  = Math.round(clamp(Math.min(S.bodyParts.armL ?? 100,  hpRatio * 102 - kw * 22), 0, 100));
  const armRVal  = Math.round(clamp(Math.min(S.bodyParts.armR ?? 100,  hpRatio * 102 - kw * 48), 0, 100));
  const legLVal  = Math.round(clamp(Math.min(S.bodyParts.legL ?? 100,  hpRatio * 104), 0, 100));
  const legRVal  = Math.round(clamp(Math.min(S.bodyParts.legR ?? 100,  hpRatio * 104), 0, 100));
  return { head: headVal, torso: torsoVal, armL: armLVal, armR: armRVal, legL: legLVal, legR: legRVal };
}

function bodyPartColor(v) {
  if (v >= 70) return { hex: '#3ec962', fill: 'rgba(62, 201, 98, 0.58)', status: 'В норме' };
  if (v >= 35) return { hex: '#f2c038', fill: 'rgba(242, 192, 56, 0.65)', status: 'Повреждена средне' };
  return { hex: '#e84238', fill: 'rgba(232, 66, 56, 0.72)', status: 'Сильно повреждена' };
}

// Числовые показатели персонажа (0..100)
function getNumericStats() {
  ensureState();
  const sk = S.sk || { sense: 0, charm: 0, trade: 0 };
  const xp = S.skXp || { sense: 0, charm: 0, trade: 0 };
  const strength  = clamp(Math.round(20 + (sk.sense || 0) * 25 + ((xp.sense || 0) * 0.25)), 0, 100);
  const intellect = clamp(Math.round(20 + (sk.charm || 0) * 25 + ((xp.charm || 0) * 0.25)), 0, 100);
  const trade     = clamp(Math.round(20 + (sk.trade || 0) * 25 + ((xp.trade || 0) * 0.25)), 0, 100);
  const shots     = S.shotsFired || 0;
  const accuracy  = clamp(Math.round(25 + (sk.charm || 0) * 15 + (sk.sense || 0) * 10 + Math.min(40, shots * 4)), 0, 100);

  // Уважение в цифрах (переводим шкалу -100..+100 в наглядные 0..100, где 50 — нейтрально)
  const repStreet = clamp(Math.round(50 + (S.rep.street || 0) * 0.5), 0, 100);
  const repLaw    = clamp(Math.round(50 + (S.rep.law || 0) * 0.5), 0, 100);
  const repFolk   = clamp(Math.round(50 + (S.rep.folk || 0) * 0.5), 0, 100);
  const repTotal  = Math.round((repStreet + repLaw + repFolk) / 3);

  return { strength, accuracy, intellect, trade, repTotal, repStreet, repLaw, repFolk };
}

function getHeroStatusBadges() {
  if (!S) return [];
  const badges = [];
  const hg = S.hunger ?? 100;
  if (hg >= 70) badges.push({ text: '🍖 Сыт', bg: '#1e4628', fg: '#98f2ac' });
  else if (hg >= 38) badges.push({ text: '🍞 Проголодался', bg: '#4e3c14', fg: '#ffd878' });
  else if (hg >= 15) badges.push({ text: '⚠️ Голоден', bg: '#5c2614', fg: '#ff9e78' });
  else badges.push({ text: '💀 Умирает от голода', bg: '#6e1111', fg: '#ff6868' });

  const hp = S.hp ?? 100, mx = S.maxHp || 100;
  if (hp >= mx * 0.85) badges.push({ text: '❤️ Здоров', bg: '#1c3e32', fg: '#88e8b8' });
  else if (hp >= mx * 0.45) badges.push({ text: '🩹 Побит (края экрана в крови)', bg: '#542218', fg: '#ff9882' });
  else badges.push({ text: '🩸 Тяжело ранен (макс. выносливость снижена)', bg: '#6e0e14', fg: '#ff5c5c' });

  if (S.sleepDeprived || (S.flags && S.flags.sleepDeprived)) {
    badges.push({ text: '👁 Недосып (галлюцинации в зеркале)', bg: '#4a154b', fg: '#ff85f2' });
  }
  if (W && W.life && W.life.fx && W.life.fx.drunk > .2) {
    badges.push({ text: '🍺 Опьянение', bg: '#4e3814', fg: '#ffcf70' });
  }
  if (W && W.P && W.P.bleed > 0) {
    badges.push({ text: '🩸 Кровотечение', bg: '#6e0e14', fg: '#ff5c5c' });
  }
  if (S.flags && S.flags.anabolBuff && S.flags.anabolBuff >= S.day) {
    badges.push({ text: '💪 Сила «Метана» (+урон)', bg: '#1e4628', fg: '#98f2ac' });
  }
  if (S.flags && S.flags.energeticBuff && S.flags.energeticBuff >= S.day) {
    badges.push({ text: '⚡ Бодрость (+выносливость)', bg: '#1a4248', fg: '#7ef4ff' });
  }
  if (S.flags && S.flags.nightmareStressDay === S.day) {
    badges.push({ text: '👁 Стресс после «Кошмара наяву» (−22% сил)', bg: '#3e1e54', fg: '#d89eff' });
  }
  if (S.flags && S.flags.nightmareInsight) {
    badges.push({ text: '🧠 Вещий инсайт (козырь в диалогах)', bg: '#1a3a5c', fg: '#82d4ff' });
  }

  // Дурная слава и статусы фракций (Криминал / Закон / Народ)
  const rS = S.rep.street || 0, rL = S.rep.law || 0, rF = S.rep.folk || 0;
  if (rL <= -25 || (S.flags && S.flags.kills > 0)) badges.push({ text: '🚨 В розыске МВД', bg: '#6e1218', fg: '#ff7070' });
  if (S.flags && S.flags.ratOutlaw) badges.push({ text: '🐀 «Крыса» (Вне закона у блатных)', bg: '#5a1838', fg: '#ff88c2' });
  else if (S.flags && S.flags.bugorRoof) badges.push({ text: '⛓ Под крышей ОПГ «Чайники» (Бугор)', bg: '#283848', fg: '#9ec8f8' });
  else if (rS >= 40) badges.push({ text: '👑 Авторитет улицы', bg: '#3c2a12', fg: '#f8cc68' });
  else if (rS <= -20 && rL >= 20) badges.push({ text: '🕵️ Стукач-осведомитель', bg: '#24384c', fg: '#88c4f8' });

  if (S.flags && S.flags.kills >= 2) badges.push({ text: '🔪 Отморозок', bg: '#5c1010', fg: '#ff6262' });
  if (rL >= 30 && S.permit) badges.push({ text: '🚓 Коррупционер со связями в РОВД', bg: '#1c3652', fg: '#98d2ff' });
  else if (rL >= 10 && (!S.flags || !S.flags.kills)) badges.push({ text: '🕶 Неуловимый делец без улик', bg: '#22323c', fg: '#b8d4e4' });

  if (rF >= 30) badges.push({ text: '⭐ Герой народа', bg: '#1e4828', fg: '#9ef4b0' });
  else if (rF <= -20 || S.markup > 0.75) badges.push({ text: '💰 Барыга-спекулянт', bg: '#4c3212', fg: '#f4b860' });

  return badges;
}

function getInfluenceLadderInfo() {
  const cap = capitalUsd();
  const rS = S.rep.street || 0, rL = S.rep.law || 0;
  if (cap >= 1800 && (S.up.pavilion || S.flags.neighborStallsOwned) && (rS >= 30 || rL >= 30 || S.flags.bugorRoof)) {
    return {
      stage: 3,
      title: 'Этап 3 · Теневой хозяин района',
      desc: 'Вы управляете денежными потоками через прикормленных майоров и бригадиров, контролируете чёрный рынок и сталкиваете лбами конкурентов. Перманентный кризис: залётные гастролёры и дефициты не дают расслабиться.'
    };
  }
  if (cap >= 450 || S.flags.seregaGuard >= S.day || S.flags.bugorRoof || S.flags.neighborStallsOwned) {
    return {
      stage: 2,
      title: 'Этап 2 · Крышевание и партнёрство',
      desc: 'Собственная охрана и подмятые соседние палатки. Вы сами выбираете, кому платить долю, а кого негласно слить оперативникам РОВД.'
    };
  }
  return {
    stage: 1,
    title: 'Этап 1 · Выживание уличного торговца',
    desc: 'Мелкий коммерсант 1992 года: откупаетесь пачкой «Примы» от пьяного патрульного, отбиваетесь от дворовой шпаны и ищете левые схемы в цехах заводов, чтобы закрыть огромный долг «Заводским» ($2 500).'
  };
}

let alarmModalOpen = false;
function openAlarmModal() {
  if (!S) return;
  const existing = document.getElementById('slavaClockModal');
  if (existing) existing.remove();
  alarmModalOpen = true;
  renderControls();

  let selHour = clamp(Math.floor(S.alarmHour ?? 7), 0, 23);
  let selMin = clamp(Math.round((S.alarmMinute ?? Math.round(((S.alarmHour ?? 7) % 1) * 60))), 0, 59);
  let dragStep = 'hour';
  let rotY = 0, rotX = 0;

  const modal = document.createElement('div');
  modal.id = 'slavaClockModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(6,10,14,0.26);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;touch-action:none;user-select:none;';
  modal.innerHTML = `
    <canvas id="vityaz3dCanvas" width="384" height="384" style="width:min(350px,84vw);height:min(350px,84vw);cursor:grab;touch-action:none;display:block;background:transparent;border:none;outline:none;box-shadow:none;"></canvas>
    <div style="display:flex;gap:10px;align-items:center;justify-content:center;">
      <button id="alPutAwayBtn" style="background:rgba(24,30,34,0.88);color:#f2ead8;border:none;outline:none;border-radius:8px;padding:11px 22px;font-weight:800;font-size:14px;cursor:pointer;">Убрать будильник</button>
      <button id="alTurnOffBtn" style="background:rgba(92,26,26,0.88);color:#f2ead8;border:none;outline:none;border-radius:8px;padding:11px 20px;font-weight:800;font-size:14px;cursor:pointer;">Выключить будильник</button>
    </div>
  `;
  document.body.appendChild(modal);

  const al3dCvs = modal.querySelector('#vityaz3dCanvas');

  const syncDialUI = (playTick = false) => {
    selHour = ((Math.round(selHour) % 24) + 24) % 24;
    selMin = ((Math.round(selMin) % 60) + 60) % 60;
    const decimalHour = selHour + selMin / 60;
    if (W && typeof W.updateAlarmClock3D === 'function') {
      W.updateAlarmClock3D(decimalHour, true, selMin);
    }
    if (W && typeof W.bindAlarmClock3DPreview === 'function' && al3dCvs) {
      W.bindAlarmClock3DPreview(al3dCvs, selHour, selMin, dragStep, rotY, rotX);
    }
    if (playTick && audio && audio.click) {
      audio.click(1140 + (selHour % 12) * 35 + selMin * 4, .05, 0, .06);
    }
  };
  syncDialUI(false);

  let dragging = false, dragMode = 'hand', lastX = 0, lastY = 0;
  const getXY = (ev) => ({
    x: (ev.touches && ev.touches[0]) ? ev.touches[0].clientX : ev.clientX,
    y: (ev.touches && ev.touches[0]) ? ev.touches[0].clientY : ev.clientY
  });

  const pickHandFromEvent = (ev) => {
    const rect = al3dCvs.getBoundingClientRect();
    const { x: clientX, y: clientY } = getXY(ev);
    const sx = ((clientX - rect.left) / Math.max(1, rect.width)) * 240;
    const sy = ((clientY - rect.top) / Math.max(1, rect.height)) * 240;
    const dx = sx - 120, dy = sy - 120;
    if (Math.hypot(dx, dy) < 8) return;
    let ang = Math.atan2(dx, -dy);
    if (ang < 0) ang += Math.PI * 2;

    if (dragStep === 'hour') {
      let h12 = Math.round((ang / (Math.PI * 2)) * 12) % 12;
      if (h12 !== (selHour % 12)) {
        selHour = h12;
        syncDialUI(true);
      }
    } else {
      let candM = Math.round((ang / (Math.PI * 2)) * 60) % 60;
      if (candM !== selMin) {
        selMin = candM;
        syncDialUI(true);
      }
    }
  };

  const onDown = (e) => {
    if (e.target && (e.target.id === 'alPutAwayBtn' || e.target.id === 'alTurnOffBtn')) return;
    e.stopPropagation();
    try { if (e.pointerId != null && al3dCvs.setPointerCapture) al3dCvs.setPointerCapture(e.pointerId); } catch (err) {}
    const rect = al3dCvs.getBoundingClientRect();
    const { x: clientX, y: clientY } = getXY(e);
    lastX = clientX; lastY = clientY;
    const sx = ((clientX - rect.left) / Math.max(1, rect.width)) * 240;
    const sy = ((clientY - rect.top) / Math.max(1, rect.height)) * 240;
    const rNorm = Math.hypot(sx - 120, sy - 120) / 120;
    const facingFront = Math.cos(rotY) > 0.30 && Math.abs(rotX) < 0.85;
    dragging = true;
    if (e.target === al3dCvs && rNorm <= 0.80 && facingFront) {
      dragMode = 'hand';
      pickHandFromEvent(e);
    } else {
      dragMode = 'orbit';
    }
    e.preventDefault();
  };
  const onMove = (e) => {
    if (!dragging) return;
    if (dragMode === 'hand') {
      pickHandFromEvent(e);
    } else {
      const { x: clientX, y: clientY } = getXY(e);
      const dx = clientX - lastX, dy = clientY - lastY;
      lastX = clientX; lastY = clientY;
      rotY += dx * 0.014;
      rotX = clamp(rotX + dy * 0.011, -1.15, 1.15);
      syncDialUI(false);
    }
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    if (dragMode === 'hand') {
      dragStep = (dragStep === 'hour') ? 'minute' : 'hour';
      syncDialUI(false);
    }
  };

  modal.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);

  const closeModal = () => {
    alarmModalOpen = false;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (W && typeof W.bindAlarmClock3DPreview === 'function') W.bindAlarmClock3DPreview(null);
    if (modal && modal.parentNode) modal.remove();
    renderControls();
  };

  modal.querySelector('#alTurnOffBtn').onclick = () => {
    S.alarmOn = false;
    if (W && typeof W.updateAlarmClock3D === 'function') W.updateAlarmClock3D(selHour + selMin / 60, false, selMin);
    if (audio && audio.click) audio.click(480, .08, 0, .06);
    closeModal();
    save();
    render();
  };

  modal.querySelector('#alPutAwayBtn').onclick = () => {
    S.alarmHour = selHour;
    S.alarmMinute = selMin;
    S.alarmOn = true;
    const decH = selHour + selMin / 60;
    if (W && typeof W.updateAlarmClock3D === 'function') W.updateAlarmClock3D(decH, true, selMin);
    if (audio && audio.click) {
      audio.click(980, .08, 0, .07);
    }
    closeModal();
    save();
    render();
  };
}

function heroHtml() {
  const bp = getBodyPartsCondition();
  const st = getNumericStats();
  const badges = getHeroStatusBadges();
  const ladder = getInfluenceLadderInfo();

  const goal = S.debt > 0
    ? `Счётчик «Заводских»: долг $${fmt(S.debt)} (${fmt(usdToRub(S.debt))} ₽). Выживайте, работайте с цехами заводов и развивайте торговлю!`
    : `Долг «Заводским» закрыт! Удерживайте баланс сил между Улицей и Законом.`;

  const cHead  = bodyPartColor(bp.head);
  const cTorso = bodyPartColor(bp.torso);
  const cArmL  = bodyPartColor(bp.armL);
  const cArmR  = bodyPartColor(bp.armR);
  const cLegL  = bodyPartColor(bp.legL);
  const cLegR  = bodyPartColor(bp.legR);

  const bpLine = (label, val) => {
    const c = bodyPartColor(val);
    return `<div class="bp-row">
      <div><span class="bp-dot" style="background:${c.hex};box-shadow:0 0 6px ${c.hex}"></span><b>${label}</b> <span class="muted">(${c.status})</span></div>
      <b style="color:${c.hex};font-family:'Courier New',monospace">${val} / 100</b>
    </div>`;
  };

  const numStatRow = (icon, title, val, maxVal, desc, col = 'var(--acc)') => {
    const pct = clamp(Math.round((val / maxVal) * 100), 0, 100);
    return `<div class="hi-sub-row">
      <div style="flex:1;padding-right:10px">
        <b>${icon} ${title}</b>
        <div class="muted">${desc}</div>
      </div>
      <div style="text-align:right;min-width:96px">
        <div style="font-size:14px;font-weight:900;color:${col};font-family:'Courier New',monospace;margin-bottom:3px">${val} / ${maxVal}</div>
        <div style="width:90px;height:6px;background:#ffffff1a;border-radius:3px;overflow:hidden;margin-left:auto">
          <i style="display:block;height:100%;width:${pct}%;background:${col}"></i>
        </div>
      </div>
    </div>`;
  };

  return `
    ${financeHtml()}
    <!-- Верхний блок: слева силуэт персонажа с цветовой индикацией повреждений, справа Задачи и Капитал -->
    <div class="hi-top">
      <div class="hi-left" style="flex:0 0 auto">
        <div class="hi-doll-box" id="heroDollBox" style="width:142px;height:218px">
          <svg class="hi-doll-svg" viewBox="0 0 120 200" style="width:120px;height:202px">
            <!-- Голова -->
            <circle cx="60" cy="24" r="15" fill="${cHead.fill}" stroke="${cHead.hex}" stroke-width="2.5"/>
            <!-- Торс / Грудь -->
            <path d="M40 44 L80 44 L77 104 L43 104 Z" fill="${cTorso.fill}" stroke="${cTorso.hex}" stroke-width="2.5" rx="4"/>
            <!-- Левая рука (на схеме слева) -->
            <path d="M24 46 L38 44 L35 102 L21 100 Z" fill="${cArmL.fill}" stroke="${cArmL.hex}" stroke-width="2.5"/>
            <!-- Правая рука / кулак (на схеме справа) -->
            <path d="M82 44 L96 46 L99 100 L85 102 Z" fill="${cArmR.fill}" stroke="${cArmR.hex}" stroke-width="2.5"/>
            <!-- Левая нога -->
            <path d="M43 107 L58 107 L56 184 L41 184 Z" fill="${cLegL.fill}" stroke="${cLegL.hex}" stroke-width="2.5"/>
            <!-- Правая нога -->
            <path d="M62 107 L77 107 L79 184 L64 184 Z" fill="${cLegR.fill}" stroke="${cLegR.hex}" stroke-width="2.5"/>
          </svg>
        </div>
      </div>

      <div class="hi-goal-box" style="flex:1">
        <div class="hi-goal-title">задачи и капитал</div>
        <div style="font-size:13px;font-weight:800;line-height:1.35;margin-bottom:8px;color:#f5efe2">🎯 ${goal}</div>
        <div class="card" style="padding:8px 10px;margin-bottom:6px">
          <div class="bp-row"><span>Наличные рубли:</span><b style="color:var(--acc);font-family:'Courier New',monospace">${fmt(Math.floor(S.money || 0))} ₽</b></div>
          <div class="bp-row"><span>Валюта США:</span><b style="color:#8fc27a;font-family:'Courier New',monospace">$${fmt(Math.floor(S.usd || 0))}</b></div>
          <div class="bp-row"><span>Уровень и опыт:</span><b style="font-family:'Courier New',monospace">Ур. ${S.lvl + 1} (${S.xp}/${xpNeed(S.lvl)})</b></div>
        </div>
      </div>
    </div>

    <!-- Статусы героя и Дурная слава -->
    <div class="hi-sec-title">статусы героя и дурная слава</div>
    <div class="card" style="margin-top:2px;padding:10px">
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
        ${badges.map(b => `<span style="background:${b.bg};color:${b.fg};border:1px solid ${b.fg}44;padding:4px 9px;border-radius:5px;font-size:12px;font-weight:800">${b.text}</span>`).join('')}
      </div>
      <div class="bp-row"><span>Макс. выносливость (с учётом HP и стресса):</span><b style="color:var(--acc);font-family:'Courier New',monospace">${S.effMaxStam || 100} / 100</b></div>
      <div class="bp-row"><span>Будильник «Витязь» (на тумбочке у кровати):</span><b style="color:#8fc27a;font-family:'Courier New',monospace">${S.alarmOn !== false ? '🔔 ' + String(S.alarmHour ?? 7).padStart(2, '0') + ':' + String(S.alarmMinute ?? 0).padStart(2, '0') : '🔕 Выкл'}</b></div>
      <div style="margin-top:4px;font-size:11px;color:var(--mut)">Подойдите к будильнику на тумбочке в спальне и наведитесь на него, чтобы завести стрелку на циферблате.</div>
    </div>



    <!-- Характеристики персонажа в цифрах (Физическая сила, Меткость, Интеллект, Торговля) -->
    <div class="hi-sec-title">характеристики персонажа</div>
    <div class="card" style="margin-top:2px">
      ${numStatRow('💪', 'Физическая сила', st.strength, 100, 'Урон кулаком в драке, выносливость, тренировка с гирей 24 кг', '#e8a838')}
      ${numStatRow('🎯', 'Меткость', st.accuracy, 100, 'Кучность и точность стрельбы из огнестрельного оружия', '#68b8e8')}
      ${numStatRow('🧠', 'Интеллект', st.intellect, 100, 'Убеждение в разговорах, чтение прессы, запись кассет', '#a888e8')}
      ${numStatRow('⚖️', 'Торговля', st.trade, 100, 'Скидка на оптовых базах и приток покупателей к ларьку', '#78c878')}
    </div>

    <!-- Уважение в цифрах (Общее уважение + Улица, Милиция, Народ) -->
    <div class="hi-sec-title">уважение</div>
    <div class="card" style="margin-top:2px">
      ${numStatRow('⭐', 'Общее уважение в городе', st.repTotal, 100, 'Сводный авторитет главного героя в Краснозаводске', '#f4d068')}
      ${numStatRow('🕶', 'Уважение: Улица и пацаны', st.repStreet, 100, st.repStreet >= 65 ? 'Свой человек на районе, ночью не трогают' : st.repStreet <= 35 ? 'На вас зуб у шпаны' : 'Нейтральное отношение (50 — норма)', st.repStreet >= 50 ? '#8fc27a' : '#e8735a')}
      ${numStatRow('🚓', 'Уважение: Милиция и закон', st.repLaw, 100, st.repLaw >= 65 ? 'Участковый закрывает глаза на мелочи' : st.repLaw <= 35 ? 'Милиция ищет повод закрыть' : 'Нейтральное отношение (50 — норма)', st.repLaw >= 50 ? '#8fc27a' : '#e8735a')}
      ${numStatRow('👥', 'Уважение: Народ и покупатели', st.repFolk, 100, st.repFolk >= 65 ? 'Жители охотно идут к вашему ларьку' : st.repFolk <= 35 ? 'Покупатели обходят ларёк стороной' : 'Нейтральное отношение (50 — норма)', st.repFolk >= 50 ? '#8fc27a' : '#e8735a')}
    </div>
  `;
}

function invHtml() {
  return heroHtml();
}

let setSubTab = 'gfx';
function setHtml() {
  const st = SET, q = resolveQualityPreset(st.quality), cq = Object.assign({}, QUALITY[q], st.custom || {});
  const sel = (k, opts, cur) => `<select data-set="${k}">${opts.map(([v, l]) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const rng = (k, min, max, step, val, fmtv) => `<input type="range" data-set="${k}" min="${min}" max="${max}" step="${step}" value="${val}"><span class="muted">${fmtv(val)}</span>`;
  const gpuInf = (W && W.gpu) ? W.gpu() : null;
  const subTabs = [
    ['gfx', '🎨 Графика'],
    ['play', '🎮 Геймплей'],
    ['snd', '🔊 Звук'],
    ['ctl', '🕹 Управление']
  ];
  const nav = `<div class="seg" style="margin-bottom:10px">${subTabs.map(([k, l]) => `<button data-settab="${k}" class="${setSubTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  let body = '';
  if (setSubTab === 'gfx') {
    const presetBtns = Object.entries(QUALITY).map(([k, v]) => `<button data-quality="${k}" class="${q === k && !st.custom ? 'on' : ''}">${v.label}</button>`).join('')
      + `<button data-quality="custom" class="${st.custom ? 'on' : ''}" disabled>Custom</button>`;
    body = `<h3>Пресеты графики и авто-профиль</h3>
    <div class="seg" style="flex-wrap:wrap">${presetBtns}</div>
    <div class="row" style="margin:6px 0 8px;gap:8px">
      <button class="btn small blue" data-quality="auto">⚡ Авто-профиль устройства${gpuInf && gpuInf.autoPreset ? ' (' + QUALITY[gpuInf.autoPreset].label + ')' : ''}</button>
    </div>
    <div class="card setgrid">
      <label>Контекст WebGL ${sel('gfxApi', [['auto', 'Авто (WebGL 2.0)'], ['gles3', 'WebGL 2.0 (OpenGL ES 3.0)'], ['gles2', 'WebGL 1.0 (OpenGL ES 2.0)']], (st.gfxApi === 'gles2' || st.gfxApi === 'gles3') ? st.gfxApi : 'auto')}</label>
      <div class="muted" style="font-size:11.5px;line-height:1.35">${gpuInf ? 'GPU: ' + esc(gpuInf.name || '?') + '<br>Рендер: ' + esc(gpuInf.backend || 'WebGL') : 'Определение GPU...'}</div>
      <label>Разрешение рендера ${sel('dpr', [[0.65, '65%'], [0.72, '72%'], [0.85, '85%'], [1, '100%'], [1.25, '125%'], [1.5, '150%'], [2, '200%']], cq.dpr)}</label>
      <label>Dynamic Resolution Scaling ${sel('drs', [[1, 'включён (0.65–1.0×)'], [0, 'выключен']], (cq.drs ?? 1) ? 1 : 0)}</label>
      <label>Качество теней ${sel('shadows', [[0, 'Выключены'], [512, 'Низкие (512 PCF)'], [1024, 'Средние (1024 PCF)'], [1536, 'Высокие (1536 Soft)']], cq.shadows)}</label>
      <label>Дальность прорисовки ${rng('draw', 55, 220, 5, cq.draw, v => v + ' м')}</label>
      <label>Качество освещения ${sel('light', [[0, 'Базовое'], [1, 'Среднее'], [2, 'Полное']], cq.light)}</label>
      <label>Активных источников света ${sel('maxLights', [[1, '1 (минимум)'], [2, '2 (оптимально)'], [3, '3 (баланс)'], [4, '4 (максимум)']], cq.maxLights || 3)}</label>
      <label>Фильтрация текстур ${sel('texFilter', [['bilinear', 'Билинейная (mip)'], ['trilinear', 'Трилинейная (mip)']], cq.texFilter || 'trilinear')}</label>
      <label>Анизотропная фильтрация ${sel('aniso', [[1, '1× (выкл)'], [2, '2×'], [4, '4×'], [8, '8×'], [16, '16×']], cq.aniso || 4)}</label>
      <label>Качество отражений ${sel('reflections', [[0, 'Выключены'], [1, 'Низкие (зеркало)'], [2, 'Высокие (зеркало + лужи)']], cq.reflections ?? 1)}</label>
      <label>Дальность прорисовки NPC ${rng('npcDraw', 30, 120, 5, cq.npcDraw || 75, v => v + ' м')}</label>
      <label>Количество NPC ${rng('npc', 4, 24, 1, cq.npc, v => v)}</label>
      <label>Количество транспорта ${rng('cars', 1, 6, 1, cq.cars || 3, v => v)}</label>
      <label>Снег и погодные эффекты ${rng('snow', 0, 2500, 50, cq.snow, v => v)}</label>
      <label>Постобработка ${sel('postfx', [[1, 'Включена'], [0, 'Выключена (быстрый проход)']], (cq.postfx ?? 1) ? 1 : 0)}</label>
      <label>Вертикальная синхронизация ${sel('vsync', [[1, 'Вкл (управляется WebView)']], 1)}</label>
      <label>Ограничитель FPS ${sel('fpsCap', [[30, '30 FPS'], [45, '45 FPS'], [60, '60 FPS'], [90, '90 FPS'], [120, '120 FPS']], st.fpsCap || 60)}</label>
      <label>Диагностика производительности ${sel('showDiag', [[0, 'Выключена'], [1, 'Полный оверлей']], st.showDiag ? 1 : 0)}</label>
      <label>Кинематографичный ретро-фильтр ${sel('retro', [[0, 'выключен'], [1, 'включён']], st.retro ? 1 : 0)}</label>
      <label>Летающие газеты и мусор ${sel('litter', [[1, 'включены'], [0, 'выключены']], st.litter === 0 ? 0 : 1)}</label>
      <label>Облегчённый режим (слабые GPU) ${sel('lite', [[2, 'авто'], [1, 'включён'], [0, 'выключен']], st.lite ?? 2)}</label>
    </div>`;
  } else if (setSubTab === 'play') {
    body = `<h3>Геймплей и интерфейс</h3>
    <div class="card setgrid">
      <label>Покачивание камеры при ходьбе ${rng('bob', 0, 2, .1, st.bob, v => Math.round(v * 100) + '%')}</label>
      <label>Счётчик ФПС (FPS) ${sel('showFps', [[1, 'включён'], [0, 'выключен']], (st.showFps ?? 1) ? 1 : 0)}</label>
      <label>Уведомления на экране ${sel('toasts', [[2, 'все'], [1, 'только важные'], [0, 'выключены']], st.toasts ?? 2)}</label>
      <label>Сдача руками (мини-игра) ${sel('changeGame', [[1, 'включена'], [0, 'выключена']], st.changeGame === false ? 0 : 1)}</label>
      <div class="muted" style="font-size:12px">«Только важные» — без реплик прохожих и подсказок: остаются деньги, угрозы, итоги.</div>
    </div>`;
  } else if (setSubTab === 'snd') {
    body = `<h3>Звук и радио</h3>
    <div class="card setgrid">
      <label>Общая громкость ${rng('master', 0, 1, .05, st.master, v => Math.round(v * 100) + '%')}</label>
      <label>Радио ${rng('radio', 0, 1, .05, st.radio, v => Math.round(v * 100) + '%')}</label>
      <label>Город и ветер ${rng('ambience', 0, 1, .05, st.ambience, v => Math.round(v * 100) + '%')}</label>
      <div class="row" style="gap:8px"><button class="btn small" data-a="radio">${audio.radioOn ? '📻 Радио: вкл' : '📻 Радио: выкл'}</button><button class="btn small" data-a="mute">${(S ? S.mute : st.mute) ? '🔇 Звук выкл' : '🔊 Звук вкл'}</button></div>
    </div>`;
  } else {
    body = `<h3>Управление и система</h3>
    <div class="card setgrid">
      <label>Чувствительность обзора ${rng('sens', .3, 3, .05, controls ? controls.lookSens : 1, v => (+v).toFixed(2))}</label>
    </div>
    ${S ? `<div class="card"><p class="muted">Двигайте, добавляйте и удаляйте кнопки, меняйте размер, прозрачность, зону нажатия и действие.</p>
      <button class="btn big yellow" data-a="editctl">Редактор управления</button></div>
    <div class="card"><div class="row" style="gap:8px"><input type="text" id="adminCode" placeholder="АДМИН-КОД" maxlength="24" autocomplete="off" style="flex:1;min-width:0;background:#0b1214;border:1px solid var(--line2);color:var(--text);padding:8px;font:inherit">
      <button class="btn small" data-a="admin">Ввести</button></div></div>
    <div class="row" style="gap:8px;margin-top:12px">
      <button class="btn big blue" data-a="exitMenu" style="flex:1">🚪 Выйти в главное меню</button>
      <button class="btn small red" data-a="reset">Начать заново</button>
    </div>` : '<div class="card"><p class="muted">Редактор кнопок и выход доступны во время игры.</p></div>'}`;
  }
  return `<h2>⚙ Настройки</h2>${nav}${body}`;
}
// ============================================================
//  События ввода
// ============================================================

// Жест выбора и взятия предмета в руки в колесе RDR2 (нажатие на предмет / колесо и оттягивание в сторону)
let rdrDragState = null;
let rdrJustDragged = false;

function refreshRdrWheelDom() {
  const rdrEl = $('#rdrWheelOverlay');
  if (rdrEl && rdrInvOpen) rdrEl.innerHTML = rdrWheelHtml();
}

document.addEventListener('pointerdown', e => {
  if (!rdrInvOpen) return;
  if (e.target.closest('[data-rdr-rub], [data-rdr-usd], [data-rdr-close]')) return;
  const wheelBox = $('#rdrWheelBox');
  if (!wheelBox) return;
  const rect = wheelBox.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = e.clientX - cx, dy = e.clientY - cy;
  const distFromCenter = Math.hypot(dx, dy);

  const slotEl = e.target.closest('[data-rdr-slot]');
  // Если нажали далеко за пределами колеса — закрываем инвентарь
  if (!slotEl && distFromCenter > rect.width * 0.56) {
    closeRdrInventory();
    return;
  }

  const items = buildPocketWheelList();
  let hitKey = slotEl ? slotEl.dataset.rdrSlot : null;
  if (!hitKey && distFromCenter > rect.width * 0.16) {
    const deg = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
    const idx = Math.round(deg / (360 / MAX_POCKET_SLOTS)) % MAX_POCKET_SLOTS;
    if (items[idx]) hitKey = items[idx].key;
  }

  const wasAlreadySelected = !!(hitKey && hitKey === selectedInvKey);
  if (hitKey && hitKey !== selectedInvKey) {
    selectedInvKey = hitKey;
    sfx.click && sfx.click();
    refreshRdrWheelDom();
  }

  rdrDragState = {
    pointerId: e.pointerId,
    sx: e.clientX,
    sy: e.clientY,
    cx,
    cy,
    radius: rect.width / 2,
    startKey: hitKey || selectedInvKey,
    wasAlreadySelected,
    pulled: false
  };
}, { passive: true });

document.addEventListener('pointermove', e => {
  if (!rdrInvOpen || !rdrDragState || e.pointerId !== rdrDragState.pointerId) return;
  const dx = e.clientX - rdrDragState.cx;
  const dy = e.clientY - rdrDragState.cy;
  const distFromCenter = Math.hypot(dx, dy);
  const pullDist = Math.hypot(e.clientX - rdrDragState.sx, e.clientY - rdrDragState.sy);

  if (pullDist >= 9) rdrDragState.pulled = true;

  // При ведении пальца по кольцу подсвечиваем сектор, в сторону которого тянем, и показываем информацию в центре
  if (distFromCenter > rdrDragState.radius * 0.28) {
    const deg = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
    const idx = Math.round(deg / (360 / MAX_POCKET_SLOTS)) % MAX_POCKET_SLOTS;
    const items = buildPocketWheelList();
    if (items[idx] && items[idx].key !== selectedInvKey) {
      selectedInvKey = items[idx].key;
      sfx.click && sfx.click();
      refreshRdrWheelDom();
    }
  }

  // Визуальный сдвиг иконки выбранного предмета в сторону оттягивания пальцем
  const activeSlot = document.querySelector('#rdrWheelBox .rdr-slot.sel');
  if (activeSlot && pullDist >= 4) {
    const maxPull = 14;
    const k = Math.min(maxPull, pullDist * 0.35) / Math.max(1, pullDist);
    const ox = (e.clientX - rdrDragState.sx) * k;
    const oy = (e.clientY - rdrDragState.sy) * k;
    activeSlot.style.transform = `translate(${ox.toFixed(1)}px, ${oy.toFixed(1)}px) scale(1.22)`;
  }
}, { passive: true });

const finishRdrDrag = e => {
  if (!rdrDragState || e.pointerId !== rdrDragState.pointerId) return;
  const st = rdrDragState;
  rdrDragState = null;
  if (!rdrInvOpen) return;

  const pullDist = Math.hypot(e.clientX - st.sx, e.clientY - st.sy);
  const activeSlot = document.querySelector('#rdrWheelBox .rdr-slot.sel');
  if (activeSlot) activeSlot.style.transform = '';

  // Если нажали на предмет/кольцо и потянули в сторону (pullDist >= 9px) — сразу берём выбранный предмет в руки!
  if (selectedInvKey && (st.pulled || pullDist >= 9)) {
    rdrJustDragged = true;
    setTimeout(() => { rdrJustDragged = false; }, 180);
    actInvToHand(selectedInvKey);
  }
};
document.addEventListener('pointerup', finishRdrDrag);
document.addEventListener('pointercancel', finishRdrDrag);

document.addEventListener('click', e => {
  au();
  // Обработка номиналов купюр и закрытия колеса инвентаря RDR2
  const rdrRub = e.target.closest('[data-rdr-rub]');
  if (rdrRub) {
    rdrCashDenom = +rdrRub.dataset.rdrRub;
    sfx.click && sfx.click();
    render();
    return;
  }
  const rdrUsd = e.target.closest('[data-rdr-usd]');
  if (rdrUsd) {
    rdrUsdDenom = +rdrUsd.dataset.rdrUsd;
    sfx.click && sfx.click();
    render();
    return;
  }
  if (e.target.closest('[data-rdr-close]') || (rdrInvOpen && e.target.id === 'rdrWheelOverlay' && !rdrJustDragged)) {
    closeRdrInventory();
    return;
  }
  if (e.target.closest('#rdrWheelBox')) {
    return;
  }
  const el = e.target.closest('button, [data-a]'); if (!el || el.disabled) return;
  const d = el.dataset;
  const isSetAction = !!(d.quality || d.settab || ['radio', 'mute', 'editctl', 'admin', 'reset', 'exitMenu'].includes(d.a));
  if (!el.isConnected || (el.closest('#mbox') && !isSetAction)) return;
  if (d.tab) { if (S && S.phase === 'trade' && d.tab === 'exch') return; tab = d.tab; sfx.click(); render(); $('#screen').scrollTop = 0; return; }
  if (!S && !['new', 'continue', 'menuSettings', 'radio', 'mute'].includes(d.a) && !d.quality && !d.settab) return;
  if (d.slot !== undefined) {
    if (S.phase === 'evening') return;
    openSlotPicker(+d.slot); return;
  }
  if (d.opt !== undefined) { chooseOpt(+d.opt); return; }
  if (d.src) { S.src = d.src; sfx.click(); render(); return; }
const stTabBtn = e.target.closest('[data-settab]');
  if (stTabBtn) {
    setSubTab = stTabBtn.dataset.settab;
    sfx.click && sfx.click();
    const mbody = document.querySelector('#mbox #menuSetWrap');
    if (mbody) mbody.innerHTML = setHtml(); else render();
    return;
  }
  if (d.quality) {
    const gpuInf = (W && W.gpu) ? W.gpu() : null;
    const chosen = d.quality === 'auto' ? ((gpuInf && gpuInf.autoPreset) || (isMob ? 'perf' : 'high')) : resolveQualityPreset(d.quality);
    SET.quality = chosen; SET.custom = null; saveSet();
    W && W.applyQuality(Object.assign({}, QUALITY[chosen]), chosen);
    if (el.closest('#mbox')) {
      const mbody = document.querySelector('#mbox #menuSetWrap');
      if (mbody) mbody.innerHTML = setHtml();
    } else {
      render();
    }
    return;
  }
  if (d.invClose) { selectedInvKey = null; sfx.click(); render(); return; }
  if (d.invEquip) { equipClothToSlot(d.invEquip, null); return; }
  if (d.invHand) { actInvToHand(d.invHand); return; }
  if (d.invDrop) { actInvDropWorld(d.invDrop); return; }
  if (d.outfit) { const o = OUTFITS[d.outfit], p = usdToRub(o.usd); if (S.money < p) return; S.money -= p; S.owned.push(d.outfit); S.outfit = d.outfit;
    ensureState();
    if (d.outfit === 'sport') rep('street', 5); sfx.ching(); toast('Обновка! ' + o.name, 'good'); render(); return; }
  if (d.wear) { S.outfit = d.wear; sfx.click(); render(); return; }
  if (d.takecash) {
    const amt = +d.takecash;
    if (S.money < amt) return;
    const isCoin = amt <= 10;
    if (takeToHand(isCoin ? 'coin' : 'cash', amt)) {
      S.money -= amt;
      sheetOpen = false;
      sfx.coin();
      save(); render();
      toast(isCoin ? `Достали из кармана монету ${amt} ₽ (можно положить, кинуть или убрать обратно).` : `Достали из кармана купюру ${fmt(amt)} ₽ (можно положить, кинуть или убрать обратно).`);
    }
    return;
  }
  if (d.takeusd) {
    const amt = +d.takeusd;
    if (S.usd < amt) return;
    if (takeToHand('usd', amt)) {
      S.usd -= amt;
      sheetOpen = false;
      sfx.coin();
      save(); render();
      toast(`Достали из кармана купюру $${amt} (можно положить, кинуть или убрать обратно).`);
    }
    return;
  }
  if (d.a === 'pocketheld') {
    pocketHeld();
    render();
    return;
  }
  if (d.up) { const u = UPGRADES[d.up], p = usdToRub(u.usd); if (S.money < p) return; S.money -= p; S.up[d.up] = true;
    if (d.up === 'pavilion') { S.slots = S.slots.concat([null, null, null]).slice(0, 9); sfx.fanfare(); toast('Павильон открыт! Цель главы выполнена', 'good'); }
    else { sfx.ching(); toast(u.name + ' — готово!', 'good'); }
    render(); return; }
  if (d.usd) { usdOp(d.usd, d.n); return; }
  switch (d.a) {
    case 'menuSettings':
      queueCard({ title: '', wide: true, html: `<div id="menuSetWrap">${setHtml()}</div>`, buttons: [{ label: '✓ Сохранить и закрыть', cls: 'green' }] });
      break;
    case 'new':
      if (audio && audio.stopMenuAnthem) audio.stopMenuAnthem();
      if (load()) queueCard({ title:'Начать заново?', html:'<p>Текущее сохранение пропадёт.</p>', buttons:[{ label:'Да, заново', cls:'red', fn() { setTimeout(startNewFlow, 0); } }, { label:'Отмена' }] }); else startNewFlow();
      break;
    case 'continue':
      if (audio && audio.stopMenuAnthem) audio.stopMenuAnthem();
      S = load(); ensureState(); if (S.phase !== 'night') S.phase = 'morning'; S.gunState = S.gunState || 'wall'; S.gun = S.gunState === 'carried'; S.shells = S.shells ?? 0; S.ammo = S.ammo ?? 2; S.order = S.order || { lines: {}, hidden: {} }; S.deliveries = S.deliveries || []; S.items = S.items || []; S.slotCounts = S.slotCounts || S.slots.map(id => id ? 1 : 0); S.shelfPlacements = S.shelfPlacements || []; S.hidden = S.hidden || {}; S.cigs = S.cigs || 0; S.butts = S.butts || 0; tab = 'kiosk'; if (W) W.reset(); syncAmmoToWeapon(); offlineIncome(); render();
      break;
    case 'shells': { const p = usdToRub(3); if (S.money < p) return; S.money -= p; if (W) W.weapon.reserve += 5; else S.shells += 5; syncAmmoFromWeapon(); sfx.coin(); toast('Пачка патронов: +5', 'good'); render(); break; }
    case 'editctl': sheetOpen = false; render(); controls && controls.setEditing(true); renderControls(); break;
    case 'openAlarm': openAlarmModal(); break;
    case 'sleep': sheetOpen = false; sleep(); break;
    case 'hiddenOffer': offerHidden(); break;
    case 'radio': {
      audio.radioToggle();
      const mbody = document.querySelector('#mbox #menuSetWrap');
      if (mbody) mbody.innerHTML = setHtml(); else render();
      break;
    }
    case 'sheet': sheetOpen ? closeSheet() : openSheet(); break;
    case 'closeSheet': closeSheet(); break;
    case 'vitrine': openSheet('kiosk'); break;
    case 'gocounter': if (W) { sheetOpen = false; W.goCounter(false); render(); } break;
    case 'open': startTrade(); break;
    case 'auto': { const r = autoDay(); S.phase = 'trade'; eveningFlow(r); break; }
    case 'hire': S.seller = true; sfx.ching(); toast('Тётя Люба вышла на смену!', 'good'); render(); break;
    case 'sell': case 'discount': case 'credit': case 'next': act(d.a); break;
    case 'bribeLeave': bribeCurrentCustomerToLeave(); break;
    case 'swapQueue': swapCustomerWithQueue(); break;
    case 'sellBlackMarket': sellBlackMarketToCustomer(); break;
    case 'nightKiosk': sheetOpen = false; openNightKioskShift(); break;
    case 'cassetteDeck': openCassetteDeckModal(); break;
    case 'blackMarketLab': openBlackMarketModal(); break;
    case 'cleanRats': cleanWarehouseRats(); break;
    case 'paydebt': { const k = debtPayable(); if (k < 1) break; const fromUsd = Math.min(S.usd, k), rub = (k - fromUsd) * Math.round(S.rate * 1.04); S.usd -= fromUsd; S.money -= rub; S.debt -= k; sfx.ching(); toast(S.debt ? `Отдали $${k}. Осталось $${S.debt}` : 'Долг закрыт! Колян уважает.', 'good'); if (!S.debt) rep('street', 5); render(); break; }
    case 'pmpIn': { const k = Math.round(S.money / 4); S.money -= k; S.pmp += k; sfx.coin(); toast(`Вложено ${fmt(k)} ₽ в «ПМП»`); render(); break; }
    case 'pmpOut': { S.money += S.pmp; toast(`Забрали ${fmt(S.pmp)} ₽ из «ПМП»`, 'good'); S.pmp = 0; sfx.ching(); render(); break; }
    case 'admin': { const inp = $('#adminCode'), code = ((inp && inp.value) || '').trim().toLowerCase().replace(/\s+/g, ''); if (code === ADMIN_CODE) { sheetOpen = false; render(); openAdmin(); } else { sfx.bad(); toast('Неверный код', 'bad'); } break; }
    case 'map': openMap(); break;
    case 'openGear': if (sheetOpen) closeSheet(); else openSheet('hero'); break;
    case 'mute': {
      const nxtMute = !(S ? S.mute : SET.mute);
      if (S) S.mute = nxtMute;
      SET.mute = nxtMute; saveSet();
      audio.setMuted(nxtMute);
      const mbody = document.querySelector('#mbox #menuSetWrap');
      if (mbody) mbody.innerHTML = setHtml(); else render();
      break;
    }
    case 'exitMenu':
      save();
      if (dialogOpen) closeDialog();
      sheetOpen = false;
      rdrInvOpen = false;
      npOpen = false;
      paperOpen = false;
      cards = [];
      cardOpen = false;
      $('#modal').classList.remove('on');
      S = null;
      T = null;
      if (audio && audio.startMenuAnthem) audio.startMenuAnthem();
      render();
      break;
    case 'reset': queueCard({ title:'Начать заново?', html:'<p>Весь прогресс пропадёт.</p>', buttons:[{ label:'Да', cls:'red', fn() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} S = null; T = null; render(); } }, { label:'Отмена' }] }); break;
  }
});
document.addEventListener('input', e => {
  if (e.target.dataset.range === 'markup') {
    S.markup = +e.target.value / 100;
    const vit = document.querySelector('.vit'); if (vit) vit.outerHTML = vitrineHtml();
    const mk = Math.round(S.markup * 100);
    const mkLabel = mk <= 25 ? 'по-честному' : mk <= 60 ? 'как все' : mk <= 100 ? 'дерзко' : 'грабёж';
    const npMk = document.getElementById('npMkVal');
    if (npMk) npMk.innerHTML = `<b>+${mk}%</b> <span class="np-dim">(${mkLabel})</span>`;
    if (npOpen) renderNotepad();
    if (W) W.updateShelves();
  }
});
document.addEventListener('change', e => { if (e.target.dataset.range) save(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (S && (S.phase === 'morning' || S.phase === 'night')) save(); audio.suspend(); } else audio.resume(); });
document.addEventListener('input', e => {
  const k = e.target.dataset.set; if (!k) return;
  const v = +e.target.value; const sp = e.target.nextElementSibling;
  if (['bob', 'master', 'radio', 'ambience'].includes(k)) { SET[k] = v; if (k !== 'bob') audio.setVolume(k, v); if (sp) sp.textContent = Math.round(v * 100) + '%'; }
  else if (k === 'retro') { SET.retro = v; W && W.setRetro(v); }
  else if (k === 'litter') { SET.litter = v; }
  else if (k === 'toasts') { SET.toasts = v; }
  else if (k === 'changeGame') { SET.changeGame = !!v; }
  else if (k === 'showFps') { SET.showFps = v; const fb = $('#fpsBadge'); if (fb) fb.style.display = (S && SET.showFps) ? 'block' : 'none'; }
  else if (k === 'showDiag') { SET.showDiag = v; const dh = $('#diagHud'); if (dh) dh.style.display = (S && SET.showDiag) ? 'block' : 'none'; }
  else if (k === 'fpsCap') { SET.fpsCap = v; toast('Лимит FPS: ' + v, 'good'); }
  else if (k === 'vsync') { SET.vsync = 1; }
  else if (k === 'gfxApi') { SET.gfxApi = e.target.value; toast('Контекст WebGL выбран (применится при перезапуске)', 'good'); }
  else if (k === 'lite') { SET.lite = v; const baseQ = QUALITY[resolveQualityPreset(SET.quality)]; W && W.applyQuality(Object.assign({}, baseQ, SET.custom || {}), SET.custom ? 'custom' : resolveQualityPreset(SET.quality)); toast('Режим GPU применён мгновенно'); }
  else if (k === 'sens') { if (controls) controls.lookSens = v; if (sp) sp.textContent = v.toFixed(2); }
  else {
    const val = (k === 'texFilter') ? e.target.value : v;
    const baseQ = QUALITY[resolveQualityPreset(SET.quality)];
    SET.custom = Object.assign({}, baseQ, SET.custom || {}, { [k]: val });
    if (sp) sp.textContent = (k === 'draw' || k === 'npcDraw') ? val + ' м' : val;
    W && W.applyQuality(SET.custom, 'custom');
  }
  saveSet();
});

function offlineIncome() {
  if (!S.seller || !S.lastSeen) return;
  const hours = Math.min(8, (Date.now() - S.lastSeen) / 3.6e6);
  if (hours < .1) return;
  const r = autoDay(hours);
  if (r.rev <= 0) return;
  queueCard({ title:'👩 Пока вас не было', html:`<p>Тётя Люба торговала ${hours.toFixed(1)} ч и наторговала <b>${fmt(r.rev - r.theft)} ₽</b> (продано ${r.sold} шт.).</p>
    ${r.theft ? `<p class="muted">Касса почему-то не сходится на ${fmt(r.theft)} ₽...</p>` : ''}<p class="muted">Лимит — 8 часов.</p>` });
  save();
}

// ============================================================
//  Заказы: бумажный блокнот, телефон, доставка, распаковка, товар из-под полы
// ============================================================
const CATS = [
  ['Продукты', ['bread', 'choc']], ['Консервы', ['tushonka', 'kilka']], ['Напитки', ['soda', 'beer']], ['Сигареты', ['cig']],
  ['Жвачка', ['gum']], ['Журналы', ['paper', 'mag', 'mag2']], ['Алкоголь', ['vodka']], ['Прочее', ['batt', 'tape', 'toy', 'up:tv', 'up:fridge', 'up:sharp', 'up:sign', 'outfit:sport', 'outfit:varenki', 'outfit:raspberry', 'outfit:business']],
  ['Карандашом…', ['h:samogon', 'h:kontra', 'h:royal', 'h:anabol', 'h:vhs']],
];
const DELIV = { min: 1.5, rate: .06 };
let npOpen = false, npCat = 0, npBusy = false;
const ordQty = id => (id.startsWith('h:') ? S.order.hidden[id.slice(2)] : S.order.lines[id]) || 0;
function lineInfo(id) {
  if (id.startsWith('h:')) { const k = id.slice(2); return { name: HIDDEN[k].name, unit: hiddenPrice(k), pack: 1, avail: true, hidden: true }; }
  if (id.startsWith('outfit:')) { const k = id.slice(7), o = OUTFITS[k]; return { name: o.name, unit: usdToRub(o.usd), pack: 1, avail: (!o.from || S.day >= o.from) && !S.owned.includes(k), outfit: true }; }
  if (id.startsWith('up:')) { const k = id.slice(3), u = UPGRADES[k]; return { name: u.name, unit: usdToRub(u.usd), pack: 1, avail: (!u.from || S.day >= u.from) && !S.up[k], outfit: true }; }
  return { name: GOODS[id].name, unit: S.prices[id], pack: 5, avail: goodAvail(id) };
}
function orderSum(hidden) {
  let sum = 0, n = 0; const src = hidden ? S.order.hidden : S.order.lines;
  for (const [k, q] of Object.entries(src)) { if (!q) continue; const li = lineInfo(hidden ? 'h:' + k : k); sum += li.unit * q; n += q; }
  const deliv = n ? Math.round(Math.max(usdToRub(DELIV.min), sum * DELIV.rate)) : 0;
  return { sum, deliv, total: sum + deliv, n };
}
function setOrd(id, q) { q = Math.max(0, Math.min(200, q)); if (id.startsWith('h:')) S.order.hidden[id.slice(2)] = q; else S.order.lines[id] = q; if (!q) { delete S.order.hidden[id.slice(2)]; delete S.order.lines[id]; } save(); }
function notepadHtml() {
  const [cname, ids] = CATS[npCat], hid = cname.startsWith('Карандаш');
  const o = orderSum(false), oh = orderSum(true);
  const mk = Math.round(S.markup * 100);
  const mkLabel = mk <= 25 ? 'по-честному' : mk <= 60 ? 'как все' : mk <= 100 ? 'дерзко' : 'грабёж';
  const lines = Object.entries(S.order.lines).filter(([, q]) => q).map(([k, q]) => `<div class="np-ln"><span>${lineInfo(k).name.replace(/«|»/g, '')}</span><span>${q} шт</span><span>${fmt(lineInfo(k).unit * q)}</span><button data-np="del" data-id="${k}">×</button></div>`).join('') || '<div class="np-ln np-dim">пока пусто…</div>';
  const pend = (S.deliveries || []).length;
  return `<div class="np-book">
    <div class="np-cover"></div><div class="np-stack"></div>
    <div class="np-sheet"><div class="np-page ${hid ? 'np-pencilpage' : ''}">
      <div class="np-label">ЗАКАЗЫ И ЦЕНЫ · 1992</div>
      <div class="np-cats">${CATS.map(([n], i) => `<button data-np="cat" data-i="${i}" class="${i === npCat ? 'on' : ''} ${n.startsWith('Карандаш') ? 'pencil' : ''}">${n}</button>`).join('')}</div>
      <div class="np-cols">
        <div class="np-colL">
          <div class="np-h">${cname}</div>
          ${hid ? '<div class="np-dim">для своих. Вова с вокзала, звонить вечером.</div>' : ''}
          ${ids.map(id => { const li = lineInfo(id); if (!li.avail) return ''; const q = ordQty(id);
            const isGood = !li.hidden && !li.outfit && GOODS[id];
            const prTxt = isGood ? `опт ${fmt(li.unit)} → <b>${fmt(sellPrice(id))} р.</b>` : `${fmt(li.unit)} р.${li.pack > 1 ? '/шт' : ''}`;
            return `<div class="np-item"><div class="np-nm">${li.name}</div><div class="np-pr">${prTxt}</div>
              <div class="np-q"><button data-np="q" data-id="${id}" data-d="-${li.pack}">−</button><span>${q}</span><button data-np="q" data-id="${id}" data-d="${li.pack}">+</button></div></div>`; }).join('')}
        </div>
        <div class="np-colR">
          <div class="np-h">Наценка в ларьке</div>
          <div id="npMkVal"><b>+${mk}%</b> <span class="np-dim">(${mkLabel})</span></div>
          <div style="display:flex;align-items:center;gap:6px;margin:2px 0 4px">
            <button data-np="mk" data-d="-5" style="border:1px solid #1d2f7a66;border-radius:12px;padding:0 8px;line-height:22px">−5%</button>
            <input type="range" min="0" max="150" step="5" value="${mk}" data-range="markup" style="flex:1;accent-color:#7a1a1a">
            <button data-np="mk" data-d="5" style="border:1px solid #1d2f7a66;border-radius:12px;padding:0 8px;line-height:22px">+5%</button>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;border-bottom:1px solid #1d2f7a44;padding-bottom:6px">
            ${[20, 40, 60, 100].map(v => `<button data-np="mkset" data-v="${v}" style="border:1px dashed #1d2f7a66;border-radius:4px;padding:0 6px;font-size:.86em;${mk === v ? 'color:#7a1a1a;font-weight:700;border-style:solid' : ''}">${v}%</button>`).join('')}
          </div>
          <div class="np-h">Заказ на базу «Оптторг»</div>
          ${lines}
          <div class="np-sum"><div>товар: <b>${fmt(o.sum)} р.</b></div><div>доставка (прим.): <b>${fmt(o.deliv)} р.</b></div><div class="np-tot">итого: ${fmt(o.total)} р.</div></div>
          ${oh.n ? `<div class="np-pencil">Вове: ${oh.n} шт на ${fmt(oh.total)} р.</div>` : ''}
          <div class="np-note">${o.n || oh.n ? '→ позвонить с телефона на прилавке, подтвердить' : ''}${pend ? `<br>везут: ${pend} заказ(а)` : ''}</div>
          <div class="np-dim">в кассе: ${fmt(S.money)} р.</div>
        </div>
      </div>
    </div><div class="np-flip"></div></div>
    <div class="np-rings">${'<i></i>'.repeat(16)}</div>
  </div>
  <div class="np-bar"><button data-np="clear">Очистить заказ</button><button data-np="close" class="np-close">Убрать блокнот</button></div>`;
}
function renderNotepad() { const el = $('#notepad'); if (!el) return; el.innerHTML = notepadHtml(); }
function openOrders() {
  if (npOpen || npBusy || !W) return; npBusy = true; sfx.click();
  W.openNotepadAnim(() => { npBusy = false; npOpen = true; const el = $('#notepad'); renderNotepad(); el.classList.add('on', 'enter'); setTimeout(() => el.classList.remove('enter'), 450); renderControls(); });
  renderControls();
}
function closeOrders() {
  if (!npOpen) return; npOpen = false; const el = $('#notepad'); el.classList.remove('on'); npBusy = true;
  setTimeout(() => W.closeNotepadAnim(() => { npBusy = false; renderControls(); }), 250); renderControls();
}

// ============================================================
//  Чтение газет «ПРАВДА» (5952.jpg) и «ИЗВЕСТИЯ» (5951.jpg)
// ============================================================
let paperOpen = false, paperBusy = false, paperCat = 0, paperZoom = 1;
const PAPER_CATS = [
  ['ПРАВДА · Полоса 1', 'pravda', 'page1'],
  ['ПРАВДА · Полоса 2', 'pravda', 'page2'],
  ['ИЗВЕСТИЯ · Полоса 1', 'izvestia', 'page1'],
  ['ИЗВЕСТИЯ · Полоса 2', 'izvestia', 'page2']
];
const PAPER_ISSUES = {
  pravda: {
    title: 'ПРАВДА',
    sub: 'Газета основана 5 мая 1912 года В. И. Лениным · Суббота, 28 ноября 1992 года · № 177 (26931) · Цена свободная',
    leadTitle: 'С ЧЕМ ИДЕМ К СЪЕЗДУ: Полярный настрой · Та же колода',
    articles: [
      {
        h: 'Полярный настрой и «Та же колода»',
        illo: 'assets/tex/pravda_cartoon.jpg',
        illoCap: 'Рис. Александра УМЯРОВА: «Та же колода» у съездовской трибуны.',
        illoWide: true,
        body: 'В канун VII съезда народных депутатов России политические страсти накалились до предела. Правительственный курс «шоковой терапии» привёл к обвальному росту цен и падению производства на крупнейших предприятиях страны. В очередях у коммерческих ларьков и государственных магазинов люди задают один вопрос: останется ли прежняя колода реформаторов у руля или съезд потребует смены экономического курса?'
      },
      {
        h: 'Краснов с Красной Пресни (Красный телефон: 257-30-20)',
        illo: 'assets/tex/pravda_krasnov.jpg',
        illoCap: 'А. Краснов на прямой линии с читателями.',
        illoWide: false,
        body: 'Прежде чем он объявит перерыв и журналисты бросятся к микрофонам, Александр Краснов — председатель Краснопресненского райсовета — прямо говорит о судьбе приватизации, ваучерах и муниципальной торговле: «Людям нужны не громкие обещания, а твёрдый рубль, работающие заводы и доступные продукты первой необходимости на каждом углу».'
      },
      {
        h: 'Коротко и ясно · Цитаты дня',
        body: `• Егор ГАЙДАР: «Инфляция остаётся главным вызовом нынешней зимы, однако возврата к старой распределительной системе уже не будет».
• «Правда» возвращает подписчиков: несмотря на взвинченные тарифы связистов и подорожание бумаги, тысячи читателей по всей стране продолжают выписывать газету.
• В Минске чтут СССР: ветераны и рабочие делегации обсуждают сохранение кооперационных связей между заводами.`
      },
      {
        h: 'Субботний репортаж: «Ведь это наши горы» · «Купить город можно ...в Польше. А у нас?»',
        illo: 'assets/tex/pravda_cartoon.jpg',
        illoCap: 'Зарубежная пресса о политической обстановке в России.',
        illoWide: true,
        body: 'Пока на прилавках коммерческих киосков появляются импортные батончики, жвачки и кассеты, отечественные заводы вынуждены рассчитываться с рабочими по бартеру — тушёнкой, сгущёнкой и пивом собственного разлива. Предприимчивые торговцы закупают заводские партии напрямую со складов сбыта со скидкой 20%.'
      }
    ]
  },
  izvestia: {
    title: 'ИЗВЕСТИЯ',
    sub: 'Газета выходит с марта 1917 года · Понедельник, 27 июля 1992 года · № 170 (23744) · Московский вечерний выпуск',
    leadTitle: 'ВНУТРЕННИЕ РАСПРИ В СТАНЕ ДЕМОКРАТОВ УСИЛИВАЮТ УГРОЗУ РЕФОРМАМ',
    articles: [
      {
        h: 'Внутренние распри в стане демократов усиливают угрозу реформам',
        illo: 'assets/tex/izvestia_ft.jpg',
        illoCap: 'Редакторы «Файнэншл таймс» и «Известий» с пилотным выпуском газеты.',
        illoWide: true,
        body: 'Экономическая реформа вступила в самую сложную полосу: свободные цены и курс доллара меняются каждую неделю, а промышленное лобби требует льготных кредитов для заводов. Эксперты предупреждают: кто держит сбережения в твёрдой валюте и вовремя обновляет ассортимент, тот переживёт любые скачки инфляции.'
      },
      {
        h: 'Стартовал русско-французский космический экипаж · Первые победы в Барселоне',
        illo: 'assets/tex/izvestia_olympic.jpg',
        illoCap: 'Барселона-92: первые олимпийские медали на водных дорожках.',
        illoWide: false,
        body: 'С космодрома Байконур успешно стартовал корабль «Союз ТМ-15» с международным экипажем на борту. А в Барселоне на Олимпиаде-92 в первый же день прозвучали гимны в честь наших пловцов и гимнастов.'
      },
      {
        h: '«Файнэншл таймс» и «Известия» объединяют усилия для выпуска новой газеты',
        illo: 'assets/tex/izvestia_cartoon.jpg',
        illoCap: 'Острый штрих недели.',
        illoWide: false,
        body: 'Совместный финансово-экономический выпуск призван помочь новым российским предпринимателям, кооператорам и владельцам торговых точек ориентироваться в рыночной конъюнктуре, оптовых ценах и валютных курсах.'
      },
      {
        h: 'От наших корреспондентов: Клиенты Внешэкономбанка и товарные биржи',
        body: `• Клиенты Внешэкономбанка, кажется, могут готовить кошельки: обсуждается порядок выплат по замороженным валютным счетам.
• Ставропольский хлеб идёт на торги: закупочные цены нового урожая определят стоимость хлеба и продуктов в рознице на ближайшие месяцы.
• Коммерческие киоски переходят на круглосуточный график работы у автобусных остановок.`
      }
    ]
  }
};

function renderPaperArticle(a) {
  const illoHtml = a.illo
    ? (a.illoWide
      ? `<div style="margin:5px 0 6px;background:#d6cebc;border:1px solid #2b2720;padding:4px;text-align:center;">
          <img src="${a.illo}" alt="" style="width:100%;max-height:118px;object-fit:contain;display:block;margin:0 auto;filter:contrast(1.06) sepia(0.08);">
          ${a.illoCap ? `<div style="font-size:10.5px;font-style:italic;color:#38332b;margin-top:3px;line-height:1.2;">${esc(a.illoCap)}</div>` : ''}
        </div>`
      : `<div style="float:left;width:82px;margin:2px 9px 4px 0;background:#d6cebc;border:1px solid #2b2720;padding:3px;text-align:center;">
          <img src="${a.illo}" alt="" style="width:100%;height:auto;display:block;filter:contrast(1.06) sepia(0.08);">
          ${a.illoCap ? `<div style="font-size:9.5px;font-style:italic;color:#38332b;margin-top:2px;line-height:1.15;">${esc(a.illoCap)}</div>` : ''}
        </div>`)
    : '';
  return `<div class="paper-art" style="overflow:hidden;">
    <div class="paper-art-h">${esc(a.h)}</div>
    ${illoHtml}
    <div class="paper-art-b">${esc(a.body)}</div>
  </div>`;
}

function paperHtml() {
  const [, issueKey, mode] = PAPER_CATS[paperCat] || PAPER_CATS[0];
  const iss = PAPER_ISSUES[issueKey] || PAPER_ISSUES.pravda;
  const hotGood = S && S.wave && GOODS[S.wave] ? GOODS[S.wave].name : 'Сигареты «Космонавт», Пиво «Заводское» и Хлеб';
  const crimeNote = S && S.npcMemory && S.npcMemory.crimes && S.npcMemory.crimes.kills > 0
    ? 'Жители ул. Заводской встревожены недавними разборками у ларька — милиция усилила патрули.'
    : 'На маршруте автобуса №7 (ул. Заводская — Завод) движение по расписанию, у проходной открыт отдел сбыта.';
  const tabs = PAPER_CATS.map(([lbl], i) => `<button data-pr="cat" data-i="${i}" class="${i === paperCat ? 'on' : ''}">${lbl}</button>`).join('');
  const fontScale = (0.96 + (paperZoom - 1) * 0.22).toFixed(2);
  const colL = mode === 'page1' ? [iss.articles[0], iss.articles[2]] : [iss.articles[3], iss.articles[1]];
  const colR = mode === 'page1' ? [iss.articles[1], iss.articles[3]] : [iss.articles[2], iss.articles[0]];

  const bodyHtml = `<div class="paper-cols" style="font-size:${fontScale}em;">
      <div class="paper-colL">
        <div style="font-weight:900;font-size:1.06em;text-transform:uppercase;border-bottom:2px solid #181715;padding-bottom:4px;margin-bottom:8px;">${esc(iss.leadTitle)}</div>
        ${colL.map(renderPaperArticle).join('')}
      </div>
      <div class="paper-colR">
        ${colR.map(renderPaperArticle).join('')}
        <div style="background:#cec8b8;border:1px solid #3a362e;padding:7px 9px;font-size:12px;margin-top:6px;">
          <div style="font-weight:900;text-transform:uppercase;margin-bottom:2px;">📌 Коммерческий вестник района (${S ? dateStr(S.day) : '1992 г.'})</div>
          <div>• Курс доллара: <b>1 $ = ${S ? fmt(S.rate) : 110} ₽</b> · Индекс цен: <b>×${S ? S.idx.toFixed(2) : '1.00'}</b></div>
          <div>• Повышенный спрос: <b>${esc(hotGood)}</b></div>
          <div>• ${esc(crimeNote)}</div>
        </div>
      </div>
    </div>`;
  return `<div class="np-book paper-book">
    <div class="np-cover"></div><div class="np-stack"></div>
    <div class="np-sheet">
      <div class="paper-page">
        <div class="paper-fold"></div>
        <div class="paper-cats">${tabs}</div>
        <div class="paper-masthead">
          <div class="paper-masthead-title">${esc(iss.title)}</div>
          <div class="paper-masthead-sub">${esc(iss.sub)}</div>
        </div>
        ${bodyHtml}
      </div>
      <div class="paper-flip"></div>
    </div>
  </div>
  <div class="np-bar">
    <button data-pr="next">Листать полосу ➔</button>
    <button data-pr="zoom">Шрифт ×${paperZoom.toFixed(1)}</button>
    <button data-pr="close" class="np-close">Убрать газету</button>
  </div>`;
}

function renderPaperReader() {
  const el = $('#paperReader');
  if (!el) return;
  el.innerHTML = paperHtml();
}

function finishOpenPaper() {
  if (paperOpen) return;
  paperBusy = false;
  paperOpen = true;
  const el = $('#paperReader');
  renderPaperReader();
  if (el) {
    el.classList.add('on', 'enter');
    setTimeout(() => el.classList.remove('enter'), 450);
  }
  renderControls();
}

function gainIntellectExp(sourceLabel) {
  if (!S) return;
  S.xp = (S.xp || 0) + 8;
  checkLevel();
  gainSkillXp('charm', 50, sourceLabel);
  renderHud();
}

function watchVhsOnTv() {
  if (!S) return;
  if (S.lastTvWatchDay === S.day) {
    toast('Сегодня вы уже смотрели кассету на «Рубине»! Пора торговать.', '');
    return;
  }
  S.lastTvWatchDay = S.day;
  const show = pick([
    '«Двойной удар» с Жан-Клодом Ван Даммом в переводе Володарского',
    'телепередачу «Поле чудес» с Леонидом Якубовичем',
    'выпуск криминальной хроники «600 секунд»',
    '«Терминатор 2: Судный день» на видеокассете VHS'
  ]);
  S.hp = Math.min(S.maxHp || 100, (S.hp || 100) + 15);
  if (W && W.P) W.P.hp = S.hp;
  sfx.tv && sfx.tv();
  gainIntellectExp(`📺 Просмотр VHS (${show})`);
}

function trainKettlebell() {
  if (!S) return;
  if (S.lastGymDay === S.day && (S.gymToday || 0) >= 2) {
    toast('Мышцы уже гудят после подхода с 24-килограммовой гирей! Продолжите тренировку завтра.', '');
    return;
  }
  if (S.lastGymDay !== S.day) { S.lastGymDay = S.day; S.gymToday = 0; }
  S.gymToday = (S.gymToday || 0) + 1;
  S.maxHp = Math.min(160, (S.maxHp || 100) + 5);
  S.hp = Math.min(S.maxHp, (S.hp || 100) + 5);
  if (W && W.P) W.P.hp = S.hp;
  sfx.click && sfx.click();
  gainSkillXp('sense', 50, '🏋️ Подход с пудовой гирей 24 кг');
  renderHud();
}

function readPaper(issue) {
  if (S && S.lastPaperReadDay !== S.day) {
    S.lastPaperReadDay = S.day;
    setTimeout(() => gainIntellectExp('📰 Чтение свежей прессы'), 800);
  }
  if (paperOpen || paperBusy || npOpen || npBusy || !W || !S) return;
  if (dialogOpen) closeDialog();
  if (issue === 'izvestia') paperCat = 2;
  else if (issue === 'pravda') paperCat = 0;
  paperZoom = 1;
  paperBusy = true;
  sfx.click();
  renderControls();
  let doneCalled = false;
  const done = () => {
    if (doneCalled) return;
    doneCalled = true;
    finishOpenPaper();
  };
  try {
    const openFn = W.openPaperAnim || W.openNotepadAnim;
    if (openFn) openFn(done);
    else done();
  } catch (err) {
    console.error(err);
    done();
  }
  setTimeout(done, 650);
}

function closePaperReader() {
  if (!paperOpen && !paperBusy) return;
  paperOpen = false;
  const el = $('#paperReader');
  if (el) el.classList.remove('on');
  paperBusy = true;
  renderControls();
  let doneCalled = false;
  const done = () => {
    if (doneCalled) return;
    doneCalled = true;
    paperBusy = false;
    renderControls();
  };
  setTimeout(() => {
    try {
      const closeFn = W && (W.closePaperAnim || W.closeNotepadAnim);
      if (closeFn) closeFn(done);
      else done();
    } catch (err) {
      console.error(err);
      done();
    }
  }, 200);
  setTimeout(done, 750);
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-pr]');
  if (!b || !paperOpen) return;
  e.stopPropagation();
  const a = b.dataset.pr;
  sfx.click();
  if (a === 'close') { closePaperReader(); return; }
  if (a === 'zoom') { paperZoom = paperZoom >= 1.8 ? 1 : 1.8; renderPaperReader(); return; }
  if (a === 'cat' || a === 'next') {
    const nextCat = a === 'next' ? (paperCat + 1) % PAPER_CATS.length : +b.dataset.i;
    if (nextCat === paperCat) return;
    const fl = document.querySelector('.paper-flip');
    if (fl) { fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); }
    audio.click && audio.click(2400, .25, 0, .12);
    setTimeout(() => { paperCat = nextCat; paperZoom = 1; renderPaperReader(); }, 260);
    return;
  }
}, true);
document.addEventListener('click', e => {
  const b = e.target.closest('[data-np]'); if (!b || !npOpen) return; e.stopPropagation();
  const a = b.dataset.np; sfx.click();
  if (a === 'close') { closeOrders(); return; }
  if (a === 'cat') { const i = +b.dataset.i; if (i === npCat) return; const fl = document.querySelector('.np-flip'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); audio.click(2400, .25, 0, .12); setTimeout(() => { npCat = i; renderNotepad(); }, 280); return; }
  if (a === 'mk') { S.markup = clamp(Math.round((S.markup * 100 + +b.dataset.d) / 5) * 5, 0, 150) / 100; if (W) W.updateShelves(); save(); renderHud(); }
  if (a === 'mkset') { S.markup = clamp(+b.dataset.v, 0, 150) / 100; if (W) W.updateShelves(); save(); renderHud(); }
  if (a === 'q') { setOrd(b.dataset.id, ordQty(b.dataset.id) + +b.dataset.d); }
  if (a === 'del') setOrd(b.dataset.id, 0);
  if (a === 'clear') { S.order = { lines: {}, hidden: {} }; save(); }
  renderNotepad();
}, true);

// --- Проходная трёх заводов Краснозаводска: Мясокомбинат, Хлебозавод и Ликёро-водочный завод (с бартером и скидками от работяг) ---
function factoryTalk(initialPlant = null) {
  if (!W || !S) return;
  const gNpc = W.debug.people.find(p => p.role === 'zavod');
  if (gNpc) gNpc.talking = true;
  const done = () => { if (gNpc) gNpc.talking = false; closeDialog(); };
  const physLv = (S.sk && S.sk.sense) || 0;
  const maxCarryBoxes = 1 + Math.min(2, physLv); // с высокой Физкультурой можно утащить за раз до 3 ящиков!

  const PLANTS = {
    meat: {
      name: '🥩 Краснозаводский Мясокомбинат (Цех №1)',
      disc: .68,
      desc: `Работягам Мясокомбината зарплату выдали варёной колбасой «Докторская», «Краковской», котлетами и тушёнкой в солидоле — отдают на 32% дешевле базы! ${S.up && S.up.fridge ? 'В вашем ларьке стоит холодильник «ЗИЛ», поэтому мясо не испортится!' : 'ВНИМАНИЕ: без холодильника «ЗИЛ» в ларьке мясные продукты протухнут за 2 дня и вызовут СЭС!'}`,
      lots: [
        { id: 'tushonka', qty: 10, title: 'Ящик колбасы «Докторская» и говяжьей тушёнки (10 шт.)' },
        { id: 'kilka',    qty: 10, title: 'Коробка заводских котлет и консервов (10 шт.)' },
      ]
    },
    bread: {
      name: '🍞 Краснозаводский Хлебозавод (Цех №2)',
      disc: .65,
      desc: 'Пекари с ночной смены отдают горячий ржаной хлеб «Дарницкий», батоны, сушки и пряники на 35% дешевле опта! Покупка свежего хлеба повышает Уважение Народа.',
      lots: [
        { id: 'bread', qty: 10, title: 'Лоток ржаного хлеба и батонов (10 бух.)' },
        { id: 'choc',  qty: 10, title: 'Коробка заводских пряников и вафель к чаю (10 шт.)' },
      ]
    },
    lvz: {
      name: '🍾 Ликёро-водочный и Пивзавод (Цех №3)',
      disc: .72,
      desc: 'На ЛВЗ и пивзаводе разливают «Русскую», «Столичную», классическое «Жигулёвское» и лимонад «Буратинка» — отгружают ящиками со скидкой 28%!',
      lots: [
        { id: 'vodka', qty: 10, title: 'Ящик водки «Русская» / «Столичная» (10 бут.)' },
        { id: 'beer',  qty: 10, title: 'Ящик пива «Жигулёвское» (10 бут.)' },
        { id: 'soda',  qty: 10, title: 'Ящик лимонада «Буратинка» (10 бут.)' },
      ]
    }
  };

  const buyLot = (lot, disc, toKiosk = false, boxMult = 1, pKey = 'meat') => {
    const totalQty = lot.qty * boxMult;
    const unit = Math.max(1, Math.round((S.prices[lot.id] || GOODS[lot.id].base) * disc));
    const cost = unit * totalQty;
    if (S.money < cost) {
      showDialog({
        name: 'Кладовщик Геннадий',
        text: `Наличных не хватает, коммерсант. За ${boxMult} кор. нужно ${fmt(cost)} ₽, а у тебя в кассе ${fmt(S.money)} ₽.`,
        options: [{ label: 'Понял', fn: () => factoryTalk() }]
      });
      return;
    }
    S.money -= cost;
    if (lot.id === 'bread') rep('folk', 2);
    const contents = { [lot.id]: [totalQty, unit] };
    if (toKiosk) {
      const etaH = R(.30, .55);
      S.deliveries = S.deliveries || [];
      S.deliveries.push({ contents, hidden: false, label: '«Заводской сбыт»', etaHours: etaH, eta: etaH * 90, state: 'way' });
      sfx.coin(); renderHud(); save();
      showDialog({
        name: 'Кладовщик Геннадий',
        text: `Оформил накладную на ${totalQty} шт.! Наш заводской грузовик по пути закинет прямо к двери твоего ларька.`,
        options: [{ label: 'Спасибо, Геннадий!', fn: done }]
      });
    } else {
      const bLbl = pKey === 'bread' ? '«ХЛЕБОЗАВОД № 2»' : pKey === 'lvz' ? '«ЛИКЁРО-ВОДОЧНЫЙ»' : '«МЯСОКОМБИНАТ»';
      if (W.spawnFactoryBox) W.spawnFactoryBox(contents, bLbl, pKey);
      sfx.coin(); renderHud(); save();
      toast(`Выдано ${totalQty} шт. (${boxMult} ящ.)! Берите у проходной и везите на автобусе №7.`, 'good');
      showDialog({
        name: 'Кладовщик Геннадий',
        text: `Вынес со штампом ОТК — вон у проходной стоит! Бери в руки, заходи в ПАЗик к Дяде Коле и вези к ларьку.`,
        options: [{ label: 'Отлично, забираю!', fn: done }]
      });
    }
  };

  const openPlantMenu = (pKey) => {
    const pl = PLANTS[pKey];
    { closeDialog();
      const unitOf = lot => Math.max(1, Math.round((S.prices[lot.id] || GOODS[lot.id].base) * pl.disc));
      openShop({ title: pl.name, intro: pl.desc, modes: [`Забрать самому (до ${maxCarryBoxes} ящ.)`, 'Доставка заводской машиной'], onClose: () => { if (gNpc) gNpc.talking = false; },
        items: mode => pl.lots.map(lot => ({ ic: GOODS[lot.id].icon, name: lot.title, desc: `${fmt(unitOf(lot))} ₽/шт. · в рознице у вас ${fmt(sellPrice(lot.id))} ₽`, unit: 'ящик', price: unitOf(lot) * lot.qty, max: mode === 0 ? maxCarryBoxes : 5,
          buy(n, md) { // деньги спишет прилавок — здесь только выдача
            const unit = unitOf(lot), totalQty = lot.qty * n, contents = { [lot.id]: [totalQty, unit] };
            if (lot.id === 'bread') rep('folk', 2);
            if (md === 1) { const etaH = R(.30, .55); S.deliveries = S.deliveries || []; S.deliveries.push({ contents, hidden: false, label: '«Заводской сбыт»', etaHours: etaH, eta: etaH * 90, state: 'way' }); return `Оформил накладную на ${totalQty} шт. Грузовик закинет к двери вашего ларька.`; }
            const bLbl = pKey === 'bread' ? '«ХЛЕБОЗАВОД № 2»' : pKey === 'lvz' ? '«ЛИКЁРО-ВОДОЧНЫЙ»' : '«МЯСОКОМБИНАТ»';
            if (W.spawnFactoryBox) W.spawnFactoryBox(contents, bLbl, pKey);
            return `Вынес ${n} ящ. со штампом ОТК — стоят у входа. Берите в руки и везите автобусом № 7.`; } })) });
      return; }
    showDialog({
      name: pl.name,
      text: pl.desc,
      options: [
        ...pl.lots.map(lot => {
          const unit = Math.max(1, Math.round((S.prices[lot.id] || GOODS[lot.id].base) * pl.disc));
          const cost1 = unit * lot.qty;
          return {
            label: `📦 ${lot.title} — ${fmt(cost1)} ₽`,
            fn: () => showDialog({
              name: pl.name,
              text: `${lot.title}: ${fmt(cost1)} ₽ за 1 ящик (${fmt(unit)} ₽/шт.). Благодаря вашей Физкультуре (${physLv * 25 + 25}/100) вы можете унести за раз до ${maxCarryBoxes} ящиков!`,
              options: [
                { label: `Взять 1 ящик у проходной (${fmt(cost1)} ₽)`, fn: () => buyLot(lot, pl.disc, false, 1, pKey) },
                ...(maxCarryBoxes >= 2 ? [{ label: `💪 [Физкультура] Утащить сразу ${maxCarryBoxes} ящика (${fmt(cost1 * maxCarryBoxes)} ₽)`, fn: () => buyLot(lot, pl.disc, false, maxCarryBoxes, pKey) }] : []),
                { label: `Отправить заводской машиной к ларьку (${fmt(cost1)} ₽)`, fn: () => buyLot(lot, pl.disc, true, 1, pKey) },
                { label: '← Назад к цехам', fn: () => openPlantMenu(pKey) }
              ]
            })
          };
        }),
        ...(((S.hidden && S.hidden.samogon >= 2) || qOf('vodka') >= 2) ? [{
          label: '🔄 Бартер с работягами: отдать 2 бут. самогона/водки за 15 банок тушёнки и 10 буханок хлеба!',
          fn: () => {
            if (S.hidden && S.hidden.samogon >= 2) S.hidden.samogon -= 2;
            else takeStock('vodka', 2);
            addStock('tushonka', 15, Math.round(GOODS.tushonka.base * S.idx * .4));
            addStock('bread', 10, Math.round(GOODS.bread.base * S.idx * .4));
            rep('folk', 4);
            sfx.ching(); save(); renderHud();
            toast('Бартер состоялся! Работяги отдали 15 банок тушёнки и 10 буханок хлеба! (Народ +4)', 'good');
            done();
          }
        }] : []),
        { label: '← Все заводы Краснозаводска', fn: () => factoryTalk(null) },
        { label: 'До свидания', fn: done }
      ]
    });
  };

  const canBarterSamogon = (S.hidden && S.hidden.samogon >= 2) || qOf('vodka') >= 2;
  if (initialPlant && PLANTS[initialPlant]) {
    openPlantMenu(initialPlant);
    return;
  }
  showDialog({
    name: 'Проходная промузла Краснозаводска (Кладовщик Геннадий)',
    text: 'Здорово, коммерсант! На наших заводах людям месяцами не платят живыми деньгами — выдают зарплату колбасой, хлебом да водкой. Выбирай, с какого предприятия отгружать товар за нал или по бартеру:',
    options: [
      { label: '🥩 Краснозаводский Мясокомбинат (Колбаса, тушёнка, котлеты −32%)', fn: () => openPlantMenu('meat') },
      { label: '🍞 Краснозаводский Хлебозавод (Ржаной хлеб, батоны, пряники −35%)', fn: () => openPlantMenu('bread') },
      { label: '🍾 Ликёро-водочный и Пивзавод (Водка «Столичная», пиво «Жигулёвское» −28%)', fn: () => openPlantMenu('lvz') },
      ...(canBarterSamogon ? [{
        label: '🔄 Бартер с работягами: отдать 2 бут. самогона/водки за 15 банок тушёнки и 10 буханок хлеба!',
        fn: () => {
          if (S.hidden && S.hidden.samogon >= 2) S.hidden.samogon -= 2;
          else takeStock('vodka', 2);
          addStock('tushonka', 15, Math.round(GOODS.tushonka.base * S.idx * .4));
          addStock('bread', 10, Math.round(GOODS.bread.base * S.idx * .4));
          rep('folk', 4);
          sfx.ching(); save(); renderHud();
          toast('Бартер состоялся! Работяги отдали 15 банок тушёнки и 10 буханок хлеба! (Народ +4)', 'good');
          done();
        }
      }] : []),
      { label: 'Бывай, Геннадий', fn: done }
    ]
  });
}

// --- Меню покупки: список позиций с ценой, количеством и суммой (Марат, заводы) ---
// items: [{ ic, name, desc, price, max?, unit?, once?, buy(n) -> текст-ответ продавца | false }]
function openShop({ title, intro, items, modes, onClose, extra }) {
  const qty = []; let mode = 0, said = intro;
  const draw = box => {
    const list = typeof items === 'function' ? items(mode) : items;
    box.querySelector('#shopBody').innerHTML = `<p class="say" style="margin:0 0 8px">«${esc(said)}»</p>
      ${modes ? `<div class="seg" style="margin-bottom:8px">${modes.map((m, i) => `<button data-smode="${i}" class="${mode === i ? 'on' : ''}">${m}</button>`).join('')}</div>` : ''}
      ${list.map((it, i) => { if (qty[i] == null) qty[i] = 1; const mx = Math.max(0, Math.min(it.max ?? 99, it.once ? 1 : 99)); if (qty[i] > mx) qty[i] = Math.max(1, mx); const sum = it.price * qty[i], ok = mx > 0 && S.money >= sum;
        return `<div class="good" style="${mx > 0 ? '' : 'opacity:.45'}"><div class="ic">${it.ic}</div><div class="nm"><div>${it.name}</div><div class="muted">${it.desc || ''}${it.max != null && !it.once ? ` · в наличии: ${it.max}` : ''}</div></div>
          <div style="text-align:right;white-space:nowrap"><div class="pr">${fmt(it.price)} ₽${it.unit ? '<span class="muted">/' + it.unit + '</span>' : ''}</div>
          <div class="row" style="gap:4px;justify-content:flex-end;margin-top:3px">${it.once ? '' : `<button class="btn small" data-sq="${i}:-1">−</button><b style="min-width:20px;text-align:center">${qty[i]}</b><button class="btn small" data-sq="${i}:1">+</button>`}
          <button class="btn small ${ok ? 'green' : ''}" data-sbuy="${i}" ${ok ? '' : 'disabled'}>${mx > 0 ? (it.once ? 'Купить' : fmt(sum) + ' ₽') : 'Нет'}</button></div></div></div>`; }).join('')}
      <div class="tstat"><span>В КАРМАНЕ: ${fmt(S.money)} ₽</span></div>`;
    box.querySelectorAll('[data-smode]').forEach(b => b.onclick = () => { mode = +b.dataset.smode; qty.length = 0; sfx.click(); draw(box); });
    box.querySelectorAll('[data-sq]').forEach(b => b.onclick = () => { const [i, d] = b.dataset.sq.split(':').map(Number); const mx = Math.max(1, Math.min(list[i].max ?? 99, 99)); qty[i] = clamp((qty[i] || 1) + d, 1, mx); sfx.click(); draw(box); });
    box.querySelectorAll('[data-sbuy]').forEach(b => b.onclick = () => { const i = +b.dataset.sbuy, it = list[i], n = it.once ? 1 : qty[i], sum = it.price * n;
      if (S.money < sum) { sfx.bad(); return; } // без денег — без товара
      const r = it.buy(n, mode); if (r === false) return; S.money -= sum; if (typeof r === 'string') said = r; qty[i] = 1; sfx.coin(); renderHud(); save(); draw(box); });
  };
  queueCard({ title, wide: true, html: '<div id="shopBody"></div>', onShow: draw,
    buttons: [...(extra || []).map(e => ({ label: e.label, fn() { said = e.say(); draw($('#mbox')); return 'keep'; } })), { label: 'Уйти', fn() { onClose && onClose(); } }] });
}

// --- Марат: патроны на остановке ---
function maratTalk() {
  if (!W) return; const m = W.debug.people.find(p => p.role === 'marat'); if (m) m.talking = true;
  const done = () => { if (m) m.talking = false; closeDialog(); };
  const gMem = S.npcMemory = S.npcMemory || { talks: {}, crimes: { gunAimed: 0, brawls: 0, kills: 0 } };
  gMem.talks.marat = (gMem.talks.marat || 0) + 1;
  if (S.flags.maratPunched === S.day || (m && m.memory && m.memory.wasPunched)) {
    showDialog({
      name: 'Марат',
      text: 'Ты какого чёрта кулаками машешь, коммерсант?! В челюсть мне заехал, а теперь как ни в чём не бывало разговаривать пришёл?! Гони ' + fmt(usdToRub(4)) + ' ₽ за неуважение или сейчас на кулаках разберёмся до нокаута!',
      options: [
        ...(S.money >= usdToRub(4) ? [{ label: `Держи ${fmt(usdToRub(4))} ₽, Марат, бес попутал — мир!`, fn: () => { S.money -= usdToRub(4); S.flags.maratPunched = -1; if (m && m.memory) m.memory.wasPunched = false; if (m) { m.brawling = false; m.hp = m.maxHp || 135; } renderHud(); save(); maratTalk(); } }] : []),
        { label: '🥊 Давай разберёмся на кулаках!', fn: () => { done(); if (m) { m.brawling = true; m.state = 'brawl'; } W.punch(); } },
        { label: 'Ладно, ухожу…', fn: done }
      ]
    });
    return;
  }
  if (S.flags.maratAngry === S.day || (m && m.memory && m.memory.sawGunAim)) {
    showDialog({
      name: 'Марат',
      text: 'Ты на меня ствол наставлял, коммерсант. Память у меня длинная. Или гони ' + fmt(usdToRub(5)) + ' ₽ за неуважение, или сегодня разговора нет.',
      options: [
        ...(S.money >= usdToRub(5) ? [{ label: `Держи ${fmt(usdToRub(5))} ₽, Марат, погорячился`, fn: () => { S.money -= usdToRub(5); S.flags.maratAngry = -1; if (m && m.memory) m.memory.sawGunAim = false; renderHud(); save(); maratTalk(); } }] : []),
        { label: 'Ладно, зайду позже…', fn: done }
      ]
    });
    return;
  }
  if (!S.marat || S.marat.day !== S.day) S.marat = { day: S.day, stock: RI(10, 25) };
  const price5 = usdToRub(4), have = S.marat.stock;
  const buy = n => { const cost = price5 * n / 5; if (have < n) { showDialog({ name: 'Марат', text: `Столько нет. Осталось ${have}.`, options: [{ label: 'Понял', fn: () => maratTalk() }] }); return; } if (S.money < cost) { showDialog({ name: 'Марат', text: 'Денег не хватает, брат. Без денег — никак.', options: [{ label: 'Понял', fn: done }] }); return; }
    S.money -= cost; S.marat.stock -= n; if (W) { W.weapon.reserve += n; syncAmmoFromWeapon(); } else S.shells += n; sfx.coin(); renderHud(); save();
    showDialog({ name: 'Марат', text: pick(['Держи. И не свети особо.', 'Двенадцатый калибр, дробь. Как договаривались.', 'Бери. Если что — ты меня не знаешь.']), options: [{ label: 'Спасибо', fn: done }] }); };
  if (W && W.maratHere && !W.maratHere()) { done(); toast('Марат торгует за гаражами только на рассвете, с 7:00 до 8:30 — пока нет патрулей.'); return; }
  { const sd = S.rep.street >= 25 ? .8 : 1, pr = usd => Math.max(5, Math.round(usdToRub(usd) * sd / 5) * 5), hp = id => Math.max(5, Math.round(hiddenPrice(id) * .72 * sd / 5) * 5);
    const addHid = (id, n) => { S.hidden = S.hidden || {}; S.hidden[id] = (S.hidden[id] || 0) + n; };
    closeDialog(); S.flags.maratMet = true;
    openShop({ title: 'Марат · багажник красной BMW', onClose: () => { if (m) m.talking = false; },
      intro: sd < 1 ? 'Для своих — скидка. Смотри, что есть, и не свети тут долго: в девять патруль пойдёт.' : 'Ты с ларька дяди Толи? Смотри, что есть. Деньги вперёд, вопросов не задавать. В девять меня тут уже нет.',
      items: [
        { ic: '🔒', name: 'Стальные решётки-ставни для ларька', desc: 'сварная решётка на витрину — защита от ночного взлома и налётчиков', once: true, max: S.up.shutters ? 0 : 1, price: pr(UPGRADES.shutters.usd), buy() { S.up.shutters = true; rep('street', 2); sfx.ching(); return 'Пацаны со сварочного цеха сварили на совесть! Установили на твою витрину — теперь ночью никто стекло не выставит.'; } },
        { ic: '🔴', name: 'Патроны 12 калибра, дробь', desc: 'к дядиной двустволке', unit: 'шт.', price: pr(.45), max: S.marat.stock, buy(n) { S.marat.stock -= n; if (W) { W.weapon.reserve += n; syncAmmoFromWeapon(); } else S.shells += n; return pick(['Держи. И не свети особо.', 'Двенадцатый калибр, дробь. Как договаривались.', 'Бери. Если что — ты меня не знаешь.']); } },
        { ic: '🥊', name: 'Свинцовый кастет', desc: 'удары руками заметно тяжелее', once: true, max: S.flags.hasBrassKnuckles ? 0 : 1, price: pr(5), buy() { S.flags.hasBrassKnuckles = true; rep('street', 3); return 'Отливали свои, на заводе. В кармане носи, ментам не показывай.'; } },
        { ic: '💊', name: '«Метан» — курс для себя', desc: '+25 ед. Физкультура, +20 к здоровью', once: true, max: (S.sk.sense || 0) >= 3 || S.flags.methCourse >= 2 ? 0 : 1, price: pr(9), buy() { S.flags.methCourse = (S.flags.methCourse || 0) + 1; S.sk.sense = Math.min(3, (S.sk.sense || 0) + 1); S.maxHp = Math.min(160, (S.maxHp || 100) + 20); S.hp = S.maxHp; if (W) W.P.hp = S.hp; sfx.fanfare(); return 'По таблетке утром и вечером, и гирю не бросай. Печень потом спасибо не скажет, но это потом.'; } },
        { ic: '💊', name: '«Метан» — упаковка на продажу', desc: 'качкам из-под полы', unit: 'уп.', price: hp('anabol'), max: 6, buy(n) { addHid('anabol', n); rep('street', 1); return 'Толкай спортсменам, у них деньги есть.'; } },
        { ic: '🍾', name: 'Спирт «Royal» 96°, 1 л', desc: 'из-под полы', unit: 'бут.', price: hp('royal'), max: 12, buy(n) { addHid('royal', n); return 'Голландский. Разбавлять один к двум, не жадничай.'; } },
        { ic: '🚬', name: 'Сигареты контрабандные', desc: 'блок, 10 пачек', unit: 'блок', price: hp('kontra'), max: 8, buy(n) { addHid('kontra', n); return 'Без накладных, сам понимаешь. На витрину не клади.'; } },
        { ic: '📼', name: 'Кассета VHS без обложки', desc: 'боевики, «для взрослых»', unit: 'шт.', price: hp('vhs'), max: 5, buy(n) { addHid('vhs', n); return 'Перевод гнусавый, зато свежак.'; } },
      ],
      extra: [{ label: 'Что слышно в районе?', say: () => pick([`Заводские опять по ларькам ходят. ${S.rep.street >= 30 ? 'Тебя не тронут — ты свой.' : 'Смотри в оба.'}`, 'На мясокомбинате зарплату тушёнкой дают — мужики её за бутылку отдают.', 'Бугра из «Чайников» закрыли в ИВС. Говорят, свои же сдали.', 'Патрули с девяти утра и до шести. Я поэтому тут на рассвете.', 'Сизого знаешь? Щипач старый. Сидит сейчас, но руки золотые — научит, если попросишь.']) }] });
    return; }
  const streetDisc = S.rep.street >= 25 ? .78 : 1.0;
  const knuckPrice = Math.round(usdToRub(12) * streetDisc);
  const anabolPrice = Math.round(usdToRub(9) * streetDisc);
  const royalPrice = Math.round(usdToRub(8) * streetDisc);
  showDialog({ name: 'Марат (Оружие, кастеты и запретка за гаражами)', text: S.gunState === 'wall' && !S.flags.maratMet ? 'Ты с ларька дяди Толи? У меня для ровных пацанов всё есть: патроны к дедовской двустволке, свинцовый кастет для разборок, «Метан» для качков и литровый спирт «Royal». ' + (S.rep.street >= 25 ? 'Тебе как авторитетному человеку — скидка 22%!' : '') : `Здорово, брат! Патроны в наличии (${have} шт., 5 шт. — ${fmt(price5)} ₽), плюс кастеты и товар для своих. Что берёшь?`, options: [
    { label: `🔫 Пачку патронов (5 шт.) — ${fmt(price5)} ₽`, fn() { buy(5); } },
    { label: `🔫 Две пачки патронов (10 шт.) — ${fmt(price5 * 2)} ₽`, fn() { buy(10); } },
    ...(!(S.flags && S.flags.hasBrassKnuckles) ? [{
      label: `🥊 Купить свинцовый кастет (${fmt(knuckPrice)} ₽) — урон в драке ×2 и запугивание гопников!`,
      fn() {
        if (S.money < knuckPrice) { toast('Не хватает наличных на кастет!', 'bad'); return; }
        S.money -= knuckPrice;
        S.flags = S.flags || {};
        S.flags.hasBrassKnuckles = true;
        rep('street', 4);
        sfx.ching(); renderHud(); save();
        toast('Вы купили у Марата тяжёлый свинцовый кастет! Урон в кулачном бою удвоен!', 'good');
        maratTalk();
      }
    }] : []),
    {
      label: `💊 Взять курс «Метана» (Анаболики, ${fmt(anabolPrice)} ₽) — +25 ед. к Физкультуре или на продажу`,
      fn() {
        if (S.money < anabolPrice) { toast('Не хватает денег!', 'bad'); return; }
        S.money -= anabolPrice;
        showDialog({
          name: 'Марат',
          text: 'Держи заводской блистер «Метандростенолона». Можешь сам пропить курс для взрывной силы (+25 ед. Физкультура и +20 к макс. здоровью) или толкать качкам из-под полы в ларьке втридорога!',
          options: [
            {
              label: '💪 Принять курс самому (+25 ед. Физкультура, +20 макс. HP)',
              fn() {
                S.sk.sense = Math.min(3, (S.sk.sense || 0) + 1);
                S.maxHp = Math.min(160, (S.maxHp || 100) + 20);
                S.hp = S.maxHp;
                if (W && W.P) W.P.hp = S.hp;
                sfx.fanfare && sfx.fanfare();
                toast('Сила в руках выросла! Физкультура повышена, здоровье ' + S.maxHp + ' HP!', 'good');
                save(); renderHud(); done();
              }
            },
            {
              label: '📦 Спрятать 3 упаковки под прилавок для перепродажи',
              fn() {
                S.hidden = S.hidden || {};
                S.hidden.anabol = (S.hidden.anabol || 0) + 3;
                rep('street', 2);
                sfx.coin(); save(); renderHud();
                toast('3 упаковки анаболиков спрятаны под прилавок!', 'good');
                done();
              }
            }
          ]
        });
      }
    },
    {
      label: `🍾 Взять 3 литра спирта «Royal» и пиратскую VHS из-под полы (${fmt(royalPrice)} ₽)`,
      fn() {
        if (S.money < royalPrice) { toast('Не хватает денег!', 'bad'); return; }
        S.money -= royalPrice;
        S.hidden = S.hidden || {};
        S.hidden.royal = (S.hidden.royal || 0) + 3;
        S.hidden.vhs = (S.hidden.vhs || 0) + 1;
        rep('street', 3);
        sfx.coin(); save(); renderHud();
        toast('Получено 3 бут. спирта «Royal» и пиратская VHS под прилавок! (Улица +3)', 'good');
        done();
      }
    },
    { label: 'Что слышно в районе?', fn() { showDialog({ name: 'Марат', text: pick([`Заводские опять по ларькам ходят. ${S.rep.street >= 30 ? 'Но тебя не тронут — ты свой, авторитетный.' : 'Смотри в оба, или кастет с двустволкой держи наготове.'}`, 'На Мясокомбинате работяги колбасу за полцены и за самогон отдают, только без холодильника «ЗИЛ» она за два дня протухнет!', 'Через «Посылторг» по телефону 4-19-92 можно японские видики и кожанки под богатых клиентов заказывать.', 'В СИЗО сейчас Бугор из «Чайников», Айнур, Сизый и Жека-снабженец сидят — с ними не пропадёшь.']), options: [{ label: 'Ясно', fn: () => maratTalk() }] }); } },
    { label: 'Бывай', fn: done },
  ] });
  S.flags.maratMet = true;
}
// --- телефон: атмосферный звонок с гудками ---
let callBusy = false;
function phoneCall() {
  if (callBusy || !W) return;
  const o = orderSum(false), oh = orderSum(true);
  showDialog({ name: 'Дисковый телефон на прилавке', text: 'Кому звонить? Номера поставщиков записаны в блокноте и на обоях карандашом:', options: [
    { label: `📦 База «Оптторг» (3-17-40)${o.n ? ` — заказ: ${o.n} шт, ${fmt(o.total)} ₽` : ''}`, fn() { closeDialog(); dial('opt'); } },
    { label: `📮 Каталог «Посылторг» (4-19-92) — импортный дефицит, видики, кожанки, лекарства`, fn() { closeDialog(); dial('posyl'); } },
    { label: `🕵️ Вова с вокзала (2-28-15)${oh.n ? ` — нелегал: ${oh.n} шт, ${fmt(oh.total)} ₽` : ''}`, fn() { closeDialog(); dial('vova'); } },
    { label: '☎️ Справочная 09 — курс доллара и сводка цен', fn() { closeDialog(); dial('info'); } },
    { label: 'Положить трубку', fn() { closeDialog(); } },
  ] });
}
const PHONE_NUM = { opt: '31740', posyl: '41992', vova: '22815', info: '09' };
const PHONE_NAME = { opt: '«Оптторг»', posyl: '«Посылторг»', vova: 'Вова', info: 'Справочная' };
function dial(who) {
  callBusy = true; W.P.locked = true; W.life.startCall(); renderControls();
  // на экране видно, что идёт звонок, — и всегда можно положить трубку
  const num = PHONE_NUM[who] || '09', pretty = num.length > 3 ? num.replace(/(\d)(\d\d)(\d\d)$/, '$1-$2-$3') : num;
  showDialog({ name: 'Телефон', text: `Снимаете трубку… набираете ${pretty} (${PHONE_NAME[who] || ''})`, options: [{ label: 'Положить трубку', fn: hangUp }] });
  setTimeout(() => { if (!callBusy) return; audio.tone425(true); }, 700); // трубка у уха — длинный гудок
  setTimeout(() => { if (!callBusy) return; audio.tone425(false);
    W.life.dialNumber(PHONE_NUM[who] || '09', () => { if (!callBusy) return; // диск отщёлкал номер — пошли вызовы
      audio.tone425(true, 'ring');
      showDialog({ name: 'Телефон', text: `Длинные гудки… ${PHONE_NAME[who] || ''}`, options: [{ label: 'Положить трубку', fn: hangUp }] });
      const rings = who === 'vova' && (S.phase === 'trade') && Math.random() < .5 ? 99 : 1;
      setTimeout(() => { if (!callBusy) return; audio.tone425(false); if (rings > 3) { audio.tone425(true, 'busy'); showDialog({ name: 'Телефон', text: 'Никто не берёт. Вова днём на вокзале, звони вечером.', options: [{ label: 'Положить трубку', fn: hangUp }] }); return; } audio.click(800, .5, 0, .05); talk(who); }, rings > 3 ? 7000 : 2600);
    });
  }, 1200);
}
function hangUp() { closeDialog(); audio.tone425(false); audio.click(400, .7, 0, .06); audio.tone425(true, 'busy'); setTimeout(() => audio.tone425(false), 1800); W.life.hangUp(); W.P.locked = false; callBusy = false; renderControls(); }
function talk(who) {
  if (who === 'info') { showDialog({ name: 'Справочная 09', text: `Курс доллара на сегодня — ${fmt(S.rate)} рублей. Спасибо за звонок.`, options: [{ label: 'Спасибо', fn: hangUp }] }); return; }
  if (who === 'posyl') {
    const discZheka = (S.flags && S.flags.zhekaSupplyBonus) ? .85 : 1.0;
    const POSYL_EQUIP = ['tv', 'fridge', 'sharp', 'sign', 'pavilion'].filter(k => UPGRADES[k] && !S.up[k] && (!UPGRADES[k].from || S.day >= UPGRADES[k].from));
    const SPEC_ORDERS = [
      { id: 'vcr',     title: 'Японский видеомагнитофон «Funai VIP-5000» (под заказ «Нового русского»)', usd: 35 },
      { id: 'leather', title: 'Турецкая кожаная куртка и джинсы «Montana» (под заказ челнока)',          usd: 22 },
      { id: 'adidas',  title: 'Кроссовки «Adidas Torsion» и кассетный плеер «Sony Walkman»',             usd: 16 },
      { id: 'insulin', title: 'Партия импортных антибиотиков и инсулина (под заказ горбольницы)',         usd: 12 },
    ];
    const boxCoffeeCost = Math.round(usdToRub(7) * discZheka);
    showDialog({
      name: '📮 Центральная база «Посылторг» (тел. 4-19-92)',
      text: `Диспетчер «Посылторга» на линии! ${S.flags && S.flags.zhekaSupplyBonus ? 'По знакомству от снабженца Жеки из СИЗО для вас действует скидка 15%! ' : ''}У нас можно заказать технику и улучшения для ларька (телевизор «Рубин» с видеомагнитофоном VHS, холодильник «ЗИЛ-Москва», двухкассетник «Sharp WF-939», неоновую вывеску), выписать посылку с дефицитом на витрину или оформить спецзаказ под клиента:`,
      options: [
        ...POSYL_EQUIP.map(k => {
          const u = UPGRADES[k];
          const cost = Math.round(usdToRub(u.usd) * discZheka);
          return {
            label: `${u.icon} Заказать в ларёк: ${u.name} — ${fmt(cost)} ₽ (${u.desc})`,
            fn() {
              if (S.money < cost) {
                showDialog({ name: '«Посылторг»', text: `Не хватает наличных (нужно ${fmt(cost)} ₽).`, options: [{ label: 'Перезвоню позже', fn: hangUp }] });
                return;
              }
              S.money -= cost;
              S.up[k] = true;
              if (k === 'pavilion') {
                S.slots = S.slots.concat([null, null, null]).slice(0, 9);
                sfx.fanfare && sfx.fanfare();
              } else {
                sfx.ching();
              }
              save(); renderHud();
              showDialog({
                name: '«Посылторг»',
                text: `Заказ оформлен и доставлен экспедитором! В вашем ларьке установлено: «${u.name}».`,
                options: [{ label: 'Отлично, спасибо!', fn: hangUp }]
              });
            }
          };
        }),
        {
          label: `☕ Посылка на витрину: Индийский чай, кофе, 5 кассет TDK и 5 журналов (${fmt(boxCoffeeCost)} ₽)`,
          fn() {
            if (S.money < boxCoffeeCost) { showDialog({ name: '«Посылторг»', text: `В кассе не хватает средств (нужно ${fmt(boxCoffeeCost)} ₽).`, options: [{ label: 'Положить трубку', fn: hangUp }] }); return; }
            S.money -= boxCoffeeCost;
            const contents = {
              choc: [5, Math.round(GOODS.choc.base * S.idx * .7)],
              tape: [5, Math.round(GOODS.tape.base * S.idx * .7)],
              mag:  [5, Math.round(GOODS.mag.base * S.idx * .7)],
            };
            const etaH = R(.35, .65);
            S.deliveries = S.deliveries || [];
            S.deliveries.push({ contents, hidden: false, label: '«Посылторг»', etaHours: etaH, eta: etaH * 90, state: 'way' });
            sfx.coin(); save(); renderHud();
            showDialog({ name: '«Посылторг»', text: 'Посылка с дефицитом оформлена! Почтовый фургон доставит коробку к дверям вашего ларька в течение часа.', options: [{ label: 'Отлично, жду!', fn: hangUp }] });
          }
        },
        ...SPEC_ORDERS.map(sp => {
          const rubCost = Math.round(usdToRub(sp.usd) * discZheka);
          return {
            label: `💎 Спецзаказ под клиента: ${sp.title} — ${fmt(rubCost)} ₽ (выкуп завтра за +${fmt(Math.round(rubCost * 1.78))} ₽!)`,
            fn() {
              if (S.posylSpecialOrder) {
                showDialog({ name: '«Посылторг»', text: `У вас уже идёт доставка спецзаказа (${S.posylSpecialOrder.title}). Дождитесь завтрашнего выкупа клиентом!`, options: [{ label: 'Понял', fn: hangUp }] });
                return;
              }
              if (S.money < rubCost) {
                showDialog({ name: '«Посылторг»', text: `Для выкупа со склада нужно ${fmt(rubCost)} ₽ предоплаты.`, options: [{ label: 'Перезвоню позже', fn: hangUp }] });
                return;
              }
              S.money -= rubCost;
              S.posylSpecialOrder = { id: sp.id, title: sp.title, cost: rubCost, readyDay: S.day + 1 };
              sfx.ching(); save(); renderHud();
              showDialog({ name: '«Посылторг»', text: `Спецзаказ «${sp.title}» забронирован! Завтра утром клиент заберёт заказ у вашего ларька и заплатит ${fmt(Math.round(rubCost * 1.78))} ₽ наличными!`, options: [{ label: 'Договорились!', fn: hangUp }] });
            }
          };
        }),
        { label: 'Положить трубку', fn: hangUp }
      ]
    });
    return;
  }
  const hidden = who === 'vova', o = orderSum(hidden);
  const name = hidden ? 'Вова' : '«Оптторг»';
  if (!o.n) { showDialog({ name, text: hidden ? 'Ну? Чего молчишь? Надо чего — так записывай и звони.' : 'База «Оптторг», слушаю. Заказ готов? Нет? Тогда не занимайте линию.', options: [{ label: 'Извините, перезвоню', fn: hangUp }] }); return; }
  showDialog({ name, text: hidden ? `Записал: ${o.n} шт. С тебя ${fmt(o.total)}. Деньги — на месте, коробку под дверь поставлю.` : `Слушаю. Значит, ${o.n} единиц товара на ${fmt(o.sum)} и доставка ${fmt(o.deliv)}. Итого ${fmt(o.total)} рублей. Подтверждаете?`, options: [
    { label: `Подтвердить (${fmt(o.total)} р.)`, fn() {
      if (S.money < o.total) { showDialog({ name, text: 'Денег-то хватит? Касса не сходится. Перезвоните, когда будет.', options: [{ label: 'Положить трубку', fn: hangUp }] }); return; }
      S.money -= o.total;
      const src = hidden ? S.order.hidden : S.order.lines, contents = {};
      for (const [k, q] of Object.entries(src)) if (q) contents[k] = [q, lineInfo(hidden ? 'h:' + k : k).unit];
      const etaH = R(.48, .92); S.deliveries = S.deliveries || []; S.deliveries.push({ contents, hidden, label: name, etaHours: etaH, eta: etaH * 90, state: 'way' });
      if (hidden) S.order.hidden = {}; else S.order.lines = {};
      if (hidden) rep('street', 1);
      save(); renderHud(); sfx.coin();
      showDialog({ name, text: hidden ? 'Добро. Жди, постучу.' : 'Заказ принят. Машина будет в течение часа. Постучат в дверь.', options: [{ label: 'Положить трубку', fn: hangUp }] });
    } },
    { label: 'Нет, отбой', fn: hangUp },
  ] });
}
function onDelivered(d, boxCount = 1) {
  if (boxCount > 1) toast(`Тук-тук! Привезли заказ — у двери ${boxCount} кор.`, 'good');
  else toast('Тук-тук! Привезли заказ — коробка у двери.', 'good');
}
function onUnpack(data) {
  gainSkillXp('sense', 18, ''); gainSkillXp('trade', 12, '');
  const c = (data && data.contents) || {};
  for (const [k, [q, unit]] of Object.entries(c)) {
    if (k.startsWith('outfit:')) {
      const id = k.slice(7);
      if (!S.owned.includes(id)) S.owned.push(id);
      toast('Обновка: ' + OUTFITS[id].name + ' (надеть — меню → Герой)', 'good');
    }
    if (k.startsWith('up:')) {
      const id = k.slice(3);
      S.up[id] = true;
      if (UPGRADES[id]) toast('Установлено в ларьке: ' + UPGRADES[id].name + '!', 'good');
    }
  }
  sfx.ching();
  if (data && data.spawnedPacks > 0) {
    const extraTxt = data.extraBoxes > 0 ? ` (остальное в ${data.extraBoxes} соседн. кор.)` : '';
    toast(`Коробка открыта! Внутри ${data.spawnedPacks} уп.${extraTxt} — доставайте блоки по одному.`, 'good');
  } else {
    toast('Коробка открыта!', 'good');
  }
  save(); render();
}
const hiddenCount = () => Object.values(S.hidden || {}).reduce((a, b) => a + b, 0);
// предложение из-под полы — часть разговора с покупателем
function offerHidden() {
  const c = T && T.cur; if (!c || c.special) return;
  const opts = Object.entries(S.hidden).filter(([, q]) => q > 0).map(([k]) => ({ label: `${HIDDEN[k].name} — ${fmt(hiddenPrice(k) * 1.9)} р.`, fn() { closeDialog(); hiddenReact(c, k); } }));
  showDialog({ name: c.name, text: 'Вы наклоняетесь к окошку и вполголоса: «Есть кое-что, не для всех…»', options: [...opts, { label: 'Да нет, ничего', fn: closeDialog }] });
}
function hiddenReact(c, k) {
  const chance = {
    worker:  { samogon: .85, kontra: .70, royal: .88, anabol: .45, vhs: .50 },
    chelnok: { samogon: .45, kontra: .88, royal: .75, anabol: .65, vhs: .75 },
    newrus:  { samogon: .25, kontra: .55, royal: .60, anabol: .90, vhs: .92 },
    babka:   { samogon: .40, kontra: .15, royal: .30, anabol: .05, vhs: .05 },
    student: { samogon: .55, kontra: .65, royal: .75, anabol: .75, vhs: .90 },
    school:  { samogon: 0,   kontra: 0,   royal: 0,   anabol: 0,   vhs: 0   }
  }[c.k] || { samogon: .4, kontra: .4, royal: .5, anabol: .4, vhs: .5 };
  const tradeLv = (S.sk && S.sk.trade) || 0;
  const price = Math.round(hiddenPrice(k) * (1.9 + tradeLv * .15));
  if (c.k === 'school') { rep('folk', -4); c.said = 'Дядь, вы чего?! Я мамке скажу!'; toast('Предлагать такое школьнику… Народ −4', 'bad'); renderTrade(); return; }
  // Механика «Стукач»: если уважение Народа низкое (< 0), покупатель может сдать милиции (до 22% риска); если Народ >= 25 — свои не сдают никогда (0%)!
  const snitchRisk = S.rep.folk >= 25 ? 0 : S.rep.folk < 0 ? .18 : .06;
  if (Math.random() < snitchRisk && S.rep.law < 45) {
    rep('law', -8);
    S.hidden[k]--;
    const fine = Math.min(S.money, usdToRub(10));
    S.money -= fine;
    c.said = S.rep.folk < 0 ? 'Ага, спекулянт! Я участковому на тебя доложил — вот и милиция!' : 'Милиция! Контрольная закупка.';
    toast(`${S.rep.folk < 0 ? 'Стукач сдал вас милиции из-за низкого уважения Народа!' : 'Контрольная закупка!'} Штраф ${fmt(fine)} ₽, товар изъят. Закон −8`, 'bad');
    T.cur = null; renderTrade(); renderHud(); return;
  }
  if (Math.random() < (chance[k] || .45) + S.rep.street / 250 + tradeLv * .08) {
    S.hidden[k]--; S.money += price; T.rev += price; rep('street', 1);
    c.said = pick(['Во, это дело! Давай сюда под куртку.', 'Только тихо… То что надо!', 'Беру без вопросов, коммерсант!', 'Ух, дефицитная вещь! Держи наличными.']);
    sfx.ching(); floatText('+' + fmt(price) + ' ₽'); if (W) W.customerEvent(c, 'sold'); renderHud(); setTimeout(() => { if (T && T.cur === c) { T.cur = null; renderTrade(); } }, 600);
  } else { c.said = pick(['Не, такого не надо.', 'Ты чего, у меня совесть есть.', 'Обойдусь.']); if (c.k === 'babka') rep('folk', -1); renderTrade(); }
}

// ============================================================
//  Настройки, звук, 3D-мир, управление, диалоги
// ============================================================
const SET_KEY = 'larek-settings-v1';
const isMob = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
const SET = Object.assign({ quality: isMob ? 'balanced' : 'high', custom: null, bob: 1, retro: 0, litter: 1, master: .9, radio: .7, ambience: .6, toasts: 2, showFps: 1, showDiag: 0, fpsCap: 60, vsync: 1, gfxVer: 237 }, (() => { try { const s = JSON.parse(localStorage.getItem(SET_KEY)) || {}; if (s.quality) s.quality = resolveQualityPreset(s.quality); if (s.gfxVer !== 237) { s.custom = null; s.lite = 2; s.fpsCap = s.fpsCap || 60; s.gfxVer = 237; } return s; } catch (e) { return {}; } })());
function saveSet() { try { localStorage.setItem(SET_KEY, JSON.stringify(SET)); } catch (e) {} }
const audio = createAudio();
['master', 'radio', 'ambience'].forEach(k => audio.setVolume(k, SET[k]));
let controls = null, worldReady = false, loadP = 0;
function say(p, text) { const n = (p && p.title) || { police: 'Сержант милиции', gopnik: 'Пацан', babka: 'Бабушка', dedushka: 'Дедушка Егор', worker: 'Мужик', youth: 'Парень', neighbor: 'Сосед' }[p && p.kind] || 'Прохожий'; toast(`${n}: «${text}»`); }
// диалоговое окно
let dlgTimer = null;
function showDialog({ name, text, options }) {
  dialogOpen = true; const el = $('#dialog'); el.classList.add('on');
  el.innerHTML = `<div class="dlg"><div class="dlg-name">${esc(name)}</div><div class="dlg-text"></div><div class="dlg-opts">${options.map((o, i) => `<button class="btn" data-dlg="${i}">${o.label}</button>`).join('')}</div></div>`;
  const tx = el.querySelector('.dlg-text'); let i = 0; clearInterval(dlgTimer);
  dlgTimer = setInterval(() => { i += 2; tx.textContent = '«' + text.slice(0, i) + (i < text.length ? '' : '»'); if (i >= text.length) clearInterval(dlgTimer); }, 28);
  tx.onclick = () => { clearInterval(dlgTimer); tx.textContent = '«' + text + '»'; };
  // защита от «сквозного» касания: кнопка, открывшая диалог, срабатывает по pointerdown, и отпускание пальца
  // иначе засчитывается варианту под ним. Вариант выбирается, только если нажатие на нём же и началось.
  const t0 = performance.now();
  el.querySelectorAll('[data-dlg]').forEach(b => {
    b.onpointerdown = () => { b._armed = performance.now() - t0 > 120; };
    b.onclick = e => { const ok = b._armed || (e.detail === 0 && performance.now() - t0 > 300); b._armed = false; if (!ok) return; sfx.click(); options[+b.dataset.dlg].fn(); };
  });
  renderControls();
}
function closeDialog() { dialogOpen = false; clearInterval(dlgTimer); const el = $('#dialog'); el.classList.remove('on'); setTimeout(() => { if (!dialogOpen) el.innerHTML = ''; }, 250); renderControls(); }
function gopnikDemand(g) {
  if (W && W.faceNpc && g && g.leader) W.faceNpc(g.leader);
  const ask = Math.max(usdToRub(3), Math.round(S.money * .12)), lead = g.leader.h.L;
  sfx.bad();
  const intLv = (S.sk && S.sk.charm) || 0;
  const hasKnuck = !!(S.flags && S.flags.hasBrassKnuckles);
  showDialog({ name: 'Гопник («Заводские»)', text: pick(['Слышь, коммерсант, за крышу платить пора! Делись, не жмись.', 'Ты чё, не понял? Бабки на общак гони, сказал.', 'Здорово. С тебя взнос за спокойную торговлю на Советской.', 'Сигареты и выручка есть? А если найду?']), options: [
    ...(intLv >= 1 ? [{
      label: `🧠 [Интеллект ${intLv * 25 + 25}/100] Заболтать зубы по понятиям («Я от Бугра из Чайников, вопрос решён!»)`,
      fn() {
        closeDialog();
        rep('street', 3);
        W.gopLeave(g, 'paid');
        toast('Вы уверенно загрузили гопников именами авторитетов — они извинились и ретировались! (Улица +3)', 'good');
        render();
      }
    }] : []),
    ...(hasKnuck ? [{
      label: '🥊 Надеть свинцовый кастет Марата и пригрозить проломить челюсть!',
      fn() {
        closeDialog();
        rep('street', 4);
        W.gopLeave(g, 'flee');
        toast('Увидев свинцовый кастет на вашем кулаке, гопник попятился и дал дёру! (Улица +4)', 'good');
        render();
      }
    }] : []),
    { label: `Отдать ${fmt(ask)} ₽`, fn() { closeDialog(); const k = Math.min(S.money, ask); S.money -= k; rep('street', 2); W.gopLeave(g, 'paid'); toast(`Отдали ${fmt(k)} ₽. Пацаны довольны.`); render(); } },
    { label: 'Нету у меня ничего', fn() { closeDialog(); if (lead.aggression > .72 && !W.weapon.drawn) { const take = Math.round(S.money * .2); S.money -= take; rep('street', -3); sfx.bad(); toast(`Вас прижали к стенке и забрали ${fmt(take)} ₽`, 'bad'); W.gopLeave(g, 'paid'); } else { say(g.leader, pick(['Ну смотри, ещё встретимся.', 'Ладно, живи пока.'])); W.gopLeave(g, 'back'); } render(); } },
    ...(!W.weapon.drawn ? [{ label: '🥊 Дать в морду (кулачный бой)', fn() { closeDialog(); W.startGopBrawl(g); W.punch(); toast('Кулачный бой! Бейте кнопкой «Ударить»!', 'good'); } }] : []),
    ...(S.gun ? [{ label: '🔫 Достать ружьё', fn() { closeDialog(); W.weapon.draw(); toast('Наведите ружьё на них. Стрелять не обязательно.'); } }] : []),
    ...((S.fakeBills || 0) > 0 ? [{ label: `💵 Всучить припрятанную фальшивку (ост. ${S.fakeBills} шт.)`, fn() { closeDialog(); S.fakeBills--; rep('street', 2); sfx.coin(); W.gopLeave(g, 'paid'); toast('Гопники схватили фальшивую купюру и довольные ушли в темноту!', 'good'); render(); } }] : []),
    { label: 'Позвать милицию', fn() { closeDialog(); if (S.rep.law >= 10) { rep('law', 2); rep('street', -5); W.gopLeave(g, 'flee'); toast('Свисток участкового — гопники разбежались', 'good'); } else { say(g.leader, 'Ха! Какая тебе милиция?'); } } },
  ] });
}
function syncAmmoToWeapon() { if (!W || !S) return; W.weapon.ammo = S.ammo ?? 2; W.weapon.reserve = S.shells ?? 4; if (!S.gun && W.weapon.forceHolster) W.weapon.forceHolster(); }
function syncAmmoFromWeapon() { if (!W || !S) return; S.ammo = W.weapon.ammo; S.shells = W.weapon.reserve; }
function look(dx, dy, kind) { if (controls && kind !== 'mouse') controls.look(dx, dy); else W && W.look(dx, dy, kind); }

function clearPlayerWantedState(clearKills = false) {
  if (!S) return;
  if (clearKills && S.flags) S.flags.kills = 0;
  if (S.npcMemory && S.npcMemory.crimes) {
    if (clearKills) S.npcMemory.crimes.kills = 0;
    S.npcMemory.crimes.brawls = 0;
    S.npcMemory.crimes.gunAimed = 0;
  }
  if (W && W.debug && W.debug.people) {
    for (const p of W.debug.people) {
      p.brawling = false;
      p.approachingPlayer = false;
      p.investigatePlayer = false;
      p.sawCrimeDirect = false;
      p.crimeIsMurder = false;
      if (p.memory) {
        if (clearKills) p.memory.sawKill = false;
        p.memory.sawBody = false;
        p.memory.sawBrawl = false;
        p.memory.sawGunAim = false;
      }
    }
  }
}

function advanceJailSentence(isMurder) {
  if (!S) return;
  if (T) { T = null; if (W) W.unlock(); }
  if (isMurder) {
    // 2 года игрового времени (24 месяца)
    for (let m = 0; m < 24; m++) {
      S.day++;
      const infl = R(.05, .09);
      S.inflLast = infl;
      S.idx *= 1 + infl;
      S.rate = Math.round(S.rate * (1 + infl + R(-.02, .03)));
      S.rateHist.push(S.rate);
      if (S.rateHist.length > 30) S.rateHist.shift();
    }
    S.free = true; // сюжетные ограничения сняты после отсидки 2 лет
    genPrices();
  } else {
    // 15 суток ареста в КПЗ
    S.day++;
    const infl = R(.06, .11);
    S.inflLast = infl;
    S.idx *= 1 + infl;
    S.rate = Math.round(S.rate * (1 + infl + R(-.02, .03)));
    S.rateHist.push(S.rate);
    if (S.rateHist.length > 30) S.rateHist.shift();
    genPrices();
  }
  S.hp = S.maxHp || 100;
  S.phase = 'morning';
  if (W) {
    W.P.hp = S.hp;
    W.P.x = 0; W.P.z = -.25; W.P.yaw = Math.PI; W.P.pitch = -.08;
    W.P.seated = false; W.P.locked = false;
    W.updateShelves();
  }
  clearPlayerWantedState(true);
  save();
  render();
}

function openJailCellModal(wasMurder, signedProtocol = true) {
  if (!S) return;
  const hasMurder = !!(wasMurder || (S.flags && S.flags.kills > 0) || (S.npcMemory && S.npcMemory.crimes && S.npcMemory.crimes.kills > 0));
  const guardBribeRub = hasMurder ? usdToRub(80) : Math.max(400, usdToRub(5));
  const guardBribeUsd = hasMurder ? 20 : 5;
  const canPayRub = S.money >= guardBribeRub;
  const canPayUsd = (S.usd || 0) >= guardBribeUsd;
  const termText = hasMurder ? '2 года лишения свободы (исправительная колония)' : '15 суток административного ареста (КПЗ РОВД)';

  queueCard({
    title: hasMurder ? '🔒 Камера СИЗО / КПЗ (Срок: 2 года)' : '🔒 Камера КПЗ Заводского РОВД (Срок: 15 суток)',
    html: `<div class="card" style="background:#141819;border-color:#4a5456;font-size:13px;line-height:1.45;">
        <div style="color:#d4a72c;font-weight:700;text-transform:uppercase;margin-bottom:4px;">${signedProtocol ? 'Протокол подписан · Вы под стражей' : 'Отказ от подписи зафиксирован понятыми · Вы в камере'}</div>
        <p style="margin:4px 0;">За железной дверью гудит тусклая лампочка. Назначенный срок: <b>${termText}</b>.</p>
        <p style="margin:6px 0 2px;" class="muted">Ночью в отделении остаётся только один сонный дежурный прапорщик, а в углу камеры под потолком видна старая вентиляционная решётка со ржавыми болтами…</p>
      </div>`,
    buttons: [
      ...(canPayRub ? [{
        label: `💸 Подкупить дежурного прапорщика (${fmt(guardBribeRub)} ₽) — тихо выйти через двор`,
        cls: 'yellow',
        fn() {
          S.money -= guardBribeRub;
          clearPlayerWantedState(true);
          rep('law', -2);
          sfx.ching();
          toast('Прапорщик пересчитал купюры, отпер калитку внутреннего двора и махнул рукой: «Дуй отсюда тихо!»', 'good');
          save(); render();
        }
      }] : []),
      ...(canPayUsd ? [{
        label: `💵 Сунуть дежурному валюту ($${guardBribeUsd}) — выйти ночью без протокола`,
        cls: 'yellow',
        fn() {
          S.usd -= guardBribeUsd;
          clearPlayerWantedState(true);
          rep('law', -2);
          sfx.ching();
          toast(`Дежурный спрятал $${guardBribeUsd} в китель и выпустил вас через чёрный ход РОВД!`, 'good');
          save(); render();
        }
      }] : []),
      {
        label: '🛠 Открутить ложкой ржавую решётку вентиляции и сбежать ночью через крышу',
        cls: 'green',
        fn() {
          clearPlayerWantedState(false);
          rep('street', 6);
          rep('law', -8);
          sfx.door();
          toast('Ночью вы выдавили вентиляционную решётку, выбрались на козырёк РОВД и спрыгнули в сугроб! Побег удался! Улица +6', 'good');
          save(); render();
        }
      },
      {
        label: '🥊 Позвать конвоира («Начальник, плохо с сердцем!»), вырубить его и бежать с ключами',
        cls: 'red',
        fn() {
          clearPlayerWantedState(false);
          rep('street', 10);
          rep('law', -14);
          sfx.bad();
          toast('Вы оглушили вошедшего дежурного, забрали связку ключей и вырвались на свободу! Улица +10, Закон −14', 'good');
          save(); render();
        }
      },
      {
        label: hasMurder
          ? '⏳ Отсидеть весь срок (2 года игрового времени) и выйти по закону'
          : '⏳ Честно отсидеть 15 суток в КПЗ и выйти с чистой совестью',
        fn() {
          advanceJailSentence(hasMurder);
          queueCard({
            title: hasMurder ? '🌅 Выход на свободу (спустя 2 года)' : '🌅 Освобождение из КПЗ (спустя 15 суток)',
            html: hasMurder
              ? `<p>Прошло <b>2 года</b> игрового времени (${dateStr(S.day)}). Вы отбыли срок от звонка до звонка и вернулись в Краснозаводск к своему ларьку.</p><p class="muted">Все обвинения сняты, курс доллара за это время вырос до ${fmt(S.rate)} ₽.</p>`
              : `<p>Прошло <b>15 суток</b> административного ареста. Дежурный вернул вам личные вещи и открыл ворота отделения.</p><p class="muted">Претензий у милиции больше нет — пора возвращаться к торговле в ларьке.</p>`,
            buttons: [{ label: 'К ларьку!', cls: 'green' }]
          });
        }
      }
    ]
  });
}

function onArrivePoliceStation(wasMurder = false, mode = '') {
  if (!S) return;
  if (dialogOpen) closeDialog();
  if (sheetOpen) closeSheet();
  const hasMurder = !!(wasMurder || (S.flags && S.flags.kills > 0) || (S.npcMemory && S.npcMemory.crimes && S.npcMemory.crimes.kills > 0));
  if (mode === 'serve_now') {
    advanceJailSentence(hasMurder);
    queueCard({
      title: hasMurder ? '🌅 Выход на свободу (спустя 2 года)' : '🌅 Освобождение из КПЗ (спустя 15 суток)',
      html: hasMurder
        ? `<p>Прошло <b>2 года</b> игрового времени (${dateStr(S.day)}). Вы отбыли срок от звонка до звонка и вернулись в Краснозаводск к своему ларьку.</p><p class="muted">Все обвинения сняты, курс доллара за это время вырос до ${fmt(S.rate)} ₽.</p>`
        : `<p>Прошло <b>15 суток</b> административного ареста в Камере № 3 ИВС. Дежурный прапорщик Степанов вернул вам личные вещи и открыл ворота Заводского РОВД.</p><p class="muted">Претензий у милиции больше нет — пора возвращаться к торговле в ларьке.</p>`,
      buttons: [{ label: 'К ларьку!', cls: 'green' }]
    });
    return;
  }
  const deskBribeRub = hasMurder ? Math.max(3000, usdToRub(25)) : Math.max(600, usdToRub(6));
  const articleTxt = hasMurder
    ? 'ст. 103 УК РСФСР (Умышленное убийство) — мера наказания: 2 года лишения свободы'
    : 'ст. 158 КоАП РСФСР / ст. 206 ч.1 УК РСФСР (Хулиганство и рукоприкладство) — мера наказания: 15 суток административного ареста';

  queueCard({
    title: '🚓 Заводской РОВД · Кабинет дознания',
    html: `<p>Патрульная машина с мигалками остановилась во дворе милицейского участка. Сержант завёл вас в дежурную часть и положил на стол бланк протокола.</p>
      <div class="card" style="background:#e8e3d3;color:#1b1a17;border:2px solid #2b2923;font-family:'Courier New',monospace;font-size:12px;line-height:1.38;">
        <div style="text-align:center;font-weight:700;border-bottom:1px solid #2b2923;padding-bottom:4px;margin-bottom:6px;">МВД РФ · ЗАВОДСКОЙ РОВД г. КРАСНОЗАВОДСКА<br>ПРОТОКОЛ ЗАДЕРЖАНИЯ № 92/${RI(110, 980)}</div>
        <div><b>Задержанный:</b> ${esc(S.name || 'Серёга')}, коммерческий киоск «Ларёк»</div>
        <div><b>Статья обвинения:</b> ${articleTxt}</div>
        <div><b>Основание:</b> явка с повинной / задержание нарядом ППС</div>
        <div style="margin-top:6px;border-top:1px dashed #444;padding-top:4px;">Подпись задержанного: _______________________</div>
      </div>
      <p class="muted">Следователь протягивает вам ручку: «Подписывай протокол, гражданин, и конвой отведёт тебя в камеру ${hasMurder ? 'на 2 года' : 'на 15 суток'}».</p>`,
    buttons: [
      {
        label: `✍️ Подписать протокол и пройти в камеру (${hasMurder ? '2 года' : '15 суток'})`,
        cls: 'yellow',
        fn() {
          sfx.click();
          toast('Вы подписали протокол. Конвоир увёл вас по коридору в камеру…');
          setTimeout(() => openJailCellModal(hasMurder, true), 0);
        }
      },
      {
        label: '🙅 Отказаться подписывать («Без адвоката ничего подписывать не буду!»)',
        fn() {
          sfx.bad();
          toast('Следователь вызвал двух понятых, зафиксировал отказ от подписи и отправил вас в камеру.');
          setTimeout(() => openJailCellModal(hasMurder, false), 0);
        }
      },
      ...(S.money >= deskBribeRub ? [{
        label: `💵 Замять дело у следователя пока протокол не в журнале (${fmt(deskBribeRub)} ₽)`,
        cls: 'green',
        fn() {
          S.money -= deskBribeRub;
          clearPlayerWantedState(true);
          rep('law', 2);
          sfx.ching();
          toast('Следователь молча порвал черновик протокола: «Свободен, коммерсант. И больше не попадайся!»', 'good');
          save(); render();
        }
      }] : [])
    ]
  });
}

// Сейф — это полка. Здесь только «достать из кармана / из-под прилавка в руку»; дальше вещь ставится на полку сейфа руками.
const SAFE_BOX = it => { const p = it && it.obj && it.obj.position; return !!p && p.x > 1.44 && p.x < 1.68 && p.z > -.84 && p.z < -.20 && p.y > .88 && p.y < 1.38; };
const safeItems = () => (W && W.life ? W.life.items.filter(it => it.state === 'rest' && SAFE_BOX(it)) : []);
const looseCash = kind => (W && W.life ? W.life.items.filter(it => it.kind === 'good' && it.data && (it.data.goodId === kind || (kind === 'cash' && it.data.goodId === 'coin'))).reduce((a, it) => a + (it.data.amount || 0), 0) : 0);
function takeToHand(goodId, amount) {
  if (!W || W.life.held) { toast('Руки заняты — сначала поставьте то, что держите.'); return false; }
  const P = W.P, it = W.life.addItem({ kind: 'good', x: P.x, y: 1.25, z: P.z, ry: 0, data: amount != null ? { goodId, amount } : { goodId } });
  W.life.pick(it); W.life.persist && W.life.persist(); return true;
}
const MAX_POCKET_SLOTS = 10;

function isHeldItemPocketable(h) {
  if (!h) return false;
  if (W && W.carryKb) return false;
  if (h.kind === 'box' || h.kind === 'pack' || h.kind === 'gun') return false; // Крупные ящики, упаковки и двустволка в карман не влезают
  if (h.kind === 'bottle') return true;
  const NON_POCKETABLE = [
    'stool', 'chair_item', 'armchair_item', 'coffee_table', 'nightstand_item',
    'tv_rubin', 'cassette_player', 'guitar', 'potR', 'potW', 'potG', 'pan',
    'bowl', 'kettle', 'jar', 'breadbox', 'flowerpot', 'bucket', 'vase', 'plate',
    'pillow', 'blanket', 'globe', 'chess', 'shoe'
  ];
  if (h.kind === 'good' && h.data && NON_POCKETABLE.includes(h.data.goodId)) return false; // Мебель и крупные предметы нельзя положить в карман!
  if (h.kind === 'good' && h.data) return true; // Мелкие предметы (ключи, будильник Витязь, книга, кассета, пачка сигарет, еда, деньги) помещаются в карман
  return false;
}

function pocketHeld() {
  if (!S || !W) return;
  const h = W.life.held;
  if (!h) return;
  if (!isHeldItemPocketable(h)) {
    sfx.bad && sfx.bad();
    toast(h.kind === 'pack' ? 'Целая упаковка в карман не влезет — достаньте одну штуку.' : 'Этот предмет слишком крупный — в карман не поместится!', 'bad');
    return;
  }
  S.pockets = Array.isArray(S.pockets) ? S.pockets : [];
  const curItems = buildPocketWheelList();
  const curCount = curItems.length;

  if (h.kind === 'good' && h.data) {
    const id = h.data.goodId;
    if (id === 'cash' || id === 'coin') {
      const hasRubSlot = (S.money || 0) > 0;
      if (!hasRubSlot && curCount >= MAX_POCKET_SLOTS) {
        sfx.bad && sfx.bad();
        toast('Карманы полны (10 / 10 предметов)! Сначала освободите место.', 'bad');
        return;
      }
      const amt = h.data.amount || (id === 'coin' ? 5 : 100);
      S.money = (S.money || 0) + amt;
      W.life.removeItem(h); W.life.persist && W.life.persist();
      sfx.coin(); save(); renderHud(); renderControls();
      toast(`Убрали в карман: ${fmt(amt)} ₽ (${buildPocketWheelList().length}/${MAX_POCKET_SLOTS})`, 'good');
      return;
    }
    if (id === 'usd') {
      const hasUsdSlot = (S.usd || 0) > 0;
      if (!hasUsdSlot && curCount >= MAX_POCKET_SLOTS) {
        sfx.bad && sfx.bad();
        toast('Карманы полны (10 / 10 предметов)! Сначала освободите место.', 'bad');
        return;
      }
      const amt = h.data.amount || 10;
      S.usd = (S.usd || 0) + amt;
      W.life.removeItem(h); W.life.persist && W.life.persist();
      sfx.coin(); save(); renderHud(); renderControls();
      toast(`Убрали в карман: $${fmt(amt)} (${buildPocketWheelList().length}/${MAX_POCKET_SLOTS})`, 'good');
      return;
    }
    if (id === 'cig' || id === 'kontra') {
      const hasCigSlot = (S.cigs || 0) > 0;
      if (!hasCigSlot && curCount >= MAX_POCKET_SLOTS) {
        sfx.bad && sfx.bad();
        toast('Карманы полны (10 / 10 предметов)! Сначала освободите место.', 'bad');
        return;
      }
      const addN = id === 'kontra' ? 100 : 20;
      S.cigs = (S.cigs || 0) + addN;
      W.life.removeItem(h); W.life.persist && W.life.persist();
      sfx.click(); save(); renderHud(); renderControls();
      toast(`Пачка убрана в карман (+${addN} сигарет, занято ${buildPocketWheelList().length}/${MAX_POCKET_SLOTS})`, 'good');
      return;
    }
    if (HIDDEN[id]) {
      const hasHidSlot = S.hidden && (S.hidden[id] || 0) > 0;
      if (!hasHidSlot && curCount >= MAX_POCKET_SLOTS) {
        sfx.bad && sfx.bad();
        toast('Карманы полны (10 / 10 предметов)! Сначала освободите место.', 'bad');
        return;
      }
      S.hidden = S.hidden || {};
      S.hidden[id] = (S.hidden[id] || 0) + 1;
      W.life.removeItem(h); W.life.persist && W.life.persist();
      sfx.click(); save(); renderHud(); renderControls();
      toast(`Убрали в карман: ${HIDDEN[id].name} (${buildPocketWheelList().length}/${MAX_POCKET_SLOTS})`, 'good');
      return;
    }
  }

  if (h.kind === 'gun') {
    const hasGunSlot = S.gunState === 'carried';
    if (!hasGunSlot && curCount >= MAX_POCKET_SLOTS) {
      sfx.bad && sfx.bad();
      toast('Карманы полны (10 / 10 предметов)! Сначала освободите место.', 'bad');
      return;
    }
    S.gunState = 'carried'; S.gun = true;
    W.life.removeItem(h); W.life.persist && W.life.persist();
    sfx.click(); save(); renderHud(); renderControls();
    toast(`Оружие убрано за пазуху (${buildPocketWheelList().length}/${MAX_POCKET_SLOTS})`, 'good');
    return;
  }

  // Любой другой небольшой предмет (бутылка, пачка товара, еда, газета, кассета, пустая бутылка)
  if (curCount >= MAX_POCKET_SLOTS) {
    sfx.bad && sfx.bad();
    toast('Карманы полны (максимум 10 предметов)! Сначала освободите место в инвентаре.', 'bad');
    return;
  }
  const gid = (h.data && h.data.goodId) || (h.kind === 'bottle' ? 'bottle' : 'item');
  const cnt = (h.data && h.data.count) || 1;
  const gInfo = GOODS[gid] || HIDDEN[gid] || (W && W.aptItemInfo ? W.aptItemInfo(gid) : null) || null;
  const itemName = h.kind === 'bottle' ? 'Пустая стеклянная бутылка 0,5 л'
    : gid === 'safekey' ? 'Ключ от сейфа дяди Толи'
    : gid === 'aptkey' ? 'Ключ от квартиры № 4'
    : gid === 'matches' ? 'Спички'
    : gid === 'plug' ? 'Затычка для ванны'
    : gid === 'alarm_vityaz' ? 'Будильник «Витязь»'
    : gid === 'book_item' ? 'Книга с полки'
    : h.kind === 'pack' ? `Упаковка: ${gInfo ? gInfo.name : gid} (${cnt} шт.)`
    : gInfo ? gInfo.name : 'Небольшой предмет';
  S.pockets.push({
    uid: 'pk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    kind: h.kind,
    goodId: gid,
    count: cnt,
    unitCost: h.data && h.data.unitCost
  });
  W.life.removeItem(h); W.life.persist && W.life.persist();
  sfx.click(); save(); renderHud(); renderControls();
  toast(`Положили в карман: ${itemName} (${buildPocketWheelList().length}/${MAX_POCKET_SLOTS})`, 'good');
}
function openPosterStash(onClose) {
  if (!S) return;
  S.hidden = S.hidden || {};
  const done = () => { closeDialog(); if (onClose) onClose(); };
  const inSafe = safeItems();
  const cashIn = inSafe.filter(it => it.data && it.data.goodId === 'cash').reduce((a, it) => a + (it.data.amount || 0), 0), usdIn = inSafe.filter(it => it.data && it.data.goodId === 'usd').reduce((a, it) => a + (it.data.amount || 0), 0);
  const sums = [...new Set([1, 5, 10, 25, 50, 100, 200, 500, 1000, 5000, 10000, Math.floor(S.money)])].filter(v => v >= 1 && v <= S.money).slice(-7);
  const cash = n => ({ label: `${n <= 10 ? '🪙 Достать монету' : '💴 Достать купюру'}: ${fmt(n)} ₽`, fn() { if (S.money < n) return; if (takeToHand(n <= 10 ? 'coin' : 'cash', n)) { S.money -= n; save(); renderHud(); done(); toast('Деньги в руке. Наведитесь на нижнюю или верхнюю полочку сейфа и положите.'); } } });
  showDialog({
    name: '🔐 Сейф дяди Толи',
    text: `Потайной сейф полностью утоплен в толщу стены за плакатом и имеет 2 небольшие полочки (нижнюю и верхнюю). Чтобы что-то спрятать, возьмите предмет в руку и поставьте на любую из двух полочек сейфа; чтобы забрать — возьмите с полки. Сейчас в сейфе: ${inSafe.length ? inSafe.length + ' предм.' + (cashIn ? ', ' + fmt(cashIn) + ' ₽' : '') + (usdIn ? ', $' + fmt(usdIn) : '') : 'пусто'}. Закрытый заподлицо со стеной сейф не находят ни воры, ни участковый.`,
    options: [
      ...sums.map(cash),
      ...(S.usd >= 1 ? [{ label: `💵 Достать из кармана валюту: $${fmt(S.usd)}`, fn() { const u = S.usd; if (takeToHand('usd', u)) { S.usd = 0; save(); renderHud(); done(); toast('Доллары в руке. Положите их на полку сейфа.'); } } }] : []),
      ...Object.keys(HIDDEN).filter(k => (S.hidden[k] || 0) > 0).map(k => ({ label: `🤫 Достать из-под прилавка: ${HIDDEN[k].short} (есть ${S.hidden[k]})`, fn() { if (takeToHand(k)) { S.hidden[k]--; save(); if (W) W.updateShelves(); done(); toast(`${HIDDEN[k].short} в руке. Поставьте на полку сейфа.`); } } })),
      { label: 'Ничего не доставать', fn: done }
    ]
  });
}

function listenRadioNews() {
  if (!S) return;
  const bulletins = [
    {
      title: 'Хлебозавод бастует!',
      text: '«Внимание, говорит радио Краснозаводска! На городском хлебозаводе смена объявила забастовку. Цены и спрос на хлеб в городе выросли вдвое!»',
      eff: () => { if (S.prices && S.prices.bread) S.prices.bread = Math.round(GOODS.bread.base * S.idx * 1.85); S.wave = { item: 'bread', until: S.day + 1 }; }
    },
    {
      title: 'Сводка УВД: проверка точек',
      text: '«По сообщениям Заводского РОВД, в районе проводятся рейды по выявлению самогона и контрабандного табака. Рекомендуем убрать нелегал в тайник за постером!»',
      eff: () => { rep('law', 1); }
    },
    {
      title: 'Ажиотаж на аудиокассеты и батончики',
      text: '«Молодёжь Краснозаводска сметает с прилавков кассеты «Хиты-92» и шоколадные батончики «Сникерсон»! Отличный повод поднять наценку или включить двухкассетник Sharp!»',
      eff: () => { S.wave = { item: 'tape', until: S.day + 1 }; }
    },
    {
      title: 'Бартер на Механосборочном заводе',
      text: '«На Краснозаводском заводе зарплату за прошлый месяц выдали продукцией предприятия. В отделе сбыта у проходной действуют дополнительные скидки!»',
      eff: () => { S.cheap = Math.max(S.cheap || 0, 1); }
    }
  ];
  const b = bulletins[(S.day - 1) % bulletins.length];
  if (S.lastRadioNewsDay !== S.day) {
    S.lastRadioNewsDay = S.day;
    b.eff();
    gainSkillXp('charm', 35, '📻 Сводка радио «Маяк»');
    save();
  }
  sfx.click();
  showDialog({
    name: `📻 Радио «Маяк» · Сводка дня (${b.title})`,
    text: b.text,
    options: [{ label: 'Принято к сведению!', fn() { closeDialog(); render(); } }]
  });
}

function dubCassetteOnSharp() {
  if (!S) return;
  if (S.lastSharpDubDay === S.day) {
    toast('Сегодня вы уже переписали партию кассет на «Sharp»! Магнитные головки должны остыть до завтра.', 'bad');
    return;
  }
  S.lastSharpDubDay = S.day;
  gainSkillXp('trade', 40, '📼 Перезапись кассет на «Sharp»');
  const album = pick(['«Кино — Чёрный альбом»', '«Сектор Газа — Колхозный панк»', '«Комбинация — Два кусочека колбаски»', '«Наутилус Помпилиус — Наугад»']);
  const profit = Math.round((S.prices.tape || 380) * 2.4);
  S.money += profit;
  rep('street', 2);
  rep('folk', 1);
  sfx.ching();
  save(); renderHud();
  toast(`Переписали на двухкассетнике «Sharp» альбом ${album}! Пацаны с района забрали запись за +${fmt(profit)} ₽ (Улица +2)`, 'good');
}

function onBugorNoteDelivered() {
  if (S) {
    S.flags = S.flags || {};
    S.flags.bugorRoof = true;
    if (S.debt > 0) {
      S.debt = 0;
      toast('ОПГ «Чайники» Бугра закрыла ваш долг $2 500 перед «Заводскими»! Теперь вы под крышей Бугра.', 'good');
    }
  }
  if (!S) return;
  S.flags = S.flags || {};
  if (S.flags.bugorRewardClaimed) return;
  S.flags.bugorRewardClaimed = true;
  S.flags.hasBugorNote = false;
  S.flags.underRoof = true;
  const cutDebt = Math.floor((S.debt || 0) * .5);
  S.debt = Math.max(0, (S.debt || 0) - cutDebt);
  const bonusRub = usdToRub(50);
  S.money += bonusRub;
  rep('street', 25);
  sfx.fanfare();
  save(); renderHud();
  queueCard({
    title: '🤝 Слово «Бугра» · Крыша ОПГ «Чайники»',
    html: `<p>У самого ларька тормозит тёмная «девятка». Крепкие парни в кожанках забирают у вас маляву от <b>Багрова («Бугра»)</b> и жмут вам руку:</p>
      <p><i>«Бугор передал, что ты человек надёжный и в камере не сломался. Отныне твой ларёк стоит под железной крышей «Чайников» совершенно бесплатно!»</i></p>
      <div class="card">
        <div class="row sp"><span>Долг перед «Заводскими» списан</span><b>−$${cutDebt} (осталось $${S.debt})</b></div>
        <div class="row sp"><span>Воровской подгон в кассу</span><b>+${fmt(bonusRub)} ₽ ($50)</b></div>
        <div class="row sp"><span>Бесплатная крыша ОПГ «Чайники»</span><b>АКТИВНА (Улица +25)</b></div>
      </div>`,
    buttons: [{ label: 'Отлично! Работаем дальше!', cls: 'green' }]
  });
}

let _worldInitErr = '';
const W = (() => { try { return createWorld({
  buskTip: (amt, p) => { // прохожий бросил мелочь гитаристу (дневной предел, чтобы не заменить ларёк)
    if (!S) return false; S.busk = S.busk && S.busk.day === S.day ? S.busk : { day: S.day, sum: 0 };
    const cap = Math.round(S.idx * 220); if (S.busk.sum >= cap) return false;
    const a = Math.min(amt, cap - S.busk.sum); S.busk.sum += a; S.money += a;
    if (Math.random() < .25) rep('folk', .3);
    floatText('🎸 +' + fmt(a) + ' ₽', '#ffe27a'); sfx.coin && sfx.coin(); renderHud();
    if (S.busk.sum >= cap) toast('Сегодня уже хорошо подали — народ разошёлся. Завтра будет новая публика.');
    return true; },
  getS: () => S, getT: () => T, openMap, takeMap, closeDialog, pocketHeld, cardOpen: () => cardOpen || dialogOpen || paperOpen, modalOpen: () => cardOpen || paperOpen || npOpen || rdrInvOpen, sheetOpen: () => sheetOpen, settings: () => SET, save,
  toast, openSheet, onCtl, rep, qOf, addStock, takeStock, slotCount,
  onGumUnpacked(n) {
    if (!S) return;
    S.gumBought = (S.gumBought || 0) + (n || 1);
    while (S.gumBought >= 10) {
      S.gumBought -= 10;
      const missing = CARD_NAMES.map((_, i) => i).filter(i => !S.cards.includes(i));
      if (missing.length && Math.random() < .7) {
        const c = pick(missing); S.cards.push(c);
        toast(`Вкладыш! «${CARD_NAMES[c]}» (${S.cards.length}/${CARD_NAMES.length})`, 'good');
        if (S.cards.length === CARD_NAMES.length) { rep('folk', 10); toast('Полный альбом! Школьники в восторге. Народ +10', 'good'); }
      }
    }
  },
  onStockChange: () => { renderHud(); save(); if (T) renderTrade(); }, sellPrice, stockTotal, pocketHeld, GOODS, fmt, MONTHS, monthOf, yearOf, audio, look,
  arrive, customerScared, onKill, onKnockout, onPunchHit, onPlayerPunched, onPlayerBlocked, subtitles, gopnikDemand, say, sleep, maratTalk, factoryTalk, workerTalk, openAlarmModal, phoneCall, openOrders, readPaper, openPosterStash, listenRadioNews, dubCassetteOnSharp, watchVhsOnTv, trainKettlebell, onBugorNoteDelivered, notepadOpen: () => npOpen || npBusy || paperOpen || paperBusy, onDelivered, onUnpack, onSitCounter, onStandCounter,
  onDrink(k, strong, total) {
    if (k === 'soda') { S.hunger = Math.min(100, (S.hunger ?? 100) + 8); healPlayer(4, 'Сладкий лимонад «Буратинка» освежает'); return; }
    if (k === 'beer') { S.hunger = Math.min(100, (S.hunger ?? 100) + 6); healPlayer(3); }
    const d = total ?? (W && W.life.fx.drunkTarget) ?? strong;
    if (d >= 1.35) toast('В глазах темнеет, ноги подкашиваются… Перебрал!', 'bad');
    else if (d >= .95) toast('Ноги ватные, в глазах двоится… Ещё немного — и вырубит!', 'bad');
    else if (d >= .55) toast(k === 'samogon' ? 'Ух, крепкий первач! Голова сразу поплыла…' : 'Хорошо пошло — голова уже заметно кружится.');
    else toast(k === 'beer' ? 'Холодное пиво освежает — пошёл лёгкий хмель.' : k === 'samogon' ? 'Ух, забористый самогон! Сразу дало в голову.' : 'Спирт обжёг горло — по телу пошло тепло.');
  },
  onBedSleepWake() {
    sleep(true);
  },
  onBlackout(spotName, sleepHours, isNightmare = false) {
    if (!S) return;
    if (dialogOpen) closeDialog();
    if (sheetOpen) closeSheet();
    const hrs = sleepHours || R(2.5, 5.0);
    const hInt = Math.floor(hrs), mInt = Math.round((hrs - hInt) * 60);
    const timeTxt = mInt > 0 ? `${hInt} ч ${mInt} мин` : `${hInt} ч`;
    if (S.phase === 'trade' && T) {
      T.t += hrs * (T.len / 12);
      T.lost += T.queue.length + (T.cur && !T.cur.special ? 1 : 0);
      T.queue = [];
      if (T.cur && !T.cur.special) T.cur = null;
      renderTrade();
    }
    if (isNightmare === 'fist_ko') {
      // В кулачной драке игрок НЕ умирает: приходит в себя на том же месте!
      S.hp = Math.max(55, Math.round((S.maxHp || 100) * 0.60));
      if (W && W.P) W.P.hp = S.hp;
      toast(`👊 Вас нокаутировали в кулачной драке! Прошло ${timeTxt} — вы очнулись на том же месте. Нажмите «Встать с земли»!`, 'bad');
      save(); renderHud(); renderControls();
      return;
    }
    if (isNightmare === 'lethal' || isNightmare === true) {
      // ОТКАТ ВСЕЙ ИГРЫ НА 2 ЧАСА НАЗАД ПЕРЕД СМЕРТЬЮ:
      const rewound = restoreStateTwoHoursBack();
      S.flags = S.flags || {};
      S.flags.nightmareStressDay = S.day;
      S.flags.nightmareInsight = true;
      S.hp = Math.max(65, Math.round((S.maxHp || 100) * 0.75));
      if (W && W.P) W.P.hp = S.hp;
      gainSkillXp('charm', 15, 'Инсайт из вещего кошмара');
      const curH = W && W.hour != null ? W.hour : 7;
      const hhStr = String(Math.floor(curH) % 24).padStart(2, '0') + ':' + String(Math.floor((curH % 1) * 60)).padStart(2, '0');
      queueCard({
        title: '⏪ Откат на 2 часа назад (Вещий кошмар)',
        html: `<p>Гибель (${spotName}) оказалась жутким вещим сном… Вы очнулись у себя в кровати в Квартире № 4 в <b>${hhStr}</b> — <b>ровно за пару часов до своей смерти!</b></p>
          <p>Весь мир, время, деньги, товары, предметы и события <b>полностью откатились на 2 часа назад</b> (${rewound ? 'восстановлен снимок состояния за 2 часа до гибели' : 'время и состояние мира возвращены на 2 часа назад'}).</p>
          <p class="goal">🧠 <b>Предвидение судьбы:</b> теперь вы знаете, что произойдёт в ближайшие два часа, и можете изменить ход событий!</p>`,
        buttons: [{ label: 'Очнуться и изменить прошлое', cls: 'green' }]
      });
      save(); renderHud(); renderControls();
      return;
    }
    // Обычная отключка от перебора с алкоголем: просыпаемся в рандомном месте города
    const stealChance = .55;
    if (S.money > 0 && Math.random() < stealChance) {
      const rawSteal = RI(500, 5000);
      const lost = Math.min(S.money, rawSteal);
      S.money -= lost;
      sfx.bad && sfx.bad();
      floatText('−' + fmt(lost) + ' ₽');
      toast(`После перебора с алкоголем вас вырубило на ${timeTxt}! Очнулись (${spotName}) — из карманов пропало ${fmt(lost)} ₽!`, 'bad');
    } else {
      toast(`После перебора с алкоголем вас вырубило на ${timeTxt}! Очнулись (${spotName}). Деньги целы.`);
    }
    save(); renderHud(); renderControls();
  },
  dialog: showDialog, closeDialog, onArrivePoliceStation,
  gopResolved(how) { if (how === 'scared') { rep('street', 3); toast('Гопники отступили. Улица +3'); } },
  onShot() {
    syncAmmoFromWeapon();
    if (S) { S.shotsFired = (S.shotsFired || 0) + 1; }
    toast('Выстрел! Все разбегаются. Меткость +2, Закон −4', 'bad');
    renderHud();
  },
  onHit(sp) {
    if (S) {
      S.bodyParts = S.bodyParts || { head: 100, torso: 100, armL: 100, armR: 100, legL: 100, legR: 100 };
      S.bodyParts.legL = clamp((S.bodyParts.legL ?? 100) - 28, 10, 100);
      S.bodyParts.legR = clamp((S.bodyParts.legR ?? 100) - 28, 10, 100);
      S.bodyParts.torso = clamp((S.bodyParts.torso ?? 100) - 18, 15, 100);
    }
    toast('Вас задела машина! Повреждены ноги и корпус.', 'bad');
    sfx.bad();
  },
  onLoadProgress(p) { loadP = p; const li = document.getElementById('loadInfo'); if (li) li.textContent = 'Загрузка города… ' + Math.round(p * 100) + '%'; const lb = document.getElementById('loadBar'); if (lb) lb.style.width = Math.round(p * 100) + '%'; },
  onLoaded() {
    worldReady = true;
    const li = document.getElementById('loadInfo'); if (li) li.textContent = '';
    const lb = document.getElementById('loadBox'); if (lb) lb.classList.add('done');
    const mb = document.getElementById('menuBtns');
    if (mb) { mb.classList.remove('hidden-until-loaded'); mb.style.display = 'flex'; }
  },
}); } catch (e) { _worldInitErr = String(e && (e.stack || e.message || e)); console.error('3D не запустился', e); return null; } })();
if (W) W.setRetro(SET.retro); // ретро-фильтр — из настроек (по умолчанию выключен)
if (W) {
  const heldGoodId = () => W && W.life.held && W.life.held.kind === 'good' ? (W.life.held.data && W.life.held.data.goodId) : null;
  const heldCigPack = () => ['cig', 'kontra'].includes(heldGoodId());
  const heldDrinkId = () => { const hg = heldGoodId(); return ['beer', 'vodka', 'samogon', 'soda'].includes(hg) ? hg : null; };
  const heldFoodId = () => { const hg = heldGoodId(); return ['bread', 'choc', 'tushonka', 'kilka', 'sausage', 'jam'].includes(hg) ? hg : null; };
  const isCarryingBody = () => !!(W && ((W.carryingBody && W.carryingBody()) || (W.life && W.life.habit && W.life.habit.handcuffed)));
  const handsFree = () => S && !isCarryingBody() && !W.carryKb && !W.life.habit.busy && !W.life.held && !W.weapon.drawn && !W.P.locked && !npOpen && !paperOpen;
  const carried = () => S && S.gunState === 'carried';
  // Когда игрок несёт тело или руки заняты сигаретой, бутылкой, гирей или предметом — все боевые и оружейные кнопки скрыты
  const canUseWeapon = () => carried() && !isCarryingBody() && !W.carryKb && !W.life.habit.busy && !W.life.held && !W.P.locked && !npOpen && !paperOpen;
  const ACTIONS = {
    move:      { label: 'Движение', icon: 'move', kind: 'stick' },
    interact:  { label: 'Действие', icon: 'interact', kind: 'tap', down() { const a = W.action(); if (a) { sfx.click(); a.fn(); } }, visible: () => !!W.action(), text: () => { const a = W.action(); return a ? a.label : 'Действие'; } },
    use:       { label: 'Ещё', icon: 'hand', kind: 'tap', down() { const a = W.action(); if (a && a.alt) { sfx.click(); a.alt.fn(); } }, visible: () => { const a = W.action(); return !!(a && a.alt); }, text: () => { const a = W.action(); return a && a.alt ? a.alt.label : ''; } },
    tvch:      { label: 'Канал', icon: 'interact', kind: 'tap', down() { const a = W.action(); if (a && a.tvCh) { sfx.click(); a.tvCh.fn(); } }, visible: () => { const a = W.action(); return !!(a && a.tvCh); }, text: () => { const a = W.action(); return a && a.tvCh ? a.tvCh.label : ''; } },
    punch:     { label: 'Ударить', icon: '<svg class="ctl-img" viewBox="0 0 64 64" fill="currentColor"><path d="M18 14c2.8 0 5 2.2 5 5v3h2v-5c0-2.8 2.2-5 5-5s5 2.2 5 5v5h2v-4c0-2.8 2.2-5 5-5s5 2.2 5 5v6h1.5c2.5 0 4.5 2 4.5 4.5V39c0 8.8-7.2 16-16 16H25c-7.7 0-14-6.3-14-14V27c0-3.3 2.7-6 6-6h7v4h-5c-1.7 0-3 1.3-3 3v3c0 1.7 1.3 3 3 3h11c1.7 0 3-1.3 3-3s-1.3-3-3-3H18v-9c0-2.8 0-5 0-5z"/></svg>', kind: 'tap', down() { if (!handsFree()) return; if (dialogOpen) closeDialog(); W.punch(); renderControls(); }, visible: () => !W.carryKb && handsFree() && !W.P.seated },
    block:     { label: 'Блок', icon: '<svg class="ctl-img" viewBox="0 0 64 64" fill="currentColor"><path d="M32 8L12 16v15c0 13.8 8.5 26.2 20 30 11.5-3.8 20-16.2 20-30V16L32 8zm-6 14h4v18h-4V22zm8 0h4v18h-4V22z"/></svg>', kind: 'hold', down() { if (!handsFree()) return; if (dialogOpen) closeDialog(); W.setBlock(true); }, up() { W.setBlock(false); }, active: () => !!(W && W.blocking), visible: () => handsFree() && (W.inStrikeCombo ? W.inStrikeCombo() : W.inFight()) && !W.carryKb && !W.P.seated },
    kick:      { label: 'Ногой', icon: '<svg class="ctl-img" viewBox="0 0 64 64" fill="currentColor"><path d="M22 6h14v26l16 9c3 1.7 4 4 4 7v6H14V44l8-6V6zm-6 44v4h36v-4H16z"/></svg>', kind: 'tap', down() { if (!handsFree()) return; if (dialogOpen) closeDialog(); W.strike('kick'); renderControls(); }, visible: () => !!(handsFree() && ((W.aimingAtDeadBody && W.aimingAtDeadBody()) || (S.moves && S.moves.kick && (W.inStrikeCombo ? W.inStrikeCombo() : W.inFight()))) && !W.carryKb && !W.P.seated) },
    hook:      { label: 'Боковой', icon: '<svg class="ctl-img" viewBox="0 0 64 64" fill="currentColor"><path d="M10 40c0-14 10-26 26-28l2 8c-10 2-17 9-18 19l-10 1zm30-22h8c6 0 10 4 10 10v10c0 8-6 14-14 14h-8c-5 0-9-4-9-9V30c0-3 2-5 5-5h8v-7z"/></svg>', kind: 'tap', down() { if (!handsFree()) return; if (dialogOpen) closeDialog(); W.strike('hook'); renderControls(); }, visible: () => !!(handsFree() && S.moves && S.moves.hook && (W.inStrikeCombo ? W.inStrikeCombo() : W.inFight()) && !W.carryKb && !W.P.seated) },
    upper:     { label: 'Апперкот', icon: '<svg class="ctl-img" viewBox="0 0 64 64" fill="currentColor"><path d="M32 4l12 14h-8v12h-8V18h-8L32 4zM22 34h20c5 0 9 4 9 9v6c0 6-5 11-11 11H26c-6 0-10-4-10-10v-9c0-4 3-7 6-7z"/></svg>', kind: 'tap', down() { if (!handsFree()) return; if (dialogOpen) closeDialog(); W.strike('upper'); renderControls(); }, visible: () => !!(handsFree() && S.moves && S.moves.upper && (W.inStrikeCombo ? W.inStrikeCombo() : W.inFight()) && !W.carryKb && !W.P.seated) },
    map:       { label: 'Карта', icon: '<svg class="ctl-img" viewBox="0 0 64 64" fill="currentColor"><path d="M6 14l16-6 20 6 16-6v42l-16 6-20-6-16 6V14zm16-1v38l20 6V19l-20-6z"/></svg>', kind: 'tap', down() { openMap(); }, visible: () => false },
    fire:      { label: 'Огонь', icon: 'fire', kind: 'tap', down() { if (!canUseWeapon() || !W.weapon.drawn) return; const r = W.weapon.fire(); if (r === 'empty') toast('Стволы пусты — перезарядите'); syncAmmoFromWeapon(); renderHud(); }, visible: () => canUseWeapon() && W.weapon.drawn },
    aim:       { label: 'Прицел', icon: 'aim', kind: 'hold', down() { if (canUseWeapon()) W.weapon.aim(true); }, up() { W.weapon.aim(false); }, visible: () => canUseWeapon() && W.weapon.drawn, active: () => W.weapon.aiming },
    reload:    { label: 'Перезарядка', icon: 'reload', kind: 'tap', down() { if (!canUseWeapon()) return; if (!W.weapon.reload()) { if (W.weapon.reserve <= 0) toast('Патронов нет — спросите у Марата за гаражами (он там с 7:00 до 8:30)'); } setTimeout(() => { syncAmmoFromWeapon(); renderHud(); }, 2500); }, visible: () => canUseWeapon() && W.weapon.drawn && W.weapon.ammo < 2 },
    weapon:    { label: 'Ружьё', icon: 'weapon', kind: 'tap', down() { if (!canUseWeapon()) return; W.life.habit.hidePunchHands && W.life.habit.hidePunchHands(); W.weapon.toggle(); renderControls(); setTimeout(() => { renderHud(); renderControls(); }, 480); }, visible: canUseWeapon, active: () => W.weapon.drawn },
    gunput:    { label: 'Положить ружьё', icon: 'drop', kind: 'tap', down() { if (!canUseWeapon() || !W.weapon || !W.weapon.drawn) return; W.putGunDown(); save(); renderHud(); renderControls(); }, visible: () => !!(canUseWeapon() && W && W.weapon && W.weapon.drawn && W.weapon.state === 'idle' && !W.weapon.aiming) },
    sprint:    { label: 'Бег', icon: 'sprint', kind: 'hold', down() { if (!(W.carryingBody && W.carryingBody())) W.setSprint(true); }, up() { W.setSprint(false); }, active: () => W.sprint, visible: () => !W.P.seated && !W.P.lying && !(W.carryingBody && W.carryingBody()) },
    crouch:    { label: 'Присесть', icon: 'crouch', kind: 'tap', down() { W.toggleCrouch(); }, active: () => W.crouch, visible: () => !W.P.seated && !W.P.lying },
    inventory: { label: 'Инвентарь', icon: 'menu', kind: 'tap', down() { if (W && W.guitarMode) return; toggleRdrInventory(); }, visible: () => !(W && W.guitarMode) }, // во время игры на гитаре кнопка не мешает
    pocket:    { label: 'В карман', icon: 'hand', kind: 'tap', down() {
        if (!S || isCarryingBody() || W.life.habit.busy || W.weapon.drawn || W.P.locked || npOpen || paperOpen) return;
        if (W.life.held && isHeldItemPocketable(W.life.held)) {
          pocketHeld();
        }
      },
      text: () => 'Положить в карман',
      visible: () => !!(S && !isCarryingBody() && !W.life.habit.busy && !W.weapon.drawn && !W.P.locked && !npOpen && !paperOpen && W.life.held && isHeldItemPocketable(W.life.held)) },
    smoke:     { label: 'Закурить', icon: 'smoke', kind: 'tap', down() {
        if (!S || isCarryingBody() || W.life.habit.busy || W.weapon.drawn || W.P.locked || npOpen || paperOpen) return;
        if (!heldCigPack()) return;
        const h = W.life.held;
        const gid = h && h.data && h.data.goodId;
        const addN = (gid === 'kontra' ? 100 : 20) - 1;
        W.life.removeItem(h); W.life.persist && W.life.persist();
        S.cigs = (S.cigs || 0) + addN;
        W.life.habit.startSmoke();
        toast('Достали сигарету из пачки и закурили (пачка убрана в карман).', 'good');
        W.updateShelves(); save(); renderHud(); renderControls();
      },
      text: () => 'Закурить',
      visible: () => !!(S && !isCarryingBody() && heldCigPack() && !W.life.habit.busy && !W.weapon.drawn && !W.P.locked && !npOpen && !paperOpen) },
    readpaper: { label: 'Читать газету', icon: 'notepad', kind: 'tap', down() {
        if (!S || W.life.habit.busy || W.weapon.drawn || W.P.locked || npOpen || paperOpen) return;
        readPaper();
      },
      visible: () => !!(S && !isCarryingBody() && heldGoodId() === 'paper' && !W.life.habit.busy && !W.weapon.drawn && !W.P.locked && !npOpen && !paperOpen) },
    drink:     { label: 'Выпить', icon: 'drink', kind: 'tap', down() {
        if (W.life.habit.busy || W.weapon.drawn || W.P.locked || npOpen || paperOpen) return;
        const fk = heldFoodId();
        if (fk) {
          W.life.removeItem(W.life.held);
          const healMap = { bread: [6, 'Съели полбуханки «Дарницкого»', 34], choc: [8, 'Съели батончик «Сникерсон»', 20], tushonka: [14, 'Плотно поели говяжьей тушёнки', 60], kilka: [8, 'Съели банку кильки в томате', 36], sausage: [6, 'Отрезали кусок докторской (на плите было бы вкуснее)', 26], jam: [5, 'Наелись варенья ложкой', 18] };
          const [hpAdd, txt, food] = healMap[fk] || [5, 'Перекусили', 20];
          sfx.click();
          S.hunger = Math.min(100, (S.hunger ?? 100) + food);
          healPlayer(hpAdd, txt);
          renderControls();
          return;
        }
        const k = heldDrinkId();
        if (!k) return;
        W.life.removeItem(W.life.held);
        const bName = k === 'samogon' ? 'самогон' : k === 'vodka' ? 'спирт «Король»' : k === 'soda' ? 'лимонад «Буратинка»' : 'пиво «Заводское»';
        toast(`Открыли бутылку (${bName}).`);
        W.life.habit.startDrink(k, true); W.updateShelves();
        // Каждая выпитая бутылка оставляет после себя пустую бутылку
        W.life.habit.onDrinkEnd = (dKind, willBlackout) => {
          W.life.habit.giveEmptyBottle(dKind || k, !!willBlackout);
          if (!willBlackout) toast('Бутылка пуста — можно поставить или выбросить в урну.');
          save(); renderHud(); renderControls();
        };
        save(); renderHud(); renderControls(); },
      text: () => {
        const fk = heldFoodId();
        if (fk) return fk === 'bread' ? 'Съесть: хлеб' : fk === 'choc' ? 'Съесть: батончик' : fk === 'tushonka' ? 'Съесть: тушёнку' : 'Съесть: кильку';
        const k = heldDrinkId();
        return k === 'beer' ? 'Выпить: пиво' : k === 'vodka' ? 'Выпить: спирт' : k === 'samogon' ? 'Выпить: самогон' : k === 'soda' ? 'Выпить: лимонад' : 'Выпить';
      },
      visible: () => !!(S && !isCarryingBody() && (heldDrinkId() || heldFoodId()) && !W.life.habit.busy && !W.weapon.drawn && !W.P.locked && !npOpen && !paperOpen) },
    door:      { label: 'Дверь', icon: 'door', kind: 'tap', down() { if (!isCarryingBody()) W.toggleDoor(); }, visible: () => !isCarryingBody() && W.nearDoor() },
  };
  const defaults = () => ({ elements: [
    { uid: 'mv', action: 'move', x: .13, y: .76, size: 150, opacity: .6, hit: 1.5, sens: 1 },
    { uid: 'in', action: 'interact', x: .66, y: .84, size: 78, opacity: .85, hit: 1.2 },
    { uid: 'us', action: 'use', x: .53, y: .86, size: 60, opacity: .8, hit: 1.2 },
    { uid: 'tv', action: 'tvch', x: .66, y: .66, size: 60, opacity: .85, hit: 1.2 },
    { uid: 'pn', action: 'punch', x: .89, y: .78, size: 76, opacity: .78, hit: 1.2 },
    { uid: 'bl', action: 'block', x: .77, y: .84, size: 68, opacity: .78, hit: 1.2 },
    { uid: 'fi', action: 'fire', x: .9, y: .8, size: 84, opacity: .75, hit: 1.2 },
    { uid: 'ai', action: 'aim', x: .78, y: .88, size: 62, opacity: .7, hit: 1.2 },
    { uid: 're', action: 'reload', x: .79, y: .7, size: 52, opacity: .7, hit: 1.2 },
    { uid: 'we', action: 'weapon', x: .91, y: .42, size: 54, opacity: .7, hit: 1.2 },
    { uid: 'gp', action: 'gunput', x: .80, y: .36, size: 48, opacity: .65, hit: 1.2 },
    { uid: 'sp', action: 'sprint', x: .3, y: .88, size: 56, opacity: .65, hit: 1.2 },
    { uid: 'cr', action: 'crouch', x: .3, y: .73, size: 50, opacity: .6, hit: 1.2 },
    { uid: 'pk', action: 'pocket', x: .54, y: .70, size: 52, opacity: .72, hit: 1.2 },
    { uid: 'sm', action: 'smoke', x: .66, y: .66, size: 52, opacity: .75, hit: 1.2 },
    { uid: 'dk', action: 'drink', x: .66, y: .66, size: 50, opacity: .65, hit: 1.2 },
    { uid: 'rp', action: 'readpaper', x: .66, y: .66, size: 58, opacity: .82, hit: 1.2 },
    { uid: 'iv', action: 'inventory', x: .06, y: .42, size: 52, opacity: .6, hit: 1.2 },
    { uid: 'mp', action: 'map', x: .06, y: .58, size: 46, opacity: .55, hit: 1.2 },
    { uid: 'kk', action: 'kick', x: .79, y: .50, size: 54, opacity: .76, hit: 1.2 },
    { uid: 'hk', action: 'hook', x: .79, y: .66, size: 54, opacity: .76, hit: 1.2 },
    { uid: 'up', action: 'upper', x: .90, y: .59, size: 54, opacity: .76, hit: 1.2 },
  ] });
  controls = createControls({ root: $('#ui'), actions: ACTIONS, defaults, storageKey: 'larek-controls-v4',
    onLook: (dx, dy) => W.look(dx, dy, 'touch'), onMove: (x, y) => W.move(x, y) });
  window.addEventListener('keydown', e => {
    if (!S || cardOpen || sheetOpen || e.repeat) return;
    const k = e.code;
    if (k === 'KeyE') ACTIONS.interact.down(); if (k === 'KeyF') ACTIONS.use.down(); if (k === 'KeyV' && ACTIONS.punch.visible()) ACTIONS.punch.down(); if (k === 'KeyB' && ACTIONS.block.visible()) ACTIONS.block.down(); if (k === 'KeyG' && ACTIONS.kick.visible()) ACTIONS.kick.down(); if (k === 'KeyH' && ACTIONS.hook.visible()) ACTIONS.hook.down(); if (k === 'KeyJ' && ACTIONS.upper.visible()) ACTIONS.upper.down(); if (k === 'KeyM' && ACTIONS.map.visible()) ACTIONS.map.down(); if (k === 'KeyQ' && canUseWeapon()) ACTIONS.weapon.down(); if (k === 'KeyR' && canUseWeapon()) ACTIONS.reload.down(); if (k === 'KeyT' && ACTIONS.smoke.visible()) ACTIONS.smoke.down(); if (k === 'KeyY' && ACTIONS.drink.visible()) ACTIONS.drink.down(); if (k === 'KeyX' && canUseWeapon()) ACTIONS.gunput.down();
    if (k === 'KeyC') ACTIONS.crouch.down(); if (k === 'ShiftLeft') W.setSprint(true); if (k === 'Tab') { e.preventDefault(); openSheet(); }
  });
  window.addEventListener('keyup', e => { if (e.code === 'ShiftLeft') W.setSprint(false); if (e.code === 'KeyB') ACTIONS.block.up(); });
}
// ============================================================
//  Главный цикл
// ============================================================
let last = performance.now(), hudT = 0;
let brawlHudEl = null;
let lastBrawlSig = '';
function updateBrawlHud() {
  if (brawlHudEl) brawlHudEl.style.display = 'none';
  return;
  if (!W || !W.brawlStatus) return;
  const st = W.brawlStatus();
  if (!st) {
    if (lastBrawlSig !== '') {
      lastBrawlSig = '';
      if (brawlHudEl) brawlHudEl.style.display = 'none';
    }
    return;
  }
  const sig = `${st.enemyName}|${st.enemyHp}|${st.enemyMaxHp}|${st.playerHp}|${st.blocking ? 1 : 0}`;
  if (sig === lastBrawlSig) return;
  lastBrawlSig = sig;
  if (!brawlHudEl) {
    brawlHudEl = document.createElement('div');
    brawlHudEl.id = 'brawlHud';
    brawlHudEl.style.cssText = 'position:absolute;left:50%;top:max(12px,env(safe-area-inset-top));transform:translateX(-50%);width:min(340px,54vw);pointer-events:none;z-index:10;text-align:center;font-family:"Roboto Condensed",sans-serif;';
    $('#ui').appendChild(brawlHudEl);
  }
  brawlHudEl.style.display = 'block';
  const ePct = clamp((st.enemyHp / Math.max(1, st.enemyMaxHp)) * 100, 0, 100);
  const pPct = clamp(st.playerHp, 0, 100);
  brawlHudEl.innerHTML = `
    <div style="font-weight:900;font-size:16px;color:#fff;text-shadow:0 2px 4px #000;letter-spacing:.6px;margin-bottom:3px;">${esc(st.enemyName)} <span style="font-size:12px;color:#e8c66a;">(${st.enemyHp}/${st.enemyMaxHp} HP)</span></div>
    <div style="height:12px;background:rgba(0,0,0,.78);border:2px solid #111;box-shadow:0 1px 4px #000a;overflow:hidden;border-radius:2px;">
      <div style="width:${ePct}%;height:100%;background:linear-gradient(90deg,#c02218,#ff3824);transition:width .12s;"></div>
    </div>
    <div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:5px;font-size:11px;font-weight:800;color:#ddd;text-shadow:0 1px 2px #000;">
      <span>ЗДОРОВЬЕ: ${st.playerHp}%</span>
      <div style="width:95px;height:7px;background:rgba(0,0,0,.75);border:1px solid #222;overflow:hidden;border-radius:2px;">
        <div style="width:${pPct}%;height:100%;background:${st.blocking ? '#44bbff' : '#58d64c'};"></div>
      </div>
      ${st.blocking ? '<span style="color:#66ccff;">🛡 БЛОК</span>' : ''}
    </div>`;
}
// Система снимков времени для полного отката игры на 2 часа назад после смерти главного героя
const _stateHistory = [];
let _histSampleT = 0;
function captureHistorySnapshot() {
  if (!S || !W) return;
  try {
    if (W.life && W.life.persist) W.life.persist();
    syncAmmoFromWeapon();
    const snapS = JSON.parse(JSON.stringify(S));
    const snapHour = W.hour != null ? W.hour : 8.0;
    const totalGameHours = (S.day - 1) * 24 + snapHour;
    _stateHistory.push({
      totalGameHours,
      hour: snapHour,
      S: snapS
    });
    while (_stateHistory.length > 24) _stateHistory.shift();
  } catch (e) {
    console.warn('snapshot err', e);
  }
}
function recordHistorySnapshotTick(dt) {
  if (!S || !W || dt <= 0) return;
  // Если игрок не спал дольше 02:30 ночи — появляется эффект «Недосып»
  if (W.hour >= 2.5 && W.hour < 5.5 && S.phase === 'night' && !S.sleepDeprived) {
    S.sleepDeprived = true;
    S.flags = S.flags || {};
    S.flags.sleepDeprived = true;
  }
  _histSampleT -= dt;
  if (_histSampleT <= 0) {
    _histSampleT = 15.0; // каждые 15 секунд реального времени (~10 игровых минут)
    captureHistorySnapshot();
  }
}
function restoreStateTwoHoursBack() {
  if (!S || !W) return false;
  const curHour = W.hour != null ? W.hour : 8.0;
  const curTotal = (S.day - 1) * 24 + curHour;
  const targetTotal = curTotal - 2.0;
  let bestSnap = null;
  for (let i = _stateHistory.length - 1; i >= 0; i--) {
    const sn = _stateHistory[i];
    if (sn.totalGameHours <= targetTotal + 0.25) {
      bestSnap = sn;
      break;
    }
  }
  if (!bestSnap && _stateHistory.length > 0) {
    bestSnap = _stateHistory[0];
  }
  const newHour = ((curHour - 2.0) % 24 + 24) % 24;
  if (bestSnap && bestSnap.S) {
    const restored = JSON.parse(JSON.stringify(bestSnap.S));
    for (const k of Object.keys(S)) delete S[k];
    Object.assign(S, restored);
    const snapH = bestSnap.hour != null ? bestSnap.hour : newHour;
    const useH = Math.abs(curTotal - bestSnap.totalGameHours) >= 0.4 ? snapH : newHour;
    if (W.rewindWorldToSnapshot) W.rewindWorldToSnapshot(useH, S);
    else if (W.setHour) W.setHour(useH);
    syncAmmoToWeapon();
    return true;
  } else {
    if (W.rewindWorldToSnapshot) W.rewindWorldToSnapshot(newHour, S);
    else if (W.setHour) W.setHour(newHour);
    return false;
  }
}
let _fpsFrames = 0, _fpsAcc = 0, _fpsLastNow = performance.now(), _lastRenderNow = performance.now();
const _ftBuf = new Float32Array(120);
let _ftIdx = 0, _ftCount = 0;
function loop(now) {
  // Реальный ограничитель FPS (30 / 45 / 60 / 90 / 120)
  const cap = Number(SET.fpsCap) || 60;
  if (cap > 0 && cap < 120) {
    const minInterval = (1000 / cap) - 0.85;
    if ((now - _lastRenderNow) < minInterval) {
      requestAnimationFrame(loop);
      return;
    }
  }
  const frameMs = Math.max(0.5, now - _lastRenderNow);
  _lastRenderNow = now;
  _ftBuf[_ftIdx] = frameMs;
  _ftIdx = (_ftIdx + 1) % _ftBuf.length;
  if (_ftCount < _ftBuf.length) _ftCount++;

  const realDt = Math.max(0.0005, (now - _fpsLastNow) / 1000);
  _fpsLastNow = now;
  _fpsFrames++;
  _fpsAcc += realDt;
  if (_fpsAcc >= 0.25) {
    const fpsVal = clamp(Math.round(_fpsFrames / _fpsAcc), 1, 240);
    _fpsFrames = 0; _fpsAcc = 0;
    const fb = document.getElementById('fpsBadge');
    if (fb) {
      if (S && (SET.showFps ?? 1)) {
        fb.style.display = 'block';
        fb.textContent = fpsVal + ' FPS';
        fb.style.color = fpsVal >= 50 ? '#6ee85e' : fpsVal >= 30 ? '#f2c94c' : '#ff5242';
      } else {
        fb.style.display = 'none';
      }
    }
    const dh = document.getElementById('diagHud');
    if (dh) {
      if (S && SET.showDiag && W && W.getDiag) {
        dh.style.display = 'block';
        const d = W.getDiag();
        let sum = 0;
        const arr = [];
        for (let i = 0; i < _ftCount; i++) { sum += _ftBuf[i]; arr.push(_ftBuf[i]); }
        arr.sort((a, b) => a - b);
        const avgMs = _ftCount ? sum / _ftCount : frameMs;
        const avgFps = 1000 / Math.max(0.5, avgMs);
        const p99Ms = arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * 0.99))] : frameMs;
        const low1Fps = 1000 / Math.max(0.5, p99Ms);
        const heapStr = d.jsHeapMB != null ? (d.jsHeapMB + ' MB') : 'n/a';
        dh.textContent =
          `FPS: ${fpsVal} | Avg: ${avgFps.toFixed(1)} | 1% low: ${low1Fps.toFixed(1)} | ${avgMs.toFixed(1)} ms\n` +
          `Calls: ${d.calls} | Tris: ${(d.tris / 1000).toFixed(1)}k | Geo: ${d.geos} | Tex: ${d.tex} | Sh: ${d.progs}\n` +
          `Lights: ${d.lights} | Res: ${d.resW}x${d.resH} (DPR ${d.dpr}, DRS ${Math.round(d.drsK * 100)}%)\n` +
          `Preset: ${d.preset} | Cap: ${cap} | Heap: ${heapStr}\n` +
          `${d.backend}`;
      } else {
        dh.style.display = 'none';
      }
    }
  }
  const rawDt = Math.min(.1, (now - last) / 1000) * (window.__larekTimeScale || 1); last = now;
  // Игра полностью ставится на паузу, когда открыто меню персонажа / настройки (sheetOpen) или модальное окно настроек!
  const isMenuPaused = !!(S && (sheetOpen || (cardOpen && document.querySelector('#mbox #menuSetWrap'))));
  const dt = isMenuPaused ? 0 : (rdrInvOpen ? rawDt * 0.18 : rawDt);
  if (S && !isMenuPaused) {
    tradeTick(dt);
    recordHistorySnapshotTick(dt);
  }
  hudT -= rawDt; if (hudT <= 0 && S) { hudT = .2; if (S.hunger == null || !S.moves) ensureState(); updVitals(); if (!isMenuPaused) trackVisits(); if (controls) controls.refresh(); $('#cross').classList.toggle('aim', !!(W && W.weapon.aiming)); }
  if (W) { try { W.frame(dt); updateBrawlHud(); } catch (e) { console.error(e); } }
  requestAnimationFrame(loop);
}
if (!W) document.body.insertAdjacentHTML('beforeend', '');
render();
requestAnimationFrame(loop);
// для отладки/тестов
window.__larek = { get S() { return S; }, get T() { return T; }, W, get controls() { return controls; } };
})();
