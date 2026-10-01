// A character as a square you can point a camera at.
//
// The code is already one line of text; this is the same line in a form the
// other device can read across the table. Drawn as SVG rather than a canvas so
// it stays crisp at any size and needs nothing but the page it sits in.
import qrcode from './vendor/qrcode.js';

// Four modules of paper round the outside, which the standard asks for and
// cameras rely on.
const QUIET = 4;

// The lowest error correction: a save is long, and a code on a screen is not
// being read off a crumpled parcel. More correction here would only make the
// squares smaller and harder to scan.
const LEVEL = 'L';

export function qrSvg(text, { size = 240, ink = '#2b2011', paper = '#f0e4c6' } = {}) {
  const code = qrcode(0, LEVEL);
  code.addData(String(text));
  code.make();

  const count = code.getModuleCount();
  const side = count + QUIET * 2;

  // Runs of dark modules along each row, so a symbol is a few hundred
  // rectangles rather than a few thousand.
  let path = '';
  for (let row = 0; row < count; row++) {
    let from = -1;
    for (let col = 0; col <= count; col++) {
      const dark = col < count && code.isDark(row, col);
      if (dark && from < 0) from = col;
      if (!dark && from >= 0) {
        path += `M${from + QUIET} ${row + QUIET}h${col - from}v1h-${col - from}z`;
        from = -1;
      }
    }
  }

  return `<svg class="qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}"
    width="${size}" height="${size}" role="img" aria-label="This character as a scannable code"
    shape-rendering="crispEdges">
    <rect width="${side}" height="${side}" fill="${paper}"/>
    <path d="${path}" fill="${ink}"/>
  </svg>`;
}

// What the square should carry. A link is worth more than the bare code — the
// other device opens the game with the character already in hand — but only
// when this page knows an address that will work somewhere else. Inside a
// frame it does not, so there it carries the code itself.
export function shareTarget(code, scope = globalThis) {
  try {
    const { location, top, self } = scope;
    if (!location || !location.href || top !== self) return code;
    if (!/^https?:$/.test(location.protocol)) return code;
    const base = location.href.split('#')[0].split('?')[0];
    return `${base}#code=${code}`;
  } catch {
    return code;
  }
}

// A character arriving by link: the code sits in the address after #code=.
export function readCode(scope = globalThis) {
  try {
    const hash = (scope.location && scope.location.hash) || '';
    const match = /^#code=(.+)$/.exec(hash);
    return match ? decodeURIComponent(match[1]) : '';
  } catch {
    return '';
  }
}

// Read once, as the page loads, and remembered. The address is a busy place —
// the game itself rewrites it to name the character being played — so waiting
// to look is how an arrival gets lost.
const ARRIVED = readCode();

export function codeFromAddress() {
  return ARRIVED;
}
