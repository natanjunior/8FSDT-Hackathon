import { criarConsulta, criarTransacao } from "@/infraestrutura/clientes";

import { NOME_DA_ORGANIZACAO_A, NOME_DA_ORGANIZACAO_B } from "./plano";

/**
 * ============================================================================
 *  A conferência de existência e o `--apagar`
 * ============================================================================
 *
 * **O único arquivo do repositório, fora de `src/composicao/`, que alcança `infraestrutura/`** — e o
 * `eslint.config.mjs` diz isso em duas linhas de `files`.
 *
 * **Ele precisa alcançar, e a razão é que não há capacidade a chamar.** O produto não tem
 * *"apagar organização"*, e não vai ter: apagar dado de negócio não é capacidade de produto. Mas o
 * critério 43.5 promete que *"apagar a demonstração é apagar duas organizações, não caçar linhas"* — e com
 * `on delete restrict` em toda parte essa frase **não é executável** sem os `delete` em ordem de
 * dependência. Este arquivo os escreve, uma vez, em ordem, dentro de uma transação.
 *
 * **`SDKS` continua proibido aqui**, e é o que separa esta autorização de uma porta aberta: as duas
 * funções usam `criarConsulta`/`criarTransacao`, nunca o `pg`.
 */

export type OrganizacaoEncontrada = {
  readonly id: string;
  readonly nome: string;
  readonly codigoPublico: string;
  readonly ocorrencias: number;
};

/** Os dois nomes do critério 43.5. **É a identificação inteira** — não há coluna `e_demonstracao`. */
export const NOMES_DA_DEMONSTRACAO: readonly string[] = [
  NOME_DA_ORGANIZACAO_A,
  NOME_DA_ORGANIZACAO_B,
];

/**
 * As tabelas escopadas, **em ordem de dependência**.
 *
 * `anexos` e `autorizacoes_de_upload` não recebem linha da semente (§3.8: a demonstração não tem anexo),
 * mas `anexos` entra na lista assim mesmo: um `delete` de zero linhas custa nada, e o dia em que a
 * demonstração ganhar anexo é o dia em que ninguém vai lembrar de acrescentá-la aqui.
 * `autorizacoes_de_upload` fica de fora porque **não tem `organizacao_id`** — é o livro-caixa global do
 * limite de 30/h.
 *
 * **`vinculos` não está aqui, e não é esquecimento: `areas` e `vinculos` se referenciam nos dois
 * sentidos.** `areas.criado_por_pessoa_id`/`atualizado_por_pessoa_id` apontam para `vinculos`
 * (002:141 e :145, `on delete restrict`), e `vinculos.area_id` aponta de volta para `areas`
 * (002:171-175, `on delete restrict`, e **não** diferida). Nenhuma das duas ordens funciona sozinha —
 * ver `apagarADemonstracao`, que desfaz o laço com um `update` antes do primeiro `delete`.
 */
const TABELAS_ESCOPADAS: readonly string[] = [
  "mensagens",
  "canais_conversa",
  "anexos",
  "atribuicoes",
  "registros_transicao",
  "ocorrencias",
  "pedidos_de_entrada",
  "categorias",
  "areas",
];

/**
 * As organizações de demonstração que já existem, com a contagem de ocorrências de cada uma.
 *
 * É o que a linha de comando usa para **recusar antes de escrever**: sem esta pergunta, uma execução
 * distraída faz nascer a terceira e a quarta organização de demonstração.
 */
export async function organizacoesDaDemonstracao(): Promise<readonly OrganizacaoEncontrada[]> {
  const consulta = criarConsulta();

  const linhas = await consulta<{
    id: string;
    nome: string;
    codigo_publico: string;
    ocorrencias: string;
  }>(
    `select o.id,
            o.nome,
            o.codigo_publico,
            (select count(*) from ocorrencias oc where oc.organizacao_id = o.id) as ocorrencias
       from organizacoes o
      where o.nome = any($1::text[])
      order by o.nome`,
    [[...NOMES_DA_DEMONSTRACAO]],
  );

  return linhas.map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    codigoPublico: linha.codigo_publico,
    // `count(*)` volta como `bigint`, e o driver o entrega como texto para não perder precisão.
    ocorrencias: Number(linha.ocorrencias),
  }));
}

