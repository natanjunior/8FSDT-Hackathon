/**
 * A interface do Fumadocs em português.
 *
 * A chave é o texto em inglês seguido do contexto entre parênteses, que é como o Fumadocs a procura; a
 * lista completa está em `fumadocs-ui/dist/.translations/keys.js`. Entram só as que aparecem nas páginas
 * da documentação. As de recursos que o site não usa (chat com IA, abrir em outro editor, tabela de
 * tipos) ficam de fora.
 */
export const traducoes: Record<string, string> = {
  "Back to Home(404 page)": "Voltar ao início",
  "Close Search(search dialog)(aria-label)": "Fechar a busca",
  "Close Sidebar(aria-label)": "Fechar o menu lateral",
  "Close Sidebar(sidebar)(aria-label)": "Fechar o menu lateral",
  "Collapse Sidebar(sidebar)(aria-label)": "Recolher o menu lateral",
  "Copied Text(code block)(aria-label)": "Texto copiado",
  "Copy Anchor Link(heading anchor)(aria-label)": "Copiar o link desta seção",
  "Copy Text(code block)(aria-label)": "Copiar o texto",
  "Dark(theme switcher)(aria-label)": "Tema escuro",
  "Hide Sidebar(sidebar)": "Esconder o menu lateral",
  "Light(theme switcher)(aria-label)": "Tema claro",
  "Next Page(pagination)": "Próxima página",
  "No Headings(table of contents)": "Sem seções",
  "No results found(search dialog)": "Nenhum resultado",
  "On this page(table of contents)": "Nesta página",
  "Open Search(search trigger)(aria-label)": "Abrir a busca",
  "Open Sidebar(sidebar)(aria-label)": "Abrir o menu lateral",
  "Page Not Found(404 page)": "Página não encontrada",
  "Previous Page(pagination)": "Página anterior",
  "Search(search dialog)": "Buscar",
  "Search(search trigger)": "Buscar",
  "Show Sidebar(sidebar)": "Mostrar o menu lateral",
  "System(theme switcher)(aria-label)": "Tema do sistema",
  "Table of Contents(inline table of contents)": "Sumário",
  "The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.(404 page)":
    "A página procurada não existe ou mudou de endereço.",
  "Toggle Menu(mobile menu)(aria-label)": "Abrir ou fechar o menu",
  "Toggle Theme(theme switcher)(aria-label)": "Trocar o tema",
};
