"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Aviso, Campo } from "@/interface/componentes/moldura-de-tela";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";

// Mesma mensagem nos dois desfechos sem `detail` utilizável: a resposta `4xx/5xx` sem corpo legível e a
// rejeição do próprio `fetch` (rede caiu, DNS falhou) — ver o `catch` abaixo.
const MENSAGEM_DE_ERRO_GENERICA = "Não foi possível criar a organização agora. Tente de novo em instantes.";

/**
 * **T-02 face A, o segundo caminho:** *"Você administra um condomínio, empresa ou bairro que ainda não usa
 * o Resolve Aí?"*
 *
 * **Um campo de texto, e o inventário diz por que não é uma tela:** *"Criar organização — face de T-02. É
 * um campo de texto. Um campo não é um lugar a visitar"* (§8). A hierarquia da face também é do
 * inventário: quem chega aqui quase sempre está **entrando**, não fundando — por isso este bloco fica
 * **abaixo** da linha divisória.
 */
export function FormularioDeNovaOrganizacao() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    // Lido **antes** do `await`: depois dele, `currentTarget` já é nulo.
    const nome = String(new FormData(evento.currentTarget).get("nome") ?? "").trim();
    if (nome === "") {
      setErro("Informe o nome da organização.");
      return;
    }

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

      if (!resposta.ok) {
        // O corpo de erro é `application/problem+json` (contrato §6.1), e `detail` é o texto para gente.
        const problema = (await resposta.json().catch(() => null)) as { detail?: string } | null;
        setErro(problema?.detail ?? MENSAGEM_DE_ERRO_GENERICA);
      } else {
        criada = true;
      }
    } catch {
      // `fetch` rejeitou antes de haver resposta — rede caiu, DNS falhou. Sem este `catch`, a exceção
      // sobe sem tratamento: o `finally` reabilita o botão, mas ninguém chama `setErro`, e a pessoa fica
      // sem mensagem nenhuma. RNF de cold start e nuvem sem SLA: rede instável é o caso esperado.
      setErro(MENSAGEM_DE_ERRO_GENERICA);
    } finally {
      setEnviando(false);
    }

    if (criada) {
      // O `Set-Cookie` do `201` já deixou a nova organização ativa. `refresh` refaz o `GET /contexto` do
      // shell **antes** de navegar — sem ele, a tela seguinte pintaria com o contexto anterior, em que
      // ainda não há organização, e voltaria para cá. Fora do `try`: uma falha síncrona aqui (o limite
      // que o navegador aplica à History API, por exemplo) não pode virar mensagem de erro de criação —
      // a organização já foi criada com sucesso.
      router.refresh();
      // *"Criar organização leva direto a T-03 com o estado vazio de organização nova"* — inventário,
      // T-02. Antes ia para `/`, que era o mapa; agora T-03 existe, e é lá que o convite a conferir as
      // áreas semeadas mora.
      router.push("/ocorrencias");
    }
  }

  return (
    <>
      {erro !== null && <Aviso>{erro}</Aviso>}

      <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
        <Campo
          id="nome-da-organizacao"
          rotulo="Nome da organização"
          ajuda="É o nome que aparece para todo mundo que entrar. Dá para corrigir depois, em Configuração."
        >
          <Input
            id="nome-da-organizacao"
            name="nome"
            type="text"
            maxLength={120}
            autoComplete="organization"
            disabled={enviando}
            className="h-12 text-base"
          />
        </Campo>

        <Button type="submit" variant="outline" disabled={enviando} className="h-12 w-full text-base">
          {enviando ? "Criando…" : "Criar uma organização"}
        </Button>
      </form>
    </>
  );
}
