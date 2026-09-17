/**
 * ============================================================================
 *  As regras e as palavras de T-04 — item 44l
 * ============================================================================
 *
 * **Nenhum `import`, e é de propósito**, pela mesma razão de `busca-de-candidatos.ts` e de `ciclo.ts`: o
 * arquivo não conhece React, não conhece `next` e não conhece o Domínio, atravessa a fronteira
 * servidor/cliente sem arrastar nada, e é testável num projeto que roda `environment: "node"` e não
 * renderiza componente (ADR-0008).
 *
 * **Toda palavra que T-04 diz mora aqui.** O que fica dentro do `.tsx` não tem teste nenhum; trocar uma
 * frase passa a ser trocar uma constante com caso.
 *
 * **As mensagens de campo dizem o que fazer, não o que falhou** (guia §7). Duas vêm desenhadas na
 * prancheta *"T-04 · celular · foto subindo, registro tentado com dois campos vazios"* — a da descrição e
 * a da área —; as outras duas seguem a mesma forma.
 *
 * **As frases de erro do servidor são as do `inventario-de-telas.md` §7, e nenhuma é inventada aqui.**
 */

export type ValoresDoRegistro = {
  readonly titulo: string;
  readonly descricao: string;
  readonly categoriaId: string;
  readonly areaId: string;
  readonly localizacaoComplemento: string;
};

export const VALORES_VAZIOS: ValoresDoRegistro = {
  titulo: "",
  descricao: "",
  categoriaId: "",
  areaId: "",
  localizacaoComplemento: "",
};

/**
 * Nome do campo → `id` do elemento que recebe o foco, **na ordem do documento**. É o que
 * `useFormularioTocado` percorre para achar o primeiro campo com problema.
 */
export const CAMPOS_DO_REGISTRO: Readonly<Record<string, string>> = {
  titulo: "titulo",
  descricao: "descricao",
  categoriaId: "categoriaId",
  areaId: "areaId",
  localizacaoComplemento: "localizacaoComplemento",
};

/** Os tetos são os do schema de `POST /ocorrencias`, e são o que o contador imprime. */
export const TETO_DO_TITULO = 150;
export const TETO_DA_DESCRICAO = 5000;
export const TETO_DA_REFERENCIA = 200;

export const ROTULOS = {
  titulo: "Título",
  descricao: "Descrição",
  categoria: "Categoria",
  area: "Área",
  referencia: "Referência do lugar",
  foto: "Foto",
} as const;

/** Os textos de exemplo das pranchetas. **Exemplo não é rótulo** (guia §9): o rótulo fica em cima. */
export const EXEMPLOS = {
  titulo: "Ex.: Lâmpada queimada na garagem",
  referencia: "Ex.: perto da vaga 34",
} as const;

export const AJUDA_DA_DESCRICAO = "Uma ou duas frases bastam.";

/** Os dois títulos do aviso flutuante. O de erro diz **o que foi tentado** (`retorno-de-acao.ts`). */
export const TEXTOS_DO_REGISTRO = {
  sucesso: "Ocorrência registrada",
  falha: "Não foi possível registrar a ocorrência",
} as const;

export const MENSAGENS_DE_CAMPO = {
  titulo: "Dê um título à ocorrência.",
  descricao: "Descreva o que aconteceu, em uma frase.",
  categoriaId: "Escolha uma categoria.",
  areaId: "Escolha onde aconteceu.",
} as const;

/** As frases de T-04 no `inventario-de-telas.md` §7. Nenhuma nasce aqui. */
export const FRASES_DO_SERVIDOR: Readonly<Record<string, string>> = {
  ANEXO_NAO_RECONHECIDO:
    "A foto não chegou ou a autorização expirou. Escolha a foto de novo — o resto do que você escreveu está aqui.",
  ANEXO_ACIMA_DO_LIMITE:
    "A foto ficou grande demais depois da compressão. Tente uma foto com menos detalhe.",
  LIMITE_DE_AUTORIZACOES_DE_UPLOAD:
    "Muitas fotos enviadas na última hora. Espere um pouco antes de anexar outra.",
  CATEGORIA_INVALIDA: "Esta categoria não está mais disponível. Escolha outra.",
  AREA_INVALIDA: "Esta área não está mais disponível. Escolha outra.",
};

