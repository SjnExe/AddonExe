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
                const allowedNodes = new Set();

                function getNodeKey(node) {
                    if (!node) {
                        return null;
                    }
                    if (typeof node.span?.start === 'number') {
                        return node.span.start;
                    }
                    if (typeof node.start === 'number') {
                        return node.start;
                    }
                    if (Array.isArray(node.range)) {
                        return node.range[0];
                    }
                    if (node.loc?.start) {
                        return `${node.loc.start.line}:${node.loc.start.column}`;
                    }
                    return null;
                }

                function markAllowed(arg) {
                    const key = getNodeKey(arg);
                    if (key !== null) {
                        allowedNodes.add(key);
                    }
                    if (arg?.type === 'TemplateLiteral') {
                        for (const quasi of arg.quasis || []) {
                            const qKey = getNodeKey(quasi);
                            if (qKey !== null) {
                                allowedNodes.add(qKey);
                            }
                        }
                    }
                }

                function walk(node, visitor) {
                    if (!node || typeof node !== 'object') {
                        return;
                    }
                    visitor(node);
                    for (const key of Object.keys(node)) {
                        if (key === 'parent') {
                            continue;
                        }
                        const child = node[key];
                        if (Array.isArray(child)) {
                            for (const item of child) {
                                if (item && typeof item === 'object' && typeof item.type === 'string') {
                                    walk(item, visitor);
                                }
                            }
                        } else if (child && typeof child === 'object' && typeof child.type === 'string') {
                            walk(child, visitor);
                        }
                    }
                }

                return {
                    Program(rootNode) {
                        allowedNodes.clear();
                        walk(rootNode, (node) => {
                            if (node.type === 'CallExpression' && node.callee?.type === 'MemberExpression') {
                                const propName = node.callee.property?.name;
                                if (['getComponent', 'hasComponent', 'getComponentNet'].includes(propName)) {
                                    for (const arg of node.arguments || []) {
                                        markAllowed(arg);
                                    }
                                }
                            }
                        });
                    },
                    Literal(node) {
                        if (typeof node.value === 'string' && node.value.startsWith('minecraft:')) {
                            const key = getNodeKey(node);
                            if (key !== null && allowedNodes.has(key)) {
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
                            if (key !== null && allowedNodes.has(key)) {
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
