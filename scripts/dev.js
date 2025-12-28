// @ts-check

import fs from 'node:fs/promises'
import path from 'node:path'
import { exit } from 'node:process'

import { select } from '@inquirer/prompts'
import esbuild from 'esbuild'
import obsidianUtils from 'obsidian-utils'

import { sharedEsbuildConfig } from './esbuild.config.js'

const { findVault, installPluginFromGithub, isPluginInstalled } = obsidianUtils

let vaults
try {
  vaults = await findVault()
} catch (e) {
  console.error('Failed to find  vaults', e)
  exit(1)
}

const vaultsOptions = vaults.map((v) => ({ name: v.name, value: v.path }))

// Support VAULT_PATH env var or --vault CLI arg for non-interactive environments
const envVaultPath = process.env.VAULT_PATH
const cliVaultArg = process.argv[2]

let selectedVaultPath
if (envVaultPath) {
  selectedVaultPath = envVaultPath
  console.log(`Using vault from VAULT_PATH: ${selectedVaultPath}`)
} else if (cliVaultArg) {
  // Match by name or path
  const match = vaults.find((v) => v.name === cliVaultArg || v.path === cliVaultArg)
  if (match) {
    selectedVaultPath = match.path
    console.log(`Using vault: ${match.name}`)
  } else {
    console.error(`Vault not found: ${cliVaultArg}`)
    console.error('Available vaults:', vaults.map((v) => v.name).join(', '))
    exit(1)
  }
} else {
  selectedVaultPath = await select({
    message: 'Select Obsidian Vault for development',
    choices: vaultsOptions,
  })
}

if (!(await isPluginInstalled('hot-reload', selectedVaultPath))) {
  console.log('Installing hot-reload from github...')
  await installPluginFromGithub('pjeby/hot-reload', 'latest', selectedVaultPath)
}

const localManifestPath = path.join(process.cwd(), 'manifest.json')
const manifest = JSON.parse(await fs.readFile(localManifestPath, { encoding: 'utf-8' }))

const pluginPath = path.join(selectedVaultPath, '.obsidian', 'plugins', manifest.id)

fs.mkdir(pluginPath, { recursive: true })
await fs.copyFile(localManifestPath, path.join(pluginPath, 'manifest.json'))
await fs.writeFile(path.join(pluginPath, '.hotreload'), '')

const esbuildCtx = await esbuild.context({
  ...sharedEsbuildConfig,
  ...{ outfile: path.join(pluginPath, 'main.js') },
})
esbuildCtx.watch()
