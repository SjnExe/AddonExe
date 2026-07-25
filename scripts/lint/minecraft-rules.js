export default {
    meta: {
        name: 'minecraft-custom',
        version: '1.0.0'
    },
    rules: {
        'no-deprecated-run-command': {
            meta: { type: 'problem', docs: { description: 'Ban deprecated runCommandAsync calls' } },
            create(context) {
                return {
                    CallExpression(node) {
                        if (node.callee?.type === 'MemberExpression' && node.callee.property?.name === 'runCommandAsync') {
                            context.report({
                                node,
                                message: 'runCommandAsync is deprecated. Please use native APIs.'
                            });
                        }
                    }
                };
            }
        },
        'no-magic-minecraft-strings': {
            meta: { type: 'suggestion', docs: { description: 'Require @minecraft/vanilla-data for identifier strings' } },
            create(context) {
                const allowedStrings = new Set(['minecraft:', 'minecraft:script_unload']);
                return {
                    Literal(node) {
                        if (typeof node.value === 'string' && node.value.startsWith('minecraft:') && !allowedStrings.has(node.value)) {
                            context.report({
                                node,
                                message: `Do not use magic string '${node.value}'. Use @minecraft/vanilla-data enums instead.`
                            });
                        }
                    },
                    TemplateElement(node) {
                        const raw = node.value?.raw;
                        if (typeof raw === 'string' && raw.startsWith('minecraft:') && !allowedStrings.has(raw)) {
                            context.report({
                                node,
                                message: `Do not use magic string '${raw}'. Use @minecraft/vanilla-data enums instead.`
                            });
                        }
                    }
                };
            }
        }
    }
};
