---
title: "Infraestrutura"
description: "Onde cada peça roda, o que a imagem contém, a ordem da esteira de entrega, como se volta atrás, o que a franquia gratuita impõe e como subir a pilha na própria máquina."
---

# Infraestrutura

Um contêiner com a aplicação inteira, PostgreSQL e autenticação gerenciados, e um armazenamento de objetos
para as imagens. Quase tudo dentro de franquias gratuitas permanentes: o e-mail de conta e o
armazenamento de imagens custam centavos no crédito de estudante. A mesma imagem roda na máquina de quem
desenvolve e em produção.

## Onde cada peça roda

| Peça | Provedor | O que faz |
|---|---|---|
| Aplicação | Azure Container Apps | serve a interface, a API e estas páginas, num contêiner só |
| Banco | Supabase PostgreSQL | as ocorrências, a trilha e o cadastro |
| Contas e sessões | Supabase Auth | autenticação, confirmação de e-mail e recuperação de senha |
| E-mail de conta | Azure Communication Services | o servidor de envio do provedor de autenticação, para a confirmação e a recuperação de senha |
| E-mail do convite | Brevo | o convite pessoal, por SMTP, dentro da requisição |
| Imagens | Azure Blob Storage | um contêiner de objetos, alimentado direto pelo aparelho |
| Imagem do contêiner | GitHub Container Registry | pública, consumida sem credencial |
| Esteira | GitHub Actions | verificações, migrações, construção da imagem e implantação |

A aplicação roda na região `chilecentral` e o banco em São Paulo, com latência de cerca de 40 ms entre os
dois. A assinatura de estudante restringe as regiões permitidas a cinco, e a do Brasil não está entre
elas. Contra o orçamento de resposta do produto esse número é ruído, e fica escrito para que ninguém gaste
uma tarde tentando mover a aplicação para mais perto.

## A imagem

O mesmo `Dockerfile` sobe o ambiente local e a produção, em três estágios: dependências, construção e
execução. O estágio final leva apenas a saída autocontida do Next, sem código-fonte, sem dependências de
desenvolvimento e sem testes. Ele roda com usuário próprio, não privilegiado, e tem verificação de saúde
apontada para a tela de entrada.

**A imagem não carrega segredo nem configuração.** Não há `ARG` no arquivo, os arquivos de ambiente são
excluídos antes de qualquer cópia, e não existe variável embutida no pacote que o navegador baixa. As
sete variáveis de execução chegam do próprio Container App em tempo de execução:

| Variável | Para quê |
|---|---|
| `SUPABASE_URL` e `SUPABASE_CHAVE_ANONIMA` | falar com o provedor de autenticação |
| `BANCO_URL` | a conexão do servidor com o PostgreSQL |
| `SEGREDO_DE_SESSAO` | assinar o cookie da organização ativa |
| `ARMAZENAMENTO_CONEXAO` | assinar as credenciais temporárias de upload |
| `CORREIO_SMTP_URL` | o servidor de envio do convite, com a credencial |
| `CORREIO_REMETENTE` | quem aparece como remetente do convite |

Como a imagem é pública, nada disso pode estar nela. Um verificador confere antes da publicação, e
[Testes](testes.md) descreve como.

## Da máquina ao ar

```mermaid
flowchart TB
    MERGE["Mesclagem em main"]
    VER["Verificar<br/>lint, tipos, testes, documentação e site local"]
    COMPOSE["Subir a pilha do zero<br/>num servidor limpo"]
    MIG["Migrar o banco<br/>migrações versionadas"]
    IMG["Publicar a imagem<br/>com o verificador de segredo antes"]
    REV["Nova revisão no Container Apps"]
    TRAF["Apontar todo o tráfego para ela"]
    SITE["Verificar a documentação publicada"]

    MERGE --> VER
    VER --> COMPOSE
    COMPOSE --> MIG
    MIG --> IMG
    IMG --> REV
    REV --> TRAF
    TRAF --> SITE
```

**A ordem importa, e a migração vem antes da imagem.** Voltar atrás na aplicação é imediato; no banco, não
é. Quem aplica a migração é a própria esteira, num passo que falha em voz alta e interrompe a cadeia, em
vez de depender de alguém lembrar de rodar um comando antes da mesclagem.

