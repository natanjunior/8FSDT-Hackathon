import Link from "next/link";

import {
  MenuDeOrganizacao,
  type VinculoNoMenu,
} from "@/interface/componentes/menu-de-organizacao";
import { MolduraDeTela } from "@/interface/componentes/moldura-de-tela";
import { ocorrenciaNaoEncontradaEm } from "@/interface/componentes/rotulos";

/**
 * **O `404` de ocorrência, desenhado pela própria tela** — critério 28.3, metade de T-05.
 *
 * A §7 do `inventario-de-telas.md` (`:1504`) especifica **três coisas**, e o bloco tem exatamente três:
 * a frase, **trocar de organização** e o **`traceId`**. Mais uma quarta que o inventário dá de graça em
 * toda tela de erro deste produto — uma saída que não seja o botão *voltar* do navegador.
 *
 * **Ele morava dentro de `app/ocorrencias/[ocorrenciaId]/page.tsx` e saiu no item 41b, quando ganhou o
 * segundo consumidor** — T-06. É a regra que aquele mesmo arquivo já escreve sobre o `PAPEL_EM_PALAVRA`
 * (`:84-87`): *"se o segundo consumidor aparecer … o lugar dos dois é um módulo"*. **O corpo não mudou
 * uma linha.**
 *
 * **Nada além disso.** Um parágrafo explicando que *"ela pode ter sido registrada em outra organização"*
 * seria texto de produto sem critério escrito, e o rótulo *"Você está em"* acima do menu já diz o mesmo
 * sem virar frase nova.
 *
 * **A `MolduraDeTela` é a mesma do caminho feliz**, e a frase é o `titulo` — isto é, o `<h1>`, que é como
 * o inventário a escreve. Zero componente novo.
 *
 * **O menu só aparece havendo organização ativa**, como em T-03: ele exige `id` e `nome` não-nulos, e
 * resolve sozinho o caso de **não haver outra** organização — mostra a atual e *"Entrar em outra
 * organização"* (`menu-de-organizacao.tsx:76-102`).
 *
 * **O documento volta com `200`, e não com `404`** — está declarado. Nada no projeto depende disso: o
 * produto inteiro está atrás de sessão, não há rastreador, e o `404` que o contrato governa é o da
 * **API**, que continua sendo `404`.
 */
export function OcorrenciaNaoEncontradaNaTela({
  organizacaoAtiva,
  vinculos,
  traceId,
}: {
  organizacaoAtiva: { id: string; nome: string } | null;
  vinculos: readonly VinculoNoMenu[];
  traceId: string;
}) {
  return (
    <MolduraDeTela titulo={ocorrenciaNaoEncontradaEm(organizacaoAtiva?.nome ?? null)}>
      {organizacaoAtiva !== null && (
        <div className="border-linha bg-superficie flex flex-col gap-1 rounded-md border px-4 py-3">
          <span className="text-tinta-fraca text-xs tracking-wide uppercase">Você está em</span>
          <MenuDeOrganizacao
            vinculos={vinculos}
            organizacaoAtivaId={organizacaoAtiva.id}
            nomeDaOrganizacaoAtiva={organizacaoAtiva.nome}
          />
        </div>
      )}

      {/*
        **Sem o `?de=`, e é decisão.** O filtro que trouxe até aqui pode ser de outra organização, e
        reconstruí-lo seria carregar um recorte que não vale mais. **A-3:** `min-h-11`.
      */}
      <Link
        href="/ocorrencias"
        className="border-linha text-tinta inline-flex min-h-11 w-full items-center justify-center rounded-md border px-4 text-sm font-medium"
      >
        Voltar à lista
      </Link>

      {/*
        **O `traceId` carrega a palavra (A-5) e é copiável.** Ele existe porque a §6.3 do contrato diz
        para que serve — *"liga à linha de log"* — e porque `registrarFalha` acabou de escrever essa linha.
      */}
      <p className="text-tinta-fraca text-xs">
        Código para suporte: <code className="select-all">{traceId}</code>
      </p>
    </MolduraDeTela>
  );
}
