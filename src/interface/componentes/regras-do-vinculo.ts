import { FINALIDADES_DE_CONTATO } from "@/dominio/pessoa";
import {
  TEXTOS_DO_FORMULARIO,
  type Papel,
} from "@/interface/componentes/frases-de-participantes";
import {
  PREFIXO_BR,
  converterTelefoneDigitado,
  telefoneLegivel,
  telefoneNoCampo,
} from "@/interface/componentes/telefone";
import type { ErrosDeCampo } from "@/interface/ganchos/use-formulario-tocado";
import { cadastroDeVinculoSchema, correcaoDeVinculoSchema, errosDoSchema } from "@/interface/schemas";

/**
 * ============================================================================
 *  As regras do formulário de vínculo — cadastrar e editar participante (44j)
 * ============================================================================
 *
 * **Saíram de `sub-formulario-de-contatos.tsx`** (itens 9b e 44j): o que decide precisa rodar em Node, e
 * o que ficava dentro do `.tsx` não tinha teste nenhum.
 *
 * **O cliente valida com o mesmo schema da rota**, sobre o corpo já montado: é a razão escrita de o `zod`
 * estar no projeto (ADR-0007, decisão 3), e é o que faz o e-mail malformado acender antes do envio. As
 * três regras que o schema não vê — duplicata na lista, telefone que não converte e campo vazio — moram
 * em `erroDoContato`, e ganham dele.
 */

export type ContatoEmEdicao = {
  /** Chave estável de React. Não é o `id` do banco — a substituição descarta os antigos. */
  readonly chave: string;
  readonly tipo: "telefone" | "email";
  /** O que a pessoa digitou. Telefone só vira E.164 na hora de montar o corpo. */
  readonly valor: string;
  readonly finalidade: (typeof FINALIDADES_DE_CONTATO)[number];
  readonly temWhatsapp: boolean;
  readonly observacao: string;
};

/** O contato como `GET /vinculos` o projeta. */
export type ContatoDaApi = {
  readonly id: string;
  readonly tipo: string;
  readonly valor: string;
  readonly finalidade: string;
  readonly temWhatsapp: boolean;
  readonly observacao: string | null;
};

export const ROTULO_DE_FINALIDADE: Readonly<Record<ContatoEmEdicao["finalidade"], string>> = {
  pessoal: "Pessoal",
  trabalho: "Trabalho",
  recado: "Recado",
};

function finalidadeConhecida(valor: string): ContatoEmEdicao["finalidade"] {
  return FINALIDADES_DE_CONTATO.find((finalidade) => finalidade === valor) ?? "pessoal";
}

/**
 * O que `GET /vinculos` devolveu, virando linha editável. **O telefone entra no campo como a pessoa o
 * lê** (`+55 (11) 98123-4567`), e não como E.164 cru; a conversão de volta aceita a forma.
 */
export function contatoVindoDaApi(contato: ContatoDaApi): ContatoEmEdicao {
  const tipo = contato.tipo === "email" ? "email" : "telefone";
  return {
    chave: contato.id,
    tipo,
    valor: tipo === "telefone" ? telefoneNoCampo(contato.valor) : contato.valor,
    finalidade: finalidadeConhecida(contato.finalidade),
    temWhatsapp: contato.temWhatsapp,
    observacao: contato.observacao ?? "",
  };
}

/** O contato acrescentado entra **no fim** da lista, como o último a ser tentado (quadro 7 do protótipo). */
export function contatoNovo(chave: string): ContatoEmEdicao {
  return { chave, tipo: "telefone", valor: PREFIXO_BR, finalidade: "pessoal", temWhatsapp: false, observacao: "" };
}

/**
 * Trocar o tipo. **E-mail não carrega WhatsApp** (`contatos_whatsapp_ck`), e o país que o campo de
 * telefone traz sozinho não fica num campo de e-mail — o que a pessoa digitou fica.
 */
export function comTipo(contato: ContatoEmEdicao, tipo: ContatoEmEdicao["tipo"]): ContatoEmEdicao {
  if (tipo === contato.tipo) return contato;
  const aparado = contato.valor.trim();
  const semValor = aparado === "" || aparado === PREFIXO_BR.trim();
  return {
    ...contato,
    tipo,
    temWhatsapp: tipo === "telefone" && contato.temWhatsapp,
    valor: semValor ? (tipo === "telefone" ? PREFIXO_BR : "") : contato.valor,
  };
}

