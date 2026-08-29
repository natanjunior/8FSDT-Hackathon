"use client";

import Link from "next/link";
import { useState } from "react";

import { segundaLinhaDeMotivo } from "@/interface/projecoes";
import type { OcorrenciaResumoProjetada, PaginaDeOcorrenciasProjetada } from "@/interface/projecoes";

import { IconeDeCategoria } from "./icone-de-categoria";
import { rotuloDePrioridade } from "./rotulos";
import { tempoCurto, tempoRelativo } from "./tempo-relativo";

/**
 * ============================================================================
 *  T-03 · a lista, nos três recortes
 * ============================================================================
 *
 * **Dois eixos independentes, e é o que o protótipo separou (D-2):** o **recorte**
 * (`visibilidadeAplicada`) escolhe a *densidade do item*; a **largura** escolhe *quantas colunas de
 * layout* existem. É por isso que o Gestor pedindo `?autor=eu` numa tela grande recebe itens altos numa
 * coluna só — que é exatamente o que ele quer ao ler as próprias.
 *
 * | Recorte | Onde | Forma |
 * |---|---|---|
 * | **A** · `apenas_minhas` | qualquer largura | cartão alto, rótulo em destaque, **sem prioridade** |
 * | **B** · `todas`, ≥ `md` | tabela | seis colunas de comparação |
 * | **C** · `todas`, celular | cartão de 3 linhas | **sem categoria** — achado P-04, aprovado pelo hub |
 *
 * **Nenhuma ação no item** (critério 14.5): `acoesDisponiveis` não existe no `OcorrenciaResumo`, e uma
 * ação de lote obrigaria o cliente a adivinhar quais itens a aceitam — a segunda cópia da máquina de
 * estados. O item inteiro é **um link para T-05**.
 *
 * **`agora` vem do servidor** e não de `Date.now()` aqui: a primeira renderização acontece no servidor e a
 * hidratação no navegador, e dois relógios produziriam dois textos.
 */
type Props = {
  primeiraPagina: PaginaDeOcorrenciasProjetada;
  /**
   * A *query string* de T-03, crua — o recorte que definiu esta lista. Vazia quando não há filtro.
   *
   * **Obrigatória de propósito** (item 15): opcional, um esquecimento em quem monta a lista faz o
   * *Carregar mais* voltar a perder o filtro em silêncio, e o compilador deixa de ser a garantia.
   */
  consultaAtual: string;
  /** `categoriaId → nome do ícone`, cruzado **no cliente** contra `GET /categorias` (critério 14.6). */
  iconePorCategoria: Readonly<Record<string, string>>;
  /**
   * A prioridade aparece para quem **pode alterá-la** — `ocorrencia.alterar_prioridade`.
   *
   * **Permissão, nunca recorte:** é a correção **P-03** do protótipo. A regra do inventário
   * (`visibilidadeAplicada == "todas"`) faria o Gestor que filtra pelas próprias perder a coluna de um
   * campo que ele mesmo altera. Está como achado A-3 na spec.
   */
  mostrarPrioridade: boolean;
  /** O instante da renderização no servidor. */
  agora: number;
};