/**
 * Apaga as duas organizações inteiras.
 *
 * **Tudo numa transação só, e não é conveniência.** A FK `(criada_por_pessoa_id, id)` de `organizacoes`
 * para `vinculos` é `DEFERRABLE INITIALLY DEFERRED` (modelo §6.3): apagar o vínculo antes da organização
 * só funciona porque a verificação é adiada para o `COMMIT`, quando nenhuma das duas linhas existe mais.
 * Em duas transações, o primeiro `delete` é recusado.
 *
 * **As Pessoas apagadas saem dos vínculos que acabamos de apagar, nunca de uma varredura em `pessoas`** —
 * é o item do DoD que o lint não alcança, porque a consulta seria legítima: ela apenas partiria da tabela
 * global. E só caem as que ficaram **sem nenhum vínculo** e **sem conta**: os `pessoas` das duas contas
 * sobrevivem, e uma nova semeadura os reaproveita.
 *
 * **O `update vinculos set area_id = null` vem antes de tudo, e sem ele nada disto funciona.** `areas` e
 * `vinculos` se referenciam nos DOIS sentidos, ambos `on delete restrict` e nenhum diferido:
 * `areas.criado_por_pessoa_id` → `vinculos` (002:141) e `vinculos.area_id` → `areas` (002:171-175). Com
 * o laço fechado, `delete from areas` é recusado enquanto houver vínculo com `area_id` (a semente cria
 * três: Cláudia, Jorge e Diego, pelo `cadastrarVinculo`, que grava `area_id` —
 * `vinculos-escopados.ts:65-69`), e `delete from vinculos` é recusado enquanto houver área criada por
 * eles. Anular a coluna primeiro é o corte mais barato do laço: ela é anulável por decisão declarada
 * (*"o Gestor e o Encarregado terceirizado não têm unidade"*), e as linhas caem inteiras logo depois.
 */
export async function apagarADemonstracao(): Promise<{ organizacoes: number; pessoas: number }> {
  const emTransacao = criarTransacao();

  return emTransacao(async (executar) => {
    const encontradas = await executar<{ id: string }>(
      `select id from organizacoes where nome = any($1::text[])`,
      [[...NOMES_DA_DEMONSTRACAO]],
    );
    if (encontradas.length === 0) return { organizacoes: 0, pessoas: 0 };

    const ids = encontradas.map((linha) => linha.id);

    // **Corta o laço `areas` ⇄ `vinculos` ANTES do primeiro `delete`** — ver o cabeçalho desta função.
    await executar(`update vinculos set area_id = null where organizacao_id = any($1::uuid[])`, [ids]);

    for (const tabela of TABELAS_ESCOPADAS) {
      // O nome vem de uma lista fechada deste arquivo, nunca de entrada — não há interpolação de dado.
      await executar(`delete from ${tabela} where organizacao_id = any($1::uuid[])`, [ids]);
    }

    const candidatas = await executar<{ pessoa_id: string }>(
      `select distinct pessoa_id from vinculos where organizacao_id = any($1::uuid[])`,
      [ids],
    );

    await executar(`delete from vinculos where organizacao_id = any($1::uuid[])`, [ids]);
    await executar(`delete from organizacoes where id = any($1::uuid[])`, [ids]);

    const orfas = candidatas.map((linha) => linha.pessoa_id);
    const apagadas =
      orfas.length === 0
        ? []
        : await executar<{ id: string }>(
            `delete from pessoas p
              where p.id = any($1::uuid[])
                and p.usuario_id is null
                and not exists (select 1 from vinculos v where v.pessoa_id = p.id)
            returning p.id`,
            [orfas],
          );

    return { organizacoes: ids.length, pessoas: apagadas.length };
  });
}
