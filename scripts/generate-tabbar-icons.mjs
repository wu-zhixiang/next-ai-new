import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const outputDirectory = resolve('src/assets/tabbar');
const inactiveColor = '#7A7A7A';
const activeColor = '#D97757';
const normalizeExisting = process.argv.includes('--normalize-existing');
const updateNewsAndMember = process.argv.includes('--update-news-member');

const icons = {
  news: `
    <path d="M49 42H113 M49 81H113 M49 120H113" />
    <circle cx="38" cy="42" r="11" />
    <circle cx="124" cy="42" r="11" />
    <circle cx="38" cy="81" r="11" />
    <circle cx="124" cy="81" r="11" />
    <circle cx="38" cy="120" r="11" />
    <circle cx="124" cy="120" r="11" />
  `,
  tools: `
    <path d="M81 27C86 63 99 76 135 81C99 86 86 99 81 135C76 99 63 86 27 81C63 76 76 63 81 27Z" />
  `,
  records: `
    <path d="M45 102H69C81 102 81 60 93 60H117" />
    <circle cx="34" cy="102" r="11" />
    <circle cx="128" cy="60" r="11" />
  `,
  invite: `
    <path d="M81 94V77L49 55 M81 77L113 55" />
    <circle cx="81" cy="111" r="13" />
    <circle cx="39" cy="42" r="13" />
    <circle cx="123" cy="42" r="13" />
  `,
  member: `
    <g transform="rotate(180 81 81)">
      <circle cx="81" cy="81" r="53" />
      <circle cx="81" cy="94" r="16" stroke-width="6" />
      <path d="M52 52C59 75 103 75 110 52" stroke-width="6" />
    </g>
  `,
};

const iconBounds = {
  news: '45:61:21:13',
  tools: '63:63:12:12',
  records: '67:39:10:24',
  invite: '64:56:12:13',
  member: '62:62:13:13',
};

function createSvg(content, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="162" height="162" viewBox="0 0 162 162">
    <g fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
      ${content}
    </g>
  </svg>`;
}

function normalizePng(inputPath, outputPath, bounds) {
  const result = spawnSync('ffmpeg', [
    '-loglevel', 'error',
    '-y',
    '-i', inputPath,
    '-vf', [
      'colorkey=0xFFFFFF:0.08:0.05',
      `crop=${bounds}`,
      'scale=132:132:force_original_aspect_ratio=decrease',
      'pad=162:162:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
      'format=rgba',
    ].join(','),
    '-frames:v', '1',
    outputPath,
  ], { encoding: 'utf8' });

  if (result.status !== 0) {
    throw new Error(result.stderr || `规范化 ${outputPath} 失败`);
  }
}

function parseHexColor(value) {
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
}

function distanceToSegment(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

async function renderNewsPng(color, outputPath, temporaryDirectory) {
  const supersampling = 4;
  const size = 162 * supersampling;
  const strokeRadius = 3.5;
  const [red, green, blue] = parseHexColor(color);
  const pixels = Buffer.alloc(size * size * 4);
  const rows = [42, 81, 120];

  for (let pixelY = 0; pixelY < size; pixelY += 1) {
    const y = (pixelY + 0.5) / supersampling;
    for (let pixelX = 0; pixelX < size; pixelX += 1) {
      const x = (pixelX + 0.5) / supersampling;
      const covered = rows.some((rowY) => (
        distanceToSegment(x, y, 49, rowY, 113, rowY) <= strokeRadius
        || Math.abs(Math.hypot(x - 38, y - rowY) - 11) <= strokeRadius
        || Math.abs(Math.hypot(x - 124, y - rowY) - 11) <= strokeRadius
      ));

      if (!covered) continue;
      const offset = (pixelY * size + pixelX) * 4;
      pixels[offset] = red;
      pixels[offset + 1] = green;
      pixels[offset + 2] = blue;
      pixels[offset + 3] = 255;
    }
  }

  const rawPath = join(temporaryDirectory, `news-${color.slice(1)}.rgba`);
  await writeFile(rawPath, pixels);
  const result = spawnSync('ffmpeg', [
    '-loglevel', 'error',
    '-y',
    '-f', 'rawvideo',
    '-pixel_format', 'rgba',
    '-video_size', `${size}x${size}`,
    '-i', rawPath,
    '-vf', 'scale=162:162:flags=lanczos,format=rgba',
    '-frames:v', '1',
    outputPath,
  ], { encoding: 'utf8' });

  if (result.status !== 0) {
    throw new Error(result.stderr || `生成 ${outputPath} 失败`);
  }
}

function rotatePng180(inputPath, outputPath) {
  const result = spawnSync('ffmpeg', [
    '-loglevel', 'error',
    '-y',
    '-i', inputPath,
    '-vf', 'hflip,vflip',
    '-frames:v', '1',
    outputPath,
  ], { encoding: 'utf8' });

  if (result.status !== 0) {
    throw new Error(result.stderr || `旋转 ${inputPath} 失败`);
  }
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'gpt-pay-tabbar-'));

try {
  if (updateNewsAndMember) {
    await renderNewsPng(inactiveColor, join(outputDirectory, 'news.png'), temporaryDirectory);
    await renderNewsPng(activeColor, join(outputDirectory, 'news-active.png'), temporaryDirectory);

    for (const fileName of ['member.png', 'member-active.png']) {
      const originalPath = join(outputDirectory, fileName);
      const rotatedPath = join(temporaryDirectory, fileName);
      rotatePng180(originalPath, rotatedPath);
      await copyFile(rotatedPath, originalPath);
    }
    console.log('Updated news and member tab bar icons.');
  } else for (const [name, content] of Object.entries(icons)) {
    for (const [suffix, color] of [['', inactiveColor], ['-active', activeColor]]) {
      const pngPath = join(outputDirectory, `${name}${suffix}.png`);
      const normalizedPath = join(temporaryDirectory, `${name}${suffix}.png`);

      if (normalizeExisting) {
        normalizePng(pngPath, normalizedPath, iconBounds[name]);
        await copyFile(normalizedPath, pngPath);
        continue;
      }

      const svgPath = join(temporaryDirectory, `${name}${suffix}.svg`);
      await writeFile(svgPath, createSvg(content, color), 'utf8');

      const result = spawnSync('qlmanage', [
        '-t',
        '-s', '162',
        '-o', temporaryDirectory,
        svgPath,
      ], { encoding: 'utf8' });

      if (result.status !== 0) {
        throw new Error(result.stderr || `生成 ${name}${suffix}.png 失败`);
      }

      normalizePng(`${svgPath}.png`, pngPath, iconBounds[name]);
    }
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

if (!updateNewsAndMember) {
  console.log(`Generated ${Object.keys(icons).length * 2} tab bar icons.`);
}