export type ContatoNoCorpo = {
  readonly tipo: "telefone" | "email";
  readonly valor: string;
  readonly finalidade: (typeof FINALIDADES_DE_CONTATO)[number];
  readonly temWhatsapp: boolean;
  readonly observacao: string | null;
};

/**
 * A lista virando corpo. **Sem `ordem`:** quem a grava é o servidor, pela posição (decisão 2.1 do 9b).
 *
 * Devolve `null` quando algum valor não fica pronto — quem chama não envia, e o erro já está no campo.
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
 * `+5511955217788` são o mesmo contato para o `UNIQUE (pessoa_id, tipo, valor)`.
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
 * **Compara conteúdo E ordem** — subir e descer sem editar nada **é** alteração, e é a única que um
 * comparador de conjunto não vê. Serve à decisão 2.3: quando nada mudou, o `PATCH` **omite** `contatos`,
 * e os `id` e `criadoEm` das linhas sobrevivem a uma correção de unidade.
 */
export function listaMudou(
  atual: readonly ContatoEmEdicao[],
  original: readonly ContatoEmEdicao[],
): boolean {
  return JSON.stringify(paraCorpo(atual)) !== JSON.stringify(paraCorpo(original));
}

export const MENSAGENS_DE_CONTATO = {
  repetido: "Este contato já está na lista.",
  semNumero: "Informe o número.",
  semEmail: "Informe o e-mail.",
} as const;

/** O nome do campo daquele contato no formulário tocado. */
export function campoDoContato(chave: string): string {
  return `contato:${chave}`;
}

/** Os cinco identificadores de uma linha de contato, num lugar só. */
export function idDoContato(
  prefixo: string,
  chave: string,
  parte: "tipo" | "valor" | "finalidade" | "whatsapp" | "observacao",
): string {
  return `${prefixo}-${chave}-${parte}`;
}

/**
 * O erro do campo do valor, **na ordem em que as regras valem**: a duplicata fala da lista inteira, o
 * vazio fala do que a pessoa não escreveu, e o resto é forma. A frase do telefone é a do schema, que
 * T-02 também usa: uma regra, uma redação.
 */
export function erroDoContato(
  contato: ContatoEmEdicao,
  duplicado: boolean,
  doSchema?: string,
): string | undefined {
  if (duplicado) return MENSAGENS_DE_CONTATO.repetido;
  if (contato.tipo === "telefone") {
    const convertido = converterTelefoneDigitado(contato.valor);
    if (convertido.situacao === "vazio") return MENSAGENS_DE_CONTATO.semNumero;
    if (convertido.situacao === "recusado") return convertido.mensagem;
    return undefined;
  }
  if (contato.valor.trim() === "") return MENSAGENS_DE_CONTATO.semEmail;
  return doSchema;
}

/** O corpo que vai ao schema: o valor pronto quando converte, e o digitado quando não. */
function corpoParaConferir(contatos: readonly ContatoEmEdicao[]): readonly ContatoNoCorpo[] {
  return contatos.map((contato) => ({
    tipo: contato.tipo,
    valor: valorNormalizado(contato) ?? contato.valor.trim(),
    finalidade: contato.finalidade,
    temWhatsapp: contato.tipo === "telefone" && contato.temWhatsapp,
    observacao: contato.observacao.trim() === "" ? null : contato.observacao.trim(),
  }));
}

export type DadosDoFormulario = {
  readonly modo: "cadastro" | "correcao";
  /** Quem tem conta não edita nome nem contatos: eles são globais (contrato §8.2). */
  readonly editaNomeEContatos: boolean;
  readonly nome: string;
  readonly papel: string | null;
  readonly contatos: readonly ContatoEmEdicao[];
};

export function errosDoFormularioDeVinculo(dados: DadosDoFormulario): ErrosDeCampo {
  const contatos = corpoParaConferir(dados.contatos);
  const doSchema =
    dados.modo === "cadastro"
      ? errosDoSchema(cadastroDeVinculoSchema, {
          nome: dados.nome,
          papel: dados.papel ?? "",
          areaId: null,
          contatos,
        })
      : errosDoSchema(
          correcaoDeVinculoSchema,
          dados.editaNomeEContatos ? { nome: dados.nome, contatos } : {},
        );

  const duplicados = indicesDuplicados(dados.contatos);
  const erros: Record<string, string | undefined> = {};

  if (dados.editaNomeEContatos) erros["nome"] = doSchema["nome"];
  // A mensagem do papel é a da tela: a do schema é da biblioteca, e fala em inglês.
  if (dados.modo === "cadastro") {
    erros["papel"] = dados.papel === null ? TEXTOS_DO_FORMULARIO.erroDoPapel : undefined;
  }
  if (dados.editaNomeEContatos) {
    dados.contatos.forEach((contato, indice) => {
      erros[campoDoContato(contato.chave)] = erroDoContato(
        contato,
        duplicados.has(indice),
        doSchema[`contatos.${String(indice)}.valor`],
      );
    });
  }
  return erros;
}

