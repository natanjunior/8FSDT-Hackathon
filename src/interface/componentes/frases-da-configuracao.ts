import type { Filtro } from "@/interface/componentes/ordem-da-lista";
import type { AvisoDeConclusao, FrasesDaTela } from "@/interface/componentes/retorno-de-acao";

/**
 * ============================================================================
 *  As frases de T-09 · Categorias e T-14 · Áreas — item 44k
 * ============================================================================
 *
 * **Todo o texto das duas telas, parametrizado pela lista.** É a mesma razão que pôs
 * `frases-de-participantes.ts` no 44j: as duas escrevem quase a mesma coisa com o substantivo trocado, e
 * duas cópias divergem na primeira correção.
 *
 * **O gênero é seguro aqui:** *categoria* e *área* são femininas, e *"Ela"* e *"reativá-la"* concordam
 * com o substantivo, não com uma pessoa. O achado A-03 do 44j não se repete.
 *
 * **Nenhuma frase para `LISTA_DESATUALIZADA`:** `mensagemDoProblema` prefere a frase da tela ao `detail`,
 * e o item 50 redigiu *"A lista mudou desde que você a abriu."* exatamente para cá.
 *
 * **`MENSAGEM_GENERICA` não se redeclara**: ela existe uma vez só no produto, em `retorno-de-acao.ts`
 * (critério 44g.6).
 */

export type Lista = "categorias" | "areas";

export type TipoDeArea = "comum" | "privativa";

export type TextosDaLista = {
  readonly titulo: string;
  readonly substantivo: string;
  readonly colunaDoNome: string;
  readonly exemploDaBusca: string;
  readonly acaoDeCriar: string;
  readonly tetoDoNome: number;
  readonly rotuloDoNome: string;
  readonly endpoint: string;
  readonly endpointDaOrdem: string;
};

export const TEXTOS_DA_LISTA: Readonly<Record<Lista, TextosDaLista>> = {
  categorias: {
    titulo: "Categorias",
    substantivo: "categoria",
    colunaDoNome: "Categoria",
    exemploDaBusca: "Ex.: vazamento",
    acaoDeCriar: "Criar categoria",
    tetoDoNome: 60,
    rotuloDoNome: "Nome",
    endpoint: "/api/categorias",
    endpointDaOrdem: "/api/categorias/ordem",
  },
  areas: {
    titulo: "Áreas",
    substantivo: "área",
    colunaDoNome: "Área",
    exemploDaBusca: "Ex.: garagem",
    acaoDeCriar: "Criar área",
    tetoDoNome: 80,
    rotuloDoNome: "Nome",
    endpoint: "/api/areas",
    endpointDaOrdem: "/api/areas/ordem",
  },
};

/**
 * O fato do cabeçalho.
 *
 * **T-09 mantém a frase que o inventário obriga** (*"Sete categorias foram criadas junto com a
 * organização"*), comprimida como a prancheta a escreve. Ela é incondicional: diz como a organização
 * nasceu, e continua verdadeira depois de a pessoa mexer na lista.
 *
 * **T-14 diz *"dentro da organização"*, e não *"dentro do condomínio"*** como a prancheta desenha: a
 * organização pode ser empresa ou bairro (decisão de produto D3), e é a redação do verbete *Localização*
 * do glossário.
 */
export function fatoDaLista(lista: Lista, ativas: number, total: number): string {
  const contagem = `${String(ativas)} ativas de ${String(total)}.`;
  return lista === "categorias"
    ? `${contagem} Sete foram criadas junto com a organização.`
    : `${contagem} Onde, dentro da organização, a ocorrência aconteceu.`;
}

export const TEXTOS_DA_TABELA = {
  arrastar: "Arrastar",
  ordem: "Ordem",
  noFormulario: "No formulário",
  acoes: "Ações",
  ativa: "Ativa",
  inativa: "Inativa",
  buscar: "Buscar pelo nome",
  subir: "Subir uma posição",
  descer: "Descer uma posição",
  filtrar: "Filtrar",
  editar: "Editar",
  tipo: "Tipo",
} as const;

export const ROTULO_DO_FILTRO: Readonly<Record<Filtro, string>> = {
  todas: "Todas",
  ativas: "Ativas",
  inativas: "Inativas",
};

/**
 * **A explicação vem antes do clique** (critério 2 e achado A-06 da spec): o guia manda que ação
 * impossível abra um aviso, e o critério manda deixar alça e setas inertes. O critério vence, e a barra
 * do cartão escreve a razão.
 */
export const FRASE_DO_INERTE = "A ordem se muda com a lista inteira: volte para Todas e limpe a busca.";