/** Os dois códigos que são erro **da foto**, e por isso remontam o controle em vez de falar do formulário. */
export const CODIGOS_DO_ANEXO: readonly string[] = ["ANEXO_NAO_RECONHECIDO", "ANEXO_ACIMA_DO_LIMITE"];

/** Os dois códigos que invalidam uma escolha e por isso **recarregam a lista** (inventário §7). */
export const CODIGOS_DE_ESCOLHA: Readonly<Record<string, "categoriaId" | "areaId">> = {
  CATEGORIA_INVALIDA: "categoriaId",
  AREA_INVALIDA: "areaId",
};

export const SEM_REDE = "Sem conexão. O que você escreveu continua aqui.";

function vazio(texto: string): boolean {
  return texto.trim() === "";
}

/**
 * Os quatro obrigatórios: título, descrição, categoria e área. **A referência do lugar não é
 * obrigatória**, e por isso o `*` não a marca e o rodapé conta quatro.
 */
export function errosDoRegistro(valores: ValoresDoRegistro): Readonly<Record<string, string | undefined>> {
  const erros: Record<string, string> = {};
  if (vazio(valores.titulo)) erros.titulo = MENSAGENS_DE_CAMPO.titulo;
  if (vazio(valores.descricao)) erros.descricao = MENSAGENS_DE_CAMPO.descricao;
  if (vazio(valores.categoriaId)) erros.categoriaId = MENSAGENS_DE_CAMPO.categoriaId;
  if (vazio(valores.areaId)) erros.areaId = MENSAGENS_DE_CAMPO.areaId;
  return erros;
}

/**
 * **A foto entra na conta, e não entrava:** escolher uma foto, esperar subir e cancelar descartava o
 * envio sem perguntar nada.
 */
export function temAlgoEscrito(valores: ValoresDoRegistro, comFoto: boolean): boolean {
  if (comFoto) return true;
  return Object.values(valores).some((valor) => !vazio(valor));
}

/**
 * **O tipo fica ao lado de cada área porque é ele que decide a visibilidade da ocorrência, e ele fica
 * congelado nela** — e porque o Solicitante não tem outro lugar para vê-lo. Não vai em dica de ponteiro:
 * é o sexto compromisso de acessibilidade.
 */
export function rotuloDoTipoDeArea(tipo: "comum" | "privativa"): string {
  return tipo === "comum" ? "área comum" : "unidade privativa";
}

export type FaltaNoRegistro = "categorias" | "areas";

export type VazioDoRegistro = {
  readonly titulo: string;
  readonly corpo: string;
  readonly acao: { readonly href: string; readonly rotulo: string } | null;
};

const DESTINO: Readonly<Record<FaltaNoRegistro, { href: string; rotulo: string }>> = {
  categorias: { href: "/configuracao/categorias", rotulo: "Ir para Categorias" },
  areas: { href: "/configuracao/areas", rotulo: "Ir para Áreas" },
};

/**
 * **O vazio grave.** Não existe estado vazio de formulário — mas com zero categorias ou zero áreas ativas
 * não há como registrar nada. A organização nasce com sementes (POL-01), então isso só acontece se o
 * Gestor desativar tudo.
 *
 * **O botão e a segunda frase andam juntos.** Oferecer o caminho a quem não pode percorrê-lo é o beco que
 * o item 44h passou inteiro tirando do produto; quem não configura lê *"Fale com um Gestor."* e nada mais.
 */
