---
title: "ADR-0022 · O e-mail sai por SMTP, com o nodemailer"
description: "O convite pessoal passa a sair por e-mail, por SMTP e com um pacote, por um provedor próprio que não divide cota com a recuperação de senha, dentro da requisição e com lote de vinte."
---

# ADR-0022 — O e-mail sai por SMTP, com o nodemailer

**Status:** Aceita · 04/10/2026

## Contexto

O Gestor passou a convidar, pelo link pessoal, quem ele cadastrou sem conta. O link sai do modal por
cópia, e mandar um a um por mensagem não escala para um condomínio que cadastra dezenas de moradores de
uma vez. O produto passa a enviar o convite por e-mail, do detalhe da pessoa e em massa pela lista.

Até aqui o produto não enviava e-mail próprio. O único e-mail que saía era o de conta, confirmação e
recuperação de senha, e ele sai pelo provedor de autenticação, com um servidor de envio configurado lá. Esse
servidor tem teto de dez mensagens por hora, sem aumento.

O produto também não tem fila nem trabalho em segundo plano, e a aplicação desce a zero réplicas poucos
minutos depois da última requisição.

## Decisão

O convite pessoal sai por um provedor próprio, a Brevo no plano gratuito, com trezentas mensagens por dia.
A recuperação de senha continua pelo provedor de autenticação. Os dois não dividem cota nem credencial: um
envio em massa pelo servidor da autenticação esgotaria as dez mensagens da hora, e a recuperação de senha
do produto inteiro ficaria fora por uma hora, sem erro visível.

O transporte é SMTP, com um adaptador só atrás de uma porta da camada de aplicação. Trocar de provedor
vira trocar duas variáveis, a do servidor com a credencial e a do remetente, e o ambiente local usa a
caixa de teste que a pilha do provedor de autenticação já sobe. Nada sai da máquina de quem desenvolve.

O SMTP entra com o pacote `nodemailer`, que não tem dependência transitiva. Escrever o protocolo à mão
seria escrever justamente a parte em que o defeito mora: a negociação de criptografia e a autenticação.

O envio acontece dentro da requisição, um depois do outro, porque não há fila. O lote tem teto de vinte, e
vinte chamadas de um a dois segundos cabem no tempo de uma requisição. Os tempos de conexão do cliente
são curtos e declarados.

Para cada pessoa, a ordem é gravar o envio, chamar o provedor e só confirmar se ele aceitou. Se ele
recusar ou demorar, a transação desfaz, e o envio que falhou não conta para o limite de um por dia por
endereço nem para o de dez por participante.

## Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| Reusar o servidor de envio da autenticação | Dez por hora, dividido com a recuperação de senha, que cairia junto |
| Domínio próprio de envio | Tem custo, contra a restrição de custo zero; vira troca de configuração quando houver |
| A API HTTP da Brevo | Prende o produto a um provedor, e não tem caixa local para o desenvolvimento e o teste |
| Fila com agendador | Não há trabalho em segundo plano, e a aplicação dorme sem tráfego |
| Enviar o lote em paralelo | O tempo da requisição ficaria imprevisível, e com vinte não há o que ganhar |

## Consequências

O remetente gratuito é reescrito para o domínio do provedor, e o convite pode cair na caixa de spam. O
link para copiar continua no modal, e é o caminho quando o e-mail não chega.

Quando o provedor aceita e a confirmação no banco falha logo depois, o e-mail saiu e o registro não
existe, e um segundo envio para o mesmo endereço no mesmo dia passaria. É o lado barato da ordem escolhida:
o inverso, confirmar antes de enviar, gastaria o envio do dia em cada falha do provedor, que é o caso
frequente.

A aplicação ganha duas variáveis de execução, e a publicação exige as duas no Container App, a do servidor
como segredo. O verificador da imagem passa a procurá-las, com as outras cinco.

O envio em massa segura uma transação aberta por pessoa durante a chamada ao provedor. Na escala do
produto, com lote pequeno, é aceitável.
