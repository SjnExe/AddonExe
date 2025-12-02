// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import jsonc from 'eslint-plugin-jsonc';
import importPlugin from 'eslint-plugin-import';
import unusedImports from 'eslint-plugin-unused-imports';
import promisePlugin from 'eslint-plugin-promise';
import path from 'path';
import { fileURLToPath } from 'url';
import prettierConfig from 'eslint-config-prettier';
import minecraftLinting from 'eslint-plugin-minecraft-linting';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default tseslint.config(
    {
        ignores: [
            'node_modules/',
            'dist/',
            'package-lock.json',
            '.git/',
            'packs/resource/font/',
            '.github/',
            'Docs/Development/',
            'Docs/',
            'packs/behavior/scripts/',
            'OldAntiCheatsBP/',
            'OldAntiCheatsRP/',
            'src/**/__tests__/',
            'eslint.config.js',
            'package.json'
        ]
    },
    // Base JS configuration
    eslint.configs.recommended,

    // TS Configuration (Type-Checked)
    {
        files: ['src/**/*.ts'],
        extends: [...tseslint.configs.recommendedTypeChecked],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: {
                project: './tsconfig.json',
                tsconfigRootDir: __dirname
            },
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2021,
                system: 'readonly',
                world: 'readonly',
                mc: 'readonly',
                Minecraft: 'readonly',
                'mojang-minecraft': 'readonly',
                'mojang-gametest': 'readonly',
                'mojang-minecraft-ui': 'readonly',
                'mojang-server-admin': 'readonly',
                'mojang-net': 'readonly'
            }
        },
        plugins: {
            'minecraft-linting': minecraftLinting,
            import: importPlugin,
            'unused-imports': unusedImports,
            promise: promisePlugin
        },
        settings: {
            'import/resolver': {
                typescript: {
                    project: './tsconfig.json'
                },
                node: {
                    extensions: ['.js', '.ts']
                }
            },
            'import/core-modules': [
                '@minecraft/server',
                '@minecraft/server-ui',
                '@minecraft/server-gametest',
                '@minecraft/common',
                '@minecraft/diagnostics',
                '@minecraft/debug-utilities',
                '@minecraft/gameplay-utilities',
                '@minecraft/math',
                '@minecraft/vanilla-data'
            ]
        },
        rules: {
            'minecraft-linting/avoid-unnecessary-command': 'error',
            'import/no-unresolved': ['error', { commonjs: true, amd: true }],
            'import/named': 'error',
            'import/namespace': 'error',
            'import/default': 'error',
            'import/export': 'error',
            'import/order': [
                'error',
                {
                    groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
                    'newlines-between': 'always',
                    alphabetize: { order: 'asc', caseInsensitive: true }
                }
            ],
            camelcase: ['error', { properties: 'always', ignoreDestructuring: true, allow: ['^UNSAFE_'] }],
            'no-console': 'warn',
            eqeqeq: ['error', 'always'],
            'no-var': 'error',
            curly: ['error', 'all'],
            'import/no-duplicates': 'error',
            'unused-imports/no-unused-imports': 'error',
            'promise/param-names': 'error',
            'promise/always-return': 'warn',
            'promise/catch-or-return': 'warn',
            'promise/no-return-wrap': 'error',
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-var-requires': 'off',
            '@typescript-eslint/no-shadow': 'error',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-misused-promises': 'error',
            '@typescript-eslint/no-unused-vars': ['warn', { args: 'none' }],
            // Warn for strict type safety rules to facilitate migration
            '@typescript-eslint/no-unsafe-argument': 'warn',
            '@typescript-eslint/no-unsafe-assignment': 'warn',
            '@typescript-eslint/no-unsafe-call': 'warn',
            '@typescript-eslint/no-unsafe-member-access': 'warn',
            '@typescript-eslint/no-unsafe-return': 'warn',
            '@typescript-eslint/no-unsafe-enum-comparison': 'warn',
            '@typescript-eslint/restrict-template-expressions': 'warn',
            '@typescript-eslint/await-thenable': 'warn',
            '@typescript-eslint/require-await': 'warn'
        }
    },

    // JS Configuration (Scripts)
    {
        files: ['scripts/**/*.js'],
        extends: [...tseslint.configs.recommended],
        rules: {
            'no-console': 'off'
        }
    },

    // JSONC configuration
    ...jsonc.configs['flat/recommended-with-jsonc'],
    {
        files: ['**/*.json'],
        rules: {}
    },

    // Prettier
    prettierConfig
);
