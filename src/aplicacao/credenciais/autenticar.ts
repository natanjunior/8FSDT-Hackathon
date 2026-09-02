import type { PortaDeCredenciais, ResultadoDeCredencial } from "./portas";

/**
 * As três operações de credencial, como funções (arquitetura.md §5.4: *funções, não objetos de caso de
 * uso*). Cada uma **recebe** a porta; nenhuma a fabrica (ADR-0005).
 *
 * São finas de propósito: o subdomínio é Genérico e foi comprado, então o trabalho desta camada é
 * orquestrar e nada mais. O valor de existirem é que a camada de Interface passa a ter **uma** função a
 * chamar em vez de um SDK a importar — e é isso que mantém a regra de fronteira verdadeira.
 */

export function entrar(
  credenciais: PortaDeCredenciais,
  email: string,
  senha: string,
): Promise<ResultadoDeCredencial> {
  return credenciais.entrar(email.trim(), senha);
}

export function criarConta(
  credenciais: PortaDeCredenciais,
  nome: string,
  email: string,
  senha: string,
  destino: string,
): Promise<ResultadoDeCredencial> {
  // **O destino não é aparado e não é validado aqui.** Esta camada orquestra; quem o montou foi a
  // Interface, que é a única com a requisição na mão. Aparar endereço montado por outra camada seria
  // esta opinando sobre transporte (item 6c).
  return credenciais.criarConta(nome.trim(), email.trim(), senha, destino);
}

/** T-01, estados 5 e 6: a aterrissagem do link de confirmação de conta. */
export function confirmarPorCodigo(
  credenciais: PortaDeCredenciais,
  codigo: string,
): Promise<ResultadoDeCredencial> {
  return credenciais.confirmarPorCodigo(codigo);
}

/** T-12 · pedir o link. O e-mail é aparado; o resultado não distingue conta existente de inexistente. */
export function pedirRedefinicaoDeSenha(
  credenciais: PortaDeCredenciais,
  email: string,
): Promise<ResultadoDeCredencial> {
  return credenciais.pedirRedefinicaoDeSenha(email.trim());
}

/** A aterrissagem do link de T-13 — o token vem da URL, e a Interface é quem o lê. */
export function iniciarRedefinicao(
  credenciais: PortaDeCredenciais,
  tokenHash: string,
): Promise<ResultadoDeCredencial> {
  return credenciais.iniciarRedefinicao(tokenHash.trim());
}

/** T-13 · gravar a senha nova. **A senha não é aparada** — aparar mudaria o segredo escolhido. */
export function definirSenha(
  credenciais: PortaDeCredenciais,
  senhaNova: string,
): Promise<ResultadoDeCredencial> {
  return credenciais.definirSenha(senhaNova);
}

export function sair(credenciais: PortaDeCredenciais): Promise<void> {
  return credenciais.sair();
}
