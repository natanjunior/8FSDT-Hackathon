import { FormularioDeRedefinicao } from "@/interface/componentes/formulario-de-redefinicao";
import { MolduraDeTela } from "@/interface/componentes/moldura-de-tela";

/**
 * **T-12 · Redefinir senha** — alcançada de T-01 e do erro de e-mail repetido em T-11.
 *
 * **Não redireciona quem tem sessão**, ao contrário de T-01 (decisão D-6b-5). O *"sem sessão"* do
 * inventário descreve quem chega aqui, não é guarda — e **esta continua sendo a única porta de trocar a
 * senha** que o produto tem. Desde o item 49 ela deixou de ser a única **alcançável**: **T-16 · Meus
 * dados** aponta para cá, na seção *Acesso*. A guarda fica, e a razão dela ficou melhor.
 *
 * Não chama endpoint deste contrato: chama a ação de credencial, que chama o provedor (§4.1).
 */
export default function TelaDeRedefinirSenha() {
  return (
    <MolduraDeTela titulo="Redefinir senha">
      <FormularioDeRedefinicao />
    </MolduraDeTela>
  );
}
