const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');

const FileService = require('../src/services/fileService');

const MAX_NARROW = 80;

// Minimal fake db: only the surface processFiles/processSingleFile touches.
function fakeDb() {
  return {
    sequelize: { literal: (expr) => ({ __literal: expr }) },
    files: {
      findOne: async () => null,
      create: async (record) => ({
        ...record,
        toJSON() {
          return { ...record };
        },
      }),
    },
  };
}

async function writePng(filePath, width, height) {
  await sharp({
    create: { width, height, channels: 3, background: { r: 12, g: 34, b: 56 } },
  })
    .png()
    .toFile(filePath);
}

// Builds a real FileService pointed at a tmp destPath, plus a multer-shaped
// `file`. The destination mirrors what progressAwareUploader produces —
// `destPath + '/tmp/uploadedFiles' + getHashDir()` — including the trailing
// slash that cleanUploadDir()'s regex relies on.
async function setup(t, { name = 'tall.png', width = 100, height = 400, bytes } = {}) {
  const destPath = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-dest-'));
  t.after(() => fs.rm(destPath, { recursive: true, force: true }));

  const destination = `${destPath}/tmp/uploadedFiles/99/99/`;
  await fs.mkdir(destination, { recursive: true });

  const srcPath = `${destination}${name}`;
  if (bytes !== undefined) {
    await fs.writeFile(srcPath, bytes);
  } else {
    await writePng(srcPath, width, height);
  }

  const file = { path: srcPath, destination, originalname: name, filename: name };
  const service = new FileService({
    destPath,
    maxImageNarrowSide: MAX_NARROW,
    imgServer: 'https://example.com',
  });

  return { destPath, file, service, db: fakeDb() };
}

function outputLocation(destPath, record) {
  return path.join(destPath, record.path, record.md5 + record.fileExt);
}

test('resolveMaxNarrowSide coerces a numeric string and falls back on invalid input', () => {
  const service = new FileService({ maxImageNarrowSide: MAX_NARROW });
  assert.equal(service.resolveMaxNarrowSide('40'), 40);
  assert.equal(service.resolveMaxNarrowSide(40), 40);
  assert.equal(service.resolveMaxNarrowSide('80'), 80);
  // Invalid / empty / missing → configured default.
  for (const invalid of ['abc', '0', '-5', '40.5', '', undefined, null, NaN]) {
    assert.equal(service.resolveMaxNarrowSide(invalid), MAX_NARROW, `value: ${String(invalid)}`);
  }
});

test('processFiles resizes an image whose narrow side exceeds the configured max', async (t) => {
  const { destPath, file, service, db } = await setup(t, { width: 100, height: 400 });
  // Source narrow side is 100 (> MAX_NARROW 80).
  const [record] = await service.processFiles([file], db);
  const out = outputLocation(destPath, record);

  const meta = await sharp(out).metadata();
  assert.equal(meta.width, 80); // narrowed from 100, ratio preserved → 80x320
  assert.equal(meta.height, 320);
});

test('processFiles applies a numeric-string maxNarrowSide override (the regression)', async (t) => {
  // Before the fix, the string "40" crashed sharp inside resize() and the
  // catch silently copied the untouched 100x400 source. After the fix it
  // produces a 40-wide image.
  const { destPath, file, service, db } = await setup(t, { width: 100, height: 400 });
  const [record] = await service.processFiles([file], db, '40');
  const out = outputLocation(destPath, record);

  const meta = await sharp(out).metadata();
  assert.equal(meta.width, 40);
  assert.equal(meta.height, 160);
});

test('processFiles falls back to the configured default on an invalid override', async (t) => {
  for (const override of ['abc', '0', '-5', '40.5']) {
    const { destPath, file, service, db } = await setup(t, { width: 100, height: 400 });
    const [record] = await service.processFiles([file], db, override);
    const meta = await sharp(outputLocation(destPath, record)).metadata();
    // Default 80 applies (source narrow side 100 > 80) — proving the invalid
    // override was ignored rather than crashing or skipping resize.
    assert.equal(meta.width, 80, `override: ${override}`);
  }
});

test('processFiles surfaces a HEIC processing failure and writes no renamed output', async (t) => {
  const bytes = Buffer.from('definitely not a real heic file', 'utf8');
  const { destPath, file, service, db } = await setup(t, {
    name: 'broken.heic',
    width: 100,
    height: 100,
    bytes,
  });

  // processNewFile rewrites the extension to .jpg before calling
  // processImageFile; a failed HEIC decode must propagate rather than move the
  // raw bytes onto the .jpg path.
  await assert.rejects(service.processFiles([file], db, '100'));

  // No .jpg may exist anywhere under destPath — the renamed output path was
  // never written, so no corrupt HEIC-as-.jpg file is produced.
  async function findJpgs(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const found = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        found.push(...(await findJpgs(full)));
      } else if (entry.name.endsWith('.jpg')) {
        found.push(full);
      }
    }
    return found;
  }
  const jpgs = await findJpgs(destPath);
  assert.deepEqual(jpgs, []);
});
