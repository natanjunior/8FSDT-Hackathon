import { criarConsulta, criarTransacao } from "@/infraestrutura/clientes";

import {
  EMAIL_DE_HELENA,
  EMAIL_DE_MARCOS,
  NOME_DA_ORGANIZACAO_A,
  NOME_DA_ORGANIZACAO_B,
} from "./plano";

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
 *
 * **A demonstração é reconhecida por nome E autoria** (item 74). Um dos dois nomes basta para ser
 * candidata; ser fundada por uma das duas contas da demonstração é o que a torna da demonstração. O nome
 * sozinho não serve: `organizacoes.nome` não é único e o cadastro é público, então qualquer pessoa pode
 * fundar uma `Edifício Aurora (demonstração)`. A que tem o nome e outra autoria é **homônima**: a remoção
 * não a toca e a devolve nomeada, e a semeadura recusa escrever ao lado dela.
 */

export type OrganizacaoEncontrada = {
  readonly id: string;
  readonly nome: string;
  readonly codigoPublico: string;
  readonly ocorrencias: number;
};

export type Reconhecimento = {
  /** Um dos dois nomes, fundada por uma das contas da demonstração. */
  readonly daDemonstracao: readonly OrganizacaoEncontrada[];
  /** Um dos dois nomes, e qualquer outra autoria, inclusive nenhuma. */
  readonly homonimas: readonly OrganizacaoEncontrada[];
};

/** Os dois nomes do critério 43.5. Metade da identificação; a outra metade é a autoria. */
export const NOMES_DA_DEMONSTRACAO: readonly string[] = [
  NOME_DA_ORGANIZACAO_A,
  NOME_DA_ORGANIZACAO_B,
];

/** As duas contas que fundam a demonstração (`plano.ts`, Recanto Azul por Helena e Aurora por Marcos). */
export const EMAILS_DA_DEMONSTRACAO: readonly string[] = [EMAIL_DE_HELENA, EMAIL_DE_MARCOS];

/**
 * As tabelas escopadas, **em ordem de dependência**.
 *
 * `anexos` e `autorizacoes_de_upload` não recebem linha da semente (§3.8: a demonstração não tem anexo),
 * mas `anexos` entra na lista assim mesmo: um `delete` de zero linhas custa nada, e o dia em que a
 * demonstração ganhar anexo é o dia em que ninguém vai lembrar de acrescentá-la aqui.
 * `autorizacoes_de_upload` fica de fora porque **não tem `organizacao_id`** — é o livro-caixa global do
 * limite de 30/h.
 *
 * **`registros_transicao` está aqui, e só pode estar por causa da migração 013**: o gatilho da trilha
 * recusa `delete` fora da transação que liga `resolveai.remocao_da_demonstracao`. Ver `apagarADemonstracao`.
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
 * **A consulta de reconhecimento, uma só para as duas pontas.** Duas definições de "o que é a
 * demonstração" produziriam uma semente que recusa por causa de uma organização que o `--apagar` depois
 * não apaga.
 *
 * **O fundador é lido a partir de `vinculos`**, pela regra de que consulta que envolva pessoas parte de
 * `vinculos`. A FK composta `(criada_por_pessoa_id, id)` → `vinculos` (migração 001) garante que o
 * vínculo do fundador existe. `left join` porque `criada_por_pessoa_id` é anulável: a organização sem
 * fundador cai como homônima, e nunca some da lista.
 */
const RECONHECER = `
  select o.id,
         o.nome,
         o.codigo_publico,
         (select count(*) from ocorrencias oc where oc.organizacao_id = o.id) as ocorrencias,
         coalesce(u.email = any($2::text[]), false) as da_demonstracao
    from organizacoes o
    left join vinculos v on v.organizacao_id = o.id and v.pessoa_id = o.criada_por_pessoa_id
    left join pessoas p on p.id = v.pessoa_id
    left join auth.users u on u.id = p.usuario_id
   where o.nome = any($1::text[])
   order by o.nome, o.codigo_publico`;

type LinhaReconhecida = {
  id: string;
  nome: string;
  codigo_publico: string;
  ocorrencias: string;
  da_demonstracao: boolean;
};

function separar(linhas: readonly LinhaReconhecida[]): Reconhecimento {
  const paraEncontrada = (linha: LinhaReconhecida): OrganizacaoEncontrada => ({
    id: linha.id,
    nome: linha.nome,
    codigoPublico: linha.codigo_publico,
    // `count(*)` volta como `bigint`, e o driver o entrega como texto para não perder precisão.
    ocorrencias: Number(linha.ocorrencias),
  });
  return {
    daDemonstracao: linhas.filter((l) => l.da_demonstracao).map(paraEncontrada),
    homonimas: linhas.filter((l) => !l.da_demonstracao).map(paraEncontrada),
  };
}

/**
 * O host de `BANCO_URL`, com a porta, **sem usuário nem senha**. É a primeira linha do `--apagar`: um
 * `BANCO_URL` errado no shell aparece antes de qualquer `delete`.
 */
export function hostDoBanco(url: string | undefined): string {
  if (url === undefined || url.trim() === "") return "(BANCO_URL não definida)";
  try {
    const alvo = new URL(url);
    return alvo.port === "" ? alvo.hostname : `${alvo.hostname}:${alvo.port}`;
  } catch {
    return "(BANCO_URL ilegível)";
  }
}

