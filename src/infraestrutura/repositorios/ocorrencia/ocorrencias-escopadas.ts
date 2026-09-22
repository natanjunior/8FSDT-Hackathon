import type {
  AnexoLido,
  AtribuicaoLida,
  ComentarioLido,
  ContagensLidas,
  FiltroDeOcorrencias,
  OcorrenciaLida,
  OcorrenciaResumoLida,
  RepositorioEscopadoDeOcorrencias,
  ResultadoDoRegistro,
  TransicaoLida,
} from "@/aplicacao/ocorrencia";
import {
  Avaliacao,
  comandoPermitido,
  Ocorrencia,
  RegistroDeTransicao,
  STATUS,
  TERMINAIS,
  type StatusOcorrencia,
} from "@/dominio/ocorrencia";
import type { ConsultaEscopada, TransacaoEscopada } from "@/infraestrutura/contexto";

/**
 * ============================================================================
 *  O agregado em SQL — duas escritas, um `COMMIT`
 * ============================================================================
 *
 * **`$1` é sempre a organização ativa**, amarrado pelo `escoparConsulta`/`escoparTransacao`. Este arquivo
 * **não recebe** o identificador: não tem como escrever o filtro errado porque não tem o valor
 * (ADR-0003).
 *
 * **Não existe `atualizar` nem `apagar` para `registros_transicao`, e a ausência é a invariante 3.** O
 * gatilho do banco é a defesa em profundidade; o mecanismo primário é esta porta não ter a operação.
 *
 * **A leitura de pessoa parte de `vinculos`, nunca de `pessoas`** — item do DoD que o lint não alcança,
 * porque a consulta seria legítima: ela apenas partiria da tabela errada, e `pessoas` é global.
 */

type LinhaDeContagens = {
  total_filtrado: number;
  todas: number;
  minhas: number;
  em_aberto: number;
  sem_responsavel: number;
  novas: number;
};

/** As colunas da ocorrência mais o que o `join` traz. Fica junto do SQL, que é quem a produz. */
type LinhaDeOcorrencia = {
  id: string;
  titulo: string;
  descricao: string;
  status: OcorrenciaLida["status"];
  prioridade: OcorrenciaLida["prioridade"];
  categoria_id: string;
  categoria_nome: string;
  categoria_icone: string;
  area_id: string;
  area_nome: string;
  area_tipo: OcorrenciaLida["area"]["tipo"];
  localizacao_complemento: string | null;
  autor_pessoa_id: string;
  autor_nome: string;
  responsavel_pessoa_id: string | null;
  responsavel_nome: string | null;
  solucao_aplicada: string | null;
  avaliacao_nota: number | null;
  avaliacao_comentario: string | null;
  avaliada_em: Date | null;
  registrada_em: Date;
  atualizada_em: Date;
};

type LinhaDeTransicao = {
  sequencia: number;
  status_anterior: TransicaoLida["statusAnterior"];
  status_novo: TransicaoLida["statusNovo"];
  ocorreu_em: Date;
  autor_pessoa_id: string;
  autor_nome: string;
  observacao: string | null;
  motivo_pausa: TransicaoLida["motivoPausa"];
  motivo_cancelamento: TransicaoLida["motivoCancelamento"];
};

type LinhaDeAtribuicao = {
  atribuido_em: Date;
  encerrada_em: Date | null;
  motivo_encerramento: AtribuicaoLida["motivoEncerramento"];
  responsavel_pessoa_id: string;
  responsavel_nome: string;
  atribuido_por_pessoa_id: string;
  atribuido_por_nome: string;
};

type LinhaDeMensagem = {
  id: string;
  texto: string;
  criado_em: Date;
  autor_pessoa_id: string;
  autor_nome: string;
};

type LinhaDeAnexo = {
  id: string;
  tipo: AnexoLido["tipo"];
  titulo: string | null;
  nome_arquivo: string | null;
  tipo_conteudo: string;
  tamanho_bytes: number;
  tem_miniatura: boolean;
  anexado_em: Date;
};

/**
 * ============================================================================
 *  O responsável vigente — o mesmo `LATERAL` nas DUAS leituras
 * ============================================================================
 *
 * **O `join` de pessoa parte de `vinculos`, nunca de `pessoas`** — item do DoD que o lint não alcança,
 * porque a consulta seria legítima: ela apenas partiria da tabela global. É a mesma forma dos três `join`
 * de autor deste arquivo.
 *
 * **Sem `limit 1`, e é de propósito.** `atribuicoes_vigente_uk` é único e parcial: há no máximo uma linha
 * vigente por ocorrência, e o banco a garante. Escrever `limit 1` seria defender-se de um estado que a
 * constraint torna impossível — e esconderia o defeito se um dia a constraint caísse.
 *
 * **O vínculo do responsável pode estar REVOGADO, e o nome continua saindo.** Revogar não apaga a linha
 * de `vinculos` (modelo §6.4), então o `join` casa igual: quem foi responsável continua nomeado no
 * histórico. É o mesmo motivo pelo qual as FKs compostas de toda a trilha continuam válidas.
 */
const LATERAL_DO_RESPONSAVEL = `
    left join lateral (
      select at.responsavel_pessoa_id,
             pr.nome as responsavel_nome
        from atribuicoes at
        join vinculos vr on vr.pessoa_id = at.responsavel_pessoa_id
                        and vr.organizacao_id = at.organizacao_id
        join pessoas  pr on pr.id = vr.pessoa_id
       where at.ocorrencia_id = o.id
         and at.organizacao_id = o.organizacao_id
         and at.encerrada_em is null
    ) resp on true`;

/**
 * O `select` da ocorrência. **O `join` de autor começa em `vinculos`** e só então alcança `pessoas` —
 * é o que impede a consulta de enxergar o cadastro do sistema inteiro.
 */
const SELECT_DA_OCORRENCIA = `
  select o.id,
         o.titulo,
         o.descricao,
         o.status,
         o.prioridade,
         o.categoria_id,
         c.nome  as categoria_nome,
         c.icone as categoria_icone,
         o.area_id,
         a.nome  as area_nome,
         o.area_tipo,
         o.localizacao_complemento,
         o.autor_pessoa_id,
         pa.nome as autor_nome,
         resp.responsavel_pessoa_id,
         resp.responsavel_nome,
         o.solucao_aplicada,
         o.avaliacao_nota,
         o.avaliacao_comentario,
         o.avaliada_em,
         o.registrada_em,
         o.atualizada_em
    from ocorrencias o
    join categorias c on c.id = o.categoria_id and c.organizacao_id = o.organizacao_id
    join areas      a on a.id = o.area_id       and a.organizacao_id = o.organizacao_id
    join vinculos  va on va.pessoa_id = o.autor_pessoa_id and va.organizacao_id = o.organizacao_id
    join pessoas   pa on pa.id = va.pessoa_id
${LATERAL_DO_RESPONSAVEL}
   where o.organizacao_id = $1`;

const SELECT_DA_TRILHA = `
  select r.sequencia,
         r.status_anterior,
         r.status_novo,
         r.ocorreu_em,
         r.autor_pessoa_id,
         pt.nome as autor_nome,
         r.observacao,
         r.motivo_pausa,
         r.motivo_cancelamento
    from registros_transicao r
    join vinculos vt on vt.pessoa_id = r.autor_pessoa_id and vt.organizacao_id = r.organizacao_id
    join pessoas  pt on pt.id = vt.pessoa_id
   where r.organizacao_id = $1 and r.ocorrencia_id = $2
   order by r.sequencia`;

/**
 * As atribuições de uma ocorrência — a segunda fonte da linha do tempo (item 29).
 *
 * **DOIS pares de `join`, e os dois partem de `vinculos`** — o do responsável e o de quem atribuiu. É o
 * item do DoD que o lint não alcança, porque a consulta partindo de `pessoas` seria legítima: ela só
 * enxergaria o cadastro do sistema inteiro. É a mesma forma dos três `join` de autor deste arquivo.
 *
 * **Sem `limit` e sem `where encerrada_em is null`**, ao contrário do `LATERAL_DO_RESPONSAVEL`: aqui a
 * pergunta é *"o que aconteceu"*, e a reatribuição precisa aparecer duas vezes (critério 29.3).
 *
 * **`order by at.atribuido_em`** é exatamente o índice `atribuicoes_linha_do_tempo_ix
 * (ocorrencia_id, atribuido_em)`, criado pela migração 008 nomeando este item.
 */
const SELECT_DAS_ATRIBUICOES = `
  select at.atribuido_em,
         at.encerrada_em,
         at.motivo_encerramento,
         at.responsavel_pessoa_id,
         pr.nome as responsavel_nome,
         at.atribuido_por_pessoa_id,
         pq.nome as atribuido_por_nome
    from atribuicoes at
    join vinculos vr on vr.pessoa_id = at.responsavel_pessoa_id
                    and vr.organizacao_id = at.organizacao_id
    join pessoas  pr on pr.id = vr.pessoa_id
    join vinculos vq on vq.pessoa_id = at.atribuido_por_pessoa_id
                    and vq.organizacao_id = at.organizacao_id
    join pessoas  pq on pq.id = vq.pessoa_id
   where at.organizacao_id = $1 and at.ocorrencia_id = $2
   order by at.atribuido_em`;

