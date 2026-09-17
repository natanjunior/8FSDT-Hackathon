"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";

import { PREFIXO_BR, converterTelefoneDigitado } from "@/interface/componentes/telefone";
import { Campo } from "@/interface/componentes/campo";
import { Aviso } from "@/interface/componentes/moldura-de-tela";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";
import { trocarOrganizacao } from "@/interface/componentes/troca-de-organizacao";

/**
 * **T-02 face A · o caminho de entrar.** *"Onde eu trabalho?"* — e quem chega aqui quase sempre está
 * entrando, não fundando.
 *
 * **A tela produz os dois formatos que o servidor exige** (spec §2.4): o código em maiúscula, o telefone em
 * E.164. O servidor é estrito nos dois, e o `400` que ele devolve é o que aparece no campo.
 *
 * **Onde cada erro aparece** (spec §2.3): `400` com `erros[]` vai **no campo** — a mesma regra que o item
 * 9b fixa para `CONTATO_DUPLICADO`; `404` e os dois `409` vão na **faixa**, porque não têm campo culpado.
 *
 * **Os dois `409` são desfechos de estado velho, e a ação dos dois é recarregar** (spec §2.5): com pedido
 * pendente a tela passa a mostrar a face B; com vínculo, o contexto ativa a organização e o shell manda
 * para `/`. É o que dispensa o nome da organização, que a resposta não carrega, e o botão *"entrar nela"*,
 * que é o item 7b.
 */

/** Um vínculo que a Pessoa já tem — o insumo do reconhecimento do código (item 7b, §2.6). */
export type VinculoConhecido = {
  organizacaoId: string;
  nome: string;
  codigoPublico: string;
};

type EstadoDoPedido = {
  erros?: Record<string, string>;
  recusa?: { codigo: string; detalhe: string };
  /** O código digitado casou com um vínculo que já existe: a tela oferece **entrar nela** (critério 7b.4). */
  reconhecido?: { organizacaoId: string; nome: string };
};

type ProblemaDaApi = {
  codigo?: string;
  detail?: string;
  erros?: Array<{ campo: string; mensagem?: string }>;
};

const TEXTO_DA_RECUSA: Readonly<Record<string, string>> = {
  CODIGO_PUBLICO_NAO_ENCONTRADO: "Nenhuma organização usa este código. Confira as letras e os números.",
  PEDIDO_DE_ENTRADA_PENDENTE: "Seu pedido já foi enviado e está aguardando a decisão de um Gestor.",
  JA_VINCULADO: "Você já está nesta organização.",
};

// Mesma mensagem nos dois desfechos sem detalhe utilizável: a resposta de erro sem código conhecido e a
// rejeição do próprio `fetch` (rede caiu, DNS falhou) — ver o `catch` abaixo.
const MENSAGEM_DE_RECUSA_GENERICA = "Não foi possível enviar o pedido agora. Tente de novo.";

