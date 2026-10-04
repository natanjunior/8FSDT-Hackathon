/**
 * O token do convite pessoal: 32 bytes em base64url (item 121). Fora disto, o convite não vale.
 *
 * **Mora em `schemas`, e não em `http`,** porque o schema de criar conta precisa dele e o formulário de
 * cadastro, que é componente de cliente, importa `@/interface/schemas`. `http` o reexporta para as rotas.
 */
export const FORMATO_DO_TOKEN = /^[A-Za-z0-9_-]{43}$/u;
