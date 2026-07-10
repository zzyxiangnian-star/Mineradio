function normalizeVersion(value) {
  const match = String(value || '').match(/\d+(?:\.\d+){1,3}/);
  return match ? match[0] : '0.0.0';
}

function compareVersions(a, b) {
  const left = normalizeVersion(a).split('.').map(n => Number(n) || 0);
  const right = normalizeVersion(b).split('.').map(n => Number(n) || 0);
  const len = Math.max(left.length, right.length, 3);
  for (let i = 0; i < len; i++) {
    const delta = (left[i] || 0) - (right[i] || 0);
    if (delta) return delta > 0 ? 1 : -1;
  }
  return 0;
}

function normalizeUpdateInfoForClient(info, currentVersion) {
  const raw = info || {};
  const latestVersion = normalizeVersion(raw.latestVersion || raw.version || currentVersion);
  const asset = raw.asset || {};
  const release = raw.release || {};
  const downloadUrl = release.downloadUrl || asset.downloadUrl || raw.downloadUrl || '';
  const updateAvailable = raw.updateAvailable == null
    ? compareVersions(latestVersion, currentVersion) > 0
    : !!raw.updateAvailable && compareVersions(latestVersion, currentVersion) > 0;

  return {
    ...raw,
    latestVersion,
    updateAvailable,
    release: {
      ...release,
      version: release.version || latestVersion,
      downloadUrl,
    },
    asset: {
      ...asset,
      name: asset.name || `Mineradio-Setup-${latestVersion}.exe`,
      downloadUrl,
    },
    primaryAction: updateAvailable && downloadUrl ? 'download' : 'none',
  };
}

module.exports = {
  compareVersions,
  normalizeUpdateInfoForClient,
  normalizeVersion,
};
