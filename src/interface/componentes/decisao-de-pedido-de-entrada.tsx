"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import { Button } from "@/interface/componentes/ui/button";

/**
 * **T-08 · o bloco de aprovação** — a tela onde *a forma previne o defeito*.
 *
 * O **PA-25** nasceu de um erro de clique num `select`, e o conserto (`DELETE /vinculos/{pessoaId}`) é do
 * Gestor, enquanto quem precisa saber que deve procurá-lo é a pessoa aprovada com o papel errado — que, se
 * caiu em `encarregado`, **não consegue nada**. Daí as três decisões que este componente materializa:
 *
 * 1. **Nenhum papel pré-selecionado**, e o botão de aprovar indisponível até que um seja escolhido. *Não
 *    existe papel que se obtém por não escolher* — que é exatamente o mecanismo do erro de clique.
 * 2. **A confirmação diz o papel em palavras**, não em campo.
 * 3. **A consequência está escrita onde a escolha é feita**, uma linha por papel.
 *
 * **A unidade é assimétrica ao papel, e a razão é o custo do erro** (spec §2.5): papel errado só se
 * conserta removendo o vínculo e refazendo o pedido; unidade errada se conserta com um `PATCH`. Por isso
 * ela **tem** padrão — *"Sem unidade"* —, e o papel não tem.
 */

/**
 * **O `<select>` e o `<textarea>` usam `border-input bg-transparent`, que é o par do `Input` do
 * `shadcn/ui`** (`componentes/ui/input.tsx`) — e não um token de fundo próprio: `--color-fundo` **não
 * existe** no tema (`app/globals.css` declara `marca`, `superficie`, `tinta`, `tinta-suave`,
 * `tinta-fraca`, `linha` e `linha-suave`). Classe inventada no Tailwind 4 não é erro de build: ela
 * simplesmente não gera regra, e o campo fica sem fundo em silêncio.
 */
type Area = { id: string; nome: string; tipo: string };

type Pedido = {
  id: string;
  pessoa: { nome: string; telefoneInformado: string | null };
  criadoEm: string;
};

type Papel = "solicitante" | "gestor" | "encarregado";

/** As três consequências, verbatim do inventário §T-08 e do protótipo. */
const CONSEQUENCIA: ReadonlyArray<{ papel: Papel; rotulo: string; texto: string; alerta?: string }> = [
  {
    papel: "solicitante",
    rotulo: "Solicitante",
    texto: "Registra e acompanha as próprias ocorrências.",
  },
  {
    papel: "gestor",
    rotulo: "Gestor",
    texto:
      "Analisa, atribui, resolve e cancela qualquer ocorrência. Configura a organização e aprova quem entra.",
  },
  {
    papel: "encarregado",
    rotulo: "Encarregado",
    texto: "Aparece como responsável pela ocorrência.",
    alerta: "Nesta versão, não consegue fazer nada dentro do sistema.",
  },
];

const TEXTO_DA_RECUSA: Readonly<Record<string, string>> = {
  PEDIDO_JA_DECIDIDO: "Este pedido já foi decidido por outro Gestor.",
  JA_VINCULADO: "Esta pessoa já tem vínculo nesta organização.",
  AREA_INVALIDA: "Esta área não existe nesta organização ou está desativada.",
  PEDIDO_NAO_ENCONTRADO: "Este pedido não existe mais.",
};

const MENSAGEM_GENERICA = "Não foi possível decidir agora. Tente de novo.";

