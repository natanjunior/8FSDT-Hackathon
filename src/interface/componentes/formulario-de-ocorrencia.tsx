"use client";

import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import { gravarAreaUsada } from "@/interface/componentes/areas-usadas";
import {
  Aviso,
  Campo,
  ErroDoFormulario,
  IndicadorDeEnvio,
  RodapeDoFormulario,
} from "@/interface/componentes/campo";
import { ControleDeFoto, type EstadoDoAnexo } from "@/interface/componentes/controle-de-foto";
import { IconeDeCategoria } from "@/interface/componentes/icone-de-categoria";
import { TEXTOS_DO_QR } from "@/interface/componentes/qr-da-area";
import {
  AJUDA_DA_DESCRICAO,
  avisoDoRegistro,
  BLOCOS,
  CAMPOS_DO_REGISTRO,
  CANCELAR,
  CODIGOS_DE_ESCOLHA,
  CODIGOS_DO_ANEXO,
  DESCARTE,
  errosDoRegistro,
  fraseDoQueFalta,
  EXEMPLOS,
  FRASES_DO_SERVIDOR,
  JA_REGISTRADA,
  REGISTRANDO,
  REGISTRAR,
  ROTULOS,
  SEM_REDE,
  temAlgoEscrito,
  TETO_DA_REFERENCIA,
  TETO_DA_DESCRICAO,
  TETO_DO_TITULO,
  TEXTOS_DO_REGISTRO,
  VALORES_VAZIOS,
  type ValoresDoRegistro,
} from "@/interface/componentes/registro-de-ocorrencia";
import { avisarConclusao, avisarErro, mensagemDoProblema } from "@/interface/componentes/retorno-de-acao";
import { SeletorDeArea, type AreaEscolhivel } from "@/interface/componentes/seletor-de-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/interface/componentes/ui/alert-dialog";
import { Button, buttonVariants } from "@/interface/componentes/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/interface/componentes/ui/empty";
import { Input } from "@/interface/componentes/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/interface/componentes/ui/select";
import { Textarea } from "@/interface/componentes/ui/textarea";
import { cn } from "@/interface/componentes/utilitarios";
import { SAI_SEM_ACUSAR, useFormularioTocado } from "@/interface/ganchos/use-formulario-tocado";

/**
 * ============================================================================
 *  T-04 — a ordem dos campos é a decisão, e ela vale segundos
 * ============================================================================
 *
 * **Título · descrição · categoria · bloco "Onde".** Os dois campos de texto são **consecutivos** e os
 * dois seletores vêm **depois**, e há três razões independentes para a mesma ordem
 * (`prototipo-low-fi.md` §2.3 e §2.5):
 *
 * 1. **Economia de teclado** — separar dois campos de digitação com um seletor custa duas trocas de
 *    teclado: ele descer, a tela reposicionar, e ele subir de novo.
 * 2. **Cobertura de cold start** — os dois únicos campos que dependem de rede são os dois últimos, então
 *    um cold start de até ~24 s é invisível ao Solicitante (RNF5 × RNF6).
 * 3. **Paralelismo do upload** — a foto é o primeiro alvo, acima do título, e o upload corre enquanto a
 *    pessoa digita. Entrou com o item 13a; a ordem de foco é
 *    `foto → titulo → descricao → categoria → area → complemento → registrar`, que é o orçamento da §2 do
 *    protótipo e o compromisso **A-2**.
 *
 * **Área e Referência num bloco só, chamado "Onde".** Não é agrupamento estético: o glossário define
 * **Localização** como *"uma referência a uma Área mais um complemento em texto livre"*. Um conceito, um
 * bloco, um rótulo.
 *
 * **O formulário é controlado nos cinco campos** (item 44l). Ele era lido por `FormData` no envio, e a
 * troca tem causa: **categoria e área deixaram de ser controles nativos**, e o `FormData` não os lê. Com
 * os cinco no estado, os erros saem de uma função pura com teste — `errosDoRegistro` —, e é também o que
 * o contador de caracteres do título e da referência pede. **O custo, declarado:** cada tecla repinta o
 * formulário. É o padrão que os modais dos itens 44i e 44j já usam com contador, o formulário tem cinco
 * campos, e nada abaixo dele é caro de repintar.
 *
 * **Os blocos não usam o `Cartao` do item 44i**, e a razão está no comentário do `Bloco`, abaixo.
 *
 * **O rodapé fica no fim do conteúdo, não preso.** Preso, o teclado o cobre — e o teclado está aberto
 * durante a maior parte do registro. **Esta é a exceção que o guia §7 registra por escrito** para T-04 no
 * celular.
 *
 * **Acessibilidade:** `Campo` exige `htmlFor` (A-1); os controles têm `min-h-11` ≈ 44 px (A-3); o erro é
 * texto, nunca cor sozinha (A-5).
 */

