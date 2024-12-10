import {
    Agrupamento,
    Atribuir,
    Binario,
    Chamada,
    Construto,
    FuncaoConstruto,
    Literal,
    Logico,
    TipoDe,
    Variavel,
    Vetor,
} from '../construtos';
import {
    Const,
    Declaracao,
    Enquanto,
    Escolha,
    Escreva,
    Expressao,
    Falhar,
    FuncaoDeclaracao,
    Leia,
    Retorna,
    Var,
} from '../declaracoes';
import { SimboloInterface } from '../interfaces';
import { DiagnosticoAnalisadorSemantico, DiagnosticoSeveridade } from '../interfaces/erros';
import { RetornoAnalisadorSemantico } from '../interfaces/retornos/retorno-analisador-semantico';
import { TipoDadosElementar } from '../tipo-dados-elementar';
import { RetornoQuebra } from '../quebras';
import { AnalisadorSemanticoBase } from './analisador-semantico-base';
import { PilhaVariaveis } from './pilha-variaveis';

interface VariavelHipoteticaInterface {
    tipo: TipoDadosElementar;
    subtipo?: 'texto' | 'número' | 'inteiro' | 'longo' | 'lógico';
    imutavel: boolean;
    valor?: any;
}

interface FuncaoHipoteticaInterface {
    valor: any;
}

export class AnalisadorSemantico extends AnalisadorSemanticoBase {
    pilhaVariaveis: PilhaVariaveis;
    variaveis: { [nomeVariavel: string]: VariavelHipoteticaInterface };
    funcoes: { [nomeFuncao: string]: FuncaoHipoteticaInterface };
    atual: number;
    diagnosticos: DiagnosticoAnalisadorSemantico[];

    constructor() {
        super();
        this.pilhaVariaveis = new PilhaVariaveis();
        this.variaveis = {};
        this.funcoes = {};
        this.atual = 0;
        this.diagnosticos = [];
    }

    erro(simbolo: SimboloInterface, mensagem: string): void {
        this.diagnosticos.push({
            simbolo: simbolo,
            mensagem: mensagem,
            hashArquivo: simbolo.hashArquivo,
            linha: simbolo.linha,
            severidade: DiagnosticoSeveridade.ERRO,
        });
    }

    aviso(simbolo: SimboloInterface, mensagem: string): void {
        this.diagnosticos.push({
            simbolo: simbolo,
            mensagem: mensagem,
            hashArquivo: simbolo.hashArquivo,
            linha: simbolo.linha,
            severidade: DiagnosticoSeveridade.AVISO,
        });
    }

    verificarTipoAtribuido(declaracao: Var | Const) {
        if (declaracao.tipo) {
            if (['vetor', 'qualquer[]', 'inteiro[]', 'texto[]'].includes(declaracao.tipo)) {
                if (declaracao.inicializador instanceof Vetor) {
                    const vetor = declaracao.inicializador as Vetor;
                    if (declaracao.tipo === 'inteiro[]') {
                        const v = vetor.valores.find((v) => typeof v?.valor !== 'number');
                        if (v) {
                            this.erro(
                                declaracao.simbolo,
                                `Atribuição inválida para '${declaracao.simbolo.lexema}', é esperado um valor do tipo vetor de inteiro ou real. Atual: ${vetor.tipo}.`
                            );
                        }
                    }
                    if (declaracao.tipo === 'texto[]') {
                        const v = vetor.valores.find((v) => typeof v?.valor !== 'string');
                        if (v) {
                            this.erro(
                                declaracao.simbolo,
                                `Atribuição inválida para '${declaracao.simbolo.lexema}', é esperado um valor do tipo vetor de texto. Atual: ${vetor.tipo}.`
                            );
                        }
                    }
                } else {
                    this.erro(
                        declaracao.simbolo,
                        `Atribuição inválida para '${declaracao.simbolo.lexema}', é esperado um vetor de elementos.`
                    );
                }
            }
            if (declaracao.inicializador instanceof Literal) {
                const literal = declaracao.inicializador as Literal;
                if (declaracao.tipo === 'texto' && literal.tipo !== 'texto') {
                    this.erro(
                        declaracao.simbolo,
                        `Atribuição inválida para '${declaracao.simbolo.lexema}', é esperado um valor do tipo texto. Atual: ${literal.tipo}.`
                    );
                }
                if (['inteiro', 'número', 'real'].includes(declaracao.tipo) && !['inteiro', 'número', 'real'].includes(literal.tipo)) {
                    this.erro(
                        declaracao.simbolo,
                        `Atribuição inválida para '${declaracao.simbolo.lexema}', é esperado um valor do tipo número. Atual: ${literal.tipo}.`
                    );
                }
            }
            // TODO: Estudar remoção.
            if (declaracao.inicializador instanceof Leia) {
                if (declaracao.tipo !== 'texto') {
                    this.erro(
                        declaracao.simbolo,
                        `Atribuição inválida para '${declaracao.simbolo.lexema}', Leia só pode receber tipo 'texto'.`
                    );
                }
            }
        }
    }

