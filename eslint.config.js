// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import jsonc from 'eslint-plugin-jsonc';
import importPlugin from 'eslint-plugin-import';
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
            import: importPlugin
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
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-var-requires': 'off',
            '@typescript-eslint/no-shadow': 'error',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-misused-promises': 'error',
            '@typescript-eslint/no-unused-vars': ['warn', { args: 'none' }],
            // Disable strict type safety rules for now to facilitate migration
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            '@typescript-eslint/no-unsafe-enum-comparison': 'off',
            '@typescript-eslint/restrict-template-expressions': 'off',
            '@typescript-eslint/await-thenable': 'off',
            '@typescript-eslint/require-await': 'off'
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
