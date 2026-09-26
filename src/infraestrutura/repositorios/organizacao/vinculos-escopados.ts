import type {
  ContatoParaEscrita,
  DadosDaCorrecao,
  DadosDoCadastro,
  ImpedimentoDeRemocao,
  RepositorioEscopadoDeVinculos,
  ResultadoDaCorrecao,
  ResultadoDaRemocao,
  ResultadoDaRevogacao,
  ResultadoDoCadastro,
  VinculoLido,
} from "@/aplicacao/organizacao";
import { TERMINAIS } from "@/dominio/ocorrencia";
import { ehPapel, ehTipoDeArea } from "@/dominio/organizacao";
import type { ConsultaEscopada, TransacaoEscopada } from "@/infraestrutura/contexto";

/**
 * ============================================================================
 *  Os vínculos, escopados — item 9a
 * ============================================================================
 *
 * Note o que este arquivo **não** contém: a palavra `organizacao_id` num valor. Ela está em `$1`, e `$1` é
 * injetado pelo ponto de estrangulamento (`infraestrutura/contexto/escopo.ts`) — o repositório não sabe
 * qual é a organização e **não tem como saber**. É a ADR-0003 levada à assinatura.
 *
 * **As quatro consultas partem de `vinculos`.** Inclusive a de contatos, que é a mais fácil de escrever ao
 * contrário: `contatos` é tabela **global**, e uma consulta que partisse dela devolveria telefone e e-mail
 * de todas as pessoas de todas as organizações. Partir de `vinculos` não é estilo — é o filtro.
 *
 * **A escrita em `pessoas` cavalga dentro da escrita em `vinculos`, e isso não é truque.** `pessoas` é
 * global e não tem coluna de organização; um `insert` nela sozinho seria recusado pela trava do escopo, e
 * corretamente. A CTE do `cadastrar` põe a criação da Pessoa **dentro** da instrução que cria o Vínculo:
 * a instrução referencia `$1`, é atômica por si só, e **não existe caminho que produza Pessoa sem
 * Vínculo** — que é exatamente o que o contrato §4.6 promete.
 *
 * **A escrita em `contatos` cavalga do mesmo jeito, e por um motivo mais forte.** `contatos` é global e é
 * a tabela mais sensível do esquema. Um `delete from contatos where pessoa_id = $2` seria **recusado em
 * execução** pela trava do `escoparConsulta`, que exige `$1` — e é bom que seja: sem passar por
 * `vinculos`, uma organização reescreveria o contato de quem só tem vínculo em outra. As duas instruções
 * abaixo partem de `vinculos`, e é o `where organizacao_id = $1` delas que fecha essa porta.
 */
