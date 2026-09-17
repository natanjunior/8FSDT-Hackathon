---
title: "Segurança"
description: "Como uma organização não vê o dado da outra, quem entra, o que cada um pode, onde ficam os segredos e o que acontece com foto, localização e conta excluída."
---

# Segurança

Atender várias organizações na mesma instalação é a decisão mais cara do produto, porque multiplica a
superfície de falha de autorização. Esta página mostra o que sustenta a promessa de que uma nunca vê o
dado da outra, e os demais controles em volta dela.

## O isolamento entre organizações

Toda requisição passa por um ponto só, e é ele quem descobre em qual organização se está operando.

```mermaid
flowchart TB
    NAV["Navegador<br/>cookie de sessão"]
    ROTA["Rota HTTP<br/>valida formato, monta a resposta"]
    CTX["Resolução de contexto<br/>usuário, pessoa, organização e papel"]
    REPO["Repositórios já escopados<br/>repos(contexto)"]
    BD[("PostgreSQL")]

    NAV --> ROTA
    ROTA --> CTX
    CTX --> REPO
    REPO --> BD
```

A resolução acontece **uma vez por requisição** e produz o contexto com o usuário, a pessoa, a organização
ativa e o papel. Daí em diante nenhuma consulta é escrita com o filtro de organização repetido à mão:
quem consulta recebe repositórios que já nascem escopados, e o filtro é aplicado numa função só.

O que torna isso um estrangulamento, e não uma boa intenção: **nenhum arquivo fora da camada de
infraestrutura importa o cliente de banco**, e isso é regra de lint, conferida a cada build. Quem quisesse
escapar do funil teria de escrever uma importação que o portão recusa.

**Duas escritas acontecem sem sessão de onde tirar a organização, e as duas estão enumeradas.** Quem pede
entrada numa organização ainda não tem vínculo com ela, e quem cria uma organização está criando o próprio
escopo. Nos dois casos a origem do identificador é declarada: o Código da Organização apresentado na
requisição, no primeiro, e a organização recém-criada, no segundo. A lista é fechada, e um terceiro caso
exigiria alterar a [ADR-0003](adr/0003-isolamento-de-tenant-na-camada-de-aplicacao.md).

A garantia é exercida por teste. Cada consulta escopada entra numa suíte compartilhada que pergunta sempre
as mesmas três coisas, e as duas escritas de fora do funil têm caso próprio. O detalhe está em
[Testes](testes.md).

## Quem entra

Contas e sessões são do Supabase Auth, e o produto não guarda senha. O cadastro exige confirmação por
e-mail antes do primeiro acesso.

**O SDK do provedor roda no servidor, nunca no navegador.** Não existe variável `NEXT_PUBLIC_` neste
projeto, então nada do provedor é embutido no pacote que o navegador baixa. Entre o provedor e o resto do
sistema há uma camada de tradução que devolve apenas o identificador do usuário e o nome sugerido: token,
claim e objeto do SDK param ali e não alcançam o domínio.

A organização ativa viaja num cookie assinado pelo servidor, com segredo próprio. Trocar de organização é
trocar esse cookie, e a troca passa pela mesma resolução de contexto de qualquer outra requisição.

## O que cada um pode

A checagem pergunta **o que o vínculo pode**, e não qual é o papel dele. São dezoito permissões nomeadas,
e o mapa de papel para permissões é constante em código.

| Papel | O que recebe |
|---|---|
| Solicitante | registrar, ler as próprias, comentar, cancelar a própria e avaliar |
| Gestor | tudo do Solicitante, mais ler todas, triar, atribuir, conduzir o atendimento, cancelar qualquer uma, configurar a organização, gerir vínculos e ler o painel |
| Encarregado | nenhuma permissão nesta versão |

O Encarregado com lista vazia é estado declarado: o vínculo autentica, e qualquer endereço de negócio
responde `403 PERMISSAO_INSUFICIENTE`. A diferença entre isso e um esquecimento é que o contrato o
descreve, e o teste o exerce.

Perguntar pela permissão, e não pelo papel, é o que permite ao Gestor que mora no prédio registrar a
própria ocorrência sem precisar de um segundo vínculo.

## O banco não conversa com o navegador

Todas as tabelas têm Row Level Security ligada e **nenhuma política escrita**. No PostgreSQL isso é
negação total: os papéis anônimo e autenticado não leem nem escrevem uma linha. A chave anônima é pública
por natureza, e neste esquema ela não alcança nada.

Quem fala com o banco é o servidor, com credencial que só existe como variável de ambiente do contêiner.
A divisão de responsabilidade é deliberada: o código responde *qual organização*, e o banco responde *quem
pode falar comigo*. Nenhuma das duas cobre a outra.

## A foto não passa pela aplicação

O servidor não transporta os bytes da imagem. Ele assina uma credencial de escrita temporária e restrita
àquele objeto, e o aparelho envia a foto direto para o armazenamento. A credencial de escrita vale quinze
minutos, e a de leitura, dez.

Junto com a credencial o servidor emite um comprovante assinado, que é o que torna o upload verificável na
hora de vinculá-lo à ocorrência. A chave da conta de armazenamento nunca sai do servidor, e a assinatura é
calculada localmente, sem ida ao provedor.

## Dados pessoais

O produto guarda foto, localização e contato de pessoas, e os controles são estes:

| O que | O controle |
|---|---|
| Alcance | foto, localização e contato só são legíveis dentro da organização do vínculo |
| Área privativa | ocorrência registrada numa área privativa é visível ao autor e aos Gestores, e a ninguém mais |
| Exclusão de conta | a pessoa é anonimizada e perde o vínculo com a conta, e a trilha de auditoria permanece com o autor anonimizado |
| Retenção | o histórico não expira, porque apagá-lo destruiria a exigência central do desafio |
| Transporte | tudo por HTTPS, incluindo o envio direto da imagem ao armazenamento |

Um limite fica escrito: **campos de texto livre não são varridos**. Se alguém digitar um dado pessoal na
descrição ou numa observação, a anonimização não o alcança, porque ela opera sobre os campos que o modelo
declara como identificadores.

## Os segredos

Nenhum segredo entra na imagem. Não há `ARG` no Dockerfile, os arquivos de ambiente são excluídos antes de
qualquer cópia, e as cinco variáveis de execução chegam do próprio Container App em tempo de execução. A
imagem publicada é pública, e não carrega configuração de ambiente nenhum.

Isso é conferido por máquina antes de a imagem ir para o registro: um verificador lê o histórico de
construção, e não apenas o sistema de arquivos final, porque uma camada guarda o que um comando de remoção
apagou depois. Ele tem canário positivo, então saída vazia por cegueira não passa como imagem limpa.

A esteira se autentica no Azure por credencial federada de curta duração, emitida para o emprego que
declara o ambiente de produção. Não há segredo do Azure guardado no repositório.

## O que a trilha garante

A auditabilidade é um controle de segurança, e não só um requisito funcional: como o estado da ocorrência
só muda por comando, e todo comando grava o registro na mesma operação, **não existe caminho de escrita
capaz de alterar uma ocorrência sem deixar rastro**. Quem fez, quando e a partir de qual estado ficam
gravados, e o registro não se altera nem se apaga. O mecanismo está em [Domínio e regras](dominio.md).

## Os controles que esta versão não tem

Teste de intrusão, firewall de aplicação, criptografia por coluna, limite de requisições por cliente e
auditoria de acesso de leitura. Ficam nomeados para que a ausência seja escolha visível.
