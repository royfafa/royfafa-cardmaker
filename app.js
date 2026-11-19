/* ============================================================
   로이파파 카드메이커
   모바일 우선 카드뉴스 · 9:16 숏폼 제작 (순수 HTML/CSS/JS)
   개인정보 없이 동작하는 공개용 웹앱입니다.
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- 기본 상수 ---------------- */
  const CARD_W = 1080;
  const CARD_H = 1350;
  const VID_W = 1080;
  const VID_H = 1920;
  const FONT_STACK = "'Pretendard Variable', Pretendard, 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";

  const ACCENTS = [
    { id: 'mint', name: '다크민트', hex: '#52E5B7' },
    { id: 'amber', name: '다크앰버', hex: '#FFB030' },
    { id: 'yellow', name: '노란색', hex: '#FACC15' },
    { id: 'sky', name: '스카이블루', hex: '#38BDF8' }
  ];

  const TEMPLATES = [
    { id: 'photo', name: '사진형', desc: '상단 사진 + 하단 본문' },
    { id: 'infographic', name: '설명 도식형', desc: '번호 배지 인포그래픽' },
    { id: 'text', name: '글 중심형', desc: '딥 다크 + 넉넉한 여백' }
  ];

  const LS = {
    working: 'royfafa.working.v1',
    projects: 'royfafa.projects.v1',
    settings: 'royfafa.settings.v1',
    key: 'royfafa.apikey.v1'
  };

  const VIDEO_CANDIDATES = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];

  /* ---------------- 작은 도구들 ---------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  const uid = (p) => (p || 'id') + '_' + Math.random().toString(36).slice(2, 9);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pad2 = (n) => String(n).padStart(2, '0');
  const debounce = (fn, ms) => {
    let t = 0;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms || 120);
    };
  };

  function hexA(hex, alpha) {
    const h = String(hex || '#52E5B7').replace('#', '');
    const full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
    const n = parseInt(full, 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  let toastTimer = 0;
  function toast(msg, type) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast' + (type ? ' ' + type : '');
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3400);
  }

  function askConfirm(title, body, okLabel) {
    const dlg = $('#dialog');
    if (!dlg || typeof dlg.showModal !== 'function') {
      return Promise.resolve(window.confirm(title + '\n\n' + body));
    }
    $('#dialog-title').textContent = title;
    $('#dialog-body').textContent = body;
    $('#dialog-ok').textContent = okLabel || '확인';
    dlg.returnValue = '';
    return new Promise((resolve) => {
      const onClose = () => {
        dlg.removeEventListener('close', onClose);
        resolve(dlg.returnValue === 'ok');
      };
      dlg.addEventListener('close', onClose);
      dlg.showModal();
    });
  }

  /* ---------------- 설정 / 프로젝트 모델 ---------------- */
  function defaultSettings() {
    return {
      handle: '@royfafa2023',
      subtitle: '로이파파의 AI·생활 기록',
      template: 'text',
      accent: '#52E5B7'
    };
  }

  function createCard(role, seed) {
    const base = {
      id: uid('c'),
      role: role,
      title1: '',
      title2: '',
      subtitle: '',
      body: '',
      items: [],
      layout: 'inherit',
      photo: { src: '', brightness: 100, focus: 50 }
    };
    return Object.assign(base, seed || {});
  }

  function newProject(settings) {
    const s = settings || defaultSettings();
    const cover = createCard('cover', {
      title1: '나만의 카드뉴스를',
      title2: '3분 만에 만들기',
      subtitle: s.subtitle
    });
    const cta = createCard('cta', {
      subtitle: s.subtitle,
      body: '저장하고 천천히 다시 보세요'
    });
    return {
      id: uid('p'),
      name: '',
      topic: '',
      memo: '',
      hooks: [],
      cards: [cover, cta],
      caption: '',
      hashtags: [],
      design: { template: s.template, accent: s.accent, handle: s.handle, subtitle: s.subtitle },
      updatedAt: Date.now()
    };
  }

  const VALID_TEMPLATES = ['photo', 'infographic', 'text'];
  const VALID_ROLES = ['cover', 'body', 'cta'];

  function normalizeProject(raw) {
    const settings = state.settings || defaultSettings();
    const p = Object.assign({}, raw || {});
    const design = Object.assign(
      { template: settings.template, accent: settings.accent, handle: settings.handle, subtitle: settings.subtitle },
      p.design || {}
    );
    if (!design.handle) design.handle = settings.handle;
    if (!design.subtitle) design.subtitle = settings.subtitle;
    if (VALID_TEMPLATES.indexOf(design.template) < 0) design.template = settings.template;
    if (!/^#[0-9a-f]{6}$/i.test(String(design.accent || ''))) design.accent = settings.accent;

    const cards = Array.isArray(p.cards) ? p.cards : [];
    const normalized = cards.map((card) => {
      const c = createCard(VALID_ROLES.indexOf(card.role) >= 0 ? card.role : 'body', {});
      c.id = card.id || c.id;
      c.title1 = String(card.title1 || '');
      c.title2 = String(card.title2 || '');
      c.subtitle = String(card.subtitle || '');
      c.body = String(card.body || '');
      c.items = Array.isArray(card.items) ? card.items.map(String).filter(Boolean) : [];
      c.layout = VALID_TEMPLATES.indexOf(card.layout) >= 0 ? card.layout : 'inherit';
      const ph = card.photo || {};
      c.photo = {
        src: typeof ph.src === 'string' ? ph.src : '',
        brightness: Number.isFinite(Number(ph.brightness)) ? clamp(Number(ph.brightness), 30, 160) : 100,
        focus: Number.isFinite(Number(ph.focus)) ? clamp(Number(ph.focus), 0, 100) : 50
      };
      return c;
    });

    if (!normalized.length) {
      normalized.push(createCard('cover', { title1: '나만의 카드뉴스를', title2: '3분 만에 만들기', subtitle: design.subtitle }));
      normalized.push(createCard('cta', { subtitle: design.subtitle, body: '저장하고 천천히 다시 보세요' }));
    }
    if (VALID_ROLES.indexOf(normalized[0].role) < 0) normalized[0].role = 'cover';
    normalized[0].role = 'cover';
    const last = normalized[normalized.length - 1];
    if (normalized.length > 1) last.role = 'cta';

    const hooks = Array.isArray(p.hooks)
      ? p.hooks.map((h) => ({
          id: h.id || uid('h'),
          type: String(h.type || '핵심형'),
          line1: String(h.line1 || ''),
          line2: String(h.line2 || '')
        }))
      : [];

    return {
      id: p.id || uid('p'),
      name: String(p.name || ''),
      topic: String(p.topic || ''),
      memo: String(p.memo || ''),
      hooks: hooks,
      cards: normalized,
      caption: String(p.caption || ''),
      hashtags: Array.isArray(p.hashtags) ? p.hashtags.map(String) : [],
      design: design,
      updatedAt: Number(p.updatedAt) || Date.now()
    };
  }

  /* ---------------- 상태 ---------------- */
  const state = {
    tab: 'workspace',
    step: 1,
    mode: 'free',
    activeCard: 0,
    project: null,
    settings: defaultSettings(),
    apiKey: '',
    ui: {
      bgmFile: null,
      dwell: 3000,
      transition: 'fade',
      recording: false,
      previewing: false
    }
  };

  const imageCache = new Map();
  const missingImageNotified = new Set();

  /* ---------------- 저장 도우미 ---------------- */
  const persistWorking = debounce(() => {
    if (!state.project) return;
    saveJSON(LS.working, state.project);
  }, 450);

  function touch() {
    if (!state.project) return;
    state.project.updatedAt = Date.now();
    persistWorking();
  }

  function projectSignature() {
    const p = state.project;
    if (!p) return '';
    return p.name + '|' + p.cards.length;
  }

  /* ============================================================
     캔버스 그리기
     ============================================================ */
  function setFont(ctx, size, weight) {
    ctx.font = (weight || 700) + ' ' + Math.round(size) + 'px ' + FONT_STACK;
  }

  function wrapText(ctx, text, maxWidth) {
    const out = [];
    const paragraphs = String(text == null ? '' : text).split('\n');
    for (let pi = 0; pi < paragraphs.length; pi++) {
      const para = paragraphs[pi].trim();
      if (!para) {
        if (out.length) out.push('');
        continue;
      }
      const words = para.split(/\s+/);
      let line = '';
      for (let wi = 0; wi < words.length; wi++) {
        const w = words[wi];
        const cand = line ? line + ' ' + w : w;
        if (ctx.measureText(cand).width <= maxWidth) {
          line = cand;
          continue;
        }
        if (line) {
          out.push(line);
          line = '';
        }
        if (ctx.measureText(w).width > maxWidth) {
          let chunk = '';
          const chars = Array.from(w);
          for (let ci = 0; ci < chars.length; ci++) {
            const ch = chars[ci];
            if (chunk && ctx.measureText(chunk + ch).width > maxWidth) {
              out.push(chunk);
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          line = chunk;
        } else {
          line = w;
        }
      }
      if (line) out.push(line);
    }
    return out;
  }

  function ellipsize(ctx, line, maxWidth) {
    if (ctx.measureText(line).width <= maxWidth) return line;
    let s = line;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxWidth) s = s.slice(0, -1);
    return s + '…';
  }

  function fitLines(ctx, text, width, maxSize, minSize, weight, lineHeight, maxLines) {
    let size = maxSize;
    let lines = [];
    let lh = maxSize;
    for (;;) {
      setFont(ctx, size, weight);
      lh = Math.round(size * lineHeight);
      lines = wrapText(ctx, text, width);
      if (lines.length <= maxLines || size <= minSize) break;
      size -= 2;
    }
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[lines.length - 1] = ellipsize(ctx, lines[lines.length - 1], width);
    }
    return { size: size, lines: lines, lh: lh };
  }

  function linesHeight(fit) {
    return fit.lines.length * fit.lh;
  }

  function drawLines(ctx, lines, x, y, lh, color, align, width, size, weight) {
    ctx.save();
    if (size) setFont(ctx, size, weight || 700);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'top';
    const dx = align === 'center' ? x + width / 2 : align === 'right' ? x + width : x;
    let cy = y;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], dx, cy);
      cy += lh;
    }
    ctx.restore();
    return cy;
  }

  function drawParagraph(ctx, text, o) {
    if (!text) return { height: 0 };
    const fit = fitLines(
      ctx,
      text,
      o.width,
      o.size,
      o.minSize || Math.round(o.size * 0.6),
      o.weight || 500,
      o.lineHeight || 1.45,
      o.maxLines || 6
    );
    let lines = fit.lines;
    if (o.maxHeight) {
      const maxLineCount = Math.max(1, Math.floor(o.maxHeight / fit.lh));
      if (lines.length > maxLineCount) {
        lines = lines.slice(0, maxLineCount);
        lines[lines.length - 1] = ellipsize(ctx, lines[lines.length - 1], o.width);
      }
    }
    const height = lines.length * fit.lh;
    let y = o.y;
    if (o.valign === 'center' && o.maxHeight) y = o.y + Math.max(0, (o.maxHeight - height) / 2);
    drawLines(ctx, lines, o.x, y, fit.lh, o.color || '#F2F7F4', o.align, o.width, fit.size, o.weight || 500);
    return { height: height, size: fit.size };
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, rr);
      return;
    }
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawCoverImage(ctx, img, x, y, w, h, focus, brightness) {
    if (!img) return;
    const ir = img.width / img.height;
    const br = w / h;
    let dw, dh;
    if (ir > br) {
      dh = h;
      dw = h * ir;
    } else {
      dw = w;
      dh = w / ir;
    }
    const dx = x + (w - dw) / 2;
    const f = clamp(Number(focus) || 0, 0, 100) / 100;
    const dy = y + (h - dh) * f;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    const b = clamp(Number(brightness) || 100, 20, 200);
    if (b !== 100) ctx.filter = 'brightness(' + b / 100 + ')';
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  function drawBaseTexture(ctx, accent) {
    ctx.fillStyle = '#070A09';
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    const g = ctx.createRadialGradient(CARD_W * 0.8, CARD_H * 0.14, 40, CARD_W * 0.8, CARD_H * 0.14, 760);
    g.addColorStop(0, hexA(accent, 0.26));
    g.addColorStop(0.55, hexA(accent, 0.06));
    g.addColorStop(1, hexA(accent, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    for (let x = 84; x < CARD_W; x += 84) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CARD_H);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFooter(ctx, idx, total, proj) {
    const handle = proj.design.handle || '@royfafa2023';
    ctx.save();
    setFont(ctx, 27, 600);
    ctx.fillStyle = 'rgba(255,255,255,0.36)';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText(handle, 84, CARD_H - 48);
    ctx.textAlign = 'right';
    ctx.fillText(pad2(idx + 1) + ' / ' + pad2(total), CARD_W - 84, CARD_H - 48);
    ctx.restore();
  }

  function drawCover(ctx, card, proj, idx, total) {
    const accent = proj.design.accent;
    const img = card.photo && card.photo.src ? getImage(card.photo.src) : null;

    if (img) {
      ctx.fillStyle = '#050807';
      ctx.fillRect(0, 0, CARD_W, CARD_H);
      drawCoverImage(ctx, img, 0, 0, CARD_W, CARD_H, card.photo.focus, card.photo.brightness);
      const g = ctx.createLinearGradient(0, 0, 0, CARD_H);
      g.addColorStop(0, 'rgba(4,7,6,0.62)');
      g.addColorStop(0.34, 'rgba(4,7,6,0.22)');
      g.addColorStop(0.6, 'rgba(5,8,7,0.72)');
      g.addColorStop(0.82, 'rgba(5,8,7,0.95)');
      g.addColorStop(1, 'rgba(5,8,7,0.99)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CARD_W, CARD_H);
    } else {
      drawBaseTexture(ctx, accent);
    }

    // 상단 라벨
    ctx.save();
    setFont(ctx, 26, 700);
    const label = '카드뉴스';
    const labelW = ctx.measureText(label).width + 48;
    ctx.fillStyle = hexA(accent, 0.14);
    roundRect(ctx, 84, 78, labelW, 54, 27);
    ctx.fill();
    ctx.strokeStyle = hexA(accent, 0.42);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 84 + 24, 78 + 28);
    ctx.restore();

    // 제목 블록
    const titleW = 912;
    const x = 84;
    const bottomLimit = CARD_H - 168;
    const subtitleText = card.subtitle || proj.design.subtitle || '';
    const subFit = subtitleText
      ? fitLines(ctx, subtitleText, titleW, 33, 24, 600, 1.4, 1)
      : null;
    const titleBottom = bottomLimit - (subFit ? linesHeight(subFit) + 26 : 0);

    const t1 = fitLines(ctx, card.title1 || '', titleW, 96, 52, 800, 1.18, 3);
    const t2 = card.title2 ? fitLines(ctx, card.title2, titleW, 96, 52, 800, 1.18, 3) : null;
    const size = t2 ? Math.min(t1.size, t2.size) : t1.size;

    setFont(ctx, size, 800);
    let lines1 = wrapText(ctx, card.title1 || '', titleW);
    if (lines1.length > 3) lines1 = lines1.slice(0, 3);
    let lines2 = t2 ? wrapText(ctx, card.title2, titleW) : [];
    if (lines2.length > 3) lines2 = lines2.slice(0, 3);
    const lh = Math.round(size * 1.18);
    const h1 = lines1.length * lh;
    const h2 = lines2.length * lh;
    const blockH = h1 + (h2 ? 16 : 0) + h2;
    let y = titleBottom - blockH;

    // 강조 룰
    ctx.fillStyle = accent;
    roundRect(ctx, x, y - 46, 72, 7, 3.5);
    ctx.fill();

    drawLines(ctx, lines1, x, y, lh, '#F4F8F5', 'left', titleW, size, 800);
    if (h2) {
      y += h1 + 16;
      drawLines(ctx, lines2, x, y, lh, accent, 'left', titleW, size, 800);
    }

    if (subFit) {
      drawLines(ctx, subFit.lines, x, titleBottom + 26, subFit.lh, 'rgba(255,255,255,0.6)', 'left', titleW, subFit.size, 600);
    }

    drawFooter(ctx, idx, total, proj);
  }

  function drawPhotoPlaceholder(ctx, accent, h) {
    const g = ctx.createLinearGradient(0, 0, CARD_W, h);
    g.addColorStop(0, hexA(accent, 0.2));
    g.addColorStop(0.5, '#131C18');
    g.addColorStop(1, '#0A100E');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CARD_W, h);

    ctx.save();
    ctx.strokeStyle = hexA(accent, 0.16);
    ctx.lineWidth = 2;
    for (let r = 140; r <= 640; r += 62) {
      ctx.beginPath();
      ctx.arc(CARD_W / 2, h * 0.95, r, Math.PI * 1.06, Math.PI * 1.94);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    setFont(ctx, 30, 700);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('P H O T O', CARD_W / 2, h * 0.5);
    ctx.restore();
  }

  function drawPhotoCard(ctx, card, proj, idx, total) {
    const accent = proj.design.accent;
    const photoH = 640;
    ctx.fillStyle = '#070A09';
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    const img = card.photo && card.photo.src ? getImage(card.photo.src) : null;
    if (img) {
      drawCoverImage(ctx, img, 0, 0, CARD_W, photoH + 70, card.photo.focus, card.photo.brightness);
    } else {
      drawPhotoPlaceholder(ctx, accent, photoH + 70);
    }

    const fade = ctx.createLinearGradient(0, photoH - 170, 0, photoH + 70);
    fade.addColorStop(0, 'rgba(7,10,9,0)');
    fade.addColorStop(0.55, 'rgba(7,10,9,0.72)');
    fade.addColorStop(1, '#070A09');
    ctx.fillStyle = fade;
    ctx.fillRect(0, photoH - 170, CARD_W, 240);

    const x = 84;
    const w = 912;
    let y = photoH + 190;

    if (card.subtitle) {
      ctx.fillStyle = accent;
      roundRect(ctx, x, y - 32, 44, 6, 3);
      ctx.fill();
      const sub = fitLines(ctx, card.subtitle, w, 40, 28, 800, 1.3, 2);
      drawLines(ctx, sub.lines, x, y, sub.lh, accent, 'left', w, sub.size, 800);
      y += linesHeight(sub) + 30;
    }

    const items = (card.items || []).filter(Boolean);
    if (card.body) {
      const body = drawParagraph(ctx, card.body, {
        x: x, y: y, width: w, size: 54, minSize: 36, maxHeight: CARD_H - 132 - y,
        weight: 500, lineHeight: 1.46, color: '#E9F1EC', maxLines: 5
      });
      y += body.height + 22;
    }
    if (items.length) {
      const shown = items.slice(0, Math.min(3, Math.floor((CARD_H - 132 - y) / 52)));
      ctx.save();
      setFont(ctx, 34, 600);
      ctx.textBaseline = 'top';
      for (let i = 0; i < shown.length; i++) {
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(x + 8, y + 18, 5, 0, Math.PI * 2);
        ctx.fill();
        const line = ellipsize(ctx, shown[i], w - 34);
        ctx.fillStyle = 'rgba(233,241,236,0.86)';
        ctx.fillText(line, x + 30, y);
        y += 52;
      }
      ctx.restore();
    }

    drawFooter(ctx, idx, total, proj);
  }

  function drawInfoCard(ctx, card, proj, idx, total) {
    const accent = proj.design.accent;
    ctx.fillStyle = '#0B100E';
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    const glow = ctx.createRadialGradient(CARD_W, 0, 40, CARD_W, 0, 900);
    glow.addColorStop(0, hexA(accent, 0.16));
    glow.addColorStop(1, hexA(accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    const x = 84;
    const w = 912;
    let y = 112;

    ctx.fillStyle = accent;
    roundRect(ctx, x, y, 8, 52, 4);
    ctx.fill();

    setFont(ctx, 24, 700);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('CARD ' + pad2(idx + 1), x + 30, y + 2);

    if (card.subtitle) {
      const sub = fitLines(ctx, card.subtitle, w - 30, 50, 32, 800, 1.28, 2);
      let sy = y + 34;
      drawLines(ctx, sub.lines, x + 30, sy, sub.lh, '#F3F8F5', 'left', w - 30, sub.size, 800);
      y = sy + linesHeight(sub) + 34;
    } else {
      y += 90;
    }

    if (card.body) {
      const body = drawParagraph(ctx, card.body, {
        x: x, y: y, width: w, size: 41, minSize: 30, maxHeight: 210,
        weight: 500, lineHeight: 1.5, color: 'rgba(214,228,220,0.86)', maxLines: 4
      });
      y += body.height + 42;
    }

    const items = (card.items || []).filter(Boolean).slice(0, 5);
    const bottom = CARD_H - 132;

    if (items.length) {
      const gap = 16;
      const available = bottom - y;
      const rowH = clamp((available - gap * (items.length - 1)) / items.length, 84, 176);
      const blockH = items.length * rowH + gap * (items.length - 1);
      const startY = y + Math.max(0, (available - blockH) / 2);
      for (let i = 0; i < items.length; i++) {
        const ry = startY + i * (rowH + gap);
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.035)';
        roundRect(ctx, x, ry, w, rowH, 22);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        const r = Math.min(38, rowH * 0.3);
        const cx = x + 34 + r;
        const cy = ry + rowH / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = hexA(accent, 0.16);
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = hexA(accent, 0.65);
        ctx.stroke();

        setFont(ctx, r * 0.95, 800);
        ctx.fillStyle = accent;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pad2(i + 1), cx, cy + 1);

        const tx = cx + r + 26;
        const tw = w - (tx - x) - 28;
        const tSize = clamp(rowH * 0.3, 30, 44);
        const fit = fitLines(ctx, items[i], tw, tSize, 26, 600, 1.32, 2);
        const ty = cy - linesHeight(fit) / 2;
        drawLines(ctx, fit.lines, tx, ty, fit.lh, '#EEF5F1', 'left', tw, fit.size, 600);
      }
      y += items.length * (rowH + gap);
    } else if (!card.body) {
      const fit = fitLines(ctx, card.subtitle || '내용을 입력해 주세요', w, 60, 36, 700, 1.4, 4);
      drawLines(ctx, fit.lines, x, CARD_H / 2, fit.lh, 'rgba(255,255,255,0.4)', 'left', w, fit.size, 700);
    }

    drawFooter(ctx, idx, total, proj);
  }

  function drawTextCard(ctx, card, proj, idx, total) {
    const accent = proj.design.accent;
    ctx.fillStyle = '#080B0A';
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    const glow = ctx.createRadialGradient(CARD_W * 0.92, CARD_H * 0.06, 30, CARD_W * 0.92, CARD_H * 0.06, 820);
    glow.addColorStop(0, hexA(accent, 0.13));
    glow.addColorStop(1, hexA(accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    const x = 104;
    const w = 872;
    let y = 190;

    ctx.fillStyle = accent;
    roundRect(ctx, x, y, 46, 6, 3);
    ctx.fill();

    y += 40;
    if (card.subtitle) {
      const sub = fitLines(ctx, card.subtitle, w, 42, 30, 800, 1.3, 2);
      drawLines(ctx, sub.lines, x, y, sub.lh, accent, 'left', w, sub.size, 800);
      y += linesHeight(sub) + 46;
    }

    const items = (card.items || []).filter(Boolean);
    if (card.body) {
      const body = drawParagraph(ctx, card.body, {
        x: x, y: y, width: w, size: 74, minSize: 40, maxHeight: CARD_H - 200 - y,
        weight: 500, lineHeight: 1.52, color: '#F1F6F3', maxLines: 8
      });
      y += body.height + 34;
    }

    if (items.length && y < CARD_H - 220) {
      ctx.save();
      setFont(ctx, 36, 500);
      ctx.textBaseline = 'top';
      const shown = items.slice(0, Math.min(4, Math.floor((CARD_H - 200 - y) / 62)));
      for (let i = 0; i < shown.length; i++) {
        ctx.fillStyle = accent;
        ctx.fillRect(x, y + 20, 22, 4);
        ctx.fillStyle = 'rgba(226,236,230,0.8)';
        ctx.fillText(ellipsize(ctx, shown[i], w - 44), x + 44, y);
        y += 62;
      }
      ctx.restore();
    }

    drawFooter(ctx, idx, total, proj);
  }

  function drawCta(ctx, card, proj, idx, total) {
    const accent = proj.design.accent;
    ctx.fillStyle = '#070A09';
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    const glow = ctx.createRadialGradient(CARD_W / 2, CARD_H * 0.6, 40, CARD_W / 2, CARD_H * 0.6, 620);
    glow.addColorStop(0, hexA(accent, 0.22));
    glow.addColorStop(0.65, hexA(accent, 0.05));
    glow.addColorStop(1, hexA(accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    ctx.save();
    ctx.strokeStyle = hexA(accent, 0.16);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CARD_W / 2, CARD_H * 0.52, 300, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = hexA(accent, 0.08);
    ctx.beginPath();
    ctx.arc(CARD_W / 2, CARD_H * 0.52, 372, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    const w = 820;
    const x = (CARD_W - w) / 2;

    if (card.subtitle) {
      const sub = fitLines(ctx, card.subtitle, w, 32, 22, 600, 1.35, 1);
      drawLines(ctx, sub.lines, x, 372, sub.lh, 'rgba(255,255,255,0.5)', 'center', w, sub.size, 600);
    }

    const body = card.body || '저장하고 천천히 다시 보세요';
    const fit = fitLines(ctx, body, w, 80, 46, 900, 1.28, 3);
    const bodyTop = CARD_H * 0.5 - linesHeight(fit) / 2;
    drawLines(ctx, fit.lines, x, bodyTop, fit.lh, '#F6FBF8', 'center', w, fit.size, 900);

    ctx.save();
    const handleFit = fitLines(ctx, proj.design.handle || '@royfafa2023', 900, 62, 30, 800, 1.2, 1);
    drawLines(ctx, handleFit.lines, (CARD_W - 900) / 2, CARD_H - 320 - handleFit.lh + 12, handleFit.lh, accent, 'center', 900, handleFit.size, 800);
    setFont(ctx, 28, 600);
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('팔로우하고 저장해 두세요', CARD_W / 2, CARD_H - 258);
    ctx.restore();

    ctx.save();
    setFont(ctx, 27, 600);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(pad2(idx + 1) + ' / ' + pad2(total), CARD_W - 84, CARD_H - 48);
    ctx.restore();
  }

  function drawCard(ctx, card, idx, proj) {
    const total = proj.cards.length;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    if (card.role === 'cover') {
      drawCover(ctx, card, proj, idx, total);
    } else if (card.role === 'cta') {
      drawCta(ctx, card, proj, idx, total);
    } else {
      const layout = VALID_TEMPLATES.indexOf(card.layout) >= 0 ? card.layout : proj.design.template;
      if (layout === 'photo') drawPhotoCard(ctx, card, proj, idx, total);
      else if (layout === 'infographic') drawInfoCard(ctx, card, proj, idx, total);
      else drawTextCard(ctx, card, proj, idx, total);
    }
    ctx.restore();
  }

  /* ---------------- 이미지 ---------------- */
  function ensureImage(src) {
    if (!src) return Promise.resolve(false);
    const cached = imageCache.get(src);
    if (cached && cached.status === 'ok') return Promise.resolve(true);
    if (cached && cached.status === 'error') return Promise.resolve(false);
    return new Promise((resolve) => {
      const img = new Image();
      if (!/^data:/i.test(src)) img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageCache.set(src, { img: img, status: 'ok' });
        scheduleDraw();
        resolve(true);
      };
      img.onerror = () => {
        imageCache.set(src, { img: null, status: 'error' });
        if (!missingImageNotified.has(src)) {
          missingImageNotified.add(src);
          toast('사진을 불러오지 못했습니다. 외부 URL은 CORS 제한이 있을 수 있어요. 갤러리 사진을 권장합니다.', 'err');
        }
        resolve(false);
      };
      img.src = src;
    });
  }

  function getImage(src) {
    if (!src) return null;
    const cached = imageCache.get(src);
    if (cached) return cached.status === 'ok' ? cached.img : null;
    ensureImage(src);
    return null;
  }

  async function preloadPhotos() {
    if (!state.project) return;
    const srcs = state.project.cards.map((c) => c.photo && c.photo.src).filter(Boolean);
    await Promise.all(srcs.map((s) => ensureImage(s)));
  }

  /* ============================================================
     미리보기 / 썸네일
     ============================================================ */
  function activeCard() {
    const p = state.project;
    if (!p) return null;
    return p.cards[clamp(state.activeCard, 0, p.cards.length - 1)] || null;
  }

  function drawPreview() {
    const canvas = $('#card-canvas');
    if (!canvas || !state.project) return;
    const card = activeCard();
    if (!card) return;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, CARD_W, CARD_H);
    try {
      drawCard(ctx, card, state.activeCard, state.project);
    } catch (err) {
      console.error('[cardmaker] draw failed', err);
    }
    const pos = $('#card-position');
    if (pos) pos.textContent = pad2(state.activeCard + 1) + ' / ' + pad2(state.project.cards.length);
  }

  const scheduleDraw = debounce(() => {
    drawPreview();
    drawThumb(state.activeCard);
  }, 70);

  function cardLabel(card, i) {
    if (card.role === 'cover') return pad2(i + 1) + ' 표지';
    if (card.role === 'cta') return '마지막 장';
    return pad2(i + 1) + ' 본문';
  }

  function renderThumbs() {
    const strip = $('#thumb-strip');
    if (!strip || !state.project) return;
    strip.innerHTML = '';
    state.project.cards.forEach((card, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'thumb' + (i === state.activeCard ? ' is-active' : '');
      btn.dataset.index = String(i);
      btn.setAttribute('aria-label', cardLabel(card, i) + ' 카드 보기');
      const c = document.createElement('canvas');
      c.width = 216;
      c.height = 270;
      btn.appendChild(c);
      const label = document.createElement('span');
      label.className = 'thumb-label';
      label.textContent = cardLabel(card, i);
      btn.appendChild(label);
      strip.appendChild(btn);
    });
    drawAllThumbs();
  }

  function drawThumb(index) {
    const strip = $('#thumb-strip');
    if (!strip) return;
    const btn = strip.querySelector('.thumb[data-index="' + index + '"]');
    if (!btn || !state.project) return;
    const c = btn.querySelector('canvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.save();
    ctx.scale(c.width / CARD_W, c.height / CARD_H);
    const card = state.project.cards[index];
    if (card) drawCard(ctx, card, index, state.project);
    ctx.restore();
  }

  function drawAllThumbs() {
    if (!state.project) return;
    state.project.cards.forEach((_, i) => drawThumb(i));
  }

  /* ============================================================
     원고 — 샘플 / 파싱 / AI
     ============================================================ */
  const SAMPLES = [
    {
      key: 'ai',
      name: 'AI 활용 팁',
      deck: {
        title1: 'AI에게 일을 잘 시키는',
        title2: '프롬프트 5가지',
        subtitle: '오늘부터 바로 쓰는',
        hooks: [
          { type: '호기심형', line1: 'AI 답이 늘 아쉬웠다면', line2: '이 5가지만 바꿔보세요' },
          { type: '반전형', line1: '프롬프트를 길게 쓰면', line2: '오히려 답이 나빠집니다' },
          { type: '핵심형', line1: 'AI 잘 쓰는 사람의', line2: '공통점 5가지' }
        ],
        cards: [
          {
            subtitle: '역할을 먼저 정하기',
            body: '"너는 10년 차 편집자야"처럼 역할을 주면 답의 밀도가 달라집니다.',
            items: ['역할 + 목표 + 형식을 한 번에 적기', '원하는 답의 예시를 하나 붙이기', '금지 조건도 함께 알려주기']
          },
          {
            subtitle: '한 번에 하나만 묻기',
            body: '질문 세 개를 한꺼번에 던지면 답도 세 개로 흩어집니다. 순서대로 물으면 깊어집니다.',
            items: ['1번 질문 → 확인 → 2번 질문', '답이 마음에 안 들면 이유를 알려주기', '길이와 말투를 매번 지정하기']
          },
          {
            subtitle: '초안을 시키고 다듬기',
            body: '완벽한 결과를 한 번에 받으려 하지 마세요. 초안 → 수정 → 요약 순서가 훨씬 빠릅니다.',
            items: ['"초안만 써줘"로 시작', '"더 짧게, 더 구체적으로" 반복', '마지막에는 스스로 검토 요청']
          },
          {
            subtitle: '내 말투를 학습시키기',
            body: '내가 쓴 글 세 개를 보여주고 "이 말투로 써줘"라고 하면 훨씬 자연스러워집니다.',
            items: ['기존 글 2~3개 붙여넣기', '자주 쓰는 표현을 알려주기', '싫은 표현도 함께 적기']
          },
          {
            subtitle: '결과는 내가 검증하기',
            body: 'AI는 자신 있게 틀릴 수 있습니다. 숫자·날짜·출처는 반드시 원문에서 확인하세요.',
            items: ['출처 링크 요구하기', '숫자는 원문 대조', '최종 책임은 내가 지기']
          }
        ],
        caption: 'AI를 잘 쓰는 사람은 질문을 잘 다듬습니다.\n오늘 알려드린 5가지만 바꿔도 답의 밀도가 확실히 달라집니다. 저장해 두고 하나씩 적용해 보세요.',
        hashtags: ['#AI활용', '#프롬프트', '#업무자동화', '#생산성', '#카드뉴스']
      }
    },
    {
      key: 'save',
      name: '일상·절약 체크리스트',
      deck: {
        title1: '새는 돈을 막는',
        title2: '생활 체크리스트',
        subtitle: '이번 달에 바로 확인',
        hooks: [
          { type: '호기심형', line1: '매달 빠져나가는 돈', line2: '여기서 새고 있습니다' },
          { type: '반전형', line1: '아껴서 모은 돈보다', line2: '안 새는 게 먼저입니다' },
          { type: '핵심형', line1: '확인만 해도 되는', line2: '절약 6가지' }
        ],
        cards: [
          {
            subtitle: '구독 결제 점검',
            body: '쓰지 않는 구독이 매달 자동 결제되는 경우가 가장 많습니다. 3개월 내역을 확인하세요.',
            items: ['휴대폰 결제 내역 3개월 보기', '중복된 영상 구독 정리', '연간 결제로 바꿀 수 있는지 확인']
          },
          {
            subtitle: '배달 최소주문 맞추기',
            body: '배달비를 아끼려고 메뉴를 하나 더 담는 순간 오히려 더 씁니다.',
            items: ['장바구니에 담고 하루 뒤 재확인', '포장 할인 가능한 매장 찾기', '주 1회로 횟수 정하기']
          },
          {
            subtitle: '전기·수도 요금 습관',
            body: '요금은 누진 구간에서 크게 올라갑니다. 여름·겨울 전에 미리 확인하면 좋습니다.',
            items: ['대기전력 차단 멀티탭 쓰기', '세탁은 모아서 한 번에', '계량기 사용량 월 1회 확인']
          },
          {
            subtitle: '장보기 전 메모',
            body: '목록 없이 가면 30%는 충동구매입니다. 냉장고부터 확인하고 메모하세요.',
            items: ['냉장고 사진 찍고 출발', '필요한 것만 목록에 적기', '온라인 장바구니 하루 숙성']
          },
          {
            subtitle: '고정지출 한 번 정리',
            body: '보험·통신·교통처럼 매달 나가는 돈을 표로 만들면 새는 곳이 눈에 보입니다.',
            items: ['고정지출 목록 만들기', '약정·할인 만료일 캘린더 등록', '연 1회 재비교']
          }
        ],
        caption: '많이 벌기보다 먼저 할 일은 안 새게 하는 것.\n6가지만 확인해도 이번 달 고정지출이 정리됩니다. 저장해 두고 주말에 하나씩 체크해 보세요.',
        hashtags: ['#절약', '#생활비', '#체크리스트', '#구독정리', '#카드뉴스']
      }
    }
  ];

  function stripNumbering(line) {
    return String(line || '')
      .replace(/^\s*(?:\d{1,2}\s*[.)\-:]\s*|[①-⑳]\s*|[-•·*]\s+)/, '')
      .trim();
  }

  function splitItems(lines) {
    const items = [];
    const bodyLines = [];
    const itemRe = /^\s*(?:[-•·*]\s+|\d{1,2}\s*[.)]\s+|[①-⑳]\s*)/;
    lines.forEach((line) => {
      if (itemRe.test(line)) {
        const text = line.replace(itemRe, '').trim();
        if (text) items.push(text);
      } else if (line.trim()) {
        bodyLines.push(line.trim());
      }
    });
    return { body: bodyLines.join('\n'), items: items };
  }

  function extractJSON(text) {
    if (!text) return null;
    let s = String(text).trim();
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start >= 0 && end > start) s = s.slice(start, end + 1);
    try {
      return JSON.parse(s);
    } catch (e) {
      return null;
    }
  }

  function normalizeHookType(type) {
    const t = String(type || '');
    if (t.indexOf('호기심') >= 0) return '호기심형';
    if (t.indexOf('반전') >= 0) return '반전형';
    return '핵심형';
  }

  function normalizeHooks(list, fallbackTitle) {
    const out = [];
    const arr = Array.isArray(list) ? list : [];
    arr.forEach((h) => {
      if (!h) return;
      if (typeof h === 'string') {
        out.push({ id: uid('h'), type: '핵심형', line1: h, line2: '' });
        return;
      }
      const line1 = String(h.line1 || h.first || h.title || h.hook || '').trim();
      const line2 = String(h.line2 || h.second || h.sub || h.emphasis || '').trim();
      if (!line1 && !line2) return;
      out.push({ id: h.id || uid('h'), type: normalizeHookType(h.type), line1: line1, line2: line2 });
    });
    if (!out.length) return makeDefaultHooks(fallbackTitle);
    const order = { '호기심형': 0, '반전형': 1, '핵심형': 2 };
    out.sort((a, b) => (order[a.type] || 0) - (order[b.type] || 0));
    return out.slice(0, 3);
  }

  function makeDefaultHooks(title) {
    const t = String(title || '오늘의 카드뉴스').trim() || '오늘의 카드뉴스';
    return [
      { id: uid('h'), type: '호기심형', line1: '혹시 아직도', line2: t },
      { id: uid('h'), type: '반전형', line1: t, line2: '알고 보면 반대입니다' },
      { id: uid('h'), type: '핵심형', line1: '3분 정리', line2: t }
    ];
  }

  function deckFromJSON(raw) {
    const j = raw || {};
    const slides = Array.isArray(j.cards) ? j.cards : Array.isArray(j.slides) ? j.slides : [];
    const deck = {
      title1: String(j.title || j.title1 || '').trim(),
      title2: String(j.title2 || j.subtitle2 || '').trim(),
      cards: [],
      hooks: Array.isArray(j.hooks) ? j.hooks : j.hook ? [j.hook] : [],
      caption: String(j.caption || j.instagram_caption || ''),
      hashtags: Array.isArray(j.hashtags) ? j.hashtags : []
    };

    slides.forEach((s, i) => {
      if (typeof s === 'string') {
        const parts = s.split('\n');
        deck.cards.push({ subtitle: stripNumbering(parts[0] || ''), body: parts.slice(1).join('\n'), items: [] });
        return;
      }
      if (!s || typeof s !== 'object') return;
      const role = String(s.role || '').toLowerCase();
      const isCover =
        role === 'cover' ||
        i === 0 && (s.title || s.title1 || s.title2) && !s.body && !s.items;
      if (isCover) {
        if (!deck.title1) deck.title1 = String(s.title || s.title1 || s.subtitle || '').trim();
        if (!deck.title2) deck.title2 = String(s.title2 || '').trim();
        return;
      }
      if (role === 'cta') {
        deck.cta = String(s.body || s.text || s.cta || '').trim();
        return;
      }
      deck.cards.push({
        subtitle: String(s.subtitle || s.sub || s.heading || s.title || '').trim(),
        body: String(s.body || s.text || s.content || '').trim(),
        items: Array.isArray(s.items) ? s.items.map((x) => String(x).trim()).filter(Boolean) : [],
        layout: VALID_TEMPLATES.indexOf(s.layout) >= 0 ? s.layout : 'inherit'
      });
    });

    return deck;
  }

  function parseFreeText(raw) {
    const text = String(raw || '').replace(/\r\n?/g, '\n').trim();
    if (!text) return null;

    if (/^[\[{]/.test(text) || text.indexOf('"cards"') >= 0 || text.indexOf('```') === 0) {
      const json = extractJSON(text);
      if (json) {
        const deck = deckFromJSON(json);
        if (deck.cards.length || deck.title1) return deck;
      }
    }

    const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
    if (!blocks.length) return null;

    const deck = { title1: '', title2: '', cards: [], hooks: [], caption: '', hashtags: [] };

    blocks.forEach((block, bi) => {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return;

      if (bi === 0) {
        const first = stripNumbering(lines[0]);
        deck.title1 = first;
        if (lines.length > 1) {
          const second = stripNumbering(lines[1]);
          if (second.length <= 26) {
            deck.title2 = second;
            const rest = lines.slice(2);
            if (rest.length) {
              const parsed = splitItems(rest);
              deck.cards.push({ subtitle: '', body: parsed.body, items: parsed.items });
            }
          } else {
            const parsed = splitItems(lines.slice(1));
            deck.cards.push({ subtitle: '', body: parsed.body, items: parsed.items });
          }
        }
        return;
      }

      const subtitle = stripNumbering(lines[0]);
      const parsed = splitItems(lines.slice(1));
      deck.cards.push({ subtitle: subtitle, body: parsed.body, items: parsed.items });
    });

    if (!deck.cards.length && deck.title1) {
      deck.cards.push({ subtitle: '', body: '', items: [] });
    }
    return deck;
  }

  function applyDeck(deck, opts) {
    if (!deck) return false;
    const options = opts || {};
    const project = state.project;
    const settings = state.settings;

    const title1 = (deck.title1 || '').trim() || '제목을 입력하세요';
    const title2 = (deck.title2 || '').trim();

    const cover = createCard('cover', { title1: title1, title2: title2, subtitle: project.design.subtitle || settings.subtitle });
    const cards = [cover];

    (deck.cards || []).forEach((c) => {
      const card = createCard('body', {
        subtitle: String(c.subtitle || '').trim(),
        body: String(c.body || '').trim(),
        items: Array.isArray(c.items) ? c.items.map(String).filter(Boolean) : [],
        layout: VALID_TEMPLATES.indexOf(c.layout) >= 0 ? c.layout : 'inherit'
      });
      cards.push(card);
    });

    const cta = createCard('cta', {
      subtitle: project.design.subtitle || settings.subtitle,
      body: (deck.cta || '저장하고 천천히 다시 보세요').trim()
    });
    cards.push(cta);

    project.cards = cards.slice(0, 9);
    project.hooks = normalizeHooks(deck.hooks, title1);

    const captionParts = [];
    if (deck.caption) captionParts.push(String(deck.caption).trim());
    const tags = Array.isArray(deck.hashtags)
      ? deck.hashtags.map((t) => {
          const s = String(t).trim();
          return s && s.charAt(0) !== '#' ? '#' + s : s;
        }).filter(Boolean)
      : [];
    if (tags.length) captionParts.push(tags.join(' '));
    project.caption = captionParts.join('\n\n');
    project.hashtags = tags;
    if (deck.title1 && !project.name) project.name = title1;
    if (options.setTopic && deck.topic) project.topic = deck.topic;

    state.activeCard = 0;
    touch();
    return true;
  }

  /* ---------------- Claude API ---------------- */
  async function callClaude(payload) {
    const key = state.apiKey;
    if (!key) throw new Error('설정 탭에서 Claude API 키를 먼저 저장해 주세요.');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = data && data.error && data.error.message ? data.error.message : 'HTTP ' + res.status;
      throw new Error(msg);
    }
    const blocks = (data && data.content) || [];
    return blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  }

  function buildSystemPrompt() {
    return [
      '너는 한국어 인스타그램 카드뉴스 작가다.',
      '요청을 받으면 반드시 아래 JSON 형식만 출력한다. 설명, 인사, 마크다운 코드블록 모두 쓰지 않는다.',
      '{"title":"표지 제목","hooks":[{"type":"호기심형","line1":"첫째 줄","line2":"강조 둘째 줄"},{"type":"반전형","line1":"...","line2":"..."},{"type":"핵심형","line1":"...","line2":"..."}],"cards":[{"subtitle":"소제목","body":"본문 1~2문장","items":["도식 항목1","도식 항목2"]}],"caption":"인스타 캡션","hashtags":["#태그"]}',
      'cards는 4~6장, 각 body는 90자 이내, items는 항목별 12~24자로 2~4개, title은 24자 이내.',
      '문장은 짧고 단호하게. 과장·허위 정보 금지, 확인되지 않은 수치 금지.'
    ].join('\n');
  }

  function buildUserPrompt(topic, memo) {
    const lines = ['주제: ' + topic];
    if (memo) lines.push('참고 메모: ' + memo);
    lines.push('위 주제로 인스타그램 카드뉴스 원고를 JSON으로 만들어 줘.');
    return lines.join('\n');
  }

  function buildCopyPrompt() {
    const topicEl = $('#inp-topic');
    const memoEl = $('#inp-memo');
    const topic = (topicEl && topicEl.value.trim()) || '아래 주제';
    const memo = (memoEl && memoEl.value.trim()) || '';
    return [
      '너는 한국어 인스타그램 카드뉴스 작가야. 아래 주제로 카드뉴스 원고를 만들고, 형식에 맞는 JSON만 출력해.',
      '',
      '[주제] ' + topic,
      memo ? '[참고 메모] ' + memo : '',
      '',
      '[출력 형식]',
      '{',
      '  "title": "표지 제목",',
      '  "hooks": [',
      '    {"type":"호기심형","line1":"첫째 줄","line2":"강조 둘째 줄"},',
      '    {"type":"반전형","line1":"첫째 줄","line2":"강조 둘째 줄"},',
      '    {"type":"핵심형","line1":"첫째 줄","line2":"강조 둘째 줄"}',
      '  ],',
      '  "cards": [',
      '    {"subtitle":"소제목","body":"본문 1~2문장","items":["도식 항목1","도식 항목2"]}',
      '  ],',
      '  "caption": "인스타 캡션",',
      '  "hashtags": ["#카드뉴스", "#정보"]',
      '}',
      '',
      '[조건]',
      '- cards는 4~6장',
      '- 각 body는 90자 이내',
      '- items는 2~4개, 항목당 12~24자',
      '- title은 24자 이내',
      '- JSON 외 다른 말은 쓰지 말 것',
      '',
      '위 JSON을 그대로 복사해서 카드메이커의 "원고 붙여넣기" 칸에 넣으면 됩니다.'
    ].filter(Boolean).join('\n');
  }

  async function copyText(text, okMsg) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      toast(okMsg || '복사했습니다.', 'ok');
      return true;
    } catch (e) {
      toast('복사에 실패했습니다. 길게 눌러 직접 복사해 주세요.', 'err');
      return false;
    }
  }

  /* ============================================================
     UI 렌더
     ============================================================ */
  function applyAccentToUI() {
    const accent = (state.project && state.project.design.accent) || state.settings.accent;
    document.documentElement.style.setProperty('--accent', accent);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#0a0c0b');
  }

  function showTab(tab) {
    state.tab = tab;
    ['workspace', 'storage', 'settings'].forEach((t) => {
      const panel = $('#panel-' + t);
      if (panel) panel.hidden = t !== tab;
    });
    $$('.tab-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === tab));
    const stepbar = $('#stepbar');
    if (stepbar) stepbar.hidden = tab !== 'workspace';
    if (tab === 'storage') renderStorage();
    if (tab === 'settings') renderSettings();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showStep(step) {
    state.step = step;
    $$('.step-view').forEach((v) => {
      v.hidden = Number(v.dataset.step) !== step;
    });
    $$('.step-btn').forEach((b) => {
      const n = Number(b.dataset.step);
      b.classList.toggle('is-active', n === step);
      b.classList.toggle('is-done', n < step);
    });
    if (state.tab !== 'workspace') showTab('workspace');
    if (step === 2) renderHooks();
    if (step === 3) {
      buildEditor();
      renderThumbs();
      drawPreview();
    }
    if (step === 4) renderExportPanel();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderStep1() {
    const p = state.project;
    if (!p) return;
    const nameEl = $('#inp-project-name');
    if (nameEl && nameEl.value !== p.name) nameEl.value = p.name || '';
    const topicEl = $('#inp-topic');
    if (topicEl && document.activeElement !== topicEl) topicEl.value = p.topic || '';
    const memoEl = $('#inp-memo');
    if (memoEl && document.activeElement !== memoEl) memoEl.value = p.memo || '';

    const summary = $('#draft-summary');
    if (summary) {
      const hasContent = p.cards.length > 1 && (p.cards[0].title1 || p.cards.some((c) => c.body));
      if (!hasContent) {
        summary.textContent = '아직 원고가 없습니다. 샘플을 불러오거나 붙여넣기로 시작하세요.';
      } else {
        const tpl = TEMPLATES.filter((t) => t.id === p.design.template)[0];
        summary.textContent =
          '카드 ' + p.cards.length + '장 · 훅 ' + (p.hooks.length || 0) + '종 · 양식 ' + (tpl ? tpl.name : '글 중심형');
      }
    }
  }

  function renderTemplateChips() {
    const box = $('#template-chips');
    if (!box) return;
    box.innerHTML = '';
    const card = activeCard();
    const current = card && card.role === 'body' && VALID_TEMPLATES.indexOf(card.layout) >= 0 ? card.layout : state.project.design.template;
    TEMPLATES.forEach((t) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (state.project.design.template === t.id ? ' is-active' : '');
      b.textContent = t.name;
      b.title = t.desc;
      b.addEventListener('click', () => {
        state.project.design.template = t.id;
        if (state.project.cards[state.activeCard]) state.project.cards[state.activeCard].layout = 'inherit';
        touch();
        renderTemplateChips();
        buildEditor();
        drawAllThumbs();
        drawPreview();
      });
      box.appendChild(b);
    });
  }

  function renderAccentSwatches(container, current, onPick) {
    const box = container;
    if (!box) return;
    box.innerHTML = '';
    ACCENTS.forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch' + (a.hex.toLowerCase() === String(current).toLowerCase() ? ' is-active' : '');
      b.style.background = a.hex;
      b.setAttribute('aria-label', a.name);
      b.title = a.name;
      const label = document.createElement('span');
      label.textContent = a.name;
      b.appendChild(label);
      b.addEventListener('click', () => onPick(a));
      box.appendChild(b);
    });
  }

  function renderHooks() {
    const list = $('#hook-list');
    if (!list) return;
    const p = state.project;
    if (!p.hooks.length) {
      p.hooks = makeDefaultHooks(p.cards[0] ? p.cards[0].title1 : '');
    }
    list.innerHTML = '';
    const cover = p.cards[0];

    p.hooks.forEach((h, i) => {
      const applied = cover && cover.title1 === h.line1 && cover.title2 === h.line2;
      const card = document.createElement('div');
      card.className = 'hook-card' + (applied ? ' is-applied' : '');
      card.setAttribute('role', 'button');
      card.tabIndex = 0;
      card.setAttribute('aria-label', (i + 1) + '. ' + h.type + ' 후킹을 표지에 적용');

      const top = document.createElement('div');
      top.className = 'hook-top';
      const tag = document.createElement('span');
      tag.className = 'hook-tag';
      tag.textContent = (i + 1) + '. ' + h.type;
      const right = document.createElement('span');
      right.className = 'hook-right';
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'hook-edit';
      editBtn.textContent = '문구 수정';
      const applyHint = document.createElement('span');
      applyHint.className = 'hook-apply';
      applyHint.textContent = applied ? '✓ 표지에 적용됨' : '눌러서 적용';
      right.appendChild(editBtn);
      right.appendChild(applyHint);
      top.appendChild(tag);
      top.appendChild(right);

      const preview = document.createElement('div');
      preview.className = 'hook-text';
      const l1 = document.createElement('div');
      l1.className = 'hook-line1';
      l1.textContent = h.line1 || '(첫째 줄 비어 있음)';
      const l2 = document.createElement('div');
      l2.className = 'hook-line2';
      l2.textContent = h.line2 || '(둘째 줄 비어 있음)';
      preview.appendChild(l1);
      preview.appendChild(l2);

      const editor = document.createElement('div');
      editor.className = 'hook-lines';
      editor.hidden = true;
      const in1 = document.createElement('input');
      in1.type = 'text';
      in1.value = h.line1;
      in1.placeholder = '첫째 줄';
      in1.setAttribute('aria-label', h.type + ' 첫째 줄');
      const in2 = document.createElement('input');
      in2.type = 'text';
      in2.value = h.line2;
      in2.placeholder = '강조 둘째 줄';
      in2.setAttribute('aria-label', h.type + ' 둘째 줄');

      function syncText() {
        l1.textContent = h.line1 || '(첫째 줄 비어 있음)';
        l2.textContent = h.line2 || '(둘째 줄 비어 있음)';
      }

      function onChange() {
        h.line1 = in1.value;
        h.line2 = in2.value;
        const cv = state.project.cards[0];
        if (card.classList.contains('is-applied')) {
          cv.title1 = h.line1;
          cv.title2 = h.line2;
        }
        syncText();
        touch();
        scheduleDraw();
        renderStep1();
      }
      in1.addEventListener('input', onChange);
      in2.addEventListener('input', onChange);
      [in1, in2].forEach((el) => {
        el.addEventListener('click', (e) => e.stopPropagation());
        el.addEventListener('keydown', (e) => e.stopPropagation());
      });

      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        editor.hidden = !editor.hidden;
        preview.hidden = !editor.hidden;
        editBtn.textContent = editor.hidden ? '문구 수정' : '수정 닫기';
        if (!editor.hidden) {
          in1.value = h.line1;
          in2.value = h.line2;
          in1.focus();
        }
      });

      editor.appendChild(in1);
      editor.appendChild(in2);
      card.appendChild(top);
      card.appendChild(preview);
      card.appendChild(editor);

      card.addEventListener('click', () => applyHook(h.id));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (e.target.tagName === 'INPUT') return;
          e.preventDefault();
          applyHook(h.id);
        }
      });

      list.appendChild(card);
    });
  }

  function applyHook(id) {
    const p = state.project;
    const h = p.hooks.filter((x) => x.id === id)[0];
    if (!h) return;
    const cover = p.cards[0];
    cover.title1 = h.line1;
    cover.title2 = h.line2;
    if (h.line1 && !p.name) p.name = h.line1;
    touch();
    renderHooks();
    renderStep1();
    drawAllThumbs();
    if (state.step === 3) drawPreview();
    toast('01 표지에 적용했습니다.', 'ok');
  }

  /* ---------------- 카드 편집 필드 ---------------- */
  function fieldLabel(text, sub) {
    const el = document.createElement('div');
    el.className = 'field-label';
    el.textContent = text;
    if (sub) {
      const em = document.createElement('em');
      em.textContent = sub;
      el.appendChild(em);
    }
    return el;
  }

  function addTextInput(parent, label, value, onInput, opts) {
    const o = opts || {};
    const wrap = document.createElement('label');
    wrap.className = 'field';
    wrap.appendChild(fieldLabel(label, o.hint));
    let el;
    if (o.multiline) {
      el = document.createElement('textarea');
      el.rows = o.rows || 3;
    } else {
      el = document.createElement('input');
      el.type = 'text';
    }
    el.value = value || '';
    if (o.placeholder) el.placeholder = o.placeholder;
    el.addEventListener('input', () => onInput(el.value));
    wrap.appendChild(el);
    parent.appendChild(wrap);
    return el;
  }

  function buildEditor() {
    const box = $('#card-fields');
    if (!box || !state.project) return;
    const card = activeCard();
    if (!card) return;

    renderTemplateChips();
    function pickAccent(a) {
      state.project.design.accent = a.hex;
      touch();
      renderAccentSwatches($('#accent-swatches'), a.hex, pickAccent);
      drawAllThumbs();
      drawPreview();
      applyAccentToUI();
    }
    renderAccentSwatches($('#accent-swatches'), state.project.design.accent, pickAccent);

    box.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'field-label';
    head.textContent = cardLabel(card, state.activeCard) + ' 편집';
    box.appendChild(head);

    const onChange = () => {
      touch();
      scheduleDraw();
      renderStep1();
      updateVideoDuration();
    };

    if (card.role === 'cover') {
      addTextInput(box, '표지 제목 1', card.title1, (v) => { card.title1 = v; onChange(); }, {
        hint: '첫째 줄',
        placeholder: '시선을 잡는 첫 문장'
      });
      addTextInput(box, '표지 제목 2', card.title2, (v) => { card.title2 = v; onChange(); }, {
        hint: '강조색으로 표시',
        placeholder: '강조할 둘째 줄'
      });
      addTextInput(box, '서브 타이틀', card.subtitle, (v) => { card.subtitle = v; onChange(); }, {
        placeholder: '예: 로이파파의 AI·생활 기록'
      });
    } else if (card.role === 'cta') {
      addTextInput(box, 'CTA 문구', card.body, (v) => { card.body = v; onChange(); }, {
        multiline: true,
        rows: 3,
        placeholder: '예: 저장하고 천천히 다시 보세요'
      });
      addTextInput(box, '서브 타이틀', card.subtitle, (v) => { card.subtitle = v; onChange(); }, {});
      addTextInput(box, '마지막 장 핸들', state.project.design.handle, (v) => {
        state.project.design.handle = v;
        onChange();
        drawAllThumbs();
      }, { placeholder: '@yourname' });
      const note = document.createElement('p');
      note.className = 'hint';
      note.textContent = '핸들은 모든 카드 하단에도 함께 표시됩니다.';
      box.appendChild(note);
    } else {
      addTextInput(box, '소제목', card.subtitle, (v) => { card.subtitle = v; onChange(); }, {
        placeholder: '이 장의 핵심 한 줄'
      });
      addTextInput(box, '본문', card.body, (v) => { card.body = v; onChange(); }, {
        multiline: true,
        rows: 4,
        placeholder: '짧게, 한두 문장으로'
      });
      addTextInput(box, '도식 항목', (card.items || []).join('\n'), (v) => {
        card.items = v.split('\n').map((s) => s.trim()).filter(Boolean);
        onChange();
      }, {
        multiline: true,
        rows: 4,
        hint: '한 줄에 항목 하나 · 설명 도식형에서 번호 배지로 표시',
        placeholder: '항목 1\n항목 2\n항목 3'
      });

      const layoutWrap = document.createElement('div');
      layoutWrap.className = 'field';
      layoutWrap.appendChild(fieldLabel('이 카드 양식', '전체 양식과 다르게 지정'));
      const sel = document.createElement('select');
      sel.innerHTML =
        '<option value="inherit">전체 양식 따르기</option>' +
        '<option value="photo">사진형</option>' +
        '<option value="infographic">설명 도식형</option>' +
        '<option value="text">글 중심형</option>';
      sel.value = VALID_TEMPLATES.indexOf(card.layout) >= 0 ? card.layout : 'inherit';
      sel.addEventListener('change', () => {
        card.layout = sel.value;
        onChange();
        drawAllThumbs();
        drawPreview();
      });
      layoutWrap.appendChild(sel);
      box.appendChild(layoutWrap);
    }

    // 사진 도구
    if (card.role !== 'cta') {
      const tools = document.createElement('div');
      tools.className = 'photo-tools';
      const label = fieldLabel('사진', '사진형·표지에서 사용');
      tools.appendChild(label);

      const status = document.createElement('div');
      status.style.marginBottom = '10px';
      const chip = document.createElement('span');
      chip.className = 'photo-chip';
      chip.textContent = card.photo.src ? '사진 넣음' : '사진 없음';
      status.appendChild(chip);
      if (card.photo.src && /^http/i.test(card.photo.src)) {
        const chip2 = document.createElement('span');
        chip2.className = 'photo-chip';
        chip2.style.marginLeft = '6px';
        chip2.textContent = '외부 URL';
        status.appendChild(chip2);
      }
      tools.appendChild(status);

      const row1 = document.createElement('div');
      row1.className = 'row-split';
      const fileWrap = document.createElement('label');
      fileWrap.className = 'btn btn-file';
      fileWrap.textContent = '갤러리 사진';
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.hidden = true;
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        await applyPhotoFile(file, card);
        fileInput.value = '';
      });
      fileWrap.appendChild(fileInput);
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn btn-sm';
      removeBtn.textContent = '사진 제거';
      removeBtn.disabled = !card.photo.src;
      removeBtn.addEventListener('click', () => {
        card.photo.src = '';
        onChange();
        buildEditor();
        drawAllThumbs();
        drawPreview();
      });
      row1.appendChild(fileWrap);
      row1.appendChild(removeBtn);
      tools.appendChild(row1);

      const urlField = document.createElement('div');
      urlField.className = 'field';
      urlField.style.marginTop = '10px';
      urlField.appendChild(fieldLabel('이미지 URL', 'CORS 차단 시 갤러리 사진 사용'));
      const urlRow = document.createElement('div');
      urlRow.className = 'row-split';
      const urlInput = document.createElement('input');
      urlInput.type = 'url';
      urlInput.placeholder = 'https://...';
      urlInput.autocomplete = 'off';
      const urlBtn = document.createElement('button');
      urlBtn.type = 'button';
      urlBtn.className = 'btn btn-sm';
      urlBtn.textContent = '넣기';
      urlBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) return;
        if (!/^https?:\/\//i.test(url)) {
          toast('http(s)로 시작하는 주소를 넣어 주세요.', 'err');
          return;
        }
        const ok = await validateImageUrl(url);
        if (!ok) {
          toast('이 URL은 불러올 수 없습니다(CORS 차단 가능). 갤러리 사진을 사용해 주세요.', 'err');
          return;
        }
        card.photo.src = url;
        onChange();
        buildEditor();
        drawAllThumbs();
        drawPreview();
        toast('사진을 넣었습니다.', 'ok');
      });
      urlRow.appendChild(urlInput);
      urlRow.appendChild(urlBtn);
      urlField.appendChild(urlRow);
      tools.appendChild(urlField);

      // 밝기
      const brightRow = document.createElement('div');
      brightRow.className = 'slider-row';
      const bl = document.createElement('label');
      bl.textContent = '사진 밝기';
      const br = document.createElement('input');
      br.type = 'range';
      br.min = '50';
      br.max = '140';
      br.step = '5';
      br.value = String(card.photo.brightness || 100);
      const bo = document.createElement('output');
      bo.textContent = String(card.photo.brightness || 100);
      br.addEventListener('input', () => {
        card.photo.brightness = Number(br.value);
        bo.textContent = br.value;
        scheduleDraw();
        touch();
      });
      brightRow.appendChild(bl);
      brightRow.appendChild(br);
      brightRow.appendChild(bo);
      tools.appendChild(brightRow);

      // 배치
      const focusRow = document.createElement('div');
      focusRow.className = 'slider-row';
      const fl = document.createElement('label');
      fl.textContent = '사진 위치';
      const fr = document.createElement('input');
      fr.type = 'range';
      fr.min = '0';
      fr.max = '100';
      fr.step = '5';
      fr.value = String(card.photo.focus == null ? 50 : card.photo.focus);
      const fo = document.createElement('output');
      fo.textContent = fr.value;
      fr.addEventListener('input', () => {
        card.photo.focus = Number(fr.value);
        fo.textContent = fr.value;
        scheduleDraw();
        touch();
      });
      focusRow.appendChild(fl);
      focusRow.appendChild(fr);
      focusRow.appendChild(fo);
      tools.appendChild(focusRow);

      box.appendChild(tools);
    }

    const pos = $('#card-position');
    if (pos) pos.textContent = pad2(state.activeCard + 1) + ' / ' + pad2(state.project.cards.length);
    const del = $('#btn-card-del');
    if (del) del.disabled = state.project.cards.length <= 2;
  }

  async function applyPhotoFile(file, card) {
    if (!file.type || file.type.indexOf('image/') !== 0) {
      toast('이미지 파일만 넣을 수 있습니다.', 'err');
      return;
    }
    try {
      const dataUrl = await downscaleImage(file, 1440, 0.86);
      card.photo.src = dataUrl;
      touch();
      buildEditor();
      drawAllThumbs();
      drawPreview();
      toast('사진을 넣었습니다.', 'ok');
    } catch (e) {
      toast('사진을 읽지 못했습니다. 다른 파일로 시도해 주세요.', 'err');
    }
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ img: img, url: url });
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('image decode failed'));
      };
      img.src = url;
    });
  }

  async function downscaleImage(file, maxSide, quality) {
    const loaded = await loadImageFromFile(file);
    const img = loaded.img;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(loaded.url);
    const keepPng = file.type === 'image/png' && w * h <= 900000;
    return canvas.toDataURL(keepPng ? 'image/png' : 'image/jpeg', quality);
  }

  function validateImageUrl(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve(false);
      }, 9000);
      img.onload = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        imageCache.set(url, { img: img, status: 'ok' });
        resolve(true);
      };
      img.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(false);
      };
      img.src = url;
    });
  }

  /* ---------------- 캡션 ---------------- */
  function renderCaption() {
    const el = $('#caption-text');
    if (!el || !state.project) return;
    if (document.activeElement === el) return;
    el.value = state.project.caption || '';
  }

  /* ---------------- 저장함 ---------------- */
  function listProjects() {
    const arr = loadJSON(LS.projects, []);
    return Array.isArray(arr) ? arr : [];
  }

  function saveProjectToStorage() {
    const p = JSON.parse(JSON.stringify(state.project));
    if (!p.name) {
      p.name = p.topic || (p.cards[0] && p.cards[0].title1) || '이름 없는 프로젝트';
    }
    p.updatedAt = Date.now();
    const arr = listProjects();
    const idx = arr.findIndex((x) => x && x.id === p.id);
    if (idx >= 0) arr[idx] = p;
    else arr.unshift(p);
    if (!saveJSON(LS.projects, arr)) {
      toast('저장 공간이 부족합니다. 사진 수를 줄이거나 저장함을 정리해 주세요.', 'err');
      return false;
    }
    state.project.name = p.name;
    const nameEl = $('#inp-project-name');
    if (nameEl) nameEl.value = p.name;
    renderStorage();
    renderStep1();
    toast('저장함에 저장했습니다. (' + arr.length + '개)', 'ok');
    return true;
  }

  function formatDate(ts) {
    const d = new Date(ts || Date.now());
    return (
      d.getFullYear() + '.' + pad2(d.getMonth() + 1) + '.' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes())
    );
  }

  function renderStorage() {
    const list = $('#storage-list');
    const empty = $('#storage-empty');
    if (!list) return;
    const projects = listProjects();
    list.innerHTML = '';
    if (empty) empty.hidden = projects.length > 0;

    projects.forEach((item) => {
      const wrap = document.createElement('div');
      wrap.className = 'storage-item';

      const top = document.createElement('div');
      top.className = 'storage-top';
      const info = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'storage-name';
      name.textContent = item.name || '이름 없는 프로젝트';
      const meta = document.createElement('div');
      meta.className = 'storage-meta';
      meta.textContent = formatDate(item.updatedAt) + ' · 카드 ' + ((item.cards && item.cards.length) || 0) + '장';
      info.appendChild(name);
      info.appendChild(meta);
      top.appendChild(info);
      wrap.appendChild(top);

      const actions = document.createElement('div');
      actions.className = 'storage-actions';

      const loadBtn = document.createElement('button');
      loadBtn.type = 'button';
      loadBtn.className = 'btn btn-primary';
      loadBtn.textContent = '불러오기';
      loadBtn.addEventListener('click', () => {
        state.project = normalizeProject(JSON.parse(JSON.stringify(item)));
        state.activeCard = 0;
        touch();
        applyAccentToUI();
        refreshAllUI();
        showTab('workspace');
        showStep(3);
        toast('불러왔습니다: ' + (item.name || '프로젝트'), 'ok');
      });

      const dupBtn = document.createElement('button');
      dupBtn.type = 'button';
      dupBtn.className = 'btn';
      dupBtn.textContent = '복제';
      dupBtn.addEventListener('click', () => {
        const copy = JSON.parse(JSON.stringify(item));
        copy.id = uid('p');
        copy.name = (item.name || '프로젝트') + ' 사본';
        copy.updatedAt = Date.now();
        const arr = listProjects();
        arr.unshift(copy);
        if (!saveJSON(LS.projects, arr)) {
          toast('저장 공간이 부족합니다.', 'err');
          return;
        }
        renderStorage();
        toast('복제했습니다.', 'ok');
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-danger';
      delBtn.textContent = '삭제';
      delBtn.addEventListener('click', async () => {
        const ok = await askConfirm('프로젝트 삭제', '"' + (item.name || '프로젝트') + '"을(를) 삭제할까요? 되돌릴 수 없습니다.', '삭제');
        if (!ok) return;
        const arr = listProjects().filter((x) => x && x.id !== item.id);
        saveJSON(LS.projects, arr);
        renderStorage();
        toast('삭제했습니다.', 'ok');
      });

      actions.appendChild(loadBtn);
      actions.appendChild(dupBtn);
      actions.appendChild(delBtn);
      wrap.appendChild(actions);
      list.appendChild(wrap);
    });
  }

  /* ---------------- 설정 ---------------- */
  function renderSettings() {
    const s = state.settings;
    const keyEl = $('#inp-api-key');
    if (keyEl) keyEl.value = state.apiKey || '';
    const handleEl = $('#inp-default-handle');
    if (handleEl) handleEl.value = s.handle;
    const subEl = $('#inp-default-subtitle');
    if (subEl) subEl.value = s.subtitle;
    const tplEl = $('#sel-default-template');
    if (tplEl) tplEl.value = s.template;
    function pickSettingAccent(a) {
      s.accent = a.hex;
      renderAccentSwatches($('#settings-accents'), a.hex, pickSettingAccent);
    }
    renderAccentSwatches($('#settings-accents'), s.accent, pickSettingAccent);
  }

  /* ---------------- 내보내기 패널 ---------------- */
  function updateVideoDuration() {
    const el = $('#video-duration');
    if (!el || !state.project) return;
    const n = state.project.cards.length;
    const trans = state.ui.transition === 'none' ? 0 : 420;
    const total = n * state.ui.dwell + Math.max(0, n - 1) * trans;
    const sec = Math.round(total / 100) / 10;
    el.textContent = '총 길이 ' + sec + '초 · 카드 ' + n + '장 · ' + Math.round(state.ui.dwell / 1000) + '초씩';
  }

  function renderExportPanel() {
    updateVideoDuration();
    renderVideoFormat();
    const bgm = $('#bgm-name');
    if (bgm) {
      bgm.textContent = state.ui.bgmFile
        ? '선택: ' + state.ui.bgmFile.name
        : '선택 안 함 · 무음으로 내보냅니다.';
    }
    drawVideoStill();
  }

  function renderVideoFormat() {
    const el = $('#video-format');
    if (!el) return;
    if (!window.MediaRecorder) {
      el.textContent = '이 브라우저는 영상 녹화(MediaRecorder)를 지원하지 않습니다. PNG 저장은 그대로 사용할 수 있습니다.';
      return;
    }
    const supported = VIDEO_CANDIDATES.filter((m) => {
      try {
        return MediaRecorder.isTypeSupported(m);
      } catch (e) {
        return false;
      }
    });
    if (!supported.length) {
      el.textContent = '이 브라우저에서 지원하는 영상 포맷을 찾지 못했습니다. 다른 브라우저(Chrome·Safari 최신)에서 시도해 주세요.';
    } else {
      el.textContent = '이 브라우저 지원 포맷: ' + supported.slice(0, 3).join(' · ') + ' — 실제 저장 포맷대로 확장자가 정해집니다.';
    }
  }

  /* ============================================================
     PNG / ZIP 내보내기
     ============================================================ */
  async function ensureFonts() {
    if (!document.fonts || !document.fonts.ready) return;
    try {
      await Promise.all([
        document.fonts.load('500 40px "Pretendard Variable"', '가나다'),
        document.fonts.load('700 40px "Pretendard Variable"', '가나다'),
        document.fonts.load('800 40px "Pretendard Variable"', '가나다'),
        document.fonts.ready
      ]);
    } catch (e) {
      /* 폰트 로드 실패 시 시스템 폰트로 대체 */
    }
  }

  async function ensureReady() {
    await ensureFonts();
    await preloadPhotos();
  }

  function renderCardCanvas(index) {
    const canvas = document.createElement('canvas');
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext('2d');
    drawCard(ctx, state.project.cards[index], index, state.project);
    return canvas;
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('이미지를 만들지 못했습니다. 외부 이미지(CORS) 문제일 수 있습니다.'))),
          type || 'image/png',
          quality
        );
      } catch (e) {
        reject(e);
      }
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 2000);
  }

  function baseName() {
    const raw = (state.project.name || state.project.topic || (state.project.cards[0] && state.project.cards[0].title1) || 'cardnews')
      .toString()
      .trim();
    const safe = raw.replace(/[\\/:*?"<>|\n\r\t]/g, ' ').replace(/\s+/g, '-').slice(0, 40) || 'cardnews';
    return safe;
  }

  function setPngStatus(msg, cls) {
    const el = $('#png-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'hint' + (cls ? ' ' + cls : '');
  }

  async function exportCurrentPng() {
    try {
      setPngStatus('저장 중...');
      await ensureReady();
      const canvas = renderCardCanvas(state.activeCard);
      const blob = await canvasToBlob(canvas, 'image/png');
      downloadBlob(blob, baseName() + '-' + pad2(state.activeCard + 1) + '.png');
      setPngStatus('현재 카드 PNG를 저장했습니다. (1080×1350)', 'ok');
    } catch (e) {
      setPngStatus(e.message || 'PNG 저장에 실패했습니다.', 'err');
      toast('PNG 저장에 실패했습니다. 외부 이미지(CORS)를 사용 중이면 갤러리 사진으로 바꿔 보세요.', 'err');
    }
  }

  async function exportAllPng() {
    try {
      setPngStatus('카드 ' + state.project.cards.length + '장 저장 중...');
      await ensureReady();
      for (let i = 0; i < state.project.cards.length; i++) {
        const canvas = renderCardCanvas(i);
        const blob = await canvasToBlob(canvas, 'image/png');
        downloadBlob(blob, baseName() + '-' + pad2(i + 1) + '.png');
        await new Promise((r) => setTimeout(r, 350));
      }
      setPngStatus('전체 ' + state.project.cards.length + '장을 저장했습니다.', 'ok');
    } catch (e) {
      setPngStatus(e.message || '전체 저장에 실패했습니다.', 'err');
    }
  }

  async function exportZip() {
    if (typeof JSZip === 'undefined') {
      setPngStatus('ZIP 라이브러리를 불러오지 못해 한 장씩 저장합니다.', 'err');
      return exportAllPng();
    }
    try {
      setPngStatus('ZIP 만드는 중...');
      await ensureReady();
      const zip = new JSZip();
      const folder = zip.folder('cardnews');
      for (let i = 0; i < state.project.cards.length; i++) {
        const canvas = renderCardCanvas(i);
        const blob = await canvasToBlob(canvas, 'image/png');
        folder.file(pad2(i + 1) + '.png', blob);
        setPngStatus('ZIP ' + (i + 1) + ' / ' + state.project.cards.length + ' 준비...');
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, baseName() + '-png.zip');
      setPngStatus('ZIP 저장 완료 · ' + state.project.cards.length + '장 (' + (blob.size / 1048576).toFixed(1) + 'MB)', 'ok');
    } catch (e) {
      setPngStatus('ZIP 저장에 실패했습니다. 외부 이미지(CORS) 문제일 수 있습니다.', 'err');
    }
  }

  /* ============================================================
     영상
     ============================================================ */
  function videoTimings() {
    const n = state.project.cards.length;
    const dwell = state.ui.dwell;
    const trans = state.ui.transition === 'none' ? 0 : 420;
    const segs = [];
    let acc = 0;
    for (let i = 0; i < n; i++) {
      segs.push({ type: 'hold', i: i, start: acc, end: acc + dwell });
      acc += dwell;
      if (i < n - 1 && trans > 0) {
        segs.push({ type: 'trans', from: i, to: i + 1, start: acc, end: acc + trans });
        acc += trans;
      }
    }
    return { n: n, dwell: dwell, trans: trans, total: acc, segs: segs };
  }

  function drawVideoBackdrop(ctx, proj) {
    const accent = proj.design.accent;
    ctx.fillStyle = '#050706';
    ctx.fillRect(0, 0, VID_W, VID_H);
    const g = ctx.createRadialGradient(VID_W / 2, VID_H * 0.3, 40, VID_W / 2, VID_H * 0.3, 1000);
    g.addColorStop(0, hexA(accent, 0.16));
    g.addColorStop(1, hexA(accent, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VID_W, VID_H);
  }

  function drawVideoCard(ctx, cardCanvas, offsetY, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    const y = 285 + (offsetY || 0);
    ctx.drawImage(cardCanvas, 0, y, CARD_W, CARD_H);
    ctx.restore();
  }

  function drawVideoChrome(ctx, t, timing, proj) {
    const accent = proj.design.accent;
    ctx.save();
    setFont(ctx, 30, 700);
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(proj.design.handle || '@royfafa2023', VID_W / 2, 150);
    ctx.restore();

    // 진행 바
    const barY = VID_H - 118;
    const totalW = VID_W - 200;
    const gap = 8;
    const segW = (totalW - gap * (timing.n - 1)) / timing.n;
    ctx.save();
    for (let i = 0; i < timing.n; i++) {
      const x = 100 + i * (segW + gap);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      roundRect(ctx, x, barY, segW, 6, 3);
      ctx.fill();
    }
    const progress = clamp(t / timing.total, 0, 1);
    const filled = progress * totalW;
    ctx.fillStyle = accent;
    roundRect(ctx, 100, barY, filled, 6, 3);
    ctx.fill();
    ctx.restore();
  }

  function drawVideoFrame(ctx, cardCanvases, t, proj) {
    const timing = videoTimings();
    const n = timing.n;
    ctx.clearRect(0, 0, VID_W, VID_H);
    drawVideoBackdrop(ctx, proj);

    const time = clamp(t, 0, timing.total - 1);
    let seg = timing.segs[timing.segs.length - 1];
    for (let i = 0; i < timing.segs.length; i++) {
      if (time >= timing.segs[i].start && time < timing.segs[i].end) {
        seg = timing.segs[i];
        break;
      }
    }

    if (seg.type === 'hold') {
      drawVideoCard(ctx, cardCanvases[seg.i], 0, 1);
    } else {
      const p = clamp((time - seg.start) / (seg.end - seg.start), 0, 1);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      if (state.ui.transition === 'slide') {
        drawVideoCard(ctx, cardCanvases[seg.from], -e * VID_H, 1);
        drawVideoCard(ctx, cardCanvases[seg.to], (1 - e) * VID_H, 1);
      } else if (state.ui.transition === 'none') {
        drawVideoCard(ctx, cardCanvases[seg.to], 0, 1);
      } else {
        drawVideoCard(ctx, cardCanvases[seg.from], 0, 1);
        drawVideoCard(ctx, cardCanvases[seg.to], 0, e);
      }
    }

    drawVideoChrome(ctx, time, timing, proj);
  }

  function drawVideoStill() {
    const canvas = $('#video-preview-canvas');
    if (!canvas || !state.project) return;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(canvas.width / VID_W, canvas.height / VID_H);
    try {
      const cards = state.project.cards.map((c, i) => renderCardCanvas(i));
      drawVideoFrame(ctx, cards, 0, state.project);
    } catch (e) {
      console.error('[cardmaker] video still failed', e);
    }
    ctx.restore();
  }

  function pickVideoMime() {
    if (!window.MediaRecorder) return '';
    for (let i = 0; i < VIDEO_CANDIDATES.length; i++) {
      try {
        if (MediaRecorder.isTypeSupported(VIDEO_CANDIDATES[i])) return VIDEO_CANDIDATES[i];
      } catch (e) {
        /* ignore */
      }
    }
    return '';
  }

  function extFromMime(type) {
    const t = String(type || '').split(';')[0].trim().toLowerCase();
    const map = {
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
      'video/x-matroska': 'mkv',
      'video/ogg': 'ogv'
    };
    if (map[t]) return map[t];
    const sub = t.split('/')[1];
    return sub ? sub.replace(/[^a-z0-9]/g, '') || 'webm' : 'webm';
  }

  async function decodeAudio(arrayBuffer) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error('이 브라우저는 오디오 믹싱을 지원하지 않습니다.');
    const ctx = new Ctx();
    if (ctx.state === 'suspended' && ctx.resume) {
      try {
        await ctx.resume();
      } catch (e) {
        /* ignore */
      }
    }
    try {
      const buffer = await new Promise((resolve, reject) => {
        let settled = false;
        const maybe = ctx.decodeAudioData(
          arrayBuffer,
          (buf) => {
            settled = true;
            resolve(buf);
          },
          (err) => {
            settled = true;
            reject(err || new Error('오디오 디코딩 실패'));
          }
        );
        if (maybe && typeof maybe.then === 'function') {
          maybe.then((buf) => {
            if (!settled) {
              settled = true;
              resolve(buf);
            }
          }).catch((err) => {
            if (!settled) {
              settled = true;
              reject(err);
            }
          });
        }
      });
      return { ctx: ctx, buffer: buffer };
    } catch (e) {
      ctx.close && ctx.close();
      throw new Error('음악 파일을 읽지 못했습니다. MP3·M4A 파일을 권장합니다.');
    }
  }

  async function prepareAudio(totalMs) {
    const file = state.ui.bgmFile;
    if (!file) return null;
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await decodeAudio(arrayBuffer);
    const ctx = decoded.ctx;
    const buffer = decoded.buffer;
    const dest = ctx.createMediaStreamDestination();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain);
    gain.connect(dest);

    const t0 = ctx.currentTime;
    const totalSec = totalMs / 1000;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.95, t0 + 0.5);
    const fadeStart = t0 + Math.max(0.8, totalSec - 1.6);
    gain.gain.setValueAtTime(0.95, fadeStart);
    gain.gain.linearRampToValueAtTime(0, t0 + totalSec);
    src.start(t0);
    try {
      src.stop(t0 + totalSec + 0.3);
    } catch (e) {
      /* ignore */
    }

    let stopped = false;
    return {
      stream: dest.stream,
      stop: function () {
        if (stopped) return;
        stopped = true;
        try {
          src.stop();
        } catch (e) {
          /* ignore */
        }
        try {
          if (ctx.state !== 'closed') ctx.close();
        } catch (e) {
          /* ignore */
        }
      }
    };
  }

  function setVideoStatus(msg, cls) {
    const el = $('#video-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'hint' + (cls ? ' ' + cls : '');
  }

  function setVideoBusy(busy) {
    const pv = $('#btn-video-preview');
    const ex = $('#btn-video-export');
    if (pv) pv.disabled = busy;
    if (ex) ex.disabled = busy;
    if (ex) ex.textContent = busy ? '만드는 중...' : '영상 만들기';
    const prog = $('#video-progress');
    if (prog) {
      prog.hidden = !busy;
      if (!busy) prog.querySelector('span').style.width = '0%';
    }
  }

  async function playVideoPreview() {
    if (state.ui.previewing || state.ui.recording) return;
    const canvas = $('#video-preview-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    state.ui.previewing = true;
    setVideoBusy(true);
    if ($('#btn-video-preview')) $('#btn-video-preview').textContent = '재생 중...';

    let audioEl = null;
    let audioUrl = '';
    try {
      await ensureReady();
      const cardCanvases = state.project.cards.map((c, i) => renderCardCanvas(i));
      const timing = videoTimings();
      if (state.ui.bgmFile) {
        audioUrl = URL.createObjectURL(state.ui.bgmFile);
        audioEl = new Audio(audioUrl);
        audioEl.loop = true;
        audioEl.volume = 0.85;
        audioEl.play().catch(() => {});
      }
      const start = performance.now();
      await new Promise((resolve) => {
        function frame(now) {
          const t = now - start;
          ctx.save();
          ctx.scale(canvas.width / VID_W, canvas.height / VID_H);
          drawVideoFrame(ctx, cardCanvases, Math.min(t, timing.total), state.project);
          ctx.restore();
          if (audioEl && t > timing.total - 1500) {
            audioEl.volume = Math.max(0, 0.85 * (1 - (t - (timing.total - 1500)) / 1500));
          }
          if (t >= timing.total) {
            resolve();
            return;
          }
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
      setVideoStatus('미리보기 재생 완료 · 총 ' + (timing.total / 1000).toFixed(1) + '초', 'ok');
    } catch (e) {
      setVideoStatus(e.message || '미리보기에 실패했습니다.', 'err');
    } finally {
      if (audioEl) {
        audioEl.pause();
        if (audioUrl) URL.revokeObjectURL(audioUrl);
      }
      state.ui.previewing = false;
      setVideoBusy(false);
      if ($('#btn-video-preview')) $('#btn-video-preview').textContent = '미리보기 재생';
    }
  }

  async function exportVideo() {
    if (state.ui.recording || state.ui.previewing) return;
    if (!window.MediaRecorder) {
      setVideoStatus('이 브라우저는 영상 녹화를 지원하지 않습니다. PNG 저장을 사용해 주세요.', 'err');
      return;
    }
    const mime = pickVideoMime();
    if (!mime) {
      setVideoStatus('이 브라우저에서 지원하는 영상 포맷이 없습니다. Chrome·Safari 최신 버전에서 시도해 주세요.', 'err');
      return;
    }

    const timing = videoTimings();
    state.ui.recording = true;
    setVideoBusy(true);
    setVideoStatus('준비 중...');

    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-12000px;top:0;width:' + VID_W + 'px;height:' + VID_H + 'px;overflow:hidden;';
    const canvas = document.createElement('canvas');
    canvas.width = VID_W;
    canvas.height = VID_H;
    host.appendChild(canvas);
    document.body.appendChild(host);
    const ctx = canvas.getContext('2d');

    let audio = null;
    let recorder = null;
    try {
      await ensureReady();
      const cardCanvases = state.project.cards.map((c, i) => renderCardCanvas(i));
      drawVideoFrame(ctx, cardCanvases, 0, state.project);

      if (state.ui.bgmFile) {
        setVideoStatus('음악 준비 중...');
        audio = await prepareAudio(timing.total);
      }

      const stream = canvas.captureStream(30);
      if (audio) {
        audio.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      }

      let options = { videoBitsPerSecond: 6000000 };
      if (audio) options.audioBitsPerSecond = 128000;
      try {
        options.mimeType = mime;
        recorder = new MediaRecorder(stream, options);
      } catch (e) {
        try {
          recorder = new MediaRecorder(stream);
        } catch (e2) {
          throw new Error('이 브라우저에서 영상 녹화를 시작할 수 없습니다.');
        }
      }

      const chunks = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size) chunks.push(ev.data);
      };
      const stopped = new Promise((resolve) => {
        recorder.onstop = resolve;
      });

      recorder.start(1000);
      setVideoStatus('녹화 중... 화면을 벗어나지 마세요.');

      const start = performance.now();
      await new Promise((resolve) => {
        function frame(now) {
          const t = now - start;
          drawVideoFrame(ctx, cardCanvases, Math.min(t, timing.total), state.project);
          const pct = clamp((t / timing.total) * 100, 0, 100);
          const bar = $('#video-progress span');
          if (bar) bar.style.width = pct.toFixed(1) + '%';
          if (t >= timing.total + 160) {
            resolve();
            return;
          }
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });

      recorder.stop();
      await stopped;
      if (audio) audio.stop();

      const actualType = recorder.mimeType || mime;
      const blob = new Blob(chunks, { type: actualType });
      const ext = extFromMime(actualType);
      if (!blob.size) throw new Error('영상 데이터가 만들어지지 않았습니다. 다시 시도해 주세요.');
      downloadBlob(blob, baseName() + '-short.' + ext);
      setVideoStatus(
        '저장 완료 · ' + ext.toUpperCase() + ' (' + (blob.size / 1048576).toFixed(1) + 'MB · ' + (actualType.split(';')[0]) + ')',
        'ok'
      );
      toast('영상을 저장했습니다. (' + ext.toUpperCase() + ')', 'ok');
    } catch (e) {
      setVideoStatus(e.message || '영상 저장에 실패했습니다.', 'err');
      toast(e.message || '영상 저장에 실패했습니다.', 'err');
    } finally {
      if (audio) {
        try {
          audio.stop();
        } catch (e) {
          /* ignore */
        }
      }
      host.remove();
      state.ui.recording = false;
      setVideoBusy(false);
    }
  }

  /* ============================================================
     전체 UI 갱신
     ============================================================ */
  function refreshAllUI() {
    applyAccentToUI();
    renderStep1();
    renderHooks();
    buildEditor();
    renderThumbs();
    renderCaption();
    renderExportPanel();
    drawPreview();
  }

  /* ============================================================
     이벤트 연결
     ============================================================ */
  function wireEvents() {
    $$('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => showTab(btn.dataset.tab));
    });

    $$('.step-btn').forEach((btn) => {
      btn.addEventListener('click', () => showStep(Number(btn.dataset.step)));
    });

    $$('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.mode = btn.dataset.mode;
        $$('.mode-btn').forEach((b) => b.classList.toggle('is-active', b === btn));
        const api = $('#pane-api');
        const free = $('#pane-free');
        if (api) api.hidden = state.mode !== 'api';
        if (free) free.hidden = state.mode !== 'free';
      });
    });

    const preset1 = $('#btn-preset-1');
    const preset2 = $('#btn-preset-2');
    function loadSample(idx) {
      const sample = SAMPLES[idx];
      if (!sample) return;
      applyDeck(JSON.parse(JSON.stringify(sample.deck)));
      refreshAllUI();
      showStep(2);
      toast('샘플 "' + sample.name + '"을 불러왔습니다. 훅을 골라 보세요.', 'ok');
    }
    if (preset1) preset1.addEventListener('click', () => loadSample(0));
    if (preset2) preset2.addEventListener('click', () => loadSample(1));

    const parseBtn = $('#btn-parse-text');
    if (parseBtn) {
      parseBtn.addEventListener('click', () => {
        const raw = ($('#inp-paste') || {}).value || '';
        if (!raw.trim()) {
          toast('원고를 먼저 붙여넣어 주세요.', 'err');
          ($('#inp-paste') || {}).focus && $('#inp-paste').focus();
          return;
        }
        const deck = parseFreeText(raw);
        if (!deck || (!deck.cards.length && !deck.title1)) {
          toast('원고를 해석하지 못했습니다. 빈 줄로 슬라이드를 나눠 주세요.', 'err');
          return;
        }
        applyDeck(deck);
        refreshAllUI();
        const st = $('#paste-status');
        if (st) {
          st.textContent = '카드 ' + state.project.cards.length + '장으로 만들었습니다. 2단계에서 훅을 골라 보세요.';
          st.className = 'hint ok';
        }
        showStep(2);
        toast('원고를 카드로 만들었습니다.', 'ok');
      });
    }

    const copyPromptBtn = $('#btn-copy-prompt');
    if (copyPromptBtn) copyPromptBtn.addEventListener('click', () => copyText(buildCopyPrompt(), '프롬프트를 복사했습니다. 클로드·포리에 붙여넣어 주세요.'));

    const modelSel = $('#sel-model');
    const customModel = $('#inp-model-custom');
    if (modelSel && customModel) {
      modelSel.addEventListener('change', () => {
        const custom = modelSel.value === '__custom__';
        customModel.hidden = !custom;
        if (custom) customModel.focus();
      });
    }

    const genBtn = $('#btn-generate');
    if (genBtn) {
      genBtn.addEventListener('click', async () => {
        const topic = (($('#inp-topic') || {}).value || '').trim();
        const memo = (($('#inp-memo') || {}).value || '').trim();
        const status = $('#gen-status');
        if (!topic) {
          toast('주제를 먼저 적어 주세요.', 'err');
          if ($('#inp-topic')) $('#inp-topic').focus();
          return;
        }
        if (!state.apiKey) {
          if (status) {
            status.textContent = 'API 키가 없습니다. 설정 탭에서 저장하거나, 무료 붙여넣기 모드를 사용하세요.';
            status.className = 'hint err';
          }
          return;
        }
        let model = modelSel ? modelSel.value : 'claude-sonnet-4-5';
        if (model === '__custom__') model = (customModel.value || '').trim();
        if (!model) {
          toast('모델 ID를 입력해 주세요.', 'err');
          return;
        }
        state.project.topic = topic;
        state.project.memo = memo;
        touch();
        genBtn.classList.add('is-busy');
        genBtn.textContent = '만드는 중...';
        if (status) {
          status.textContent = 'Claude가 원고를 쓰고 있습니다... (10~30초)';
          status.className = 'hint';
        }
        try {
          const text = await callClaude({
            model: model,
            max_tokens: 3000,
            system: buildSystemPrompt(),
            messages: [{ role: 'user', content: buildUserPrompt(topic, memo) }]
          });
          const json = extractJSON(text);
          if (!json) throw new Error('응답을 JSON으로 해석하지 못했습니다. 다시 시도해 주세요.');
          const deck = deckFromJSON(json);
          if (!deck.cards.length && !deck.title1) throw new Error('카드가 비어 있습니다. 다시 시도해 주세요.');
          applyDeck(deck);
          refreshAllUI();
          if (status) {
            status.textContent = '완성: 카드 ' + state.project.cards.length + '장. 2단계에서 훅을 골라 보세요.';
            status.className = 'hint ok';
          }
          showStep(2);
        } catch (e) {
          const msg = e && e.message ? e.message : '생성에 실패했습니다.';
          if (status) {
            status.textContent = '오류: ' + msg;
            status.className = 'hint err';
          }
          toast('원고 생성 실패: ' + msg, 'err');
        } finally {
          genBtn.classList.remove('is-busy');
          genBtn.textContent = 'Claude로 원고 만들기';
        }
      });
    }

    const nameEl = $('#inp-project-name');
    if (nameEl) {
      nameEl.addEventListener('input', () => {
        state.project.name = nameEl.value;
        touch();
        renderStep1();
      });
    }

    const topicEl = $('#inp-topic');
    if (topicEl) {
      topicEl.addEventListener('input', () => {
        state.project.topic = topicEl.value;
        touch();
      });
    }
    const memoEl = $('#inp-memo');
    if (memoEl) {
      memoEl.addEventListener('input', () => {
        state.project.memo = memoEl.value;
        touch();
      });
    }

    const newBtn = $('#btn-new');
    if (newBtn) {
      newBtn.addEventListener('click', async () => {
        const ok = await askConfirm('새로 쓰기', '지금 작업 중인 내용을 비우고 새 프로젝트를 시작합니다. 저장하지 않은 내용은 사라집니다.', '새로 쓰기');
        if (!ok) return;
        state.project = newProject(state.settings);
        state.activeCard = 0;
        touch();
        refreshAllUI();
        showStep(1);
        toast('새 프로젝트를 시작했습니다.', 'ok');
      });
    }

    const saveBtn = $('#btn-save-project');
    if (saveBtn) saveBtn.addEventListener('click', () => saveProjectToStorage());

    const addBtn = $('#btn-card-add');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const p = state.project;
        const ctaIndex = p.cards.length - 1;
        const card = createCard('body', { subtitle: '', body: '', items: [] });
        const insertAt = Math.max(1, Math.min(state.activeCard + 1, ctaIndex));
        p.cards.splice(insertAt, 0, card);
        state.activeCard = insertAt;
        touch();
        buildEditor();
        renderThumbs();
        drawPreview();
        renderStep1();
        toast('카드를 추가했습니다.', 'ok');
      });
    }

    const delBtn = $('#btn-card-del');
    if (delBtn) {
      delBtn.addEventListener('click', async () => {
        const p = state.project;
        if (p.cards.length <= 2) {
          toast('카드는 최소 2장이 필요합니다.', 'err');
          return;
        }
        const card = p.cards[state.activeCard];
        if (!card) return;
        if (card.role === 'cover' || card.role === 'cta') {
          toast('표지와 마지막 장은 삭제할 수 없습니다.', 'err');
          return;
        }
        const ok = await askConfirm('카드 삭제', cardLabel(card, state.activeCard) + ' 카드를 삭제할까요?', '삭제');
        if (!ok) return;
        p.cards.splice(state.activeCard, 1);
        state.activeCard = clamp(state.activeCard, 0, p.cards.length - 1);
        touch();
        buildEditor();
        renderThumbs();
        drawPreview();
        renderStep1();
      });
    }

    const prevBtn = $('#btn-card-prev');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => moveCard(-1));
    }
    const nextBtn = $('#btn-card-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => moveCard(1));
    }

    const strip = $('#thumb-strip');
    if (strip) {
      strip.addEventListener('click', (e) => {
        const btn = e.target.closest ? e.target.closest('.thumb') : null;
        if (!btn) return;
        const index = Number(btn.dataset.index);
        if (!Number.isFinite(index)) return;
        selectCard(index);
      });
    }

    const capEl = $('#caption-text');
    if (capEl) {
      capEl.addEventListener('input', () => {
        state.project.caption = capEl.value;
        touch();
      });
    }
    const copyCap = $('#btn-copy-caption');
    if (copyCap) {
      copyCap.addEventListener('click', () => {
        const text = (($('#caption-text') || {}).value || '').trim();
        if (!text) {
          toast('캡션이 비어 있습니다.', 'err');
          return;
        }
        copyText(text, '캡션을 복사했습니다.');
      });
    }

    // 내보내기
    const pngCur = $('#btn-png-current');
    if (pngCur) pngCur.addEventListener('click', exportCurrentPng);
    const pngAll = $('#btn-png-all');
    if (pngAll) pngAll.addEventListener('click', exportAllPng);
    const pngZip = $('#btn-png-zip');
    if (pngZip) pngZip.addEventListener('click', exportZip);

    $$('#dwell-options .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.ui.dwell = Number(chip.dataset.dwell) || 3000;
        $$('#dwell-options .chip').forEach((c) => c.classList.toggle('is-active', c === chip));
        updateVideoDuration();
      });
    });

    const transSel = $('#sel-transition');
    if (transSel) {
      transSel.addEventListener('change', () => {
        state.ui.transition = transSel.value;
        updateVideoDuration();
      });
    }

    const bgmInput = $('#inp-bgm');
    if (bgmInput) {
      bgmInput.addEventListener('change', () => {
        const file = bgmInput.files && bgmInput.files[0];
        state.ui.bgmFile = file || null;
        const el = $('#bgm-name');
        if (el) el.textContent = file ? '선택: ' + file.name : '선택 안 함 · 무음으로 내보냅니다.';
        if (file) toast('배경음악을 선택했습니다: ' + file.name, 'ok');
      });
    }
    const bgmRemove = $('#btn-bgm-remove');
    if (bgmRemove) {
      bgmRemove.addEventListener('click', () => {
        state.ui.bgmFile = null;
        if (bgmInput) bgmInput.value = '';
        const el = $('#bgm-name');
        if (el) el.textContent = '선택 안 함 · 무음으로 내보냅니다.';
      });
    }

    const pvBtn = $('#btn-video-preview');
    if (pvBtn) pvBtn.addEventListener('click', playVideoPreview);
    const exBtn = $('#btn-video-export');
    if (exBtn) exBtn.addEventListener('click', exportVideo);

    // 설정
    const keyToggle = $('#btn-key-toggle');
    if (keyToggle) {
      keyToggle.addEventListener('click', () => {
        const el = $('#inp-api-key');
        if (!el) return;
        const show = el.type === 'password';
        el.type = show ? 'text' : 'password';
        keyToggle.textContent = show ? '숨기기' : '보기';
      });
    }

    const keySave = $('#btn-key-save');
    if (keySave) {
      keySave.addEventListener('click', () => {
        const el = $('#inp-api-key');
        const val = (el.value || '').trim();
        state.apiKey = val;
        try {
          if (val) localStorage.setItem(LS.key, val);
          else localStorage.removeItem(LS.key);
        } catch (e) {
          toast('키를 저장하지 못했습니다.', 'err');
          return;
        }
        const st = $('#key-status');
        if (st) {
          st.textContent = val ? '키를 이 브라우저에 저장했습니다. (서버로 전송되지 않음)' : '저장된 키를 지웠습니다.';
          st.className = 'hint ok';
        }
        toast('API 키를 저장했습니다.', 'ok');
      });
    }

    const keyTest = $('#btn-key-test');
    if (keyTest) {
      keyTest.addEventListener('click', async () => {
        const el = $('#inp-api-key');
        const key = ((el && el.value) || state.apiKey || '').trim();
        const st = $('#key-status');
        if (!key) {
          if (st) {
            st.textContent = '키를 입력해 주세요.';
            st.className = 'hint err';
          }
          return;
        }
        state.apiKey = key;
        keyTest.classList.add('is-busy');
        keyTest.textContent = '확인 중...';
        if (st) {
          st.textContent = '테스트 호출 중...';
          st.className = 'hint';
        }
        try {
          await callClaude({
            model: 'claude-haiku-4-5',
            max_tokens: 16,
            messages: [{ role: 'user', content: '연결 테스트입니다. "확인"이라고만 답해 주세요.' }]
          });
          if (st) {
            st.textContent = '연결 성공! 1단계에서 Claude로 원고를 만들 수 있습니다.';
            st.className = 'hint ok';
          }
        } catch (e) {
          if (st) {
            st.textContent = '실패: ' + (e.message || '알 수 없는 오류') + ' (키·크레딧·모델명을 확인해 주세요)';
            st.className = 'hint err';
          }
        } finally {
          keyTest.classList.remove('is-busy');
          keyTest.textContent = '테스트 호출';
        }
      });
    }

    const settingsSave = $('#btn-settings-save');
    if (settingsSave) {
      settingsSave.addEventListener('click', () => {
        const handle = (($('#inp-default-handle') || {}).value || '').trim() || '@royfafa2023';
        const subtitle = (($('#inp-default-subtitle') || {}).value || '').trim() || '로이파파의 AI·생활 기록';
        const template = ($('#sel-default-template') || {}).value || 'text';
        state.settings = {
          handle: handle.charAt(0) === '@' ? handle : '@' + handle,
          subtitle: subtitle,
          template: template,
          accent: state.settings.accent
        };
        saveJSON(LS.settings, state.settings);
        if (state.project) {
          state.project.design.handle = state.settings.handle;
          state.project.design.subtitle = state.settings.subtitle;
          state.project.design.template = state.settings.template;
          state.project.design.accent = state.settings.accent;
          touch();
        }
        refreshAllUI();
        renderSettings();
        const st = $('#settings-status');
        if (st) {
          st.textContent = '기본값을 저장했고 현재 프로젝트에도 적용했습니다.';
          st.className = 'hint ok';
        }
        toast('기본값을 저장했습니다.', 'ok');
      });
    }

    const resetBtn = $('#btn-reset-data');
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        const ok = await askConfirm('전체 삭제', '저장된 프로젝트와 API 키를 이 브라우저에서 모두 지웁니다. 되돌릴 수 없습니다.', '모두 삭제');
        if (!ok) return;
        try {
          localStorage.removeItem(LS.projects);
          localStorage.removeItem(LS.key);
          localStorage.removeItem(LS.working);
        } catch (e) {
          /* ignore */
        }
        state.apiKey = '';
        state.project = newProject(state.settings);
        state.activeCard = 0;
        refreshAllUI();
        renderSettings();
        renderStorage();
        toast('모든 데이터를 삭제했습니다.', 'ok');
      });
    }

    // 3단계 미리보기 : 크게 보기 / 작게 보기
    const previewDock = $('#preview-dock');
    const previewToggle = $('#btn-preview-toggle');
    if (previewDock && previewToggle) {
      previewToggle.addEventListener('click', () => {
        const large = previewDock.classList.toggle('is-large');
        previewToggle.setAttribute('aria-pressed', large ? 'true' : 'false');
        const label = previewToggle.querySelector('span');
        if (label) label.textContent = large ? '작게 보기' : '크게 보기';
      });
    }

    // 설정 탭 강조색 즉시 반영
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        /* 다이얼로그는 브라우저가 처리 */
      }
    });
  }

  function selectCard(index) {
    if (!state.project) return;
    state.activeCard = clamp(index, 0, state.project.cards.length - 1);
    $$('#thumb-strip .thumb').forEach((t) => t.classList.toggle('is-active', Number(t.dataset.index) === state.activeCard));
    buildEditor();
    drawPreview();
    const activeThumb = $('#thumb-strip .thumb.is-active');
    if (activeThumb && activeThumb.scrollIntoView) {
      activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  function moveCard(dir) {
    const p = state.project;
    const i = state.activeCard;
    const j = i + dir;
    if (j < 0 || j >= p.cards.length) return;
    if (i === 0 || j === 0 || i === p.cards.length - 1 || j === p.cards.length - 1) {
      toast('표지와 마지막 장은 위치를 옮길 수 없습니다.', 'err');
      return;
    }
    const tmp = p.cards[i];
    p.cards[i] = p.cards[j];
    p.cards[j] = tmp;
    state.activeCard = j;
    touch();
    renderThumbs();
    buildEditor();
    drawPreview();
    toast('카드 순서를 바꿨습니다.', 'ok');
  }

  /* ============================================================
     시작
     ============================================================ */
  function syncChrome() {
    // 헤더 실제 높이를 CSS 변수로 넘겨 스티키 오프셋을 맞춘다
    const header = document.querySelector('.app-header');
    if (header) {
      const h = Math.round(header.getBoundingClientRect().height);
      if (h > 0) document.documentElement.style.setProperty('--header-h', h + 'px');
    }
    const bar = document.querySelector('.stepbar');
    if (bar && !bar.hidden) {
      const bh = Math.round(bar.getBoundingClientRect().height);
      if (bh > 0) document.documentElement.style.setProperty('--stepbar-h', bh + 'px');
    }
  }

  function init() {
    state.settings = Object.assign(defaultSettings(), loadJSON(LS.settings, {}));
    try {
      state.apiKey = localStorage.getItem(LS.key) || '';
    } catch (e) {
      state.apiKey = '';
    }

    const saved = loadJSON(LS.working, null);
    state.project = saved ? normalizeProject(saved) : newProject(state.settings);
    if (!state.project.hooks.length) {
      state.project.hooks = makeDefaultHooks(state.project.cards[0].title1);
    }

    applyAccentToUI();
    wireEvents();
    showTab('workspace');
    showStep(1);
    refreshAllUI();

    renderSettings();
    renderStorage();
    renderExportPanel();
    syncChrome();

    window.addEventListener('resize', syncChrome);
    window.addEventListener('orientationchange', () => setTimeout(syncChrome, 120));

    ensureFonts().then(() => {
      drawPreview();
      drawAllThumbs();
      drawVideoStill();
    });

    // 폰트가 늦게 도착하면 다시 그린다
    if (document.fonts && document.fonts.addEventListener) {
      document.fonts.addEventListener('loadingdone', () => {
        drawPreview();
        drawAllThumbs();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 개발 편의: 콘솔에서 상태 확인 (개인정보 없음)
  window.__cardmaker = {
    state: state,
    drawPreview: drawPreview,
    showStep: showStep,
    showTab: showTab
  };
})();
