---
title: "ADR-0001 · Histórico de transições é domínio"
description: "Por que a auditabilidade é invariante do agregado, e não auditoria genérica de infraestrutura."
---

# ADR-0001 — O histórico de transições é conceito de domínio, não auditoria de infraestrutura

**Status:** Aceita · 16/08/2026

## Contexto

O desafio fecha a descrição do fluxo principal com a exigência mais enfática do documento: *"cada
transição de status deve ser auditável"*. E especifica os cinco campos do registro: status anterior, novo
status, data e horário, usuário responsável, e observação da alteração.

A mesma exigência pode ser atendida na infraestrutura, com auditoria genérica. É um padrão maduro, com
três formas conhecidas: tabelas-sombra, em que cada recurso ganha uma tabela de histórico alimentada a
cada atualização; gatilho genérico gravando a diferença em JSONB; e versionamento temporal por extensão
do banco. Todas capturam o que mudou na linha, em qualquer tabela, sem código de domínio.

## Decisão

O histórico de transições é modelado **dentro do agregado `Ocorrência`**:

- o `status` só muda por comandos nomeados — `analisar`, `iniciarAtendimento`, `pausar`, `retomar`,
  `resolver` e `cancelar`;
- cada comando produz exatamente um registro de transição, na mesma operação;
- o registro é imutável e vive dentro do limite do agregado, e nada de fora o escreve;
- nenhum código fora do agregado escreve `status`.

**O argumento decisivo é o campo `observação`.** Ele é intenção humana declarada no momento do comando, e
um gatilho que compara linha velha com linha nova nunca vai produzi-lo, porque ele não decorre de mudança
de coluna nenhuma. O mesmo vale para o motivo da pausa e para o motivo do cancelamento. Auditoria genérica
responde *o que mudou na linha*; o desafio pede *o que aconteceu e por quê*.

O segundo argumento é a consistência forçada. Se ninguém de fora escreve `status` e a única porta são os
comandos, torna-se impossível mudar o estado sem passar pelo código que grava o histórico, e a
auditabilidade deixa de depender do cuidado de quem programa. O mesmo limite resolve as transições
ilegais, que passam a ser recusadas no mesmo lugar em que a trilha é escrita.

Auditoria genérica pode ser acrescentada depois como defesa em profundidade, sem alterar esta decisão.

## Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| Tabelas-sombra | Capturam a diferença entre linhas, e não a intenção, então não produzem a observação. Amarram a auditoria ao esquema físico |
| Gatilho genérico com JSONB | O mesmo limite, com prêmio de espaço de cerca de duas vezes e consulta histórica pior |
| Versionamento temporal | O mesmo limite, e o PostgreSQL não o tem de forma nativa: depende de extensão |
| Event sourcing | Entregaria a melhor auditoria possível, ao custo de o estado passar a ser derivado do fluxo de eventos. Incompatível com o prazo e com o tamanho do time |

## Consequências

**O que se ganha**

- A auditabilidade passa a ser propriedade da estrutura, e não convenção de time.
- Transição ilegal é bloqueada no mesmo ponto em que a trilha é gravada.
- A máquina de estados fica testável em memória, sem banco, em milissegundos.
- O registro de transição já tem formato de evento de domínio, o que mantém aberto o caminho para event
  sourcing a custo quase zero.

**O que custa**

- Toda operação nova que mude status exige um comando explícito. Não há auditoria de graça.
- Escrita que contorne a aplicação, como SQL manual ou script de migração, escapa do histórico. A
  mitigação é a permissão restrita de banco descrita em [Segurança](../seguranca.md).
- Histórico de outros recursos fica fora desta decisão. Para esse caso a auditoria genérica segue sendo a
  resposta provável, e os dois mecanismos coexistem sem conflito.

Esta decisão não trata da linha do tempo que o Solicitante lê ao acompanhar o andamento: aquilo é um
modelo de leitura derivado, que combina transições com atribuições e mensagens.

## Fontes

- [FHIRbase, documentação](https://healthsamurai.github.io/fhirbase-site/docs.html)
- [Cybertec, opções de auditoria de linha no PostgreSQL](https://www.cybertec-postgresql.com/en/row-change-auditing-options-for-postgresql/)
- [Supabase, auditoria em 150 linhas de SQL](https://supabase.com/blog/postgres-audit)
- Michael Nygard, *Documenting Architecture Decisions* (2011), de onde vem o formato desta ADR.