export function ListaDeOcorrencias({
  primeiraPagina,
  consultaAtual,
  iconePorCategoria,
  mostrarPrioridade,
  agora,
}: Props) {
  const [itens, setItens] = useState<readonly OcorrenciaResumoProjetada[]>(primeiraPagina.itens);
  const [cursor, setCursor] = useState(primeiraPagina.proximoCursor);
  const [carregando, setCarregando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);

  /**
   * **Anexa, nunca substitui** — critério 14.7. E a falha **não** limpa o que já está na tela: a lista que
   * a pessoa já lê é dela, e esvaziá-la para mostrar um erro é perder o lugar por causa de uma requisição.
   */
  async function carregarMais() {
    if (cursor === null || carregando) return;

    setCarregando(true);
    setFalha(null);

    try {
      /**
       * **A consulta atual MAIS o cursor, nunca o cursor sozinho** — §3.7 da spec do item 15.
       *
       * O `proximoCursor` é uma posição **dentro de um conjunto**; pedi-lo sem o recorte que definiu esse
       * conjunto devolve a página seguinte de *outra* lista. Anexada à que já está na tela, ela mistura
       * dois conjuntos sem nenhum aviso — e a pessoa lê como dado, não como defeito.
       *
       * `consultaAtual` já vem sem `cursor`: quem a monta é a página, a partir dos `searchParams`, e toda
       * mudança de filtro apaga o cursor antes de navegar. Se ainda vier um — link colado com cursor na
       * URL —, o `set` abaixo o sobrescreve, que é o comportamento certo.
       */
      const destino = new URLSearchParams(consultaAtual);
      destino.set("cursor", cursor);
      const resposta = await fetch(`/api/ocorrencias?${destino.toString()}`);

      if (!resposta.ok) {
        setFalha("Não foi possível carregar mais agora. Tente de novo.");
        return;
      }

      const pagina = (await resposta.json()) as PaginaDeOcorrenciasProjetada;
      setItens((anteriores) => [...anteriores, ...pagina.itens]);
      setCursor(pagina.proximoCursor);
    } catch {
      setFalha("Sem conexão. A lista que você já tem continua aqui.");
    } finally {
      setCarregando(false);
    }
  }

  /**
   * **O recorte viaja com o link, e só quando existe** — a metade do critério 15.3 que fala do *Voltar*.
   *
   * Um `<Link href="/ocorrencias">` estático em T-05 devolveria a lista **do zero**: o gesto de voltar do
   * sistema preserva a URL, o **controle da tela** não. Com `?de=`, T-05 sabe para onde voltar mesmo quem
   * abriu o link numa aba nova, sem histórico — que é a condição que o critério 11.7 impõe ao endereço.
   *
   * **Sem filtro, o endereço não ganha nada:** `/ocorrencias/{id}` continua limpo, e é ele que se
   * compartilha. Quem copia a URL no meio de uma triagem filtrada leva `?de=` junto — inútil para quem
   * recebe, e inofensivo: T-05 não a usa para mais nada.
   *
   * **Montado aqui, e não recebido pronto da página.** O plano previa `destinoDoItem` descendo como
   * propriedade, mas este é um Client Component e **função não atravessa a fronteira do servidor**. A
   * regra é a mesma; a peça que atravessa é `consultaAtual`, que é texto.
   */
  const destinoDoItem = (id: string) =>
    consultaAtual === ""
      ? `/ocorrencias/${id}`
      : `/ocorrencias/${id}?de=${encodeURIComponent(consultaAtual)}`;

  const comum = { destinoDoItem, iconePorCategoria, mostrarPrioridade, agora };

  return (
    <div className="flex flex-col gap-4">
      {primeiraPagina.visibilidadeAplicada === "apenas_minhas" ? (
        <ul className="flex flex-col gap-3">
          {itens.map((item) => (
            <CartaoDoSolicitante key={item.id} item={item} {...comum} />
          ))}
        </ul>
      ) : (
        <>
          <ul className="flex flex-col gap-3 md:hidden">
            {itens.map((item) => (
              <CartaoDeTriagem key={item.id} item={item} {...comum} />
            ))}
          </ul>
          <TabelaDeTriagem itens={itens} {...comum} />
        </>
      )}

      {falha !== null && (
        <p role="alert" className="text-destructive text-sm">
          {falha}
        </p>
      )}

      {cursor !== null && (
        <button
          type="button"
          onClick={carregarMais}
          disabled={carregando}
          className="border-linha text-tinta min-h-11 w-full rounded-md border text-sm font-medium disabled:opacity-60"
        >
          {carregando ? "Carregando…" : "Carregar mais"}
        </button>
      )}
    </div>
  );
}

type PropsDoItem = {
  item: OcorrenciaResumoProjetada;
  /** O endereço de T-05 **com o recorte de origem**, quando há um. */
  destinoDoItem: (id: string) => string;
  iconePorCategoria: Readonly<Record<string, string>>;
  mostrarPrioridade: boolean;
  agora: number;
};

/**
 * **Recorte A.** O `statusRotulo` é a primeira linha e é o que fica em destaque — é a resposta literal a
 * *"o que aconteceu com o meu pedido?"*. Sem prioridade: é decisão do Gestor, e não há nada que o
 * Solicitante faça com ela.
 */
function CartaoDoSolicitante({ item, destinoDoItem, iconePorCategoria, agora }: PropsDoItem) {
  return (
    <li>
      <Link
        href={destinoDoItem(item.id)}
        className="border-linha bg-superficie flex min-h-11 flex-col gap-1 rounded-md border px-4 py-3"
      >
        <span className="text-tinta text-sm font-semibold">{item.statusRotulo}</span>
        <span className="text-tinta text-base leading-snug">{item.titulo}</span>
        <span className="text-tinta-suave flex items-center gap-1.5 text-xs">
          <IconeDeCategoria
            nome={iconePorCategoria[item.categoria.id] ?? "tag"}
            className="size-3.5 shrink-0"
          />
          {item.categoria.nome} · {item.area.nome}
          {item.quantidadeDeAnexos > 0 && ` · ${item.quantidadeDeAnexos} foto`}
        </span>
        <span className="text-tinta-fraca text-xs">
          {item.responsavel !== null && `${item.responsavel.nome} está cuidando · `}
          {tempoRelativo(item.registradaEm, agora)}
        </span>
      </Link>
    </li>
  );
}

/**
 * **Recorte C — o caso que o inventário não cobria**, e é a tela da Persona 1A: o síndico que mora no
 * prédio e anda por ele com o celular na mão.
 *
 * **Cai a categoria, e com ela o ícone.** É o achado **P-04**, aprovado pelo hub ao responder a P3: a
 * categoria é a dimensão pela qual o Gestor **recorta**, não a que ele **compara**. O critério 14.6 vale
 * nos recortes que exibem o nome — *"ao lado do nome, nunca no lugar dele"* é regra que se autolimita.
 */
