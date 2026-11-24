// Процедурные люди 90-х: скелет из шарниров, разнообразная внешность, позы со смешиванием, мимика.
import * as THREE from 'three';

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sstep = (a, b, x) => { const t = clamp((x - a) / ((b - a) || 1e-6), 0, 1); return t * t * (3 - 2 * t); };

// ---------- общие ресурсы ----------
const matCache = new Map();
function mat(color, rough = .85, metal = 0, extra) {
  const k = color + '|' + rough + '|' + metal + (extra ? JSON.stringify(extra) : '');
  let m = matCache.get(k); if (!m) { m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal }, extra || {})); matCache.set(k, m); }
  return m;
}
const G = {
  cap: (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10),
  sph: new THREE.SphereGeometry(1, 16, 12),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
  cone: new THREE.CylinderGeometry(.7, 1, 1, 16, 1, true),
  half: new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * .5),
  torus: new THREE.TorusGeometry(1, .28, 8, 18),
};
const capCache = new Map();
const capG = (r, l) => { const k = r.toFixed(3) + '_' + l.toFixed(3); let g = capCache.get(k); if (!g) { g = G.cap(r, l); capCache.set(k, g); } return g; };
function part(geo, m, sx = 1, sy = 1, sz = 1, x = 0, y = 0, z = 0, parent, shadow = false) {
  const o = new THREE.Mesh(geo, m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); o.castShadow = shadow; parent.add(o); return o;
}
function pivot(parent, x, y, z) { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; }
function bonePivot(parent, x, y, z) { const b = new THREE.Bone(); b.position.set(x, y, z); parent.add(b); return b; }

// стипы ткани: полоски «Адидас» на спортивных костюмах
const stripeTex = (() => { const c = document.createElement('canvas'); c.width = 16; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 16, 64); const t = new THREE.CanvasTexture(c); return t; })();

// ---------- палитры эпохи ----------
const SKIN = ['#e8bfa0', '#d9a888', '#cf9c7c', '#e2b494', '#c99272'];
const HAIR = ['#2a1d14', '#3b2a1c', '#4e3826', '#1a1612', '#6b5236', '#8a6b48'];
const GRAY = ['#9a958e', '#b8b3ab', '#d0ccc4', '#7d7870'];
const DARK_COATS = ['#1B2A4A', '#4E3D36', '#2c353d', '#3B2314', '#26303a', '#423630'];
const BOLONYA = ['#1B2A4A', '#6B1D24', '#52665A', '#7a6348', '#2448a8', '#4E3D36'];
const OLD_COATS = ['#4E3D36', '#52665A', '#6B1D24', '#856d52', '#3B2314', '#5c493e'];
const SCARF = ['#6B1D24', '#7B2CBF', '#52665A', '#D97724', '#A68966', '#E8D8C3'];
const HATS = ['#1B2A4A', '#4E3D36', '#6B1D24', '#3B2314', '#52665A', '#7D8488'];
// Олимпийки 1992 года: приглушённые на 12% акцентные тона Палитры № 2 (фуксия, синий электрик, фиолетовый, алый) для гармонии с PS2-стилистикой
const TRACK = [['#184bd9', '#FFE600'], ['#6B28A8', '#FF1E8E'], ['#c81e74', '#E8D8C3'], ['#1B2A4A', '#E61919'], ['#52665A', '#FFE600']];

// ---------- генерация внешности ----------
export function makeLook(kind) {
  const L = { kind };
  const male = kind !== 'babka' && kind !== 'neighbor' && kind !== 'dedushka' ? (!(kind === 'vendor' && Math.random() < .45) && !(kind === 'school' && Math.random() < .45)) : (kind === 'dedushka');
  L.male = male;
  L.age = { worker: rnd(30, 55), dedushka: rnd(68, 80), babka: rnd(65, 78), neighbor: rnd(50, 70), youth: rnd(17, 25), school: rnd(10, 14), gopnik: rnd(18, 30), vendor: rnd(35, 60), police: rnd(28, 50), newrus: rnd(28, 45), racket: rnd(22, 35), chelnok: rnd(30, 50) }[kind] || rnd(25, 50);
  L.height = kind === 'school' ? rnd(1.30, 1.45) : (male ? rnd(1.68, 1.88) : rnd(1.52, 1.66)) * (kind === 'dedushka' ? .92 : L.age > 60 ? .95 : 1);
  L.build = { worker: rnd(1, 1.2), gopnik: rnd(1.05, 1.25), youth: rnd(.85, 1.05), school: rnd(.8, .95), babka: rnd(.9, 1.15), vendor: rnd(1, 1.25), newrus: rnd(1.1, 1.35), racket: rnd(1.1, 1.3), police: rnd(1, 1.15), neighbor: rnd(1, 1.2), chelnok: rnd(1, 1.2) }[kind] || 1;
  L.stoop = L.age > 55 ? rnd(.12, .25) : kind === 'worker' ? rnd(.03, .1) : kind === 'gopnik' ? rnd(.04, .1) : rnd(0, .05);
  L.skin = pick(SKIN); L.headScale = rnd(.95, 1.08); L.jaw = rnd(.9, 1.12);
  L.hair = L.age > 55 ? pick(GRAY) : pick(HAIR);
  L.hairStyle = male ? (kind === 'gopnik' || kind === 'racket' ? pick(['buzz', 'buzz', 'bald']) : pick(['short', 'short', 'buzz', 'side'])) : pick(['bun', 'short', 'perm']);
  L.facial = male && L.age > 20 ? pick(['none', 'stubble', 'stubble', 'mustache', kind === 'worker' ? 'mustache' : 'none']) : 'none';
  L.gloves = Math.random() < .5 ? pick(['#2a2a2a', '#4a3a2a', '#6a2a2a']) : null;
  L.scarf = Math.random() < (kind === 'babka' ? .8 : .45) ? pick(SCARF) : null;
  L.bag = null; L.stripes = null;
  switch (kind) {
    case 'dedushka':
      L.top = pick(['#3a3228', '#42382e', '#2c2822', '#4a4034']); L.coat = true; L.pants = '#282522';
      L.boots = '#1c1a18'; L.hat = pick(['ushanka', 'ushanka', 'kepka']); L.hatC = pick(['#4a3a2a', '#2b2b2b', '#3d3024']);
      L.hair = pick(GRAY); L.facial = pick(['beard', 'mustache']); L.cane = true; L.stoop = rnd(.22, .34); break;
    case 'babka': case 'neighbor':
      L.top = pick(OLD_COATS); L.coat = true; L.pants = '#2a2622'; L.boots = pick(['#2a1f18', '#1c1a18']);
      L.hat = kind === 'babka' ? 'platok' : pick(['beret', 'shapka']); L.hatC = L.hat === 'platok' ? pick(['#7a2a2a', '#5a4a6a', '#8a7a5a', '#3a4a6a']) : pick(HATS);
      L.bag = 'avoska'; L.stoop = rnd(.18, .30); break;
    case 'worker': case 'chelnok':
      L.top = Math.random() < .5 ? pick(BOLONYA) : pick(DARK_COATS); L.puffy = Math.random() < .5; L.pants = pick(['#22252a', '#2d2a26', '#33302b']);
      L.boots = pick(['#1c1a18', '#2a1f18']); L.hat = pick(['shapka', 'shapka', 'ushanka', 'kepka', 'none']); L.hatC = pick(HATS);
      if (kind === 'chelnok') L.bag = 'kletchataya'; break;
    case 'youth': case 'school': {
      const sporty = Math.random() < .5;
      if (sporty) { const [c, s] = pick(TRACK); L.top = c; L.stripes = s; L.pants = c; } else { L.top = pick(['#151515', '#2a1d16', ...BOLONYA]); L.leather = L.top === '#151515' || L.top === '#2a1d16'; L.pants = pick(['#5d7ea8', '#4a6a94', '#3b4f70']); }
      L.boots = pick(['#1a1a1a', '#e0e0e0', '#2a2a2a']); L.hat = pick(['shapka', 'none', 'kepka', 'none']); L.hatC = pick(HATS);
      if (kind === 'school') L.bag = 'ranec'; break;
    }
    case 'gopnik': case 'racket': {
      const [c, s] = pick(TRACK);
      if (Math.random() < .55) { L.top = c; L.stripes = s; L.pants = c; } else { L.top = pick(['#121212', '#1b1b1d', '#222']); L.leather = true; L.puffy = !L.leather; L.pants = Math.random() < .6 ? c : '#1d1d20'; L.stripes = L.pants === c ? s : null; L.legStripes = !!L.stripes; L.stripes = null; }
      if (L.stripes) L.legStripes = true;
      L.boots = pick(['#111', '#1a1a1a', '#e8e8e8']); L.hat = pick(['kepka', 'shapka', 'none', 'none']); L.hatC = pick(['#111', '#1a1a2a', '#2a2a2a']);
      L.facial = pick(['none', 'stubble']); if (kind === 'racket') { L.chain = true; L.hat = 'none'; } break;
    }
    case 'vendor':
      L.top = pick(['#5a4a3a', '#3a4a3a', '#6a5a4a', '#4a3a3a']); L.apron = pick(['#c8c0b0', '#8a9aa8', '#b06a5a']); L.pants = '#2a2622'; L.boots = '#1c1a18';
      L.hat = pick(['shapka', 'platok', 'ushanka']); L.hatC = L.hat === 'platok' ? '#7a3a3a' : pick(HATS); L.puffy = true; break;
    case 'police':
      L.top = '#5c727c'; L.pants = '#3c4d56'; L.boots = '#111'; L.hat = 'zimnyaya'; L.hatC = '#4a5860'; L.facial = pick(['none', 'mustache']); L.puffy = true; break;
    case 'newrus':
      L.top = '#b81d48'; L.pants = '#0D131A'; L.boots = '#111'; L.hat = 'none'; L.chain = true; L.hairStyle = 'buzz'; break;
    default:
      L.top = pick(DARK_COATS); L.pants = '#2a2a2a'; L.boots = '#1c1a18'; L.hat = 'shapka'; L.hatC = pick(HATS);
  }
  // характер
  L.walkSpeed = { dedushka: rnd(.65, .82), babka: rnd(.72, .90), neighbor: rnd(.8, 1), school: rnd(1.35, 1.6), youth: rnd(1.2, 1.4), gopnik: rnd(1.05, 1.25) }[kind] || rnd(1.05, 1.3);
  L.aggression = kind === 'gopnik' || kind === 'racket' ? rnd(.35, 1) : kind === 'youth' ? rnd(0, .45) : rnd(0, .15);
  L.nerve = kind === 'gopnik' ? rnd(.2, .9) : rnd(0, .4); // смелость против угроз
  L.swagger = kind === 'gopnik' || kind === 'racket' ? rnd(.5, 1) : kind === 'youth' ? rnd(0, .5) : 0;
  return L;
}

