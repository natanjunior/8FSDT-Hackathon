import type { ArmazenamentoDeAnexos, PortasDeAnexo } from "@/aplicacao/anexo";
import type { PortasGlobais, RepositoriosEscopados } from "@/aplicacao/contexto";
import { randomBytes } from "node:crypto";

import type { PortaDeCredenciais } from "@/aplicacao/credenciais";
import type { RepositorioDeConvites } from "@/aplicacao/organizacao";
import {
  criarArmazenamentoDeAnexos,
  criarAutenticacao,
  criarConsulta,
  criarCredenciais,
  criarEmissorDeCredencialDeUpload,
  criarTransacao,
  type ArmazenamentoDeCookies,
} from "@/infraestrutura/clientes";
import { escoparConsulta, escoparTransacao } from "@/infraestrutura/contexto";
import { livroDeAutorizacoesDeUpload } from "@/infraestrutura/repositorios/anexo";
import { repositorioEscopadoDeDashboard } from "@/infraestrutura/repositorios/dashboard";
import { repositorioEscopadoDeOcorrencias } from "@/infraestrutura/repositorios/ocorrencia";
import {
  repositorioDeConvites,
  repositorioDeOrganizacoes,
  repositorioDePedidosDeEntrada,
  repositorioEscopadoDaConfiguracao,
  repositorioEscopadoDaOrganizacao,
  repositorioEscopadoDeAreas,
  repositorioEscopadoDeCategorias,
  repositorioEscopadoDeConvitesPessoais,
  repositorioEscopadoDeEtiquetas,
  repositorioEscopadoDePedidosDeEntrada,
  repositorioEscopadoDeVinculos,
  repositorioGlobalDePedidosDeEntrada,
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
 * `eslint.config.mjs`. E a sua **superfície pública tem quatro funções e nenhum cliente**: quem chega aqui
 * não consegue obter uma conexão de banco nem um objeto do SDK. Só portas. *(Eram três até o item 13a
 * acrescentar `montarPortasDeAnexo`, cujas portas não são escopadas nem globais no sentido da §4.4 — ver
 * o comentário dela.)*
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
 * As portas que as cinco operações sem organização consomem (contrato §4.4), mais a porta que o ponto
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
    pedidosDeEntrada: repositorioGlobalDePedidosDeEntrada(consulta),
    // A escrita das três linhas num `COMMIT` só. Recebe a transação, não a consulta.
    escritaDePedidosDeEntrada: repositorioDePedidosDeEntrada(criarTransacao()),
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
    // Recebe as **duas** formas de acesso: a consulta para a leitura, e a transação escopada para o
    // cadastro e a correção, que fazem duas escritas num `COMMIT` só. As duas passam pelo mesmo `$1`.
    vinculos: repositorioEscopadoDeVinculos(
      consulta,
      escoparTransacao(criarTransacao(), organizacaoId),
    ),
    // Recebe as **duas** formas de acesso: a consulta para a lista e as escritas de uma instrução, e a
    // transação escopada para atribuir, que trava o vínculo, cria ou acha a etiqueta e liga, num `COMMIT`.
    etiquetas: repositorioEscopadoDeEtiquetas(consulta, escoparTransacao(criarTransacao(), organizacaoId)),
    // O convite pessoal do lado do Gestor (item 121): a consulta para ler e garantir, que é uma instrução
    // só com `on conflict`, e a transação escopada para renovar, que carimba o vivo e insere outro.
    convitesPessoais: repositorioEscopadoDeConvitesPessoais(
      consulta,
      escoparTransacao(criarTransacao(), organizacaoId),
    ),
    // Recebem as **duas** formas de acesso desde o item 50: a consulta para a leitura e para as escritas de
    // uma instrução só, e a transação escopada para a reordenação, que trava a lista, confere o conjunto,
    // grava e relê num `COMMIT` só. As duas passam pelo mesmo `$1`.
    categorias: repositorioEscopadoDeCategorias(
      consulta,
      escoparTransacao(criarTransacao(), organizacaoId),
    ),
    areas: repositorioEscopadoDeAreas(consulta, escoparTransacao(criarTransacao(), organizacaoId)),
    // **Só a consulta, e a ausência da transação é o desenho:** a correção do nome é uma instrução só, e
    // uma porta que recebesse `escoparTransacao` daria a ela atomicidade que ninguém pediu.
    organizacao: repositorioEscopadoDaOrganizacao(consulta),
    // Recebe as **duas** formas de acesso desde o item 100: a consulta para a leitura, e a transação
    // escopada para a escrita. A mudança de regra continua sendo uma instrução só, com o gatilho da 017
    // gravando a trilha dentro dela; a mudança de rótulo escreve em duas tabelas — o texto e a linha da
    // trilha —, e as duas têm de cair juntas.
    configuracao: repositorioEscopadoDaConfiguracao(
      consulta,
      escoparTransacao(criarTransacao(), organizacaoId),
    ),
    // Recebe as **duas** formas de acesso: a consulta para a leitura, e a transação escopada para a
    // aprovação, que faz duas escritas num `COMMIT` só. As duas passam pelo mesmo `$1`.
    pedidosDeEntrada: repositorioEscopadoDePedidosDeEntrada(
      consulta,
      escoparTransacao(criarTransacao(), organizacaoId),
    ),
    // Recebe as **duas** formas de acesso: a consulta para as duas leituras, e a transação escopada para
    // o registro, que grava ocorrência e primeiro registro de transição num `COMMIT` só (invariante 2).
    ocorrencias: repositorioEscopadoDeOcorrencias(
      consulta,
      escoparTransacao(criarTransacao(), organizacaoId),
    ),
    // **Só a consulta, e a ausência da transação é o desenho:** o dashboard não escreve, e uma porta que
    // recebesse `escoparTransacao` daria a ele o poder de gravar sem que nada no tipo dissesse isso.
    dashboard: repositorioEscopadoDeDashboard(consulta),
  };
}

