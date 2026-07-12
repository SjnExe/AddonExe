// @ts-check

import eslint from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import jsonc from 'eslint-plugin-jsonc';
import minecraftLinting from 'eslint-plugin-minecraft-linting';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default tseslint.config(
    {
        ignores: ['node_modules/', 'dist/', 'package-lock.json', '.git/', 'packs/resource/font/', '.github/', 'Docs/', '**/packs/behavior/scripts/**', 'package.json']
    },
    // Base JS configuration
    eslint.configs.recommended,

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
            import: importPlugin
        },
        settings: {
            'import/resolver': {
                node: {
                    extensions: ['.js', '.ts']
                }
            },
            'import/core-modules': [
                '@minecraft/server',
                '@minecraft/server-ui',
                '@minecraft/server-gametest',
                '@minecraft/common',
                '@minecraft/debug-utilities',
                '@minecraft/gameplay-utilities',
                '@minecraft/math',
                '@minecraft/vanilla-data'
            ]
        },
        rules: {
            'minecraft-linting/avoid-unnecessary-command': 'error',
            'import/no-unresolved': 'off',
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
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-var-requires': 'error',
            '@typescript-eslint/no-shadow': 'error',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-misused-promises': 'error',
            '@typescript-eslint/no-unused-vars': ['error', { args: 'all', argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-unsafe-argument': 'error',
            '@typescript-eslint/no-unsafe-assignment': 'error',
            '@typescript-eslint/no-unsafe-call': 'error',
            '@typescript-eslint/no-unsafe-member-access': 'error',
            '@typescript-eslint/no-unsafe-return': 'error',
            '@typescript-eslint/no-unsafe-enum-comparison': 'error',
            '@typescript-eslint/ban-ts-comment': ['error', { 'ts-ignore': 'allow-with-description', 'ts-nocheck': true, 'ts-check': false }],
            '@typescript-eslint/restrict-template-expressions': 'error',
            '@typescript-eslint/only-throw-error': 'error',
            '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' }],
            '@typescript-eslint/await-thenable': 'error',
            '@typescript-eslint/require-await': 'error',
            '@typescript-eslint/switch-exhaustiveness-check': 'error',
            '@typescript-eslint/prefer-readonly': 'error',
            '@typescript-eslint/no-unnecessary-condition': 'error',
            '@typescript-eslint/no-unnecessary-type-assertion': 'error',
            'no-restricted-syntax': [
                'error',
                {
                    selector: 'CallExpression[callee.property.name="runCommandAsync"]',
                    message: 'runCommandAsync is deprecated. Please use native APIs.'
                },
                {
                    selector: 'Literal[value=/^minecraft:/]:not(CallExpression[callee.property.name=/^(getComponent|hasComponent|getComponentNet)$/] > Literal)',
                    message: 'Do not use magic strings for Minecraft IDs. Use @minecraft/vanilla-data instead.'
                },
                {
                    selector:
                        'TemplateLiteral > TemplateElement:first-child[value.raw=/^minecraft:/]:not(CallExpression[callee.property.name=/^(getComponent|hasComponent|getComponentNet)$/] > TemplateLiteral > TemplateElement)',
                    message: 'Do not use magic strings for Minecraft IDs. Use @minecraft/vanilla-data instead.'
                }
            ]
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
                vi: 'readonly',
                describe: 'readonly',
                it: 'readonly',
                expect: 'readonly',
                test: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly'
            }
        },
        plugins: {
            import: importPlugin
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

    // Configuration (Scripts)
    {
        files: ['scripts/**/*.{js,ts}'],
        extends: [...tseslint.configs.recommended],
        rules: {
            'no-console': 'off',
            'unicorn/no-process-exit': 'off',
            'unicorn/prefer-top-level-await': 'off',
            '@typescript-eslint/no-explicit-any': 'off'
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