/**
 * As organizações de demonstração que já existem, e os homônimos, com a contagem de ocorrências de cada.
 *
 * É o que a linha de comando usa para **recusar antes de escrever**: sem esta pergunta, uma execução
 * distraída faz nascer a terceira e a quarta organização de demonstração.
 *
 * `emails` e `nomes` são o perfil do mundo a reconhecer. A linha de comando os passa a partir do perfil
 * escolhido, a demonstração ou o gêmeo de teste (item 63). O teste de integração passa e-mails próprios,
 * porque `auth.users` não é derrubada entre execuções e as contas reais da demonstração existem no local.
 */
export async function organizacoesDaDemonstracao(
  emails: readonly string[] = EMAILS_DA_DEMONSTRACAO,
  nomes: readonly string[] = NOMES_DA_DEMONSTRACAO,
): Promise<Reconhecimento> {
  const consulta = criarConsulta();
  return separar(await consulta<LinhaReconhecida>(RECONHECER, [[...nomes], [...emails]]));
}

/**
 * Apaga as organizações da demonstração inteiras, e devolve os homônimos que deixou.
 *
 * **Tudo numa transação só, e não é conveniência.** A FK `(criada_por_pessoa_id, id)` de `organizacoes`
 * para `vinculos` é `DEFERRABLE INITIALLY DEFERRED` (modelo §6.3): apagar o vínculo antes da organização
 * só funciona porque a verificação é adiada para o `COMMIT`, quando nenhuma das duas linhas existe mais.
 * Em duas transações, o primeiro `delete` é recusado.
 *
 * **A primeira instrução liga a porta nomeada da trilha** (migração 013). Com `set_config(..., true)` o
 * valor vale até o fim DESTA transação e some sozinho no `commit` ou no `rollback`: não há `finally` para
 * esquecer, e nenhuma outra sessão ganha a exceção enquanto esta roda. O gatilho nunca é desligado.
 *
 * **As Pessoas apagadas saem dos vínculos que acabamos de apagar, nunca de uma varredura em `pessoas`** —
 * é o item do DoD que o lint não alcança, porque a consulta seria legítima: ela apenas partiria da tabela
 * global. E só caem as que ficaram **sem nenhum vínculo** e **sem conta**: os `pessoas` das duas contas
 * sobrevivem, e uma nova semeadura os reaproveita.
 *
 * **O `update vinculos set area_id = null` vem antes dos `delete`, e sem ele nada disto funciona.** `areas`
 * e `vinculos` se referenciam nos DOIS sentidos, ambos `on delete restrict` e nenhum diferido:
 * `areas.criado_por_pessoa_id` → `vinculos` (002:141) e `vinculos.area_id` → `areas` (002:171-175). Com
 * o laço fechado, `delete from areas` é recusado enquanto houver vínculo com `area_id` (a semente cria
 * três: Cláudia, Jorge e Diego, pelo `cadastrarVinculo`, que grava `area_id` —
 * `vinculos-escopados.ts:65-69`), e `delete from vinculos` é recusado enquanto houver área criada por
 * eles. Anular a coluna primeiro é o corte mais barato do laço: ela é anulável por decisão declarada
 * (*"o Gestor e o Encarregado terceirizado não têm unidade"*), e as linhas caem inteiras logo depois.
 *
 * **O segundo `update` anula `organizacoes.atualizado_por_pessoa_id`, pela mesma razão.** A coluna aponta
 * para `vinculos` com `on delete restrict` **imediato** (migração 010), ao contrário da FK do fundador, que
 * é diferida: bastaria um Gestor ter salvo a configuração uma vez para o `delete from vinculos` ser
 * recusado. As demais colunas de autoria moram em linhas que caem antes de `vinculos`. O `update` dispara o
 * gatilho de relógio da 012 numa linha que é apagada logo depois, então não tem efeito.
 */
export async function apagarADemonstracao(
  emails: readonly string[] = EMAILS_DA_DEMONSTRACAO,
  nomes: readonly string[] = NOMES_DA_DEMONSTRACAO,
): Promise<{ organizacoes: number; pessoas: number; homonimas: readonly OrganizacaoEncontrada[] }> {
  const emTransacao = criarTransacao();

  return emTransacao(async (executar) => {
    await executar(`select set_config('resolveai.remocao_da_demonstracao', 'sim', true)`);

    const { daDemonstracao, homonimas } = separar(
      await executar<LinhaReconhecida>(RECONHECER, [[...nomes], [...emails]]),
    );
    if (daDemonstracao.length === 0) return { organizacoes: 0, pessoas: 0, homonimas };

    const ids = daDemonstracao.map((organizacao) => organizacao.id);

    // **Corta o laço `areas` ⇄ `vinculos` ANTES do primeiro `delete`** — ver o cabeçalho desta função.
    await executar(`update vinculos set area_id = null where organizacao_id = any($1::uuid[])`, [ids]);
    // **E a última escrita da configuração**, pela mesma razão: FK imediata para `vinculos` (migração 010).
    await executar(`update organizacoes set atualizado_por_pessoa_id = null where id = any($1::uuid[])`, [
      ids,
    ]);

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

    return { organizacoes: ids.length, pessoas: apagadas.length, homonimas };
  });
}
