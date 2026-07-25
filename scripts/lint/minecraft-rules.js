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
                const allowedNodes = new WeakSet();

                return {
                    CallExpression(node) {
                        if (node.callee?.type === 'MemberExpression') {
                            const propName = node.callee.property?.name;
                            if (['getComponent', 'hasComponent', 'getComponentNet'].includes(propName)) {
                                for (const arg of node.arguments || []) {
                                    if (arg.type === 'Literal') {
                                        allowedNodes.add(arg);
                                    } else if (arg.type === 'TemplateLiteral') {
                                        for (const quasi of arg.quasis || []) {
                                            allowedNodes.add(quasi);
                                        }
                                    }
                                }
                            }
                        }
                    },
                    Literal(node) {
                        if (typeof node.value === 'string' && node.value.startsWith('minecraft:')) {
                            if (!allowedNodes.has(node)) {
                                context.report({
                                    node,
                                    message: 'Do not use magic strings for Minecraft IDs. Use @minecraft/vanilla-data instead.'
                                });
                            }
                        }
                    },
                    TemplateElement(node) {
                        if (node.value?.raw?.startsWith('minecraft:')) {
                            if (!allowedNodes.has(node)) {
                                context.report({
                                    node,
                                    message: 'Do not use magic strings for Minecraft IDs. Use @minecraft/vanilla-data instead.'
                                });
                            }
                        }
                    }
                };
            }
        }
    }
};
