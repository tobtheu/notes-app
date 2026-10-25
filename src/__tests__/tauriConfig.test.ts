import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Tauri Configuration Separation', () => {
  it('has valid public offline configuration in tauri.conf.json', () => {
    const mainConfPath = path.resolve(__dirname, '../../src-tauri/tauri.conf.json');
    expect(fs.existsSync(mainConfPath)).toBe(true);
    const conf = JSON.parse(fs.readFileSync(mainConfPath, 'utf8'));
    expect(conf.identifier).toBe('com.tobtheu.notizapp');
    expect(conf.productName).toBe('Lama Notes');
    expect(conf.plugins.updater.endpoints[0]).toBe(
      'https://github.com/tobtheu/notes-app/releases/latest/download/latest.json'
    );
  });

  it('has valid private sync configuration in tauri.sync.conf.json', () => {
    const syncConfPath = path.resolve(__dirname, '../../src-tauri/tauri.sync.conf.json');
    expect(fs.existsSync(syncConfPath)).toBe(true);
    const conf = JSON.parse(fs.readFileSync(syncConfPath, 'utf8'));
    expect(conf.identifier).toBe('com.tobtheu.notizapp.sync');
    expect(conf.productName).toBe('Lama Notes Sync');
    expect(conf.build.beforeBuildCommand).toBe('npm run build:sync');
    expect(conf.plugins.updater.endpoints[0]).toBe(
      'https://api.lamanotes.de/updates/sync.json'
    );
  });

  it('removes legacy tauri.beta.conf.json', () => {
    const betaConfPath = path.resolve(__dirname, '../../src-tauri/tauri.beta.conf.json');
    expect(fs.existsSync(betaConfPath)).toBe(false);
  });
});
