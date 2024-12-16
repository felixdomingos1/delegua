import hrtime from 'browser-process-hrtime';
import tipoDeDadosDelegua from '../tipos-de-dados/delegua';
import tiposDeSimbolos from '../tipos-de-simbolos/delegua';

import {
    AcessoIndiceVariavel,
    AcessoMetodoOuPropriedade,
    Agrupamento,
    AtribuicaoPorIndice,
    Atribuir,
    Binario,
    Chamada,
    Comentario,
    Construto,
    Decorador,
    DefinirValor,
    Dicionario,
    ExpressaoRegular,
    FuncaoConstruto,
    Isto,
    Literal,
    Logico,
    Super,
    TipoDe,
    Unario,
    Variavel,
    Vetor,
} from '../construtos';
import { AvaliadorSintaticoInterface, ParametroInterface, SimboloInterface } from '../interfaces';

import { ErroAvaliadorSintatico } from './erro-avaliador-sintatico';

import { SeletorTuplas, Tupla } from '../construtos/tuplas';
import {
    Bloco,
    Classe,
    Const,
    Continua,
    Declaracao,
    Enquanto,
    Escolha,
    Escreva,
    Expressao,
    Falhar,
    Fazer,
    FuncaoDeclaracao,
    Importar,
    Leia,
    Para,
    ParaCada,
    PropriedadeClasse,
    Retorna,
    Se,
    Sustar,
    TendoComo,
    Tente,
    Var,
} from '../declaracoes';
import { RetornoAvaliadorSintatico } from '../interfaces/retornos/retorno-avaliador-sintatico';
import { RetornoLexador } from '../interfaces/retornos/retorno-lexador';
import { Simbolo } from '../lexador';
import { TipoDadosElementar } from '../tipo-dados-elementar';
import { RetornoDeclaracao } from './retornos';
import { AvaliadorSintaticoBase } from './avaliador-sintatico-base';
import { inferirTipoVariavel, tipoInferenciaParaTipoDadosElementar } from '../inferenciador';
import { TipoInferencia } from '../inferenciador';
import { PilhaEscopos } from './pilha-escopos';
import { InformacaoEscopo } from './informacao-escopo';

// Será usado para forçar tipagem em construtos e em algumas funções internas.
type TipoDeSimboloDelegua = (typeof tiposDeSimbolos)[keyof typeof tiposDeSimbolos];

/**
 * O avaliador sintático (_Parser_) é responsável por transformar os símbolos do Lexador em estruturas de alto nível.
 * Essas estruturas de alto nível são as partes que executam lógica de programação de fato.
 * Há dois grupos de estruturas de alto nível: Construtos e Declarações.
 */
