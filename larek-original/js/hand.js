// Единая высокодетализированная скелетная модель рук и тела/ног главного героя (курение, выпивка, кулачный бой, удержание оружия, бег, ходьба и сидение).
// Система координат кисти: запястье в начале, пальцы смотрят в −Z, тыльная сторона +Y, ладонь −Y, большой палец со стороны −X*side.
// У каждого пальца три сустава (MCP — пястно-фаланговый, PIP, DIP), у большого — CMC, MCP, IP.
import * as THREE from 'three';

const FINGERS = [ // имя, x костяшки, z костяшки, длины фаланг, радиус
  ['index',  -.026, -.088, [.044, .027, .021], .0096],
  ['middle', -.007, -.092, [.048, .029, .022], .0098],
  ['ring',    .011, -.088, [.043, .026, .020], .0092],
  ['pinky',   .028, -.081, [.035, .021, .017], .0084],
];
const THUMB = [[.038, .012], [.030, .0108], [.025, .0098]]; // пястная, проксимальная, дистальная

// Библиотека поз: для пальца [MCP, PIP, DIP, разведение], для большого [CMC, MCP, IP, отведение]
export const HAND_POSES = {
  relaxed: { index: [.25, .3, .2, .04], middle: [.3, .35, .2, 0], ring: [.35, .4, .25, -.03], pinky: [.4, .45, .3, -.06], thumb: [.15, .15, .1, .1] },
  open:    { index: [.05, .05, .03, .08], middle: [.05, .05, .03, .02], ring: [.06, .06, .04, -.04], pinky: [.08, .08, .05, -.1], thumb: [-.1, 0, 0, .35] },
  // Покой с сигаретой: сигарета зажата между указательным и средним пальцами
  pinch:   { index: [.14, .28, .20, .06], middle: [.18, .32, .22, -.05], ring: [.88, 1.22, .78, -.04], pinky: [1.12, 1.32, .85, -.08], thumb: [.08, .12, .08, .42] },
  // Затяжка у рта
  pinchHard: { index: [.08, .20, .14, .10], middle: [.22, .42, .30, -.08], ring: [1.30, 1.45, .90, -.05], pinky: [1.40, 1.50, .95, -.10], thumb: [.45, .40, .25, .15] },
  // Разворот кисти боком перед стряхиванием пепла
  ashReady: { index: [.26, .28, .18, .03], middle: [.04, .06, .04, -.03], ring: [1.32, 1.48, .92, -.06], pinky: [1.42, 1.52, .95, -.12], thumb: [.68, .62, .42, .05] },
  // Щелчок большим пальцем по фильтру
  ashFlick: { index: [.24, .26, .16, .03], middle: [.04, .06, .04, -.03], ring: [1.32, 1.48, .92, -.06], pinky: [1.42, 1.52, .95, -.12], thumb: [.32, .14, -.10, .16] },
  // Реалистичный анатомический хват вокруг цилиндра бутылки
  grip:    { index: [.42, .80, .58, .05], middle: [.46, .84, .62, 0], ring: [.50, .88, .65, -.03], pinky: [.54, .92, .68, -.06], thumb: [.68, .52, .38, -.28] },
  // Большой палец тянется вверх к горлышку и отщёлкивает пробку
  thumbFlick: { index: [.40, .78, .55, .05], middle: [.44, .82, .60, 0], ring: [.48, .86, .63, -.03], pinky: [.52, .90, .66, -.06], thumb: [-.18, -.12, -.15, .48] },
  // Анатомически правильный плотно сжатый боксёрский кулак:
  // 4 пальца согнуты на ~90° в пястно-фаланговом (MCP), ~98° в проксимальном (PIP) и ~82° в дистальном (DIP) суставах так, что подушечки и ногти полностью утоплены в ладони,
  // а большой палец согнут и плотно прижат снаружи горизонтально поперёк средних фаланг указательного и среднего пальцев!
  fist: { index: [1.56, 1.68, 1.42, .01], middle: [1.58, 1.70, 1.44, 0], ring: [1.60, 1.72, 1.45, -.01], pinky: [1.62, 1.74, 1.46, -.03], thumb: [.92, .50, 1.16, .70] },
};

// Анатомическая скруглённая ногтевая пластина, которая лежит строго поверх кожи фаланги без врезания и Z-fighting
function makeNailGeo(r, len) {
  const nw = r * 1.08, nh = .0018, nl = len * .42;
  const g = new THREE.BoxGeometry(nw, nh, nl, 4, 1, 3);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ux = x / (nw * .5);
    const uz = z / (nl * .5);
    // Плавный поперечный изгиб ногтя по профилю пальца + скругление переднего края
    const archY = -Math.pow(ux, 2) * r * .18;
    const tipTaper = uz < 0 ? (1 - .14 * Math.pow(-uz, 2)) : (1 - .06 * Math.pow(uz, 2));
    p.setX(i, x * tipTaper);
    p.setY(i, y + archY + (y > 0 ? .0004 * (1 - ux * ux) : 0));
  }
  g.computeVertexNormals();
  return g;
}

