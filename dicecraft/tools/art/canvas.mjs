// A very small raster canvas for drawing pixel art, and a PNG writer, with
// nothing to install: node's own zlib does the compression.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function hex(color) {
  if (!color || color === 'transparent') return [0, 0, 0, 0];
  let c = color.replace('#', '');
  if (c.length === 3) c = [...c].map((x) => x + x).join('');
  const n = parseInt(c.slice(0, 6), 16);
  const a = c.length === 8 ? parseInt(c.slice(6, 8), 16) : 255;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}

export function shade(color, k) {
  const [r, g, b, a] = hex(color);
  const f = (v) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return `#${[f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}${a < 255 ? a.toString(16).padStart(2, '0') : ''}`;
}

export function mix(a, b, t) {
  const x = hex(a);
  const y = hex(b);
  const m = (i) => Math.round(x[i] + (y[i] - x[i]) * t);
  return `#${[m(0), m(1), m(2)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// A seeded generator, so every run of the tool draws the same pictures.
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return [0, 0, 0, 0];
    const i = (y * this.w + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  // Alpha-blended over what is there.
  px(x, y, color) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const [r, g, b, a] = Array.isArray(color) ? color : hex(color);
    if (!a) return;
    const i = (y * this.w + x) * 4;
    const d = this.data;
    const sa = a / 255;
    const da = d[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    if (!oa) return;
    d[i] = (r * sa + d[i] * da * (1 - sa)) / oa;
    d[i + 1] = (g * sa + d[i + 1] * da * (1 - sa)) / oa;
    d[i + 2] = (b * sa + d[i + 2] * da * (1 - sa)) / oa;
    d[i + 3] = oa * 255;
  }

  rect(x, y, w, h, color) {
    for (let j = Math.max(0, Math.floor(y)); j < Math.min(this.h, Math.ceil(y + h)); j++) {
      for (let i = Math.max(0, Math.floor(x)); i < Math.min(this.w, Math.ceil(x + w)); i++) this.px(i, j, color);
    }
  }

  clear(x, y, w, h) {
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        if (i < 0 || j < 0 || i >= this.w || j >= this.h) continue;
        this.data.fill(0, (j * this.w + i) * 4, (j * this.w + i) * 4 + 4);
      }
    }
  }

  ellipse(cx, cy, rx, ry, color) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.px(x, y, color);
      }
    }
  }

  // A grid of characters, one per pixel, `scale` screen pixels each.
  sprite(rows, palette, x, y, scale = 1) {
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
      const c = palette[ch];
      if (c) this.rect(x + i * scale, y + j * scale, scale, scale, c);
    }));
  }

  // A texture (a function of integer texel coordinates) mapped onto a
  // parallelogram: `o` is the corner texel (0,0) lands on, `u` and `v` are the
  // screen vectors one whole texture width and height span.
  quad(tex, tw, th, o, u, v) {
    const det = u[0] * v[1] - u[1] * v[0];
    if (!det) return;
    const xs = [o[0], o[0] + u[0], o[0] + v[0], o[0] + u[0] + v[0]];
    const ys = [o[1], o[1] + u[1], o[1] + v[1], o[1] + u[1] + v[1]];
    for (let y = Math.floor(Math.min(...ys)); y < Math.ceil(Math.max(...ys)); y++) {
      for (let x = Math.floor(Math.min(...xs)); x < Math.ceil(Math.max(...xs)); x++) {
        const px = x + 0.5 - o[0];
        const py = y + 0.5 - o[1];
        const a = (px * v[1] - py * v[0]) / det;
        const b = (u[0] * py - u[1] * px) / det;
        if (a < 0 || b < 0 || a >= 1 || b >= 1) continue;
        const c = tex(Math.floor(a * tw), Math.floor(b * th));
        if (c) this.px(x, y, c);
      }
    }
  }

  draw(other, x, y) {
    for (let j = 0; j < other.h; j++) {
      for (let i = 0; i < other.w; i++) {
        const c = other.get(i, j);
        if (c[3]) this.px(x + i, y + j, c);
      }
    }
  }

  // Nearest-neighbour scale, which is the only honest way to enlarge pixels.
  scaled(k) {
    const out = new Canvas(Math.round(this.w * k), Math.round(this.h * k));
    for (let y = 0; y < out.h; y++) {
      for (let x = 0; x < out.w; x++) {
        const c = this.get(Math.floor(x / k), Math.floor(y / k));
        const i = (y * out.w + x) * 4;
        out.data[i] = c[0]; out.data[i + 1] = c[1]; out.data[i + 2] = c[2]; out.data[i + 3] = c[3];
      }
    }
    return out;
  }

  rotated(quarters) {
    const q = ((quarters % 4) + 4) % 4;
    if (!q) return this;
    const out = new Canvas(q % 2 ? this.h : this.w, q % 2 ? this.w : this.h);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const [nx, ny] = q === 1 ? [this.h - 1 - y, x] : q === 2 ? [this.w - 1 - x, this.h - 1 - y] : [y, this.w - 1 - x];
        const i = (y * this.w + x) * 4;
        const o = (ny * out.w + nx) * 4;
        for (let k = 0; k < 4; k++) out.data[o + k] = this.data[i + k];
      }
    }
    return out;
  }

  // A dark rim one pixel wide round everything opaque, the way item icons
  // and mob heads are outlined.
  outlined(color = '#000000c0') {
    const out = new Canvas(this.w, this.h);
    out.data.set(this.data);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)[3]) continue;
        const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.get(x + dx, y + dy)[3] > 128);
        if (near) out.px(x, y, color);
      }
    }
    return out;
  }

  bbox() {
    let x0 = this.w; let y0 = this.h; let x1 = -1; let y1 = -1;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)[3]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      }
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  crop(x, y, w, h) {
    const out = new Canvas(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out.px(i, j, this.get(x + i, y + j));
    return out;
  }

  png() {
    const raw = Buffer.alloc((this.w * 4 + 1) * this.h);
    for (let y = 0; y < this.h; y++) {
      raw[y * (this.w * 4 + 1)] = 0;
      Buffer.from(this.data.buffer, y * this.w * 4, this.w * 4).copy(raw, y * (this.w * 4 + 1) + 1);
    }
    const chunk = (type, body) => {
      const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
      const tb = Buffer.concat([Buffer.from(type), body]);
      const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(tb));
      return Buffer.concat([len, tb, crc]);
    };
    const head = Buffer.alloc(13);
    head.writeUInt32BE(this.w, 0); head.writeUInt32BE(this.h, 4);
    head[8] = 8; head[9] = 6; head[10] = 0; head[11] = 0; head[12] = 0;
    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', head),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }

  save(path) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, this.png());
  }
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