/**
 * A porta do convite (item 86, ADR-0018).
 *
 * **Separada das globais e das escopadas, e a separação é a decisão.** As globais servem as cinco
 * operações do §4.4, todas com sessão; o convite roda sem. Quem recebe esta porta não recebe mais nada:
 * nem vínculos, nem pessoas, nem escrita.
 */
export function montarPortaDeConvites(): RepositorioDeConvites {
  return repositorioDeConvites(criarConsulta());
}

/**
 * A porta de leitura e etiqueta do anexo.
 *
 * **Separada de `montarPortasDeAnexo`, e a separação é a decisão** (spec §3.5): aquela entrega o emissor
 * de **SAS de escrita** e o livro-caixa das 30/h; esta lê objeto, troca etiqueta e assina **SAS de
 * leitura**. Fundi-las daria ao endpoint de leitura o poder de emitir crédito de upload — precisão
 * perdida por economia de quinze linhas.
 *
 * **Ela também não é escopada**, pelo mesmo motivo da outra: o adaptador não conhece organização. Quem
 * amarra o escopo é o ticket, na escrita, e a linha de `anexos` lida pelo repositório escopado, na
 * leitura. Por isso ela não entra em `RepositoriosEscopados`.
 */
export function montarArmazenamentoDeAnexos(): ArmazenamentoDeAnexos {
  return criarArmazenamentoDeAnexos();
}

/**
 * As portas do anexo. **Nenhuma das duas é escopada, e isso é decisão** — spec do item 13a §3.1.
 *
 * O emissor não tem dado de organização nenhum. O livro-caixa é global porque o limite protege a conta de
 * armazenamento, que é uma só para todas as organizações: escopá-lo daria 60/h a quem tem dois vínculos.
 *
 * **Quem alcança isto é um arquivo só** — `interface/http/portas-de-anexo.ts` —, e o `eslint.config.mjs`
 * restringe a importação daquela função ao único `route.ts` que a usa, no mesmo mecanismo de lista fechada
 * que já protege `semOrganizacao`.
 */
export function montarPortasDeAnexo(): PortasDeAnexo {
  return {
    emissor: criarEmissorDeCredencialDeUpload(),
    livro: livroDeAutorizacoesDeUpload(criarTransacao()),
  };
}

/**
 * O gerador do token do convite pessoal (item 121): 32 bytes aleatórios em base64url, 43 sinais. Mora na
 * composição porque é o único lugar de fora da Infraestrutura que pode importar `node:crypto` sem levar o
 * gerador para a Aplicação, que o recebe por parâmetro.
 */
export function novoTokenDeConvite(): string {
  return randomBytes(32).toString("base64url");
}

/** A porta das telas de credencial (T-01, T-11). */
export function montarCredenciais(cookies: ArmazenamentoDeCookies): PortaDeCredenciais {
  return criarCredenciais(cookies);
}
