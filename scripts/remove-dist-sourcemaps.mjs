import fs from 'node:fs';
import path from 'node:path';

const outputRoot = path.resolve(process.cwd(), 'dist');

function removeSourcemaps(dir) {
  if (!fs.existsSync(dir)) {
    return 0;
  }

  let removedCount = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removedCount += removeSourcemaps(entryPath);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.map')) {
      fs.unlinkSync(entryPath);
      removedCount += 1;
    }
  }
  return removedCount;
}

const removedCount = removeSourcemaps(outputRoot);
console.log(`Removed ${removedCount} sourcemap file(s) from dist.`);
