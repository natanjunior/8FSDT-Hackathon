"use client";

import { Plus, Trash2 } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type FocusEventHandler } from "react";

import { FINALIDADES_DE_CONTATO } from "@/dominio/pessoa";
import { BotaoDeIcone, CONTORNO_DE_ACAO } from "@/interface/componentes/botao-de-icone";
import { Campo } from "@/interface/componentes/campo";
import {
  AlcaDeArrasto,
  AnuncioDeOrdem,
  ControlesDeOrdem,
  VagaDeArrasto,
} from "@/interface/componentes/controles-de-ordem";
import { TEXTOS_DO_FORMULARIO } from "@/interface/componentes/frases-de-participantes";
import { anuncioDeMovimento, moverItem } from "@/interface/componentes/ordem-manual";
import {
  ROTULO_DE_FINALIDADE,
  comTipo,
  contatoNovo,
  idDoContato,
  type ContatoEmEdicao,
} from "@/interface/componentes/regras-do-vinculo";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/interface/componentes/ui/select";
import { Switch } from "@/interface/componentes/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/interface/componentes/ui/toggle-group";
import { cn } from "@/interface/componentes/utilitarios";
import { useArrastoDeLinha } from "@/interface/ganchos/use-arrasto-de-linha";

/**
 * ============================================================================
 *  T-08 · os contatos, em linhas que se reordenam (critério 44j.9)
 * ============================================================================
 *
 * **A ordem da lista é o significado**, e não há caixa de *"contato preferido"*: o 1 é para onde se liga
 * primeiro, e mudar a preferência é mudar a ordem. **Pelas setas**, que servem ao toque e ao teclado, ou
 * **arrastando pela alça**, onde há ponteiro fino — o arrastar recusado no protótipo por ser hostil ao
 * toque continua recusado para o toque.
 *
 * **A lista substitui a anterior ao salvar**, e a escrita não muda: a posição é a ordem (decisão 2.1 do
 * item 9b).
 *
 * **`temWhatsapp` só existe num telefone** (`contatos_whatsapp_ck`), e trocar para e-mail limpa a marca —
 * é isso que impede o `400` daquele campo de existir pela tela.
 *
 * **A partir de `lg`, cada contato é uma linha de grade, sob uma linha de cabeçalho**; abaixo disso, um
 * bloco com os rótulos visíveis e as ações embaixo. O cabeçalho visual não é associado a controle nenhum,
 * então **cada controle leva o próprio nome**, com o número do contato (A-1).
 */

const GRADE = "lg:grid-cols-[16px_20px_172px_minmax(0,1fr)_140px_150px_minmax(0,1fr)_144px]";

const CLASSE_DO_TIPO = cn(
  "text-interface text-tinta-suave min-h-11 rounded-sm px-3 font-normal",
  "data-[state=on]:bg-superficie data-[state=on]:text-tinta data-[state=on]:font-semibold data-[state=on]:shadow-sm",
);

