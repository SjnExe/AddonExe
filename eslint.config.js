// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import jsonc from 'eslint-plugin-jsonc';
import importPlugin from 'eslint-plugin-import';
import path from 'path';
import { fileURLToPath } from 'url';

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
        plugins: {
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
            'import/core-modules': ['@minecraft/server', '@minecraft/server-ui']
        },
        rules: {
            // Import rules
            'import/no-unresolved': ['error', { commonjs: true, amd: true }],
            'import/named': 'error',
            'import/namespace': 'error',
            'import/default': 'error',
            'import/export': 'error',

            camelcase: ['error', { properties: 'always', ignoreDestructuring: true, allow: ['^UNSAFE_'] }],
            quotes: ['error', 'single', { avoidEscape: true }],
            semi: ['error', 'always'],
            'no-trailing-spaces': 'error',
            'no-unused-vars': 'off', // handled by TS
            '@typescript-eslint/no-unused-vars': ['warn', { args: 'none' }],
            'no-undef': 'off', // handled by TS
            'object-curly-spacing': ['error', 'always'],
            'comma-dangle': ['error', 'never'],
            'no-console': 'warn',
            'key-spacing': ['error', { beforeColon: false, afterColon: true }],
            'keyword-spacing': ['error', { before: true, after: true }],
            'space-before-function-paren': [
                'error',
                {
                    anonymous: 'always',
                    named: 'never',
                    asyncArrow: 'always'
                }
            ],
            'arrow-spacing': ['error', { before: true, after: true }],
            curly: ['error', 'all'],
            eqeqeq: ['error', 'always'],
            'no-var': 'error',
            'comma-spacing': ['error', { before: false, after: true }],
            'space-infix-ops': 'error',
            'space-in-parens': ['error', 'never'],
            'space-before-blocks': 'error',
            'max-len': [
                'warn',
                {
                    code: 256,
                    ignoreUrls: true,
                    ignoreStrings: true,
                    ignoreTemplateLiterals: true,
                    ignoreRegExpLiterals: true
                }
            ],

            // TS specific
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-var-requires': 'off'
        }
    },
    // JSONC configuration
    ...jsonc.configs['flat/recommended-with-jsonc'],
    {
        files: ['**/*.json'],
        rules: {
            'jsonc/indent': ['error', 4],
            'jsonc/object-curly-spacing': ['error', 'always'],
            'jsonc/array-bracket-spacing': ['error', 'never'],
            'jsonc/comma-dangle': ['error', 'never'],
            'jsonc/key-spacing': ['error', { beforeColon: false, afterColon: true }],
            'jsonc/object-curly-newline': ['error', { multiline: true, consistent: true }],
            'jsonc/object-property-newline': ['error', { allowAllPropertiesOnSameLine: true }]
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
    }
);
