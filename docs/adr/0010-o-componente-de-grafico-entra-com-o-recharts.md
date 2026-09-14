---
title: "ADR-0010 · O componente de gráfico entra com o Recharts"
description: "O painel pediu o gráfico que a ADR-0007 tinha adiado, e a dependência entra com o custo medido e a recusa anterior preservada."
---

# ADR-0010 — O componente de gráfico do catálogo entra, e com ele o Recharts

**Status:** Aceita · 14/09/2026 · Substitui parcialmente a [ADR-0007](0007-camada-de-interface-com-shadcn-ui.md)

## Contexto

A [ADR-0007](0007-camada-de-interface-com-shadcn-ui.md) recusou o componente de gráfico do catálogo para a
primeira entrega e escreveu, na mesma linha, a condição da volta: *"Se o painel se provar ilegível, entra
depois, porque é aditivo"*. A condição se cumpriu, e este registro é o que ela previa.

O painel é a tela de indicadores, e o primeiro bloco dela responde se o problema está melhorando ou
piorando, e onde. Até aqui esse bloco foi desenhado com elementos de HTML de largura percentual, num par
de colunas mensais que mostrava duas séries de categoria. Com sete categorias em uso, duas séries não
mostram tendência: mostram as duas primeiras, e quem lê não tem como saber o tamanho do que ficou de fora.

Três coisas de que o bloco precisa já vêm prontas no componente. Empilhar as séries, para que o topo da
pilha seja o total do mês. Rotular o eixo de meses de modo a atravessar a virada do ano. Nomear a série
sob o ponteiro num balão, com o valor dela. Alcançar as três com elementos de largura percentual custa
escrever um eixo à mão, e manter esse eixo depois.

## Decisão

**O componente de gráfico do catálogo entra, e com ele o Recharts como dependência instalada, fixado em
`3.10.1`.**

A recusa da ADR-0007 continua onde está, palavra por palavra, e continua certa para a data em que foi
tomada. Em 21/08/2026 o painel existia como desenho de protótipo, e trazer uma biblioteca de porte para um
indicador que ninguém tinha lido em dados reais seria custo antes de informação. O que mudou é que o painel
foi construído, ganhou semente de demonstração, e o primeiro bloco dele se provou curto.

Duas coisas vêm junto com a decisão, e ficam registradas aqui porque quem for mexer no gráfico as encontra.

**A paleta categórica foi re-escalonada antes de o componente entrar.** O arquivo do catálogo se liga a
`var(--chart-1)` e seguintes, e os valores que o tema trazia não passavam como paleta de categorias: o
terceiro tinha croma 0,06 e lia como cinza, e ele e o primeiro ficavam a cinco graus de matiz um do outro.
Instalar o componente sobre aqueles valores faria o gráfico nascer com duas séries que o olho não separa.
Os valores novos estão em `app/globals.css`, e quem os segura é `testes/interface/tema.test.ts`, que mede
croma, separação perceptual e contraste com a superfície de cada modo.

**O mapa de temas do arquivo copiado saiu.** Ele emitia um seletor `.dark`, e a variante escura deste
produto é `[data-theme="dark"]` mais a consulta de mídia do sistema, sem classe nenhuma. O ramo compilava,
passava no verificador de tipos e nunca acenderia.

## Justificativa

O gráfico responde a pergunta que dá nome ao painel, e as três formas comparadas com os dados da semente
mostraram a área empilhada como a única em que o total do mês aparece junto com a composição dele. Um
desenho próprio chegaria ao mesmo resultado visual, e a conta que decide não é a da primeira versão: é a de
quem mantém o eixo, o empilhamento e o balão depois, com uma pessoa no projeto.

A compatibilidade foi conferida no registro do npm em 14/09/2026. A versão 3.10.1 declara `react` em
`^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0`, e o projeto está em React 19.2.8. A versão fica fixada sem
acento circunflexo, como as outras dependências deste `package.json`, para que uma atualização de terceiro
continue sendo uma decisão e não um efeito colateral de `npm install`.

O gráfico vive numa ilha cliente de **uma** rota, e a informação dele existe também em texto, na lista de
categorias ao lado. Isso mantém o compromisso de não comunicar nada apenas por cor, e mantém o pacote fora
da tela que o RNF6 cronometra.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Manter as colunas mensais de largura percentual | Elas cabem duas séries, e o painel tem sete categorias. Crescer o desenho para empilhar quatro séries com eixo de mês e balão é escrever uma biblioteca pequena, e mantê-la sozinho |
| Uma biblioteca de gráfico diferente da que o catálogo usa | O componente do catálogo já traz o contêiner responsivo, o balão e a ligação com os tokens de cor. Escolher outra base significaria escrever essa camada, e perder a linha que o CLI mantém |
| Gerar o gráfico no servidor, como imagem | Remove o balão e o redimensionamento, e troca uma dependência de navegador por uma de build. O ganho seria de pacote, e o pacote já está fora da tela cronometrada |
| Adiar de novo, mantendo a recusa da 0007 | A condição que a própria 0007 escreveu se cumpriu. Adiar sem a condição mudar seria decidir sem critério |

## Consequências

**Positivas**

- O primeiro bloco do painel passa a mostrar o total do mês e a composição dele, com quatro séries: as três
  categorias de maior total e uma faixa para o resto.
- A paleta de gráfico deixa de ser inventário sem consumidor e passa a ter garantia de teste.
- O balão dá o valor por série sem que a tela precise de uma coluna para cada mês.

**Negativas, declaradas**

- A frase da ADR-0007 sobre o código dos componentes morar no repositório tinha duas exceções conhecidas,
  os primitivos e os ícones. Agora são três, e esta é a primeira que entra por uma tela.
- A consequência positiva da ADR-0007 de que nenhuma atualização de terceiro pode quebrar a interface
  durante as seis semanas deixa de valer para o gráfico.
- **O custo medido.** O Recharts declara 11 dependências diretas, entre elas `@reduxjs/toolkit`,
  `react-redux`, `immer` e `victory-vendor`. O fecho transitivo tem 37 pacotes, dos quais 13 chegaram ao
  projeto só por causa dele. Em disco, os 14 somam 16,26 MB, com 7,11 MB no próprio Recharts.
- O arquivo copiado tem manutenção nossa, como todos os outros do catálogo, e a edição que removeu o mapa
  de temas precisa ser refeita se alguém rodar o CLI de novo sobre ele.

## Fontes

- `docs/adr/0007-camada-de-interface-com-shadcn-ui.md`, a recusa e a condição da volta.
- `docs/inventario-de-telas.md`, a tela de indicadores e os cinco blocos dela.
- `app/globals.css` e `testes/interface/tema.test.ts`, os valores da paleta e a medição que os segura.
- O registro do npm, para a versão, os pares declarados e a árvore de dependências.
