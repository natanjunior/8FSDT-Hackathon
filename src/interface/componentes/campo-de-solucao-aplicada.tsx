"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import {
  Campo,
  ErroDoFormulario,
  IndicadorDeEnvio,
  RodapeDoFormulario,
} from "@/interface/componentes/campo";
import { executarComando } from "@/interface/componentes/comando-de-ocorrencia";
import {
  avisarErro,
  avisarSucesso,
  type TextosDoRetorno,
} from "@/interface/componentes/retorno-de-acao";
import { Button } from "@/interface/componentes/ui/button";
import { Textarea } from "@/interface/componentes/ui/textarea";
import { useFormularioTocado } from "@/interface/ganchos/use-formulario-tocado";

/**
 * ============================================================================
 *  O bloco de T-05 que NÃO é modal — e é o único assim
 * ============================================================================
 *
 * Os cinco comandos com formulário abrem modal; este mora **no corpo da tela**, e a decisão é do
 * inventário, não deste componente: *"Registrar solução aplicada · **campo no corpo da tela**, não modal"*
 * (`inventario-de-telas.md`). O protótipo desenha o bloco entre a descrição e a linha do tempo, com
 * rótulo, `textarea` de 4.000 e um *Salvar* discreto (`telas.html`).
 *
 * **Por que não vira o `useComandoDeModal` que a spec do item 26 esboçou.** O ciclo dos cinco modais tem
 * `aberto`, `precisaRepintar` e repinte **no fechamento** — porque repintar no erro desmontaria o modal no
 * exato caso em que a frase do `409` existe para ser lida (furo F-2 do item 19). **Aqui nada desmonta:** o
 * bloco fica na tela, então o repinte acontece no sucesso e a frase de erro sobrevive sozinha. A extração
 * continua sendo dos cinco modais; este não é o sexto caso.
 *
 * **O repinte NÃO remonta este componente.** `router.refresh()` re-renderiza a página do servidor e a
 * prop `valorAtual` chega com o texto novo; o estado `texto` permanece, porque o componente não é
 * desmontado, e é por isso que o formulário recomeça depois do sucesso: sem isso, o texto igual ao salvo
 * acenderia a mensagem de campo.
 *
 * **O retorno (guia §7, item 44g).** Salvar responde com aviso; a linha *"Solução aplicada salva."* saiu,
 * porque o aviso a substitui. **O *Salvar* só fica inerte durante o envio.** Vazio, ele mostra *"Escreva o
 * que foi feito."*; igual ao que está salvo, *"Altere o texto antes de salvar."*. O segundo caso **não
 * envia** de propósito: o campo é pré-preenchido com o valor da renderização, e se outro Gestor salvou
 * depois, o reenvio sobrescreveria o texto dele com o velho (a janela que o item 25 fechou).
 *
 * **O aviso de visibilidade NÃO está aqui**, e é a letra da restrição herdada nº 1 do inventário: ela
 * enumera *"todo modal que tem campo `observacao`"*, e isto não é modal nem `observacao`. Que este campo
 * também é lido pelo Solicitante e também congela em `resolvida` é verdade e **não tem texto em documento
 * nenhum** — é o achado **A-2** da spec, e inventar a frase aqui seria escrever texto de produto num
 * componente.
 *
 * **Acessibilidade:** `<label htmlFor>` pelo `Campo` (**A-1**), `min-h-11` no campo e `h-11` no botão
 * (**A-3**), e o erro em palavra (**A-5**). O DOM é linear, então a ordem de foco é a de leitura.
 */
function erroDaSolucao(texto: string, salvo: string): string | undefined {
  if (texto.trim() === "") return "Escreva o que foi feito.";
  if (texto === salvo) return "Altere o texto antes de salvar.";
  return undefined;
}

export function CampoDeSolucaoAplicada({
  ocorrenciaId,
  valorAtual,
  rotulosDeStatus,
  organizacaoId,
  retorno,
}: {
  ocorrenciaId: string;
  /** O que está gravado. **O campo abre pré-preenchido**, e não vazio: é registro, não rascunho. */
  valorAtual: string | null;
  /** O mapa pronto, para a frase do `409`. O navegador não monta rótulo. */
  rotulosDeStatus: Readonly<Record<string, string>>;
  /** A organização com que a página renderizou — a afirmação da §4.3 (item 7b, critério 7b.6). */
  organizacaoId: string;
  /** Os títulos do aviso, prontos (`RETORNO_DO_COMANDO`). */
  retorno: TextosDoRetorno;
}) {
  const router = useRouter();
  const campoId = useId();
  const [texto, setTexto] = useState(valorAtual ?? "");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const formulario = useFormularioTocado({
    campos: { solucao: campoId },
    erros: { solucao: erroDaSolucao(texto, valorAtual ?? "") },
  });

  async function salvar() {
    if (enviando || !formulario.tentarEnviar()) return;
    setEnviando(true);
    setAviso(null);

    // **A tela manda o que digitou, sem aparar.** Quem apara é o schema, num lugar só.
    const resultado = await executarComando(
      ocorrenciaId,
      "registrar-solucao-aplicada",
      { solucaoAplicada: texto },
      rotulosDeStatus,
      organizacaoId,
    );

    setEnviando(false);

    if (resultado.ok) {
      avisarSucesso(retorno.sucesso);
      formulario.recomecar();
      // **O repinte acontece no sucesso**, e não no fechamento: não há fechamento.
      router.refresh();
      return;
    }

    setAviso(resultado.aviso);
    avisarErro(retorno.falha);
  }

  return (
    <section className="flex flex-col gap-2">
      <Campo id={campoId} rotulo="Solução aplicada" erro={formulario.erroDe("solucao")}>
        {(controle) => (
          <Textarea
            {...controle}
            value={texto}
            onChange={(evento) => {
              setTexto(evento.target.value);
              // Aviso velho ao lado de texto novo é a pior combinação possível.
              setAviso(null);
              formulario.mudou("solucao");
            }}
            disabled={enviando}
            rows={4}
            /* **O mesmo teto do schema** — 4000. Dois números divergiriam. */
            maxLength={4000}
          />
        )}
      </Campo>

      {aviso !== null && <ErroDoFormulario>{aviso}</ErroDoFormulario>}

      <RodapeDoFormulario obrigatorios={0}>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={enviando}
          onClick={() => void salvar()}
        >
          <IndicadorDeEnvio ativo={enviando} />
          {enviando ? "Salvando…" : "Salvar"}
        </Button>
      </RodapeDoFormulario>
    </section>
  );
}
