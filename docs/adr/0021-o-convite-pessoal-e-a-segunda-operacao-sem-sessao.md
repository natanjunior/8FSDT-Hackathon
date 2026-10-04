---
title: "ADR-0021 · O convite pessoal é a segunda operação sem sessão"
description: "O link pessoal de quem o Gestor cadastrou sem conta mostra o nome da pessoa antes do login, por uma segunda leitura sem sessão que o lint fecha em mais dois arquivos."
---

# ADR-0021 — O convite pessoal é a segunda operação sem sessão

**Status:** Aceita · 04/10/2026 · Substitui a [ADR-0018](0018-a-primeira-operacao-sem-sessao.md)

## Contexto

O Gestor cadastra participantes que ainda não têm conta. Para que uma dessas pessoas passe a usar o
aplicativo, ele gera um link pessoal no detalhe dela e o envia. Quem abre o link liga a própria conta ao
vínculo que já existe, sem pedido de entrada: o convite pessoal não cria vínculo, e o Gestor já aprovou
aquela pessoa ao cadastrá-la.

Quem abre o link, no caso comum, ainda não tem conta. A página precisa mostrar a essa pessoa quem o
convite acha que ela é, e de que organização, antes de pedir que crie a conta. Isso exige ler o banco sem
sessão, pelo token do link.

A ADR-0018 abriu a primeira leitura sem sessão, a do convite por código, e fechou a porta em dois arquivos.
Três dias antes desta decisão, o QR de cada área precisou do nome da organização para quem ainda não
entrou, e a escolha foi o contrário: nenhuma leitura nova, a página do QR passou a ser a do convite por
código. As duas decisões diferem porque os dados diferem. O nome de uma organização é público, e o código
público já o alcança pela leitura que existia. O nome de uma pessoa não é público, e só o token do convite
o alcança.

## Decisão

Existem duas operações sem sessão. A segunda é `GET /convites-pessoais/{token}`, e ela devolve o nome da
pessoa, o nome da organização, o papel e a situação de quem abre: sem sessão, pode aceitar ou já
participa. Ela não devolve contato nenhum, porque contato só é legível dentro da organização do vínculo, e
quem abre o link sem conta não está em organização nenhuma.

Token inexistente, adulterado, renovado, aceito, de vínculo revogado ou de pessoa que já ganhou conta têm
a mesma resposta, sem nome nenhum, e com o mesmo status. Um status diferente para o token morto diria que
ele existiu.

A porta sem sessão continua entregando só leitura. A lista fechada do lint passa de dois para quatro
arquivos: a rota e a página do convite por código, e a rota e a página do convite pessoal. Um quinto
arquivo exige decisão nova.

O aceite com conta, `POST /convites-pessoais/{token}/aceite`, exige sessão e roda sem organização ativa,
porque a conta pode não ter vínculo nenhum. Ele entra na lista das operações sem organização ativa, que
passa a ter sete, e o critério da lista se amplia: ler ou escrever tabela global pela chave da sessão,
pelo código público apresentado, ou pelo token apresentado.

O token fica em claro no banco, porque o Gestor recupera o link já gerado. Ele não concede acesso novo:
liga uma conta a um vínculo que o Gestor já aprovou. A janela fecha por quatro lados. Gerar novo link
invalida o anterior, o aceite o mata, revogar o vínculo o invalida, e só quem gere vínculos lê o token. A
razão está escrita também em [Segurança](../seguranca.md).

## Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| Ler pelo código público, como o QR da área | O código alcança o nome da organização, e não o da pessoa |
| Mostrar a página sem o nome da pessoa | Ela criaria conta sem saber quem o convite acha que ela é, e um link encaminhado por engano passaria sem aviso |
| Guardar só o resumo do token | O Gestor não recuperaria o link já gerado, e cada abertura do modal invalidaria o link que já circulou |
| Devolver o e-mail do cadastro para preencher o formulário | Contato sairia sem sessão, para fora da organização do vínculo |

## Consequências

Quem tiver o link lê o nome de uma pessoa e o da organização sem conta nenhuma. É o preço desta decisão, e
ele é limitado: o token tem 32 bytes aleatórios, morre no aceite e na renovação, e o que ele abre já tinha
sido aprovado pelo Gestor.

A leitura e o aceite não são escopados por organização, e por isso ficam fora da suíte de isolamento. Os
dois têm caso de teste escrito à mão, como as leituras do convite por código.

A fusão que o aceite faz, quando a conta já tem uma pessoa própria, depende de saber toda chave que aponta
para o vínculo e para a pessoa. Um teste lê o catálogo do banco e reprova a chave que ninguém classificou,
e é ele que impede a fusão de envelhecer na próxima migração.
