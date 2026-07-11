import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseImageDataUrl,
  parseMultipartFormData,
  sha256Hex,
  signWorkerPayload,
  verifyWorkerSignature,
} from '../cloudfunctions/shared/ai-image-worker-core.ts';

test('worker job signatures use task id, timestamp, nonce and body hash', () => {
  const rawBody = JSON.stringify({ taskId: 'run_1', type: 'workflow.old_photo_restore' });
  const signature = signWorkerPayload({
    secret: 'secret',
    taskId: 'run_1',
    timestamp: '1773072000000',
    nonce: 'nonce',
    rawBody,
  });

  assert.equal(
    verifyWorkerSignature({
      secret: 'secret',
      taskId: 'run_1',
      timestamp: '1773072000000',
      nonce: 'nonce',
      bodyHash: sha256Hex(rawBody),
      signature,
      now: 1773072000000,
    }),
    true,
  );
  assert.equal(
    verifyWorkerSignature({
      secret: 'wrong',
      taskId: 'run_1',
      timestamp: '1773072000000',
      nonce: 'nonce',
      bodyHash: sha256Hex(rawBody),
      signature,
      now: 1773072000000,
    }),
    false,
  );
});

test('image data url parser accepts supported image formats', () => {
  const parsed = parseImageDataUrl(`data:image/png;base64,${Buffer.from('image').toString('base64')}`);

  assert.equal(parsed?.mimeType, 'image/png');
  assert.equal(parsed?.extension, 'png');
  assert.equal(parsed?.buffer.toString(), 'image');
});

test('multipart parser extracts callback fields and result file', () => {
  const boundary = 'test-boundary';
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="taskId"',
    '',
    'run_1',
    `--${boundary}`,
    'Content-Disposition: form-data; name="status"',
    '',
    'success',
    `--${boundary}`,
    'Content-Disposition: form-data; name="resultFile"; filename="result.jpg"',
    'Content-Type: image/jpeg',
    '',
    'JPEGDATA',
    `--${boundary}--`,
    '',
  ].join('\r\n');

  const parsed = parseMultipartFormData(Buffer.from(body, 'binary'), `multipart/form-data; boundary=${boundary}`);

  assert.equal(parsed.fields.taskId, 'run_1');
  assert.equal(parsed.fields.status, 'success');
  assert.equal(parsed.files.resultFile.filename, 'result.jpg');
  assert.equal(parsed.files.resultFile.contentType, 'image/jpeg');
  assert.equal(parsed.files.resultFile.buffer.toString(), 'JPEGDATA');
});
