import { lerConvite } from "@/aplicacao/organizacao";
import { FORMATO_DO_CODIGO } from "@/dominio/organizacao";
import { FormatoInvalido, semSessao } from "@/interface/http";
import { projetarConvite } from "@/interface/projecoes";

/**
 * **`GET /convites/{codigo}`** — o convite, com e sem sessão (item 86, ADR-0018).
 *
 * **A primeira operação do produto que não exige sessão.** O código é a credencial, pelo mesmo argumento
 * do `POST /pedidos-de-entrada`: ele já está no cartaz, e o que ele abre é o nome da organização e um
 * pedido que o Gestor decide. Sem sessão, o corpo tem o nome, o código e `situacao: "sem-sessao"`, e mais
 * nada (critério 86.2).
 *
 * **O formato é conferido aqui, e não no banco**: `400` para o que nunca poderia ser um código, `404`
 * para o código bem formado que não leva a lugar nenhum. A página desenha os dois do mesmo jeito.
 */
export const GET = semSessao(async ({ quem, convites, parametros }) => {
  const codigo = parametros.codigo ?? "";
  if (!FORMATO_DO_CODIGO.test(codigo)) {
    throw new FormatoInvalido([
      {
        campo: "codigo",
        codigo: "VALOR_INVALIDO",
        mensagem: "O código tem de 6 a 12 letras e números, sem espaços.",
      },
    ]);
  }
  return projetarConvite(await lerConvite({ convites }, quem, codigo));
});

/** Escala a zero e cookie de sessão: nada aqui é cacheável (RNF5). */
export const dynamic = "force-dynamic";
