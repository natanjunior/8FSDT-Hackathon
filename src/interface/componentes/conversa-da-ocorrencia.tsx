"use client";

import { useRouter } from "next/navigation";
import { Suspense, use, useId, useState } from "react";

import {
  Campo,
  ErroDoFormulario,
  IndicadorDeEnvio,
  RodapeDoFormulario,
} from "@/interface/componentes/campo";
import {
  Cartao,
  CorpoDoCartao,
  FaixaDoCartao,
  TITULO_DA_FAIXA,
} from "@/interface/componentes/cartao";
import {
  enviarComentario,
  type ComentarioDoEnvio,
} from "@/interface/componentes/comando-de-ocorrencia";
import { dataEHora } from "@/interface/componentes/datas";
import { AvatarDePessoa } from "@/interface/componentes/ficha-de-pessoa";
import { partesDaAutoria } from "@/interface/componentes/linha-do-tempo";
import {
  avisarErro,
  avisarSucesso,
  type TextosDoRetorno,
} from "@/interface/componentes/retorno-de-acao";
import { Button } from "@/interface/componentes/ui/button";
import { Textarea } from "@/interface/componentes/ui/textarea";
import { useFormularioTocado } from "@/interface/ganchos/use-formulario-tocado";
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
 * - **O aviso de sucesso** sai, e o formulário recomeça, para o campo vazio não acender o erro (item
 *   44g).
 *
 * **Acessibilidade:** `<label htmlFor>` de verdade (**A-1**) — o protótipo o desenha, e `placeholder`
 * **não** é rótulo —, `min-h-11` no campo e `h-11` nos botões (**A-3**), e o erro em **palavra**: o de
 * campo pela descrição do campo, o do servidor em `role="alert"` (**A-5**). O DOM é linear, então a ordem de foco é a de leitura (A-2).
 */
