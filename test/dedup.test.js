const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const FileService = require('../src/services/fileService');

// A fake db whose findOne returns an already-stored record, so processSingleFile
// takes the dedup branch. create/update are recorded so the test can assert the
// new-row path was NOT taken and the RefCount + 1 literal WAS issued. literal()
// mirrors the real Sequelize seam used by updateExistingFile.
function dedupDb(existing) {
  const calls = { create: [], update: [] };
  const db = {
    sequelize: { literal: (expr) => ({ __literal: expr }) },
    files: {
      findOne: async () => existing,
      create: async (record) => {
        calls.create.push(record);
        return record;
      },
      update: async (values, options) => {
        calls.update.push({ values, options });
        return [1];
      },
    },
  };
  return { db, calls };
}

// Builds a real FileService plus a multer-shaped file backed by real bytes on
// disk (calculateFileHash reads file.path) sitting in a real temp upload dir
// (cleanUploadDir removes file.destination and its numeric parent), so the temp
// cleanup assertion exercises the real filesystem rather than a mock.
async function setup(t) {
  const destPath = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-dedup-'));
  t.after(() => fs.rm(destPath, { recursive: true, force: true }));

  const destination = `${destPath}/tmp/uploadedFiles/99/99/`;
  await fs.mkdir(destination, { recursive: true });
  const srcPath = `${destination}new-upload.png`;
  await fs.writeFile(srcPath, Buffer.from('identical content bytes'));
  const { size } = await fs.stat(srcPath);

  const file = {
    path: srcPath,
    destination,
    originalname: 'new-upload.png',
    filename: 'new-upload.png',
    size,
  };
  const service = new FileService({
    destPath,
    maxImageNarrowSide: 1600,
    imgServer: 'https://example.com',
  });
  return { destPath, destination, file, service };
}

// The stored record the "existing" MD5 maps to. Its own md5/path/fileExt are
// deliberately different from the new upload so the returned URL can be proven
// to come from THIS record, not the fresh upload. toJSON mirrors Sequelize and
// reflects the in-place mutations updateExistingFile applies.
function existingRecord() {
  return {
    id: 42,
    path: '/12/34/',
    md5: 'existingmd5hash',
    fileExt: '.png',
    refCount: 3,
    fileName: 'old-name.png',
    updatedAt: null,
    toJSON() {
      return {
        id: this.id,
        path: this.path,
        md5: this.md5,
        fileExt: this.fileExt,
        refCount: this.refCount,
        fileName: this.fileName,
        updatedAt: this.updatedAt,
      };
    },
  };
}

test('dedup: a duplicate MD5 bumps RefCount and creates no new row', async (t) => {
  const { file, service } = await setup(t);
  const { db, calls } = dedupDb(existingRecord());

  await service.processFiles([file], db);

  // New-file branch must NOT run.
  assert.equal(calls.create.length, 0, 'create must not be called on the dedup path');

  // updateExistingFile must issue exactly one RefCount + 1 update scoped to the id.
  assert.equal(calls.update.length, 1, 'update must be called exactly once');
  const { values, options } = calls.update[0];
  assert.deepEqual(values.refCount, { __literal: 'RefCount + 1' });
  assert.equal(values.fileName, 'new-upload.png', 'fileName refreshed to the new upload name');
  assert.equal(typeof values.updatedAt, 'number');
  assert.deepEqual(options.where, { id: 42 });
});

test('dedup: returns the EXISTING record URL with the new upload metadata', async (t) => {
  const { file, service } = await setup(t);
  const { db } = dedupDb(existingRecord());

  const [record] = await service.processFiles([file], db);

  // URL derives from the existing record (its path/md5/fileExt), not the upload.
  assert.equal(record.url, 'https://example.com/320/12/34/existingmd5hash.png');
  // Client-facing aliases come from the new upload.
  assert.equal(record.originalName, 'new-upload.png');
  assert.equal(record.fileSize, file.size);
  // Persisted name was refreshed to the new upload's name.
  assert.equal(record.fileName, 'new-upload.png');
  assert.equal(record.refCount, 4, 'local refCount reflects the increment');
});

test('dedup: cleans the temp upload dir', async (t) => {
  const { destination, file, service } = await setup(t);
  const { db } = dedupDb(existingRecord());

  await service.processFiles([file], db);

  // cleanUploadDir removes file.destination (and its numeric parent); the temp
  // upload must be gone on the dedup path just as on the new-file path.
  await assert.rejects(fs.stat(destination), /ENOENT/);
});
