"use client";

import { useId, useSyncExternalStore } from "react";

import { FINALIDADES_DE_CONTATO } from "@/dominio/pessoa";
import { Campo } from "@/interface/componentes/moldura-de-tela";
import { PREFIXO_BR, converterTelefoneDigitado } from "@/interface/componentes/telefone";
import { Input } from "@/interface/componentes/ui/input";

/**
 * **T-08 · o sub-formulário repetível de contatos** — quadros 7 e 8 do protótipo, item 9b.
 *
 * **A ordem da lista é o significado**, e não há caixa de *"contato preferido"*: o 1 é para onde se liga
 * primeiro, e mudar a preferência é mudar a ordem, com **Subir** e **Descer**. Arrastar foi recusado no
 * protótipo — é hostil no celular e invisível em low-fi.
 *
 * **A lista substitui a anterior inteira ao salvar**, e a tela diz isso antes de a pessoa apagar algo.
 *
 * **`temWhatsapp` só existe quando o tipo é telefone** (`contatos_whatsapp_ck`), e trocar para e-mail
 * limpa a marca — é isso que impede o `400` daquele campo de existir pela tela.
 *
 * **A duplicata é vista aqui, antes de enviar.** Como a escrita é substituição, o estado final é esta
 * lista: um par repetido só pode vir de dentro dela. O `409 CONTATO_DUPLICADO` do servidor é a rede que
 * esta tela não provoca.
 */

export type ContatoEmEdicao = {
  /** Chave estável de React. Não é o `id` do banco — a substituição descarta os antigos. */
  chave: string;
  tipo: "telefone" | "email";
  /** O que a pessoa digitou. Telefone só vira E.164 na hora de montar o corpo. */
  valor: string;
  finalidade: (typeof FINALIDADES_DE_CONTATO)[number];
  temWhatsapp: boolean;
  observacao: string;
};

/** O que `GET /vinculos` devolveu, virando linha editável. */
export function contatoVindoDaApi(contato: {
  id: string;
  tipo: string;
  valor: string;
  finalidade: string;
  temWhatsapp: boolean;
  observacao: string | null;
}): ContatoEmEdicao {
  return {
    chave: contato.id,
    tipo: contato.tipo === "email" ? "email" : "telefone",
    valor: contato.valor,
    finalidade:
      contato.finalidade === "trabalho"
        ? "trabalho"
        : contato.finalidade === "recado"
          ? "recado"
          : "pessoal",
    temWhatsapp: contato.temWhatsapp,
    observacao: contato.observacao ?? "",
  };
}

/** O contato acrescentado entra **no fim** da lista, como o último a ser tentado (quadro 7). */
export function contatoNovo(chave: string): ContatoEmEdicao {
  return {
    chave,
    tipo: "telefone",
    valor: PREFIXO_BR,
    finalidade: "pessoal",
    temWhatsapp: false,
    observacao: "",
  };
}

export type ContatoNoCorpo = {
  tipo: "telefone" | "email";
  valor: string;
  finalidade: (typeof FINALIDADES_DE_CONTATO)[number];
  temWhatsapp: boolean;
  observacao: string | null;
};

/**
 * A lista virando corpo. **Sem `ordem`:** quem a grava é o servidor, pela posição (decisão 2.1).
 *
 * Devolve `null` quando algum telefone não converte — quem chama não envia, e mostra o erro no campo.
 */
export function paraCorpo(contatos: readonly ContatoEmEdicao[]): ContatoNoCorpo[] | null {
  const corpo: ContatoNoCorpo[] = [];

  for (const contato of contatos) {
    const valor = valorNormalizado(contato);
    if (valor === null) return null;

    corpo.push({
      tipo: contato.tipo,
      valor,
      finalidade: contato.finalidade,
      temWhatsapp: contato.tipo === "telefone" && contato.temWhatsapp,
      observacao: contato.observacao.trim() === "" ? null : contato.observacao.trim(),
    });
  }

  return corpo;
}

/**
 * O valor como ele vai ser **guardado**, ou `null` se não converte.
 *
 * **A comparação de duplicata acontece sobre isto, não sobre o digitado**: `(11) 95521-7788` e
 * `+5511955217788` são o mesmo contato para o `UNIQUE (pessoa_id, tipo, valor)`, e comparar o texto cru
 * deixaria a tela mandar um par que o banco recusa.
 */