export function ConversaDaOcorrencia({
  ocorrenciaId,
  primeiraPagina,
  organizacaoId,
  pessoaIdDeQuemLe,
  vazio,
  rotuloDoCampo,
  retorno,
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
  /** Os títulos do aviso, prontos (`RETORNO_DA_MENSAGEM`). */
  retorno: TextosDoRetorno;
}) {
  const router = useRouter();
  const campoId = useId();
  const idDoTitulo = useId();
  const [acrescentadas, setAcrescentadas] = useState<readonly ComentarioDoEnvio[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const formulario = useFormularioTocado({
    campos: { mensagem: campoId },
    erros: { mensagem: texto.trim() === "" ? "Escreva a mensagem." : undefined },
  });

  async function enviar() {
    // **O freio contra o toque duplo é da tela** (critério 30.3, §7.10 do contrato): enquanto envia, o
    // botão fica inerte e um segundo clique não passa daqui. Não promete nada: dois aparelhos, ou um
    // `curl`, continuam criando dois comentários.
    if (enviando || !formulario.tentarEnviar()) return;
    setEnviando(true);
    setAviso(null);

    // **A tela manda o que digitou, sem aparar.** Quem apara é o schema, num lugar só.
    const resultado = await enviarComentario(ocorrenciaId, texto, organizacaoId);
    setEnviando(false);

    if (!resultado.ok) {
      setAviso(resultado.aviso);
      avisarErro(retorno.falha);
      return;
    }

    setAcrescentadas((anteriores) => [...anteriores, resultado.comentario]);
    setTexto("");
    // O campo vazio acenderia "Escreva a mensagem." se o formulário continuasse tocado.
    formulario.recomecar();
    avisarSucesso(retorno.sucesso);
    // Repinta o bloco 3, onde a mesma mensagem aparece entre aspas — critério 30.8.
    router.refresh();
  }

  return (
    /* **Cartão com faixa, como os outros blocos de T-05** (item 44q, critério 5). A faixa mora dentro
       da `ListaDeMensagens`, porque é lá que estão a contagem e o cursor. */
    <Cartao tituloId={idDoTitulo}>
      <Suspense fallback={<EsqueletoDaConversa idDoTitulo={idDoTitulo} />}>
        <ListaDeMensagens
          idDoTitulo={idDoTitulo}
          pagina={primeiraPagina}
          acrescentadas={acrescentadas}
          ocorrenciaId={ocorrenciaId}
          pessoaIdDeQuemLe={pessoaIdDeQuemLe}
          vazio={vazio}
        />
      </Suspense>

      <CorpoDoCartao>
        <Campo id={campoId} rotulo={rotuloDoCampo} obrigatorio erro={formulario.erroDe("mensagem")}>
          {(controle) => (
            <Textarea
              {...controle}
              value={texto}
              onChange={(evento) => {
                setTexto(evento.target.value);
                // Aviso velho ao lado de texto novo é a pior combinação possível.
                setAviso(null);
                formulario.mudou("mensagem");
              }}
              onBlur={formulario.aoSair("mensagem")}
              disabled={enviando}
              rows={3}
              /* **O mesmo teto do schema** — 4000. Dois números divergiriam. E **sem contador de caracteres**:
                 não há um em nenhum campo do produto, inclusive nos de 1.000 e de 5.000. */
              maxLength={4000}
            />
          )}
        </Campo>

        {aviso !== null && <ErroDoFormulario>{aviso}</ErroDoFormulario>}

        {/* **A mensagem enviada responde com aviso** (guia §7, item 44g), e isso fecha a pergunta Q-6 do
            item 30: a mensagem também aparece na lista, e o aviso é o retorno que todo salvamento dá.
            **O botão continua contorno** (guia §2: a ação na cor da marca desta tela é o comando do
            momento), e as duas classes que distinguiam habilitado de desabilitado saíram: ele só fica
            inerte durante o envio. */}
        <RodapeDoFormulario obrigatorios={1} todosObrigatorios>
          <Button
            type="button"
            variant="outline"
            className="h-11 font-medium"
            disabled={enviando}
            onClick={() => void enviar()}
          >
            <IndicadorDeEnvio ativo={enviando} />
            {enviando ? "Enviando…" : "Enviar"}
          </Button>
        </RodapeDoFormulario>
      </CorpoDoCartao>
    </Cartao>
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
  idDoTitulo,
  pagina,
  acrescentadas,
  ocorrenciaId,
  pessoaIdDeQuemLe,
  vazio,
}: {
  idDoTitulo: string;
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
      <FaixaDoCartao>
        {/* O nome acessível continua *"Mensagens 1"*, que é o que o teste de ponta a ponta afirma: o
            separador é mudo, e sobra *Mensagens*, espaço, *1*. */}
        <h2 id={idDoTitulo} className={TITULO_DA_FAIXA}>
          Mensagens{" "}
          {cursor === null && (
            <>
              <span aria-hidden="true">· </span>
              <span className="text-tinta-fraca">{itens.length}</span>
            </>
          )}
        </h2>
      </FaixaDoCartao>

      <CorpoDoCartao>
        {itens.length === 0 ? (
          <p className="text-tinta-suave text-corpo">{vazio}</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {itens.map((mensagem) => (
              <li key={mensagem.id} className="flex flex-col gap-1.5">
                {/* **A autoria numa linha, a mensagem embaixo, na bolha** (item 66). **A-5: nada só por
                    cor** — quem, quando e o quê, em palavras. O texto da linha é o de `autoria(…)`, caractere
                    por caractere. A bolha **não muda de lado por autor**: é livro de ocorrências, não
                    conversa de mensageiro. */}
                {(() => {
                  const { quem, quando } = partesDaAutoria(
                    mensagem.autor.nome,
                    mensagem.autor.pessoaId === pessoaIdDeQuemLe,
                    dataEHora(mensagem.criadoEm),
                  );
                  return (
                    <span className="text-meta flex items-center gap-2">
                      <AvatarDePessoa nome={mensagem.autor.nome} className="size-7" />
                      <span>
                        <span className="text-tinta text-interface font-medium">{quem}</span>
                        <span className="text-tinta-fraca"> · </span>
                        <span className="text-tinta-fraca font-mono tabular-nums">{quando}</span>
                      </span>
                    </span>
                  );
                })()}
                {/* **SEM aspas aqui**, ao contrário do bloco 3: aqui tudo é texto de pessoa. **`bg-secondary`
                    é o `--chrome`** (`globals.css:129`), e a bolha recua até o nome, 28 px do avatar mais
                    8 de vão. */}
                <p className="bg-secondary text-tinta text-corpo ml-9 w-fit max-w-[60ch] rounded-lg px-3 py-2.5 break-words whitespace-pre-line">
                  {mensagem.texto}
                </p>
              </li>
            ))}
          </ol>
        )}

        {falha !== null && (
          <p role="alert" className="text-tinta-suave text-meta">
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
      </CorpoDoCartao>
    </>
  );
}

/**
 * O estado de carregamento do bloco 4 — cabeçalho **sem a contagem** e duas mensagens em barra cinza.
 * `animate-pulse` é a mesma classe do `EsqueletoDaLinhaDoTempo`.
 */
function EsqueletoDaConversa({ idDoTitulo }: { idDoTitulo: string }) {
  return (
    <>
      <FaixaDoCartao>
        <h2 id={idDoTitulo} className={TITULO_DA_FAIXA}>
          Mensagens
        </h2>
      </FaixaDoCartao>
      <CorpoDoCartao>
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
      </CorpoDoCartao>
    </>
  );
}
