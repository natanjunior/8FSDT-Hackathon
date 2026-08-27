import { z } from "zod";

/**
 * Os schemas das telas de credencial — T-01 (entrar) e T-11 (criar conta).
 *
 * **Estes não geram `openapi.yaml`**, e é de propósito: `Criar conta` e `Autenticar-se` não são endpoints
 * deste contrato (§4.1). Vivem aqui porque o lugar dos schemas de validação é um só (ADR-0006), e porque a
 * validação do campo no navegador e a do servidor têm de ser a mesma — que é a razão de o `zod` estar no
 * projeto (ADR-0007).
 */

/** ≤ 120 — é o `varchar(120)` de `pessoas.nome` (modelo §6.2), e o limite que T-11 declara. */
export const nomeDePessoa = z
  .string()
  .trim()
  .min(1, "Diga como você quer ser chamado.")
  .max(120, "O nome cabe em 120 caracteres.");

export const email = z
  .string()
  .trim()
  .min(1, "Informe o seu e-mail.")
  .email("Confira o e-mail.");

/**
 * A senha é validada **pelo provedor** — a regra de força é dele (T-11: *"dita antes de digitar, não como
 * erro depois"*). O que se confere aqui é só a presença, para não gastar uma ida ao provedor com o campo
 * vazio.
 */
export const senha = z.string().min(1, "Informe a senha.");

export const entrarSchema = z.object({ email, senha });

export const criarContaSchema = z.object({
  nome: nomeDePessoa,
  email,
  senha,
});

/** T-12 · um campo: o e-mail da conta. Não pede senha — quem chega aqui é quem não a tem. */
export const pedirRedefinicaoSchema = z.object({ email });

/**
 * T-13 · um campo, e **só um**: a senha nova.
 *
 * **Não pede a antiga**, e é o critério 2 do item 6b — quem chegou ali é justamente quem não a tem
 * (inventário, T-13). O `Object.keys` do teste é a forma mecânica dessa frase.
 *
 * **A regra de força continua sendo do provedor**, como em T-11: aqui se confere presença. Escrever `6`
 * neste arquivo criaria um terceiro lugar guardando o mesmo número — e a divergência entre os lugares que
 * já o guardam é exatamente o achado **A-6b-1**.
 */
export const definirSenhaSchema = z.object({ senha });

export type EntradaDeLogin = z.infer<typeof entrarSchema>;
export type EntradaDeCadastro = z.infer<typeof criarContaSchema>;
export type EntradaDeRedefinicao = z.infer<typeof pedirRedefinicaoSchema>;
export type EntradaDeNovaSenha = z.infer<typeof definirSenhaSchema>;
