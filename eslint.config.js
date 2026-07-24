// @ts-check

import eslint from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import minecraftLinting from 'eslint-plugin-minecraft-linting';
import oxlint from 'eslint-plugin-oxlint';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: ['node_modules/', 'dist/', 'package-lock.json', '.git/', 'packs/resource/font/', '.github/', 'Docs/', '**/packs/behavior/scripts/**', 'package.json', 'packs/**']
    },
    eslint.configs.recommended,

    // TS Configuration (Pure AST Parsing) - Main Source
    {
        files: ['src/**/*.ts'],
        ignores: ['src/**/__tests__/**'],
        extends: [...tseslint.configs.recommended],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.bun,
                ...globals.node,
                ...globals.browser,
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
        rules: {
            // Minecraft Domain Specific Rules
            'minecraft-linting/avoid-unnecessary-command': 'error',
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
            ],

            // Handled natively by TypeScript (bun tsc) and Oxlint
            'import/no-unresolved': 'off',
            'import/no-cycle': 'off',
            'import/named': 'off',
            'import/namespace': 'off',
            'import/default': 'off',
            'import/export': 'off',
            'import/no-duplicates': 'error',

            // Code Quality & Formatting
            camelcase: ['error', { properties: 'always', ignoreDestructuring: true, allow: ['^UNSAFE_'] }],
            'no-console': 'warn',
            eqeqeq: ['error', 'always'],
            'no-var': 'error',
            curly: ['error', 'all'],
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-shadow': 'error',
            '@typescript-eslint/no-unused-vars': ['error', { args: 'all', argsIgnorePattern: '^_' }],
            '@typescript-eslint/ban-ts-comment': ['error', { 'ts-ignore': 'allow-with-description', 'ts-nocheck': true, 'ts-check': false }]
        }
    },

    // TS Configuration (Test Files)
    {
        files: ['src/**/__tests__/**/*.ts'],
        extends: [...tseslint.configs.recommended],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.bun,
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
            'no-console': 'off',
            'import/no-unresolved': 'off'
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
        languageOptions: {
            globals: {
                ...globals.bun,
                ...globals.node
            }
        },
        rules: {
            'no-console': 'off',
            '@typescript-eslint/no-explicit-any': 'off'
        }
    },

    ...oxlint.configs['flat/recommended'],
    prettierConfig
);