**Criar revisão não move tráfego.** O ambiente roda em modo de revisões múltiplas, que é a precondição de
poder voltar atrás sem reconstruir nada, e o preço desse modo é que a revisão nova nasce com peso zero. Sem
o passo que aponta o tráfego, a esteira ficaria verde enquanto a URL continuasse servindo o código
anterior.

## Voltar atrás

O Container Apps guarda as revisões anteriores, e voltar é redirecionar o tráfego para uma delas: imediato
e sem reconstruir. A prova de que o caminho de volta tem alvo é a revisão anterior continuar ativa com peso
zero depois de cada entrega.

Migração de banco é versionada em arquivo e não se desfaz sozinha, então mudança destrutiva de esquema
exige o script de volta escrito à mão. É a razão de a ordem segura ser migração compatível primeiro,
código depois.

## O que a franquia gratuita impõe

Sem tráfego, a aplicação escala para zero réplicas; a primeira requisição depois de um período ocioso leva
cerca de 20 segundos enquanto o contêiner inicia.

Nos dias em que alguém de fora vai abrir a aplicação, uma sonda no GitHub Actions a mantém acordada. Ela
só lê duas páginas públicas que não consultam o banco, a tela de entrar e a documentação, e roda de dois
jeitos. Na faixa, chama a cada cinco minutos nos dias e horários declarados numa linha do workflow
`aquecer-a-aplicacao.yml`, o que torna a partida a frio rara nesse período. Na janela, disparada à mão,
chama a cada dois minutos e segura a aplicação quente pela duração escolhida, até quatro horas. Uma
janela custa um despertar, a partida a frio da primeira chamada, porque as seguintes chegam antes de o
contêiner dormir. Fora das duas, a escala a zero volta. Cada hora de janela custa cerca de 1% da franquia
mensal de computação e 60 minutos de execução do Actions; a faixa custa um minuto de Actions a cada cinco.

Quem volta à aplicação pelo mesmo navegador tem a outra metade. O trabalhador de serviço guarda uma casca
sem dado nenhum e, quando a última resposta do servidor que ele viu tem mais de quatro minutos, a pinta na
hora e a troca pela tela assim que o contêiner responde. A primeira visita num navegador ainda não tem
trabalhador, e é a sonda que a cobre.

O projeto de banco na franquia gratuita pausa depois de sete dias de inatividade, e uma pausa derruba a
migração da entrega seguinte. A mitigação é uma consulta trivial agendada diariamente. Já foi semanal, e
falhou: sete dias de janela contra sete dias de intervalo dão margem zero, e o agendador é de melhor
esforço. O intervalo diário dá sete tentativas dentro de cada janela.

O teto de armazenamento do banco na franquia comporta cerca de 55.000 ocorrências, quase trinta vezes o
alvo declarado em [O produto](produto.md). O armazenamento de imagens não é restrição: na escala deste
produto o limite prático é o custo, e ele é da ordem de um dólar por ano.

## O e-mail

O produto envia um e-mail só, o convite pessoal, e ele sai por SMTP. A recuperação de senha sai pelo
provedor de autenticação, com outra credencial e outra cota, e os dois não se misturam.

O envio acontece dentro da requisição, um depois do outro, até vinte por vez, porque não há fila. Quando
o provedor recusa ou demora, nada é gravado, o limite de um por dia por endereço fica intacto, e a tela diz
ao Gestor qual convite não saiu. O link para copiar continua no modal.

No ambiente local, as mensagens ficam na caixa de teste que a pilha do provedor de autenticação sobe, e
nada sai da máquina. A razão de cada escolha está na
[ADR-0022](adr/0022-o-email-sai-por-smtp-com-o-nodemailer.md).

## O ambiente local

```
npm run local
```

Sobe a pilha inteira em contêiner: a aplicação com o mesmo `Dockerfile` da produção, o PostgreSQL e o Auth
da CLI do Supabase, e um emulador do armazenamento de objetos. Um clone limpo chega até aqui sem passo
manual, porque as credenciais do emulador são públicas e fixas.

A esteira sobe essa mesma pilha do zero a cada entrega, num servidor limpo, e bate na aplicação por HTTP.
É o que impede o ambiente local de divergir do publicado sem que ninguém perceba.

O passo a passo, incluindo o que precisa estar instalado, está no
[README do repositório](https://github.com/natanjunior/8FSDT-Hackathon#como-rodar).
