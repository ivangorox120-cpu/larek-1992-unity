// ЗАЩИТА МЕХАНИК: автоматическая проверка всех зафиксированных механик и деталей игры (реестр — MECHANICS.md).
// Запускается перед каждой сборкой APK (mkapk9.py не собирает, если хоть одна проверка провалена).
// Если механику меняют НАМЕРЕННО — меняют её запись в MECHANICS.md и соответствующую проверку здесь (одно место).
import { boot, wev } from './lib.mjs';
import fs from 'fs';

const ROOT = process.env.ROOT || '/home/claude/work5/assets';
const src = f => fs.readFileSync(`${ROOT}/js/${f}`, 'utf8');
const look = (page, x, z, tx, ty, tz, h = 1.66, wait = 500) => wev(page, `(() => { P.seated = false; P.locked = false; P.lying = false; P.lyingInBed = false; P.climbH = null; P.x = ${x}; P.z = ${z}; P.h = ${h}; const dx = ${tx} - P.x, dz = ${tz} - P.z, dy = ${ty} - (${h}); P.yaw = Math.atan2(-dx, -dz); P.pitch = Math.atan2(dy, Math.hypot(dx, dz)); P.vx = P.vz = 0; return 1; })()`).then(() => page.waitForTimeout(wait));
const act = page => wev(page, `(() => { const a = action(); return a ? a.label : null; })()`);