export function vazioDoRegistro(
  faltando: readonly FaltaNoRegistro[],
  podeConfigurar: boolean,
): VazioDoRegistro {
  const semCategorias = faltando.includes("categorias");
  const semAreas = faltando.includes("areas");

  const titulo =
    semCategorias && semAreas
      ? "Esta organização não tem categorias nem áreas ativas."
      : semCategorias
        ? "Esta organização não tem categorias ativas."
        : "Esta organização não tem áreas ativas.";

  const explicacao =
    semCategorias && semAreas
      ? "Sem as duas listas, não há como registrar nada. Reative ao menos uma de cada para voltar a receber ocorrências."
      : semCategorias
        ? "Sem categoria, ninguém consegue dizer que tipo de problema aconteceu. Reative ao menos uma para voltar a receber ocorrências."
        : "Sem área, ninguém consegue dizer onde o problema aconteceu. Reative ao menos uma para voltar a receber ocorrências.";

  if (!podeConfigurar) return { titulo, corpo: "Fale com um Gestor.", acao: null };

  const acao =
    semCategorias && semAreas
      ? { href: "/configuracao", rotulo: "Ir para a configuração" }
      : DESTINO[semCategorias ? "categorias" : "areas"];

  return { titulo, corpo: explicacao, acao };
}

/** O `409`: a tela troca o formulário pelo aviso e pelo caminho, e **não oferece tentar de novo**. */
export const JA_REGISTRADA = {
  titulo: "Esta ocorrência já foi registrada.",
  corpo: "A foto que você anexou já está nela: o envio anterior chegou, mesmo sem resposta na tela.",
  acao: "Ver a ocorrência",
} as const;

/**
 * O painel da tela grande (critérios 11 e 12). A prancheta termina a frase de quem acompanha nomeando um
 * tipo de local, e **esse pedaço sai**: pela D3 a organização **é** o local, e ela pode ser empresa ou
 * bairro. A razão de a frase não citar o tipo está inteira em `depois-de-registrar.tsx`.
 *
 * *(O pedaço que saiu não é escrito aqui por extenso de propósito: a guarda do critério 12 casa
 * texto-fonte e não distingue código de prosa — citar a frase recusada faria o arquivo reprovar por
 * explicar a própria decisão.)*
 */
export const DEPOIS_DE_REGISTRAR = {
  titulo: "Depois de registrar",
  nasce: "nasce assim",
  explicacao: "Um Gestor analisa, define quem cuida e você acompanha cada passo em Ocorrências.",
  acompanha: "Quem acompanha: você e os Gestores.",
} as const;

/** O descarte (critério 9). *"Descartar"* veste `destructive`: é a ação que perde trabalho (guia §7). */
export const DESCARTE = {
  titulo: "Descartar o que você escreveu?",
  corpo: "O que está no formulário não é guardado, e a foto anexada é descartada junto.",
  continuar: "Continuar escrevendo",
  descartar: "Descartar",
} as const;

export const FOTO = {
  vazioTitulo: "Adicionar foto",
  vazioApoio: "Tire na hora ou escolha da galeria.",
  preparando: "Preparando a foto…",
  subindoTitulo: "Enviando a foto",
  subindoApoio: "Você pode continuar escrevendo.",
  prontaTitulo: "Foto pronta",
  prontaApoio: "Ela segue junto com a ocorrência.",
  trocar: "Trocar a foto",
  remover: "Remover a foto",
  naoSubiu: "A foto não subiu. Toque para tentar de novo.",
  ilegivel: "Não foi possível ler esta imagem. Escolha outra foto.",
  naoPreparou: "Não foi possível preparar esta foto. Escolha outra.",
} as const;

export const AREA = {
  gatilhoVazio: "Busque ou escolha",
  tituloDoPainel: "Onde aconteceu?",
  busca: "Buscar pelo nome",
  usadas: "Usadas por você",
  todas: "Todas as áreas",
  semResultado: "Nenhuma área com esse nome.",
  fechar: "Fechar",
} as const;

export const BLOCOS = { oQue: "O que aconteceu", onde: "Onde" } as const;

export const REGISTRAR = "Registrar ocorrência";
export const REGISTRANDO = "Registrando…";
export const CANCELAR = "Cancelar";
