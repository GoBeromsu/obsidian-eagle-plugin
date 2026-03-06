#!/usr/bin/env node
/**
 * verify-plugin.mjs
 *
 * CDP smoke test via Obsidian CLI for the unified Eagle picker flow.
 *
 * Usage:
 *   node scripts/verify-plugin.mjs --vault Test
 *   VAULT_NAME=Test node scripts/verify-plugin.mjs
 *
 * `pnpm run verify -- --vault Test` is recommended.
 */

import { execSync } from 'node:child_process'

const PLUGIN_ID = 'obsidian-eagle-plugin'
const IMPORT_COMMAND_ID = 'obsidian-eagle-plugin:eagle-import-from-library'
const TEST_NOTE = '_eagle-verify-test.md'
const VERIFY_ITEM_ID = 'VERIFY001'
const VERIFY_ITEM_NAME = 'eagle-test.png'
const VERIFY_FILE_URL = 'file:///mock/eagle-test.png'
const SEARCH_QUERY = '지혜'
const SEARCH_RESULT_TIMEOUT_MS = 2000
const MODAL_RETRY_MS = 100
const POST_CLICK_WAIT_MS = 900

const cliArgs = process.argv.slice(2)
const vaultArgIndex = cliArgs.indexOf('--vault')
const VAULT_NAME =
  (vaultArgIndex >= 0 && cliArgs[vaultArgIndex + 1]) ||
  cliArgs.find((arg) => arg.startsWith('--vault='))?.replace('--vault=', '') ||
  process.env.VAULT_NAME ||
  process.env.VAULT_PATH ||
  'Test'

let passed = 0
let failed = 0

// ── Helpers ───────────────────────────────────────────────────────────────

function obsidian(args) {
  const vaultPrefix = VAULT_NAME ? `vault="${VAULT_NAME}" ` : ''
  return execSync(`obsidian ${vaultPrefix}${args}`, { encoding: 'utf8' }).trim()
}

/**
 * Evaluate JS in Obsidian via CDP.
 * Collapses multiline code to a single line (Obsidian CLI requirement).
 */
