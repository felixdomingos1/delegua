import { TipoNativoSimbolo, TipoInferencia } from '../inferenciador';

export interface VariavelInterface {
    valor: any;
    tipo: TipoInferencia | TipoNativoSimbolo;
    subtipo?: 'texto' | 'número' | 'longo' | 'lógico';
    imutavel: boolean;
    nomeReferencia?: string;
}