    visitarExpressaoTipoDe(expressao: TipoDe): Promise<any> {
        return this.verificarTipoDe(expressao.valor);
    }

    private verificarTipoDe(valor: Construto): Promise<any> {
        if (valor instanceof Binario) {
            this.verificarTipoDe(valor.direita);
            this.verificarTipoDe(valor.esquerda);
        }
        if (valor instanceof Agrupamento) {
            return this.verificarTipoDe(valor.expressao);
        }
        if (valor instanceof Variavel) {
            return this.verificarVariavel(valor);
        }
        return Promise.resolve();
    }

    visitarExpressaoFalhar(expressao: Falhar): Promise<any> {
        return this.verificarFalhar(expressao.explicacao);
    }

    private verificarFalhar(valor: Construto): Promise<any> {
        if (valor instanceof Binario) {
            this.verificarFalhar(valor.direita);
            this.verificarFalhar(valor.esquerda);
        }
        if (valor instanceof Agrupamento) {
            return this.verificarFalhar(valor.expressao);
        }
        if (valor instanceof Variavel) {
            return this.verificarVariavel(valor);
        }
        return Promise.resolve();
    }

    visitarExpressaoDeChamada(expressao: Chamada) {
        if (expressao.entidadeChamada instanceof Variavel) {
            const variavel = expressao.entidadeChamada as Variavel;
            const funcaoChamada = this.variaveis[variavel.simbolo.lexema] || this.funcoes[variavel.simbolo.lexema];
            if (!funcaoChamada) {
                this.erro(
                    expressao.entidadeChamada.simbolo,
                    `Chamada da função '${expressao.entidadeChamada.simbolo.lexema}' não existe.`
                );
                return Promise.resolve();
            }

            const funcao = funcaoChamada.valor as FuncaoConstruto;
            if (funcao.parametros.length !== expressao.argumentos.length) {
                this.erro(
                    expressao.entidadeChamada.simbolo,
                    `Função '${expressao.entidadeChamada.simbolo.lexema}' espera ${funcao.parametros.length} parâmetros. Atual: ${expressao.argumentos.length}.`
                );
            }

            for (let [indice, parametro] of funcao.parametros.entries()) {
                // TODO: `argumento` pode ser Literal (tipo já resolvido) ou variável (tipo inferido em outra etapa).
                const argumento = expressao.argumentos[indice] as any;
                if (argumento) {
                    if (parametro.tipoDado === 'texto' && argumento.tipo !== 'texto') {
                        this.erro(
                            expressao.entidadeChamada.simbolo,
                            `O valor passado para o parâmetro '${parametro.nome.lexema}' (${parametro.tipoDado}) é diferente do esperado pela função (${argumento.tipo}).`
                        );
                    } else if (['inteiro', 'número', 'real'].includes(parametro.tipoDado)) {
                        // Aqui, se houver diferença entre os tipos do parâmetro e do argumento, não há erro,
                        // porque Delégua pode trabalhar com conversões implícitas.
                        // Isso pode ou não mudar no futuro.
                        if (!['inteiro', 'número', 'real'].includes(argumento.tipo)) {
                            this.erro(
                                expressao.entidadeChamada.simbolo,
                                `O valor passado para o parâmetro '${parametro.nome.lexema}' (${parametro.tipoDado}) é diferente do esperado pela função (${argumento.tipo}).`
                            );
                        }
                    }
                }
            }
        }

        return Promise.resolve();
    }

