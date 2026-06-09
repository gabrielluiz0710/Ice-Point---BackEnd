export type BotEstado =
  | 'INICIO'
  | 'MENU_PRINCIPAL'
  | 'CARDAPIO_ENVIADO'
  | 'INFO_ENVIADA'
  | 'ATENDIMENTO_HUMANO'
  | 'ENCOMENDA_INTRO'
  | 'AGUARDANDO_LISTA_PICOLES'
  | 'CONFIRMANDO_ITENS'
  | 'AGUARDANDO_NOME'
  | 'AGUARDANDO_EMAIL'
  | 'AGUARDANDO_DATA_HORA'
  | 'AGUARDANDO_CARRINHO_COR'
  | 'AGUARDANDO_ENTREGA'
  | 'AGUARDANDO_ENDERECO'
  | 'AGUARDANDO_PAGAMENTO'
  | 'CONFIRMANDO_PEDIDO'
  | 'PEDIDO_FINALIZADO';

export interface BotSession {
  id: number;
  telefone: string;
  estado: BotEstado;
  dados_temp: DadosTemp;
  ultima_interacao: Date;
  atendimento_humano: boolean;
}

export interface DadosTemp {
  // Itens do pedido
  itens?: Array<{
    produto_id: number;
    nome: string;
    quantidade: number;
    preco: number;
  }>;

  // Dados pessoais
  nome?: string;
  email?: string;

  // Data e hora
  data_agendada?: string;
  hora_agendada?: string;

  // Carrinho
  carrinho_id?: number;
  carrinho_cor?: string;
  carrinhos_disponiveis?: Array<{
    id: number;
    cor: string;
    identificacao: string;
  }>;

  // Entrega
  metodo_entrega?: 'RETIRADA' | 'ENTREGA';
  endereco_logradouro?: string;
  endereco_numero?: string;
  endereco_complemento?: string;
  endereco_bairro?: string;
  endereco_cidade?: string;
  endereco_estado?: string;
  endereco_cep?: string;
  taxa_entrega?: number;
  distancia?: string;

  // Pagamento
  metodo_pagamento?: 'DINHEIRO' | 'PIX' | 'CARTAO';
  valor_produtos?: number;
  valor_desconto?: number;
  valor_total?: number;
}
