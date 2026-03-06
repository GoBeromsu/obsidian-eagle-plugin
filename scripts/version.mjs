import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';

const version = process.env.npm_package_version;
if (!version) throw new Error('npm_package_version is not set. Run via: pnpm version <semver>');

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const { minAppVersion } = manifest;
manifest.version = version;
writeFileSync('manifest.json', JSON.stringify(manifest, null, '\t') + '\n');

const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
versions[version] = minAppVersion;
writeFileSync('versions.json', JSON.stringify(versions, null, '\t') + '\n');

spawnSync('git', ['add', 'manifest.json', 'versions.json'], { stdio: 'inherit' });