/** O `erros[]` do `400 FORMATO_INVALIDO` virando erro de campo (contrato §6.1). */
export function errosDoServidorNoFormulario(
  corpo: unknown,
  contatos: readonly ContatoEmEdicao[],
): ErrosDeCampo {
  if (typeof corpo !== "object" || corpo === null) return {};
  const { erros } = corpo as { erros?: unknown };
  if (!Array.isArray(erros)) return {};

  const saida: Record<string, string> = {};
  for (const erro of erros as readonly unknown[]) {
    if (typeof erro !== "object" || erro === null) continue;
    const { campo, mensagem } = erro as { campo?: unknown; mensagem?: unknown };
    if (typeof campo !== "string" || typeof mensagem !== "string" || mensagem.trim() === "") continue;
    const doContato = /^contatos\.(\d+)\.valor$/u.exec(campo);
    if (doContato === null) {
      saida[campo] ??= mensagem;
      continue;
    }
    const chave = contatos[Number(doContato[1])]?.chave;
    if (chave !== undefined) saida[campoDoContato(chave)] ??= mensagem;
  }
  return saida;
}

export function corpoDoCadastro(dados: {
  readonly nome: string;
  readonly papel: Papel;
  readonly areaId: string | null;
  readonly contatos: readonly ContatoEmEdicao[];
}): { nome: string; papel: Papel; areaId: string | null; contatos: ContatoNoCorpo[] } | null {
  const contatos = paraCorpo(dados.contatos);
  if (contatos === null) return null;
  return { nome: dados.nome.trim(), papel: dados.papel, areaId: dados.areaId, contatos };
}

/**
 * **Omitir e `[]` são coisas diferentes** (contrato §8.2): a chave `contatos` só entra quando a lista
 * mudou de verdade. Sem isto, corrigir a unidade apagaria e reinseriria todo contato da pessoa.
 */
export function corpoDaCorrecao(dados: {
  readonly editaNomeEContatos: boolean;
  readonly nome: string;
  readonly areaId: string | null;
  readonly contatos: readonly ContatoEmEdicao[];
  readonly originais: readonly ContatoEmEdicao[];
}): Readonly<Record<string, unknown>> | null {
  if (!dados.editaNomeEContatos) return { areaId: dados.areaId };
  const contatos = paraCorpo(dados.contatos);
  if (contatos === null) return null;
  return {
    nome: dados.nome.trim(),
    areaId: dados.areaId,
    ...(listaMudou(dados.contatos, dados.originais) ? { contatos } : {}),
  };
}

/** *Salvar* sem mudança não envia nada (§4.8.2 da spec). */
export function edicaoMudou(dados: {
  readonly editaNomeEContatos: boolean;
  readonly nomeOriginal: string;
  readonly nome: string;
  readonly areaOriginal: string | null;
  readonly areaId: string | null;
  readonly originais: readonly ContatoEmEdicao[];
  readonly contatos: readonly ContatoEmEdicao[];
}): boolean {
  if (dados.areaId !== dados.areaOriginal) return true;
  if (!dados.editaNomeEContatos) return false;
  return (
    dados.nome.trim() !== dados.nomeOriginal.trim() || listaMudou(dados.contatos, dados.originais)
  );
}

/** O contato de quem tem conta, em leitura. */
export function contatoEmLeitura(contato: ContatoDaApi): {
  readonly valor: string;
  readonly finalidade: string;
  readonly whatsapp: string | null;
} {
  return {
    valor: contato.tipo === "telefone" ? telefoneLegivel(contato.valor) : contato.valor,
    finalidade: ROTULO_DE_FINALIDADE[finalidadeConhecida(contato.finalidade)],
    whatsapp: contato.tipo === "telefone" && contato.temWhatsapp ? "Aceita WhatsApp" : null,
  };
}

/**
 * **O `Select` do catálogo recusa valor vazio**, então *Sem unidade* viaja como sentinela e vira `null`
 * no corpo.
 */
export const SEM_UNIDADE = "sem-unidade";

export function seletorDaArea(areaId: string | null): string {
  return areaId ?? SEM_UNIDADE;
}

export function areaDoSeletor(valor: string): string | null {
  return valor === SEM_UNIDADE ? null : valor;
}
