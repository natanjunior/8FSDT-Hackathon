"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";

import { paraE164Brasileiro } from "@/dominio/pessoa";
import { Aviso, Campo } from "@/interface/componentes/moldura-de-tela";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";

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

type EstadoDoPedido = {
  erros?: Record<string, string>;
  recusa?: { codigo: string; detalhe: string };
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

export function FormularioDePedidoDeEntrada({ nome }: { nome: string }) {
  const router = useRouter();

  const [estado, agir, aguardando] = useActionState(
    async (_anterior: EstadoDoPedido, dados: FormData): Promise<EstadoDoPedido> => {
      const codigo = String(dados.get("codigo") ?? "").trim().toUpperCase();
      const nomeInformado = String(dados.get("nome") ?? "").trim();
      const telefoneDigitado = String(dados.get("telefone") ?? "").trim();

      // A conversão acontece aqui, e o campo é o único lugar onde ela pode falhar de forma explicável:
      // quem digitou nove dígitos merece a frase, não um `400` genérico do servidor.
      let telefone: string | undefined;
      if (telefoneDigitado !== "" && telefoneDigitado !== "+55") {
        const convertido = paraE164Brasileiro(telefoneDigitado);
        if (convertido === null) {
          return { erros: { telefone: "Informe um telefone com DDD, como (11) 99999-0000." } };
        }
        telefone = convertido;
      }

      const resposta = await fetch("/api/pedidos-de-entrada", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          codigoPublico: codigo,
          ...(nomeInformado === "" ? {} : { nome: nomeInformado }),
          ...(telefone === undefined ? {} : { telefone }),
        }),
      });

      if (resposta.ok) {
        // O contexto refeito escolhe a face B — sem tela nova e sem texto novo (spec §2.7).
        router.refresh();
        return {};
      }

      const problema = (await resposta.json().catch(() => ({}))) as ProblemaDaApi;

      if (problema.erros !== undefined && problema.erros.length > 0) {
        const erros: Record<string, string> = {};
        for (const erro of problema.erros) {
          const campo = erro.campo === "codigoPublico" ? "codigo" : erro.campo;
          erros[campo] = erro.mensagem ?? "Confira este campo.";
        }
        return { erros };
      }

      const codigoDaRecusa = problema.codigo ?? "ERRO_INTERNO";
      return {
        recusa: {
          codigo: codigoDaRecusa,
          detalhe:
            TEXTO_DA_RECUSA[codigoDaRecusa] ??
            "Não foi possível enviar o pedido agora. Tente de novo.",
        },
      };
    },
    {},
  );

  const podeRecarregar =
    estado.recusa?.codigo === "PEDIDO_DE_ENTRADA_PENDENTE" ||
    estado.recusa?.codigo === "JA_VINCULADO";

  return (
    <>
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
            defaultValue="+55 "
            aria-invalid={estado.erros?.["telefone"] !== undefined}
            className="h-12 text-base"
          />
        </Campo>

        <Button type="submit" disabled={aguardando} className="h-12 w-full text-base">
          {aguardando ? "Enviando…" : "Pedir entrada"}
        </Button>
      </form>
    </>
  );
}
