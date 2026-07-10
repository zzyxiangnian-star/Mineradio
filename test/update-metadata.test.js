const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeUpdateInfoForClient,
} = require('../src/desktop/updateMetadata');

test('marks 1.4.0 available for 1.3.x clients', () => {
  const info = normalizeUpdateInfoForClient({
    configured: true,
    latestVersion: '1.4.0',
    release: { downloadUrl: 'https://example.test/Mineradio-Setup-1.4.0.exe' },
    asset: { name: 'Mineradio-Setup-1.4.0.exe' },
  }, '1.3.5');

  assert.equal(info.updateAvailable, true);
  assert.equal(info.latestVersion, '1.4.0');
  assert.equal(info.asset.name, 'Mineradio-Setup-1.4.0.exe');
  assert.equal(info.primaryAction, 'download');
});

test('does not mark the same version as updateable', () => {
  const info = normalizeUpdateInfoForClient({
    configured: true,
    latestVersion: '1.4.0',
    release: { downloadUrl: 'https://example.test/Mineradio-Setup-1.4.0.exe' },
  }, '1.4.0');

  assert.equal(info.updateAvailable, false);
  assert.equal(info.primaryAction, 'none');
});
