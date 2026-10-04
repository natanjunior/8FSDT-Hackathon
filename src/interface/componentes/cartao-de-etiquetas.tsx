"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import { CabecaDoCartao, Cartao } from "@/interface/componentes/cartao";
import {
  LIMITE_DO_NOME,
  TEXTO_DO_LIMITE,
  diferencaDaEscolha,
  nomeParaCriar,
  sugestoes,
  type EtiquetaNaTela,
} from "@/interface/componentes/etiquetas-de-participante";
import { avisarErro, avisarSucesso, mensagemDoProblema } from "@/interface/componentes/retorno-de-acao";
import { MultiSelect, type MultiSelectOption } from "@/interface/componentes/ui/multi-select";

/**
 * ============================================================================
 *  T-08 · editar participante — as etiquetas (itens 115 e 120)
 * ============================================================================
 *
 * **Depois de Contatos, e fora do formulário** (item 120, ordem do dono em 03/10). O formulário salva no
 * rodapé; este cartão grava a cada gesto. Ele fica entre Contatos e o rodapé, mas fora do elemento
 * `<form>` — o botão de salvar se liga ao formulário pelo atributo `form` —, e o apoio diz que a mudança
 * vale na hora, para o cartão não ser lido como campo que espera *Salvar* (a razão do 115).
 *
 * **A peça é a seleção múltipla do `@designrevision`** (item 120, bloco 4), com a busca e a regra de criar
 * do projeto: sugerir ignora acento; criar não — as duas regras de `etiquetas-de-participante.ts`.
 *
 * **Cada gesto é uma escrita.** A peça devolve a lista inteira; `diferencaDaEscolha` acha o que entrou ou
 * saiu. Enquanto a escrita corre, o valor mostrado já é o novo; se falhar, volta ao que era.
 */
export function CartaoDeEtiquetas({
  pessoaId,
  nome,
  organizacaoId,
  daPessoa,
  todas,
}: {
  pessoaId: string;
  nome: string;
  organizacaoId: string;
  daPessoa: readonly EtiquetaNaTela[];
  todas: readonly EtiquetaNaTela[];
}) {
  const router = useRouter();
  const doServidor = daPessoa.map((etiqueta) => etiqueta.id);
  const [escolhidas, setEscolhidas] = useState<readonly string[]>(doServidor);
  const [vistas, setVistas] = useState<readonly string[]>(doServidor);
  const [gravando, setGravando] = useState(false);

  // O servidor mandou outra lista (depois do `router.refresh`): o valor acompanha. Durante a renderização,
  // sem efeito — o padrão do `CampoDoTitulo` de T-03.
  if (doServidor.join() !== vistas.join()) {
    setVistas(doServidor);
    setEscolhidas(doServidor);
  }

  const opcoes: MultiSelectOption[] = todas.map((etiqueta) => ({ value: etiqueta.id, label: etiqueta.nome }));
  const nomeDe = (valor: string) => todas.find((etiqueta) => etiqueta.id === valor)?.nome ?? valor;

  async function mudar(proximas: string[]): Promise<void> {
    const mudanca = diferencaDaEscolha(escolhidas, proximas);
    if (mudanca === null || gravando) return;
    const anteriores = escolhidas;
    setEscolhidas(proximas);
    setGravando(true);
    try {
      const resposta =
        mudanca.tipo === "entrou"
          ? await fetch(`/api/vinculos/${pessoaId}/etiquetas`, {
              method: "POST",
              headers: { "content-type": "application/json", ...cabecalhosDeEscrita(organizacaoId) },
              body: JSON.stringify({ nome: nomeDe(mudanca.valor) }),
            })
          : await fetch(`/api/vinculos/${pessoaId}/etiquetas/${mudanca.valor}`, {
              method: "DELETE",
              headers: cabecalhosDeEscrita(organizacaoId),
            });
      if (!resposta.ok) {
        setEscolhidas(anteriores);
        avisarErro(
          mudanca.tipo === "entrou" ? "Não foi possível adicionar a etiqueta." : "Não foi possível tirar a etiqueta.",
          mensagemDoProblema(await resposta.json().catch(() => null)),
        );
        return;
      }
      avisarSucesso(`${nomeDe(mudanca.valor)} ${mudanca.tipo === "entrou" ? "adicionada" : "tirada"}`);
      router.refresh();
    } catch {
      setEscolhidas(anteriores);
      avisarErro("Não foi possível gravar a etiqueta.", "Verifique a conexão e tente de novo.");
    } finally {
      setGravando(false);
    }
  }

  return (
    <Cartao tituloId="bloco-etiquetas">
      <CabecaDoCartao id="bloco-etiquetas" titulo="Etiquetas" apoio="Cada mudança vale na hora." />
      <div className="p-[15px] md:p-[18px]">
        <MultiSelect
          aria-label={`Etiquetas de ${nome}`}
          options={opcoes}
          value={[...escolhidas]}
          onChange={(proximas) => void mudar(proximas)}
          disabled={gravando}
          creatable
          placeholder="Adicionar etiqueta"
          textoDaBusca="Buscar ou criar"
          emptyText="Nenhuma etiqueta com esse nome."
          filtrar={(_opcoes, consulta) => {
            const sugeridas = sugestoes(todas, [], consulta);
            return sugeridas.map((etiqueta) => ({ value: etiqueta.id, label: etiqueta.nome }));
          }}
          podeCriar={(consulta) => nomeParaCriar(todas, consulta) !== null}
          avisoDaBusca={(consulta) => (consulta.trim().length > LIMITE_DO_NOME ? TEXTO_DO_LIMITE : null)}
        />
      </div>
    </Cartao>
  );
}
