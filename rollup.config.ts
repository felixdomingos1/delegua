import nodePolyfills from 'rollup-plugin-polyfill-node';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

/**
 * Nós tentamos usar o Rollup para gerar um UMD de Delégua, mas ele cria problemas com o `antlr4ts`.
 * O método escolhido para gerar o UMD é o mesmo de `delegua-web`, usando o Browserify, que
 * não cria problemas.
 * 
 * Essa configuração é mantida aqui porque pode ser interessante para outros projetos da Design
 * Líquido que se beneficiem desse tipo de conhecimento.
 */
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
        resolve({
            browser: true
        }),
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
