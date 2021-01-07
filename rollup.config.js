import typescript from 'rollup-plugin-typescript2';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

const plugins = [
    json(),
    resolve(),
    commonjs(),
    typescript(),
];

export default [
    {
        input: 'packages/client/src/extension.ts',
        output: {
            dir: 'node_modules/@volar/client/out',
            format: 'cjs'
        },
        plugins,
    },
    {
        input: 'packages/server/src/server.ts',
        output: {
            dir: 'node_modules/@volar/server/out',
            format: 'cjs'
        },
        external: [
            'vscode-uri',
        ],
        plugins,
    },
];
