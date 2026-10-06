---
title: "ADR-0020 · O navegador guarda só a casca"
description: "A volta à aplicação pinta uma casca guardada enquanto o contêiner inicia; o cache guarda só ela, sem dado de organização, e a saída o apaga."
---

# ADR-0020 — O navegador guarda só a casca, e a saída a apaga

**Status:** Aceita · 30/09/2026 · Complementa a [ADR-0002](0002-stack-e-plataforma.md) e a [ADR-0003](0003-isolamento-de-tenant-na-camada-de-aplicacao.md)

## Contexto

Sem tráfego, o contêiner escala para zero réplicas, e a primeira requisição depois de um período ocioso
espera cerca de 20 segundos enquanto ele inicia ([Infraestrutura](../infraestrutura.md)). Quem volta à
aplicação pelo atalho passa esse tempo diante de uma tela branca.

Um trabalhador de serviço pode responder à abertura de uma página sem esperar o servidor. O que ele
responde, porém, fica guardado no navegador, fora do ponto único em que o isolamento entre organizações é
garantido. Uma página renderizada levaria para lá o nome da organização, as ocorrências e o nome da
pessoa, e sobreviveria à saída num aparelho emprestado.

A casca que as telas de dentro desenham tem esse problema: a barra superior mostra a organização ativa, o
nome e o e-mail de quem está usando, e a navegação depende das permissões do vínculo.

## Decisão

O trabalhador de serviço guarda uma casca desenhada para ser guardada: um documento próprio, com a marca,
o esqueleto do conteúdo e uma linha de espera, sem nenhum dado de organização ou de pessoa. Ela é a mesma
para todo mundo e para toda rota.

Ele só atende abertura de página por `GET`. Quando a última resposta que ele viu do servidor tem mais de
quatro minutos, pinta a casca na hora e deixa o pedido original acordar o contêiner. Com resposta mais
recente, espera a rede até três segundos antes de recorrer à casca. A casca pergunta ao servidor por um
arquivo público até ele responder e então recarrega a própria página, que chega da rede.

O cache guarda duas entradas, a casca e a hora da última resposta, e o teste compara o conjunto inteiro
com essa lista. A saída apaga todos os caches da origem e termina num documento novo. O nome do cache
carrega a versão, que muda com o conteúdo do trabalhador, e a versão nova assume sozinha e apaga as
anteriores.

O trabalhador é escrito à mão e registrado só em produção.

## Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| Guardar a página renderizada | Levaria dado de uma organização para fora do ponto único do isolamento, e ele sobreviveria à saída |
| Guardar a casca de hoje com os campos vazios | Ela é componente de servidor que resolve a sessão antes de desenhar, e separar as duas metades seria refazê-la |
| Guardar os arquivos do build, com um pacote como o Serwist | Guarda o que esta decisão recusa, e traria uma dependência para um trabalhador de poucas dezenas de linhas |
| Cache montado durante o uso, por padrão de endereço | Tudo o que casasse com o padrão entraria, e a prova de ausência deixaria de ser uma lista |
| Mostrar a casca em toda abertura | Dobraria cada abertura com a aplicação acordada: casca, recarga e segunda renderização no servidor |

## Consequências

A volta à aplicação pinta uma tela preenchida enquanto o contêiner inicia. A espera pelo servidor continua
a mesma, e a primeira visita num navegador continua sem trabalhador: quem a cobre é a réplica sempre de
pé da [ADR-0023](0023-uma-replica-sempre-de-pe.md).

Quando outra pessoa manteve o contêiner acordado, a casca pode aparecer por uma fração de segundo antes da
tela. É o custo de decidir pela hora da última resposta vista por este navegador, que é a única informação
que ele tem.

A leitura sem rede continua fora desta versão. Sem conexão, a casca diz que está sem conexão e abre a tela
quando ela volta.
