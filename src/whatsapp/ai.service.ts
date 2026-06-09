import { Injectable, Logger } from '@nestjs/common';
import { OpenAI } from 'openai';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }

  async interpretarPicoles(
    textoCliente: string,
    catalogo: {
      id: number | string;
      nome: string;
      preco_unitario: number | string;
      [key: string]: any;
    }[],
  ): Promise<{
    sucesso: boolean;
    itens?: any[];
    nao_encontrados?: string[];
    erro?: string;
  }> {
    const catalogoStr = catalogo
      .map(
        (p) =>
          `ID:${p.id} | ${p.nome} | R$${Number(p.preco_unitario).toFixed(2)}`,
      )
      .join('\n');

    const prompt = `Você é um assistente de uma sorveteria chamada Ice Point. O cliente enviou uma lista de picolés que deseja encomendar.

CATÁLOGO DISPONÍVEL:
${catalogoStr}

Minha tarefa é interpretar a mensagem do cliente e mapear para os produtos do catálogo.
- Faça match mesmo com erros de digitação, abreviações, nomes parciais ou escritas alternativas.
- Se o cliente não especificar quantidade para algum item, assuma 1.
- Se o cliente escrever algo como "10 de chocolate e 5 morango", interprete como 10x chocolate e 5x morango.
- Se um item não corresponder a nenhum produto, liste-o em "nao_encontrados".
- IMPORTANTE: Use o produto_id e nome EXATOS do catálogo.

Responda APENAS com JSON válido, sem markdown nem explicações:
{"itens": [{"produto_id": 1, "nome": "Nome Exato do Catálogo", "quantidade": 5}], "nao_encontrados": ["item não encontrado"]}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: textoCliente },
        ],
        response_format: { type: 'json_object' },
      });

      const responseText = response.choices[0]?.message?.content || '';
      const cleaned = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleaned) as {
        itens?: any[];
        nao_encontrados?: string[];
      };

      return {
        sucesso: true,
        itens: parsed.itens || [],
        nao_encontrados: parsed.nao_encontrados || [],
      };
    } catch (err: unknown) {
      this.logger.error('Erro ao interpretar picolés com OpenAI:', err);
      const error = err as { status?: unknown };
      if (error?.status === 429) {
        return { sucesso: false, erro: '429_TOO_MANY_REQUESTS' };
      }
      return { sucesso: false, erro: 'Não consegui interpretar a lista.' };
    }
  }

  async interpretarDataHora(textoCliente: string): Promise<{
    sucesso: boolean;
    data?: string;
    hora?: string;
    erro?: string;
  }> {
    const agora = new Date();
    const hoje = agora.toISOString().split('T')[0];
    const diaSemana = agora.toLocaleDateString('pt-BR', { weekday: 'long' });

    const prompt = `Você é um assistente. O cliente informou a data e horário de um evento (festa).

DATA DE HOJE: ${hoje} (${diaSemana})

Extraia a data e o horário informados. Considere formatos brasileiros:
- DD/MM/AAAA, DD/MM
- "dia 25 de dezembro", "25 de dezembro às 16h"
- "sábado que vem às 16h", "próximo sábado"
- "daqui 2 semanas", "semana que vem"

Regras:
- Se o ano não for mencionado, assuma ${agora.getFullYear()} ou ${agora.getFullYear() + 1} se a data já passou neste ano.
- Se apenas a hora for informada sem data, retorne data como null.
- Se apenas a data for informada sem hora, retorne hora como null.
- Horário deve estar no formato HH:MM (24h).

Responda APENAS com JSON válido, sem markdown:
{"data": "YYYY-MM-DD", "hora": "HH:MM"}

Se não conseguir interpretar nenhum dos dois, responda:
{"data": null, "hora": null}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: textoCliente },
        ],
        response_format: { type: 'json_object' },
      });

      const responseText = response.choices[0]?.message?.content || '';
      const cleaned = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleaned) as { data?: string; hora?: string };

      if (!parsed.data && !parsed.hora) {
        return {
          sucesso: false,
          erro: 'Não consegui identificar a data nem o horário.',
        };
      }

      return { sucesso: true, data: parsed.data, hora: parsed.hora };
    } catch (err: unknown) {
      this.logger.error('Erro ao interpretar data/hora com OpenAI:', err);
      const error = err as { status?: unknown };
      if (error?.status === 429) {
        return { sucesso: false, erro: '429_TOO_MANY_REQUESTS' };
      }
      return {
        sucesso: false,
        erro: 'Não consegui interpretar a data/hora.',
      };
    }
  }

  async interpretarEndereco(
    textoCliente: string,
  ): Promise<{ sucesso: boolean; endereco?: any; erro?: string }> {
    const prompt = `Você é um assistente. O cliente informou um endereço de entrega. O serviço só atende em Uberaba-MG.

Extraia as partes do endereço. Se o cliente não informar cidade, assuma Uberaba. Se não informar estado, assuma MG.

Responda APENAS com JSON válido, sem markdown:
{
  "logradouro": "Rua/Av nome completo",
  "numero": "123",
  "complemento": "apto 1 (ou null se não informado)",
  "bairro": "Nome do bairro (ou null se não informado)",
  "cidade": "Uberaba",
  "estado": "MG"
}

Se não conseguir interpretar o endereço, responda:
{"erro": "Não consegui interpretar o endereço"}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: textoCliente },
        ],
        response_format: { type: 'json_object' },
      });

      const responseText = response.choices[0]?.message?.content || '';
      const cleaned = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleaned) as {
        erro?: string;
        [key: string]: any;
      };

      if (parsed.erro) {
        return { sucesso: false, erro: parsed.erro };
      }

      return { sucesso: true, endereco: parsed };
    } catch (err: unknown) {
      this.logger.error('Erro ao interpretar endereço com OpenAI:', err);
      const error = err as { status?: unknown };
      if (error?.status === 429) {
        return { sucesso: false, erro: '429_TOO_MANY_REQUESTS' };
      }
      return {
        sucesso: false,
        erro: 'Não consegui interpretar o endereço.',
      };
    }
  }

  async buscarCepViaCep(
    estado: string,
    cidade: string,
    logradouro: string,
  ): Promise<string | null> {
    try {
      const url = `https://viacep.com.br/ws/${encodeURIComponent(estado)}/${encodeURIComponent(cidade)}/${encodeURIComponent(logradouro)}/json/`;
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const data = (await response.json()) as any[];

      if (Array.isArray(data) && data.length > 0) {
        return (data[0] as { cep: string }).cep;
      }
      return null;
    } catch (error) {
      this.logger.error('Erro ao buscar CEP no ViaCEP:', error);
      return null;
    }
  }

  async buscarEnderecoPorCep(cep: string): Promise<Record<string, any> | null> {
    try {
      const cepLimpo = cep.replace(/\D/g, '');
      const url = `https://viacep.com.br/ws/${cepLimpo}/json/`;
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const data = (await response.json()) as Record<string, any>;

      if (data.erro) return null;
      return data;
    } catch (error) {
      this.logger.error('Erro ao buscar endereço por CEP:', error);
      return null;
    }
  }
}
