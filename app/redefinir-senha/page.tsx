import { FormularioDeRedefinicao } from "@/interface/componentes/formulario-de-redefinicao";
import { MolduraDeTela } from "@/interface/componentes/moldura-de-tela";

/**
 * **T-12 · Redefinir senha** — alcançada de T-01 e do erro de e-mail repetido em T-11.
 *
 * **Não redireciona quem tem sessão**, ao contrário de T-01 (decisão D-6b-5). O *"sem sessão"* do
 * inventário descreve quem chega aqui, não é guarda — e como a Q-T6 fechou que não existe tela de perfil,
 * **esta é a única porta de trocar a senha** que o produto tem. Fechá-la deixaria quem está dentro sem
 * nenhuma, e nada na interface diria isso.
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