function valorNormalizado(contato: ContatoEmEdicao): string | null {
  if (contato.tipo === "email") {
    const email = contato.valor.trim();
    return email === "" ? null : email;
  }

  const convertido = converterTelefoneDigitado(contato.valor);
  return convertido.situacao === "convertido" ? convertido.valor : null;
}

/** Os índices que repetem um par (`tipo`, `valor`) anterior. O primeiro de cada par não é culpado. */
export function indicesDuplicados(contatos: readonly ContatoEmEdicao[]): ReadonlySet<number> {
  const vistos = new Set<string>();
  const duplicados = new Set<number>();

  contatos.forEach((contato, indice) => {
    const valor = valorNormalizado(contato);
    if (valor === null) return;

    const par = `${contato.tipo} ${valor.toLowerCase()}`;
    if (vistos.has(par)) duplicados.add(indice);
    else vistos.add(par);
  });

  return duplicados;
}

/**
 * A lista mudou em relação ao que foi lido?
 *
 * **Compara conteúdo E ordem** — Subir/Descer sem editar nada **é** alteração, e é a única que um
 * comparador de conjunto não vê. Comparar o corpo montado, e não os objetos em edição, é o que faz
 * `(11) 95521-7788` e `+5511955217788` contarem como iguais.
 *
 * Serve à decisão 2.3: quando nada mudou, o `PATCH` **omite** `contatos`, e os `id` e `criadoEm` das
 * linhas sobrevivem a uma correção de unidade.
 */
export function listaMudou(
  atual: readonly ContatoEmEdicao[],
  original: readonly ContatoEmEdicao[],
): boolean {
  return JSON.stringify(paraCorpo(atual)) !== JSON.stringify(paraCorpo(original));
}

/**
 * `true` abaixo de `md` (768 px), o mesmo ponto de corte da lista de vínculos.
 *
 * **`useSyncExternalStore` e não `useEffect`:** o instantâneo do servidor é `false` — tela grande —, e é
 * ele que a primeira renderização usa, então não há divergência de hidratação.
 */
function useEhCelular(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const consulta = window.matchMedia("(max-width: 767px)");
      consulta.addEventListener("change", avisar);
      return () => {
        consulta.removeEventListener("change", avisar);
      };
    },
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false,
  );
}

const ROTULO_DE_FINALIDADE: Readonly<Record<string, string>> = {
  pessoal: "Pessoal",
  trabalho: "Trabalho",
  recado: "Recado",
};

const CLASSE_DE_CHIP =
  "border-linha text-tinta inline-flex min-h-11 items-center rounded-md border px-3 text-sm disabled:opacity-40";

