"use client";

import { useRouter } from "next/navigation";
import { Suspense, use, useId, useState } from "react";

import {
  enviarComentario,
  type ComentarioDoEnvio,
} from "@/interface/componentes/comando-de-ocorrencia";
import { autoria, dataHora } from "@/interface/componentes/linha-do-tempo";
import { Button } from "@/interface/componentes/ui/button";
import type { PaginaDeComentariosProjetada } from "@/interface/projecoes";

/**
 * ============================================================================
 *  O bloco 4 de T-05 — a conversa, e é o último dos quatro blocos a existir
 * ============================================================================
 *
 * **O campo fica FORA do `<Suspense>`, e o *Carregar mais* fica dentro.** O campo de escrever não depende
 * da lista: sob cold start (RNF5), quem abre a tela para responder pode começar a digitar enquanto as
 * mensagens chegam. **O protótipo desenha o estado de carregamento sem o campo**, e esta é a única
 * divergência declarada da fatia — aquele quadro mostra o que está *carregando*, e o campo não carrega
 * nada.
 *
 * **É por isso que o componente é de cliente e o `<Suspense>` mora DENTRO dele:** o campo e a lista
 * precisam do mesmo estado — a mensagem recém-enviada é acrescentada localmente —, e um `<Suspense>` no
 * servidor envolvendo os dois arrastaria o campo para dentro da espera. Quem espera a promessa é o filho,
 * com `use()`; quem guarda o que foi escrito é o pai.
 *
 * **Depois de enviar, duas coisas acontecem, cada uma por uma razão:**
 * - **Acrescentar localmente** é o que faz a mensagem aparecer. `router.refresh()` sozinho **não
 *   bastaria**, e o motivo é a ordem: a primeira página é a **mais antiga**, então numa conversa de 25
 *   mensagens o repinte devolveria as vinte primeiras e a recém-escrita não estaria entre elas.
 * - **`router.refresh()`** repinta o **bloco 3**, onde a mensagem também aparece — critério **30.8**. Sem
 *   os critérios 30.7/30.8 ele seria repintar a tela inteira para não mudar nada nela, que é custo sem
 *   efeito, e este produto já recusou isso uma vez por escrito. Com os dois, o efeito existe e é visível.
 * - O repinte **não remonta** este componente, então o que foi acrescentado localmente não é duplicado
 *   nem perdido — é o mesmo mecanismo que o `CampoDeSolucaoAplicada` documenta.
 *
 * **Acessibilidade:** `<label htmlFor>` de verdade (**A-1**) — o protótipo o desenha, e `placeholder`
 * **não** é rótulo —, `min-h-11` no campo e `h-11` nos botões (**A-3**), e o erro em **palavra**, com
 * `role="alert"` (**A-5**). O DOM é linear, então a ordem de foco é a de leitura (A-2).
 */