function CartaoDeTriagem({ item, destinoDoItem, mostrarPrioridade, agora }: PropsDoItem) {
  /** **A segunda metade só sai quando acrescenta informação** — critério 23.6. Até o item 31 o
   *  `statusRotulo` já É o rótulo do motivo, e imprimir os dois repetiria a mesma frase. */
  const segundaLinha = segundaLinhaDeMotivo(item.motivoPausa, item.statusRotulo);

  return (
    <li>
      <Link
        href={destinoDoItem(item.id)}
        className="border-linha bg-superficie flex min-h-11 flex-col gap-1 rounded-md border px-4 py-3"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-tinta text-sm font-semibold">
            {item.statusRotulo}
            {segundaLinha !== null && ` · ${segundaLinha}`}
          </span>
          {/* A-5: a prioridade carrega a palavra. Nunca só a cor. */}
          {mostrarPrioridade && (
            <span className="text-tinta-suave border-linha shrink-0 rounded border px-1.5 py-0.5 text-xs">
              {rotuloDePrioridade(item.prioridade)}
            </span>
          )}
        </span>
        <span className="text-tinta text-base leading-snug">{item.titulo}</span>
        <span className="text-tinta-suave text-xs">
          {item.area.nome} · {item.responsavel?.nome ?? "sem responsável"} ·{" "}
          {tempoCurto(item.registradaEm, agora)} ↻ {tempoCurto(item.atualizadaEm, agora)}
        </span>
      </Link>
    </li>
  );
}

/**
 * **Recorte B — a tabela de triagem.**
 *
 * **Uma linha por ocorrência, e o secundário vai como segunda linha dentro da célula.** O protótipo
 * desenha duas `<tr>` por item com truque de borda; aqui não, e a razão é o compromisso **A-7**, *tabela
 * de verdade*: numa tabela, uma linha **é** um registro, e duas `<tr>` por ocorrência mentem para quem
 * navega por leitor de tela.
 *
 * **`registradaEm` e `atualizadaEm` dividem a coluna TEMPO**, a segunda marcada por `↻` — o protótipo:
 * *"duas colunas de data numa tabela de triagem é uma coluna a mais para uma leitura que ninguém faz de
 * relance"*.
 */
function TabelaDeTriagem({
  itens,
  destinoDoItem,
  iconePorCategoria,
  mostrarPrioridade,
  agora,
}: {
  itens: readonly OcorrenciaResumoProjetada[];
  destinoDoItem: (id: string) => string;
  iconePorCategoria: Readonly<Record<string, string>>;
  mostrarPrioridade: boolean;
  agora: number;
}) {
  return (
    <div className="hidden md:block">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="text-tinta-suave border-linha border-b">
            <th scope="col" className="py-2 pr-3 font-medium">
              Status
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Título
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Onde
            </th>
            {mostrarPrioridade && (
              <th scope="col" className="py-2 pr-3 font-medium">
                Prioridade
              </th>
            )}
            <th scope="col" className="py-2 pr-3 font-medium">
              Responsável
            </th>
            <th scope="col" className="py-2 font-medium">
              Tempo
            </th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => (
            <tr key={item.id} className="border-linha border-b align-top">
              <td className="py-3 pr-3">
                <span className="text-tinta block">{item.statusRotulo}</span>
                {/* **A MESMA função do cartão** — critério 23.6. Duas condições que precisam concordar
                    em dois lugares é o defeito que o item 22 consertou ao criar `acaoPrimaria`. */}
                {segundaLinhaDeMotivo(item.motivoPausa, item.statusRotulo) !== null && (
                  <span className="text-tinta-suave block text-xs">
                    {segundaLinhaDeMotivo(item.motivoPausa, item.statusRotulo)}
                  </span>
                )}
              </td>
              <td className="py-3 pr-3">
                <Link
                  href={destinoDoItem(item.id)}
                  className="text-tinta font-medium underline-offset-4 hover:underline"
                >
                  {item.titulo}
                </Link>
                <span className="text-tinta-suave mt-0.5 flex items-center gap-1.5 text-xs">
                  <IconeDeCategoria
                    nome={iconePorCategoria[item.categoria.id] ?? "tag"}
                    className="size-3.5 shrink-0"
                  />
                  {item.categoria.nome}
                  {item.quantidadeDeAnexos > 0 && ` · ${item.quantidadeDeAnexos} foto`}
                </span>
              </td>
              <td className="text-tinta-suave py-3 pr-3">{item.area.nome}</td>
              {mostrarPrioridade && (
                <td className="text-tinta-suave py-3 pr-3">{rotuloDePrioridade(item.prioridade)}</td>
              )}
              <td className="text-tinta-suave py-3 pr-3">{item.responsavel?.nome ?? "—"}</td>
              <td className="text-tinta-suave py-3 whitespace-nowrap">
                <span className="block">{tempoCurto(item.registradaEm, agora)}</span>
                <span className="block text-xs">↻ {tempoCurto(item.atualizadaEm, agora)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
