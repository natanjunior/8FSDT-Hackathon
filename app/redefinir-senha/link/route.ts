import { aterrissarRedefinicaoDeSenha } from "@/interface/http";

/**
 * `/redefinir-senha/link` — **o endereço que o e-mail de redefinição aponta**, e o único do produto que
 * carrega credencial na URL.
 *
 * Ele consome o `token_hash`, cria a sessão de recuperação no pote paralelo e redireciona para
 * `/definir-senha` — **sem token**. É o critério 4: consumido o token, voltar não reencontra o formulário.
 *
 * **Não é endpoint do contrato** (§4.1), então não existe no `openapi.yaml` e não deve existir. E não
 * precisa entrar em `additional_redirect_urls`: o link do e-mail aponta direto para cá, sem passar pelo
 * redirecionador do provedor.
 */
export const GET = aterrissarRedefinicaoDeSenha;

export const dynamic = "force-dynamic";
