// @ts-check

import globals from 'globals'
import * as wdio from 'eslint-plugin-wdio'
import tseslint from 'typescript-eslint'

import { baseConfig } from './eslint.base.js'

// eslint-disable-next-line @typescript-eslint/no-deprecated -- defineConfig doesn't flatten wdio/baseConfig array spread
export default tseslint.config(
	...baseConfig,
	{
		files: ['**/*.ts'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			// NodeJS namespace and require() are used in Electron context (EagleUploader, SettingsTab).
			// TypeScript handles undefined-variable checks; disable ESLint's no-undef for .ts files.
			'no-undef': 'off',
		},
	},
	{
		files: ['src/shared/**/*.ts'],
		rules: {
			// Synced files from boiler-template — suppressions for stricter type-checked rules
			'@typescript-eslint/no-base-to-string': 'off',
		},
	},
	// EagleUploader uses Electron's Node integration (Buffer, fs callbacks with NodeJS.ErrnoException).
	{
		files: ['src/ui/EagleUploader.ts', 'src/ui/EaglePluginSettingsTab.ts'],
		languageOptions: {
			globals: { ...globals.node },
		},
	},
	// WebdriverIO e2e tests: need wdio globals + mocha globals (describe, it, before, context).
	{
		files: ['test/e2e/**/*.ts'],
		extends: [wdio.configs['flat/recommended']],
		languageOptions: {
			globals: { ...globals.mocha },
		},
	},
	{
		ignores: ['main.js', 'release/', 'coverage/', '**/e2e_test_vault/', 'scripts/*.js', 'vitest.config.ts'],
	},
)
