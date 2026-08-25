import type {
  ContatoParaEscrita,
  DadosDaCorrecao,
  DadosDoCadastro,
  RepositorioEscopadoDeVinculos,
  ResultadoDaCorrecao,
  ResultadoDoCadastro,
  VinculoLido,
} from "@/aplicacao/organizacao";
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
                set nome = $3, atualizado_em = now()
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
  const linhas = await consulta<{
    pessoa_id: string;
    papel: string;
    criado_em: Date;
    pessoa_nome: string;
    tem_conta: boolean;
    area_id: string | null;
    area_nome: string | null;
    area_tipo: string | null;
  }>(
    `select v.pessoa_id,
            v.papel,
            v.criado_em,
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