export function DecisaoDePedidoDeEntrada({
  pedido,
  areas,
  organizacaoId,
}: {
  pedido: Pedido;
  areas: readonly Area[];
  /** A organização com que a página renderizou — a afirmação da §4.3 (item 7b, critério 7b.6). */
  organizacaoId: string;
}) {
  const router = useRouter();
  const [papel, setPapel] = useState<Papel | null>(null);
  const [areaId, setAreaId] = useState<string>("");
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [recusa, setRecusa] = useState<string | null>(null);

  const confirmacao = useRef<HTMLDialogElement>(null);
  const recusaDialogo = useRef<HTMLDialogElement>(null);

  const escolhido = CONSEQUENCIA.find((c) => c.papel === papel);
  const area = areas.find((a) => a.id === areaId);

  async function decidir(caminho: "aprovar" | "recusar", corpo: unknown) {
    setEnviando(true);
    setRecusa(null);

    let decidido = false;
    try {
      const resposta = await fetch(`/api/pedidos-de-entrada/${pedido.id}/${caminho}`, {
        method: "POST",
        headers: cabecalhosDeEscrita(organizacaoId),
        body: JSON.stringify(corpo),
      });

      if (resposta.ok) {
        decidido = true;
      } else {
        const problema = (await resposta.json().catch(() => ({}))) as {
          codigo?: string;
          detail?: string;
        };
        setRecusa(TEXTO_DA_RECUSA[problema.codigo ?? ""] ?? problema.detail ?? MENSAGEM_GENERICA);
      }
    } catch {
      // `fetch` rejeitou antes de haver resposta — rede caiu. Sem este `catch` a rejeição sobe pela
      // transição e aciona o Error Boundary em vez de mostrar a linha de recusa. Nuvem sem SLA: rede
      // instável é o caso esperado.
      setRecusa(MENSAGEM_GENERICA);
    } finally {
      setEnviando(false);
    }

    if (decidido) {
      confirmacao.current?.close();
      recusaDialogo.current?.close();
      // A lista recarrega e o pedido decidido sai dela — o padrão do endpoint é `situacao=pendente`. A
      // faixa de desfecho é da página, que a mostra a partir da query (spec §2.6).
      router.replace(
        caminho === "aprovar"
          ? `/vinculos?decidido=aprovado&quem=${encodeURIComponent(pedido.pessoa.nome)}&papel=${papel ?? ""}&unidade=${encodeURIComponent(area?.nome ?? "")}`
          : `/vinculos?decidido=recusado&quem=${encodeURIComponent(pedido.pessoa.nome)}`,
      );
      router.refresh();
    }
  }

  return (
    <article className="border-linha bg-superficie flex flex-col gap-4 rounded-md border p-5">
      <header className="flex flex-col gap-1">
        <h3 className="text-tinta text-base font-semibold">{pedido.pessoa.nome}</h3>
        <p className="text-tinta-suave text-sm">pediu em {formatarData(pedido.criadoEm)}</p>
        {pedido.pessoa.telefoneInformado !== null && (
          <p className="text-tinta-suave text-sm">
            Telefone informado no pedido:{" "}
            <span className="text-tinta">{agrupar(pedido.pessoa.telefoneInformado)}</span>
          </p>
        )}
      </header>

      {recusa !== null && (
        <p
          role="alert"
          className="border-marca/40 bg-accent text-tinta rounded-md border px-3 py-2.5 text-sm"
        >
          {recusa}{" "}
          <button
            type="button"
            onClick={() => router.refresh()}
            className="text-marca underline underline-offset-4"
          >
            Atualizar a lista
          </button>
        </p>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-tinta mb-2 text-sm font-semibold">
          Qual papel {pedido.pessoa.nome} vai ter nesta organização?
        </legend>

        {CONSEQUENCIA.map((opcao, indice) => (
          <label
            key={opcao.papel}
            className={`border-linha flex min-h-11 items-start gap-3 rounded-md border p-3 ${
              indice === 2 ? "mt-2 border-t-2" : ""
            }`}
          >
            <input
              type="radio"
              name={`papel-${pedido.id}`}
              value={opcao.papel}
              checked={papel === opcao.papel}
              onChange={() => setPapel(opcao.papel)}
              className="mt-1"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-tinta text-sm font-medium">{opcao.rotulo}</span>
              <span className="text-tinta-suave text-xs leading-relaxed">
                {opcao.texto}
                {opcao.alerta !== undefined && (
                  <strong className="text-tinta block font-semibold">{opcao.alerta}</strong>
                )}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`unidade-${pedido.id}`} className="text-tinta text-sm font-medium">
          Unidade (opcional)
        </label>
        <select
          id={`unidade-${pedido.id}`}
          value={areaId}
          onChange={(evento) => setAreaId(evento.target.value)}
          className="border-input bg-transparent text-tinta h-11 rounded-md border px-3 text-base"
        >
          <option value="">Sem unidade</option>
          {areas.map((opcao) => (
            <option key={opcao.id} value={opcao.id}>
              {opcao.nome}
            </option>
          ))}
        </select>
        <span className="text-tinta-suave text-xs leading-relaxed">
          Onde esta pessoa mora ou trabalha aqui — o apartamento 302, a sala 14. O Gestor e o terceirizado
          não têm unidade.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="button"
          disabled={papel === null || enviando}
          aria-describedby={papel === null ? `dica-${pedido.id}` : undefined}
          onClick={() => confirmacao.current?.showModal()}
          className="h-11"
        >
          Aprovar
        </Button>
        {papel === null && (
          <span id={`dica-${pedido.id}`} className="text-tinta-suave text-sm">
            indisponível até escolher um papel
          </span>
        )}
        <button
          type="button"
          disabled={enviando}
          onClick={() => recusaDialogo.current?.showModal()}
          className="border-linha text-tinta ml-auto h-11 rounded-md border px-5 text-sm"
        >
          Recusar
        </button>
      </div>

      {/* A confirmação — onde o papel vira palavra. */}
      <dialog
        ref={confirmacao}
        className="bg-superficie text-tinta m-auto max-w-md rounded-md p-6 backdrop:bg-black/40"
      >
        <h4 className="text-tinta text-base font-semibold">
          Aprovar {pedido.pessoa.nome} como <strong>{escolhido?.rotulo}</strong>
          {area === undefined ? ", sem unidade registrada" : `, no ${area.nome}`}?
        </h4>
        <p className="text-tinta-suave mt-3 text-sm leading-relaxed">{escolhido?.texto}</p>
        <p className="text-tinta-suave mt-2 text-sm leading-relaxed">
          O papel não pode ser alterado depois. Para corrigir, é preciso remover o vínculo e pedir entrada
          de novo.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => confirmacao.current?.close()}
            className="border-linha h-11 rounded-md border px-5 text-sm"
          >
            Voltar
          </button>
          <Button
            type="button"
            disabled={enviando}
            onClick={() => decidir("aprovar", { papel, areaId: areaId === "" ? null : areaId })}
            className="h-11"
          >
            {enviando ? "Aprovando…" : `Aprovar como ${escolhido?.rotulo ?? ""}`}
          </Button>
        </div>
      </dialog>

      {/* A recusa — e a caixa diz para quem o texto serve ANTES de o Gestor começar a escrever. */}
      <dialog
        ref={recusaDialogo}
        className="bg-superficie text-tinta m-auto max-w-md rounded-md p-6 backdrop:bg-black/40"
      >
        <h4 className="text-tinta text-base font-semibold">Recusar o pedido de {pedido.pessoa.nome}?</h4>
        <p className="text-tinta-suave mt-3 text-sm leading-relaxed">
          Nenhum vínculo é criado, e ela continua fora desta organização. Um pedido recusado{" "}
          <strong className="text-tinta font-semibold">pode ser refeito</strong> — recusar não bloqueia
          para sempre.
        </p>

        <div className="mt-4 flex flex-col gap-1.5">
          <label htmlFor={`motivo-${pedido.id}`} className="text-tinta text-sm font-medium">
            Por que este pedido foi recusado?{" "}
            <span className="text-tinta-suave font-normal">(opcional)</span>
          </label>
          <textarea
            id={`motivo-${pedido.id}`}
            maxLength={500}
            rows={4}
            value={observacao}
            onChange={(evento) => setObservacao(evento.target.value)}
            className="border-input bg-transparent text-tinta rounded-md border px-3 py-2 text-base"
          />
          <span className="text-tinta-suave text-xs leading-relaxed">
            Até 500 caracteres.{" "}
            <strong className="text-tinta font-semibold">{pedido.pessoa.nome} não vê este texto.</strong>{" "}
            Ela só verá que o pedido foi recusado. O texto fica no registro da organização, para você e
            para o próximo Gestor.
          </span>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => recusaDialogo.current?.close()}
            className="border-linha h-11 rounded-md border px-5 text-sm"
          >
            Voltar
          </button>
          <Button
            type="button"
            disabled={enviando}
            onClick={() => decidir("recusar", { observacao: observacao === "" ? null : observacao })}
            className="h-11"
          >
            {enviando ? "Recusando…" : "Recusar pedido"}
          </Button>
        </div>
      </dialog>
    </article>
  );
}

/**
 * E.164 agrupado — `+55 11 98877-1234`. **O mesmo valor com espaços**, sem inventar um segundo formato:
 * é a decisão declarada do protótipo para a leitura. Número que não case com o padrão brasileiro sai como
 * veio, em vez de sair mutilado.
 */
function agrupar(e164: string): string {
  const brasileiro = /^\+55(\d{2})(\d{4,5})(\d{4})$/u.exec(e164);
  if (brasileiro === null) return e164;
  return `+55 ${brasileiro[1]} ${brasileiro[2]}-${brasileiro[3]}`;
}

function formatarData(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}
