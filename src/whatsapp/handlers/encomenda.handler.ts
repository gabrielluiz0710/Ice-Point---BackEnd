import { Injectable, Logger } from '@nestjs/common';
import { EvolutionService } from '../evolution.service';
import { SessionService } from '../session.service';
import { AiService } from '../ai.service';
import { ShippingService } from '../../shipping/shipping.service';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

const CART_IMAGES = {
  azul: 'https://db.icepoint.com.br/storage/v1/object/public/images/carrinhos/azul.webp',
  rosa: 'https://db.icepoint.com.br/storage/v1/object/public/images/carrinhos/rosa.webp',
  misto:
    'https://db.icepoint.com.br/storage/v1/object/public/images/carrinhos/misto.webp',
};

@Injectable()
export class EncomendaHandler {
  private readonly logger = new Logger(EncomendaHandler.name);
  private supabase: SupabaseClient;

  constructor(
    private readonly evo: EvolutionService,
    private readonly session: SessionService,
    private readonly aiService: AiService,
    private readonly shippingService: ShippingService,
  ) {
    this.supabase = createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    );
  }

  // ======================================================
  //  ENTRY POINT — chamado pelo MenuHandler (opção 2)
  // ======================================================

  async iniciarEncomenda(ctx: any): Promise<void> {
    const { remoteJid, telefone } = ctx;

    // 1. Regras e informações
    await this.evo.sendText(
      remoteJid,
      '🛒 *Encomenda de Carrinho de Picolé para Festa!*\n\n' +
        '📌 Algumas informações importantes:\n\n' +
        '✅ O carrinho é *emprestado sem custo*!\n' +
        '✅ É necessário escolher no *mínimo 80 picolés*\n' +
        '✅ O pagamento pode ser feito no *momento da entrega e/ou retirada*\n\n' +
        '💻 Se preferir, você também pode fazer a encomenda pelo nosso site:\n' +
        'https://www.icepoint.com.br\n\n' +
        '_Vamos montar seu pedido! 🎉_',
    );
    await this.delay(1500);

    // 2. Imagens dos carrinhos
    for (const [cor, url] of Object.entries(CART_IMAGES)) {
      await this.evo.sendImage(remoteJid, url, `🛒 Carrinho ${cor}`);
      await this.delay(1000);
    }

    // 3. Catálogo de produtos por categoria (sem números)
    const produtos = await this.getProdutos();
    const porCategoria: Record<string, any[]> = {};
    for (const p of produtos) {
      const cat = p.categoria?.nome || 'Outros';
      if (!porCategoria[cat]) porCategoria[cat] = [];
      porCategoria[cat].push(p);
    }

    let catalogo = '📋 *Nosso Cardápio de Picolés*\n\n';
    const categoriasOrdenadas = Object.keys(porCategoria).sort();
    for (const cat of categoriasOrdenadas) {
      catalogo += `🍦 *${cat}*\n`;
      const produtosCat = porCategoria[cat].sort((a: any, b: any) =>
        a.nome.localeCompare(b.nome),
      );
      for (const p of produtosCat) {
        catalogo += `• ${p.nome} — R$ ${Number(p.preco_unitario).toFixed(2)}\n`;
      }
      catalogo += '\n';
    }
    await this.evo.sendText(remoteJid, catalogo);
    await this.delay(500);

    // 4. Pedir a lista
    await this.evo.sendText(
      remoteJid,
      '📝 Agora me passe a *lista dos picolés* que você gostaria!\n\n' +
        'Pode escrever de forma livre, por exemplo:\n' +
        '_"20 de chocolate, 15 morango, 10 limão..."_\n\n' +
        '📌 Lembre-se: mínimo de *80 picolés*.\n\n' +
        '_📌 Digite *menu* a qualquer momento para voltar ao início_',
    );

    await this.session.update(telefone, 'AGUARDANDO_LISTA_PICOLES', {});
  }

  // ======================================================
  //  ROTEAMENTO POR ESTADO
  // ======================================================

  async handle(ctx: any): Promise<void> {
    const { remoteJid, telefone, texto, session } = ctx;
    const estado = session.estado;
    const dados = session.dados_temp || {};

    switch (estado) {
      case 'AGUARDANDO_LISTA_PICOLES':
        await this.handleListaPicoles(remoteJid, telefone, texto, dados);
        break;
      case 'CONFIRMANDO_ITENS':
        await this.handleConfirmandoItens(
          ctx,
          remoteJid,
          telefone,
          texto,
          dados,
        );
        break;
      case 'AGUARDANDO_NOME':
        await this.handleNome(remoteJid, telefone, texto, dados);
        break;
      case 'AGUARDANDO_EMAIL':
        await this.handleEmail(remoteJid, telefone, texto, dados);
        break;
      case 'AGUARDANDO_DATA_HORA':
        await this.handleDataHora(remoteJid, telefone, texto, dados);
        break;
      case 'AGUARDANDO_CARRINHO_COR':
        await this.handleCarrinhoCor(remoteJid, telefone, texto, dados);
        break;
      case 'AGUARDANDO_ENTREGA':
        await this.handleEntrega(remoteJid, telefone, texto, dados);
        break;
      case 'AGUARDANDO_ENDERECO':
        await this.handleEndereco(remoteJid, telefone, texto, dados);
        break;
      case 'AGUARDANDO_PAGAMENTO':
        await this.handlePagamento(remoteJid, telefone, texto, dados);
        break;
    }
  }

  // ======================================================
  //  HANDLERS DE CADA ESTADO
  // ======================================================

  /** AGUARDANDO_LISTA_PICOLES — interpreta via IA, valida mínimo 80 */
  private async handleListaPicoles(
    remoteJid: string,
    telefone: string,
    texto: string,
    dados: any,
  ): Promise<void> {
    await this.evo.sendText(remoteJid, '🔄 Analisando sua lista...');

    const produtos = await this.getProdutos();
    const resultado = await this.aiService.interpretarPicoles(texto, produtos);

    if (!resultado.sucesso) {
      if (resultado.erro === '429_TOO_MANY_REQUESTS') {
        await this.evo.sendText(
          remoteJid,
          '⏳ Nosso sistema de inteligência artificial está um pouco sobrecarregado no momento.\n\nPor favor, *aguarde 30 segundos* e tente enviar a sua lista novamente! 🙏',
        );
        return;
      }

      await this.evo.sendText(
        remoteJid,
        '❌ Não consegui entender sua lista. Pode tentar novamente?\n\n' +
          'Escreva os picolés que deseja, por exemplo:\n' +
          '_"20 de chocolate, 15 morango, 10 limão..."_',
      );
      return;
    }

    // Montar itens com preços
    const novosItens = (resultado.itens || []).map((item: any) => {
      const produtoDB = produtos.find((p: any) => p.id === item.produto_id);
      return {
        produto_id: item.produto_id,
        nome: item.nome,
        quantidade: item.quantidade,
        preco: produtoDB ? Number(produtoDB.preco_unitario) : 0,
      };
    });

    // Mesclar com itens existentes (caso de "adicionar mais")
    const itensExistentes: any[] = dados.itens || [];
    const itensMerged = [...itensExistentes];

    for (const novo of novosItens) {
      const existente = itensMerged.find(
        (i: any) => i.produto_id === novo.produto_id,
      );
      if (existente) {
        existente.quantidade += novo.quantidade;
      } else {
        itensMerged.push(novo);
      }
    }

    const totalPicoles = itensMerged.reduce(
      (acc: number, i: any) => acc + i.quantidade,
      0,
    );
    const naoEncontrados = resultado.nao_encontrados || [];

    // Validar mínimo de 80
    if (totalPicoles < 80) {
      let msg = `⚠️ Você selecionou *${totalPicoles} picolés*, mas o mínimo é *80*.\n\n`;
      msg += '📦 *Seus itens até agora:*\n';
      itensMerged.forEach((i: any) => {
        msg += `• ${i.nome} × ${i.quantidade}\n`;
      });
      if (naoEncontrados.length > 0) {
        msg += `\n❓ *Não encontrei:* ${naoEncontrados.join(', ')}\n`;
      }
      msg += `\n📝 Quais outros picolés gostaria de *adicionar*?\n`;
      msg += `_Faltam pelo menos *${80 - totalPicoles}* picolés para atingir o mínimo._`;

      await this.evo.sendText(remoteJid, msg);
      await this.session.update(telefone, 'AGUARDANDO_LISTA_PICOLES', {
        ...dados,
        itens: itensMerged,
      });
      return;
    }

    // Exibir resumo e pedir confirmação
    const valorProdutos = itensMerged.reduce(
      (acc: number, i: any) => acc + i.preco * i.quantidade,
      0,
    );

    let msg = '✅ *Resumo dos picolés selecionados:*\n\n';
    itensMerged.forEach((i: any) => {
      msg += `• ${i.nome} × ${i.quantidade} — R$ ${(i.preco * i.quantidade).toFixed(2)}\n`;
    });
    msg += `\n📊 *Total:* ${totalPicoles} picolés — R$ ${valorProdutos.toFixed(2)}\n`;

    if (naoEncontrados.length > 0) {
      msg += `\n❓ *Não encontrei:* ${naoEncontrados.join(', ')}\n`;
    }

    msg += '\n───────────────────\n';
    msg += '*1* - ✅ Confirmar itens\n';
    msg += '*2* - ✏️ Refazer lista\n';
    msg += '*3* - ➕ Adicionar mais picolés\n';

    await this.evo.sendText(remoteJid, msg);
    await this.session.update(telefone, 'CONFIRMANDO_ITENS', {
      ...dados,
      itens: itensMerged,
      valor_produtos: valorProdutos,
    });
  }

  /** CONFIRMANDO_ITENS — confirma / refaz / adiciona */
  private async handleConfirmandoItens(
    ctx: any,
    remoteJid: string,
    telefone: string,
    texto: string,
    dados: any,
  ): Promise<void> {
    switch (texto) {
      case '1':
      case 'sim':
      case 'confirmar':
        await this.session.update(telefone, 'AGUARDANDO_NOME', dados);
        await this.evo.sendText(
          remoteJid,
          '👤 Ótimo! Agora preciso de algumas informações.\n\nQual é o seu *nome completo*?',
        );
        break;

      case '2':
      case 'refazer':
        await this.session.update(telefone, 'AGUARDANDO_LISTA_PICOLES', {
          ...dados,
          itens: undefined,
          valor_produtos: undefined,
        });
        await this.evo.sendText(
          remoteJid,
          '📝 Sem problemas! Me passe a nova lista de picolés.\n\n' +
            'Pode escrever de forma livre, por exemplo:\n' +
            '_"20 de chocolate, 15 morango, 10 limão..."_',
        );
        break;

      case '3':
      case 'adicionar':
        await this.session.update(telefone, 'AGUARDANDO_LISTA_PICOLES', dados);
        await this.evo.sendText(
          remoteJid,
          '➕ Me passe os picolés que gostaria de *adicionar*.\n\n' +
            'Vou somar aos que você já escolheu!',
        );
        break;

      default:
        await this.evo.sendText(
          remoteJid,
          'Escolha uma opção:\n\n' +
            '*1* - ✅ Confirmar itens\n' +
            '*2* - ✏️ Refazer lista\n' +
            '*3* - ➕ Adicionar mais picolés',
        );
    }
  }

  /** AGUARDANDO_NOME */
  private async handleNome(
    remoteJid: string,
    telefone: string,
    texto: string,
    dados: any,
  ): Promise<void> {
    if (texto.length < 3) {
      await this.evo.sendText(
        remoteJid,
        'Por favor, informe um nome válido (mínimo 3 caracteres).',
      );
      return;
    }

    const nomeFmt = texto.replace(/\b\w/g, (l: string) => l.toUpperCase());
    await this.session.update(telefone, 'AGUARDANDO_EMAIL', {
      ...dados,
      nome: nomeFmt,
    });
    await this.evo.sendText(
      remoteJid,
      `Prazer, *${nomeFmt}*! 👋\n\nAgora, qual é o seu *email*?\n\n_Usamos o email para enviar a confirmação do pedido._`,
    );
  }

  /** AGUARDANDO_EMAIL */
  private async handleEmail(
    remoteJid: string,
    telefone: string,
    texto: string,
    dados: any,
  ): Promise<void> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(texto)) {
      await this.evo.sendText(
        remoteJid,
        '❌ Email inválido. Por favor, informe um email válido.\n_Exemplo: seuemail@gmail.com_',
      );
      return;
    }
    await this.session.update(telefone, 'AGUARDANDO_DATA_HORA', {
      ...dados,
      email: texto.toLowerCase(),
    });
    await this.evo.sendText(
      remoteJid,
      '📅 Qual será a *data e o horário* da festa/evento?\n\n' +
        'Pode escrever de forma livre, por exemplo:\n' +
        '_"dia 25 de dezembro às 16h"_\n' +
        '_"sábado que vem às 14:00"_\n' +
        '_"15/06/2026 16:30"_',
    );
  }

  /** AGUARDANDO_DATA_HORA — interpreta via IA, verifica carrinhos */
  private async handleDataHora(
    remoteJid: string,
    telefone: string,
    texto: string,
    dados: any,
  ): Promise<void> {
    await this.evo.sendText(remoteJid, '🔄 Interpretando a data...');

    const resultado = await this.aiService.interpretarDataHora(texto);

    if (!resultado.sucesso) {
      if (resultado.erro === '429_TOO_MANY_REQUESTS') {
        await this.evo.sendText(
          remoteJid,
          '⏳ Nosso sistema de inteligência artificial está um pouco sobrecarregado no momento.\n\nPor favor, *aguarde 30 segundos* e informe a data/hora novamente! 🙏',
        );
        return;
      }

      await this.evo.sendText(
        remoteJid,
        '❌ Não consegui entender a data/hora. Pode tentar novamente?\n\n' +
          'Exemplos:\n' +
          '_"25/12/2026 às 16h"_\n' +
          '_"próximo sábado às 14:00"_',
      );
      return;
    }

    // Mesclar com dados parciais anteriores
    const data = resultado.data || dados.data_agendada;
    const hora = resultado.hora || dados.hora_agendada;

    if (!data) {
      await this.evo.sendText(
        remoteJid,
        `📅 Consegui o horário (*${hora}*), mas não identifiquei a *data*.\n\nPode informar a data? Ex: _"25/12/2026"_`,
      );
      if (hora) {
        await this.session.update(telefone, 'AGUARDANDO_DATA_HORA', {
          ...dados,
          hora_agendada: hora,
        });
      }
      return;
    }

    if (!hora) {
      await this.evo.sendText(
        remoteJid,
        `📅 Consegui a data (*${this.formatDateBR(data)}*), mas não identifiquei o *horário*.\n\nPode informar o horário? Ex: _"16:00"_`,
      );
      await this.session.update(telefone, 'AGUARDANDO_DATA_HORA', {
        ...dados,
        data_agendada: data,
      });
      return;
    }

    // Validar data futura
    const dataEvento = new Date(`${data}T${hora}:00`);
    if (dataEvento < new Date()) {
      await this.evo.sendText(
        remoteJid,
        '❌ Essa data/hora já passou. Por favor, informe uma data *futura*.',
      );
      return;
    }

    // Verificar carrinhos disponíveis
    await this.evo.sendText(
      remoteJid,
      '🔄 Verificando carrinhos disponíveis...',
    );
    const carrinhos = await this.checkAvailableCarts(data);

    if (carrinhos.length === 0) {
      await this.evo.sendText(
        remoteJid,
        '😕 Infelizmente, não temos carrinhos disponíveis para essa data.\n\n' +
          'Pode tentar outra data?\n\n' +
          '📅 Informe uma *nova data e horário*:',
      );
      return;
    }

    // Exibir opções de cor
    let msg = `📅 Data: *${this.formatDateBR(data)}* às *${hora}*\n\n`;
    msg += '🛒 *Carrinhos disponíveis:*\n\n';
    carrinhos.forEach((c: any, i: number) => {
      msg += `*${i + 1}* - Carrinho ${c.cor} (${c.identificacao})\n`;
    });
    msg += '\nQual carrinho você prefere? _Digite o número_';

    await this.evo.sendText(remoteJid, msg);
    await this.session.update(telefone, 'AGUARDANDO_CARRINHO_COR', {
      ...dados,
      data_agendada: data,
      hora_agendada: hora,
      carrinhos_disponiveis: carrinhos.map((c: any) => ({
        id: c.id,
        cor: c.cor,
        identificacao: c.identificacao,
      })),
    });
  }

  /** AGUARDANDO_CARRINHO_COR */
  private async handleCarrinhoCor(
    remoteJid: string,
    telefone: string,
    texto: string,
    dados: any,
  ): Promise<void> {
    const carrinhos = dados.carrinhos_disponiveis || [];
    const idx = parseInt(texto) - 1;

    if (isNaN(idx) || idx < 0 || idx >= carrinhos.length) {
      await this.evo.sendText(
        remoteJid,
        `❌ Opção inválida. Digite um número entre *1* e *${carrinhos.length}*.`,
      );
      return;
    }

    const carrinhoEscolhido = carrinhos[idx];
    await this.session.update(telefone, 'AGUARDANDO_ENTREGA', {
      ...dados,
      carrinho_id: carrinhoEscolhido.id,
      carrinho_cor: carrinhoEscolhido.cor,
    });

    await this.evo.sendText(
      remoteJid,
      `✅ Carrinho *${carrinhoEscolhido.cor}* selecionado!\n\n` +
        'Como você prefere?\n\n' +
        '*1* - 🏠 Retirar na sorveteria\n' +
        '*2* - 🚗 Entregar no endereço da festa\n\n' +
        '_Nota: levamos e buscamos o carrinho!_',
    );
  }

  /** AGUARDANDO_ENTREGA — retirada ou entrega */
  private async handleEntrega(
    remoteJid: string,
    telefone: string,
    texto: string,
    dados: any,
  ): Promise<void> {
    if (
      texto === '1' ||
      texto.includes('retirar') ||
      texto.includes('retirada')
    ) {
      await this.session.update(telefone, 'AGUARDANDO_PAGAMENTO', {
        ...dados,
        metodo_entrega: 'RETIRADA',
        taxa_entrega: 0,
      });
      await this.enviarOpcoesPagamento(remoteJid, dados, 0);
    } else if (texto === '2' || texto.includes('entreg')) {
      await this.session.update(telefone, 'AGUARDANDO_ENDERECO', {
        ...dados,
        metodo_entrega: 'ENTREGA',
      });
      await this.evo.sendText(
        remoteJid,
        '📍 Qual é o *endereço completo* da festa?\n\n' +
          'Pode escrever de forma livre, por exemplo:\n' +
          '_"Rua das Flores, 123, bairro Centro"_\n\n' +
          '⚠️ Só atendemos endereços em *Uberaba - MG*.',
      );
    } else {
      await this.evo.sendText(
        remoteJid,
        'Digite *1* para retirar na sorveteria ou *2* para entrega.',
      );
    }
  }

  /** AGUARDANDO_ENDERECO — interpreta via IA + ViaCEP + calcula frete */
  private async handleEndereco(
    remoteJid: string,
    telefone: string,
    texto: string,
    dados: any,
  ): Promise<void> {
    await this.evo.sendText(remoteJid, '🔄 Analisando o endereço...');

    const resultado = await this.aiService.interpretarEndereco(texto);

    if (!resultado.sucesso) {
      if (resultado.erro === '429_TOO_MANY_REQUESTS') {
        await this.evo.sendText(
          remoteJid,
          '⏳ Nosso sistema de inteligência artificial está um pouco sobrecarregado no momento.\n\nPor favor, *aguarde 30 segundos* e digite o endereço novamente! 🙏',
        );
        return;
      }

      await this.evo.sendText(
        remoteJid,
        '❌ Não consegui interpretar o endereço. Pode tentar novamente?\n\n' +
          '_Informe rua, número e bairro._',
      );
      return;
    }

    const endereco = resultado.endereco;

    // Validar se é Uberaba-MG
    const cidadeNorm = (endereco.cidade || '').toLowerCase().trim();
    const estadoNorm = (endereco.estado || '').toUpperCase().trim();

    if (cidadeNorm !== 'uberaba' || estadoNorm !== 'MG') {
      await this.evo.sendText(
        remoteJid,
        '❌ Desculpe, só atendemos endereços em *Uberaba - MG*.\n\n' +
          'Você pode:\n' +
          '*1* - 🏠 Retirar na sorveteria\n' +
          '*2* - 📝 Informar outro endereço',
      );
      return;
    }

    // Buscar CEP se não informado
    let cep = endereco.cep;
    if (!cep && endereco.logradouro) {
      cep = await this.aiService.buscarCepViaCep(
        endereco.estado,
        endereco.cidade,
        endereco.logradouro,
      );
    }

    if (!cep) {
      await this.evo.sendText(
        remoteJid,
        '❌ Não consegui encontrar o CEP desse endereço.\n\n' +
          'Pode me informar o *CEP*? Ou tente informar o endereço novamente com mais detalhes.',
      );
      return;
    }

    // Calcular frete
    try {
      const shippingResult = await this.shippingService.calculateShippingFee({
        street: endereco.logradouro,
        number: endereco.numero || 'S/N',
        city: endereco.cidade,
        state: endereco.estado,
        cep: cep,
        neighborhood: endereco.bairro,
      });

      const taxa = shippingResult.fee;

      await this.evo.sendText(
        remoteJid,
        `📍 *Endereço identificado:*\n` +
          `${endereco.logradouro}, ${endereco.numero || 'S/N'}` +
          `${endereco.complemento ? ' - ' + endereco.complemento : ''}\n` +
          `${endereco.bairro || ''} - ${endereco.cidade}/${endereco.estado}\n` +
          `CEP: ${cep}\n\n` +
          `📏 Distância: *${shippingResult.distance}*\n` +
          `🚗 Taxa de entrega (ida e volta): *R$ ${taxa.toFixed(2)}*`,
      );

      await this.session.update(telefone, 'AGUARDANDO_PAGAMENTO', {
        ...dados,
        metodo_entrega: 'ENTREGA',
        endereco_logradouro: endereco.logradouro,
        endereco_numero: endereco.numero || 'S/N',
        endereco_complemento: endereco.complemento || null,
        endereco_bairro: endereco.bairro,
        endereco_cidade: endereco.cidade,
        endereco_estado: endereco.estado,
        endereco_cep: cep,
        taxa_entrega: taxa,
        distancia: shippingResult.distance,
      });

      await this.delay(500);
      await this.enviarOpcoesPagamento(remoteJid, dados, taxa);
    } catch (error) {
      this.logger.error('Erro ao calcular frete:', error);
      await this.evo.sendText(
        remoteJid,
        '❌ Não consegui calcular o frete para esse endereço.\n\n' +
          'Pode tentar novamente ou falar com um atendente.\n\n' +
          '*1* - 📝 Tentar outro endereço\n' +
          '*2* - 👤 Falar com atendente',
      );
    }
  }

  /** AGUARDANDO_PAGAMENTO — método de pagamento + resumo final */
  private async handlePagamento(
    remoteJid: string,
    telefone: string,
    texto: string,
    dados: any,
  ): Promise<void> {
    let metodo: 'DINHEIRO' | 'PIX' | 'CARTAO' | null = null;
    if (texto === '1' || texto.includes('dinheiro')) metodo = 'DINHEIRO';
    else if (texto === '2' || texto.includes('pix')) metodo = 'PIX';
    else if (texto === '3' || texto.includes('cart')) metodo = 'CARTAO';

    if (!metodo) {
      await this.enviarOpcoesPagamento(
        remoteJid,
        dados,
        dados.taxa_entrega || 0,
      );
      return;
    }

    const valorProdutos = dados.valor_produtos || 0;
    const taxaEntrega = dados.taxa_entrega || 0;
    const temDesconto = metodo === 'DINHEIRO' || metodo === 'PIX';
    const valorDesconto = temDesconto ? valorProdutos * 0.1 : 0;
    const valorTotal = valorProdutos - valorDesconto + taxaEntrega;

    const metodoLabel =
      metodo === 'DINHEIRO'
        ? 'Dinheiro 💵'
        : metodo === 'PIX'
          ? 'Pix 💠'
          : 'Cartão 💳';

    // Resumo completo
    let resumo = '📋 *RESUMO DO SEU PEDIDO*\n\n';
    resumo += `👤 *Nome:* ${dados.nome}\n`;
    resumo += `📧 *Email:* ${dados.email}\n`;
    resumo += `📱 *Telefone:* ${telefone}\n`;
    resumo += `📅 *Data:* ${this.formatDateBR(dados.data_agendada)} às ${dados.hora_agendada}\n`;
    resumo += `🛒 *Carrinho:* ${dados.carrinho_cor}\n`;
    resumo += `🚗 *Entrega:* ${dados.metodo_entrega === 'RETIRADA' ? 'Retirada na sorveteria' : 'Entrega no endereço'}\n`;

    if (dados.metodo_entrega === 'ENTREGA') {
      resumo += `📍 ${dados.endereco_logradouro}, ${dados.endereco_numero}`;
      if (dados.endereco_bairro) resumo += ` - ${dados.endereco_bairro}`;
      resumo += ` - ${dados.endereco_cidade}/${dados.endereco_estado}\n`;
    }

    resumo += `💳 *Pagamento:* ${metodoLabel}\n\n`;
    resumo += '───────────────────\n';
    resumo += '🍦 *Picolés:*\n';
    const itens = dados.itens || [];
    itens.forEach((i: any) => {
      resumo += `• ${i.nome} × ${i.quantidade} — R$ ${(i.preco * i.quantidade).toFixed(2)}\n`;
    });

    resumo += '\n───────────────────\n';
    resumo += `💰 Subtotal: R$ ${valorProdutos.toFixed(2)}\n`;
    if (temDesconto) {
      resumo += `🏷️ Desconto (10%): - R$ ${valorDesconto.toFixed(2)}\n`;
    }
    if (taxaEntrega > 0) {
      resumo += `🚗 Frete: R$ ${taxaEntrega.toFixed(2)}\n`;
    }
    resumo += `\n*💰 TOTAL: R$ ${valorTotal.toFixed(2)}*\n`;
    resumo += '\n───────────────────\n\n';
    resumo += '*1* - ✅ Confirmar pedido\n';
    resumo += '*2* - ❌ Cancelar\n';
    resumo += '*3* - ✏️ Editar pedido\n';

    await this.evo.sendText(remoteJid, resumo);
    await this.session.update(telefone, 'CONFIRMANDO_PEDIDO', {
      ...dados,
      metodo_pagamento: metodo,
      valor_desconto: valorDesconto,
      valor_total: valorTotal,
    });
  }

  // ======================================================
  //  HELPERS
  // ======================================================

  private async enviarOpcoesPagamento(
    remoteJid: string,
    dados: any,
    taxa: number,
  ): Promise<void> {
    const valorProdutos = dados.valor_produtos || 0;

    let msg = '💳 *Como deseja pagar?*\n\n';
    msg += `*1* - 💵 Dinheiro _(10% de desconto = R$ ${(valorProdutos * 0.1).toFixed(2)} off)_\n`;
    msg += `*2* - 💠 Pix _(10% de desconto = R$ ${(valorProdutos * 0.1).toFixed(2)} off)_\n`;
    msg += '*3* - 💳 Cartão\n';

    if (taxa > 0) {
      msg +=
        '\n_⚠️ O desconto de 10% é aplicado apenas nos produtos, não no frete._';
    }

    await this.evo.sendText(remoteJid, msg);
  }

  private async checkAvailableCarts(dataStr: string): Promise<any[]> {
    // Buscar todos os carrinhos ativos
    const { data: todosCarrinhos } = await this.supabase
      .from('carrinhos')
      .select('*')
      .eq('status', 'DISPONIVEL');

    if (!todosCarrinhos || todosCarrinhos.length === 0) return [];

    // Buscar encomendas não-canceladas para a data
    const { data: encomendasNaData } = await this.supabase
      .from('encomendas')
      .select('id')
      .eq('data_agendada', dataStr)
      .not('status', 'eq', 'CANCELADO');

    if (!encomendasNaData || encomendasNaData.length === 0)
      return todosCarrinhos;

    const encomendaIds = encomendasNaData.map((e: any) => e.id);

    // Buscar carrinhos já comprometidos
    const { data: carrinhosOcupados } = await this.supabase
      .from('encomendas_carrinhos')
      .select('carrinho_id')
      .in('encomenda_id', encomendaIds);

    const idsOcupados = (carrinhosOcupados || []).map(
      (ec: any) => ec.carrinho_id,
    );

    return todosCarrinhos.filter((c: any) => !idsOcupados.includes(c.id));
  }

  private async getProdutos(): Promise<any[]> {
    const { data } = await this.supabase
      .from('produtos')
      .select(
        'id, nome, descricao, preco_unitario, imagem_capa, categoria:categorias(nome)',
      )
      .eq('disponivel', true)
      .order('nome');
    return data || [];
  }

  private formatDateBR(dateStr: string): string {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