export function SubFormularioDeContatos({
  prefixo,
  contatos,
  inerte,
  aoMudar,
  aoMudarValor,
  aoSairDoValor,
  erroDoValor,
}: {
  prefixo: string;
  contatos: readonly ContatoEmEdicao[];
  /** Durante o envio, nada se move e nada se digita. */
  inerte: boolean;
  aoMudar: (contatos: readonly ContatoEmEdicao[]) => void;
  aoMudarValor: (chave: string) => void;
  /** O `onBlur` do valor de cada contato: a saída dele revela o erro (item 75). */
  aoSairDoValor: (chave: string) => FocusEventHandler<HTMLElement>;
  erroDoValor: (chave: string) => string | undefined;
}) {
  const [anuncio, setAnuncio] = useState("");
  const lista = useRef<HTMLDivElement>(null);
  const focarNoNovo = useRef<string | null>(null);

  function trocar(indice: number, mudanca: (contato: ContatoEmEdicao) => ContatoEmEdicao) {
    aoMudar(contatos.map((contato, i) => (i === indice ? mudanca(contato) : contato)));
  }

  function mover(de: number, para: number) {
    const proxima = moverItem(contatos, de, para);
    if (proxima === contatos) return;
    aoMudar(proxima);
    setAnuncio(anuncioDeMovimento(para + 1, contatos.length));
  }

  const arrasto = useArrastoDeLinha({ quantidade: contatos.length, inerte, aoMover: mover });

  // *Adicionar contato* leva o foco ao tipo do contato novo, que é o primeiro controle da linha.
  useEffect(() => {
    const chave = focarNoNovo.current;
    if (chave === null) return;
    focarNoNovo.current = null;
    lista.current
      ?.querySelector<HTMLElement>(`[data-tipo-do-contato="${chave}"] [data-state="on"]`)
      ?.focus();
  }, [contatos]);

  return (
    // `id="contatos"` é o alvo do *Acrescentar e-mail* do modal do convite (item 122).
    <div ref={lista} id="contatos" className="scroll-mt-20">
      {contatos.length > 0 && (
        <div
          aria-hidden="true"
          className={cn(
            "bg-background border-linha text-rotulo-coluna text-tinta-suave hidden gap-x-3 border-b px-4 py-2.5 font-mono uppercase lg:grid",
            GRADE,
          )}
        >
          <span />
          <span>Nº</span>
          <span>Tipo</span>
          <span>
            Número ou e-mail <span className="text-destructive">*</span>
          </span>
          <span>Finalidade</span>
          <span>WhatsApp</span>
          <span>Observação</span>
          <span />
        </div>
      )}

      {contatos.map((contato, indice) => (
        <Fragment key={contato.chave}>
          {arrasto.vaga === indice && <VagaDeArrasto {...arrasto.propsDaVaga()} />}
          <LinhaDeContato
            prefixo={prefixo}
            contato={contato}
            indice={indice}
            total={contatos.length}
            inerte={inerte}
            recuada={arrasto.arrastando === indice}
            propsDaAlca={arrasto.propsDaAlca(indice)}
            propsDaLinha={arrasto.propsDaLinha(indice)}
            erro={erroDoValor(contato.chave)}
            aoTrocar={trocar}
            aoMover={mover}
            aoRemover={() => {
              aoMudar(contatos.filter((_, i) => i !== indice));
            }}
            aoMudarValor={aoMudarValor}
            aoSairDoValor={aoSairDoValor}
          />
        </Fragment>
      ))}
      {arrasto.vaga === contatos.length && <VagaDeArrasto {...arrasto.propsDaVaga()} />}

      <div className="px-4 py-3">
        <Button
          type="button"
          variant="outline"
          disabled={inerte}
          onClick={() => {
            const novo = contatoNovo(`novo-${String(Date.now())}-${String(contatos.length)}`);
            focarNoNovo.current = novo.chave;
            aoMudar([...contatos, novo]);
          }}
          className={cn(CONTORNO_DE_ACAO, "text-interface text-tinta min-h-11 rounded-sm px-4 has-[>svg]:px-4")}
        >
          <Plus aria-hidden="true" />
          {TEXTOS_DO_FORMULARIO.adicionar}
        </Button>
      </div>

      <AnuncioDeOrdem texto={anuncio} />
    </div>
  );
}

