import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  smartParseProxy,
  createProfile,
  checkProfile,
  workspaceQuality,
  profileQuality,
  DEFAULT_PROFILE_EXTENSION_IDS,
  defaultExtensionsForFamily,
  DEVICE_TEMPLATES,
  EXTENSION_CATALOG,
} from '../packages/core/src/index';

describe('Joe Browser v3.2+ upgrades', () => {
  it('parses clipboard proxy formats accurately', () => {
    const a = smartParseProxy('socks5://alice:secret@198.51.100.12:1080');
    assert.equal(a.valid, true);
    assert.equal(a.protocol, 'socks5');
    assert.equal(a.host, '198.51.100.12');
    assert.equal(a.port, 1080);
    assert.equal(a.username, 'alice');
    assert.equal(a.password, 'secret');

    const b = smartParseProxy('203.0.113.40:8080:bob:pw123');
    assert.equal(b.valid, true);
    assert.equal(b.protocol, 'http');
    assert.equal(b.host, '203.0.113.40');
    assert.equal(b.port, 8080);
    assert.equal(b.username, 'bob');
    assert.equal(b.password, 'pw123');

    const c = smartParseProxy('user:pass@192.0.2.5:1080');
    assert.equal(c.valid, true);
    assert.equal(c.protocol, 'socks5');
    assert.equal(c.host, '192.0.2.5');
    assert.equal(c.port, 1080);
  });

  it('attaches HTTP Tracker and Absolute Right Click by default on Chromium families and allows removal', () => {
    for (const fam of ['chrome', 'chromium', 'brave', 'joe'] as const) {
      const p = createProfile({ name: fam, browserFamily: fam, seed: `ext::${fam}` });
      assert.deepEqual(p.extensions, [...DEFAULT_PROFILE_EXTENSION_IDS]);
    }
    const removed = createProfile({ name: 'Custom', browserFamily: 'chrome', extensions: [] });
    assert.deepEqual(removed.extensions, []);
    assert.deepEqual(defaultExtensionsForFamily('firefox'), []);
    assert.equal(EXTENSION_CATALOG.some((e) => e.id === 'http-tracker' && e.rating === 4.5), true);
    assert.equal(EXTENSION_CATALOG.some((e) => e.id === 'absolute-right-click'), true);
  });

  it('reports 100% uniqueness when no duplicate bundles exist', () => {
    const profiles = [
      createProfile({ name: 'P1', templateId: 'win11-intel', seed: '1' }),
      createProfile({ name: 'P2', templateId: 'win11-nvidia', seed: '2' }),
      createProfile({ name: 'P3', templateId: 'mac-sonoma-m1', seed: '3' }),
      createProfile({ name: 'P4', templateId: 'android-pixel8', seed: '4' }),
      createProfile({ name: 'P5', templateId: 'linux-fedora', seed: '5' }),
      createProfile({ name: 'P6', templateId: 'iphone-16-pro', seed: '6' }),
    ];
    const wq = workspaceQuality(profiles);
    assert.equal(wq.averageUniqueness, 100);
    for (const p of profiles) {
      assert.equal(profileQuality(p, profiles).uniqueness, 100);
    }
  });

  it('honors chromeMajor override with zero consistency penalty and covers all OS classes', () => {
    const p = createProfile({
      name: 'VerTest',
      templateId: 'linux-arch',
      browserFamily: 'brave',
      seed: 'v146',
      overrides: { chromeMajor: 146 },
    });
    assert.equal(p.fingerprint.chromeMajor, 146);
    assert.match(p.fingerprint.userAgent, /Chrome\/146\.0\.0\.0/);
    const report = checkProfile(p);
    assert.equal(report.issues.filter((i) => i.severity === 'critical').length, 0);
    assert.equal(report.score, 100);

    const oses = new Set(DEVICE_TEMPLATES.map((t) => t.os));
    for (const os of ['Windows', 'macOS', 'Android', 'iOS', 'iPadOS', 'Linux'] as const) {
      assert.equal(oses.has(os), true, `Missing OS templates for ${os}`);
    }
    assert.equal(DEVICE_TEMPLATES.filter((t) => t.os === 'Linux').length >= 4, true);
    assert.equal(DEVICE_TEMPLATES.filter((t) => t.os === 'Android').length >= 4, true);
  });
});