export class AvaliadorSintatico
    extends AvaliadorSintaticoBase
    implements AvaliadorSintaticoInterface<SimboloInterface, Declaracao>
{
    pilhaDecoradores: Decorador[];
    simbolos: SimboloInterface[];
    erros: ErroAvaliadorSintatico[];
    tiposDefinidosEmCodigo: { [key: string]: Declaracao };
    pilhaEscopos: PilhaEscopos;
    tiposDeFerramentasExternas: {[key: string]: {[key: string]: string}};

    hashArquivo: number;
    atual: number;
    blocos: number;
    performance: boolean;

    constructor(performance = false) {
        super();
        this.hashArquivo = 0;
        this.atual = 0;
        this.blocos = 0;
        this.erros = [];
        this.performance = performance;
        this.tiposDefinidosEmCodigo = {};
        this.tiposDeFerramentasExternas = {};
        this.pilhaEscopos = new PilhaEscopos();
    }

    protected verificarDefinicaoTipoAtual(): string {
        const tipos = [...Object.values(tipoDeDadosDelegua)];

        if (this.simbolos[this.atual].lexema in this.tiposDefinidosEmCodigo) {
            return this.simbolos[this.atual].lexema;
        }

        const lexemaElementar = this.simbolos[this.atual].lexema.toLowerCase();
        const tipoElementarResolvido = tipos.find((tipo) => tipo === lexemaElementar);
        if (!tipoElementarResolvido) {
            throw this.erro(
                this.simbolos[this.atual],
                `Tipo de dados desconhecido: '${this.simbolos[this.atual].lexema}'.`
            );
        }

        if (this.verificarTipoProximoSimbolo(tiposDeSimbolos.COLCHETE_ESQUERDO)) {
            const tiposVetores = ['inteiro[]', 'numero[]', 'número[]', 'qualquer[]', 'real[]', 'texto[]'];
            this.avancarEDevolverAnterior();

            if (!this.verificarTipoProximoSimbolo(tiposDeSimbolos.COLCHETE_DIREITO)) {
                throw this.erro(
                    this.simbolos[this.atual],
                    `Esperado símbolo de fechamento do vetor: ']'. Atual: ${this.simbolos[this.atual].lexema}`
                );
            }

            const tipoVetor = tiposVetores.find((tipo) => tipo === `${lexemaElementar}[]`);
            this.avancarEDevolverAnterior();
            return tipoVetor as TipoDadosElementar;
        }

        return tipoElementarResolvido as TipoDadosElementar;
    }

    override primario(): Construto {
        const simboloAtual = this.simbolos[this.atual];
        let valores = [];
        switch (simboloAtual.tipo) {
            case tiposDeSimbolos.CHAVE_ESQUERDA:
                this.avancarEDevolverAnterior();
                const chaves = [];
                valores = [];

                if (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.CHAVE_DIREITA)) {
                    return new Dicionario(this.hashArquivo, Number(simboloAtual.linha), [], []);
                }

                while (!this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.CHAVE_DIREITA)) {
                    const chave = this.atribuir();
                    this.consumir(tiposDeSimbolos.DOIS_PONTOS, "Esperado ':' entre chave e valor.");
                    const valor = this.atribuir();

                    chaves.push(chave);
                    valores.push(valor);

                    if (this.simbolos[this.atual].tipo !== tiposDeSimbolos.CHAVE_DIREITA) {
                        this.consumir(tiposDeSimbolos.VIRGULA, 'Esperado vírgula antes da próxima expressão.');
                    }
                }

                return new Dicionario(this.hashArquivo, Number(simboloAtual.linha), chaves, valores);

            case tiposDeSimbolos.COLCHETE_ESQUERDO:
                this.avancarEDevolverAnterior();
                valores = [];

                if (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.COLCHETE_DIREITO)) {
                    return new Vetor(this.hashArquivo, Number(simboloAtual.linha), [], 0, 'qualquer');
                }

                while (!this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.COLCHETE_DIREITO)) {
                    let valor: any = null;
                    if (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.PARENTESE_ESQUERDO)) {
                        const expressao = this.expressao();
                        const argumentos = [expressao];
                        while (this.simbolos[this.atual].tipo === tiposDeSimbolos.VIRGULA) {
                            this.avancarEDevolverAnterior();
                            argumentos.push(this.expressao());
                        }

                        this.consumir(tiposDeSimbolos.PARENTESE_DIREITO, "Esperado ')' após a expressão.");
                        this.consumir(tiposDeSimbolos.COLCHETE_DIREITO, "Esperado ']' após a expressão.");
                        return new SeletorTuplas(...argumentos) as Tupla;
                    }

                    valor = this.atribuir();
                    valores.push(valor);
                    if (this.simbolos[this.atual].tipo !== tiposDeSimbolos.COLCHETE_DIREITO) {
                        this.consumir(tiposDeSimbolos.VIRGULA, 'Esperado vírgula antes da próxima expressão.');
                    }
                }

                const tipoVetor = inferirTipoVariavel(valores);
                return new Vetor(this.hashArquivo, Number(simboloAtual.linha), valores, valores.length, tipoVetor);

            case tiposDeSimbolos.FALSO:
                this.avancarEDevolverAnterior();
                return new Literal(this.hashArquivo, Number(simboloAtual.linha), false, 'lógico');

            case tiposDeSimbolos.FUNCAO:
            case tiposDeSimbolos.FUNÇÃO:
                const simboloFuncao = this.avancarEDevolverAnterior();
                return this.corpoDaFuncao(simboloFuncao.lexema);

            case tiposDeSimbolos.IDENTIFICADOR:
                const simboloIdentificador: SimboloInterface = this.avancarEDevolverAnterior();
                let tipoOperando: string;
                if (simboloIdentificador.lexema in this.tiposDefinidosEmCodigo) {
                    tipoOperando = simboloIdentificador.lexema;
                } else {
                    tipoOperando = this.pilhaEscopos.obterTipoVariavelPorNome(simboloIdentificador.lexema);
                }

                // Se o próximo símbolo é um incremento ou um decremento,
                // aqui deve retornar um unário correspondente.
                // Caso contrário, apenas retornar um construto de variável.
                if (
                    this.simbolos[this.atual] &&
                    [tiposDeSimbolos.INCREMENTAR, tiposDeSimbolos.DECREMENTAR].includes(this.simbolos[this.atual].tipo)
                ) {
                    const simboloIncrementoDecremento: SimboloInterface = this.avancarEDevolverAnterior();
                    return new Unario(
                        this.hashArquivo,
                        simboloIncrementoDecremento,
                        new Variavel(this.hashArquivo, simboloIdentificador, tipoOperando),
                        'DEPOIS'
                    );
                }

                return new Variavel(this.hashArquivo, simboloIdentificador, tipoOperando);

            case tiposDeSimbolos.IMPORTAR:
                this.avancarEDevolverAnterior();
                return this.declaracaoImportar();

            case tiposDeSimbolos.ISTO:
                this.avancarEDevolverAnterior();
                return new Isto(this.hashArquivo, Number(simboloAtual.linha), simboloAtual);

            case tiposDeSimbolos.NULO:
                this.avancarEDevolverAnterior();
                return new Literal(this.hashArquivo, Number(simboloAtual.linha), null);

            case tiposDeSimbolos.NUMERO:
            case tiposDeSimbolos.TEXTO:
                const simboloNumeroTexto: SimboloInterface = this.avancarEDevolverAnterior();
                const tipoInferido = inferirTipoVariavel(simboloNumeroTexto.literal);
                const tipoDadosElementar = tipoInferenciaParaTipoDadosElementar(tipoInferido as TipoInferencia);
                return new Literal(
                    this.hashArquivo,
                    Number(simboloNumeroTexto.linha),
                    simboloNumeroTexto.literal,
                    tipoDadosElementar
                );

            case tiposDeSimbolos.PARENTESE_ESQUERDO:
                this.avancarEDevolverAnterior();
                const expressao = this.expressao();
                this.consumir(tiposDeSimbolos.PARENTESE_DIREITO, "Esperado ')' após a expressão.");

                return new Agrupamento(this.hashArquivo, Number(simboloAtual.linha), expressao);

            case tiposDeSimbolos.SUPER:
                const simboloSuper = this.avancarEDevolverAnterior();
                // Se o próximo símbolo for uma abertura de parênteses, significa que
                // é uma chamada ao construtor da classe ancestral (superclasse).
                // Se o próximo símbolo for um ponto, significa que é uma chamada
                // a um método da superclasse.
                switch (this.simbolos[this.atual].tipo) {
                    case tiposDeSimbolos.PARENTESE_ESQUERDO:
                        return new Super(
                            this.hashArquivo,
                            simboloSuper,
                            new Simbolo(
                                tiposDeSimbolos.IDENTIFICADOR,
                                'construtor',
                                null,
                                simboloSuper.linha,
                                this.hashArquivo
                            )
                        );
                    default:
                        this.consumir(tiposDeSimbolos.PONTO, "Esperado '.' após 'super'.");
                        const metodoSuperclasse = this.consumir(
                            tiposDeSimbolos.IDENTIFICADOR,
                            'Esperado nome do método da Superclasse.'
                        );
                        return new Super(this.hashArquivo, simboloSuper, metodoSuperclasse);
                }

            case tiposDeSimbolos.VERDADEIRO:
                this.avancarEDevolverAnterior();
                return new Literal(this.hashArquivo, Number(simboloAtual.linha), true, 'lógico');

            case tiposDeSimbolos.TIPO:
                this.avancarEDevolverAnterior();
                this.consumir(tiposDeSimbolos.DE, "Esperado 'de' após 'tipo'.");
                let _expressao;
                if (
                    this.verificarSeSimboloAtualEIgualA(
                        tiposDeSimbolos.ESCREVA,
                        tiposDeSimbolos.LEIA,
                        tiposDeSimbolos.FUNCAO,
                        tiposDeSimbolos.FUNÇÃO,
                        tiposDeSimbolos.SE,
                        tiposDeSimbolos.ENQUANTO,
                        tiposDeSimbolos.PARA,
                        tiposDeSimbolos.RETORNA,
                        tipoDeDadosDelegua.INTEIRO,
                        tipoDeDadosDelegua.TEXTO,
                        tipoDeDadosDelegua.VETOR,
                        tipoDeDadosDelegua.LOGICO,
                        tipoDeDadosDelegua.LÓGICO,
                        tipoDeDadosDelegua.VAZIO
                    )
                ) {
                    _expressao = this.simboloAnterior();
                } else {
                    _expressao = this.expressao() as any;
                }

                return new TipoDe(
                    this.hashArquivo,
                    simboloAtual,
                    _expressao instanceof Literal ? _expressao.valor : _expressao
                );

            case tiposDeSimbolos.EXPRESSAO_REGULAR:
                let valor: string = '';
                let linhaAtual = this.simbolos[this.atual].linha;
                let eParExpressaoRegular =
                    this.simbolos.filter((l) => l.linha === linhaAtual && l.tipo === tiposDeSimbolos.EXPRESSAO_REGULAR)
                        .length %
                        2 ===
                    0;
                if (eParExpressaoRegular) {
                    this.avancarEDevolverAnterior();
                    while (!this.verificarTipoSimboloAtual(tiposDeSimbolos.EXPRESSAO_REGULAR)) {
                        valor += this.simbolos[this.atual].lexema || '';
                        this.avancarEDevolverAnterior();
                    }
                    this.avancarEDevolverAnterior();
                    return new ExpressaoRegular(this.hashArquivo, simboloAtual, valor);
                }
        }

        throw this.erro(this.simbolos[this.atual], 'Esperado expressão.');
    }

    override chamar(): Construto {
        let expressao = this.primario();

        while (true) {
            if (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.PARENTESE_ESQUERDO)) {
                expressao = this.finalizarChamada(expressao);
            } else if (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.PONTO)) {
                const nome = this.consumir(
                    tiposDeSimbolos.IDENTIFICADOR,
                    "Esperado nome de método ou propriedade após '.'."
                );
                expressao = new AcessoMetodoOuPropriedade(this.hashArquivo, expressao, nome);
            } else if (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.COLCHETE_ESQUERDO)) {
                const indice = this.expressao();
                const simboloFechamento = this.consumir(
                    tiposDeSimbolos.COLCHETE_DIREITO,
                    "Esperado ']' após escrita do indice."
                );
                expressao = new AcessoIndiceVariavel(this.hashArquivo, expressao, indice, simboloFechamento);
            } else {
                break;
            }
        }

        return expressao;
    }

    override unario(): Construto {
        if (
            this.verificarSeSimboloAtualEIgualA(
                tiposDeSimbolos.NEGACAO,
                tiposDeSimbolos.SUBTRACAO,
                tiposDeSimbolos.BIT_NOT,
                tiposDeSimbolos.INCREMENTAR,
                tiposDeSimbolos.DECREMENTAR
            )
        ) {
            const operador = this.simbolos[this.atual - 1];
            const direito = this.unario();
            return new Unario(this.hashArquivo, operador, direito, 'ANTES');
        }

        return this.chamar();
    }

    override multiplicar(): Construto {
        let expressao = this.exponenciacao();

        while (
            this.verificarSeSimboloAtualEIgualA(
                tiposDeSimbolos.DIVISAO,
                tiposDeSimbolos.DIVISAO_IGUAL,
                tiposDeSimbolos.DIVISAO_INTEIRA,
                tiposDeSimbolos.DIVISAO_INTEIRA_IGUAL,
                tiposDeSimbolos.MODULO,
                tiposDeSimbolos.MODULO_IGUAL,
                tiposDeSimbolos.MULTIPLICACAO,
                tiposDeSimbolos.MULTIPLICACAO_IGUAL
            )
        ) {
            const operador = this.simbolos[this.atual - 1];
            const direito = this.exponenciacao();
            expressao = new Binario<TipoDeSimboloDelegua>(this.hashArquivo, expressao, operador, direito);
        }

        return expressao;
    }

    /**
     * Se símbolo de operação é `+`, `-`, `+=` ou `-=`, monta objeto `Binario` para
     * ser avaliado pelo Interpretador.
     * @returns Um Construto, normalmente um `Binario`, ou `Unario` se houver alguma operação unária para ser avaliada.
     */
    override adicaoOuSubtracao(): Construto {
        let expressao = this.multiplicar();

        while (
            this.verificarSeSimboloAtualEIgualA(
                tiposDeSimbolos.SUBTRACAO,
                tiposDeSimbolos.ADICAO,
                tiposDeSimbolos.MAIS_IGUAL,
                tiposDeSimbolos.MENOS_IGUAL
            )
        ) {
            const operador = this.simbolos[this.atual - 1];
            const direito = this.multiplicar();
            expressao = new Binario<TipoDeSimboloDelegua>(this.hashArquivo, expressao, operador, direito);
        }

        return expressao;
    }

    override bitShift(): Construto {
        let expressao = this.adicaoOuSubtracao();

        while (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.MENOR_MENOR, tiposDeSimbolos.MAIOR_MAIOR)) {
            const operador = this.simbolos[this.atual - 1];
            const direito = this.adicaoOuSubtracao();
            expressao = new Binario<TipoDeSimboloDelegua>(this.hashArquivo, expressao, operador, direito);
        }

        return expressao;
    }

    override bitE(): Construto {
        let expressao = this.bitShift();

        while (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.BIT_AND)) {
            const operador = this.simbolos[this.atual - 1];
            const direito = this.bitShift();
            expressao = new Binario<TipoDeSimboloDelegua>(this.hashArquivo, expressao, operador, direito);
        }

        return expressao;
    }

    override bitOu(): Construto {
        let expressao = this.bitE();

        while (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.BIT_OR, tiposDeSimbolos.BIT_XOR)) {
            const operador = this.simbolos[this.atual - 1];
            const direito = this.bitE();
            expressao = new Binario<TipoDeSimboloDelegua>(this.hashArquivo, expressao, operador, direito);
        }

        return expressao;
    }

    override comparar(): Construto {
        let expressao = this.bitOu();

        while (
            this.verificarSeSimboloAtualEIgualA(
                tiposDeSimbolos.MAIOR,
                tiposDeSimbolos.MAIOR_IGUAL,
                tiposDeSimbolos.MENOR,
                tiposDeSimbolos.MENOR_IGUAL
            )
        ) {
            const operador = this.simbolos[this.atual - 1];
            const direito = this.bitOu();
            expressao = new Binario<TipoDeSimboloDelegua>(this.hashArquivo, expressao, operador, direito);
        }

        return expressao;
    }

    override comparacaoIgualdade(): Construto {
        let expressao = this.comparar();

        while (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.DIFERENTE, tiposDeSimbolos.IGUAL_IGUAL)) {
            const operador = this.simbolos[this.atual - 1];
            const direito = this.comparar();
            expressao = new Binario<TipoDeSimboloDelegua>(this.hashArquivo, expressao, operador, direito);
        }

        return expressao;
    }

    override em(): Construto {
        let expressao = this.comparacaoIgualdade();

        while (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.EM)) {
            const operador = this.simbolos[this.atual - 1];
            const direito = this.comparacaoIgualdade();
            expressao = new Logico(this.hashArquivo, expressao, operador, direito);
        }

        return expressao;
    }

    override e(): Construto {
        let expressao = this.em();

        while (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.E)) {
            const operador = this.simbolos[this.atual - 1];
            const direito = this.em();
            expressao = new Logico(this.hashArquivo, expressao, operador, direito);
        }

        return expressao;
    }

    /**
     * Método que resolve atribuições.
     * @returns Um construto do tipo `Atribuir`, `Conjunto` ou `AtribuicaoPorIndice`.
     */
    override atribuir(): Construto {
        const expressao = this.ou();

        if (
            expressao instanceof Binario &&
            [
                tiposDeSimbolos.MAIS_IGUAL,
                tiposDeSimbolos.MENOS_IGUAL,
                tiposDeSimbolos.MULTIPLICACAO_IGUAL,
                tiposDeSimbolos.DIVISAO_IGUAL,
                tiposDeSimbolos.DIVISAO_INTEIRA_IGUAL,
                tiposDeSimbolos.MODULO_IGUAL,
            ].includes(expressao.operador.tipo)
        ) {
            if (expressao.esquerda instanceof AcessoIndiceVariavel) {
                const entidade = expressao.esquerda as AcessoIndiceVariavel;
                const simbolo = (entidade.entidadeChamada as Variavel).simbolo;
                return new Atribuir(this.hashArquivo, simbolo, expressao, entidade.indice);
            }

            const simbolo = (expressao.esquerda as Variavel).simbolo;
            return new Atribuir(this.hashArquivo, simbolo, expressao);
        } else if (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.IGUAL)) {
            const igual = this.simbolos[this.atual - 1];
            const valor = this.expressao();

            if (expressao instanceof Variavel) {
                const simbolo = expressao.simbolo;
                return new Atribuir(this.hashArquivo, simbolo, valor);
            }

            if (expressao instanceof AcessoMetodoOuPropriedade) {
                const get = expressao;
                return new DefinirValor(this.hashArquivo, igual.linha, get.objeto, get.simbolo, valor);
            }

            if (expressao instanceof AcessoIndiceVariavel) {
                return new AtribuicaoPorIndice(
                    this.hashArquivo,
                    expressao.linha,
                    expressao.entidadeChamada,
                    expressao.indice,
                    valor
                );
            }

            this.erro(igual, 'Tarefa de atribuição inválida');
        }

        return expressao;
    }

    override expressao(): Construto {
        if (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.LEIA)) return this.declaracaoLeia();
        return this.atribuir();
    }

    override blocoEscopo(): Array<RetornoDeclaracao> {
        this.pilhaEscopos.empilhar(new InformacaoEscopo());
        let declaracoes: Array<RetornoDeclaracao> = [];

        while (!this.verificarTipoSimboloAtual(tiposDeSimbolos.CHAVE_DIREITA) && !this.estaNoFinal()) {
            const retornoDeclaracao = this.resolverDeclaracaoForaDeBloco();
            if (Array.isArray(retornoDeclaracao)) {
                declaracoes = declaracoes.concat(retornoDeclaracao);
            } else {
                declaracoes.push(retornoDeclaracao as Declaracao);
            }
        }

        this.consumir(tiposDeSimbolos.CHAVE_DIREITA, "Esperado '}' após o bloco.");

        this.pilhaEscopos.removerUltimo();
        this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.PONTO_E_VIRGULA);

        return declaracoes;
    }

    override declaracaoEnquanto(): Enquanto {
        try {
            this.blocos += 1;

            const condicao = this.expressao();
            const corpo = this.resolverDeclaracao();

            return new Enquanto(condicao, corpo);
        } finally {
            this.blocos -= 1;
        }
    }

    override declaracaoEscreva(): Escreva {
        const simboloAtual = this.simbolos[this.atual];

        this.consumir(tiposDeSimbolos.PARENTESE_ESQUERDO, "Esperado '(' antes dos valores em escreva.");

        const argumentos: Construto[] = [];

        if (!this.verificarTipoSimboloAtual(tiposDeSimbolos.PARENTESE_DIREITO)) {
            do {
                argumentos.push(this.expressao());
            } while (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.VIRGULA));
        }

        this.consumir(tiposDeSimbolos.PARENTESE_DIREITO, "Esperado ')' após os valores em escreva.");

        // Ponto-e-vírgula é opcional aqui.
        this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.PONTO_E_VIRGULA);

        return new Escreva(Number(simboloAtual.linha), simboloAtual.hashArquivo, argumentos);
    }

    protected declaracaoExpressao(): Expressao {
        // Se há decoradores a serem adicionados aqui, obtemo-los agora,
        // para evitar que outros passos recursivos peguem-los antes.
        const decoradores = Array.from(this.pilhaDecoradores);
        this.pilhaDecoradores = [];

        const expressao = this.expressao();
        // Ponto-e-vírgula é opcional aqui.
        this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.PONTO_E_VIRGULA);
        return new Expressao(expressao, decoradores);
    }

    protected declaracaoComentarioMultilinha(): Comentario {
        let simboloComentario: SimboloInterface;
        const conteudos: string[] = [];
        do {
            simboloComentario = this.avancarEDevolverAnterior();
            conteudos.push(simboloComentario.literal);
        } while (simboloComentario.tipo === tiposDeSimbolos.LINHA_COMENTARIO);

        return new Comentario(simboloComentario.hashArquivo, simboloComentario.linha, conteudos, true);
    }

    protected declaracaoComentarioUmaLinha(): Comentario {
        const simboloComentario = this.avancarEDevolverAnterior();
        return new Comentario(simboloComentario.hashArquivo, simboloComentario.linha, simboloComentario.literal, false);
    }

    override declaracaoContinua(): Continua {
        if (this.blocos < 1) {
            this.erro(this.simbolos[this.atual - 1], "'continua' precisa estar em um laço de repetição.");
        }

        // Ponto-e-vírgula é opcional aqui.
        this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.PONTO_E_VIRGULA);
        return new Continua(this.simbolos[this.atual - 1]);
    }

    override declaracaoEscolha(): Escolha {
        try {
            this.blocos += 1;

            const condicao = this.expressao();
            this.consumir(tiposDeSimbolos.CHAVE_ESQUERDA, "Esperado '{' antes do escopo do 'escolha'.");

            const caminhos = [];
            let caminhoPadrao = null;
            while (!this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.CHAVE_DIREITA) && !this.estaNoFinal()) {
                if (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.CASO)) {
                    const caminhoCondicoes = [this.expressao()];
                    this.consumir(tiposDeSimbolos.DOIS_PONTOS, "Esperado ':' após o 'caso'.");

                    while (this.verificarTipoSimboloAtual(tiposDeSimbolos.CASO)) {
                        this.consumir(tiposDeSimbolos.CASO, null);
                        caminhoCondicoes.push(this.expressao());
                        this.consumir(tiposDeSimbolos.DOIS_PONTOS, "Esperado ':' após declaração do 'caso'.");
                    }

                    let declaracoes = [];
                    do {
                        const retornoDeclaracao = this.resolverDeclaracao();
                        if (Array.isArray(retornoDeclaracao)) {
                            declaracoes = declaracoes.concat(retornoDeclaracao);
                        } else {
                            declaracoes.push(retornoDeclaracao as Declaracao);
                        }
                    } while (
                        !this.verificarTipoSimboloAtual(tiposDeSimbolos.CASO) &&
                        !this.verificarTipoSimboloAtual(tiposDeSimbolos.PADRAO) &&
                        !this.verificarTipoSimboloAtual(tiposDeSimbolos.CHAVE_DIREITA)
                    );

                    caminhos.push({
                        condicoes: caminhoCondicoes,
                        declaracoes,
                    });
                } else if (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.PADRAO)) {
                    if (caminhoPadrao !== null) {
                        const excecao = new ErroAvaliadorSintatico(
                            this.simbolos[this.atual],
                            "Você só pode ter um 'padrao' em cada declaração de 'escolha'."
                        );
                        this.erros.push(excecao);
                        throw excecao;
                    }

                    this.consumir(tiposDeSimbolos.DOIS_PONTOS, "Esperado ':' após declaração do 'padrao'.");

                    const declaracoes = [];
                    do {
                        declaracoes.push(this.resolverDeclaracao());
                    } while (
                        !this.verificarTipoSimboloAtual(tiposDeSimbolos.CASO) &&
                        !this.verificarTipoSimboloAtual(tiposDeSimbolos.PADRAO) &&
                        !this.verificarTipoSimboloAtual(tiposDeSimbolos.CHAVE_DIREITA)
                    );

                    caminhoPadrao = {
                        declaracoes,
                    };
                }
            }

            return new Escolha(condicao, caminhos, caminhoPadrao);
        } finally {
            this.blocos -= 1;
        }
    }

    protected declaracaoFalhar(): Falhar {
        const simboloFalha: SimboloInterface = this.simbolos[this.atual - 1];
        return new Falhar(simboloFalha, this.declaracaoExpressao().expressao);
    }

    override declaracaoFazer(): Fazer {
        const simboloFazer: SimboloInterface = this.simbolos[this.atual - 1];
        try {
            this.blocos += 1;

            const caminhoFazer = this.resolverDeclaracao();
            this.consumir(tiposDeSimbolos.ENQUANTO, "Esperado declaração do 'enquanto' após o escopo do 'fazer'.");
            const condicaoEnquanto = this.expressao();
            return new Fazer(simboloFazer.hashArquivo, Number(simboloFazer.linha), caminhoFazer, condicaoEnquanto);
        } finally {
            this.blocos -= 1;
        }
    }

    override declaracaoImportar(): Importar {
        this.consumir(tiposDeSimbolos.PARENTESE_ESQUERDO, "Esperado '(' após declaração.");
        const caminho = this.expressao();
        const simboloFechamento = this.consumir(tiposDeSimbolos.PARENTESE_DIREITO, "Esperado ')' após declaração.");
        return new Importar(caminho as Literal, simboloFechamento);
    }

    /**
     * Declaração para comando `leia`, para ler dados de entrada do usuário.
     * @returns Um objeto da classe `Leia`.
     */
    override declaracaoLeia(): Leia {
        const simboloLeia = this.simbolos[this.atual];

        this.consumir(tiposDeSimbolos.PARENTESE_ESQUERDO, "Esperado '(' antes dos argumentos em instrução `leia`.");

        const argumentos: Construto[] = [];

        if (this.simbolos[this.atual].tipo !== tiposDeSimbolos.PARENTESE_DIREITO) {
            do {
                argumentos.push(this.expressao());
            } while (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.VIRGULA));
        }

        this.consumir(tiposDeSimbolos.PARENTESE_DIREITO, "Esperado ')' após os argumentos em instrução `leia`.");

        return new Leia(simboloLeia, argumentos);
    }

    override declaracaoPara(): Para | ParaCada {
        try {
            const simboloPara: SimboloInterface = this.simbolos[this.atual - 1];
            this.blocos += 1;

            if (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.CADA)) {
                return this.declaracaoParaCada(simboloPara);
            }

            return this.declaracaoParaTradicional(simboloPara);
        } finally {
            this.blocos -= 1;
        }
    }

    protected declaracaoParaCada(simboloPara: SimboloInterface): ParaCada {
        const nomeVariavelIteracao = this.consumir(
            tiposDeSimbolos.IDENTIFICADOR,
            "Esperado identificador de variável de iteração para instrução 'para cada'."
        );

        if (!this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.DE, tiposDeSimbolos.EM)) {
            throw this.erro(
                this.simbolos[this.atual],
                "Esperado palavras reservadas 'em' ou 'de' após variável de iteração em instrução 'para cada'."
            );
        }

        const vetor = this.expressao();
        if (!vetor.hasOwnProperty('tipo')) {
            throw this.erro(simboloPara, `Variável ou constante em 'para cada' não parece possuir um tipo iterável.`);
        }

        const tipoVetor = (vetor as any).tipo as string;
        if (!(tipoVetor).endsWith('[]')) {
            throw this.erro(simboloPara, `Variável ou constante em 'para cada' não é iterável. Tipo resolvido: ${tipoVetor}.`);
        }

        this.pilhaEscopos.definirTipoVariavel(nomeVariavelIteracao.lexema, tipoVetor.slice(0, -2));
        const corpo = this.resolverDeclaracao();

        return new ParaCada(this.hashArquivo, Number(simboloPara.linha), nomeVariavelIteracao.lexema, vetor, corpo);
    }

    protected declaracaoParaTradicional(simboloPara: SimboloInterface): Para {
        const comParenteses = this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.PARENTESE_ESQUERDO);

        let inicializador: Var | Expressao | Const[];
        if (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.PONTO_E_VIRGULA)) {
            inicializador = null;
        } else if (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.VARIAVEL)) {
            inicializador = this.declaracaoDeVariaveis();
        } else if (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.CONSTANTE)) {
            inicializador = this.declaracaoDeConstantes();
        } else {
            inicializador = this.declaracaoExpressao();
        }

        let condicao = null;
        if (!this.verificarTipoSimboloAtual(tiposDeSimbolos.PONTO_E_VIRGULA)) {
            condicao = this.expressao();
        }

        // Ponto-e-vírgula é opcional aqui.
        this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.PONTO_E_VIRGULA);

        let incrementar = null;
        if (!this.verificarTipoSimboloAtual(tiposDeSimbolos.PARENTESE_DIREITO)) {
            incrementar = this.expressao();
            this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.INCREMENTAR, tiposDeSimbolos.DECREMENTAR);
        }

        if (comParenteses) {
            this.consumir(
                tiposDeSimbolos.PARENTESE_DIREITO,
                "Esperado ')' após cláusulas de inicialização, condição e incremento."
            );
        }

        const corpo = this.resolverDeclaracao();

        return new Para(this.hashArquivo, Number(simboloPara.linha), inicializador, condicao, incrementar, corpo);
    }

    override declaracaoRetorna(): Retorna {
        const simboloChave = this.simbolos[this.atual - 1];
        let valor = null;

        if (
            [
                tiposDeSimbolos.CHAVE_ESQUERDA,
                tiposDeSimbolos.COLCHETE_ESQUERDO,
                tiposDeSimbolos.FALSO,
                tiposDeSimbolos.IDENTIFICADOR,
                tiposDeSimbolos.ISTO,
                tiposDeSimbolos.NEGACAO,
                tiposDeSimbolos.NUMERO,
                tiposDeSimbolos.NULO,
                tiposDeSimbolos.PARENTESE_ESQUERDO,
                tiposDeSimbolos.SUPER,
                tiposDeSimbolos.TEXTO,
                tiposDeSimbolos.VERDADEIRO,
            ].includes(this.simbolos[this.atual].tipo)
        ) {
            valor = this.expressao();
        }

        // Ponto-e-vírgula é opcional aqui.
        this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.PONTO_E_VIRGULA);
        return new Retorna(simboloChave, valor);
    }

    override declaracaoSe(): Se {
        const condicao = this.expressao();

        const caminhoEntao = this.resolverDeclaracao();

        let caminhoSenao = null;
        if (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.SENAO, tiposDeSimbolos.SENÃO)) {
            caminhoSenao = this.resolverDeclaracao();
        }

        return new Se(condicao, caminhoEntao, [], caminhoSenao);
    }

    override declaracaoSustar(): Sustar {
        if (this.blocos < 1) {
            this.erro(this.simbolos[this.atual - 1], "'sustar' ou 'pausa' deve estar dentro de um laço de repetição.");
        }

        // Ponto-e-vírgula é opcional aqui.
        this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.PONTO_E_VIRGULA);
        return new Sustar(this.simbolos[this.atual - 1]);
    }

    override declaracaoTente(): Tente {
        const simboloTente: SimboloInterface = this.simbolos[this.atual - 1];
        this.consumir(tiposDeSimbolos.CHAVE_ESQUERDA, "Esperado '{' após a declaração 'tente'.");

        const blocoTente: any[] = this.blocoEscopo();

        let blocoPegue: FuncaoConstruto | Declaracao[] = null;
        if (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.PEGUE)) {
            if (this.verificarTipoSimboloAtual(tiposDeSimbolos.PARENTESE_ESQUERDO)) {
                // Caso 1: com parâmetro de erro.
                // `pegue` recebe um `FuncaoConstruto`.
                blocoPegue = this.corpoDaFuncao('bloco `pegue`');
            } else {
                // Caso 2: sem parâmetro de erro.
                // `pegue` recebe um bloco.
                this.consumir(tiposDeSimbolos.CHAVE_ESQUERDA, "Esperado '{' após a declaração 'pegue'.");
                blocoPegue = this.blocoEscopo();
            }
        }

        let blocoSenao: any[] = null;
        if (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.SENAO, tiposDeSimbolos.SENÃO)) {
            this.consumir(tiposDeSimbolos.CHAVE_ESQUERDA, "Esperado '{' após a declaração 'senão'.");

            blocoSenao = this.blocoEscopo();
        }

        let blocoFinalmente: any[] = null;
        if (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.FINALMENTE)) {
            this.consumir(tiposDeSimbolos.CHAVE_ESQUERDA, "Esperado '{' após a declaração 'finalmente'.");

            blocoFinalmente = this.blocoEscopo();
        }

        return new Tente(
            simboloTente.hashArquivo,
            Number(simboloTente.linha),
            blocoTente,
            blocoPegue,
            blocoSenao,
            blocoFinalmente
        );
    }

    protected resolverDecorador(): void {
        while (this.verificarTipoSimboloAtual(tiposDeSimbolos.ARROBA)) {
            let nomeDecorador: string = '';
            let linha: number;
            let parametros: ParametroInterface[] = [];
            let parenteseEsquerdo = false;
            linha = this.simbolos[this.atual].linha;
            let simbolosLinhaAtual = this.simbolos.filter((l) => l.linha === linha);

            for (let simbolo of simbolosLinhaAtual) {
                parenteseEsquerdo = this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.PARENTESE_ESQUERDO);
                if (parenteseEsquerdo) {
                    if (!this.verificarTipoSimboloAtual(tiposDeSimbolos.PARENTESE_DIREITO)) {
                        parametros = this.logicaComumParametros();
                    }
                    this.consumir(tiposDeSimbolos.PARENTESE_DIREITO, "Esperado ')' após parâmetros.");
                    break;
                }
                this.avancarEDevolverAnterior();
                nomeDecorador += simbolo.lexema || '.';
            }

            const atributos: { [key: string]: any } = {};
            for (const parametro of parametros) {
                if (parametro.nome.lexema in atributos) {
                    throw this.erro(
                        parametro.nome,
                        `Atributo de decorador declarado duas ou mais vezes: ${parametro.nome.lexema}`
                    );
                }

                atributos[parametro.nome.lexema] = parametro.valorPadrao;
            }

            this.pilhaDecoradores.push(new Decorador(this.hashArquivo, linha, nomeDecorador, atributos));
        }
    }

    /**
     * Todas as resoluções triviais da linguagem, ou seja, todas as
     * resoluções que podem ocorrer dentro ou fora de um bloco.
     * @returns Normalmente uma `Declaracao`, mas há casos em que
     * outros objetos podem ser retornados.
     * @see resolverDeclaracaoForaDeBloco para as declarações que não podem
     * ocorrer em blocos de escopo elementares.
     */
    protected resolverDeclaracao(): any {
        switch (this.simbolos[this.atual].tipo) {
            case tiposDeSimbolos.CHAVE_ESQUERDA:
                const simboloInicioBloco: SimboloInterface = this.avancarEDevolverAnterior();
                return new Bloco(simboloInicioBloco.hashArquivo, Number(simboloInicioBloco.linha), this.blocoEscopo());
            case tiposDeSimbolos.COMENTARIO:
                return this.declaracaoComentarioUmaLinha();
            case tiposDeSimbolos.CONSTANTE:
                this.avancarEDevolverAnterior();
                return this.declaracaoDeConstantes();
            case tiposDeSimbolos.CONTINUA:
                this.avancarEDevolverAnterior();
                return this.declaracaoContinua();
            case tiposDeSimbolos.ENQUANTO:
                this.avancarEDevolverAnterior();
                return this.declaracaoEnquanto();
            case tiposDeSimbolos.ESCOLHA:
                this.avancarEDevolverAnterior();
                return this.declaracaoEscolha();
            case tiposDeSimbolos.ESCREVA:
                this.avancarEDevolverAnterior();
                return this.declaracaoEscreva();
            case tiposDeSimbolos.FALHAR:
                this.avancarEDevolverAnterior();
                return this.declaracaoFalhar();
            case tiposDeSimbolos.FAZER:
                this.avancarEDevolverAnterior();
                return this.declaracaoFazer();
            case tiposDeSimbolos.LINHA_COMENTARIO:
                return this.declaracaoComentarioMultilinha();
            case tiposDeSimbolos.PARA:
                this.avancarEDevolverAnterior();
                return this.declaracaoPara();
            case tiposDeSimbolos.PAUSA:
            case tiposDeSimbolos.SUSTAR:
                this.avancarEDevolverAnterior();
                return this.declaracaoSustar();
            case tiposDeSimbolos.SE:
                this.avancarEDevolverAnterior();
                return this.declaracaoSe();
            case tiposDeSimbolos.RETORNA:
                this.avancarEDevolverAnterior();
                return this.declaracaoRetorna();
            case tiposDeSimbolos.TENDO:
                this.avancarEDevolverAnterior();
                return this.declaracaoTendoComo();
            case tiposDeSimbolos.TENTE:
                this.avancarEDevolverAnterior();
                return this.declaracaoTente();
            case tiposDeSimbolos.VARIAVEL:
                this.avancarEDevolverAnterior();
                return this.declaracaoDeVariaveis();
        }

        const simboloAtual = this.simbolos[this.atual];
        if (simboloAtual.tipo === tiposDeSimbolos.IDENTIFICADOR) {
            // Pela gramática, a seguinte situação não pode ocorrer:
            // 1. O símbolo anterior ser um identificador; e
            // 2. O símbolo anterior estar na mesma linha do identificador atual.

            const simboloAnterior = this.simbolos[this.atual - 1];
            if (
                !!simboloAnterior &&
                simboloAnterior.tipo === tiposDeSimbolos.IDENTIFICADOR &&
                simboloAnterior.linha === simboloAtual.linha
            ) {
                this.erro(
                    this.simbolos[this.atual],
                    'Não é permitido ter dois identificadores seguidos na mesma linha.'
                );
            }
        }

        return this.declaracaoExpressao();
    }

    protected declaracaoTendoComo(): TendoComo {
        const simboloTendo = this.simbolos[this.atual - 1];
        const expressaoInicializacao = this.expressao();
        this.consumir(
            tiposDeSimbolos.COMO,
            "Esperado palavra reservada 'como' após expressão de inicialização de variável, em declaração 'tendo'."
        );
        const simboloNomeVariavel = this.consumir(
            tiposDeSimbolos.IDENTIFICADOR,
            "Esperado nome do identificador em declaração 'tendo'."
        );
        this.consumir(
            tiposDeSimbolos.CHAVE_ESQUERDA,
            "Esperado chave esquerda para abertura de bloco em declaração 'tendo'."
        );

        let tipoInicializacao: string = 'qualquer';
        switch (expressaoInicializacao.constructor.name) {
            case 'Chamada':
                const construtoChamada = expressaoInicializacao as Chamada;
                switch (construtoChamada.entidadeChamada.constructor.name) {
                    case 'Variavel':
                        const entidadeChamadaVariavel = construtoChamada.entidadeChamada as Variavel;
                        tipoInicializacao = entidadeChamadaVariavel.tipo;
                        break;
                    // TODO: Demais casos
                    default:
                        break;
                }
                break;
            // TODO: Demais casos
            default:
                break;
        }

        this.pilhaEscopos.definirTipoVariavel(simboloNomeVariavel.lexema, tipoInicializacao);
        
        const blocoCorpo = this.blocoEscopo();
        return new TendoComo(
            simboloTendo.linha,
            simboloTendo.hashArquivo,
            simboloNomeVariavel,
            expressaoInicializacao,
            new Bloco(simboloTendo.linha, simboloTendo.hashArquivo, blocoCorpo)
        );
    }

    protected declaracaoDesestruturacaoVariavel(): Var[] {
        const identificadores: SimboloInterface[] = [];

        do {
            identificadores.push(this.consumir(tiposDeSimbolos.IDENTIFICADOR, 'Esperado nome da variável.'));
        } while (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.VIRGULA));

        this.consumir(
            tiposDeSimbolos.CHAVE_DIREITA,
            'Esperado chave direita para concluir relação de variáveis a serem desestruturadas.'
        );
        this.consumir(tiposDeSimbolos.IGUAL, 'Esperado igual após relação de propriedades da desestruturação.');

        const inicializador = this.expressao();
        const retornos = [];
        for (let identificador of identificadores) {
            // TODO: Melhorar dicionário para intuir o tipo de cada propriedade.
            this.pilhaEscopos.definirTipoVariavel(identificador.lexema, 'qualquer');
            const declaracaoVar = new Var(
                identificador,
                new AcessoMetodoOuPropriedade(this.hashArquivo, inicializador, identificador)
            );
            declaracaoVar.decoradores = Array.from(this.pilhaDecoradores);
            retornos.push(declaracaoVar);
        }

        this.pilhaDecoradores = [];
        return retornos;
    }

    /**
     * Caso símbolo atual seja `var`, devolve uma declaração de variável.
     * @returns Um Construto do tipo Var.
     */
    protected declaracaoDeVariaveis(): Var[] {
        const identificadores: SimboloInterface[] = [];
        const retorno: Var[] = [];
        let tipo: any = null;

        if (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.CHAVE_ESQUERDA)) {
            return this.declaracaoDesestruturacaoVariavel();
        }

        do {
            identificadores.push(this.consumir(tiposDeSimbolos.IDENTIFICADOR, 'Esperado nome da variável.'));
        } while (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.VIRGULA));

        if (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.DOIS_PONTOS)) {
            tipo = this.verificarDefinicaoTipoAtual();
            this.avancarEDevolverAnterior();
        }

        if (!this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.IGUAL)) {
            // Inicialização de variáveis sem valor.
            for (let identificador of identificadores.values()) {
                this.pilhaEscopos.definirTipoVariavel(identificador.lexema, tipo);
                retorno.push(new Var(identificador, null, tipo, Array.from(this.pilhaDecoradores)));
            }

            this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.PONTO_E_VIRGULA);
            this.pilhaDecoradores = [];
            return retorno;
        }

        const inicializadores = [];
        do {
            inicializadores.push(this.expressao());
        } while (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.VIRGULA));

        if (identificadores.length !== inicializadores.length) {
            throw this.erro(
                this.simbolos[this.atual],
                'Quantidade de identificadores à esquerda do igual é diferente da quantidade de valores à direita.'
            );
        }

        for (let [indice, identificador] of identificadores.entries()) {
            // Se tipo ainda não foi definido, infere.
            if (!tipo) {
                switch (inicializadores[indice].constructor.name) {
                    case 'Dupla':
                    case 'Trio':
                    case 'Quarteto':
                    case 'Quinteto':
                    case 'Sexteto':
                    case 'Septeto':
                    case 'Octeto':
                    case 'Noneto':
                    case 'Deceto':
                        tipo = tipoDeDadosDelegua.TUPLA;
                        break;
                    case 'Literal':
                    case 'Vetor':
                        tipo = inicializadores[indice].tipo;
                        break;
                }
            }

            this.pilhaEscopos.definirTipoVariavel(identificador.lexema, tipo);
            retorno.push(new Var(identificador, inicializadores[indice], tipo, Array.from(this.pilhaDecoradores)));
        }

        this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.PONTO_E_VIRGULA);
        this.pilhaDecoradores = [];
        return retorno;
    }

    protected declaracaoDesestruturacaoConstante(): Const[] {
        const identificadores: SimboloInterface[] = [];

        do {
            identificadores.push(this.consumir(tiposDeSimbolos.IDENTIFICADOR, 'Esperado nome da variável.'));
        } while (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.VIRGULA));

        this.consumir(
            tiposDeSimbolos.CHAVE_DIREITA,
            'Esperado chave direita para concluir relação de variáveis a serem desestruturadas.'
        );
        this.consumir(tiposDeSimbolos.IGUAL, 'Esperado igual após relação de propriedades da desestruturação.');

        const inicializador = this.expressao();
        const retornos: Const[] = [];
        for (let identificador of identificadores) {
            // TODO: Melhorar dicionário para intuir o tipo de cada propriedade.
            this.pilhaEscopos.definirTipoVariavel(identificador.lexema, 'qualquer');
            const declaracaoConst = new Const(
                identificador,
                new AcessoMetodoOuPropriedade(this.hashArquivo, inicializador, identificador)
            );

            declaracaoConst.decoradores = Array.from(this.pilhaDecoradores);
            retornos.push(declaracaoConst);
        }

        return retornos;
    }

    /**
     * Caso símbolo atual seja `const, constante ou fixo`, devolve uma declaração de const.
     * @returns Um Construto do tipo Const.
     */
    declaracaoDeConstantes(): Const[] {
        const identificadores: SimboloInterface[] = [];
        let tipo: string = null;

        if (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.CHAVE_ESQUERDA)) {
            return this.declaracaoDesestruturacaoConstante();
        }

        do {
            identificadores.push(this.consumir(tiposDeSimbolos.IDENTIFICADOR, 'Esperado nome da constante.'));
        } while (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.VIRGULA));

        if (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.DOIS_PONTOS)) {
            tipo = this.verificarDefinicaoTipoAtual();
            this.avancarEDevolverAnterior();
        }

        this.consumir(tiposDeSimbolos.IGUAL, "Esperado '=' após identificador em instrução 'constante'.");

        const inicializadores = [];
        do {
            inicializadores.push(this.expressao());
        } while (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.VIRGULA));

        if (identificadores.length !== inicializadores.length) {
            throw this.erro(
                this.simbolos[this.atual],
                'Quantidade de identificadores à esquerda do igual é diferente da quantidade de valores à direita.'
            );
        }

        let retorno: Const[] = [];
        for (let [indice, identificador] of identificadores.entries()) {
            if (!tipo) {
                tipo = inferirTipoVariavel(inicializadores[indice]);
            }

            this.pilhaEscopos.definirTipoVariavel(identificador.lexema, tipo);
            retorno.push(
                new Const(
                    identificador, 
                    inicializadores[indice], 
                    tipo as TipoDadosElementar, 
                    Array.from(this.pilhaDecoradores)
                )
            );
        }

        this.pilhaDecoradores = [];
        this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.PONTO_E_VIRGULA);

        return retorno;
    }

    protected funcao(tipo: string): FuncaoDeclaracao {
        let simbolo: SimboloInterface;
        switch (this.simbolos[this.atual].tipo) {
            case tiposDeSimbolos.CONSTRUTOR:
                simbolo = this.avancarEDevolverAnterior();
                break;
            default:
                simbolo = this.consumir(tiposDeSimbolos.IDENTIFICADOR, `Esperado nome de ${tipo}.`);
                break;
        }

        const decoradores = Array.from(this.pilhaDecoradores);
        this.pilhaDecoradores = [];
        
        // Se houver chamadas recursivas à função, precisamos definir um tipo
        // para ela. Vai ser atualizado após avaliação do corpo da função.
        this.pilhaEscopos.definirTipoVariavel(simbolo.lexema, 'qualquer');

        const corpoDaFuncao = this.corpoDaFuncao(tipo);
        this.pilhaEscopos.definirTipoVariavel(simbolo.lexema, corpoDaFuncao.tipoRetorno || 'qualquer');
        return new FuncaoDeclaracao(simbolo, corpoDaFuncao, null, decoradores);
    }

    protected logicaComumParametros(): ParametroInterface[] {
        const parametros: ParametroInterface[] = [];

        do {
            const parametro: Partial<ParametroInterface> = {};

            if (this.simbolos[this.atual].tipo === tiposDeSimbolos.MULTIPLICACAO) {
                this.consumir(tiposDeSimbolos.MULTIPLICACAO, null);
                parametro.abrangencia = 'multiplo';
            } else {
                parametro.abrangencia = 'padrao';
            }

            parametro.nome = this.consumir(tiposDeSimbolos.IDENTIFICADOR, 'Esperado nome do parâmetro.');

            if (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.IGUAL)) {
                const valorPadrao = this.primario();
                parametro.valorPadrao = valorPadrao;
            }

            if (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.DOIS_PONTOS)) {
                let tipoDadoParametro = this.verificarDefinicaoTipoAtual();
                parametro.tipoDado = tipoDadoParametro;
                this.avancarEDevolverAnterior();
            }

            this.pilhaEscopos.definirTipoVariavel(parametro.nome.lexema, parametro.tipoDado || 'qualquer');
            parametros.push(parametro as ParametroInterface);
            if (parametro.abrangencia === 'multiplo') break;
        } while (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.VIRGULA));
        return parametros;
    }

    override corpoDaFuncao(tipo: string): FuncaoConstruto {
        // O parêntese esquerdo é considerado o símbolo inicial para
        // fins de pragma.
        const parenteseEsquerdo = this.consumir(
            tiposDeSimbolos.PARENTESE_ESQUERDO,
            `Esperado '(' após o nome ${tipo}.`
        );

        let parametros = [];
        if (!this.verificarTipoSimboloAtual(tiposDeSimbolos.PARENTESE_DIREITO)) {
            parametros = this.logicaComumParametros();
        }

        this.consumir(tiposDeSimbolos.PARENTESE_DIREITO, "Esperado ')' após parâmetros.");

        let tipoRetorno: string = 'qualquer';
        if (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.DOIS_PONTOS)) {
            tipoRetorno = this.verificarDefinicaoTipoAtual();
            this.avancarEDevolverAnterior();
        }

        this.consumir(tiposDeSimbolos.CHAVE_ESQUERDA, `Esperado '{' antes do escopo do ${tipo}.`);

        const corpo = this.blocoEscopo();
        return new FuncaoConstruto(this.hashArquivo, Number(parenteseEsquerdo.linha), parametros, corpo, tipoRetorno);
    }

    override declaracaoDeClasse(): Classe {
        const simbolo: SimboloInterface = this.consumir(tiposDeSimbolos.IDENTIFICADOR, 'Esperado nome da classe.');
        const pilhaDecoradoresClasse = Array.from(this.pilhaDecoradores);

        let superClasse = null;
        if (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.HERDA)) {
            const simboloSuperclasse = this.consumir(tiposDeSimbolos.IDENTIFICADOR, 'Esperado nome da Superclasse.');
            superClasse = new Variavel(this.hashArquivo, this.simbolos[this.atual - 1], simboloSuperclasse.lexema);
        }

        this.consumir(tiposDeSimbolos.CHAVE_ESQUERDA, "Esperado '{' antes do escopo da classe.");

        this.pilhaDecoradores = [];
        const metodos = [];
        const propriedades = [];
        while (!this.verificarTipoSimboloAtual(tiposDeSimbolos.CHAVE_DIREITA) && !this.estaNoFinal()) {
            // Se o símbolo atual é arroba, é um decorador.
            // Caso contrário, verificamos o próximo símbolo.
            if (this.simbolos[this.atual].tipo === tiposDeSimbolos.ARROBA) {
                this.resolverDecorador();
                continue;
            }

            // Se o próximo símbolo ao atual for um parênteses, é um método.
            // Caso contrário, é uma propriedade.
            const proximoSimbolo = this.simbolos[this.atual + 1];
            switch (proximoSimbolo.tipo) {
                case tiposDeSimbolos.PARENTESE_ESQUERDO:
                    metodos.push(this.funcao('método'));
                    break;
                case tiposDeSimbolos.DOIS_PONTOS:
                    const nomePropriedade = this.consumir(
                        tiposDeSimbolos.IDENTIFICADOR,
                        'Esperado identificador para nome de propriedade.'
                    );
                    this.consumir(tiposDeSimbolos.DOIS_PONTOS, 'Esperado dois-pontos após nome de propriedade.');
                    const tipoPropriedade = this.avancarEDevolverAnterior();
                    this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.PONTO_E_VIRGULA);
                    propriedades.push(
                        new PropriedadeClasse(
                            nomePropriedade,
                            tipoPropriedade.lexema,
                            Array.from(this.pilhaDecoradores)
                        )
                    );
                    this.pilhaDecoradores = [];
                    break;
                default:
                    throw this.erro(this.simbolos[this.atual], 'Esperado definição de método ou propriedade.');
            }
        }

        this.consumir(tiposDeSimbolos.CHAVE_DIREITA, "Esperado '}' após o escopo da classe.");
        const definicaoClasse = new Classe(simbolo, superClasse, metodos, propriedades, pilhaDecoradoresClasse);
        this.tiposDefinidosEmCodigo[definicaoClasse.simbolo.lexema] = definicaoClasse;
        return definicaoClasse;
    }

    /**
     * Declarações fora de bloco precisam ser verificadas primeiro por
     * uma série de motivos, como, por exemplo:
     *
     * - Não é possível declarar uma classe/função dentro de um bloco `enquanto`,
     *   `fazer ... enquanto`, `para`, `escolha`, etc;
     * - Qualquer declaração pode ter um decorador.
     * @returns Uma função ou classe se o símbolo atual resolver aqui.
     *          O retorno de `resolverDeclaracao()` em caso contrário.
     * @see resolverDeclaracao
     * @see resolverDecorador
     */
    override resolverDeclaracaoForaDeBloco(): RetornoDeclaracao {
        try {
            while (this.verificarTipoSimboloAtual(tiposDeSimbolos.ARROBA)) {
                this.resolverDecorador();
            }

            if (
                (this.verificarTipoSimboloAtual(tiposDeSimbolos.FUNCAO) ||
                    this.verificarTipoSimboloAtual(tiposDeSimbolos.FUNÇÃO)) &&
                this.verificarTipoProximoSimbolo(tiposDeSimbolos.IDENTIFICADOR)
            ) {
                this.avancarEDevolverAnterior();
                return this.funcao('funcao');
            }

            if (this.verificarSeSimboloAtualEIgualA(tiposDeSimbolos.CLASSE)) {
                return this.declaracaoDeClasse();
            }

            return this.resolverDeclaracao();
        } catch (erro: any) {
            this.sincronizar();
            this.erros.push(erro);
            return null;
        }
    }

    /**
     * Usado quando há erros na avaliação sintática.
     * Garante que o código não entre em loop infinito.
     * @returns Sempre retorna `void`.
     */
    protected sincronizar(): void {
        this.avancarEDevolverAnterior();

        while (!this.estaNoFinal()) {
            const tipoSimboloAtual: string = this.simbolos[this.atual - 1].tipo;

            switch (tipoSimboloAtual) {
                case tiposDeSimbolos.CLASSE:
                case tiposDeSimbolos.FUNCAO:
                case tiposDeSimbolos.FUNÇÃO:
                case tiposDeSimbolos.VARIAVEL:
                case tiposDeSimbolos.PARA:
                case tiposDeSimbolos.SE:
                case tiposDeSimbolos.ENQUANTO:
                case tiposDeSimbolos.ESCREVA:
                case tiposDeSimbolos.RETORNA:
                    return;
            }

            this.avancarEDevolverAnterior();
        }
    }

    protected inicializarPilhaEscopos() {
        this.pilhaEscopos = new PilhaEscopos();
        this.pilhaEscopos.empilhar(new InformacaoEscopo());

        // Funções nativas de Delégua
        this.pilhaEscopos.definirTipoVariavel('filtrarPor', 'qualquer[]');
        this.pilhaEscopos.definirTipoVariavel('inteiro', 'inteiro');
        this.pilhaEscopos.definirTipoVariavel('mapear', 'qualquer[]');
        this.pilhaEscopos.definirTipoVariavel('paraCada', 'qualquer[]');
        this.pilhaEscopos.definirTipoVariavel('primeiroEmCondicao', 'qualquer');
        this.pilhaEscopos.definirTipoVariavel('real', 'número');
        this.pilhaEscopos.definirTipoVariavel('tamanho', 'inteiro');
        this.pilhaEscopos.definirTipoVariavel('texto', 'texto');
        this.pilhaEscopos.definirTipoVariavel('todosEmCondicao', 'lógico');
        this.pilhaEscopos.definirTipoVariavel('tupla', 'tupla');

        // TODO: Escrever algum tipo de validação aqui.
        for (const tipos of Object.values(this.tiposDeFerramentasExternas)) {
            for (const [nomeTipo, tipo] of Object.entries(tipos)) {
                this.pilhaEscopos.definirTipoVariavel(nomeTipo, tipo);
            }
        }
    }

    analisar(
        retornoLexador: RetornoLexador<SimboloInterface>,
        hashArquivo: number
    ): RetornoAvaliadorSintatico<Declaracao> {
        const inicioAnalise: [number, number] = hrtime();
        this.erros = [];
        this.atual = 0;
        this.blocos = 0;

        this.hashArquivo = hashArquivo || 0;
        this.simbolos = retornoLexador?.simbolos || [];
        this.pilhaDecoradores = [];
        this.tiposDefinidosEmCodigo = {};
        this.inicializarPilhaEscopos();

        let declaracoes: Declaracao[] = [];
        while (!this.estaNoFinal()) {
            this.resolverDecorador();
            const retornoDeclaracao = this.resolverDeclaracaoForaDeBloco();
            if (Array.isArray(retornoDeclaracao)) {
                declaracoes = declaracoes.concat(retornoDeclaracao);
            } else {
                declaracoes.push(retornoDeclaracao as Declaracao);
            }
        }

        if (this.performance) {
            const deltaAnalise: [number, number] = hrtime(inicioAnalise);
            console.log(`[Avaliador Sintático] Tempo para análise: ${deltaAnalise[0] * 1e9 + deltaAnalise[1]}ns`);
        }

        return {
            declaracoes: declaracoes,
            erros: this.erros,
        } as RetornoAvaliadorSintatico<Declaracao>;
    }
}
