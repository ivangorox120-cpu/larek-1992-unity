// Оптимизированная интерактивная 3D-модель холодильника «ЗИЛ-Москва КХ-240»
// Автоматическое слияние статичных мешей по материалам + мобильные текстуры + полные анимации и механики.

export function createZilFridge(THREE, mergeGeometries, opts = {}) {
  const isMobile = !!opts.isMobile;
  const liteMode = !!opts.lite;
  const maxAniso = Math.min(opts.maxAniso || 4, isMobile ? 2 : 4);
  const regTex = opts.regTex || (t => t);

  // =========================================================================
  // 1. SYNTHESIZED SOUND ENGINE (Web Audio API)
  // =========================================================================
      const SoundEngine = {
        ctx: null,
        enabled: false,
        humOsc1: null,
        humOsc2: null,
        humGain: null,

        init() {
          if (this.ctx) return;
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) return;
          this.ctx = new AudioCtx();

          this.humGain = this.ctx.createGain();
          this.humGain.gain.value = 0.0;
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 175;

          this.humOsc1 = this.ctx.createOscillator();
          this.humOsc1.type = 'sawtooth';
          this.humOsc1.frequency.value = 50;

          this.humOsc2 = this.ctx.createOscillator();
          this.humOsc2.type = 'triangle';
          this.humOsc2.frequency.value = 100.4;

          this.humOsc1.connect(filter);
          this.humOsc2.connect(filter);
          filter.connect(this.humGain);
          this.humGain.connect(this.ctx.destination);
          this.humOsc1.start();
          this.humOsc2.start();
        },

        toggle() {
          this.init();
          if (!this.ctx) return false;
          if (this.ctx.state === 'suspended') this.ctx.resume();
          this.enabled = !this.enabled;
          this.updateHum(state.compressorRunning, state.thermostat);
          return this.enabled;
        },

        ensureStartedOnGesture() {
          if (this.enabled && this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
        },

        updateHum(running, thermo) {
          if (!this.ctx || !this.humGain) return;
          const now = this.ctx.currentTime;
          const target = (this.enabled && running && thermo > 0) ? (0.024 + thermo * 0.004) : 0.0;
          this.humGain.gain.cancelScheduledValues(now);
          this.humGain.gain.setTargetAtTime(target, now, 0.25);
        },

        playLatchClick(locked) {
          if (!this.enabled || !this.ctx) return;
          const now = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(locked ? 1150 : 620, now);
          osc.frequency.exponentialRampToValueAtTime(locked ? 480 : 180, now + 0.06);
          gain.gain.setValueAtTime(0.16, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now);
          osc.stop(now + 0.08);
        },

        playRubberPeel() {
          if (!this.enabled || !this.ctx) return;
          const now = this.ctx.currentTime;
          const len = Math.floor(this.ctx.sampleRate * 0.14);
          const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
          const d = buf.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.35));
          const src = this.ctx.createBufferSource();
          src.buffer = buf;
          const f = this.ctx.createBiquadFilter();
          f.type = 'bandpass';
          f.frequency.setValueAtTime(320, now);
          f.frequency.linearRampToValueAtTime(840, now + 0.12);
          f.Q.value = 2.4;
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.14, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
          src.connect(f); f.connect(g); g.connect(this.ctx.destination);
          src.start(now);
        },

        playDoorSlam(intensity) {
          if (!this.enabled || !this.ctx) return;
          const vol = Math.min(1.0, Math.max(0.15, intensity));
          const now = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(112 + vol * 28, now);
          osc.frequency.exponentialRampToValueAtTime(35, now + 0.19);
          g.gain.setValueAtTime(0.42 * vol, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
          osc.connect(g); g.connect(this.ctx.destination);
          osc.start(now); osc.stop(now + 0.25);
          this.playLatchClick(false);
        },

        playRelayClunk() {
          if (!this.enabled || !this.ctx) return;
          const now = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(210, now);
          osc.frequency.exponentialRampToValueAtTime(70, now + 0.04);
          g.gain.setValueAtTime(0.11, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          osc.connect(g); g.connect(this.ctx.destination);
          osc.start(now); osc.stop(now + 0.06);
        },

        playDrawerSlide() {
          if (!this.enabled || !this.ctx) return;
          const now = this.ctx.currentTime;
          const len = Math.floor(this.ctx.sampleRate * 0.22);
          const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
          const d = buf.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI);
          const src = this.ctx.createBufferSource();
          src.buffer = buf;
          const f = this.ctx.createBiquadFilter();
          f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 1.4;
          const g = this.ctx.createGain(); g.gain.value = 0.08;
          src.connect(f); f.connect(g); g.connect(this.ctx.destination);
          src.start(now);
        }
      };


  // =========================================================================
  // 2. STATE
  // =========================================================================
  const state = {
    doorAngle: 0,
    doorVel: 0,
    doorTarget: 0,
    doorAutoSpring: true,
    locked: false,
    keyAngle: 0,
    keyTarget: 0,
    freezerOpen: false,
    freezerAngle: 0,
    freezerVel: 0,
    drawerOpen: false,
    drawerPos: 0,
    drawerVel: 0,
    chassisShakeX: 0,
    chassisShakeZ: 0,
    chassisShakeVelX: 0,
    chassisShakeVelZ: 0,
    thermostat: 4,
    compressorRunning: true,
    chamberTemp: 4.5,
    freezerTemp: -12.0,
    frostLevel: 0.60,
    defrosting: false,
    lampOn: false,
    enamelColor: '#dad0bc',
    wearLevel: 0.55
  };

  // =========================================================================
  // 3. PROCEDURAL TEXTURES
  // =========================================================================
      function finalizeTexture(canvas, repeatX = 1, repeatY = 1) {
        const tex = new THREE.CanvasTexture(canvas);
        tex.encoding = THREE.SRGBColorSpace;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.anisotropy = maxAniso;
        if (repeatX !== 1 || repeatY !== 1) {
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(repeatX, repeatY);
        }
        tex.needsUpdate = true;
        return tex;
      }

      function createEnamelTextures(hexColor, wear) {
        const size = isMobile ? 512 : 1024;
        const diffCanvas = document.createElement('canvas');
        diffCanvas.width = diffCanvas.height = size;
        const dctx = diffCanvas.getContext('2d');

        const roughCanvas = document.createElement('canvas');
        roughCanvas.width = roughCanvas.height = size;
        const rctx = roughCanvas.getContext('2d');

        // Smooth warm satin light-beige enamel (zero pixel noise -> zero shimmer)
        dctx.fillStyle = hexColor;
        dctx.fillRect(0, 0, size, size);

        const baseR = Math.floor(66 + wear * 16);
        rctx.fillStyle = `rgb(${baseR},${baseR},${baseR})`;
        rctx.fillRect(0, 0, size, size);

        // Subtle organic rust strictly hugging perimeter edges & bottom corners (normalized [0..1] UVs)
        if (wear > 0.02) {
          const wA = Math.min(1.0, wear * 1.15);

          // Bottom edge rim
          const botG = dctx.createLinearGradient(0, size * 0.88, 0, size);
          botG.addColorStop(0.0, 'rgba(138, 88, 48, 0)');
          botG.addColorStop(0.65, `rgba(142, 92, 52, ${0.36 * wA})`);
          botG.addColorStop(1.0, `rgba(104, 60, 30, ${0.74 * wA})`);
          dctx.fillStyle = botG;
          dctx.fillRect(0, size * 0.88, size, size * 0.12);

          // Top, left, right subtle perimeter oxidation
          const topG = dctx.createLinearGradient(0, 0, 0, size * 0.05);
          topG.addColorStop(0.0, `rgba(120, 76, 42, ${0.36 * wA})`);
          topG.addColorStop(1.0, 'rgba(120, 76, 42, 0)');
          dctx.fillStyle = topG;
          dctx.fillRect(0, 0, size, size * 0.05);

          const leftG = dctx.createLinearGradient(0, 0, size * 0.05, 0);
          leftG.addColorStop(0.0, `rgba(122, 78, 42, ${0.38 * wA})`);
          leftG.addColorStop(1.0, 'rgba(122, 78, 42, 0)');
          dctx.fillStyle = leftG;
          dctx.fillRect(0, 0, size * 0.05, size);

          const rightG = dctx.createLinearGradient(size * 0.95, 0, size, 0);
          rightG.addColorStop(0.0, 'rgba(122, 78, 42, 0)');
          rightG.addColorStop(1.0, `rgba(122, 78, 42, ${0.38 * wA})`);
          dctx.fillStyle = rightG;
          dctx.fillRect(size * 0.95, 0, size * 0.05, size);

          // Soft corner rust washes (bottom-right & bottom-left)
          const brGrad = dctx.createRadialGradient(size * 0.97, size * 0.97, 8, size * 0.92, size * 0.92, size * 0.24);
          brGrad.addColorStop(0.0, `rgba(112, 64, 32, ${0.78 * wA})`);
          brGrad.addColorStop(0.45, `rgba(156, 108, 68, ${0.46 * wA})`);
          brGrad.addColorStop(0.80, `rgba(182, 142, 104, ${0.14 * wA})`);
          brGrad.addColorStop(1.0, 'rgba(182, 142, 104, 0)');
          dctx.fillStyle = brGrad;
          dctx.fillRect(0, 0, size, size);

          const blGrad = dctx.createRadialGradient(size * 0.03, size * 0.97, 8, size * 0.08, size * 0.93, size * 0.19);
          blGrad.addColorStop(0.0, `rgba(122, 74, 38, ${0.62 * wA})`);
          blGrad.addColorStop(0.50, `rgba(164, 118, 78, ${0.28 * wA})`);
          blGrad.addColorStop(1.0, 'rgba(164, 118, 78, 0)');
          dctx.fillStyle = blGrad;
          dctx.fillRect(0, 0, size, size);

          // Matte roughness on rusted edges
          rctx.fillStyle = `rgba(220,220,220,${0.65 * wA})`;
          rctx.fillRect(0, size * 0.93, size, size * 0.07);
          rctx.fillRect(0, 0, size * 0.03, size);
          rctx.fillRect(size * 0.97, 0, size * 0.03, size);
        }

        const map = finalizeTexture(diffCanvas);
        const roughnessMap = new THREE.CanvasTexture(roughCanvas);
        roughnessMap.generateMipmaps = true;
        roughnessMap.minFilter = THREE.LinearMipmapLinearFilter;
        roughnessMap.magFilter = THREE.LinearFilter;
        roughnessMap.anisotropy = maxAniso;
        roughnessMap.needsUpdate = true;
        return { map, roughnessMap };
      }

      function createZilRedPlaqueTexture() {
        const c = document.createElement('canvas');
        c.width = 256; c.height = 96;
        const ctx = c.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, 0, 96);
        g.addColorStop(0, '#c81d25');
        g.addColorStop(0.5, '#b0121b');
        g.addColorStop(1, '#8c0d14');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 256, 96);
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, 248, 88);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'italic 900 62px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
        ctx.fillText('ЗиЛ', 128, 50);
        return finalizeTexture(c);
      }

      function createMoskvaBarTexture() {
        const c = document.createElement('canvas');
        c.width = 768; c.height = 112;
        const ctx = c.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, 0, 112);
        g.addColorStop(0, '#dad7cf');
        g.addColorStop(0.4, '#c2beb3');
        g.addColorStop(0.7, '#aeaa9e');
        g.addColorStop(1, '#d4d1c9');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 768, 112);
        ctx.strokeStyle = '#f5f7f8';
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, 760, 104);
        [32, 56, 80].forEach(ry => {
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(22, ry - 4, 152, 5);
          ctx.fillRect(594, ry - 4, 152, 5);
          ctx.fillStyle = '#5c5850';
          ctx.fillRect(22, ry + 1, 152, 3);
          ctx.fillRect(594, ry + 1, 152, 3);
        });
        ctx.font = '700 44px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ['М', 'О', 'С', 'К', 'В', 'А'].forEach((ch, idx) => {
          const lx = 216 + idx * 67;
          ctx.fillStyle = 'rgba(45,42,36,0.7)';
          ctx.fillText(ch, lx + 2, 60);
          ctx.fillStyle = '#f8fafc';
          ctx.fillText(ch, lx, 57);
        });
        return finalizeTexture(c);
      }

      function createMasloBoxTexture() {
        const c = document.createElement('canvas');
        c.width = 384; c.height = 256;
        const ctx = c.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, 0, 256);
        g.addColorStop(0, '#dfd6c2');
        g.addColorStop(1, '#c8bba1');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 384, 256);
        ctx.font = '700 28px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillText('М  А  С  Л  О', 193, 98);
        ctx.fillStyle = 'rgba(130,120,105,0.58)';
        ctx.fillText('М  А  С  Л  О', 192, 96);
        for (let i = 0; i < 5; i++) {
          const y = 166 + i * 16;
          ctx.fillStyle = '#5c5247';
          ctx.fillRect(10, y, 364, 5);
          ctx.fillStyle = '#f5f2ea';
          ctx.fillRect(10, y + 5, 364, 3);
        }
        return finalizeTexture(c);
      }

      function createFreezerDoorTexture() {
        const c = document.createElement('canvas');
        c.width = 512; c.height = 256;
        const ctx = c.getContext('2d');
        // Aged warm vintage Soviet cream plastic
        const g = ctx.createLinearGradient(0, 0, 0, 256);
        g.addColorStop(0, '#ddd5c4');
        g.addColorStop(0.30, '#d6cdb9');
        g.addColorStop(0.34, '#bfb49d'); // horizontal molded groove shadow (like 7705.jpg)
        g.addColorStop(0.37, '#e4ddcf'); // groove highlight
        g.addColorStop(1, '#cec3ac');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 512, 256);

        // Soft age patina toward corners
        const rg = ctx.createRadialGradient(256, 128, 70, 256, 128, 290);
        rg.addColorStop(0, 'rgba(130,96,56,0)');
        rg.addColorStop(1, 'rgba(116,84,48,0.22)');
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, 512, 256);

        // Subtle embossed «ЗИЛ · МОСКВА» along lower right (like 7705.jpg)
        ctx.font = '600 18px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillText('З И Л   М О С К В А', 466, 214);
        ctx.fillStyle = 'rgba(110,98,82,0.55)';
        ctx.fillText('З И Л   М О С К В А', 465, 212);

        return finalizeTexture(c);
      }

      function createThermostatDialTexture() {
        const c = document.createElement('canvas');
        c.width = 256; c.height = 256;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#e5dfd2';
        ctx.fillRect(0, 0, 256, 256);
        ctx.strokeStyle = '#9c9282';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(128, 128, 114, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#4a4035';
        ctx.font = 'bold 20px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i <= 7; i++) {
          const a = -Math.PI * 1.25 + (i / 7) * Math.PI * 1.5;
          ctx.fillText(String(i), 128 + Math.cos(a) * 94, 128 + Math.sin(a) * 94);
        }
        return finalizeTexture(c);
      }

      function createAgedInteriorTexture(baseHex, grimeStrength = 0.65) {
        const size = isMobile ? 256 : 512;
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const ctx = c.getContext('2d');

        // Warm yellowed vintage Soviet enamel/plastic base
        ctx.fillStyle = baseHex;
        ctx.fillRect(0, 0, size, size);

        // Soft warm age-yellowing gradient (darker toward bottom & edges like 7705.jpg)
        const vGrad = ctx.createLinearGradient(0, 0, 0, size);
        vGrad.addColorStop(0.0, `rgba(170, 142, 98, ${0.08 * grimeStrength})`);
        vGrad.addColorStop(0.65, `rgba(150, 118, 76, ${0.14 * grimeStrength})`);
        vGrad.addColorStop(1.0, `rgba(116, 82, 46, ${0.38 * grimeStrength})`);
        ctx.fillStyle = vGrad;
        ctx.fillRect(0, 0, size, size);

        // Soft brownish-tan age vignette around seams & corners
        const radG = ctx.createRadialGradient(size / 2, size / 2, size * 0.20, size / 2, size / 2, size * 0.72);
        radG.addColorStop(0.0, 'rgba(130, 96, 56, 0)');
        radG.addColorStop(1.0, `rgba(118, 84, 48, ${0.32 * grimeStrength})`);
        ctx.fillStyle = radG;
        ctx.fillRect(0, 0, size, size);

        // Subtle aged water/rusty-brown condensation smudges & scuffs (baked smooth, no pixel shimmer)
        const smudges = [
          { x: 0.16, y: 0.86, rx: 56, ry: 22, a: 0.24 },
          { x: 0.82, y: 0.88, rx: 64, ry: 26, a: 0.28 },
          { x: 0.48, y: 0.94, rx: 110, ry: 18, a: 0.26 },
          { x: 0.12, y: 0.48, rx: 28, ry: 55, a: 0.16 },
          { x: 0.88, y: 0.32, rx: 24, ry: 48, a: 0.15 },
          { x: 0.62, y: 0.56, rx: 45, ry: 18, a: 0.12 },
          { x: 0.30, y: 0.22, rx: 42, ry: 16, a: 0.11 }
        ];
        smudges.forEach(s => {
          const g = ctx.createRadialGradient(s.x * size, s.y * size, 2, s.x * size, s.y * size, Math.max(s.rx, s.ry));
          g.addColorStop(0.0, `rgba(112, 78, 44, ${s.a * grimeStrength})`);
          g.addColorStop(1.0, 'rgba(112, 78, 44, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(s.x * size, s.y * size, s.rx, s.ry, 0, 0, Math.PI * 2);
          ctx.fill();
        });

        // A few delicate dark scuff marks from decades of pots & jars
        ctx.strokeStyle = `rgba(92, 76, 58, ${0.22 * grimeStrength})`;
        ctx.lineWidth = 2;
        [[70, 390, 125, 396], [310, 420, 370, 412], [180, 290, 220, 294], [380, 190, 425, 196]].forEach(([x1, y1, x2, y2]) => {
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        });

        return finalizeTexture(c);
      }

      function createFrostTexture() {
        const c = document.createElement('canvas');
        c.width = 256; c.height = 256;
        const ctx = c.getContext('2d');
        const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 180);
        g.addColorStop(0, '#eaf4fb');
        g.addColorStop(1, '#cde2f0');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 450; i++) {
          const x = Math.random() * 256, y = Math.random() * 256;
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          ctx.beginPath();
          ctx.arc(x, y, 2 + Math.random() * 6, 0, Math.PI * 2);
          ctx.fill();
        }
        return finalizeTexture(c, 2, 2);
      }

      function createTileFloorTexture() {
        const c = document.createElement('canvas');
        c.width = 512; c.height = 512;
        const ctx = c.getContext('2d');
        const step = 128;
        for (let y = 0; y < 4; y++) {
          for (let x = 0; x < 4; x++) {
            ctx.fillStyle = (x + y) % 2 === 0 ? '#c8bfa9' : '#6c6254';
            ctx.fillRect(x * step, y * step, step, step);
            ctx.strokeStyle = 'rgba(40,34,28,0.45)';
            ctx.lineWidth = 3;
            ctx.strokeRect(x * step, y * step, step, step);
          }
        }
        return finalizeTexture(c, 5, 5);
      }

      function createWallTileTexture() {
        const c = document.createElement('canvas');
        c.width = 512; c.height = 512;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#c8c3b5';
        ctx.fillRect(0, 0, 512, 512);
        const step = 64;
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            ctx.fillStyle = '#dad5c8';
            ctx.fillRect(x * step + 2, y * step + 2, step - 4, step - 4);
          }
        }
        return finalizeTexture(c, 4, 2.5);
      }

      function createSovietMagnetTexture(kind) {
        const c = document.createElement('canvas');
        c.width = 256; c.height = 256;
        const ctx = c.getContext('2d');
        if (kind === 'olimpiada80') {
          ctx.fillStyle = '#f8f5ec';
          ctx.fillRect(0, 0, 256, 256);
          ctx.strokeStyle = '#c81e1e';
          ctx.lineWidth = 14;
          ctx.strokeRect(10, 10, 236, 236);
          ctx.fillStyle = '#c81e1e';
          for (let i = 0; i < 5; i++) {
            const h = 38 + (2 - Math.abs(2 - i)) * 22;
            ctx.fillRect(72 + i * 24, 118 - h, 14, h);
          }
          ctx.fillStyle = '#d92626';
          ctx.font = 'bold 32px serif';
          ctx.textAlign = 'center';
          ctx.fillText('★', 128, 42);
          ctx.lineWidth = 5;
          [
            { x: 86, y: 146, col: '#1d4ed8' }, { x: 128, y: 146, col: '#111827' }, { x: 170, y: 146, col: '#dc2626' },
            { x: 107, y: 164, col: '#eab308' }, { x: 149, y: 164, col: '#16a34a' }
          ].forEach(r => {
            ctx.strokeStyle = r.col; ctx.beginPath(); ctx.arc(r.x, r.y, 16, 0, Math.PI * 2); ctx.stroke();
          });
          ctx.fillStyle = '#991b1b';
          ctx.font = '900 28px Inter, sans-serif';
          ctx.fillText('МОСКВА-80', 128, 218);
        } else if (kind === 'gagarin') {
          const g = ctx.createLinearGradient(0, 0, 0, 256);
          g.addColorStop(0, '#0c1b44'); g.addColorStop(1, '#1e3a8a');
          ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
          ctx.fillStyle = '#fef08a';
          [[36, 40], [210, 52], [60, 140], [202, 160], [180, 95]].forEach(([sx, sy]) => {
            ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, Math.PI * 2); ctx.fill();
          });
          ctx.save(); ctx.translate(128, 112); ctx.rotate(-0.45);
          ctx.fillStyle = '#e5e7eb';
          ctx.beginPath(); ctx.moveTo(0, -56); ctx.lineTo(18, -12); ctx.lineTo(18, 36); ctx.lineTo(-18, 36); ctx.lineTo(-18, -12); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ef4444';
          ctx.beginPath(); ctx.moveTo(0, -56); ctx.lineTo(14, -22); ctx.lineTo(-14, -22); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath(); ctx.moveTo(-12, 38); ctx.lineTo(0, 66); ctx.lineTo(12, 38); ctx.closePath(); ctx.fill();
          ctx.restore();
          ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 10; ctx.strokeRect(8, 8, 240, 240);
          ctx.fillStyle = '#fde68a'; ctx.font = '900 28px Inter, sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('ПОЕХАЛИ!', 128, 206);
          ctx.font = '700 18px Inter, sans-serif'; ctx.fillStyle = '#93c5fd';
          ctx.fillText('СССР · 1961', 128, 232);
        } else if (kind === 'sochi') {
          const g = ctx.createLinearGradient(0, 0, 0, 256);
          g.addColorStop(0, '#f59e0b'); g.addColorStop(0.55, '#fbbf24'); g.addColorStop(0.56, '#0284c7'); g.addColorStop(1, '#0369a1');
          ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
          ctx.fillStyle = '#fffbeb'; ctx.beginPath(); ctx.arc(178, 88, 34, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#451a03'; ctx.lineWidth = 10;
          ctx.beginPath(); ctx.moveTo(64, 185); ctx.quadraticCurveTo(80, 125, 96, 86); ctx.stroke();
          ctx.strokeStyle = '#14532d'; ctx.lineWidth = 8;
          [[-38, -10], [-22, -32], [28, -26], [42, -2]].forEach(([dx, dy]) => {
            ctx.beginPath(); ctx.moveTo(96, 86); ctx.quadraticCurveTo(96 + dx * 0.6, 86 + dy - 10, 96 + dx, 86 + dy + 12); ctx.stroke();
          });
          ctx.strokeStyle = '#fef3c7'; ctx.lineWidth = 10; ctx.strokeRect(8, 8, 240, 240);
          ctx.fillStyle = '#ffffff'; ctx.font = '900 38px Georgia, serif'; ctx.textAlign = 'center';
          ctx.fillText('СОЧИ', 142, 212);
          ctx.font = '700 18px Inter, sans-serif'; ctx.fillText('ЧЁРНОЕ МОРЕ · 1974', 128, 236);
        } else if (kind === 'baikal') {
          const g = ctx.createLinearGradient(0, 0, 0, 256);
          g.addColorStop(0, '#bae6fd'); g.addColorStop(0.52, '#e0f2fe'); g.addColorStop(0.53, '#1d4ed8'); g.addColorStop(1, '#1e3a8a');
          ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
          ctx.fillStyle = '#475569';
          ctx.beginPath(); ctx.moveTo(10, 136); ctx.lineTo(75, 68); ctx.lineTo(132, 118); ctx.lineTo(190, 58); ctx.lineTo(246, 136); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.moveTo(75, 68); ctx.lineTo(94, 88); ctx.lineTo(58, 88); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(190, 58); ctx.lineTo(212, 84); ctx.lineTo(170, 84); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#1e40af'; ctx.lineWidth = 10; ctx.strokeRect(8, 8, 240, 240);
          ctx.fillStyle = '#ffffff'; ctx.font = '900 36px Inter, sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('БАЙКАЛ', 128, 198);
          ctx.font = '600 18px Inter, sans-serif'; ctx.fillStyle = '#bfdbfe'; ctx.fillText('СИБИРЬ · СССР', 128, 228);
        } else if (kind === 'leningrad') {
          ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 0, 256, 256);
          ctx.strokeStyle = '#e2c275'; ctx.lineWidth = 10; ctx.strokeRect(10, 10, 236, 236);
          ctx.fillStyle = '#e2c275';
          ctx.beginPath(); ctx.moveTo(128, 30); ctx.lineTo(138, 120); ctx.lineTo(118, 120); ctx.closePath(); ctx.fill();
          ctx.fillRect(106, 120, 44, 48);
          ctx.font = '800 26px Georgia, serif'; ctx.textAlign = 'center';
          ctx.fillText('ЛЕНИНГРАД', 128, 206);
          ctx.font = '600 17px Inter, sans-serif'; ctx.fillStyle = '#cbd5e1'; ctx.fillText('БЕЛЫЕ НОЧИ', 128, 232);
        } else {
          ctx.fillStyle = '#f2e8cc'; ctx.fillRect(0, 0, 256, 256);
          ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2;
          for (let y = 48; y < 240; y += 28) { ctx.beginPath(); ctx.moveTo(16, y); ctx.lineTo(240, y); ctx.stroke(); }
          ctx.fillStyle = '#1e3a8a'; ctx.font = 'italic 600 22px Georgia, serif'; ctx.textAlign = 'left';
          ctx.fillText('Купить:', 28, 66);
          ctx.fillText('- Молоко 2 бут.', 24, 102);
          ctx.fillText('- Хлеб бородин.', 24, 134);
          ctx.fillText('- Сгущёнку', 24, 166);
          ctx.fillText('- Спички', 24, 198);
        }
        return finalizeTexture(c);
      }

      function createMistSpriteTexture() {
        const c = document.createElement('canvas');
        c.width = 128; c.height = 128;
        const ctx = c.getContext('2d');
        const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
        g.addColorStop(0, 'rgba(225,244,255,0.52)');
        g.addColorStop(0.5, 'rgba(210,236,255,0.16)');
        g.addColorStop(1, 'rgba(200,230,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 128, 128);
        return new THREE.CanvasTexture(c);
      }


  // =========================================================================
  // 4. GEOMETRY HELPERS
  // =========================================================================
      function makeRoundedRectShape(w, h, rBot, rTop, cx = 0, cy = 0) {
        const shape = new THREE.Shape();
        const hw = w / 2, hh = h / 2;
        const rb = Math.min(rBot, hw * 0.92, hh * 0.92);
        const rt = Math.min(rTop, hw * 0.92, hh * 0.92);
        shape.moveTo(cx - hw + rb, cy - hh);
        shape.lineTo(cx + hw - rb, cy - hh);
        shape.quadraticCurveTo(cx + hw, cy - hh, cx + hw, cy - hh + rb);
        shape.lineTo(cx + hw, cy + hh - rt);
        shape.quadraticCurveTo(cx + hw, cy + hh, cx + hw - rt, cy + hh);
        shape.lineTo(cx - hw + rt, cy + hh);
        shape.quadraticCurveTo(cx - hw, cy + hh, cx - hw, cy + hh - rt);
        shape.lineTo(cx - hw, cy - hh + rb);
        shape.quadraticCurveTo(cx - hw, cy - hh, cx - hw + rb, cy - hh);
        return shape;
      }

      function makeRoundedRectPath(w, h, r, cx = 0, cy = 0) {
        const path = new THREE.Path();
        const hw = w / 2, hh = h / 2;
        const rad = Math.min(r, hw * 0.9, hh * 0.9);
        path.moveTo(cx - hw + rad, cy - hh);
        path.lineTo(cx + hw - rad, cy - hh);
        path.quadraticCurveTo(cx + hw, cy - hh, cx + hw, cy - hh + rad);
        path.lineTo(cx + hw, cy + hh - rad);
        path.quadraticCurveTo(cx + hw, cy + hh, cx + hw - rad, cy + hh);
        path.lineTo(cx - hw + rad, cy + hh);
        path.quadraticCurveTo(cx - hw, cy + hh, cx - hw, cy + hh - rad);
        path.lineTo(cx - hw, cy - hh + rad);
        path.quadraticCurveTo(cx - hw, cy - hh, cx - hw + rad, cy - hh);
        return path;
      }

      function applyBoxNormalizedUVs(geo) {
        geo.computeVertexNormals();
        geo.computeBoundingBox();
        const bb = geo.boundingBox;
        const dx = Math.max(0.0001, bb.max.x - bb.min.x);
        const dy = Math.max(0.0001, bb.max.y - bb.min.y);
        const dz = Math.max(0.0001, bb.max.z - bb.min.z);
        const pos = geo.attributes.position;
        const norm = geo.attributes.normal;
        const uvs = new Float32Array(pos.count * 2);
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
          const nx = Math.abs(norm.getX(i));
          const ny = Math.abs(norm.getY(i));
          const nz = Math.abs(norm.getZ(i));
          let u, v;
          if (nz >= nx && nz >= ny) {
            u = (x - bb.min.x) / dx; v = (y - bb.min.y) / dy;
          } else if (nx >= ny && nx >= nz) {
            u = (z - bb.min.z) / dz; v = (y - bb.min.y) / dy;
          } else {
            u = (x - bb.min.x) / dx; v = (z - bb.min.z) / dz;
          }
          uvs[i * 2] = u;
          uvs[i * 2 + 1] = v;
        }
        geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        return geo;
      }

      function createRoundedBox(w, h, d, rBot, bevel = 0.012, puffFront = 0, rTop = null) {
        const shape = makeRoundedRectShape(
          Math.max(0.01, w - bevel * 2),
          Math.max(0.01, h - bevel * 2),
          rBot,
          rTop !== null ? rTop : rBot
        );
        const geo = new THREE.ExtrudeGeometry(shape, {
          depth: Math.max(0.004, d - bevel * 2),
          bevelEnabled: true,
          bevelThickness: bevel,
          bevelSize: bevel,
          bevelSegments: bevel > 0.025 ? 10 : 5,
          curveSegments: 16
        });
        geo.center();
        if (puffFront > 0) {
          const pos = geo.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const z = pos.getZ(i);
            if (z > 0) {
              const nx = pos.getX(i) / (w / 2);
              const ny = pos.getY(i) / (h / 2);
              const dome = Math.max(0, 1 - (nx * nx * 0.65 + ny * ny * 0.65));
              pos.setZ(i, z + dome * puffFront);
            }
          }
        }
        return applyBoxNormalizedUVs(geo);
      }

      // True SINGLE-PIECE seamless stamped-steel retro door shell (flat rear at z=0.006 -> straight side -> smooth rounded front bevel -> pillowed front dome!)
      // Eliminates the 2-layer "sandwich" seam completely while leaving the rear open for the recessed inner door liner.
      function buildSinglePieceDoorShell(w, h, totalDepth, rBot, rTop, frontBevel, puffFront) {
        const contourSegs = 80;
        const bevelSteps = 10;
        const capRings = 5;

        function sampleContour(inset) {
          const cw = Math.max(0.02, w - inset * 2);
          const ch = Math.max(0.02, h - inset * 2);
          const rb = Math.max(0.004, rBot - inset * 0.72);
          const rt = Math.max(0.004, rTop - inset * 0.72);
          const shape = makeRoundedRectShape(cw, ch, rb, rt);
          const pts = shape.getSpacedPoints(contourSegs);
          // Drop duplicate closing point (we wrap explicitly)
          return pts.slice(0, contourSegs);
        }

        const rings = [];
        // Ring 0: Rear gasket flange (z = 0.006, full outer dimensions)
        rings.push({ pts: sampleContour(0), z: 0.006, domeScale: 0 });
        // Ring 1: Straight smooth outer side wall up to start of front automotive curve
        const flatEndZ = totalDepth - frontBevel;
        rings.push({ pts: sampleContour(0), z: flatEndZ, domeScale: 0 });

        // Rings 2..bevelSteps+1: Smooth quarter-circle front automotive bevel
        for (let k = 1; k <= bevelSteps; k++) {
          const a = (k / bevelSteps) * (Math.PI / 2);
          const inset = (1 - Math.cos(a)) * frontBevel;
          const z = flatEndZ + Math.sin(a) * frontBevel;
          rings.push({ pts: sampleContour(inset), z, domeScale: Math.pow(k / bevelSteps, 2) * 0.35 });
        }

        // Front pillowed face rings converging cleanly to center point
        for (let c = 1; c <= capRings; c++) {
          const frac = c / (capRings + 1);
          const inset = frontBevel + frac * (Math.min(w, h) * 0.5 - frontBevel - 0.015);
          rings.push({ pts: sampleContour(inset), z: totalDepth, domeScale: 0.35 + frac * 0.65 });
        }

        const positions = [];
        const indices = [];
        const nPts = contourSegs;

        for (let r = 0; r < rings.length; r++) {
          const ring = rings[r];
          for (let j = 0; j < nPts; j++) {
            const p = ring.pts[j];
            const nx = p.x / (w / 2);
            const ny = p.y / (h / 2);
            const dome = Math.max(0, 1 - (nx * nx * 0.65 + ny * ny * 0.65)) * puffFront * ring.domeScale;
            positions.push(p.x, p.y, ring.z + dome);
          }
        }

        // Center front vertex
        const centerIdx = rings.length * nPts;
        positions.push(0, 0, totalDepth + puffFront);

        // Side & bevel quads (CCW outward normals when contour is CCW)
        for (let r = 0; r < rings.length - 1; r++) {
          const rowA = r * nPts;
          const rowB = (r + 1) * nPts;
          for (let j = 0; j < nPts; j++) {
            const jNext = (j + 1) % nPts;
            const a = rowA + j;
            const b = rowA + jNext;
            const c = rowB + jNext;
            const d = rowB + j;
            indices.push(a, b, c, a, c, d);
          }
        }

        // Front center fan
        const lastRow = (rings.length - 1) * nPts;
        for (let j = 0; j < nPts; j++) {
          const jNext = (j + 1) % nPts;
          indices.push(lastRow + j, lastRow + jNext, centerIdx);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setIndex(indices);
        return applyBoxNormalizedUVs(geo);
      }

      // Single-piece seamless hollow frame extrusion (ZERO overlapping corner boxes!)
      function createHollowShell(outerW, outerH, depth, rBot, rTop, holeW, holeH, holeR, holeOffsetY, bevel = 0.012) {
        const shape = makeRoundedRectShape(outerW - bevel * 2, outerH - bevel * 2, rBot, rTop);
        const hole = makeRoundedRectPath(holeW + bevel * 2, holeH + bevel * 2, holeR, 0, holeOffsetY);
        shape.holes.push(hole);
        const geo = new THREE.ExtrudeGeometry(shape, {
          depth: Math.max(0.004, depth - bevel * 2),
          bevelEnabled: true,
          bevelThickness: bevel,
          bevelSize: bevel,
          bevelSegments: bevel > 0.02 ? 8 : 4,
          curveSegments: 16
        });
        geo.center();
        return applyBoxNormalizedUVs(geo);
      }


  // =========================================================================
  // 5. MATERIALS
  // =========================================================================
      const initialEnamel = createEnamelTextures(state.enamelColor, state.wearLevel);
      const enamelMat = new THREE.MeshStandardMaterial({
        map: initialEnamel.map,
        roughnessMap: initialEnamel.roughnessMap,
        roughness: 1.0,
        metalness: 0.10,
        envMapIntensity: 1.1
      });

      const agedInnerEnamelTex = createAgedInteriorTexture('#ddd5c3', 0.85);
      const agedPlasticTex = createAgedInteriorTexture('#d6ccb7', 0.78);

      const innerEnamelMat = new THREE.MeshStandardMaterial({
        map: agedInnerEnamelTex,
        emissive: new THREE.Color('#ffbe66'),
        emissiveIntensity: 0.0,
        roughness: 0.38,
        metalness: 0.05,
        envMapIntensity: 0.65
      });

      const chromeMat = new THREE.MeshStandardMaterial({
        color: '#d4dbe2',
        roughness: 0.12,
        metalness: 0.92,
        envMapIntensity: 1.4
      });

      const brushedAlumMat = new THREE.MeshStandardMaterial({
        color: '#b8bec2',
        roughness: 0.44,
        metalness: 0.76
      });

      const frostMat = new THREE.MeshStandardMaterial({
        map: createFrostTexture(),
        color: '#e6eff5',
        roughness: 0.86,
        metalness: 0.02,
        transparent: true,
        opacity: state.frostLevel * 0.84,
        polygonOffset: true,
        polygonOffsetFactor: -1
      });

      const rubberMat = new THREE.MeshStandardMaterial({ color: '#423d36', roughness: 0.92, metalness: 0.02 });
      const plasticTrimMat = new THREE.MeshStandardMaterial({ map: agedPlasticTex, roughness: 0.44, metalness: 0.02 });
      const plasticRecessMat = new THREE.MeshStandardMaterial({ color: '#c8bea7', roughness: 0.50, metalness: 0.02 });
      const blackMetalMat = new THREE.MeshStandardMaterial({ color: '#1e1e1e', roughness: 0.45, metalness: 0.72 });
      const copperMat = new THREE.MeshStandardMaterial({ color: '#b8683a', roughness: 0.28, metalness: 0.90 });
      const brassMat = new THREE.MeshStandardMaterial({ color: '#d4a64a', roughness: 0.22, metalness: 0.92 });


  // =========================================================================
  // 6. BUILD FRIDGE
  // =========================================================================
  const wrapperRoot = new THREE.Group();
  wrapperRoot.userData.dyn = true;
  wrapperRoot.userData.keep = true;

      const W = 0.640;
      const H = 1.375;
      const D = 0.560;
      const LEG_H = 0.055;
      const BODY_H = H - LEG_H; // 1.320m
      const DOOR_D = 0.132;

      // Chamber cavity dimensions inside the monolithic cabinet
      const innerW = 0.520;
      const innerH = 0.960;
      const innerCenterY = 0.085; // shifts cavity above the 24 cm bottom compressor compartment
      const innerD = 0.485;

      const fridgeRoot = new THREE.Group();
      wrapperRoot.add(fridgeRoot);

      const interactables = [];
      function registerInteractive(mesh, type, label, data = {}) {
        mesh.userData = { interactiveType: type, label, ...data };
        interactables.push(mesh);
      }

      // --- 8A. Four Rubber Support Feet ---
      const footGeo = new THREE.CylinderGeometry(0.026, 0.032, LEG_H, 16);
      [
        [-W / 2 + 0.075, -D / 2 + 0.075],
        [W / 2 - 0.075, -D / 2 + 0.075],
        [-W / 2 + 0.075, D / 2 - 0.075],
        [W / 2 - 0.075, D / 2 - 0.075]
      ].forEach(([fx, fz]) => {
        const foot = new THREE.Mesh(footGeo, rubberMat);
        foot.position.set(fx, LEG_H / 2, fz);
        foot.castShadow = false;
        foot.receiveShadow = true;
        fridgeRoot.add(foot);
      });

      // --- 8B. Monolithic Seamless Hollow Cabinet Shell ---
      const cabinetGroup = new THREE.Group();
      cabinetGroup.position.set(0, LEG_H + BODY_H / 2, 0);
      fridgeRoot.add(cabinetGroup);

      // Front 90% of cabinet: ONE seamless hollow extruded rounded shell (ZERO seams!)
      const shellFrontD = D - 0.055;
      const cabinetHollow = new THREE.Mesh(
        createHollowShell(W, BODY_H, shellFrontD, 0.044, 0.088, innerW, innerH, 0.036, innerCenterY, 0.022),
        enamelMat
      );
      cabinetHollow.position.set(0, 0, D / 2 - shellFrontD / 2);
      cabinetHollow.castShadow = false;
      cabinetHollow.receiveShadow = true;
      cabinetGroup.add(cabinetHollow);

      // Solid rounded rear wall cap (sits strictly behind cabinetHollow at z = -D/2..-D/2+0.055)
      const backCapD = 0.058;
      const cabinetBack = new THREE.Mesh(
        createRoundedBox(W - 0.004, BODY_H - 0.004, backCapD, 0.042, 0.018, 0, 0.084),
        enamelMat
      );
      cabinetBack.position.set(0, 0, -D / 2 + backCapD / 2);
      cabinetBack.castShadow = false;
      cabinetBack.receiveShadow = true;
      cabinetGroup.add(cabinetBack);

      // Front lower ventilation kickplate slots (recessed cleanly on lower skirt)
      [-0.14, 0.14].forEach(kx => {
        for (let s = 0; s < 3; s++) {
          const slot = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.009, 0.008), blackMetalMat);
          slot.position.set(kx, -BODY_H / 2 + 0.048 + s * 0.020, D / 2 + 0.001);
          cabinetGroup.add(slot);
        }
      });

      // --- 8C. Seamless Inner Enameled Chamber Liner & Front Decorative Trim Ring ---
      const innerLinerGroup = new THREE.Group();
      innerLinerGroup.position.set(0, innerCenterY, D / 2 - innerD / 2 - 0.012);
      cabinetGroup.add(innerLinerGroup);

      // Full aged enameled interior chamber walls (back, left, right, top, bottom)
      const linerBack = new THREE.Mesh(new THREE.BoxGeometry(innerW - 0.008, innerH - 0.008, 0.008), innerEnamelMat);
      linerBack.position.set(0, 0, -innerD / 2 + 0.004);
      linerBack.receiveShadow = true;
      innerLinerGroup.add(linerBack);

      const linerLeft = new THREE.Mesh(new THREE.BoxGeometry(0.006, innerH - 0.010, innerD - 0.012), innerEnamelMat);
      linerLeft.position.set(-innerW / 2 + 0.004, 0, 0);
      linerLeft.receiveShadow = true;
      innerLinerGroup.add(linerLeft);

      const linerRight = new THREE.Mesh(new THREE.BoxGeometry(0.006, innerH - 0.010, innerD - 0.012), innerEnamelMat);
      linerRight.position.set(innerW / 2 - 0.004, 0, 0);
      linerRight.receiveShadow = true;
      innerLinerGroup.add(linerRight);

      const linerBottom = new THREE.Mesh(new THREE.BoxGeometry(innerW - 0.010, 0.006, innerD - 0.012), innerEnamelMat);
      linerBottom.position.set(0, -innerH / 2 + 0.004, 0);
      linerBottom.receiveShadow = true;
      innerLinerGroup.add(linerBottom);

      const linerTop = new THREE.Mesh(new THREE.BoxGeometry(innerW - 0.010, 0.006, innerD - 0.012), innerEnamelMat);
      linerTop.position.set(0, innerH / 2 - 0.004, 0);
      innerLinerGroup.add(linerTop);

      // Single-piece molded front door-opening trim ring (ZERO overlapping trim strips!)
      const frontTrimRing = new THREE.Mesh(
        createHollowShell(innerW + 0.076, innerH + 0.076, 0.018, 0.036, 0.046, innerW - 0.004, innerH - 0.004, 0.030, 0, 0.005),
        plasticTrimMat
      );
      frontTrimRing.position.set(0, 0, innerD / 2 + 0.008);
      innerLinerGroup.add(frontTrimRing);

      // Door-activated Lamp Plunger Switch (концевик) on right front trim
      const plunger = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.018, 12), plasticTrimMat);
      plunger.rotation.x = Math.PI / 2;
      plunger.position.set(innerW / 2 + 0.020, innerH * 0.24, innerD / 2 + 0.018);
      innerLinerGroup.add(plunger);

      // --- 8D. Compact Vintage Interior Lamp Mounted Directly Under the Freezer ---
      const lampY = innerH / 2 - 0.21 - 0.046;
      const underLampGroup = new THREE.Group();
      underLampGroup.position.set(0, lampY, -0.02);
      innerLinerGroup.add(underLampGroup);

      // Small chrome/plastic mounting collar tucked neatly beneath the freezer bottom
      const lampCollar = new THREE.Mesh(createRoundedBox(0.068, 0.012, 0.046, 0.006, 0.002), plasticTrimMat);
      lampCollar.position.y = 0.008;
      underLampGroup.add(lampCollar);

      const bulbMat = new THREE.MeshStandardMaterial({
        color: '#fff6dc',
        emissive: '#ffab38',
        emissiveIntensity: 0,
        roughness: 0.28,
        transparent: true,
        opacity: 0.92
      });
      // Small compact frosted glass oval diffuser dome
      const lampDiffuser = new THREE.Mesh(new THREE.SphereGeometry(0.022, 18, 12, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.58), bulbMat);
      lampDiffuser.scale.set(1.25, 0.85, 0.90);
      lampDiffuser.position.y = 0.004;
      underLampGroup.add(lampDiffuser);

      // Оптимизация: вместо 6-проходного PointLight с тенями используем тёплое свечение плафона и камеры (0 доп. draw calls!)
      const interiorLight = { intensity: 0 };

      // --- 8E. Sleek Flush Front-Mounted Thermostat Regulator above Freezer (Reference 7705.jpg) ---
      const thermoGroup = new THREE.Group();
      thermoGroup.position.set(0, innerH / 2 + 0.020, innerD / 2 + 0.017);
      innerLinerGroup.add(thermoGroup);

      const thermoPlate = new THREE.Mesh(
        createRoundedBox(0.116, 0.042, 0.005, 0.008, 0.0018),
        new THREE.MeshStandardMaterial({ color: '#e5dfd3', roughness: 0.36 })
      );
      thermoGroup.add(thermoPlate);

      const dialFace = new THREE.Mesh(
        new THREE.CircleGeometry(0.0185, 28),
        new THREE.MeshStandardMaterial({
          map: createThermostatDialTexture(),
          roughness: 0.42,
          polygonOffset: true,
          polygonOffsetFactor: -1
        })
      );
      dialFace.position.z = 0.0030;
      thermoGroup.add(dialFace);

      const thermoKnob = new THREE.Group();
      thermoKnob.position.set(0, 0, 0.0046);
      thermoGroup.add(thermoKnob);

      const knobMat = new THREE.MeshStandardMaterial({ color: '#efeae0', roughness: 0.30 });
      const knobCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.015, 0.004, 24), knobMat);
      knobCyl.rotation.x = Math.PI / 2;
      thermoKnob.add(knobCyl);

      const knobPointer = new THREE.Mesh(createRoundedBox(0.025, 0.0042, 0.0038, 0.0014, 0.0008), knobMat);
      knobPointer.position.set(0, 0, 0.0028);
      thermoKnob.add(knobPointer);

      const knobDot = new THREE.Mesh(new THREE.CylinderGeometry(0.0014, 0.0014, 0.001, 10), blackMetalMat);
      knobDot.rotation.x = Math.PI / 2;
      knobDot.position.set(0.009, 0, 0.0049);
      thermoKnob.add(knobDot);

      registerInteractive(thermoPlate, 'thermostat', 'Терморегулятор 0–7 (клик — переключить)');
      registerInteractive(knobCyl, 'thermostat', 'Терморегулятор 0–7 (клик — переключить)');
      registerInteractive(knobPointer, 'thermostat', 'Терморегулятор 0–7 (клик — переключить)');

      // --- 8F. Detailed Soviet Aluminum Freezer Evaporator (Морозилка КХ-240, Reference 7705.jpg) ---
      const frzW = innerW - 0.030;
      const frzH = 0.215;
      const frzD = innerD - 0.085;
      const freezerBoxGroup = new THREE.Group();
      freezerBoxGroup.position.set(0, innerH / 2 - frzH / 2 - 0.020, -0.022);
      innerLinerGroup.add(freezerBoxGroup);

      // Seamless hollow anodized aluminum evaporator chamber + rear wall
      const frzShell = new THREE.Mesh(
        createHollowShell(frzW, frzH, frzD, 0.014, 0.014, frzW - 0.026, frzH - 0.026, 0.009, 0, 0.004),
        brushedAlumMat
      );
      freezerBoxGroup.add(frzShell);

      const frzBack = new THREE.Mesh(new THREE.BoxGeometry(frzW - 0.008, frzH - 0.008, 0.010), brushedAlumMat);
      frzBack.position.z = -frzD / 2 + 0.005;
      freezerBoxGroup.add(frzBack);

      // Embossed aluminum refrigerant channels along left & right interior walls of evaporator
      const chanMat = new THREE.MeshStandardMaterial({ color: '#a8b0b6', roughness: 0.36, metalness: 0.80 });
      for (let c = 0; c < 4; c++) {
        const cy = -frzH * 0.30 + c * (frzH * 0.20);
        [-frzW / 2 + 0.016, frzW / 2 - 0.016].forEach(cx => {
          const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, frzD - 0.04, 8), chanMat);
          ch.rotation.x = Math.PI / 2;
          ch.position.set(cx, cy, 0);
          freezerBoxGroup.add(ch);
        });
      }

      // Middle aluminum divider shelf inside the freezer
      const frzShelf = new THREE.Mesh(new THREE.BoxGeometry(frzW - 0.032, 0.006, frzD - 0.045), brushedAlumMat);
      frzShelf.position.set(0, 0.004, -0.005);
      freezerBoxGroup.add(frzShelf);

      // Two detailed aluminum Soviet ice-cube trays with internal grid dividers on the bottom floor
      [-0.095, 0.095].forEach(ix => {
        const trayG = new THREE.Group();
        trayG.position.set(ix, -frzH / 2 + 0.026, 0.015);
        const trayWall = new THREE.Mesh(
          createHollowShell(0.108, 0.20, 0.022, 0.006, 0.006, 0.096, 0.188, 0.004, 0, 0.002),
          brushedAlumMat
        );
        trayWall.rotation.x = Math.PI / 2;
        trayG.add(trayWall);
        const trayBot = new THREE.Mesh(new THREE.BoxGeometry(0.104, 0.003, 0.196), brushedAlumMat);
        trayBot.position.y = -0.010;
        trayG.add(trayBot);
        // Ice divider grid
        const divMid = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.018, 0.185), chanMat);
        trayG.add(divMid);
        for (let r = -2; r <= 2; r++) {
          const rib = new THREE.Mesh(new THREE.BoxGeometry(0.094, 0.018, 0.003), chanMat);
          rib.position.z = r * 0.036;
          trayG.add(rib);
        }
        freezerBoxGroup.add(trayG);
      });

      // Dynamic Frost Layer lining the inside top/sides of the evaporator (melts on Defrost)
      const frostMesh = new THREE.Mesh(
        createHollowShell(frzW - 0.028, frzH - 0.028, frzD - 0.030, 0.008, 0.008, frzW - 0.042, frzH - 0.042, 0.006, 0, 0.002),
        frostMat
      );
      freezerBoxGroup.add(frostMesh);

      // Authentic Sculpted Molded Soviet Freezer Door (Reference 7705.jpg: wide stepped panel + embossed ZIL-MOSKVA)
      const freezerDoorPivot = new THREE.Group();
      freezerDoorPivot.position.set(frzW / 2, 0, frzD / 2 + 0.006);
      freezerBoxGroup.add(freezerDoorPivot);

      const frzDoorMat = new THREE.MeshStandardMaterial({ map: createFreezerDoorTexture(), roughness: 0.40, metalness: 0.04 });
      const freezerDoorMesh = new THREE.Mesh(
        createRoundedBox(frzW + 0.014, frzH + 0.012, 0.020, 0.008, 0.004),
        frzDoorMat
      );
      freezerDoorMesh.position.set(-frzW / 2, 0, 0.010);
      freezerDoorPivot.add(freezerDoorMesh);

      // Molded upper horizontal step & lower chrome pull latch on the freezer door
      const frzTopBand = new THREE.Mesh(createRoundedBox(frzW + 0.006, frzH * 0.28, 0.006, 0.004, 0.002), plasticTrimMat);
      frzTopBand.position.set(-frzW / 2, frzH * 0.32, 0.020);
      freezerDoorPivot.add(frzTopBand);

      const freezerHandle = new THREE.Mesh(createRoundedBox(0.056, 0.016, 0.014, 0.004, 0.002), chromeMat);
      freezerHandle.position.set(-frzW + 0.052, -frzH * 0.28, 0.023);
      freezerDoorPivot.add(freezerHandle);

      // Compact chrome hinge pins on right side of freezer door
      [-frzH * 0.34, frzH * 0.34].forEach(hy => {
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.022, 10), chromeMat);
        pin.position.set(0.002, hy, 0.006);
        freezerDoorPivot.add(pin);
      });

      registerInteractive(freezerDoorMesh, 'freezer', 'Дверца морозилки (клик — открыть/закрыть)');
      registerInteractive(frzTopBand, 'freezer', 'Дверца морозилки (клик — открыть/закрыть)');
      registerInteractive(freezerHandle, 'freezer', 'Дверца морозилки (клик — открыть/закрыть)');

      // --- 8G. 4 Empty Aluminum Slatted Wire Shelves ---
      const shelfYs = [
        innerH / 2 - frzH - 0.115,
        innerH / 2 - frzH - 0.285,
        innerH / 2 - frzH - 0.455,
        -innerH / 2 + 0.188
      ];
      shelfYs.forEach(sy => {
        const shelfGroup = new THREE.Group();
        shelfGroup.position.set(0, sy, -0.01);
        const frameFront = new THREE.Mesh(new THREE.BoxGeometry(innerW - 0.024, 0.007, 0.007), chromeMat);
        frameFront.position.set(0, 0, innerD / 2 - 0.055);
        shelfGroup.add(frameFront);
        const frameBack = new THREE.Mesh(new THREE.BoxGeometry(innerW - 0.024, 0.007, 0.007), chromeMat);
        frameBack.position.set(0, 0, -innerD / 2 + 0.035);
        shelfGroup.add(frameBack);
        for (let i = 0; i < 13; i++) {
          const sx = -innerW / 2 + 0.026 + (i / 12) * (innerW - 0.052);
          const slat = new THREE.Mesh(new THREE.BoxGeometry(0.0045, 0.0045, innerD - 0.09), brushedAlumMat);
          slat.position.set(sx, 0, -0.01);
          shelfGroup.add(slat);
        }
        innerLinerGroup.add(shelfGroup);
      });

      // --- 8H. Single-Piece Seamless Hollow Open-Top Rounded Crisper Drawer (ZERO layers, ZERO seams!) ---
      const drawerGroup = new THREE.Group();
      const drawerW = innerW - 0.038;
      const drawerH = 0.148;
      const drawerD = innerD - 0.088;
      drawerGroup.position.set(0, -innerH / 2 + drawerH / 2 + 0.014, -0.01);
      innerLinerGroup.add(drawerGroup);

      function buildSinglePieceOpenTub(w, h, d, cornerR, wallT) {
        const segs = isMobile ? 36 : 64;
        const hh = h / 2;
        const botR = 0.016;
        const rimR = wallT / 2;

        function sampleXZ(inset) {
          const cw = Math.max(0.01, w - inset * 2);
          const cd = Math.max(0.01, d - inset * 2);
          const cr = Math.max(0.003, cornerR - inset * 0.78);
          const pts = makeRoundedRectShape(cw, cd, cr, cr).getSpacedPoints(segs).slice(0, segs);
          // Map (x, y) -> (x, -y) in XZ plane so perimeter runs CCW when viewed from +Y
          return pts.map(p => ({ x: p.x, z: -p.y }));
        }

        // Continuous cross-section profile: outer bottom fillet -> outer wall -> rounded top rim -> inner wall -> inner bottom fillet
        const profile = [];
        // Outer bottom fillet (4 steps)
        for (let k = 0; k <= 4; k++) {
          const a = (k / 4) * (Math.PI / 2);
          profile.push({ inset: botR * (1 - Math.sin(a)), y: -hh + botR * (1 - Math.cos(a)) });
        }
        // Top of outer wall + rounded top rim lip (5 steps)
        for (let k = 0; k <= 4; k++) {
          const a = (k / 4) * Math.PI;
          profile.push({ inset: rimR * (1 - Math.cos(a)), y: hh - rimR + rimR * Math.sin(a) });
        }
        // Inner wall down to inner bottom fillet (4 steps)
        const inBotR = 0.012;
        for (let k = 0; k <= 4; k++) {
          const a = (k / 4) * (Math.PI / 2);
          profile.push({ inset: wallT + inBotR * (1 - Math.cos(a)), y: -hh + wallT + inBotR * (1 - Math.sin(a)) });
        }

        const positions = [];
        const indices = [];

        for (let r = 0; r < profile.length; r++) {
          const ringPts = sampleXZ(profile[r].inset);
          const y = profile[r].y;
          for (let j = 0; j < segs; j++) {
            positions.push(ringPts[j].x, y, ringPts[j].z);
          }
        }

        const outerBotCenterIdx = profile.length * segs;
        positions.push(0, -hh, 0);
        const innerBotCenterIdx = outerBotCenterIdx + 1;
        positions.push(0, -hh + wallT, 0);

        // Outer bottom center cap (normal -Y)
        for (let j = 0; j < segs; j++) {
          const jN = (j + 1) % segs;
          indices.push(outerBotCenterIdx, j, jN);
        }
        // Continuous wall + rim + inner wall strip
        for (let r = 0; r < profile.length - 1; r++) {
          const rowA = r * segs;
          const rowB = (r + 1) * segs;
          for (let j = 0; j < segs; j++) {
            const jN = (j + 1) % segs;
            indices.push(rowA + j, rowA + jN, rowB + jN, rowA + j, rowB + jN, rowB + j);
          }
        }
        // Inner floor center cap (normal +Y)
        const lastRow = (profile.length - 1) * segs;
        for (let j = 0; j < segs; j++) {
          const jN = (j + 1) % segs;
          indices.push(lastRow + j, lastRow + jN, innerBotCenterIdx);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setIndex(indices);
        return applyBoxNormalizedUVs(geo);
      }

      const drawerMat = new THREE.MeshStandardMaterial({ map: agedPlasticTex, roughness: 0.44, metalness: 0.03 });
      const dTub = new THREE.Mesh(buildSinglePieceOpenTub(drawerW, drawerH, drawerD, 0.044, 0.010), drawerMat);
      dTub.castShadow = false;
      dTub.receiveShadow = true;
      drawerGroup.add(dTub);

      // Sleek rounded chrome pull handle seated directly on the front face of the single-piece tub
      const dHandle = new THREE.Mesh(createRoundedBox(0.112, 0.015, 0.014, 0.005, 0.003), chromeMat);
      dHandle.position.set(0, 0.028, drawerD / 2 + 0.005);
      drawerGroup.add(dHandle);

      registerInteractive(dTub, 'drawer', 'Ящик для овощей (клик — выдвинуть)');
      registerInteractive(dHandle, 'drawer', 'Ящик для овощей (клик — выдвинуть)');

      // --- 8I. MONOLITHIC SEAMLESS THICK ROUNDED MAIN DOOR (ZERO SEAMS, ZERO COLLISION) ---
      const doorPivot = new THREE.Group();
      doorPivot.position.set(W / 2 - 0.010, LEG_H + BODY_H / 2 + 0.010, D / 2 + 0.006);
      fridgeRoot.add(doorPivot);

      const doorW = W + 0.004;
      const doorH = BODY_H - 0.044;
      const doorCenterX = -W / 2 + 0.010;

      // 1. TRUE SINGLE-PIECE SEAMLESS STAMPED-STEEL DOOR SHELL (ZERO 2-layer seam!)
      // Spans continuously from rear gasket flange (z=0.006) straight forward and curves smoothly into the front dome (z=0.132+0.024)
      const doorMesh = new THREE.Mesh(
        buildSinglePieceDoorShell(doorW, doorH, DOOR_D, 0.052, 0.096, 0.044, 0.024),
        enamelMat
      );
      doorMesh.position.set(doorCenterX, 0, 0);
      doorMesh.castShadow = false;
      doorMesh.receiveShadow = true;
      doorPivot.add(doorMesh);
      registerInteractive(doorMesh, 'door', 'Дверца холодильника (клик или потяните мышкой)');

      // Clean thin rear flange cap closing the outer perimeter gap between outer steel shell and recessed inner liner at z = 0.007
      const rearFlange = new THREE.Mesh(
        createHollowShell(doorW - 0.004, doorH - 0.004, 0.006, 0.050, 0.092, innerW - 0.012, innerH - 0.012, 0.030, innerCenterY - 0.010, 0.002),
        enamelMat
      );
      rearFlange.position.set(doorCenterX, 0, 0.007);
      doorPivot.add(rearFlange);

      // 3. Continuous Oval Rubber Gasket Seal around perimeter (z = -0.004..+0.006)
      const gasketRing = new THREE.Mesh(
        createHollowShell(innerW + 0.072, innerH + 0.072, 0.012, 0.040, 0.052, innerW + 0.028, innerH + 0.028, 0.034, 0, 0.003),
        rubberMat
      );
      gasketRing.position.set(doorCenterX, innerCenterY - 0.010, 0.001);
      doorPivot.add(gasketRing);

      // 4. Deeply Recessed Molded Inner Door Liner (Reference 7705.jpg)
      // Backing sits deep at z = +0.062; ALL shelves, «МАСЛО» box & chrome rails stay strictly inside z >= 0.000!
      const innerDoorGroup = new THREE.Group();
      innerDoorGroup.position.set(doorCenterX, innerCenterY - 0.010, 0.062);
      doorPivot.add(innerDoorGroup);

      const pW = innerW - 0.012;
      const pH = innerH - 0.012;

      // Deep backing wall
      const innerDoorPanel = new THREE.Mesh(new THREE.BoxGeometry(pW, pH, 0.008), plasticTrimMat);
      innerDoorGroup.add(innerDoorPanel);

      // Continuous molded plastic liner frame bridging z = 0 to z = -0.056 (flush with rubber gasket)
      const linerFrame = new THREE.Mesh(
        createHollowShell(pW, pH, 0.056, 0.028, 0.032, pW - 0.046, pH - 0.046, 0.020, 0, 0.004),
        plasticTrimMat
      );
      linerFrame.position.z = -0.028;
      innerDoorGroup.add(linerFrame);

      // Upper vertical fluted ribs (same aged molded plastic material -> zero white stripes!)
      const ribZoneH = pH * 0.24;
      const ribZoneY = pH / 2 - 0.028 - ribZoneH / 2;
      const ribSpanW = pW - 0.068;
      for (let r = 0; r < 16; r++) {
        const rx = -ribSpanW / 2 + (r / 15) * ribSpanW;
        const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.0048, 0.0048, ribZoneH, 10), plasticTrimMat);
        rib.position.set(rx, ribZoneY, -0.006);
        innerDoorGroup.add(rib);
      }

      // Centered «М А С Л О» Butter Compartment (tucked cleanly inside door depth: z_door = +0.016)
      const masloW = pW * 0.44;
      const masloH = pH * 0.142;
      const masloD = 0.040;
      const masloBox = new THREE.Mesh(createRoundedBox(masloW, masloH, masloD, 0.007, 0.003), plasticTrimMat);
      masloBox.position.set(0, ribZoneY - 0.014, -masloD / 2 - 0.005);
      innerDoorGroup.add(masloBox);

      const masloFace = new THREE.Mesh(
        new THREE.PlaneGeometry(masloW - 0.010, masloH - 0.010),
        new THREE.MeshStandardMaterial({
          map: createMasloBoxTexture(),
          roughness: 0.34,
          polygonOffset: true,
          polygonOffsetFactor: -1
        })
      );
      masloFace.rotation.y = Math.PI;
      masloFace.position.set(0, ribZoneY - 0.014, -masloD - 0.006);
      innerDoorGroup.add(masloFace);

      // Compact curved-end chrome door rails (stay strictly at z_door >= +0.002 -> ZERO collision!)
      const railChromeMat = new THREE.MeshStandardMaterial({ color: '#c4c9ce', roughness: 0.16, metalness: 0.88 });
      function addCurvedDoorRail(yPos, depth) {
        const halfW = pW / 2 - 0.025;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-halfW, yPos, -0.032),
          new THREE.Vector3(-halfW + 0.018, yPos, -depth),
          new THREE.Vector3(halfW - 0.018, yPos, -depth),
          new THREE.Vector3(halfW, yPos, -0.032)
        ]);
        innerDoorGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.0042, 8, false), railChromeMat));
      }

      const shelfW = pW - 0.044;
      // Top Perforated Molded Egg Holder Shelf with 9 REAL recessed concave egg holes & cup bowls!
      const eggY = pH * 0.115;
      const eggD = 0.054;
      const eggCount = 9;
      const eggPlateShape = makeRoundedRectShape(shelfW, eggD, 0.005, 0.005);
      for (let c = 0; c < eggCount; c++) {
        const cx = -shelfW * 0.43 + (c / (eggCount - 1)) * (shelfW * 0.86);
        const hole = new THREE.Path();
        hole.absarc(cx, 0, 0.0165, 0, Math.PI * 2, true);
        eggPlateShape.holes.push(hole);
      }
      const eggPlateGeo = new THREE.ExtrudeGeometry(eggPlateShape, {
        depth: 0.010, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0018, bevelSegments: 3, curveSegments: 16
      });
      eggPlateGeo.center();
      const eggLedge = new THREE.Mesh(applyBoxNormalizedUVs(eggPlateGeo), plasticTrimMat);
      eggLedge.rotation.x = Math.PI / 2;
      eggLedge.position.set(0, eggY + 0.004, -0.032);
      innerDoorGroup.add(eggLedge);

      // Concave hollow egg-cup bowls molded underneath each cutout hole (visible depth from above!)
      const eggCupMat = new THREE.MeshStandardMaterial({ color: '#c4b89f', roughness: 0.55, side: THREE.DoubleSide });
      const cupGeo = new THREE.SphereGeometry(0.017, 16, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
      for (let c = 0; c < eggCount; c++) {
        const cx = -shelfW * 0.43 + (c / (eggCount - 1)) * (shelfW * 0.86);
        const bowl = new THREE.Mesh(cupGeo, eggCupMat);
        bowl.position.set(cx, eggY + 0.003, -0.032);
        innerDoorGroup.add(bowl);
      }
      addCurvedDoorRail(eggY + 0.025, 0.058);

      // Middle & bottom molded shelves (clean aged plastic, ZERO white rectangular patches!)
      const midY = -pH * 0.135;
      const midLedge = new THREE.Mesh(createRoundedBox(shelfW, 0.015, 0.054, 0.005, 0.0025), plasticTrimMat);
      midLedge.position.set(0, midY, -0.031);
      innerDoorGroup.add(midLedge);
      addCurvedDoorRail(midY + 0.038, 0.059);

      const botY = -pH * 0.345;
      const botLedge = new THREE.Mesh(createRoundedBox(shelfW, 0.015, 0.054, 0.005, 0.0025), plasticTrimMat);
      botLedge.position.set(0, botY, -0.031);
      innerDoorGroup.add(botLedge);
      addCurvedDoorRail(botY + 0.040, 0.060);

      // Black latch strike slot on handle-side edge
      const latchSlot = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.034, 0.010), blackMetalMat);
      latchSlot.position.set(-pW / 2 + 0.012, 0.01, -0.052);
      innerDoorGroup.add(latchSlot);

      // --- 8J. Authentic Stepped Chrome «ЗиЛ МОСКВА» Winged Emblem & Full-Width Molding Strip (7694.jpg) ---
      function doorSurfaceZ(localX, localY) {
        const nx = (localX - doorCenterX) / (doorW / 2);
        const ny = localY / (doorH / 2);
        const dome = Math.max(0, 1 - (nx * nx * 0.65 + ny * ny * 0.65)) * 0.024;
        return DOOR_D + dome;
      }

      const badgeY = doorH * 0.245;
      const badgeGroup = new THREE.Group();
      badgeGroup.position.set(doorCenterX, badgeY, doorSurfaceZ(doorCenterX, badgeY) + 0.002);
      doorPivot.add(badgeGroup);

      // Full-width curved horizontal chrome molding strip following exact convex door contour
      const stripPts = [];
      for (let i = 0; i <= 28; i++) {
        const u = (i / 28) * 2 - 1;
        const sx = u * (doorW / 2 - 0.022);
        const sz = doorSurfaceZ(doorCenterX + sx, badgeY) - doorSurfaceZ(doorCenterX, badgeY) - Math.pow(Math.abs(u), 4) * 0.016;
        stripPts.push(new THREE.Vector3(sx, 0, sz));
      }
      badgeGroup.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stripPts), 36, 0.0045, 8, false), chromeMat));

      // Stepped chrome winged crest
      const crestShape = new THREE.Shape();
      crestShape.moveTo(-0.152, -0.021);
      crestShape.lineTo(0.152, -0.021);
      crestShape.quadraticCurveTo(0.158, -0.021, 0.158, -0.014);
      crestShape.lineTo(0.158, 0.007);
      crestShape.quadraticCurveTo(0.158, 0.013, 0.152, 0.013);
      crestShape.lineTo(0.074, 0.013);
      crestShape.lineTo(0.066, 0.032);
      crestShape.quadraticCurveTo(0.064, 0.037, 0.058, 0.037);
      crestShape.lineTo(-0.058, 0.037);
      crestShape.quadraticCurveTo(-0.064, 0.037, -0.066, 0.032);
      crestShape.lineTo(-0.074, 0.013);
      crestShape.lineTo(-0.152, 0.013);
      crestShape.quadraticCurveTo(-0.158, 0.013, -0.158, 0.007);
      crestShape.lineTo(-0.158, -0.014);
      crestShape.quadraticCurveTo(-0.158, -0.021, -0.152, -0.021);

      const crestGeo = new THREE.ExtrudeGeometry(crestShape, {
        depth: 0.010, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.0028, bevelSegments: 3
      });
      const crestBody = new THREE.Mesh(crestGeo, chromeMat);
      crestBody.position.z = -0.004;
      crestBody.castShadow = false;
      badgeGroup.add(crestBody);

      const moskvaPlate = new THREE.Mesh(
        new THREE.PlaneGeometry(0.302, 0.030),
        new THREE.MeshStandardMaterial({
          map: createMoskvaBarTexture(),
          roughness: 0.24,
          metalness: 0.50,
          polygonOffset: true,
          polygonOffsetFactor: -1
        })
      );
      moskvaPlate.position.set(0, -0.004, 0.0098);
      badgeGroup.add(moskvaPlate);

      const zilRedPlaque = new THREE.Mesh(
        new THREE.BoxGeometry(0.064, 0.021, 0.003),
        new THREE.MeshStandardMaterial({ map: createZilRedPlaqueTexture(), roughness: 0.18, metalness: 0.12 })
      );
      zilRedPlaque.position.set(0, 0.0235, 0.0095);
      badgeGroup.add(zilRedPlaque);

      // --- 8K. Straight Horizontal Fixed Chrome Handle & Lock (Reference 7694.jpg + User Feedback) ---
      const handleX = doorCenterX - doorW / 2 + 0.026;
      const handleY = -0.02;
      const handleMount = new THREE.Group();
      handleMount.position.set(handleX, handleY, doorSurfaceZ(handleX, handleY) - 0.016);
      doorPivot.add(handleMount);

      // Straight horizontal chrome latch housing seated flush into the left door edge
      const bracketBase = new THREE.Mesh(createRoundedBox(0.066, 0.028, 0.042, 0.004, 0.003), chromeMat);
      bracketBase.position.set(0.028, 0.004, 0.014);
      bracketBase.castShadow = false;
      handleMount.add(bracketBase);

      const bracketGasket = new THREE.Mesh(new THREE.BoxGeometry(0.070, 0.032, 0.006), rubberMat);
      bracketGasket.position.set(0.028, 0.004, -0.006);
      handleMount.add(bracketGasket);

      // Fixed straight horizontal tapered automotive chrome lever (zero floppy lever physics!)
      const handleGripGeo = (function buildHorizontalZilLeverGeo() {
        const rings = 24;
        const segs = 18;
        const positions = [];
        const indices = [];
        for (let i = 0; i <= rings; i++) {
          const t = i / rings;
          const cx = t * 0.195;
          const cy = 0;
          const cz = 0.010 - Math.pow(t, 1.35) * 0.010;

          let capScale = 1.0;
          if (t < 0.05) capScale = Math.sqrt(Math.max(0.01, 1 - Math.pow((0.05 - t) / 0.05, 2)));
          else if (t > 0.93) capScale = Math.sqrt(Math.max(0.01, 1 - Math.pow((t - 0.93) / 0.07, 2)));

          const ry = (0.0132 * (1 - t * 0.62) + 0.0022) * capScale;
          const rz = (0.0102 * (1 - t * 0.48) + 0.0025) * capScale;

          for (let j = 0; j <= segs; j++) {
            const phi = (j / segs) * Math.PI * 2;
            const cPhi = Math.cos(phi), sPhi = Math.sin(phi);
            const ridge = cPhi > 0 ? Math.pow(cPhi, 3) * 0.0024 * (1 - t * 0.5) : 0;
            positions.push(cx, cy + sPhi * ry, cz + cPhi * rz + ridge);
          }
        }
        const stride = segs + 1;
        for (let i = 0; i < rings; i++) {
          for (let j = 0; j < segs; j++) {
            const a = i * stride + j, b = (i + 1) * stride + j;
            const c = (i + 1) * stride + (j + 1), d = i * stride + (j + 1);
            indices.push(a, d, b, b, d, c);
          }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        return geo;
      })();

      const handleGrip = new THREE.Mesh(handleGripGeo, chromeMat);
      handleGrip.position.set(0.004, 0, 0.032);
      handleGrip.castShadow = false;
      handleMount.add(handleGrip);

      const handleStem = new THREE.Mesh(createRoundedBox(0.024, 0.028, 0.024, 0.004, 0.003), chromeMat);
      handleStem.position.set(0.006, 0.002, 0.030);
      handleStem.castShadow = false;
      handleMount.add(handleStem);

      registerInteractive(handleGrip, 'handle', 'Хромированная ручка (клик или потяните дверцу)');
      registerInteractive(handleStem, 'handle', 'Хромированная ручка (клик или потяните дверцу)');
      registerInteractive(bracketBase, 'handle', 'Хромированная ручка (клик или потяните дверцу)');

      // Flush keyhole cylinder + brass key (visible when locked)
      const lockCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.006, 16), chromeMat);
      lockCyl.rotation.x = Math.PI / 2;
      lockCyl.position.set(0.006, 0.002, 0.043);
      handleMount.add(lockCyl);

      const keyholeSlot = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.007, 0.002), blackMetalMat);
      keyholeSlot.position.set(0.006, 0.002, 0.0465);
      handleMount.add(keyholeSlot);

      const keyGroup = new THREE.Group();
      keyGroup.position.set(0.006, 0.002, 0.048);
      keyGroup.visible = false;
      handleMount.add(keyGroup);
      const keyShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.018, 10), brassMat);
      keyShaft.rotation.x = Math.PI / 2;
      keyShaft.position.z = 0.005;
      keyGroup.add(keyShaft);
      const keyBow = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.0026, 8, 16), brassMat);
      keyBow.position.z = 0.019;
      keyGroup.add(keyBow);

      registerInteractive(lockCyl, 'lock', 'Механический замок (клик — запереть/отпереть)');
      registerInteractive(keyBow, 'lock', 'Ключ замка (клик — повернуть)');

      // --- 8L. Soviet Magnets, Note & 3 Aged Vintage User Photos (NO SHADOWS ON MAGNETS/PHOTOS!) ---
      const magnetSideMat = new THREE.MeshStandardMaterial({ color: '#262422', roughness: 0.65 });
      const frontMagnets = [
        { kind: 'olimpiada80', label: 'Магнитик «Олимпиада-80, Москва»', x: doorCenterX + 0.20, y: doorH * 0.07, w: 0.074, h: 0.074, rot: -0.07 },
        { kind: 'gagarin',     label: 'Магнитик «Ю. Гагарин — Поехали! 1961»', x: doorCenterX + 0.10, y: doorH * 0.04, w: 0.068, h: 0.068, rot: 0.11 },
        { kind: 'sochi',       label: 'Сувенирный магнитик «Сочи · Чёрное море»', x: doorCenterX + 0.21, y: -doorH * 0.05, w: 0.078, h: 0.060, rot: 0.06 },
        { kind: 'baikal',      label: 'Сувенирный магнитик «Байкал · Сибирь»', x: doorCenterX + 0.09, y: -doorH * 0.09, w: 0.074, h: 0.058, rot: -0.10 },
        { kind: 'leningrad',   label: 'Сувенирный магнитик «Ленинград»', x: doorCenterX + 0.17, y: doorH * 0.35, w: 0.066, h: 0.066, rot: 0.08 }
      ];

      frontMagnets.forEach(m => {
        const faceMat = new THREE.MeshStandardMaterial({ map: createSovietMagnetTexture(m.kind), roughness: 0.28, metalness: 0.06 });
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(m.w, m.h, 0.006),
          [magnetSideMat, magnetSideMat, magnetSideMat, magnetSideMat, faceMat, magnetSideMat]
        );
        mesh.position.set(m.x, m.y, doorSurfaceZ(m.x, m.y) + 0.0035);
        mesh.rotation.z = m.rot;
        mesh.castShadow = false;
        doorPivot.add(mesh);
        registerInteractive(mesh, 'magnet', m.label);
      });

      // Soviet Shopping List Note pinned by red magnet
      const noteX = doorCenterX + 0.08;
      const noteY = -doorH * 0.25;
      const noteZ = doorSurfaceZ(noteX, noteY);
      const noteMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.095, 0.105, 0.002),
        new THREE.MeshStandardMaterial({ map: createSovietMagnetTexture('note'), roughness: 0.82 })
      );
      noteMesh.position.set(noteX, noteY, noteZ + 0.002);
      noteMesh.rotation.z = -0.05;
      noteMesh.castShadow = false;
      doorPivot.add(noteMesh);
      registerInteractive(noteMesh, 'magnet', 'Записка: «Купить молоко, хлеб, сгущёнку, спички»');

      const pinMagnet = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.013, 0.0085, 18),
        new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.25, metalness: 0.12 })
      );
      pinMagnet.rotation.x = Math.PI / 2;
      pinMagnet.position.set(noteX, noteY + 0.042, noteZ + 0.0065);
      pinMagnet.castShadow = false;
      doorPivot.add(pinMagnet);
      registerInteractive(pinMagnet, 'magnet', 'Красный круглый магнит');

      // All 3 Aged Vintage User Photos (overlapping cat photos on top-left + friends photo on lower-left, NO shadows)
      const userPhotos = [
        {
          src: "assets/tex/fridge/fridge_photo_7699.jpg",
          label: "Старая фотография на магнитике",
          px: doorCenterX - 0.12,
          py: -doorH * 0.19,
          zOff: 0.003,
          w: 0.132,
          h: 0.1444,
          padW: 0.014,
          padH: 0.022,
          rot: 0.065,
          pinColor: '#eab308'
        },
        {
          src: "assets/tex/fridge/fridge_photo_7703.jpg",
          label: "Старая фотография кота на магнитике",
          px: doorCenterX - 0.165,
          py: doorH * 0.365,
          zOff: 0.0028,
          w: 0.138,
          h: 0.103,
          padW: 0.006,
          padH: 0.006,
          rot: -0.075,
          pinColor: '#2563eb'
        },
        {
          src: "assets/tex/fridge/fridge_photo_7702.jpg",
          label: "Старая фотография рыжей кошки на магнитике",
          px: doorCenterX - 0.070,
          py: doorH * 0.350,
          zOff: 0.0074, // sits cleanly slightly on top of the first cat photo
          w: 0.100,
          h: 0.134,
          padW: 0.006,
          padH: 0.006,
          rot: 0.085,
          pinColor: '#15803d'
        }
      ];

      userPhotos.forEach(cfg => {
        const g = new THREE.Group();
        g.position.set(cfg.px, cfg.py, doorSurfaceZ(cfg.px, cfg.py) + cfg.zOff);
        g.rotation.z = cfg.rot;
        doorPivot.add(g);

        const paperW = cfg.w + cfg.padW;
        const paperH = cfg.h + cfg.padH;
        const backing = new THREE.Mesh(
          new THREE.BoxGeometry(paperW, paperH, 0.002),
          new THREE.MeshStandardMaterial({ color: '#ddd0ae', roughness: 0.78 })
        );
        backing.castShadow = false;
        g.add(backing);

        const img = new Image();
        const tex = new THREE.Texture(img);
        tex.encoding = THREE.SRGBColorSpace;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.anisotropy = maxAniso;
        img.onload = function () { tex.needsUpdate = true; };
        img.src = cfg.src;

        const face = new THREE.Mesh(
          new THREE.PlaneGeometry(cfg.w, cfg.h),
          new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.34,
            metalness: 0.02,
            polygonOffset: true,
            polygonOffsetFactor: -1
          })
        );
        face.position.set(0, cfg.padH > 0.01 ? 0.003 : 0, 0.0014);
        face.castShadow = false;
        g.add(face);

        const pin = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.013, 0.0085, 20),
          new THREE.MeshStandardMaterial({ color: cfg.pinColor, roughness: 0.24, metalness: 0.14 })
        );
        pin.rotation.x = Math.PI / 2;
        pin.position.set(0, paperH / 2 - 0.011, 0.0052);
        pin.castShadow = false;
        g.add(pin);

        registerInteractive(face, 'magnet', cfg.label);
        registerInteractive(backing, 'magnet', cfg.label);
        registerInteractive(pin, 'magnet', cfg.label);
      });

      // External Chrome Hinges on Right Edge
      [doorH * 0.34, -doorH * 0.34].forEach(hy => {
        const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.056, 14), chromeMat);
        hinge.position.set(W / 2 - 0.003, LEG_H + BODY_H / 2 + 0.010 + hy, D / 2 + 0.006);
        fridgeRoot.add(hinge);
      });

      // --- 8M. REAR MECHANICAL ASSEMBLY (Condenser Coils, Compressor, Power Cord) ---
      const rearGroup = new THREE.Group();
      rearGroup.position.set(0, LEG_H, -D / 2 - 0.008);
      fridgeRoot.add(rearGroup);

      const coilW = W - 0.14;
      for (let i = 0; i < 14; i++) {
        const cy = 0.36 + i * 0.062;
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, coilW, 8), blackMetalMat);
        tube.rotation.z = Math.PI / 2;
        tube.position.set(0, cy, -0.025);
        rearGroup.add(tube);
        if (i < 13) {
          const bend = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.005, 8, 12, Math.PI), blackMetalMat);
          const rightSide = i % 2 === 0;
          bend.position.set(rightSide ? coilW / 2 : -coilW / 2, cy + 0.031, -0.025);
          bend.rotation.z = rightSide ? -Math.PI / 2 : Math.PI / 2;
          rearGroup.add(bend);
        }
      }
      [-0.18, 0, 0.18].forEach(rx => {
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.86, 8), blackMetalMat);
        rod.position.set(rx, 0.76, -0.018);
        rearGroup.add(rod);
      });

      const compressorGroup = new THREE.Group();
      compressorGroup.position.set(0.04, 0.125, -0.042);
      rearGroup.add(compressorGroup);
      const compDome = new THREE.Mesh(new THREE.SphereGeometry(0.092, 20, 16), blackMetalMat);
      compDome.scale.set(1.15, 0.92, 0.92);
      compDome.castShadow = false;
      compressorGroup.add(compDome);
      const compFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.108, 0.108, 0.016, 20), blackMetalMat);
      compFlange.position.y = -0.01;
      compressorGroup.add(compFlange);

      const copperCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.06, 0.04, 0),
        new THREE.Vector3(0.14, 0.11, -0.02),
        new THREE.Vector3(0.16, 0.24, 0.015),
        new THREE.Vector3(0.22, 0.24, 0.015)
      ]);
      compressorGroup.add(new THREE.Mesh(new THREE.TubeGeometry(copperCurve, 20, 0.005, 8, false), copperMat));

      const cordCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.08, 0.12, -0.02),
        new THREE.Vector3(-0.24, 0.08, -0.14),
        new THREE.Vector3(-0.44, 0.22, -0.22),
        new THREE.Vector3(-0.56, 0.465, -0.265)
      ]);
      rearGroup.add(new THREE.Mesh(
        new THREE.TubeGeometry(cordCurve, 24, 0.0045, 8, false),
        new THREE.MeshStandardMaterial({ color: '#292622', roughness: 0.85 })
      ));


  // =========================================================================
  // 7. COLD VAPOR / MIST PARTICLES (only in full apartment mode)
  // =========================================================================
  let mistMat = null, mistGeo = null, mistSeeds = [], mistCount = 0;
  if (!liteMode) {
          mistCount = isMobile ? 20 : 36;
      mistGeo = new THREE.BufferGeometry();
      const mistPositions = new Float32Array(mistCount * 3);
      mistSeeds = [];
      for (let i = 0; i < mistCount; i++) {
        mistSeeds.push({
          x: (Math.random() - 0.5) * 0.40,
          y: 0.72 + Math.random() * 0.46,
          z: 0.12 + Math.random() * 0.24,
          vy: 0.045 + Math.random() * 0.055,
          phase: Math.random() * Math.PI * 2
        });
        mistPositions[i * 3] = mistSeeds[i].x;
        mistPositions[i * 3 + 1] = mistSeeds[i].y;
        mistPositions[i * 3 + 2] = mistSeeds[i].z;
      }
      mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPositions, 3));
      mistMat = new THREE.PointsMaterial({
        map: createMistSpriteTexture(),
        size: 0.22,
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      fridgeRoot.add(new THREE.Points(mistGeo, mistMat));

  }

  // =========================================================================
  // 8. DRAW-CALL OPTIMIZATION: MERGE STATIC SUB-MESHES PER MATERIAL
  // =========================================================================
  function mergeStaticSubtree(rootGroup, skipSet) {
    if (!mergeGeometries || !rootGroup) return;
    rootGroup.updateMatrixWorld(true);
    const invRoot = new THREE.Matrix4().copy(rootGroup.matrixWorld).invert();
    const buckets = new Map();
    const skipNodes = new Set(skipSet || []);

    function walk(node) {
      if (skipNodes.has(node)) return;
      for (const ch of node.children.slice()) {
        if (skipNodes.has(ch)) continue;
        if (ch.isMesh && !ch.isSkinnedMesh && !ch.isInstancedMesh && !Array.isArray(ch.material) && ch.material && !ch.material.transparent && !ch.userData.noMerge) {
          const k = ch.material.uuid;
          if (!buckets.has(k)) buckets.set(k, []);
          buckets.get(k).push(ch);
        } else {
          walk(ch);
        }
      }
    }
    walk(rootGroup);

    for (const [, list] of buckets) {
      if (list.length < 2) continue;
      const geos = [];
      let ok = true;
      for (const m of list) {
        let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        for (const attr of Object.keys(g.attributes)) {
          if (!['position', 'normal', 'uv'].includes(attr)) g.deleteAttribute(attr);
        }
        if (!g.attributes.uv) {
          g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        }
        if (!g.attributes.normal) g.computeVertexNormals();
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(invRoot, m.matrixWorld));
        geos.push(g);
      }
      if (!ok || geos.length < 2) continue;
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const mm = new THREE.Mesh(merged, list[0].material);
      mm.castShadow = false;
      mm.receiveShadow = true;
      rootGroup.add(mm);
      for (const m of list) {
        if (m.parent) m.parent.remove(m);
      }
    }
  }

  // Merge static parts of body (keeping moving doorPivot, freezerDoorPivot, drawerGroup, thermoKnob, plunger, frostMesh, lampDiffuser)
  mergeStaticSubtree(fridgeRoot, [doorPivot, freezerDoorPivot, drawerGroup, thermoKnob, plunger, lampDiffuser]);
  // Merge static parts inside door (keeping keyGroup & magnets/photos with multi-materials intact)
  mergeStaticSubtree(doorPivot, [keyGroup]);
  // Merge static parts inside freezer door and drawer
  mergeStaticSubtree(freezerDoorPivot, []);
  mergeStaticSubtree(drawerGroup, []);

  // Register textures for global quality management
  [enamelMat.map, enamelMat.roughnessMap, innerEnamelMat.map, plasticTrimMat.map, frostMat.map].forEach(t => {
    if (t) regTex(t);
  });

  wrapperRoot.traverse(o => {
    o.userData.dyn = true;
    o.userData.keep = true;
  });

  // Exact local Y heights of the 4 interior aluminum wire shelves (from floor y = 0)
  const linerWorldY = LEG_H + BODY_H / 2 + innerCenterY;
  const shelfLocalYs = shelfYs.map(sy => +(linerWorldY + sy + 0.005).toFixed(4));

  // Interactive controls
  function setMainDoor(open) {
    if (open && state.locked) {
      SoundEngine.playLockClick(true);
      state.chassisShakeVelZ += 0.05;
      return false;
    }
    state.doorAutoSpring = true;
    if (open) {
      state.doorTarget = 1.85;
      state.doorVel = Math.max(state.doorVel, 1.9);
      SoundEngine.playDoorOpen();
    } else {
      state.doorTarget = 0;
      state.doorVel = Math.min(state.doorVel, -2.4);
    }
    return true;
  }

  function toggleFreezer() {
    if (state.doorAngle < 0.45) return false;
    state.freezerOpen = !state.freezerOpen;
    SoundEngine.playFreezerLatch(state.freezerOpen);
    return state.freezerOpen;
  }

  function toggleDrawer() {
    if (state.doorAngle < 0.55) return false;
    state.drawerOpen = !state.drawerOpen;
    SoundEngine.playDrawerSlide(state.drawerOpen);
    return state.drawerOpen;
  }

  function stepThermostat() {
    state.thermostat = (state.thermostat + 1) % 8;
    state.compressorRunning = state.thermostat > 0 && !state.defrosting;
    if (state.thermostat === 0) state.defrosting = false;
    SoundEngine.playThermostatClick();
    return state.thermostat;
  }

  function toggleDefrost() {
    state.defrosting = !state.defrosting;
    if (state.defrosting) {
      state.compressorRunning = false;
    } else if (state.thermostat > 0) {
      state.compressorRunning = true;
    }
    SoundEngine.playThermostatClick();
    return state.defrosting;
  }

  function toggleLock() {
    if (state.doorAngle > 0.08) return false;
    state.locked = !state.locked;
    state.keyTarget = state.locked ? Math.PI * 0.52 : 0;
    SoundEngine.playLockClick(state.locked);
    return state.locked;
  }

  const _boxFrz = new THREE.Box3();
  const _boxDrw = new THREE.Box3();
  const _boxThm = new THREE.Box3();

  function getPartBoxes() {
    wrapperRoot.updateMatrixWorld(true);
    _boxFrz.setFromObject(freezerDoorPivot).expandByScalar(0.025);
    _boxDrw.setFromObject(drawerGroup).expandByScalar(0.025);
    _boxThm.setFromObject(thermoGroup).expandByScalar(0.035);
    return { freezer: _boxFrz, drawer: _boxDrw, thermo: _boxThm };
  }

  function update(dt, nowMs, nearPlayer = true) {
    if (!nearPlayer) return;
    const d = Math.min(0.05, dt);

    // Main door spring-damper + gasket suction
    if (state.doorAutoSpring) {
      const force = (state.doorTarget - state.doorAngle) * 20 - state.doorVel * 6.2;
      state.doorVel += force * d;
    } else {
      state.doorVel *= Math.exp(-2.4 * d);
      if (state.doorAngle < 0.14 && state.doorVel <= 0.15) state.doorVel -= 5.2 * d;
    }
    state.doorAngle += state.doorVel * d;
    if (state.doorAngle <= 0) {
      const impactSpeed = Math.abs(state.doorVel);
      state.doorAngle = 0;
      if (impactSpeed > 0.35) {
        const intensity = Math.min(1, impactSpeed / 7.5);
        SoundEngine.playDoorSlam(intensity);
        state.chassisShakeVelZ -= intensity * 0.18;
        state.chassisShakeVelX += (Math.random() - 0.5) * intensity * 0.06;
        state.doorVel = impactSpeed * 0.08;
      } else {
        state.doorVel = 0;
      }
      if (state.doorAutoSpring && state.doorTarget === 0 && Math.abs(state.doorVel) < 0.12) state.doorVel = 0;
    }
    if (state.doorAngle >= 2.04) {
      state.doorAngle = 2.04;
      state.doorVel = -Math.abs(state.doorVel) * 0.22;
    }
    doorPivot.rotation.y = state.doorAngle;

    // Brass key rotation
    state.keyAngle += (state.keyTarget - state.keyAngle) * Math.min(1, d * 12);
    keyGroup.rotation.z = state.keyAngle;
    keyGroup.visible = state.locked || Math.abs(state.keyAngle) > 0.05;

    // Interior incandescent lamp glow & plunger switch (zero extra PointLight cost!)
    const shouldLampBeOn = state.doorAngle > 0.055;
    if (shouldLampBeOn !== state.lampOn) state.lampOn = shouldLampBeOn;
    interiorLight.intensity += ((state.lampOn ? 2.15 : 0) - interiorLight.intensity) * Math.min(1, d * 16);
    bulbMat.emissiveIntensity = interiorLight.intensity * 1.4;
    innerEnamelMat.emissiveIntensity = interiorLight.intensity * 0.22;
    plunger.position.z = innerD / 2 + (state.lampOn ? 0.020 : 0.011);

    // Freezer door spring-damper + physical pushing when closing main door
    const maxAllowedFreezer = state.doorAngle < 0.12 ? 0 : Math.min(1.65, Math.max(0, (state.doorAngle - 0.10) * 1.12));
    if (state.freezerOpen && state.doorAngle < 0.45 && state.doorVel <= 0.05) state.freezerOpen = false;
    const frzTarget = state.freezerOpen ? Math.min(1.55, maxAllowedFreezer) : 0;
    state.freezerVel += ((frzTarget - state.freezerAngle) * 28 - state.freezerVel * 7.8) * d;
    state.freezerAngle = Math.max(0, Math.min(maxAllowedFreezer, state.freezerAngle + state.freezerVel * d));
    if (state.freezerAngle >= maxAllowedFreezer && state.freezerVel > 0) state.freezerVel = 0;
    freezerDoorPivot.rotation.y = state.freezerAngle;

    // Crisper drawer linear damping + physical pushing when closing main door
    const maxAllowedDrawer = state.doorAngle < 0.25 ? 0 : Math.min(0.34, Math.max(0, (state.doorAngle - 0.25) * 0.45));
    if (state.drawerOpen && state.doorAngle < 0.55 && state.doorVel <= 0.05) state.drawerOpen = false;
    const drwTarget = state.drawerOpen ? Math.min(0.32, maxAllowedDrawer) : 0;
    state.drawerVel += ((drwTarget - state.drawerPos) * 32 - state.drawerVel * 8.5) * d;
    state.drawerPos = Math.max(0, Math.min(maxAllowedDrawer, state.drawerPos + state.drawerVel * d));
    if (state.drawerPos >= maxAllowedDrawer && state.drawerVel > 0) state.drawerVel = 0;
    drawerGroup.position.z = -0.01 + state.drawerPos;

    // Thermostat knob rotation
    const targetKnobRot = 2.2 - (state.thermostat / 7) * 4.4;
    thermoKnob.rotation.z += (targetKnobRot - thermoKnob.rotation.z) * Math.min(1, d * 10);

    // Chassis shake & compressor micro-vibration
    state.chassisShakeVelX += (-state.chassisShakeX * 140 - state.chassisShakeVelX * 12) * d;
    state.chassisShakeVelZ += (-state.chassisShakeZ * 140 - state.chassisShakeVelZ * 12) * d;
    state.chassisShakeX += state.chassisShakeVelX * d;
    state.chassisShakeZ += state.chassisShakeVelZ * d;
    let vibX = 0, vibZ = 0;
    if (state.compressorRunning) {
      const vibAmp = 0.00032 + state.thermostat * 0.00007;
      vibX = Math.sin(nowMs * 0.095) * vibAmp;
      vibZ = Math.cos(nowMs * 0.11) * vibAmp;
    }
    fridgeRoot.position.set(state.chassisShakeX + vibX, 0, state.chassisShakeZ + vibZ);
    fridgeRoot.rotation.x = state.chassisShakeZ * 0.45;
    fridgeRoot.rotation.z = -state.chassisShakeX * 0.45;

    // Thermal & frost simulation
    const doorOpenFactor = Math.min(1, state.doorAngle / 1.2);
    const targetChamber = state.compressorRunning ? (8.5 - state.thermostat * 0.95 + doorOpenFactor * 4.5) : 18.0;
    const targetFreezer = state.compressorRunning ? (-4.0 - state.thermostat * 1.9 + (state.freezerOpen ? 5.0 : 0) + doorOpenFactor * 2.0) : 4.0;
    state.chamberTemp += (targetChamber - state.chamberTemp) * d * 0.08;
    state.freezerTemp += (targetFreezer - state.freezerTemp) * d * 0.06;
    if (state.defrosting || !state.compressorRunning) state.frostLevel = Math.max(0, state.frostLevel - d * 0.14);
    else state.frostLevel += (Math.min(1, 0.25 + state.thermostat * 0.1) - state.frostLevel) * d * 0.03;
    frostMat.opacity = state.frostLevel * 0.84;

    // Cold mist particles
    if (mistMat && mistGeo) {
      const mistVis = (doorOpenFactor * 0.55 + (state.freezerOpen ? 0.45 : 0)) * (state.compressorRunning ? 1 : 0.2);
      mistMat.opacity += (mistVis * 0.34 - mistMat.opacity) * Math.min(1, d * 4);
      if (mistMat.opacity > 0.01) {
        const posArr = mistGeo.attributes.position.array;
        for (let i = 0; i < mistCount; i++) {
          const s = mistSeeds[i];
          s.y -= s.vy * d;
          s.z += 0.045 * d;
          if (s.y < 0.15 || s.z > 0.65) {
            s.x = (Math.random() - 0.5) * 0.40;
            s.y = state.freezerOpen ? (1.02 + Math.random() * 0.18) : (0.75 + Math.random() * 0.40);
            s.z = 0.14 + Math.random() * 0.14;
          }
          posArr[i * 3] = s.x + Math.sin(nowMs * 0.0015 + s.phase) * 0.03;
          posArr[i * 3 + 1] = s.y;
          posArr[i * 3 + 2] = s.z;
        }
        mistGeo.attributes.position.needsUpdate = true;
      }
    }
  }

  return {
    root: wrapperRoot,
    fridgeRoot,
    doorPivot,
    freezerDoorPivot,
    drawerGroup,
    thermoGroup,
    shelfLocalYs,
    state,
    SoundEngine,
    setMainDoor,
    toggleFreezer,
    toggleDrawer,
    stepThermostat,
    toggleDefrost,
    toggleLock,
    getPartBoxes,
    update
  };
}
