/**
 * ============================================================================
 *  As chaves que a fusão do convite pessoal conhece (item 121, critério 6)
 * ============================================================================
 *
 * Toda chave estrangeira cujo alvo é `vinculos` ou `pessoas` está em **uma** das três listas, no formato
 * `tabela.constraint`. `testes/integracao/vinculo.test.ts` lê o `pg_constraint` e reprova a chave fora
 * delas: **a fusão certa hoje envelhece na próxima migração**, e é isto que impede.
 *
 * **Os dois pais, e não um.** `contatos` pendura em `pessoas (id)`, e não no par do vínculo: uma varredura
 * só de `vinculos` não o encontraria, como não encontraria as outras chaves para `pessoas`.
 *
 * - **reapontadas:** onde a Pessoa cadastrada pode estar **como objeto**, porque alguém a pôs lá. A fusão
 *   as move para a Pessoa da conta. Sem conta, ela nunca agiu, e por isso a lista é curta.
 * - **o próprio vínculo:** a linha que a fusão insere (ou readmite) e apaga.
 * - **de quem fez:** colunas de autoria. Exigem login, e a Pessoa cadastrada sem conta nunca está nelas.
 *   (A exceção é a conta apagada no provedor: a fusão dela falha no `delete` do vínculo, e a transação
 *   desfaz tudo.)
 *
 * **Acrescentou uma chave?** Decida se ela pode conter alguém sem conta. Se pode, ela é reapontada, e
 * `aceitar` em `convites-pessoais.ts` ganha o `update`; se não, é de quem fez.
 */
export const CHAVES_DA_FUSAO = {
  reapontadas: [
    "atribuicoes.atribuicoes_responsavel_fk",
    "compartilhamentos.compartilhamentos_com_fk",
    "contatos.contatos_pessoa_fk",
    "convites_pessoais.convites_pessoais_vinculo_fk",
    "vinculos_etiquetas.vinculos_etiquetas_vinculo_fk",
  ],
  proprioVinculo: ["vinculos.vinculos_pessoa_fk"],
  deQuemFez: [
    "anexos.anexos_anexado_por_fk",
    "areas.areas_atualizado_por_fk",
    "areas.areas_criado_por_fk",
    "areas.areas_tipo_alterado_por_fk",
    "atribuicoes.atribuicoes_atribuido_por_fk",
    // Sem nome declarado na 006 (`references pessoas (id)` em linha): é o nome que o Postgres gera.
    "autorizacoes_de_upload.autorizacoes_de_upload_pessoa_id_fkey",
    "categorias.categorias_atualizado_por_fk",
    "categorias.categorias_criado_por_fk",
    "compartilhamentos.compartilhamentos_por_fk",
    "convites_pessoais.convites_pessoais_criado_por_fk",
    "envios_de_convite.envios_de_convite_enviado_por_fk",
    "leituras_de_ocorrencia.leituras_de_ocorrencia_pessoa_fk",
    "mensagens.mensagens_autor_fk",
    "mudancas_de_configuracao.mudancas_de_configuracao_autor_fk",
    "ocorrencias.ocorrencias_autor_fk",
    "organizacoes.organizacoes_atualizado_por_fk",
    "organizacoes.organizacoes_criada_por_vinculo_fk",
    "pedidos_de_entrada.pedidos_de_entrada_decisor_fk",
    "pedidos_de_entrada.pedidos_de_entrada_pessoa_fk",
    "registros_transicao.registros_transicao_autor_fk",
    "vinculos_etiquetas.vinculos_etiquetas_atribuido_por_fk",
  ],
} as const;

export type ChaveDoCatalogo = { tabela: string; chave: string };

/**
 * Os defeitos, em frases que nomeiam a tabela. Lista vazia é catálogo e listas de acordo. As listas entram
 * por parâmetro só para o teste de unidade provar a lista duplicada; o código usa sempre as declaradas.
 */
export function conferirChavesDaFusao(
  catalogo: readonly ChaveDoCatalogo[],
  listas: Readonly<Record<string, readonly string[]>> = CHAVES_DA_FUSAO,
): string[] {
  const declaradas: readonly string[] = Object.values(listas).flat();
  const noBanco = new Set(catalogo.map((c) => `${c.tabela}.${c.chave}`));
  const defeitos: string[] = [];
  for (const c of catalogo) {
    if (!declaradas.includes(`${c.tabela}.${c.chave}`)) {
      defeitos.push(
        `${c.tabela}: a chave ${c.chave} aponta para vinculos ou pessoas e não está em nenhuma lista da fusão`,
      );
    }
  }
  for (const par of declaradas) {
    const [tabela, chave] = par.split(".");
    if (declaradas.indexOf(par) !== declaradas.lastIndexOf(par)) {
      defeitos.push(`${tabela}: a chave ${chave} está em mais de uma lista da fusão`);
    }
    if (!noBanco.has(par)) {
      defeitos.push(`${tabela}: a chave ${chave} está numa lista da fusão e não existe mais no banco`);
    }
  }
  return [...new Set(defeitos)];
}