export function repositorioEscopadoDeVinculos(
  consulta: ConsultaEscopada,
  emTransacao: TransacaoEscopada,
): RepositorioEscopadoDeVinculos {
  return {
    ativos() {
      return lerVinculos(consulta, null);
    },

    async porPessoa(pessoaId) {
      const lidos = await lerVinculos(consulta, pessoaId);
      return lidos[0] ?? null;
    },

    cadastrar(dados: DadosDoCadastro) {
      return emTransacao<ResultadoDoCadastro>(async (dentro) => {
        if (dados.areaId !== null && !(await areaVale(dentro, dados.areaId))) {
          return { desfecho: "area-invalida" };
        }

        // A CTE cria a Pessoa **dentro** da instrução que cria o Vínculo. Se o `insert` externo for
        // recusado — a FK composta `(area_id, organizacao_id)` pega Área de outra organização —, a CTE
        // volta atrás junto, e não sobra Pessoa órfã.
        const criados = await dentro<{ pessoa_id: string }>(
          `with nova_pessoa as (
             insert into pessoas (nome) values ($3) returning id
           )
           insert into vinculos (pessoa_id, organizacao_id, papel, area_id)
           select nova_pessoa.id, $1, $2::papel_vinculo, $4::uuid
             from nova_pessoa
           returning pessoa_id`,
          [dados.papel, dados.nome, dados.areaId],
        );

        const criado = criados[0];
        if (criado === undefined) {
          throw new Error("insert ... returning não devolveu linha — invariante violada");
        }

        try {
          await escreverContatos(dentro, criado.pessoa_id, dados.contatos);
        } catch (erro) {
          // A transação inteira volta atrás: nem Pessoa, nem Vínculo, nem contato pela metade.
          if (ehContatoDuplicado(erro)) return { desfecho: "contato-duplicado" };
          throw erro;
        }

        const vinculo = (await lerVinculos(dentro, criado.pessoa_id))[0];
        if (vinculo === undefined) {
          throw new Error("vínculo recém-criado não encontrado — invariante violada");
        }
        return { desfecho: "cadastrado", vinculo };
      });
    },

    corrigir(dados: DadosDaCorrecao) {
      return emTransacao<ResultadoDaCorrecao>(async (dentro) => {
        if (dados.areaId !== undefined && dados.areaId !== null) {
          if (!(await areaVale(dentro, dados.areaId))) return { desfecho: "area-invalida" };
        }

        if (dados.nome !== undefined) {
          // **A guarda por campo mora no `where`, não numa leitura prévia.** `from vinculos` escopa: só é
          // alcançável quem tem vínculo NESTA organização. `usuario_id is null` é a guarda de `pessoas`,
          // que é global.
          const alteradas = await dentro<{ id: string }>(
            `update pessoas p
                set nome = $3
               from vinculos v
              where v.pessoa_id = p.id
                and v.organizacao_id = $1
                and v.revogado_em is null
                and p.id = $2
                and p.usuario_id is null
            returning p.id`,
            [dados.pessoaId, dados.nome],
          );

          if (alteradas.length === 0) return await distinguirRecusa(dentro, dados.pessoaId);
        }

        if (dados.contatos !== undefined) {
          // A guarda de quem tem conta vale para contatos pela mesma razão do `nome`: `contatos` é
          // global, e reescrevê-la mudaria como aquela pessoa é alcançada em TODAS as organizações dela.
          if (!(await pessoaEditavel(dentro, dados.pessoaId))) {
            return await distinguirRecusa(dentro, dados.pessoaId);
          }

          // Substituição: apaga a lista inteira e reinsere. É a única tabela do esquema que recebe
          // `DELETE` de rotina, e está declarado na §11.4 do modelo — o "nada é apagado" do RNF9 não vale
          // aqui.
          await apagarContatos(dentro, dados.pessoaId);

          try {
            await escreverContatos(dentro, dados.pessoaId, dados.contatos);
          } catch (erro) {
            if (ehContatoDuplicado(erro)) return { desfecho: "contato-duplicado" };
            throw erro;
          }
        }

        if (dados.areaId !== undefined) {
          const alterados = await dentro<{ pessoa_id: string }>(
            `update vinculos
                set area_id = $3::uuid
              where organizacao_id = $1
                and pessoa_id = $2
                and revogado_em is null
            returning pessoa_id`,
            [dados.pessoaId, dados.areaId],
          );

          if (alterados.length === 0) return { desfecho: "nao-encontrado" };
        }

        const vinculo = (await lerVinculos(dentro, dados.pessoaId))[0];
        if (vinculo === undefined) return { desfecho: "nao-encontrado" };
        return { desfecho: "corrigido", vinculo };
      });
    },

    async remover(pessoaId: string): Promise<ResultadoDaRemocao> {
      try {
        return await emTransacao<ResultadoDaRemocao>(async (dentro) => {
          // **A trava, e ela é tomada SEMPRE — não só quando o alvo é Gestor.**
          //
          // Com dois Gestores e `read committed`, os dois se removendo no mesmo instante veem um ao outro
          // — nenhuma exclusão está visível para a outra transação — e as duas passam, deixando a
          // organização com zero Gestores. É o **PA-24 entrando pela porta da frente**, pela guarda que
          // existe justamente para fechá-la. A segunda sessão bloqueia aqui, e ao desbloquear reavalia o
          // `exists` de baixo sobre o estado já comitado.
          //
          // Descobrir o papel antes custaria a leitura prévia que a doutrina deste arquivo recusa, e são
          // poucas linhas numa tela de trabalho de escritório.
          await dentro(
            `select 1 from vinculos
              where organizacao_id = $1 and papel = 'gestor' and revogado_em is null
                for update`,
          );

          // **A guarda do último Gestor mora no `where`** — a doutrina de `corrigir` (`:100-121`). Assim a
          // instrução nunca chega a violar chave nenhuma quando o alvo é o último Gestor, e o critério
          // 10.3 lê verdadeiro no cenário que ele nomeia: o Gestor inicial TEM dependente
          // (`organizacoes.criada_por_pessoa_id`), e traduzir a recusa do banco primeiro responderia
          // `VINCULO_COM_HISTORICO` onde o contrato promete `ULTIMO_GESTOR`.
          //
          // **A guarda do histórico continua sendo do banco**, como o critério 10.2 exige: nenhum `select`
          // a antecipa. O `23503` sobe e é traduzido no `catch` lá embaixo.
          const removidos = await dentro<{ pessoa_id: string }>(
            `delete from vinculos v
              where v.organizacao_id = $1
                and v.pessoa_id = $2
                and v.revogado_em is null
                and (v.papel <> 'gestor'
                     or exists (select 1 from vinculos g
                                 where g.organizacao_id = $1
                                   and g.pessoa_id     <> $2
                                   and g.papel          = 'gestor'
                                   and g.revogado_em is null))
            returning v.pessoa_id`,
            [pessoaId],
          );

          if (removidos.length > 0) return { desfecho: "removido" };

          // Zero linhas tem exatamente duas causas, e o contrato as distingue: ou não há vínculo ativo com
          // esta Pessoa nesta organização (`404`), ou ele é o último Gestor (`409`). É o mesmo movimento
          // de `distinguirRecusa`, com a pergunta desta operação.
          const restantes = await dentro<{ papel: string }>(
            `select papel from vinculos
              where organizacao_id = $1 and pessoa_id = $2 and revogado_em is null`,
            [pessoaId],
          );

          return restantes.length === 0
            ? { desfecho: "nao-encontrado" }
            : { desfecho: "ultimo-gestor" };
        });
      } catch (erro) {
        // **O `catch` fica AQUI, em volta da chamada a `emTransacao`, e não dentro dela** — a forma de
        // `organizacoes.criar`. `organizacoes_criada_por_vinculo_fk` é `deferrable initially deferred`
        // (migração `001:246-250`), então essa violação aparece no **`COMMIT`**, depois de a função de
        // trabalho já ter devolvido "removido". Só um `catch` externo pega as duas origens.
        //
        // **`set constraints … immediate` não é opção:** toda consulta escopada é obrigada a referenciar
        // `$1` (`escopo.ts:50`), e aquele comando não tem onde pôr um parâmetro.
        if (ehViolacaoDeDependencia(erro)) return { desfecho: "com-historico" };
        throw erro;
      }
    },

    async revogar(pessoaId: string): Promise<ResultadoDaRevogacao> {
      return emTransacao<ResultadoDaRevogacao>(async (dentro) => {
        // **A MESMA trava do `remover`, e não uma parecida** (spec §3.2). Ela serializa as duas
        // operações entre si: um Gestor removendo o outro enquanto o outro revoga o primeiro, sem trava
        // comum, deixaria a organização com zero Gestores — o PA-24 pela porta que as duas guardas fecham.
        await dentro(
          `select 1 from vinculos
            where organizacao_id = $1 and papel = 'gestor' and revogado_em is null
              for update`,
        );

        // **A guarda do último Gestor mora no `where`**, como no `remover`. E `revogado_em is null` é o
        // que faz o segundo `revogar` sobre a mesma pessoa ser `nao-encontrado`, e não um sucesso vazio.
        //
        // **Não há `catch` de `23503` aqui:** `update` não viola chave estrangeira nenhuma, então nem as
        // nove `restrict` nem a chave diferida de `organizacoes` têm o que recusar. É o item inteiro.
        const revogados = await dentro<{ pessoa_id: string }>(
          `update vinculos v
              set revogado_em = now()
            where v.organizacao_id = $1
              and v.pessoa_id = $2
              and v.revogado_em is null
              and (v.papel <> 'gestor'
                   or exists (select 1 from vinculos g
                               where g.organizacao_id = $1
                                 and g.pessoa_id     <> $2
                                 and g.papel          = 'gestor'
                                 and g.revogado_em is null))
          returning v.pessoa_id`,
          [pessoaId],
        );

        if (revogados.length > 0) return { desfecho: "revogado" };

        // Zero linhas, duas causas — o mesmo movimento do `remover`.
        const restantes = await dentro<{ papel: string }>(
          `select papel from vinculos
            where organizacao_id = $1 and pessoa_id = $2 and revogado_em is null`,
          [pessoaId],
        );

        return restantes.length === 0 ? { desfecho: "nao-encontrado" } : { desfecho: "ultimo-gestor" };
      });
    },

    async impedimentosDeRemocao(): Promise<ReadonlyMap<string, ImpedimentoDeRemocao>> {
      // **Uma consulta só, partindo de `vinculos`.** É a quinta leitura de T-08 — tela grande, trabalho de
      // escritório, uma vez por semana (inventário, T-08). O RNF6 cronometra T-04, não esta.
      //
      // **Os dez `exists` cobrem as NOVE tabelas** que apontam para `vinculos (pessoa_id, organizacao_id)`,
      // por catorze colunas: `atribuicoes`, `categorias` e `organizacoes` com duas, e `areas` com três. O
      // décimo `exists` é o do último Gestor. A lista não sai da prosa do contrato, que nomeia quatro: sai do
      // esquema, e `testes/integracao/vinculo.test.ts` tem um caso que quebra no dia em que uma tabela
      // nova entrar sem passar por aqui.
      //
      // **`organizacoes` passou a ter duas colunas em 16/09/2026** (item 46 · 47): quem corrige o nome da
      // organização deixa rastro em `atualizado_por_pessoa_id`, com FK `on delete restrict`. Sem esta
      // coluna na consulta, T-08 mostraria o botão de remover e o `DELETE` responderia `409`.
      //
      // **`areas` passou a ter três colunas em 17/09/2026** (item 50, migração 011): quem reclassifica uma
      // Área deixa rastro em `tipo_alterado_por_pessoa_id`, com a mesma chave `on delete restrict`.
      const linhas = await consulta<{
        pessoa_id: string;
        ultimo_gestor: boolean;
        tem_historico: boolean;
      }>(
        `select v.pessoa_id,
                (v.papel = 'gestor'
                 and not exists (select 1 from vinculos g
                                  where g.organizacao_id = $1
                                    and g.pessoa_id     <> v.pessoa_id
                                    and g.papel          = 'gestor'
                                    and g.revogado_em is null)) as ultimo_gestor,
                (exists (select 1 from ocorrencias t
                          where t.organizacao_id = $1 and t.autor_pessoa_id = v.pessoa_id)
                 or exists (select 1 from registros_transicao t
                             where t.organizacao_id = $1 and t.autor_pessoa_id = v.pessoa_id)
                 or exists (select 1 from mensagens t
                             where t.organizacao_id = $1 and t.autor_pessoa_id = v.pessoa_id)
                 or exists (select 1 from atribuicoes t
                             where t.organizacao_id = $1
                               and (t.responsavel_pessoa_id = v.pessoa_id
                                    or t.atribuido_por_pessoa_id = v.pessoa_id))
                 or exists (select 1 from anexos t
                             where t.organizacao_id = $1 and t.anexado_por_pessoa_id = v.pessoa_id)
                 or exists (select 1 from pedidos_de_entrada t
                             where t.organizacao_id = $1 and t.decidido_por_pessoa_id = v.pessoa_id)
                 or exists (select 1 from categorias t
                             where t.organizacao_id = $1
                               and (t.criado_por_pessoa_id = v.pessoa_id
                                    or t.atualizado_por_pessoa_id = v.pessoa_id))
                 or exists (select 1 from areas t
                             where t.organizacao_id = $1
                               and (t.criado_por_pessoa_id = v.pessoa_id
                                    or t.atualizado_por_pessoa_id = v.pessoa_id
                                    or t.tipo_alterado_por_pessoa_id = v.pessoa_id))
                 or exists (select 1 from organizacoes t
                             where t.id = $1
                               and (t.criada_por_pessoa_id = v.pessoa_id
                                    or t.atualizado_por_pessoa_id = v.pessoa_id))) as tem_historico
           from vinculos v
          where v.organizacao_id = $1
            and v.revogado_em is null`,
      );

      const mapa = new Map<string, ImpedimentoDeRemocao>();
      for (const linha of linhas) {
        // **`ultimo-gestor` ganha quando os dois valem** (spec §3.4) — a mesma precedência do `remover`,
        // para que a razão da tela e a razão do `409` nunca discordem.
        if (linha.ultimo_gestor) mapa.set(linha.pessoa_id, "ultimo-gestor");
        else if (linha.tem_historico) mapa.set(linha.pessoa_id, "historico");
        // Ausente é *pode sair*. Não há valor nulo neste mapa.
      }
      return mapa;
    },

    async responsabilidadesEmAberto(): Promise<ReadonlyMap<string, number>> {
      // **Parte de `vinculos`**, como toda leitura de gente deste arquivo, e só de vínculo ATIVO: quem já
      // saiu não abre confirmação nenhuma, e não há por que contar para ele.
      //
      // **`TERMINAIS` vem do Domínio e nunca é escrito à mão**, a regra de `dashboard-escopado.ts:47`:
      // um `('resolvida','cancelada')` literal envelhece no dia em que o ciclo ganhar um estado.
      //
      // **O `::int` não é decoração:** `count(*)` é `bigint`, e o `pg` o devolve como string.
      const linhas = await consulta<{ pessoa_id: string; quantas: number }>(
        `select v.pessoa_id, count(*)::int as quantas
           from vinculos v
           join atribuicoes at
             on at.responsavel_pessoa_id = v.pessoa_id
            and at.organizacao_id        = v.organizacao_id
           join ocorrencias o
             on o.id             = at.ocorrencia_id
            and o.organizacao_id = at.organizacao_id
          where v.organizacao_id = $1
            and v.revogado_em is null
            and at.encerrada_em is null
            and o.status <> all($2::status_ocorrencia[])
          group by v.pessoa_id`,
        [[...TERMINAIS]],
      );

      return new Map(linhas.map((linha) => [linha.pessoa_id, linha.quantas]));
    },
  };
}