    visitarExpressaoDeAtribuicao(expressao: Atribuir) {
        let valor = this.variaveis[expressao.simbolo.lexema];
        if (!valor) {
            this.erro(
                expressao.simbolo,
                `Variável ${expressao.simbolo.lexema} ainda não foi declarada até este ponto.`
            );
            return Promise.resolve();
        }

        if (valor.tipo) {
            if (expressao.valor instanceof Literal && valor.tipo.includes('[]')) {
                this.erro(expressao.simbolo, `Atribuição inválida, esperado tipo '${valor.tipo}' na atribuição.`);
                return Promise.resolve();
            }
            if (expressao.valor instanceof Vetor && !valor.tipo.includes('[]')) {
                this.erro(expressao.simbolo, `Atribuição inválida, esperado tipo '${valor.tipo}' na atribuição.`);
                return Promise.resolve();
            }
            if (expressao.valor instanceof Literal) {
                let valorLiteral = typeof (expressao.valor as Literal).valor;
                if (!['qualquer'].includes(valor.tipo)) {
                    if (valorLiteral === 'string') {
                        if (valor.tipo != 'texto') {
                            this.erro(expressao.simbolo, `Esperado tipo '${valor.tipo}' na atribuição.`);
                            return Promise.resolve();
                        }
                    }
                    if (valorLiteral === 'number') {
                        if (!['inteiro', 'real'].includes(valor.tipo)) {
                            this.erro(expressao.simbolo, `Esperado tipo '${valor.tipo}' na atribuição.`);
                            return Promise.resolve();
                        }
                    }
                }
            }
            if (expressao.valor instanceof Vetor) {
                let valores = (expressao.valor as Vetor).valores;
                if (!['qualquer[]'].includes(valor.tipo)) {
                    if (valor.tipo === 'texto[]') {
                        if (!valores.every((v) => typeof v.valor === 'string')) {
                            this.erro(expressao.simbolo, `Esperado tipo '${valor.tipo}' na atribuição.`);
                            return Promise.resolve();
                        }
                    }
                    if (['inteiro[]', 'numero[]'].includes(valor.tipo)) {
                        if (!valores.every((v) => typeof v.valor === 'number')) {
                            this.erro(expressao.simbolo, `Esperado tipo '${valor.tipo}' na atribuição.`);
                            return Promise.resolve();
                        }
                    }
                }
            }
        }

        if (valor.imutavel) {
            this.erro(expressao.simbolo, `Constante ${expressao.simbolo.lexema} não pode ser modificada.`);
            return Promise.resolve();
        } else {
            if (this.variaveis[expressao.simbolo.lexema]) {
                this.variaveis[expressao.simbolo.lexema].valor = expressao.valor;
            }
        }
    }

    async visitarDeclaracaoDeExpressao(declaracao: Expressao): Promise<any> {
        return await declaracao.expressao.aceitar(this);
    }

    visitarDeclaracaoEscolha(declaracao: Escolha) {
        const identificadorOuLiteral = declaracao.identificadorOuLiteral as any;
        const valor = this.variaveis[identificadorOuLiteral.simbolo?.lexema]?.valor;
        const tipo = typeof valor;
        for (let caminho of declaracao.caminhos) {
            for (let condicao of caminho.condicoes) {
                if (valor instanceof Leia && typeof condicao?.valor !== 'string') {
                    this.erro(condicao, `'caso ${condicao.valor}:' não é do mesmo tipo esperado em 'escolha'`);
                    continue;
                }
                if (!(valor instanceof Leia) && typeof condicao?.valor !== tipo) {
                    this.erro(condicao, `'caso ${condicao.valor}:' não é do mesmo tipo esperado em 'escolha'`);
                }
            }
        }

        return Promise.resolve();
    }

    visitarDeclaracaoEnquanto(declaracao: Enquanto) {
        return this.verificarCondicao(declaracao.condicao);
    }

    private verificarCondicao(condicao: Construto): Promise<void> {
        if (condicao instanceof Agrupamento) {
            return this.verificarCondicao(condicao.expressao);
        }
        if (condicao instanceof Variavel) {
            return this.verificarVariavelBinaria(condicao);
        }
        if (condicao instanceof Binario) {
            return this.verificarBinario(condicao);
        }
        if (condicao instanceof Logico) {
            return this.verificarLogico(condicao);
        }
        if (condicao instanceof Chamada) {
            return this.verificarChamada(condicao);
        }
        return Promise.resolve();
    }

    private verificarVariavelBinaria(variavel: Variavel): Promise<void> {
        this.verificarVariavel(variavel);
        const variavelHipotetica = this.variaveis[variavel.simbolo.lexema];
        if (
            variavelHipotetica &&
            !(variavelHipotetica.valor instanceof Binario) &&
            typeof variavelHipotetica.valor !== 'boolean'
        ) {
            this.erro(variavel.simbolo, `Esperado tipo 'lógico' na condição do 'enquanto'.`);
        }
        return Promise.resolve();
    }

