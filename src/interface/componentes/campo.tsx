import { CircleAlertIcon, CircleXIcon, InfoIcon, LoaderCircleIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/interface/componentes/utilitarios";

/**
 * ============================================================================
 *  As peças de forma do formulário — guia §7 (16/09/2026), item 44g
 * ============================================================================
 *
 * | Regra do guia | Peça |
 * |---|---|
 * | Campo obrigatório: `*` em `--destructive` depois do rótulo | `Campo`, `GrupoDeEscolha` |
 * | Campo com problema: borda e anel em `--destructive`, e a mensagem embaixo, com ícone | `Campo` (o anel é de `ui/input.tsx` e `ui/textarea.tsx`), `GrupoDeEscolha` |
 * | O rodapé diz "campo obrigatório" à esquerda; botões só no rodapé, à direita | `RodapeDoFormulario` |
 * | A mensagem que não é de um campo | `ErroDoFormulario` |
 * | Durante o envio, o botão mostra o indicador | `IndicadorDeEnvio` |
 * | O contador *"20 / 120"* à direita do rótulo (item 44i) | `Campo`, propriedade `contador` |
 * | O rodapé da página própria, preso ao fim do conteúdo (item 44j) | `RodapeDaPagina` |
 *
 * **O `Campo` morava na moldura antiga das telas de celular** até o item 44g; o campo é do produto
 * inteiro, e aquela moldura foi apagada no 44o. Os compromissos que ele já cumpria continuam: **A-1**
 * (rótulo ligado ao controle por `htmlFor`, e por isso `id` é obrigatório) e **A-5** (o erro é texto, e o
 * ícone só acompanha).
 *
 * **O `*` é `aria-hidden`.** O nome acessível do campo continua sendo o rótulo, e quem diz que o campo é
 * obrigatório ao leitor de tela é o `aria-required` do controle. A nota do rodapé diz o que o asterisco
 * significa em palavra.
 *
 * **O filho do `Campo` pode ser uma função, e é o modo das telas que seguem o guia.** Ela recebe as
 * propriedades do controle: `id`, `aria-describedby` apontando para a ajuda e para o erro, `aria-invalid`
 * quando há erro visível, e `aria-required`. Nesse modo a mensagem **não** é `role="alert"`: a primeira
 * tecla pode acender vários erros de uma vez, e cada `alert` seria lido em voz alta; a mensagem chega pela
 * descrição do campo, e o envio com problema leva o foco ao primeiro campo, que a lê.
 *
 * **Com um elemento como filho, o `Campo` não injeta nada e mantém o `alert`.** É o modo das telas que
 * ainda não foram refeitas (T-04, T-09 e T-14), onde o controle não aponta para a mensagem; sem o
 * `alert`, o erro ficaria sem anúncio. Cada item de tela troca para a função quando a reconstrói, e o
 * modal do nome de T-15 e T-16 (item 44i) já nasceu nela.
 *
 * **O contador fica fora do `<label>`** (item 44i): dentro, ele entraria no nome acessível do campo. Ele
 * conta o valor cru, que é o que o `maxLength` limita, e não é região viva, porque seria anunciado a cada
 * tecla. Quem não passa `contador` recebe o mesmo HTML de antes.
 *
 * **A ajuda pode vir antes do controle** (`ajudaAntes`): os modais de T-05 põem o aviso de visibilidade
 * antes do campo (critério 22.5), e foi por isso que eles não usavam o `Campo` até aqui.
 *
 * **Sem `"use client"`:** nenhuma peça tem estado. A função filha só existe dentro de componente de
 * cliente, que é quem a escreve.
 */

export type PropsDoControle = {
  readonly id: string;
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: true;
  readonly "aria-required"?: true;
};

function Asterisco() {
  return (
    <span aria-hidden="true" className="text-destructive">
      {" *"}
    </span>
  );
}

function MensagemDeCampo({ id, alerta, children }: { id: string; alerta: boolean; children: ReactNode }) {
  return (
    <p
      id={id}
      role={alerta ? "alert" : undefined}
      className="text-destructive text-meta flex items-center gap-1.5"
    >
      <CircleAlertIcon aria-hidden="true" className="size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** O *"20 / 120"* da prancheta: quantos caracteres o campo tem, e o teto dele. */
export type Contador = { readonly usados: number; readonly maximo: number };

export function Campo({
  id,
  rotulo,
  obrigatorio = false,
  ajuda,
  ajudaAntes = false,
  erro,
  contador,
  rotuloEmTelaGrande = "visivel",
  rotuloOculto = false,
  children,
}: {
  id: string;
  rotulo: string;
  obrigatorio?: boolean;
  ajuda?: ReactNode;
  ajudaAntes?: boolean;
  erro?: string | undefined;
  contador?: Contador | undefined;
  /**
   * `"oculto"` esconde o rótulo a partir de `lg`, onde uma linha de cabeçalho o substitui — é a grade de
   * contatos de T-08 (item 44j). O controle continua nomeado, por `aria-label`.
   */
  rotuloEmTelaGrande?: "visivel" | "oculto";
  /**
   * Esconde o rótulo da vista em qualquer largura, e ele continua sendo o `<label>` do controle. É o
   * campo da solução aplicada de T-05 (item 44q): a faixa do cartão já escreve *Solução aplicada*, e o
   * rótulo visível repetiria a mesma palavra logo abaixo.
   */
  rotuloOculto?: boolean;
  children: ReactNode | ((controle: PropsDoControle) => ReactNode);
}) {
  const idDaAjuda = `${id}-ajuda`;
  const idDoErro = `${id}-erro`;
  const descritoPor = [ajuda === undefined ? null : idDaAjuda, erro === undefined ? null : idDoErro]
    .filter((parte) => parte !== null)
    .join(" ");

  const controle: PropsDoControle = {
    id,
    ...(descritoPor === "" ? {} : { "aria-describedby": descritoPor }),
    ...(erro === undefined ? {} : { "aria-invalid": true }),
    ...(obrigatorio ? { "aria-required": true } : {}),
  };

  const textoDeAjuda =
    ajuda === undefined ? null : (
      <span id={idDaAjuda} className="text-tinta-suave text-meta">
        {ajuda}
      </span>
    );

  const rotuloDoCampo = (
    <label
      htmlFor={id}
      className={cn(
        "text-tinta text-interface font-medium",
        rotuloEmTelaGrande === "oculto" && "lg:sr-only",
        rotuloOculto && "sr-only",
      )}
    >
      {rotulo}
      {obrigatorio && <Asterisco />}
    </label>
  );

  return (
    <div className="flex flex-col gap-1.5">
      {contador === undefined ? (
        rotuloDoCampo
      ) : (
        <div className="flex items-baseline justify-between gap-3">
          {rotuloDoCampo}
          <span className="text-tinta-fraca text-meta shrink-0 font-mono tabular-nums">
            {contador.usados} / {contador.maximo}
          </span>
        </div>
      )}
      {ajudaAntes && textoDeAjuda}
      {typeof children === "function" ? children(controle) : children}
      {!ajudaAntes && textoDeAjuda}
      {erro !== undefined && (
        <MensagemDeCampo id={idDoErro} alerta={typeof children !== "function"}>
          {erro}
        </MensagemDeCampo>
      )}
    </div>
  );
}

export function GrupoDeEscolha({
  id,
  legenda,
  obrigatorio = false,
  erro,
  children,
}: {
  id: string;
  legenda: string;
  obrigatorio?: boolean;
  erro?: string | undefined;
  children: ReactNode;
}) {
  const idDoErro = `${id}-erro`;
  return (
    <fieldset
      id={id}
      aria-describedby={erro === undefined ? undefined : idDoErro}
      data-invalido={erro === undefined ? undefined : ""}
      className="group flex min-w-0 flex-col gap-1.5"
    >
      <legend className="text-tinta text-interface mb-1.5 px-0 font-medium">
        {legenda}
        {obrigatorio && <Asterisco />}
      </legend>
      {children}
      {erro !== undefined && (
        <MensagemDeCampo id={idDoErro} alerta={false}>
          {erro}
        </MensagemDeCampo>
      )}
    </fieldset>
  );
}

export function ErroDoFormulario({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="border-destructive/[55%] bg-destructive/[8%] text-tinta text-interface flex gap-2.5 rounded-lg border px-3.5 py-2.5"
    >
      <CircleXIcon aria-hidden="true" className="text-destructive mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * A faixa que fala do formulário inteiro, e não de um campo.
 *
 * **Morava na moldura antiga das telas fora da casca** até o item 44m, e mudou de casa pela razão que
 * mudou o `Campo` no 44g: a faixa é do produto inteiro. A moldura antiga foi apagada no 44o.
 *
 * `tom="recusa"` é o erro, e desenha o mesmo `ErroDoFormulario` do resto do produto. `tom="nota"` é o
 * aviso que **não** é erro — *"Conta confirmada."*, *"Você já está em …"* — e desde o 44m ele também
 * carrega ícone: o critério 6 pede faixa com ícone nos dois tons, e sem isso o produto teria dois
 * desenhos para a mesma coisa. A diferença entre os dois é de forma e de ícone, não de cor sozinha (A-5).
 */
export function Aviso({ tom = "recusa", children }: { tom?: "recusa" | "nota"; children: ReactNode }) {
  if (tom === "recusa") return <ErroDoFormulario>{children}</ErroDoFormulario>;

  return (
    <div
      role="alert"
      className="border-linha bg-superficie text-tinta text-interface flex gap-2.5 rounded-lg border px-3.5 py-2.5"
    >
      <InfoIcon aria-hidden="true" className="text-tinta-suave mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function RodapeDoFormulario({
  obrigatorios,
  todosObrigatorios = false,
  larguraCheia = false,
  children,
}: {
  obrigatorios: number;
  /**
   * **Quando todo campo do formulário é obrigatório, a nota sai e o asterisco fica** (guia §7,
   * 20/09/2026, com as telas de conta). Ela serve para *distinguir* campo obrigatório de opcional, e
   * não há o que distinguir. O asterisco fica porque quem chega ao campo pelo leitor de tela ouve o
   * `aria-required`, e quem lê a tela vê a marca.
   */
  todosObrigatorios?: boolean;
  /**
   * **O botão ocupa a largura do cartão** (item 64, troca 3): Entrar e Criar conta, que têm uma ação só e
   * um cartão de 420 px. A coluna não vira linha em `sm`, e o botão estica pelo `align-items: stretch`
   * da coluna. Os outros formulários continuam com o botão à direita.
   */
  larguraCheia?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={
        larguraCheia ? "flex flex-col gap-3" : "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end"
      }
    >
      {obrigatorios > 0 && !todosObrigatorios && (
        <p className="text-tinta-fraca text-meta sm:mr-auto">
          <span aria-hidden="true" className="text-destructive">
            *
          </span>{" "}
          {obrigatorios === 1 ? "campo obrigatório" : "campos obrigatórios"}
        </p>
      )}
      <div className={larguraCheia ? "flex flex-col gap-2.5" : "flex flex-col-reverse gap-2.5 sm:flex-row"}>
        {children}
      </div>
    </div>
  );
}

/**
 * O rodapé da **página** própria de criar ou editar (guia §7, item 44j): o mesmo rodapé do modal, preso
 * ao fim da área de conteúdo e alcançando as bordas dela. As margens negativas desfazem o respiro que a
 * casca dá ao conteúdo; quando o formulário é curto, a faixa fica logo depois dele.
 */
export function RodapeDaPagina({ obrigatorios, children }: { obrigatorios: number; children: ReactNode }) {
  return (
    <div className="border-linha bg-superficie sticky bottom-0 z-10 -mx-4 -mb-6 border-t px-4 py-3.5 md:-mx-6 md:px-6">
      <RodapeDoFormulario obrigatorios={obrigatorios}>{children}</RodapeDoFormulario>
    </div>
  );
}

/** **Gira só sem preferência por movimento reduzido** (guia §6). O verbo no gerúndio diz o resto. */
export function IndicadorDeEnvio({ ativo }: { ativo: boolean }) {
  if (!ativo) return null;
  return <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" />;
}
