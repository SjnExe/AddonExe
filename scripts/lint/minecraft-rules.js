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
                const allowedKeys = new Set();

                function getNodeKey(node) {
                    if (!node) {
                        return null;
                    }
                    if (Array.isArray(node.range)) {
                        return `${node.range[0]}:${node.range[1]}`;
                    }
                    if (typeof node.start === 'number' && typeof node.end === 'number') {
                        return `${node.start}:${node.end}`;
                    }
                    if (node.loc?.start) {
                        return `${node.loc.start.line}:${node.loc.start.column}`;
                    }
                    return null;
                }

                function markAllowed(arg) {
                    if (!arg) {
                        return;
                    }
                    const key = getNodeKey(arg);
                    if (key) {
                        allowedKeys.add(key);
                    }
                    if (arg.type === 'TemplateLiteral') {
                        for (const quasi of arg.quasis || []) {
                            const qKey = getNodeKey(quasi);
                            if (qKey) {
                                allowedKeys.add(qKey);
                            }
                        }
                    }
                }

                return {
                    Program() {
                        allowedKeys.clear();
                    },
                    CallExpression(node) {
                        if (node.callee?.type === 'MemberExpression') {
                            const propName = node.callee.property?.name;
                            if (['getComponent', 'hasComponent', 'getComponentNet'].includes(propName)) {
                                for (const arg of node.arguments || []) {
                                    markAllowed(arg);
                                }
                            }
                        }
                    },
                    Literal(node) {
                        if (typeof node.value === 'string' && node.value.startsWith('minecraft:')) {
                            const key = getNodeKey(node);
                            if (key && allowedKeys.has(key)) {
                                return;
                            }
                            context.report({
                                node,
                                message: 'Do not use magic strings for Minecraft IDs. Use @minecraft/vanilla-data instead.'
                            });
                        }
                    },
                    TemplateElement(node) {
                        if (node.value?.raw?.startsWith('minecraft:')) {
                            const key = getNodeKey(node);
                            if (key && allowedKeys.has(key)) {
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
