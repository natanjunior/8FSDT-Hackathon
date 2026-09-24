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
 */

const GRUPO = "flex flex-1 sm:flex-none";

// `dark:bg-background` desfaz o `dark:bg-input/30` da casa do catálogo: sem ele, o `bg-background` não vence
// no tema escuro (o `tailwind-merge` não funde classes de variantes diferentes), e a casa sai da cor do --ground.
const CASA =
  "border-linha bg-background dark:bg-background text-tinta font-mono uppercase data-[active=true]:ring-marca/40 data-[active=true]:border-marca";

const CASA_DA_ENTRADA = "min-w-0 flex-1 h-[52px] sm:w-10 sm:flex-none md:w-12 md:h-14 text-titulo-bloco";

const CASA_DA_EXIBICAO = "h-14 w-12 text-titulo-pagina select-none";

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
 */
export function ExibicaoDeCodigo({ codigo, rotulo }: { codigo: string; rotulo: string }) {
  return (
    <InputOTP
      value={codigo}
      maxLength={codigo.length}
      disabled
      aria-label={rotulo}
      containerClassName="gap-3.5 has-disabled:opacity-100"
    >
      {casasDosGrupos(codigo.length).map((grupo) => (
        <InputOTPGroup key={grupo[0]}>
          {grupo.map((indice) => (
            <InputOTPSlot key={indice} index={indice} className={cn(CASA, CASA_DA_EXIBICAO)} />
          ))}
        </InputOTPGroup>
      ))}
    </InputOTP>
  );
}