type CategoriaEscolhivel = { id: string; nome: string; icone: string };

/**
 * **Um bloco de T-04, e por que ele não é o `Cartao` do item 44i.** O `Cartao` é uma seção com as classes
 * de cartão fixas; o que esta tela precisa é de um cartão que **se dissolve** a partir de `lg` — a
 * prancheta do celular desenha duas seções separadas, e a da tela grande desenha **um** cartão com os
 * dois títulos e uma régua entre eles. Envolver o `Cartao` numa classe que desfaz a borda dele seria
 * escrever a exceção duas vezes.
 *
 * **O que não se perde:** cada bloco continua sendo uma seção com `aria-labelledby` apontando para o
 * próprio título, nas duas larguras, então quem navega por regiões encontra *O que aconteceu* e *Onde* do
 * mesmo jeito.
 */
function Bloco({
  id,
  titulo,
  reguaEmCima = false,
  children,
}: {
  readonly id: string;
  readonly titulo: string;
  readonly reguaEmCima?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "border-linha bg-superficie rounded-lg border p-[15px] shadow-sm",
        "lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none",
        reguaEmCima && "lg:border-linha-suave lg:border-t lg:pt-5",
      )}
    >
      <h2 id={id} className="text-titulo-bloco text-tinta mb-4">
        {titulo}
      </h2>
      <div className="flex flex-col gap-4.5">{children}</div>
    </section>
  );
}