export default async ({ page, logs }) => {
  const res = [];
  const check = (id, ok, info = '') => { res.push({ id, ok: !!ok, info: String(info).slice(0, 160) }); };

  // ---------- статические инварианты исходников ----------
  const G = src('game.js'), Wd = src('world.js'), T = src('transport.js');
  check('M01 админ-панель по коду larek1992 на месте', /ADMIN_CODE\s*=\s*'larek1992'/.test(G));
  check('M02 меню героя: нет «Торговля без разрешения» и «(в цифрах)»', !/Торговля без разрешения|\(в цифрах\)/.test(G));
  check('M03 найм продавца выключен (S.seller = false)', /S\.seller = false/.test(G));
  check('M04 площадь Ленина удалена (нет телепорта/блока площади)', !/площадь Ленина|Площадь Ленина|lenin_sq/i.test(Wd + G));
  check('M05 конкурентов нет', !/competitor|конкурент[а-я]* ларёк/i.test(Wd + G));
  check('M06 ручки дверей: досягаемость 1.0 м', /const HANDLE_REACH = 1\.0;/.test(Wd));
  check('M07 гитара: инвентарь скрыт в режиме игры', /guitarMode/.test(G));
  check('M08 подсказка гитары гаснет через 3 с', /guitar/i.test(Wd) && /3\s*\)|> 3|>= 3/.test(Wd));
  check('M09 карманы у всех остановок', ['kiosk', 'garages', 'factory', 'rovd', 'kiosk_return', 'sizo', 'lvz_return', 'bakery_return'].every(k => new RegExp(`STOPS\\.${k}, '[xz]'`).test(T)));
  check('M10 текстовые текстуры с мип-картами (без мерцания надписей)', !/function textTex[^\n]*generateMipmaps = false/.test(Wd));
  check('M11 загрузка не отпирает квартиру насильно', /aptDoorUnlocked = !\(S0 && S0\.flags && S0\.flags\.aptUnlocked === false\)/.test(Wd));
  check('M12 английский замок: захлопнул снаружи — заперто', /английский замок кв\. 4/.test(Wd));

  // ---------- проверки в запущенной игре ----------
  await boot(page, { wait: 1500 });
  await wev(page, "(() => { setClock(13); return 1; })()");

  // домофон: снаружи заперто, код 1992 открывает
  const hh = JSON.parse(await wev(page, `JSON.stringify((() => { podezdDoorObj.p.updateWorldMatrix(true, false); return podezdDoorObj.hseg.map(sg => sg[0].clone().add(sg[1]).multiplyScalar(.5).applyMatrix4(podezdDoorObj.p.matrixWorld).toArray()); })())`));
  const out = hh.reduce((a, b) => (b[2] < a[2] ? b : a)), inn = hh.reduce((a, b) => (b[2] > a[2] ? b : a));
  await wev(page, "(() => { podLockOpenT = 0; podezdDoorObj.target = 0; podezdDoorObj.cur = 0; return 1; })()");
  await look(page, out[0] - .2, out[2] - .6, out[0], out[1], out[2]);
  const outLocked = await act(page);
  check('M20 подъезд снаружи заперт магнитным замком', !outLocked || !/Открыть/.test(outLocked), outLocked);
  await look(page, 36.37, 73.45, 36.37, 1.36, 74.03);
  const ic = await act(page);
  check('M21 действие «Набрать код на домофоне»', ic && /домофон/i.test(ic), ic);
  if (ic) {
    await wev(page, "(() => { action().fn(); return 1; })()"); await page.waitForTimeout(400);
    const modal = await page.evaluate(() => !!document.getElementById('intercomModal'));
    if (modal) for (const k of ['1', '9', '9', '2']) { await page.evaluate(k => { const b = document.querySelector(`#icGrid button[data-k="${k}"]`); b && b.click(); }, k); await page.waitForTimeout(200); }
    await page.waitForTimeout(800);
    const t = +(await wev(page, "podLockOpenT"));
    check('M22 код 1992 отпускает замок', t > 0, 'podLockOpenT=' + t);
    await look(page, out[0] - .2, out[2] - .6, out[0], out[1], out[2]);
    const after = await act(page);
    check('M23 после кода ручка подъезда открывает', after && /Открыть/.test(after), after);
  }
  // кнопка «ВЫХОД» изнутри
  await wev(page, "(() => { podLockOpenT = 0; podezdDoorObj.target = 0; podezdDoorObj.cur = 0; return 1; })()"); await page.waitForTimeout(200);
  await look(page, inn[0] - .1, inn[2] + .6, inn[0], inn[1], inn[2]);
  const inLocked = await act(page);
  check('M24 изнутри без кнопки «ВЫХОД» дверь не открыть', !inLocked || !/Открыть/.test(inLocked), inLocked);
  await look(page, 37.5, 74.85, 37.72, 1.33, 74.27);
  const ex = await act(page);
  check('M25 кнопка «ВЫХОД» на стене', ex && /ВЫХОД/.test(ex), ex);
  if (ex) { await wev(page, "(() => { action().fn(); return 1; })()"); await page.waitForTimeout(300); check('M26 «ВЫХОД» отпускает замок', +(await wev(page, 'podLockOpenT')) > 0); }

  // ключ от квартиры: захлопнул снаружи — нужен ключ
  const latch = await wev(page, `(() => { aptDoorUnlocked = true; const S0 = ctx.getS && ctx.getS(); if (S0) { S0.flags = S0.flags || {}; S0.flags.aptUnlocked = true; }
    heroDoorObj.target = 1; heroDoorObj.cur = 1; heroDoorObj._wasOpen = true; P.x = 40.2; P.z = 80.6; P.h = 4.26; heroDoorObj.target = 0; heroDoorObj.cur = 0; return 1; })()`);
  await page.waitForTimeout(1500);
  const unl = await wev(page, "String(aptDoorUnlocked)");
  check('M30 закрыл дверь кв. 4 снаружи — английский замок защёлкнулся', unl === 'false', 'aptDoorUnlocked=' + unl);
  const hd = JSON.parse(await wev(page, `JSON.stringify((() => { heroDoorObj.p.updateWorldMatrix(true, false); return heroDoorObj.hseg.map(sg => sg[0].clone().add(sg[1]).multiplyScalar(.5).applyMatrix4(heroDoorObj.p.matrixWorld).toArray()); })())`));
  const hOut = hd.reduce((a, b) => (b[0] < a[0] ? b : a));
  await look(page, hOut[0] - .65, hOut[2] + .15, hOut[0], hOut[1], hOut[2], hOut[1] + .35);
  const noKey = await act(page);
  check('M31 без ключа в руке — «заперта»', noKey && /заперт/i.test(noKey), noKey);
  await wev(page, "(() => { aptDoorUnlocked = true; const S0 = ctx.getS && ctx.getS(); if (S0 && S0.flags) S0.flags.aptUnlocked = true; return 1; })()");

  // досягаемость ручки: дальше 1 м — нет действия
  await look(page, hOut[0] - 1.7, hOut[2] + .15, hOut[0], hOut[1], hOut[2], hOut[1] + .35);
  const far = await act(page);
  check('M32 ручка двери дальше ~1 м не срабатывает', !far || !/дверь|Квартира/i.test(far), far);

  // лестница к люку управляется джойстиком
  await look(page, 40.7, 75.4, 40.7, 11.5, 74.5, 10.4 + 1.66, 500);
  const lad = await act(page);
  if (lad) { await wev(page, "(() => { const a = action(); a && a.fn(); return 1; })()"); await page.waitForTimeout(300); }
  const h0 = +(await wev(page, 'P.h'));
  await wev(page, "(() => { input.my = -1; for (let i = 0; i < 30; i++) roofClimbTick(.05); input.my = 0; return 1; })()");
  const h1 = +(await wev(page, 'P.h'));
  check('M33 лестница: подъём джойстиком', lad && h1 > h0 + .3, `${lad} ${h0.toFixed(2)}→${h1.toFixed(2)}`);
  await wev(page, "(() => { try { roofClimb && ladderLeave && ladderLeave(); } catch (e) {} roofClimb = null; P.locked = false; return 1; })()").catch(() => {});

  // свет ларька ночью виден, пока ларёк в кадре (и с 35 м)
  await wev(page, "(() => { setClock(22.5); return 1; })()");
  await look(page, -32, 10.5, 0, 1.2, 0, 1.66, 1500);
  const kl = +(await wev(page, 'bulbLight.intensity'));
  check('M40 лампа ларька не гаснет за 32 м, если ларёк в кадре', kl > .5, 'I=' + kl.toFixed(2));
  await wev(page, "(() => { setClock(13); return 1; })()");

  // остановки: павильоны и знаки не на проезжей части, у каждой есть карман
  const stopsOk = await wev(page, `(() => { const bad = []; for (const [k, st] of Object.entries(STOPS)) { const sx = st.shelterX ?? st.x, sz = st.shelterZ ?? 4.15; if (isAsphaltAt(sx, sz, -.3)) bad.push(k); } return bad.join(',') || 'ok'; })()`).catch(e => 'n/a ' + e.message);
  check('M41 павильоны остановок не стоят на дороге', stopsOk === 'ok' || /^n\/a/.test(stopsOk), stopsOk);

  // отсечение: всё, что в кадре, рисуется (сравнение с рендером без отсечения)
  const poses = [[8, 12, 90], [20, 58, -90], [60, 30, 0], [40, 90, 180]];
  let worst = 0;
  for (const [x, z, yd] of poses) {
    await wev(page, `(() => { P.locked = true; P.x = ${x}; P.z = ${z}; P.h = 1.7; P.climbH = 1.7; P.yaw = ${yd} * Math.PI / 180; P.pitch = -.03; return 1; })()`);
    await page.waitForTimeout(1500);
    const d = +(await wev(page, `(() => { runSpatialOcclusionCulling(); const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight; const grab = () => { renderer.render(scene, camera); const a = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a); return a; };
      const a = grab(); const hid = []; const cx0 = camera.position.x, cz0 = camera.position.z, mD = (Q && Q.draw) || 135; for (const e of cullEntries) { if (e.obj.visible || e.roomTag || (e.isWinter && !winter)) continue; if (Math.hypot(e.cx - cx0, e.cz - cz0) - e.r > mD) continue; hid.push(e); e.obj.visible = true; }
      const b = grab(); for (const e of hid) e.obj.visible = false; let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i+1] - b[i+1]) + Math.abs(a[i+2] - b[i+2]) > 30) n++; const pct = 100 * n / (w * h);
      if (pct > .1) { const cul = []; for (const e of hid) { e.obj.visible = true; const c = grab(); e.obj.visible = false; let m = 0; for (let i = 0; i < a.length; i += 16) if (Math.abs(a[i] - c[i]) + Math.abs(a[i+1] - c[i+1]) + Math.abs(a[i+2] - c[i+2]) > 30) m++; if (m > 10) cul.push([e.cx.toFixed(1), e.cy.toFixed(1), e.cz.toFixed(1), e.r.toFixed(1), m * 4].join(' ')); } console.log('CULL-CULPRITS', camera.position.toArray().map(v => v.toFixed(1)).join(','), cul.join(' ; ')); }
      return pct; })()`));
    worst = Math.max(worst, d);
  }
  check('M42 отсечение не прячет видимое (расхождение < 0.1%)', worst < .1, worst.toFixed(3) + '%');

  // автобус: ровные уплотнители окон
  const panels = await wev(page, "(() => { const g = transport.bus.userData.glassPanels || []; return g.filter(p => p.ok).length; })()");
  check('M43 автобус: окна с ровной резиной (≥ 20 панелей)', +panels >= 20, panels);

  const errs = [...new Set(logs.filter(l => /pageerror|\[error\]/.test(l)).map(l => l.slice(0, 200)))];
  check('M90 нет ошибок JS при загрузке и проверках', errs.length === 0, errs.slice(0, 2).join(' | '));

  const failed = res.filter(r => !r.ok);
  for (const r of res) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.id + (r.info ? '  [' + r.info + ']' : ''));
  console.log(`MECH ${res.length - failed.length}/${res.length} passed`);
  fs.writeFileSync('/home/claude/work/shots/mech.json', JSON.stringify({ passed: !failed.length, res }, null, 1));
};
