/** Superfície pública de `interface/exportacao` (ADR-0006, regra 3) — o arquivo CSV do item 124. */
export { BOM, montarCsv, neutralizar, nomeDoArquivo, type Celula, type ColunaDoArquivo } from "./csv";
export {
  COLUNAS_DE_AREAS,
  COLUNAS_DE_CATEGORIAS,
  COLUNAS_DE_OCORRENCIAS,
  COLUNAS_DE_PARTICIPANTES,
} from "./arquivos";
