import type { VinculoLido } from "@/aplicacao/organizacao";

/**
 * A projeção do schema `Vinculo` — o que a aprovação devolve.
 *
 * **`area` é a unidade da pessoa nesta organização**, e é `null` para o Gestor e o Encarregado
 * terceirizado. `organizacao_id`, `revogado_em` e os relógios de auditoria existem no esquema e **não
 * aparecem aqui** — não porque alguém se lembrou de omiti-los, mas porque este tipo não os tem.
 *
 * **`area` sai com `id` e `nome`, e não com `tipo`** — é o que o schema `Vinculo` do `openapi.yaml`
 * declara (`required: [id, nome]`, e nenhuma outra propriedade). O `tipo` existe em `VinculoLido`, do
 * lado de dentro, porque o repositório o lê para conferir a Área; publicá-lo aqui seria acrescentar à
 * resposta um campo que o contrato não tem — a mesma coisa que este item recusa fazer com `observacao`
 * em `/recusar` (achado A-8-2). Se o `tipo` fizer falta na tela do 9a, o caminho é emendar o contrato,
 * não a projeção.
 *
 * **Desde o item 9a ele serve três endpoints** — o `200` de `/aprovar`, o `201` de `POST /vinculos` e cada
 * item de `GET /vinculos` —, e é por isso que ele saiu de `pedido-de-entrada.ts`: a projeção do schema
 * `Vinculo` não é um detalhe do pedido.
 */
export type VinculoProjetado = {
  pessoa: {
    pessoaId: string;
    nome: string;
    contatos: ReadonlyArray<{
      id: string;
      tipo: string;
      valor: string;
      finalidade: string;
      temWhatsapp: boolean;
      ordem: number;
      observacao: string | null;
    }>;
  };
  papel: string;
  area: { id: string; nome: string } | null;
  temConta: boolean;
  criadoEm: string;
};

export function projetarVinculo(vinculo: VinculoLido): VinculoProjetado {
  return {
    pessoa: {
      pessoaId: vinculo.pessoa.pessoaId,
      nome: vinculo.pessoa.nome,
      // Sai na ordem em que veio, que é a de `ordem` — a cadeia de tentativa (modelo §6.17).
      contatos: vinculo.pessoa.contatos.map((contato) => ({ ...contato })),
    },
    papel: vinculo.papel,
    // `tipo` fica de fora: o schema `Vinculo` declara `id` e `nome`, e mais nada.
    area: vinculo.area === null ? null : { id: vinculo.area.id, nome: vinculo.area.nome },
    temConta: vinculo.temConta,
    criadoEm: vinculo.criadoEm,
  };
}
