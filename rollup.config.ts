import nodePolyfills from 'rollup-plugin-polyfill-node';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

/** @type {import('rollup').RollupOptions} */
export default {
    plugins: [
        typescript({
            module: 'esnext',
            exclude: [
                "**/__tests__",
                "**/*.test.ts",
                "jest.config.ts"
            ],
            tsconfig: './tsconfig.rollup.json',
            sourceMap: true
        }),
        commonjs(),
        resolve(),
        babel({
            babelHelpers: 'bundled'
        }),
        nodePolyfills(),
        terser()
    ],
    output: {
        format: 'umd',
        name: 'Delegua',
        sourcemap: 'inline',
        file: 'dist/umd/delegua.js'
    }
}
