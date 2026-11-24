// Ragdoll на verlet-частицах: точки тела берутся из текущей позы скелета Human,
// дальше — гравитация, связи-«кости», высокое трение тяжёлого тела о землю и коллайдеры; результат обратно раскладывается на суставы.
import * as THREE from 'three';

const DOWN = new THREE.Vector3(0, -1, 0), UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _fwd = new THREE.Vector3(), _hipOff = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _bodyQ = new THREE.Quaternion(), _m = new THREE.Matrix4(), _idQ = new THREE.Quaternion();
// индексы частиц
const PELV = 0, CHEST = 1, HEAD = 2, HIPL = 3, HIPR = 4, KNL = 5, KNR = 6, FTL = 7, FTR = 8, SHL = 9, SHR = 10, ELL = 11, ELR = 12, HDL = 13, HDR = 14;
const TORSO = [PELV, CHEST, HIPL, HIPR, SHL, SHR];

export class Ragdoll {
  // h — Human; impulse — вектор удара (м/с); hitY — высота попадания; blocked(x,z) — препятствия
  constructor(h, impulse, hitY, blocked) {
    this.h = h; this.blocked = blocked; this.t = 0; this.sleep = 0;
    const R = h.R;
    // Естественная расслабленная поза конечностей перед созданием частиц Ragdoll
    R.body.position.set(0, 0, 0); R.body.rotation.set(0, 0, 0);
    R.hips.position.set(0, R.legLen || .88, 0);
    for (const k of ['hips', 'spine', 'neck', 'head', 'thL', 'thR', 'knL', 'knR', 'shL', 'shR', 'elL', 'elR']) {
      if (R[k]) R[k].rotation.set(0, 0, 0);
    }
    if (R.thL) R.thL.rotation.set(-.22, 0, -.12);
    if (R.thR) R.thR.rotation.set(-.12, 0,  .14);
    if (R.knL) R.knL.rotation.set( .34, 0, 0);
    if (R.knR) R.knR.rotation.set( .22, 0, 0);
    if (R.shL) R.shL.rotation.set(-.18, 0, -.28);
    if (R.shR) R.shR.rotation.set( .14, 0,  .32);
    if (R.elL) R.elL.rotation.set(-.38, 0, 0);
    if (R.elR) R.elR.rotation.set(-.30, 0, 0);
    h.obj.updateMatrixWorld(true);
    const wp = (o, y = 0) => o.localToWorld(new THREE.Vector3(0, y, 0));
    const shin = R.knL.position.length() || .45, fore = R.elL.position.length() || .3;
    this.p = [wp(R.hips), wp(R.neck), wp(R.head, .12), wp(R.thL), wp(R.thR), wp(R.knL), wp(R.knR), wp(R.knL, -shin), wp(R.knR, -shin), wp(R.shL), wp(R.shR), wp(R.elL), wp(R.elR), wp(R.elL, -fore), wp(R.elR, -fore)];
    this.o = this.p.map(v => v.clone());
    // Умеренный импульс тяжёлому 80-килограммовому телу (чтобы тело тяжело падало на землю, а не улетало как пушинка)
    this.p.forEach((v, i) => {
      const k = (.38 + .24 * clamp(v.y / 1.7, 0, 1)) * (i === FTL || i === FTR ? .35 : 1);
      this.o[i].addScaledVector(impulse, -k / 60);
    });
    const C = [];
    const link = (a, b, stiff = 1) => C.push([a, b, this.p[a].distanceTo(this.p[b]), stiff]);
    for (let i = 0; i < TORSO.length; i++) for (let j = i + 1; j < TORSO.length; j++) link(TORSO[i], TORSO[j]);
    link(CHEST, HEAD); link(SHL, HEAD, .6); link(SHR, HEAD, .6);
    link(HIPL, KNL); link(KNL, FTL); link(HIPR, KNR); link(KNR, FTR);
    link(HIPL, FTL, .42); link(HIPR, FTR, .42);
    link(CHEST, KNL, .80); link(CHEST, KNR, .80);
    link(KNL, KNR, .55); link(FTL, FTR, .45);
    link(SHL, ELL); link(ELL, HDL); link(SHR, ELR); link(ELR, HDR);
    link(SHL, HDL, .72); link(SHR, HDR, .72);
    this.C = C;
    this.minD = [[FTL, PELV, .72], [FTR, PELV, .72], [KNL, KNR, .15], [FTL, FTR, .14], [HDL, CHEST, .24], [HDR, CHEST, .24], [HEAD, PELV, .52]];
    this.shin = shin; this.fore = fore;
    R.body.position.set(0, 0, 0); R.body.rotation.set(0, 0, 0);
    h.obj.children.forEach(ch => { if (ch !== R.body) ch.visible = false; });
    if (R.elR) R.elR.children.forEach(ch => { if (ch.type === "Group") ch.visible = false; });
  }
  step(dt) {
    this.t += dt; if (this.grab) this.sleep = 0; if (this.sleep > 1.0) return false;
    const G = this.grab;
    const n = Math.max(1, Math.ceil(dt / (1 / 60))), h = Math.min(dt, .05) / n, P = this.p, O = this.o;
    let moved = 0;
    for (let s = 0; s < n; s++) {
      for (let i = 0; i < P.length; i++) {
        const p = P[i], o = O[i];
        // Высокое трение о пол/землю (0.48 на земле) и ограничение максимальной скорости частицы, чтобы тело ощущалось тяжёлым!
        const onGround = p.y < .22;
        _v.subVectors(p, o).multiplyScalar(onGround ? .48 : (G && G.idx.includes(i)) ? .80 : .96);
        const vLen = _v.length();
        const maxStep = onGround ? .018 : .085;
        if (vLen > maxStep) _v.multiplyScalar(maxStep / vLen);
        o.copy(p); p.add(_v); p.y -= 13.5 * h * h; moved += _v.lengthSq();
      }
      if (!G && P[CHEST].y > .55) {
        _a.set(P[CHEST].x - (P[FTL].x + P[FTR].x) * .5, 0, P[CHEST].z - (P[FTL].z + P[FTR].z) * .5); let L = _a.length();
        if (L < .03) { _a.set(Math.cos(this.t * 7.3 + 1), 0, Math.sin(this.t * 7.3 + 1)); L = 1; }
        _a.multiplyScalar(.0022 / L); P[CHEST].add(_a); P[HEAD].add(_a); P[SHL].add(_a); P[SHR].add(_a);
        P[KNL].y -= .0012; P[KNR].y -= .0012;
      }
      for (let it = 0; it < 6; it++) {
        for (const [a, b, d, k] of this.C) { const A = P[a], B = P[b]; _a.subVectors(B, A); const L = _a.length() || 1e-4, diff = (L - d) / L * .5 * k; A.addScaledVector(_a, diff); B.addScaledVector(_a, -diff); }
        for (const [a, b, d] of this.minD) { const A = P[a], B = P[b]; _a.subVectors(B, A); const L = _a.length() || 1e-4; if (L < d) { const diff = (L - d) / L * .5; A.addScaledVector(_a, diff); B.addScaledVector(_a, -diff); } }
        // хват: руки тянут точки тела к цели, но сила рук ограничена — остальное тело (≈75 кг) висит и волочится
        if (G) for (let g = 0; g < G.idx.length; g++) { const A = P[G.idx[g]]; _a.subVectors(G.tgt[g], A); const L = _a.length(); if (L > G.str) _a.multiplyScalar(G.str / L); A.addScaledVector(_a, G.k); }
        for (let i = 0; i < P.length; i++) {
          const p = P[i];
          // Внутри ларька деревянный пол находится на высоте y = 0.035; поднимаем радиус опоры, чтобы тело никогда не утопало в досках пола!
          const inKioskFloor = Math.abs(p.x) < 1.54 && Math.abs(p.z) < 1.24;
          const floorBase = inKioskFloor ? .055 : .020;
          const r = floorBase + (i === HEAD ? .13 : i === PELV || i === CHEST ? .15 : .105);
          if (p.y < r) {
            p.y = r;
            // Гасим горизонтальное скольжение при контакте с полом
            O[i].x = p.x + (O[i].x - p.x) * .55;
            O[i].z = p.z + (O[i].z - p.z) * .55;
          }
          if (this.blocked) this.blocked(p, O[i], .12, i);
        }
      }
    }
    this.sleep = (moved / n < 2e-6 && (P[CHEST].y < .5 || this.t > 8)) ? this.sleep + dt : 0;
    this.apply(); return true;
  }
  apply() {
    const R = this.h.R, P = this.p, obj = this.h.obj;
    const up = _a.subVectors(P[CHEST], P[PELV]).normalize(), right = _b.subVectors(P[HIPL], P[HIPR]).add(_v.subVectors(P[SHL], P[SHR])).normalize();
    right.addScaledVector(up, -right.dot(up)).normalize(); _fwd.crossVectors(right, up);
    _m.makeBasis(right, up, _fwd); _bodyQ.setFromRotationMatrix(_m);
    obj.quaternion.copy(_bodyQ); if (obj.parent) obj.quaternion.premultiply(obj.parent.getWorldQuaternion(_pq).invert());
    R.hips.rotation.set(0, 0, 0); R.spine.rotation.set(0, 0, 0);
    _hipOff.copy(R.hips.position).add(R.body.position).applyQuaternion(_bodyQ);
    obj.position.copy(P[PELV]).sub(_hipOff); if (obj.parent) obj.parent.worldToLocal(obj.position);
    obj.updateMatrixWorld(true);
    const bone = (j, from, to, maxAng = .36) => {
      const o = R[j]; if (!o) return;
      o.parent.getWorldQuaternion(_pq);
      _v.subVectors(P[to], P[from]).normalize();
      _q.setFromUnitVectors(DOWN, _v);
      o.quaternion.copy(_pq.invert().multiply(_q));
      const ang = 2 * Math.acos(Math.min(1, Math.abs(o.quaternion.w)));
      if (ang > maxAng && ang > 1e-4) {
        o.quaternion.slerp(_idQ, 1 - maxAng / ang);
      }
      o.updateMatrixWorld(true);
    };
    bone('thL', HIPL, KNL, .44); bone('knL', KNL, FTL, .48);
    bone('thR', HIPR, KNR, .44); bone('knR', KNR, FTR, .48);
    bone('shL', SHL, ELL, .52);  bone('elL', ELL, HDL, .48);
    bone('shR', SHR, ELR, .52);  bone('elR', ELR, HDR, .48);
    if (R.neck) {
      R.neck.parent.getWorldQuaternion(_pq);
      _v.subVectors(P[HEAD], P[CHEST]).normalize();
      _q.setFromUnitVectors(UP, _v);
      R.neck.quaternion.copy(_pq.invert().multiply(_q));
      const ang = 2 * Math.acos(Math.min(1, Math.abs(R.neck.quaternion.w)));
      if (ang > .28) R.neck.quaternion.slerp(_idQ, 1 - .28 / ang);
      if (R.head) R.head.rotation.set(0, 0, 0);
    }
  }
  startFade() {
    if (this.fadeMats) return; this.fadeMats = [];
    this.h.obj.traverse(o => { if (!o.isMesh) return; const ms = Array.isArray(o.material) ? o.material : [o.material]; const cl = ms.map(m => { const c = m.clone(); c.transparent = true; c.depthWrite = false; this.fadeMats.push(c); return c; }); o.material = Array.isArray(o.material) ? cl : cl[0]; o.castShadow = false; });
  }
  setFade(a) { for (const m of this.fadeMats || []) m.opacity = a; }
  dispose() { for (const m of this.fadeMats || []) m.dispose(); }
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