export function FormularioDePedidoDeEntrada({
  nome,
  variante = "primeira-entrada",
  vinculos = [],
}: {
  /** Pré-preenche o campo `nome`. **Só existe na variante `primeira-entrada`** — na outra o campo não é
   *  renderizado, porque a razão dele não existe (spec §2.5) e a Aplicação o ignora (critério 7b.8). */
  nome?: string;
  variante?: "primeira-entrada" | "outra-organizacao";
  /** Os vínculos que a Pessoa já tem. Vazio na primeira entrada, por construção. */
  vinculos?: readonly VinculoConhecido[];
}) {
  const router = useRouter();
  const primeiraEntrada = variante === "primeira-entrada";

  const [estado, agir, aguardando] = useActionState(
    async (_anterior: EstadoDoPedido, dados: FormData): Promise<EstadoDoPedido> => {
      const codigo = String(dados.get("codigo") ?? "").trim().toUpperCase();
      const nomeInformado = String(dados.get("nome") ?? "").trim();
      const telefoneDigitado = String(dados.get("telefone") ?? "").trim();

      /**
       * **O código é reconhecido antes de virar erro** (critério 7b.4, spec §2.6).
       *
       * O `problem+json` do `JA_VINCULADO` traz `title` e `detail` e **nenhuma identidade de organização**
       * (`openapi.yaml:311-312`), então a frase do `inventario-de-telas.md:1513` — *"Você já está em
       * {nome}."* + **entrar nela** — não podia ser escrita com o que o servidor devolve. Com
       * `codigoPublico` em `vinculos[]` (item 7b, §3.7) ela pode: o cliente casa o que foi digitado com o
       * que ele já tem, **sem gastar uma ida ao servidor para receber um erro**.
       *
       * O `409` continua tratado abaixo, e volta a ser só o que é: corrida entre abas — alguém foi
       * aprovado entre o `GET /contexto` e o envio.
       */
      const jaVinculada = vinculos.find((v) => v.codigoPublico === codigo);
      if (jaVinculada !== undefined) {
        return { reconhecido: { organizacaoId: jaVinculada.organizacaoId, nome: jaVinculada.nome } };
      }

      // A conversão acontece aqui, e o campo é o único lugar onde ela pode falhar de forma explicável:
      // quem digitou nove dígitos merece a frase, não um `400` genérico do servidor. Não é rede, então
      // fica fora do `try` abaixo. **A regra saiu para `componentes/telefone.ts` em 24/08/2026**, para
      // T-08 usar a mesma — ver a decisão 2.2 da spec do 9b. **Na variante `outra-organizacao` não há
      // campo de telefone**, então não há o que converter.
      const convertido = converterTelefoneDigitado(primeiraEntrada ? telefoneDigitado : "");
      if (convertido.situacao === "recusado") {
        return { erros: { telefone: convertido.mensagem } };
      }
      const telefone = convertido.situacao === "convertido" ? convertido.valor : undefined;

      // `enviado` separa o que o `catch` deve cobrir (a chamada de rede e a leitura da resposta) do que
      // vem depois (a navegação). Se `router.refresh` lançasse **dentro** do `try`, o `catch` devolveria a
      // recusa genérica depois de o pedido já ter sido enviado — engano ativo, não erro neutro. Mesmo
      // padrão de `formulario-de-nova-organizacao.tsx` (`let criada = false`).
      let enviado = false;
      let resultado: EstadoDoPedido = {};

      try {
        const resposta = await fetch("/api/pedidos-de-entrada", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            primeiraEntrada
              ? {
                  codigoPublico: codigo,
                  ...(nomeInformado === "" ? {} : { nome: nomeInformado }),
                  ...(telefone === undefined ? {} : { telefone }),
                }
              : // **Só o código** (spec §2.5): o `nome` porque corrigi-lo aqui renomearia a Pessoa dentro
                // da organização em que ela já está — e a trilha de lá é imutável; o `telefone` porque quem
                // tem vínculo já tem o caminho do item 9b em T-08, e `contatos` recusaria o repetido.
                { codigoPublico: codigo },
          ),
        });

        if (resposta.ok) {
          enviado = true;
        } else {
          const problema = (await resposta.json().catch(() => ({}))) as ProblemaDaApi;

          if (problema.erros !== undefined && problema.erros.length > 0) {
            const erros: Record<string, string> = {};
            for (const erro of problema.erros) {
              const campo = erro.campo === "codigoPublico" ? "codigo" : erro.campo;
              erros[campo] = erro.mensagem ?? "Confira este campo.";
            }
            resultado = { erros };
          } else {
            const codigoDaRecusa = problema.codigo ?? "ERRO_INTERNO";
            resultado = {
              recusa: {
                codigo: codigoDaRecusa,
                // O texto que nós escrevemos para os três códigos conhecidos ganha do `detail` do
                // servidor, porque é redigido para a tela; o `detail` só entra quando não temos texto
                // próprio (contrato §6.1, mesma leitura de `formulario-de-nova-organizacao.tsx`); o
                // genérico é o último recurso.
                detalhe: TEXTO_DA_RECUSA[codigoDaRecusa] ?? problema.detail ?? MENSAGEM_DE_RECUSA_GENERICA,
              },
            };
          }
        }
      } catch {
        // `fetch` rejeitou antes de haver resposta — rede caiu, DNS falhou. Sem este `catch`, a rejeição
        // sobe sem tratamento pela transição do `useActionState`: risco de acionar o Error Boundary mais
        // próximo em vez de simplesmente mostrar `<Aviso>`. RNF de cold start e nuvem sem SLA: rede
        // instável é o caso esperado.
        resultado = { recusa: { codigo: "ERRO_INTERNO", detalhe: MENSAGEM_DE_RECUSA_GENERICA } };
      }

      if (enviado) {
        // O contexto refeito escolhe a face B — sem tela nova e sem texto novo (spec §2.7). Fora do
        // `try`: uma falha síncrona aqui não pode virar mensagem de erro de envio — o pedido já foi
        // enviado com sucesso.
        router.refresh();
      }

      return resultado;
    },
    {},
  );

  const podeRecarregar =
    estado.recusa?.codigo === "PEDIDO_DE_ENTRADA_PENDENTE" ||
    estado.recusa?.codigo === "JA_VINCULADO";

  // **Um `const`, e não `estado.reconhecido!` dentro do `onClick`**: o estreitamento de
  // `estado.reconhecido !== undefined` não sobrevive ao fecho do callback, e a asserção `!` seria a
  // forma de calar o compilador em vez de responder a ele.
  const reconhecido = estado.reconhecido;

  /** O `PUT /contexto/organizacao` daquele `organizacaoId` — a mesma troca do menu, e o mesmo destino. */
  async function entrarNela(organizacaoId: string) {
    const resultado = await trocarOrganizacao(organizacaoId);
    if (!resultado.ok) return;

    router.refresh();
    router.replace("/");
  }

  return (
    <>
      {reconhecido !== undefined && (
        <Aviso>
          Você já está em{" "}
          <strong className="text-tinta font-semibold">{reconhecido.nome}</strong>.{" "}
          <button
            type="button"
            disabled={aguardando}
            onClick={() => {
              void entrarNela(reconhecido.organizacaoId);
            }}
            className="text-marca underline underline-offset-4"
          >
            Entrar nela
          </button>
        </Aviso>
      )}

      {estado.recusa !== undefined && (
        <Aviso>
          {estado.recusa.detalhe}
          {podeRecarregar && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => router.refresh()}
                className="text-marca underline underline-offset-4"
              >
                Atualizar esta tela
              </button>
            </>
          )}
        </Aviso>
      )}

      <form action={agir} className="flex flex-col gap-5" noValidate>
        <Campo
          id="codigo"
          rotulo="Código da organização"
          ajuda="Está no cartaz do elevador ou na mensagem do grupo. Seis a doze letras e números."
          erro={estado.erros?.["codigo"]}
        >
          <Input
            id="codigo"
            name="codigo"
            type="text"
            maxLength={12}
            autoComplete="off"
            autoCapitalize="characters"
            required
            aria-invalid={estado.erros?.["codigo"] !== undefined}
            className="h-12 text-base tracking-[0.12em] uppercase"
          />
        </Campo>

        {primeiraEntrada && (
          <>
            <Campo
              id="nome"
              rotulo="Seu nome"
              ajuda={
                <>
                  É como você vai aparecer para os Gestores e no histórico das ocorrências.{" "}
                  <strong className="text-tinta font-semibold">Depois daqui não há como mudar.</strong>
                </>
              }
              erro={estado.erros?.["nome"]}
            >
              <Input
                id="nome"
                name="nome"
                type="text"
                maxLength={120}
                defaultValue={nome}
                aria-invalid={estado.erros?.["nome"] !== undefined}
                className="h-12 text-base"
              />
            </Campo>

            <Campo
              id="telefone"
              rotulo="Telefone (opcional)"
              ajuda="Vai virar o seu primeiro contato na organização."
              erro={estado.erros?.["telefone"]}
            >
              <Input
                id="telefone"
                name="telefone"
                type="tel"
                inputMode="tel"
                defaultValue={PREFIXO_BR}
                aria-invalid={estado.erros?.["telefone"] !== undefined}
                className="h-12 text-base"
              />
            </Campo>
          </>
        )}

        <Button type="submit" disabled={aguardando} className="h-12 w-full text-base">
          {aguardando ? "Enviando…" : "Pedir entrada"}
        </Button>
      </form>
    </>
  );
}
