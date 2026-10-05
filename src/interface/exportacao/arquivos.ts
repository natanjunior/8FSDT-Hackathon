import type { OcorrenciaExportadaLida } from "@/aplicacao/ocorrencia";
import type { AreaLida, CategoriaLida, VinculoLido } from "@/aplicacao/organizacao";
import { dataEHoraDoArquivo } from "@/interface/componentes/datas";
import { rotuloDoTipo } from "@/interface/componentes/frases-da-configuracao";
import { rotuloDoPapel } from "@/interface/componentes/frases-de-participantes";
import { rotuloDePrioridade } from "@/interface/componentes/rotulos";
import { nomeDoMotivoPausa, nomeDoStatus } from "@/interface/projecoes";

import type { ColunaDoArquivo } from "./csv";

/**
 * As quatro listas de colunas do item 124. **A ordem é a do arquivo, e o teste a prende** (critério 2):
 * coluna que entra ou sai quebra `testes/interface/exportacao.test.ts`.
 *
 * O arquivo é escrito para gente (respostas P1): enumeração em palavra, booleano em `Sim`/`Não`, data em
 * `dd/mm/aaaa hh:mm` de São Paulo. Nenhum valor cru chega à célula.
 */

const simOuNao = (valor: boolean) => (valor ? "Sim" : "Não");
const dataOuVazio = (iso: string | null) => (iso === null ? null : dataEHoraDoArquivo(iso));

export const COLUNAS_DE_OCORRENCIAS: readonly ColunaDoArquivo<OcorrenciaExportadaLida>[] = [
  { titulo: "ID", celula: (o) => o.id },
  { titulo: "Título", celula: (o) => o.titulo },
  { titulo: "Descrição", celula: (o) => o.descricao },
  { titulo: "Status", celula: (o) => nomeDoStatus(o.status) },
  { titulo: "Prioridade", celula: (o) => rotuloDePrioridade(o.prioridade) },
  { titulo: "Categoria", celula: (o) => o.categoria.nome },
  { titulo: "Área", celula: (o) => o.area.nome },
  // O tipo **congelado no registro**, o mesmo do resumo, e não o vigente da Área.
  { titulo: "Tipo da área", celula: (o) => rotuloDoTipo(o.area.tipo) },
  { titulo: "Registrada por", celula: (o) => o.autor.nome },
  { titulo: "Responsável", celula: (o) => o.responsavel?.nome ?? null },
  { titulo: "Motivo da pausa", celula: (o) => (o.motivoPausa === null ? null : nomeDoMotivoPausa(o.motivoPausa)) },
  { titulo: "Solução aplicada", celula: (o) => o.solucaoAplicada },
  { titulo: "Nota da avaliação", celula: (o) => o.notaDaAvaliacao },
  { titulo: "Anexos", celula: (o) => o.quantidadeDeAnexos },
  { titulo: "Registrada em", celula: (o) => dataEHoraDoArquivo(o.registradaEm) },
  { titulo: "Atualizada em", celula: (o) => dataEHoraDoArquivo(o.atualizadaEm) },
];

const contatosDo = (v: VinculoLido, tipo: "email" | "telefone") =>
  v.pessoa.contatos
    .filter((c) => c.tipo === tipo)
    .map((c) => c.valor)
    .join(", ") || null;

export const COLUNAS_DE_PARTICIPANTES: readonly ColunaDoArquivo<VinculoLido>[] = [
  { titulo: "Nome", celula: (v) => v.pessoa.nome },
  { titulo: "Papel", celula: (v) => rotuloDoPapel(v.papel) },
  { titulo: "Área", celula: (v) => v.area?.nome ?? null },
  { titulo: "Tem conta", celula: (v) => simOuNao(v.temConta) },
  // Na ordem da cadeia de tentativa, que é a ordem em que `contatos` já chega (`projecoes/vinculo.ts`).
  { titulo: "E-mail", celula: (v) => contatosDo(v, "email") },
  { titulo: "Telefone", celula: (v) => contatosDo(v, "telefone") },
  // A coluna existe mesmo sem etiqueta: coluna fixa não some conforme o dado.
  { titulo: "Etiquetas", celula: (v) => v.etiquetas.map((e) => e.nome).join(", ") || null },
  { titulo: "Participa desde", celula: (v) => dataEHoraDoArquivo(v.criadoEm) },
  { titulo: "Atualizado em", celula: (v) => dataOuVazio(v.atualizadoEm) },
];

export const COLUNAS_DE_AREAS: readonly ColunaDoArquivo<AreaLida>[] = [
  { titulo: "Ordem", celula: (a) => a.ordem },
  { titulo: "Nome", celula: (a) => a.nome },
  { titulo: "Tipo", celula: (a) => rotuloDoTipo(a.tipo) },
  { titulo: "Ativa", celula: (a) => simOuNao(a.ativa) },
];

export const COLUNAS_DE_CATEGORIAS: readonly ColunaDoArquivo<CategoriaLida>[] = [
  { titulo: "Ordem", celula: (c) => c.ordem },
  { titulo: "Nome", celula: (c) => c.nome },
  { titulo: "Ativa", celula: (c) => simOuNao(c.ativa) },
];