export function avisoDeSemAtivas(lista: Lista): string {
  return `Sem nenhuma ${TEXTOS_DA_LISTA[lista].substantivo} ativa, ninguém consegue registrar ocorrência.`;
}

/** O vazio de cada aba. *Todas* nunca chega aqui: lista vazia de verdade tem frase própria. */
export const VAZIO_DO_FILTRO: Readonly<Record<Lista, Readonly<Record<Filtro, string>>>> = {
  categorias: {
    todas: "Esta organização não tem categorias.",
    ativas: "Nenhuma categoria ativa.",
    inativas: "Nenhuma categoria inativa.",
  },
  areas: {
    todas: "Esta organização não tem áreas.",
    ativas: "Nenhuma área ativa.",
    inativas: "Nenhuma área inativa.",
  },
};

export function buscaVazia(lista: Lista): string {
  return `Nenhuma ${TEXTOS_DA_LISTA[lista].substantivo} com esse nome.`;
}

/**
 * **O inventário diz que este estado não existe na prática**, porque a POL-01 semeia sete categorias e
 * duas áreas. Ele está escrito porque a tela não pode ficar em branco se algum dia existir.
 */
export function listaVazia(lista: Lista): string {
  return VAZIO_DO_FILTRO[lista].todas;
}

export type TextosDoModal = {
  readonly tituloDeCriar: string;
  readonly tituloDeEditar: string;
  readonly descricaoDeCriar: string;
  readonly descricaoDeEditar: string;
  readonly principalDeCriar: string;
  readonly principalDeEditar: string;
  readonly enviandoAoCriar: string;
  readonly enviandoAoSalvar: string;
};

const DESCRICAO_DE_EDITAR = "O que mudar aqui aparece no formulário de registro a partir de agora.";

export const TEXTOS_DO_MODAL: Readonly<Record<Lista, TextosDoModal>> = {
  categorias: {
    tituloDeCriar: "Criar categoria",
    tituloDeEditar: "Editar categoria",
    descricaoDeCriar: "Ela entra no fim da lista. A ordem se ajusta depois, arrastando.",
    descricaoDeEditar: DESCRICAO_DE_EDITAR,
    principalDeCriar: "Criar categoria",
    principalDeEditar: "Salvar",
    enviandoAoCriar: "Criando…",
    enviandoAoSalvar: "Salvando…",
  },
  areas: {
    tituloDeCriar: "Criar área",
    tituloDeEditar: "Editar área",
    descricaoDeCriar: "Ela entra no fim da lista. A ordem se ajusta depois, arrastando.",
    descricaoDeEditar: DESCRICAO_DE_EDITAR,
    principalDeCriar: "Criar área",
    principalDeEditar: "Salvar",
    enviandoAoCriar: "Criando…",
    enviandoAoSalvar: "Salvando…",
  },
};

/** A mensagem diz o que fazer, como a prancheta *"T-14 · criar · dois campos obrigatórios vazios"*. */
export function erroDoNome(lista: Lista, valor: string): string | undefined {
  if (valor.trim() !== "") return undefined;
  return `Dê um nome à ${TEXTOS_DA_LISTA[lista].substantivo}.`;
}

export const ERRO_DO_TIPO = "Escolha o tipo da área.";

/** O aviso dentro do modal, **sem número**, assim que o tipo escolhido difere do atual (critério 8). */
export const AVISO_DE_TIPO_NO_MODAL =
  "Mudar o tipo vale de agora em diante — o passado não muda. As ocorrências já registradas mantêm o tipo que a área tinha quando foram criadas.";

export type OpcaoDeTipo = {
  readonly valor: TipoDeArea;
  readonly rotulo: string;
  readonly exemplo: string;
};

export const OS_DOIS_TIPOS: readonly OpcaoDeTipo[] = [
  { valor: "comum", rotulo: "Área comum", exemplo: "garagem, hall, salão" },
  { valor: "privativa", rotulo: "Unidade privativa", exemplo: "apartamento, sala, loja" },
];

export function tipoDoValor(valor: string): TipoDeArea | null {
  return OS_DOIS_TIPOS.find((opcao) => opcao.valor === valor)?.valor ?? null;
}

/** O tipo em palavra. Um valor que o produto não conhece sai como veio. */
export function rotuloDoTipo(tipo: string): string {
  return OS_DOIS_TIPOS.find((opcao) => opcao.valor === tipo)?.rotulo ?? tipo;
}

/** A legenda dos dois tipos, **fixa no cartão de T-14** e nunca em dica de ponteiro (critério 9, A-6). */
export const LEGENDA_DOS_TIPOS =
  "Área comum — garagem, hall, salão. Unidade privativa — apartamento, sala, loja.";

