// Быт ларька: физические предметы (коробки), доставка, телефон, блокнот на прилавке, руки, курение, выпивка, опьянение.
import * as THREE from 'three';
import { makeRigHand, makeBrawlerFist, makeCigarette, HAND_POSES } from './hand.js';
import { createPhone } from './phone.js';

const R = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export function createLife(env) {
  const { scene, camera, P, ctx, KW, KD, std, colliders, addCol } = env;
  const S = () => ctx.getS();
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), ray = new THREE.Raycaster();

  // ================= поверхности, на которые можно ставить (включая все 4 задние полки SH_BACK и все 3 боковые полки SH_SIDE справа от окна) =================
  const SURF = [
    { name: 'floor',   y: .035,  x1: -KW + .08, x2: KW - .08,  z1: -KD + .08, z2: KD - .50 },
    { name: 'chair',   y: .465,  x1: -.24,      x2: .24,       z1: .01,       z2: .47 },
    { name: 'bench',   y: .46,   x1: -11.55,    x2: -8.05,     z1: .72,       z2: 1.38 },
    { name: 'counter', y: 1.005, x1: -1.42,     x2: 1.42,      z1: KD - .44,  z2: KD - .02 },
    // 4 задние полки (SH_BACK = 0.75, 1.20, 1.65, 2.05)
    { name: 'shelf',   y: .763,  x1: -1.14,     x2: .27,       z1: -KD + .02, z2: -KD + .33, axis: 'x', rowIdx: 0 },
    { name: 'shelf',   y: 1.213, x1: -1.14,     x2: .27,       z1: -KD + .02, z2: -KD + .33, axis: 'x', rowIdx: 1 },
    { name: 'shelf',   y: 1.663, x1: -1.14,     x2: .27,       z1: -KD + .02, z2: -KD + .33, axis: 'x', rowIdx: 2 },
    { name: 'shelf',   y: 2.063, x1: -1.14,     x2: .27,       z1: -KD + .02, z2: -KD + .33, axis: 'x', rowIdx: 3 },
    // 3 боковые полки справа от окна ларька (SH_SIDE = 0.85, 1.30, 1.75)
    { name: 'shelf',   y: .863,  x1: -KW + .02, x2: -KW + .33, z1: -.78,      z2: .38,       axis: 'z', rowIdx: 4 },
    { name: 'shelf',   y: 1.313, x1: -KW + .02, x2: -KW + .33, z1: -.42,      z2: .38,       axis: 'z', rowIdx: 5 },
    { name: 'shelf',   y: 1.763, x1: -KW + .02, x2: -KW + .33, z1: -.78,      z2: .38,       axis: 'z', rowIdx: 6 },
    // 4 стеклянные полки витрины над прилавком у окна (левая и правая стороны, нижний и верхний ярусы)
    // ниша под прилавком (товар «из-под полы»)
    { name: 'shelf',   y: .42,   x1: -.52,      x2: .52,       z1: KD - .42,  z2: KD - .08,  axis: 'x', rowIdx: 7 },
    { name: 'shelf',   y: 1.368, x1: -1.33,     x2: -.47,      z1: KD - .32,  z2: KD - .02,  axis: 'x', rowIdx: 17 },
    { name: 'shelf',   y: 1.768, x1: -1.33,     x2: -.47,      z1: KD - .32,  z2: KD - .02,  axis: 'x', rowIdx: 18 },
    { name: 'shelf',   y: 1.368, x1: .47,      x2: 1.33,       z1: KD - .32,  z2: KD - .02,  axis: 'x', rowIdx: 19 },
    { name: 'shelf',   y: 1.768, x1: .47,      x2: 1.33,       z1: KD - .32,  z2: KD - .02,  axis: 'x', rowIdx: 20 },
    // потайной сейф в утолщённой правой стене за плакатом: 2 полноценные небольшие полочки (y = 0.913 и y = 1.133) внутри стены (x = 1.475..1.645)
    { name: 'safe',    y: .913,  x1: KW - .025, x2: KW + .145, z1: -.81,      z2: -.23,      axis: 'z', safe: true, safeTier: 0 },
    { name: 'safe',    y: 1.133, x1: KW - .025, x2: KW + .145, z1: -.81,      z2: -.23,      axis: 'z', safe: true, safeTier: 1 },
  ];
  const safeOpen = () => !!(env.safeOpen && env.safeOpen());
  const inSafeBox = (x, y, z) => x > KW - .06 && x < KW + .20 && z > -.85 && z < -.19 && y > .86 && y < 1.40;
  const fitsSafe = it => it && it.kind !== 'box' && it.kind !== 'gun';
  // полки шкафчиков, холодильников, духовки, столы и подоконники квартиры (передаются из world.js)
  if (env.extraSurfs) for (const s of env.extraSurfs) SURF.push(s);
  const HZ = env.hideZones || [];
  const inZ = (h, x, y, z) => x > h.x1 && x < h.x2 && y > h.y1 - .02 && y < h.y2 && z > h.z1 && z < h.z2;
  const hiddenAt = (x, y, z) => { for (const h of HZ) if (!h.open() && inZ(h, x, y, z)) return true; return false; };
  const openZoneAt = (x, y, z) => { for (const h of HZ) if (h.open() && inZ(h, x, y, z)) return true; return false; };
  const _surfBox = new THREE.Box3(), _surfHit = new THREE.Vector3();
  const inK = (x, z) => Math.abs(x) < KW && Math.abs(z) < KD;
  // Проверка попадания точки (x, z) внутрь открытой коробки (с учётом поворота коробки)
  function pointInBox(x, z, box, margin = .015) {
    const dx = x - box.obj.position.x, dz = z - box.obj.position.z;
    const c = Math.cos(box.obj.rotation.y), s = Math.sin(box.obj.rotation.y);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    return {
      inside: Math.abs(lx) < box.half.x - margin && Math.abs(lz) < box.half.z - margin,
      lx, lz, c, s
    };
  }
  function findOpenBoxAt(x, z, y = 0, ignore = null) {
    for (const it of items) {
      if (it === ignore || it.kind !== "box" || !it.data.opened || it.state !== "rest") continue;
      if (y < it.obj.position.y - .05 || y > it.obj.position.y + it.half.y * 2 + .25) continue;
      if (pointInBox(x, z, it, .01).inside) return it;
    }
    return null;
  }
  function groundHeightAt(x, z, yTop = null) {
    if (inK(x, z)) return .035;
    // плоская крыша дома № 14 (над подъездом и квартирами)
    if (x > 27.4 && x < 56.6 && z > 74.15 && z < 83.85 && ((yTop != null ? yTop : P.h - 1.0) > 12.75) && !(x > 40.35 && x < 41.05 && z > 74.35 && z < 75.15)) return 12.87;
    // перрон станции
    if (z >= -87.3 && z <= -83.1 && x >= -52.96 && x <= 44.96) { if (x >= -52 && x <= 44) return .565; const d = x < -52 ? x + 52.96 : 44.96 - x; return Math.min(.54, .18 * Math.ceil(d / .32 - 1e-6)) + .01; }
    // Подъезд дома 14: двухмаршевая лестница до 5-го этажа — уровень выбираем по высоте предмета
    if (x >= 34.8 && x <= 41.2 && z >= 73.9 && z <= 83.8) {
      const kN = clamp((z - 76.0) / 4.6, 0, 1), cand = z < 76.0 ? [0, 5.2, 10.4] : z > 80.6 ? [0, 2.6, 7.8] : x >= 37.07 ? [kN * 2.6, 5.2 + kN * 2.6] : [0, 2.6 + (1 - kN) * 2.6, 7.8 + (1 - kN) * 2.6];
      const yy = yTop == null ? 3 : yTop; let best = -1; for (const c of cand) if (c <= yy + .06 && c > best) best = c;
      if (best < 0) best = cand[0];
      return best + (z > 80.6 && best === 2.6 ? .012 : .025);
    }
    if (x >= 45.40 && x <= 47.70 && z >= 75.57 && z <= 78.83) {
      return 2.664; // ковёр в жилой комнате (AY + 0.064)
    }
    if (x >= 41.15 && x <= 44.02 && z >= 74.22 && z <= 77.44) {
      return 2.658; // чёрно-белая плитка кухни (AY + 0.058)
    }
    if (x >= 41.10 && x <= 49.60 && z >= 74.20 && z <= 83.80) {
      return 2.654; // паркет и дощатый пол квартиры (AY + 0.054)
    }
    if (x >= 34.8 && x <= 41.2 && z > 80.6 && z <= 83.8) {
      return 2.612; // площадка 2-го этажа подъезда
    }
    if ((z > 1.2 && z < 6.2) || (z > 14.2 && z < 19.0)) return .026;
    return .022;
  }
  // Высота потолка в текущей точке (внутри ларька y = 2.46, под лампочкой 2.18, в автобусе 2.38, в помещениях города 3.12..5.58)
  function ceilingHeightAt(x, z) {
    if (Math.abs(x) < KW + .20 && Math.abs(z) < KD + .20) {
      if (Math.hypot(x, z) < .20) return 2.18; // висящая лампочка на шнуре под потолком ларька
      return 2.46; // потолок ларька (2.46 м)
    }
    const tr = env.transport && env.transport();
    if (tr && tr.isInsideBus && tr.isInsideBus(x, z, .05)) return (tr.bus ? tr.bus.position.y : 0) + 2.38;
    if (x >= 34.8 && x <= 49.6 && z >= 73.5 && z <= 83.8) {
      if (P.h > 13.2) return 999; // на крыше
      if (x < 41.15) { const lv = Math.max(0, Math.floor((P.h - 1.2) / 2.6)); return Math.min(12.62, (lv + 1) * 2.6 - .12); } // лестничная клетка: потолок своего этажа
      return 5.58;
    }
    if (x > -130.1 && x < -117.9 && z > -6.9 && z < -0.7) return 4.10;
    if (x > 95.9 && x < 104.3 && z > 31.7 && z < 40.3) return 3.70;
    if (x > -53.1 && x < -38.9 && z > 31.9 && z < 42.1) return 3.70;
    if (x > -108.5 && x < -99.9 && z > 43.7 && z < 52.3) return 3.70;
    if (x > -138.1 && x < -121.9 && z > 67.5 && z < 85.0) return 3.75;
    return 999;
  }
  function itemWorldHalf(it, customYaw = null) {
    const ry = customYaw != null ? customYaw : (it && it.obj ? it.obj.rotation.y : 0);
    const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
    const hx0 = (it && it.half && it.half.x) || .05;
    const hz0 = (it && it.half && it.half.z) || .05;
    const hy0 = (it && it.half && it.half.y) || .04;
    return {
      hx: hx0 * c + hz0 * s,
      hz: hx0 * s + hz0 * c,
      hy: hy0,
      h: hy0 * 2
    };
  }
  function shelfPlacementObstacle(p) {
    const gp = GOOD_PHYS[p.id] || GOOD_PHYS.cig;
    const hx0 = gp.r || gp.hx || .045;
    const hz0 = gp.r || gp.hz || .045;
    const h = gp.shape === 'bottle' ? gp.h : gp.shape === 'can' ? gp.h : (gp.hy * 2);
    const ry = p.ry || 0;
    const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
    return {
      isShelfPlacement: true,
      id: p.id,
      uid: p.uid,
      x: p.x,
      y: p.y,
      z: p.z,
      ry,
      hx: hx0 * c + hz0 * s,
      hz: hx0 * s + hz0 * c,
      hy: h * .5,
      h,
      stack: gp.shape !== 'bottle'
    };
  }
  function getAllObstacles(ignoreItem = null) {
    const out = [];
    for (const o of items) {
      // Никогда не учитываем предметы, лежащие внутри открытой коробки (o.inBoxId), как внешние препятствия или опору!
      if (o === ignoreItem || o.state !== "rest" || o.inBoxId) continue;
      const ext = itemWorldHalf(o);
      const isBottlePack = o.kind === "pack" && ["vodka", "beer", "samogon", "soda"].includes(o.data && o.data.goodId);
      out.push({
        isShelfPlacement: false,
        itemRef: o,
        kind: o.kind,
        id: (o.data && o.data.goodId) || o.kind,
        x: o.obj.position.x,
        y: o.obj.position.y,
        z: o.obj.position.z,
        ry: o.obj.rotation.y,
        hx: ext.hx,
        hz: ext.hz,
        hy: ext.hy,
        h: ext.h,
        stack: !!(o.stack && !isBottlePack)
      });
    }
    if (env.deadBodies) {
      for (const b of env.deadBodies()) {
        const gY = b.groundY || 0;
        out.push({
          isShelfPlacement: false,
          kind: "body",
          id: "body",
          x: b.cx,
          y: gY,
          z: b.cz,
          ry: 0,
          hx: (b.x2 - b.x1) * .5,
          hz: (b.z2 - b.z1) * .5,
          hy: (b.y - gY) * .5,
          h: b.y - gY,
          stack: true
        });
      }
    }
    const s = S();
    if (s && Array.isArray(s.shelfPlacements)) {
      for (const p of s.shelfPlacements) {
        out.push(shelfPlacementObstacle(p));
      }
    }
    return out;
  }
  function canStackHeldOnBase(heldItem, hExt, baseObs) {
    if (!baseObs || !heldItem) return false;
    if (isFloorFurniture(heldItem)) return false;
    if (baseObs.kind === "body") return true;
    if (heldItem.kind === "box") {
      return baseObs.kind === "box" || (baseObs.id && FURNITURE_SURFS[baseObs.id] && !FLOOR_FURNITURE_SET.has(baseObs.id));
    }
    if (baseObs.kind === "box" || (baseObs.id && FURNITURE_SURFS[baseObs.id])) {
      return true;
    }
    if (!baseObs.stack) return false;
    return (hExt.hx <= baseObs.hx + .08 && hExt.hz <= baseObs.hz + .08);
  }
  // Разрешение наложений и вертикальное складывание стопкой («вверх по одной») с учётом И предметов life.items, И товаров на полках S.shelfPlacements
  function resolveItemSpot(x, y, z, heldItem, surf = null) {
    if (!heldItem) return { x, y, z, blocked: false };
    const hExt = itemWorldHalf(heldItem, surf && surf.axis === 'z' ? Math.PI / 2 : surf && surf.axis === 'x' ? 0 : (P.yaw + heldYaw));
    let curX = x, curY = y, curZ = z;
    const isSafeSurf = !!(surf && (surf.safe || inSafeBox(x, y, z)));
    if (isSafeSurf) {
      const sX1 = surf.x1 != null ? surf.x1 : (KW - .025);
      const sX2 = surf.x2 != null ? surf.x2 : (KW + .145);
      const sZ1 = surf.z1 != null ? surf.z1 : -.81;
      const sZ2 = surf.z2 != null ? surf.z2 : -.23;
      const safeHx = Math.min(hExt.hx, .055);
      const safeHz = Math.min(hExt.hz, .085);
      curX = clamp(curX, sX1 + safeHx + .004, Math.max(sX1 + safeHx + .004, sX2 - safeHx - .004));
      curZ = clamp(curZ, sZ1 + safeHz + .004, sZ2 - safeHz - .004);
    }
    const obstacles = getAllObstacles(heldItem);

    if (inK(curX, curZ) && !isSafeSurf && !inSafeBox(curX, curY, curZ)) {
      const wallPadX = Math.min(.48, hExt.hx + .03);
      const wallPadZ = Math.min(.48, hExt.hz + .03);
      curX = clamp(curX, -KW + wallPadX, KW - wallPadX);
      curZ = clamp(curZ, -KD + wallPadZ, KD - wallPadZ);
    }
    const isGuitarHeld = !!(heldItem && heldItem.kind === 'good' && heldItem.data && heldItem.data.goodId === 'guitar');
    const colTopHeight = (b, flY) => {
      const tg = b.tag;
      if (tg === 'zil_fridge') return flY + 1.52;
      if (tg === 'shelf') return flY + 1.74;
      if (tg === 'counter') return flY + 0.88;
      if (tg === 'radiola') return flY + 0.88;
      if (tg === 'writing_desk') return flY + 0.77;
      if (tg === 'table') return (b.x1 > 45.8 && b.x2 < 46.8) ? (flY + 0.505) : (flY + 0.745);
      if (tg === 'tv_stand') return flY + 0.59;
      if (tg === 'hero_bed') return flY + 0.525;
      if (tg === 'bathtub') return flY + 0.58;
      if (tg === 'chair' || tg === 'bunk' || tg === 'busstop_bench') return flY + 0.455;
      return flY + 2.60;
    };
    const collidesAt = (tx, ty, tz) => {
      if (isSafeSurf || inSafeBox(tx, ty, tz)) {
        if (tx < KW - .035 || tx > KW + .165 || tz < -.825 || tz > -.215) return { wall: true };
      } else if (inK(tx, tz)) {
        if (tx - hExt.hx < -KW + .02 || tx + hExt.hx > KW - .02 || tz - hExt.hz < -KD + .02 || tz + hExt.hz > KD - .02) return { wall: true };
      }
      // Запрет протыкания верхних полок и столешниц высокими предметами (гитарой, бутылками, банками и т.д.)
      const checkH = isGuitarHeld ? Math.max(hExt.h, 0.92) : hExt.h;
      for (const sUp of SURF) {
        if (sUp === surf) continue;
        if (sUp.y > ty + 0.03 && sUp.y < ty + checkH - 0.01) {
          if (tx + hExt.hx > sUp.x1 + 0.01 && tx - hExt.hx < sUp.x2 - 0.01 && tz + hExt.hz > sUp.z1 + 0.01 && tz - hExt.hz < sUp.z2 - 0.01) {
            return { wall: true };
          }
        }
      }
      // Запрет установки предмета внутрь твёрдых моделей мебели и стен (colliders)
      const flHere = groundHeightAt(tx, tz);
      const rPad = isGuitarHeld ? 0.14 : Math.max(0.035, Math.min(hExt.hx, hExt.hz) * 0.75);
      // только для пола/земли: полки, прилавок и столешницы сами находятся внутри своих коллайдеров (иначе нельзя выложить товар на полки ларька)
      if ((!surf || surf.name === 'floor') && !openZoneAt(tx, ty + 0.03, tz)) {
        for (const b of colliders) {
          if (!b || b.tag === 'item' || b.tag === 'small_item' || b.tag === 'door' || b.tag === 'bus' || b.tag === 'bush' || b.tag === 'sign') continue;
          if (b.tag === 'bathtub' && tx > 41.40 && tx < 42.73 && tz > 79.24 && tz < 79.71) continue;
          const topY = colTopHeight(b, flHere);
          if (ty < topY - 0.025) {
            if (tx + rPad > b.x1 && tx - rPad < b.x2 && tz + rPad > b.z1 && tz - rPad < b.z2) {
              return { wall: true };
            }
          }
        }
      }
      return obstacles.find(o => {
        const vertHit = (ty < o.y + o.h - .004) && (ty + hExt.h > o.y + .004);
        if (!vertHit) return false;
        const dx = Math.abs(tx - o.x), dz = Math.abs(tz - o.z);
        return dx < (hExt.hx + o.hx - .002) && dz < (hExt.hz + o.hz - .002);
      });
    };

    // 1) Проверяем, не наведён ли предмет прямо на другой предмет/стопку, на который его можно положить сверху («вверх по одной»)
    const underStack = obstacles.filter(o => {
      if (!canStackHeldOnBase(heldItem, hExt, o)) return false;
      const dx = Math.abs(curX - o.x), dz = Math.abs(curZ - o.z);
      return dx < Math.max(hExt.hx, o.hx) * .68 && dz < Math.max(hExt.hz, o.hz) * .68 && o.y >= curY - .05 && o.y < curY + .38;
    });
    if (underStack.length > 0) {
      underStack.sort((a, b) => (b.y + b.h) - (a.y + a.h));
      const topObs = underStack[0];
      const nextY = topObs.y + topObs.h;
      const maxAllowance = (surf && surf.name === 'shelf') ? (surf.y + .34) : (surf && surf.safe) ? (surf.y + .20) : (curY + 1.85);
      if (nextY + hExt.h <= maxAllowance && !collidesAt(topObs.x, nextY, topObs.z)) {
        return { x: topObs.x, y: nextY, z: topObs.z, stackedOn: topObs, blocked: false };
      }
    }

    // 2) Проверяем боковое пересечение с любыми предметами (включая бутылки и газеты на полках S.shelfPlacements!)
    const firstHit = collidesAt(curX, curY, curZ);
    if (!firstHit) return { x: curX, y: curY, z: curZ, blocked: false };

    // Ищем ближайшее свободное место на этой же полке / прилавке / полу без наложения моделек
    if (surf && (surf.name === 'shelf' || surf.name === 'counter' || surf.name === 'safe')) {
      const padX = Math.min(.07, Math.max(.04, hExt.hx * .85));
      const padZ = Math.min(.07, Math.max(.04, hExt.hz * .85));
      const minX = surf.x1 + padX, maxX = surf.x2 - padX;
      const minZ = surf.z1 + padZ, maxZ = surf.z2 - padZ;
      for (let step = .02; step <= 1.65; step += .02) {
        for (const dir of [1, -1]) {
          const tx = surf.axis === 'z' ? clamp(curX, minX, maxX) : clamp(curX + dir * step, minX, maxX);
          const tz = surf.axis === 'x' ? clamp(curZ, minZ, maxZ) : clamp(curZ + dir * step, minZ, maxZ);
          if (!collidesAt(tx, curY, tz)) return { x: tx, y: curY, z: tz, blocked: false };
        }
      }
    } else {
      for (let r = .03; r <= .65; r += .03) {
        for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1],[.7,.7],[-.7,.7],[.7,-.7],[-.7,-.7]]) {
          const tx = curX + dx * r, tz = curZ + dz * r;
          if (!collidesAt(tx, curY, tz)) return { x: tx, y: curY, z: tz, blocked: false };
        }
      }
    }

    // 3) Если сбоку места нет, но на предмет firstHit можно положить сверху — кладём сверху!
    if (canStackHeldOnBase(heldItem, hExt, firstHit)) {
      const nextY = firstHit.y + firstHit.h;
      const maxAllowance = (surf && surf.name === 'shelf') ? (surf.y + .34) : (surf && surf.safe) ? (surf.y + .20) : (curY + 1.85);
      if (nextY + hExt.h <= maxAllowance && !collidesAt(firstHit.x, nextY, firstHit.z)) {
        return { x: firstHit.x, y: nextY, z: firstHit.z, stackedOn: firstHit, blocked: false };
      }
    }
    return { x: curX, y: curY, z: curZ, blocked: true };
  }

  function surfaceBelow(x, z, yTop, forItem = null) {
    let best = groundHeightAt(x, z, yTop);
    const tr = env.transport && env.transport();
    if (tr && tr.isInsideBus && tr.isInsideBus(x, z, .08)) {
      const by = tr.busSurfaceAt(x, z, yTop);
      if (by > best && by <= yTop + .16) best = by;
    }
    const isFloorFurn = isFloorFurniture(forItem);
    if (isFloorFurn) return best;
    const isGuitarItem = !!(forItem && forItem.kind === "good" && forItem.data && forItem.data.goodId === "guitar");
    for (const s of SURF) {
      if (forItem && (forItem.kind === "box" || isGuitarItem) && s.name === "shelf") continue;
      const m = s.safe ? .03 : .02;
      if (x >= s.x1 - m && x <= s.x2 + m && z >= s.z1 - m && z <= s.z2 + m && s.y <= yTop + .09 && s.y > best) best = s.y;
    }
    // Верхние и нижние полки переносимых столиков, табуреток и стульев (с учётом их текущего поворота rotation.y!)
    for (const it of items) {
      if (!it || it === forItem || it === held || it.inBoxId || it.state !== "rest" || it.kind !== "good" || !it.data || typeof FURNITURE_SURFS === "undefined") continue;
      const gid = it.data.goodId;
      const fg = FURNITURE_SURFS[gid];
      if (!fg) continue;
      const dx = x - it.obj.position.x, dz = z - it.obj.position.z;
      const c = Math.cos(it.obj.rotation.y || 0), s = Math.sin(it.obj.rotation.y || 0);
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      const inTop = fg.r ? (Math.hypot(dx, dz) <= fg.r + .015) : (Math.abs(lx) <= fg.hx + .015 && Math.abs(lz) <= fg.hz + .015);
      if (!inTop) continue;
      if (fg.lowY) {
        const ly = it.obj.position.y + fg.lowY;
        const inLow = fg.lowR ? (Math.hypot(dx, dz) <= fg.lowR + .015) : inTop;
        if (inLow && ly <= yTop + .09 && ly > best) best = ly;
      }
      const ty = it.obj.position.y + fg.topY;
      if (ty <= yTop + .09 && ty > best) best = ty;
    }
    if (env.deadBodies) {
      for (const b of env.deadBodies()) {
        if (x > b.x1 && x < b.x2 && z > b.z1 && z < b.z2 && b.y <= yTop + .12 && b.y > best) best = b.y;
      }
    }
    for (const it of items) {
      if (it === forItem || it.inBoxId || it.state !== "rest" || !it.stack) continue;
      if (it.kind === "good" && it.data && FURNITURE_SURFS[it.data.goodId]) continue;
      const { inside } = pointInBox(x, z, it, -.01);
      if (!inside) continue;
      if (it.kind === "box") {
        if (it.data && it.data.opened) {
          if (forItem && forItem.kind === "box") {
            const surfY = it.obj.position.y + it.half.y * 2;
            if (surfY <= yTop + .08 && surfY > best) best = surfY;
          } else {
            const surfY = it.obj.position.y + .028;
            if (surfY <= yTop + .08 && surfY > best) best = surfY;
          }
        } else {
          const surfY = it.obj.position.y + it.half.y * 2;
          if (surfY <= yTop + .08 && surfY > best) best = surfY;
        }
        continue;
      }
      const surfY = it.obj.position.y + it.half.y * 2;
      if (surfY <= yTop + .08 && surfY > best) best = surfY;
    }
    return best;
  }
  function rayPlace(maxD, heldItem) {
    ray.setFromCamera(new THREE.Vector2(0, 0), camera); const o = ray.ray.origin, d = ray.ray.direction;
    let best = null;
    const isFloorFurnHeld = isFloorFurniture(heldItem);
    const isGuitarHeld = !!(heldItem && heldItem.kind === "good" && heldItem.data && heldItem.data.goodId === "guitar");
    const cand = isFloorFurnHeld ? [] : SURF.filter(s => !(heldItem && (heldItem.kind === "box" || isGuitarHeld) && s.name === "shelf") && !(s.safe && (!safeOpen() || !fitsSafe(heldItem))) && !(s.gate && !s.gate()));
    const tr = env.transport && env.transport();
    if (tr && (tr.onBoard || tr.doorK > .4 || tr.isInsideBus(P.x, P.z, .6))) {
      // Внутри автобуса можно ставить вещи на пол салона (y=0.775), на сиденья (y=1.15) и на капот (y=1.31)
      cand.push({ name: "bus_floor", y: .775, x1: P.x - 3.5, x2: P.x + 3.5, z1: P.z - 3.5, z2: P.z + 3.5, busCheck: true });
      cand.push({ name: "bus_seat",  y: 1.15, x1: P.x - 2.6, x2: P.x + 2.6, z1: P.z - 2.6, z2: P.z + 2.6, busCheck: true });
      cand.push({ name: "bus_hood",  y: 1.31, x1: P.x - 2.6, x2: P.x + 2.6, z1: P.z - 2.6, z2: P.z + 2.6, busCheck: true });
    }
    if (!inK(P.x, P.z)) {
      if (P.h > 2.2 && P.x >= 41.10 && P.x <= 49.60 && P.z >= 74.20 && P.z <= 83.80) {
        cand.push({ name: "floor", apt: true, noWall: true, y: 2.654, x1: 41.12, x2: 49.55, z1: 74.22, z2: 83.75 });
      } else {
        cand.push({ name: "ground", y: groundHeightAt(P.x, P.z), x1: -999, x2: 999, z1: -999, z2: 999 });
      }
    }
    if (env.deadBodies) {
      for (const b of env.deadBodies()) {
        cand.push({ name: "body", y: b.y, x1: b.x1, x2: b.x2, z1: b.z1, z2: b.z2 });
      }
    }
    if (!isFloorFurnHeld) for (const it of items) if (it !== heldItem && it.state === "rest" && !it.inBoxId) {
      const p = it.obj.position;
      if (hiddenAt(p.x, p.y + .02, p.z)) continue;
      const itemInSafe = inSafeBox(p.x, p.y, p.z);
      if (itemInSafe && (!safeOpen() || !fitsSafe(heldItem))) continue;
      if (it.kind === "box") {
        const ext = itemWorldHalf(it);
        if (it.data && it.data.opened) {
          if (heldItem && heldItem.kind === "box") {
            cand.push({ name: "item", itemRef: it, box: it, y: p.y + ext.h, x1: p.x - ext.hx, x2: p.x + ext.hx, z1: p.z - ext.hz, z2: p.z + ext.hz });
          } else {
            cand.push({ name: "box_inside", itemRef: it, box: it, y: p.y + .028, x1: p.x - ext.hx + .02, x2: p.x + ext.hx - .02, z1: p.z - ext.hz + .02, z2: p.z + ext.hz - .02 });
          }
        } else {
          cand.push({ name: "item", itemRef: it, box: it, y: p.y + ext.h, x1: p.x - ext.hx - .02, x2: p.x + ext.hx + .02, z1: p.z - ext.hz - .02, z2: p.z + ext.hz + .02 });
        }
        continue;
      }
      if (heldItem && heldItem.kind === "box") continue;
      if (it.kind === "good" && it.data && FURNITURE_SURFS[it.data.goodId]) {
        const fg = FURNITURE_SURFS[it.data.goodId];
        const c = Math.abs(Math.cos(it.obj.rotation.y || 0)), s = Math.abs(Math.sin(it.obj.rotation.y || 0));
        const hx0 = fg.r || fg.hx || .22, hz0 = fg.r || fg.hz || .22;
        const hx = fg.r ? fg.r : (hx0 * c + hz0 * s);
        const hz = fg.r ? fg.r : (hx0 * s + hz0 * c);
        cand.push({ name: "apt_top", apt: true, noWall: true, y: p.y + fg.topY, x1: p.x - hx, x2: p.x + hx, z1: p.z - hz, z2: p.z + hz });
        if (fg.lowY) {
          const lhx = fg.lowR || hx, lhz = fg.lowR || hz;
          cand.push({ name: "apt_top", apt: true, noWall: true, y: p.y + fg.lowY, x1: p.x - lhx, x2: p.x + lhx, z1: p.z - lhz, z2: p.z + lhz });
        }
        continue;
      }
      const ext = itemWorldHalf(it);
      cand.push({ name: "item", itemRef: it, box: null, safe: itemInSafe, axis: itemInSafe ? 'z' : null, y: p.y + ext.h, x1: p.x - ext.hx - .01, x2: p.x + ext.hx + .01, z1: p.z - ext.hz - .01, z2: p.z + ext.hz + .01 });
    }
    for (const s of cand) {
      let candHit = null;
      const effMaxD = s.safe ? Math.min(maxD, 1.85) : Math.min(maxD, 2.55);
      // Специальное точное наведение для 2 полок потайного сейфа в правой стене (y = 0.913 и y = 1.133)
      if (s.name === 'safe') {
        if (d.x > .12) {
          const xPlane = KW + .065;
          const tPlane = (xPlane - o.x) / d.x;
          if (tPlane > 0 && tPlane <= effMaxD) {
            const yAt = o.y + d.y * tPlane, zAt = o.z + d.z * tPlane;
            const dPlayer = Math.hypot(xPlane - P.x, zAt - P.z);
            if (dPlayer <= 1.75 && zAt >= -.83 && zAt <= -.21) {
              const inTier = s.safeTier === 1 ? (yAt >= 1.10 && yAt <= 1.39) : (yAt >= .83 && yAt < 1.10);
              if (inTier) {
                candHit = { t: tPlane, x: KW + .06, z: clamp(zAt, s.z1 + .045, s.z2 - .045), y: s.y, s };
              }
            }
          }
        }
        if (!candHit && Math.abs(d.y) >= 1e-3) {
          const t = (s.y - o.y) / d.y;
          if (t > 0 && t <= effMaxD) {
            const x = o.x + d.x * t, z = o.z + d.z * t;
            const dPlayer = Math.hypot(x - P.x, z - P.z);
            if (dPlayer <= 1.75 && x >= KW - .03 && x <= KW + .15 && z >= -.83 && z <= -.21) {
              let blockedByUpper = false;
              if (s.safeTier === 0 && d.y < -1e-3) {
                const tUp = (1.133 - o.y) / d.y;
                const xUp = o.x + d.x * tUp;
                if (tUp > 0 && xUp >= KW - .02 && xUp <= KW + .145) blockedByUpper = true;
              }
              if (!blockedByUpper) {
                candHit = { t, x: clamp(x, KW + .02, KW + .10), z: clamp(z, s.z1 + .045, s.z2 - .045), y: s.y, s };
              }
            }
          }
        }
      }
      // 1) Точное пересечение с горизонтальной плоскостью поверхности
      if (!candHit && s.name !== 'safe' && Math.abs(d.y) >= 1e-3) {
        const t = (s.y - o.y) / d.y;
        if (t > 0 && t <= effMaxD) {
          const x = o.x + d.x * t, z = o.z + d.z * t;
          if (x > s.x1 && x < s.x2 && z > s.z1 && z < s.z2) {
            if (s.busCheck && tr) {
              if (!tr.isInsideBus(x, z, -.05)) continue;
              const surfH = tr.busSurfaceAt(x, z, s.y + .06);
              if (Math.abs(surfH - s.y) > .08) continue;
            }
            const dPlayer = Math.hypot(x - P.x, z - P.z);
            const limitD = s.apt ? 2.65 : (s.name === 'shelf' || s.name === 'counter') ? 1.85 : 2.55;
            if (dPlayer <= limitD) {
              if (s.name === 'shelf' || s.name === 'counter') {
                const padX = Math.min(.05, (s.x2 - s.x1) * .15), padZ = Math.min(.05, (s.z2 - s.z1) * .15);
                candHit = { t, x: clamp(x, s.x1 + padX, s.x2 - padX), z: clamp(z, s.z1 + padZ, s.z2 - padZ), y: s.y, s };
              } else {
                candHit = { t, x, z, y: s.y, s };
              }
            }
          }
        }
      }
      // 2) Для полок (SH_SIDE / SH_BACK), прилавка, лежащих предметов и тел проверяем 3D-объём
      if (!candHit && (s.name === 'shelf' || s.name === 'counter' || s.name === 'item' || s.name === 'body')) {
        const hBot = s.name === 'body' ? .26 : (s.name === 'item' && s.itemRef ? (s.y - s.itemRef.obj.position.y) : .04);
        const hTop = s.name === 'shelf' ? .38 : s.name === 'body' ? .14 : s.name === 'item' ? .07 : .10;
        _surfBox.min.set(s.x1, s.y - hBot, s.z1);
        _surfBox.max.set(s.x2, s.y + hTop, s.z2);
        const hp = ray.ray.intersectBox(_surfBox, _surfHit);
        if (hp) {
          const t = hp.distanceTo(o);
          if (t > 0 && t <= effMaxD) {
            const dPlayer = Math.hypot(hp.x - P.x, hp.z - P.z);
            const limitD2 = s.apt ? 2.45 : (s.name === 'shelf' || s.name === 'counter') ? 1.65 : 2.35;
            if (dPlayer <= limitD2) {
              const padX = Math.min(.03, (s.x2 - s.x1) * .12);
              const padZ = Math.min(.03, (s.z2 - s.z1) * .12);
              const cx = clamp(hp.x, s.x1 + padX, s.x2 - padX);
              const cz = clamp(hp.z, s.z1 + padZ, s.z2 - padZ);
              candHit = { t, x: cx, z: cz, y: s.y, s };
            }
          }
        }
      }
      if (candHit && (!best || candHit.t < best.t)) {
        const isSafeTarget = !!(candHit.s && candHit.s.safe) || inSafeBox(candHit.x, candHit.y, candHit.z);
        if (!(isSafeTarget && safeOpen()) && !(candHit.s && candHit.s.noWall) && !openZoneAt(candHit.x, candHit.y + .02, candHit.z) && env.isWallBetween && env.isWallBetween(P.x, P.z, candHit.x, candHit.z, { mode: 'item', y1: camera.position.y, y2: candHit.y + .08, r: heldItem && heldItem.kind === 'box' ? .20 : .08 })) continue;
        if (candHit.s.name !== 'box_inside' && heldItem) {
          const res = resolveItemSpot(candHit.x, candHit.y, candHit.z, heldItem, candHit.s);
          if (res.blocked) continue;
          candHit.x = res.x;
          candHit.y = res.y;
          candHit.z = res.z;
        }
        best = candHit;
      }
    }
    return best;
  }
  function lookingAtOpenBox(maxD = 2.4) {
    ray.setFromCamera(new THREE.Vector2(0, 0), camera); ray.far = maxD;
    const openBoxes = items.filter(i => i !== held && i.kind === "box" && i.data.opened && i.state === "rest");
    if (!openBoxes.length) return null;
    const h = ray.intersectObjects(openBoxes.map(b => b.obj), true)[0];
    const bx = h && h.object.userData.item ? h.object.userData.item : null;
    if (bx && env.isWallBetween && env.isWallBetween(P.x, P.z, bx.obj.position.x, bx.obj.position.z, { mode: 'item', y1: camera.position.y, y2: bx.obj.position.y + .15 })) return null;
    return bx;
  }

  // ================= предметы =================
  const items = [];
  let held = null, heldYaw = 0, heldYawT = 0;
  const boxTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    g.fillStyle = '#b08d5c'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 2500; i++) { g.fillStyle = Math.random() < .5 ? '#9a7a4c' : '#c4a06c'; g.globalAlpha = .4; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); } g.globalAlpha = 1;
    g.fillStyle = '#c9b48a'; g.fillRect(112, 0, 32, 256); g.fillStyle = '#5a3a1a'; g.font = '900 30px Arial'; g.textAlign = 'center'; g.fillText('ОПТТОРГ', 128, 90); g.font = '700 18px Arial'; g.fillText('ОСТОРОЖНО · НЕ КАНТОВАТЬ', 128, 120);
    g.strokeStyle = '#7a2a1a'; g.lineWidth = 4; g.beginPath(); g.arc(70, 190, 30, 0, 7); g.stroke(); g.font = '700 14px Arial'; g.fillStyle = '#7a2a1a'; g.fillText('ОТК', 70, 195);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const boxMat = std({ map: boxTex, roughness: .9 });
  const kraftTex = (inner) => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    g.fillStyle = inner ? '#b39268' : '#a6845a'; g.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 6) { g.fillStyle = `rgba(${inner ? '90,64,34' : '70,50,28'},${.05 + Math.random() * .04})`; g.fillRect(x, 0, 3, 256); }
    for (let i = 0; i < 3500; i++) { const v = Math.random(); g.fillStyle = v < .5 ? 'rgba(120,90,55,.35)' : 'rgba(210,185,140,.3)'; g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1); }
    if (inner) { g.fillStyle = 'rgba(80,55,30,.18)'; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(Math.random() * 256, Math.random() * 256, 20 + Math.random() * 40, 8 + Math.random() * 20, Math.random() * 3, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(60,40,20,.5)'; g.font = '700 14px Arial'; g.fillText('ГОСТ 9142-84', 14, 240); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const inMat = std({ map: kraftTex(true), roughness: .95 }), flapOutMat = std({ map: kraftTex(false), roughness: .92 }),
    floorInMat = std({ map: kraftTex(true), color: 0xcdbca2, roughness: .97, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -2 });
  function makeOpenBox(w, h, d) {
    const g = new THREE.Group(), t = .010, tBot = .026, I = inMat, O = boxMat;
    const slab = (sx, sy, sz, x, y, z, mats, parent = g) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mats); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
    // Толстое двойное картонное дно с внутренними клапанами, чтобы дорожка и снег никогда не просвечивали сквозь коробку
    const botMain = slab(w, tBot, d, 0, tBot / 2, 0, [O, O, floorInMat, O, O, O]);
    botMain.renderOrder = 2;
    for (const szSign of [-1, 1]) {
      const innerFlap = slab(w - t * 2.2, .005, d * .46, 0, tBot + .0025, szSign * d * .24, floorInMat);
      innerFlap.renderOrder = 2;
    }
    slab(w, h, t, 0, h / 2, d / 2 - t / 2, [I, I, I, I, O, I]); slab(w, h, t, 0, h / 2, -d / 2 + t / 2, [I, I, I, I, I, O]);
    slab(t, h, d - 2 * t, w / 2 - t / 2, h / 2, 0, [O, I, I, I, I, I]); slab(t, h, d - 2 * t, -w / 2 + t / 2, h / 2, 0, [I, O, I, I, I, I]);
    const FM = [I, I, I, flapOutMat, I, I];
    for (const s of [-1, 1]) {
      const pz = new THREE.Group(); pz.position.set(0, h, s * d / 2); g.add(pz); slab(w - .01, t, d * .48, 0, 0, s * d * .24, FM, pz); pz.rotation.x = s * (.18 + Math.random() * .35);
      const px = new THREE.Group(); px.position.set(s * w / 2, h, 0); g.add(px); slab(w * .3, t, d - .02, s * w * .15, 0, 0, FM, px); px.rotation.z = -s * (.25 + Math.random() * .4);
    }
    return g;
  }
  function makeBoxMesh(w, h, d, open) {
    if (open) return makeOpenBox(w, h, d);
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), boxMat); b.position.y = h / 2; b.castShadow = b.receiveShadow = true; g.add(b);
    return g;
  }
  // Осколки разбитых бутылок, банок, тарелок, чашек и ваз (защищены noCull/keep/dyn от отсечения окклюдером!)
  const FURNITURE_SURFS = {
    stool: { r: 0.18, topY: 0.45 },
    chair_item: { hx: 0.21, hz: 0.21, topY: 0.45 },
    armchair_item: { hx: 0.26, hz: 0.25, topY: 0.43 },
    coffee_table: { r: 0.30, topY: 0.50, lowY: 0.21, lowR: 0.24 },
    nightstand_item: { hx: 0.22, hz: 0.19, topY: 0.51, lowY: 0.22 },
    tv_rubin: { hx: 0.28, hz: 0.17, topY: 0.45 },
    book_item: { hx: 0.09, hz: 0.12, topY: 0.036 },
    cassette_player: { hx: 0.19, hz: 0.07, topY: 0.15 }
  };
  const FLOOR_FURNITURE_SET = new Set(['stool', 'chair_item', 'armchair_item', 'coffee_table', 'nightstand_item']);
  const UPRIGHT_STABLE_SET = new Set([
    'stool', 'chair_item', 'armchair_item', 'coffee_table', 'nightstand_item', 'tv_rubin',
    'alarm_vityaz', 'cassette_player', 'desk_lamp', 'breadbox', 'potR', 'potW', 'potG', 'pan', 'kettle',
    'bowl', 'plate', 'cup', 'jar', 'jam', 'tin', 'sugar', 'vase', 'flowerpot', 'bucket'
  ]);
  const isFloorFurniture = it => !!(it && it.kind === 'good' && it.data && FLOOR_FURNITURE_SET.has(it.data.goodId));
  const isUprightStable = it => !!(it && it.kind === 'good' && it.data && UPRIGHT_STABLE_SET.has(it.data.goodId));
  const shardGeos = [
    new THREE.TetrahedronGeometry(.034, 0),
    new THREE.ConeGeometry(.032, .058, 4),
    new THREE.BoxGeometry(.048, .009, .036),
    new THREE.CylinderGeometry(.022, .034, .042, 5, 1, true),
  ];
  const shards = [];
  let shardCursor = 0;
  for (let i = 0; i < 96; i++) {
    const m = new THREE.Mesh(
      shardGeos[i % shardGeos.length],
      new THREE.MeshStandardMaterial({ color: 0x2d5a36, emissive: 0x16281a, emissiveIntensity: .36, roughness: .12, metalness: .18, transparent: true, opacity: .90, side: THREE.DoubleSide })
    );
    m.visible = false; m.castShadow = true; m.frustumCulled = false;
    m.userData.noCull = true; m.userData.keep = true; m.userData.dyn = true;
    scene.add(m);
    shards.push({ m, life: 0, v: new THREE.Vector3(), rv: new THREE.Vector3(), fl: 0, settled: false });
  }
  function playGlassBreak() {
    if (!env.audio) return;
    if (env.audio.thud) env.audio.thud(.35);
    if (env.audio.click) {
      for (const [delay, freq, vol, dur] of [
        [0, 2900, .55, .06], [18, 4100, .48, .05], [42, 2350, .42, .07],
        [75, 3650, .35, .05], [115, 4600, .28, .04], [165, 3100, .22, .05], [220, 4900, .18, .04]
      ]) {
        setTimeout(() => env.audio && env.audio.click(freq + R(-220, 220), vol, 0, dur), delay);
      }
    }
  }
  const GOOD_PHYS = {
    vodka:    { shape: 'bottle', drinkKind: 'vodka',   r: .036, h: .28, mass: .75 },
    beer:     { shape: 'bottle', drinkKind: 'beer',    r: .034, h: .24, mass: .65 },
    samogon:  { shape: 'bottle', drinkKind: 'samogon', r: .038, h: .26, mass: .75 },
    soda:     { shape: 'bottle', drinkKind: 'soda',    r: .032, h: .23, mass: .60 },
    tushonka: { shape: 'can',    r: .046, h: .095, mass: .42 },
    kilka:    { shape: 'can',    r: .052, h: .034, mass: .26 },
    batt:     { shape: 'box',    hx: .042, hy: .052, hz: .014, mass: .18 },
    cig:      { shape: 'box',    hx: .030, hy: .044, hz: .013, mass: .08 },
    kontra:   { shape: 'box',    hx: .058, hy: .044, hz: .024, mass: .22 },
    gum:      { shape: 'box',    hx: .042, hy: .026, hz: .014, mass: .05 },
    choc:     { shape: 'box',    hx: .068, hy: .019, hz: .014, mass: .12 },
    bread:    { shape: 'box',    hx: .100, hy: .045, hz: .052, mass: .40 },
    tape:     { shape: 'box',    hx: .052, hy: .034, hz: .010, mass: .10 },
    paper:    { shape: 'box',    hx: .110, hy: .010, hz: .080, mass: .09 },
    mag:      { shape: 'box',    hx: .075, hy: .095, hz: .008, mass: .15 },
    mag2:     { shape: 'box',    hx: .075, hy: .095, hz: .008, mass: .15 },
    toy:      { shape: 'box',    hx: .038, hy: .068, hz: .012, mass: .16 },
    royal:    { shape: 'bottle', drinkKind: 'vodka', r: .040, h: .29, mass: 1.15 },
    anabol:   { shape: 'box',    hx: .046, hy: .015, hz: .030, mass: .06 },
    vhs:      { shape: 'box',    hx: .094, hy: .013, hz: .052, mass: .22 },
    cash:     { shape: 'box',    hx: .074, hy: .006, hz: .034, mass: .04 },
    coin:     { shape: 'can',    r:  .014, h:  .004, mass: .015 },
    safekey:  { shape: 'box',    hx: .046, hy: .005, hz: .017, mass: .03 },
    matches:  { shape: 'box',    hx: .026, hy: .008, hz: .018, mass: .02 },
    plug:     { shape: 'can',    r:  .026, h:  .02, mass: .03 },
    guitar: { shape: 'box', hx: .19, hy: .50, hz: .062, mass: 2.2 }, cup: { shape: 'can', r: .035, h: .07, mass: .2 }, plate: { shape: 'can', r: .10, h: .016, mass: .4 }, potR: { shape: 'can', r: .09, h: .15, mass: 1.2 }, potW: { shape: 'can', r: .078, h: .13, mass: 1 }, potG: { shape: 'can', r: .068, h: .11, mass: .7 }, pan: { shape: 'can', r: .10, h: .16, mass: .9 },
    bowl: { shape: 'can', r: .11, h: .07, mass: .4 }, kettle: { shape: 'can', r: .10, h: .22, mass: 1.2 }, jar: { shape: 'can', r: .07, h: .24, mass: 3 }, jam: { shape: 'can', r: .05, h: .13, mass: .5 }, tin: { shape: 'can', r: .045, h: .14, mass: .4 }, milk: { shape: 'can', r: .035, h: .24, mass: .6 },
    sausage: { shape: 'box', hx: .15, hy: .045, hz: .045, mass: .5 }, butter: { shape: 'box', hx: .10, hy: .025, hz: .06, mass: .2 }, sugar: { shape: 'can', r: .065, h: .1, mass: .4 }, vase: { shape: 'can', r: .05, h: .2, mass: .5 },
    soap: { shape: 'box', hx: .04, hy: .0125, hz: .025, mass: .2 }, soap2: { shape: 'box', hx: .035, hy: .0125, hz: .0225, mass: .1 }, tbcup: { shape: 'can', r: .03, h: .09, mass: .15 }, lotos: { shape: 'box', hx: .07, hy: .10, hz: .035, mass: .5 },
    breadbox: { shape: 'box', hx: .13, hy: .07, hz: .09, mass: 1.5 }, flowerpot: { shape: 'can', r: .065, h: .12, mass: 1 }, bucket: { shape: 'can', r: .10, h: .22, mass: 1.2 }, grain: { shape: 'box', hx: .04, hy: .10, hz: .07, mass: 1 },
    stool: { shape: 'can', r: .17, h: .45, mass: 2.4 },
    chair_item: { shape: 'box', hx: .22, hy: .42, hz: .22, mass: 3.2 },
    armchair_item: { shape: 'box', hx: .29, hy: .42, hz: .28, mass: 6.2 },
    coffee_table: { shape: 'can', r: .30, h: .50, mass: 4.2 },
    nightstand_item: { shape: 'box', hx: .22, hy: .26, hz: .19, mass: 4.5 },
    tv_rubin: { shape: 'box', hx: .29, hy: .225, hz: .17, mass: 8.5 },
    book_item: { shape: 'box', hx: .085, hy: .018, hz: .115, mass: .35 },
    alarm_vityaz: { shape: 'box', hx: .056, hy: .078, hz: .035, mass: .42 },
    cassette_player: { shape: 'box', hx: .19, hy: .075, hz: .065, mass: 1.8 },
    desk_lamp: { shape: 'box', hx: .14, hy: .20, hz: .14, mass: 1.45 },
    usd:      { shape: 'box',    hx: .076, hy: .005, hz: .033, mass: .03 },
  };
  // Реалистичная хрупкость: разбиться могут ТОЛЬКО бутылки, стеклянные банки, тарелки, чашки, сахарница, ваза, стаканчик и цветочный горшок!
  // Жвачки, хлеб, сигареты, консервы, кастрюли, чайник, книги, кассеты, деньги и мебель НЕ бьются никогда!
  const FRAGILE_GOOD_SET = new Set(['vodka', 'beer', 'samogon', 'soda', 'royal', 'milk', 'jar', 'jam', 'plate', 'cup', 'sugar', 'vase', 'flowerpot', 'tbcup']);
  const PORCELAIN_GOOD_SET = new Set(['plate', 'cup', 'sugar', 'vase', 'tbcup']);
  const isPhysicsProp = it => it && (it.kind === "bottle" || it.kind === "good" || it.kind === "pack");
  const isBreakableGlass = it => !!(it && (it.kind === "bottle" || (it.kind === "good" && it.data && FRAGILE_GOOD_SET.has(it.data.goodId))));
  // катиться на боку могут бутылки и вытянутые банки/кружки/вёдра; кастрюли, тарелки, миски, чайник с ручкой и носиком и мебель — нет (они ложатся/стоят на дне)
  const NO_ROLL = { kettle: 1, potR: 1, potW: 1, potG: 1, pan: 1, plate: 1, bowl: 1, sugar: 1, flowerpot: 1, kilka: 1, coin: 1, plug: 1, stool: 1, chair_item: 1, armchair_item: 1, coffee_table: 1, nightstand_item: 1, tv_rubin: 1, book_item: 1, alarm_vityaz: 1, cassette_player: 1, desk_lamp: 1 };
  const canRollOnSide = it => it && (it.kind === "bottle" || (it.kind === "good" && it.goodPhys && (it.goodPhys.shape === "bottle" || (it.goodPhys.shape === "can" && !NO_ROLL[it.data && it.data.goodId] && it.goodPhys.h >= it.goodPhys.r * 1.8))));
  // устойчивое положение после падения: предмет ложится на ту грань, которая к моменту удара смотрела вниз (с учётом площади грани — плоское ложится плашмя)
  const _sq = new THREE.Quaternion(), _sqi = new THREE.Quaternion(), _sv = new THREE.Vector3(), _sAx = new THREE.Vector3(), _sDown = new THREE.Vector3(0, -1, 0);
  // высокий плоский предмет (гитара) без подставки ставить «на попа» нельзя — кладём на спинку
  function layTallFlat(it) {
    if (!(it && it.kind === 'good' && it.goodPhys && it.goodPhys.shape === 'box' && it.half && it.half.y > 2.2 * Math.max(it.half.x, it.half.z))) return false;
    _sAx.set(0, 0, -1); _sq.setFromUnitVectors(_sAx, _sDown);
    it.data.restQ = _sq.toArray().map(v => +v.toFixed(4)); it.data.restH = +it.half.z.toFixed(4); return true;
  }
  function settleBoxPose(it, impactHSpd = 0) {
    if (!it || !it.obj.userData.piv) return;
    const piv = it.obj.userData.piv, spin = it.obj.userData.spin;
    it.data.lying = false;
    // Реалистичное поведение мебели и устойчивых предметов при ударах и пинках:
    // слабый толчок сдвигает мебель стоя, а сильный удар/пинок реально опрокидывает её на бок или спинку!
    if (isFloorFurniture(it)) {
      const strongTip = !!(it.lastStrikeKick || impactHSpd >= 1.45 || Math.abs(piv.rotation.x) >= 0.48);
      it.lastStrikeKick = false;
      if (!strongTip) {
        it.data.restQ = null;
        it.data.restH = null;
        applyBottlePose(it);
        return;
      }
      const gpF = it.goodPhys;
      if (gpF && gpF.shape === 'can') {
        const tipSign = piv.rotation.x >= 0 ? 1 : -1;
        _sAx.set(0, 0, tipSign);
        _sq.setFromUnitVectors(_sAx, _sDown);
        it.data.restQ = _sq.toArray().map(v => +v.toFixed(4));
        it.data.restH = +(gpF.r || 0.20).toFixed(4);
        it.data.lying = true;
        applyBottlePose(it);
        return;
      }
      // Для стульев, кресел и тумбочек (box) выбираем боковую/заднюю грань по направлению наклона
      if (it.half) {
        const extF = [it.half.x, it.half.y, it.half.z];
        _sq.copy(piv.quaternion).multiply(spin.quaternion); _sqi.copy(_sq).invert();
        _sv.copy(_sDown).applyQuaternion(_sqi);
        const bi = Math.abs(_sv.x) > Math.abs(_sv.z) ? 0 : 2;
        const sgn = (_sv.getComponent(bi) >= 0) ? 1 : -1;
        _sAx.set(0, 0, 0).setComponent(bi, sgn);
        _sq.setFromUnitVectors(_sAx, _sDown);
        it.data.restQ = _sq.toArray().map(v => +v.toFixed(4));
        it.data.restH = +extF[bi].toFixed(4);
        it.data.lying = true;
        applyBottlePose(it);
        return;
      }
    }
    if (isUprightStable(it) && impactHSpd < 2.2) {
      it.data.restQ = null;
      it.data.restH = null;
      applyBottlePose(it);
      return;
    }
    const isBox = (it.kind === 'good' && it.goodPhys && it.goodPhys.shape === 'box') || it.kind === 'pack';
    if (!isBox || !it.half) { it.data.restQ = null; it.data.restH = null; applyBottlePose(it); return; }
    const ext = [it.half.x, it.half.y, it.half.z];
    _sq.copy(piv.quaternion).multiply(spin.quaternion); _sqi.copy(_sq).invert();
    _sv.copy(_sDown).applyQuaternion(_sqi); // вектор гравитации в локальных осях предмета
    const comp = [_sv.x, _sv.y, _sv.z], area = [ext[1] * ext[2], ext[0] * ext[2], ext[0] * ext[1]];
    let bi = 1, bs = -1;
    for (let i = 0; i < 3; i++) {
      // Детерминированный выбор опорной грани по проекции вектора тяжести и площади опоры (без Math.random!)
      const baseWeight = (i === 1 && comp[1] < 0) ? 1.38 : 1.0;
      const sc = Math.abs(comp[i]) * Math.pow(area[i], 0.72) * baseWeight;
      if (sc > bs) { bs = sc; bi = i; }
    }
    const sgn = comp[bi] >= 0 ? 1 : -1;
    if (bi === 1 && sgn < 0) { it.data.restQ = null; it.data.restH = null; applyBottlePose(it); return; }
    _sAx.set(0, 0, 0).setComponent(bi, sgn);
    _sq.setFromUnitVectors(_sAx, _sDown);
    it.data.restQ = _sq.toArray().map(v => +v.toFixed(4)); it.data.restH = +ext[bi].toFixed(4);
    applyBottlePose(it);
  }

  // Пул растекающихся луж жидкостей от разбитых бутылок и банок с содержимым
  const spillPuddles = [];
  let spillCursor = 0;
  const spillShape = new THREE.Shape();
  for (let k = 0; k <= 20; k++) {
    const a = (k / 20) * Math.PI * 2;
    const r = 0.22 * (1 + 0.16 * Math.sin(a * 3 + 0.7) + 0.10 * Math.cos(a * 5 - 0.4));
    const sx = Math.cos(a) * r, sy = Math.sin(a) * r;
    if (k === 0) spillShape.moveTo(sx, sy); else spillShape.lineTo(sx, sy);
  }
  const spillGeo = new THREE.ShapeGeometry(spillShape, 12);
  spillGeo.rotateX(-Math.PI / 2);
  const LIQUID_PUDDLE_CFG = {
    vodka:   { col: 0xd6eef8, em: 0x182c34, op: 0.56, rgh: 0.05, scale: 1.05, name: 'лужа спирта/водки' },
    royal:   { col: 0xdcf2fc, em: 0x1c3038, op: 0.60, rgh: 0.04, scale: 1.25, name: 'лужа спирта «Royal»' },
    beer:    { col: 0xc8821e, em: 0x2e1c06, op: 0.78, rgh: 0.08, scale: 1.15, name: 'лужа пенного пива' },
    samogon: { col: 0xd8dfd0, em: 0x242820, op: 0.68, rgh: 0.10, scale: 1.10, name: 'лужа мутного самогона' },
    soda:    { col: 0xd98a1c, em: 0x301c04, op: 0.74, rgh: 0.07, scale: 1.08, name: 'лужа лимонада «Буратино»' },
    milk:    { col: 0xf6f5ee, em: 0x343430, op: 0.92, rgh: 0.16, scale: 1.12, name: 'лужа молока' },
    jam:     { col: 0x9e1b2c, em: 0x28060a, op: 0.90, rgh: 0.22, scale: 0.95, name: 'лужа ягодного варенья' },
    jar:     { col: 0x7ea874, em: 0x182416, op: 0.66, rgh: 0.08, scale: 1.35, name: 'лужа огуречного рассола' }
  };
  function spawnLiquidPuddle(x, y, z, dk) {
    const cfg = LIQUID_PUDDLE_CFG[dk];
    if (!cfg) return;
    let sp = spillPuddles.find(p => p.life <= 0);
    if (!sp) {
      if (spillPuddles.length < 28) {
        const pm = new THREE.Mesh(
          spillGeo,
          new THREE.MeshStandardMaterial({
            color: cfg.col, emissive: cfg.em, emissiveIntensity: 0.28,
            roughness: cfg.rgh, metalness: 0.18, transparent: true, opacity: cfg.op,
            depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2
          })
        );
        pm.frustumCulled = false; pm.renderOrder = 2;
        pm.userData.noCull = true; pm.userData.keep = true; pm.userData.dyn = true;
        scene.add(pm);
        sp = { m: pm, life: 0, curScale: 0.1, maxScale: 1.0 };
        spillPuddles.push(sp);
      } else {
        sp = spillPuddles[spillCursor = (spillCursor + 1) % spillPuddles.length];
      }
    }
    sp.life = 240;
    sp.curScale = 0.22;
    sp.maxScale = cfg.scale * R(0.9, 1.18);
    sp.m.visible = true;
    sp.m.material.color.setHex(cfg.col);
    sp.m.material.emissive.setHex(cfg.em);
    sp.m.material.opacity = cfg.op;
    sp.m.material.roughness = cfg.rgh;
    sp.m.position.set(x, y + 0.004, z);
    sp.m.rotation.y = R(0, Math.PI * 2);
    sp.m.scale.set(sp.curScale, 1, sp.curScale);
  }
  function shatterBottle(it) {
    if (!it || !items.includes(it) || !isBreakableGlass(it)) return;
    const dk = (it.data && (it.data.drinkKind || it.data.goodId)) || "vodka";
    const isPorcelain = PORCELAIN_GOOD_SET.has(dk);
    const isClay = dk === "flowerpot";
    const col = isClay ? 0x9c4e2b : isPorcelain ? 0xf5f2e8 : dk === "beer" ? 0x7a4418 : (dk === "samogon" || dk === "vodka" || dk === "royal" || dk === "jar") ? 0xd8eef2 : dk === "jam" ? 0xa82838 : dk === "milk" ? 0xf2f0e6 : dk === "soda" ? 0x3b8844 : 0x3b8844;
    const emCol = isClay ? 0x261208 : isPorcelain ? 0x3a3832 : dk === "beer" ? 0x281608 : 0x24383c;
    const pos = it.obj.position.clone();
    const fl = surfaceBelow(pos.x, pos.z, pos.y + .15, it);
    // Если разбилась полная бутылка или банка с жидкостью (it.kind === 'good' и не пустая тара), на полу остаётся лужа содержимого!
    const hasContents = (it.kind === "good" && LIQUID_PUDDLE_CFG[dk]) || (it.data && it.data.hasLiquid && LIQUID_PUDDLE_CFG[dk]);
    if (hasContents) {
      spawnLiquidPuddle(pos.x, fl, pos.z, dk);
    }
    playGlassBreak();
    const shardCount = 18;
    for (let k = 0; k < shardCount; k++) {
      let sh = shards.find(s => s.life <= 0);
      if (!sh) sh = shards[shardCursor = (shardCursor + 1) % shards.length];
      sh.life = 160 + R(0, 60);
      sh.settled = false;
      sh.fl = fl;
      sh.m.visible = true;
      sh.m.material.color.setHex(col);
      sh.m.material.emissive.setHex(emCol);
      sh.m.material.opacity = isPorcelain || isClay ? 0.98 : 0.90;
      sh.m.position.set(pos.x + R(-.06, .06), Math.max(fl + .03, pos.y + R(.03, .14)), pos.z + R(-.06, .06));
      sh.m.rotation.set(R(0, 6.28), R(0, 6.28), R(0, 6.28));
      sh.m.scale.set(R(.85, 1.55), R(.80, 1.45), R(.85, 1.55));
      const ang = (k / shardCount) * Math.PI * 2 + R(-.25, .25), sp = R(.85, 2.65);
      sh.v.set(
        Math.cos(ang) * sp + (it.vel ? it.vel.x * .25 : 0),
        R(1.05, 2.55),
        Math.sin(ang) * sp + (it.vel ? it.vel.z * .25 : 0)
      );
      sh.rv.set(R(-14, 14), R(-14, 14), R(-14, 14));
    }
    removeItem(it);
    const brokenLabel = isPorcelain ? "Посуда разбилась вдребезги!" : isClay ? "Горшок разбился вдребезги!" : (dk === "jar" || dk === "jam") ? "Банка разбилась вдребезги!" : "Бутылка разбилась вдребезги!";
    env.ctx && env.ctx.toast && env.ctx.toast(brokenLabel);
  }

  function applyBottlePose(it) {
    if (!it || !isPhysicsProp(it) || !it.obj.userData.piv) return;
    const piv = it.obj.userData.piv, spin = it.obj.userData.spin;
    const standY = (it.centerY || .135) + .003;
    const lieY = (it.rollR || .036) + .004;
    if (it.data && it.data.lying && canRollOnSide(it)) {
      piv.position.set(0, lieY, 0);
      piv.rotation.set(Math.PI / 2, 0, 0);
      spin.rotation.set(0, it.data.rollAng || 0, 0);
    } else if (it.data && it.data.restQ && !canRollOnSide(it)) {
      piv.position.set(0, (it.data.restH || standY) + .002, 0);
      piv.quaternion.fromArray(it.data.restQ);
      spin.rotation.set(0, 0, 0);
    } else {
      piv.position.set(0, standY, 0);
      piv.rotation.set(0, 0, 0);
      spin.rotation.set(0, 0, 0);
    }
  }

  function makeGoodPhysMesh(gid, data = null) {
    const isCoin = gid === 'coin' || (gid === 'cash' && data && data.amount && data.amount <= 10);
    const gp = isCoin ? GOOD_PHYS.coin : (GOOD_PHYS[gid] || GOOD_PHYS.cig);
    const cy = gp.shape === 'bottle' ? gp.h * .5 : gp.shape === 'can' ? gp.h * .5 : gp.hy;
    const g = new THREE.Group();
    const piv = new THREE.Group();
    piv.position.set(0, cy, 0);
    const spin = new THREE.Group();
    piv.position.set(0, cy, 0);
    piv.add(spin);
    g.add(piv);
    g.userData.piv = piv;
    g.userData.spin = spin;
    const m = env.getItemMesh ? env.getItemMesh(isCoin ? 'coin' : gid, data) : new THREE.Mesh(new THREE.BoxGeometry(.06, .08, .03), boxMat);
    m.position.set(0, -cy, 0);
    m.traverse(o => { if (o.isMesh) o.castShadow = true; });
    spin.add(m);
    return { obj: g, gp, cy, rollR: gp.r || gp.hy || .03 };
  }

  function makePackPhysMesh(data) {
    const gid = (data && data.goodId) || "cig";
    const cnt = clamp((data && typeof data.count === "number") ? data.count : 5, 1, (data && data.maxCount) || 5);
    const maxC = (data && data.maxCount) || 5;
    const opened = !!(data && data.opened);
    const isCarton = (gid === "cig" || gid === "kontra");
    const isBundle = (gid === "paper" || gid === "mag" || gid === "mag2");
    const isShowbox = ["gum", "choc", "batt", "tape", "toy"].includes(gid);
    const isBottleTray = ["vodka", "beer", "samogon", "soda"].includes(gid);
    const cy = isCarton ? .027 : isBundle ? (cnt * (gid === "paper" ? .009 : .007) + .003) : isShowbox ? .042 : isBottleTray ? .148 : .042;
    const hx = isCarton ? .12 : isBundle ? (gid === "paper" ? .11 : .075) : isShowbox ? .095 : .145;
    const hz = isCarton ? .049 : isBundle ? (gid === "paper" ? .08 : .095) : isShowbox ? .073 : .097;
    const g = new THREE.Group();
    const piv = new THREE.Group();
    piv.position.set(0, cy, 0);
    const spin = new THREE.Group();
    piv.add(spin);
    g.add(piv);
    g.userData.piv = piv;
    g.userData.spin = spin;
    const m = env.getPackMesh ? env.getPackMesh(gid, cnt, maxC, opened) : new THREE.Mesh(new THREE.BoxGeometry(hx * 2, cy * 2, hz * 2), boxMat);
    m.position.set(0, -cy, 0);
    m.traverse(o => { if (o.isMesh) o.castShadow = true; });
    spin.add(m);
    return { obj: g, cy, rollR: cy, half: { x: hx, y: cy, z: hz }, mass: .32 + Math.max(1, cnt) * .16 };
  }

  function rebuildPackItem(it) {
    if (!it || it.kind !== "pack" || !it.obj) return;
    const pos = it.obj.position.clone(), ry = it.obj.rotation.y;
    scene.remove(it.obj);
    const built = makePackPhysMesh(it.data);
    it.obj = built.obj;
    it.centerY = built.cy;
    it.rollR = built.rollR;
    it.half = built.half;
    it.mass = built.mass;
    it.obj.position.copy(pos);
    it.obj.rotation.y = ry;
    it.obj.traverse(o => { if (o.isMesh) o.userData.item = it; });
    applyBottlePose(it);
    scene.add(it.obj);
    syncCol(it);
    persist();
  }

  function addItem(rec) {
    const it = { id: rec.id || ("i" + Math.random().toString(36).slice(2, 8)), kind: rec.kind, data: rec.data || {}, state: "rest", vy: 0, inBoxId: rec.inBoxId || null, boxOff: rec.boxOff || null };
    if (rec.kind === "box") {
      const w = .5, h = .36, d = .4;
      it.obj = makeBoxMesh(w, h, d, !!(it.data.opened));
      it.half = { x: w / 2, y: h / 2, z: d / 2 };
      it.mass = it.data.opened ? 1 : 12;
      it.stack = true;
    } else if (rec.kind === "bottle") {
      const dk = (rec.data && rec.data.drinkKind) || "vodka";
      const bH = dk === "beer" ? .24 : dk === "samogon" ? .26 : (dk === "soda" || dk === "buratino") ? .23 : .28;
      it.obj = emptyBottleMesh(dk);
      it.half = { x: .036, y: bH / 2, z: .036 };
      it.mass = .4;
      it.centerY = bH / 2;
      it.rollR = .035;
      it.stack = false;
      applyBottlePose(it);
    } else if (rec.kind === "pack") {
      it.data = Object.assign({ goodId: "cig", count: 5, maxCount: 5, opened: false }, it.data);
      const built = makePackPhysMesh(it.data);
      it.obj = built.obj;
      it.centerY = built.cy;
      it.rollR = built.rollR;
      it.half = built.half;
      it.mass = built.mass;
      it.stack = true;
      applyBottlePose(it);
    } else if (rec.kind === "good") {
      const gid = (it.data && it.data.goodId) || "cig";
      const built = makeGoodPhysMesh(gid, it.data);
      it.obj = built.obj;
      it.goodPhys = built.gp;
      it.centerY = built.cy;
      it.rollR = built.rollR;
      it.half = { x: built.gp.r || built.gp.hx || .04, y: built.cy, z: built.gp.r || built.gp.hz || .04 };
      it.mass = built.gp.mass || .2;
      it.stack = built.gp.shape !== 'bottle';
      applyBottlePose(it);
    } else if (rec.kind === "gun") {
      it.obj = env.gunWorldMesh();
      it.half = { x: .55, y: .04, z: .1 };
      it.mass = 3.4;
      it.stack = false;
    }
    const baseFl = surfaceBelow(rec.x || 0, rec.z || 0, (rec.y || 0) + .1, it);
    const startY = rec.y == null ? baseFl : Math.max(baseFl, rec.y);
    it.obj.position.set(rec.x, startY, rec.z);
    it.obj.rotation.y = rec.ry || 0;
    it.obj.traverse(o => { if (o.isMesh) o.userData.item = it; });
    scene.add(it.obj); items.push(it); syncCol(it); return it;
  }
  // длинный предмет, лежащий на боку (гитара), не должен концами уходить в стену или мебель: сдвигаем вдоль/поперёк или разворачиваем вдоль стены
  const _fd = new THREE.Vector3();
  function fitLongItem(it) {
    const piv = it.obj.userData.piv; if (!piv || !it.half || it.half.y < .2 || !it.data || !it.data.restQ) return;
    _fd.set(0, 1, 0).applyQuaternion(piv.quaternion); const lh = Math.hypot(_fd.x, _fd.z) * it.half.y; if (lh < .2) return;
    const wHalf = Math.max(it.half.x, it.half.z) * 1.0, y = it.obj.position.y + .04, p = it.obj.position;
    const blocked = (cx, cz, yaw) => { const a = Math.atan2(_fd.x, _fd.z) + yaw, dx = Math.sin(a), dz = Math.cos(a), px = -dz, pz = dx;
      for (const t of [-1, -.5, 0, .5, 1]) for (const w of [-1, 1]) { const x = cx + dx * lh * t * .96 + px * wHalf * w * .8, z = cz + dz * lh * t * .96 + pz * wHalf * w * .8; if (hitsWallCollider(x, z, .02, y)) return true; }
      return !!(env.isWallBetween && (env.isWallBetween(cx, cz, cx + dx * lh, cz + dz * lh, { mode: 'item', y1: y, y2: y, r: .02 }) || env.isWallBetween(cx, cz, cx - dx * lh, cz - dz * lh, { mode: 'item', y1: y, y2: y, r: .02 }))); };
    const y0 = it.obj.rotation.y;
    if (!blocked(p.x, p.z, y0)) return;
    for (const dy of [0, Math.PI / 2, -Math.PI / 2, Math.PI / 4, -Math.PI / 4]) for (const d of [.05, .1, .15, .2, .3, .4, .5, .6]) for (let k = 0; k < 8; k++) {
      const ang = k / 8 * Math.PI * 2, nx = p.x + Math.sin(ang) * d, nz = p.z + Math.cos(ang) * d;
      if (Math.abs(groundHeightAt(nx, nz, y) - (y - .04)) > .05) continue;
      if (!blocked(nx, nz, y0 + dy) && !(env.isWallBetween && env.isWallBetween(p.x, p.z, nx, nz, { mode: 'item', y1: y, y2: y, r: .02 }))) { p.x = nx; p.z = nz; it.obj.rotation.y = y0 + dy; return; }
    }
  }
  function syncCol(it) {
    if (it.state === "rest" && !it.inBoxId) fitLongItem(it);
    if (it.col) { const i = colliders.indexOf(it.col); if (i >= 0) colliders.splice(i, 1); it.col = null; }
    // Привязываем или обновляем привязку предмета к открытой коробке, если он лежит внутри неё
    if (it.kind !== "box" && it.state === "rest") {
      const bx = findOpenBoxAt(it.obj.position.x, it.obj.position.z, it.obj.position.y, it);
      if (bx) {
        const { lx, lz } = pointInBox(it.obj.position.x, it.obj.position.z, bx, 0);
        const keepLy = (it.inBoxId === bx.id && it.boxOff && typeof it.boxOff.ly === "number") ? it.boxOff.ly : Math.max(.028, it.obj.position.y - bx.obj.position.y);
        it.inBoxId = bx.id;
        it.boxOff = { lx, ly: keepLy, lz, lry: it.obj.rotation.y - bx.obj.rotation.y };
      } else {
        it.inBoxId = null; it.boxOff = null;
      }
    }
    // Коллайдер для любого физического предмета на земле/полу и штабелей коробок (коробки, упаковки, бутылки, товары, газеты, ружьё, деньги, ключ)
    const onKioskShelfOrCounter = Math.abs(it.obj.position.x) < KW + .08 && Math.abs(it.obj.position.z) < KD + .08 && it.obj.position.y > .48 && it.kind !== "box";
    const flHere = groundHeightAt(it.obj.position.x, it.obj.position.z);
    const onUpperFloor = flHere > 1 && it.obj.position.y - flHere < .3; // пол квартиры/подъезда/крыши: предмет на полу тоже имеет объём
    if (it.state === "rest" && !it.inBoxId && !it._inBus && !onKioskShelfOrCounter && (it.obj.position.y < 1.45 || onUpperFloor)) {
      const p = it.obj.position;
      const c = Math.abs(Math.cos(it.obj.rotation.y)), s = Math.abs(Math.sin(it.obj.rotation.y));
      const hx0 = (it.half && it.half.x) || .06;
      const hz0 = (it.half && it.half.z) || .06;
      const hx = Math.max(.07, hx0 * c + hz0 * s);
      const hz = Math.max(.07, hx0 * s + hz0 * c);
      it.col = addCol(p.x - hx, p.x + hx, p.z - hz, p.z + hz, it.kind === "box" ? "item" : "small_item");
      it.col.itemRef = it; if (onUpperFloor) it.col.fy = flHere;
    }
  }
  function wakeItemsAbove(removedIt) {
    for (const o of items) {
      if (!o || o === removedIt || o === held || o.inBoxId) continue;
      if (o.state === "rest" || o.state === "place") {
        const fl = surfaceBelow(o.obj.position.x, o.obj.position.z, o.obj.position.y + .04, o);
        if (o.obj.position.y > fl + .012) {
          o.state = "fall";
          o.vy = -0.05;
          o.vx = 0;
          o.vz = 0;
          if (o.col) { const ci = colliders.indexOf(o.col); if (ci >= 0) colliders.splice(ci, 1); o.col = null; }
        }
      }
    }
  }
  function removeItem(it) { if (it.col) { const i = colliders.indexOf(it.col); if (i >= 0) colliders.splice(i, 1); } scene.remove(it.obj); const idx = items.indexOf(it); if (idx >= 0) items.splice(idx, 1); if (held === it) held = null; wakeItemsAbove(it); persist(); }
  function persist() { const s = S(); if (!s) return; s.items = items.filter(i => i !== held || true).map(i => ({ id: i.id, kind: i.kind, x: +i.obj.position.x.toFixed(3), y: +(i === held ? surfaceBelow(P.x, P.z, 6, i) : i.obj.position.y).toFixed(3), z: +i.obj.position.z.toFixed(3), ry: +i.obj.rotation.y.toFixed(3), data: i.data })); if (held) { const r = s.items.find(x => x.id === held.id); if (r) { r.x = +P.x.toFixed(3); r.z = +P.z.toFixed(3); } } }
  function loadItems() {
    items.slice().forEach(i => { scene.remove(i.obj); if (i.col) colliders.splice(colliders.indexOf(i.col), 1); });
    items.length = 0; held = null;
    const s = S();
    if (s && Array.isArray(s.items)) {
      for (const rec of s.items) {
        if (rec.id === 'pk_start_cig' && rec.y < .2)  { rec.x = -.82;  rec.y = 1.213; rec.z = -1.03; rec.ry = 0; }
        if (rec.id === 'pk_start_beer' && rec.y < .2) { rec.x = -.24;  rec.y = 1.213; rec.z = -1.03; rec.ry = 0; }
        if (rec.id === 'pk_start_gum' && rec.y < .2)  { rec.x = -1.33; rec.y = .863;  rec.z = -.22;  rec.ry = Math.PI / 2; }
      }
    }
    (s && s.items || []).forEach(addItem);
    // Опускаем любые зависшие в воздухе коробки/предметы из прошлых сохранений на поверхность под ними
    for (const it of items) {
      // Если в старом сохранении продукты лежали в холодильнике «ЗИЛ» в прихожей (z > 82.5) или на старом месте (z = 74.60..75.05) — переносим их в сдвинутый вправо холодильник «ЗИЛ» (z = 75.36)
      if (it.obj.position.x > 43.1 && it.obj.position.x < 43.95 && ((it.obj.position.z > 82.5 && it.obj.position.z < 83.4) || (it.obj.position.z > 74.60 && it.obj.position.z < 75.04)) && it.obj.position.y > 2.65 && it.obj.position.y < 3.85) {
        it.obj.position.x = 43.62;
        it.obj.position.z = 75.36 + (((it.id ? it.id.charCodeAt(it.id.length - 1) : 3) % 5) - 2) * 0.06;
      }
    }
    const freeItems = items.filter(i => !i.inBoxId).sort((a, b) => a.obj.position.y - b.obj.position.y);
    for (const it of freeItems) {
      const fl = surfaceBelow(it.obj.position.x, it.obj.position.z, it.obj.position.y + .08, it);
      if (it.obj.position.y > fl + .02 || it.obj.position.y < fl) it.obj.position.y = fl;
    }
    items.forEach(syncCol);
    for (const bx of items.filter(i => i.kind === "box" && i.data && i.data.opened)) {
      // Если в старом сохранении внутри одной открытой коробки оказалось больше 4 упаковок — перекладываем лишние в новую коробку рядом
      const chs = items.filter(ch => ch.inBoxId === bx.id);
      if (chs.length > 4) {
        for (let bStart = 4; bStart < chs.length; bStart += 4) {
          const extraIdx = Math.floor(bStart / 4);
          const newBx = addItem({
            kind: "box",
            x: bx.obj.position.x + (extraIdx % 2 ? .56 : -.56),
            y: bx.obj.position.y,
            z: bx.obj.position.z - Math.floor((extraIdx - 1) / 2) * .48,
            ry: bx.obj.rotation.y,
            data: { opened: true }
          });
          const slice = chs.slice(bStart, bStart + 4);
          slice.forEach((ch, idx) => {
            const slotInLayer = idx % 2, layerIdx = Math.floor(idx / 2);
            ch.inBoxId = newBx.id;
            ch.boxOff = { lx: slotInLayer ? .012 : -.012, ly: .030 + layerIdx * .088, lz: slotInLayer === 0 ? -.094 : .094, lry: slotInLayer ? .02 : -.02 };
          });
          syncBoxChildren(newBx);
        }
      }
      syncBoxChildren(bx);
    }
  }
  function lookItem(maxD = 1.58) {
    const effFar = Math.min(maxD, 1.62);
    ray.setFromCamera(new THREE.Vector2(0, 0), camera); ray.far = effFar;
    const shut = !safeOpen();
    const objs = items.filter(i => i !== held && i.state !== "trash" && i.state !== "sink" && !(shut && inSafeBox(i.obj.position.x, i.obj.position.y, i.obj.position.z)) && !hiddenAt(i.obj.position.x, i.obj.position.y + .02, i.obj.position.z)).map(i => i.obj);
    const hits = ray.intersectObjects(objs, true);
    const withinReach = (it, hitPt = null) => {
      if (!it || !it.obj) return false;
      const px = hitPt ? hitPt.x : it.obj.position.x;
      const py = hitPt ? hitPt.y : it.obj.position.y;
      const pz = hitPt ? hitPt.z : it.obj.position.z;
      const horizD = Math.hypot(px - P.x, pz - P.z);
      const maxH = py > 4.2 ? 1.40 : (inSafeBox(px, py, pz) ? 1.42 : 1.28);
      return horizD <= maxH;
    };
    const softPick = () => {
      const o = ray.ray.origin, d = ray.ray.direction, sp = new THREE.Vector3(); let best = null, bs = 1e9;
      for (const i of items) {
        if (i === held || i.kind === 'box' || i.state === 'trash' || i.state === 'sink' || i.state === 'held') continue;
        const q = i.obj.position; if (shut && inSafeBox(q.x, q.y, q.z)) continue; if (hiddenAt(q.x, q.y + .02, q.z)) continue;
        if (!withinReach(i)) continue;
        const centerPt = sp.set(q.x, q.y + (i.centerY || .04), q.z).sub(o);
        const along = centerPt.dot(d); if (along < .12 || along > Math.min(effFar, 1.45)) continue;
        const perp = centerPt.addScaledVector(d, -along).length(), tol = (inSafeBox(q.x, q.y, q.z) ? .038 : .026);
        if (perp < tol && perp < bs && !(!openZoneAt(q.x, q.y + .02, q.z) && env.isWallBetween && env.isWallBetween(P.x, P.z, q.x, q.z, { mode: 'item', y1: camera.position.y, y2: q.y + .10 }))) { bs = perp; best = i; }
      }
      return best;
    };
    if (!hits.length) return softPick();
    for (const h of hits) {
      const it = h.object.userData.item;
      if (!it || !withinReach(it, h.point)) continue;
      if (!openZoneAt(it.obj.position.x, it.obj.position.y + .02, it.obj.position.z) && env.isWallBetween && env.isWallBetween(P.x, P.z, it.obj.position.x, it.obj.position.z, { mode: 'item', y1: camera.position.y, y2: it.obj.position.y + .10 })) continue;
      if (it.kind !== "box") return it;
    }
    for (const h of hits) {
      const it = h.object.userData.item;
      if (!it || !withinReach(it, h.point)) continue;
      if (openZoneAt(it.obj.position.x, it.obj.position.y + .02, it.obj.position.z) || !(env.isWallBetween && env.isWallBetween(P.x, P.z, it.obj.position.x, it.obj.position.z, { mode: 'item', y1: camera.position.y, y2: it.obj.position.y + .10 }))) return it;
    }
    return softPick();
  }
  function pick(it) {
    held = it; it.state = "held"; it.inBoxId = null; it.boxOff = null;
    if (isPhysicsProp(it)) { it.data.lying = false; it.data.rollAng = 0; it.data.restQ = null; applyBottlePose(it); }
    // Если поднимаем открытую коробку — фиксируем все предметы, лежащие внутри неё, чтобы нести их вместе с коробкой
    if (it.kind === "box" && it.data.opened) {
      for (const ch of items) {
        if (ch !== it && ch.kind !== "box" && ch.state === "rest") {
          const { inside, lx, lz } = pointInBox(ch.obj.position.x, ch.obj.position.z, it, .005);
          if (inside && ch.obj.position.y >= it.obj.position.y - .02 && ch.obj.position.y <= it.obj.position.y + it.half.y * 2 + .08) {
            ch.inBoxId = it.id;
            ch.boxOff = { lx, ly: Math.max(.028, ch.obj.position.y - it.obj.position.y), lz, lry: ch.obj.rotation.y - it.obj.rotation.y };
          }
        }
      }
    }
    heldYaw = it.obj.rotation.y - P.yaw; heldYawT = heldYaw; syncCol(it); wakeItemsAbove(it); env.audio && env.audio.click(700, .4, 0, .05); env.onCtl();
  }
  function placeHeld() {
    if (!held) return false;
    const openBx = held.kind !== "box" ? lookingAtOpenBox(1.35) : null;
    if (openBx) return throwIntoBox(openBx);
    const t = rayPlace(2.25, held); if (!t) return false;
    const it = held; held = null;
    if (isPhysicsProp(it)) { it.data.lying = false; it.data.rollAng = 0; it.data.restQ = null; layTallFlat(it); applyBottlePose(it); }
    if (t.s && t.s.axis === 'z') it.obj.rotation.y = Math.PI / 2;
    else if (t.s && t.s.axis === 'x') it.obj.rotation.y = 0;
    it.state = "place"; it.from = it.obj.position.clone(); it.to = new THREE.Vector3(t.x, t.y, t.z); it.pt = 0; it.ry = it.obj.rotation.y;
    env.onCtl(); return true;
  }
  // Бросить текущий предмет прямо внутрь открытой коробки (чтобы он физически упал на её дно)
  function throwIntoBox(box) {
    if (!held || !box) return false;
    const it = held; held = null;
    it.inBoxId = null; it.boxOff = null;
    const tx = box.obj.position.x + R(-.06, .06), tz = box.obj.position.z + R(-.05, .05);
    const dx = tx - it.obj.position.x, dz = tz - it.obj.position.z;
    if (isPhysicsProp(it)) {
      it.state = "ragdoll";
      it.bounces = 0;
      it.targetBox = box;
      it.vel = new THREE.Vector3(dx * 2.2, 1.05, dz * 2.2);
      it.tiltVel = R(5, 8);
      it.yawVel = R(-2.5, 2.5);
      it.spinVel = R(-6, 6);
    } else {
      it.state = "place";
      it.from = it.obj.position.clone();
      it.to = new THREE.Vector3(tx, box.obj.position.y + .028, tz);
      it.pt = 0;
      it.ry = box.obj.rotation.y + R(-.25, .25);
    }
    env.audio && env.audio.click(620, .35, 0, .05);
    env.onCtl();
    return true;
  }
  function dropHeld() {
    if (!held) return;
    const openBx = held.kind !== "box" ? lookingAtOpenBox(1.35) : null;
    if (openBx) { throwIntoBox(openBx); return; }
    const it = held; held = null;
    camera.getWorldDirection(tmp);
    // Стартовая точка броска всегда чуть впереди игрока по направлению взгляда, чтобы предмет летел вперёд, а не отскакивал назад
    const startDist = it.kind === 'box' ? .42 : .28;
    const sx = camera.position.x + tmp.x * startDist;
    const sy = Math.max(groundHeightAt(P.x, P.z) + .12, camera.position.y + tmp.y * startDist - .08);
    const sz = camera.position.z + tmp.z * startDist;
    if (!hitsWallCollider(sx, sz, .07, sy) && !(env.isWallBetween && env.isWallBetween(P.x, P.z, sx, sz, { mode: 'item', y1: camera.position.y, y2: sy, r: .07 }))) {
      it.obj.position.set(sx, sy, sz);
    } else {
      it.obj.position.set(P.x, Math.max(groundHeightAt(P.x, P.z) + .12, camera.position.y - .25), P.z);
    }
    it.dropOriginY = camera.position.y;
    if (isPhysicsProp(it)) {
      const isCrouched = !!P.crouch;
      const lookingDown = tmp.y < -0.45;
      const softDrop = isCrouched || lookingDown;
      const isFurn = isFloorFurniture(it) || (it.mass || 0.2) >= 2.2;
      const massScale = 1.0 / Math.pow(Math.max(0.18, it.mass || 0.25), 0.28);
      const baseSp = softDrop ? (isFurn ? 0.55 : 1.05) : ((isFurn ? 1.65 : 2.55) + Math.max(0, tmp.y) * 1.55);
      const sp = baseSp * (isFurn ? Math.min(0.85, massScale) : Math.min(1.25, massScale));
      it.state = "ragdoll";
      it.bounces = 0;
      it.targetBox = null;
      it.vel = new THREE.Vector3(
        tmp.x * sp + (P.vx || 0) * .28,
        softDrop ? Math.max(-0.65, tmp.y * 0.85 + 0.12) : (tmp.y * sp + (isFurn ? 0.32 : 0.88)),
        tmp.z * sp + (P.vz || 0) * .28
      );
      const hLen = Math.hypot(it.vel.x, it.vel.z);
      it.slideDirX = hLen > 1e-3 ? (it.vel.x / hLen) : -Math.sin(P.yaw);
      it.slideDirZ = hLen > 1e-3 ? (it.vel.z / hLen) : -Math.cos(P.yaw);
      // Детерминированный угловой импульс пропорционально скорости броска и моменту инерции (никакого рандомного вращения!)
      it.tiltVel = isFurn ? (softDrop ? 0.12 : hLen * 0.35) : isUprightStable(it) ? (softDrop ? 0.35 : hLen * 0.85) : (softDrop ? 1.15 : Math.min(5.2, 1.4 + hLen * 1.15));
      it.yawVel = 0;
      it.spinVel = 0;
    } else {
      camera.getWorldDirection(tmp); tmp.y = 0; tmp.normalize();
      it.state = "fall"; it.vy = .8;
      it.vx = tmp.x * 1.15; it.vz = tmp.z * 1.15;
    }
    env.onCtl();
  }
  function rotateHeld(dir = 1) {
    if (!held) return;
    heldYaw = (heldYaw + (Math.PI / 2) * dir);
    heldYawT = heldYaw;
    env.audio && env.audio.click(750, .3, 0, .05);
    if (ctx.toast) ctx.toast('Повернули предмет');
    env.onCtl && env.onCtl();
  }
  function trashHeld(bin, done) {
    if (!held) return false;
    if (held.kind === 'good' && held.data && held.data.goodId === 'safekey') { env.ctx && env.ctx.toast && env.ctx.toast('Ключ от сейфа выбрасывать не стоит — без него заначку не достать.'); return false; }
    const it = held; held = null;
    // Если выбрасываем коробку вместе с предметами внутри — удаляем и вложенные предметы
    if (it.kind === "box") {
      for (const ch of items.slice()) if (ch.inBoxId === it.id && ch.kind !== "gun") removeItem(ch);
    }
    it.state = "trash"; it.from = it.obj.position.clone(); it.to = new THREE.Vector3(bin.x, bin.y, bin.z); it.pt = 0; it.done = done; env.onCtl(); return true;
  }

  function syncBoxChildren(box) {
    if (!box || box.kind !== "box" || !box.data.opened) return;
    const c = Math.cos(box.obj.rotation.y), s = Math.sin(box.obj.rotation.y);
    for (const ch of items) {
      if (ch.inBoxId === box.id && ch !== held && ch.boxOff) {
        const { lx, ly, lz, lry } = ch.boxOff;
        ch.obj.position.set(
          box.obj.position.x + lx * c + lz * s,
          box.obj.position.y + ly,
          box.obj.position.z - lx * s + lz * c
        );
        ch.obj.rotation.y = box.obj.rotation.y + lry;
      }
    }
  }

  function clampInsideBoxWalls(x, z, box, r = .04) {
    const dx = x - box.obj.position.x, dz = z - box.obj.position.z;
    const c = Math.cos(box.obj.rotation.y), s = Math.sin(box.obj.rotation.y);
    let lx = dx * c - dz * s, lz = dx * s + dz * c;
    let hitWall = false;
    const maxX = Math.max(.02, box.half.x - r), maxZ = Math.max(.02, box.half.z - r);
    if (Math.abs(lx) > maxX) { lx = Math.sign(lx) * maxX; hitWall = true; }
    if (Math.abs(lz) > maxZ) { lz = Math.sign(lz) * maxZ; hitWall = true; }
    return {
      x: box.obj.position.x + lx * c + lz * s,
      z: box.obj.position.z - lx * s + lz * c,
      hitWall,
    };
  }

  function hitsWallCollider(x, z, r = .05, y = 0) {
    const tr = env.transport && env.transport();
    if (tr && tr.isInsideBus && tr.isInsideBus(x, z, .22)) {
      const { lx, lz } = tr.worldToBus(x, z);
      const inDoor = tr.doorK > .45 && (Math.abs(lx - 1.144) < .38 || Math.abs(lx + 2.241) < .38) && lz > .85;
      if (!inDoor && (lx < -3.22 + r || lx > 2.75 - r || lz < -1.18 + r || lz > 1.18 - r)) return true;
      return false;
    }
    if (Math.abs(x) < KW + r && Math.abs(z) < KD + r) {
      // Стены ларька (кроме открытого дверного проёма)
      const inOpenDoor = x > .42 && x < 1.18 && z < -KD + .12;
      if (!inOpenDoor && (Math.abs(Math.abs(x) - KW) < r + .04 || Math.abs(Math.abs(z) - KD) < r + .04)) return true;
      // Стул внутри ларька (если предмет ниже сиденья или спинки стула)
      if (y < .82 && x > -.23 - r && x < .23 + r && z > .02 - r && z < .46 + r && y < .45) return true;
    }
    if (env.deadBodies) {
      for (const b of env.deadBodies()) {
        // Если предмет катится или летит низко вдоль пола (< b.y - 0.04) в лежащее тело — он упирается и отскакивает от тела, а сверху ложится на него!
        if (y < b.y - .04 && x > b.x1 - r && x < b.x2 + r && z > b.z1 - r && z < b.z2 + r) return true;
      }
    }
    const flHere = groundHeightAt(x, z);
    if (openZoneAt(x, y + .02, z)) return false;
    for (const b of colliders) {
      if (b.tag === "item" || b.tag === "small_item" || b.tag === "door" || b.tag === "bus" || b.tag === "bush" || b.tag === "sign") continue;
      if (b.tag === "zil_fridge" && y >= flHere + 1.50) continue;
      if (b.tag === "shelf" && y >= (x > 41.0 ? flHere + 1.72 : flHere + .78)) continue;
      if ((b.tag === "counter" || b.tag === "radiola") && y >= flHere + .84) continue;
      if (b.tag === "writing_desk" && y >= flHere + .74) continue;
      if (b.tag === "table" && y >= ((b.x1 > 45.8 && b.x2 < 46.8) ? flHere + .48 : flHere + .72)) continue;
      if (b.tag === "tv_stand" && y >= flHere + .56) continue;
      if (b.tag === "hero_bed" && y >= (z > 83.22 ? flHere + .98 : z < 81.32 ? flHere + .90 : flHere + .49)) continue;
      if (b.tag === "bathtub" && (y >= flHere + .56 || (x > 41.40 && x < 42.73 && z > 79.24 && z < 79.71))) continue;
      if ((b.tag === "chair" || b.tag === "bunk" || b.tag === "busstop_bench") && y >= flHere + .42) continue;
      if (x > b.x1 - r && x < b.x2 + r && z > b.z1 - r && z < b.z2 + r) return true;
    }
    return false;
  }

  function itemsTick(dt) {
    for (const sp of spillPuddles) if (sp.life > 0) {
      sp.life -= dt;
      if (sp.curScale < sp.maxScale) {
        sp.curScale = Math.min(sp.maxScale, sp.curScale + dt * 2.4);
        sp.m.scale.set(sp.curScale, 1, sp.curScale);
      }
      if (sp.life < 12) sp.m.material.opacity = Math.max(0, (sp.life / 12) * 0.65);
      if (sp.life <= 0) sp.m.visible = false;
    }
    // Обновляем осколки разбитых бутылок
    for (const sh of shards) if (sh.life > 0) {
      sh.life -= dt;
      if (!sh.settled) {
        sh.v.y -= 9.8 * dt;
        const px = sh.m.position.x, pz = sh.m.position.z, py = sh.m.position.y, wasIn = inK(px, pz);
        sh.m.position.addScaledVector(sh.v, dt);
        // стены ларька: осколок отскакивает, а не пролетает насквозь
        if (wasIn !== inK(sh.m.position.x, sh.m.position.z)) {
          if (wasIn !== inK(sh.m.position.x, pz)) { sh.m.position.x = px; sh.v.x *= -.3; }
          if (wasIn !== inK(sh.m.position.x, sh.m.position.z)) { sh.m.position.z = pz; sh.v.z *= -.3; }
        }
        // поверхность под осколком пересчитывается на лету: слетел с прилавка/полки — падает до пола, а не висит в воздухе
        sh.fl = surfaceBelow(sh.m.position.x, sh.m.position.z, Math.max(py, sh.m.position.y)); // от высоты до шага — быстрый осколок не проскакивает сквозь прилавок
        sh.m.rotation.x += sh.rv.x * dt;
        sh.m.rotation.y += sh.rv.y * dt;
        sh.m.rotation.z += sh.rv.z * dt;
        if (sh.m.position.y <= sh.fl + .016) {
          sh.m.position.y = sh.fl + .016;
          if (Math.abs(sh.v.y) > .65) {
            sh.v.y *= -.28;
            sh.v.x *= .55; sh.v.z *= .55;
            sh.rv.multiplyScalar(.5);
          } else {
            sh.settled = true;
            sh.m.rotation.x = 0.08;
            sh.m.rotation.z = 0.06;
          }
        }
      }
      if (sh.life <= 0) sh.m.visible = false;
    }

    const pSpd = Math.hypot(P.vx || 0, P.vz || 0);
    const tr = env.transport && env.transport();
    const bm = tr && tr.busMotion ? tr.busMotion() : null;
    for (let _ii = items.length - 1; _ii >= 0; _ii--) {
      const it = items[_ii];
      if (!it) continue;
      // Спящий режим для далёких неподвижных предметов (>34 м от игрока и вне автобуса)
      if (it.state === 'rest' && !it._inBus && it !== held && it.obj) {
        const _dx = it.obj.position.x - P.x, _dz = it.obj.position.z - P.z;
        if (_dx * _dx + _dz * _dz > 1156 && (!tr || !tr.bus || (Math.abs(it.obj.position.x - tr.bus.position.x) > 10 || Math.abs(it.obj.position.z - tr.bus.position.z) > 10))) continue;
      }
      // Физика предметов внутри автобуса ПАЗ-652: перенос вместе с автобусом + инерция разгона/торможения/поворотов и качение по полу
      if (tr && bm && it !== held && !it.inBoxId) {
        const wasInBus = !!it._inBus;
        // Проверяем принадлежность салону с учётом смещения автобуса за текущий кадр
        const prevWx = it.obj.position.x - (wasInBus ? bm.dx : 0);
        const prevWz = it.obj.position.z - (wasInBus ? bm.dz : 0);
        const insideNow = tr.isInsideBus(prevWx, prevWz, .06) && it.obj.position.y >= .38 && it.obj.position.y <= 2.45;
        if (insideNow) {
          it._inBus = true;
          // 1) Переносим предмет вместе с движением и поворотом кузова автобуса за кадр
          const cPrev = Math.cos(bm.prevHeading), sPrev = Math.sin(bm.prevHeading);
          const dx0 = prevWx - (tr.bus.position.x - bm.dx), dz0 = prevWz - (tr.bus.position.z - bm.dz);
          let lx =  dx0 * cPrev - dz0 * sPrev;
          let lz =  dx0 * sPrev + dz0 * cPrev;
          const dHead = bm.heading - bm.prevHeading;
          it.obj.rotation.y += Math.atan2(Math.sin(dHead), Math.cos(dHead));

          // 2) Инерционные силы от движения автобуса в локальных осях салона (lx — вдоль салона, lz — поперёк)
          // При разгоне автобуса (accel > 0) предметы откатываются назад (-lx), при торможении (accel < 0) — летят вперёд (+lx);
          // в поворотах центробежная сила сносит предметы поперёк салона (lz), а кочки дороги добавляют вибрацию.
          it.busVx = it.busVx || 0;
          it.busVz = it.busVz || 0;
          const isRound = canRollOnSide(it);
          const inertiaMul = isRound ? 1.55 : (it.kind === 'box' ? .75 : 1.05);
          const axBus = (-bm.accel * 1.35 + bm.bumpX * (isRound ? 1.8 : .9)) * inertiaMul;
          const azBus = (-bm.turnRate * bm.v * 1.15 + bm.bumpZ * (isRound ? 1.8 : .9)) * inertiaMul;

          const forceMag = Math.hypot(axBus, azBus);
          const staticThresh = isRound ? .18 : (it.kind === 'box' ? 1.65 : .85);
          if (forceMag > staticThresh || Math.hypot(it.busVx, it.busVz) > .04) {
            it.busVx += axBus * dt;
            it.busVz += azBus * dt;
            if (isRound && it.state === 'rest') {
              it.data.lying = true;
              applyBottlePose(it);
            }
          }
          const bSpd = Math.hypot(it.busVx, it.busVz);
          if (bSpd > .015) {
            lx += it.busVx * dt;
            lz += it.busVz * dt;
            const rItem = it.kind === 'box' ? .22 : .07;
            // Отражение от бортов салона, заднего дивана и перегородки водителя
            let hitBusWall = false;
            if (lx < -3.12 + rItem) { lx = -3.12 + rItem; it.busVx = -it.busVx * .42; hitBusWall = true; }
            if (lx >  2.55 - rItem) { lx =  2.55 - rItem; it.busVx = -it.busVx * .42; hitBusWall = true; }
            const inOpenDoor = bm.doorK > .45 && (Math.abs(lx - 1.144) < .36 || Math.abs(lx + 2.241) < .36);
            if (lz < -1.14 + rItem) { lz = -1.14 + rItem; it.busVz = -it.busVz * .42; hitBusWall = true; }
            if (!inOpenDoor && lz > 1.14 - rItem) { lz = 1.14 - rItem; it.busVz = -it.busVz * .42; hitBusWall = true; }
            // Столкновение с тумбами сидений, если предмет катится по полу (y < 0.95)
            if (it.obj.position.y < .95 && Math.abs(lz) > .34 && lx > -1.85 && lx < 1.05) {
              const nearSeatRow = [-1.41, -.58, .22, 1.05].some(sx => Math.abs(lx - sx) < .16);
              if (nearSeatRow) {
                it.busVx *= -.38;
                it.busVz *= -.38;
                hitBusWall = true;
              }
            }
            if (hitBusWall && bSpd > .35) {
              env.audio && env.audio.click(isBreakableGlass(it) ? 1620 : 580, Math.min(.38, bSpd * .14), 0, .05);
            }
            // Вращение катящихся бутылок и банок по полу автобуса
            if (isRound) {
              const cH = Math.cos(bm.heading), sH = Math.sin(bm.heading);
              const wVx = it.busVx * cH + it.busVz * sH;
              const wVz = -it.busVx * sH + it.busVz * cH;
              if (bSpd > .06) it.obj.rotation.y = Math.atan2(wVx, -wVz);
              const spin = it.obj.userData.spin;
              if (spin) {
                spin.rotation.y -= (bSpd * dt) / Math.max(.025, it.rollR || .036);
                it.data.rollAng = spin.rotation.y;
              }
            } else if (bSpd > .25) {
              it.obj.rotation.y += (it.busVz * .35 - it.busVx * .15) * dt;
            }
            const damp = isRound ? 1.25 : (it.kind === 'box' ? 3.8 : 2.6);
            it.busVx *= Math.max(0, 1 - dt * damp);
            it.busVz *= Math.max(0, 1 - dt * damp);
            if (Math.hypot(it.busVx, it.busVz) < .02) {
              it.busVx = 0; it.busVz = 0;
            }
          }
          const wp = tr.busToWorld(lx, it.obj.position.y, lz, tmp);
          it.obj.position.x = wp.x;
          it.obj.position.z = wp.z;
          if (it.state === 'rest') {
            const flBus = surfaceBelow(wp.x, wp.z, it.obj.position.y + .08, it);
            if (it.obj.position.y > flBus + .04) {
              it.state = 'fall';
              it.vy = 0;
            } else {
              it.obj.position.y = flBus;
            }
          }
          syncCol(it);
          syncBoxChildren(it);
        } else {
          it._inBus = false;
          it.busVx = 0;
          it.busVz = 0;
        }
      }
      if (it === held) {
        heldYaw += (heldYawT - heldYaw) * Math.min(1, dt * 10);
        camera.getWorldDirection(tmp);
        tmp.normalize();
        let tgt;
        if (it.kind === "box") {
          // Коробка в руках несётся плавно и стабильно перед игроком без захода в стены
          const hDirX = -Math.sin(P.yaw), hDirZ = -Math.cos(P.yaw);
          let bReach = .62;
          for (let step = .24; step <= bReach; step += .06) {
            if (hitsWallCollider(camera.position.x + hDirX * step, camera.position.z + hDirZ * step, .26)) {
              bReach = Math.max(.22, step - .06);
              break;
            }
          }
          tgt = tmp2.set(
            camera.position.x + hDirX * bReach,
            clamp(camera.position.y - .42 + tmp.y * .22, groundHeightAt(P.x, P.z) + .04, camera.position.y - .15),
            camera.position.z + hDirZ * bReach
          );
          const nearDoorway = P.x > .2 && P.x < 1.4 && P.z < -KD + .75; // у дверного проёма коробку не держим внутри — иначе её не вынести
          if (inK(P.x, P.z) && !nearDoorway) {
            tgt.x = clamp(tgt.x, -KW + .28, KW - .28);
            tgt.z = clamp(tgt.z, -KD + .28, KD - .28);
          }
          it.obj.rotation.y = P.yaw + heldYaw;
        } else if (isFloorFurniture(it) || (it.kind === 'good' && it.data && it.data.goodId === 'tv_rubin')) {
          // Крупную мебель (кресло, стул, табурет, столик, тумбочку) и телевизор «Рубин» несём стабильно перед собой,
          // не приклеивая к стенам/полкам и не заталкивая в камеру!
          const gidF = it.data && it.data.goodId;
          const hDirX = -Math.sin(P.yaw), hDirZ = -Math.cos(P.yaw);
          let fReach = (gidF === 'armchair_item' || gidF === 'coffee_table') ? 0.92 : 0.78;
          const fPad = (gidF === 'armchair_item' || gidF === 'coffee_table') ? 0.30 : 0.24;
          for (let step = 0.34; step <= fReach; step += 0.06) {
            if (hitsWallCollider(camera.position.x + hDirX * step, camera.position.z + hDirZ * step, fPad)) {
              fReach = Math.max(0.34, step - 0.06);
              break;
            }
          }
          const flHere = groundHeightAt(P.x, P.z);
          tgt = tmp2.set(
            camera.position.x + hDirX * fReach,
            clamp(camera.position.y - 0.78 + tmp.y * 0.24, flHere + 0.04, camera.position.y - 0.40),
            camera.position.z + hDirZ * fReach
          );
          it.obj.rotation.y = P.yaw + heldYaw;
        } else {
          const pl = rayPlace(2.25, it);
          if (pl && (pl.s.name === 'shelf' || pl.s.name === 'safe' || pl.s.name === 'counter' || pl.s.name === 'apt_top' || pl.s.name === 'box_inside' || pl.s.name === 'item' || pl.s.name === 'body') && pl.t < (pl.s.apt ? 2.55 : pl.s.safe ? 1.85 : 1.75)) {
            tgt = tmp2.set(pl.x, pl.y + .008, pl.z);
            if (pl.s.axis === 'z') it.obj.rotation.y = Math.PI / 2;
            else if (pl.s.axis === 'x') it.obj.rotation.y = 0;
            else it.obj.rotation.y = P.yaw + heldYaw;
          } else {
            let reach = it.kind === "pack" ? .48 : it.kind === "gun" ? .46 : .42;
            const vOff = it.kind === "pack" ? -.07 : it.kind === "gun" ? -.10 : -.05;
            const itemR = it.kind === "gun" ? .28 : .14;
            if (inK(camera.position.x, camera.position.z)) {
              const toWallX = tmp.x > 0 ? (KW - camera.position.x) / tmp.x : (-KW - camera.position.x) / tmp.x;
              const toWallZ = tmp.z > 0 ? (KD - camera.position.z) / tmp.z : (-KD - camera.position.z) / tmp.z;
              const wDist = Math.min(toWallX > 0 ? toWallX : 99, toWallZ > 0 ? toWallZ : 99);
              if (wDist < reach + itemR) reach = Math.max(.18, wDist - itemR);
            }
            for (let step = .18; step <= reach; step += .05) {
              if (hitsWallCollider(camera.position.x + tmp.x * step, camera.position.z + tmp.z * step, itemR * .65, camera.position.y + tmp.y * step + vOff)) {
                reach = Math.max(.18, step - .05);
                break;
              }
            }
            tgt = tmp2.copy(camera.position).addScaledVector(tmp, reach);
            tgt.y += vOff;
            if (inK(P.x, P.z)) {
              const padW = it.kind === "gun" ? .36 : .14;
              tgt.x = clamp(tgt.x, -KW + padW, KW - padW);
              tgt.z = clamp(tgt.z, -KD + padW, KD - padW);
            }
            const minFl = groundHeightAt(tgt.x, tgt.z);
            if (tgt.y < minFl + .02) tgt.y = minFl + .02;
            const maxCeil = ceilingHeightAt(tgt.x, tgt.z) - Math.max(.08, (it.half && it.half.y ? it.half.y * 2 : .14)) - .03;
            if (tgt.y > maxCeil) tgt.y = maxCeil;
            it.obj.rotation.y = P.yaw + heldYaw;
          }
        }
        if (env.isWallBetween && !(safeOpen() && inSafeBox(tgt.x, tgt.y, tgt.z))) {
          const padR = it.kind === "box" ? .24 : it.kind === "gun" ? .26 : .12;
          if (env.isWallBetween(P.x, P.z, tgt.x, tgt.z, { mode: 'item', y1: camera.position.y, y2: tgt.y, r: padR })) {
            let bestK = 0;
            for (let k = .75; k >= .15; k -= .15) {
              const tx = P.x + (tgt.x - P.x) * k, tz = P.z + (tgt.z - P.z) * k;
              if (!env.isWallBetween(P.x, P.z, tx, tz, { mode: 'item', y1: camera.position.y, y2: tgt.y, r: padR }) && !hitsWallCollider(tx, tz, padR, tgt.y)) {
                bestK = k;
                break;
              }
            }
            tgt.x = P.x + (tgt.x - P.x) * bestK;
            tgt.z = P.z + (tgt.z - P.z) * bestK;
          }
        }
        it.obj.position.lerp(tgt, Math.min(1, dt * 16));
        if (env.isWallBetween && !(safeOpen() && inSafeBox(tgt.x, tgt.y, tgt.z)) && env.isWallBetween(P.x, P.z, it.obj.position.x, it.obj.position.z, { mode: 'item', y1: camera.position.y, y2: it.obj.position.y, r: .08 })) {
          it.obj.position.x = tgt.x;
          it.obj.position.z = tgt.z;
        }
        syncBoxChildren(it);
      } else if (it.state === "place") {
        it.pt += dt * 3.5; const k = ease(Math.min(1, it.pt)); it.obj.position.lerpVectors(it.from, it.to, k); it.obj.position.y += Math.sin(k * Math.PI) * .12;
        syncBoxChildren(it);
        if (it.pt >= 1) { it.state = "rest"; it.obj.position.copy(it.to); env.audio && env.audio.thud(.25 + it.mass * .02); syncCol(it); syncBoxChildren(it); persist(); }
      } else if (it.state === "trash") {
        it.pt += dt * 2.6; const k = ease(Math.min(1, it.pt)); it.obj.position.lerpVectors(it.from, it.to, k); it.obj.position.y += Math.sin(k * Math.PI) * .35; it.obj.rotation.x = k * .5;
        syncBoxChildren(it);
        if (it.pt >= 1) { it.state = "sink"; it.vy = 0; }
      } else if (it.state === "sink") {
        it.vy -= 9.8 * dt; it.obj.position.y += it.vy * dt;
        syncBoxChildren(it);
        if (it.obj.position.y < it.to.y - .7) { env.audio && env.audio.thud(.5 + it.mass * .03); const d = it.done; removeItem(it); d && d(it); return; }
      } else if (it.state === "ragdoll" && isPhysicsProp(it)) {
        // 3D-полёт, вращение и отскоки любого брошенного предмета (бутылок, консервов, пачек сигарет, продуктов)
        const ox = it.obj.position.x, oz = it.obj.position.z, oy = it.obj.position.y;
        it.vel.y -= 9.8 * dt;
        let nx = ox + it.vel.x * dt;
        let nz = oz + it.vel.z * dt;
        let ny = oy + it.vel.y * dt;
        const standY = (it.centerY || .135) + .003;
        const lieY = (it.rollR || .036) + .004;
        const itemTopH = Math.max(.08, (it.half && it.half.y ? it.half.y * 2 : standY * 1.6));

        // 1) Жёсткое столкновение с потолком (в ларьке y = 2.46, под лампочкой 2.18 и во всех зданиях) и с нижней стороной полок при броске вверх
        let ceilY = ceilingHeightAt(nx, nz);
        if (it.vel.y > 0) {
          for (const s of SURF) {
            if (nx > s.x1 && nx < s.x2 && nz > s.z1 && nz < s.z2 && oy + itemTopH <= s.y - .005 && s.y - .015 < ceilY) {
              ceilY = s.y - .015;
            }
          }
        }
        if (ny + itemTopH >= ceilY) {
          ny = Math.max(groundHeightAt(nx, nz), ceilY - itemTopH);
          if (it.vel.y > 0) {
            const upImpact = it.vel.y;
            if (isBreakableGlass(it) && upImpact > 2.65) { shatterBottle(it); continue; }
            it.vel.y = -upImpact * .42;
            it.vel.x *= .72;
            it.vel.z *= .72;
            it.tiltVel = R(-9, 9);
            env.audio && env.audio.click(isBreakableGlass(it) ? 1680 : 540, Math.min(.42, upImpact * .08), 0, .05);
          }
        }

        // 2) Если предмет летит внутри открытой коробки — удерживаем его стенками коробки
        const bx = it.targetBox || findOpenBoxAt(nx, nz, ny, it);
        if (bx && ny < bx.obj.position.y + bx.half.y * 2 + .04) {
          const cl = clampInsideBoxWalls(nx, nz, bx, .07);
          if (cl.hitWall) {
            nx = cl.x; nz = cl.z;
            it.vel.x *= -.32; it.vel.z *= -.32;
          }
        } else {
          const hitW = hitsWallCollider(nx, nz, .07, ny)
            || (env.isWallBetween && env.isWallBetween(ox, oz, nx, nz, { mode: 'item', y1: oy, y2: ny, r: .07 }));
          if (hitW) {
            const hSpd = Math.hypot(it.vel.x, it.vel.z);
            if (isBreakableGlass(it) && hSpd > 2.35) { shatterBottle(it); continue; }
            const hitX = hitsWallCollider(nx, oz, .07, ny) || (env.isWallBetween && env.isWallBetween(ox, oz, nx, oz, { mode: 'item', y1: oy, y2: ny, r: .07 }));
            const hitZ = hitsWallCollider(ox, nz, .07, ny) || (env.isWallBetween && env.isWallBetween(ox, oz, ox, nz, { mode: 'item', y1: oy, y2: ny, r: .07 }));
            if (hitX) { it.vel.x *= -.42; nx = ox; }
            if (hitZ) { it.vel.z *= -.42; nz = oz; }
            if (!hitX && !hitZ) { it.vel.x *= -.42; it.vel.z *= -.42; nx = ox; nz = oz; }
            if (env.isWallBetween && env.isWallBetween(ox, oz, nx, nz, { mode: 'item', y1: oy, y2: ny, r: .07 })) { nx = ox; nz = oz; }
            env.audio && env.audio.click(isBreakableGlass(it) ? 1750 : 620, .28, 0, .05);
          }
          // Дополнительное удержание внутри стен ларька (кроме открытой двери/сейфа)
          if (inK(ox, oz) && !inSafeBox(nx, ny, nz)) {
            const throughOpenDoor = env.doorOpen && env.doorOpen() > .35 && ox > .42 && ox < 1.18 && nz < -KD + .08 && ny < 2.02;
            if (!throughOpenDoor) {
              if (nx < -KW + .08) { nx = -KW + .08; it.vel.x = Math.abs(it.vel.x) * .42; }
              if (nx >  KW - .08) { nx =  KW - .08; it.vel.x = -Math.abs(it.vel.x) * .42; }
              if (nz < -KD + .08) { nz = -KD + .08; it.vel.z = Math.abs(it.vel.z) * .42; }
              if (nz >  KD - .08) { nz =  KD - .08; it.vel.z = -Math.abs(it.vel.z) * .42; }
            }
          }
        }

        it.obj.position.set(nx, ny, nz);
        it.obj.rotation.y += (it.yawVel || 0) * dt;
        const piv = it.obj.userData.piv, spin = it.obj.userData.spin;
        const isFurn = isFloorFurniture(it) || (it.mass || 0.2) >= 2.2;
        if (piv && spin) {
          if (isFurn) {
            // Мебель при сильном ударе/пинке реалистично заваливается на бок/спинку до ~95°
            const maxTilt = it.lastStrikeKick ? 1.66 : 1.48;
            piv.rotation.x = clamp(piv.rotation.x + (it.tiltVel || 0) * dt, -maxTilt, maxTilt);
          } else {
            piv.rotation.x += (it.tiltVel || 0) * dt;
            spin.rotation.y += (it.spinVel || 0) * dt;
          }
          piv.position.y = lieY + (1 - Math.abs(Math.sin(piv.rotation.x))) * Math.max(0, standY - lieY);
        }

        const fl = bx ? (bx.obj.position.y + .028) : surfaceBelow(nx, nz, (it.vel.y > .1 ? oy : ny + .08), it);
        if (it.vel.y <= .15 && it.obj.position.y <= fl) {
          it.obj.position.y = fl;
          const hSpd = Math.hypot(it.vel.x, it.vel.z);
          if (hSpd > 1e-3) {
            it.slideDirX = it.vel.x / hSpd;
            it.slideDirZ = it.vel.z / hSpd;
          }
          const imp = Math.abs(it.vel.y) + hSpd * .42;
          const fallDist = (it.dropOriginY != null ? it.dropOriginY : (fl + 1.3)) - fl;
          if (!bx && isBreakableGlass(it)) {
            const highOrFar = fallDist > 0.68 || imp > 2.95 || hSpd > 1.85;
            const softDrop = fallDist < 0.50 && imp < 2.50 && hSpd < 1.35;
            if (highOrFar && !softDrop) {
              shatterBottle(it);
              continue;
            }
          }
          it.bounces = (it.bounces || 0) + 1;
          if (isBreakableGlass(it)) env.audio && env.audio.click(1650, Math.min(.5, imp * .09), 0, .05);
          else if (canRollOnSide(it)) env.audio && env.audio.click(940, Math.min(.45, imp * .08), 0, .05);
          else env.audio && env.audio.thud(Math.min(.48, .12 + imp * .05 + (it.mass || .2) * .018));

          const eRest = isFurn ? 0.08 : canRollOnSide(it) ? 0.25 : 0.16;
          if (!bx && it.bounces === 1 && Math.abs(it.vel.y) > (isFurn ? 1.85 : 1.30)) {
            it.vel.y = -it.vel.y * eRest;
            const fric = isFurn ? 0.42 : 0.58;
            it.vel.x *= fric; it.vel.z *= fric;
            it.tiltVel = (it.tiltVel || 0) * 0.45;
          } else if (canRollOnSide(it)) {
            it.data.lying = true;
            if (piv && spin) {
              piv.position.set(0, lieY, 0);
              piv.rotation.set(Math.PI / 2, 0, 0);
            }
            if (hSpd > .05) {
              it.obj.rotation.y = Math.atan2(it.vel.x, -it.vel.z);
            }
            it.rollSpd = bx ? Math.min(.28, hSpd * .30) : (hSpd * .76);
            it.state = "roll";
          } else {
            // Детерминированная укладка на опорную грань / ножки и инерционное скольжение строго по вектору скорости!
            if (it.kind === 'good' && it.data && it.data.goodId === 'guitar') {
              layTallFlat(it);
              applyBottlePose(it);
            } else {
              settleBoxPose(it, hSpd);
            }
            it.rollSpd = bx ? Math.min(.15, hSpd * .20) : Math.min(isFurn ? 1.65 : 1.15, hSpd * (isFurn ? 0.58 : 0.52));
            it.state = "roll";
          }
        }
      } else if (it.state === "roll" && isPhysicsProp(it)) {
        // Качение бутылок/банок и скольжение по инерции вдоль реального вектора движения (slideDirX, slideDirZ)
        const ds = (it.rollSpd || 0) * dt;
        const rx = it.slideDirX != null ? it.slideDirX : Math.sin(it.obj.rotation.y);
        const rz = it.slideDirZ != null ? it.slideDirZ : Math.cos(it.obj.rotation.y);
        let nx = it.obj.position.x + rx * ds;
        let nz = it.obj.position.z + rz * ds;
        const bx = findOpenBoxAt(it.obj.position.x, it.obj.position.z, it.obj.position.y + .02, it);
        if (bx) {
          const cl = clampInsideBoxWalls(nx, nz, bx, .08);
          if (cl.hitWall) {
            nx = cl.x; nz = cl.z;
            it.rollSpd *= -.25;
          }
          it.obj.position.y = bx.obj.position.y + .028;
        } else if (hitsWallCollider(nx, nz, .07, it.obj.position.y) || (env.isWallBetween && env.isWallBetween(it.obj.position.x, it.obj.position.z, nx, nz, { mode: 'item', y1: it.obj.position.y, y2: it.obj.position.y, r: .07 }))) {
          it.rollSpd *= -.32;
          nx = it.obj.position.x; nz = it.obj.position.z;
          env.audio && env.audio.click(isBreakableGlass(it) ? 1550 : 620, .2, 0, .04);
        } else {
          it.obj.position.y = surfaceBelow(nx, nz, it.obj.position.y + .06, it);
        }
        it.obj.position.x = nx;
        it.obj.position.z = nz;
        if (canRollOnSide(it)) {
          const spin = it.obj.userData.spin;
          if (spin) {
            spin.rotation.y -= ds / Math.max(.025, it.rollR || .036);
            it.data.rollAng = spin.rotation.y;
          }
        }
        const isFurn = isFloorFurniture(it) || (it.mass || 0.2) >= 2.2;
        const baseDamp = isFurn ? 4.2 : canRollOnSide(it) ? (inK(nx, nz) || (nz > 6.3 && nz < 14.1) ? 1.55 : 2.8) : 5.8;
        const damp = bx ? 6.5 : baseDamp;
        it.rollSpd *= Math.max(0, 1 - dt * damp);
        if (Math.abs(it.rollSpd) < .025) {
          it.rollSpd = 0;
          it.state = "rest";
          syncCol(it);
          persist();
        }
      } else if (it.state === "fall") {
        it.vy -= 9.8 * dt;
        it.obj.position.y += it.vy * dt;
        const fallTopH = Math.max(.08, (it.half && it.half.y ? it.half.y * 2 : .16));
        const fallCeilY = ceilingHeightAt(it.obj.position.x, it.obj.position.z);
        if (it.obj.position.y + fallTopH >= fallCeilY) {
          it.obj.position.y = fallCeilY - fallTopH;
          if (it.vy > 0) it.vy = -it.vy * .38;
        }
        if (it.vx || it.vz) {
          let nx = it.obj.position.x + (it.vx || 0) * dt;
          let nz = it.obj.position.z + (it.vz || 0) * dt;
          const wallR = it.kind === "gun" ? .32 : it.kind === "box" ? .24 : .08;
          const bx = findOpenBoxAt(nx, nz, it.obj.position.y, it);
          if (bx && it.obj.position.y < bx.obj.position.y + bx.half.y * 2 + .05) {
            const cl = clampInsideBoxWalls(nx, nz, bx, .06);
            nx = cl.x; nz = cl.z;
            if (cl.hitWall) { it.vx *= -.25; it.vz *= -.25; }
          } else if (hitsWallCollider(nx, nz, wallR, it.obj.position.y) || (env.isWallBetween && env.isWallBetween(it.obj.position.x, it.obj.position.z, nx, nz, { mode: 'item', y1: it.obj.position.y, y2: it.obj.position.y, r: wallR }))) {
            it.vx *= -.3; it.vz *= -.3;
            nx = it.obj.position.x; nz = it.obj.position.z;
          }
          if (inK(it.obj.position.x, it.obj.position.z) && !inSafeBox(nx, it.obj.position.y, nz)) {
            nx = clamp(nx, -KW + wallR, KW - wallR);
            nz = clamp(nz, -KD + wallR, KD - wallR);
          }
          it.obj.position.x = nx; it.obj.position.z = nz;
        }
        const fl = surfaceBelow(it.obj.position.x, it.obj.position.z, it.obj.position.y + .05, it);
        syncBoxChildren(it);
        if (it.obj.position.y <= fl) {
          it.obj.position.y = fl;
          if (it.vy < -2.5) {
            it.vy *= -.25;
            it.vx = (it.vx || 0) * .5; it.vz = (it.vz || 0) * .5;
            env.audio && env.audio.thud(.4 + it.mass * .03);
          } else {
            it.vy = 0; it.vx = 0; it.vz = 0;
            it.state = "rest";
            syncCol(it);
            syncBoxChildren(it);
            persist();
          }
        }
      } else if (it.state === "rest" && !it.inBoxId) {
        const fl = surfaceBelow(it.obj.position.x, it.obj.position.z, it.obj.position.y + .04, it);
        if (it.obj.position.y > fl + .018) {
          it.state = "fall";
          it.vy = 0;
          it.vx = 0;
          it.vz = 0;
          continue;
        }
        // Столкновение катящихся/падающих предметов друг с другом (эффект домино!)
        for (const other of items) {
          if (other === it || other === held || other.inBoxId || other.state === "rest" || other.state === "place") continue;
          if (inSafeBox(it.obj.position.x, it.obj.position.y, it.obj.position.z)) break;
          const dy = Math.abs(it.obj.position.y - other.obj.position.y);
          if (dy > .28) continue;
          const dx = it.obj.position.x - other.obj.position.x, dz = it.obj.position.z - other.obj.position.z;
          const dist = Math.hypot(dx, dz), minD = (it.kind === "box" ? .26 : .09) + (other.kind === "box" ? .26 : .09);
          if (dist > 1e-4 && dist < minD) {
            const nx = dx / dist, nz = dz / dist;
            it.obj.position.x += nx * (minD - dist) * .5;
            it.obj.position.z += nz * (minD - dist) * .5;
            if (isPhysicsProp(it)) {
              if (canRollOnSide(it)) it.data.lying = true;
              applyBottlePose(it);
              it.obj.rotation.y = Math.atan2(nx, -nz);
              it.rollSpd = Math.max(it.rollSpd || 0, .85);
              it.state = "roll";
            }
          }
        }
        if (isPhysicsProp(it) && pSpd > .35) {
        // Если игрок наступает/пинает лежащий на полу предмет — он откатывается или сдвигается, а нога ГГ делает движение пинка
        const dx = it.obj.position.x - P.x, dz = it.obj.position.z - P.z;
        const d = Math.hypot(dx, dz);
        if (d < .36 && Math.abs(it.obj.position.y - surfaceBelow(P.x, P.z, P.h - 1.0)) < .15 && !canRollOnSide(it) && (it.mass || .2) < 2.5) {
          // задели ногой пачку/коробок/книгу и т.п. — отлетает, кувыркается и ложится как придётся
          const k = Math.min(2.4, pSpd * .55 + .4), nd = Math.max(.01, d);
          it.state = 'ragdoll'; it.bounces = 1; it.targetBox = null;
          it.vel = new THREE.Vector3(dx / nd * k + (P.vx || 0) * .2, .55 + Math.random() * .4, dz / nd * k + (P.vz || 0) * .2);
          it.tiltVel = R(5, 11) * (Math.random() < .5 ? -1 : 1); it.yawVel = R(-5, 5); it.spinVel = R(-7, 7); it.dropOriginY = it.obj.position.y;
          env.onKick && env.onKick(); env.audio && env.audio.click(720, .22, 0, .05);
          continue;
        }
        if (d < .36 && Math.abs(it.obj.position.y - surfaceBelow(P.x, P.z, P.h - 1.0)) < .15) {
          if (canRollOnSide(it)) it.data.lying = true;
          applyBottlePose(it);
          it.obj.rotation.y = Math.atan2(dx, -dz);
          it.rollSpd = Math.min(2.2, pSpd * (canRollOnSide(it) ? .65 : .42) + .35);
          it.state = "roll";
          env.onKick && env.onKick();
          env.audio && env.audio.click(isBreakableGlass(it) ? 1600 : 720, .24, 0, .05);
        }
        }
      }
    }
  }

  // ================= доставка =================
  const DOORSTEP = { x: .8, z: -KD - .75 };
  let knockT = 0;
  const DELIVERY_WORDS = [[0, .7, 'Доставка'], [.7, 1.2, 'товара.'], [1.62, 2.12, 'Открывайте.']];
  // Разбивка заказа на несколько коробок по вместимости:
  // В одной коробке (0.50 × 0.36 × 0.40) помещается максимум 2 колонки (lz = -0.094 и +0.094) по 2 яруса (итого 4 слота),
  // причём высокий лоток с бутылками (vodka, beer, samogon, soda) занимает всю высоту своей колонки (2 слота),
  // поэтому в одну коробку никогда не набивается гора товара выше бортиков!
  function splitOrderIntoBoxChunks(contents) {
    const outfits = {};
    const packList = [];
    for (const [k, val] of Object.entries(contents || {})) {
      const q = Array.isArray(val) ? val[0] : (val | 0);
      const unit = Array.isArray(val) ? val[1] : undefined;
      if (k.startsWith('outfit:') || k.startsWith('up:')) {
        outfits[k] = [q, unit];
        continue;
      }
      let rem = q;
      const isTall = ['vodka', 'beer', 'samogon', 'soda'].includes(k);
      while (rem > 0) {
        const cnt = Math.min(5, rem);
        rem -= cnt;
        packList.push({ goodId: k, count: cnt, unitCost: unit, slots: isTall ? 2 : 1 });
      }
    }
    const boxes = [];
    for (const pk of packList) {
      let placed = false;
      for (const b of boxes) {
        for (let col = 0; col < 2; col++) {
          if (b.colSlots[col] + pk.slots <= 2) {
            b.packs.push({ ...pk, col, layer: b.colSlots[col] });
            b.colSlots[col] += pk.slots;
            placed = true;
            break;
          }
        }
        if (placed) break;
      }
      if (!placed) {
        const nb = { colSlots: [pk.slots, 0], packs: [{ ...pk, col: 0, layer: 0 }], contents: {} };
        boxes.push(nb);
      }
    }
    if (boxes.length === 0) {
      boxes.push({ colSlots: [0, 0], packs: [], contents: {} });
    }
    for (const b of boxes) {
      for (const p of b.packs) {
        const cur = b.contents[p.goodId] ? b.contents[p.goodId][0] : 0;
        b.contents[p.goodId] = [cur + p.count, p.unitCost];
      }
    }
    if (Object.keys(outfits).length > 0) {
      Object.assign(boxes[0].contents, outfits);
    }
    return boxes;
  }

  function doorstepBoxSpot(idx) {
    // коробки доставки: вразнобой у двери — рядом друг с другом или одна на другой (не выше двух), всегда на земле или на коробке
    const H = .36, near = items.filter(i => i.kind === 'box' && i.state === 'rest' && Math.hypot(i.obj.position.x - DOORSTEP.x, i.obj.position.z - DOORSTEP.z) < 2.2);
    const base = near.filter(b => b.obj.position.y < groundHeightAt(b.obj.position.x, b.obj.position.z) + .1 && !near.some(o => o !== b && Math.hypot(o.obj.position.x - b.obj.position.x, o.obj.position.z - b.obj.position.z) < .2 && o.obj.position.y > b.obj.position.y + .2));
    if (base.length && Math.random() < .4) { const b = base[Math.floor(Math.random() * base.length)]; return { x: b.obj.position.x + R(-.05, .05), y: b.obj.position.y + H, z: b.obj.position.z + R(-.04, .04), ry: b.obj.rotation.y + R(-.35, .35) }; }
    for (let k = 0; k < 30; k++) {
      const x = DOORSTEP.x + R(-1.0, 1.0), z = DOORSTEP.z - R(0, .9);
      if (near.some(b => Math.abs(b.obj.position.x - x) < .52 && Math.abs(b.obj.position.z - z) < .44)) continue;
      return { x, y: groundHeightAt(x, z), z, ry: R(-.6, .6) };
    }
    const col = idx % 3, row = Math.floor(idx / 3); const x = DOORSTEP.x + [-.56, 0, .56][col], z = DOORSTEP.z - row * .48;
    return { x, y: groundHeightAt(x, z), z, ry: R(-.1, .1) };
  }


  function deliveryTick(dt, dHour = dt / 90) {
    if (knockT > 0) { const prev = knockT; knockT -= dt; const door = new THREE.Vector3(DOORSTEP.x, 1.3, -KD - .3);
      if (prev >= 3 && knockT < 3) { const r = env.audio && env.audio.sample && env.audio.sample('stuk', 1.1, door); if (!r) for (const t of [0, .3, .6]) setTimeout(() => env.audio && env.audio.knock(), t * 1000); }
      if (prev > 1.1 && knockT <= 1.1) { const r = env.audio && env.audio.sample && env.audio.sample('dostavka', 1.3, door);
        env.ctx.subtitles && env.ctx.subtitles('Доставщик', DELIVERY_WORDS, r ? r.start : null); } }
    const s = S(); if (!s || !s.deliveries || !s.deliveries.length) return;
    for (const d of s.deliveries) {
      if (d.state === 'way') {
        if (d.etaHours != null) { d.etaHours -= dHour; if (d.etaHours <= 0) d.state = 'arrive'; }
        else { d.eta -= dt; if (d.eta <= 0) d.state = 'arrive'; }
      }
      if (d.state === 'arrive') {
        const doorVisible = env.doorOpen() > .3 && env.visibleFromPlayer(DOORSTEP.x, DOORSTEP.z);
        const outsideNear = !inK(P.x, P.z) && Math.hypot(P.x - DOORSTEP.x, P.z - DOORSTEP.z) < 1.8 && env.visibleFromPlayer(DOORSTEP.x, DOORSTEP.z);
        if (!doorVisible && !outsideNear) {
          const baseOff = items.filter(i => i.kind === 'box' && Math.hypot(i.obj.position.x - DOORSTEP.x, i.obj.position.z - DOORSTEP.z) < 1.8).length;
          const chunks = splitOrderIntoBoxChunks(d.contents);
          chunks.forEach((ch, idx) => {
            const sp = doorstepBoxSpot(baseOff + idx);
            addItem({ kind: 'box', x: sp.x, y: sp.y, z: sp.z, ry: sp.ry, data: { contents: ch.contents, hidden: d.hidden, label: d.label } });
          });
          d.state = 'done'; knockT = 3.01; persist(); env.onDelivered && env.onDelivered(d, chunks.length);
        }
      }
    }
    s.deliveries = s.deliveries.filter(d => d.state !== 'done');
  }
  function unpack(it) {
    if (!it || it.kind !== 'box' || it.data.opened) return false;
    it.data.opened = true; const pos = it.obj.position.clone(), ry = it.obj.rotation.y;
    scene.remove(it.obj); it.obj = makeBoxMesh(.5, .36, .4, true); it.obj.position.copy(pos); it.obj.rotation.y = ry; it.obj.traverse(o => { if (o.isMesh) o.userData.item = it; }); scene.add(it.obj);
    it.mass = 1;
    const rawContents = it.data.contents || {};
    const outfitsOnly = {};
    for (const [k, val] of Object.entries(rawContents)) {
      if (k.startsWith('outfit:') || k.startsWith('up:')) outfitsOnly[k] = Array.isArray(val) ? val : [val | 0, 0];
    }
    const chunks = splitOrderIntoBoxChunks(rawContents);
    const firstChunk = chunks[0] || { packs: [] };
    // Если коробка из старого сохранения содержала слишком много товара — спавним дополнительные закрытые коробки рядом!
    if (chunks.length > 1) {
      for (let bIdx = 1; bIdx < chunks.length; bIdx++) {
        addItem({
          kind: 'box',
          x: pos.x + (bIdx % 2 ? .56 : -.56),
          y: pos.y,
          z: pos.z - Math.floor((bIdx - 1) / 2) * .48,
          ry: ry + R(-.1, .1),
          data: { contents: chunks[bIdx].contents, hidden: it.data.hidden, label: it.data.label }
        });
      }
    }
    const cCos = Math.cos(ry), cSin = Math.sin(ry);
    let packIdx = 0;
    for (const p of firstChunk.packs) {
      const lx = (p.col ? 0.010 : -0.010);
      const lz = (p.col === 0 ? -0.094 : 0.094);
      const ly = 0.030 + p.layer * 0.088;
      const wx = pos.x + lx * cCos + lz * cSin;
      const wz = pos.z - lx * cSin + lz * cCos;
      const wy = pos.y + ly;
      const lry = (p.col ? 0.02 : -0.02);
      const pk = addItem({
        kind: 'pack',
        x: wx, y: wy, z: wz,
        ry: ry + lry,
        inBoxId: it.id,
        boxOff: { lx, ly, lz, lry },
        data: { goodId: p.goodId, count: p.count, maxCount: Math.max(5, p.count), unitCost: p.unitCost, opened: false, hidden: !!it.data.hidden }
      });
      pk.inBoxId = it.id;
      pk.boxOff = { lx, ly, lz, lry };
      packIdx++;
    }
    env.onUnpack && env.onUnpack({ contents: outfitsOnly, hidden: it.data.hidden, spawnedPacks: packIdx, extraBoxes: Math.max(0, chunks.length - 1) });
    it.data.contents = null;
    persist();
    return true;
  }

  // ================= дисковый телефон на прилавке (js/phone.js) =================
  const ph = createPhone({ scene, camera, std, audio: env.audio });
  ph.root.position.set(-1.05, 1.005, KD - .22); ph.root.rotation.y = Math.PI * .85;
  ph.setCounter({ x1: -1.45, x2: 1.45, z1: KD - .45, z2: KD }, 1.005);
  let phoneBox = ph.box();
  function setPhoneModel() {}
  function phoneTick(dt) { ph.tick(dt); if (!ph.calling) phoneBox = ph.box(); }
  function startCall() { ph.startCall(); }
  function setDialing() {}
  function dialNumber(d, done) { ph.dialNumber(d, done); }
  function hangUp() { ph.hangUp(); }

  // ================= блокнот на прилавке =================
  const NOTE_REST = { x: -.66, y: 1.005, z: KD - .24, ry: Math.PI + .14 };
  let note = null, noteState = 'rest', noteT = 0, noteOnDone = null;
  function setNotepadModel(o) {
    note = o; note.position.set(NOTE_REST.x, NOTE_REST.y, NOTE_REST.z); note.rotation.set(0, NOTE_REST.ry, 0); scene.add(note);
    note.traverse(m => { if (m.isMesh) { m.castShadow = true; m.userData.notepad = true; } });
  }
  const noteBox = () => note ? new THREE.Box3().setFromObject(note).expandByScalar(.04) : null;
  const restPos = new THREE.Vector3(), restQ = new THREE.Quaternion(), holdQ = new THREE.Quaternion();
  function openNotepad(done) { if (!note || noteState !== 'rest') return; noteState = 'lift'; noteT = 0; noteOnDone = done; restPos.copy(note.position); restQ.copy(note.quaternion); }
  function closeNotepad(done) { if (!note || noteState !== 'held') return; noteState = 'lower'; noteT = 0; noteOnDone = done; }
  let paperProp = null, paperState = 'rest', paperT = 0, paperOnDone = null;
  const paperRestPos = new THREE.Vector3(), paperRestQ = new THREE.Quaternion(), paperHoldQ = new THREE.Quaternion();
  function ensurePaperProp() {
    if (!paperProp) {
      paperProp = makeGoodPhysMesh('paper').obj;
      paperProp.visible = false;
      scene.add(paperProp);
    }
    return paperProp;
  }
  function openPaper(done) {
    if (paperState !== 'rest') return;
    const pp = ensurePaperProp();
    paperState = 'lift'; paperT = 0; paperOnDone = done;
    if (held && held.obj) {
      paperRestPos.copy(held.obj.position);
      paperRestQ.copy(held.obj.quaternion);
      held.obj.visible = false;
    } else {
      paperRestPos.copy(camera.position).add(tmp2.set(0, -.36, -.28).applyQuaternion(camera.quaternion));
      paperRestQ.copy(camera.quaternion);
    }
    pp.position.copy(paperRestPos);
    pp.quaternion.copy(paperRestQ);
    pp.visible = true;
  }
  function closePaper(done) {
    if (paperState !== 'held') { done && done(); return; }
    paperState = 'lower'; paperT = 0; paperOnDone = done;
    if (held && held.obj) {
      paperRestPos.copy(held.obj.position);
      paperRestQ.copy(held.obj.quaternion);
    } else {
      paperRestPos.copy(camera.position).add(tmp2.set(0, -.36, -.28).applyQuaternion(camera.quaternion));
      paperRestQ.copy(camera.quaternion);
    }
  }
  function noteTick(dt) {
    if (note && noteState !== 'rest') {
      noteT += dt;
      const hold = tmp.copy(camera.position).add(tmp2.set(0, -.08, -.36).applyQuaternion(camera.quaternion));
      holdQ.copy(camera.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 - .25, 0, 0)));
      if (noteState === 'lift') { const k = ease(Math.min(1, noteT / .7)); note.position.lerpVectors(restPos, hold, k); note.position.y += Math.sin(k * Math.PI) * .08; note.quaternion.slerpQuaternions(restQ, holdQ, k); if (noteT >= .7) { noteState = 'held'; const f = noteOnDone; noteOnDone = null; f && f(); } }
      else if (noteState === 'held') { note.position.copy(hold); note.quaternion.copy(holdQ); }
      else if (noteState === 'lower') { const k = ease(Math.min(1, noteT / .6)); note.position.lerpVectors(hold, restPos, k); note.quaternion.slerpQuaternions(holdQ, restQ, k); if (noteT >= .6) { noteState = 'rest'; note.position.copy(restPos); note.quaternion.copy(restQ); const f = noteOnDone; noteOnDone = null; f && f(); } }
    }
    if (paperProp && paperState !== 'rest') {
      paperT += dt;
      const hold = tmp.copy(camera.position).add(tmp2.set(0, -.07, -.34).applyQuaternion(camera.quaternion));
      paperHoldQ.copy(camera.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 - .22, 0, 0)));
      if (paperState === 'lift') {
        const k = ease(Math.min(1, paperT / .52));
        paperProp.position.lerpVectors(paperRestPos, hold, k);
        paperProp.position.y += Math.sin(k * Math.PI) * .07;
        paperProp.quaternion.slerpQuaternions(paperRestQ, paperHoldQ, k);
        if (paperT >= .52) { paperState = 'held'; const f = paperOnDone; paperOnDone = null; f && f(); }
      } else if (paperState === 'held') {
        paperProp.position.copy(hold);
        paperProp.quaternion.copy(paperHoldQ);
      } else if (paperState === 'lower') {
        const k = ease(Math.min(1, paperT / .42));
        paperProp.position.lerpVectors(hold, paperRestPos, k);
        paperProp.quaternion.slerpQuaternions(paperHoldQ, paperRestQ, k);
        if (paperT >= .42) {
          paperState = 'rest';
          paperProp.visible = false;
          if (held && held.obj) held.obj.visible = true;
          const f = paperOnDone; paperOnDone = null; f && f();
        }
      }
    }
  }

  // ================= пепельница =================
  const ashtray = new THREE.Group(); ashtray.position.set(.7, 1.005, KD - .28); ashtray.visible = false; scene.add(ashtray);
  const ashM = new THREE.MeshStandardMaterial({ color: 0x9aa8a8, roughness: .1, metalness: .2, transparent: true, opacity: .8 });
  const at = new THREE.Mesh(new THREE.CylinderGeometry(.06, .055, .03, 20), ashM); at.position.y = .015; ashtray.add(at);
  const ashIn = new THREE.Mesh(new THREE.CylinderGeometry(.048, .048, .005, 16), std({ color: 0x5a5550, roughness: 1 })); ashIn.position.y = .02; ashtray.add(ashIn);
  const butts = []; const buttM = std({ color: 0xc8a070, roughness: .8 });
  function setButts(n) { while (butts.length < Math.min(n, 12)) { const b = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .025, 6), buttM); b.rotation.set(Math.PI / 2 - .3, R(0, 6), R(-.4, .4)); b.position.set(R(-.03, .03), .028, R(-.03, .03)); ashtray.add(b); butts.push(b); } while (butts.length > n) ashtray.remove(butts.pop()); }
  const ashBox = new THREE.Box3().setFromObject(ashtray).expandByScalar(.08);

  // ================= руки и привычки (рисуются поверх, в сцене оружия) =================
  const vm = env.overlayScene;
  const skin = std({ color: 0xd9a888, roughness: .7 }), sleeveM = std({ color: 0x2f3a46, roughness: .85 }), nailM = std({ color: 0xe8c0a8, roughness: .5 });
  function makeHand(side = 1) {
    const g = new THREE.Group();
    const palm = new THREE.Mesh(new THREE.BoxGeometry(.075, .022, .085), skin); g.add(palm);
    const fingers = [];
    for (let i = 0; i < 4; i++) { const f = new THREE.Group(); f.position.set((-.028 + i * .019) * side, 0, -.045); g.add(f); const len = [.03, .034, .032, .026][i];
      const p1 = new THREE.Mesh(new THREE.CapsuleGeometry(.008, len, 3, 6), skin); p1.rotation.x = Math.PI / 2; p1.position.z = -len / 2; f.add(p1);
      const j = new THREE.Group(); j.position.z = -len; f.add(j); const p2 = new THREE.Mesh(new THREE.CapsuleGeometry(.0075, len * .8, 3, 6), skin); p2.rotation.x = Math.PI / 2; p2.position.z = -len * .4; j.add(p2);
      const nail = new THREE.Mesh(new THREE.BoxGeometry(.01, .002, .01), nailM); nail.position.set(0, .0075, -len * .75); j.add(nail); fingers.push([f, j]); }
    const th = new THREE.Group(); th.position.set(.04 * side, -.004, -.005); th.rotation.y = -.6 * side; g.add(th);
    const t1 = new THREE.Mesh(new THREE.CapsuleGeometry(.009, .03, 3, 6), skin); t1.rotation.x = Math.PI / 2; t1.position.z = -.02; th.add(t1);
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(.03, .034, .05, 10), skin); wrist.rotation.x = Math.PI / 2; wrist.position.z = .06; g.add(wrist);
    const sl = new THREE.Mesh(new THREE.CylinderGeometry(.042, .05, .28, 12), sleeveM); sl.rotation.x = Math.PI / 2; sl.position.z = .22; g.add(sl);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(.046, .008, 6, 14), sleeveM); cuff.position.z = .08; g.add(cuff);
    g.userData = { fingers, thumb: th };
    g.curl = (k) => { fingers.forEach(([f, j]) => { f.rotation.x = -k * 1.1; j.rotation.x = -k * 1.3; }); th.rotation.x = -k * .6; };
    g.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    return g;
  }

  const hab = { busy: null, t: 0, handcuffed: false, signDone: null };
  const handR = makeRigHand(std, 1); handR.visible = false; vm.add(handR);
  const handL = makeBrawlerFist(-1); handL.visible = false; vm.add(handL);
  const fistR = makeBrawlerFist(1);  fistR.visible = false; vm.add(fistR);

  // 3D-модель стальных милицейских наручников «БР-С» со звеньями цепи на запястьях главного героя
  const cuffsGroup = new THREE.Group();
  cuffsGroup.visible = false;
  {
    const steelM = new THREE.MeshStandardMaterial({ color: 0xc4ccd4, emissive: 0x1e242b, emissiveIntensity: .28, roughness: .28, metalness: .88 });
    const darkSteelM = new THREE.MeshStandardMaterial({ color: 0x3a4048, emissive: 0x101318, emissiveIntensity: .22, roughness: .42, metalness: .78 });
    for (const s of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.034, .0055, 10, 24), steelM);
      ring.position.set(s * .058, 0, 0);
      ring.rotation.y = s * .22;
      cuffsGroup.add(ring);
      // Замковая коробка наручника с замочной скважиной
      const lockBox = new THREE.Mesh(new THREE.BoxGeometry(.020, .022, .013), darkSteelM);
      lockBox.position.set(s * .026, 0, .004);
      cuffsGroup.add(lockBox);
      const rivet = new THREE.Mesh(new THREE.CylinderGeometry(.0025, .0025, .015, 8), steelM);
      rivet.rotation.x = Math.PI / 2;
      rivet.position.set(s * .026, .004, .004);
      cuffsGroup.add(rivet);
    }
    // 3 сварных стальных звена цепи между браслетами
    for (let i = -1; i <= 1; i++) {
      const link = new THREE.Mesh(new THREE.TorusGeometry(.0105, .0028, 8, 16), steelM);
      link.position.set(i * .011, 0, .004);
      link.rotation.x = (i === 0) ? Math.PI / 2 : .15;
      cuffsGroup.add(link);
    }
    cuffsGroup.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  }
  vm.add(cuffsGroup);

  // 3D-модель советской шариковой ручки в правой руке для подписания протокола в РОВД
  const penGroup = new THREE.Group();
  penGroup.visible = false;
  {
    const penBodyM = new THREE.MeshStandardMaterial({ color: 0x1d4b8f, emissive: 0x0a1c38, emissiveIntensity: .25, roughness: .35, metalness: .15 });
    const penTipM  = new THREE.MeshStandardMaterial({ color: 0xd4b254, roughness: .28, metalness: .82 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.0042, .0042, .125, 10), penBodyM);
    body.position.y = .02;
    penGroup.add(body);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(.0042, .018, 10), penTipM);
    tip.rotation.x = Math.PI;
    tip.position.y = -.051;
    penGroup.add(tip);
    penGroup.position.set(-.018, -.018, -.138);
    penGroup.rotation.set(1.22, .18, -.28);
    penGroup.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  }
  handR.add(penGroup);

  function setHandcuffed(v) {
    hab.handcuffed = !!v;
    if (v) {
      if (held) dropHeld();
      hab.busy = null;
      punchState.active = false;
      punchState.blocking = false;
      punchState.guardT = 0;
      handR.visible = false;
      penGroup.visible = false;
      fistR.visible = true;
      handL.visible = true;
      cuffsGroup.visible = true;
      fx.handOut = true;
    } else {
      cuffsGroup.visible = false;
      fistR.visible = false;
      handL.visible = false;
      fx.handOut = false;
    }
    env.onCtl && env.onCtl();
  }

  function startSignProtocol(onDone) {
    if (hab.handcuffed) setHandcuffed(false);
    hidePunchHands();
    Object.assign(hab, { busy: 'sign', t: 0, out: 0, signDone: onDone || null });
    handR.visible = true;
    cigNode.visible = false;
    bottleNode.visible = false;
    penGroup.visible = true;
    handR.position.set(.055, -.24, -.28);
    handR.pose(HAND_POSES.pinch, null);
    fx.handOut = true;
    env.onCtl && env.onCtl();
    return true;
  }
  const punchState = { active: false, blocking: false, blockK: 0, blockJolt: 0, t: 0, side: 1, strikeType: 0, isHeavy: false, hitDone: false, combo: 0, lastPunchAt: 0, guardT: 0, onImpact: null };
  function setBlock(on) {
    if (on && (hab.busy || held)) return false;
    punchState.blocking = !!on;
    if (on) {
      punchState.guardT = Math.max(punchState.guardT, .65);
      fx.handOut = true;
      handR.visible = false;
      fistR.visible = true;
      handL.visible = true;
    }
    return true;
  }
  function triggerBlockImpact() {
    punchState.blockJolt = 1.0;
    punchState.guardT = Math.max(punchState.guardT, .9);
  }
  function startPunch(onImpact, force = null, allowHeavy = true, speed = 1, runBonus = 0) {
    if (hab.busy || held) return false;
    if (punchState.active && punchState.t < .16) return false;
    const now = performance.now();
    if (now - punchState.lastPunchAt > 1400) punchState.combo = 0;
    punchState.lastPunchAt = now;
    // 0 — джеб левой, 1 — прямой правой, 2 — боковой (хук), 3 — апперкот, 4 — прямой удар ногой (фронт-кик)
    punchState.strikeType = force === 'kick' ? 4 : force === 'hook' ? 2 : force === 'upper' ? 3 : (allowHeavy ? punchState.combo % 3 : punchState.combo % 2);
    punchState.side = punchState.strikeType === 0 ? -1 : 1;
    punchState.isHeavy = punchState.strikeType >= 2 || runBonus > .25;
    punchState.isUpper = punchState.strikeType === 3;
    punchState.isKick  = punchState.strikeType === 4;
    punchState.runBonus = Math.max(0, Math.min(1, runBonus || 0));
    punchState.spd = speed * (1 + punchState.runBonus * .16);
    punchState.combo++;
    punchState.active = true;
    punchState.t = 0;
    punchState.hitDone = false;
    punchState.guardT = 1.65;
    punchState.onImpact = onImpact || null;
    fx.handOut = true;
    handR.visible = false;
    fistR.visible = true;
    handL.visible = true;
    return true;
  }
  function hidePunchHands() {
    punchState.active = false;
    punchState.blocking = false;
    punchState.blockK = 0;
    punchState.guardT = 0;
    fistR.visible = false;
    handL.visible = false;
    if (!hab.busy) {
      handR.visible = false;
      fx.handOut = false;
    }
  }

  // Сигарета зажата между указательным (x = -.026) и средним (x = -.008) пальцами:
  // фильтр (−Y сигареты) выступает на ладонную сторону вправо-вниз к большому пальцу (−X, −Y кисти),
  // а белая часть с тлеющим кончиком (+Y сигареты) уходит влево-вверх (+X, −Z кисти) за средний палец.
  const cig = makeCigarette(std);
  const cigNode = new THREE.Group();
  // Сигарета зажата в верхней части между указательным и средним пальцами
  cigNode.position.set(-.016, -.013, -.148);
  const cigBaseQ = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(.641, -.022, -.767).normalize()
  );
  // У рта сигарета разворачивается оранжевым фильтром прямо к губам игрока (+Z камеры внизу по центру), а тлеющим кончиком — вперёд-вверх-влево (−Z)
  const cigMouthQ = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(.38, .36, -.85).normalize()
  );
  // При развороте кисти для стряхивания пепла сигарета наклоняется кончиком влево-вниз, а фильтром — вверх-вправо к большому пальцу
  const cigAshQ = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(.565, -.755, .332).normalize()
  );
  cigNode.quaternion.copy(cigBaseQ);
  cigNode.add(cig);
  handR.add(cigNode);

  const emberLight = new THREE.PointLight(0xff6828, 0, .55, 2); cig.add(emberLight); emberLight.position.y = .065;
  let cigModel = null; function setCigaretteModel(o) { cigModel = o; }

  // бутылка — в ладони поперёк пальцев: ось бутылки вдоль −X кисти, горлышко со стороны большого и указательного пальцев
  let bottleModel = null; const bottleNode = new THREE.Group(); bottleNode.position.set(-.004, -.050, -.082); bottleNode.rotation.z = Math.PI / 2; handR.add(bottleNode);
  const GRIP_Y = .135, NECK = .275;
  const capMat = std({ color: 0xc8b06a, metalness: .75, roughness: .32 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(.0142, .0142, .018, 14), capMat); cap.frustumCulled = false;
  const bore = new THREE.Mesh(new THREE.CylinderGeometry(.0108, .0108, .003, 14), std({ color: 0x0d110f, roughness: .92 })); bore.frustumCulled = false;
  const btlLabelMats = {};
  function getBottleLabelMat(kind = 'vodka') {
    if (btlLabelMats[kind]) return btlLabelMats[kind];
    const c = document.createElement('canvas'); c.width = 512; c.height = 192;
    const g = c.getContext('2d');
    const cfg = kind === 'beer'
      ? { bg: '#f0d278', border: '#8a2818', title: 'ПИВО', sub: 'ЗАВОДСКОЕ · СВЕТЛОЕ', fg: '#1e1610', accent: '#a82818' }
      : kind === 'samogon'
      ? { bg: '#dfd3b8', border: '#4a3622', title: 'САМОГОН', sub: 'ДОМАШНИЙ ПЕРВАЧ · 60°', fg: '#2b1e12', accent: '#7a2216' }
      : kind === 'soda'
      ? { bg: '#f6df68', border: '#c42b1c', title: 'ЛИМОНАД', sub: 'БУРАТИНО · ГОСТ', fg: '#a81e14', accent: '#1e6b34' }
      : { bg: '#f4efe2', border: '#b8281c', title: 'ВОДКА', sub: 'СПИРТ «КОРОЛЬ» · 0.5 Л', fg: '#181818', accent: '#b8281c' };
    g.fillStyle = cfg.bg; g.fillRect(0, 0, 512, 192);
    g.strokeStyle = cfg.border; g.lineWidth = 8; g.strokeRect(6, 6, 500, 180);
    g.strokeStyle = cfg.accent; g.lineWidth = 3; g.strokeRect(16, 16, 480, 160);
    for (const cx of [128, 384]) {
      g.fillStyle = cfg.accent; g.font = '900 44px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(cfg.title, cx, 78);
      g.fillStyle = cfg.fg; g.font = '900 22px Arial, sans-serif';
      g.fillText(cfg.sub, cx, 132);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return (btlLabelMats[kind] = new THREE.MeshStandardMaterial({ map: t, roughness: .55, metalness: .04 }));
  }
  const btlLabelGeo = new THREE.CylinderGeometry(.0365, .0365, .092, 18, 1, true);
  const fpLabelMesh = new THREE.Mesh(btlLabelGeo, getBottleLabelMat('vodka'));
  fpLabelMesh.position.set(0, .105, 0);
  fpLabelMesh.frustumCulled = false;
  let curDrinkMesh = null;
  function updateDrinkBottleMesh(kind) {
    while (bottleNode.children.length > 0) {
      bottleNode.remove(bottleNode.children[0]);
    }
    curDrinkMesh = null;
    const g = new THREE.Group();
    const drinkId = (kind === 'buratino' || kind === 'soda') ? 'soda' : (kind || 'vodka');
    const bMesh = env.getItemMesh ? env.getItemMesh(drinkId) : null;
    const bH = drinkId === 'beer' ? .24 : drinkId === 'samogon' ? .26 : drinkId === 'soda' ? .23 : .28;
    if (bMesh) {
      const capsToRemove = [];
      bMesh.traverse(m => {
        if (m.userData && m.userData.isCap) {
          capsToRemove.push(m);
          return;
        }
        if (m.isMesh && m.position && m.position.y > bH * .91) {
          capsToRemove.push(m);
          return;
        }
        if (m.isMesh) {
          m.frustumCulled = false;
          if (m.material) {
            const mats = Array.isArray(m.material) ? m.material : [m.material];
            mats.forEach(mt => {
              mt.depthWrite = true;
              mt.depthTest = true;
              if (mt.transparent && mt.opacity < .70) mt.opacity = .82;
            });
          }
        }
      });
      for (const cm of capsToRemove) if (cm.parent) cm.parent.remove(cm);
      bMesh.position.set(0, -GRIP_Y, 0);
      g.add(bMesh);
    } else {
      const cfg = drinkId === 'beer'
        ? { glass: 0x5c3214, cap: 0xd4a72c }
        : drinkId === 'samogon'
        ? { glass: 0xc8d2c4, cap: 0x5c432e }
        : drinkId === 'soda'
        ? { glass: 0xc97b28, cap: 0xc0392b }
        : { glass: 0x2d5a36, cap: 0xc8b06a };
      const bm = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .27, 14), std({ color: cfg.glass, roughness: .14, transparent: true, opacity: .88, depthWrite: true }));
      bm.position.set(0, 0, 0); g.add(bm);
      const lm = new THREE.Mesh(btlLabelGeo, getBottleLabelMat(drinkId));
      lm.position.set(0, 0, 0); g.add(lm);
    }
    const capC = (drinkId === 'beer' || drinkId === 'vodka') ? 0xd4a72c : (drinkId === 'samogon') ? 0x5c3c24 : 0xc0392b;
    capMat.color.setHex(capC);
    const capY = bH * .945 - GRIP_Y;
    cap.userData.restY = capY;
    cap.position.set(0, capY, 0);
    cap.rotation.set(0, 0, 0);
    g.add(cap);
    curDrinkMesh = g;
    bottleNode.add(curDrinkMesh);
  }
  function styleBottle(kind) {
    updateDrinkBottleMesh(kind);
  }
  function emptyBottleMesh(kind = "vodka") {
    const drinkId = (kind === 'buratino' || kind === 'soda') ? 'soda' : (kind || 'vodka');
    const cfg = drinkId === "beer"
      ? { glass: 0x5c3214, op: .85, rgh: .15, h: .24, r: .034 }
      : drinkId === "samogon"
      ? { glass: 0xc8d2c4, op: .75, rgh: .30, h: .26, r: .038 }
      : drinkId === "soda"
      ? { glass: 0xc97b28, op: .80, rgh: .14, h: .23, r: .032 }
      : { glass: 0x2d5a36, op: .78, rgh: .12, h: .28, r: .036 };
    const g = new THREE.Group();
    const piv = new THREE.Group();
    piv.position.set(0, cfg.h / 2, 0);
    const spin = new THREE.Group();
    piv.add(spin);
    g.add(piv);
    g.userData.piv = piv;
    g.userData.spin = spin;

    // пустая бутылка — та же модель, что у товара (стекло, этикетка, горлышко), только без жидкости и без колпачка
    const proto = env.getItemMesh ? env.getItemMesh(drinkId) : null;
    if (proto) {
      const rm = []; proto.traverse(o => { if (o.userData && (o.userData.isLiquid || o.userData.isCap)) rm.push(o); else if (o.isMesh) o.castShadow = true; });
      rm.forEach(o => o.parent && o.parent.remove(o));
      proto.position.set(0, -cfg.h / 2, 0); spin.add(proto);
      return g;
    }
    const bm = new THREE.MeshStandardMaterial({ color: cfg.glass, roughness: cfg.rgh, metalness: .08, transparent: true, opacity: cfg.op, depthWrite: true });
    // Корпус бутылки
    const bodyM = new THREE.Mesh(new THREE.CylinderGeometry(cfg.r, cfg.r, cfg.h * .62, 14), bm);
    bodyM.position.y = -cfg.h * .19; bodyM.castShadow = true; spin.add(bodyM);
    // Плечи бутылки
    const shM = new THREE.Mesh(new THREE.CylinderGeometry(cfg.r * .40, cfg.r, cfg.h * .20, 12), bm);
    shM.position.y = cfg.h * .22; shM.castShadow = true; spin.add(shM);
    // Горлышко
    const nkM = new THREE.Mesh(new THREE.CylinderGeometry(cfg.r * .36, cfg.r * .36, cfg.h * .18, 10), bm);
    nkM.position.y = cfg.h * .41; nkM.castShadow = true; spin.add(nkM);

    // Этикетка на пустой бутылке
    const lbMat = getBottleLabelMat(drinkId);
    const lbGeo = new THREE.CylinderGeometry(cfg.r * 1.02, cfg.r * 1.02, cfg.h * .34, 16, 1, true);
    const lb = new THREE.Mesh(lbGeo, lbMat);
    lb.position.y = -cfg.h * .18;
    lb.castShadow = true;
    spin.add(lb);
    return g;
  }
  function stashHeldBottle() {
    if (!held || held.kind !== 'bottle') return;
    const it = held; held = null;
    if (inK(P.x, P.z)) {
      const existing = items.filter(x => x !== it && x.kind === 'bottle' && inK(x.obj.position.x, x.obj.position.z)).length;
      const slots = [
        [-1.15, .035, .48], [-1.02, .035, .52], [-1.22, .035, .34], [-.92, .035, .52],
        [-.78, .035, -.68], [-.62, .035, -.72], [-.46, .035, -.72], [-.30, .035, -.72]
      ];
      const sl = slots[existing % slots.length];
      it.state = 'rest';
      it.obj.position.set(sl[0] + R(-.04, .04), sl[1], sl[2] + R(-.03, .03));
      it.obj.rotation.set(0, R(0, 6.28), 0);
      syncCol(it); persist();
    } else {
      it.obj.position.set(P.x + R(-.25, .25), Math.max(.05, camera.position.y - .45), P.z + R(-.25, .25));
      it.state = 'fall'; it.vy = 0; persist();
    }
    env.onCtl && env.onCtl();
  }
  function giveEmptyBottle(kind = hab.kind || 'vodka', autoStash = false) {
    if (held && held.kind === 'bottle') stashHeldBottle();
    const it = addItem({ kind: 'bottle', x: P.x + R(-.08, .08), y: Math.max(.1, camera.position.y - .5), z: P.z + R(-.08, .08), ry: R(0, 6.28), data: { drinkKind: kind } });
    pick(it);
    if (autoStash) stashHeldBottle();
    else persist();
    return it;
  }
  function setBottleModel(o) {
    bottleModel = o;
    // Обновляем уже созданные пустые бутылки в мире, чтобы у них тоже была 3D-модель
    for (const it of items) if (it.kind === "bottle") {
      const pos = it.obj.position.clone(), ry = it.obj.rotation.y;
      scene.remove(it.obj);
      it.obj = emptyBottleMesh(it.data && it.data.drinkKind);
      it.obj.position.copy(pos); it.obj.rotation.y = ry;
      it.obj.traverse(m => { if (m.isMesh) m.userData.item = it; });
      applyBottlePose(it);
      scene.add(it.obj);
    }
  }

  // Реалистичный динамичный табачный дым: 4 разные текстуры завитков и струек (не круглое пятно, а живые волокна дыма с турбулентностью)
  const smokeTexList = [0, 1, 2, 3].map(variant => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.clearRect(0, 0, 128, 128);
    // Рисуем несколько изогнутых полупрозрачных струек/завитков со смещённым центром, чтобы дым имел сложную волокнистую структуру
    const wisps = 7 + variant * 2;
    for (let i = 0; i < wisps; i++) {
      const a0 = (i / wisps) * Math.PI * 2 + variant * 1.17;
      const rOff = 10 + (i % 3) * 9;
      const cx = 64 + Math.cos(a0) * rOff;
      const cy = 64 + Math.sin(a0) * rOff * .82;
      const rx = 24 + (i % 4) * 7;
      const ry = 11 + ((i + variant) % 3) * 5;
      g.save();
      g.translate(cx, cy);
      g.rotate(a0 + .65 + (i % 2 ? .35 : -.35));
      g.scale(1, ry / rx);
      const gr = g.createRadialGradient(0, 0, rx * .12, 0, 0, rx);
      // Полупрозрачная середина с более плотным завитком по дуге — создаёт эффект клубящихся колец и лент дыма
      gr.addColorStop(0, 'rgba(235,240,248,0.52)');
      gr.addColorStop(0.42, 'rgba(228,234,244,0.78)');
      gr.addColorStop(0.72, 'rgba(208,216,228,0.42)');
      gr.addColorStop(1, 'rgba(190,198,210,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    // Мягкая маска по краям текстуры, чтобы никогда не было резких границ квадрата
    g.globalCompositeOperation = 'destination-in';
    const mask = g.createRadialGradient(64, 64, 18, 64, 64, 62);
    mask.addColorStop(0, 'rgba(0,0,0,1)');
    mask.addColorStop(0.75, 'rgba(0,0,0,0.85)');
    mask.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = mask;
    g.fillRect(0, 0, 128, 128);
    g.globalCompositeOperation = 'source-over';
    const stx = new THREE.CanvasTexture(c);
    stx.colorSpace = THREE.SRGBColorSpace;
    return stx;
  });
  const puffs = [];
  for (let i = 0; i < 64; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: smokeTexList[i % smokeTexList.length],
      color: 0xcfd6de,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    }));
    sp.visible = false; sp.frustumCulled = false; sp.renderOrder = 18;
    sp.userData.noCull = true; sp.userData.keep = true; sp.userData.dyn = true;
    vm.add(sp);
    puffs.push({
      sp, life: 0, maxLife: 1,
      v: new THREE.Vector3(),
      grow: .08, aspect: 1.25,
      rot: 0, rotSpd: 0,
      seed: i * 1.618,
      turbulence: 1,
      opScale: 1,
    });
  }
  function puff(at, dir, n = 4, big = 1, opScale = 1) {
    for (let i = 0; i < n; i++) {
      const p = puffs.find(q => q.life <= 0); if (!p) return;
      p.maxLife = R(1.75, 2.75) * (0.75 + 0.25 * big);
      p.life = p.maxLife;
      p.sp.visible = true;
      p.sp.position.copy(at).add(tmp2.set(R(-.014, .014) * big, R(-.010, .010) * big, R(-.012, .012) * big));
      p.v.copy(dir).multiplyScalar(R(.82, 1.22)).add(tmp2.set(R(-.025, .025) * big, R(.015, .045) * big, R(-.025, .010) * big));
      const baseSc = R(.048, .082) * big;
      p.aspect = R(1.18, 1.62);
      p.sp.scale.set(baseSc * p.aspect, baseSc, 1);
      p.grow = R(.075, .135) * big;
      p.rot = R(0, Math.PI * 2);
      p.rotSpd = (i % 2 === 0 ? 1 : -1) * R(.85, 2.15);
      p.sp.material.rotation = p.rot;
      p.turbulence = big;
      p.opScale = opScale;
    }
  }
  // Падающие частицы стряхнутого пепла (3–4 маленьких серых кубика при щелчке пальцем)
  const ashPartM = std({ color: 0xa8a49e, roughness: .95 });
  const ashDrops = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(.0042, .0042, .0042), ashPartM);
    m.visible = false; m.frustumCulled = false; vm.add(m);
    ashDrops.push({ m, life: 0, v: new THREE.Vector3(), rv: new THREE.Vector3() });
  }
  function spawnAshDrops(at) {
    for (let i = 0; i < 4; i++) {
      const a = ashDrops.find(q => q.life <= 0); if (!a) break;
      a.life = .75; a.m.visible = true;
      a.m.position.copy(at).add(tmp2.set((i - 1.5) * .0035 + R(-.001, .001), R(-.003, .002), R(-.002, .002)));
      a.v.set(R(-.015, .015), R(-.16, -.24), R(-.01, .01));
      a.rv.set(R(-8, 8), R(-8, 8), R(-8, 8));
    }
  }
  let _prevSmokeYaw = null, _prevSmokePitch = null;
  function smokeTick(dt) {
    const tNow = performance.now() * .001;
    // Инерция клубов дыма при повороте головы и ходьбе игрока — дым живёт в воздухе, а не приклеен к экрану!
    const curYaw = P.yaw || 0, curPitch = camera.rotation.x || 0;
    let dYaw = _prevSmokeYaw == null ? 0 : (curYaw - _prevSmokeYaw);
    dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw));
    const dPitch = _prevSmokePitch == null ? 0 : (curPitch - _prevSmokePitch);
    _prevSmokeYaw = curYaw; _prevSmokePitch = curPitch;

    for (const p of puffs) if (p.life > 0) {
      p.life -= dt;
      const u = clamp(1 - p.life / p.maxLife, 0, 1);
      // 1) Торможение начальной струи выдоха о воздух + тепловая тяга вверх (конвекция)
      const drag = Math.exp(-dt * (2.4 - u * 1.1));
      p.v.x *= drag;
      p.v.z *= drag;
      p.v.y = p.v.y * Math.exp(-dt * 1.1) + dt * .042 * p.turbulence;

      // 2) Вихревая турбулентность (клубящиеся завитки влево-вправо и по глубине по мере раскрытия облачка)
      const curlFreq = 2.6 + (p.seed % 1.7);
      const curlAmp = (.018 + u * .052) * p.turbulence;
      const wx = Math.sin(tNow * curlFreq + p.seed + u * 4.2) * curlAmp;
      const wy = Math.cos(tNow * (curlFreq * .85) + p.seed * 1.3) * curlAmp * .55;
      const wz = Math.sin(tNow * (curlFreq * 1.15) - p.seed) * curlAmp * .65;

      p.sp.position.x += (p.v.x + wx) * dt + dYaw * (-p.sp.position.z) * .65;
      p.sp.position.y += (p.v.y + wy) * dt - dPitch * (-p.sp.position.z) * .55;
      p.sp.position.z += (p.v.z + wz) * dt;

      // 3) Вращение завитков и неравномерное растяжение струи по мере рассеивания в воздухе
      p.rot += p.rotSpd * (1 - u * .55) * dt;
      p.sp.material.rotation = p.rot;
      const gStep = p.grow * (0.65 + u * 0.85) * dt;
      p.sp.scale.x += gStep * p.aspect;
      p.sp.scale.y += gStep * (0.88 + u * 0.28);

      // 4) Плавное проявление струи на выдохе и мягкое растворение с реалистичным голубовато-пепельным оттенком сигаретного дыма
      const fadeIn = clamp(u / .14, 0, 1);
      const fadeOut = Math.pow(Math.max(0, 1 - u), 1.35);
      p.sp.material.opacity = clamp(.58 * (p.opScale || 1) * Math.max(.78, envLum) * fadeIn * fadeOut, 0, .88);
      p.sp.material.color.copy(envSmokeCol);
      if (p.life <= 0) p.sp.visible = false;
    }
    fx.hasActiveSmoke = puffs.some(q => q.life > 0);
    for (const a of ashDrops) if (a.life > 0) {
      a.life -= dt;
      a.v.y -= .65 * dt;
      a.m.position.addScaledVector(a.v, dt);
      a.m.rotation.x += a.rv.x * dt; a.m.rotation.y += a.rv.y * dt; a.m.rotation.z += a.rv.z * dt;
      if (a.life <= 0) a.m.visible = false;
    }
  }

  const envSmokeCol = new THREE.Color(0xdce4ee); let envLum = .88;
  function setEnvLight(skyCol, warmCol, warmMix, lum) {
    envLum = clamp(lum, .75, 1.0);
    envSmokeCol.setHex(0xdce4ee).lerp(warmCol || new THREE.Color(0xffe4c4), clamp(warmMix * .35, 0, .35));
  }
  const fx = { smoke: 0, drunk: 0, drunkTarget: 0, handOut: false, smokePitch: 0 };
  function startSmoke() {
    if (hab.busy) return false;
    Object.assign(hab, { busy: 'smoke', t: 0, out: 0, lit: true, doneAsk: false, puffs: 0, burn: 1, ashLen: .003, lastCycle: -1, exhaledCycle: -1, flickedCycle: -1 });
    handR.visible = true; cigNode.visible = true; bottleNode.visible = false;
    cig.userData.setBurn(1, .003, 1.1); emberLight.intensity = .3;
    handR.position.set(.075, -.38, -.29);
    handR.quaternion.copy(SM.restQ);
    handR.pose(HAND_POSES.pinch, null);
    env.audio && env.audio.click(3000, .3, 0, .08);
    env.onCtl();
    return true;
  }
  function startDrink(kind, firstSip = true) {
    if (hab.busy) return false;
    updateDrinkBottleMesh(kind);
    Object.assign(hab, { busy: 'drink', kind, firstSip, t: 0, out: 0, sips: 0, gulps: 0, flick: 0, capOff: !firstSip });
    handR.visible = true; cigNode.visible = false; bottleNode.visible = true;
    cap.visible = !!firstSip; cap.position.set(0, cap.userData.restY ?? (.25 - GRIP_Y), 0); cap.rotation.set(0, 0, 0);
    handR.position.set(.14, -.42, -.34);
    handR.pose(HAND_POSES.grip, null);
    env.onCtl();
    return true;
  }
  function finishHabit(how) {
    if (hab.busy === 'smoke') {
      if (how === 'ashtray') { const s = S(); s.butts = (s.butts || 0) + 1; setButts(s.butts); }
      else if (how === 'urn') { env.audio && env.audio.click(500, .3, 0, .04); }
      else if (how === 'throw') {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .025, 6), buttM); camera.getWorldDirection(tmp); b.position.copy(camera.position).addScaledVector(tmp, .3); b.userData.v = tmp.clone().multiplyScalar(3).add(tmp2.set(0, 1.5, 0)); scene.add(b); thrown.push(b); }
    } else if (hab.busy === 'drink') {
      bottleNode.visible = false;
    }
    hab.busy = null; hab.out = .4; fx.handOut = true; env.onCtl();
  }
  const thrown = [];
  const V = (x, y, z) => new THREE.Vector3(x, y, z), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _p2 = new THREE.Vector3();
  const quatFB = (f, b, out) => { const z = f.clone().normalize().negate(), y = b.clone().addScaledVector(z, -b.dot(z)).normalize(), x = new THREE.Vector3().crossVectors(y, z); return out.setFromRotationMatrix(_m.makeBasis(x, y, z)); };
  const quatBottle = (n, b, out) => { const x = n.clone().normalize().negate(), y = b.clone().addScaledVector(x, -b.dot(x)).normalize(), z = new THREE.Vector3().crossVectors(x, y); return out.setFromRotationMatrix(_m.makeBasis(x, y, z)); };

  // Ключевые положения руки для курения:
  // 1) Покой (справа снизу, ладонь полуоборотом к лицу, сигарета под углом ~42° влево-вверх)
  // 2) Затяжка у рта (рука приближается вплотную к губам снизу по центру-слева, фильтр уходит прямо в рот у нижнего края экрана, а сигарета с тлеющим кончиком поднимается под ~58° перед глазами, не перекрываясь пальцами)
  // 3) Стряхивание пепла (кисть поворачивается боком так, что указательный и средний пальцы стоят вертикально, указательный спереди, средний чуть выше сзади, сигарета наклонена влево-вниз, а большой палец щёлкает по фильтру)
  const SM = {
    restP:  V(.078, -.262, -.320),
    restQ:  quatFB(V(-.16, .97, -.18), V(.26, -.18, -.95), new THREE.Quaternion()),
    mouthP: V(-.018, -.248, -.176),
    mouthQ: quatFB(V(-.12, .98, -.16), V(.32, -.16, -.93), new THREE.Quaternion()),
    ashP:   V(.068, -.194, -.235),
    ashQ:   quatFB(V(-.14, .98, -.14), V(.76, .16, -.63), new THREE.Quaternion()),
  };
  const LIPS = V(0, -.115, -.1);
  const DR = { restQ: quatBottle(V(.08, 1, .05), V(.7, 0, .7), new THREE.Quaternion()), restP: V(.17, -.17, -.42),
               mouthQ: quatBottle(V(0, -.3, 1), V(1, 0, 0), new THREE.Quaternion()) };
  const P_ = HAND_POSES;
  function placeByLocal(q, localPt, target) { _p.copy(localPt).applyQuaternion(q); return _p2.copy(target).sub(_p); }

  function habitTick(dt) {
    smokeTick(dt);
    for (const b of thrown.slice()) { b.userData.v.y -= 9.8 * dt; b.position.addScaledVector(b.userData.v, dt); b.rotation.x += dt * 10; if (b.position.y <= .01) { b.position.y = .01; b.userData.v.set(0, 0, 0); b.userData.life = (b.userData.life || 20) - dt; if (b.userData.life <= 0) { scene.remove(b); thrown.splice(thrown.indexOf(b), 1); } } }
    fx.smoke = Math.max(0, fx.smoke - dt / 70);
    fx.drunk += (fx.drunkTarget - fx.drunk) * Math.min(1, dt * .45);
    if (hab.busy !== 'drink') fx.drunkTarget = Math.max(0, fx.drunkTarget - dt / 135);
    if (hab.out > 0) {
      hab.out -= dt; fx.handOut = hab.out > 0;
      handR.position.lerp(_p.set(.15, -.52, -.32), Math.min(1, dt * 8));
      handR.pose(P_.relaxed, dt, 8);
      fx.smokePitch = 0; if (hab.out <= 0) { handR.visible = false; fx.handOut = false; }
      return;
    }
    // Если на главного героя надеты стальные наручники «БР-С» — обе руки скованы вместе перед камерой
    if (hab.handcuffed) {
      fx.handOut = true;
      handR.visible = false;
      penGroup.visible = false;
      fistR.visible = true;
      handL.visible = true;
      cuffsGroup.visible = true;
      fistR.pose(P_.fist, dt, 14);
      handL.pose(P_.fist, dt, 14);
      const tNow = performance.now() * .001;
      const pSpd = Math.hypot(P.vx || 0, P.vz || 0);
      const bobX = Math.sin(tNow * (pSpd > .3 ? 7.5 : 2.2)) * (pSpd > .3 ? .008 : .0025);
      const bobY = Math.abs(Math.cos(tNow * (pSpd > .3 ? 7.5 : 2.2))) * (pSpd > .3 ? .010 : .0025);
      const rx =  .056 + bobX, ry = -.172 - bobY, rz = -.285;
      const lx = -.056 + bobX, ly = -.172 - bobY, lz = -.285;
      fistR.position.set(rx, ry, rz);
      handL.position.set(lx, ly, lz);
      quatFB(V(-.28, .86, -.42), V( .72, .45, .52), fistR.quaternion);
      quatFB(V( .28, .86, -.42), V(-.72, .45, .52), handL.quaternion);
      cuffsGroup.position.set(bobX, -.212 - bobY, -.298);
      cuffsGroup.rotation.set(.32, 0, Math.sin(tNow * 3.2) * .02);
      return;
    } else if (cuffsGroup.visible) {
      cuffsGroup.visible = false;
    }
    // Анимация подписания протокола шариковой ручкой на столе у следователя
    if (hab.busy === 'sign') {
      hab.t += dt;
      const st = hab.t;
      fx.handOut = true;
      handR.visible = true;
      penGroup.visible = true;
      fistR.visible = false;
      handL.visible = false;
      const wU = clamp((st - .20) / .90, 0, 1);
      const scribbleX = wU > 0 && wU < 1 ? (wU * .065 + Math.sin(st * 34) * .007) : (wU >= 1 ? .065 : 0);
      const scribbleY = wU > 0 && wU < 1 ? (Math.cos(st * 42) * .005) : 0;
      if (wU > 0 && wU < 1 && Math.random() < dt * 14) {
        env.audio && env.audio.click && env.audio.click(1900 + R(-300, 300), .04, 0, .03);
      }
      handR.position.set(.025 + scribbleX, -.168 + scribbleY, -.265);
      quatFB(V(-.18, .62, -.76), V(.65, .62, .44), handR.quaternion);
      handR.pose(P_.pinchHard, dt, 16);
      if (st >= 1.35) {
        penGroup.visible = false;
        handR.visible = false;
        hab.busy = null;
        fx.handOut = false;
        const cb = hab.signDone;
        hab.signDone = null;
        if (cb) cb();
      }
      return;
    }
    // Анимация кулачного боя и блока от первого лица со скульптурными 3D-моделями рук (fistR и handL)
    if (!hab.busy && (punchState.active || punchState.blocking || punchState.guardT > 0)) {
      if (held || (env.weaponDrawn && env.weaponDrawn())) { hidePunchHands(); return; }
      fx.handOut = true;
      handR.visible = false;
      fistR.visible = true;
      handL.visible = true;

      if (punchState.blocking) punchState.guardT = Math.max(punchState.guardT, .45);
      const targetBlk = punchState.blocking && !punchState.active ? 1 : 0;
      punchState.blockK += (targetBlk - punchState.blockK) * Math.min(1, dt * 16);
      punchState.blockJolt = Math.max(0, punchState.blockJolt - dt * 5.5);
      const bk = punchState.blockK;
      const jolt = Math.sin(punchState.blockJolt * Math.PI) * .032;

      const tNow = performance.now() * .001;
      const swayX = Math.sin(tNow * 4.2) * .005 * (1 - bk * .6);
      const swayY = Math.cos(tNow * 8.4) * .004 * (1 - bk * .6);

      // Боевая стойка опущена ниже в кадре (ry = -0.098 в стойке, -0.044 в блоке), чтобы не перекрывать обзор по центру экрана (6039.png)
      let rx = lerp(.088, .052, bk) + swayX;
      let ry = lerp(-.098, -.044, bk) + swayY - jolt * .5;
      let rz = lerp(-.268, -.225, bk) + jolt;
      let lx = lerp(-.088, -.052, bk) - swayX;
      let ly = lerp(-.100, -.044, bk) - swayY - jolt * .5;
      let lz = lerp(-.270, -.225, bk) + jolt;

      // Реалистичная боксёрская стойка: запястья ровные на одной линии с предплечьями, кулаки полуразвёрнуты внутрь на 25° так,
      // что отлично видны ударные костяшки сверху и большой палец, плотно прижатый поперёк средних фаланг указательного и среднего пальцев!
      const qGuardR = quatFB(V(-.18, .96, -.20), V( .26, -.12, -.96), new THREE.Quaternion());
      const qGuardL = quatFB(V( .18, .96, -.20), V(-.26, -.12, -.96), new THREE.Quaternion());
      const qBlockR = quatFB(V(-.08, .98, -.15), V( .18, -.08, -.98), new THREE.Quaternion());
      const qBlockL = quatFB(V( .08, .98, -.15), V(-.18, -.08, -.98), new THREE.Quaternion());
      qGuardR.slerp(qBlockR, bk);
      qGuardL.slerp(qBlockL, bk);

      const qStrikeL = quatFB(V( .46, .82, -.34), V(-.36, .46,  .81), new THREE.Quaternion());
      const qStrikeR = quatFB(V(-.46, .82, -.34), V( .36, .46,  .81), new THREE.Quaternion());
      // Боковой хук: локоть поднят на уровень плеча (~90°), кулак развёрнут горизонтально/внутрь и закручивается по широкой дуге в челюсть
      const qHookR   = quatFB(V(-.82, .48, -.31), V( .45, .72,  .53), new THREE.Quaternion());
      // Апперкот: кулак развёрнут ладонью к себе (супинация) и бьёт снизу строго вертикально вверх в подбородок/солнечное сплетение
      const qUpperR  = quatFB(V(-.14, .93,  .34), V( .16, .35, -.92), new THREE.Quaternion());

      let rMix = 0, lMix = 0, rTargetQ = qStrikeR;

      if (punchState.active) {
        punchState.t += dt * (punchState.spd || 1); // уставший бьёт медленнее, с разбегу — резче
        const st = punchState.strikeType;
        const isH = punchState.isHeavy;
        const runB = punchState.runBonus || 0;
        const dur = st === 4 ? .44 : st === 3 ? .40 : st === 2 ? .38 : (isH ? .35 : .29);
        const impactT = st === 4 ? .16 : st === 3 ? .14 : st === 2 ? .13 : (isH ? .11 : .09);
        const pt = punchState.t;
        if (pt >= impactT && !punchState.hitDone) {
          punchState.hitDone = true;
          if (punchState.onImpact) punchState.onImpact(punchState.side, isH, st, runB);
        }
        const wT = st === 4 ? .09 : st >= 2 ? .075 : (isH ? .055 : .04);
        const peakT = impactT + (st >= 2 ? .06 : .045);
        let ext = 0, wind = 0;
        if (pt < wT) {
          wind = ease(pt / wT);
        } else if (pt < peakT) {
          const u = ease((pt - wT) / (peakT - wT));
          wind = 1 - u;
          ext = u;
        } else if (pt < dur) {
          ext = 1 - ease((pt - peakT) / (dur - peakT));
        } else {
          punchState.active = false;
          ext = 0;
        }

        if (st === 4) {
          // Фронт-кик (удар ногой): руки разводятся чуть в стороны и вниз для баланса корпуса при выбросе ноги вперёд
          rx =  .096 + wind * .022 + ext * .058;
          ry = -.104 - wind * .015 - ext * .045;
          rz = -.262 + ext * .028;
          lx = -.096 - wind * .022 - ext * .058;
          ly = -.104 - wind * .015 - ext * .045;
          lz = -.262 + ext * .028;
          fx.smokePitch = wind * .022 - ext * (.052 + runB * .024);
        } else if (punchState.side < 0) {
          // Джеб левой (с разбегу — длиннее и мощнее вложение плеча)
          lx = -.088 - wind * .030 + ext * (.088 + runB * .016);
          ly = -.100 - wind * .022 + ext * .060;
          lz = -.270 + wind * .024 - ext * (.042 + runB * .032);
          lMix = ext;
          rx = .092 + ext * .014;
          ry = -.118 - ext * .016;
          rz = -.268 + ext * .016;
          fx.smokePitch = ext * (.028 + runB * .020) - wind * .014;
        } else if (st === 2) {
          // Боковой удар (хук): широкий замах вправо с поднятым локтем и круговой захлёст через центр экрана влево
          rTargetQ = qHookR;
          const arc = Math.sin(ext * Math.PI);
          rx = .088 + wind * .092 + arc * .058 - ext * (.156 + runB * .022);
          ry = -.098 + wind * .032 + arc * .024 + ext * .052;
          rz = -.268 + wind * .044 - arc * (.068 + runB * .028) - ext * .026;
          rMix = Math.min(1, wind * .45 + ext);
          // Левая рука плотно страхует челюсть/висок
          lx = -.094 - ext * .010;
          ly = -.072 + ext * .012;
          lz = -.252 + ext * .014;
          fx.smokePitch = ext * (.038 + runB * .020) - wind * .022;
        } else if (st === 3) {
          // Апперкот: присед/подсед на замахе, кулак разворачивается ладонью к себе, опускается вниз и взлетает вертикально вверх в подбородок
          rTargetQ = qUpperR;
          const arc = Math.sin(ext * Math.PI);
          rx = .084 + wind * .018 - ext * .066;
          ry = -.098 - wind * .118 + ext * (.172 + runB * .026);
          rz = -.262 + wind * .036 - arc * (.066 + runB * .028) - ext * .034;
          rMix = Math.min(1, wind * .55 + ext);
          // Левая рука прикрывает голову
          lx = -.094;
          ly = -.070 - wind * .025 + ext * .012;
          lz = -.254 + ext * .016;
          fx.smokePitch = ext * (.076 + runB * .024) - wind * .052;
        } else {
          // Прямой правой (кросс)
          rx = .088 + wind * .034 - ext * (.088 + runB * .016);
          ry = -.098 - wind * .024 + ext * .060;
          rz = -.268 + wind * .024 - ext * (.044 + runB * .034);
          rMix = ext;
          lx = -.092 - ext * .014;
          ly = -.118 - ext * .016;
          lz = -.270 + ext * .016;
          fx.smokePitch = ext * (.034 + runB * .022) - wind * .016;
        }
      } else {
        fx.smokePitch = jolt * .35 + fx.smokePitch * Math.max(0, 1 - dt * 12);
        if (!punchState.blocking) {
          punchState.guardT = Math.max(0, punchState.guardT - dt);
        }
        const gk = punchState.blocking ? 1 : Math.min(1, punchState.guardT / .28);
        ry -= (1 - gk) * .22;
        ly -= (1 - gk) * .22;
        if (punchState.guardT <= 0 && !punchState.blocking) {
          fistR.visible = false;
          handL.visible = false;
          fx.handOut = false;
          fx.smokePitch = 0;
        }
      }

      fistR.pose(P_.fist, dt, 18);
      handL.pose(P_.fist, dt, 18);
      fistR.position.set(rx, ry, rz);
      handL.position.set(lx, ly, lz);
      fistR.quaternion.copy(qGuardR).slerp(rTargetQ, rMix);
      handL.quaternion.copy(qGuardL).slerp(qStrikeL, lMix);
      return;
    }
    if (!hab.busy) {
      fx.smokePitch = 0;
      const pSpd = Math.hypot(P.vx || 0, P.vz || 0);
      const wDrawn = !!(env.weaponDrawn && env.weaponDrawn());
      const isRun = !!(P.sprint && !P.crouch && !P.seated && !P.lying && !held && !wDrawn && pSpd > 2.0);
      hab.runK = (hab.runK || 0) + ((isRun ? 1 : 0) - (hab.runK || 0)) * Math.min(1, dt * 10);
      if (hab.runK > .015) {
        // Реалистичное положение рук при беге: нейтральный беговой хват («молоток» — большие пальцы сверху, ладони развёрнуты друг к другу внутрь, мах от локтей вперёд-вверх по бокам кадра)
        fx.handOut = true;
        handR.visible = false;
        fistR.visible = true;
        handL.visible = true;
        fistR.pose(P_.fist, dt, 14);
        handL.pose(P_.fist, dt, 14);
        // мах рук от плеча, согнутых в локте ~90°: рука уходит вперёд-вверх к середине груди (кулак виден снизу кадра)
        // и назад за корпус (уходит из кадра); руки в противофазе, плюс общее покачивание корпуса в такт шагам
        const ph = (P.stepPh || 0) * Math.PI * .78;
        const sR = Math.sin(ph), sL = -sR, bob = Math.abs(Math.cos(ph)) * .012;
        const arm = (sg, sw) => { const f = (sw + 1) / 2, e = f * f * (3 - 2 * f); // 0 — рука сзади, 1 — впереди
          return [sg * (.225 - e * .09), -.44 + e * .25 - bob - (1 - hab.runK) * .16, -.06 - e * .25]; };
        const [rx, ry, rz] = arm(1, sR), [lx, ly, lz] = arm(-1, sL);
        fistR.position.set(rx, ry, rz);
        handL.position.set(lx, ly, lz);
        // впереди кулак развёрнут «молотком» к центру и чуть вверх, сзади — опущен вдоль предплечья
        quatFB(V(-.30 + sR * .06, .55 + sR * .35, -.62 + sR * .12), V( .80, .45 - sR * .2, .35), fistR.quaternion);
        quatFB(V( .30 - sL * .06, .55 + sL * .35, -.62 + sL * .12), V(-.80, .45 - sL * .2, .35), handL.quaternion);
      } else {
        fistR.visible = false;
        handL.visible = false;
        fx.handOut = false;
      }
      return;
    }
    if (!hab.freeze) hab.t += dt;
    const t = hab.t, k = Math.min(1, dt * 12);

    if (hab.busy === 'smoke') {
      const cycIdx = Math.floor(t / 8.0);
      const c = t % 8.0;

      let toMouth = 0, toAsh = 0, inhale = 0;
      if (c >= 1.25 && c < 1.85) toMouth = ease((c - 1.25) / .60);
      else if (c >= 1.85 && c < 3.20) {
        toMouth = 1; inhale = 1;
        hab.inhaleSmokeAcc = (hab.inhaleSmokeAcc || 0) + dt * 5.5;
        if (hab.inhaleSmokeAcc >= 1) {
          hab.inhaleSmokeAcc -= 1;
          puff(V(-.018 + R(-.01, .01), -.105 + R(-.008, .008), -.19), V(R(-.015, .015), R(.035, .065), -.08), 1, .65, .72);
        }
      }
      else if (c >= 3.20 && c < 3.75) toMouth = 1 - ease((c - 3.20) / .55);
      else if (c >= 5.50 && c < 5.90) toAsh = ease((c - 5.50) / .40);
      else if (c >= 5.90 && c < 7.20) toAsh = 1;
      else if (c >= 7.20 && c < 7.75) toAsh = 1 - ease((c - 7.20) / .55);

      if (hab.lit) {
        // Сигарета заметно сгорает с каждой затяжкой (~24% длины за цикл, полностью до окурка за 4 затяжки)
        hab.burn = Math.max(0, hab.burn - dt * (inhale ? .145 : .0065));
        hab.ashLen = Math.min(.0095, hab.ashLen + dt * (inhale ? .0048 : .0003));
      }
      fx.smokePitch += (-toMouth * .055 - fx.smokePitch) * Math.min(1, dt * 10);
      const glow = inhale ? 3.2 : (hab.burn > .02 ? 1.05 + Math.sin(t * 6) * .12 : .35);
      emberLight.position.y = .008 + hab.burn * .058;
      emberLight.intensity = glow * .38;

      if (c >= 3.62 && c < 4.78) {
        if (hab.exhaledCycle !== cycIdx) {
          hab.exhaledCycle = cycIdx;
          hab.exhaleEmitAcc = 0;
          hab.puffs++;
          fx.smoke = Math.min(1, fx.smoke + .24);
          if (!hab.doneAsk) { hab.doneAsk = true; env.onCtl(); }
          // Направленный импульс выдоха изо рта вперёд-вверх: струя вылетает и закручивается клубами в воздухе
          puff(V(-.014, -.096, -.21), V(-.012, .036, -.22), 5, .92, .95);
          puff(V(-.006, -.088, -.26), V( .008, .048, -.16), 3, 1.08, .85);
        }
        // Живая редеющая струя выдоха (умеренное количество частиц, чтобы были видны отдельные завитки и кольца)
        const exU = clamp(1 - (c - 3.62) / 1.16, 0, 1);
        hab.exhaleEmitAcc = (hab.exhaleEmitAcc || 0) + dt * (4.5 + exU * 9.5);
        while (hab.exhaleEmitAcc >= 1) {
          hab.exhaleEmitAcc -= 1;
          const spread = (1 - exU) * .022;
          puff(
            V(-.014 + R(-.018 - spread, .018 + spread), -.094 + R(-.012, .015), -.22 - (1 - exU) * .05),
            V(R(-.032, .028), R(.032, .064), -(.11 + exU * .13)),
            1,
            R(.82, 1.16),
            .75 + exU * .25
          );
        }
      }

      let flickJolt = 0;
      if (c >= 6.75 && c < 7.15) {
        const u = (c - 6.75) / .40;
        flickJolt = Math.sin(u * Math.PI);
        if (c >= 6.82 && hab.flickedCycle !== cycIdx) {
          hab.flickedCycle = cycIdx;
          handR.updateMatrixWorld(true);
          cig.userData.tipNode.getWorldPosition(_p);
          spawnAshDrops(_p);
          hab.ashLen = .002;
          env.audio && env.audio.click(2200, .18, 0, .04);
        }
      }

      cig.userData.setBurn(hab.burn, hab.ashLen, glow);
      // Плавный поворот самой сигареты между пальцами: к губам (круто вверх-влево от фильтра у рта) и при стряхивании пепла (кончиком влево-вниз)
      _q2.setFromAxisAngle(V(0, 0, 1), -flickJolt * .11);
      cigNode.quaternion.copy(cigBaseQ);
      if (toMouth > 0) cigNode.quaternion.slerp(cigMouthQ, toMouth);
      else if (toAsh > 0) cigNode.quaternion.slerp(cigAshQ, toAsh);
      cigNode.quaternion.multiply(_q2);
      cigNode.position.set(
        -.017 - toMouth * .005,
        -.016 - toMouth * .014 + toAsh * .012,
        -.152 - toMouth * .014 + toAsh * .024
      );
      // Тонкая вьющаяся струйка дымка от тлеющего кончика самой сигареты между затяжками
      if (hab.lit && hab.burn > .03 && toMouth < .35) {
        hab.tipSmokeAcc = (hab.tipSmokeAcc || 0) + dt * 4.2;
        if (hab.tipSmokeAcc >= 1) {
          hab.tipSmokeAcc -= 1;
          handR.updateMatrixWorld(true);
          cig.userData.tipNode.getWorldPosition(_p);
          vm.worldToLocal(_p);
          puff(_p, V(R(-.008, .008), R(.048, .072), R(-.010, .010)), 1, .34, .52);
        }
      }

      // Позиция и поворот кисти
      _q.copy(SM.restQ);
      if (toMouth > 0) _q.slerp(SM.mouthQ, toMouth);
      else if (toAsh > 0) _q.slerp(SM.ashQ, toAsh);

      const tgt = _p.copy(SM.restP);
      if (toMouth > 0) {
        tgt.lerp(SM.mouthP, toMouth);
        // Во время самой затяжки фильтр чуть плотнее прижимается к губам
        if (inhale) {
          const drawK = Math.sin(clamp((c - 1.85) / 1.35, 0, 1) * Math.PI);
          tgt.z += drawK * .006;
          tgt.y -= drawK * .003;
        }
      } else if (toAsh > 0) {
        tgt.lerp(SM.ashP, toAsh);
      }
      if (t < .35) tgt.y -= (1 - ease(t / .35)) * .22;
      tgt.y += Math.sin(t * 2.2) * .002 + flickJolt * .005;

      handR.position.lerp(tgt, k);
      handR.quaternion.slerp(_q, k);

      // Поза пальцев: в затяжке средний палец сгибается под сигарету (не перекрывая её), при стряхивании — указательный спереди, средний вертикально сзади
      let pose = P_.pinch;
      if (toMouth > 0) {
        pose = handR.mix([P_.pinch, 1 - toMouth], [P_.pinchHard, toMouth + .001]);
      } else if (toAsh > 0) {
        pose = (c >= 6.75 && c < 7.18) ? P_.ashFlick : handR.mix([P_.pinch, 1 - toAsh], [P_.ashReady, toAsh + .001]);
      }
      handR.pose(pose, dt, 15, .006, t);
      if (hab.burn <= .01 && c >= 7.65) {
        finishHabit(inK(P.x, P.z) ? 'ashtray' : 'throw');
      }
    } else if (hab.busy === 'drink') {
      // Фазы анимации выпивания (3.8 с):
      // 0.00..0.45 — рука плавно поднимает бутылку справа снизу (горлышком вверх-влево, этикеткой и пальцами к игроку)
      // 0.45..0.95 — если бутылка новая, большой палец со щелчком сбивает крышку вверх
      // 0.95..1.55 — поднесение горлышка бутылки прямо к губам игрока снизу по центру
      // 1.55..3.15 — три выраженных глотка: на каждом глотке бутылка сильнее запрокидывается донышком вверх-вперёд, а голова игрока слегка откидывается назад
      // 3.15..3.80 — плавное опускание бутылки обратно
      let toMouth = 0;
      if (t >= .95 && t < 1.55) toMouth = ease((t - .95) / .60);
      else if (t >= 1.55 && t < 3.15) toMouth = 1;
      else if (t >= 3.15 && t < 3.75) toMouth = 1 - ease((t - 3.15) / .60);

      if (t > .52 && cap.visible && !hab.capOff) {
        hab.capOff = true; hab.flick = .32;
        env.audio && env.audio.click(1800, .5, 0, .06);
      }
      if (hab.capOff && cap.visible) {
        cap.position.y += dt * .65; cap.position.x -= dt * .22; cap.rotation.z += dt * 18;
        if (cap.position.y > .52) cap.visible = false;
      }
      if (hab.flick > 0) hab.flick -= dt;

      let gulp = 0;
      if (t >= 1.55 && t < 3.15) {
        const gp = (t - 1.55) / .52, gi = Math.floor(gp), gf = gp - gi;
        gulp = Math.sin(gf * Math.PI);
        if (gi > hab.gulps - 1 && gf > .35 && hab.gulps < 3) {
          hab.gulps++;
          env.audio && env.audio.gulp && env.audio.gulp();
        }
      }
      // Начисление опьянения зависит от крепости напитка и дозы:
      // самогон (+0.55 за приём — пьянит быстрее всего), спирт/водка (+0.36 — средне), пиво (+0.18 — слабее, но с нескольких порций тоже развозит)
      if (t > 1.75 && hab.sips === 0) {
        hab.sips = 1;
        const strong = hab.kind === 'soda' ? 0 : ({ samogon: .70, vodka: .48, beer: .28 }[hab.kind] || .28);
        fx.drunkTarget = Math.min(1.8, fx.drunkTarget + strong);
        env.onDrink && env.onDrink(hab.kind, strong, fx.drunkTarget);
      }
      if (t > 3.80) {
        const dKind = hab.kind || 'vodka';
        const willBlackout = fx.drunkTarget >= 1.35;
        hab.capOff = false; fx.smokePitch = 0;
        finishHabit('done');
        const f = hab.onDrinkEnd;
        if (f) { hab.onDrinkEnd = null; f(dKind, willBlackout); }
        if (willBlackout && env.onBlackout) env.onBlackout();
        return;
      }

      // Лёгкое запрокидывание головы назад при глотках
      fx.smokePitch += (toMouth * (.045 + gulp * .038) - fx.smokePitch) * Math.min(1, dt * 10);

      // Ось бутылки n (от дна к горлышку = −X кисти):
      // В покое: бутылка стоит почти вертикально справа снизу, чуть наклонена горлышком влево-вверх.
      // У рта: горлышко направлено прямо к губам игрока (+Z к камере, снизу по центру), а корпус уходит вправо-вниз-вперёд;
      // на каждом глотке донышко приподнимается выше (бутылка запрокидывается сильнее).
      // Ось бутылки n (от дна к горлышку = −X кисти):
      // В покое (t < 0.95): бутылка стоит справа снизу горлышком вверх.
      // При поднесении ко рту (toMouth → 1): бутылка наклоняется горлышком вниз-влево-назад прямо в рот игрока (LIPS),
      // а корпус и донышко поднимаются вверх-вправо-вперёд и запрокидываются сильнее на каждом из 3 глотков!
      // Предплечье (+Z кисти) всегда естественно уходит вниз-вправо к правому плечу игрока (b = elbowDir × (−n)).
      const nRest = V(-.12, .98, -.12);
      const nMouth = V(-.34, -.26 - gulp * .22, .88);
      const n = nRest.lerp(nMouth, toMouth).normalize();

      const elbowRest = V(.35, -.82, .45);
      const elbowMouth = V(.55, -.78, .32);
      const elbowDir = elbowRest.lerp(elbowMouth, toMouth).normalize();
      const b = new THREE.Vector3().crossVectors(elbowDir, n.clone().negate()).normalize();
      quatBottle(n, b, _q);

      const neckLocal = V(-(NECK - GRIP_Y), 0, 0).add(bottleNode.position);
      const restTarget = _p2.set(.125, -.165, -.33);
      if (t < .45) restTarget.y -= (1 - ease(t / .45)) * .28;
      // Позиция горлышка прямо у губ игрока у нижнего края экрана (корпус и донышко бутылки поднимаются перед глазами и запрокидываются выше на каждом глотке)
      // на глотке горлышко плотнее прижимается к нижней губе и чуть уходит вверх вместе с запрокинутой головой
      const mouthTarget = V(-.020, -.172 + gulp * .006, -.060 + gulp * .004);

      const restPos2 = placeByLocal(_q, bottleNode.position, restTarget).clone();
      const mouthPos = placeByLocal(_q, neckLocal, mouthTarget).clone();
      handR.position.lerp(restPos2.lerp(mouthPos, toMouth), k);
      handR.quaternion.slerp(_q, k);

      const closeK = Math.min(1, t / .40);
      const pose = hab.flick > 0
        ? handR.mix([P_.grip, 1], [P_.thumbFlick, 1.35])
        : handR.mix([P_.open, 1 - closeK], [P_.grip, closeK + .001]);
      handR.pose(pose, dt, 16, .008, t);
    }
    // (Анимация кулачного боя обрабатывается в начале habitTick)
  }
  const habit = { get busy() { return hab.busy; }, get handcuffed() { return !!hab.handcuffed; }, setHandcuffed, startSignProtocol, get canFinish() { return hab.busy === 'smoke' && hab.doneAsk; }, startSmoke: () => { hidePunchHands(); return startSmoke(); }, startDrink: (k, f) => { hidePunchHands(); return startDrink(k, f); }, startPunch, setBlock, triggerBlockImpact, hidePunchHands, get punching() { return punchState.active; }, get blocking() { return punchState.blocking; }, finishHabit, giveEmptyBottle, stashHeldBottle, set onDrinkEnd(f) { hab.onDrinkEnd = f; }, debugPose(t) { hab.t = t; hab.freeze = t != null; }, get hand() { return handR; } };

  function strikeItem(it, dirX, dirY, dirZ, baseForce = 4.0, isKick = false, isHeavy = false) {
    if (!it || it === held) return false;
    const hLen = Math.hypot(dirX, dirZ) || 1;
    const nx = dirX / hLen, nz = dirZ / hLen;
    // Снимаем статический коллайдер предмета на время полёта, чтобы он не упирался сам в себя!
    if (it.col) {
      const ci = colliders.indexOf(it.col);
      if (ci >= 0) colliders.splice(ci, 1);
      it.col = null;
    }
    // Пробуждаем все предметы, стоящие на столе/стуле/кресле, чтобы они реалистично слетали и падали!
    if (typeof wakeItemsAbove === 'function') {
      wakeItemsAbove(it, nx * (isKick ? 1.45 : 0.85), nz * (isKick ? 1.45 : 0.85));
    }
    it.inBoxId = null; it.boxOff = null;
    if (it.data) { it.data.lying = false; it.data.leaned = false; it.data.restQ = null; it.data.restH = null; }
    // Приподнимаем предмет на 3.5 см над полом, чтобы в первый же кадр не сработало мгновенное приземление
    it.obj.position.y += 0.035;
    const mass = Math.max(0.3, it.mass || 1.2);
    const furn = isFloorFurniture(it);
    const massK = furn
      ? Math.max(0.58, Math.min(1.30, 4.2 / mass))
      : Math.max(0.60, Math.min(1.55, 2.0 / mass));
    const spdH = baseForce * massK * (isKick ? 1.38 : isHeavy ? 1.12 : 0.92);
    const upV = furn
      ? (isKick ? 2.15 : 1.35) * Math.max(0.72, Math.min(1.20, 4.2 / mass))
      : (1.65 + (isKick ? 0.65 : 0) + Math.max(0, dirY) * 0.65);

    if (it.kind === 'box' || it.kind === 'gun') {
      it.state = 'fall';
      it.vx = nx * spdH * 0.80;
      it.vz = nz * spdH * 0.80;
      it.vy = upV;
    } else {
      it.state = 'ragdoll';
      it.vel = new THREE.Vector3(nx * spdH, upV, nz * spdH);
      const camFwdX = -Math.sin(P.yaw), camFwdZ = -Math.cos(P.yaw);
      const relX = it.obj.position.x - P.x, relZ = it.obj.position.z - P.z;
      const leverCross = camFwdX * relZ - camFwdZ * relX;
      it.yawVel = Math.max(-6.5, Math.min(6.5, leverCross * (isKick ? 5.8 : 3.6)));
      it.lastStrikeKick = !!(isKick || isHeavy);
      it.tiltVel = (isKick ? 7.4 : isHeavy ? 5.2 : 3.6) * massK;
      it.spinVel = (isKick ? 3.2 : 1.8) * massK;
      it.slideDirX = nx;
      it.slideDirZ = nz;
      it.bounces = 0;
      it.dropOriginY = it.obj.position.y + 0.15;
    }
    return true;
  }

  function leanGuitar(it, tiltRad = -0.22) {
    if (!it || !it.obj || !it.obj.userData || !it.obj.userData.piv) return false;
    const qLean = new THREE.Quaternion().setFromEuler(new THREE.Euler(tiltRad, 0, 0));
    if (it.data) {
      it.data.lying = false;
      it.data.leaned = true;
      it.data.restQ = qLean.toArray().map(v => +v.toFixed(4));
      it.data.restH = 0.002;
    }
    applyBottlePose(it);
    return true;
  }

  return {
    strikeItem, leanGuitar,
    layFlat: it => { if (layTallFlat(it)) { applyBottlePose(it); persist(); } },
    makeHand, items, addItem, removeItem, rebuildPackItem, loadItems, persist, lookItem, pick, placeHeld, dropHeld, trashHeld, unpack, lookingAtOpenBox, throwIntoBox, shatterBottle, rayPlace, surfaceBelow, get held() { return held; },
    canPlace: () => {
      if (!held) return false;
      const pl = rayPlace(2.25, held);
      return !!pl;
    },
    rayPlaceShelf: (maxD = 1.05) => {
      const pl = rayPlace(maxD, held);
      return (pl && pl.s && pl.s.name === 'shelf') ? { point: new THREE.Vector3(pl.x, pl.y, pl.z), rowIdx: pl.s.rowIdx } : null;
    },
    lookingAtPhone: () => { ray.setFromCamera(new THREE.Vector2(0, 0), camera); const h = ray.ray.intersectBox(phoneBox, tmp); return h && h.distanceTo(camera.position) < 1.8; },
    lookingAtNotepad: () => { const b = noteBox(); if (!b) return false; ray.setFromCamera(new THREE.Vector2(0, 0), camera); const h = ray.ray.intersectBox(b, tmp); return h && h.distanceTo(camera.position) < 1.6; },
    lookingAtAshtray: () => { ray.setFromCamera(new THREE.Vector2(0, 0), camera); const h = ray.ray.intersectBox(ashBox, tmp); return h && h.distanceTo(camera.position) < 1.6; },
    setPhoneModel, startCall, setDialing, dialNumber, hangUp, get calling() { return ph.calling; }, phone: ph,
    setNotepadModel, openNotepad, closeNotepad, openPaper, closePaper, get notepadState() { return noteState !== 'rest' ? noteState : paperState; },
    setCigaretteModel, setBottleModel, setButts, setEnvLight, habit, fx,
    tick(dt, dHour) {
      // Фиксированный физический шаг (60 Гц, до 3 подшагов) для стабильной физики предметов
      let rem = Math.min(dt, 0.08);
      const step = 1 / 60;
      let steps = 0;
      while (rem > 1e-4 && steps < 3) {
        const h = (steps === 2 || rem <= step * 1.15) ? rem : step;
        itemsTick(h);
        rem -= h;
        steps++;
      }
      deliveryTick(dt, dHour); phoneTick(dt); noteTick(dt); habitTick(dt);
    }, stashHeldBottle,
    heavy: () => held ? held.mass : 0,
  };
}
