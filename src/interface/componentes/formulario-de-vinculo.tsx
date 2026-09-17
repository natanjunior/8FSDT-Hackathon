"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import {
  SubFormularioDeContatos,
  contatoVindoDaApi,
  indicesDuplicados,
  listaMudou,
  paraCorpo,
  type ContatoEmEdicao,
} from "@/interface/componentes/sub-formulario-de-contatos";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";

/**
 * **T-08 · cadastrar pessoa sem conta, e corrigir os dados de um vínculo.**
 *
 * **Este formulário não está sob o RNF6.** É trabalho de escritório, feito sentado, uma vez — o orçamento
 * de 60 segundos é de T-04. Aqui a completude vale mais que a velocidade.
 *
 * **A escolha de papel é a do PA-25, sem exceção:** nada pré-selecionado, botão indisponível até a
 * escolha, `Encarregado` por último depois de uma régua, e a consequência escrita onde a escolha é feita.
 * *Não existe papel que se obtém por não escolher* — que é exatamente o mecanismo do erro de clique.
 *
 * **O papel não aparece no modo de correção**, e isso não é omissão: `PATCH /vinculos/{pessoaId}` não o
 * aceita, e o único conserto de papel errado é remover o vínculo e refazer o pedido (item 10).
 *
 * **`contatos[]` chegou no item 9b**, e a escrita é **substituição**: a lista enviada troca a anterior
 * inteira. Na correção, ela só é enviada quando mudou de verdade — omitir é o *"não mexe em nada"* do
 * contrato §8.2, e é o que preserva o `criadoEm` de cada contato quando o Gestor corrige só a unidade.
 */

type Area = { id: string; nome: string };

type Modo =
  | { tipo: "cadastro" }
  | {
      tipo: "correcao";
      pessoaId: string;
      nome: string;
      temConta: boolean;
      areaIdAtual: string | null;
      contatosAtuais: ReadonlyArray<{
        id: string;
        tipo: string;
        valor: string;
        finalidade: string;
        temWhatsapp: boolean;
        observacao: string | null;
      }>;
    };

const PAPEIS: ReadonlyArray<{ papel: string; rotulo: string; texto: string; alerta?: string }> = [
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
    alerta: "Não consegue fazer nada dentro do sistema.",
  },
];

const TEXTO_DA_RECUSA: Readonly<Record<string, string>> = {
  AREA_INVALIDA: "Esta área não existe nesta organização ou está desativada.",
  PESSOA_COM_CONTA_NAO_EDITAVEL:
    "Esta pessoa tem conta no Resolve Aí e edita os próprios dados. O cadastro de quem tem conta vale em todas as organizações dela.",
  VINCULO_NAO_ENCONTRADO: "Este vínculo não existe mais nesta organização.",
  CAMPO_NAO_SUPORTADO: "Um dos campos enviados não é aceito por esta operação.",
  FORMATO_INVALIDO: "Confira os campos indicados.",
  CONTATO_DUPLICADO: "Este contato já está na lista. Confira os contatos marcados.",
};

const MENSAGEM_GENERICA = "Não foi possível salvar agora. Tente de novo.";