// ---------- построение тела ----------
function addNpcDamageMeshes(R, headR = .115, isStatic = false) {
  if (!R || !R.head) return;
  const dmgGrp = new THREE.Group();
  // Для статических/SDS моделей голова привязана к шее (y = 0..0.24, лицо на z ~ +0.10)
  const yOff = isStatic ? .115 : 0;
  const zFace = isStatic ? .108 : headR * .90;
  dmgGrp.position.set(0, yOff, 0);
  R.head.add(dmgGrp);

  const bruiseMat = new THREE.MeshStandardMaterial({ color: 0x3b1844, emissive: 0x180620, emissiveIntensity: .25, roughness: .78, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const hematomaMat = new THREE.MeshStandardMaterial({ color: 0x5c1428, emissive: 0x22040c, emissiveIntensity: .25, roughness: .72, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const bloodMat = new THREE.MeshStandardMaterial({ color: 0x940c0c, emissive: 0x380404, emissiveIntensity: .32, roughness: .38, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });

  // Синяки («фонари») под глазами и на скулах
  const eyeBruiseL = part(G.sph, bruiseMat, .024, .016, .012,  .034,  .010, zFace, dmgGrp);
  const eyeBruiseR = part(G.sph, bruiseMat, .025, .017, .012, -.034,  .008, zFace, dmgGrp);
  const cheekL     = part(G.sph, hematomaMat, .028, .022, .014,  .046, -.018, zFace - .012, dmgGrp);
  const cheekR     = part(G.sph, hematomaMat, .028, .022, .014, -.046, -.020, zFace - .012, dmgGrp);
  const browCut    = part(G.box, bloodMat, .026, .007, .010, -.032, .042, zFace + .002, dmgGrp);
  // Кровь из разбитого носа и у рта/на подбородке
  const noseBlood  = part(G.box, bloodMat, .014, .032, .012, 0, -.024, zFace + .008, dmgGrp);
  const mouthBlood = part(G.sph, bloodMat, .032, .018, .012, .006, -.048, zFace + .002, dmgGrp);
  const chinBlood  = part(G.sph, bloodMat, .022, .024, .012, -.008, -.068, zFace - .006, dmgGrp);

  // Сбитые в кровь костяшки на кулаках НПС
  const handBloodMeshes = [];
  for (const el of [R.elL, R.elR]) {
    if (!el) continue;
    const hb = part(G.sph, bloodMat, .032, .024, .028, 0, -.26, .022, el);
    handBloodMeshes.push(hb);
  }

  dmgGrp.visible = false;
  R.damage = {
    grp: dmgGrp,
    bruiseMat,
    hematomaMat,
    bloodMat,
    handBloodMeshes,
    setLevel(dmgK) {
      const k = clamp(dmgK, 0, 1);
      const vis = k > .03;
      dmgGrp.visible = vis;
      for (const hm of handBloodMeshes) hm.visible = vis;
      if (!vis) return;
      bruiseMat.opacity = clamp(k * 1.15, 0, .92);
      hematomaMat.opacity = clamp((k - .08) * 1.15, 0, .90);
      bloodMat.opacity = clamp((k - .15) * 1.25, 0, .96);
    }
  };
}

export function buildHuman(L, staticModel) {
  const H = L.height, b = L.build;
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  const legLen = H * .47, torsoLen = H * .29, headR = H * .067 * L.headScale;
  const hipW = .09 * b + (L.male ? 0 : .015), shW = .19 * b + (L.male ? .02 : 0);
  const topM = L.leather ? mat(L.top, .38, .1) : L.puffy ? mat(L.top, .55, .05) : mat(L.top, .88);
  const pantsM = mat(L.pants, L.pants.startsWith('#5') || L.pants.startsWith('#4a6') || L.pants.startsWith('#3b4f') ? .9 : .82);
  const skinM = mat(L.skin, .7), bootM = mat(L.boots, .45, .05), hairM = mat(L.hair, .95);
  const R = { root, body, L };

  if (staticModel) {
    // Персонаж из 3D-модели: если есть единая скин-геометрия (P.skinnedGeo), используем плавный GPU SkinnedMesh
    // без разрезания одежды на отдельные куски (одежда никогда не рвётся и не распадается на стыках!).
    const P = staticModel, C = P.cfg, s = H / C.height;
    root.userData.static = true;
    const tint = new THREE.Color().setRGB(rnd(.94, 1.02), rnd(.92, 1.00), rnd(.90, .98));
    const sm = P.map
      ? new THREE.MeshStandardMaterial({ map: P.map, vertexColors: true, color: tint, emissive: new THREE.Color(0x1e1814), emissiveMap: P.map, emissiveIntensity: .10, roughness: .78, metalness: .02, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ vertexColors: true, emissive: new THREE.Color(0x221b16), emissiveIntensity: .14, roughness: .80, color: tint, side: THREE.DoubleSide });
    R.skinMat = sm;
    const nZ = (C.neckZ || 0) * s, sZ = (C.shZ || 0) * s, lZ = (C.legZ || 0) * s, kZ = (C.kneeZ || 0) * s;

    if (P.skinnedGeo) {
      const hips = bonePivot(body, 0, C.hipY * s, 0); R.hips = hips;
      const spine = bonePivot(hips, 0, 0, 0); R.spine = spine;
      R.neck = bonePivot(spine, 0, (C.neckY - C.hipY) * s, nZ);
      R.head = bonePivot(R.neck, 0, 0, 0);
      R.shL = bonePivot(spine, C.shX * s, (C.shY - C.hipY) * s, sZ);
      R.shR = bonePivot(spine, -C.shX * s, (C.shY - C.hipY) * s, sZ);
      const eL = P.elbL || [0, -.3, 0], eR = P.elbR || [0, -.3, 0];
      R.elL = bonePivot(R.shL, eL[0] * s, eL[1] * s, (eL[2] || 0) * s);
      R.elR = bonePivot(R.shR, eR[0] * s, eR[1] * s, (eR[2] || 0) * s);
      R.thL = bonePivot(hips, C.legX * s, 0, lZ);
      R.thR = bonePivot(hips, -C.legX * s, 0, lZ);
      const kOff = (P.kneeOff !== undefined ? P.kneeOff : -.45) * s;
      R.knL = bonePivot(R.thL, 0, kOff, kZ);
      R.knR = bonePivot(R.thR, 0, kOff, kZ);
      if (P.sds) R.sds = true;

      const smMesh = new THREE.SkinnedMesh(P.skinnedGeo, sm);
      smMesh.scale.set(s, s, s);
      smMesh.castShadow = true;
      smMesh.receiveShadow = true;
      smMesh.frustumCulled = false;
      body.add(smMesh);

      const bones = [R.spine, R.head, R.shL, R.elL, R.shR, R.elR, R.thL, R.knL, R.thR, R.knR];
      root.updateMatrixWorld(true);
      const skel = new THREE.Skeleton(bones);
      smMesh.bind(skel, smMesh.matrixWorld);
      R.skinnedMesh = smMesh;
      if (P.hatGeo) {
        const hatGrp = new THREE.Group();
        const hatMesh = new THREE.Mesh(P.hatGeo, sm);
        hatMesh.scale.set(s, s, s);
        hatMesh.castShadow = true;
        hatMesh.receiveShadow = true;
        hatGrp.add(hatMesh);
        R.head.add(hatGrp);
        R.hatGroup = hatGrp;
        R.hatKind = 'sds_hat';
      }
      R.face = null; R.legLen = C.hipY * s; R.stride = .68 * s * (C.hipY / .95);
      R.rigidArms = !!C.posedArms;
      addNpcDamageMeshes(R, headR, true);
      return R;
    }

    const hips = pivot(body, 0, C.hipY * s, 0); R.hips = hips;
    const spine = pivot(hips, 0, 0, 0); R.spine = spine;
    part(P.torso, sm, s, s, s, 0, -C.hipY * s, 0, spine, true);
    R.neck = pivot(spine, 0, (C.neckY - C.hipY) * s, nZ); R.head = pivot(R.neck, 0, 0, 0); part(P.head, sm, s, s, s, 0, 0, 0, R.head, true);
    R.shL = pivot(spine, C.shX * s, (C.shY - C.hipY) * s, sZ); R.shR = pivot(spine, -C.shX * s, (C.shY - C.hipY) * s, sZ);
    part(P.armL, sm, s, s, s, 0, 0, 0, R.shL, true); part(P.armR, sm, s, s, s, 0, 0, 0, R.shR, true);
    R.elL = pivot(R.shL, 0, -.3 * s, 0); R.elR = pivot(R.shR, 0, -.3 * s, 0);
    R.thL = pivot(hips, C.legX * s, 0, 0); R.thR = pivot(hips, -C.legX * s, 0, 0);
    part(P.legL, sm, s, s, s, 0, 0, 0, R.thL, true); part(P.legR, sm, s, s, s, 0, 0, 0, R.thR, true);
    if (P.sds) {
      R.sds = true;
      R.elL.position.set(P.elbL[0] * s, P.elbL[1] * s, 0); R.elR.position.set(P.elbR[0] * s, P.elbR[1] * s, 0);
      part(P.foreL, sm, s, s, s, 0, 0, 0, R.elL, true); part(P.foreR, sm, s, s, s, 0, 0, 0, R.elR, true);
      R.knL = pivot(R.thL, 0, P.kneeOff * s, 0); R.knR = pivot(R.thR, 0, P.kneeOff * s, 0);
      part(P.shinL, sm, s, s, s, 0, 0, 0, R.knL, true); part(P.shinR, sm, s, s, s, 0, 0, 0, R.knR, true);
    } else { R.knL = pivot(R.thL, 0, -.45 * s, 0); R.knR = pivot(R.thR, 0, -.45 * s, 0); }
    R.face = null; R.legLen = C.hipY * s; R.stride = .68 * s * (C.hipY / .95);
    R.rigidArms = !!C.posedArms;
    addNpcDamageMeshes(R, headR, true);
    return R;
  }

  const hips = pivot(body, 0, legLen, 0); R.hips = hips;
  const spine = pivot(hips, 0, .02, 0); R.spine = spine;
  // ноги
  const thighL = legLen * .5, shinL = legLen * .5, legR = .062 * b;
  for (const side of [1, -1]) {
    const th = pivot(hips, side * hipW, 0, 0);
    part(capG(legR, thighL - legR * 2), pantsM, 1, 1, 1, 0, -thighL / 2, 0, th, true);
    const kn = pivot(th, 0, -thighL, 0);
    part(capG(legR * .82, shinL - legR * 2), pantsM, 1, 1, 1, 0, -shinL / 2, 0, kn, true);
    if (L.legStripes) part(G.box, mat(L.stripes || '#fff', .8), .012, legLen * .9, .02, side * legR * .95, -legLen * .2, 0, th);
    const ft = part(G.box, bootM, .11 * Math.min(b, 1.1), .1, .26, 0, -shinL + .02, .05, kn, true);
    if (side > 0) { R.thL = th; R.knL = kn; R.ftL = ft; } else { R.thR = th; R.knR = kn; R.ftR = ft; }
  }
  // длинное пальто: без отдельного жёсткого конуса R.skirt, чтобы подол не отрывался от ног при ходьбе и сидении
  // туловище
  const puff = L.puffy ? 1.12 : 1;
  const torso = part(capG(.16 * b * puff, torsoLen * .62), topM, (shW / .16 / b) * .82, 1, .72, 0, torsoLen * .5, 0, spine, true);
  torso.scale.x = (shW + .02) / (.16 * b * puff); R.torso = torso;
  if (L.apron) part(G.box, mat(L.apron, .9), shW * 1.5, torsoLen * 1.1, .02, 0, torsoLen * .25, .13 * b, spine);
  if (L.stripes) for (const s of [1, -1]) part(G.box, mat(L.stripes, .8), .02, torsoLen * .5, .02, s * .06, torsoLen * .62, .12 * b * puff, spine);
  if (L.leather) part(G.box, mat('#0c0c0c', .3), .16 * b, .06, .05, 0, torsoLen * .95, .1 * b, spine); // воротник
  if (L.chain) { const c = part(G.torus, mat('#d4a72c', .25, .9), .085, .085, .085, 0, torsoLen * .92, .07, spine); c.rotation.x = Math.PI / 2.3; }
  if (L.scarf) { const sc = part(G.torus, mat(L.scarf, .95), .075 * b, .075 * b, .1, 0, torsoLen + .02, 0, spine); sc.rotation.x = Math.PI / 2; part(G.box, mat(L.scarf, .95), .06, .22, .03, .04, torsoLen * .8, .1 * b, spine); }
  if (L.kind === 'police') { part(G.box, mat('#c9a227', .4, .7), .03, .03, .01, .08, torsoLen * .8, .13 * b, spine); }
  // руки
  const upA = H * .17, foA = H * .16, armR = .05 * b * puff;
  for (const side of [1, -1]) {
    const sh = pivot(spine, side * (shW + .01), torsoLen * .92, 0);
    part(capG(armR, upA - armR * 2), topM, 1, 1, 1, 0, -upA / 2, 0, sh, true);
    if (L.stripes) part(G.box, mat(L.stripes, .8), .012, upA * .9, .015, side * armR * .95, -upA / 2, 0, sh);
    const el = pivot(sh, 0, -upA, 0);
    part(capG(armR * .85, foA - armR * 1.8), topM, 1, 1, 1, 0, -foA / 2, 0, el, true);
    const hand = part(G.sph, L.gloves ? mat(L.gloves, .8) : skinM, .045, .06, .03, 0, -foA - .02, 0, el);
    if (side > 0) { R.shL = sh; R.elL = el; R.handL = hand; } else { R.shR = sh; R.elR = el; R.handR = hand; }
  }
  // сумки
  if (L.bag === 'avoska') { const a = part(G.sph, mat('#6b8f4f', .9, 0, { wireframe: true }), .12, .14, .08, 0, -foA - .16, .02, R.elR); R.bag = a; }
  if (L.bag === 'sumka') part(G.box, mat('#3a2a20', .5), .22, .18, .08, 0, -foA - .12, 0, R.elR, true);
  if (L.bag === 'kletchataya') { const t = new THREE.MeshStandardMaterial({ map: checkerTex(), roughness: .8 }); part(G.box, t, .55, .42, .28, 0, -foA - .2, .05, R.elR, true); }
  if (L.bag === 'ranec') part(G.box, mat('#7a3a2a', .7), .28, .32, .14, 0, torsoLen * .5, -.16 * b, spine, true);
  // шея и голова
  R.neck = pivot(spine, 0, torsoLen + .02, 0);
  part(G.cyl, skinM, .045, .08, .045, 0, .04, 0, R.neck);
  const head = pivot(R.neck, 0, .08 + headR, 0); R.head = head;
  part(G.sph, skinM, headR * .92, headR * 1.08, headR * .98, 0, 0, 0, head, true);
  part(G.sph, skinM, headR * .75 * L.jaw, headR * .55, headR * .8, 0, -headR * .45, .01, head); // челюсть
  part(G.sph, skinM, headR * .18, headR * .28, headR * .14, headR * .93, 0, 0, head); part(G.sph, skinM, headR * .18, headR * .28, headR * .14, -headR * .93, 0, 0, head); // уши
  part(G.box, skinM, headR * .22, headR * .42, headR * .3, 0, -headR * .05, headR * .95, head); // нос
  // лицо
  const eyeM = mat('#141414', .4), F = {};
  F.eyeL = part(G.sph, eyeM, headR * .1, headR * .08, headR * .05, headR * .34, headR * .17, headR * .86, head);
  F.eyeR = part(G.sph, eyeM, headR * .1, headR * .08, headR * .05, -headR * .34, headR * .17, headR * .86, head);
  const browM = mat(L.age > 55 ? '#8a857e' : L.hair, .95);
  F.browL = part(G.box, browM, headR * .34, headR * .07, headR * .06, headR * .34, headR * .36, headR * .87, head);
  F.browR = part(G.box, browM, headR * .34, headR * .07, headR * .06, -headR * .34, headR * .36, headR * .87, head);
  F.mouth = part(G.box, mat('#6a3a32', .6), headR * .4, headR * .07, headR * .05, 0, -headR * .42, headR * .86, head);
  if (L.age > 50) for (const s of [1, -1]) part(G.box, mat('#b98f75', .8), headR * .02, headR * .25, headR * .02, s * headR * .32, -headR * .25, headR * .88, head); // морщины-складки
  if (L.facial === 'stubble') part(G.sph, mat('#3a3029', .95, 0, { transparent: true, opacity: .45 }), headR * .78 * L.jaw, headR * .5, headR * .82, 0, -headR * .5, .012, head);
  if (L.facial === 'mustache') part(G.box, mat(L.age > 55 ? '#8a857e' : L.hair, .95), headR * .5, headR * .1, headR * .08, 0, -headR * .27, headR * .9, head);
  R.face = F;
  // волосы и шапки
  const hatM = mat(L.hatC || '#333', .95);
  const hairCap = (sy = .62) => part(G.half, hairM, headR * 1.0, headR * sy * 1.6, headR * 1.03, 0, headR * .12, -headR * .03, head);
  if (L.hat === 'none' || L.hat === 'kepka') {
    if (L.hairStyle === 'short' || L.hairStyle === 'side') hairCap(.62);
    else if (L.hairStyle === 'buzz') part(G.half, mat(L.hair, .98, 0, { transparent: true, opacity: .7 }), headR * .96, headR * 1.0, headR * 1.0, 0, headR * .12, -headR * .02, head);
    else if (L.hairStyle === 'perm') { hairCap(.7); part(G.sph, hairM, headR * 1.1, headR * .8, headR * 1.05, 0, headR * .35, -headR * .12, head); }
    else if (L.hairStyle === 'bun') { hairCap(.65); part(G.sph, hairM, headR * .35, headR * .35, headR * .35, 0, headR * .35, -headR * 1.0, head); }
  }
  // Головной убор выделяется в отдельную группу R.hatGroup (кроме бабушкиного платка 'platok'),
  // чтобы при сильном ударе по голове шапка/ушанка/кепка/фуражка/берет реалистично слетали с головы на землю!
  const hatHolder = (L.hat && L.hat !== 'none' && L.hat !== 'platok') ? new THREE.Group() : head;
  if (hatHolder !== head) {
    head.add(hatHolder);
    R.hatGroup = hatHolder;
    R.hatKind = L.hat;
    // Базовая причёска под шапкой, чтобы когда шапку сбили ударом, голова не была срезанной
    hairCap(.58);
  }
  if (L.hat === 'shapka') { part(G.half, hatM, headR * 1.06, headR * 1.25, headR * 1.08, 0, headR * .15, 0, hatHolder); part(G.cyl, hatM, headR * 1.07, headR * .3, headR * 1.08, 0, headR * .25, 0, hatHolder); }
  if (L.hat === 'ushanka') { const um = mat(pick(['#4a3a2a', '#2a2622', '#5a4a3a']), 1); part(G.cyl, um, headR * 1.18, headR * .75, headR * 1.15, 0, headR * .55, 0, hatHolder); for (const s of [1, -1]) part(G.box, um, headR * .25, headR * .8, headR * .8, s * headR * 1.0, headR * .0, 0, hatHolder); part(G.box, um, headR * 1.6, headR * .35, headR * .3, 0, headR * .62, headR * .95, hatHolder); }
  if (L.hat === 'kepka') { part(G.cyl, hatM, headR * 1.08, headR * .3, headR * 1.1, 0, headR * .62, 0, hatHolder); part(G.box, hatM, headR * 1.3, headR * .06, headR * .8, 0, headR * .55, headR * .9, hatHolder); }
  if (L.hat === 'beret') part(G.sph, hatM, headR * 1.15, headR * .4, headR * 1.15, 0, headR * .72, -headR * .05, hatHolder);
  if (L.hat === 'platok') { part(G.sph, hatM, headR * 1.08, headR * 1.1, headR * 1.08, 0, headR * .12, -headR * .06, head); part(G.box, hatM, headR * .5, headR * .5, headR * .2, 0, -headR * 1.0, -headR * .2, head).rotation.x = .4; }
  if (L.hat === 'zimnyaya') { part(G.cyl, hatM, headR * 1.15, headR * .8, headR * 1.15, 0, headR * .55, 0, hatHolder); part(G.box, mat('#c9a227', .4, .7), headR * .25, headR * .25, headR * .05, 0, headR * .6, headR * 1.15, hatHolder); }
  R.legLen = legLen; R.stride = legLen * 1.25;
  addNpcDamageMeshes(R, headR, false);
  return R;
}
let _checker;
function checkerTex() { if (_checker) return _checker; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#E61919' : '#0055FF'; g.fillRect(i * 16, j * 16, 16, 16); } g.strokeStyle = '#E8D8C3'; g.lineWidth = 2.2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16, 64); g.stroke(); g.beginPath(); g.moveTo(0, i * 16); g.lineTo(64, i * 16); g.stroke(); } _checker = new THREE.CanvasTexture(c); _checker.colorSpace = THREE.SRGBColorSpace; return _checker; }

// Запись топ-4 весов костей [0..9] в атрибуты skinIndex и skinWeight
function writeTop4Weights(b, vIdx, sIdxArr, sWgtArr) {
  let i0 = 0, i1 = 0, i2 = 0, i3 = 0;
  let w0 = 0, w1 = 0, w2 = 0, w3 = 0;
  for (let k = 0; k < 10; k++) {
    const w = b[k];
    if (w <= 1e-5) continue;
    if (w > w0) { w3 = w2; i3 = i2; w2 = w1; i2 = i1; w1 = w0; i1 = i0; w0 = w; i0 = k; }
    else if (w > w1) { w3 = w2; i3 = i2; w2 = w1; i2 = i1; w1 = w; i1 = k; }
    else if (w > w2) { w3 = w2; i3 = i2; w2 = w; i2 = k; }
    else if (w > w3) { w3 = w; i3 = k; }
  }
  const sum = w0 + w1 + w2 + w3;
  const o = vIdx * 4;
  if (sum > 1e-6) {
    const inv = 1 / sum;
    sIdxArr[o] = i0; sIdxArr[o + 1] = i1; sIdxArr[o + 2] = i2; sIdxArr[o + 3] = i3;
    sWgtArr[o] = w0 * inv; sWgtArr[o + 1] = w1 * inv; sWgtArr[o + 2] = w2 * inv; sWgtArr[o + 3] = w3 * inv;
  } else {
    sIdxArr[o] = 0; sIdxArr[o + 1] = 0; sIdxArr[o + 2] = 0; sIdxArr[o + 3] = 0;
    sWgtArr[o] = 1; sWgtArr[o + 1] = 0; sWgtArr[o + 2] = 0; sWgtArr[o + 3] = 0;
  }
}

// Статичные модели (сталевар, запасные модели): единый плавный SkinnedMesh без разрывов на стыках
const STEEL_CFG = { height: 1.93, hipY: .95, neckY: 1.55, headCut: 1.56, shY: 1.45, shX: .2, armCut: .21, armTop: 1.52, armBottom: 0, legCut: .93, legX: .1 };
export const PEOPLE_CFG = { height: 1.86, hipY: .98, neckY: 1.47, headCut: 1.47, headHalfW: .2, shY: 1.42, shX: .2, armCut: .205, armTop: 2.2, armBottom: .75, legCut: .99, legX: .09 };
export function splitParts(prims, cfg) {
  const parts = { torso: [], head: [], armL: [], armR: [], legL: [], legR: [] };
  let totalVerts = 0, hasUVAll = false;
  for (const { geo, legsOK, force } of prims) {
    const pos = geo.attributes.position;
    if (geo.attributes.uv) hasUVAll = true;
    totalVerts += pos.count;
    for (let t = 0; t < pos.count; t += 3) {
      let cx = 0, cy = 0; for (let k = 0; k < 3; k++) { cx += pos.getX(t + k); cy += pos.getY(t + k); } cx /= 3; cy /= 3;
      let p = 'torso';
      if (force) p = force;
      else if (cy > cfg.headCut && Math.abs(cx) < (cfg.headHalfW || 9)) p = 'head';
      else if (cy < .48) p = cx > 0 ? 'legL' : 'legR';
      else if (Math.abs(cx) > cfg.armCut && cy < cfg.armTop && cy > cfg.armBottom) p = cx > 0 ? 'armL' : 'armR';
      else if (cy < cfg.legCut && legsOK !== false) p = cx > 0 ? 'legL' : 'legR';
      parts[p].push([geo, t]);
    }
  }
  const PIV = { torso: [0, 0, 0], head: [0, cfg.neckY, 0], armL: [cfg.shX, cfg.shY, 0], armR: [-cfg.shX, cfg.shY, 0], legL: [cfg.legX, cfg.hipY, 0], legR: [-cfg.legX, cfg.hipY, 0] };
  const out = { cfg, elbL: [0, -.3, 0], elbR: [0, -.3, 0], kneeOff: -.45, sds: true };
  for (const k in parts) {
    const tris = parts[k], m = tris.length * 3, P = new Float32Array(m * 3), N = new Float32Array(m * 3), C = new Float32Array(m * 3), hasUV = tris.length && tris[0][0].attributes.uv, UV = hasUV ? new Float32Array(m * 2) : null;
    let i = 0; const [px, py, pz] = PIV[k];
    for (const [geo, t] of tris) { const pos = geo.attributes.position, nor = geo.attributes.normal, col = geo.attributes.color;
      for (let v = 0; v < 3; v++, i++) {
        P[i * 3] = pos.getX(t + v) - px; P[i * 3 + 1] = pos.getY(t + v) - py; P[i * 3 + 2] = pos.getZ(t + v) - pz;
        N[i * 3] = nor.getX(t + v); N[i * 3 + 1] = nor.getY(t + v); N[i * 3 + 2] = nor.getZ(t + v);
        if (col) { C[i * 3] = col.getX(t + v); C[i * 3 + 1] = col.getY(t + v); C[i * 3 + 2] = col.getZ(t + v); } else C[i * 3] = C[i * 3 + 1] = C[i * 3 + 2] = .8;
        if (UV) { const uv = geo.attributes.uv; UV[i * 2] = uv.getX(t + v); UV[i * 2 + 1] = uv.getY(t + v); }
      } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    if (UV) g.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
    g.computeBoundingSphere(); out[k] = g;
  }
  // Единый плавный SkinnedMesh для splitParts (без разрывов между корпусом, руками и ногами)
  if (totalVerts > 0) {
    const P = new Float32Array(totalVerts * 3), N = new Float32Array(totalVerts * 3), C = new Float32Array(totalVerts * 3);
    const UV = hasUVAll ? new Float32Array(totalVerts * 2) : null;
    const sIdx = new Uint16Array(totalVerts * 4), sWgt = new Float32Array(totalVerts * 4);
    const b = new Float32Array(10);
    const H = cfg.height || 1.85, kneeY = cfg.hipY - .45, elY = cfg.shY - .30;
    let vi = 0;
    for (const { geo, legsOK, force } of prims) {
      const pos = geo.attributes.position, nor = geo.attributes.normal, col = geo.attributes.color, uv = geo.attributes.uv;
      for (let i = 0; i < pos.count; i++, vi++) {
        const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
        P[vi * 3] = vx; P[vi * 3 + 1] = vy; P[vi * 3 + 2] = vz;
        N[vi * 3] = nor ? nor.getX(i) : 0; N[vi * 3 + 1] = nor ? nor.getY(i) : 1; N[vi * 3 + 2] = nor ? nor.getZ(i) : 0;
        if (col) { C[vi * 3] = col.getX(i); C[vi * 3 + 1] = col.getY(i); C[vi * 3 + 2] = col.getZ(i); }
        else { C[vi * 3] = C[vi * 3 + 1] = C[vi * 3 + 2] = .85; }
        if (UV && uv) { UV[vi * 2] = uv.getX(i); UV[vi * 2 + 1] = uv.getY(i); }
        b.fill(0);
        if (force === 'head') { b[1] = 1; }
        else if (force === 'torso') { b[0] = 1; }
        else {
          const ax = Math.abs(vx), sg = vx >= 0 ? 1 : -1;
          const wArm = (force === 'armL' || force === 'armR') ? 1 : (sstep(cfg.armCut - .03, cfg.armCut + .03, ax) * sstep(cfg.armBottom - .04, cfg.armBottom + .04, vy) * (1 - sstep(cfg.armTop - .03, cfg.armTop + .03, vy)));
          const wFore = 1 - sstep(elY - .06, elY + .06, vy);
          const wBody = 1 - wArm;
          const wHead = ax < (cfg.headHalfW || .2) ? sstep(cfg.headCut - .04, cfg.headCut + .03, vy) : 0;
          const wLeg = (legsOK === false ? 0 : 1 - sstep(cfg.legCut - .07, cfg.legCut + .04, vy)) * (1 - wHead);
          const wSpine = (1 - wHead) - wLeg;
          const wLeft = sstep(-.04 * H, .04 * H, vx);
          const wRight = 1 - wLeft;
          const wShin = 1 - sstep(kneeY - .05, kneeY + .05, vy);
          b[0] = wBody * wSpine;
          b[1] = wBody * wHead;
          b[2] = sg > 0 ? wArm * (1 - wFore) : 0;
          b[3] = sg > 0 ? wArm * wFore : 0;
          b[4] = sg < 0 ? wArm * (1 - wFore) : 0;
          b[5] = sg < 0 ? wArm * wFore : 0;
          b[6] = wBody * wLeg * wLeft * (1 - wShin);
          b[7] = wBody * wLeg * wLeft * wShin;
          b[8] = wBody * wLeg * wRight * (1 - wShin);
          b[9] = wBody * wLeg * wRight * wShin;
        }
        writeTop4Weights(b, vi, sIdx, sWgt);
      }
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(P, 3));
    sg.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(C, 3));
    if (UV) sg.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
    sg.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(sIdx, 4));
    sg.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sWgt, 4));
    sg.computeBoundingBox(); sg.computeBoundingSphere();
    out.skinnedGeo = sg;
  }
  return out;
}
export function splitStaticModel(geo) { return splitParts([{ geo, legsOK: true }], STEEL_CFG); }

// Прохожие, сюжетные НПС, милиция и водитель из 3D-моделей:
// Единый неразрывный SkinnedMesh с подразделением крупных треугольников одежды и гладким 3D-полем весов костей [0..9]
// (одежда — пальто, куртки, брюки, юбки, рукава и шарфы — плавно сгибается на суставах и никогда не рвётся и не распадается!).
export const SDS_FEMALE = n => /^c(mesz|pros)/.test(n) || /^x_(woman|grandma|girl|zina)/.test(n);
export function prepareSdsPerson(mesh, name) {
  // Клонируем индексированную геометрию до toNonIndexed(), чтобы точно знать индексы базового тела (0..5821), волос (5822..8499) и шапок (>=8500)
  const rawG = mesh.geometry.clone();
  mesh.updateMatrixWorld(true);
  rawG.applyMatrix4(mesh.matrixWorld);
  rawG.computeBoundingBox();
  const H0 = rawG.boundingBox.max.y - rawG.boundingBox.min.y;
  const H = /^x_/.test(name) ? H0 : SDS_FEMALE(name) ? 1.68 : 1.78;
  const k = H / (H0 || 1.78);
  rawG.translate(0, -rawG.boundingBox.min.y, 0);
  rawG.scale(k, k, k);
  if (!rawG.attributes.normal) rawG.computeVertexNormals();

  const P0 = rawG.attributes.position;
  const LB0 = rawG.attributes._part;
  const nv0 = P0.count;
  const neckY = H * .855, hipY = H * .5, kneeY = H * .27, legX = H * .055, legTop = H * .48;

  // Если модель содержит индексированный меш с базовым телом (nv0 > 6200) и одеждой:
  // 1) Скрываем внутренние треугольники голого торса, бёдер и плеч (0..5821) под одеждой, чтобы они никогда не просвечивали сквозь куртки/брюки
  // 2) Если на персонаже надета зимняя шапка/ушанка/кепка (вершины >= 8500 с _part === 1), убираем макушку внутренних волос (5818..8500) под шапкой (6452.png)
  if (rawG.index && LB0 && nv0 > 6200) {
    const bodyN = 5822;
    let sleeveMax = 0, hatMinY = 1e9, hatMaxY = -1e9, hatCount = 0;
    for (let i = bodyN; i < nv0; i++) {
      const p = Math.round(LB0.getX(i));
      const ax = Math.abs(P0.getX(i)), vy = P0.getY(i);
      if ((p === 2 || p === 3 || p === 4 || p === 5) && ax > sleeveMax) sleeveMax = ax;
      if (i >= 8500 && p === 1 && vy > neckY + H * .04) {
        if (vy < hatMinY) hatMinY = vy;
        if (vy > hatMaxY) hatMaxY = vy;
        hatCount++;
      }
    }
    const hasLongSleeves = sleeveMax > H * .25;
    const hasHat = hatCount > 80 && hatMaxY > neckY + H * .08;
    const hatCutY = hasHat ? (hatMinY + (hatMaxY - hatMinY) * .22) : 1e9;

    const idxArr = rawG.index.array;
    const keepIdx = [];
    const hatTris = [];
    const isFemaleScarf = SDS_FEMALE(name) && /grandma|zina|babka/i.test(name);
    for (let t = 0; t < idxArr.length; t += 3) {
      const a = idxArr[t], b = idxArr[t + 1], c = idxArr[t + 2];
      if (a < bodyN && b < bodyN && c < bodyN) {
        const pa = Math.round(LB0.getX(a)), pb = Math.round(LB0.getX(b)), pc = Math.round(LB0.getX(c));
        const ym = (P0.getY(a) + P0.getY(b) + P0.getY(c)) / 3;
        const zm = (P0.getZ(a) + P0.getZ(b) + P0.getZ(c)) / 3;
        if ((pa === 0 || pb === 0 || pc === 0) && (ym < neckY - H * .018 || (zm < 0 && ym < neckY + H * .015))) continue;
        if (pa >= 6 || pb >= 6 || pc >= 6) continue;
        if (hasLongSleeves && (pa === 2 || pb === 2 || pc === 2 || pa === 4 || pb === 4 || pc === 4)) {
          const xm = (Math.abs(P0.getX(a)) + Math.abs(P0.getX(b)) + Math.abs(P0.getX(c))) / 3;
          if (xm < sleeveMax - H * .035) continue;
        }
      } else if (hasHat && !isFemaleScarf && a >= 8500 && b >= 8500 && c >= 8500) {
        const pa = Math.round(LB0.getX(a)), pb = Math.round(LB0.getX(b)), pc = Math.round(LB0.getX(c));
        const ym = (P0.getY(a) + P0.getY(b) + P0.getY(c)) / 3;
        if (pa === 1 && pb === 1 && pc === 1 && ym > neckY + H * .035) {
          hatTris.push(a, b, c);
          continue;
        }
      }
      keepIdx.push(a, b, c);
    }
    rawG.setIndex(keepIdx);
    var extractedHatTris = hatTris;
  }

  let g = rawG.index ? rawG.toNonIndexed() : rawG;
  const P = g.attributes.position;
  const N = g.attributes.normal;
  const LB = g.attributes._part;
  const nv = P.count;

  const handPt = sg => {
    let bx = 0, by = 0, n = 0, mx = 0;
    for (let i = 0; i < nv; i++) mx = Math.max(mx, sg * P.getX(i));
    for (let i = 0; i < nv; i++) {
      if (sg * P.getX(i) > mx - H * .06) { bx += P.getX(i); by += P.getY(i); n++; }
    }
    return n ? [bx / n, by / n] : [sg * H * .42, H * .60];
  };
  const shoulder = sg => [sg * H * .102, H * .795];
  const segD = (x, y, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-6;
    const t = ((x - a[0]) * dx + (y - a[1]) * dy) / L2;
    const tc = Math.max(0, Math.min(1, t));
    return [Math.hypot(x - a[0] - dx * tc, y - a[1] - dy * tc), t];
  };
  const arms = { armL: [shoulder(1), handPt(1)], armR: [shoulder(-1), handPt(-1)] };

  let nzMin = 1e9, nzMax = -1e9, szMin = 1e9, szMax = -1e9;
  for (let i = 0; i < nv; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    if (Math.abs(y - neckY) < H * .03 && Math.abs(x) < H * .1) { if (z < nzMin) nzMin = z; if (z > nzMax) nzMax = z; }
    if (Math.abs(y - H * .80) < H * .04 && Math.abs(x) > H * .07 && Math.abs(x) < H * .18) { if (z < szMin) szMin = z; if (z > szMax) szMax = z; }
  }
  const neckZ = nzMin < nzMax ? (nzMin + nzMax) * .5 : -H * .06;
  const shZ = szMin < szMax ? (szMin + szMax) * .5 : neckZ;

  // Определяем базовую метку кости [0..9] для каждой вершины
  const vPart = new Uint8Array(nv);
  for (let t = 0; t < nv; t += 3) {
    if (LB) {
      for (let k = 0; k < 3; k++) {
        const p = Math.round(LB.getX(t + k));
        vPart[t + k] = (p >= 0 && p <= 9) ? p : 0;
      }
    } else {
      const cx = (P.getX(t) + P.getX(t + 1) + P.getX(t + 2)) / 3;
      const cy = (P.getY(t) + P.getY(t + 1) + P.getY(t + 2)) / 3;
      let reg = 0;
      for (const side of ['armL', 'armR']) {
        const [a_, b_] = arms[side];
        const sg = side === 'armL' ? 1 : -1;
        const [d, tt] = segD(cx, cy, a_, b_);
        if (sg * cx > H * .115 && tt > .04 && d < H * .075) reg = side === 'armL' ? (tt > .48 ? 3 : 2) : (tt > .48 ? 5 : 4);
      }
      if (reg === 0) {
        if (cy > H * .855 && Math.abs(cx) < H * .1) reg = 1;
        else if (cy < legTop) reg = cx > 0 ? (cy < kneeY ? 7 : 6) : (cy < kneeY ? 9 : 8);
      }
      vPart[t] = vPart[t + 1] = vPart[t + 2] = reg;
    }
  }

  // Свариваем совпадающие 3D-позиции вершин (сетка 1 мм): в GLB каждый квад одежды хранился отдельным островком,
  // из-за чего без сварки и сглаживания весов по графу рёбер одежда слегка расходилась по швам при сгибах
  const posMap = new Map();
  const vToU = new Int32Array(nv);
  const uX = [], uY = [], uZ = [], uPart = [];
  for (let i = 0; i < nv; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const key = `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`;
    let u = posMap.get(key);
    if (u === undefined) {
      u = uX.length;
      posMap.set(key, u);
      uX.push(x); uY.push(y); uZ.push(z);
      uPart.push(vPart[i]);
    }
    vToU[i] = u;
  }
  const nu = uX.length;
  const adj = Array.from({ length: nu }, () => []);
  const addEdge = (a, b) => {
    if (a !== b && !adj[a].includes(b)) { adj[a].push(b); adj[b].push(a); }
  };
  for (let t = 0; t < nv; t += 3) {
    const u0 = vToU[t], u1 = vToU[t + 1], u2 = vToU[t + 2];
    addEdge(u0, u1); addEdge(u1, u2); addEdge(u2, u0);
  }
  // Дополнительно связываем в графе adj[u] близкие в 3D-пространстве вершины (в пределах 24 мм),
  // чтобы отдельные накладные детали одежды (меховая опушка подола шубы в 6521.png, манжеты, воротники, карманы)
  // деформировались абсолютно синхронно с основной тканью пальто/брюк под ними и никогда не отслаивались!
  {
    const cellSz = .024;
    const grid = new Map();
    for (let u = 0; u < nu; u++) {
      if (uPart[u] === 1) continue;
      const gx = Math.floor(uX[u] / cellSz), gy = Math.floor(uY[u] / cellSz), gz = Math.floor(uZ[u] / cellSz);
      const gk = `${gx},${gy},${gz}`;
      let list = grid.get(gk);
      if (!list) { list = []; grid.set(gk, list); }
      list.push(u);
    }
    for (let u = 0; u < nu; u++) {
      if (uPart[u] === 1) continue;
      const gx = Math.floor(uX[u] / cellSz), gy = Math.floor(uY[u] / cellSz), gz = Math.floor(uZ[u] / cellSz);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            const list = grid.get(`${gx + dx},${gy + dy},${gz + dz}`);
            if (!list) continue;
            for (let k = 0; k < list.length; k++) {
              const v = list[k];
              if (v <= u || uPart[v] === 1) continue;
              const d2 = (uX[u] - uX[v]) ** 2 + (uY[u] - uY[v]) ** 2 + (uZ[u] - uZ[v]) ** 2;
              if (d2 < .024 * .024) addEdge(u, v);
            }
          }
        }
      }
    }
  }

  // Плавный коэффициент опускания рукавов из A-позы (armKL / armKR), сглаженный по графу смежности 3D-вершин,
  // чтобы плечевой шов куртки/пальто плавно изгибался без растяжения и без единой ступеньки!
  let armKL = new Float32Array(nu), armKR = new Float32Array(nu);
  for (let u = 0; u < nu; u++) {
    const vp = uPart[u];
    if (vp === 2 || vp === 3) armKL[u] = 1;
    else if (vp === 4 || vp === 5) armKR[u] = 1;
  }
  for (let pass = 0; pass < 5; pass++) {
    const nextL = new Float32Array(armKL), nextR = new Float32Array(armKR);
    for (let u = 0; u < nu; u++) {
      const vp = uPart[u];
      if (vp === 3 || vp === 5 || vp === 1 || vp >= 6) continue; // предплечья, голова и ноги не размываются с плечом
      const nb = adj[u];
      if (!nb.length) continue;
      let sL = armKL[u] * 2, sR = armKR[u] * 2;
      for (let j = 0; j < nb.length; j++) { sL += armKL[nb[j]]; sR += armKR[nb[j]]; }
      nextL[u] = sL / (nb.length + 2);
      nextR[u] = sR / (nb.length + 2);
    }
    armKL = nextL; armKR = nextR;
  }

  const piv = {}, elbow = {};
  const v3 = new THREE.Vector3(), n3 = new THREE.Vector3(), q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1);
  for (const side of ['armL', 'armR']) {
    const sg = side === 'armL' ? 1 : -1;
    const shX = Math.abs(arms[side][0][0]), shY = arms[side][0][1];
    const hX = Math.abs(arms[side][1][0]), hY = arms[side][1][1];
    const len = Math.hypot(hX - shX, shY - hY) || (H * .32);
    const ang = Math.atan2(shY - hY, hX - shX);
    const rot = Math.PI / 2 - ang - .055;
    const outShift = H * .028;
    piv[side] = [sg * (shX + outShift * .65), shY];
    elbow[side] = [piv[side][0], shY - Math.cos(.055) * len * .48];
    const eX = elbow[side][0], eY = elbow[side][1];
    const foreCode = side === 'armL' ? 3 : 5;
    const wristCut = -.235 * (H / 1.78);
    const wristSpan = .175 * (H / 1.78);
    const kArr = side === 'armL' ? armKL : armKR;

    for (let i = 0; i < nv; i++) {
      const u = vToU[i];
      const wRot = kArr[u];
      if (wRot <= 1e-4) continue;
      q.setFromAxisAngle(Z, -sg * rot * wRot);
      v3.set(P.getX(i) - sg * shX, P.getY(i) - shY, P.getZ(i) - shZ).applyQuaternion(q);
      const distDown = Math.max(0, -v3.y);
      const shiftK = Math.min(1, distDown / (len * .18)) * wRot;
      v3.x += sg * outShift * shiftK;
      let vx = v3.x + sg * shX, vy = v3.y + shY, vz = v3.z + shZ;

      if (uPart[u] === foreCode && wRot > .95) {
        let fx = vx - eX, fy = vy - eY, fz = vz - shZ;
        if (fy < wristCut) {
          const uW = clamp((wristCut - fy) / wristSpan, 0, 1);
          const fAng = uW * 1.35;
          fy = wristCut - Math.sin(fAng) * (.032 * (H / 1.78)) - uW * (.022 * (H / 1.78));
          fx = fx * (1 - uW * .28) - sg * (1 - Math.cos(fAng)) * (.016 * (H / 1.78));
          fz = fz * .75 + Math.sin(fAng * .65) * (.012 * (H / 1.78));
          vx = eX + fx;
          vy = eY + fy;
          vz = shZ + fz;
        }
      }
      P.setXYZ(i, vx, vy, vz);
      n3.set(N.getX(i), N.getY(i), N.getZ(i)).applyQuaternion(q);
      N.setXYZ(i, n3.x, n3.y, n3.z);
    }
  }
  P.needsUpdate = true;
  N.needsUpdate = true;

  // Сглаживаем веса 10 костей по графу смежности 3D-вершин (4 прохода Лапласа):
  // все вершины с одинаковой 3D-позицией получают строго идентичные веса (sIdx, sWgt),
  // поэтому на плечах, поясе, бёдрах и коленях одежда гнётся как единая цельная ткань без единого разрыва!
  let W = new Float32Array(nu * 10);
  for (let u = 0; u < nu; u++) {
    const vp = uPart[u];
    const vx = uX[u], vy = uY[u];
    // Непрерывное пространственное поле весов на переходе от подола пальто/шубы к бёдрам (vy ~ 0.35*H..0.52*H) и коленям (vy ~ 0.21*H..0.33*H),
    // чтобы подол длинной шубы или пальто никогда не отрывался кольцом от торса при шаге (6521.png)!
    if (vp === 0 || vp >= 6) {
      const wLeg = 1 - sstep(H * .31, H * .43, vy);
      const wSpine = 1 - wLeg;
      const wLeft = sstep(-H * .085, H * .085, vx);
      const wRight = 1 - wLeft;
      const wShin = 1 - sstep(kneeY - H * .055, kneeY + H * .055, vy);
      W[u * 10 + 0] = wSpine;
      W[u * 10 + 6] = wLeg * wLeft * (1 - wShin);
      W[u * 10 + 7] = wLeg * wLeft * wShin;
      W[u * 10 + 8] = wLeg * wRight * (1 - wShin);
      W[u * 10 + 9] = wLeg * wRight * wShin;
    } else {
      W[u * 10 + vp] = 1;
    }
  }
  for (let pass = 0; pass < 8; pass++) {
    const Wn = new Float32Array(W);
    for (let u = 0; u < nu; u++) {
      if (uPart[u] === 1) continue; // голова остаётся жёсткой
      const nb = adj[u];
      if (!nb.length) continue;
      for (let k = 0; k < 10; k++) {
        if (k === 1) continue;
        let sum = W[u * 10 + k] * 1.8;
        for (let j = 0; j < nb.length; j++) sum += W[nb[j] * 10 + k];
        Wn[u * 10 + k] = sum / (nb.length + 1.8);
      }
    }
    W = Wn;
  }

  const colArr = new Float32Array(nv * 3).fill(1);
  const sIdx = new Uint16Array(nv * 4);
  const sWgt = new Float32Array(nv * 4);
  const bTmp = new Float32Array(10);
  let headTop = .25, headZMin = 1e9, headZMax = -1e9, chestZ = .16;

  // Естественный тёплый тон кожи для вершин базового меша тела (0..5821),
  // чтобы у моделей девушек, женщин, мальчиков и бабушек кожа и волосы никогда не выглядели меловыми или белыми
  const isGirlM = /girl/i.test(name);
  const isWomanOrBoyM = /woman|boy/i.test(name);
  const isGrandmaM = /grandma|zina|babka/i.test(name);
  const skinMulR = isGirlM ? 0.85 : isWomanOrBoyM ? 0.88 : isGrandmaM ? 0.89 : 0.93;
  const skinMulG = isGirlM ? 0.72 : isWomanOrBoyM ? 0.76 : isGrandmaM ? 0.77 : 0.85;
  const skinMulB = isGirlM ? 0.61 : isWomanOrBoyM ? 0.65 : isGrandmaM ? 0.65 : 0.78;
  const keptOrigIdx = (typeof keepIdx !== "undefined" && keepIdx && keepIdx.length === nv) ? keepIdx : null;

  for (let i = 0; i < nv; i++) {
    const u = vToU[i];
    const vp = uPart[u];
    for (let k = 0; k < 10; k++) bTmp[k] = W[u * 10 + k];
    writeTop4Weights(bTmp, i, sIdx, sWgt);

    const origVi = keptOrigIdx ? keptOrigIdx[i] : i;
    const vy = P.getY(i), vz = P.getZ(i), vx = P.getX(i);
    if (origVi < 5822) {
      // Вершины открытой кожи (лицо, шея, кисти рук)
      colArr[i * 3]     = skinMulR;
      colArr[i * 3 + 1] = skinMulG;
      colArr[i * 3 + 2] = skinMulB;
    } else if (isGrandmaM && vy > neckY - H * .02) {
      // Приглушаем слишком светлые седые волосы/платок у бабушек, чтобы голова не светилась белым
      colArr[i * 3]     = 0.74;
      colArr[i * 3 + 1] = 0.67;
      colArr[i * 3 + 2] = 0.60;
    }
    if (vp === 1) {
      if (vy - neckY > headTop) headTop = vy - neckY;
      if (vz - neckZ < headZMin) headZMin = vz - neckZ;
      if (vz - neckZ > headZMax) headZMax = vz - neckZ;
    } else if (vp === 0 && vy > hipY && vy < neckY && Math.abs(vx) < H * .14) {
      if (vz > chestZ) chestZ = vz;
    }
  }

  g.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(sIdx, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sWgt, 4));
  g.computeBoundingBox();
  g.computeBoundingSphere();

  const pL = piv.armL || [H * .11, H * .80];
  const eL = elbow.armL || [pL[0], pL[1] - H * .15];
  const pR = piv.armR || [-H * .11, H * .80];
  const eR = elbow.armR || [pR[0], pR[1] - H * .15];

  let hatGeo = null;
  if (typeof extractedHatTris !== 'undefined' && extractedHatTris && extractedHatTris.length >= 12) {
    const hCnt = extractedHatTris.length;
    const hPos = new Float32Array(hCnt * 3);
    const hNor = new Float32Array(hCnt * 3);
    const N0 = rawG.attributes.normal;
    const UV0 = rawG.attributes.uv;
    const hUV = UV0 ? new Float32Array(hCnt * 2) : null;
    for (let i = 0; i < hCnt; i++) {
      const vi = extractedHatTris[i];
      hPos[i * 3]     = P0.getX(vi);
      hPos[i * 3 + 1] = P0.getY(vi) - neckY;
      hPos[i * 3 + 2] = P0.getZ(vi) - neckZ;
      if (N0) {
        hNor[i * 3]     = N0.getX(vi);
        hNor[i * 3 + 1] = N0.getY(vi);
        hNor[i * 3 + 2] = N0.getZ(vi);
      }
      if (hUV && UV0) {
        hUV[i * 2]     = UV0.getX(vi);
        hUV[i * 2 + 1] = UV0.getY(vi);
      }
    }
    const hCol = new Float32Array(hCnt * 3);
    const hatTint = /girl_w2|woman_w3/i.test(name) ? [0.78, 0.72, 0.66] : [0.95, 0.93, 0.90];
    for (let i = 0; i < hCnt; i++) {
      hCol[i * 3]     = hatTint[0];
      hCol[i * 3 + 1] = hatTint[1];
      hCol[i * 3 + 2] = hatTint[2];
    }
    hatGeo = new THREE.BufferGeometry();
    hatGeo.setAttribute('position', new THREE.BufferAttribute(hPos, 3));
    hatGeo.setAttribute('normal', new THREE.BufferAttribute(hNor, 3));
    hatGeo.setAttribute('color', new THREE.BufferAttribute(hCol, 3));
    if (hUV) hatGeo.setAttribute('uv', new THREE.BufferAttribute(hUV, 2));
    hatGeo.computeBoundingBox();
    hatGeo.computeBoundingSphere();
  }
  const out = {
    cfg: { height: H, hipY, neckY, neckZ, shY: pL[1], shX: pL[0], shZ, legX },
    skinnedGeo: g,
    hatGeo,
    elbL: [eL[0] - pL[0], eL[1] - pL[1]],
    elbR: [eR[0] - pR[0], eR[1] - pR[1]],
    kneeOff: kneeY - hipY,
    headTop,
    headZ: headZMin < headZMax ? (headZMin + headZMax) * .5 : 0,
    chestZ,
    map: mesh.material && mesh.material.map,
    sds: true,
  };
  return { name, female: SDS_FEMALE(name), parts: out };
}

