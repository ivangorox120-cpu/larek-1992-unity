// Пространственный звук: радио, город, ветер, шаги, машины, оружие.
// Всё идёт через один AudioContext; слушатель — камера игрока.
import * as THREE from 'three';

// Начала отдельных шагов в записях (секунды) — найдены анализом огибающей (см. tools/asset-pipeline)
const STEPS = {
  walk: [0.14, 0.84, 1.55, 2.23, 2.94, 3.61, 4.26, 4.93, 5.6, 6.28, 6.97, 7.65, 8.38, 9.06],
  snow: [0.2, 1.41, 2.57, 4.07, 4.37, 4.74, 5.51, 6.2, 6.84],
};

export function createAudio() {
  let ctx = null, master, sfxBus, ambBus;
  const st = { master: .9, radio: .7, ambience: .6, radioOn: true, ready: false, muted: false };
  const buffers = {};
  let rainSrc, rainFilter, rainGain, roofSrc, roofGain;
  let radioRev = null;
  let radioEl, radioSrc, radioGain, radioFilter, radioPanner, cityEl, citySrc, cityGain, cityFilter, windGain, windFilter, windSrc;
  let tvEl = null, tvSrc = null, tvFilter = null, tvGain = null, tvPanner = null;
  let tvOnState = false, tvActiveChState = 0;
  const tvStartEpoch = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
  const TV_CH_OFFSETS = [0, 34, 78, 52, 18, 410, 250, 900, 120, 60];
  const TV_CH_DURS = [180, 180, 180, 180, 210, 2808.08, 1972.58, 3065.91, 2491.83, 700.41];
  function getLiveTvTime(chIdx) {
    const idx = ((chIdx % 5) + 5) % 5;
    const nowS = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    const elapsed = Math.max(0, nowS - tvStartEpoch);
    return (elapsed + (TV_CH_OFFSETS[idx] || 0)) % (TV_CH_DURS[idx] || 300);
  }
  function syncTvAudioChannel() {
    if (!tvEl) return;
    if (!tvOnState) {
      try { tvEl.pause(); } catch (e) {}
      return;
    }
    const wantUrl = 'assets/audio/tv_ch' + (tvActiveChState + 1) + '.mp3';
    const curAttr = tvEl.getAttribute('src') || '';
    const liveT = getLiveTvTime(tvActiveChState);
    if (curAttr !== wantUrl) {
      tvEl.src = wantUrl;
      tvEl.setAttribute('src', wantUrl);
      tvEl.onloadedmetadata = () => {
        try { tvEl.currentTime = getLiveTvTime(tvActiveChState); } catch (e) {}
        if (tvOnState) tvEl.play().catch(() => {});
      };
      tvEl.play().catch(() => {});
    } else {
      if (tvEl.readyState >= 1 && Math.abs((tvEl.currentTime || 0) - liveT) > 0.6) {
        try { tvEl.currentTime = liveT; } catch (e) {}
      }
      if (tvEl.paused) tvEl.play().catch(() => {});
    }
  }
  const tmpV = new THREE.Vector3(), tmpF = new THREE.Vector3(), tmpU = new THREE.Vector3();
  // ---- реверберация: предсозданный банк ConvolverNode по помещениям (НУЛЕВОЙ пересчёт FFT и никаких фризов при входе в ванную/квартиру/здания!)
  let revSend = null, revCur = '';
  const revBank = {};
  const IR_SPEC = { // длина (компактная <=0.78с для мгновенного FFT), крутизна спада, яркость, ранние отражения, «мокрый» уровень
    street: [.52, 3.6, .30, .10, .07], kiosk: [.28, 5.0, .85, .30, .20], room: [.42, 4.2, .50, .22, .15],
    bath: [.62, 3.0, .92, .42, .30], stair: [.78, 2.7, .62, .50, .34], bus: [.34, 4.6, .58, .30, .16], hall: [.68, 3.1, .55, .35, .25] };
  function makeIR(name) {
    const [len, dec, bright, early] = IR_SPEC[name] || IR_SPEC.street, sr = ctx.sampleRate, n = Math.floor(sr * len);
    const b = ctx.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let lp = 0; const a = .08 + .9 * bright;
      for (let i = 0; i < n; i++) { const x = i / n; lp += a * ((Math.random() * 2 - 1) - lp); d[i] = lp * Math.pow(1 - x, dec) * (.6 + .4 * Math.exp(-x * 6)); }
      for (let k = 0; k < 7; k++) { const at = Math.floor(sr * (.004 + k * (.007 + .012 * len / 2) + Math.random() * .004)); if (at < n) d[at] += (Math.random() < .5 ? -1 : 1) * early * (1 - k / 8); }
    }
    return b;
  }
  function initRevSpace(name) {
    if (!ctx || !revSend || revBank[name]) return revBank[name];
    try {
      const conv = ctx.createConvolver();
      conv.buffer = makeIR(name);
      const g = ctx.createGain();
      g.gain.value = 0;
      revSend.connect(conv); conv.connect(g); g.connect(master);
      revBank[name] = { conv, g };
      return revBank[name];
    } catch (e) { return null; }
  }
  function setSpace(name, instant) {
    if (!ctx || !revSend || name === revCur) return;
    revCur = name;
    const t = ctx.currentTime;
    const spec = IR_SPEC[name] || IR_SPEC.street;
    const tau = instant ? .001 : .22;
    for (const k of Object.keys(revBank)) {
      const entry = revBank[k];
      if (!entry) continue;
      entry.g.gain.cancelScheduledValues(t);
      entry.g.gain.setTargetAtTime(k === name ? spec[4] : 0, t, tau);
    }
  }
  // ---- заглушение за стенами: функцию проверки стены даёт мир (луч от слушателя до источника)
  let occluder = null; const occlCache = new Map();
  function occludedAt(pos) { if (!occluder || !pos) return false; try { return !!occluder(pos.x, pos.y == null ? 1.2 : pos.y, pos.z); } catch (e) { return false; } }
  // цепочка для точечного источника: воздушное поглощение ВЧ по расстоянию + стена (низкочастотный «бубнёж»)
  let activeOneShots = 0;
  function spatialOut(pos, model = 'HRTF', ref = 1.2, roll = 1.2, maxD = 80) {
    if (!pos || !isFinite(pos.x) || !isFinite(pos.z) || (pos.y != null && !isFinite(pos.y))) pos = { x: isFinite(tmpV.x) ? tmpV.x : 0, y: 1.2, z: isFinite(tmpV.z) ? tmpV.z : 0 }; // сбойная координата источника не должна ронять кадр
    const p = ctx.createPanner(); Object.assign(p, { panningModel: model, distanceModel: 'inverse', refDistance: ref, rolloffFactor: roll, maxDistance: maxD });
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y == null ? 1.2 : pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y == null ? 1.2 : pos.y, pos.z);
    let d = Math.hypot(pos.x - tmpV.x, (pos.y == null ? 1.2 : pos.y) - tmpV.y, pos.z - tmpV.z); if (!isFinite(d)) d = 40;
    const occ = occludedAt(pos);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.max(500, Math.min(20000, 20000 * Math.exp(-d / 38)) * (occ ? .045 : 1)); f.Q.value = .5;
    const g = ctx.createGain(); g.gain.value = occ ? .42 : 1;
    f.connect(g); g.connect(p); p.connect(sfxBus);
    return { input: f, far: d };
  }
  const cars = new Map(); let lastUpd = 0, carOcclT = 0;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    master = ctx.createGain(); master.gain.value = st.muted ? 0 : st.master; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = st.ambience; ambBus.connect(master);
    // ---- акустика помещения: асинхронный предпрогрев всех ConvolverNode по одному, без единого переключения .buffer в игре!
    revSend = ctx.createGain(); revSend.gain.value = 1;
    sfxBus.connect(revSend);
    initRevSpace('street');
    setSpace('street', true);
    const _spaces = ['room', 'bath', 'kiosk', 'stair', 'bus', 'hall'];
    _spaces.forEach((sp, idx) => setTimeout(() => {
      initRevSpace(sp);
      if (revCur === sp && revBank[sp]) {
        const t0 = ctx.currentTime;
        revBank[sp].g.gain.setTargetAtTime((IR_SPEC[sp] || IR_SPEC.street)[4], t0, .18);
      }
    }, 120 + idx * 90));
    // шаги
    for (const [k, url] of [['walk', 'assets/audio/walk.mp3'], ['snow', 'assets/audio/walk_snow.mp3'], ...['shot', 'gun_open', 'gun_shell', 'gun_shell2', 'gun_close', 'shell_drop', 'gun_move', 'stuk', 'dostavka', 'horn', 'car_engine', 'bus_engine'].map(n => [n, 'assets/audio/' + n + '.mp3'])])
      fetch(url).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(b => { buffers[k] = b; }).catch(e => console.warn('audio', url, e));
    // радио — потоковый <audio>, подключённый в граф (панорама + фильтр)
    radioEl = new Audio('assets/audio/radio.mp3'); radioEl.loop = true; radioEl.preload = 'auto'; radioEl.crossOrigin = 'anonymous';
    radioEl.currentTime = 0;
    radioSrc = ctx.createMediaElementSource(radioEl);
    radioFilter = ctx.createBiquadFilter(); radioFilter.type = 'lowpass'; radioFilter.frequency.value = 18000;
    radioGain = ctx.createGain(); radioGain.gain.value = 0;
    radioPanner = ctx.createPanner(); Object.assign(radioPanner, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: .8, rolloffFactor: 1.6, maxDistance: 60 });
    radioSrc.connect(radioFilter); radioFilter.connect(radioGain); radioGain.connect(radioPanner); radioPanner.connect(master); radioRev = ctx.createGain(); radioRev.gain.value = .5; radioPanner.connect(radioRev); radioRev.connect(revSend);
    // город
    cityEl = new Audio('assets/audio/city.mp3'); cityEl.loop = true; cityEl.crossOrigin = 'anonymous';
    citySrc = ctx.createMediaElementSource(cityEl);
    cityFilter = ctx.createBiquadFilter(); cityFilter.type = 'lowpass'; cityFilter.frequency.value = 16000;
    cityGain = ctx.createGain(); cityGain.gain.value = .35;
    citySrc.connect(cityFilter); cityFilter.connect(cityGain); cityGain.connect(ambBus);
    // ветер — отфильтрованный шум
    const len = ctx.sampleRate * 4, nb = ctx.createBuffer(1, len, ctx.sampleRate), d = nb.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { last = last * .985 + (Math.random() * 2 - 1) * .015; d[i] = last * 6; }
    windSrc = ctx.createBufferSource(); windSrc.buffer = nb; windSrc.loop = true;
    windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 500; windFilter.Q.value = .6;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    windSrc.connect(windFilter); windFilter.connect(windGain); windGain.connect(ambBus); windSrc.start();
    // дождь: шум по асфальту (высокие) + капли по крыше ларька (низкие, слышнее внутри)
    rainSrc = ctx.createBufferSource(); rainSrc.buffer = nb; rainSrc.loop = true; rainSrc.playbackRate.value = 1.3; rainFilter = ctx.createBiquadFilter(); rainFilter.type = 'highpass'; rainFilter.frequency.value = 1400; rainGain = ctx.createGain(); rainGain.gain.value = 0;
    rainSrc.connect(rainFilter); rainFilter.connect(rainGain); rainGain.connect(ambBus); rainSrc.start();
    roofSrc = ctx.createBufferSource(); roofSrc.buffer = nb; roofSrc.loop = true; roofSrc.playbackRate.value = .7; const rf = ctx.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 900; rf.Q.value = 1.2; roofGain = ctx.createGain(); roofGain.gain.value = 0;
    roofSrc.connect(rf); rf.connect(roofGain); roofGain.connect(ambBus); roofSrc.start();
    // Единый потоковый декодер для активного ТВ-канала с синхронизацией параллельного эфира 5 каналов по времени
    tvFilter = ctx.createBiquadFilter(); tvFilter.type = 'lowpass'; tvFilter.frequency.value = 11500;
    tvGain = ctx.createGain(); tvGain.gain.value = 0;
    tvPanner = ctx.createPanner();
    Object.assign(tvPanner, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 1.35, rolloffFactor: 1.35, maxDistance: 32 });
    tvFilter.connect(tvGain); tvGain.connect(tvPanner); tvPanner.connect(master); { const tr = ctx.createGain(); tr.gain.value = .5; tvPanner.connect(tr); tr.connect(revSend); }
    tvEl = new Audio('assets/audio/tv_ch1.mp3');
    tvEl.setAttribute('src', 'assets/audio/tv_ch1.mp3');
    tvEl.loop = true; tvEl.preload = 'auto'; tvEl.crossOrigin = 'anonymous';
    tvSrc = ctx.createMediaElementSource(tvEl);
    tvSrc.connect(tvFilter);
    if (tvOnState) syncTvAudioChannel();
    cityEl.play().catch(() => {});
    if (st.radioOn) radioEl.play().catch(() => {});
    if (anthemPlaying) {
      radioGain.gain.value = 0;
      const aEl = ensureAnthemEl();
      if (aEl && aEl.paused) {
        aEl.volume = st.muted ? 0 : Math.min(1, st.master);
        aEl.play().catch(() => {});
      }
    }
    st.ready = true;
    return ctx;
  }

  // ---- вызывается каждый кадр ----
  // env: { camera, radioPos, inside, doorOpen (0..1), outside wind 0..1, night }
  const fin = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v)) ? v : d;
  function update(env) {
    if (!ctx || !env || !env.camera) return;
    const t = ctx.currentTime, cam = env.camera;
    cam.getWorldPosition(tmpV); cam.getWorldDirection(tmpF); tmpU.set(0, 1, 0).applyQuaternion(cam.quaternion);
    const L = ctx.listener;
    if (L.positionX) { L.positionX.setTargetAtTime(tmpV.x, t, .03); L.positionY.setTargetAtTime(tmpV.y, t, .03); L.positionZ.setTargetAtTime(tmpV.z, t, .03);
      L.forwardX.setTargetAtTime(tmpF.x, t, .03); L.forwardY.setTargetAtTime(tmpF.y, t, .03); L.forwardZ.setTargetAtTime(tmpF.z, t, .03);
      L.upX.setTargetAtTime(tmpU.x, t, .03); L.upY.setTargetAtTime(tmpU.y, t, .03); L.upZ.setTargetAtTime(tmpU.z, t, .03); }
    else { L.setPosition(tmpV.x, tmpV.y, tmpV.z); L.setOrientation(tmpF.x, tmpF.y, tmpF.z, tmpU.x, tmpU.y, tmpU.z); }
    if (env.space) setSpace(env.space);
    if (vin && vin.pos) { vin.t -= .016; if (vin.t <= 0) { vin.t = .3; const occ = occludedAt(vin.pos); vin.occF.frequency.setTargetAtTime(occ ? 600 : 20000, t, .2); } }
    const thr = env.inside ? (.25 + .45 * env.doorOpen) : fin(env.through, 1); // насколько уличный шум проходит в помещение
    const thrCut = env.inside ? 900 + 5000 * env.doorOpen : (thr < .99 ? 380 + 5200 * thr * thr : 16000);
    // радио: источник в ларьке; снаружи — сквозь стены (низкие частоты), сильнее глушится закрытой дверью
    if (radioPanner) {
      const p = env.radioPos; if (radioPanner.positionX) { radioPanner.positionX.value = p.x; radioPanner.positionY.value = p.y; radioPanner.positionZ.value = p.z; } else radioPanner.setPosition(p.x, p.y, p.z);
      const through = env.inside ? 1 : (.18 + .5 * env.doorOpen);
      const cut = env.inside ? 16000 : 600 + 4000 * env.doorOpen;
      radioFilter.frequency.setTargetAtTime(cut, t, .15);
      const inMenuNow = !!(anthemPlaying || env.inMenu);
      if (inMenuNow) {
        radioGain.gain.value = 0;
      }
      radioGain.gain.setTargetAtTime((st.radioOn && !inMenuNow) ? st.radio * through : 0, t, .05);
    }
    // 3D-позиционирование звука телевизора «Рубин Ц-208» (HRTF-панорамирование, затухание по расстоянию и глушение стенами)
    if (tvPanner && env.tvPos) {
      const tp = env.tvPos;
      if (tvPanner.positionX) {
        tvPanner.positionX.setTargetAtTime(tp.x, t, .03);
        tvPanner.positionY.setTargetAtTime(tp.y, t, .03);
        tvPanner.positionZ.setTargetAtTime(tp.z, t, .03);
      } else {
        tvPanner.setPosition(tp.x, tp.y, tp.z);
      }
      const tvThrough = (tvOnState && env.tvOn) ? fin(env.tvThrough, 1.0) : 0;
      const tvCut = fin(env.tvCutoff, 11500);
      tvFilter.frequency.setTargetAtTime(tvCut, t, .12);
      tvGain.gain.setTargetAtTime(st.muted ? 0 : (tvThrough * 1.15), t, .08);
    }
    if (cityGain) {
      cityGain.gain.setTargetAtTime(.4 * thr * (env.night ? .6 : 1), t, .3);
      cityFilter.frequency.setTargetAtTime(thrCut, t, .2);
      const w = env.wind * (env.inside ? .15 + .4 * env.doorOpen : thr < .99 ? thr * .6 : 1);
      windGain.gain.setTargetAtTime(.05 + w * .22, t, .5);
      const rn = env.rain || 0; if (rainGain) { rainGain.gain.setTargetAtTime(rn * (env.inside ? .05 + .25 * env.doorOpen : .32 * thr), t, .8); roofGain.gain.setTargetAtTime(rn * (env.inside ? .5 : thr < .99 ? .03 : .08), t, .8); }
      windFilter.frequency.setTargetAtTime(350 + w * 500 + Math.sin(t * .3) * 120, t, .5);
    }
    const dtA = Math.min(.25, Math.max(.001, t - (lastUpd || t - .016))); lastUpd = t; carOcclT -= dtA;
    const doOccl = carOcclT <= 0; if (doOccl) carOcclT = .3;
    // проницаемость оболочки здания для уличного транспорта: ларёк (дверь), квартира (окна/форточка), подъезд
    const indoorMul = env.inside ? .14 + .6 * env.doorOpen : thr < .99 ? .05 + .55 * thr * thr : 1;
    const indoorCut = env.inside ? 700 + 6000 * env.doorOpen * env.doorOpen : thr < .99 ? 260 + 3200 * thr * thr : 16000;
    for (const [id, c] of cars) if (c.panner) {
      const p = c.pos; if (c.panner.positionX) { c.panner.positionX.value = p.x; c.panner.positionY.value = .6; c.panner.positionZ.value = p.z; } else c.panner.setPosition(p.x, .6, p.z);
      // эффект Доплера: скорость сближения источника со слушателем (звук 343 м/с), сглаженно
      const dNow = Math.hypot(p.x - tmpV.x, p.z - tmpV.z); const vr = c.lastD == null ? 0 : (c.lastD - dNow) / dtA; c.lastD = dNow;
      c.dop = (c.dop || 1) + (Math.max(.86, Math.min(1.16, 343 / (343 - Math.max(-40, Math.min(40, vr))))) - (c.dop || 1)) * .2;
      if (doOccl) { const occ = occludedAt({ x: p.x, y: 1.0, z: p.z }); c.occ = occ;
        // воздух гасит верха с расстоянием; стена — оставляет только низкий гул; внутри здания (квартира/подъезд/ларёк) — ещё и окна/стены дома
        let cut = Math.max(700, 16000 * Math.exp(-dNow / 26)); if (occ) cut = Math.min(cut, 380); if (indoorCut < 16000) cut = Math.min(cut, indoorCut);
        if (c.filt) c.filt.frequency.setTargetAtTime(cut, t, .2);
        const wantH = dNow < 35 ? 'HRTF' : 'equalpower'; if (c.panner.panningModel !== wantH) c.panner.panningModel = wantH; }
      if (c.osc && buffers[c.key]) { try { c.osc.stop(); c.osc2.stop(); } catch (e) {} cars.delete(id); addCar(id); continue; } // запись догрузилась — переключаемся на неё
      const busK = c.key === 'bus_engine';
      if (c.src) c.src.playbackRate.setTargetAtTime(((busK ? .85 : .8) + Math.min(c.speed, 12) * (busK ? .045 : .05)) * (c.dop || 1), t, .15); // холостой ход → разгон, плюс Доплер
      else { c.osc.frequency.setTargetAtTime(32 + c.speed * 4.5, t, .1); c.osc2.frequency.setTargetAtTime(64 + c.speed * 9, t, .1); }
      const farFade = dNow > 55 ? Math.max(0, 1 - (dNow - 55) / 35) : 1; // за ~90 м мотор тонет в городском фоне
      c.gain.gain.setTargetAtTime((c.src ? (busK ? .26 : .15) + c.speed * (busK ? .016 : .012) : .04 + c.speed * .01) * indoorMul * (c.occ ? .35 : 1) * farFade, t, .1);
    }
  }

  // ---- шаги: свой тембр и акустический отклик для каждой поверхности (снег, тропинка/тротуар, асфальт, дерево, пол автобуса, металл, коробка) ----
  let lastStepI = -1;
  function step(surface, speed, inside) {
    if (!ctx || st.muted) return;
    const t = ctx.currentTime;
    const volMul = (.78 + Math.random() * .3) * (speed > 3 ? 1.2 : 1);
    const key = surface === 'snow' ? 'snow' : 'walk';
    const b = buffers[key];
    if (b) {
      const list = STEPS[key];
      let i; do i = Math.floor(Math.random() * list.length); while (i === lastStepI && list.length > 1); lastStepI = i;
      const src = ctx.createBufferSource(); src.buffer = b;
      const rateBase = surface === 'wood' ? .78 : surface === 'bus' ? .84 : surface === 'box' ? .74 : surface === 'path' ? 1.04 : surface === 'metal' ? 1.12 : .94;
      src.playbackRate.value = rateBase + (Math.random() - .5) * .14 + (speed > 3 ? .06 : 0);
      const g = ctx.createGain();
      const baseGain = surface === 'snow' ? .78 : surface === 'wood' ? .48 : surface === 'bus' ? .50 : surface === 'box' ? .42 : surface === 'path' ? .62 : .56;
      g.gain.value = baseGain * volMul * (inside ? .85 : 1);
      const f = ctx.createBiquadFilter();
      f.type = surface === 'path' || surface === 'metal' ? 'bandpass' : 'lowpass';
      f.frequency.value = surface === 'wood' ? 1800 : surface === 'bus' ? 2200 : surface === 'box' ? 1400 : surface === 'path' ? 2400 : surface === 'metal' ? 3200 : 5200 + Math.random() * 3000;
      if (f.type === 'bandpass') f.Q.value = .75;
      src.connect(f); f.connect(g); g.connect(sfxBus);
      src.start(t, list[i], .38); g.gain.setTargetAtTime(0, t + .26, .04);
    }
    // Дополнительный характерный физический слой для конкретного материала под ногами
    if (surface === 'wood') {
      // Глухой деревянный стук половых досок
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(155 + Math.random() * 35, t);
      o.frequency.exponentialRampToValueAtTime(68, t + .09);
      og.gain.setValueAtTime(.22 * volMul, t); og.gain.exponentialRampToValueAtTime(.001, t + .10);
      o.connect(og); og.connect(sfxBus); o.start(t); o.stop(t + .11);
    } else if (surface === 'bus') {
      // Упругий шаг по резиновому коврику и металлическому полу салона ПАЗика
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(210 + Math.random() * 40, t);
      o.frequency.exponentialRampToValueAtTime(95, t + .08);
      og.gain.setValueAtTime(.20 * volMul, t); og.gain.exponentialRampToValueAtTime(.001, t + .09);
      o.connect(og); og.connect(sfxBus); o.start(t); o.stop(t + .10);
    } else if (surface === 'metal') {
      // Звонкий металлический лязг чугунной решётки ливнёвки
      for (const fq of [880, 1340]) {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = 'triangle'; o.frequency.setValueAtTime(fq + (Math.random() - .5) * 90, t);
        o.frequency.exponentialRampToValueAtTime(fq * .65, t + .11);
        og.gain.setValueAtTime(.14 * volMul, t); og.gain.exponentialRampToValueAtTime(.001, t + .12);
        o.connect(og); og.connect(sfxBus); o.start(t); o.stop(t + .13);
      }
    } else if (surface === 'box') {
      // Сухой картонный прогиб и шорох коробки
      const n = ctx.createBufferSource(); n.buffer = noiseBuf(.12, 3.2);
      const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 620 + Math.random() * 180; bf.Q.value = 1.8;
      const ng = ctx.createGain(); ng.gain.setValueAtTime(.28 * volMul, t); ng.gain.exponentialRampToValueAtTime(.001, t + .12);
      n.connect(bf); bf.connect(ng); ng.connect(sfxBus); n.start(t);
    } else if (surface === 'path') {
      // Чёткий сухой щелчок подошвы и гравия по расчищенной тропинке / бетонному тротуару
      const n = ctx.createBufferSource(); n.buffer = noiseBuf(.065, 4.5);
      const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 1950 + Math.random() * 450; bf.Q.value = 1.4;
      const ng = ctx.createGain(); ng.gain.setValueAtTime(.22 * volMul, t); ng.gain.exponentialRampToValueAtTime(.001, t + .065);
      n.connect(bf); bf.connect(ng); ng.connect(sfxBus); n.start(t);
    } else if (surface === 'asphalt') {
      // Твёрдый сухой удар подошвы и каблука по зимнему асфальту (отчётливо отличается от хруста снега!)
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(195 + Math.random() * 35, t);
      o.frequency.exponentialRampToValueAtTime(82, t + .055);
      og.gain.setValueAtTime(.24 * volMul, t); og.gain.exponentialRampToValueAtTime(.001, t + .06);
      o.connect(og); og.connect(sfxBus); o.start(t); o.stop(t + .065);
      const n = ctx.createBufferSource(); n.buffer = noiseBuf(.05, 5.2);
      const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 2450 + Math.random() * 550; bf.Q.value = 1.6;
      const ng = ctx.createGain(); ng.gain.setValueAtTime(.26 * volMul, t); ng.gain.exponentialRampToValueAtTime(.001, t + .05);
      n.connect(bf); bf.connect(ng); ng.connect(sfxBus); n.start(t);
    } else if (surface === 'wet') {
      // Лёгкий плеск воды по мокрому асфальту/луже
      const n = ctx.createBufferSource(); n.buffer = noiseBuf(.14, 3.0);
      const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 3100 + Math.random() * 600; bf.Q.value = 1.1;
      const ng = ctx.createGain(); ng.gain.setValueAtTime(.20 * volMul, t); ng.gain.exponentialRampToValueAtTime(.001, t + .14);
      n.connect(bf); bf.connect(ng); ng.connect(sfxBus); n.start(t);
    }
  }

  // ---- проигрыватель винила (радиола): музыка через «старый» фильтр + шорох и щелчки пластинки, объёмно из радиолы ----
  let vin = null;
  function vinyl(on, pos) {
    if (!ensure()) return;
    if (!vin) {
      const el = new Audio('assets/audio/radio.mp3'); el.loop = true; el.crossOrigin = 'anonymous'; el.preload = 'auto';
      const src = ctx.createMediaElementSource(el);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 70;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7800; lp.Q.value = .5;
      const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 1800; pk.gain.value = 3; pk.Q.value = .8; // тёплая середина лампового усилителя
      const g = ctx.createGain(); g.gain.value = 0;
      // шорох и щелчки винила — свой буфер с редкими импульсами
      const n = ctx.sampleRate * 3, cb = ctx.createBuffer(1, n, ctx.sampleRate), d = cb.getChannelData(0); let lpv = 0;
      for (let i = 0; i < n; i++) { lpv += .08 * ((Math.random() * 2 - 1) - lpv); d[i] = lpv * .35 + (Math.random() < .0004 ? (Math.random() * 2 - 1) * .9 : 0); }
      const cs = ctx.createBufferSource(); cs.buffer = cb; cs.loop = true; const cg = ctx.createGain(); cg.gain.value = 0; cs.connect(cg); cs.start();
      const occF = ctx.createBiquadFilter(); occF.type = 'lowpass'; occF.frequency.value = 20000;
      const pan = ctx.createPanner(); Object.assign(pan, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: .9, rolloffFactor: 1.5, maxDistance: 40 });
      src.connect(hp); hp.connect(pk); pk.connect(lp); lp.connect(g); g.connect(occF); cg.connect(occF); occF.connect(pan); pan.connect(master);
      const rv = ctx.createGain(); rv.gain.value = .45; pan.connect(rv); if (revSend) rv.connect(revSend);
      vin = { el, g, cg, pan, occF, pos: null, t: 0 };
    }
    const t = ctx.currentTime;
    if (on) {
      vin.pos = pos; if (vin.pan.positionX) { vin.pan.positionX.value = pos.x; vin.pan.positionY.value = pos.y; vin.pan.positionZ.value = pos.z; } else vin.pan.setPosition(pos.x, pos.y, pos.z);
      try { if (vin.el.readyState >= 1 && vin.el.duration) vin.el.currentTime = Math.random() * vin.el.duration * .8; } catch (e) {}
      vin.el.play().catch(() => {});
      vin.cg.gain.setTargetAtTime(.10, t, .05); vin.g.gain.setValueAtTime(0, t); vin.g.gain.setTargetAtTime(.75, t + 1.2, .4); // сначала только шорох иглы, потом музыка
    } else { vin.g.gain.setTargetAtTime(0, t, .05); vin.cg.gain.setTargetAtTime(0, t, .05); setTimeout(() => { try { vin.el.pause(); } catch (e) {} }, 300); vin.pos = null; }
  }
  // ---- шаги прохожих: объёмные, тише своих, по снегу — хруст ----
  let npcStepN = 0;
  function npcStep(pos, snow, heavy = 1) {
    if (!ctx || st.muted || npcStepN > 6 || !pos || !isFinite(pos.x) || !isFinite(pos.z)) return;
    const key = snow ? 'snow' : 'walk', b = buffers[key]; if (!b) return;
    const list = STEPS[key], i = Math.floor(Math.random() * list.length), t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = .9 + Math.random() * .2;
    const g = ctx.createGain(); g.gain.value = (snow ? .5 : .38) * heavy;
    const o = spatialOut({ x: pos.x, y: .05, z: pos.z }, 'equalpower', 1.0, 1.6, 25);
    src.connect(g); g.connect(o.input); src.start(t, list[i], .34); g.gain.setTargetAtTime(0, t + .24, .04);
    npcStepN++; src.onended = () => { npcStepN = Math.max(0, npcStepN - 1); };
  }
  // ---- синтез: выстрел, перезарядка, удары ----
  const noiseCache = new Map();
  function noiseBuf(dur, decay) { // кэш по 3 варианта на каждый (длина, спад): раньше шум генерировался заново на каждый шаг и удар
    const key = dur + '|' + decay; let arr = noiseCache.get(key); if (!arr) { arr = []; noiseCache.set(key, arr); }
    if (arr.length < 3) { const b = noiseBufNew(dur, decay); arr.push(b); return b; }
    return arr[(Math.random() * 3) | 0];
  }
  function noiseBufNew(dur, decay) {
    const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    return b;
  }
  // сэмпл из файла; pos — точка в мире (объёмный звук через HRTF), иначе — «в голове» игрока
  function sample(name, vol = 1, pos = null, rate = 1) {
    if (!ensure() || !buffers[name]) return null; const s = ctx.createBufferSource(); s.buffer = buffers[name]; s.playbackRate.value = rate; const g = ctx.createGain(); g.gain.value = vol; s.connect(g);
    if (pos) {
      const far = Math.hypot(pos.x - tmpV.x, pos.z - tmpV.z);
      if (activeOneShots > 28 && far > 12) return null; // ограничение числа одновременных источников: дальние тихие звуки отбрасываем
      const o = spatialOut(pos, activeOneShots > 14 && far > 8 ? 'equalpower' : 'HRTF'); g.connect(o.input);
      activeOneShots++; s.onended = () => { activeOneShots = Math.max(0, activeOneShots - 1); };
    } else g.connect(sfxBus);
    s.start(); return { start: ctx.currentTime, dur: s.buffer.duration / rate };
  }
  function shot() {
    if (!ensure()) return; if (buffers.shot) { sample('shot', 1.25, null, .97 + Math.random() * .06); return; } const t = ctx.currentTime;
    const n = ctx.createBufferSource(); n.buffer = noiseBuf(1.4, 3.5);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(9000, t); f.frequency.exponentialRampToValueAtTime(300, t + .9);
    const g = ctx.createGain(); g.gain.setValueAtTime(1.6, t); g.gain.exponentialRampToValueAtTime(.001, t + 1.4);
    n.connect(f); f.connect(g); g.connect(sfxBus); n.start(t);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(35, t + .25);
    const og = ctx.createGain(); og.gain.setValueAtTime(1.4, t); og.gain.exponentialRampToValueAtTime(.001, t + .35);
    o.connect(og); og.connect(sfxBus); o.start(t); o.stop(t + .4);
    // эхо от домов
    const e = ctx.createBufferSource(); e.buffer = noiseBuf(1.2, 4); const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 900;
    const eg = ctx.createGain(); eg.gain.value = .35; e.connect(ef); ef.connect(eg); eg.connect(sfxBus); e.start(t + .28);
  }
  function click(freq = 2400, vol = .5, delay = 0, dur = .03) {
    if (!ensure()) return; const t = ctx.currentTime + delay;
    const n = ctx.createBufferSource(); n.buffer = noiseBuf(dur, 2); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 3;
    const g = ctx.createGain(); g.gain.value = vol; n.connect(f); f.connect(g); g.connect(sfxBus); n.start(t);
  }
  let shellAlt = 0;
  const reloadOpen = () => { if (!sample('gun_open', 1)) { click(1800, .7); click(900, .5, .05, .06); } };
  const shellOut = () => { if (!sample('shell_drop', .8, null, .95 + Math.random() * .1)) { click(3200, .35); click(4200, .25, .12); } };
  const shellIn = () => { if (!sample((shellAlt++ % 2) ? 'gun_shell2' : 'gun_shell', 1)) click(1500, .5, 0, .04); };
  const reloadClose = () => { if (!sample('gun_close', 1)) { click(1200, .9, 0, .05); click(600, .6, .03, .08); } };
  const gunMove = () => sample('gun_move', .8, null, .9 + Math.random() * .2);
  function thud(vol = 1) {
    if (!ensure()) return; const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(30, t + .3);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + .4); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + .45);
    const n = ctx.createBufferSource(); n.buffer = noiseBuf(.25, 3); const ng = ctx.createGain(); ng.gain.value = vol * .6; n.connect(ng); ng.connect(sfxBus); n.start(t);
  }
  // Удар/попадание по поверхности: kind = metal | kiosk | stone | wood | glass; pellets — россыпь дроби; pos — точка в мире (объёмный звук)
  function impact(kind = 'stone', vol = 1, pos = null, pellets = false) {
    if (!ensure()) return; const t = ctx.currentTime;
    let out = sfxBus;
    if (pos) { out = spatialOut(pos, 'HRTF', 1.2, 1.15, 70).input; }
    const burst = (at, dur, decay, type, freq, q, gain) => { const n = ctx.createBufferSource(); n.buffer = noiseBuf(dur, decay); const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const gg = ctx.createGain(); gg.gain.value = gain; n.connect(f); f.connect(gg); gg.connect(out); n.start(t + at); };
    const tone = (at, f0, f1, dur, gain, type = 'sine') => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t + at); o.frequency.exponentialRampToValueAtTime(f1, t + at + dur); const gg = ctx.createGain(); gg.gain.setValueAtTime(gain, t + at); gg.gain.exponentialRampToValueAtTime(.0008, t + at + dur); o.connect(gg); gg.connect(out); o.start(t + at); o.stop(t + at + dur + .02); };
    const hits = pellets ? 9 : 1;
    for (let i = 0; i < hits; i++) {
      const at = pellets ? Math.random() * .045 : 0, v = vol * (pellets ? .38 + Math.random() * .3 : 1);
      if (kind === 'metal') { // звонкий лист железа: резкий щелчок + затухающие обертоны
        burst(at, .05, 3, 'bandpass', 2600 + Math.random() * 900, 2.5, .55 * v);
        for (const [fr, d, gv] of [[380, .55, .16], [930, .4, .1], [1720, .3, .06], [2650, .22, .04]]) tone(at, fr * (.96 + Math.random() * .08), fr * .985, d * (pellets ? .5 : 1), gv * v);
      } else if (kind === 'kiosk') { // обои на железном листе ларька: глухо, с коротким дребезгом
        tone(at, 120, 55, .22, .7 * v); burst(at, .09, 2.6, 'lowpass', 1400, .7, .6 * v); tone(at + .01, 610, 590, .16, .05 * v, 'triangle');
      } else if (kind === 'wood') { // доска: полый «тук»
        tone(at, 210, 120, .14, .55 * v); burst(at, .06, 3, 'bandpass', 950, 1.4, .5 * v);
      } else if (kind === 'glass') {
        // Реалистичный удар кулаком по стеклу с резким треском расходящихся трещин и стеклянным звоном
        tone(at, 215, 78, .14, .72 * v, 'sine'); // упругий глухой удар в стеклянное полотно
        tone(at, 460, 290, .11, .34 * v, 'triangle'); // вибрация оконной рамы и стекла
        burst(at, .065, 2.4, 'bandpass', 2950 + Math.random() * 600, 2.2, .78 * v); // резкий щелчок трескающегося стекла
        burst(at + .018, .14, 2.8, 'highpass', 4400, 1.1, .62 * v); // сухой хруст стеклянной паутинки
        for (const [dtG, fqG, durG, gnG] of [[.005, 3250, .16, .18], [.024, 4680, .14, .15], [.048, 5820, .12, .12], [.078, 3920, .15, .10], [.115, 6350, .11, .08]]) {
          const jitter = .94 + Math.random() * .12;
          tone(at + dtG, fqG * jitter, fqG * jitter * .92, durG, gnG * v, 'sine');
        }
      } else { // кирпич, бетон, штукатурка: тупой удар и шорох осыпающейся крошки
        tone(at, 95, 40, .2, .75 * v); burst(at, .07, 3, 'lowpass', 1100, .7, .65 * v);
        if (pellets || vol > .6) burst(at + .03, .25, 1.6, 'bandpass', 3200, .9, .1 * v);
      }
    }
  }
  // свист кулака по воздуху
  function strike() { if (!ensure()) return; const t = ctx.currentTime; for (let i = 0; i < 2; i++) { const n = ctx.createBufferSource(); n.buffer = noiseBuf(.09, 1.5); const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2400 + i * 900; const gg = ctx.createGain(); gg.gain.value = .32 - i * .12; n.connect(f); f.connect(gg); gg.connect(sfxBus); n.start(t + i * .07); } whoosh(.18); }
  const ksCache = new Map(); let gVoices = [null, null, null, null, null, null];
  function ksBuffer(freq) {
    const key = Math.round(freq * 100); if (ksCache.has(key)) return ksCache.get(key);
    const sr = ctx.sampleRate, dur = 3.4, n = Math.floor(sr * dur), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
    // Чистый акустический синтез струны с точной частотой (0 центов погрешности), естественными обертонами и деревянным резонансом деки
    const nHarm = Math.min(10, Math.floor((sr * 0.42) / freq));
    const amps = new Float32Array(nHarm + 1), decs = new Float32Array(nHarm + 1), phs = new Float32Array(nHarm + 1), winc = new Float32Array(nHarm + 1);
    const B = 0.00009; // лёгкая естественная негармоничность бронзовой струны
    for (let h = 1; h <= nHarm; h++) {
      const fh = freq * h * Math.sqrt(1 + B * h * h);
      winc[h] = (2 * Math.PI * fh) / sr;
      // Положение щипка у розетки (~1/5 длины струны) подавляет 5-ю гармонику и даёт тёплый акустический тембр
      const pluckPos = Math.abs(Math.sin(Math.PI * h * 0.21)) + 0.15;
      amps[h] = (1.0 / Math.pow(h, 1.32)) * pluckPos;
      decs[h] = Math.exp(-(1.15 + h * 0.68 + (freq > 220 ? 0.35 : 0)) / sr);
      phs[h] = (h * 0.6180339887) % (2 * Math.PI);
    }
    const envGrab = new Float32Array(nHarm + 1);
    for (let h = 1; h <= nHarm; h++) envGrab[h] = amps[h];
    const attackN = Math.max(12, Math.floor(sr * 0.0028));
    const bodyW1 = (2 * Math.PI * 108) / sr, bodyW2 = (2 * Math.PI * 224) / sr;
    const bodyDec = Math.exp(-18.0 / sr);
    let bodyEnv = 0.22;
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let h = 1; h <= nHarm; h++) {
        s += Math.sin(phs[h]) * envGrab[h];
        phs[h] += winc[h];
        envGrab[h] *= decs[h];
      }
      // Тёплый деревянный отклик корпуса гитары в первые 90 мс после щипка
      const bodyRes = (Math.sin(i * bodyW1) * 0.65 + Math.sin(i * bodyW2) * 0.35) * bodyEnv;
      bodyEnv *= bodyDec;
      const att = i < attackN ? Math.sin((i / attackN) * (Math.PI * 0.5)) : 1.0;
      d[i] = (s * 0.46 + bodyRes * 0.18) * att;
    }
    ksCache.set(key, b); return b;
  }
  function guitarStrum(freqs, dir = 1, vel = .8) {
    if (!ensure()) return; const t0 = ctx.currentTime;
    const order = freqs.map((f, i) => [f, i]).filter(x => x[0] > 0); if (dir < 0) order.reverse();
    const gap = .012 + (1 - vel) * .014;
    order.forEach(([f, i], k) => {
      const st = t0 + k * gap;
      const prev = gVoices[i];
      if (prev) {
        try {
          prev.g.gain.cancelScheduledValues(t0);
          prev.g.gain.setValueAtTime(Math.max(.0001, prev.g.gain.value || .08), t0);
          prev.g.gain.exponentialRampToValueAtTime(.0001, st + .018);
          prev.s.stop(st + .022);
        } catch (e) {}
      }
      const s = ctx.createBufferSource(); s.buffer = ksBuffer(f);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400 + vel * 2800 + (dir < 0 ? 500 : 0);
      const gg = ctx.createGain();
      const peak = .18 * vel * (dir < 0 && i < 2 ? .68 : 1);
      gg.gain.setValueAtTime(.0001, st);
      gg.gain.linearRampToValueAtTime(peak, st + .0035);
      gg.gain.exponentialRampToValueAtTime(.0002, st + 3.25);
      s.connect(lp); lp.connect(gg); gg.connect(sfxBus); s.start(st); s.stop(st + 3.3);
      gVoices[i] = { s, g: gg };
    });
  }
  function guitarMute(vel = .85) {
    if (!ensure()) return; const t0 = ctx.currentTime;
    // Мгновенное мягкое глушение всех звучащих струн ладонью правой руки
    for (let i = 0; i < gVoices.length; i++) {
      const v = gVoices[i];
      if (v) {
        try {
          v.g.gain.cancelScheduledValues(t0);
          v.g.gain.setTargetAtTime(.0001, t0, .012);
          v.s.stop(t0 + .065);
        } catch (e) {}
        gVoices[i] = null;
      }
    }
    // Реалистичный перкуссионный звук удара ладонью по струнам и деке («чпок / глухой щелчок»)
    const v = Math.max(.3, Math.min(1, vel));
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(148, t0); o.frequency.exponentialRampToValueAtTime(58, t0 + .065);
    const og = ctx.createGain(); og.gain.setValueAtTime(.26 * v, t0); og.gain.exponentialRampToValueAtTime(.001, t0 + .075);
    o.connect(og); og.connect(sfxBus); o.start(t0); o.stop(t0 + .08);
    const n = ctx.createBufferSource(); n.buffer = noiseBuf(.055, 3.2);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1150; bp.Q.value = 1.8;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(.22 * v, t0); ng.gain.exponentialRampToValueAtTime(.001, t0 + .05);
    n.connect(bp); bp.connect(ng); ng.connect(sfxBus); n.start(t0);
  }
  let kitN = null;
  function kitchenNoise(hiss, roar, water = 0) {
    if (!ctx || (!kitN && hiss <= 0 && roar <= 0 && water <= 0)) return; if (!ensure()) return;
    if (!kitN) { const mk = (type, fq, q) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf(2, 0); s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = fq; fl.Q.value = q; const gg = ctx.createGain(); gg.gain.value = 0; s.connect(fl); fl.connect(gg); gg.connect(sfxBus); s.start(); return gg; }; kitN = { h: mk('highpass', 3600, .7), r: mk('lowpass', 380, .9), w: mk('bandpass', 1300, .5) }; }
    const t = ctx.currentTime; kitN.h.gain.setTargetAtTime(hiss, t, .15); kitN.r.gain.setTargetAtTime(roar, t, .25); kitN.w.gain.setTargetAtTime(water, t, .2);
  }
  function whoosh(vol = .3) { if (!ensure()) return; const t = ctx.currentTime; const n = ctx.createBufferSource(); n.buffer = noiseBuf(.16, 1.2); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(1700, t + .12); f.Q.value = 1.2; const gg = ctx.createGain(); gg.gain.setValueAtTime(.0001, t); gg.gain.linearRampToValueAtTime(vol, t + .05); gg.gain.exponentialRampToValueAtTime(.0008, t + .16); n.connect(f); f.connect(gg); gg.connect(sfxBus); n.start(t); }
  function horn(pos = null, vol = 1) {
    // клаксон из файла пользователя (машины и автобус); пока файл не загрузился — прежний синтезированный сигнал
    if (sample('horn', .9 * vol, pos && pos.isVector3 ? pos : null, .97 + Math.random() * .06)) return;
    if (!ensure()) return; const t = ctx.currentTime;
    for (const fr of [392, 494]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = fr; const g = ctx.createGain(); g.gain.setValueAtTime(.06, t); g.gain.setValueAtTime(.06, t + .45); g.gain.exponentialRampToValueAtTime(.001, t + .55); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + .6); }
  }
  // писк домофона/кнопки выхода: короткий квадратный тон из динамика панели (3D)
  function beep(freq = 1000, dur = .12, vol = .2, pos = null, delay = 0) {
    if (!ensure()) return; const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.setValueAtTime(vol, t + dur - .01); g.gain.linearRampToValueAtTime(0, t + dur);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq * 1.4; f.Q.value = .8; // маленький пищалка-динамик
    o.connect(f); f.connect(g); if (pos) g.connect(spatialOut(pos, 'HRTF', .8, 1.4, 30).input); else g.connect(sfxBus);
    o.start(t); o.stop(t + dur + .02);
  }
  // электромагнитный замок: глухой «клац» якоря и короткий гул катушки
  function maglock(pos = null, release = true) {
    if (!ensure()) return; const t = ctx.currentTime;
    const n = ctx.createBufferSource(); n.buffer = noiseBuf(.09, 6); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
    const g = ctx.createGain(); g.gain.setValueAtTime(.55, t); g.gain.exponentialRampToValueAtTime(.001, t + .09);
    n.connect(f); f.connect(g); if (pos) g.connect(spatialOut(pos, 'HRTF', .8, 1.4, 30).input); else g.connect(sfxBus); n.start(t);
    if (release) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 100; const g2 = ctx.createGain(); g2.gain.setValueAtTime(.05, t); g2.gain.exponentialRampToValueAtTime(.001, t + .35); const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 300; o.connect(f2); f2.connect(g2); if (pos) g2.connect(spatialOut(pos, 'HRTF', .8, 1.4, 30).input); else g2.connect(sfxBus); o.start(t); o.stop(t + .4); }
  }
  function door(open, pos = null) { if (!ensure()) return;
    let k = 1; if (pos) { const d = Math.hypot(pos.x - tmpV.x, pos.z - tmpV.z); if (d > 40) return; k = Math.min(1, 3 / Math.max(3, d)) * (occludedAt({ x: pos.x, y: 1.2, z: pos.z }) ? .3 : 1); if (k < .03) return; }
    click(open ? 700 : 400, .5 * k, 0, .08); click(open ? 1400 : 250, .3 * k, .08, .1); }

  // ---- телефон (советская сеть: 425 Гц) и бытовые звуки ----
  let toneNode = null;
  function tone425(on, pattern) { if (!ensure()) return; if (toneNode) { try { toneNode.o.stop(); } catch (e) {} toneNode = null; } if (!on) return;
    const o = ctx.createOscillator(); o.frequency.value = 425; const g = ctx.createGain(); g.gain.value = 0; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = .5;
    o.connect(g); g.connect(f); f.connect(sfxBus); o.start(); const t = ctx.currentTime;
    if (pattern === 'ring') { for (let i = 0; i < 6; i++) { g.gain.setValueAtTime(.07, t + i * 5); g.gain.setValueAtTime(0, t + i * 5 + 1); } }
    else if (pattern === 'busy') { for (let i = 0; i < 6; i++) { g.gain.setValueAtTime(.07, t + i * .7); g.gain.setValueAtTime(0, t + i * .7 + .35); } }
    else g.gain.setValueAtTime(.06, t);
    toneNode = { o, g }; }
  function dialClicks(n) { if (!ensure()) return; for (let i = 0; i < n; i++) click(500, .35, i * .1, .02); }
  function knock() { if (!ensure()) return; const t = ctx.currentTime; for (let i = 0; i < 1; i++) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(60, t + .12); const g = ctx.createGain(); g.gain.setValueAtTime(.9, t); g.gain.exponentialRampToValueAtTime(.001, t + .18); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + .2); } click(300, .6, 0, .05); }
  function gulp() { if (!ensure()) return; for (let i = 0; i < 3; i++) { const t = ctx.currentTime + i * .38; const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(140, t + .12); const g = ctx.createGain(); g.gain.setValueAtTime(.25, t); g.gain.exponentialRampToValueAtTime(.001, t + .15); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + .16); } }

  // ---- моторы машин ----
  function addCar(id) {
    if (!ctx || cars.has(id)) return;
    // двигатель — зацикленная запись пользователя (автобус — свой звук); тон и громкость от скорости; пока запись не загружена — синтез
    const key = String(id) === 'bus' ? 'bus_engine' : 'car_engine';
    const gain = ctx.createGain(); gain.gain.value = 0;
    const panner = ctx.createPanner(); Object.assign(panner, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 2.5, rolloffFactor: 1.6, maxDistance: 120 });
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 12000;
    gain.connect(filt); filt.connect(panner); panner.connect(ambBus);
    const c = { gain, panner, filt, pos: { x: 0, z: 0 }, speed: 0, key, src: null, osc: null };
    if (buffers[key]) { const s = ctx.createBufferSource(); s.buffer = buffers[key]; s.loop = true; s.playbackRate.value = .8; s.connect(gain); s.start(0, Math.random() * buffers[key].duration); c.src = s; }
    else {
      const osc = ctx.createOscillator(); osc.type = 'sawtooth'; const osc2 = ctx.createOscillator(); osc2.type = 'triangle';
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; osc.connect(f); osc2.connect(f); f.connect(gain); osc.start(); osc2.start(); c.osc = osc; c.osc2 = osc2;
    }
    cars.set(id, c);
  }
  function carState(id, x, z, speed) { const c = cars.get(id); if (c) { c.pos.x = x; c.pos.z = z; c.speed = speed; } else if (ctx) addCar(id); }


  // Торжественный инструментальный гимн России 1992 года — «Патриотическая песня» М. И. Глинки (без слов)
  // Величественная, меланхоличная и тревожная духовая/оркестровая аранжировка для главного меню
  let anthemTimer = null, anthemPlaying = false, anthemNodes = [];
  // Мелодия М. И. Глинки «Патриотическая песня» (До мажор / Ля минор, Maestoso): [частота_мелодии_Гц, частота_баса_Гц, длительность_сек]
  const GLINKA_NOTES = [
    [523.25, 130.81, 0.72], // C5 / C3
    [392.00, 196.00, 0.72], // G4 / G3
    [523.25, 130.81, 0.72], // C5 / C3
    [659.25, 130.81, 0.54], // E5 / C3
    [587.33, 196.00, 0.18], // D5 / G3
    [523.25, 220.00, 0.54], // C5 / A3
    [493.88, 164.81, 0.18], // B4 / E3
    [440.00, 174.61, 0.72], // A4 / F3
    [392.00, 196.00, 1.44], // G4 / G3
    // Вторая фраза (торжественный подъём и меланхоличный спад)
    [659.25, 130.81, 0.72], // E5 / C3
    [698.46, 174.61, 0.72], // F5 / F3
    [783.99, 196.00, 0.72], // G5 / G3
    [523.25, 220.00, 0.72], // C5 / A3
    [587.33, 146.83, 0.72], // D5 / D3
    [659.25, 196.00, 0.72], // E5 / G3
    [587.33, 196.00, 1.44], // D5 / G3
    // Третья фраза (тревожно-минорный поворот 1992 года)
    [659.25, 220.00, 0.72], // E5 / A3
    [587.33, 164.81, 0.54], // D5 / E3
    [523.25, 220.00, 0.18], // C5 / A3
    [493.88, 164.81, 0.72], // B4 / E3
    [440.00, 220.00, 0.72], // A4 / A3
    [587.33, 146.83, 0.72], // D5 / D3
    [523.25, 130.81, 0.54], // C5 / C3
    [493.88, 196.00, 0.18], // B4 / G3
    [440.00, 174.61, 0.72], // A4 / F3
    [392.00, 196.00, 1.44], // G4 / G3
    // Финальная каденция «Славься / Патриотическая песня»
    [523.25, 130.81, 0.72], // C5 / C3
    [659.25, 130.81, 0.72], // E5 / C3
    [783.99, 174.61, 0.72], // G5 / F3
    [698.46, 146.83, 0.54], // F5 / D3
    [659.25, 196.00, 0.18], // E5 / G3
    [587.33, 196.00, 0.90], // D5 / G3
    [523.25, 130.81, 1.90], // C5 / C3
  ];
  let anthemEl = null;
  function ensureAnthemEl() {
    if (!anthemEl && typeof Audio !== 'undefined') {
      anthemEl = new Audio('assets/audio/anthem1992.mp3');
      anthemEl.loop = true;
      anthemEl.preload = 'auto';
      anthemEl.volume = st.muted ? 0 : Math.min(1, st.master);
    }
    return anthemEl;
  }
  function stopAnthemOscs() {
    if (anthemTimer) { clearTimeout(anthemTimer); anthemTimer = null; }
    for (const n of anthemNodes) { try { n.stop(); n.disconnect(); } catch (e) {} }
    anthemNodes = [];
  }
  function startMenuAnthem() {
    anthemPlaying = true;
    ensure();
    // Не ставим radioEl и cityEl на паузу в меню (чтобы AudioContext на Android WebView не засыпал),
    // а просто глушим радио в меню через radioGain = 0
    if (radioGain && ctx) {
      radioGain.gain.value = 0;
      try { radioGain.gain.setValueAtTime(0, ctx.currentTime); } catch (e) {}
    }
    const el = ensureAnthemEl();
    if (el) {
      el.volume = st.muted ? 0 : Math.min(1, st.master);
      if (el.paused) {
        el.play().catch(() => {});
      }
    }
  }
  function stopMenuAnthem() {
    anthemPlaying = false;
    stopAnthemOscs();
    if (anthemEl) {
      try {
        anthemEl.pause();
        anthemEl.currentTime = 0;
      } catch (e) {}
    }
  }
  if (typeof window !== 'undefined') {
    const resumeAnthemOnTouch = () => {
      if (!anthemPlaying) return;
      ensure();
      if (radioGain && ctx) {
        radioGain.gain.value = 0;
        try { radioGain.gain.setValueAtTime(0, ctx.currentTime); } catch (e) {}
      }
      const el = ensureAnthemEl();
      if (el && el.paused) {
        el.volume = st.muted ? 0 : Math.min(1, st.master);
        el.play().catch(() => {});
      }
    };
    window.addEventListener('pointerdown', resumeAnthemOnTouch, { passive: true });
    window.addEventListener('touchstart', resumeAnthemOnTouch, { passive: true });
    window.addEventListener('click', resumeAnthemOnTouch, { passive: true });
  }
  return {
    startMenuAnthem, stopMenuAnthem, ensure, update, step, npcStep, vinyl, beep, maglock, shot, click, sample, gunMove, now: () => ctx ? ctx.currentTime : 0, tone425, dialClicks, knock, gulp, reloadOpen, shellOut, shellIn, reloadClose, thud, horn, door, carState, impact, whoosh, strike, kitchenNoise, guitarStrum, guitarMute,
    get settings() { return st; },
    setOccluder(fn) { occluder = fn; },
    setSpace,
    setVolume(k, v) { st[k] = v; if (k === 'master') { if (master) master.gain.value = st.muted ? 0 : v; if (anthemEl) anthemEl.volume = st.muted ? 0 : Math.min(1, v); } if (k === 'ambience' && ambBus) ambBus.gain.value = v; },
    setMuted(m) { st.muted = m; if (master) master.gain.value = m ? 0 : st.master; if (anthemEl) anthemEl.volume = m ? 0 : Math.min(1, st.master); },
    radioToggle(on) { st.radioOn = on === undefined ? !st.radioOn : on; if (radioEl) { if (st.radioOn) radioEl.play().catch(() => {}); else radioEl.pause(); } return st.radioOn; },
    get radioOn() { return st.radioOn; },
    tvSetPower(on, chIdx = tvActiveChState) {
      ensure();
      tvOnState = !!on;
      tvActiveChState = ((chIdx % 5) + 5) % 5;
      syncTvAudioChannel();
      if (!tvOnState && tvGain && ctx) tvGain.gain.setTargetAtTime(0.0, ctx.currentTime, .025);
    },
    tvSetChannel(chIdx) {
      ensure();
      tvActiveChState = ((chIdx % 5) + 5) % 5;
      syncTvAudioChannel();
      click(680, .38, 0, .035);
      click(1420, .25, .028, .03);
    },
    tvChannelTime(chIdx) {
      const idx = ((chIdx % 5) + 5) % 5;
      if (tvOnState && idx === tvActiveChState && tvEl && !tvEl.paused && tvEl.currentTime > 0) {
        return tvEl.currentTime;
      }
      return getLiveTvTime(idx);
    },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
  };
}
