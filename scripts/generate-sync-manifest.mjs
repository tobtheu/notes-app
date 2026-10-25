import fs from 'fs';
import path from 'path';

/**
 * Scans artifacts directory, matches updater bundles with .sig files,
 * and creates a Tauri v2 manifest object.
 */
export function generateSyncManifest({ artifactsDir, version, baseUrl, pubDate = new Date().toISOString() }) {
  const cleanVersion = version.startsWith('v') ? version.slice(1) : version;
  const files = fs.readdirSync(artifactsDir);

  const manifest = {
    version: `v${cleanVersion}`,
    notes: `Lama Notes Sync v${cleanVersion}`,
    pub_date: pubDate,
    platforms: {},
  };

  for (const file of files) {
    if (!file.endsWith('.sig')) continue;
    const targetFile = file.slice(0, -4);
    if (!files.includes(targetFile)) continue;

    const signature = fs.readFileSync(path.join(artifactsDir, file), 'utf8').trim();
    const encodedUrl = `${baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(targetFile)}`;

    // Tauri platform matching rules
    if (targetFile.includes('darwin-aarch64') || (targetFile.includes('aarch64') && targetFile.endsWith('.tar.gz'))) {
      manifest.platforms['darwin-aarch64'] = { signature, url: encodedUrl };
    } else if (
      targetFile.includes('darwin-x86_64') ||
      (targetFile.includes('x64') && (targetFile.endsWith('.app.tar.gz') || targetFile.endsWith('.tar.gz')))
    ) {
      manifest.platforms['darwin-x86_64'] = { signature, url: encodedUrl };
    } else if (
      targetFile.includes('windows') ||
      targetFile.endsWith('.exe') ||
      targetFile.endsWith('.zip') ||
      targetFile.endsWith('.msi')
    ) {
      manifest.platforms['windows-x86_64'] = { signature, url: encodedUrl };
    } else if (
      targetFile.includes('linux') ||
      targetFile.endsWith('.AppImage') ||
      targetFile.endsWith('.AppImage.tar.gz')
    ) {
      manifest.platforms['linux-x86_64'] = { signature, url: encodedUrl };
    }
  }

  return manifest;
}

// CLI runner when called directly: node scripts/generate-sync-manifest.mjs <artifactsDir> <version> <baseUrl> <outputPath>
if (process.argv[1] && process.argv[1].endsWith('generate-sync-manifest.mjs')) {
  const [, , artifactsDir, version, baseUrl, outputPath] = process.argv;
  if (!artifactsDir || !version || !baseUrl || !outputPath) {
    console.error('Usage: node generate-sync-manifest.mjs <artifactsDir> <version> <baseUrl> <outputPath>');
    process.exit(1);
  }
  const manifest = generateSyncManifest({ artifactsDir, version, baseUrl });
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Generated sync manifest at ${outputPath}:`, JSON.stringify(manifest, null, 2));
}