/**
 * **`ativa` nenhuma constraint alcança** — a FK composta pega só a Área de outra organização, e a resposta
 * dos dois casos é a mesma (contrato §6.3). É a mesma conferência do item 8, na mesma transação da
 * escrita: fora dela, a Área poderia ser desativada entre o `select` e o `insert`.
 */
async function areaVale(consulta: ConsultaEscopada, areaId: string): Promise<boolean> {
  const areas = await consulta<{ id: string }>(
    `select id from areas where organizacao_id = $1 and id = $2 and ativa`,
    [areaId],
  );
  return areas.length > 0;
}

/**
 * Zero linhas alteradas tem exatamente duas causas, e o contrato as distingue: ou não há vínculo com esta
 * Pessoa nesta organização (`404`), ou a Pessoa tem conta (`409`). Se a linha existe **e** `usuario_id` é
 * nulo, o `update` teria casado — então este ramo não tem terceira saída.
 */
async function distinguirRecusa(
  consulta: ConsultaEscopada,
  pessoaId: string,
): Promise<ResultadoDaCorrecao> {
  const linhas = await consulta<{ tem_conta: boolean }>(
    `select (p.usuario_id is not null) as tem_conta
       from vinculos v
       join pessoas p on p.id = v.pessoa_id
      where v.organizacao_id = $1
        and v.pessoa_id = $2
        and v.revogado_em is null`,
    [pessoaId],
  );

  const linha = linhas[0];
  if (linha === undefined) return { desfecho: "nao-encontrado" };
  return linha.tem_conta ? { desfecho: "pessoa-com-conta" } : { desfecho: "nao-encontrado" };
}

