import Link from "next/link";

import { ocorrenciaNaoEncontradaEm } from "@/interface/componentes/rotulos";

/**
 * **O `404` de ocorrência, desenhado pela própria tela** — critério 28.3, metade de T-05.
 *
 * A §7 do `inventario-de-telas.md` (`:1504`) especifica **três coisas**: a frase, **trocar de
 * organização** e o **`traceId`**. Duas estão aqui; a segunda passou para a barra superior da casca no
 * item 44b, de onde vale para toda tela de dentro. Mais uma quarta que o inventário dá de graça em toda
 * tela de erro deste produto — uma saída que não seja o botão *voltar* do navegador.
 *
 * **Ele morava dentro de `app/ocorrencias/[ocorrenciaId]/page.tsx` e saiu no item 41b, quando ganhou o
 * segundo consumidor** — T-06. É a regra que aquele mesmo arquivo já escreve sobre o `PAPEL_EM_PALAVRA`
 * (`:84-87`): *"se o segundo consumidor aparecer … o lugar dos dois é um módulo"*. **O corpo não mudou
 * uma linha.**
 *
 * **Nada além disso.** Um parágrafo explicando que *"ela pode ter sido registrada em outra organização"*
 * seria texto de produto sem critério escrito, e o nome da organização — na frase e na barra superior —
 * já diz o mesmo sem virar frase nova.
 *
 * **A moldura saiu no item 44b, e o menu de organização junto.** As duas telas que usam este bloco
 * passaram a viver dentro da casca, que já desenha a moldura e já mostra a organização ativa
 * permanentemente na barra superior — manter os dois aqui era moldura dentro de moldura e um segundo
 * seletor de organização a dois centímetros do primeiro. **As três coisas que a §7 do inventário
 * especifica continuam:** a frase, a organização em que se está, e o `traceId`. A segunda mudou de lugar,
 * não de existência.
 *
 * A frase continua sendo o `<h1>`, que é como o inventário a escreve.
 *
 * **O documento volta com `200`, e não com `404`** — está declarado. Nada no projeto depende disso: o
 * produto inteiro está atrás de sessão, não há rastreador, e o `404` que o contrato governa é o da
 * **API**, que continua sendo `404`.
 */
export function OcorrenciaNaoEncontradaNaTela({
  organizacaoAtiva,
  traceId,
}: {
  organizacaoAtiva: { nome: string } | null;
  traceId: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-titulo-pagina text-tinta">
        {ocorrenciaNaoEncontradaEm(organizacaoAtiva?.nome ?? null)}
      </h1>

      {/*
        **A lista inteira, sem recorte, e é decisão.** O filtro que trouxe até aqui pode ser de outra
        organização, e reconstruí-lo seria carregar um recorte que não vale mais. **A-3:** `min-h-11`.
      */}
      <Link
        href="/ocorrencias"
        className="border-linha text-tinta text-interface inline-flex min-h-11 w-full items-center justify-center rounded-md border px-4 font-medium"
      >
        Voltar à lista
      </Link>

      {/*
        **O `traceId` carrega a palavra (A-5) e é copiável.** Ele existe porque a §6.3 do contrato diz
        para que serve — *"liga à linha de log"* — e porque `registrarFalha` acabou de escrever essa linha.
      */}
      <p className="text-tinta-fraca text-meta">
        Código para suporte: <code className="select-all font-mono">{traceId}</code>
      </p>
    </div>
  );
}
