import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// These are narrowly documented local guards, not upstream fixes or alert
// dismissals. Installation and separate regression tests verify each guard.
// Never permit a package name alone, a version range, or a whole severity.
const guarded = new Map([
  ['braces', { version: '3.0.3', advisories: new Set(['GHSA-vfj7-8cjw-p6xm']) }],
  ['sprintf-js', { version: '1.1.3', advisories: new Set(['GHSA-hp3w-g68c-fv3c']) }],
  ['node-forge', { version: '1.4.0', advisories: new Set(['GHSA-86w9-cpqp-85rv']) }],
  ['image-size', { version: '1.2.1', advisories: new Set(['GHSA-5p2g-fcmc-qvqq', 'GHSA-w3rx-r6r6-pgpr']) }],
]);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (message) => { throw new Error(message); };

export function evaluateAuditReport(report, lockfile) {
  if (!isObject(report)) fail('npm audit did not return a JSON object');
  if (report.error) fail(`npm audit registry error: ${/^[A-Z0-9_]+$/.test(report.error.code) ? report.error.code : 'UNKNOWN'}`);
  if (report.auditReportVersion !== 2 || !isObject(report.vulnerabilities) || !isObject(report.metadata?.vulnerabilities)) {
    fail('npm audit returned an unsupported or incomplete report');
  }
  if (!isObject(lockfile?.packages)) fail('A package-lock.json packages map is required');
  const entries = Object.entries(report.vulnerabilities);
  const counts = report.metadata.vulnerabilities;
  const severityNames = ['info', 'low', 'moderate', 'high', 'critical'];
  if (!Number.isInteger(counts.total) || counts.total !== entries.length ||
    severityNames.some((name) => !Number.isInteger(counts[name]) || counts[name] < 0) ||
    severityNames.reduce((sum, name) => sum + counts[name], 0) !== counts.total) {
    fail('npm audit vulnerability totals are inconsistent');
  }
  const actualCounts = Object.fromEntries(severityNames.map((name) => [name, 0]));
  const allowed = new Map();
  const directPackages = new Set();
  for (const [name, entry] of entries) {
    if (!isObject(entry) || entry.name !== name || !severityNames.includes(entry.severity) ||
      !Array.isArray(entry.via) || entry.via.length === 0 || !Array.isArray(entry.nodes) || entry.nodes.length === 0) {
      fail(`npm audit returned an incomplete vulnerability entry for ${name}`);
    }
    actualCounts[entry.severity]++;
    for (const via of entry.via) {
      if (typeof via === 'string') {
        if (!Object.hasOwn(report.vulnerabilities, via)) fail(`Unresolved inherited advisory: ${name} → ${via}`);
        continue;
      }
      if (!isObject(via) || via.name !== name || via.dependency !== name) fail(`Unsupported direct advisory for ${name}`);
      const match = /^https:\/\/github\.com\/advisories\/(GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4})$/.exec(via.url);
      const permitted = guarded.get(name);
      if (!match || !permitted?.advisories.has(match[1])) fail(`New or unguarded upstream advisory for ${name}: ${match?.[1] || 'unrecognized advisory URL'}`);
      for (const node of entry.nodes) {
        const metadata = typeof node === 'string' ? lockfile.packages[node] : null;
        const packageName = typeof node === 'string' ? metadata?.name || node.slice(node.lastIndexOf('node_modules/') + 'node_modules/'.length) : null;
        if (!metadata || !node.includes('node_modules/') || packageName !== name || metadata.version !== permitted.version) {
          fail(`Guarded advisory ${match[1]} requires ${name}@${permitted.version} at every reported node; found ${metadata?.version || 'missing node'}`);
        }
      }
      directPackages.add(name);
      allowed.set(`${name}@${permitted.version}:${match[1]}`, { name, version: permitted.version, advisory: match[1] });
    }
  }
  for (const severity of severityNames) {
    if (actualCounts[severity] !== counts[severity]) fail('npm audit severity totals are inconsistent');
  }
  // Audit graphs can contain legitimate cycles (Metro and metro-config).
  // Every inherited entry must still reach a verified direct advisory.
  for (const [name] of entries) {
    const pending = [name];
    const visited = new Set();
    let reachesGuarded = false;
    while (pending.length) {
      const current = pending.pop();
      if (visited.has(current)) continue;
      visited.add(current);
      if (directPackages.has(current)) reachesGuarded = true;
      for (const via of report.vulnerabilities[current].via) {
        if (typeof via === 'string') pending.push(via);
      }
    }
    if (!reachesGuarded) fail(`Inherited advisory ${name} does not resolve to a documented guard`);
  }
  return {
    total: counts.total,
    guardedAdvisories: [...allowed.values()].sort((left, right) => `${left.name}:${left.advisory}`.localeCompare(`${right.name}:${right.advisory}`)),
    directPackageCount: directPackages.size,
    inheritedPackageCount: entries.length - directPackages.size,
  };
}

export function parseAuditResult(result, lockfile) {
  if (result.error) fail(`Unable to run npm audit: ${result.error.code || 'UNKNOWN'}`);
  if (result.signal || ![0, 1].includes(result.status)) fail(`npm audit failed (status ${result.status}, signal ${result.signal || 'none'})`);
  let report;
  try { report = JSON.parse(result.stdout); }
  catch { fail('npm audit returned invalid JSON'); }
  const summary = evaluateAuditReport(report, lockfile);
  if ((summary.total === 0 && result.status !== 0) || (summary.total > 0 && result.status !== 1)) {
    fail('npm audit exit status does not match its vulnerability report');
  }
  return summary;
}

export function auditDependencies(installRoot, run = spawnSync) {
  const root = path.resolve(installRoot);
  const lockfile = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const args = ['audit', '--package-lock-only', '--json'];
  const npmCli = process.env.npm_execpath;
  const result = run(npmCli ? process.execPath : 'npm', npmCli ? [npmCli, ...args] : args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
  });
  return parseAuditResult(result, lockfile);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const summary = auditDependencies(process.argv[2] || process.cwd());
    console.log(`npm audit reports ${summary.total} vulnerable package entries: ${summary.guardedAdvisories.length} guarded upstream advisories across ${summary.directPackageCount} packages, plus ${summary.inheritedPackageCount} inherited dependency entries.`);
    for (const entry of summary.guardedAdvisories) console.log(`- ${entry.name}@${entry.version}: ${entry.advisory} (documented local guard; upstream audit remains affected)`);
    console.log('Dependency audit policy passed; guard regression checks must pass separately.');
  } catch (error) {
    console.error(`Dependency audit policy failed: ${error.message}`);
    process.exitCode = 1;
  }
}
