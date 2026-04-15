export type BotEstado =
  | 'INICIO'
  | 'MENU_PRINCIPAL'
  | 'VER_PRODUTOS'
  | 'INICIANDO_ENCOMENDA'
  | 'AGUARDANDO_NOME'
  | 'AGUARDANDO_TELEFONE'
  | 'AGUARDANDO_DATA'
  | 'AGUARDANDO_HORA'
  | 'AGUARDANDO_ENTREGA'
  | 'AGUARDANDO_CEP'
  | 'AGUARDANDO_NUMERO_ENDERECO'
  | 'AGUARDANDO_PRODUTOS'
  | 'AGUARDANDO_QUANTIDADE'
  | 'CONFIRMANDO_PEDIDO'
  | 'PEDIDO_FINALIZADO';

export interface BotSession {
  id: number;
  telefone: string;
  estado: BotEstado;
  dados_temp: DadosTemp;
  ultima_interacao: Date;
}

export interface DadosTemp {
  nome?: string;
  telefone_contato?: string;
  data_agendada?: string;
  hora_agendada?: string;
  metodo_entrega?: 'RETIRADA' | 'ENTREGA';
  cep?: string;
  endereco_numero?: string;
  itens?: Array<{ produto_id: number; nome: string; quantidade: number; preco: number }>;
  produto_selecionado_id?: number;
}