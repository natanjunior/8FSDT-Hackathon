"use client";

import { useRef, useState } from "react";

import { Button } from "@/interface/componentes/ui/button";

import {
  ImagemGrandeDemais,
  ImagemIlegivel,
  LIMITE_DO_SELETOR_EM_BYTES,
  comprimir,
} from "./compressao-de-imagem";

/**
 * ============================================================================
 *  O controle de foto de T-04 — o primeiro alvo da tela
 * ============================================================================
 *
 * **Ele fica acima do título, e é o DG-5 inteiro.** O protótipo (§2.3 e o desenho D-1) moveu a foto para
 * cima justamente para **garantir o paralelismo**: com a foto por último, os 400 KB entram na conta do
 * RNF6 — cerca de 3,5 s em 4G real, e até 12 s em rede ruim. Com ela primeiro, o upload corre enquanto a
 * pessoa digita, e não entra na soma.
 *
 * **A tela não espera o upload para habilitar o envio** (critério 13a.4) — ela espera só `chave` e
 * `ticket`, que chegam do `201` da autorização. Habilitar e submeter são coisas diferentes: **o envio**
 * espera o `PUT` terminar, porque reivindicar um objeto que ainda não chegou produziria um `422`
 * evitável. Isso passa a valer no item 13b, que é quem reivindica.
 *
 * **Nesta fatia a foto sobe e não é reivindicada.** O item 13b é quem a liga à ocorrência; até lá, o
 * objeto fica pendente e a faxina o recolhe em 24–48 h. A janela está registrada no
 * `trabalho/roteiro-de-validacao.md` — não na tela, que não deve trazer texto construído para ser apagado.
 *
 * **Acessibilidade:** rótulo associado ao controle (A-1); alvo de 44 px (A-3); e **todo estado carrega a
 * palavra**, nunca só a barra ou a cor (A-5).
 */

/**
 * **Não há campo de progresso, e é decisão declarada.** O protótipo (§7.1) lista um `Progress` para o
 * upload, e ele não é entregável nesta fatia por duas razões independentes: `fetch` **não emite evento de
 * progresso de envio** — quem emite é `XMLHttpRequest`, e trocar o transporte é escopo que ninguém pediu —,
 * e `ui/progress.tsx` não existe no repositório. Guardar um `progresso: number` que nada renderiza seria
 * exatamente a sobra que o comentário de `guardadas` abaixo condena. **O que o compromisso A-5 exige é a
 * palavra, e ela está lá:** *"Enviando a foto — você pode continuar escrevendo."* Está na §9 como achado.
 */
type Situacao =
  | { nome: "vazio" }
  | { nome: "comprimindo" }
  | { nome: "enviando"; previa: string }
  | { nome: "pronta"; previa: string }
  | { nome: "erro"; mensagem: string };

const ACEITOS = "image/*";

