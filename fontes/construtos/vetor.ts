import { VisitanteComumInterface } from '../interfaces';
import { Construto } from './construto';

export class Vetor implements Construto {
    linha: number;
    hashArquivo: number;
    tamanho: number;

    valores: any[];

    constructor(hashArquivo: number, linha: number, valores: any[], tamanho?: number) {
        this.linha = linha;
        this.hashArquivo = hashArquivo;

        this.valores = valores;
        if (tamanho) {
            this.tamanho = tamanho;
        } else {
            this.tamanho = this.valores.length;
        }
    }

    async aceitar(visitante: VisitanteComumInterface): Promise<any> {
        return await visitante.visitarExpressaoVetor(this);
    }
}
