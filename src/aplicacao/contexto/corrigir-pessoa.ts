import type { PessoaReferencia, RepositorioDePessoas } from "./portas";

export type ComandoDeCorrecaoDePessoa = {
  /** Quem está se corrigindo — `ctx.pessoaId`, da sessão. Nunca vem do corpo nem da URL. */
  pessoaId: string;
  nome: string;
};

/**
 * **Corrigir os próprios dados — item 49.**
 *
 * **Sem recusa a traduzir, e sem desfecho.** A Pessoa é a da sessão, `resolverContexto` garante que ela
 * existe (é o ACL que a cria), e não há `UNIQUE` sobre `pessoas.nome` — duas pessoas podem se chamar
 * Helena Rocha, e o que as distingue é o identificador. É a mesma forma de `corrigirOrganizacao`.
 *
 * **Ele existe mesmo assim porque a fronteira é a mesma:** `app/` não monta repositório (ADR-0006, regra
 * 2b), e o handler chama **uma** função desta camada.
 *
 * **`nome` é obrigatório aqui e opcional no corpo do endpoint**, e a divisão é a de
 * `PATCH /organizacoes`: *"informe ao menos um campo"* é regra da rota, e o que chega nesta camada já é
 * uma correção com conteúdo. Quando `contatos[]` entrar, este comando ganha o segundo campo e os dois
 * ficam opcionais — o corpo `{ nome? }` existe para que isso não quebre cliente nenhum (spec §3.5).
 */
export async function corrigirPessoa(
  pessoas: RepositorioDePessoas,
  comando: ComandoDeCorrecaoDePessoa,
): Promise<PessoaReferencia> {
  return pessoas.renomear(comando.pessoaId, comando.nome);
}
