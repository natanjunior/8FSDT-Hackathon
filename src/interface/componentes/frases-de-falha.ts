/**
 * **As frases do item 90, num lugar só.** A voz é a do guia (`style-guide.md`, as quatro regras de
 * escrita): diz o que aconteceu e o que fazer, sem código, sem `digest`, sem anunciar defeito.
 *
 * **Por que constantes e não texto solto na tela.** São seis superfícies — o 404, as duas páginas de erro
 * e os três cartões de T-05 — dizendo a mesma coisa de três formas diferentes se cada uma escrevesse a
 * sua. E o teste do item confere a voz sobre este objeto, não sobre seis arquivos.
 */
export const FRASES_DE_FALHA = {
  /** A ação de toda fronteira: ela chama `retry()`, nunca `reset()`. */
  acao: "Tentar de novo",
  linhaDoTempo: "A linha do tempo não carregou.",
  regua: "As datas do ciclo não carregaram.",
  conversa: "As mensagens não carregaram.",
  paginaTitulo: "Esta página não carregou.",
  paginaFrase: "Tente de novo em instantes.",
  voltarAoInicio: "Ir para o início",
  inexistenteTitulo: "Página não encontrada",
  inexistenteFrase: "Este endereço não leva a nenhuma página.",
  abrirAplicacao: "Abrir o Resolve Aí",
  lerDocumentacao: "Ler a documentação",
} as const;
