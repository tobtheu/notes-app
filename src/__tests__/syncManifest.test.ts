import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
// @ts-expect-error script is mjs
import { generateSyncManifest } from '../../scripts/generate-sync-manifest.mjs';

describe('generateSyncManifest', () => {
  const tmpDir = path.resolve(__dirname, 'tmp-manifest-test');

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    // Simulate macOS ARM64 updater bundle
    fs.writeFileSync(path.join(tmpDir, 'Lama Notes Sync_0.8.5_aarch64.app.tar.gz'), 'dummy-tar');
    fs.writeFileSync(path.join(tmpDir, 'Lama Notes Sync_0.8.5_aarch64.app.tar.gz.sig'), 'SIG_MAC_ARM');

    // Simulate macOS x64 updater bundle
    fs.writeFileSync(path.join(tmpDir, 'Lama Notes Sync_0.8.5_x64.app.tar.gz'), 'dummy-tar-x64');
    fs.writeFileSync(path.join(tmpDir, 'Lama Notes Sync_0.8.5_x64.app.tar.gz.sig'), 'SIG_MAC_X64');

    // Simulate Windows x64 updater bundle
    fs.writeFileSync(path.join(tmpDir, 'Lama Notes Sync_0.8.5_x64-setup.nsis.zip'), 'dummy-zip');
    fs.writeFileSync(path.join(tmpDir, 'Lama Notes Sync_0.8.5_x64-setup.nsis.zip.sig'), 'SIG_WIN_X64');

    // Simulate Linux x64 updater bundle
    fs.writeFileSync(path.join(tmpDir, 'Lama Notes Sync_0.8.5_amd64.AppImage.tar.gz'), 'dummy-linux-tar');
    fs.writeFileSync(path.join(tmpDir, 'Lama Notes Sync_0.8.5_amd64.AppImage.tar.gz.sig'), 'SIG_LINUX_X64');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('compiles platforms with exact signatures and https urls', () => {
    const manifest = generateSyncManifest({
      artifactsDir: tmpDir,
      version: '0.8.5',
      baseUrl: 'https://api.lamanotes.de/updates',
      pubDate: '2026-10-25T12:00:00Z',
    });

    expect(manifest.version).toBe('v0.8.5');
    expect(manifest.notes).toContain('v0.8.5');
    expect(manifest.pub_date).toBe('2026-10-25T12:00:00Z');
    expect(manifest.platforms['darwin-aarch64']).toEqual({
      signature: 'SIG_MAC_ARM',
      url: 'https://api.lamanotes.de/updates/Lama%20Notes%20Sync_0.8.5_aarch64.app.tar.gz',
    });
    expect(manifest.platforms['darwin-x86_64']).toEqual({
      signature: 'SIG_MAC_X64',
      url: 'https://api.lamanotes.de/updates/Lama%20Notes%20Sync_0.8.5_x64.app.tar.gz',
    });
    expect(manifest.platforms['windows-x86_64']).toEqual({
      signature: 'SIG_WIN_X64',
      url: 'https://api.lamanotes.de/updates/Lama%20Notes%20Sync_0.8.5_x64-setup.nsis.zip',
    });
    expect(manifest.platforms['linux-x86_64']).toEqual({
      signature: 'SIG_LINUX_X64',
      url: 'https://api.lamanotes.de/updates/Lama%20Notes%20Sync_0.8.5_amd64.AppImage.tar.gz',
    });
  });
});
