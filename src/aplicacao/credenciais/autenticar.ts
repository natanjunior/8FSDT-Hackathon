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
): Promise<ResultadoDeCredencial> {
  return credenciais.criarConta(nome.trim(), email.trim(), senha);
}

/** T-01, estados 5 e 6: a aterrissagem do link de confirmação de conta. */
export function confirmarPorCodigo(
  credenciais: PortaDeCredenciais,
  codigo: string,
): Promise<ResultadoDeCredencial> {
  return credenciais.confirmarPorCodigo(codigo);
}

export function sair(credenciais: PortaDeCredenciais): Promise<void> {
  return credenciais.sair();
}
