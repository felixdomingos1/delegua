import { VisitanteComumInterface, SimboloInterface } from '../interfaces';
import { Declaracao } from './declaracao';
import { Decorador, FuncaoConstruto } from '../construtos';

/**
 * Uma declaração de função. 
 */
export class FuncaoDeclaracao extends Declaracao {
    simbolo: SimboloInterface;
    funcao: FuncaoConstruto;
    tipoRetorno: string;
    decoradores: Decorador[];

    constructor(
        simbolo: SimboloInterface,
        funcao: FuncaoConstruto,
        tipoRetorno: string = 'qualquer',
        decoradores: Decorador[] = []
    ) {
        super(Number(simbolo.linha), simbolo.hashArquivo);
        this.simbolo = simbolo;
        this.funcao = funcao;
        this.tipoRetorno = tipoRetorno;
        this.decoradores = decoradores;
    }

    async aceitar(visitante: VisitanteComumInterface): Promise<any> {
        return Promise.resolve(visitante.visitarDeclaracaoDefinicaoFuncao(this));
    }
}