function LinhaDeContato({
  prefixo,
  contato,
  indice,
  total,
  inerte,
  recuada,
  propsDaAlca,
  propsDaLinha,
  erro,
  aoTrocar,
  aoMover,
  aoRemover,
  aoMudarValor,
  aoSairDoValor,
}: {
  prefixo: string;
  contato: ContatoEmEdicao;
  indice: number;
  total: number;
  inerte: boolean;
  recuada: boolean;
  propsDaAlca: ReturnType<ReturnType<typeof useArrastoDeLinha>["propsDaAlca"]>;
  propsDaLinha: ReturnType<ReturnType<typeof useArrastoDeLinha>["propsDaLinha"]>;
  erro: string | undefined;
  aoTrocar: (indice: number, mudanca: (contato: ContatoEmEdicao) => ContatoEmEdicao) => void;
  aoMover: (de: number, para: number) => void;
  aoRemover: () => void;
  aoMudarValor: (chave: string) => void;
  aoSairDoValor: (chave: string) => FocusEventHandler<HTMLElement>;
}) {
  const numero = indice + 1;
  const id = (parte: Parameters<typeof idDoContato>[2]) => idDoContato(prefixo, contato.chave, parte);
  const ehTelefone = contato.tipo === "telefone";

  return (
    <fieldset
      {...propsDaLinha}
      className={cn(
        "border-linha-suave min-w-0 border-b px-4 py-3",
        indice % 2 === 1 && "bg-background",
        recuada && "opacity-40",
      )}
    >
      <legend className="sr-only">Contato {numero}</legend>

      <div className={cn("flex flex-col gap-3 lg:grid lg:items-start lg:gap-x-3 lg:gap-y-0", GRADE)}>
        <div className="flex items-center gap-2 lg:contents">
          <span className="flex w-4 shrink-0 justify-center lg:mt-3.5">
            <AlcaDeArrasto {...propsDaAlca} />
          </span>
          <span aria-hidden="true" className="text-interface text-tinta-suave font-mono tabular-nums lg:mt-3">
            <span className="font-sans lg:hidden">Contato </span>
            {numero}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-interface text-tinta font-medium lg:sr-only">Tipo</span>
          <ToggleGroup
            type="single"
            spacing={1}
            value={contato.tipo}
            disabled={inerte}
            data-tipo-do-contato={contato.chave}
            aria-label={`Tipo do contato ${String(numero)}`}
            onValueChange={(escolhido) => {
              if (escolhido !== "telefone" && escolhido !== "email") return;
              aoTrocar(indice, (atual) => comTipo(atual, escolhido));
              aoMudarValor(contato.chave);
            }}
            className="bg-muted w-fit rounded-sm p-0.5"
          >
            <ToggleGroupItem value="telefone" className={CLASSE_DO_TIPO}>
              Telefone
            </ToggleGroupItem>
            <ToggleGroupItem value="email" className={CLASSE_DO_TIPO}>
              E-mail
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <Campo
          id={id("valor")}
          rotulo="Número ou e-mail"
          obrigatorio
          rotuloEmTelaGrande="oculto"
          erro={erro}
        >
          {(controle) => (
            <Input
              {...controle}
              aria-label={`Número ou e-mail do contato ${String(numero)}`}
              type={ehTelefone ? "tel" : "email"}
              inputMode={ehTelefone ? "tel" : "email"}
              maxLength={255}
              value={contato.valor}
              disabled={inerte}
              onChange={(evento) => {
                const valor = evento.target.value;
                aoTrocar(indice, (atual) => ({ ...atual, valor }));
                aoMudarValor(contato.chave);
              }}
              onBlur={aoSairDoValor(contato.chave)}
              className="border-linha bg-background h-11"
            />
          )}
        </Campo>

        <Campo id={id("finalidade")} rotulo="Finalidade" rotuloEmTelaGrande="oculto">
          {(controle) => (
            <Select
              value={contato.finalidade}
              disabled={inerte}
              onValueChange={(escolhido) => {
                const finalidade = FINALIDADES_DE_CONTATO.find((valor) => valor === escolhido);
                if (finalidade !== undefined) aoTrocar(indice, (atual) => ({ ...atual, finalidade }));
              }}
            >
              <SelectTrigger
                {...controle}
                aria-label={`Finalidade do contato ${String(numero)}`}
                className="border-linha bg-background text-interface min-h-11 w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FINALIDADES_DE_CONTATO.map((finalidade) => (
                  <SelectItem key={finalidade} value={finalidade}>
                    {ROTULO_DE_FINALIDADE[finalidade]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Campo>

        {/* No e-mail a célula fica vazia na tela grande, e o bloco some no celular. */}
        <div className={cn("flex flex-col gap-1.5", !ehTelefone && "hidden lg:flex")}>
          <span className="text-interface text-tinta font-medium lg:sr-only">WhatsApp</span>
          {ehTelefone && (
            <label className="flex min-h-11 w-fit cursor-pointer items-center gap-2.5">
              <Switch
                checked={contato.temWhatsapp}
                disabled={inerte}
                aria-label={`WhatsApp do contato ${String(numero)}`}
                onCheckedChange={(ligado) => {
                  aoTrocar(indice, (atual) => ({ ...atual, temWhatsapp: ligado }));
                }}
                className="data-[state=checked]:bg-marca"
              />
              {/* A-5: a marca carrega a palavra, nunca só a cor. */}
              <span className="text-interface text-tinta">
                {contato.temWhatsapp ? "Aceita" : "Não aceita"}
              </span>
            </label>
          )}
        </div>

        <Campo id={id("observacao")} rotulo="Observação" rotuloEmTelaGrande="oculto">
          {(controle) => (
            <Input
              {...controle}
              aria-label={`Observação do contato ${String(numero)}`}
              maxLength={200}
              placeholder="Opcional"
              value={contato.observacao}
              disabled={inerte}
              onChange={(evento) => {
                const observacao = evento.target.value;
                aoTrocar(indice, (atual) => ({ ...atual, observacao }));
              }}
              className="border-linha bg-background h-11"
            />
          )}
        </Campo>

        <div className="flex items-center gap-1.5 lg:mt-1">
          <ControlesDeOrdem
            posicao={indice}
            total={total}
            rotulos={{
              subir: `Subir o contato ${String(numero)}`,
              descer: `Descer o contato ${String(numero)}`,
            }}
            inerte={inerte}
            aoMover={aoMover}
          />
          {/* **Remover não pede confirmação**: nada é gravado até o envio, e *Cancelar* descarta tudo. */}
          <BotaoDeIcone
            rotulo={`Remover o contato ${String(numero)}`}
            icone={<Trash2 aria-hidden="true" />}
            disabled={inerte}
            onClick={aoRemover}
          />
        </div>
      </div>
    </fieldset>
  );
}
