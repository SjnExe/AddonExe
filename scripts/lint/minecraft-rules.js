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
            meta: { type: 'problem', docs: { description: 'Require @minecraft/vanilla-data for identifier strings' } },
            create(context) {
                const allowedStrings = new Set();

                function addAllowedString(arg) {
                    if (!arg) {
                        return;
                    }
                    if (arg.type === 'Literal' && typeof arg.value === 'string') {
                        allowedStrings.add(arg.value);
                    } else if (arg.type === 'TemplateLiteral') {
                        for (const quasi of arg.quasis || []) {
                            if (quasi.value?.raw) {
                                allowedStrings.add(quasi.value.raw);
                            }
                            if (quasi.value?.cooked) {
                                allowedStrings.add(quasi.value.cooked);
                            }
                        }
                    }
                }

                return {
                    Program() {
                        allowedStrings.clear();
                    },
                    CallExpression(node) {
                        if (node.callee?.type === 'MemberExpression') {
                            const propName = node.callee.property?.name;
                            if (['getComponent', 'hasComponent', 'getComponentNet'].includes(propName)) {
                                for (const arg of node.arguments || []) {
                                    addAllowedString(arg);
                                }
                            }
                        }
                    },
                    Literal(node) {
                        if (typeof node.value === 'string' && node.value.startsWith('minecraft:')) {
                            if (allowedStrings.has(node.value)) {
                                return;
                            }
                            context.report({
                                node,
                                message: 'Do not use magic strings for Minecraft IDs. Use @minecraft/vanilla-data instead.'
                            });
                        }
                    },
                    TemplateElement(node) {
                        const raw = node.value?.raw;
                        if (typeof raw === 'string' && raw.startsWith('minecraft:')) {
                            if (allowedStrings.has(raw)) {
                                return;
                            }
                            context.report({
                                node,
                                message: 'Do not use magic strings for Minecraft IDs. Use @minecraft/vanilla-data instead.'
                            });
                        }
                    }
                };
            }
        }
    }
};