// Единая реалистичная сглаженная модель руки и рукава куртки главного героя (side = 1 — правая рука, side = -1 — левая рука)
export function makeRigHand(std, side = 1) {
  const skin = new THREE.MeshStandardMaterial({ color: 0xd8a082, emissive: 0x1c100a, emissiveIntensity: .07, roughness: .52, metalness: .04 });
  const skinDark = new THREE.MeshStandardMaterial({ color: 0xbe8466, emissive: 0x160c08, emissiveIntensity: .06, roughness: .58, metalness: .03 });
  const nailM = new THREE.MeshStandardMaterial({ color: 0xe8c4b0, emissive: 0x1a0f0a, emissiveIntensity: .06, roughness: .26, metalness: .08, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const cuffM = new THREE.MeshStandardMaterial({ color: 0x1d2630, emissive: 0x06080b, emissiveIntensity: .06, roughness: .82, metalness: .03 });
  const sleeveM = new THREE.MeshStandardMaterial({ color: 0x273440, emissive: 0x080c10, emissiveIntensity: .06, roughness: .76, metalness: .04 });
  const root = new THREE.Group();
  const add = (geo, m, p, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); p.add(o); return o; };

  // Скруглённая анатомическая ладонь с высокой полигональной сеткой (6x3x6) и боковыми валиками
  const palmGeo = new THREE.BoxGeometry(.082, .026, .092, 6, 3, 6);
  {
    const p = palmGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x0 = p.getX(i), y0 = p.getY(i), z0 = p.getZ(i);
      const u = (-z0 + .046) / .092;
      const k = .86 + .14 * u;
      const edgeRound = 1 - .18 * Math.pow(Math.abs(x0) / .041, 2);
      p.setX(i, x0 * k);
      p.setY(i, y0 * edgeRound + (y0 > 0 ? .0025 * Math.cos(x0 * 32) : -.002 * (1 - Math.pow(x0 / .041, 2))));
    }
    palmGeo.computeVertexNormals();
  }
  add(palmGeo, skin, root, 0, -.001, -.046);
  const sideL = add(new THREE.CapsuleGeometry(.0135, .068, 8, 14), skin, root, -.035 * side, -.001, -.045); sideL.rotation.x = Math.PI / 2; sideL.scale.set(1, 1, .92);
  const sideR = add(new THREE.CapsuleGeometry(.0130, .066, 8, 14), skin, root,  .035 * side, -.001, -.044); sideR.rotation.x = Math.PI / 2; sideR.scale.set(1, 1, .92);
  const knuckleBridge = add(new THREE.CapsuleGeometry(.0125, .056, 8, 14), skin, root, 0, -.001, -.084); knuckleBridge.rotation.z = Math.PI / 2; knuckleBridge.scale.set(.92, 1, 1);
  // Мышца большого пальца (тенар) на ладони со стороны -X*side
  add(new THREE.SphereGeometry(.023, 14, 12), skin, root, -.024 * side, -.010, -.032).scale.set(1.05, .68, 1.38);

  // Овальное в сечении анатомическое запястье и группа рукава (позволяет наклонять предплечье отдельно при удержании цевья ружья)
  const sleeveGroup = new THREE.Group();
  root.add(sleeveGroup);
  const wrist = add(new THREE.CylinderGeometry(.035, .038, .062, 16), skin, sleeveGroup, 0, -.001, .020);
  wrist.rotation.x = Math.PI / 2;
  wrist.scale.set(1.02, 1, .58);
  const wristCap = add(new THREE.SphereGeometry(.036, 14, 10), skin, sleeveGroup, 0, -.001, -.004);
  wristCap.scale.set(1.0, .54, .85);

  // Вязаная манжета и длинный рукав зимней куртки
  const cuff = add(new THREE.CylinderGeometry(.039, .042, .038, 16), cuffM, sleeveGroup, 0, -.001, .052);
  cuff.rotation.x = Math.PI / 2;
  cuff.scale.set(1.02, 1, .68);
  const cuffLip = add(new THREE.SphereGeometry(.039, 14, 10), cuffM, sleeveGroup, 0, -.001, .035);
  cuffLip.scale.set(1.02, .65, .45);
  const forearm = add(new THREE.CylinderGeometry(.043, .056, .32, 16), sleeveM, sleeveGroup, 0, -.002, .225);
  forearm.rotation.x = Math.PI / 2;
  forearm.scale.set(1.04, 1, .76);
  root.sleeveGroup = sleeveGroup;

  // Материалы синяков (гематом) на открытых участках кожи кисти/запястья и сбитых в кровь костяшек
  const bruisePurpleM = new THREE.MeshStandardMaterial({ color: 0x3b1e46, emissive: 0x16081c, emissiveIntensity: .22, roughness: .82, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const bruiseRedM = new THREE.MeshStandardMaterial({ color: 0x681828, emissive: 0x24060c, emissiveIntensity: .25, roughness: .78, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const knuckleBloodM = new THREE.MeshStandardMaterial({ color: 0x8e1111, emissive: 0x380505, emissiveIntensity: .30, roughness: .42, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const knuckleScabM = new THREE.MeshStandardMaterial({ color: 0x520a0a, emissive: 0x1c0303, emissiveIntensity: .22, roughness: .68, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });

  // Синяки и гематомы на тыльной стороне ладони, запястье и у большого пальца
  const b1 = add(new THREE.SphereGeometry(.024, 10, 8), bruisePurpleM, root, -.010 * side, .0132, -.042); b1.scale.set(1.15, .14, 1.35);
  const b2 = add(new THREE.SphereGeometry(.019, 10, 8), bruiseRedM, root, .016 * side, .0128, -.056); b2.scale.set(1.1, .14, 1.15);
  const b3 = add(new THREE.SphereGeometry(.022, 10, 8), bruisePurpleM, sleeveGroup, -.006 * side, .0195, .016); b3.scale.set(1.25, .16, 1.10);
  const b4 = add(new THREE.SphereGeometry(.016, 8, 8), bruiseRedM, root, -.031 * side, .006, -.034); b4.scale.set(.9, .35, 1.2);

  const joints = {};
  const seg = (parent, len, r, nail) => {
    const m = add(new THREE.CapsuleGeometry(r, Math.max(.001, len - r * 1.10), 8, 14), skin, parent, 0, 0, -len / 2);
    m.rotation.x = Math.PI / 2;
    m.scale.set(1.02, 1, .92);
    if (nail) {
      const nm = add(makeNailGeo(r, len), nailM, parent, 0, r * .945, -len * .58);
      nm.rotation.x = .04;
    }
    const j = new THREE.Group(); j.position.z = -len; parent.add(j); return j;
  };
  for (const [name, x, kz, L, r] of FINGERS) {
    const mcp = new THREE.Group(); mcp.position.set(x * side, .002, kz); root.add(mcp);
    add(new THREE.SphereGeometry(r * 1.12, 12, 10), skinDark, mcp, 0, r * .18, .002);
    // Ссадины и кровь прямо на ударных костяшках кулака (MCP) и первых фалангах пальцев
    const kb = add(new THREE.SphereGeometry(r * 1.19, 10, 8), knuckleBloodM, mcp, 0, r * .36, -.001);
    kb.scale.set(1.12, .62, 1.18);
    const ks = add(new THREE.SphereGeometry(r * .95, 8, 6), knuckleScabM, mcp, 0, r * .52, -L[0] * .28);
    ks.scale.set(.95, .42, 1.35);
    const pip = seg(mcp, L[0], r); add(new THREE.SphereGeometry(r * .98, 10, 8), skin, pip);
    const kp = add(new THREE.SphereGeometry(r * 1.04, 8, 6), knuckleBloodM, pip, 0, r * .32, -.001);
    kp.scale.set(1.0, .55, 1.05);
    const dip = seg(pip, L[1], r * .94); add(new THREE.SphereGeometry(r * .92, 10, 8), skin, dip);
    seg(dip, L[2], r * .88, true);
    joints[name] = [mcp, pip, dip];
  }
  const cmc = new THREE.Group(); cmc.position.set(-.035 * side, -.007, -.027); root.add(cmc);
  const tBase = new THREE.Euler(-.10, .78 * side, .48 * side);
  const tAxis = new THREE.Group(); tAxis.rotation.copy(tBase); cmc.add(tAxis);
  const cmcJ = new THREE.Group(); tAxis.add(cmcJ);
  add(new THREE.SphereGeometry(THUMB[0][1] * 1.05, 10, 8), skin, cmcJ);
  const tm = seg(cmcJ, THUMB[0][0], THUMB[0][1]); add(new THREE.SphereGeometry(THUMB[1][1] * .98, 10, 8), skin, tm);
  const ip0 = new THREE.Group(); tm.add(ip0);
  const tp = seg(ip0, THUMB[1][0], THUMB[1][1]); add(new THREE.SphereGeometry(THUMB[2][1] * .95, 10, 8), skin, tp);
  const ip1 = new THREE.Group(); tp.add(ip1);
  seg(ip1, THUMB[2][0], THUMB[2][1], true);
  joints.thumb = [cmcJ, ip0, ip1];
  root.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; } });

  const cur = {}; for (const k of Object.keys(joints)) cur[k] = [...HAND_POSES.relaxed[k]];
  function apply() {
    for (const k of Object.keys(joints)) {
      const [a, b, c, s] = cur[k], J = joints[k];
      if (k === 'thumb') {
        // При сжатии кулака (a > 0.5) большой палец заворачивается внутрь (-0.32 * side по оси Y), ложась строго поперёк средних фаланг указательного и среднего пальцев
        const fistWrapY = Math.max(0, Math.min(1, (a - .45) / .47)) * (-.32 * side);
        J[0].rotation.set(-a, fistWrapY, s * side);
        J[1].rotation.x = -b;
        J[2].rotation.x = -c;
      } else {
        J[0].rotation.set(-a, s * side, 0);
        J[1].rotation.x = -b;
        J[2].rotation.x = -c;
      }
    }
  }
  root.setDamage = (bruiseLv = 0, knuckleLv = 0) => {
    const b = Math.max(0, Math.min(1, bruiseLv));
    const kn = Math.max(0, Math.min(1, knuckleLv));
    bruisePurpleM.opacity = b * .82;
    bruiseRedM.opacity = Math.min(1, b * .88 + kn * .25);
    knuckleBloodM.opacity = Math.min(.96, kn * .95 + b * .22);
    knuckleScabM.opacity = Math.min(.92, kn * .88 + b * .18);
  };
  root.pose = (target, dt, speed = 14, jitter = 0, t = 0) => {
    if (typeof window !== 'undefined' && window.__larekPlayerDamage) {
      root.setDamage(window.__larekPlayerDamage.bruise || 0, window.__larekPlayerDamage.knuckles || 0);
    }
    const k = dt == null ? 1 : 1 - Math.exp(-speed * dt);
    for (const name of Object.keys(joints)) { const tg = target[name]; if (!tg) continue; const c = cur[name];
      for (let i = 0; i < 4; i++) { const n = jitter ? Math.sin(t * (1.3 + i * .7) + name.length * 1.7) * jitter : 0; c[i] += (tg[i] + n - c[i]) * k; } }
    apply();
  };
  root.mix = (...pairs) => {
    const out = {}; for (const name of Object.keys(joints)) { const v = [0, 0, 0, 0]; let w = 0;
      for (const [p, wt] of pairs) { const src = p[name] || HAND_POSES.relaxed[name]; for (let i = 0; i < 4; i++) v[i] += src[i] * wt; w += wt; }
      out[name] = v.map(x => x / (w || 1)); } return out; };
  root.joints = joints;
  apply();
  return root;
}

// В кулачном бое и при беге используется ТА ЖЕ высокодетализированная модель руки makeRigHand в позе плотного кулака HAND_POSES.fist
export function makeBrawlerFist(side = 1) {
  const h = makeRigHand(null, side);
  h.pose(HAND_POSES.fist, null);
  // В плотно сжатом кулаке ногти четырёх пальцев прижаты внутрь ладони и не должны просвечивать снизу
  for (const fname of ['index', 'middle', 'ring', 'pinky']) {
    const dip = h.joints && h.joints[fname] && h.joints[fname][2];
    if (dip) {
      dip.traverse(o => {
        if (o.isMesh && o.material && o.material.polygonOffsetFactor === -2) {
          o.visible = false;
        }
      });
    }
  }
  return h;
}

// Реалистичная модель тела и ног главного героя от первого лица (куртка с молнией и подолом, ремень, брюки и зимние ботинки — без круглой сферы таза при взгляде вниз и без перекрытия камеры при беге)
export function makePlayerBody(std) {
  const root = new THREE.Group();

  // Процедурные текстуры ткани куртки, вязаного свитера и зимних брюк 1992 года
  const makeFabricTex = (baseHex, darkHex, lightHex, mode = 'weave') => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 128, 128);
    if (mode === 'knit') {
      // Крупная советская вязка свитера под курткой
      for (let y = 0; y < 128; y += 6) {
        ctx.fillStyle = (y % 12 === 0) ? darkHex : lightHex;
        ctx.fillRect(0, y, 128, 2);
        for (let x = 0; x < 128; x += 8) {
          ctx.fillStyle = ((x + y) % 16 === 0) ? lightHex : darkHex;
          ctx.fillRect(x, y, 3, 4);
        }
      }
    } else if (mode === 'quilted') {
      // Болоньевая куртка 90-х с горизонтальной прострочкой и микрорельефом ткани
      for (let i = 0; i < 900; i++) {
        ctx.fillStyle = (i & 1) ? darkHex : lightHex;
        ctx.fillRect((i * 37) % 128, (i * 53) % 128, 2, 2);
      }
      ctx.fillStyle = darkHex;
      for (let y = 16; y < 128; y += 24) {
        ctx.fillRect(0, y, 128, 2);
        ctx.fillStyle = lightHex;
        ctx.fillRect(0, y + 2, 128, 1);
        ctx.fillStyle = darkHex;
      }
    } else {
      // Плотная брючная ткань / джинса
      for (let y = 0; y < 128; y += 2) {
        ctx.fillStyle = (y % 4 === 0) ? darkHex : lightHex;
        ctx.fillRect(0, y, 128, 1);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  const jacketTex  = makeFabricTex('#273440', 'rgba(12,18,24,0.32)', 'rgba(68,88,108,0.18)', 'quilted');
  const sweaterTex = makeFabricTex('#3b352e', 'rgba(22,18,14,0.45)', 'rgba(88,78,68,0.28)', 'knit');
  const pantsTex   = makeFabricTex('#20252c', 'rgba(10,12,16,0.30)', 'rgba(54,62,74,0.16)', 'weave');

  const jacketM  = new THREE.MeshStandardMaterial({ color: 0x2d3c4a, map: jacketTex, emissive: 0x080c10, emissiveIntensity: .06, roughness: .68, metalness: .06 });
  const lapelM   = new THREE.MeshStandardMaterial({ color: 0x23303c, map: jacketTex, emissive: 0x06090c, emissiveIntensity: .06, roughness: .64, metalness: .07 });
  const sweaterM = new THREE.MeshStandardMaterial({ color: 0x463e36, map: sweaterTex, emissive: 0x090706, emissiveIntensity: .05, roughness: .84, metalness: .02 });
  const stripeM  = new THREE.MeshStandardMaterial({ color: 0xebe8e0, emissive: 0x121210, emissiveIntensity: .06, roughness: .58 });
  const beltM    = new THREE.MeshStandardMaterial({ color: 0x1a1410, emissive: 0x050302, emissiveIntensity: .05, roughness: .42, metalness: .22 });
  const buckleM  = new THREE.MeshStandardMaterial({ color: 0xc8a858, emissive: 0x161004, emissiveIntensity: .08, roughness: .22, metalness: .86 });
  const pantsM   = new THREE.MeshStandardMaterial({ color: 0x222830, map: pantsTex, emissive: 0x06080b, emissiveIntensity: .06, roughness: .74, metalness: .04 });
  const bootM    = new THREE.MeshStandardMaterial({ color: 0x181615, emissive: 0x050404, emissiveIntensity: .05, roughness: .44, metalness: .12 });
  const soleM    = new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: .94 });

  const hips = new THREE.Group();
  hips.position.set(0, .86, 0);
  root.add(hips);

  // Анатомический таз и пояс брюк
  const waistGeo = new THREE.CylinderGeometry(.124, .118, .12, 24);
  waistGeo.scale(1.22, 1, .76);
  const pelvis = new THREE.Mesh(waistGeo, pantsM);
  pelvis.position.set(0, -.015, .01);
  hips.add(pelvis);

  // Скруглённые тазобедренные суставы, чтобы при сгибании ног на стуле не было ни малейших зазоров
  for (const s of [-1, 1]) {
    const hipBall = new THREE.Mesh(new THREE.SphereGeometry(.072, 16, 12), pantsM);
    hipBall.scale.set(1.02, .92, 1.06);
    hipBall.position.set(s * .104, -.025, .005);
    hips.add(hipBall);
  }

  // Кожаный ремень со шлёвками и латунной пряжкой
  const beltGeo = new THREE.CylinderGeometry(.127, .126, .036, 24);
  beltGeo.scale(1.22, 1, .77);
  const belt = new THREE.Mesh(beltGeo, beltM);
  belt.position.set(0, .026, .01);
  hips.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(.048, .042, .014), buckleM);
  buckle.position.set(0, .026, -.088);
  hips.add(buckle);
  const buckleCenter = new THREE.Mesh(new THREE.BoxGeometry(.028, .024, .016), beltM);
  buckleCenter.position.set(0, .026, -.089);
  hips.add(buckleCenter);

  // ПОЛНОЕ РЕАЛИСТИЧНОЕ ТУЛОВИЩЕ ОТ ПОЯСА ДО ПЛЕЧ И ВОРОТНИКА (высота 0.46 м)
  // Наклон spine назад (+X в Three.js) уводит горловину и затылок воротника ЗА линию глаз камеры,
  // а передняя часть груди, лацканы, свитер, молния, карманы и пояс отлично видны при взгляде вниз (6145.png, 6147.png)!
  const spine = new THREE.Group();
  spine.position.set(0, .035, .015);
  hips.add(spine);

  // 1. Нижняя резинка-подол куртки
  const hemGeo = new THREE.CylinderGeometry(.134, .128, .07, 24);
  hemGeo.scale(1.22, 1, .78);
  const jacketHem = new THREE.Mesh(hemGeo, jacketM);
  jacketHem.position.set(0, .025, 0);
  spine.add(jacketHem);

  // 2. Живот и нижняя часть грудной клетки (y = 0.05 .. 0.25)
  const lowerTorsoGeo = new THREE.CylinderGeometry(.144, .134, .21, 24);
  lowerTorsoGeo.scale(1.24, 1, .80);
  const lowerTorso = new THREE.Mesh(lowerTorsoGeo, jacketM);
  lowerTorso.position.set(0, .155, .006);
  spine.add(lowerTorso);

  // 3. Верхняя часть груди и широкая грудная клетка до ключиц (y = 0.24 .. 0.44)
  const upperChestGeo = new THREE.CylinderGeometry(.156, .144, .21, 24);
  upperChestGeo.scale(1.30, 1, .82);
  const upperChest = new THREE.Mesh(upperChestGeo, jacketM);
  upperChest.position.set(0, .345, .016);
  spine.add(upperChest);

  // 4. Скруглённый верх грудной клетки и плечевого пояса (закрывает верх торса мягким куполом со свитером, без плоского среза!)
  const chestDomeGeo = new THREE.SphereGeometry(.152, 24, 14);
  chestDomeGeo.scale(1.32, .42, .80);
  const chestDome = new THREE.Mesh(chestDomeGeo, sweaterM);
  chestDome.position.set(0, .44, .022);
  spine.add(chestDome);

  // 5. Тёплый вязаный свитер крупной вязки в треугольном вырезе ворота куртки спереди (y = 0.28 .. 0.45)
  const sweaterFront = new THREE.Mesh(new THREE.BoxGeometry(.11, .16, .022), sweaterM);
  sweaterFront.position.set(0, .365, -.096);
  sweaterFront.rotation.x = -.06;
  spine.add(sweaterFront);

  const collarRollGeo = new THREE.TorusGeometry(.082, .024, 10, 20);
  collarRollGeo.scale(1.18, .92, 1.0);
  const collarRoll = new THREE.Mesh(collarRollGeo, sweaterM);
  collarRoll.rotation.x = Math.PI / 2 + .12;
  collarRoll.position.set(0, .455, .025);
  spine.add(collarRoll);

  // Открытый участок кожи шеи/ключиц в вырезе свитера с синяками и следами сплюнутой крови на вороте при сильных побоях
  const neckSkinM = new THREE.MeshStandardMaterial({ color: 0xd8a082, roughness: .75 });
  const neckPatch = new THREE.Mesh(new THREE.BoxGeometry(.078, .052, .024), neckSkinM);
  neckPatch.position.set(0, .425, -.092);
  neckPatch.rotation.x = -.18;
  spine.add(neckPatch);
  const bodyBruiseM = new THREE.MeshStandardMaterial({ color: 0x421a4c, emissive: 0x1a0620, emissiveIntensity: .25, roughness: .8, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const bodyBloodM = new THREE.MeshStandardMaterial({ color: 0x7c0e0e, emissive: 0x2a0404, emissiveIntensity: .25, roughness: .55, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const neckBruise1 = new THREE.Mesh(new THREE.SphereGeometry(.024, 8, 8), bodyBruiseM);
  neckBruise1.scale.set(1.2, .75, .25); neckBruise1.position.set(-.018, .424, -.103); spine.add(neckBruise1);
  const neckBruise2 = new THREE.Mesh(new THREE.SphereGeometry(.020, 8, 8), bodyBruiseM);
  neckBruise2.scale.set(1.1, .7, .25); neckBruise2.position.set(.020, .420, -.103); spine.add(neckBruise2);
  const chestBlood1 = new THREE.Mesh(new THREE.SphereGeometry(.032, 8, 8), bodyBloodM);
  chestBlood1.scale.set(1.15, 1.4, .22); chestBlood1.position.set(0, .375, -.107); spine.add(chestBlood1);
  const chestBlood2 = new THREE.Mesh(new THREE.SphereGeometry(.024, 8, 8), bodyBloodM);
  chestBlood2.scale.set(1.3, .9, .22); chestBlood2.position.set(-.032, .335, -.104); spine.add(chestBlood2);

  // 6. Объёмные лацканы и воротник-стойка куртки слева и справа от свитера
  const lapelMeshes = [];
  for (const s of [-1, 1]) {
    const lapel = new THREE.Mesh(new THREE.BoxGeometry(.058, .19, .022), lapelM);
    lapel.position.set(s * .068, .35, -.098);
    lapel.rotation.z = s * .24;
    lapel.rotation.y = -s * .18;
    spine.add(lapel);
    lapelMeshes.push(lapel);

    // Боковые стойки воротника убраны ниже уровня камеры, чтобы при взгляде вертикально вниз не торчала тёмная полоса (6365.png)
  }

  // 7. Центральная планка застёжки-молнии во всю высоту груди и живота + металлический бегунок
  const zipStrip = new THREE.Mesh(new THREE.BoxGeometry(.022, .35, .016), lapelM);
  zipStrip.position.set(0, .19, -.104);
  spine.add(zipStrip);

  const zipSlider = new THREE.Mesh(new THREE.BoxGeometry(.016, .026, .018), buckleM);
  zipSlider.position.set(0, .31, -.110);
  spine.add(zipSlider);

  // 8. Нагрудные карманы с клапанами и нижние боковые карманы куртки
  const chestStripes = [];
  for (const s of [-1, 1]) {
    const chestPoc = new THREE.Mesh(new THREE.BoxGeometry(.074, .082, .016), lapelM);
    chestPoc.position.set(s * .102, .275, -.096);
    chestPoc.rotation.y = -s * .20;
    spine.add(chestPoc);

    const chestFlap = new THREE.Mesh(new THREE.BoxGeometry(.078, .026, .020), jacketM);
    chestFlap.position.set(s * .102, .312, -.099);
    chestFlap.rotation.y = -s * .20;
    spine.add(chestFlap);

    const lowerPoc = new THREE.Mesh(new THREE.BoxGeometry(.078, .105, .018), lapelM);
    lowerPoc.position.set(s * .116, .115, -.088);
    lowerPoc.rotation.y = -s * .26;
    lowerPoc.rotation.z = s * .14;
    spine.add(lowerPoc);

    // Белые полосы для спортивной олимпийки («sport»)
    const st = new THREE.Mesh(new THREE.BoxGeometry(.082, .018, .019), stripeM);
    st.position.set(s * .102, .335, -.098);
    st.rotation.y = -s * .20;
    st.visible = false;
    spine.add(st);
    chestStripes.push(st);
  }

  // 9. Объёмные 3D-плечи и верхние части рукавов по бокам грудной клетки (видны боковым зрением при взгляде вниз)
  let shL, shR;
  for (const s of [1, -1]) {
    const sh = new THREE.Group();
    sh.position.set(-s * .215, .395, .018);
    spine.add(sh);

    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(.068, 16, 12), jacketM);
    shoulderCap.scale.set(1.05, .95, 1.05);
    sh.add(shoulderCap);

    const upperArmGeo = new THREE.CylinderGeometry(.062, .054, .26, 16);
    const upperArm = new THREE.Mesh(upperArmGeo, jacketM);
    upperArm.position.set(-s * .012, -.125, -.018);
    upperArm.rotation.z = s * .08;
    upperArm.rotation.x = -.12;
    sh.add(upperArm);

    if (s > 0) shL = sh;
    else       shR = sh;
  }

  // 10. Сглаженные анатомические ноги главного героя (бедро -> коленная чашечка -> голень -> манжета брюк -> зимний ботинок со шнуровкой)
  const thighLen = .44, shinLen = .40;
  let thL, knL, ftL, thR, knR, ftR;
  for (const side of [1, -1]) {
    const th = new THREE.Group();
    th.position.set(-side * .132, -.018, -.015);
    hips.add(th);

    // Сферический тазобедренный сустав внутри брюк таза, чтобы при любом подъёме ноги (даже на 95° вперёд) бедро оставалось на 100% слитным с телом (6465.png)!
    const hipCap = new THREE.Mesh(new THREE.SphereGeometry(.074, 16, 12), pantsM);
    hipCap.scale.set(1.02, 1.08, 1.12);
    hipCap.position.set(0, .012, 0);
    th.add(hipCap);

    const thighGeo = new THREE.CylinderGeometry(.071, .059, thighLen + .05, 20);
    thighGeo.scale(.98, 1, 1.08);
    const thighMesh = new THREE.Mesh(thighGeo, pantsM);
    thighMesh.position.set(0, -thighLen / 2 + .025, 0);
    th.add(thighMesh);

    const kn = new THREE.Group();
    kn.position.set(0, -thighLen, 0);
    th.add(kn);

    const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(.061, 16, 12), pantsM);
    kneeCap.scale.set(.96, .94, 1.06);
    kneeCap.position.set(0, 0, -.006);
    kn.add(kneeCap);

    const shinGeo = new THREE.CylinderGeometry(.058, .049, shinLen, 18);
    const shinMesh = new THREE.Mesh(shinGeo, pantsM);
    shinMesh.position.set(0, -shinLen / 2, 0);
    kn.add(shinMesh);

    const pantCuff = new THREE.Mesh(new THREE.CylinderGeometry(.053, .056, .058, 18), pantsM);
    pantCuff.position.set(0, -shinLen + .056, 0);
    kn.add(pantCuff);

    const ft = new THREE.Group();
    ft.position.set(0, -shinLen, 0);
    kn.add(ft);

    const bootAnkle = new THREE.Mesh(new THREE.CylinderGeometry(.047, .052, .098, 16), bootM);
    bootAnkle.position.set(0, .048, .005);
    ft.add(bootAnkle);

    const bootFoot = new THREE.Mesh(new THREE.CapsuleGeometry(.046, .148, 8, 16), bootM);
    bootFoot.rotation.x = Math.PI / 2;
    bootFoot.scale.set(1.14, 1, .84);
    bootFoot.position.set(0, .040, -.070);
    ft.add(bootFoot);

    const bootSole = new THREE.Mesh(new THREE.BoxGeometry(.108, .024, .270, 2, 1, 4), soleM);
    bootSole.position.set(0, .012, -.064);
    ft.add(bootSole);

    if (side > 0) { thL = th; knL = kn; ftL = ft; }
    else          { thR = th; knR = kn; ftR = ft; }
  }

  root.traverse(o => {
    if (o.isMesh) {
      o.frustumCulled = false;
      o.castShadow = false;
      o.receiveShadow = true;
    }
  });

  let kickT = 0, kickDur = .46, kickRun = 0, kickMode = 'combat', squatK = 0;
  function triggerKick(runBonus = 0, mode = 'combat') {
    kickMode = mode || 'combat';
    kickDur = kickMode === 'step' ? .26 : kickMode === 'ground' ? .38 : .46;
    kickT = kickDur;
    kickRun = Math.max(0, Math.min(1, runBonus || 0));
  }

  const bathSkinM = new THREE.MeshStandardMaterial({ color: 0xd8a284, emissive: 0x6a3a26, emissiveIntensity: .45, roughness: .7 });
  function update({ x, y, z, yaw, seatYaw = null, seatH = null, seatBack = null, stepPh = 0, spd = 0, run = false, crouch = false, seated = false, lying = false, outfit = 'default', bath = false, guitar = false, onStairs = false, stairDir = 1, dt = .016 }) {
    { const wantBath = outfit === 'bath';
      if (root.userData.bathOn !== wantBath) { root.userData.bathOn = wantBath;
        root.traverse(o => { if (!o.isMesh) return; if (wantBath) { if (o.material.transparent) return; o.userData.origMat = o.material; o.material = bathSkinM; } else if (o.userData.origMat) { o.material = o.userData.origMat; o.userData.origMat = null; } }); } }
    if (lying) {
      root.visible = false;
      return;
    }
    root.visible = true;
    if (typeof window !== 'undefined' && window.__larekPlayerDamage) {
      const b = Math.max(0, Math.min(1, window.__larekPlayerDamage.bruise || 0));
      bodyBruiseM.opacity = b * .88;
      bodyBloodM.opacity = Math.max(0, (b - .18) / .82) * .85;
    }
    const eq = (typeof window !== 'undefined' && window.__larekEquipped) || null;
    const eqSig = eq ? `${eq.top || ''}|${eq.legs || ''}|${eq.feet || ''}|${outfit}` : outfit;
    if (root.userData.lastOutfit !== eqSig) {
      root.userData.lastOutfit = eqSig;
      const topId = (eq && eq.top) || (outfit === 'sport' ? 'top_sport' : outfit === 'varenki' ? 'top_varenki' : outfit === 'raspberry' ? 'top_raspberry' : outfit === 'business' ? 'top_business' : 'top_kurtka');
      const legsId = (eq && eq.legs) || (outfit === 'sport' ? 'legs_sport' : outfit === 'varenki' ? 'legs_varenki' : outfit === 'raspberry' ? 'legs_slacks' : outfit === 'business' ? 'legs_business' : 'legs_watnik');
      const feetId = (eq && eq.feet) || (outfit === 'sport' ? 'feet_sneakers' : outfit === 'varenki' ? 'feet_kazaki' : 'feet_boots');
      const isSportTop = topId === 'top_sport';
      for (const st of chestStripes) st.visible = isSportTop;
      if (topId === 'top_raspberry') {
        jacketM.color.setHex(0x921b3b); lapelM.color.setHex(0x78142e); sweaterM.color.setHex(0x18181c);
      } else if (topId === 'top_sport') {
        jacketM.color.setHex(0x1d3578); lapelM.color.setHex(0xebe8e0); sweaterM.color.setHex(0x18264a);
      } else if (topId === 'top_varenki') {
        jacketM.color.setHex(0x46688e); lapelM.color.setHex(0x3a587a); sweaterM.color.setHex(0x3a342e);
      } else if (topId === 'top_business') {
        jacketM.color.setHex(0x2a2c32); lapelM.color.setHex(0x1e2026); sweaterM.color.setHex(0x3c3832);
      } else if (!eq || eq.top) {
        jacketM.color.setHex(0x2d3c4a); lapelM.color.setHex(0x23303c); sweaterM.color.setHex(0x463e36);
      } else {
        // Свитер без куртки
        jacketM.color.setHex(0x463e36); lapelM.color.setHex(0x3b352e); sweaterM.color.setHex(0x463e36);
      }
      if (legsId === 'legs_varenki') pantsM.color.setHex(0x4c6e98);
      else if (legsId === 'legs_sport') pantsM.color.setHex(0x1a2c62);
      else if (legsId === 'legs_slacks') pantsM.color.setHex(0x16161a);
      else if (legsId === 'legs_business') pantsM.color.setHex(0x24262c);
      else pantsM.color.setHex(0x222830);

      if (feetId === 'feet_sneakers') bootM.color.setHex(0xd0d4d8);
      else if (feetId === 'feet_kazaki') bootM.color.setHex(0x382014);
      else bootM.color.setHex(0x181615);
    }

    const bodyYaw = (seated && seatYaw !== null && seatYaw !== undefined) ? seatYaw : yaw;
    // Корпус всегда смещён назад за камеру (backDist = 0.33..0.35), чтобы при взгляде вниз, пинке или наступании на предметы грудь/плечи никогда не вылезали в кадр (6457.png)!
    // С гитарой в руках верх тела (куртка, плечи, свои рукава) не рисуем: гитару держат руки оверлея, а торс сверху выглядел тёмным «блином»;
    // в приседе с гитарой прячем и ноги — иначе колени пробивали гитару
    // с гитарой тело видно целиком: задняя дека прижата к животу, поэтому корпус стоит ближе к камере (живот ≈ под глазами, как у живого человека)
    spine.visible = true; hips.visible = true;
    const backDist = guitar ? (crouch ? .30 : .17) : seated ? (seatBack != null ? seatBack : .26) : run ? .34 : crouch ? .30 : .33;
    const fx = -Math.sin(bodyYaw), fz = -Math.cos(bodyYaw);
    root.position.set(x - fx * backDist, y, z - fz * backDist);
    root.rotation.set(0, bodyYaw, 0);

    if (kickT > 0) kickT = Math.max(0, kickT - dt);
    // 3-фазная биомеханика фронт-кика (прямого удара ногой): 1) вынос согнутого колена к груди (0..0.26), 2) мощный выброс стопы вперёд подошвой с подачей таза (0.26..0.62), 3) возврат ноги (0.62..1.0)
    let kickChamber = 0, kickExt = 0, kickEnv = 0;
    if (kickT > 0) {
      const ku = 1 - kickT / kickDur;
      if (ku < .26) {
        kickChamber = Math.sin((ku / .26) * (Math.PI * .5));
        kickEnv = kickChamber;
      } else if (ku < .62) {
        const eu = (ku - .26) / .36;
        kickExt = Math.sin(eu * Math.PI);
        kickChamber = 1 - kickExt * .35;
        kickEnv = 1;
      } else {
        const ru = (ku - .62) / .38;
        const rem = Math.cos(ru * (Math.PI * .5));
        kickChamber = rem * .65;
        kickExt = 0;
        kickEnv = rem;
      }
    }

    if (seated && bath) {
      // Сидим в ванне: таз низко, ноги вытянуты вперёд под водой, спина откинута
      hips.position.set(0, .20, -.02);
      spine.rotation.set(-.24, 0, 0);
      if (shL && shR) { shL.rotation.set(.3, 0, .1); shR.rotation.set(.3, 0, -.1); }
      thL.rotation.set(1.50, -.06, -.04); thR.rotation.set(1.50, .06, .04);
      knL.rotation.set(-.14, 0, 0); knR.rotation.set(-.14, 0, 0);
      ftL.rotation.set(.45, 0, 0); ftR.rotation.set(.45, 0, 0);
      return;
    }
    if (seated) {
      // В положении сидя таз приподнят над поверхностью сиденья (seatH), бёдра лежат поверх подушки,
      // а колени вынесены за передний край сиденья, чтобы ноги не проваливались в текстуры стула или кресла!
      let lookDiff = Math.atan2(Math.sin(yaw - bodyYaw), Math.cos(yaw - bodyYaw));
      const effSeatH = (seatH != null) ? seatH : .53;
      hips.position.set(0, effSeatH, .04);
      spine.rotation.set(-.06, Math.max(-.30, Math.min(.30, lookDiff * .25)), 0);
      if (shL && shR) {
        shL.rotation.set(.08, 0, 0);
        shR.rotation.set(.08, 0, 0);
      }
      thL.rotation.set(1.52, -.07, -.03);
      thR.rotation.set(1.52,  .07,  .03);
      knL.rotation.set(-1.46, 0, 0);
      knR.rotation.set(-1.46, 0, 0);
      ftL.rotation.set(-.06, 0, 0);
      ftR.rotation.set(-.06, 0, 0);
      return;
    }

    const moveK = Math.min(1, spd / (run ? 3.2 : 1.6));
    const p = stepPh * Math.PI;
    const sL = Math.sin(p) * moveK;
    const cL = Math.cos(p) * moveK;
    const amp = run ? .52 : crouch ? .34 : .38;

    // Присед — на корточки, «по-пацански»: таз почти у пяток, пятки на земле, колени широко разведены, корпус подан вперёд
    squatK += ((crouch ? 1 : 0) - squatK) * Math.min(1, dt * 9);
    const sq = squatK, deep = sq * (1 - moveK * .32);
    const bob = Math.abs(cL) * (run ? .024 : .014) * moveK;
    const isStepKick = kickMode === 'step';
    const isGroundKick = kickMode === 'ground';
    // При ударе ногой таз (hips) остаётся единым целым с бёдрами (thL и thR жёстко закреплены в тазобедренных суставах и НИКОГДА не отсоединяются от тела — 6465.png!),
    // а верхняя часть туловища (spine) при ударе отклоняется назад за камеру, чтобы грудь никогда не перекрывала обзор (6457.png)!
    // Высота таза .945 м гарантирует, что подошвы ботинок находятся строго НА полу (+0.05..+0.08 м) и никогда не проваливаются сквозь пол/ковёр/ступени!
    const kPelvisFwd = isStepKick ? 0 : (kickEnv * .10 + kickExt * .04);
    const kPelvisUp  = isStepKick ? 0 : (kickEnv * .06);
    hips.position.set(0, .945 - deep * .46 + bob + kPelvisUp, -.08 - deep * .16 - kPelvisFwd);
    spine.position.set(0, .04, isStepKick ? 0 : (kickEnv * .13 + kickExt * .05));
    spine.rotation.set((run ? .08 : .04) + deep * .18 - (isStepKick ? 0 : (kickEnv * .42 + kickExt * .14)), -sL * .05 + (isStepKick ? 0 : kickExt * .06), 0);
    if (shL && shR) {
      shL.rotation.set(-sL * .22 * (1 - sq) - deep * .95, 0, deep * .16);
      shR.rotation.set( sL * .22 * (1 - sq) - deep * .95, 0, -deep * .16);
    }

    const baseThigh = (run ? .10 : 0) + deep * 1.72;
    const baseKnee  = -deep * 2.22;
    const splay = deep * (guitar ? .95 : .52); // в приседе с гитарой колени разведены — корпус гитары лежит между ними, а не «пробивается» коленями

    // Оба бедра ВСЕГДА жёстко сидят в тазобедренных суставах таза (никакого отрыва ноги от тела!)
    thL.position.set(-.132, -.018, -.015);
    thR.position.set( .132, -.018, -.015);
    if (isStepKick) {
      thR.scale.set(1, 1, 1);
      const stepKickA = Math.sin((1 - (kickT / kickDur)) * Math.PI);
      thL.rotation.set(baseThigh + sL * amp * (1 - sq * .55), -splay, -splay * .55);
      thR.rotation.set(baseThigh - sL * amp * (1 - sq * .55) + stepKickA * .42, splay, splay * .55);
      const knBendL = Math.max(0, -cL) * amp * (run ? 1.38 : 1.15) + (sL > 0 ? sL * .14 : .04 * moveK);
      const knBendR = Math.max(0,  cL) * amp * (run ? 1.38 : 1.15) + (-sL > 0 ? -sL * .14 : .04 * moveK);
      knL.rotation.set(baseKnee - knBendL, 0, 0);
      knR.rotation.set((baseKnee - knBendR) * (1 - stepKickA * .6), 0, 0);
      ftL.rotation.set(-sL * .18 + deep * .5, 0, 0);
      ftR.rotation.set( sL * .18 + deep * .5 - stepKickA * .18, 0, 0);
    } else {
      // Лёгкое продольное вытяжение вдоль оси самой ноги при выбросе (основание бедра на 100% остаётся внутри таза!)
      thR.scale.set(1, 1 + kickEnv * .14 + kickExt * .08, 1);
      thL.rotation.set((baseThigh + sL * amp * (1 - sq * .55)) * (1 - kickEnv * .65) - kickEnv * .10, -splay, -splay * .55);
      const kickThighAngle = isGroundKick ? (kickChamber * 1.24 + kickExt * (.48 + kickRun * .08)) : (kickChamber * 1.56 + kickExt * (.74 + kickRun * .10));
      thR.rotation.set((baseThigh - sL * amp * (1 - sq * .55)) * (1 - kickEnv) + kickThighAngle, splay * (1 - kickEnv) + kickEnv * .04, splay * .55 * (1 - kickEnv));

      const knBendL = Math.max(0, -cL) * amp * (run ? 1.38 : 1.15) + (sL > 0 ? sL * .14 : .04 * moveK);
      const knBendR = Math.max(0,  cL) * amp * (run ? 1.38 : 1.15) + (-sL > 0 ? -sL * .14 : .04 * moveK);
      knL.rotation.set((baseKnee - knBendL) * (1 - kickEnv * .5), 0, 0);
      const kickKneeAngle = -kickChamber * 1.38 * (1 - kickExt * .95) - kickExt * .05;
      knR.rotation.set((baseKnee - knBendR) * (1 - kickEnv) + kickKneeAngle, 0, 0);

      ftL.rotation.set(-sL * .10 + deep * .46, 0, 0);
      ftR.rotation.set((sL * .10 + deep * .46) * (1 - kickEnv) + kickChamber * .22 - kickExt * .44, 0, 0);
    }
    // Защита от проваливания ботинок в пол/ковёр/ступени при любом наклоне бедра и голени:
    const calcFootMinY = (th, kn, ft) => {
      const a1 = th.rotation.x, a2 = a1 + kn.rotation.x, a3 = a2 + ft.rotation.x;
      const ankY = hips.position.y - .018 - Math.cos(a1) * thighLen * (th.scale.y || 1) - Math.cos(a2) * shinLen;
      const toeY = ankY + Math.sin(a3) * (-.19);
      const heelY = ankY + Math.sin(a3) * (.07);
      return Math.min(ankY, toeY, heelY);
    };
    // Если игрок поднимается или спускается по лестничному маршу подъезда (onStairs),
    // чётко переставляем левую и правую ногу по ступенькам (подъём колена +0.52 рад, фиксация опорной стопы на ступеньке):
    if (onStairs && moveK > .05 && kickT <= 0) {
      const stL = Math.max(0, sL), stR = Math.max(0, -sL);
      const climbSign = stairDir >= 0 ? 1 : .65;
      thL.rotation.x += stL * .48 * climbSign;
      knL.rotation.x -= stL * .62 * climbSign;
      ftL.rotation.x += stL * .18;
      thR.rotation.x += stR * .48 * climbSign;
      knR.rotation.x -= stR * .62 * climbSign;
      ftR.rotation.x += stR * .18;
      hips.position.y += Math.abs(sL) * .045;
    }
    const minFootY = Math.min(calcFootMinY(thL, knL, ftL), calcFootMinY(thR, knR, ftR));
    if (minFootY < .052) {
      hips.position.y += (.052 - minFootY);
    }
  }

  return { root, hips, spine, thL, knL, ftL, thR, knR, ftR, update, triggerKick };
}

export function makeCigarette(std) {
  const g = new THREE.Group();
  const filterTex = (() => { const c = document.createElement('canvas'); c.width = 32; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#c87638'; x.fillRect(0, 0, 32, 64);
    for (let i = 0; i < 140; i++) { x.fillStyle = Math.random() < .5 ? 'rgba(140,72,26,.45)' : 'rgba(235,165,98,.45)'; x.fillRect(Math.random() * 32, Math.random() * 64, 1.5, 1.5); }
    x.fillStyle = '#dfc278'; x.fillRect(0, 0, 32, 3); const t = new THREE.CanvasTexture(x.canvas); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const R = .0054, FL = .035, PL = .082;
  const filter = new THREE.Mesh(new THREE.CylinderGeometry(R, R, FL, 14), std({ map: filterTex, roughness: .78 })); filter.position.y = -FL / 2; g.add(filter);
  const paperM = std({ color: 0xdad5ca, roughness: .82 }); const paper = new THREE.Mesh(new THREE.CylinderGeometry(R, R, PL, 14), paperM); paper.position.y = PL / 2; g.add(paper);
  const charM = std({ color: 0x2b1d14, roughness: .92 });
  const charRing = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.005, R * 1.005, .0024, 14), charM); g.add(charRing);
  const emberM = new THREE.MeshStandardMaterial({ color: 0x4a2218, emissive: 0xff4510, emissiveIntensity: 0, roughness: .85 });
  const ember = new THREE.Mesh(new THREE.CylinderGeometry(R * .97, R * .92, .0036, 14), emberM); g.add(ember);
  const ash = new THREE.Mesh(new THREE.CylinderGeometry(R * .93, R * .86, .001, 12), std({ color: 0x7c7a76, roughness: .95 })); g.add(ash);
  const tipNode = new THREE.Object3D(); g.add(tipNode);
  g.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  g.userData = { paper, charRing, ember, emberM, ash, tipNode, PL, FL,
    setBurn(burn, ashLen, glow) {
      const b = Math.max(0, Math.min(1, burn));
      const len = PL * (.07 + .93 * b);
      paper.scale.y = len / PL; paper.position.y = len / 2;
      charRing.position.y = Math.max(.0012, len - .0008);
      ember.position.y = len + .0016; emberM.emissiveIntensity = glow;
      const aLen = Math.max(.0018, ashLen);
      ash.visible = aLen > .0005; ash.scale.y = aLen / .001; ash.position.y = len + .0028 + aLen / 2;
      tipNode.position.set(0, len + .003 + aLen, 0);
    },
    filterEnd: new THREE.Vector3(0, -FL, 0) };
  g.userData.setBurn(1, .002, 0);
  return g;
}
