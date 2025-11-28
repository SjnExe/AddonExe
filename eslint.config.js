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
            'AddonExeRP/font/',
            '.github/',
            'Dev/',
            'Docs/',
            'AddonExeBP/scripts/',
            'OldAntiCheatsBP/',
            'OldAntiCheatsRP/',
            'eslint.config.js',
            'package.json'
        ]
    },
    // Base JS/TS configuration
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.js', '**/*.ts'],
        plugins: {
            'minecraft-linting': minecraftLinting,
            import: importPlugin
        },
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2021,
                // Minecraft Bedrock Scripting API globals
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
            // Import rules
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
            'no-unused-vars': 'off', // handled by TS
            '@typescript-eslint/no-unused-vars': ['warn', { args: 'none' }],
            'no-undef': 'off', // handled by TS
            'no-console': 'warn',
            eqeqeq: ['error', 'always'],
            'no-var': 'error',
            curly: ['error', 'all'],
            'import/no-duplicates': 'error',

            // TS specific
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-var-requires': 'off',
            '@typescript-eslint/no-shadow': 'error'
        }
    },

    // JSONC configuration
    ...jsonc.configs['flat/recommended-with-jsonc'],
    {
        files: ['**/*.json'],
        rules: {
            // Add any non-stylistic JSON rules here if needed in the future
        }
    },
    // Jest test file configuration
    {
        files: ['**/__tests__/**/*.js', '**/__tests__/**/*.ts'],
        languageOptions: {
            globals: {
                ...globals.jest
            }
        }
    },
    // Scripts configuration
    {
        files: ['scripts/**/*.js'],
        rules: {
            'no-console': 'off'
        }
    },

    // Prettier config must be last to override other formatting rules
    prettierConfig
);
