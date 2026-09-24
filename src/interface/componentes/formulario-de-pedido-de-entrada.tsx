"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import { Aviso, Campo, IndicadorDeEnvio, RodapeDoFormulario } from "@/interface/componentes/campo";
import { EntradaDeCodigo } from "@/interface/componentes/campo-de-codigo";
import { erroDoCodigo } from "@/interface/componentes/regras-do-codigo";
import {
  avisarErro,
  avisarSucesso,
  MENSAGEM_GENERICA,
  mensagemDoProblema,
} from "@/interface/componentes/retorno-de-acao";
import { PREFIXO_BR, converterTelefoneDigitado } from "@/interface/componentes/telefone";
import { trocarOrganizacao } from "@/interface/componentes/troca-de-organizacao";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";
import { useFormularioTocado, type ErrosDeCampo } from "@/interface/ganchos/use-formulario-tocado";

/**
 * **T-02 · o caminho de entrar**, nas faces A, C e E. *"Onde eu trabalho?"* — e desde o item 44o ele é o
 * único formulário da face A: criar organização ganhou tela própria.
 *
 * **A tela produz os dois formatos que o servidor exige** (spec §2.4): o código em maiúscula, o telefone em
 * E.164. O servidor é estrito nos dois, e o `400` que ele devolve é o que aparece no campo. Desde o item 65
 * o código é digitado em oito casas, que já recusam o que está fora do alfabeto e já convertem a minúscula.
 *
 * **Onde cada erro aparece** (spec §2.3): `400` com `erros[]` vai **no campo** — a mesma regra que o item
 * 9b fixa para `CONTATO_DUPLICADO`; `404` e os dois `409` vão na **faixa**, porque não têm campo culpado.
 * O código e o telefone são conferidos também antes do envio, com a regra de formulário tocado do guia §7
 * (item 44g).
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

const TEXTO_DA_RECUSA: Readonly<Record<string, string>> = {
  CODIGO_PUBLICO_NAO_ENCONTRADO: "Nenhuma organização usa este código. Confira as letras e os números.",
  PEDIDO_DE_ENTRADA_PENDENTE: "Seu pedido já foi enviado e está aguardando a decisão de um Gestor.",
  JA_VINCULADO: "Você já está nesta organização.",
};

type ErroDeCampoDaApi = { campo: string; mensagem?: string };

const FALHA_DO_PEDIDO = "Não foi possível enviar o pedido";

function codigoDigitado(dados: FormData): string {
  return String(dados.get("codigo") ?? "").trim().toUpperCase();
}

/**
 * **O que a tela sabe conferir antes de enviar** (C-11 do plano do 44g): o formato do código, pelas oito
 * casas do sorteio (item 65), mais estrito que o `codigoPublico` do servidor, que aceita de 6 a 12; e o
 * telefone, pela mesma conversão que o envio usa. O nome não tem erro possível: é opcional, e o campo corta
 * em 120.
 */
function errosDoPedido(dados: FormData, primeiraEntrada: boolean): ErrosDeCampo {
  const telefone = primeiraEntrada
    ? converterTelefoneDigitado(String(dados.get("telefone") ?? ""))
    : null;
  return {
    codigo: erroDoCodigo(codigoDigitado(dados)),
    telefone: telefone?.situacao === "recusado" ? telefone.mensagem : undefined,
  };
}

function lerCodigo(problema: unknown): string {
  if (typeof problema !== "object" || problema === null) return "ERRO_INTERNO";
  const { codigo } = problema as { codigo?: unknown };
  return typeof codigo === "string" ? codigo : "ERRO_INTERNO";
}

