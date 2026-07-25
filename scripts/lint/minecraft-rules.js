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
                function isComponentCall(node) {
                    let parent = node.parent;
                    if (parent?.type === 'TemplateLiteral') {
                        parent = parent.parent;
                    }
                    if (parent?.type === 'CallExpression' && parent.callee?.type === 'MemberExpression') {
                        const prop = parent.callee.property?.name;
                        return ['getComponent', 'hasComponent', 'getComponentNet'].includes(prop);
                    }
                    return false;
                }

                return {
                    Literal(node) {
                        if (typeof node.value === 'string' && node.value.startsWith('minecraft:')) {
                            if (!isComponentCall(node)) {
                                context.report({
                                    node,
                                    message: 'Do not use magic strings for Minecraft IDs. Use @minecraft/vanilla-data instead.'
                                });
                            }
                        }
                    },
                    TemplateElement(node) {
                        if (node.value?.raw?.startsWith('minecraft:')) {
                            if (!isComponentCall(node)) {
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