/**
 * A leitura, em **duas** consultas para N pessoas — nunca duas por pessoa.
 *
 * `pessoaId` nulo é *"todos"*. O parâmetro entra sempre, e o `is null` do `where` é o que permite uma
 * consulta só servir a lista e o item: duas versões do mesmo SQL divergiriam na primeira alteração, e a
 * que divergisse seria a que ninguém está olhando.
 */
async function lerVinculos(
  consulta: ConsultaEscopada,
  pessoaId: string | null,
): Promise<readonly VinculoLido[]> {
  // **A última atualização do participante é a MAIOR das duas**, a da pessoa e a do vínculo (item 68b).
  // `greatest` no PostgreSQL ignora nulo e só devolve nulo quando todos os argumentos são nulos — é
  // divergência conhecida em relação ao padrão SQL, e é o que se quer aqui.
  // `nullif(p.atualizado_em, p.criado_em)` é como se lê *"a pessoa nunca foi alterada"*: a coluna é
  // `not null default now()`, e `now()` é o instante da transação, então numa linha recém-criada as duas
  // são iguais ao microssegundo. **Limitação declarada:** pessoa criada E alterada na mesma transação
  // leria como nunca alterada. Nenhum caminho do produto faz isso.
  const linhas = await consulta<{
    pessoa_id: string;
    papel: string;
    criado_em: Date;
    atualizado_em: Date | null;
    pessoa_nome: string;
    tem_conta: boolean;
    area_id: string | null;
    area_nome: string | null;
    area_tipo: string | null;
  }>(
    `select v.pessoa_id,
            v.papel,
            v.criado_em,
            greatest(nullif(p.atualizado_em, p.criado_em), v.atualizado_em) as atualizado_em,
            p.nome                        as pessoa_nome,
            (p.usuario_id is not null)    as tem_conta,
            a.id                          as area_id,
            a.nome                        as area_nome,
            a.tipo                        as area_tipo
       from vinculos v
       join pessoas p on p.id = v.pessoa_id
       left join areas a on a.id = v.area_id and a.organizacao_id = v.organizacao_id
      where v.organizacao_id = $1
        and v.revogado_em is null
        and ($2::uuid is null or v.pessoa_id = $2::uuid)
      order by p.nome`,
    [pessoaId],
  );

  if (linhas.length === 0) return [];

  // `ordem` **é** a cadeia de tentativa (modelo §6.17): ler fora dela apresentaria empate como
  // preferência. E a consulta parte de `vinculos`, não de `contatos` — `contatos` é global, e partir dela
  // devolveria o telefone de todas as pessoas de todas as organizações.
  const contatos = await consulta<{
    pessoa_id: string;
    id: string;
    tipo: string;
    valor: string;
    finalidade: string;
    tem_whatsapp: boolean;
    ordem: number;
    observacao: string | null;
  }>(
    `select c.pessoa_id, c.id, c.tipo, c.valor, c.finalidade, c.tem_whatsapp, c.ordem, c.observacao
       from vinculos v
       join contatos c on c.pessoa_id = v.pessoa_id
      where v.organizacao_id = $1
        and v.revogado_em is null
        and ($2::uuid is null or v.pessoa_id = $2::uuid)
      order by c.pessoa_id, c.ordem`,
    [pessoaId],
  );

  const porPessoa = new Map<string, Array<VinculoLido["pessoa"]["contatos"][number]>>();
  for (const contato of contatos) {
    const lista = porPessoa.get(contato.pessoa_id) ?? [];
    lista.push({
      id: contato.id,
      tipo: contato.tipo === "email" ? "email" : "telefone",
      valor: contato.valor,
      finalidade:
        contato.finalidade === "trabalho"
          ? "trabalho"
          : contato.finalidade === "recado"
            ? "recado"
            : "pessoal",
      temWhatsapp: contato.tem_whatsapp,
      ordem: contato.ordem,
      observacao: contato.observacao,
    });
    porPessoa.set(contato.pessoa_id, lista);
  }

  return linhas.map((linha): VinculoLido => {
    if (!ehPapel(linha.papel)) {
      // O tipo `papel_vinculo` do banco e o do domínio saíram da mesma decisão (D4, D27). Se divergirem,
      // é migração aplicada sem código — falha alto, não em silêncio.
      throw new Error(`papel desconhecido vindo do banco: ${linha.papel}`);
    }

    let area: VinculoLido["area"] = null;
    if (linha.area_id !== null && linha.area_nome !== null) {
      if (!ehTipoDeArea(linha.area_tipo)) {
        throw new Error(`tipo de área desconhecido vindo do banco: ${String(linha.area_tipo)}`);
      }
      area = { id: linha.area_id, nome: linha.area_nome, tipo: linha.area_tipo };
    }

    return {
      pessoa: {
        pessoaId: linha.pessoa_id,
        nome: linha.pessoa_nome,
        // Lista vazia quando não há contato — **nunca `null`**, para o cliente não precisar de dois
        // caminhos de leitura (schema `PessoaComContato`).
        contatos: porPessoa.get(linha.pessoa_id) ?? [],
      },
      papel: linha.papel,
      area,
      temConta: linha.tem_conta,
      criadoEm: linha.criado_em.toISOString(),
      atualizadoEm: linha.atualizado_em === null ? null : linha.atualizado_em.toISOString(),
    };
  });
}