// милиционер из присланной модели (T-поза, лицом по +X): разворачиваем лицом вперёд, ставим на землю, опускаем руки вдоль тела
// и режем на те же части, что у остальных прохожих; текстура формы сохраняется (uv)
export function preparePolice(srcGeo, map) {
  let g = srcGeo.index ? srcGeo.toNonIndexed() : srcGeo.clone();
  g.rotateY(-Math.PI / 2); g.computeBoundingBox(); let bb = g.boundingBox;
  const sc = 1.8 / (bb.max.y - bb.min.y); g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2); g.scale(sc, sc, sc);
  if (!g.attributes.normal) g.computeVertexNormals();
  const P = g.attributes.position, N = g.attributes.normal, shX = .2;
  let sy = 0, sn = 0; for (let i = 0; i < P.count; i++) { const ax = Math.abs(P.getX(i)); if (ax > .26 && ax < .36 && P.getY(i) > 1.2) { sy += P.getY(i); sn++; } }
  const shY = sn ? sy / sn : 1.43, th = 1.36;
  const armTri = new Uint8Array(P.count / 3);
  for (let t = 0; t < P.count; t += 3) { let cx = 0, cy = 0; for (let k = 0; k < 3; k++) { cx += P.getX(t + k); cy += P.getY(t + k); } cx /= 3; cy /= 3;
    if (Math.abs(cx) > .24 && cy > shY - .22) armTri[t / 3] = cx > 0 ? 1 : 2; }
  const v = new THREE.Vector3(), n = new THREE.Vector3(), q = new THREE.Quaternion(), ax = new THREE.Vector3(0, 0, 1);
  for (let t = 0; t < P.count; t += 3) { const a = armTri[t / 3]; if (!a) continue; const sgn = a === 1 ? 1 : -1; q.setFromAxisAngle(ax, -sgn * th);
    for (let k = 0; k < 3; k++) { const i = t + k; v.set(P.getX(i) - sgn * shX, P.getY(i) - shY, P.getZ(i)).applyQuaternion(q); P.setXYZ(i, v.x + sgn * shX, v.y + shY, v.z); n.set(N.getX(i), N.getY(i), N.getZ(i)).applyQuaternion(q); N.setXYZ(i, n.x, n.y, n.z); } }
  const pick = sel => { const idx = []; for (let t = 0; t < P.count / 3; t++) if (sel(armTri[t])) idx.push(t); const out = new THREE.BufferGeometry();
    for (const [name, at] of Object.entries(g.attributes)) { const sz = at.itemSize, arr = new Float32Array(idx.length * 3 * sz); const G = ['getX', 'getY', 'getZ', 'getW']; idx.forEach((t, j) => { for (let vv = 0; vv < 3; vv++) for (let c = 0; c < sz; c++) arr[(j * 3 + vv) * sz + c] = at[G[c]](t * 3 + vv); }); out.setAttribute(name, new THREE.BufferAttribute(arr, sz)); }
    return out; };
  const cfg = { height: 1.8, hipY: .93, neckY: 1.5, headCut: 1.53, headHalfW: .2, shY, shX, armCut: 9, armTop: 0, armBottom: 0, legCut: .9, legX: .09 };
  const parts = splitParts([{ geo: pick(a => !a), legsOK: true }, { geo: pick(a => a === 1), force: 'armL' }, { geo: pick(a => a === 2), force: 'armR' }], cfg);
  parts.map = map; return parts;
}

