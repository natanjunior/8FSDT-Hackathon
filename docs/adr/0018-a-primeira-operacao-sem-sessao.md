---
title: "ADR-0018 · A primeira operação sem sessão"
description: "O convite por link lê o nome e o código de uma organização sem sessão nenhuma, por uma porta própria que o lint só deixa usar em dois arquivos."
---

# ADR-0018 — A primeira operação sem sessão

**Status:** Aceita · 26/09/2026 · Substitui parcialmente a
[ADR-0003](0003-isolamento-de-tenant-na-camada-de-aplicacao.md)

## Contexto

O Gestor passou a convidar pessoas por um link com o código da organização, e o QR do mesmo link. Quem
abre o link, no caso comum, ainda não tem conta. A página precisa mostrar a essa pessoa o nome da
organização antes de pedir que ela crie uma conta, e para isso precisa ler o banco sem sessão.

Até aqui toda leitura partia de uma pessoa autenticada. As cinco operações que rodavam sem organização ativa
se qualificavam por ler ou escrever tabela global pela chave da sessão, e as duas escritas fora do funil
de escopo recebiam a organização de um código apresentado por alguém que já tinha entrado.

O contrato também decide que toda leitura de página tem endpoint equivalente. Uma leitura só de página
seria uma operação que o contrato omite.

## Decisão

Existe uma operação sem sessão, e ela é uma só: `GET /convites/{codigo}`. Ela devolve o nome e o código
da organização, e a situação de quem abre: sem sessão, pode pedir, já participa ou já pediu. Sem sessão, a
resposta tem o nome, o código e a situação, e mais nada.

O código é a credencial, pelo mesmo argumento que já valia para o pedido de entrada. Ele circula em
cartaz e em mensagem, e o que ele abre é o nome da organização e um pedido que o Gestor decide.

A operação tem porta de entrada própria na camada de interface, que resolve a sessão se houver e não
entrega nenhuma porta global nem escopada. Uma regra de lint só deixa importar essa porta em dois
arquivos: a rota e a página do convite. É a quarta lista fechada do projeto, e acrescentar um terceiro
arquivo exige decisão nova.

O critério da lista de operações sem organização ativa passa a ser ler ou escrever tabela global pela
chave da sessão, ou pelo código público apresentado.

Código que nunca foi sorteado e código de organização apagada têm a mesma resposta.

## Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| Ler só pela página, sem endpoint | O contrato recusa leitura sem endpoint equivalente, porque ele passaria a omitir uma operação |
| Pôr a rota na lista das operações sem organização ativa | Aquela porta resolve a sessão antes de tudo, e daria recusa por falta de sessão a quem o convite existe para receber |
| Mostrar a página sem o nome da organização, pedindo conta antes | A pessoa criaria conta sem saber onde está entrando, e o convite perderia o que o torna melhor que o código digitado |
| Acrescentar o código aos pedidos da pessoa na leitura de contexto | Mudaria a leitura mais frequente do produto para servir uma tela, e não resolveria o caso sem sessão |

## Consequências

Qualquer pessoa sem conta pode testar códigos e ler nomes de organização. O alfabeto de 32 sinais em oito
casas dá cerca de um trilhão de combinações, e o pedido de entrada já respondia se um código existe a
quem tivesse uma conta gratuita. A operação tira um passo, e não abre uma porta nova.

As duas consultas não são escopadas por organização, e por isso ficam fora da suíte de isolamento. Elas
têm caso de teste escrito à mão, como as duas escritas fora do funil.
