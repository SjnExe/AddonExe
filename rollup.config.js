// rollup.config.js
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default {
    input: 'AddonExeBP/scripts/core/main.js',
    output: {
        file: 'AddonExeBP/scripts/dist/bundle.js',
        format: 'es',
        inlineDynamicImports: true
    },
    plugins: [
        nodeResolve({
            preferBuiltins: false
        }),
        commonjs(),
        json()
    ],
    // Exclude Minecraft modules from the bundle, as they are provided by the game environment
    external: [
        '@minecraft/server',
        '@minecraft/server-ui',
        '@minecraft/server-admin',
        '@minecraft/server-gametest'
    ]
};
