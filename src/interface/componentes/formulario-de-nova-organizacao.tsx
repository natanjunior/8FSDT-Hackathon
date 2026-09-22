"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Aviso, Campo, IndicadorDeEnvio, RodapeDoFormulario } from "@/interface/componentes/campo";
import {
  avisarErro,
  avisarSucesso,
  MENSAGEM_GENERICA,
  mensagemDoProblema,
} from "@/interface/componentes/retorno-de-acao";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";
import { useFormularioTocado } from "@/interface/ganchos/use-formulario-tocado";
import { criacaoDeOrganizacaoSchema, errosDoSchema } from "@/interface/schemas";

const FALHA_DA_CRIACAO = "Não foi possível criar a organização";

/**
 * **A tela de criar organização** — `/organizacao/criar`, alcançada pelo caminho abaixo do cartão da face
 * A de T-02: *"Administra um condomínio, empresa ou bairro que ainda não usa o Resolve Aí?"*
 *
 * **Até 20/09/2026 isto era um campo dentro da face A**, e a decisão se defendia dizendo que um campo não
 * é um lugar a visitar. **O dono a reverteu naquele dia** (critério 44o.4), pela razão que a própria tela
 * mostrava: o que estava ali não era um campo, eram **dois formulários concorrendo** — o do código, com
 * três campos, e este. Entrar e criar viraram duas telas, e este componente passou a ser o único
 * conteúdo da segunda.
 *
 * **O botão é o principal da tela** (guia §2), e deixou de ser contorno: era o segundo caminho de uma
 * tela com dois, e agora é o único.
 *
 * **O nome vazio é erro de campo, e não linha de aviso** (guia §7, item 44g): aparece embaixo do campo,
 * depois da primeira interação, pelo mesmo schema que a rota usa. **Sem a nota "campo obrigatório"**
 * (critério 44o.11): o formulário tem um campo só, e ele é obrigatório.
 */
export function FormularioDeNovaOrganizacao() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const formulario = useFormularioTocado({
    campos: { nome: "nome-da-organizacao" },
    validar: (dados) => errosDoSchema(criacaoDeOrganizacaoSchema, { nome: dados.get("nome") }),
  });

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando || !formulario.aoEnviarFormulario(evento)) return;

    // Lido **antes** do `await`: depois dele, `currentTarget` já é nulo.
    const nome = String(new FormData(evento.currentTarget).get("nome") ?? "").trim();

    setErro(null);
    setEnviando(true);

    // `criada` separa o que o `catch` deve cobrir (a chamada de rede e a leitura da resposta) do que
    // vem depois (a navegação). Se a navegação lançasse **dentro** do `try`, o `catch` mostraria a
    // mensagem de erro genérica depois de a organização já ter sido criada — engano ativo, não erro
    // neutro. Por isso `router.refresh`/`router.push` ficam fora do `try`, condicionados a este flag.
    let criada = false;
    try {
      const resposta = await fetch("/api/organizacoes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nome }),
      });

      if (resposta.ok) {
        criada = true;
      } else {
        setErro(mensagemDoProblema(await resposta.json().catch(() => null)));
        avisarErro(FALHA_DA_CRIACAO);
      }
    } catch {
      // `fetch` rejeitou antes de haver resposta — rede caiu, DNS falhou. Sem este `catch`, a exceção
      // sobe sem tratamento: o `finally` reabilita o botão, mas ninguém chama `setErro`, e a pessoa fica
      // sem mensagem nenhuma. RNF de cold start e nuvem sem SLA: rede instável é o caso esperado.
      setErro(MENSAGEM_GENERICA);
      avisarErro(FALHA_DA_CRIACAO);
    } finally {
      setEnviando(false);
    }

    if (criada) {
      avisarSucesso("Organização criada");
      // O `Set-Cookie` do `201` já deixou a nova organização ativa. `refresh` refaz o `GET /contexto` do
      // shell **antes** de navegar — sem ele, a tela seguinte pintaria com o contexto anterior, em que
      // ainda não há organização, e voltaria para cá. Fora do `try`: uma falha síncrona aqui (o limite
      // que o navegador aplica à History API, por exemplo) não pode virar mensagem de erro de criação —
      // a organização já foi criada com sucesso.
      router.refresh();
      // Leva direto à lista de ocorrências, no estado vazio de organização nova — o critério 44o.4 manda
      // que isso não mude. É lá que o convite a conferir as áreas semeadas mora.
      router.push("/ocorrencias");
    }
  }

  return (
    <>
      {erro !== null && <Aviso>{erro}</Aviso>}

      <form
        onChange={formulario.aoMudarNoFormulario}
        onSubmit={(evento) => void enviar(evento)}
        className="flex flex-col gap-5"
        noValidate
      >
        <Campo
          id="nome-da-organizacao"
          rotulo="Nome da organização"
          obrigatorio
          ajuda="É o nome que aparece para todo mundo que entrar. Dá para corrigir depois, em Configuração."
          erro={formulario.erroDe("nome")}
        >
          {(controle) => (
            <Input
              {...controle}
              name="nome"
              type="text"
              maxLength={120}
              autoComplete="organization"
              required
              disabled={enviando}
              className="border-linha bg-background min-h-11"
            />
          )}
        </Campo>

        <RodapeDoFormulario obrigatorios={1} todosObrigatorios>
          <Button type="submit" variant="marca" disabled={enviando} className="text-interface min-h-11 px-4">
            <IndicadorDeEnvio ativo={enviando} />
            {enviando ? "Criando…" : "Criar uma organização"}
          </Button>
        </RodapeDoFormulario>
      </form>
    </>
  );
}