export type TextoDaSituacao = {
  readonly titulo: string;
  readonly corpo: string;
  readonly aviso: string | null;
  readonly confirmar: string;
  readonly confirmando: string;
  readonly destrutiva: boolean;
};

/**
 * A confirmação própria de desativar e reativar (critério 7), da prancheta *"T-09 · desativar:
 * confirmação própria"*. **A última ativa** acrescenta a frase que o inventário obriga e troca o botão
 * para *"Desativar mesmo assim"*: é a única configuração destas telas que quebra outra tela.
 */
export function textoDaSituacao(
  lista: Lista,
  nome: string,
  ativa: boolean,
  ehUltimaAtiva: boolean,
): TextoDaSituacao {
  const substantivo = TEXTOS_DA_LISTA[lista].substantivo;
  if (!ativa) {
    return {
      titulo: `Reativar ${nome}?`,
      corpo: "Ela volta a aparecer no formulário de registro.",
      aviso: null,
      confirmar: "Reativar",
      confirmando: "Reativando…",
      destrutiva: false,
    };
  }
  return {
    titulo: `Desativar ${nome}?`,
    corpo: `Ela deixa de aparecer no formulário de registro. As ocorrências já registradas continuam com esta ${substantivo}, e você pode reativá-la quando quiser.`,
    aviso: ehUltimaAtiva ? avisoDeSemAtivas(lista) : null,
    confirmar: ehUltimaAtiva ? "Desativar mesmo assim" : "Desativar",
    confirmando: "Desativando…",
    destrutiva: true,
  };
}

export const FALHA = {
  mover: "Não foi possível mover",
  criarCategoria: "Não foi possível criar a categoria",
  criarArea: "Não foi possível criar a área",
  salvar: "Não foi possível salvar",
  desativar: "Não foi possível desativar",
  reativar: "Não foi possível reativar",
} as const;

export function falhaAoCriar(lista: Lista): string {
  return lista === "categorias" ? FALHA.criarCategoria : FALHA.criarArea;
}

export function falhaDaSituacao(ativa: boolean): string {
  return ativa ? FALHA.desativar : FALHA.reativar;
}

function comMaiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function avisoDeCriado(lista: Lista, nome: string): AvisoDeConclusao {
  return { titulo: `${comMaiuscula(TEXTOS_DA_LISTA[lista].substantivo)} criada`, descricao: nome };
}

export function avisoDeAlterado(lista: Lista, nome: string): AvisoDeConclusao {
  return { titulo: `${comMaiuscula(TEXTOS_DA_LISTA[lista].substantivo)} alterada`, descricao: nome };
}

export function avisoDeSituacao(lista: Lista, nome: string, ativa: boolean): AvisoDeConclusao {
  const substantivo = comMaiuscula(TEXTOS_DA_LISTA[lista].substantivo);
  return { titulo: `${substantivo} ${ativa ? "reativada" : "desativada"}`, descricao: nome };
}

/**
 * O aviso de T-14 depois de mudar o tipo (critério 8).
 *
 * **Com contagem zero vira sucesso, e isso é decisão** (spec §4.10): o aviso de atenção existe para ser
 * lido e fica na tela até alguém fechá-lo; prendê-lo para dizer *"0 ocorrências mantêm o tipo anterior"*
 * cobraria um clique por uma informação vazia. O texto do sucesso ainda diz o que mudou.
 *
 * **O plural é escrito, nunca montado com `(s)`.**
 */
export function avisoDaMudancaDeTipo(
  nome: string,
  tipo: string,
  contagem: number,
): AvisoDeConclusao {
  const rotulo = rotuloDoTipo(tipo);
  if (contagem <= 0) return { titulo: `${nome} passou a ser ${rotulo}.` };
  const quantas =
    contagem === 1
      ? "1 ocorrência já registrada mantém o tipo anterior."
      : `${String(contagem)} ocorrências já registradas mantêm o tipo anterior.`;
  return {
    forma: "atencao",
    titulo: `${nome} passou a ser ${rotulo}`,
    descricao: `${quantas} O passado não muda.`,
  };
}

/** Os códigos que estas telas conhecem (inventário §7). O resto cai no `detail` do servidor. */
export const FRASES_DA_TELA: Readonly<Record<Lista, FrasesDaTela>> = {
  categorias: {
    CATEGORIA_NOME_DUPLICADO: "Já existe uma categoria com este nome.",
    CATEGORIA_NAO_ENCONTRADA: "Esta categoria não existe mais.",
  },
  areas: {
    AREA_NOME_DUPLICADO: "Já existe uma área com este nome.",
    AREA_NAO_ENCONTRADA: "Esta área não existe mais.",
  },
};