/**
 * Apaga os contatos daquela Pessoa — **partindo de `vinculos`**, sempre.
 *
 * O `using vinculos` não é estilo: é o filtro. `contatos` não tem `organizacao_id`, então a única coisa
 * que impede uma organização de apagar o contato de quem está noutra é este `join`.
 */
async function apagarContatos(consulta: ConsultaEscopada, pessoaId: string): Promise<void> {
  await consulta(
    `delete from contatos c
       using vinculos v
      where v.organizacao_id = $1
        and v.pessoa_id = $2
        and v.revogado_em is null
        and c.pessoa_id = v.pessoa_id`,
    [pessoaId],
  );
}

/**
 * Insere a lista, **gravando `ordem` pela posição** (decisão 2.1 da spec).
 *
 * Uma instrução por contato, e não um `unnest`: são um a cinco por pessoa, a transação é a mesma, e o SQL
 * legível vale mais que a viagem economizada. Cada uma parte de `vinculos`, pela razão do `apagarContatos`.
 */
async function escreverContatos(
  consulta: ConsultaEscopada,
  pessoaId: string,
  contatos: readonly ContatoParaEscrita[],
): Promise<void> {
  for (const [indice, contato] of contatos.entries()) {
    await consulta(
      `insert into contatos (pessoa_id, tipo, valor, finalidade, tem_whatsapp, ordem, observacao)
       select v.pessoa_id, $3::tipo_contato, $4, $5::finalidade_contato, $6, $7, $8
         from vinculos v
        where v.organizacao_id = $1
          and v.pessoa_id = $2
          and v.revogado_em is null`,
      [
        pessoaId,
        contato.tipo,
        contato.valor,
        contato.finalidade,
        contato.temWhatsapp,
        indice + 1,
        contato.observacao,
      ],
    );
  }
}

