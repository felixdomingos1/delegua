import { Lexador } from '../fontes/lexador';

import tiposDeSimbolos from '../fontes/tipos-de-simbolos/delegua';

describe('Lexador', () => {
    describe('mapear()', () => {
        let lexador: Lexador;

        beforeEach(() => {
            lexador = new Lexador();
        });

        describe('Cenários de sucesso', () => {
            it('Sucesso - Vetor de código vazio', () => {
                const resultado = lexador.mapear([], -1);

                expect(resultado).toBeTruthy();
                expect(resultado.simbolos).toHaveLength(0);
                expect(resultado.erros).toHaveLength(0);
            });

            it('Sucesso - Código vazio', () => {
                const resultado = lexador.mapear([''], -1);

                expect(resultado).toBeTruthy();
                expect(resultado.simbolos).toHaveLength(0);
            });

            it('Sucesso - Ponto-e-vírgula, opcional', () => {
                const resultado = lexador.mapear([';;;;;;;;;;;;;;;;;;;;;'], -1);

                expect(resultado).toBeTruthy();
                expect(resultado.simbolos).toHaveLength(21);
            });

            it('Sucesso - Olá mundo', () => {
                const resultado = lexador.mapear(["escreva('Olá mundo')"], -1);

                expect(resultado).toBeTruthy();
                expect(resultado.simbolos).toHaveLength(4);
                expect(resultado.simbolos).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({ tipo: tiposDeSimbolos.ESCREVA }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.PARENTESE_ESQUERDO }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.TEXTO }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.PARENTESE_DIREITO }),
                    ])
                );
            });

            it('Sucesso - Soma - Maior Igual', () => {
                const resultado = lexador.mapear(["var valor = 1", "valor += 2"], -1);

                expect(resultado).toBeTruthy();
                expect(resultado.simbolos).toHaveLength(7);
                expect(resultado.simbolos).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({ tipo: tiposDeSimbolos.VARIAVEL }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.IGUAL }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.NUMERO }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.IDENTIFICADOR }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.MAIS_IGUAL }),
                    ])
                );
            });

            it('Sucesso - Subtração - Menor Igual', () => {
                const resultado = lexador.mapear(["var valor = 5", "valor -= 2"], -1);

                expect(resultado).toBeTruthy();
                expect(resultado.simbolos).toHaveLength(7);
                expect(resultado.simbolos).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({ tipo: tiposDeSimbolos.VARIAVEL }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.IDENTIFICADOR }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.IGUAL }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.NUMERO }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.MENOS_IGUAL }),
                    ])
                );
            });

            it('Sucesso - Multiplicação Igual', () => {
                const resultado = lexador.mapear(["var valor = 5", "valor *= 2"], -1);

                expect(resultado).toBeTruthy();
                expect(resultado.simbolos).toHaveLength(7);
                expect(resultado.simbolos).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({ tipo: tiposDeSimbolos.VARIAVEL }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.IGUAL }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.NUMERO }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.IDENTIFICADOR }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.MULTIPLICACAO_IGUAL }),
                    ])
                );
            });

            it('Sucesso - Diferente Igual', () => {
                const resultado = lexador.mapear(["1 != 2"], -1);

                expect(resultado).toBeTruthy();
                expect(resultado.simbolos).toHaveLength(3);
                expect(resultado.simbolos).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({ tipo: tiposDeSimbolos.NUMERO }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.DIFERENTE }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.NUMERO }),
                    ])
                );
            });

            it('Sucesso - Divisão Igual', () => {
                const resultado = lexador.mapear(["var valor = 10", "valor /= 2"], -1);

                expect(resultado).toBeTruthy();
                expect(resultado.simbolos).toHaveLength(7);
                expect(resultado.simbolos).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({ tipo: tiposDeSimbolos.VARIAVEL }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.IDENTIFICADOR }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.IGUAL }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.NUMERO }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.DIVISAO_IGUAL }),
                    ])
                );
            });

            it('Sucesso - Módulo Igual', () => {
                const resultado = lexador.mapear(["var valor = 5", "valor %= 2"], -1);

                expect(resultado).toBeTruthy();
                expect(resultado.simbolos).toHaveLength(7);
                expect(resultado.simbolos).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({ tipo: tiposDeSimbolos.VARIAVEL }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.IDENTIFICADOR }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.IGUAL }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.NUMERO }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.MODULO_IGUAL }),
                    ])
                );
            });

            it('Sucesso - Comentários multilinha', () => {
                const resultado = lexador.mapear(["/* comentário ", "outro comentário*/"], -1);

                expect(resultado).toBeTruthy();
                expect(resultado.simbolos).toHaveLength(2);
                expect(resultado.simbolos[0].tipo).toBe(tiposDeSimbolos.LINHA_COMENTARIO);
                expect(resultado.simbolos[1].tipo).toBe(tiposDeSimbolos.LINHA_COMENTARIO);
            });

            it('Sucesso - Comentários de uma linha', () => {
                const resultado = lexador.mapear(["// comentário ", "// outro comentário"], -1);

                expect(resultado).toBeTruthy();
                expect(resultado.simbolos).toHaveLength(2);
                expect(resultado.simbolos[0].tipo).toBe(tiposDeSimbolos.COMENTARIO);
                expect(resultado.simbolos[1].tipo).toBe(tiposDeSimbolos.COMENTARIO);
            });

            it('Sucesso - Se', () => {
                const resultado = lexador.mapear(["se (1 == 1) { escreva('Tautologia') }"], -1);

                expect(resultado).toBeTruthy();
                expect(resultado.simbolos).toHaveLength(12);
                expect(resultado.simbolos).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({ tipo: tiposDeSimbolos.SE }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.ESCREVA }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.PARENTESE_ESQUERDO }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.TEXTO }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.PARENTESE_DIREITO }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.CHAVE_ESQUERDA }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.CHAVE_DIREITA }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.IGUAL_IGUAL }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.NUMERO }),
                    ])
                );
            });

            it('Sucesso - Operação Matemática (soma e igualdade)', () => {
                const resultado = lexador.mapear(['2 + 3 == 5'], -1);

                expect(resultado).toBeTruthy();
                expect(resultado.simbolos).toHaveLength(5);
                expect(resultado.simbolos).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({ tipo: tiposDeSimbolos.ADICAO }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.IGUAL_IGUAL }),
                        expect.objectContaining({ tipo: tiposDeSimbolos.NUMERO }),
                    ])
                );
            });

            it('Sucesso - Atribução de variável e Operação Matemática (diferença, multiplicação e módulo)', () => {
                const resultado = lexador.mapear(['var numero = 1 * 2 - 3 % 4'], -1);

                expect(resultado).toBeTruthy();
            });
        });

        describe('Cenários de falha', () => {
            it('Falha léxica - texto sem fim', () => {
                const resultado = lexador.mapear(['"texto sem fim'], -1);
                expect(resultado.simbolos).toHaveLength(0);
                expect(resultado.erros).toHaveLength(1);
            });

            it('Falha léxica - caractere inesperado', () => {
                const resultado = lexador.mapear(['平'], -1);
                expect(resultado.simbolos).toHaveLength(0);
                expect(resultado.erros).toHaveLength(1);
            });
        });
    });
});
