// @ts-check

import eslint from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import jsonc from 'eslint-plugin-jsonc';
import minecraftLinting from 'eslint-plugin-minecraft-linting';
import promisePlugin from 'eslint-plugin-promise';
import sonarjs from 'eslint-plugin-sonarjs';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import path from 'path';
import tseslint from 'typescript-eslint';
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
            'packs/resource/font/',
            '.github/',
            'Docs/Development/',
            'Docs/',
            '**/packs/behavior/scripts/**',
            'OldAntiCheatsBP/',
            'OldAntiCheatsRP/',
            // 'src/**/__tests__/', // Removed to enable linting for tests
            'eslint.config.js',
            'package.json'
        ]
    },
    // Base JS configuration
    eslint.configs.recommended,

    // SonarJS Configuration
    sonarjs.configs.recommended,
    {
        rules: {
            // Disable rules that conflict with strict TS or are too noisy for this project
            'sonarjs/no-duplicate-string': 'off', // Common in Minecraft commands/IDs
            'sonarjs/cognitive-complexity': ['warn', 25], // Allow slightly higher complexity
            'sonarjs/no-nested-template-literals': 'off',
            'sonarjs/todo-tag': 'warn',
            'sonarjs/fixme-tag': 'warn',
            'sonarjs/pseudo-random': 'off' // Safe for Minecraft game mechanics
        }
    },

    // Unicorn Configuration
    eslintPluginUnicorn.configs['flat/recommended'],
    {
        rules: {
            'unicorn/filename-case': 'off',
            'unicorn/prevent-abbreviations': 'off',
            'unicorn/no-null': 'off'
        }
    },

    // TS Configuration (Type-Checked) - Main Source
    {
        files: ['src/**/*.ts'],
        ignores: ['src/**/__tests__/**'], // Ignore tests in main config
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
            'import/no-cycle': 'error',
            'import/named': 'error',
            'import/namespace': 'error',
            'import/default': 'error',
            'import/export': 'error',
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
            '@typescript-eslint/no-var-requires': 'error',
            '@typescript-eslint/no-shadow': 'error',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-misused-promises': 'error',
            '@typescript-eslint/no-unused-vars': ['error', { args: 'all', argsIgnorePattern: '^_' }],
            // Strict type safety rules - Upgraded to error
            '@typescript-eslint/no-unsafe-argument': 'error',
            '@typescript-eslint/no-unsafe-assignment': 'error',
            '@typescript-eslint/no-unsafe-call': 'error',
            '@typescript-eslint/no-unsafe-member-access': 'error',
            '@typescript-eslint/no-unsafe-return': 'error',
            '@typescript-eslint/no-unsafe-enum-comparison': 'error',
            '@typescript-eslint/restrict-template-expressions': 'error',
            '@typescript-eslint/only-throw-error': 'error',
            '@typescript-eslint/consistent-type-assertions': [
                'error',
                { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' }
            ],
            '@typescript-eslint/await-thenable': 'error',
            '@typescript-eslint/require-await': 'error',
            '@typescript-eslint/switch-exhaustiveness-check': 'error',
            '@typescript-eslint/prefer-readonly': 'error',

            // NEW STRICT RULES
            '@typescript-eslint/no-unnecessary-condition': 'error',
            '@typescript-eslint/strict-boolean-expressions': 'error',
            '@typescript-eslint/no-unnecessary-type-assertion': 'error'
        }
    },

    // TS Configuration (Test Files)
    {
        files: ['src/**/__tests__/**/*.ts'],
        extends: [...tseslint.configs.recommendedTypeChecked],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: {
                project: './tsconfig.test.json',
                tsconfigRootDir: __dirname
            },
            globals: {
                ...globals.node,
                jest: 'readonly'
            }
        },
        plugins: {
            import: importPlugin
        },
        settings: {
            'import/resolver': {
                typescript: {
                    project: './tsconfig.test.json'
                }
            }
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/unbound-method': 'off',
            '@typescript-eslint/require-await': 'off',
            '@typescript-eslint/no-floating-promises': 'off',
            'no-console': 'off',
            'import/no-unresolved': 'off',
            'unicorn/no-useless-undefined': 'off'
        }
    },

    // Override for Logger
    {
        files: ['src/core/logger.ts'],
        rules: {
            'no-console': 'off'
        }
    },

    // JS Configuration (Scripts)
    {
        files: ['scripts/**/*.js'],
        extends: [...tseslint.configs.recommended],
        rules: {
            'no-console': 'off',
            'unicorn/no-process-exit': 'off',
            'unicorn/prefer-top-level-await': 'off'
        }
    },

    // JSONC configuration
    ...jsonc.configs['flat/recommended-with-jsonc'],
    {
        files: ['**/*.json'],
        rules: {
            'sonarjs/no-empty-test-file': 'off'
        }
    },

    // Prettier
    prettierConfig
);