/**
 * As mensagens do canal 1 de uma ocorrência — **escrito UMA vez, com TRÊS chamadores**: a página do
 * `GET`, a releitura de dentro da transação do `POST`, e a linha do tempo (critério 30.7). Cada um
 * acrescenta a sua cauda, que é a forma que `SELECT_DA_OCORRENCIA` já usa com `and o.id = $2`.
 *
 * **O `join` de autor parte de `vinculos`** — item do DoD que o lint não alcança, porque a consulta
 * partindo de `pessoas` seria legítima: ela só enxergaria o cadastro do sistema inteiro. É a mesma forma
 * dos quatro `join` de autor deste arquivo.
 *
 * **`c.tipo = 'comentario'` está no `where`, e não é redundante.** Os canais 2 e 3 não têm produtor
 * nesta entrega, mas o `tipo_canal` já tem os três valores — e o dia em que a nota interna nascer é o dia
 * em que esta consulta, sem o predicado, passaria a devolvê-la ao Solicitante. É o filtro que impede uma
 * entrega futura de vazar por esta.
 *
 * **Chaveado pela OCORRÊNCIA e não pelo canal**, porque é o que os três chamadores têm na mão. O caminho
 * `canais_conversa (ocorrencia_id)` → `mensagens (canal_id)` são duas buscas indexadas sobre no máximo
 * três canais — a desnormalização de `ocorrencia_id` em `mensagens` foi recusada por escrito no modelo
 * (§6.11), e é o contraste deliberado com a §7.3.
 */
const SELECT_DAS_MENSAGENS = `
  select m.id,
         m.texto,
         m.criado_em,
         m.autor_pessoa_id,
         pm.nome as autor_nome
    from mensagens m
    join canais_conversa c on c.id = m.canal_id and c.organizacao_id = m.organizacao_id
    join vinculos vm on vm.pessoa_id = m.autor_pessoa_id and vm.organizacao_id = m.organizacao_id
    join pessoas  pm on pm.id = vm.pessoa_id
   where m.organizacao_id = $1 and c.ocorrencia_id = $2 and c.tipo = 'comentario'`;

function montarComentario(linha: LinhaDeMensagem): ComentarioLido {
  return {
    id: linha.id,
    texto: linha.texto,
    autor: { pessoaId: linha.autor_pessoa_id, nome: linha.autor_nome },
    criadoEm: linha.criado_em.toISOString(),
  };
}

/**
 * Os anexos de uma ocorrência, pelo índice `(organizacao_id, ocorrencia_id)`.
 *
 * **`thumbnail_chave` não sai — sai se ela existe.** A projeção monta as duas URLs a partir do `id`, que
 * é a chave primária e é o que torna a URL estável (contrato §10.4); a chave do storage não participa.
 */
const SELECT_DOS_ANEXOS = `
  select a.id,
         a.tipo,
         a.titulo,
         a.nome_arquivo,
         a.tipo_conteudo,
         a.tamanho_bytes,
         (a.thumbnail_chave is not null) as tem_miniatura,
         a.anexado_em
    from anexos a
   where a.organizacao_id = $1 and a.ocorrencia_id = $2
   order by a.anexado_em, a.id`;

function montarAnexo(linha: LinhaDeAnexo): AnexoLido {
  return {
    id: linha.id,
    tipo: linha.tipo,
    titulo: linha.titulo,
    nomeArquivo: linha.nome_arquivo,
    tipoConteudo: linha.tipo_conteudo,
    tamanhoBytes: linha.tamanho_bytes,
    temMiniatura: linha.tem_miniatura,
    anexadoEm: linha.anexado_em.toISOString(),
  };
}

function montarTransicao(linha: LinhaDeTransicao): TransicaoLida {
  return {
    sequencia: linha.sequencia,
    statusAnterior: linha.status_anterior,
    statusNovo: linha.status_novo,
    ocorreuEm: linha.ocorreu_em.toISOString(),
    autor: { pessoaId: linha.autor_pessoa_id, nome: linha.autor_nome },
    observacao: linha.observacao,
    motivoPausa: linha.motivo_pausa,
    motivoCancelamento: linha.motivo_cancelamento,
  };
}

function montarAtribuicao(linha: LinhaDeAtribuicao): AtribuicaoLida {
  return {
    responsavel: { pessoaId: linha.responsavel_pessoa_id, nome: linha.responsavel_nome },
    autor: { pessoaId: linha.atribuido_por_pessoa_id, nome: linha.atribuido_por_nome },
    atribuidoEm: linha.atribuido_em.toISOString(),
    encerradaEm: linha.encerrada_em === null ? null : linha.encerrada_em.toISOString(),
    motivoEncerramento: linha.motivo_encerramento,
  };
}

function montarOcorrencia(
  linha: LinhaDeOcorrencia,
  ultima: TransicaoLida,
  anexos: readonly AnexoLido[],
): OcorrenciaLida {
  return {
    id: linha.id,
    titulo: linha.titulo,
    descricao: linha.descricao,
    status: linha.status,
    prioridade: linha.prioridade,
    categoria: { id: linha.categoria_id, nome: linha.categoria_nome, icone: linha.categoria_icone },
    area: { id: linha.area_id, nome: linha.area_nome, tipo: linha.area_tipo },
    localizacaoComplemento: linha.localizacao_complemento,
    anexos,
    autor: { pessoaId: linha.autor_pessoa_id, nome: linha.autor_nome },
    // **A atribuição vigente**, do `LATERAL` — ou `null` quando não há. Uma no máximo, e quem garante é
    // `atribuicoes_vigente_uk`, não este código (item 19).
    responsavel:
      linha.responsavel_pessoa_id === null || linha.responsavel_nome === null
        ? null
        : { pessoaId: linha.responsavel_pessoa_id, nome: linha.responsavel_nome },
    solucaoAplicada: linha.solucao_aplicada,
    avaliacao:
      linha.avaliacao_nota === null || linha.avaliada_em === null
        ? null
        : {
            nota: linha.avaliacao_nota,
            comentario: linha.avaliacao_comentario,
            avaliadaEm: linha.avaliada_em.toISOString(),
          },
    // O motivo da pausa vigente vem do último registro; fora de `pausada` é nulo por construção.
    motivoPausa: ultima.statusNovo === "pausada" ? ultima.motivoPausa : null,
    ultimaTransicao: ultima,
    registradaEm: linha.registrada_em.toISOString(),
    atualizadaEm: linha.atualizada_em.toISOString(),
  };
}

/** As colunas do agregado. **Menos que as do detalhe, e a diferença não é economia:** o agregado não
 *  carrega nome de categoria, de área nem de autor — ele carrega o que a máquina de estados decide. */
type LinhaDoAgregado = {
  titulo: string;
  descricao: string;
  categoria_id: string;
  area_id: string;
  area_tipo: OcorrenciaLida["area"]["tipo"];
  localizacao_complemento: string | null;
  autor_pessoa_id: string;
  status: OcorrenciaLida["status"];
  prioridade: OcorrenciaLida["prioridade"];
  registrada_em: Date;
  /** **Coluna de `ocorrencias`, e portanto DENTRO do agregado** — ao contrário de `tem_responsavel`,
   *  logo abaixo, que viaja ao lado dele no envelope. */
  solucao_aplicada: string | null;
  /** **As três colunas do objeto de valor, e elas vêm JUNTAS** — o `CHECK` `ocorrencias_avaliacao_ck`
   *  garante que ou as três são nulas, ou `nota` e `avaliada_em` não são. */
  avaliacao_nota: number | null;
  avaliacao_comentario: string | null;
  avaliada_em: Date | null;
  /** **O único campo desta linha que não é coluna de `ocorrencias`** — e não entra no agregado: ele
   *  viaja ao lado dele, no envelope de `carregar` (item 22, invariante 9). */
  tem_responsavel: boolean;
};

/**
 * O `select` da **reidratação**.
 *
 * **Sem um único `join`, e é o ponto:** o agregado não tem nome de ninguém dentro dele, então não toca
 * `categorias`, `areas`, `vinculos` nem `pessoas`. Quem precisa de nome é o **modelo de leitura**, e ele
 * já tem o `SELECT_DA_OCORRENCIA`.
 *
 * **O `exists` do item 22 não desfaz isso.** Sub-consulta correlacionada não é junção: nenhuma linha de
 * `atribuicoes` entra no resultado e nenhum nome é lido — é por isso que ele **não** precisa passar por
 * `vinculos`. O `at.organizacao_id = o.organizacao_id` não é redundante com o `$1`: é o mesmo par
 * composto das FKs da migração 008, e é o que impede o `exists` de enxergar atribuição de outra
 * organização. Custo: uma varredura do índice único parcial `atribuicoes_vigente_uk`.
 *
 * **As três colunas da avaliação entram na MESMA linha, sem `join` e sem segunda consulta** (item 27) —
 * exatamente como a `solucao_aplicada` do item 26 e o `exists` do 22. O agregado precisa delas para
 * recusar a segunda avaliação, e é por isso que elas estão do lado da **escrita** e não só da leitura.
 */
const SELECT_DO_AGREGADO = `
  select o.titulo,
         o.descricao,
         o.categoria_id,
         o.area_id,
         o.area_tipo,
         o.localizacao_complemento,
         o.autor_pessoa_id,
         o.status,
         o.prioridade,
         o.registrada_em,
         o.solucao_aplicada,
         o.avaliacao_nota,
         o.avaliacao_comentario,
         o.avaliada_em,
         exists (select 1
                   from atribuicoes at
                  where at.ocorrencia_id = o.id
                    and at.organizacao_id = o.organizacao_id
                    and at.encerrada_em is null) as tem_responsavel
    from ocorrencias o
   where o.organizacao_id = $1 and o.id = $2`;

/**
 * Monta a raiz.
 *
 * **A trilha vem do `SELECT_DA_TRILHA`, que já existe e já é pago** — o `join` de autor dele traz um
 * `autor_nome` que o agregado descarta, e isso é custo declarado: escrever um segundo `select` de trilha
 * criaria a segunda cópia que diverge no dia em que a tabela ganhar coluna.
 */
