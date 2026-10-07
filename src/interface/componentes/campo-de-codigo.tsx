"use client";

import { useState } from "react";

import type { PropsDoControle } from "@/interface/componentes/campo";
import {
  CASAS_DO_CODIGO,
  casasDosGrupos,
  limparCodigo,
  PADRAO_DA_DIGITACAO,
} from "@/interface/componentes/regras-do-codigo";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/interface/componentes/ui/input-otp";
import { cn } from "@/interface/componentes/utilitarios";

/**
 * ============================================================================
 *  O código da organização em casas — item 65
 * ============================================================================
 *
 * **Duas formas, a mesma peça.** Em T-02 a pessoa digita o código em oito casas; em T-15 o Gestor o lê nas
 * mesmas casas, desabilitadas. Os grupos de quatro espelham como o código é escrito no cartaz (`K7RQ 4MZP`),
 * e o espaço entre eles é vão, e não caractere.
 *
 * **O rótulo continua existindo.** O `input-otp` desenha as casas sobre um `<input>` de verdade, que recebe
 * o `id`, o `aria-*` e o `name` do `Campo`. É por isso que `getByLabel("Código da organização")`, o
 * `FormData` e o `fill` do Playwright seguem funcionando.
 *
 * **Tamanho da casa.** O design pede 40 × 52 no celular e 48 × 56 na tela grande. Oito casas de 40 px não
 * cabem num celular de 360 px (F2 do plano), então abaixo de `sm` a casa divide a largura, e os 40 px valem
 * a partir de `sm`. A letra é o *título de bloco* (19 px) na entrada: 20 px não é papel do guia. Na
 * exibição é o *título de página*, porque ali o código é lido do outro lado da mesa (critério 44i.3).
 *
 * **A exibição cede de outro jeito, e o item 93 é o porquê.** Ela tinha 48 px em toda largura, e oito casas
 * mais o vão dão 398 px: o código saía cortado a 360, 390 e 414 px, recortado pelo cartão e sem rolagem que
 * o denunciasse. Agora a casa divide a largura do contêiner, com teto nos 398 naturais, **em qualquer
 * largura de janela**: quem aperta a exibição é a célula da grade de `/configuracao` e a barra lateral, e
 * não a janela. A letra e a altura não mudam, e é isso que mantém o código legível no cartaz.
 */

const GRUPO = "flex flex-1 sm:flex-none";

const GRUPO_DA_EXIBICAO = "flex min-w-0 flex-1";

// `bg-background` é o `--ground` do guia, e no tema escuro a casa fica cava sobre o cartão. A peça do
// catálogo perdeu as classes da variante escura na entrada (a divergência 2 de `ui/input-otp.tsx`), então
// não há o que desfazer aqui: o token já troca sozinho.
const CASA =
  "border-linha bg-background text-tinta font-mono uppercase data-[active=true]:ring-marca";

const CASA_DA_ENTRADA = "min-w-0 flex-1 h-[52px] sm:w-10 sm:flex-none md:w-12 md:h-14 text-titulo-bloco";

// `w-auto` desfaz o `w-9` do catálogo: largura definida conta na largura mínima do conteúdo, e é ela que
// empurrava a grade de `/configuracao` para fora do cartão (critério 93.2).
const CASA_DA_EXIBICAO = "min-w-0 flex-1 w-auto h-14 text-titulo-pagina select-none";

export function EntradaDeCodigo({
  controle,
  name,
  erro,
  ocupado,
}: {
  controle: PropsDoControle;
  name: string;
  erro: boolean;
  /** Enquanto o pedido é enviado: `aria-busy`, e o botão mostra o indicador. */
  ocupado: boolean;
}) {
  // **Controlado**: o reset de formulário do React 19 não apaga o código depois de um erro do servidor, e a
  // pessoa corrige uma letra em vez de redigitar oito (Review Focus 5).
  const [valor, setValor] = useState("");

  return (
    <InputOTP
      {...controle}
      name={name}
      maxLength={CASAS_DO_CODIGO}
      value={valor}
      onChange={(novo) => setValor(novo.toUpperCase())}
      pattern={PADRAO_DA_DIGITACAO}
      pasteTransformer={limparCodigo}
      inputMode="text"
      autoCapitalize="characters"
      autoComplete="off"
      spellCheck={false}
      aria-busy={ocupado}
      containerClassName="w-full gap-3.5 sm:w-auto"
    >
      {casasDosGrupos(CASAS_DO_CODIGO).map((grupo) => (
        <InputOTPGroup key={grupo[0]} className={GRUPO}>
          {grupo.map((indice) => (
            <InputOTPSlot
              key={indice}
              index={indice}
              className={cn(CASA, CASA_DA_ENTRADA, erro && "border-destructive")}
            />
          ))}
        </InputOTPGroup>
      ))}
    </InputOTP>
  );
}

/**
 * **A exibição de T-15: desabilitada, e é isso que cumpre o critério 65.3.** Campo desabilitado não recebe
 * foco, não se edita e não se seleciona, e as casas são `select-none`. O botão *Copiar* é o caminho, e a
 * falha dele tem texto próprio (`codigo-da-organizacao.tsx`).
 *
 * **A opacidade do catálogo sai**: o `input-otp` do shadcn apaga o desabilitado a 50%, e este código é para
 * ser lido de longe. O comprimento vem do código, pela mesma regra de `gruposDoCodigo`, para não perder
 * caractere se algum dia houver um código fora de oito (Review Focus 4).
 *
 * **O teto do contêiner é a largura natural** (8 × 48 + 14 = 398 px = 24,875 rem). Abaixo dele as casas
 * dividem o que houver. Com código fora de oito, cada casa fica mais larga ou mais estreita que 48 px, e
 * nenhum código gerado sai fora de oito (ADR-0014).
 */
export function ExibicaoDeCodigo({ codigo, rotulo }: { codigo: string; rotulo: string }) {
  return (
    <InputOTP
      value={codigo}
      maxLength={codigo.length}
      disabled
      aria-label={rotulo}
      containerClassName="w-full max-w-[24.875rem] gap-3.5 has-disabled:opacity-100"
    >
      {casasDosGrupos(codigo.length).map((grupo) => (
        <InputOTPGroup key={grupo[0]} className={GRUPO_DA_EXIBICAO}>
          {grupo.map((indice) => (
            <InputOTPSlot key={indice} index={indice} className={cn(CASA, CASA_DA_EXIBICAO)} />
          ))}
        </InputOTPGroup>
      ))}
    </InputOTP>
  );
}