export function FormularioDeVinculo({
  modo,
  areas,
  organizacaoId,
}: {
  modo: Modo;
  areas: readonly Area[];
  /** A organização com que a página renderizou — a afirmação da §4.3 (item 7b, critério 7b.6). */
  organizacaoId: string;
}) {
  const router = useRouter();
  const [nome, setNome] = useState(modo.tipo === "correcao" ? modo.nome : "");
  const [papel, setPapel] = useState<string | null>(null);
  const [areaId, setAreaId] = useState<string>(
    modo.tipo === "correcao" ? (modo.areaIdAtual ?? "") : "",
  );
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // `originais` é recalculado a cada renderização de propósito — é só a lista de referência para o
  // `listaMudou`, e as props desta tela não mudam sem remontar a página.
  const originais = modo.tipo === "correcao" ? modo.contatosAtuais.map(contatoVindoDaApi) : [];
  const [contatos, setContatos] = useState<readonly ContatoEmEdicao[]>(originais);
  const [abertoNoCelular, setAbertoNoCelular] = useState<string | null>(null);

  const corpoDosContatos = paraCorpo(contatos);
  const contatosValem = corpoDosContatos !== null && indicesDuplicados(contatos).size === 0;

  // No cadastro, o botão nasce indisponível — é a decisão 1 do PA-25. Na correção não há papel a
  // escolher, e travar o botão seria travar por nada. Em qualquer dos dois, contato malformado ou
  // repetido segura o envio: o erro já está no campo, e mandar produziria um `400`/`409` que a tela sabe
  // evitar.
  const podeSalvar =
    contatosValem && (modo.tipo === "cadastro" ? papel !== null && nome.trim() !== "" : true);

  async function salvar() {
    setEnviando(true);
    setErro(null);

    const alvo = modo.tipo === "cadastro" ? "/api/vinculos" : `/api/vinculos/${modo.pessoaId}`;

    // Quem tem conta nunca manda contatos: eles são globais, como o nome, e a tela os mostra em leitura.
    // Ele cai no mesmo caminho de quem não mexeu na lista — sem caso especial (decisão 2.4).
    const mandaContatos =
      modo.tipo === "cadastro" || (!modo.temConta && listaMudou(contatos, originais));

    const corpo =
      modo.tipo === "cadastro"
        ? {
            nome: nome.trim(),
            papel,
            areaId: areaId === "" ? null : areaId,
            contatos: corpoDosContatos,
          }
        : {
            // Quem tem conta não tem o nome enviado: a tela mostra o campo como leitura, e mandá-lo
            // produziria o `409` que a tela existe para não provocar.
            ...(modo.temConta ? {} : { nome: nome.trim() }),
            areaId: areaId === "" ? null : areaId,
            // **Omitir e `[]` são coisas diferentes** (contrato §8.2): a chave só entra quando a lista
            // mudou de verdade. Sem isto, corrigir a unidade apagaria e reinseriria todo contato da
            // pessoa, trocando o `id` e o `criadoEm` de cada um.
            ...(mandaContatos ? { contatos: corpoDosContatos } : {}),
          };

    try {
      const resposta = await fetch(alvo, {
        method: modo.tipo === "cadastro" ? "POST" : "PATCH",
        headers: cabecalhosDeEscrita(organizacaoId),
        body: JSON.stringify(corpo),
      });

      if (!resposta.ok) {
        const problema = (await resposta.json().catch(() => ({}))) as {
          codigo?: string;
          detail?: string;
        };
        // **O `detail` antes do genérico** (item 7b): o texto que nós escrevemos ganha, porque é
        // redigido para a tela; o do servidor entra quando não temos texto próprio (contrato §6.1).
        // Sem esta linha, o `409 ORGANIZACAO_DIVERGENTE` — alcançável desde o critério 7b.6 — vira
        // *"Não foi possível salvar agora"*, que é a única frase que **não** diz o que aconteceu.
        setErro(TEXTO_DA_RECUSA[problema.codigo ?? ""] ?? problema.detail ?? MENSAGEM_GENERICA);
        setEnviando(false);
        return;
      }

      const parametros =
        modo.tipo === "cadastro"
          ? `cadastrado=${encodeURIComponent(nome.trim())}&papel=${encodeURIComponent(papel ?? "")}`
          : `corrigido=${encodeURIComponent(modo.temConta ? modo.nome : nome.trim())}`;

      router.replace(`/vinculos?${parametros}`);
      router.refresh();
    } catch {
      // `fetch` rejeitou antes de haver resposta — a rede caiu. Sem este `catch` a rejeição sobe pela
      // fronteira do React e a pessoa vê a tela de erro do framework no lugar de uma frase.
      setErro(MENSAGEM_GENERICA);
      setEnviando(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(evento) => {
        evento.preventDefault();
        if (podeSalvar && !enviando) void salvar();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="nome" className="text-tinta text-sm font-medium">
          Nome
        </label>
        {modo.tipo === "correcao" && modo.temConta ? (
          <>
            <p id="nome" className="text-tinta text-sm">
              {modo.nome}
            </p>
            <p className="text-tinta-suave text-sm leading-relaxed">
              {modo.nome} tem conta no Resolve Aí e edita os próprios dados. O cadastro de quem tem conta
              vale em todas as organizações dela.
            </p>
          </>
        ) : (
          <>
            <Input
              id="nome"
              name="nome"
              maxLength={120}
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
            />
            <p className="text-tinta-suave text-sm leading-relaxed">
              Até 120 caracteres. O nome vai para a trilha de auditoria a cada transição que esta pessoa
              autorar, e a trilha é imutável — o que estiver escrito aqui fica lá para sempre. Não escreva
              a unidade no nome: ela tem campo próprio abaixo.
            </p>
          </>
        )}
      </div>

      {modo.tipo === "cadastro" && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-tinta text-sm font-medium">
            Qual papel esta pessoa vai ter nesta organização?
          </legend>
          {PAPEIS.map((opcao, indice) => (
            <label
              key={opcao.papel}
              className={`border-linha flex min-h-11 gap-3 rounded-md border px-3 py-2.5 ${
                indice === 2 ? "mt-2 border-t-2" : ""
              }`}
            >
              <input
                type="radio"
                name="papel"
                value={opcao.papel}
                checked={papel === opcao.papel}
                onChange={() => setPapel(opcao.papel)}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-tinta text-sm font-medium">{opcao.rotulo}</span>
                <span className="text-tinta-suave text-sm">{opcao.texto}</span>
                {opcao.alerta !== undefined && (
                  <strong className="text-tinta text-sm font-semibold">{opcao.alerta}</strong>
                )}
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="areaId" className="text-tinta text-sm font-medium">
          Unidade (opcional)
        </label>
        <select
          id="areaId"
          name="areaId"
          value={areaId}
          onChange={(evento) => setAreaId(evento.target.value)}
          className="border-input text-tinta h-11 rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="">Sem unidade</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.nome}
            </option>
          ))}
        </select>
        <p className="text-tinta-suave text-sm leading-relaxed">
          A unidade desta pessoa nesta organização — o apartamento 302, a sala 14. Deixe em{" "}
          <em>Sem unidade</em> para Gestor e para Encarregado de terceirizada, que não têm uma. A unidade
          é do vínculo, não da pessoa: a mesma pessoa mora num lugar e trabalha em outro.
        </p>
      </div>

      <SubFormularioDeContatos
        contatos={contatos}
        aoMudar={setContatos}
        aberto={abertoNoCelular}
        aoAbrir={setAbertoNoCelular}
        somenteLeitura={modo.tipo === "correcao" && modo.temConta}
      />

      {erro !== null && (
        <p role="alert" className="text-tinta text-sm">
          {erro}
        </p>
      )}

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={!podeSalvar || enviando} className="w-auto px-6">
          {modo.tipo === "cadastro" ? "Cadastrar" : "Salvar"}
        </Button>
        {modo.tipo === "cadastro" && papel === null && (
          <span className="text-tinta-suave text-sm">indisponível até escolher um papel</span>
        )}
        {!contatosValem && (
          <span className="text-tinta-suave text-sm">
            indisponível até os contatos ficarem completos e sem repetição
          </span>
        )}
        <a href="/vinculos" className="text-marca ml-auto text-sm underline underline-offset-4">
          Cancelar
        </a>
      </div>
    </form>
  );
}
