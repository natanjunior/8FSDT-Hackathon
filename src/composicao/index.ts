import type { PortasGlobais, RepositoriosEscopados } from "@/aplicacao/contexto";
import type { PortaDeCredenciais } from "@/aplicacao/credenciais";
import {
  criarAutenticacao,
  criarConsulta,
  criarCredenciais,
  criarTransacao,
  type ArmazenamentoDeCookies,
} from "@/infraestrutura/clientes";
import { escoparConsulta } from "@/infraestrutura/contexto";
import {
  repositorioDeOrganizacoes,
  repositorioEscopadoDeAreas,
  repositorioEscopadoDeCategorias,
  repositorioEscopadoDeVinculos,
  repositorioGlobalDeVinculos,
} from "@/infraestrutura/repositorios/organizacao";
import { repositorioDePessoas } from "@/infraestrutura/repositorios/pessoa";

/**
 * ============================================================================
 *  O ponto de composição
 * ============================================================================
 *
 * **Monta o grafo de objetos; não decide regra** (ADR-0006).
 *
 * É o único lugar do repositório que importa `infraestrutura/` — regra de lint 2, conferida por
 * `eslint.config.mjs`. E a sua **superfície pública tem três funções e nenhum cliente**: quem chega aqui
 * não consegue obter uma conexão de banco nem um objeto do SDK. Só portas.
 *
 * Isso é o que fecha a pergunta *"e se um `route.ts` novo esquecer o contexto?"*: não há como. `app/` não
 * pode importar nem `infraestrutura/` nem este módulo (regras 2 e 2b), então o único caminho de um handler
 * até um dado é o ajudante `comContexto` de `interface/http` — e ele resolve o contexto sempre.
 *
 * Se este arquivo virar trezentas linhas, o problema mudou de lugar em vez de sumir (ADR-0005, custo
 * assumido). Ele monta **um** grafo; qualquer decisão que apareça aqui pertence a outra camada.
 */

export type { ArmazenamentoDeCookies };

/**
 * As portas que as quatro operações sem organização consomem (contrato §4.4), mais a porta que o ponto
 * único de contexto usa em **toda** requisição.
 */
export function montarPortasGlobais(
  cookies: ArmazenamentoDeCookies,
  tokenPortador: string | null = null,
): PortasGlobais {
  const consulta = criarConsulta();
  return {
    autenticacao: criarAutenticacao(cookies, tokenPortador),
    pessoas: repositorioDePessoas(consulta),
    vinculos: repositorioGlobalDeVinculos(consulta),
    // A escrita que **cria** o escopo. Recebe a transação, não a consulta: as quatro escritas da POL-01
    // acontecem num `COMMIT` só, e a FK diferida de `organizacoes` depende disso (modelo §6.3).
    organizacoes: repositorioDeOrganizacoes(criarTransacao()),
  };
}

/**
 * Os repositórios já escopados à organização ativa.
 *
 * Recebe o identificador **resolvido** — não o descobre. Quem o descobre é a camada de Aplicação, uma vez
 * por requisição (ADR-0003, ponto 1).
 */
export function montarPortasEscopadas(organizacaoId: string): RepositoriosEscopados {
  const consulta = escoparConsulta(criarConsulta(), organizacaoId);
  return {
    vinculos: repositorioEscopadoDeVinculos(consulta),
    categorias: repositorioEscopadoDeCategorias(consulta),
    areas: repositorioEscopadoDeAreas(consulta),
  };
}

/** A porta das telas de credencial (T-01, T-11). */
export function montarCredenciais(cookies: ArmazenamentoDeCookies): PortaDeCredenciais {
  return criarCredenciais(cookies);
}