    private verificarVariavel(variavel: Variavel): Promise<void> {
        const variavelHipotetica = this.variaveis[variavel.simbolo.lexema];
        if (!variavelHipotetica) {
            this.erro(variavel.simbolo, `Variável ${variavel.simbolo.lexema} ainda não foi declarada até este ponto.`);
        }
        return Promise.resolve();
    }

    private verificarBinario(binario: Binario): Promise<void> {
        this.verificarLadoBinario(binario.direita);
        this.verificarLadoBinario(binario.esquerda);
        this.verificarOperadorBinario(binario);
        return Promise.resolve();
    }

    private verificarOperadorBinario(binario: Binario): void {
        const operadoresMatematicos = ['ADICAO', 'SUBTRACAO', 'MULTIPLICACAO', 'DIVISAO', 'MODULO'];
        if (operadoresMatematicos.includes(binario.operador.tipo)) {
            if (binario.direita instanceof Variavel && binario.esquerda instanceof Variavel) {
                const tipoDireita = typeof this.variaveis[binario.direita.simbolo.lexema]?.valor;
                const tipoEsquerda = typeof this.variaveis[binario.esquerda.simbolo.lexema]?.valor;
                if (tipoDireita !== tipoEsquerda) {
                    this.erro(binario.operador, `Operação inválida, tipos diferentes.`);
                }
            }
        }

        if (binario.operador.tipo === 'DIVISAO') {
            switch (binario.direita.constructor.name) {
                case 'Variavel':
                    const operadorDireitoLiteral = binario.direita as Variavel;
                    if (this.variaveis[operadorDireitoLiteral.simbolo.lexema]?.valor === 0) {
                        this.erro(binario.operador, `Divisão por zero.`);
                    }
                    break;
            }
        }
    }

    private verificarLadoBinario(lado: Construto): void {
        if (lado instanceof Variavel && !this.variaveis[lado.simbolo.lexema]) {
            this.erro(lado.simbolo, `Variável ${lado.simbolo.lexema} ainda não foi declarada até este ponto.`);
            return;
        }
        if (lado instanceof Binario) {
            this.verificarBinario(lado);
            return;
        }
    }

    private verificarLogico(logio: Logico): Promise<void> {
        this.verificarLadoLogico(logio.direita);
        this.verificarLadoLogico(logio.esquerda);
        return Promise.resolve();
    }

    private verificarChamada(chamada: Chamada): Promise<void> {
        let funcaoChamada = chamada.entidadeChamada as Variavel;
        if (!this.funcoes[funcaoChamada.simbolo.lexema]) {
            this.erro(funcaoChamada.simbolo, `Chamada da função '${funcaoChamada.simbolo.lexema}' não existe.`);
        }

        return Promise.resolve();
    }

    private verificarLadoLogico(lado: any): void {
        if (lado instanceof Variavel) {
            let variavel = lado as Variavel;
            this.verificarVariavelBinaria(variavel);
        }
    }

    visitarDeclaracaoEscreva(declaracao: Escreva) {
        if (declaracao.argumentos.length === 0) {
            const { linha, hashArquivo } = declaracao;
            const simbolo: SimboloInterface<''> = { literal: '', tipo: '', lexema: 'escreva', linha, hashArquivo };
            this.erro(simbolo, `É preciso ter um ou mais parametros para 'escreva(...)'`);
            return Promise.resolve();
        }

        const variaveis = declaracao.argumentos.filter((arg) => arg instanceof Variavel);

        for (let variavel of variaveis as Variavel[]) {
            if (!this.variaveis[variavel.simbolo.lexema]) {
                this.erro(variavel.simbolo, `Variável '${variavel.simbolo.lexema}' não existe.`);
            }

            if (this.variaveis[variavel.simbolo.lexema]?.valor === undefined) {
                this.aviso(variavel.simbolo, `Variável '${variavel.simbolo.lexema}' não foi inicializada.`);
            }
        }

        return Promise.resolve();
    }