/** `400` com `erros[]` vai **no campo** (spec do 7a, §2.3). `codigoPublico` é o campo `codigo` da tela. */
function lerErrosDeCampo(problema: unknown): Record<string, string> | null {
  if (typeof problema !== "object" || problema === null) return null;
  const { erros } = problema as { erros?: unknown };
  if (!Array.isArray(erros) || erros.length === 0) return null;

  const saida: Record<string, string> = {};
  for (const erro of erros as ErroDeCampoDaApi[]) {
    const campo = erro.campo === "codigoPublico" ? "codigo" : erro.campo;
    saida[campo] = erro.mensagem ?? "Confira este campo.";
  }
  return saida;
}

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
  const [falhaAoEntrar, setFalhaAoEntrar] = useState<string | null>(null);

  const formulario = useFormularioTocado({
    campos: primeiraEntrada ? { codigo: "codigo", nome: "nome", telefone: "telefone" } : { codigo: "codigo" },
    validar: (dados) => errosDoPedido(dados, primeiraEntrada),
  });

  const [estado, agir, aguardando] = useActionState(
    async (_anterior: EstadoDoPedido, dados: FormData): Promise<EstadoDoPedido> => {
      const codigo = codigoDigitado(dados);
      const nomeInformado = String(dados.get("nome") ?? "").trim();
      const telefoneDigitado = String(dados.get("telefone") ?? "").trim();
      setFalhaAoEntrar(null);

      /**
       * **O código é reconhecido antes de virar erro** (critério 7b.4, spec §2.6).
       *
       * O `problem+json` do `JA_VINCULADO` traz `title` e `detail` e **nenhuma identidade de organização**
       * (`openapi.yaml:311-312`), então a frase *"Você já está em
       * {nome}."* + **entrar nela** — não podia ser escrita com o que o servidor devolve. Com
       * `codigoPublico` em `vinculos[]` (item 7b, §3.7) ela pode: o cliente casa o que foi digitado com o
       * que ele já tem, **sem gastar uma ida ao servidor para receber um erro**.
       *
       * O `409` continua tratado abaixo, e volta a ser só o que é: corrida entre abas — alguém foi
       * aprovado entre o `GET /contexto` e o envio.
       */
      const jaVinculada = vinculos.find((v) => v.codigoPublico === codigo);
      if (jaVinculada !== undefined) {
        formulario.recomecar();
        return { reconhecido: { organizacaoId: jaVinculada.organizacaoId, nome: jaVinculada.nome } };
      }

      // A conferência do cliente já barrou o telefone malformado; este ramo fica como guarda do envio.
      const convertido = converterTelefoneDigitado(primeiraEntrada ? telefoneDigitado : "");
      if (convertido.situacao === "recusado") {
        formulario.recomecar();
        avisarErro(FALHA_DO_PEDIDO);
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
          const problema = (await resposta.json().catch(() => null)) as unknown;
          const erros = lerErrosDeCampo(problema);
          resultado =
            erros !== null
              ? { erros }
              : {
                  recusa: {
                    codigo: lerCodigo(problema),
                    // A frase que nós escrevemos para os três códigos conhecidos ganha do `detail`, que
                    // ganha da genérica (retorno-de-acao.ts).
                    detalhe: mensagemDoProblema(problema, TEXTO_DA_RECUSA),
                  },
                };
        }
      } catch {
        // `fetch` rejeitou antes de haver resposta — rede caiu, DNS falhou. Sem este `catch`, a rejeição
        // sobe sem tratamento pela transição do `useActionState`: risco de acionar o Error Boundary mais
        // próximo em vez de simplesmente mostrar `<Aviso>`. RNF de cold start e nuvem sem SLA: rede
        // instável é o caso esperado.
        resultado = { recusa: { codigo: "ERRO_INTERNO", detalhe: MENSAGEM_GENERICA } };
      }

      formulario.recomecar();

      if (enviado) {
        avisarSucesso("Pedido de entrada enviado");
        // O contexto refeito escolhe a face B — sem tela nova e sem texto novo (spec §2.7). Fora do
        // `try`: uma falha síncrona aqui não pode virar mensagem de erro de envio — o pedido já foi
        // enviado com sucesso.
        router.refresh();
      } else {
        avisarErro(FALHA_DO_PEDIDO);
      }

      return resultado;
    },
    {},
  );

  const podeRecarregar =
    estado.recusa?.codigo === "PEDIDO_DE_ENTRADA_PENDENTE" || estado.recusa?.codigo === "JA_VINCULADO";

  // **Um `const`, e não `estado.reconhecido!` dentro do `onClick`**: o estreitamento de
  // `estado.reconhecido !== undefined` não sobrevive ao fecho do callback, e a asserção `!` seria a
  // forma de calar o compilador em vez de responder a ele.
  const reconhecido = estado.reconhecido;

  /** O `PUT /contexto/organizacao` daquele `organizacaoId` — a mesma troca do menu, e o mesmo destino. */
  async function entrarNela(organizacaoId: string) {
    setFalhaAoEntrar(null);
    const resultado = await trocarOrganizacao(organizacaoId);
    if (!resultado.ok) {
      // **Até o item 44g esta falha era muda**: o botão não fazia nada, e a pessoa não sabia por quê.
      setFalhaAoEntrar(resultado.aviso);
      avisarErro("Não foi possível entrar na organização");
      return;
    }

    router.refresh();
    router.replace("/");
  }

  return (
    <>
      {reconhecido !== undefined && (
        // **Tom de nota:** reconhecer o código não é erro, é o caminho certo (spec do 44g, §4.5).
        <Aviso tom="nota">
          Você já está em{" "}
          <strong className="text-tinta font-semibold">{reconhecido.nome}</strong>.{" "}
          {/* O botão de texto que já existia continua nativo, e continua na contagem do G7 (spec §6). */}
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

      {falhaAoEntrar !== null && <Aviso>{falhaAoEntrar}</Aviso>}

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

      <form
        action={agir}
        onChange={formulario.aoMudarNoFormulario}
        onSubmit={formulario.aoEnviarFormulario}
        className="flex flex-col gap-5"
        noValidate
      >
        <Campo
          id="codigo"
          rotulo="Código da organização"
          obrigatorio
          ajuda="Está no cartaz do elevador ou na mensagem do grupo."
          erro={formulario.erroDe("codigo", estado.erros)}
        >
          {(controle) => (
            <EntradaDeCodigo
              controle={controle}
              name="codigo"
              erro={formulario.erroDe("codigo", estado.erros) !== undefined}
              ocupado={aguardando}
            />
          )}
        </Campo>

        {primeiraEntrada && (
          <>
            <Campo
              id="nome"
              rotulo="Seu nome"
              ajuda="É como você vai aparecer para os Gestores e no histórico das ocorrências."
              erro={formulario.erroDe("nome", estado.erros)}
            >
              {(controle) => (
                <Input
                  {...controle}
                  name="nome"
                  type="text"
                  maxLength={120}
                  defaultValue={nome}
                  className="border-linha bg-background min-h-11"
                />
              )}
            </Campo>

            <Campo
              id="telefone"
              rotulo="Telefone (opcional)"
              ajuda="Vai virar o seu primeiro contato na organização."
              erro={formulario.erroDe("telefone", estado.erros)}
            >
              {(controle) => (
                <Input
                  {...controle}
                  name="telefone"
                  type="tel"
                  inputMode="tel"
                  defaultValue={PREFIXO_BR}
                  className="border-linha bg-background min-h-11"
                />
              )}
            </Campo>
          </>
        )}

        {/* **A nota sai só onde todo campo é obrigatório** (critério 44o.11): na variante de outra
            organização sobra o código, e só ele. Na primeira entrada o telefone é opcional, e a nota fica. */}
        <RodapeDoFormulario obrigatorios={1} todosObrigatorios={!primeiraEntrada}>
          <Button type="submit" variant="marca" disabled={aguardando} className="text-interface min-h-11 px-4">
            <IndicadorDeEnvio ativo={aguardando} />
            {aguardando ? "Enviando…" : "Pedir entrada"}
          </Button>
        </RodapeDoFormulario>
      </form>
    </>
  );
}