export function SubFormularioDeContatos({
  contatos,
  aoMudar,
  aberto,
  aoAbrir,
  somenteLeitura,
}: {
  contatos: readonly ContatoEmEdicao[];
  aoMudar: (contatos: readonly ContatoEmEdicao[]) => void;
  /** A chave do contato aberto no celular. Em tela grande todos ficam abertos. */
  aberto: string | null;
  aoAbrir: (chave: string | null) => void;
  /** Quem tem conta: a lista aparece, sem controle nenhum (decisão 2.4). */
  somenteLeitura: boolean;
}) {
  const ehCelular = useEhCelular();
  const prefixo = useId();
  const duplicados = indicesDuplicados(contatos);

  function trocar(indice: number, mudanca: Partial<ContatoEmEdicao>) {
    aoMudar(contatos.map((contato, i) => (i === indice ? { ...contato, ...mudanca } : contato)));
  }

  function mover(indice: number, passo: number) {
    const destino = indice + passo;
    if (destino < 0 || destino >= contatos.length) return;
    const copia = [...contatos];
    const [movido] = copia.splice(indice, 1);
    if (movido !== undefined) copia.splice(destino, 0, movido);
    aoMudar(copia);
  }

  if (somenteLeitura) {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-tinta text-sm font-medium">Contatos</h2>
        {contatos.length === 0 ? (
          <p className="text-tinta-suave text-sm">Nenhum contato cadastrado.</p>
        ) : (
          <ol className="flex flex-col gap-1">
            {contatos.map((contato, indice) => (
              <li key={contato.chave} className="text-tinta-suave text-sm">
                {indice + 1} · {resumo(contato)}
              </li>
            ))}
          </ol>
        )}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-tinta text-sm font-medium">
        Contatos <span className="text-tinta-suave font-normal">— por onde se alcança esta pessoa</span>
      </h2>

      <p className="border-linha text-tinta-suave rounded-md border px-3 py-2.5 text-sm leading-relaxed">
        <strong className="text-tinta">A ordem da lista é o significado.</strong> O contato 1 é para onde se
        liga primeiro; o 2 é o que se tenta se o 1 não responder. Não há caixa de &quot;contato
        preferido&quot; — mudar a preferência é mudar a ordem, com <strong>Subir</strong> e{" "}
        <strong>Descer</strong>. E ao salvar, <strong>esta lista substitui inteira a anterior</strong>: o
        que for removido aqui deixa de existir.
      </p>

      {contatos.map((contato, indice) => {
        const id = `${prefixo}-${contato.chave}`;
        const expandido = !ehCelular || aberto === contato.chave;
        const erroDoCampo = erroDoValor(contato, duplicados.has(indice));

        return (
          <fieldset key={contato.chave} className="border-linha flex flex-col gap-3 rounded-md border p-3">
            <legend className="sr-only">Contato {indice + 1}</legend>

            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-tinta text-sm">Contato {indice + 1}</strong>
              <span className="text-tinta-suave text-sm">
                {indice === 0 ? "é para onde se liga primeiro" : "se o anterior não responder"}
              </span>
              {ehCelular && (
                <button
                  type="button"
                  className={`${CLASSE_DE_CHIP} ml-auto`}
                  onClick={() => {
                    aoAbrir(expandido ? null : contato.chave);
                  }}
                >
                  {expandido ? "Fechar" : "Abrir"}
                  <span className="sr-only"> o contato {indice + 1}</span>
                </button>
              )}
            </div>

            {!expandido && <p className="text-tinta-suave text-sm">{resumo(contato)}</p>}

            {expandido && (
              <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-x-4">
                <fieldset className="flex flex-col gap-1.5">
                  <legend className="text-tinta mb-1 text-sm font-medium">Tipo</legend>
                  <div className="flex gap-4">
                    {(["telefone", "email"] as const).map((tipo) => (
                      <label key={tipo} className="flex min-h-11 items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`${id}-tipo`}
                          checked={contato.tipo === tipo}
                          onChange={() => {
                            // Trocar para e-mail **limpa o WhatsApp**: o banco recusa a marca num e-mail,
                            // e deixá-la marcada produziria um `400` que a tela deveria ter evitado.
                            trocar(indice, {
                              tipo,
                              temWhatsapp: tipo === "telefone" && contato.temWhatsapp,
                            });
                          }}
                          className="h-4 w-4"
                        />
                        {tipo === "telefone" ? "Telefone" : "E-mail"}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <Campo
                  id={`${id}-valor`}
                  rotulo={contato.tipo === "telefone" ? "Número" : "E-mail"}
                  ajuda={ajudaDoValor(contato)}
                  erro={erroDoCampo}
                >
                  <Input
                    id={`${id}-valor`}
                    type={contato.tipo === "telefone" ? "tel" : "email"}
                    inputMode={contato.tipo === "telefone" ? "tel" : "email"}
                    maxLength={255}
                    value={contato.valor}
                    aria-invalid={erroDoCampo !== undefined}
                    onChange={(evento) => {
                      trocar(indice, { valor: evento.target.value });
                    }}
                    className="h-11"
                  />
                </Campo>

                <Campo
                  id={`${id}-finalidade`}
                  rotulo="Finalidade"
                  ajuda="Recado é o telefone de terceiro que aceita mensagem — a portaria, o escritório da terceirizada."
                >
                  <select
                    id={`${id}-finalidade`}
                    value={contato.finalidade}
                    onChange={(evento) => {
                      trocar(indice, {
                        finalidade: evento.target.value as ContatoEmEdicao["finalidade"],
                      });
                    }}
                    className="border-input text-tinta h-11 rounded-md border bg-transparent px-3 text-sm"
                  >
                    {FINALIDADES_DE_CONTATO.map((valor) => (
                      <option key={valor} value={valor}>
                        {ROTULO_DE_FINALIDADE[valor]}
                      </option>
                    ))}
                  </select>
                </Campo>

                {contato.tipo === "telefone" && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-tinta text-sm font-medium">WhatsApp</span>
                    <label className="flex min-h-11 items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={contato.temWhatsapp}
                        onChange={(evento) => {
                          trocar(indice, { temWhatsapp: evento.target.checked });
                        }}
                        className="h-4 w-4"
                      />
                      Este número aceita WhatsApp
                    </label>
                  </div>
                )}

                <div className="md:col-span-2">
                  <Campo
                    id={`${id}-observacao`}
                    rotulo="Observação (opcional)"
                    ajuda="Instrução humana, para quem for ligar. Até 200 caracteres."
                  >
                    <Input
                      id={`${id}-observacao`}
                      maxLength={200}
                      value={contato.observacao}
                      onChange={(evento) => {
                        trocar(indice, { observacao: evento.target.value });
                      }}
                      className="h-11"
                    />
                  </Campo>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={CLASSE_DE_CHIP}
                disabled={indice === 0}
                onClick={() => {
                  mover(indice, -1);
                }}
              >
                Subir<span className="sr-only"> o contato {indice + 1}</span>
              </button>
              <button
                type="button"
                className={CLASSE_DE_CHIP}
                disabled={indice === contatos.length - 1}
                onClick={() => {
                  mover(indice, 1);
                }}
              >
                Descer<span className="sr-only"> o contato {indice + 1}</span>
              </button>
              <button
                type="button"
                className={CLASSE_DE_CHIP}
                onClick={() => {
                  aoMudar(contatos.filter((_, i) => i !== indice));
                }}
              >
                Remover<span className="sr-only"> o contato {indice + 1}</span>
              </button>
            </div>
          </fieldset>
        );
      })}

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          className={`${CLASSE_DE_CHIP} self-start`}
          onClick={() => {
            const novo = contatoNovo(`novo-${String(contatos.length)}-${String(Date.now())}`);
            aoMudar([...contatos, novo]);
            aoAbrir(novo.chave);
          }}
        >
          Acrescentar contato
        </button>
        <p className="text-tinta-suave text-sm">
          O contato acrescentado entra no fim da lista, como o último a ser tentado. Cadastrar sem contato
          nenhum é permitido — a lista pode ficar vazia.
        </p>
      </div>
    </section>
  );
}

/** *"+55 11 95521-7788 — telefone trabalho · Aceita WhatsApp"*. **WhatsApp em palavra** (A-5). */
function resumo(contato: ContatoEmEdicao): string {
  const partes = [
    `${contato.valor} — ${contato.tipo} ${ROTULO_DE_FINALIDADE[contato.finalidade]?.toLowerCase() ?? contato.finalidade}`,
  ];
  if (contato.tipo === "telefone") {
    partes.push(contato.temWhatsapp ? "Aceita WhatsApp" : "sem WhatsApp");
  }
  if (contato.observacao.trim() !== "") partes.push("tem observação");
  return partes.join(" · ");
}

/**
 * O erro **do campo do valor** — duplicata primeiro, porque ela fala da lista inteira.
 *
 * **O telefone recusado é a outra metade da §2.5(e) da spec**, e é o que a §6.2 do protótipo manda
 * (`docs/prototipo-low-fi.md`, linha 911: *"`FORMATO_INVALIDO` (400) de telefone · T-08 → no campo do
 * número"*). Sem isto, um número malformado apenas **desabilitaria o botão de salvar sem dizer por quê** —
 * o modo de falha que o A-1 e a §6.2 existem para impedir. **A frase é a do 7a**, que
 * `converterTelefoneDigitado` já devolve: uma regra, uma redação, e nenhum import novo.
 *
 * **Contato recém-acrescentado não é erro.** Ele nasce com `+55 `, e o módulo chama isso de *vazio*, não
 * de *recusado* — a frase só aparece para quem digitou algo que não converte.
 */
function erroDoValor(contato: ContatoEmEdicao, duplicado: boolean): string | undefined {
  if (duplicado) return "Este contato já está na lista.";
  if (contato.tipo !== "telefone") return undefined;

  const convertido = converterTelefoneDigitado(contato.valor);
  return convertido.situacao === "recusado" ? convertido.mensagem : undefined;
}

function ajudaDoValor(contato: ContatoEmEdicao): string {
  if (contato.tipo === "email") return "O e-mail de contato — não é a credencial de acesso.";

  const convertido = converterTelefoneDigitado(contato.valor);
  if (convertido.situacao === "convertido") {
    return `Vai ser guardado como ${convertido.valor} — o formato que um link de WhatsApp consome direto.`;
  }
  return "O país vem Brasil por padrão. Digite com DDD, como (11) 99999-0000.";
}
