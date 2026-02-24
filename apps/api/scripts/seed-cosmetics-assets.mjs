import sharp from 'sharp';
import { Client } from 'minio';

const endpoint = process.env.MINIO_ENDPOINT ?? 'localhost';
const port = Number(process.env.MINIO_PORT ?? 9000);
const useSSL = (process.env.MINIO_USE_SSL ?? 'false') === 'true';
const accessKey = process.env.MINIO_ACCESS_KEY ?? 'gratonite';
const secretKey = process.env.MINIO_SECRET_KEY ?? 'gratonite123';

const client = new Client({
  endPoint: endpoint,
  port,
  useSSL,
  accessKey,
  secretKey,
});

const bucket = 'avatars';

const nameplates = [
  ['nameplate_aurora.webp', '#3B82F6'],
  ['nameplate_sunburst.webp', '#F97316'],
  ['nameplate_cybergrid.webp', '#0EA5E9'],
  ['nameplate_forestglass.webp', '#10B981'],
];

const avatarDecorations = [
  ['avatar_decoration_aurora.webp', '#60A5FA'],
  ['avatar_decoration_sunburst.webp', '#FB923C'],
  ['avatar_decoration_cybergrid.webp', '#22D3EE'],
  ['avatar_decoration_forestglass.webp', '#34D399'],
];

const profileEffects = [
  ['profile_effect_aurora.webp', '#2563EB'],
  ['profile_effect_sunburst.webp', '#EA580C'],
  ['profile_effect_cybergrid.webp', '#0891B2'],
  ['profile_effect_forestglass.webp', '#059669'],
];

async function upload(key, buffer) {
  await client.putObject(bucket, `cosmetics/${key}`, buffer, buffer.length, {
    'Content-Type': 'image/webp',
  });
  console.log(`uploaded cosmetics/${key}`);
}

for (const [filename, color] of nameplates) {
  const image = await sharp({
    create: { width: 800, height: 220, channels: 4, background: color },
  })
    .webp({ quality: 90 })
    .toBuffer();
  await upload(filename, image);
}

for (const [filename, color] of avatarDecorations) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" rx="256" fill="none" stroke="${color}" stroke-width="42"/><rect x="28" y="28" width="456" height="456" rx="228" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="6"/></svg>`;
  const image = await sharp(Buffer.from(svg)).webp({ quality: 92 }).toBuffer();
  await upload(filename, image);
}

for (const [filename, color] of profileEffects) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="${color}" fill-opacity="0.32"/><circle cx="180" cy="120" r="140" fill="white" fill-opacity="0.14"/><circle cx="760" cy="420" r="220" fill="white" fill-opacity="0.10"/></svg>`;
  const image = await sharp(Buffer.from(svg)).webp({ quality: 90 }).toBuffer();
  await upload(filename, image);
}

console.log('Cosmetics placeholder assets seeded.');
