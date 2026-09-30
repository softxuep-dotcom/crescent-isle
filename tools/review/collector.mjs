import http from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc(bytes) {
  let n = -1;
  for (const b of bytes) n = crcTable[(n ^ b) & 255] ^ (n >>> 8);
  return (n ^ -1) >>> 0;
}
function chunk(type, data) {
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  output.write(type, 4, 'ascii');
  data.copy(output, 8);
  output.writeUInt32BE(crc(output.subarray(4, -4)), output.length - 4);
  return output;
}
export function rawTexturePNG(body, format = 'bgra8unorm') {
  if (body.length < 8) throw new Error('Missing width/height header');
  const width = body.readUInt32LE(0), height = body.readUInt32LE(4);
  if (!width || !height || body.length !== 8 + width * height * 4) throw new Error('Invalid texture dimensions');
  const scanlines = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    for (let x = 0; x < width; x++) {
      const source = 8 + (y * width + x) * 4, target = row + 1 + x * 4;
      const bgra = format.startsWith('bgra');
      scanlines[target] = body[source + (bgra ? 2 : 0)];
      scanlines[target + 1] = body[source + 1];
      scanlines[target + 2] = body[source + (bgra ? 0 : 2)];
      scanlines[target + 3] = body[source + 3];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(scanlines)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Receives the original project's Bench.shots() raw textures. No public listener.
export async function startCollector(outputDirectory) {
  const directory = resolve(outputDirectory);
  await mkdir(directory, { recursive: true });
  const received = [];
  let format = 'bgra8unorm';
  const server = http.createServer(async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (request.method === 'OPTIONS') { response.writeHead(204).end(); return; }
    const name = new URL(request.url, 'http://127.0.0.1').pathname.slice(1);
    if (request.method !== 'POST' || !/^[a-zA-Z0-9_-]+\.(bgra|json)$/.test(name)) {
      response.writeHead(400).end('Invalid review artifact'); return;
    }
    try {
      const parts = [];
      let size = 0;
      for await (const part of request) {
        size += part.length;
        if (size > 100 * 1024 * 1024) throw new Error('Artifact too large');
        parts.push(part);
      }
      const body = Buffer.concat(parts);
      if (name.endsWith('.bgra')) {
        const outputName = name.replace(/\.bgra$/, '.png');
        await writeFile(join(directory, outputName), rawTexturePNG(body, format));
        received.push({ name: outputName, width: body.readUInt32LE(0), height: body.readUInt32LE(4), format });
      } else {
        JSON.parse(body.toString('utf8'));
        await writeFile(join(directory, name), body);
        received.push({ name });
      }
      response.writeHead(201).end('Saved');
    } catch (error) {
      response.writeHead(400).end(error.message);
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}/`,
    received,
    setFormat(value) { format = value; },
    close: () => new Promise(resolve => server.close(resolve)),
  };
}
