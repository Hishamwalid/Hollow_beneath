import { inflateSync } from 'zlib';

export function decodePNG(buf) {
  if (buf.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Not a PNG');
  let pos = 8, width = 0, height = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.slice(pos + 4, pos + 8).toString('ascii');
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const all = inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = width * bpp;
  const out = Buffer.alloc(stride * height);
  let ip = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = all[ip++];
    const cur = Buffer.from(all.slice(ip, ip + stride)); ip += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b2 = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = cur[x];
      if (filter === 1) v = (v + a) & 255;
      else if (filter === 2) v = (v + b2) & 255;
      else if (filter === 3) v = (v + ((a + b2) >> 1)) & 255;
      else if (filter === 4) { const p = a + b2 - c; const pa = Math.abs(p - a), pb = Math.abs(p - b2), pc = Math.abs(p - c); v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b2 : c)) & 255; }
      cur[x] = v;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return { width, height, data: out };
}

export function samplePNG(img, cx, cy, r, step) {
  const { width, height, data } = img;
  let count = 0, nonBg = 0, min = [255, 255, 255], max = [0, 0, 0], sum = [0, 0, 0];
  for (let dx = -r; dx <= r; dx += step) {
    for (let dy = -r; dy <= r; dy += step) {
      const x = Math.round(cx + dx), y = Math.round(cy + dy);
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const idx = (y * width + x) * 4;
      const r2 = data[idx], g = data[idx + 1], b = data[idx + 2];
      count++;
      const lum = 0.2126 * r2 + 0.7152 * g + 0.0722 * b;
      if (lum > 30) nonBg++;
      sum[0] += r2; sum[1] += g; sum[2] += b;
    }
  }
  return { count, nonBg, avg: count ? [Math.round(sum[0]/count), Math.round(sum[1]/count), Math.round(sum[2]/count)] : null };
}