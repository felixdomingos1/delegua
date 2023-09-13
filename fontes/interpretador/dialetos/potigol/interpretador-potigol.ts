import { InterpretadorBase } from "../../interpretador-base";

import { registrarBibliotecaGlobalPotigol } from "../../../bibliotecas/dialetos/potigol/biblioteca-global";
import { AcessoMetodo } from "../../../construtos";

import * as comum from './comum';

/**
 * Uma implementação do interpretador de Potigol.
 */
export class InterpretadorPotigol extends InterpretadorBase {
    constructor(
        diretorioBase: string,
        performance = false,
        funcaoDeRetorno: Function = null,
        funcaoDeRetornoMesmaLinha: Function = null
    ) {
        super(diretorioBase, performance, funcaoDeRetorno, funcaoDeRetornoMesmaLinha);
        this.expandirPropriedadesDeObjetosEmEspacoVariaveis = true;

        registrarBibliotecaGlobalPotigol(this, this.pilhaEscoposExecucao);
    }

    async visitarExpressaoAcessoMetodo(expressao: AcessoMetodo): Promise<any> {
        return comum.visitarExpressaoAcessoMetodo(this, expressao);
    }
}
