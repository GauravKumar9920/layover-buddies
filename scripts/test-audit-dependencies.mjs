import assert from 'node:assert/strict';
import { evaluateAuditReport, parseAuditResult } from './audit-dependencies.mjs';

const advisory = (name, id) => ({ name, dependency: name, url: `https://github.com/advisories/${id}` });
const vulnerable = (name, via, nodes = [`node_modules/${name}`]) => ({ name, severity: 'high', via, nodes });
const reportFor = (vulnerabilities) => ({
  auditReportVersion: 2,
  vulnerabilities,
  metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: Object.keys(vulnerabilities).length, critical: 0, total: Object.keys(vulnerabilities).length } },
});
const lockfile = { packages: {
  'node_modules/braces': { version: '3.0.3' },
  'node_modules/nested/node_modules/braces': { version: '3.0.3' },
  'node_modules/sprintf-js': { version: '1.1.3' },
  'node_modules/node-forge': { version: '1.4.0' },
  'node_modules/image-size': { version: '1.2.1' },
} };
const known = reportFor({
  braces: vulnerable('braces', [advisory('braces', 'GHSA-vfj7-8cjw-p6xm')], ['node_modules/braces', 'node_modules/nested/node_modules/braces']),
  'sprintf-js': vulnerable('sprintf-js', [advisory('sprintf-js', 'GHSA-hp3w-g68c-fv3c')]),
  'node-forge': vulnerable('node-forge', [advisory('node-forge', 'GHSA-86w9-cpqp-85rv')]),
  'image-size': vulnerable('image-size', [advisory('image-size', 'GHSA-5p2g-fcmc-qvqq'), advisory('image-size', 'GHSA-w3rx-r6r6-pgpr')]),
  metro: vulnerable('metro', ['metro-config', 'braces']),
  'metro-config': vulnerable('metro-config', ['metro']),
});
const summary = evaluateAuditReport(known, lockfile);
assert.equal(summary.guardedAdvisories.length, 5);
assert.equal(summary.directPackageCount, 4);
assert.equal(summary.inheritedPackageCount, 2);
assert.equal(summary.total, 6);
assert.deepEqual(parseAuditResult({ status: 1, stdout: JSON.stringify(known) }, lockfile), summary);
assert.equal(parseAuditResult({ status: 0, stdout: JSON.stringify(reportFor({})) }, lockfile).total, 0);

const newAdvisory = structuredClone(known);
newAdvisory.vulnerabilities.braces.via.push(advisory('braces', 'GHSA-aaaa-bbbb-cccc'));
assert.throws(() => evaluateAuditReport(newAdvisory, lockfile), /New or unguarded upstream advisory/);
const differentPackage = reportFor({ unknown: vulnerable('unknown', [advisory('unknown', 'GHSA-vfj7-8cjw-p6xm')]) });
assert.throws(() => evaluateAuditReport(differentPackage, lockfile), /New or unguarded upstream advisory/);
const changedVersion = structuredClone(lockfile);
changedVersion.packages['node_modules/nested/node_modules/braces'].version = '3.0.2';
assert.throws(() => evaluateAuditReport(known, changedVersion), /requires braces@3.0.3/);
const missingNode = structuredClone(lockfile);
delete missingNode.packages['node_modules/braces'];
assert.throws(() => evaluateAuditReport(known, missingNode), /missing node/);
const renamedNode = structuredClone(lockfile);
renamedNode.packages['node_modules/braces'].name = 'another-package';
assert.throws(() => evaluateAuditReport(known, renamedNode), /requires braces@3.0.3/);

const unresolved = reportFor({ consumer: vulnerable('consumer', ['absent']) });
assert.throws(() => evaluateAuditReport(unresolved, lockfile), /Unresolved inherited advisory/);
const unrootedCycle = reportFor({ first: vulnerable('first', ['second']), second: vulnerable('second', ['first']) });
assert.throws(() => evaluateAuditReport(unrootedCycle, lockfile), /does not resolve to a documented guard/);
const alteredUrl = structuredClone(known);
alteredUrl.vulnerabilities.braces.via[0].url = 'https://example.org/advisories/GHSA-vfj7-8cjw-p6xm';
assert.throws(() => evaluateAuditReport(alteredUrl, lockfile), /unrecognized advisory URL/);

const incorrectCount = structuredClone(known);
incorrectCount.metadata.vulnerabilities.total++;
assert.throws(() => evaluateAuditReport(incorrectCount, lockfile), /totals are inconsistent/);
assert.throws(() => parseAuditResult({ status: 1, stdout: JSON.stringify({ error: { code: 'ENOAUDIT', message: 'registry unavailable' } }) }, lockfile), /registry error: ENOAUDIT/);
assert.throws(() => parseAuditResult({ status: 1, stdout: 'not JSON' }, lockfile), /invalid JSON/);
assert.throws(() => parseAuditResult({ error: { code: 'ETIMEDOUT' }, status: null, stdout: '' }, lockfile), /Unable to run npm audit/);
assert.throws(() => parseAuditResult({ status: 2, stdout: JSON.stringify(known) }, lockfile), /npm audit failed/);
assert.throws(() => parseAuditResult({ status: 0, signal: 'SIGTERM', stdout: JSON.stringify(known) }, lockfile), /npm audit failed/);
assert.throws(() => parseAuditResult({ status: 1, stdout: JSON.stringify(reportFor({})) }, lockfile), /exit status does not match/);
assert.throws(() => parseAuditResult({ status: 0, stdout: JSON.stringify(known) }, lockfile), /exit status does not match/);
assert.throws(() => evaluateAuditReport({ auditReportVersion: 1, vulnerabilities: {}, metadata: {} }, lockfile), /unsupported or incomplete/);

console.log('Dependency audit policy regression checks passed: exact guards, nested versions, new advisories, inherited cycles, registry errors, and malformed reports.');
