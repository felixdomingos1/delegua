import { Simbolo } from './lexador';
import tipoDeDadosPrimitivos from './tipos-de-dados/primitivos';
import tipoDeDadosDelegua from './tipos-de-dados/delegua';
import tiposDeSimbolos from './tipos-de-simbolos/delegua';
import { TipoDadosElementar } from './tipo-dados-elementar';
export type TipoInferencia =
    | 'cadeia'
    | 'caracter'
    | 'dicionário'
    | 'função'
    | 'lógico'
    | 'lógico[]'
    | 'longo'
    | 'longo[]'
    | 'módulo'
    | 'nulo'
    | 'número'
    | 'número[]'
    | 'objeto'
    | 'símbolo'
    | 'texto'
    | 'texto[]'
    | 'vazio'
    | 'vetor';

export enum TipoNativoSimbolo {
    ESCREVA = '<palavra reservada escreva ajuda="palavra reservada usada para apresentar informações">',
    LEIA = '<palavra reservada leia ajuda="palavra reservada usada para entrada de dados">',
    FUNCAO = '<palavra reservada funcao ajuda="palavra reservada usada para criar funções">',
    SE = '<palavra reservada se ajuda="palavra reservada usada para estruturas condicionais">',
    ENQUANTO = '<palavra reservada enquanto ajuda="palavra reservada usada para loops enquanto">',
    PARA = '<palavra reservada para ajuda="palavra reservada usada para loops para">',
    RETORNA = '<palavra reservada retornar ajuda="palavra reservada usada para retornar valores em funções">',
    INTEIRO = '<palavra reservada inteiro ajuda="palavra reservada usada para definir variáveis do tipo inteiro">',
    TEXTO = '<palavra reservada texto ajuda="palavra reservada usada para definir variáveis do tipo texto">',
    BOOLEANO = '<palavra reservada booleano ajuda="palavra reservada usada para definir variáveis do tipo booleano">',
    VAZIO = '<palavra reservada vazio ajuda="palavra reservada usada para definir funções que não retornam valores">',
}

function inferirVetor(vetor: Array<any>): TipoInferencia {
    const tiposEmVetor = new Set(vetor.map((elemento) => typeof elemento));
    if (tiposEmVetor.size > 1) {
        return 'vetor';
    }

    const tipoVetor = tiposEmVetor.values().next().value;
    switch (tipoVetor) {
        case 'bigint':
            return 'longo[]';
        case 'boolean':
            return 'lógico[]';
        case 'number':
            return 'número[]';
        case 'string':
            return 'texto[]';
        case 'object':
            const tiposObjetosEmVetor = new Set(vetor.map((elemento) => (elemento as any).tipo));
            if (tiposObjetosEmVetor.size > 1) {
                return 'vetor';
            }

            return `${tiposObjetosEmVetor.values().next().value}[]` as TipoInferencia;
        default:
            return 'vetor';
    }
}

export function inferirTipoVariavel(
    variavel: string | number | Array<any> | boolean | null | undefined
): TipoInferencia | TipoNativoSimbolo {
    const tipo = typeof variavel;
    switch (tipo) {
        case 'string':
            return 'texto';
        case 'number':
            return 'número';
        case 'bigint':
            return 'longo';
        case 'boolean':
            return 'lógico';
        case 'undefined':
            return 'nulo';
        case 'object':
            if (Array.isArray(variavel)) {
                return inferirVetor(variavel);
            }

            if (variavel === null) return 'nulo';
            if (variavel.constructor.name === 'DeleguaFuncao') return 'função';
            if (variavel.constructor.name === 'DeleguaModulo') return 'módulo';
            if (variavel.constructor.name === 'Classe') return 'objeto';
            if (variavel.constructor.name === 'Simbolo') {
                if (typeof variavel === 'object') {
                    const simbolo = variavel as Simbolo;
                    if (simbolo.tipo === tiposDeSimbolos.ESCREVA) return TipoNativoSimbolo.ESCREVA;
                    if (simbolo.tipo === tiposDeSimbolos.FUNCAO || simbolo.tipo === tiposDeSimbolos.FUNÇÃO)
                        return TipoNativoSimbolo.FUNCAO;
                    if (simbolo.tipo === tiposDeSimbolos.LEIA) return TipoNativoSimbolo.LEIA;
                    if (simbolo.tipo === tiposDeSimbolos.SE) return TipoNativoSimbolo.SE;
                    if (simbolo.tipo === tiposDeSimbolos.ENQUANTO) return TipoNativoSimbolo.ENQUANTO;
                    if (simbolo.tipo === tiposDeSimbolos.PARA) return TipoNativoSimbolo.PARA;
                    if (simbolo.tipo === tiposDeSimbolos.RETORNA) return TipoNativoSimbolo.RETORNA;
                    if (simbolo.tipo === tipoDeDadosPrimitivos.TEXTO) return TipoNativoSimbolo.TEXTO;
                    if (simbolo.tipo === tipoDeDadosPrimitivos.BOOLEANO) return TipoNativoSimbolo.BOOLEANO;
                    if (simbolo.tipo === tipoDeDadosDelegua.VAZIO) return TipoNativoSimbolo.VAZIO;
                }
            }
            return 'dicionário';
        case 'function':
            return 'função';
        case 'symbol':
            return 'símbolo';
    }
}

export function tipoInferenciaParaTipoDadosElementar(tipoInferencia: TipoInferencia): TipoDadosElementar {
    switch (tipoInferencia) {
        // TODO: Colocar exceções aqui.
        default:
            return tipoInferencia as TipoDadosElementar;
    }
}