export function FormularioDeOcorrencia({
  categorias,
  areas,
  organizacaoId,
  painel,
  areaInicial,
  areaIndisponivel,
}: {
  categorias: readonly CategoriaEscolhivel[];
  areas: readonly AreaEscolhivel[];
  /** A organização com que a página renderizou — a afirmação da §4.3 (item 7b, critério 7b.6). */
  organizacaoId: string;
  /** O painel *Depois de registrar*, montado no servidor. Ele some nos dois estados terminais. */
  painel: ReactNode;
  /** A área do QR (item 111): valor inicial do campo, e nada mais. O tipo é apurado no servidor. */
  areaInicial?: string | undefined;
  /** O QR trouxe uma área que não está entre as ativas: o campo abre vazio, com o aviso. */
  areaIndisponivel?: boolean;
}) {
  const router = useRouter();
  const [inicial] = useState<ValoresDoRegistro>(() => ({
    ...VALORES_VAZIOS,
    areaId: areaInicial ?? "",
  }));
  const [valores, setValores] = useState<ValoresDoRegistro>(inicial);
  const [avisoDaArea, setAvisoDaArea] = useState(areaIndisponivel === true);
  const [enviando, setEnviando] = useState(false);
  /** Houve um envio tentado: só depois dele a frase de quanto falta aparece (critério 116.6). */
  const [tentou, setTentou] = useState(false);
  const [errosDoServidor, setErrosDoServidor] = useState<Record<string, string | undefined>>({});
  const [falha, setFalha] = useState<string | null>(null);
  const [erroDaFoto, setErroDaFoto] = useState<string | undefined>(undefined);
  const [anexo, setAnexo] = useState<EstadoDoAnexo>({ nome: "vazio" });
  /** Trocar a chave **remonta** o controle: é como ele volta a *vazio* sem um método imperativo. */
  const [chaveDoControle, setChaveDoControle] = useState(0);
  /** O `409`: a ocorrência que **já** tem esta foto. Presente, ele substitui o formulário inteiro. */
  const [jaRegistrada, setJaRegistrada] = useState<string | null>(null);
  const [perguntandoDescarte, setPerguntandoDescarte] = useState(false);

  const erros = errosDoRegistro(valores);

  /** O erro de um campo aparece quando a pessoa sai dele ou tenta registrar: a regra do produto desde o item 75. */
  const formulario = useFormularioTocado({ campos: CAMPOS_DO_REGISTRO, erros });

  function mudar(campo: keyof ValoresDoRegistro, valor: string) {
    setValores((anteriores) => ({ ...anteriores, [campo]: valor }));
    formulario.mudou(campo);
  }

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    // A frase entra no mesmo render que marca os erros, e esse render é confirmado antes do foco
    // (`tentarEnviar`, critério 116.6). Com o envio válido, ela fica vazia: não falta nada.
    setTentou(true);
    if (!formulario.tentarEnviar(erros)) return;

    setEnviando(true);
    setErrosDoServidor({});
    setFalha(null);
    setErroDaFoto(undefined);

    /**
     * **O envio espera o `PUT`.** Com o envio em voo, aguarda a promessa; pronto, usa a referência;
     * vazio ou falhou, manda sem anexo — que é desfecho legítimo. **É o DG-5, e não muda aqui.**
     */
    const referencia =
      anexo.nome === "pronta"
        ? anexo.referencia
        : anexo.nome === "subindo"
          ? await anexo.conclusao
          : null;

    const complemento = valores.localizacaoComplemento.trim();

    try {
      const resposta = await fetch("/api/ocorrencias", {
        method: "POST",
        headers: cabecalhosDeEscrita(organizacaoId),
        body: JSON.stringify({
          titulo: valores.titulo,
          descricao: valores.descricao,
          categoriaId: valores.categoriaId,
          areaId: valores.areaId,
          localizacaoComplemento: complemento === "" ? null : complemento,
          anexos: referencia === null ? null : [referencia],
        }),
      });

      if (resposta.status === 201) {
        const criada = (await resposta.json()) as { id: string };
        gravarAreaUsada(organizacaoId, valores.areaId);
        /**
         * **O aviso sobrevive à navegação, e é por isso que pode sair antes do `replace`:** o `Toaster`
         * mora no layout raiz, a navegação é do cliente, e o layout não remonta (ADR-0011).
         *
         * **T-05 da ocorrência criada, nunca de volta ao formulário** (critério 11.5), e `replace` e não
         * `push`: o botão "voltar" do navegador não deve reabrir um formulário já enviado.
         */
        avisarConclusao(avisoDoRegistro(anexo.nome, referencia !== null));
        router.replace(`/ocorrencias/${criada.id}`);
        return;
      }

      const problema = (await resposta.json()) as {
        detail?: string;
        codigo?: string;
        ocorrenciaId?: string;
        erros?: { campo: string; mensagem?: string }[];
      };

      /**
       * **O `409` substitui o formulário, e o critério 13b.3 é explícito sobre por quê:** ele diz que a
       * tela *"não oferece tentar de novo nem escolher outra foto"* — e um formulário que continua na
       * tela oferece as duas por construção, porque o botão está lá.
       */
      if (problema.codigo === "ANEXO_JA_REIVINDICADO" && typeof problema.ocorrenciaId === "string") {
        setJaRegistrada(problema.ocorrenciaId);
        return;
      }

      const mensagem = mensagemDoProblema(problema, FRASES_DO_SERVIDOR);
      avisarErro(TEXTOS_DO_REGISTRO.falha);

      /**
       * Os dois `422` do anexo são **erro de campo**, e o campo é a foto. O controle volta a *vazio* pela
       * remontagem por `key`, e a pessoa escolhe outra foto **sem perder uma palavra do que escreveu**.
       */
      if (problema.codigo !== undefined && CODIGOS_DO_ANEXO.includes(problema.codigo)) {
        setErroDaFoto(mensagem);
        setAnexo({ nome: "vazio" });
        setChaveDoControle((numero) => numero + 1);
        return;
      }

      /**
       * **`CATEGORIA_INVALIDA` e `AREA_INVALIDA` recarregam a lista**, que é o que o
       * `inventario-de-telas.md` §7 manda desde agosto e nunca foi construído: *"Escolha outra."* **mais**
       * a lista recarregada, mantendo o resto do formulário. A página é `force-dynamic`, o `refresh`
       * repinta só os componentes de servidor, e o estado do formulário sobrevive.
       */
      const campoDaEscolha =
        problema.codigo === undefined ? undefined : CODIGOS_DE_ESCOLHA[problema.codigo];
      if (campoDaEscolha !== undefined) {
        setValores((anteriores) => ({ ...anteriores, [campoDaEscolha]: "" }));
        setErrosDoServidor({ [campoDaEscolha]: mensagem });
        router.refresh();
        return;
      }

      if (problema.erros !== undefined && problema.erros.length > 0) {
        setErrosDoServidor(
          Object.fromEntries(
            problema.erros.map((erro) => [erro.campo, erro.mensagem ?? "Confira este campo."]),
          ),
        );
        return;
      }

      setFalha(mensagem);
    } catch {
      // `fetch` rejeitou antes de haver resposta — a rede caiu.
      avisarErro(TEXTOS_DO_REGISTRO.falha);
      setFalha(SEM_REDE);
    } finally {
      setEnviando(false);
    }
  }

  function cancelar() {
    if (temAlgoEscrito(valores, anexo.nome !== "vazio" && anexo.nome !== "falhou", inicial)) {
      setPerguntandoDescarte(true);
      return;
    }
    router.push("/ocorrencias");
  }

  if (jaRegistrada !== null) {
    return (
      <div className="border-linha bg-superficie rounded-lg border shadow-sm">
        <Empty className="px-6 py-14 md:px-6 md:py-14">
          <EmptyHeader>
            <EmptyMedia
              variant="icon"
              className="border-linha bg-background text-tinta-suave mb-3 size-13 rounded-lg border"
            >
              <CircleCheck aria-hidden="true" className="size-5.5" />
            </EmptyMedia>
            <EmptyTitle className="text-titulo-bloco text-tinta">
              {JA_REGISTRADA.titulo}
            </EmptyTitle>
            <EmptyDescription className="text-corpo text-tinta-suave">
              {JA_REGISTRADA.corpo}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link
              href={`/ocorrencias/${jaRegistrada}`}
              className={cn(
                buttonVariants({ variant: "marca" }),
                "text-interface min-h-11 rounded-sm px-4",
              )}
            >
              {JA_REGISTRADA.acao}
            </Link>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,700px)_340px] lg:items-start lg:gap-6">
      <form
        onSubmit={enviar}
        noValidate
        className={cn(
          "flex flex-col gap-4",
          "lg:border-linha lg:bg-superficie lg:gap-0 lg:rounded-lg lg:border lg:p-[18px] lg:shadow-sm",
        )}
      >
        <Bloco id="bloco-o-que" titulo={BLOCOS.oQue}>
          {/* **A foto é o primeiro alvo da tela** — protótipo §2.3 e desenho D-1. O envio corre em
              paralelo enquanto a pessoa digita, e é isso que tira 400 KB da conta do RNF6. */}
          <ControleDeFoto
            key={chaveDoControle}
            aoMudar={setAnexo}
            erro={erroDaFoto}
            organizacaoId={organizacaoId}
            inerte={enviando}
          />

          <Campo
            id="titulo"
            rotulo={ROTULOS.titulo}
            obrigatorio
            contador={{ usados: valores.titulo.length, maximo: TETO_DO_TITULO }}
            erro={formulario.erroDe("titulo", errosDoServidor)}
          >
            {(controle) => (
              <Input
                {...controle}
                value={valores.titulo}
                maxLength={TETO_DO_TITULO}
                placeholder={EXEMPLOS.titulo}
                autoComplete="off"
                disabled={enviando}
                onChange={(evento) => {
                  mudar("titulo", evento.target.value);
                }}
                onBlur={formulario.aoSair("titulo")}
                className="border-linha bg-background min-h-11"
              />
            )}
          </Campo>

          <Campo
            id="descricao"
            rotulo={ROTULOS.descricao}
            obrigatorio
            ajuda={AJUDA_DA_DESCRICAO}
            erro={formulario.erroDe("descricao", errosDoServidor)}
          >
            {(controle) => (
              <Textarea
                {...controle}
                value={valores.descricao}
                rows={2}
                maxLength={TETO_DA_DESCRICAO}
                disabled={enviando}
                onChange={(evento) => {
                  mudar("descricao", evento.target.value);
                }}
                onBlur={formulario.aoSair("descricao")}
                className="border-linha bg-background min-h-20"
              />
            )}
          </Campo>

          <Campo
            id="categoriaId"
            rotulo={ROTULOS.categoria}
            obrigatorio
            erro={formulario.erroDe("categoriaId", errosDoServidor)}
          >
            {(controle) => (
              <Select
                value={valores.categoriaId}
                disabled={enviando}
                onValueChange={(escolhida) => {
                  mudar("categoriaId", escolhida);
                }}
              >
                <SelectTrigger
                  {...controle}
                  onBlur={formulario.aoSair("categoriaId")}
                  className="border-linha bg-background text-interface min-h-11 w-full"
                >
                  <SelectValue placeholder="Escolha" />
                </SelectTrigger>
                <SelectContent>
                  {/* **O ícone vai DENTRO de cada opção, ao lado do nome** (critério 5) — o que o
                      seletor nativo nunca permitiu. O `SelectValue` reimprime o conteúdo do item
                      escolhido, então o gatilho mostra ícone e nome sem código a mais, e o ícone solto
                      que vivia ao lado do seletor some. O ícone acompanha a palavra, nunca a substitui
                      (critério 4b.4). */}
                  {categorias.map((categoria) => (
                    <SelectItem key={categoria.id} value={categoria.id}>
                      <IconeDeCategoria nome={categoria.icone} className="text-tinta-suave size-4" />
                      {categoria.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Campo>
        </Bloco>

        {/* **O bloco "Onde"** — Localização é *"uma referência a uma Área mais um complemento em texto
            livre"* (glossário, D10). Um conceito, um bloco, um rótulo. */}
        <Bloco id="bloco-onde" titulo={BLOCOS.onde} reguaEmCima>
          {avisoDaArea && <Aviso tom="nota">{TEXTOS_DO_QR.areaIndisponivel}</Aviso>}
          <div className="flex flex-col gap-4.5 lg:grid lg:grid-cols-2 lg:gap-4">
            <Campo
              id="areaId"
              rotulo={ROTULOS.area}
              obrigatorio
              erro={formulario.erroDe("areaId", errosDoServidor)}
            >
              {(controle) => (
                <SeletorDeArea
                  controle={controle}
                  areas={areas}
                  valor={valores.areaId}
                  organizacaoId={organizacaoId}
                  inerte={enviando}
                  aoEscolher={(areaId) => {
                    setAvisoDaArea(false);
                    mudar("areaId", areaId);
                  }}
                  aoSair={() => {
                    formulario.saiu("areaId");
                  }}
                />
              )}
            </Campo>

            <Campo
              id="localizacaoComplemento"
              rotulo={ROTULOS.referencia}
              contador={{
                usados: valores.localizacaoComplemento.length,
                maximo: TETO_DA_REFERENCIA,
              }}
              erro={formulario.erroDe("localizacaoComplemento", errosDoServidor)}
            >
              {(controle) => (
                <Input
                  {...controle}
                  value={valores.localizacaoComplemento}
                  maxLength={TETO_DA_REFERENCIA}
                  placeholder={EXEMPLOS.referencia}
                  autoComplete="off"
                  disabled={enviando}
                  onChange={(evento) => {
                    mudar("localizacaoComplemento", evento.target.value);
                  }}
                  onBlur={formulario.aoSair("localizacaoComplemento")}
                  className="border-linha bg-background min-h-11"
                />
              )}
            </Campo>
          </div>
        </Bloco>

        {falha !== null && <ErroDoFormulario>{falha}</ErroDoFormulario>}

        {/* **O rodapé fica no FIM do conteúdo, e não preso** — decisão 5 do D-1 do protótipo, e a exceção
            que o guia §7 registra por escrito: preso, o teclado o cobriria, e o teclado está aberto
            durante quase todo o registro. A partir de `lg` ele ganha a régua e o respiro do cartão,
            porque ali ele é o rodapé do cartão. */}
        <div className="lg:border-linha-suave mt-2 lg:mt-5 lg:border-t lg:pt-4">
          <RodapeDoFormulario
            obrigatorios={4}
            faltando={tentou ? fraseDoQueFalta(Object.values(erros).filter((erro) => erro !== undefined).length) : null}
          >
            <Button
              type="button"
              variant="outline"
              disabled={enviando}
              onClick={cancelar}
              {...{ [SAI_SEM_ACUSAR]: "" }}
              className="border-linha text-tinta text-interface min-h-11 px-4"
            >
              {CANCELAR}
            </Button>
            <Button
              type="submit"
              variant="marca"
              disabled={enviando}
              className="text-interface min-h-11 px-4"
            >
              <IndicadorDeEnvio ativo={enviando} />
              {enviando ? REGISTRANDO : REGISTRAR}
            </Button>
          </RodapeDoFormulario>
        </div>
      </form>

      {/* **O painel não carrega nada que falte no celular.** Lá, o mesmo caminho aparece em T-05, que é
          para onde a pessoa vai depois do registro. */}
      <div className="hidden lg:block">{painel}</div>

      <AlertDialog open={perguntandoDescarte} onOpenChange={setPerguntandoDescarte}>
        <AlertDialogContent className="bg-superficie border-linha">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-titulo-bloco text-tinta">
              {DESCARTE.titulo}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-corpo text-tinta-suave">
              {anexo.nome === "subindo" || anexo.nome === "pronta" ? DESCARTE.corpoComFoto : DESCARTE.corpoSemFoto}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-interface min-h-11 rounded-sm px-4">
              {DESCARTE.continuar}
            </AlertDialogCancel>
            {/* **`destructive`, porque é a ação que perde trabalho** (guia §7). Aqui o `AlertDialogAction`
                serve: não há envio ao servidor, e fechar no clique é o comportamento certo — ao contrário
                da remoção de vínculo (item 44j), onde quem fecha tem de ser o ciclo do envio.

                **A cor vai pela variante, não pela classe** (item 64). O `AlertDialogAction` embrulha a si
                mesmo num `<Button variant asChild>`, e o `Slot` junta as duas classes sem `tailwind-merge`:
                com `buttonVariants({ variant: "destructive" })` na classe, `bg-primary` e `bg-destructive`
                chegavam juntas ao elemento, e o botão saía escuro. */}
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                router.push("/ocorrencias");
              }}
              className="text-interface min-h-11 rounded-sm px-4"
            >
              {DESCARTE.descartar}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
