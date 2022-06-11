import { InterpretadorInterface, ResolvedorInterface, SimboloInterface } from "../interfaces";
import { Declaracao } from "./declaracao";


export class Retorna extends Declaracao {
    simboloChave: SimboloInterface;
    valor: any;

    constructor(simboloChave: SimboloInterface, valor: any) {
        super(Number(simboloChave.linha), simboloChave.hashArquivo);
        this.simboloChave = simboloChave;
        this.valor = valor;
    }

    aceitar(visitante: ResolvedorInterface | InterpretadorInterface): any {
        return visitante.visitarExpressaoRetornar(this);
    }
}
