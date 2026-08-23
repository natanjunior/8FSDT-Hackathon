import type {
  PedidoDaPessoa,
  PedidoDeEntradaLido,
  PedidoDeEntradaRegistrado,
  VinculoCriado,
} from "@/aplicacao/organizacao";

/**
 * A projeção do schema `PedidoDeEntrada` do `openapi.yaml`.
 *
 * **Uma só, para os dois consumidores**: o `201` de `POST /pedidos-de-entrada` e o `pedidosDeEntrada[]` de
 * `GET /contexto`. Duas projeções do mesmo schema divergiriam na primeira alteração.
 *
 * **Só o nome da organização.** O código é público, mas isso não autoriza ler quem está lá dentro
 * (contrato §8.2) — e `PedidoDeEntradaDetalhe`, que é como o **Gestor** vê o pedido, é outro schema e é do
 * item 8.
 */
export type PedidoDeEntradaProjetado = {
  id: string;
  organizacao: { nome: string };
  situacao: string;
  criadoEm: string;
};

export function projetarPedidoDeEntrada(
  pedido: PedidoDaPessoa | PedidoDeEntradaRegistrado,
): PedidoDeEntradaProjetado {
  return {
    id: pedido.id,
    organizacao: { nome: pedido.organizacao.nome },
    situacao: pedido.situacao,
    criadoEm: pedido.criadoEm,
  };
}

/**
 * A projeção do schema `PedidoDeEntradaDetalhe` — **como o Gestor vê o pedido**.
 *
 * **`pessoa` é `PessoaDoPedido`, não `PessoaComContato`**, e a diferença é de privacidade: `contatos` é
 * tabela global, e devolvê-la aqui mostraria ao Gestor desta organização os contatos que a pessoa
 * cadastrou em **outra**. O pedido carrega só o telefone que ela informou nele — um valor, não uma lista.
 *
 * **`observacao` não aparece**, porque o schema do contrato não a declara (achado A-8-2).
 */
export type PedidoDeEntradaDetalheProjetado = {
  id: string;
  pessoa: { pessoaId: string; nome: string; telefoneInformado: string | null };
  situacao: string;
  criadoEm: string;
  decididoEm: string | null;
  decididoPor: { pessoaId: string; nome: string } | null;
};

export function projetarPedidoDeEntradaDetalhe(
  pedido: PedidoDeEntradaLido,
): PedidoDeEntradaDetalheProjetado {
  return {
    id: pedido.id,
    pessoa: {
      pessoaId: pedido.pessoa.pessoaId,
      nome: pedido.pessoa.nome,
      telefoneInformado: pedido.pessoa.telefoneInformado,
    },
    situacao: pedido.situacao,
    criadoEm: pedido.criadoEm,
    decididoEm: pedido.decididoEm,
    decididoPor: pedido.decididoPor,
  };
}

/**
 * A projeção do schema `Vinculo` — o que a aprovação devolve.
 *
 * **`area` é a unidade da pessoa nesta organização**, e é `null` para o Gestor e o Encarregado
 * terceirizado. `organizacao_id`, `revogado_em` e os relógios de auditoria existem no esquema e **não
 * aparecem aqui** — não porque alguém se lembrou de omiti-los, mas porque este tipo não os tem.
 *
 * **`area` sai com `id` e `nome`, e não com `tipo`** — é o que o schema `Vinculo` do `openapi.yaml`
 * declara (`required: [id, nome]`, e nenhuma outra propriedade). O `tipo` existe em `VinculoCriado`, do
 * lado de dentro, porque o repositório o lê para conferir a Área; publicá-lo aqui seria acrescentar à
 * resposta um campo que o contrato não tem — a mesma coisa que este item recusa fazer com `observacao`
 * em `/recusar` (achado A-8-2). Se o `tipo` fizer falta na tela do 9a, o caminho é emendar o contrato,
 * não a projeção.
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

export function projetarVinculo(vinculo: VinculoCriado): VinculoProjetado {
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
