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
                const allowedRanges = new Set();

                function getRangeKey(node) {
                    if (!node) {
                        return null;
                    }
                    if (Array.isArray(node.range)) {
                        return node.range.join(':');
                    }
                    if (node.start !== undefined && node.end !== undefined) {
                        return `${node.start}:${node.end}`;
                    }
                    if (node.loc) {
                        return `${node.loc.start.line}:${node.loc.start.column}:${node.loc.end.line}:${node.loc.end.column}`;
                    }
                    return null;
                }

                function preScanAllowedCalls(node) {
                    if (!node || typeof node !== 'object') {
                        return;
                    }
                    if (node.type === 'CallExpression' && node.callee?.type === 'MemberExpression') {
                        const propName = node.callee.property?.name;
                        if (['getComponent', 'hasComponent', 'getComponentNet'].includes(propName)) {
                            for (const arg of node.arguments || []) {
                                const key = getRangeKey(arg);
                                if (key) {
                                    allowedRanges.add(key);
                                }
                                if (arg.type === 'TemplateLiteral') {
                                    for (const quasi of arg.quasis || []) {
                                        const qKey = getRangeKey(quasi);
                                        if (qKey) {
                                            allowedRanges.add(qKey);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    for (const k in node) {
                        if (k === 'parent') {
                            continue;
                        }
                        const child = node[k];
                        if (Array.isArray(child)) {
                            for (const item of child) {
                                if (item && typeof item === 'object' && typeof item.type === 'string') {
                                    preScanAllowedCalls(item);
                                }
                            }
                        } else if (child && typeof child === 'object' && typeof child.type === 'string') {
                            preScanAllowedCalls(child);
                        }
                    }
                }

                return {
                    Program(node) {
                        allowedRanges.clear();
                        preScanAllowedCalls(node);
                    },
                    Literal(node) {
                        if (typeof node.value === 'string' && node.value.startsWith('minecraft:')) {
                            const key = getRangeKey(node);
                            if (!key || !allowedRanges.has(key)) {
                                context.report({
                                    node,
                                    message: 'Do not use magic strings for Minecraft IDs. Use @minecraft/vanilla-data instead.'
                                });
                            }
                        }
                    },
                    TemplateElement(node) {
                        if (node.value?.raw?.startsWith('minecraft:')) {
                            const key = getRangeKey(node);
                            if (!key || !allowedRanges.has(key)) {
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
