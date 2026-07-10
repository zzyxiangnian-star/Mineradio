const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

test('loads the taskbar native module under the installed Electron ABI', { timeout: 30000 }, () => {
  const electron = require('electron');
  const fixture = path.join(__dirname, 'fixtures', 'taskbar-native-smoke.js');
  const result = spawnSync(electron, [fixture], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    timeout: 25000,
    windowsHide: true,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stdout.trim(), 'attach,clearBitmap,detach,updateBitmap');
});
