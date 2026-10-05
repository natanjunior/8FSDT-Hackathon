import type { ZodString } from "zod";

import type { AvisoDeConclusao } from "@/interface/componentes/retorno-de-acao";
import type { ErrosDeCampo } from "@/interface/ganchos/use-formulario-tocado";
import { nomeDeOrganizacao, nomeDePessoa } from "@/interface/schemas";

/**
 * ============================================================================
 *  As regras do modal do nome — T-15 e T-16, item 44i
 * ============================================================================
 *
 * **Os dois modais são o mesmo formulário**: um campo `nome`, obrigatório, de 1 a 120 depois de aparado,
 * que vai num `PATCH` e responde com aviso. O que muda entre eles é dado, e o dado mora nesta tabela. O
 * componente é `edicao-de-nome.tsx`.
 *
 * **Módulo sem JSX, e é de propósito.** O projeto não tem biblioteca de teste de componente; a decisão
 * mora aqui e é testada em `testes/interface/configuracao.test.ts` e em `pessoa.test.ts`.
 *
 * **O schema do campo é o mesmo da rota** (`nomeDeOrganizacao` em `PATCH /organizacoes`, `nomeDePessoa`
 * em `PATCH /contexto/pessoa`): a frase do campo vazio é a que o servidor devolveria.
 *
 * **As duas importações de tipo são instruções inteiras**, e não marcas dentro de uma importação comum:
 * com `verbatimModuleSyntax`, a segunda forma deixaria a importação do módulo no código emitido, e
 * `retorno-de-acao.ts` traz o pacote de avisos junto.
 */

export type AlvoDoNome = "organizacao" | "pessoa";

/** O teto do campo: o `varchar(120)` das duas colunas, e o `max(120)` dos dois schemas. */
export const TETO_DO_NOME = 120;

/**
 * **Salvar sem mudar acende esta frase**, em vez de desabilitar o botão (critério 44g.9). É a decisão que
 * o 44g tomou para a solução aplicada, com *nome* no lugar de *texto*.
 */
export const NOME_SEM_MUDANCA = "Altere o nome antes de salvar.";

export type EdicaoDoAlvo = {
  readonly endpoint: string;
  readonly schema: ZodString;
  readonly titulo: string;
  readonly descricao: string;
  readonly rotulo: string;
  readonly ajuda: string;
  /** O título do aviso de erro: o que foi tentado. A razão fica dentro do modal. */
  readonly falha: string;
  readonly sucesso: (nome: string) => AvisoDeConclusao;
};

export const EDICAO_DE_NOME: Readonly<Record<AlvoDoNome, EdicaoDoAlvo>> = {
  organizacao: {
    endpoint: "/api/organizacoes",
    schema: nomeDeOrganizacao,
    titulo: "Editar organização",
    descricao: "O código não muda junto com o nome.",
    rotulo: "Nome da organização",
    ajuda: "Aparece para quem pede entrada, no seletor de organização e no título do pedido pendente.",
    falha: "Não foi possível renomear a organização",
    sucesso: (nome) => ({
      titulo: "Organização renomeada",
      descricao: `A organização passou a se chamar ${nome}.`,
    }),
  },
  pessoa: {
    endpoint: "/api/contexto/pessoa",
    schema: nomeDePessoa,
    titulo: "Editar nome",
    descricao: "Vale em todas as suas organizações.",
    rotulo: "Nome",
    ajuda:
      "É como você aparece nas suas organizações, inclusive no que já fez nas ocorrências.",
    falha: "Não foi possível salvar o seu nome",
    // **A frase carrega o alcance**, que o item 49 fez questão de dizer (Persona 1B).
    sucesso: (nome) => ({
      titulo: "Nome salvo",
      descricao: `Você passou a aparecer como ${nome} em todas as suas organizações.`,
    }),
  },
};

/**
 * O erro do campo, calculado do valor de agora (o campo é controlado).
 *
 * | Valor | Mensagem |
 * |---|---|
 * | vazio, só espaços, ou acima de 120 depois de aparado | a do schema |
 * | igual ao nome atual depois de aparado | `NOME_SEM_MUDANCA` |
 * | outro nome válido | nenhuma |
 */
export function erroDoNome(alvo: AlvoDoNome, valor: string, atual: string): string | undefined {
  const conferido = EDICAO_DE_NOME[alvo].schema.safeParse(valor);
  if (!conferido.success) return conferido.error.issues[0]?.message;
  return conferido.data === atual.trim() ? NOME_SEM_MUDANCA : undefined;
}

/**
 * **O `400` que traz `erros[]` para `nome` põe a mensagem embaixo do campo** (o inventário diz que
 * `FORMATO_INVALIDO` vira mensagem por campo). Na prática ele não acontece, porque o campo é conferido com
 * o mesmo schema antes do envio.
 */
export function errosDoNomeNoCorpo(corpo: unknown): ErrosDeCampo {
  if (typeof corpo !== "object" || corpo === null) return {};
  const { erros } = corpo as { erros?: unknown };
  if (!Array.isArray(erros)) return {};

  for (const erro of erros as unknown[]) {
    if (typeof erro !== "object" || erro === null) continue;
    const { campo, mensagem } = erro as { campo?: unknown; mensagem?: unknown };
    if (campo === "nome" && typeof mensagem === "string" && mensagem.trim() !== "") {
      return { nome: mensagem };
    }
  }
  return {};
}

/**
 * O nome que a resposta de sucesso devolve (`OrganizacaoResumo.nome`, `PessoaReferencia.nome`). É ele que
 * o aviso diz, porque é o que ficou gravado; sem ele, quem chama usa o que enviou.
 */
export function nomeDaResposta(corpo: unknown): string | null {
  if (typeof corpo !== "object" || corpo === null) return null;
  const { nome } = corpo as { nome?: unknown };
  return typeof nome === "string" && nome !== "" ? nome : null;
}
