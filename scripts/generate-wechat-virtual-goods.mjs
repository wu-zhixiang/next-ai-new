import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const planSeedPath = path.join(projectRoot, 'cloudfunctions', 'shared', 'plan-seed.ts');
const productTypeSeedPath = path.join(projectRoot, 'cloudfunctions', 'shared', 'product-type-seed.ts');
const outputDir = path.join(projectRoot, 'exports');
const imageUrlOverride = process.argv[2] || '';
const fallbackImageUrl = '请替换为HTTPS图片URL';

function extractArraySource(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error(`未找到 ${marker}`);
  }
  const equalsIndex = source.indexOf('=', markerIndex);
  if (equalsIndex < 0) {
    throw new Error(`未找到 ${marker} 赋值位置`);
  }
  const arrayStart = source.indexOf('[', equalsIndex);
  if (arrayStart < 0) {
    throw new Error(`未找到 ${marker} 数组开始位置`);
  }

  let depth = 0;
  for (let index = arrayStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '[') depth += 1;
    if (char === ']') depth -= 1;
    if (depth === 0) {
      return source.slice(arrayStart + 1, index);
    }
  }
  throw new Error(`未找到 ${marker} 数组结束位置`);
}

function extractPlanBlocks(arrayBody) {
  const blocks = [];
  let start = -1;
  let depth = 0;
  for (let index = 0; index < arrayBody.length; index += 1) {
    const char = arrayBody[index];
    if (char === '{') {
      if (depth === 0) start = index;
      depth += 1;
    }
    if (char === '}') {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        blocks.push(arrayBody.slice(start, index + 1));
        start = -1;
      }
    }
  }
  return blocks;
}

function readStringProperty(block, key) {
  const matched = block.match(new RegExp(`${key}:\\s*'([^']*)'`));
  return matched?.[1] || '';
}

function readTokenProperty(block, key) {
  const matched = block.match(new RegExp(`${key}:\\s*([^,\\n]+)`));
  return matched?.[1]?.trim() || '';
}

function readNumberProperty(block, key) {
  const matched = block.match(new RegExp(`${key}:\\s*([0-9]+(?:\\.[0-9]+)?)`));
  return matched ? Number(matched[1]) : 0;
}

function readStringConstants(source) {
  const constants = {};
  const pattern = /const\s+([A-Z0-9_]+)\s*=\s*'([^']*)';/g;
  let matched = pattern.exec(source);
  while (matched) {
    constants[matched[1]] = matched[2];
    matched = pattern.exec(source);
  }
  return constants;
}

function normalizeGoodsName(planName) {
  if (planName === 'ChatGPT Plus 季度会员') return 'GPT季度';
  if (planName === 'ChatGPT Plus') return 'GPT Plus';
  return planName.slice(0, 10);
}

function readPlans() {
  const source = fs.readFileSync(planSeedPath, 'utf8');
  const arrayBody = extractArraySource(source, 'const PLAN_SEED_SOURCE');
  return extractPlanBlocks(arrayBody)
    .map((block) => {
      const productCode = readStringProperty(block, 'productCode') || (block.includes('DEFAULT_PRODUCT_CODE') ? 'ai_news' : '');
      return {
        productCode,
        goodsId: readStringProperty(block, 'virtualPaymentProductId'),
        goodsName: normalizeGoodsName(readStringProperty(block, 'planName')),
        price: readNumberProperty(block, 'price'),
        remark: readStringProperty(block, 'description'),
      };
    })
    .filter((plan) => plan.goodsId && plan.goodsName && plan.price > 0);
}

function readProductAvatars() {
  const source = fs.readFileSync(productTypeSeedPath, 'utf8');
  const constants = readStringConstants(source);
  const arrayBody = extractArraySource(source, 'export const PRODUCT_TYPE_SEED');
  const avatars = {};
  for (const block of extractPlanBlocks(arrayBody)) {
    const productCode = readStringProperty(block, 'productCode') || (block.includes('DEFAULT_PRODUCT_CODE') ? 'ai_news' : '');
    const avatarToken = readTokenProperty(block, 'avatarUrl');
    const avatarUrl = avatarToken.startsWith("'")
      ? avatarToken.slice(1, -1)
      : constants[avatarToken] || '';
    if (productCode && avatarUrl) {
      avatars[productCode] = avatarUrl;
    }
  }
  return avatars;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(index) {
  let name = '';
  let current = index + 1;
  while (current > 0) {
    const mod = (current - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    current = Math.floor((current - mod) / 26);
  }
  return name;
}

function buildWorksheet(rows) {
  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, colIndex) => {
      const ref = `${columnName(colIndex)}${rowIndex + 1}`;
      if (typeof value === 'number') {
        return `<c r="${ref}"><v>${value}</v></c>`;
      }
      return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:E${rows.length}"/>
  <cols>
    <col min="1" max="1" width="28" customWidth="1"/>
    <col min="2" max="2" width="18" customWidth="1"/>
    <col min="3" max="3" width="36" customWidth="1"/>
    <col min="4" max="4" width="12" customWidth="1"/>
    <col min="5" max="5" width="34" customWidth="1"/>
  </cols>
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;
}

async function writeXlsx(rows, targetPath) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`);
  zip.folder('_rels').file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  zip.folder('xl').file('workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="虚拟商品" sheetId="1" r:id="rId1"/></sheets>
</workbook>`);
  zip.folder('xl').folder('_rels').file('workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`);
  zip.folder('xl').folder('worksheets').file('sheet1.xml', buildWorksheet(rows));
  fs.writeFileSync(targetPath, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
}

function writeCsv(rows, targetPath) {
  const csv = rows
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  fs.writeFileSync(targetPath, `\ufeff${csv}`);
}

const plans = readPlans();
const productAvatars = readProductAvatars();
const rows = [
  ['道具id', '道具名称', '道具图片', '道具价格', '备注'],
  ...plans.map((plan) => [
    plan.goodsId,
    plan.goodsName,
    imageUrlOverride || productAvatars[plan.productCode] || fallbackImageUrl,
    plan.price,
    plan.remark,
  ]),
];

fs.mkdirSync(outputDir, { recursive: true });
const xlsxPath = path.join(outputDir, 'wechat-virtual-goods.xlsx');
const csvPath = path.join(outputDir, 'wechat-virtual-goods.csv');
await writeXlsx(rows, xlsxPath);
writeCsv(rows, csvPath);

console.log(JSON.stringify({ xlsxPath, csvPath, goodsCount: plans.length }, null, 2));
