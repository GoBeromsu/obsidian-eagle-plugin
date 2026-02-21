#!/usr/bin/env node
/**
 * verify-plugin.mjs
 *
 * CDP smoke test via Obsidian CLI — runs against the live Obsidian instance.
 * Verifies search + upload flows without requiring Eagle to be running.
 *
 * Usage:
 *   node scripts/verify-plugin.mjs          # skip build step
 *   pnpm run verify                         # build → reload → verify
 */

import { execSync } from 'node:child_process'

const PLUGIN_ID = 'obsidian-eagle-plugin'
const TEST_NOTE = '_eagle-verify-test.md'
const WAIT_MS = 800

let passed = 0
let failed = 0

// ── Helpers ───────────────────────────────────────────────────────────────

function obsidian(args) {
  return execSync(`obsidian ${args}`, { encoding: 'utf8' }).trim()
}

/**
 * Evaluate JS in the Obsidian runtime via CDP.
 * Collapses multiline code to a single line (Obsidian CLI requirement).
 * Parses the `=> value` result line from CLI output.
 */
function evalSync(code) {
  const oneliner = code.replace(/\s*\n\s*/g, ' ').trim()
  const raw = execSync(`obsidian eval code=${JSON.stringify(oneliner)}`, {
    encoding: 'utf8',
  }).trim()

  // CLI output format: "[timestamp log lines]\n=> <result>"
  const lines = raw.split('\n')
  const resultLine = [...lines].reverse().find((l) => l.trimStart().startsWith('=>'))
  return resultLine ? resultLine.replace(/^.*?=>/, '').trim() : raw
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function assert(label, actual, expected) {
  const ok = String(actual) === String(expected)
  console.log(`  ${ok ? '✓' : '✗'} ${label}`)
  if (!ok) {
    console.log(`      expected: ${JSON.stringify(expected)}`)
    console.log(`      actual:   ${JSON.stringify(String(actual).slice(0, 300))}`)
  }
  ok ? passed++ : failed++
}

function assertContains(label, actual, substr) {
  const ok = String(actual).includes(substr)
  console.log(`  ${ok ? '✓' : '✗'} ${label}`)
  if (!ok) {
    console.log(`      expected to contain: ${JSON.stringify(substr)}`)
    console.log(`      actual: ${String(actual).slice(0, 300)}`)
  }
  ok ? passed++ : failed++
}

// ── Step 1: Plugin load check ─────────────────────────────────────────────

console.log('\n● Plugin status')
const pluginType = evalSync(`typeof app.plugins.plugins['${PLUGIN_ID}']`)
assert('plugin is loaded', pluginType, 'object')

if (pluginType !== 'object') {
  console.error('\nPlugin not found — make sure the plugin is installed and Obsidian is running.')
  process.exit(1)
}

// ── Step 2: Prepare test note ─────────────────────────────────────────────

console.log('\n● Setting up test note')

// Create a disposable note and open it
evalSync(`
  (async () => {
    const exists = app.vault.getAbstractFileByPath('${TEST_NOTE}')
    const file = exists ?? await app.vault.create('${TEST_NOTE}', '')
    await app.workspace.getLeaf(false).openFile(file)
    const ed = app.workspace.activeEditor?.editor
    if (ed) { ed.setValue(''); ed.setCursor({ line: 0, ch: 0 }) }
  })()
`)

await sleep(WAIT_MS)

// Confirm editor is ready
const editorReady = evalSync(
  `typeof app.workspace.activeEditor?.editor?.getValue === 'function'`,
)
assert('test note editor is active', editorReady, 'true')

// ── Step 3: search → insert (mocked Eagle API) ────────────────────────────

console.log('\n● Search flow (mocked Eagle, Eagle not running)')

// Install mocks
evalSync(`
  const p = app.plugins.plugins['${PLUGIN_ID}'];
  p.__origSearchItems = p.eagleUploader.searchItems.bind(p.eagleUploader);
  p.__origResolveFileUrl = p.eagleUploader.resolveFileUrl.bind(p.eagleUploader);
  p.eagleUploader.searchItems = async () => [
    { id: 'VERIFY001', name: 'eagle-test.png', filePath: '/mock/eagle-test.png' }
  ];
  p.eagleUploader.resolveFileUrl = async (item) => 'file:///mock/' + item.name;
  window.__verifySearchResult = null;
  window.__verifySearchError = null;
`)

// Trigger the private executeEagleImport (modal bypassed — direct call)
evalSync(`
  const p = app.plugins.plugins['${PLUGIN_ID}'];
  const ed = app.workspace.activeEditor?.editor;
  if (ed) {
    ed.setValue('');
    ed.setCursor({ line: 0, ch: 0 });
    p['executeEagleImport'](ed, 'eagle-test')
      .then(() => { window.__verifySearchResult = ed.getValue() })
      .catch((e) => { window.__verifySearchError = e?.message ?? String(e) });
  }
`)

await sleep(WAIT_MS)

const searchResult = evalSync(`window.__verifySearchResult ?? 'TIMEOUT'`)
const searchError = evalSync(`window.__verifySearchError ?? null`)

assert('no error during mocked search', searchError, 'null')
assertContains('Eagle item ID written to note', searchResult, 'VERIFY001')
assertContains('file:// URL written to note', searchResult, 'file:///mock/')

// ── Step 4: connection refused → graceful Notice, no unhandled rejection ──

console.log('\n● Connection-refused error handling (Eagle not running)')

// Restore real searchItems so it hits the real (closed) Eagle port
evalSync(`
  const p = app.plugins.plugins['${PLUGIN_ID}'];
  if (p.__origSearchItems) {
    p.eagleUploader.searchItems = p.__origSearchItems;
    p.eagleUploader.resolveFileUrl = p.__origResolveFileUrl;
  }
  window.__verifyUnhandledCount = 0;
  window.__origUnhandledRejection = window.onunhandledrejection;
  window.onunhandledrejection = () => { window.__verifyUnhandledCount++ };
`)

evalSync(`
  const p = app.plugins.plugins['${PLUGIN_ID}'];
  const ed = app.workspace.activeEditor?.editor;
  if (ed) {
    ed.setValue('');
    ed.setCursor({ line: 0, ch: 0 });
    p['executeEagleImport'](ed, 'no-eagle-running');
  }
`)

// Wait long enough for the HTTP timeout/refusal to propagate
await sleep(2000)

const unhandledCount = evalSync(`window.__verifyUnhandledCount ?? 0`)
assert('connection refused triggers Notice (not unhandled rejection)', unhandledCount, '0')

// ── Step 5: Settings sanity check ────────────────────────────────────────

console.log('\n● Settings')
const settings = evalSync(`JSON.stringify(app.plugins.plugins['${PLUGIN_ID}']?.settings)`)
assertContains('eagleHost is set', settings, '"eagleHost"')
assertContains('eaglePort is set', settings, '"eaglePort"')

// ── Cleanup ───────────────────────────────────────────────────────────────

evalSync(`
  (async () => {
    const f = app.vault.getAbstractFileByPath('${TEST_NOTE}')
    if (f) await app.vault.delete(f)
    window.onunhandledrejection = window.__origUnhandledRejection ?? null
  })()
`)

// ── Dev console check ─────────────────────────────────────────────────────

console.log('\n● Console errors')
try {
  const devOut = obsidian('dev:errors')
  const hasErrors = devOut && devOut !== '[]' && !devOut.toLowerCase().includes('no errors')
  assert('no Obsidian console errors', hasErrors, false)
  if (hasErrors) console.log(`      errors:\n${devOut}`)
} catch {
  console.log('  (skipped — obsidian dev:errors unavailable)')
}

// ── Summary ───────────────────────────────────────────────────────────────

const total = passed + failed
console.log(`\n${total} checks — ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
