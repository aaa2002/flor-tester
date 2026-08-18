// Paints a floor texture into a room photo.
//
//   out = texture(H⁻¹·p) · shading(p)     inside the floor mask
//
// `shading` is the photo's own luminance normalised around the floor's mean, so the
// room's shadows, contact darkening and thin objects standing on the floor survive
// the swap instead of being painted over.

const TEX = 512; // texture atlas is square at this size

/** Solve A·x = b by Gaussian elimination with partial pivoting. */
function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) {
      if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    }
    [M[c], M[piv]] = [M[piv], M[c]];
    const d = M[c][c];
    if (Math.abs(d) < 1e-12) continue;
    for (let k = c; k <= n; k++) M[c][k] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c];
      if (!f) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row) => row[n]);
}

/** 3x3 homography mapping the four `src` points onto the four `dst` points. */
function homography(src, dst) {
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solve(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

function invert3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  const s = 1 / det;
  return [
    (e * i - f * h) * s, (c * h - b * i) * s, (b * f - c * e) * s,
    (f * g - d * i) * s, (a * i - c * g) * s, (c * d - a * f) * s,
    (d * h - e * g) * s, (b * g - a * h) * s, (a * e - b * d) * s,
  ];
}

function polyPath(points, w, h) {
  const p = new Path2D();
  points.forEach(([x, y], i) => {
    const px = (x / 100) * w;
    const py = (y / 100) * h;
    if (i === 0) p.moveTo(px, py); else p.lineTo(px, py);
  });
  p.closePath();
  return p;
}

/**
 * Everything that depends only on the room, computed once: the floor mask, the
 * lighting to re-apply, and the texture coordinate of every pixel.
 */
export function prepareRoom(roomImage, cfg, maxSize = 1000) {
  const scale = Math.min(1, maxSize / Math.max(roomImage.width, roomImage.height));
  const w = Math.round(roomImage.width * scale);
  const h = Math.round(roomImage.height * scale);

  const base = document.createElement('canvas');
  base.width = w; base.height = h;
  const bctx = base.getContext('2d', { willReadFrequently: true });
  bctx.drawImage(roomImage, 0, 0, w, h);
  const baseData = bctx.getImageData(0, 0, w, h);

  // ---- floor mask: outer polygon minus the large occluders ----
  const mc = document.createElement('canvas');
  mc.width = w; mc.height = h;
  const mctx = mc.getContext('2d', { willReadFrequently: true });
  mctx.fillStyle = '#000';
  mctx.fillRect(0, 0, w, h);
  mctx.filter = 'blur(1.2px)';
  mctx.fillStyle = '#fff';
  mctx.fill(polyPath(cfg.outer, w, h));
  mctx.fillStyle = '#000';
  for (const hole of cfg.holes) mctx.fill(polyPath(hole, w, h));
  const maskData = mctx.getImageData(0, 0, w, h).data;

  const n = w * h;
  const mask = new Float32Array(n);
  for (let i = 0; i < n; i++) mask[i] = maskData[i * 4] / 255;

  // ---- lighting: luminance normalised so the floor averages 1.0 ----
  const { lo, hi, strength } = cfg.shading;
  const px = baseData.data;
  let sum = 0;
  let wsum = 0;
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const l = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    lum[i] = l;
    sum += l * mask[i];
    wsum += mask[i];
  }
  const mean = wsum > 0 ? sum / wsum : 1;
  const shade = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = Math.min(hi, Math.max(lo, lum[i] / mean));
    shade[i] = 1 + (s - 1) * strength;
  }

  return { w, h, baseData, mask, shade, cfg };
}

/**
 * Composite one texture into the prepared room. `scale` > 1 makes the boards smaller.
 * Returns ImageData ready to put on the visible canvas.
 */
export function renderFloor(room, texCanvasData, scale = 1) {
  const { w, h, baseData, mask, shade, cfg } = room;
  const n = cfg.repeat * scale;

  const quad = cfg.plane.map(([x, y]) => [(x / 100) * w, (y / 100) * h]);
  const Hm = homography([[0, 0], [n, 0], [n, n], [0, n]], quad);
  const [a, b, c, d, e, f, g, i2, j] = invert3(Hm);

  const out = new ImageData(w, h);
  const o = out.data;
  const bp = baseData.data;
  const tp = texCanvasData.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const p4 = idx * 4;
      const m = mask[idx];

      if (m <= 0.002) {
        o[p4] = bp[p4]; o[p4 + 1] = bp[p4 + 1]; o[p4 + 2] = bp[p4 + 2]; o[p4 + 3] = 255;
        continue;
      }

      const wgt = g * x + i2 * y + j;
      let u = (a * x + b * y + c) / wgt;
      let v = (d * x + e * y + f) / wgt;
      u -= Math.floor(u);
      v -= Math.floor(v);

      const t4 = ((v * TEX) | 0) * TEX * 4 + ((u * TEX) | 0) * 4;
      const s = shade[idx];

      const r = Math.min(255, tp[t4] * s);
      const gg = Math.min(255, tp[t4 + 1] * s);
      const bb = Math.min(255, tp[t4 + 2] * s);

      o[p4] = bp[p4] + (r - bp[p4]) * m;
      o[p4 + 1] = bp[p4 + 1] + (gg - bp[p4 + 1]) * m;
      o[p4 + 2] = bp[p4 + 2] + (bb - bp[p4 + 2]) * m;
      o[p4 + 3] = 255;
    }
  }
  return out;
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

/** Draw a texture into a TEX×TEX offscreen canvas and hand back its pixels. */
export function textureData(img) {
  const c = document.createElement('canvas');
  c.width = TEX; c.height = TEX;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, TEX, TEX);
  return ctx.getImageData(0, 0, TEX, TEX);
}
