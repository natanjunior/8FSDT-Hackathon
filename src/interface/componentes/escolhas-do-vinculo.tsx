"use client";

import { Campo } from "@/interface/componentes/campo";
import {
  PAPEIS,
  TEXTOS_DA_RESPOSTA,
  papelDoValor,
  type Papel,
} from "@/interface/componentes/frases-de-participantes";
import { SEM_UNIDADE, areaDoSeletor, seletorDaArea } from "@/interface/componentes/regras-do-vinculo";
import { RadioGroup, RadioGroupItem } from "@/interface/componentes/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/interface/componentes/ui/select";
import { cn } from "@/interface/componentes/utilitarios";

/**
 * ============================================================================
 *  As duas escolhas de um vínculo — o papel e a unidade (item 44j)
 * ============================================================================
 *
 * **Dois consumidores:** o modal de responder um pedido e a página de cadastrar. Escrever uma vez é o
 * que impede que a mesma escolha apareça de duas formas em duas telas — e o papel já estava escrito
 * duas vezes antes deste item.
 *
 * **A escolha de papel é a do PA-25, sem exceção:** nada pré-marcado, a consequência escrita onde a
 * escolha é feita, e o principal nunca desabilitado. *Não existe papel que se obtém por não escolher.*
 *
 * **O `id` da primeira opção é o alvo do foco** quando o envio acha problema: é o botão visível, e não o
 * rádio escondido que o primitivo desenha dentro de um formulário.
 *
 * **A unidade é assimétrica ao papel, e a razão é o custo do erro:** papel errado só se conserta
 * removendo o vínculo; unidade errada se conserta com um `PATCH`. Por isso ela **tem** padrão — *Sem
 * unidade* —, e o papel não tem.
 */

export function idDaOpcaoDePapel(prefixo: string, papel: Papel): string {
  return `${prefixo}-${papel}`;
}

export function OpcoesDePapel({
  id,
  rotulo,
  valor,
  inerte,
  aoMudar,
  emColunas = false,
}: {
  readonly id: string;
  readonly rotulo: string;
  readonly valor: Papel | null;
  readonly inerte: boolean;
  readonly aoMudar: (papel: Papel) => void;
  /** Três colunas a partir de `lg`, como a prancheta do cadastro desenha. */
  readonly emColunas?: boolean;
}) {
  return (
    <RadioGroup
      aria-label={rotulo}
      value={valor ?? ""}
      disabled={inerte}
      onValueChange={(escolhido) => {
        const papel = papelDoValor(escolhido);
        if (papel !== null) aoMudar(papel);
      }}
      className={cn("gap-2", emColunas && "lg:grid-cols-3")}
    >
      {PAPEIS.map((opcao) => {
        const idDaOpcao = idDaOpcaoDePapel(id, opcao.papel);
        return (
          <label
            key={opcao.papel}
            htmlFor={idDaOpcao}
            className={cn(
              "border-linha bg-background flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-2.5",
              "has-[[data-state=checked]]:border-marca has-[[data-state=checked]]:bg-marca/[7%]",
              "group-data-invalido:border-destructive/[75%]",
            )}
          >
            <RadioGroupItem
              id={idDaOpcao}
              value={opcao.papel}
              className="border-tinta-fraca text-tinta-marca data-[state=checked]:border-marca mt-0.5 [&_svg]:fill-tinta-marca"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-interface text-tinta font-semibold">{opcao.rotulo}</span>
              <span className="text-meta text-tinta-suave">
                {opcao.consequencia}
                {opcao.alerta !== null && (
                  <>
                    {" "}
                    <strong className="text-tinta font-semibold">{opcao.alerta}</strong>
                  </>
                )}
              </span>
            </span>
          </label>
        );
      })}
    </RadioGroup>
  );
}

export function CampoDeUnidade({
  id,
  valor,
  areas,
  inerte,
  aoMudar,
}: {
  readonly id: string;
  readonly valor: string | null;
  readonly areas: ReadonlyArray<{ readonly id: string; readonly nome: string }>;
  readonly inerte: boolean;
  readonly aoMudar: (areaId: string | null) => void;
}) {
  return (
    <Campo id={id} rotulo={TEXTOS_DA_RESPOSTA.unidade} ajuda={TEXTOS_DA_RESPOSTA.ajudaDaUnidade}>
      {(controle) => (
        <Select
          value={seletorDaArea(valor)}
          disabled={inerte}
          onValueChange={(escolhido) => {
            aoMudar(areaDoSeletor(escolhido));
          }}
        >
          <SelectTrigger {...controle} className="border-linha bg-background text-interface min-h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_UNIDADE}>{TEXTOS_DA_RESPOSTA.semUnidade}</SelectItem>
            {areas.map((area) => (
              <SelectItem key={area.id} value={area.id}>
                {area.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Campo>
  );
}