export function ControleDeFoto() {
  const [situacao, setSituacao] = useState<Situacao>({ nome: "vazio" });
  const entrada = useRef<HTMLInputElement>(null);
  const guardadas = useRef<{ chave: string; ticket: string } | null>(null);

  /**
   * Uma repetição silenciosa antes de desistir. Rede de garagem cai uma vez e volta; transformar a
   * primeira queda em mensagem seria pedir à pessoa que fizesse o que o cliente pode fazer sozinho.
   */
  async function enviar(
    destino: { url: string; cabecalhos: Record<string, string> },
    bytes: Blob,
  ): Promise<boolean> {
    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
      const resposta = await fetch(destino.url, {
        method: "PUT",
        headers: destino.cabecalhos,
        body: bytes,
      }).catch(() => null);

      if (resposta !== null && resposta.ok) return true;
    }
    return false;
  }

  async function escolher(arquivo: File) {
    // O teto do seletor é do RNF8, e a recusa acontece **antes de decodificar**: um arquivo de 40 MB não
    // precisa virar bitmap para se saber que não serve.
    if (arquivo.size > LIMITE_DO_SELETOR_EM_BYTES) {
      setSituacao({
        nome: "erro",
        mensagem: "A foto ficou grande demais depois da compressão. Tente uma foto com menos detalhe.",
      });
      return;
    }

    // Trocar a foto sem passar por "Remover" descartaria a `blob:` anterior sem revogá-la, e o navegador
    // segura os bytes até a aba fechar. Uma linha, e a quarta foto não custa quatro fotos de memória.
    if ("previa" in situacao) URL.revokeObjectURL(situacao.previa);

    setSituacao({ nome: "comprimindo" });

    let comprimida;
    try {
      comprimida = await comprimir(arquivo);
    } catch (erro) {
      setSituacao({
        nome: "erro",
        mensagem:
          erro instanceof ImagemIlegivel
            ? "Não foi possível ler esta imagem. Escolha outra foto."
            : erro instanceof ImagemGrandeDemais
              ? "A foto ficou grande demais depois da compressão. Tente uma foto com menos detalhe."
              : "Não foi possível preparar esta foto. Escolha outra.",
      });
      return;
    }

    // A prévia aparece **antes** de qualquer byte subir: é o retorno mais rápido que a tela consegue dar.
    const previa = URL.createObjectURL(comprimida.arquivo);
    setSituacao({ nome: "enviando", previa });

    const resposta = await fetch("/api/anexos/autorizacoes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tipoConteudo: "image/jpeg", tamanhoBytes: comprimida.arquivo.size }),
    });

    if (!resposta.ok) {
      const problema: { codigo?: string } = await resposta.json().catch(() => ({}));
      setSituacao({
        nome: "erro",
        mensagem:
          problema.codigo === "LIMITE_DE_AUTORIZACOES_DE_UPLOAD"
            ? "Muitas fotos enviadas na última hora. Espere um pouco antes de anexar outra."
            : "A foto ficou grande demais depois da compressão. Tente uma foto com menos detalhe.",
      });
      return;
    }

    const autorizacao: {
      chave: string;
      ticket: string;
      upload: { url: string; cabecalhos: Record<string, string> };
      uploadMiniatura: { url: string; cabecalhos: Record<string, string> };
    } = await resposta.json();

    // Guardados para o item 13b, que é quem os manda no `POST /ocorrencias`.
    guardadas.current = { chave: autorizacao.chave, ticket: autorizacao.ticket };

    // Os dois `PUT` em paralelo, direto no storage, **fora da API**. A miniatura é opcional: se ela não
    // subir, a ocorrência é criada igual e a listagem só perde a prévia.
    const principal = enviar(autorizacao.upload, comprimida.arquivo);
    const miniatura =
      comprimida.miniatura === null
        ? Promise.resolve(true)
        : enviar(autorizacao.uploadMiniatura, comprimida.miniatura).catch(() => false);

    const subiu = await principal.catch(() => false);
    await miniatura;

    setSituacao(
      subiu
        ? { nome: "pronta", previa }
        : { nome: "erro", mensagem: "A foto não subiu. Toque para tentar de novo." },
    );
  }

  function limpar() {
    if ("previa" in situacao) URL.revokeObjectURL(situacao.previa);
    guardadas.current = null;
    setSituacao({ nome: "vazio" });
    // Trocar a foto **abandona** o objeto que já subiu — a faxina o recolhe, e a foto nova consome um slot
    // novo das 30/h. Não há chamada de cancelamento no contrato, e não vai haver.
    if (entrada.current !== null) entrada.current.value = "";
  }

  return (
    <div className="space-y-2">
      <label htmlFor="foto" className="block text-sm font-medium">
        Foto <span className="text-muted-foreground">(opcional)</span>
      </label>

      <input
        ref={entrada}
        id="foto"
        type="file"
        accept={ACEITOS}
        className="sr-only"
        onChange={(evento) => {
          const arquivo = evento.target.files?.[0];
          if (arquivo !== undefined) void escolher(arquivo);
        }}
      />

      {"previa" in situacao ? (
        /*
          **`div` com `background-image`, e não `<img>`.** `@next/next/no-img-element` dispara sobre a
          tag, e desativá-lo gastaria o **primeiro `eslint-disable` do repositório** — que o DoD lista
          como um dos quatro instrumentos que substituem o revisor humano. `next/image` também não
          serve: a fonte é uma `blob:` local, sem otimização a fazer e sem dimensão conhecida.

          **A acessibilidade não é perdida no caminho:** `role="img"` + `aria-label` dão ao leitor de
          tela exatamente o que o `alt` daria.
        */
        <div
          role="img"
          aria-label="A foto escolhida"
          className="bg-superficie h-48 w-full rounded-md bg-contain bg-left bg-no-repeat"
          style={{ backgroundImage: `url(${situacao.previa})` }}
        />
      ) : null}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => entrada.current?.click()}
        >
          {situacao.nome === "vazio" ? "Adicionar foto" : "Trocar a foto"}
        </Button>

        {situacao.nome !== "vazio" ? (
          <Button type="button" variant="ghost" className="min-h-11" onClick={limpar}>
            Remover
          </Button>
        ) : null}
      </div>

      {/* **A palavra, sempre** — compromisso A-5. Barra sem texto é defeito. */}
      <p role="status" className="text-muted-foreground text-sm">
        {situacao.nome === "comprimindo"
          ? "Preparando a foto…"
          : situacao.nome === "enviando"
            ? "Enviando a foto — você pode continuar escrevendo."
            : situacao.nome === "pronta"
              ? "Foto enviada."
              : situacao.nome === "erro"
                ? situacao.mensagem
                : ""}
      </p>
    </div>
  );
}