function evalSync(code) {
  const oneliner = code.replace(/\s*\n\s*/g, ' ').trim()
  const raw = obsidian(`eval code=${JSON.stringify(oneliner)}`)
  const lines = raw.split('\n')
  const resultLine = [...lines].reverse().find((line) => line.trimStart().startsWith('=>'))
  return resultLine ? resultLine.replace(/^.*=>\s*/, '').trim() : raw
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

async function waitForPickerInput() {
  const end = Date.now() + SEARCH_RESULT_TIMEOUT_MS
  while (Date.now() < end) {
    const exists = evalSync(`
      const el = document.querySelector('.eagle-picker-search')
      return JSON.stringify(Boolean(el && el.isConnected))
    `)
    if (exists === 'true') return true
    await wait(MODAL_RETRY_MS)
  }
  return false
}

async function waitForPickerItems() {
  const end = Date.now() + SEARCH_RESULT_TIMEOUT_MS
  while (Date.now() < end) {
    const count = Number(
      evalSync(`
        const count = document.querySelectorAll('.eagle-picker-item').length
        return JSON.stringify(count)
      `),
    )
    if (count > 0) return count
    await wait(MODAL_RETRY_MS)
  }
  return 0
}

function cleanupMocks() {
  try {
    evalSync(`
      const plugin = app.plugins.plugins['${PLUGIN_ID}']
      if (!plugin?.eagleUploader) return

      if (plugin.__verifyOrigSearchItems) {
        plugin.eagleUploader.searchItems = plugin.__verifyOrigSearchItems
        delete plugin.__verifyOrigSearchItems
      }

      if (plugin.__verifyOrigResolveFileUrl) {
        plugin.eagleUploader.resolveFileUrl = plugin.__verifyOrigResolveFileUrl
        delete plugin.__verifyOrigResolveFileUrl
      }

      if (plugin.__verifyOrigGetThumbnailFileUrl) {
        plugin.eagleUploader.getThumbnailFileUrl = plugin.__verifyOrigGetThumbnailFileUrl
        delete plugin.__verifyOrigGetThumbnailFileUrl
      }
    `)
  } catch {
    // best effort cleanup only
  }
}

// ── Step 1: plugin status and command check ─────────────────────────────

console.log('\n● Plugin status')
const commandInfo = evalSync(`
  const commands = app?.commands?.commands
  const keys = commands && commands.keys
    ? Array.from(commands.keys())
    : commands && typeof commands === 'object'
      ? Object.keys(commands)
      : []
  const commandExists = keys.includes('${IMPORT_COMMAND_ID}')
  return JSON.stringify({ commandExists })
`)
const { commandExists } = JSON.parse(commandInfo || '{"commandExists":false}')
assert('import-from-library command is registered', commandExists, true)

const pluginType = evalSync(`typeof app.plugins.plugins['${PLUGIN_ID}']`)
assert('plugin is loaded', pluginType, 'object')

if (pluginType !== 'object') {
  console.error('\nPlugin not found — make sure the plugin is installed and Obsidian is running.')
  process.exit(1)
}

// ── Step 2: prepare test note ───────────────────────────────────────────

console.log('\n● Setting up test note')
const setupResult = evalSync(`
  (async () => {
    const file =
      app.vault.getAbstractFileByPath('${TEST_NOTE}') ?? (await app.vault.create('${TEST_NOTE}', ''))
    const leaf = app.workspace.getLeaf(false)
    await leaf.openFile(file, { active: true })
    const viewState = leaf?.getViewState?.()
    if (viewState?.state?.mode !== 'source') {
      await app.commands.executeCommandById('editor:toggle-source')
    }
    const editor = app.workspace.activeEditor?.editor
    if (!editor) return JSON.stringify({ ok: false })
    editor.setValue('')
    editor.setCursor({ line: 0, ch: 0 })
    return JSON.stringify({ ok: true, path: file.path })
  })()
`)
const setupPayload = JSON.parse(setupResult)
assert('test note opened in editor', setupPayload.ok, true)

// ── Step 3: open picker, mock response, validate explicit selection ─────

console.log('\n● Mocked picker flow')
try {
  evalSync(`
    const plugin = app.plugins.plugins['${PLUGIN_ID}']
    const mockItems = [
      {
        id: '${VERIFY_ITEM_ID}',
        name: '${VERIFY_ITEM_NAME}',
        ext: 'png',
        filePath: '/mock/eagle-test.png',
        thumbnail: '/api/item/thumbnail?id=${VERIFY_ITEM_ID}',
      },
    ]

    plugin.__verifyOrigSearchItems = plugin.eagleUploader.searchItems.bind(plugin.eagleUploader)
    plugin.__verifyOrigResolveFileUrl = plugin.eagleUploader.resolveFileUrl.bind(plugin.eagleUploader)
    plugin.__verifyOrigGetThumbnailFileUrl = plugin.eagleUploader.getThumbnailFileUrl.bind(plugin.eagleUploader)

    plugin.eagleUploader.searchItems = async () => mockItems
    plugin.eagleUploader.resolveFileUrl = async () => '${VERIFY_FILE_URL}'
    plugin.eagleUploader.getThumbnailFileUrl = async () => 'file:///mock/eagle-test-thumb.png'
  `)

  const commandResult = evalSync(`JSON.stringify(await app.commands.executeCommandById('${IMPORT_COMMAND_ID}'))`)
  assert('search picker command executed', commandResult, 'true')

  const pickerReady = await waitForPickerInput()
  assert('picker input appears after command', pickerReady, true)

  const keywordSet = evalSync(`
    const input = document.querySelector('.eagle-picker-search')
    if (!input) return 'missing'
    input.value = '${SEARCH_QUERY}'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return 'ok'
  `)
  assert('search keyword dispatched', keywordSet, 'ok')

  await wait(SEARCH_RESULT_TIMEOUT_MS)
  const resultCount = await waitForPickerItems()
  assert('search result card is rendered', resultCount > 0, true)

  const before = JSON.parse(
    evalSync(`
      const value = app.workspace.activeEditor?.editor?.getValue() ?? ''
      return JSON.stringify(value)
    `),
  )
  assert('no auto-insert before card click', before, '')

  const clickResult = evalSync(`
    const item = document.querySelector('.eagle-picker-item')
    if (!item) return 'missing'
    item.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return 'clicked'
  `)
  assert('result card click executed', clickResult, 'clicked')

  await wait(POST_CLICK_WAIT_MS)

  const after = JSON.parse(
    evalSync(`
      const value = app.workspace.activeEditor?.editor?.getValue() ?? ''
      return JSON.stringify(value)
    `),
  )
  assertContains('markdown inserted for selected item', after, `![eagle:${VERIFY_ITEM_ID}]`)
  assertContains('markdown uses resolved file URL', after, '${VERIFY_FILE_URL}')
} finally {
  cleanupMocks()
}

// ── Step 4: settings sanity check ───────────────────────────────────────

console.log('\n● Settings')
const settings = evalSync(`JSON.stringify(app.plugins.plugins['${PLUGIN_ID}']?.settings ?? null)`)
assertContains('eagleHost is set', settings, '"eagleHost"')
assertContains('eaglePort is set', settings, '"eaglePort"')

// ── Step 5: console errors (eagle plugin scope only) ────────────────────

console.log('\n● Console errors')
try {
  const devOut = obsidian('dev:errors')
  const filtered = String(devOut)
    .split('\n')
    .filter((line) => line.includes('${PLUGIN_ID}') || line.includes('eagle'))
    .join('\n')
  const hasErrors = filtered.trim() !== '' && !filtered.toLowerCase().includes('no errors')
  assert('no Obsidian console errors for this plugin', hasErrors, false)
  if (hasErrors) console.log(`      errors:\n${filtered}`)
} catch {
  console.log('  (skipped — obsidian dev:errors unavailable)')
}

// ── Cleanup ───────────────────────────────────────────────────────────────

try {
  evalSync(`
    const file = app.vault.getAbstractFileByPath('${TEST_NOTE}')
    if (file) await app.vault.delete(file)
  `)
} catch {
  // ignore
}

// ── Summary ───────────────────────────────────────────────────────────────

const total = passed + failed
console.log(`\n${total} checks — ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