/**
 * A Pessoa existe **nesta** organização e **não tem conta**?
 *
 * **É leitura prévia, e é a única deste arquivo — vale explicar por quê.** A doutrina daqui é *"nenhum
 * desfecho vem de leitura prévia"*, e o `nome` a cumpre pondo a guarda no `where` do próprio `update`. Para
 * contatos isso não fecha: com `contatos: []` **não há instrução nenhuma** cujo número de linhas possa
 * carregar a guarda — apagar zero contatos de quem não tinha contato é indistinguível de apagar zero por
 * ser proibido.
 *
 * A corrida que ela não cobre é uma Pessoa **ganhar conta** entre esta leitura e a escrita, dentro da mesma
 * transação. Não é cenário deste produto: `usuario_id` é preenchido quando alguém cria conta e pede
 * entrada, nunca por um caminho concorrente ao Gestor corrigindo um cadastro.
 */
async function pessoaEditavel(consulta: ConsultaEscopada, pessoaId: string): Promise<boolean> {
  const linhas = await consulta<{ id: string }>(
    `select p.id
       from vinculos v
       join pessoas p on p.id = v.pessoa_id
      where v.organizacao_id = $1
        and v.pessoa_id = $2
        and v.revogado_em is null
        and p.usuario_id is null`,
    [pessoaId],
  );
  return linhas.length > 0;
}

