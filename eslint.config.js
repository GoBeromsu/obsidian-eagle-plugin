// @ts-check

import perfectionist from 'eslint-plugin-perfectionist'
import * as wdio from 'eslint-plugin-wdio'
import tseslint from 'typescript-eslint'

import { baseConfig } from './eslint.base.js'

const sortImportsSettings = {
	type: 'natural',
	order: 'asc',
	ignoreCase: false,
	newlinesBetween: 'always',
	groups: [
		'type',
		'builtin',
		'external',
		'internal-type',
		'internal',
		['parent-type', 'sibling-type', 'index-type'],
		['parent', 'sibling', 'index'],
		'object',
		'unknown',
	],
	environment: 'node',
}

export default tseslint.config(
	...baseConfig,
	{
		...perfectionist.configs['recommended-natural'],
		rules: {
			'perfectionist/sort-imports': ['error', sortImportsSettings],
			'perfectionist/sort-named-imports': [
				'error',
				{
					type: 'alphabetical',
					order: 'asc',
				},
			],
		},
	},
	{
		files: ['**/*.ts'],
		extends: [
			...tseslint.configs.recommendedTypeChecked,
			{
				languageOptions: {
					parserOptions: {
						projectService: true,
						tsconfigDirName: import.meta.dirname,
					},
				},
			},
		],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
		},
	},
	{
		files: ['src/shared/**/*.ts'],
		rules: {
			// Synced files from boiler-template — suppressions for stricter type-checked rules
			'@typescript-eslint/no-base-to-string': 'off',
		},
	},
	{
		files: ['test/e2e/specs/**/*.ts'],
		extends: [wdio.configs['flat/recommended']],
	},
	{
		ignores: ['main.js', 'release/', 'coverage/', '**/e2e_test_vault/'],
	},
)