function montarAgregado(linha: LinhaDoAgregado, trilha: readonly LinhaDeTransicao[]): Ocorrencia {
  return Ocorrencia.reconstituir({
    titulo: linha.titulo,
    descricao: linha.descricao,
    categoriaId: linha.categoria_id,
    areaId: linha.area_id,
    areaTipo: linha.area_tipo,
    localizacaoComplemento: linha.localizacao_complemento,
    autorPessoaId: linha.autor_pessoa_id,
    registradaEm: linha.registrada_em.toISOString(),
    status: linha.status,
    prioridade: linha.prioridade,
    solucaoAplicada: linha.solucao_aplicada,
    // **O MESMO predicado que `montarLida` usa** (`:226-232`), e não uma segunda regra: `nota` nula ou
    // `avaliada_em` nula significa *não avaliada*. O `CHECK` do banco garante que as duas andam juntas;
    // conferir as duas é o que faz este código não depender disso.
    avaliacao:
      linha.avaliacao_nota === null || linha.avaliada_em === null
        ? null
        : Avaliacao.reconstituir({
            nota: linha.avaliacao_nota,
            comentario: linha.avaliacao_comentario,
            avaliadaEm: linha.avaliada_em.toISOString(),
          }),
    trilha: trilha.map((registro) =>
      RegistroDeTransicao.reconstituir({
        sequencia: registro.sequencia,
        statusAnterior: registro.status_anterior,
        statusNovo: registro.status_novo,
        ocorreuEm: registro.ocorreu_em.toISOString(),
        autorPessoaId: registro.autor_pessoa_id,
        observacao: registro.observacao,
        motivoPausa: registro.motivo_pausa,
        motivoCancelamento: registro.motivo_cancelamento,
      }),
    ),
  });
}

/** As colunas do resumo. **Menos que as do detalhe, de propósito** — sem `descricao` e sem a trilha. */
type LinhaDeResumo = {
  id: string;
  titulo: string;
  status: OcorrenciaResumoLida["status"];
  prioridade: OcorrenciaResumoLida["prioridade"];
  categoria_id: string;
  categoria_nome: string;
  area_id: string;
  area_nome: string;
  area_tipo: OcorrenciaResumoLida["area"]["tipo"];
  autor_pessoa_id: string;
  autor_nome: string;
  responsavel_pessoa_id: string | null;
  responsavel_nome: string | null;
  motivo_pausa: OcorrenciaResumoLida["motivoPausa"];
  quantidade_de_anexos: number;
  avaliada: boolean;
  registrada_em: Date;
  atualizada_em: Date;
};

/**
 * O `select` da listagem.
 *
 * **Três coisas para reparar, e nenhuma é estilo:**
 *
 * 1. **`o.area_tipo`, nunca `a.tipo`.** É a cópia congelada no instante do registro (modelo §7.5):
 *    reclassificar a Área **não** muda o que a lista mostra para as ocorrências antigas. É o critério
 *    12.3 se completando aqui.
 * 2. **O `join` do autor começa em `vinculos`** e só então alcança `pessoas` — item do DoD que o lint não
 *    alcança, porque a consulta seria legítima; ela apenas partiria da tabela global.
 * 3. **O `LATERAL` do motivo da pausa.** O `status` é coluna desnormalizada justamente para a lista não
 *    precisar da trilha (modelo §7.2); o **motivo** não é. Uma linha por ocorrência, pelo índice único
 *    `(ocorrencia_id, sequencia)`. Hoje devolve `null` sempre, porque nada pode estar `pausada` antes do
 *    item 23 — e entra assim mesmo, para o 23 não herdar uma dívida que nenhum critério dele nomeia.
 * 4. **O `LATERAL` do responsável.** Um por página, pelo índice único parcial `atribuicoes_vigente_uk` —
 *    uma linha por ocorrência, no máximo. É o custo declarado do item 19, ao lado do que já existe para o
 *    `motivoPausa`. **Não** vira coluna desnormalizada em `ocorrencias`: o modelo recusou isso por escrito
 *    (§6.9 e §7.1), e o argumento é duas fontes de verdade para o mesmo fato.
 * 5. **`avaliada` é EXPRESSÃO, não coluna nem `join`.** `o.avaliacao_nota` já está na linha que este
 *    `select` lê — o booleano custa zero leitura a mais. É o oposto do `quantidadeDeAnexos`, que é
 *    subconsulta correlacionada porque `anexos` é outra tabela (item 27).
 */
/**
 * As três condições do recorte de G2, montadas **uma vez** — item 14b.
 *
 * **`and` entre dimensões e `or` dentro de cada uma:** é o que `= any(lista)` já significa, e é a leitura
 * literal de *"aceitam múltiplos valores e combinam entre si"* (critério 15.1).
 *
 * **Os `::` não são decoração:** sem o *cast* o Postgres recusa comparar `text[]` com
 * `status_ocorrencia`. O `pg` converte `readonly string[]` em array de Postgres sozinho; o *cast* é o que
 * lhe dá o tipo do enum.
 *
 * **A ordem importa:** `proximo()` numera pela ordem de inserção em `valores`, então quem chama tem de
 * acrescentar estas condições antes de reservar os parâmetros que vêm depois.
 *
 * **Existe como função porque tem DOIS chamadores** — a página e o painel —, e o dia em que as duas
 * cópias divergirem é o dia em que o `total` deixa de descrever a lista que está na tela.
 */
function condicoesDoRecorte(
  recorte: FiltroDeOcorrencias | undefined,
  proximo: () => string,
  valores: unknown[],
): string[] {
  const condicoes: string[] = [];

  if (recorte?.status !== undefined) {
    condicoes.push(`o.status = any(${proximo()}::status_ocorrencia[])`);
    valores.push(recorte.status);
  }
  if (recorte?.categoriaId !== undefined) {
    condicoes.push(`o.categoria_id = any(${proximo()}::uuid[])`);
    valores.push(recorte.categoriaId);
  }
  if (recorte?.prioridade !== undefined) {
    condicoes.push(`o.prioridade = any(${proximo()}::prioridade_ocorrencia[])`);
    valores.push(recorte.prioridade);
  }

  return condicoes;
}

const SELECT_DO_RESUMO = `
  select o.id,
         o.titulo,
         o.status,
         o.prioridade,
         o.categoria_id,
         c.nome  as categoria_nome,
         o.area_id,
         a.nome  as area_nome,
         o.area_tipo,
         o.autor_pessoa_id,
         pa.nome as autor_nome,
         resp.responsavel_pessoa_id,
         resp.responsavel_nome,
         ult.motivo_pausa,
         (select count(*)
            from anexos ax
           where ax.ocorrencia_id = o.id
             and ax.organizacao_id = o.organizacao_id)::int as quantidade_de_anexos,
         (o.avaliacao_nota is not null) as avaliada,
         o.registrada_em,
         o.atualizada_em
    from ocorrencias o
    join categorias c on c.id = o.categoria_id and c.organizacao_id = o.organizacao_id
    join areas      a on a.id = o.area_id       and a.organizacao_id = o.organizacao_id
    join vinculos  va on va.pessoa_id = o.autor_pessoa_id and va.organizacao_id = o.organizacao_id
    join pessoas   pa on pa.id = va.pessoa_id
    left join lateral (
      select r.motivo_pausa
        from registros_transicao r
       where r.ocorrencia_id = o.id
         and r.organizacao_id = o.organizacao_id
       order by r.sequencia desc
       limit 1
    ) ult on true
${LATERAL_DO_RESPONSAVEL}
   where o.organizacao_id = $1`;

function montarResumo(linha: LinhaDeResumo): OcorrenciaResumoLida {
  return {
    id: linha.id,
    titulo: linha.titulo,
    status: linha.status,
    prioridade: linha.prioridade,
    categoria: { id: linha.categoria_id, nome: linha.categoria_nome },
    area: { id: linha.area_id, nome: linha.area_nome, tipo: linha.area_tipo },
    autor: { pessoaId: linha.autor_pessoa_id, nome: linha.autor_nome },
    // **A atribuição vigente**, do `LATERAL` — ou `null` quando não há. Uma no máximo, e quem garante é
    // `atribuicoes_vigente_uk`, não este código (item 19).
    responsavel:
      linha.responsavel_pessoa_id === null || linha.responsavel_nome === null
        ? null
        : { pessoaId: linha.responsavel_pessoa_id, nome: linha.responsavel_nome },
    // **Subconsulta correlacionada e não coluna materializada.** O índice `(organizacao_id,
    // ocorrencia_id)` existe exatamente para as duas leituras deste arquivo, e `ocorrencias
    // .total_anexos` está na lista dos recusados (modelo §7.1): desnormaliza-se o que é **filtrado ou
    // ordenado**, nunca o que é só projetado.
    quantidadeDeAnexos: linha.quantidade_de_anexos,
    avaliada: linha.avaliada,
    // Fora de `pausada` o motivo é nulo por construção — o `CHECK` da migração 005 garante o par.
    motivoPausa: linha.status === "pausada" ? linha.motivo_pausa : null,
    registradaEm: linha.registrada_em.toISOString(),
    atualizadaEm: linha.atualizada_em.toISOString(),
  };
}

/**
 * **Lê `code` e `constraint` de um objeto desconhecido, sem importar o driver** — a mesma técnica de
 * `categorias-escopadas.ts` e `organizacoes.ts`. Confere as **duas**, porque `23505` sozinho pegaria
 * qualquer unicidade da transação.
 *
 * **As duas constraints de `anexos`, e não só a da chave** (decisão D-P4 do plano): `chave` e
 * `thumbnail_chave` vêm do **mesmo ticket**, então a segunda reivindicação viola as duas, e qual índice o
 * Postgres reporta primeiro não é contratual. Conferir só a primeira transformaria metade das corridas
 * em `500`.
 */