/**
 * **Lê `code` e `constraint` de um objeto desconhecido, sem importar o driver** — a mesma técnica de
 * `organizacoes.ts` e `pedidos-de-entrada.ts`. Confere as **duas**: `23505` sozinho pegaria qualquer
 * unicidade da transação.
 *
 * **`contatos_ordem_uk` não aparece aqui de propósito.** Depois da decisão 2.1 a `ordem` é escrita pelo
 * servidor, `1..N` pela posição — ela não é alcançável por entrada, e traduzi-la para uma recusa do
 * contrato daria nome de erro de usuário a um defeito do servidor.
 */
function ehContatoDuplicado(erro: unknown): boolean {
  const comCodigo = erro as { code?: unknown; constraint?: unknown };
  return comCodigo.code === "23505" && comCodigo.constraint === "contatos_par_uk";
}

/**
 * **A única tradução deste arquivo que NÃO casa nome de restrição, e a razão está escrita para ninguém a
 * "consertar" depois copiando o padrão vizinho.**
 *
 * A transação de `remover` faz exatamente duas instruções — um `select … for update` e um `delete` —,
 * então uma violação de chave estrangeira ali só pode ser uma linha dependente do vínculo. São **nove**
 * tabelas e **catorze** restrições candidatas; enumerá-las pelo nome criaria uma lista que envelhece em
 * silêncio, e é justamente o que o teste de deriva existe para não deixar acontecer do outro lado.
 */
function ehViolacaoDeDependencia(erro: unknown): boolean {
  if (typeof erro !== "object" || erro === null) return false;
  return (erro as { code?: unknown }).code === "23503";
}
