# Resolve Aí — Plataforma de Gestão de Ocorrências

Onde um condomínio, uma empresa ou um bairro registra ocorrências — iluminação, vazamento, limpeza,
segurança, manutenção — e acompanha cada uma até a resolução, com **trilha auditável de toda mudança de
status**. Hoje esse trabalho acontece em grupo de WhatsApp, e-mail e planilha: o pedido chega como texto
solto, alguém transcreve à mão, e é justamente quando a ocorrência trava esperando por alguém que ela
desaparece.

Trabalho da **Fase 5** da pós-graduação em Full Stack Development da FIAP. Entrega em 29/09/2026.

## Estado do projeto

**Documentação de descoberta e arquitetura. Ainda não há código.**

Não há `package.json`, não há build e não há o que instalar. A escolha da stack está registrada e
justificada nas ADRs, mas a implementação começa depois desta etapa — e isso é deliberado: a disciplina
posiciona a escolha de tecnologia no Design Tático, depois do design estratégico.

## O que está entregue

| Documento | O que responde |
|---|---|
| [Documentação da Demanda](docs/documentacao-da-demanda.md) | Quem são as pessoas, qual é o problema, o objetivo com métrica, e os requisitos — funcionais e não funcionais quantificados |
| [Escopo](docs/escopo.md) | O que o produto é, o que entra na primeira entrega, e o que ficou de fora com o motivo de cada corte |
| [Glossário](docs/glossario.md) | A linguagem ubíqua: uma definição por termo, e as colisões de vocabulário que ela resolve |
| [Arquitetura](docs/arquitetura.md) | Design estratégico de DDD e o Documento de Requisito Técnico da Solução |
| [Modelo de Dados](docs/modelo-de-dados.md) | O esquema em PostgreSQL, com cada índice justificado por uma consulta |
| [Contrato de API](docs/contrato-de-api.md) · [openapi.yaml](docs/api/openapi.yaml) | A superfície HTTP, e a especificação executável em OpenAPI 3.1 |
| [Fluxos e Diagramas](docs/fluxos-e-diagramas.md) | Os fluxos que o texto explica pior — e a lista do que decidimos **não** desenhar |
| [Inventário de Telas](docs/inventario-de-telas.md) | O que cada tela responde, o que oferece e qual endpoint chama |
| [Protótipo Low-Fi](docs/prototipo-low-fi.md) | A forma das telas, e o orçamento de tempo do requisito de registro em menos de um minuto |
| [Registros de Decisão (ADR)](docs/adr/) | As decisões de arquitetura, no formato Nygard — com as alternativas rejeitadas |
| [Premissas e Questões Abertas](docs/premissas-e-questoes-abertas.md) | O que assumimos sem confirmar, e o que muda se estiver errado |
| [Definition of Done e Definition of Ready](docs/definition-of-done.md) | Os dois portões de qualidade do projeto |

O índice comentado, com a ordem de leitura, está em **[docs/README.md](docs/README.md)**.

## Por onde começar

**Caminho curto** — a [narrativa da primeira entrega](docs/escopo.md#a-primeira-entrega-em-uma-passada),
na abertura do Escopo: o produto inteiro de ponta a ponta, e o que ele não faz. De lá, a
[Arquitetura](docs/arquitetura.md) e a [ADR-0001](docs/adr/0001-historico-de-transicoes-como-conceito-de-dominio.md),
que é a decisão que sustenta o resto.

**Caminho completo** — a ordem numerada de [docs/README.md](docs/README.md), que é a ordem em que os
documentos foram produzidos: cada um usa o anterior.

## O que define esta solução

**A auditabilidade é invariante, não convenção.** Ninguém de fora escreve `status`: a única porta são
comandos nomeados, e cada um grava o registro de transição na mesma operação. É impossível mudar o status
sem deixar rastro, porque não existe caminho de escrita que o permita ([ADR-0001](docs/adr/0001-historico-de-transicoes-como-conceito-de-dominio.md)).

**O isolamento entre organizações vive num ponto único.** Várias organizações na mesma instância, e o
escopo é aplicado numa função só — não espalhado pelas consultas, onde a próxima consulta esquecida
vazaria dados de outro condomínio ([ADR-0003](docs/adr/0003-isolamento-de-tenant-na-camada-de-aplicacao.md)).

**O container que construímos é o que roda em produção** — não só o ambiente de
desenvolvimento ([ADR-0004](docs/adr/0004-execucao-em-container-no-azure.md)).

**Todo requisito carrega a origem.** `ENUNCIADO · literal` (o desafio define o quê **e** o como) ·
`ENUNCIADO · aberto` (a existência é imposta, a forma é nossa) · `NOSSO` (adição do projeto). É o que
torna o corte de escopo verificável em vez de opinativo: nenhum item `ENUNCIADO` ficou de fora, e todo o
corte recaiu sobre adições nossas.

## Como rodar

**Não há o que rodar ainda.** Quando houver código, esta seção passa a ser o procedimento — subir o
ambiente local em Docker, aplicar as migrações e executar os testes —, e ela é preenchida no primeiro
deploy, que é a primeira tarefa de implementação. O plano de implantação já está escrito na
[Arquitetura](docs/arquitetura.md).

## Como este repositório está organizado

| Pasta | O que é | Está aqui? |
|---|---|---|
| `docs/` | Os entregáveis — é o que este README indexa | **sim** |
| `refs/` | Material de terceiros: o enunciado do desafio e as apostilas das aulas | não — não redistribuímos |
| `trabalho/` | O processo interno: depósito de ideias, decisões em andamento, curadoria do material do curso | não — é rascunho, não entrega |

Onde um documento cita uma decisão de produto por identificador (`D1` a `D27`), uma premissa (`P1` a `P5`)
ou um ponto de atenção (`PA-nn`), o conteúdo está em `docs/` — os identificadores são estáveis e
atravessam todos os documentos.

---

Projeto acadêmico, sem uso comercial. Cinco integrantes, um implementador.