function ehAnexoJaReivindicado(erro: unknown): boolean {
  const comCodigo = erro as { code?: unknown; constraint?: unknown };
  return (
    comCodigo.code === "23505" &&
    (comCodigo.constraint === "anexos_chave_uk" ||
      comCodigo.constraint === "anexos_thumbnail_chave_uk")
  );
}

/**
 * ============================================================================
 *  O sentinela do `422` — e por que ele não pode ser um `return`
 * ============================================================================
 *
 * `criarTransacao` dá `commit` quando o trabalho **retorna normalmente** e `rollback` **só quando ele
 * lança** (`clientes/banco.ts`). Devolver `{ desfecho: "responsavel-sem-vinculo-ativo" }` de dentro do
 * `emTransacao` **comitaria o `update` que já encerrou a atribuição anterior** — e a ocorrência ficaria
 * **sem responsável nenhum**, com um `422` na tela dizendo que nada mudou.
 *
 * **Classe `Error` e não `Symbol`**: a pilha diz de onde veio no dia em que o `catch` errar, e `throw` de
 * não-`Error` é o tipo de coisa que uma regra futura do lint pega. **Não é exportada e não escapa deste
 * arquivo** — o que sai é desfecho.
 *
 * **E nada de ler o vínculo ANTES para evitar o `throw`:** a doutrina do item 8 continua valendo, e o
 * `where exists` do `insert` segue sendo a única fonte do desfecho. O sentinela é sobre **transação**,
 * não sobre corrida.
 */
class SemVinculoAtivo extends Error {
  constructor() {
    super("responsável sem vínculo ativo nesta organização");
    this.name = "SemVinculoAtivo";
  }
}

/**
 * A corrida entre dois Gestores atribuindo ao mesmo tempo.
 *
 * **Confere `code` E `constraint`**, como `ehAnexoJaReivindicado` já faz: `23505` sozinho pegaria qualquer
 * unicidade da transação — inclusive a `atribuicoes_id_organizacao_uk`, que é outro assunto.
 *
 * **Desde o item 21 este caminho é rede, não o caso comum.** O guarda de estado é a primeira instrução da
 * transação, e o bloqueio de linha que ele toma na raiz **serializa** duas atribuições concorrentes à mesma
 * ocorrência: a segunda espera, reavalia o predicado e segue, encerrando a atribuição da primeira em vez de
 * bater no índice. O `23505` continua conferido porque a serialização é do caminho de hoje, e não uma
 * promessa do esquema.
 */
function ehAtribuicaoVigenteDuplicada(erro: unknown): boolean {
  const comCodigo = erro as { code?: unknown; constraint?: unknown };
  return comCodigo.code === "23505" && comCodigo.constraint === "atribuicoes_vigente_uk";
}

/**
 * ============================================================================
 *  Os estados que admitem `atribuir-responsavel` — o predicado do item 21
 * ============================================================================
 *
 * **Derivada, nunca copiada.** `comandoPermitido` é a mesma função que a guarda do agregado usa
 * (`atribuir-responsavel.ts:79`), então a porta e o comando leem **a mesma** tabela do Domínio. Uma
 * segunda lista escrita à mão aqui divergiria no dia em que a tabela companheira mudasse, e divergiria
 * **em silêncio** — o compilador não alcança string dentro de SQL.
 *
 * **Por que a lista do comando, e não `TERMINAIS`.** É a decisão da `respostas.md` P1 do item 21, e a
 * razão é a nota do `backlog.md` sob o item 27: *"cada porta expressa a invariante do **seu** comando, e
 * simetria entre portas não é valor por si só"*. O item 17 usa `TERMINAIS` porque o erro dele **se chama**
 * terminalidade (`PRIORIDADE_IMUTAVEL_EM_ESTADO_TERMINAL`); aqui o erro é o genérico
 * `TRANSICAO_NAO_PERMITIDA`, e o que ele expressa é a lista de estados admitidos do critério **19.2**.
 * As duas listas são o mesmo conjunto **hoje**; `TERMINAIS` deixaria passar em silêncio um sétimo estado
 * não terminal que não admitisse o comando.
 *
 * **E por que não `status = <o que o agregado leu>`**, que é a forma dos itens 25 e 27: um movimento
 * **legal** entre a leitura e a escrita responderia `conflito`, e o `409` sairia com
 * `statusAtual: "em_analise"` ao lado de um `acoesDisponiveis` **contendo `atribuir-responsavel`**.
 */
const ESTADOS_QUE_ADMITEM_ATRIBUICAO: readonly StatusOcorrencia[] = STATUS.filter((status) =>
  comandoPermitido(status, "atribuir-responsavel"),
);