export function ConversaDaOcorrencia({
  ocorrenciaId,
  primeiraPagina,
  organizacaoId,
  pessoaIdDeQuemLe,
  vazio,
  rotuloDoCampo,
}: {
  ocorrenciaId: string;
  /** A promessa da estrada direta. **Ela parte antes do `await` do detalhe** — critério 29.5. */
  primeiraPagina: Promise<PaginaDeComentariosProjetada>;
  /** A organização com que a página renderizou — a afirmação da §4.3 (item 7b). */
  organizacaoId: string;
  /** Para o *"Você"* da autoria. Comparação de `pessoaId`, nunca papel. */
  pessoaIdDeQuemLe: string;
  /** A frase do vazio, escolhida por AUTORIA no servidor. O navegador não monta rótulo. */
  vazio: string;
  /** O rótulo do campo, mesmo predicado. */
  rotuloDoCampo: string;
}) {
  const router = useRouter();
  const campoId = useId();
  const [acrescentadas, setAcrescentadas] = useState<readonly ComentarioDoEnvio[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  /**
   * **Vazio desabilita porque o schema o proíbe** (`minLength: 1`): habilitar produziria um `400` sobre um
   * campo que a pessoa vê vazio. **Enviando desabilita porque é o único freio possível contra o toque
   * duplo** — e o critério 30.3 e a §7.10 do contrato declaram que **dois toques criam dois comentários**,
   * sem chave de idempotência. **O freio é da tela e não promete nada:** dois aparelhos, ou um `curl`,
   * continuam criando dois.
   */
  const podeEnviar = !enviando && texto.trim() !== "";

  async function enviar() {
    setEnviando(true);
    setAviso(null);

    // **A tela manda o que digitou, sem aparar.** Quem apara é o schema, num lugar só.
    const resultado = await enviarComentario(ocorrenciaId, texto, organizacaoId);
    setEnviando(false);

    if (!resultado.ok) {
      setAviso(resultado.aviso);
      return;
    }

    setAcrescentadas((anteriores) => [...anteriores, resultado.comentario]);
    setTexto("");
    // Repinta o bloco 3, onde a mesma mensagem aparece entre aspas — critério 30.8.
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-2">
      <Suspense fallback={<EsqueletoDaConversa />}>
        <ListaDeMensagens
          pagina={primeiraPagina}
          acrescentadas={acrescentadas}
          ocorrenciaId={ocorrenciaId}
          pessoaIdDeQuemLe={pessoaIdDeQuemLe}
          vazio={vazio}
        />
      </Suspense>

      <label htmlFor={campoId} className="text-tinta text-sm font-semibold">
        {rotuloDoCampo}
      </label>

      <textarea
        id={campoId}
        value={texto}
        onChange={(evento) => {
          setTexto(evento.target.value);
          // Aviso velho ao lado de texto novo é a pior combinação possível.
          setAviso(null);
        }}
        disabled={enviando}
        rows={3}
        /* **O mesmo teto do schema** — 4000. Dois números divergiriam. E **sem contador de caracteres**:
           não há um em nenhum campo do produto, inclusive nos de 1.000 e de 5.000. */
        maxLength={4000}
        className="border-linha bg-superficie text-tinta min-h-11 rounded-md border px-3 py-2 text-base"
      />

      {aviso !== null && (
        <p
          role="alert"
          className="border-marca/40 bg-accent text-tinta rounded-md border px-3 py-2 text-sm"
        >
          {aviso}
        </p>
      )}

      {/* **Sem frase de confirmação, e a ausência é decisão:** ao contrário do campo de solução aplicada,
          aqui o sucesso **se vê** — a mensagem aparece na lista logo acima e o campo esvazia. Uma frase
          dizendo "mensagem enviada" ao lado da própria mensagem é ruído. É a pergunta Q-6 ao hub. */}
      <Button
        type="button"
        variant="outline"
        className="h-11 w-auto self-start"
        disabled={!podeEnviar}
        onClick={() => void enviar()}
      >
        {enviando ? "Enviando…" : "Enviar"}
      </Button>
    </section>
  );
}

/**
 * A lista, o cabeçalho e o *Carregar mais* — **o que espera a promessa**, e por isso o que fica dentro do
 * `<Suspense>`.
 *
 * **Anexa, nunca substitui**, como `ListaDeOcorrencias`. E a falha **não** limpa o que já está na tela: a
 * conversa que a pessoa já lê é dela.
 */
function ListaDeMensagens({
  pagina,
  acrescentadas,
  ocorrenciaId,
  pessoaIdDeQuemLe,
  vazio,
}: {
  pagina: Promise<PaginaDeComentariosProjetada>;
  acrescentadas: readonly ComentarioDoEnvio[];
  ocorrenciaId: string;
  pessoaIdDeQuemLe: string;
  vazio: string;
}) {
  const primeira = use(pagina);

  const [carregadas, setCarregadas] = useState(primeira.itens);
  const [cursor, setCursor] = useState(primeira.proximoCursor);
  const [carregando, setCarregando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);

  const itens = [...carregadas, ...acrescentadas];

  async function carregarMais() {
    if (cursor === null || carregando) return;

    setCarregando(true);
    setFalha(null);

    try {
      const destino = new URLSearchParams({ cursor });
      const resposta = await fetch(
        `/api/ocorrencias/${ocorrenciaId}/comentarios?${destino.toString()}`,
      );

      if (!resposta.ok) {
        setFalha("Não foi possível carregar mais agora. Tente de novo.");
        return;
      }

      const proxima = (await resposta.json()) as PaginaDeComentariosProjetada;
      setCarregadas((anteriores) => [...anteriores, ...proxima.itens]);
      setCursor(proxima.proximoCursor);
    } catch {
      setFalha("Sem conexão. As mensagens que você já tem continuam aqui.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      {/*
        **O título é *"Mensagens"*, e não *"Comentários"***: *Comentário* é o nome do **recurso** no
        contrato e no glossário; *Mensagens* é o que a tela escreve. O produto já mantém essa distinção
        entre `Registro de transição` e *"Linha do tempo"*.

        **A contagem só aparece quando a conversa inteira está na tela.** O contrato não devolve `total`,
        de propósito (§7.7), então o número que a tela tem é *"quantas foram carregadas"* — e mostrá-lo ao
        lado de um *Carregar mais* diria *"2"* numa conversa de trinta. É a mesma razão pela qual o
        esqueleto da linha do tempo não conta: **não se conta o que ainda não chegou**.
      */}
      <h2 className="text-tinta text-sm font-semibold">
        Mensagens{" "}
        {cursor === null && <span className="text-tinta-fraca font-normal">{itens.length}</span>}
      </h2>

      {itens.length === 0 ? (
        <p className="text-tinta-suave text-sm leading-relaxed">{vazio}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {itens.map((mensagem) => (
            <li key={mensagem.id} className="flex flex-col gap-0.5">
              {/* **A-5: nada só por cor.** Cada mensagem carrega quem, quando e o quê, em palavras. */}
              <span className="text-tinta-fraca text-xs">
                {autoria(
                  mensagem.autor.nome,
                  mensagem.autor.pessoaId === pessoaIdDeQuemLe,
                  dataHora(mensagem.criadoEm),
                )}
              </span>
              {/* **SEM aspas aqui**, ao contrário do bloco 3: ali as aspas distinguem o que uma pessoa
                  escreveu do que o sistema registrou; aqui tudo é texto de pessoa, e aspar tudo é ruído.
                  **Duas formas, as duas transcritas do protótipo** — critério 30.8. */}
              <span className="text-tinta-suave text-sm leading-relaxed whitespace-pre-line">
                {mensagem.texto}
              </span>
            </li>
          ))}
        </ol>
      )}

      {falha !== null && (
        <p role="alert" className="text-tinta-suave text-xs">
          {falha}
        </p>
      )}

      {cursor !== null && (
        <Button
          type="button"
          variant="outline"
          className="h-11 w-auto self-start"
          disabled={carregando}
          onClick={() => void carregarMais()}
        >
          {carregando ? "Carregando…" : "Carregar mais"}
        </Button>
      )}
    </>
  );
}

/**
 * O estado de carregamento do bloco 4 — cabeçalho **sem a contagem** e duas mensagens em barra cinza.
 * `animate-pulse` é a mesma classe do `EsqueletoDaLinhaDoTempo`.
 */
function EsqueletoDaConversa() {
  return (
    <>
      <h2 className="text-tinta text-sm font-semibold">Mensagens</h2>
      <div aria-hidden className="flex flex-col gap-3">
        {[
          [44, 90],
          [50, 72],
        ].map(([autor, frase]) => (
          <div key={autor} className="flex flex-col gap-1.5">
            <div
              className="bg-secondary h-3 animate-pulse rounded"
              style={{ width: `${String(autor)}%` }}
            />
            <div
              className="bg-secondary h-4 animate-pulse rounded"
              style={{ width: `${String(frase)}%` }}
            />
          </div>
        ))}
      </div>
    </>
  );
}
