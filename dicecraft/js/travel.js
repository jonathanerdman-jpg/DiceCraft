// A character written down small enough to carry by hand.
//
// The store a published page is granted covers the common case — the same
// person, signed in, on another device — but not a character sent to a friend,
// moved to a copy of the game running somewhere else, or kept as a backup
// against a cleared browser. For that the save becomes one line of text:
// gzipped where the browser can (every current one), base64 either way, with a
// prefix saying which.
const PLAIN = 'DICE1.';
const PACKED = 'DICE1z.';

const B64 = (bytes) => {
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const UNB64 = (text) => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

async function squeeze(bytes, format) {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream(format));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

async function unsqueeze(bytes, format) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function toCode(json) {
  const bytes = new TextEncoder().encode(json);
  const packed = await squeeze(bytes, 'gzip');
  return packed && packed.length < bytes.length
    ? PACKED + B64(packed)
    : PLAIN + B64(bytes);
}

// Gives back the save, or throws something a player can read.
export async function fromCode(code) {
  const text = String(code || '').trim().replace(/\s+/g, '');
  if (!text) throw new Error('paste a character code first');
  const packed = text.startsWith(PACKED);
  if (!packed && !text.startsWith(PLAIN)) throw new Error('that does not look like a character code');
  const body = text.slice(packed ? PACKED.length : PLAIN.length);
  let bytes;
  try {
    bytes = UNB64(body);
    if (packed) bytes = await unsqueeze(bytes, 'gzip');
  } catch {
    throw new Error('that code is damaged — copy the whole line and try again');
  }
  const json = new TextDecoder().decode(bytes);
  try {
    const data = JSON.parse(json);
    if (!data || data.version !== 2) throw new Error('version');
  } catch {
    throw new Error('that code is not a character from this game');
  }
  return json;
}