// набор «Зимние люди»: 10 персонажей из отдельных частей; цвет материала запекаем в вершины
export const PEOPLE_FEMALE = ['Anna', 'Galina', 'Elena', 'Irina'];
const OUTFIT = {
  summer: { skip: [9, 10, 11, 12], shirt: ['#e8e4dc', '#9fc0d8', '#d8c8a0', '#c8d8c0', '#e0b8b0', '#f0f0ea', '#7a96b0'], pants: ['#4a5260', '#8a7a62', '#3a3f48', '#6a6f78', '#2e3440'], shoes: ['#3a2a1e', '#1e1a18', '#5a4632'] },
  mid: { skip: [10], coat: ['#6b5a44', '#4a4f55', '#7a3b2e', '#3c4a3a', '#8a7a5e', '#2f3640', '#5a4a3a'] },
};
const PEOPLE_DROP = new Set(['Viktor_7']);
function dropTris(g, test) {
  const P = g.attributes.position, N = g.attributes.normal, keep = [];
  for (let t = 0; t < P.count; t += 3) { const cy = Math.min(P.getY(t), P.getY(t + 1), P.getY(t + 2)); if (!test(cy)) keep.push(t); }
  const out = new THREE.BufferGeometry(), np = new Float32Array(keep.length * 9), nn = N ? new Float32Array(keep.length * 9) : null;
  keep.forEach((t, i) => { for (let v = 0; v < 3; v++) { np[i * 9 + v * 3] = P.getX(t + v); np[i * 9 + v * 3 + 1] = P.getY(t + v); np[i * 9 + v * 3 + 2] = P.getZ(t + v); if (nn) { nn[i * 9 + v * 3] = N.getX(t + v); nn[i * 9 + v * 3 + 1] = N.getY(t + v); nn[i * 9 + v * 3 + 2] = N.getZ(t + v); } } });
  out.setAttribute('position', new THREE.BufferAttribute(np, 3)); if (nn) out.setAttribute('normal', new THREE.BufferAttribute(nn, 3)); return out;
}
const hstr = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
export function preparePeople(sceneRoot, outfit = 'winter') {
  const out = [];
  for (const person of sceneRoot.children) {
    const prims = [];
    person.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(person.matrixWorld).invert();
    const H = hstr(person.name), O = OUTFIT[outfit]; let k = -1;
    const skip = new Set(O ? O.skip : []); if (outfit === 'mid') { if (H % 2) skip.add(9); if (H % 3 === 0) { skip.add(11); skip.add(12); } }
    person.traverse(m => {
      if (!m.isMesh) return; k++; if (skip.has(k)) return;
      if (PEOPLE_DROP.has(m.name)) return;
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      {
        g.computeBoundingBox(); const b0 = g.boundingBox, hc = PEOPLE_CFG.headCut, w0 = b0.max.x - b0.min.x, h0 = b0.max.y - b0.min.y;
        if (w0 < .3 && b0.max.y < hc - .12 && b0.min.y > 1.1 && h0 < .2) return;
        if (w0 < .3 && b0.min.y < hc - .15 && b0.max.y > hc - .05 && b0.max.y < hc + .15) g = dropTris(g, cy => cy < hc - .1);
      }
      if (!g.attributes.normal) g.computeVertexNormals();
      let c = (m.material.color || new THREE.Color(1, 1, 1)).clone(); const n = g.attributes.position.count, C = new Float32Array(n * 3);
      if (outfit === 'summer') { if (k === 2 || k === 3) c.set(O.shirt[H % O.shirt.length]); else if (k === 4) c.set(O.shirt[H % O.shirt.length]).multiplyScalar(.85); else if (k === 0) c.set(O.pants[(H >> 3) % O.pants.length]); else if (k === 1) c.set(O.shoes[(H >> 5) % O.shoes.length]); }
      else if (outfit === 'mid' && (k === 3 || k === 4)) { c.set(O.coat[H % O.coat.length]); if (k === 4) c.multiplyScalar(.8); }
      for (let i = 0; i < n; i++) { C[i * 3] = c.r; C[i * 3 + 1] = c.g; C[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(C, 3));
      g.computeBoundingBox();
      const bb = g.boundingBox, sx = bb.max.x - bb.min.x, sy = bb.max.y - bb.min.y, sz = bb.max.z - bb.min.z, C_ = PEOPLE_CFG;
      let force = null;
      if (bb.min.y > C_.headCut - .08) force = 'head';
      else if (bb.max.y < C_.headCut + .1 && bb.min.y > C_.legCut - .2 && sy < .25 && sx < .36) force = 'torso';
      else if (Math.max(sx, sy, sz) < .32 && sx < .36) { const cy = (bb.min.y + bb.max.y) / 2; force = cy > C_.headCut ? 'head' : cy < C_.legCut ? null : 'torso'; }
      prims.push({ geo: g, legsOK: bb.max.y < 1.06, force });
    });
    if (!prims.length) continue;
    const parts = splitParts(prims, PEOPLE_CFG);
    const raised = ['armL', 'armR'].some(k => { const g = parts[k]; if (!g || !g.attributes.position.count) return false; g.computeBoundingBox(); return g.boundingBox.max.y > .25 || g.boundingBox.min.y > -.4; });
    if (raised) continue;
    out.push({ name: person.name, female: PEOPLE_FEMALE.includes(person.name), parts, outfit });
  }
  return out;
}

// ---------- позы и анимация ----------
const JOINTS = ['hips', 'spine', 'neck', 'head', 'shL', 'shR', 'elL', 'elR', 'thL', 'thR', 'knL', 'knR'];
export class Human {
  constructor(look, staticModel) {
    this.L = look; this.R = buildHuman(look, staticModel); this.obj = this.R.root;
    this.anim = 'idle'; this.phase = Math.random() * 6; this.t = Math.random() * 10; this.expr = 'neutral';
    this.target = {}; for (const j of JOINTS) this.target[j] = new THREE.Euler();
    this.lookYaw = 0; this.lookPitch = 0; this.nextGlance = rnd(2, 6); this.blend = 7; this.speed = 0;
    this.obj.userData.human = this;
  }
  setAnim(a) { if (this.anim !== a) { this.anim = a; this.t = 0; } }
  update(dt, dist = 0, onStep) {
    const R = this.R, L = this.L, T = this.target, a = this.anim;
    this.t += dt;
    for (const j of JOINTS) T[j].set(0, 0, 0);
    let bob = 0, lean = L.stoop, sway = 0;
    const moving = a === 'walk' || a === 'run' || a === 'flee';
    if (moving) {
      const stride = R.stride * (a === 'walk' ? 1 : 1.5);
      const prev = this.phase; this.phase += (dist / stride) * Math.PI;
      if (onStep && Math.floor(prev / Math.PI) !== Math.floor(this.phase / Math.PI)) onStep();
      const p = this.phase, run = a !== 'walk', amp = run ? .76 : .44 * (L.age > 60 ? .74 : 1);
      const sL = Math.sin(p), cL = Math.cos(p);
      T.thL.x = sL * amp; T.thR.x = -sL * amp;
      T.knL.x = Math.max(0, -cL) * amp * (run ? 1.55 : 1.25) + (sL > 0 ? sL * .14 : .04);
      T.knR.x = Math.max(0,  cL) * amp * (run ? 1.55 : 1.25) + (-sL > 0 ? -sL * .14 : .04);
      const arm = (run ? .78 : .36) * (L.swagger > .5 ? 1.22 : 1) * (R.rigidArms ? .45 : 1);
      T.shL.x = -sL * arm; T.shR.x = sL * arm;
      T.elL.x = -(run ? 1.15 : .22 + Math.max(0, -sL) * .26);
      T.elR.x = -(run ? 1.15 : .22 + Math.max(0,  sL) * .26);
      T.shL.z = .035 + L.swagger * .04;
      T.shR.z = -.035 - L.swagger * .04;
      T.hips.y = -sL * .07;
      T.hips.z = cL * .022;
      T.spine.y = sL * (.06 + L.swagger * .09);
      bob = Math.abs(cL) * (run ? .048 : .024); lean += run ? .20 : .04; sway = sL * (.018 + L.swagger * .022);
      if (a === 'flee') { T.head.y = Math.sin(this.t * 3) * .4; }
    } else {
      const br = Math.sin(this.t * 1.7) * .018;
      T.spine.x = br;
      T.shL.z = .03 + Math.abs(Math.sin(this.t * .6)) * .015;
      T.shR.z = -.03 - Math.abs(Math.sin(this.t * .6)) * .015;
      T.shL.x = Math.sin(this.t * .9) * .025;
      T.shR.x = -Math.sin(this.t * .9) * .025;
      T.elL.x = -.16; T.elR.x = -.16;
      sway = Math.sin(this.t * .5) * .010; T.hips.z = Math.sin(this.t * .5) * .024;
      if (a === 'idle' || a === 'wait' || a === 'sit') { this.nextGlance -= dt; if (this.nextGlance < 0) { this.nextGlance = rnd(2, 5.5); this.lookYaw = rnd(-.65, .65); this.lookPitch = rnd(-.12, .10); } }
      if (a === 'wait' && (this.t % 9) > 6.8) { T.shL.x = -.95; T.elL.x = -1.45; T.shL.z = -.18; T.head.x = .32; this.lookYaw = .35; }
      if (a === 'wait') { T.thL.x = Math.max(0, Math.sin(this.t * 1.3)) * .09; T.knL.x = T.thL.x * 1.5; }
      if (a === 'warm') {
        T.shL.x = -.72 + Math.sin(this.t * 5) * .06; T.shR.x = -.72 - Math.sin(this.t * 5) * .06;
        T.shL.z = -.24; T.shR.z = .24;
        T.elL.x = -1.32 + Math.sin(this.t * 6.5) * .12; T.elR.x = -1.32 - Math.sin(this.t * 6.5) * .12;
        T.head.x = .18; lean += .06;
      }
      if (a === 'sit') {
        T.thL.x = -1.42; T.thR.x = -1.42;
        T.knL.x = 1.38;  T.knR.x = 1.38;
        T.shL.x = -.24 + Math.sin(this.t * .8) * .03;
        T.shR.x = -.24 + Math.cos(this.t * .8) * .03;
        T.elL.x = -.58;  T.elR.x = -.58;
        T.shL.z = -.04;  T.shR.z = .04;
        T.hips.z = 0; sway = Math.sin(this.t * .7) * .006;
        bob = -.36;
      }
      if (a === 'inspect') { lean += .16; T.head.x = .28; T.shR.x = -.68; T.elR.x = -1.38; T.shR.z = .12; this.lookYaw = Math.sin(this.t * .7) * .32; this.lookPitch = .16; }
      if (a === 'talk') {
        T.shR.x = -.52 + Math.sin(this.t * 3.8) * .26; T.elR.x = -.92 + Math.sin(this.t * 4.9) * .24; T.shR.z = .06;
        T.shL.x = -.26 + Math.cos(this.t * 3.1) * .16; T.elL.x = -.52 + Math.cos(this.t * 4.2) * .15; T.shL.z = -.06;
        T.head.x = Math.sin(this.t * 3.1) * .07; this.lookYaw *= .9;
      }
      if (a === 'pay' || a === 'receive') { T.shR.x = -1.15; T.elR.x = -.42; T.shR.z = .05; if (a === 'receive') { T.shL.x = -1.05; T.elL.x = -.45; T.shL.z = -.05; } lean += .08; }
      if (a === 'count') { T.shL.x = -.82; T.elL.x = -1.15; T.shR.x = -.82; T.elR.x = -1.25 + Math.sin(this.t * 9) * .15; T.head.x = .42; }
      if (a === 'threaten') { T.shR.x = -1.45 + Math.sin(this.t * 6) * .22; T.elR.x = -1.25; T.shR.z = .12; lean += .14; T.head.x = -.08; T.shL.x = -.55; T.shL.z = -.14; T.elL.x = -.95; }
      if (a === 'brawl') {
        const wv = Math.sin(this.t * 5.2), wc = Math.cos(this.t * 5.2);
        T.shL.x = -.72 + wv * .06; T.shL.y = -.18; T.shL.z = -.10; T.elL.x = -1.28 + wc * .05;
        T.shR.x = -.78 - wv * .06; T.shR.y =  .18; T.shR.z =  .10; T.elR.x = -1.32 - wc * .05;
        T.thL.x = -.08; T.knL.x = .18;
        T.thR.x =  .06; T.knR.x = .14;
        T.spine.y = wv * .06;
        lean += .10;
        sway = wc * .024;
        bob = -Math.abs(wv) * .022;
        T.head.x = -.06;
      }
      if (a === 'brawl_block') {
        T.shL.x = -.94; T.shL.y = -.24; T.shL.z = -.12; T.elL.x = -1.45;
        T.shR.x = -.94; T.shR.y =  .24; T.shR.z =  .12; T.elR.x = -1.45;
        T.thL.x = -.08; T.knL.x = .20;
        T.thR.x =  .06; T.knR.x = .16;
        lean += .12;
        bob = -.02;
        T.head.x = .08;
      }
      if (a === 'smoke') { const k = (this.t % 6.2) < 2.2 ? 1 : 0; T.shR.x = -.26 - k * 1.02; T.elR.x = -.45 - k * 1.42; T.shR.z = .08 + k * .16; T.shL.x = .06; T.elL.x = -.28; T.shL.z = -.05; }
      if (a === 'handsUp') { T.shL.x = -2.85; T.shR.x = -2.85; T.shL.z = .25; T.shR.z = -.25; T.elL.x = -.45; T.elR.x = -.45; lean -= .05; this.lookYaw = 0; }
      if (a === 'scared') { lean -= .15; T.shL.x = -1.35; T.shR.x = -1.35; T.elL.x = -1.55; T.elR.x = -1.55; T.shL.z = -.18; T.shR.z = .18; T.head.x = .25; T.thL.x = .15; T.knL.x = .3; }
      if (a === 'pocket') { T.shL.x = .12; T.shR.x = .12; T.elL.x = -.52; T.elR.x = -.52; T.shL.z = -.14; T.shR.z = .14; }
    }
    if (this.umbrella && a !== 'handsUp' && a !== 'scared') { T.shR.x = -.42; T.shR.z = .08; T.elR.x = -1.45; }
    const dmgK = clamp(1 - (this.hpRatio ?? 1), 0, 1);
    const exhK = clamp(1 - (this.stamRatio ?? 1), 0, 1);
    if (R.damage) R.damage.setLevel(dmgK);
    if (dmgK > .04 || exhK > .12) {
      const pantFreq = 6.5 + exhK * 6.5 + dmgK * 4.0;
      const pantAmp = exhK * .055 + dmgK * .045;
      const pantWave = Math.sin(this.t * pantFreq);
      T.spine.x += pantWave * pantAmp + dmgK * .24 + exhK * .12;
      T.shL.x += pantWave * pantAmp * .8;
      T.shR.x += pantWave * pantAmp * .8;
      T.head.x += dmgK * .16 + Math.cos(this.t * pantFreq) * pantAmp * .6;
      const stagger = Math.sin(this.t * 2.85 + this.phase * .5) * (exhK * .095 + dmgK * .11);
      sway += stagger;
      T.hips.z += stagger * .65;
      T.spine.z = (T.spine.z || 0) + stagger * .85;
    }
    if (a !== 'handsUp' && a !== 'scared') { T.neck.y = this.lookYaw * .4; T.head.y = this.lookYaw * .6 - T.spine.y * .45; T.head.x += this.lookPitch; }
    T.spine.x += lean;
    if (R.root.userData.static && !R.sds && a !== 'handsUp' && a !== 'scared') for (const j of ['shL', 'shR']) { T[j].x = Math.max(-.45, Math.min(.35, T[j].x)); T[j].z = Math.max(-.2, Math.min(.2, T[j].z)); }
    const k = 1 - Math.exp(-this.blend * dt);
    for (const j of JOINTS) { const o = R[j]; if (!o) continue; const tg = T[j]; o.rotation.x += (tg.x - o.rotation.x) * k; o.rotation.y += (tg.y - o.rotation.y) * k; o.rotation.z += (tg.z - o.rotation.z) * k; }
    R.body.position.y += (bob - R.body.position.y) * Math.min(1, dt * 20); R.body.rotation.z += (sway - R.body.rotation.z) * k;
    if (R.skirt) R.skirt.rotation.x = -(R.thL.rotation.x + R.thR.rotation.x) * .15;
    this.updateFace(dt);
  }
  setExpr(e) { this.expr = e; }
  updateFace(dt) {
    const F = this.R.face; if (!F) return;
    const e = this.expr, k = Math.min(1, dt * 8);
    const tg = { neutral: [1, 1, 0, 0], smile: [1.2, .8, .1, 0], angry: [1.1, .9, -.35, -.04], scared: [.6, 3.2, .3, .03], talk: [1, 1 + Math.abs(Math.sin(this.t * 14)) * 2.5, 0, 0], tired: [.9, .8, .15, -.02] }[e] || [1, 1, 0, 0];
    F.mouth.scale.x += (tg[0] * this.R.head.children[0].scale.x * .4 / 1 - F.mouth.scale.x) * 0;
    const base = F.mouth.userData.base || (F.mouth.userData.base = F.mouth.scale.clone());
    F.mouth.scale.x += (base.x * tg[0] - F.mouth.scale.x) * k; F.mouth.scale.y += (base.y * tg[1] - F.mouth.scale.y) * k;
    F.browL.rotation.z += (tg[2] - F.browL.rotation.z) * k; F.browR.rotation.z += (-tg[2] - F.browR.rotation.z) * k;
    const by = F.browL.userData.y ?? (F.browL.userData.y = F.browL.position.y);
    F.browL.position.y = F.browR.position.y = by + tg[3];
    const bl = (this.t % 4.3) < .12 ? .15 : 1; F.eyeL.scale.y = F.eyeR.scale.y = (F.eyeL.userData.sy ?? (F.eyeL.userData.sy = F.eyeL.scale.y)) * bl;
  }
}