    visitarDeclaracaoConst(declaracao: Const): Promise<any> {
        this.verificarTipoAtribuido(declaracao);

        if (this.variaveis.hasOwnProperty(declaracao.simbolo.lexema)) {
            this.erro(declaracao.simbolo, 'Declaração de constante já feita.');
        } else {
            this.variaveis[declaracao.simbolo.lexema] = {
                imutavel: true,
                tipo: declaracao.tipo,
                valor: declaracao.inicializador.valor,
            };
        }

        this.virificarTipoDeclaracaoConst(declaracao);

        return Promise.resolve();
    }

    virificarTipoDeclaracaoConst(declaracao: Const): Promise<any> {
        if (declaracao.inicializador instanceof Binario) {
            // verificar tipos iguais no lado esquerdo e direito
            const binario = declaracao.inicializador as Binario;
            this.verificarLadoBinario(binario.direita);
            this.verificarLadoBinario(binario.esquerda);

            const tipoDireita = typeof binario.direita.valor;
            const tipoEsquerda = typeof binario.esquerda.valor;

            if (tipoDireita !== tipoEsquerda) {
                this.aviso(declaracao.simbolo, 'Declaração de constante com tipos diferentes.');
            }
        }

        return Promise.resolve();
    }

    visitarDeclaracaoVar(declaracao: Var): Promise<any> {
        this.verificarTipoAtribuido(declaracao);

        if (declaracao.inicializador instanceof FuncaoConstruto) {
            const funcao = declaracao.inicializador;
            if (funcao.parametros.length >= 255) {
                this.erro(declaracao.simbolo, 'Função não pode ter mais de 255 parâmetros.');
            }
        }

        this.variaveis[declaracao.simbolo.lexema] = {
            imutavel: false,
            tipo: declaracao.tipo,
            valor:
                declaracao.inicializador !== null
                    ? declaracao.inicializador.valor !== undefined
                        ? declaracao.inicializador.valor
                        : declaracao.inicializador
                    : undefined,
        };

        return Promise.resolve();
    }

    visitarExpressaoRetornar(declaracao: Retorna): Promise<RetornoQuebra> {
        return Promise.resolve(null);
    }

    visitarDeclaracaoDefinicaoFuncao(declaracao: FuncaoDeclaracao) {
        if (declaracao.funcao.tipoRetorno === undefined) {
            this.erro(declaracao.simbolo, `Declaração de retorno da função é inválido.`);
        }

        if (declaracao.funcao.parametros.length >= 255) {
            this.erro(declaracao.simbolo, 'Função não pode ter mais de 255 parâmetros.');
        }

        let tipoRetornoFuncao = declaracao.funcao.tipoRetorno;
        if (tipoRetornoFuncao) {
            let funcaoContemRetorno = declaracao.funcao.corpo.find((c) => c instanceof Retorna) as Retorna;
            if (funcaoContemRetorno) {
                if (tipoRetornoFuncao === 'vazio') {
                    this.erro(declaracao.simbolo, `A função não pode ter nenhum tipo de retorno.`);
                }

                const tipoValor = typeof funcaoContemRetorno.valor.valor;
                if (!['qualquer'].includes(tipoRetornoFuncao)) {
                    if (tipoValor === 'string') {
                        if (tipoRetornoFuncao != 'texto') {
                            this.erro(
                                declaracao.simbolo,
                                `Esperado retorno do tipo '${tipoRetornoFuncao}' dentro da função.`
                            );
                        }
                    }
                    if (tipoValor === 'number') {
                        if (!['inteiro', 'real'].includes(tipoRetornoFuncao)) {
                            this.erro(
                                declaracao.simbolo,
                                `Esperado retorno do tipo '${tipoRetornoFuncao}' dentro da função.`
                            );
                        }
                    }
                }
            } else {
                if (!['vazio', 'qualquer'].includes(tipoRetornoFuncao)) {
                    this.erro(declaracao.simbolo, `Esperado retorno do tipo '${tipoRetornoFuncao}' dentro da função.`);
                }
            }
        }

        this.funcoes[declaracao.simbolo.lexema] = {
            valor: declaracao.funcao,
        };

        return Promise.resolve();
    }

    analisar(declaracoes: Declaracao[]): RetornoAnalisadorSemantico {
        // this.pilhaVariaveis = new PilhaVariaveis();
        // this.pilhaVariaveis.empilhar()
        this.variaveis = {};
        this.atual = 0;
        this.diagnosticos = [];

        while (this.atual < declaracoes.length) {
            declaracoes[this.atual].aceitar(this);
            this.atual++;
        }

        return {
            diagnosticos: this.diagnosticos,
        } as RetornoAnalisadorSemantico;
    }
}
