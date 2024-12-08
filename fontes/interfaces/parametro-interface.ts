import { SimboloInterface } from './simbolo-interface';

export interface ParametroInterface {
    abrangencia: 'padrao' | 'multiplo';
    nome: SimboloInterface;
    tipoDado: string;
    valorPadrao?: any;
    referencia?: boolean;
}