export function repositorioEscopadoDeOcorrencias(
  consulta: ConsultaEscopada,
  emTransacao: TransacaoEscopada,
): RepositorioEscopadoDeOcorrencias {
  async function lerPorId(executar: ConsultaEscopada, id: string): Promise<OcorrenciaLida | null> {
    const linhas = await executar<LinhaDeOcorrencia>(`${SELECT_DA_OCORRENCIA} and o.id = $2`, [id]);
    const linha = linhas[0];
    if (linha === undefined) return null;

    // As duas leituras filhas em paralelo — é uma ida e volta, não duas.
    const [trilha, anexos] = await Promise.all([
      executar<LinhaDeTransicao>(SELECT_DA_TRILHA, [id]),
      executar<LinhaDeAnexo>(SELECT_DOS_ANEXOS, [id]),
    ]);

    const ultima = trilha[trilha.length - 1];
    if (ultima === undefined) {
      // Ocorrência sem trilha é a invariante 2 violada. Não se conserta lendo: grita.
      throw new Error(`Ocorrência ${id} sem registro de transição — invariante 2 violada.`);
    }

    return montarOcorrencia(linha, montarTransicao(ultima), anexos.map(montarAnexo));
  }

  return {
    /**
     * **Ocorrência + registro, num `COMMIT` só** — a invariante 2.
     *
     * **Este método transcreve o agregado; ele não decide nada.** `status`, `prioridade` e todo o
     * conteúdo do registro saem de `ocorrencia`, e são escritos **explicitamente** — não deixados para
     * o `default` da coluna. Os `default` da migração 005 continuam lá como rede para escrita
     * administrativa; **o escritor do caminho normal é o agregado**, e é o que faz a invariante 1 ser
     * estrutural.
     */
    async registrar(ocorrencia: Ocorrencia): Promise<ResultadoDoRegistro> {
      try {
        const lida = await emTransacao(async (executar) => {
          const criadas = await executar<{ id: string }>(
            `insert into ocorrencias
               (organizacao_id, titulo, descricao, categoria_id, area_id, area_tipo,
                localizacao_complemento, prioridade, status, autor_pessoa_id, registrada_em, atualizada_em)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
             returning id`,
            [
              ocorrencia.titulo,
              ocorrencia.descricao,
              ocorrencia.categoriaId,
              ocorrencia.areaId,
              ocorrencia.areaTipo,
              ocorrencia.localizacaoComplemento,
              ocorrencia.prioridade,
              ocorrencia.status,
              ocorrencia.autorPessoaId,
              ocorrencia.registradaEm,
            ],
          );

          const criada = criadas[0];
          if (criada === undefined) {
            throw new Error("insert ... returning não devolveu linha — invariante violada");
          }

          // **A premissa P1**, e ela vem do agregado — não de literais escritos aqui. Os `CHECK` da
          // migração 005 conferem os três fatos nos dois sentidos: `sequencia` 1, `status_anterior` nulo,
          // destino `aberta`.
          const primeira = ocorrencia.ultimaTransicao;
          await executar(
            `insert into registros_transicao
               (organizacao_id, ocorrencia_id, sequencia, status_anterior, status_novo,
                ocorreu_em, autor_pessoa_id, observacao, motivo_pausa, motivo_cancelamento)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              criada.id,
              primeira.sequencia,
              primeira.statusAnterior,
              primeira.statusNovo,
              primeira.ocorreuEm,
              primeira.autorPessoaId,
              primeira.observacao,
              primeira.motivoPausa,
              primeira.motivoCancelamento,
            ],
          );

          /**
           * **A terceira escrita, no mesmo `COMMIT`.** O caso de uso NÃO chama
           * `repos.anexos.gravar(...)`: seriam duas transações, a invariante 2 cairia, e o anexo passaria
           * a ser escrito por fora do agregado — o defeito que a ADR-0001 recusa em uma frase. O
           * repositório continua transcritor: `tipo`, `chave`, `tipo_conteudo` e `tamanho_bytes` saem do
           * objeto de valor, e `fonte` fica no `default` do enum, que é o único provedor que existe.
           */
          for (const anexo of ocorrencia.anexos) {
            await executar(
              `insert into anexos
                 (organizacao_id, ocorrencia_id, tipo, chave, thumbnail_chave, nome_arquivo,
                  titulo, tipo_conteudo, tamanho_bytes, anexado_por_pessoa_id, anexado_em)
               values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [
                criada.id,
                anexo.tipo,
                anexo.chave,
                anexo.thumbnailChave,
                anexo.nomeArquivo,
                anexo.titulo,
                anexo.tipoConteudo,
                anexo.tamanhoBytes,
                anexo.anexadoPorPessoaId,
                anexo.anexadoEm,
              ],
            );
          }

          const relida = await lerPorId(executar, criada.id);
          if (relida === null) {
            throw new Error("Ocorrência recém-gravada não foi relida — transação inconsistente.");
          }
          return relida;
        });

        return { desfecho: "registrada", ocorrencia: lida };
      } catch (erro) {
        if (!ehAnexoJaReivindicado(erro)) throw erro;

        const chave = ocorrencia.anexos[0]?.chave;
        if (chave === undefined) throw erro;

        /**
         * **A consulta que monta o corpo do `409` é ESCOPADA**, e é o que impede o `ocorrenciaId` de
         * apontar para fora da organização. A conferência 2 da reivindicação já provou que o ticket é
         * desta organização e desta Pessoa; se a linha existisse em outra — o que aquela conferência
         * torna inalcançável —, esta consulta devolveria nada e a resposta degradaria para `500` em vez
         * de vazar. O ponto de estrangulamento da D2 continua único.
         *
         * **Note que o `catch` envolve o `emTransacao` inteiro, e não o `insert`:** esta consulta precisa
         * rodar **depois** do `rollback` — de dentro da transação abortada, o Postgres recusa qualquer
         * comando com `25P02`.
         */
        const linhas = await consulta<{ ocorrencia_id: string }>(
          `select ocorrencia_id from anexos where organizacao_id = $1 and chave = $2`,
          [chave],
        );

        const linha = linhas[0];
        if (linha === undefined) throw erro;

        return { desfecho: "anexo-ja-reivindicado", ocorrenciaId: linha.ocorrencia_id };
      }
    },

    /**
     * **A reidratação — duas idas, e as duas escopadas.** A linha e a trilha; nada além. Sequencial e não
     * `Promise.all`, ao contrário de `lerPorId`: sem a linha não há agregado a montar, e disparar a
     * segunda consulta para descartá-la seria trabalho pago por nada no caminho de `null`.
     */
    async carregar(id) {
      const linhas = await consulta<LinhaDoAgregado>(SELECT_DO_AGREGADO, [id]);
      const linha = linhas[0];
      if (linha === undefined) return null;

      const trilha = await consulta<LinhaDeTransicao>(SELECT_DA_TRILHA, [id]);
      // **O fato sai da MESMA linha do agregado**, e morre aqui como coluna: o que sobe é o booleano
      // do envelope. `LinhaDoAgregado` não deixa este arquivo (item do DoD).
      return { ocorrencia: montarAgregado(linha, trilha), temResponsavel: linha.tem_responsavel };
    },

    /**
     * **A transição — `update` e `insert` num `COMMIT` só** (invariante 2), e o `update` é o controle
     * otimista.
     *
     * **O predicado é a própria transição de origem:** `where status = <statusAnterior do registro>`.
     * Zero linhas significa que outro Gestor moveu a ocorrência entre a leitura e a escrita — e a resposta
     * é `desfecho: "conflito"`, sem coluna de versão e sem `ETag` (contrato §7.9). **A rede de trás é o
     * `unique (ocorrencia_id, sequencia)`**: se um dia o predicado se perder, a trilha não ganha duas
     * linhas nº 2 em silêncio.
     *
     * **Este método transcreve; ele não decide.** Os oito campos do registro saem do objeto de valor.
     */
    async aplicarTransicao(id, ocorrencia) {
      const registro = ocorrencia.ultimaTransicao;
      const anterior = registro.statusAnterior;

      if (anterior === null) {
        // A origem da trilha é gravada por `registrar`. Chegar aqui com ela é defeito de chamador.
        throw new Error("aplicarTransicao recebeu a origem da trilha — só transição se aplica aqui.");
      }

      return emTransacao(async (executar) => {
        // Os `::` não são decoração: sem eles o Postgres compara `unknown` com `status_ocorrencia` e a
        // resolução passa a depender de inferência — a mesma razão dos casts do `listar`, logo abaixo.
        //
        // **`solucao_aplicada` entra AQUI, e não numa segunda instrução** (item 26): a coluna é da raiz
        // do agregado, o `update` já toca a linha certa, e duas escritas onde uma serve criariam a
        // pergunta *"qual das duas ganha se a outra falhar"* dentro de um `COMMIT` que já é atômico.
        // **O valor vem do agregado** — este método transcreve, não decide.
        const movidas = await executar<{ id: string }>(
          `update ocorrencias
              set status = $4::status_ocorrencia, atualizada_em = $5, solucao_aplicada = $6
            where organizacao_id = $1 and id = $2 and status = $3::status_ocorrencia
          returning id`,
          // `atualizada_em` recebe o INSTANTE DA TRANSIÇÃO, nunca `now()` (arquitetura.md §5.8).
          [id, anterior, ocorrencia.status, registro.ocorreuEm, ocorrencia.solucaoAplicada],
        );

        if (movidas[0] === undefined) return { desfecho: "conflito" as const };

        await executar(
          `insert into registros_transicao
             (organizacao_id, ocorrencia_id, sequencia, status_anterior, status_novo,
              ocorreu_em, autor_pessoa_id, observacao, motivo_pausa, motivo_cancelamento)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            id,
            registro.sequencia,
            registro.statusAnterior,
            registro.statusNovo,
            registro.ocorreuEm,
            registro.autorPessoaId,
            registro.observacao,
            registro.motivoPausa,
            registro.motivoCancelamento,
          ],
        );

        // **A releitura acontece DENTRO da transação**, como `registrar` já faz: o que volta ao cliente é
        // o detalhe de verdade, com nome de categoria, de área e de autor — não um payload pela metade
        // montado a partir do agregado, que é como se produz resposta que diverge da leitura.
        const relida = await lerPorId(executar, id);
        if (relida === null) {
          throw new Error("Ocorrência recém-transicionada não foi relida — transação inconsistente.");
        }
        return { desfecho: "aplicada" as const, ocorrencia: relida };
      });
    },

    /**
     * **A solução aplicada — um `update`, uma releitura, e NENHUM `insert`** (item 25).
     *
     * É a primeira porta de escrita do produto que toca a raiz sem tocar a trilha, e a ausência do
     * `insert` é o critério 25.1 expresso em estrutura: não há como gravar registro daqui.
     *
     * **O predicado é o status que o agregado leu**, e ele não é controle de texto: é a **mesma máquina de
     * estados** fazendo o mesmo papel dos outros comandos. Ele não pergunta *"o texto mudou?"*; pergunta
     * *"o estado ainda admite este comando?"*. Zero linhas significa que outro Gestor moveu a ocorrência
     * entre a leitura e a escrita — e sem ele esta escrita cairia numa ocorrência já **`resolvida`**, que é
     * a mutação silenciosa de registro fechado que a ADR-0001 existe para impedir (contrato §8.4).
     *
     * *Alternativa recusada — repetir `["em_atendimento", "pausada"]` no SQL:* segunda cópia da tabela
     * companheira, num lugar onde o compilador não a alcança. O status lido responde à mesma pergunta e é
     * mais estrito.
     *
     * **O que o predicado NÃO defende, e é aceito por documento:** dois Gestores gravando solução no mesmo
     * estado — o segundo vence, sem aviso. É um dos **dois** pontos que a §7.9 do contrato nomeia como
     * exposição aceita. **Não construímos defesa contra o que o contrato decidiu aceitar.**
     *
     * **Este método transcreve; ele não decide.** O texto sai de `ocorrencia.solucaoAplicada`, e o
     * `atualizada_em` recebe o instante que o comando de aplicação leu — nunca `now()`.
     */
    async registrarSolucaoAplicada(id, ocorrencia, em) {
      return emTransacao(async (executar) => {
        // O `::` do `status` não é decoração: sem ele o Postgres compara `unknown` com
        // `status_ocorrencia` e a resolução passa a depender de inferência. As atribuições do `set` não
        // precisam — em contexto de atribuição o tipo vem da coluna, como em `aplicarTransicao`.
        const gravadas = await executar<{ id: string }>(
          `update ocorrencias
              set solucao_aplicada = $4, atualizada_em = $5
            where organizacao_id = $1 and id = $2 and status = $3::status_ocorrencia
          returning id`,
          [id, ocorrencia.status, ocorrencia.solucaoAplicada, em],
        );

        if (gravadas[0] === undefined) return { desfecho: "conflito" as const };

        // A releitura acontece **dentro** da transação, como as três portas de escrita anteriores: o que
        // volta ao cliente é o detalhe de verdade, com nome de categoria, de área e de responsável.
        const relida = await lerPorId(executar, id);
        if (relida === null) {
          throw new Error("Ocorrência recém-gravada não foi relida — transação inconsistente.");
        }
        return { desfecho: "gravada" as const, ocorrencia: relida };
      });
    },

    /**
     * **A prioridade — um `update`, uma releitura, e NENHUM `insert`** (item 17).
     *
     * É a segunda porta do produto que toca a raiz sem tocar a trilha, e a ausência do `insert` é o
     * critério 17.3 expresso em estrutura: não há como gravar registro daqui.
     *
     * **O predicado é a invariante 7, dita com a lista que a nomeia** — e é a única porta de escrita da
     * ocorrência cujo predicado **não** é `status = <algo>`:
     *
     * ```
     * status <> all($5::status_ocorrencia[])   -- $5 = TERMINAIS
     * ```
     *
     * **Por que `TERMINAIS` e não os quatro estados admitidos.** As duas listas são o mesmo conjunto
     * **hoje** — os quatro de `SEM_TRANSICAO["alterar-prioridade"]` são o complemento exato dos dois de
     * `TERMINAIS`. A diferença é o que cada uma promete: `TERMINAIS` **é** a invariante 7, que é o que o
     * nome do erro afirma (`PRIORIDADE_IMUTAVEL_EM_ESTADO_TERMINAL`) e o que o `detail` publicado diz
     * (`openapi.yaml:1666`). Derivar de `SEM_TRANSICAO` faria o predicado e o erro coincidirem **por
     * acidente**, e o acidente termina no dia em que nascer um sétimo estado não terminal que não admita o
     * comando — aí o `409` volta a ser frase falsa, em silêncio.
     *
     * **E é a mesma lista que a guarda do agregado lê** (`Ocorrencia.alterarPrioridade`), então a fatia
     * inteira tem **uma** lista para o mesmo fato.
     *
     * *Alternativa recusada — `status = $n::status_ocorrencia` com o status lido, como o item 25:* mais
     * estrito do que precisa, e o custo não é teórico. Um movimento **legal** entre a leitura e a escrita
     * — `aberta → em_analise` — responderia `conflito`, e a tela mostraria o `detail` publicado
     * (*"a prioridade não muda depois de resolvida ou cancelada"*) sobre uma ocorrência `em_analise`.
     * Frase falsa, e sem compensatória: o `inventario-de-telas.md:1532-1536` decidiu que este código
     * **não tem frase de tela própria**. Ver o achado A-5 da spec do item 17.
     *
     * **O que o predicado NÃO defende, e é aceito por documento:** dois Gestores alterando a prioridade no
     * mesmo estado — o segundo vence, sem aviso. É um dos **dois** pontos que a §7.9 do contrato nomeia
     * como exposição aceita. **Não construímos defesa contra o que o contrato decidiu aceitar** — o que o
     * produto passa a ter contra o toque errado é a janela de conserto do critério 17.7, na tela.
     *
     * **Este método transcreve; ele não decide.** O valor sai de `ocorrencia.prioridade`, e o
     * `atualizada_em` recebe o instante que o comando de aplicação leu — nunca `now()`.
     */
    async alterarPrioridade(id, ocorrencia, em) {
      return emTransacao(async (executar) => {
        // O `::status_ocorrencia[]` não é decoração: sem ele o Postgres compara `unknown` com o tipo do
        // enum e a resolução passa a depender de inferência. A atribuição do `set` não precisa — em
        // contexto de atribuição o tipo vem da coluna, como em `aplicarTransicao`.
        const alteradas = await executar<{ id: string }>(
          `update ocorrencias
              set prioridade = $3, atualizada_em = $4
            where organizacao_id = $1 and id = $2
              and status <> all($5::status_ocorrencia[])
          returning id`,
          [id, ocorrencia.prioridade, em, [...TERMINAIS]],
        );

        if (alteradas[0] === undefined) return { desfecho: "conflito" as const };

        // A releitura acontece **dentro** da transação, como as quatro portas de escrita anteriores: o que
        // volta ao cliente é o detalhe de verdade, com nome de categoria, de área e de responsável.
        const relida = await lerPorId(executar, id);
        if (relida === null) {
          throw new Error("Ocorrência recém-alterada não foi relida — transação inconsistente.");
        }
        return { desfecho: "alterada" as const, ocorrencia: relida };
      });
    },

    /**
     * **A avaliação — um `update`, uma releitura, e NENHUM `insert`** (item 27).
     *
     * É a **terceira** porta de escrita do produto que toca a raiz sem tocar a trilha, e a ausência do
     * `insert` é o critério 27.4 expresso em estrutura: não há como gravar registro daqui.
     *
     * **O predicado tem DUAS metades, e é a única porta do produto assim.**
     *
     * ```
     * status = $3::status_ocorrencia    -- o que o agregado leu; transcrição, não decisão
     * avaliacao_nota is null            -- a invariante 8, metade "uma vez só"
     * ```
     *
     * **A segunda é a que reprova.** `resolvida` é terminal — nada tira a ocorrência de lá —, então a
     * primeira **nunca** reprova sozinha, e sem a segunda duas abas do mesmo Solicitante gravariam duas
     * avaliações, a segunda por cima da primeira, em silêncio. O `CHECK` do banco não impede: ele é
     * verdadeiro nas duas gravações.
     *
     * **A primeira NÃO é redundância**: ela é o que este método transcreve do agregado, e é o que impede
     * a porta de depender de a coluna de avaliação ser a única defesa no dia em que um sétimo estado
     * admitir o comando.
     *
     * *Alternativa recusada — `status <> all(TERMINAIS)`, o predicado do item 17:* recusaria **tudo**, e
     * a nota do backlog de 28/08/2026 já a nomeia. Cada porta expressa a invariante do **seu** comando;
     * simetria entre portas não é valor por si só.
     *
     * **O que o predicado NÃO defende:** nada. Ao contrário das duas irmãs, aqui **não há exposição
     * aceita** — a §7.9 nomeia `solucao_aplicada` e `prioridade`, e a avaliação não é nenhuma das duas.
     *
     * **Este método transcreve; ele não decide.** Os três valores saem de `ocorrencia.avaliacao`, e o
     * `atualizada_em` recebe o instante que o comando de aplicação leu — nunca `now()`.
     */
    async avaliar(id, ocorrencia, em) {
      const avaliacao = ocorrencia.avaliacao;
      if (avaliacao === null) {
        // **Defeito de chamador, não caso de negócio.** Quem chama esta porta passa a instância que saiu
        // de `Ocorrencia.avaliar`, e ela tem avaliação por construção. Um `?.` aqui gravaria três nulos
        // em silêncio — que é a mutação que a ADR-0001 existe para impedir.
        throw new Error("avaliar recebeu um agregado sem avaliação — o comando não o atravessou.");
      }

      return emTransacao(async (executar) => {
        // O `::` do `status` não é decoração: sem ele o Postgres compara `unknown` com
        // `status_ocorrencia` e a resolução passa a depender de inferência. As atribuições do `set` não
        // precisam — em contexto de atribuição o tipo vem da coluna.
        const avaliadas = await executar<{ id: string }>(
          `update ocorrencias
              set avaliacao_nota = $4,
                  avaliacao_comentario = $5,
                  avaliada_em = $6,
                  atualizada_em = $7
            where organizacao_id = $1 and id = $2
              and status = $3::status_ocorrencia
              and avaliacao_nota is null
          returning id`,
          [id, ocorrencia.status, avaliacao.nota, avaliacao.comentario, avaliacao.avaliadaEm, em],
        );

        if (avaliadas[0] === undefined) return { desfecho: "conflito" as const };

        // A releitura acontece **dentro** da transação, como as cinco portas de escrita anteriores: o que
        // volta ao cliente é o detalhe de verdade, com nome de categoria, de área e de responsável.
        const relida = await lerPorId(executar, id);
        if (relida === null) {
          throw new Error("Ocorrência recém-avaliada não foi relida — transação inconsistente.");
        }
        return { desfecho: "avaliada" as const, ocorrencia: relida };
      });
    },

    /**
     * **Atribuir e reatribuir são o mesmo caminho** — a distinção é derivada do estado, não da intenção
     * de quem chamou (contrato §3.4). Três escritas e uma releitura, num `COMMIT` só.
     *
     * **A primeira escrita é o guarda (item 21).** O `update` da raiz subiu para o topo porque é ele que
     * carrega o predicado de `status`, e recusar de lá é o único jeito de a recusa não comitar as
     * escritas em `atribuicoes` — ver o comentário do passo 1 e o docblock de `SemVinculoAtivo`.
     *
     * **A ordem entre as duas escritas em `atribuicoes` é o que faz o índice único parcial nunca ser
     * violado no caminho normal:** o `update` de encerramento tira a linha vigente do índice **antes** de
     * o `insert` entrar nele.
     *
     * *Alternativa recusada — `update` e `insert` como CTEs irmãs numa instrução só.* CTEs de escrita
     * veem o **mesmo snapshot** e não têm ordem garantida entre si, então o `insert` poderia ser conferido
     * contra `atribuicoes_vigente_uk` antes de o `update` ter agido. Correção que depende de ordem não
     * especificada é a pior espécie de correção.
     *
     * **Os `::` não são decoração**, e aqui menos ainda: num `insert … select`, o Postgres resolve os
     * tipos da sub-consulta **primeiro** — parâmetro sem tipo vira `text` — e não há coerção de atribuição
     * de `text` para `uuid`. Sem os *casts*, a instrução nem chega a rodar.
     */
    async atribuirResponsavel(ocorrenciaId, dados) {
      try {
        return await emTransacao(async (executar) => {
          /**
           * 1 · **O guarda de estado, e ele vem PRIMEIRO — item 21, critério 21.4.**
           *
           * Ele responde *"o estado ainda admite este comando?"*, com a lista que o Domínio deriva
           * (`ESTADOS_QUE_ADMITEM_ATRIBUICAO`), e é o que impede a atribuição de entrar numa ocorrência
           * que virou `resolvida` ou `cancelada` entre o `carregar` do comando e este `COMMIT` — a
           * mutação silenciosa de registro fechado que a ADR-0001 existe para impedir (contrato §8.4).
           *
           * **Primeiro, e não terceiro, por causa da transação.** `criarTransacao` dá `commit` quando o
           * trabalho **retorna normalmente** (ver o docblock de `SemVinculoAtivo`): um `return
           * { desfecho: "conflito" }` depois das duas escritas em `atribuicoes` comitaria justamente o
           * encerramento da atribuição vigente, que é o dano que este guarda existe para impedir. Aqui em
           * cima não há nada escrito, e o `return` é o mesmo das três portas irmãs.
           *
           * **`atualizada_em` é escrito mesmo sem transição.** O campo não quer dizer *"esta linha
           * mudou"* — quer dizer *"houve atividade nesta ocorrência"*, o que inclui `INSERT` em outra
           * tabela (`arquitetura.md` §5.8). Atribuir é atividade. **O mesmo instante** que `atribuido_em`,
           * nunca `now()`.
           *
           * O `::status_ocorrencia[]` não é decoração: sem ele o Postgres compara `unknown` com o tipo do
           * enum e a resolução passa a depender de inferência.
           */
          const tocadas = await executar<{ id: string }>(
            `update ocorrencias
                set atualizada_em = $3::timestamptz
              where organizacao_id = $1 and id = $2::uuid
                and status = any($4::status_ocorrencia[])
            returning id`,
            [ocorrenciaId, dados.em, [...ESTADOS_QUE_ADMITEM_ATRIBUICAO]],
          );

          if (tocadas[0] === undefined) return { desfecho: "conflito" as const };

          // 2 · Encerra a vigente, se houver. Zero linhas = primeira atribuição.
          const encerradas = await executar<{ id: string }>(
            `update atribuicoes
                set encerrada_em = $3::timestamptz, motivo_encerramento = 'reatribuicao'
              where organizacao_id = $1 and ocorrencia_id = $2::uuid and encerrada_em is null
            returning id`,
            [ocorrenciaId, dados.em],
          );
          const reatribuicao = encerradas.length > 0;

          /**
           * 3 · **O `422` nasce do próprio `insert`, sem leitura prévia.** A FK aponta para
           * `vinculos (pessoa_id, organizacao_id)` **sem olhar `revogado_em`** — vínculo revogado passa
           * nela. O `where exists` é o que traduz *"vínculo **ativo**"*, que é a palavra do critério 19.3.
           *
           * E *"pessoa de outra organização recebe a mesma resposta"* sai de graça: `$1` é a organização
           * ativa, amarrada pelo escopo, então o vínculo de outra não existe para esta consulta. **Mesmo
           * `422`, sem um `if` a mais** — a §6.3 se aplicando por construção.
           */
          const criadas = await executar<{ id: string }>(
            `insert into atribuicoes
               (organizacao_id, ocorrencia_id, responsavel_pessoa_id, atribuido_por_pessoa_id, atribuido_em)
             select $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::timestamptz
              where exists (select 1
                              from vinculos v
                             where v.pessoa_id = $3::uuid
                               and v.organizacao_id = $1
                               and v.revogado_em is null)
             returning id`,
            [ocorrenciaId, dados.responsavelPessoaId, dados.atribuidoPorPessoaId, dados.em],
          );

          if (criadas[0] === undefined) throw new SemVinculoAtivo();

          // 4 · A releitura acontece **dentro** da transação, como `registrar` e `aplicarTransicao` já
          // fazem: o que volta ao cliente é o detalhe de verdade, com nome de responsável, de categoria e
          // de área — não um payload pela metade.
          const relida = await lerPorId(executar, ocorrenciaId);
          if (relida === null) {
            // **Desde o item 21 este ramo é defeito, não caso de negócio.** O `update` da raiz já
            // devolveu linha, então a ocorrência existe nesta organização e `lerPorId` não pode falhar
            // — mesmo tratamento das quatro portas irmãs.
            throw new Error("Ocorrência recém-atribuída não foi relida — transação inconsistente.");
          }

          return { desfecho: "atribuida" as const, reatribuicao, ocorrencia: relida };
        });
      } catch (erro) {
        if (erro instanceof SemVinculoAtivo) {
          return { desfecho: "responsavel-sem-vinculo-ativo" as const };
        }
        if (ehAtribuicaoVigenteDuplicada(erro)) return { desfecho: "conflito" as const };
        throw erro;
      }
    },

    porId: (id) => lerPorId(consulta, id),

    /**
     * **A única leitura do produto que devolve `chave`.** O tipo de retorno é estreito de propósito: ele
     * não serve para montar payload nenhum, e é o que transforma *"a chave nunca sai"* de disciplina em
     * tipo.
     */
    async objetoDoAnexo(ocorrenciaId, anexoId) {
      const linhas = await consulta<{ chave: string; thumbnail_chave: string | null }>(
        `select a.chave, a.thumbnail_chave
           from anexos a
          where a.organizacao_id = $1 and a.ocorrencia_id = $2 and a.id = $3`,
        [ocorrenciaId, anexoId],
      );

      const linha = linhas[0];
      if (linha === undefined) return null;
      return { chave: linha.chave, thumbnailChave: linha.thumbnail_chave };
    },

    /**
     * A página da listagem — **numerada sobre um instante de corte** (item 14b, 09/09/2026).
     *
     * **`$1` é a organização, e os parâmetros de quem chama começam em `$2`** — por isso o contador começa
     * em 2. O SQL é montado por partes porque as condições são opcionais, e **não há interpolação de valor
     * em lugar nenhum**: o que entra no texto é sempre `$n`.
     *
     * **`registrada_em <= $ate` é a fronteira superior imóvel.** `registrada_em` nunca muda, então uma
     * ocorrência registrada depois de o leitor abrir a lista não entra no conjunto e não empurra ninguém —
     * é o que substitui a imunidade que o cursor dava, e é a metade da §7.7 do contrato que esta fatia
     * conserta de vez.
     *
     * **O `offset` chega COMPENSADO** e este arquivo não sabe disso — para ele é um deslocamento. Quem
     * compensa é `listarOcorrencias`, e a razão está na §3.3 da spec do 14b.
     *
     * **Sem `count(*) over ()`, e a ausência é decisão.** Uma função de janela obrigaria a consumir o
     * conjunto filtrado inteiro antes de emitir a primeira linha — o `limit` para a saída, não a entrada.
     * O `total` vem do `contar`, logo abaixo, num `count(*) FILTER` da consulta que já contava. **Assim a
     * página continua sendo um `limit/offset` sobre o índice `(organizacao_id, registrada_em desc)`.**
     *
     * **O índice que serve esta consulta é `(organizacao_id, registrada_em DESC)`**, o da ordenação — não
     * o `(organizacao_id, status)`. O `EXPLAIN` que o confirmaria continua sem ser rodado (passo manual
     * **M.2**).
     */
    async listar(filtro) {
      const valores: unknown[] = [];
      const condicoes: string[] = [];
      const proximo = () => `$${valores.length + 2}`;

      if (filtro.autorPessoaId !== undefined) {
        condicoes.push(`o.autor_pessoa_id = ${proximo()}::uuid`);
        valores.push(filtro.autorPessoaId);
      }

      condicoes.push(`o.registrada_em <= ${proximo()}::timestamptz`);
      valores.push(filtro.ate);

      condicoes.push(...condicoesDoRecorte(filtro.filtro, proximo, valores));

      const limite = proximo();
      valores.push(filtro.limite);
      const deslocamento = proximo();
      valores.push(filtro.deslocamento);

      const linhas = await consulta<LinhaDeResumo>(
        `${SELECT_DO_RESUMO}
           ${condicoes.map((condicao) => `and ${condicao}`).join("\n           ")}
         order by o.registrada_em desc, o.id desc
         limit ${limite}::int offset ${deslocamento}::int`,
        valores,
      );

      return linhas.map(montarResumo);
    },

    /**
     * As seis contagens de `GET /ocorrencias` — item 14b, e **todas sob a mesma visibilidade que a
     * listagem aplica**.
     *
     * **Este é o ponto onde um erro vira furo de multi-tenant.** Um `COUNT` sem `autor_pessoa_id` vaza a
     * **existência** de ocorrências que o Solicitante não pode ler: ele não veria os títulos, mas leria o
     * número. É por isso que o `GET /dashboard` **não** foi reusado — o `SELECT_DO_BACKLOG_POR_STATUS`
     * conta a organização inteira, o que está correto lá (só o Gestor o alcança) e seria vazamento aqui.
     *
     * **UMA consulta, seis números, uma varredura da partição.** O `where` carrega só a organização e a
     * visibilidade; o corte e o recorte moram dentro de cada `FILTER`, porque `novas` olha para o outro
     * lado do corte e não caberia num `where` compartilhado.
     *
     * **A assimetria do recorte é deliberada, e não é descuido.** `totalFiltrado` e `novas` aplicam os
     * três filtros de G2 **e o recorte de autor da página** (`?autor=eu`); `todas`, `minhas`, `emAberto` e
     * `semResponsavel` **não** aplicam nenhum dos quatro. A razão é de uso: os quatro do painel existem
     * para o leitor **decidir qual recorte pedir**, e recalculá-los dentro do recorte que ele já pediu
     * seria um espelho de frente para outro — `emAberto` sob `?status=resolvida` daria zero, sempre, e não
     * informaria nada. `novas` é o oposto: ela responde *"apertar Atualizar vai mudar a lista que você
     * está lendo"*, e essa lista é a filtrada.
     *
     * **`todas` acompanha `minhas`** (item 44p, critério 23): os dois existem para o leitor escolher o
     * recorte, e por isso nenhum dos dois aplica os quatro. Foi a falta dele que deixou T-03 sem contagem
     * enquanto T-08 tinha — lá o cliente tem a lista inteira na mão, aqui a lista pagina.
     *
     * **`semResponsavel` conta só entre as não terminais**, e é escolha: *"sem responsável"* é uma fila de
     * trabalho, e ocorrência resolvida sem responsável não é trabalho parado — é história.
     *
     * **Os `::int` não são decoração:** `count(*)` é `bigint`, e o `pg` o devolve como **string** para não
     * perder precisão. Sem o *cast*, `total` chegaria como `"137"` e a aritmética da compensação
     * concatenaria em vez de subtrair. É a mesma nota do `dashboard-escopado.ts`.
     */
    async contar(filtro): Promise<ContagensLidas> {
      const valores: unknown[] = [];
      const condicoes: string[] = [];
      const proximo = () => `$${valores.length + 2}`;

      if (filtro.autorPessoaId !== undefined) {
        condicoes.push(`o.autor_pessoa_id = ${proximo()}::uuid`);
        valores.push(filtro.autorPessoaId);
      }

      const ate = proximo();
      valores.push(filtro.ate);
      const quem = proximo();
      valores.push(filtro.pessoaIdDeQuemPergunta);
      const terminais = proximo();
      valores.push([...TERMINAIS]);

      const recorte = condicoesDoRecorte(filtro.filtro, proximo, valores);

      // **O recorte de autor DA PÁGINA entra aqui, e só aqui.** Ele acompanha os três de G2 em
      // `totalFiltrado` e em `novas`, e **não** entra no `where` de fora: o `where` carrega a
      // visibilidade do painel, que é só permissão. Para o Solicitante os dois coincidem e a condição é
      // redundante; para o Gestor com `?autor=eu` ela é a diferença entre o `total` da lista e o da
      // organização.
      if (filtro.autorPessoaIdDaPagina !== undefined) {
        recorte.push(`o.autor_pessoa_id = ${proximo()}::uuid`);
        valores.push(filtro.autorPessoaIdDaPagina);
      }

      const eRecorte = recorte.length === 0 ? "" : ` and ${recorte.join(" and ")}`;

      const corte = `o.registrada_em <= ${ate}::timestamptz`;
      const naoTerminal = `o.status <> all(${terminais}::status_ocorrencia[])`;
      const semResponsavelVigente = `not exists (
             select 1 from atribuicoes at
              where at.ocorrencia_id = o.id
                and at.organizacao_id = o.organizacao_id
                and at.encerrada_em is null)`;

      const linhas = await consulta<LinhaDeContagens>(
        `select count(*) filter (where ${corte}${eRecorte})::int                             as total_filtrado,
                count(*) filter (where ${corte})::int                                        as todas,
                count(*) filter (where ${corte} and o.autor_pessoa_id = ${quem}::uuid)::int  as minhas,
                count(*) filter (where ${corte} and ${naoTerminal})::int                     as em_aberto,
                count(*) filter (where ${corte} and ${naoTerminal}
                                   and ${semResponsavelVigente})::int                        as sem_responsavel,
                count(*) filter (where o.registrada_em > ${ate}::timestamptz${eRecorte})::int as novas
           from ocorrencias o
          where o.organizacao_id = $1
          ${condicoes.map((condicao) => `and ${condicao}`).join("\n          ")}`,
        valores,
      );

      const linha = linhas[0];
      // `count(*)` sem `group by` sempre devolve uma linha, inclusive com zero linhas na tabela. O ramo
      // existe para o compilador, não para o banco.
      if (linha === undefined) {
        return { totalFiltrado: 0, todas: 0, minhas: 0, emAberto: 0, semResponsavel: 0, novas: 0 };
      }

      return {
        totalFiltrado: linha.total_filtrado,
        todas: linha.todas,
        minhas: linha.minhas,
        emAberto: linha.em_aberto,
        semResponsavel: linha.sem_responsavel,
        novas: linha.novas,
      };
    },

    async trilha(ocorrenciaId) {
      const linhas = await consulta<LinhaDeTransicao>(SELECT_DA_TRILHA, [ocorrenciaId]);
      return linhas.map(montarTransicao);
    },
    /**
     * **`[ocorrenciaId]` e não `[organizacaoId, ocorrenciaId]`.** `escoparConsulta` injeta a organização
     * como `$1` — este arquivo **não recebe** o identificador (ADR-0003). É a mesma chamada de `trilha`,
     * logo acima.
     */
    async atribuicoes(ocorrenciaId) {
      const linhas = await consulta<LinhaDeAtribuicao>(SELECT_DAS_ATRIBUICOES, [ocorrenciaId]);
      return linhas.map(montarAtribuicao);
    },

    /**
     * **A página da conversa** — ordem crescente, cursor sobre `(criado_em, id)`.
     *
     * **Os `::` não são decoração.** Numa comparação de linha `(a, b) > ($3, $4)` o Postgres não infere o
     * tipo dos parâmetros, e sem a marcação ele recusa a consulta. É a mesma nota do `listar`.
     *
     * **O `id` no `order by` não é enfeite — é o desempate.** Sem ele, duas mensagens com o mesmo
     * `criado_em` deixam a ordem indefinida, e é exatamente aí que um item aparece em duas páginas. É a
     * mesma razão pela qual `CursorDeListagem` carrega o `id`.
     */
    async comentarios(ocorrenciaId, pagina) {
      const valores: unknown[] = [ocorrenciaId];
      let corte = "";

      if (pagina.cursor !== null) {
        corte = ` and (m.criado_em, m.id) > ($3::timestamptz, $4::uuid)`;
        valores.push(pagina.cursor.criadoEm, pagina.cursor.id);
      }

      const limite = `$${String(valores.length + 2)}`;
      valores.push(pagina.limite);

      const linhas = await consulta<LinhaDeMensagem>(
        `${SELECT_DAS_MENSAGENS}${corte}
         order by m.criado_em, m.id
         limit ${limite}::int`,
        valores,
      );

      return linhas.map(montarComentario);
    },

    /**
     * **Todas as mensagens, sem cauda nenhuma** — a terceira fonte da linha do tempo.
     *
     * **`[ocorrenciaId]` e não `[organizacaoId, ocorrenciaId]`.** `escoparConsulta` injeta a organização
     * como `$1` — este arquivo **não recebe** o identificador (ADR-0003). É a mesma chamada de `trilha` e
     * de `atribuicoes`.
     */
    async mensagens(ocorrenciaId) {
      const linhas = await consulta<LinhaDeMensagem>(
        `${SELECT_DAS_MENSAGENS} order by m.criado_em, m.id`,
        [ocorrenciaId],
      );
      return linhas.map(montarComentario);
    },

    /**
     * **A mensagem — o canal preguiçoso, o `insert`, o carimbo e a releitura, num `COMMIT` só.**
     *
     * **Duas instruções para o canal, sempre, e a segunda é a única fonte do `id`.** O
     * `on conflict … where tipo <> 'atribuicao' do nothing` repete o predicado do índice **porque tem de
     * repetir**: a inferência sobre índice único PARCIAL exige o `index_predicate`. Sem ele o Postgres
     * recusa a instrução — e não silenciosamente.
     *
     * **Não há `where exists` como em `atribuirResponsavel`.** Lá ele traduz *"vínculo **ativo**"*, que é
     * um fato que a FK não vê. Aqui a FK composta `(ocorrencia_id, organizacao_id) → ocorrencias` já é a
     * defesa do escopo, e o `insert` nem chega com valor de outra organização, porque a Aplicação leu a
     * ocorrência pelo repositório escopado e já devolveu `404`.
     *
     * **A releitura acontece DENTRO da transação**, como as seis portas de escrita anteriores: o que
     * volta ao cliente é o payload de verdade, com o nome que sai do `join vinculos → pessoas` — não um
     * objeto montado a partir do que se acabou de escrever, que é como se produz resposta que diverge da
     * leitura seguinte.
     */
    async comentar(ocorrenciaId, dados) {
      return emTransacao(async (executar) => {
        // 1 · O canal, se ainda não houver. Zero linhas afetadas = já existia.
        await executar(
          `insert into canais_conversa (organizacao_id, ocorrencia_id, tipo, criado_em)
           values ($1, $2::uuid, 'comentario', $3::timestamptz)
           on conflict (ocorrencia_id, tipo) where tipo <> 'atribuicao' do nothing`,
          [ocorrenciaId, dados.em],
        );

        // 2 · O `id`, de antes ou de agora — o caminho é um só.
        const canais = await executar<{ id: string }>(
          `select id from canais_conversa
            where organizacao_id = $1 and ocorrencia_id = $2::uuid and tipo = 'comentario'`,
          [ocorrenciaId],
        );
        const canalId = canais[0]?.id;
        if (canalId === undefined) {
          // Inalcançável pelo caminho normal: o `insert` acima acabou de garantir a linha. Se acontecer,
          // a FK da ocorrência recusou em silêncio — e continuar escreveria mensagem órfã.
          throw new Error(
            `Canal do comentário da ocorrência ${ocorrenciaId} não foi lido após o insert.`,
          );
        }

        // 3 · A mensagem.
        const criadas = await executar<{ id: string }>(
          `insert into mensagens (organizacao_id, canal_id, autor_pessoa_id, texto, criado_em)
           values ($1, $2::uuid, $3::uuid, $4, $5::timestamptz)
           returning id`,
          [canalId, dados.autorPessoaId, dados.texto, dados.em],
        );
        const mensagemId = criadas[0]?.id;
        if (mensagemId === undefined) {
          throw new Error("Mensagem não foi inserida — transação inconsistente.");
        }

        /**
         * 4 · **`atualizada_em` é escrito, mesmo sem transição.** O campo não quer dizer *"esta linha
         * mudou"* — quer dizer *"houve atividade nesta ocorrência"*, o que inclui `INSERT` em outra
         * tabela (`arquitetura.md` §5.8, que nomeia **esta** fatia). **O mesmo instante** que
         * `mensagens.criado_em`, nunca `now()`.
         */
        await executar(
          `update ocorrencias set atualizada_em = $3::timestamptz
            where organizacao_id = $1 and id = $2::uuid`,
          [ocorrenciaId, dados.em],
        );

        // 5 · A releitura, com a cauda que estreita para a linha recém-escrita.
        const linhas = await executar<LinhaDeMensagem>(
          `${SELECT_DAS_MENSAGENS} and m.id = $3::uuid`,
          [ocorrenciaId, mensagemId],
        );
        const linha = linhas[0];
        if (linha === undefined) {
          throw new Error("Mensagem recém-criada não foi relida — transação inconsistente.");
        }

        return montarComentario(linha);
      });
    },
  };
}
