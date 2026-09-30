import { alterarConfiguracao, lerConfiguracao } from "@/aplicacao/organizacao";
import { FormatoInvalido, comContexto } from "@/interface/http";
import { projetarConfiguracao } from "@/interface/projecoes";
import { alteracaoDeConfiguracaoSchema } from "@/interface/schemas";

/**
 * `GET /configuracao` — as regras da organização ativa e as mudanças delas (item 99, T-15).
 *
 * **`/configuracao`, e não `/organizacoes/configuracao`:** o verificador de contrato recusa caminho que
 * nomeie organização fora dos dois permitidos, que é a ADR-0003 virada mecanismo. A organização vem da
 * sessão, e este é também o endereço da tela.
 *
 * **`organizacao.configurar` também na leitura:** o Solicitante não lê a configuração; o efeito dela
 * chega a ele pronto, em `acoesDisponiveis`.
 */
export const GET = comContexto({ exige: "organizacao.configurar" }, async ({ repos }) =>
  projetarConfiguracao(await lerConfiguracao(repos.configuracao)),
);

/**
 * `PATCH /configuracao` — mudar as regras (item 99).
 *
 * **A trilha é escrita pelo gatilho da migração 017, dentro da mesma instrução**, com o valor anterior da
 * linha travada pelo `update`: é o que faz a segunda de duas escritas simultâneas registrar o valor que a
 * primeira deixou. Gravar o valor que já está lá responde `200` e não deixa rastro, porque a trilha
 * registra mudança e aquilo não é uma.
 *
 * **O corpo vazio é recusado aqui**, e não no schema: *"informe ao menos um campo"* é regra do endpoint,
 * a mesma divisão de `PATCH /organizacoes`.
 */
export const PATCH = comContexto(
  { exige: "organizacao.configurar", corpo: alteracaoDeConfiguracaoSchema },
  async ({ ctx, repos, corpo }) => {
    if (
      corpo.exigirSolucaoAoResolver === undefined &&
      corpo.limiteDeCancelamentoDoSolicitante === undefined
    ) {
      throw new FormatoInvalido([
        {
          campo: "corpo",
          codigo: "OBRIGATORIO",
          mensagem: "Informe ao menos um campo para alterar.",
        },
      ]);
    }

    return projetarConfiguracao(
      await alterarConfiguracao(repos.configuracao, { ...corpo, porPessoaId: ctx.pessoaId }),
    );
  },
);

/** Escala a zero e cookie de sessão: nada aqui é cacheável (RNF5). */
export const dynamic = "force-dynamic";
