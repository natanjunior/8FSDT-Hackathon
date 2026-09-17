---
title: "ADR-0010 · O componente de gráfico entra com o Recharts"
description: "O painel pediu o gráfico que a ADR-0007 tinha adiado, e a dependência entra com o custo medido e a recusa anterior preservada."
---

# ADR-0010 — O componente de gráfico do catálogo entra, e com ele o Recharts

**Status:** Aceita · 14/09/2026 · Substitui parcialmente a
[ADR-0007](0007-camada-de-interface-com-shadcn-ui.md)

## Contexto

A [ADR-0007](0007-camada-de-interface-com-shadcn-ui.md) recusou o componente de gráfico do catálogo e
escreveu, na mesma linha, a condição da volta: se o painel se provasse ilegível, ele entraria depois,
porque é aditivo. A condição se cumpriu.

O primeiro bloco do painel responde se o problema está melhorando ou piorando, e onde. Ele foi desenhado
com elementos de largura percentual, num par de colunas mensais que mostrava duas séries de categoria. Com
sete categorias em uso, duas séries não mostram tendência: mostram as duas primeiras, e quem lê não tem
como saber o tamanho do que ficou de fora.

Três coisas de que o bloco precisa já vêm prontas no componente: empilhar as séries, para que o topo da
pilha seja o total do mês; rotular o eixo de meses de modo a atravessar a virada do ano; e nomear a série
sob o ponteiro num balão, com o valor dela. Alcançar as três à mão custa escrever um eixo, e mantê-lo
depois.

## Decisão

**O componente de gráfico do catálogo entra, e com ele o Recharts como dependência instalada, em versão
fixa.**

A recusa da ADR-0007 continua onde está, e continua certa para a data em que foi tomada: naquele momento o
painel existia como desenho, e trazer uma biblioteca de porte para um indicador que ninguém tinha lido em
dados reais seria custo antes de informação. O que mudou é que o painel foi construído e o primeiro bloco
dele se provou curto.

Duas coisas vêm junto, e ficam registradas porque quem mexer no gráfico as encontra.

**A paleta categórica foi refeita antes de o componente entrar.** Os valores que o tema trazia não passavam
como paleta de categorias: uma das cores lia como cinza, e duas ficavam próximas demais em matiz.
Instalar o componente sobre aqueles valores faria o gráfico nascer com duas séries que o olho não separa.
Os valores novos são segurados por um teste que mede croma, separação perceptual e contraste com a
superfície de cada modo.

**O mapa de temas do arquivo copiado saiu.** Ele emitia um seletor de classe, e a variante escura deste
produto responde a outra chave. O ramo compilava, passava na verificação de tipos e nunca acenderia.

As três formas comparadas com dados de demonstração mostraram a área empilhada como a única em que o total
do mês aparece junto com a composição dele. Um desenho próprio chegaria ao mesmo resultado visual, e a
conta que decide não é a da primeira versão: é a de quem mantém o eixo, o empilhamento e o balão depois. A
versão fica fixada sem faixa, como as outras dependências, para que uma atualização de terceiro continue
sendo decisão e não efeito colateral de instalação.

O gráfico vive numa ilha cliente de uma rota só, e a informação dele existe também em texto na lista ao
lado. Isso mantém o compromisso de não comunicar nada apenas por cor, e mantém o pacote fora da tela cujo
tempo de registro é cronometrado.

## Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| Manter as colunas de largura percentual | Cabem duas séries, e o painel tem sete categorias. Crescer o desenho para empilhar quatro séries com eixo de mês e balão é escrever uma biblioteca pequena, e mantê-la sozinho |
| Outra biblioteca de gráfico | O componente do catálogo já traz o contêiner responsivo, o balão e a ligação com os tokens de cor. Outra base significaria escrever essa camada |
| Gerar o gráfico no servidor, como imagem | Remove o balão e o redimensionamento, e troca uma dependência de navegador por uma de construção. O ganho seria de tamanho de pacote, e o pacote já está fora da tela cronometrada |
| Adiar de novo | A condição que a própria ADR-0007 escreveu se cumpriu. Adiar sem a condição mudar seria decidir sem critério |

## Consequências

**O que se ganha**

- O primeiro bloco do painel passa a mostrar o total do mês e a composição dele, com as três categorias de
  maior total e uma faixa para o resto.
- A paleta de gráfico deixa de ser inventário sem consumidor e passa a ter garantia de teste.
- O balão dá o valor por série sem que a tela precise de uma coluna para cada mês.

**O que custa**

- As exceções à regra de que o código dos componentes mora no repositório passam de duas a três, e esta é
  a primeira que entra por causa de uma tela.
- A promessa da ADR-0007 de que nenhuma atualização de terceiro pode quebrar a interface deixa de valer
  para o gráfico.
- **O custo medido.** A biblioteca declara onze dependências diretas. O fecho transitivo tem 37 pacotes,
  dos quais treze chegaram ao projeto só por causa dela, somando cerca de 16 MB em disco.
- O arquivo copiado tem manutenção nossa, e a edição que removeu o mapa de temas precisa ser refeita se
  alguém rodar a ferramenta de novo sobre ele.
