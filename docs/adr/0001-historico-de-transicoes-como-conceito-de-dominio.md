# ADR-0001 — O histórico de transições é conceito de domínio, não auditoria de infraestrutura

**Status:** Aceita · 16/08/2026

## Contexto

O enunciado do desafio fecha a seção de fluxo principal com a frase mais enfática do documento:
*"Cada transição de status deve ser auditável."* E especifica os cinco campos do registro: status
anterior, novo status, data e horário, usuário responsável, **observação da alteração**.

Existe uma alternativa tentadora: resolver isso na infraestrutura, com auditoria genérica. É um
padrão maduro e há várias formas dele —

- **Tabelas-sombra**, no estilo do `fhirbase`: cada recurso tem duas tabelas (`patient` e
  `patient_history`); a cada `update`, a versão antiga é copiada para a `_history`. A escrita é
  forçada por *stored procedures*, não por `UPDATE` direto, justamente para o versionamento não
  depender de o cliente lembrar.
- **Trigger genérico + JSONB**, uma função só aplicada a todas as tabelas.
- **Versionamento temporal** (`temporal_tables`, Hibernate Envers no mundo Java).

Todos capturam automaticamente "o que mudou na linha", para qualquer tabela, sem código de domínio. E
há interesse futuro do time em ter histórico de **outros** recursos, não só de `Ocorrência`.

## Decisão

O histórico de transições é modelado **dentro do agregado `Ocorrência`**:

- O `status` só muda através de **comandos nomeados** — `analisar`, `iniciarAtendimento`, `resolver`,
  `cancelar`, `pausar`, `retomar`.
- Cada comando produz **exatamente um** registro `HistoricoTransicao`, **na mesma operação**.
- O registro é **imutável** e vive **dentro** do limite do agregado. Nada de fora o escreve.
- Nenhum código fora do agregado escreve `status`.

Auditoria genérica **não é** o mecanismo deste requisito. Pode ser acrescentada depois como defesa em
profundidade, na camada de infraestrutura, sem alterar esta decisão.

## Justificativa

**1. O campo `observação` não é derivável de um diff.** Este é o argumento decisivo. A observação é
**intenção humana declarada no momento do comando** — um *trigger* que compara linha velha com linha
nova nunca vai produzi-la, porque ela não é consequência de mudança de coluna nenhuma. O mesmo vale
para o motivo codificado do cancelamento e para o motivo da pausa. Auditoria genérica responde *"o
que mudou na linha"*; o enunciado pede *"o que aconteceu e por quê"*. São camadas diferentes, e a de
baixo não substitui a de cima.

**2. Consistência forçada torna a auditabilidade uma invariante, não uma convenção** (aula 5, p.9:
*"somente a lógica do agregado pode alterar o seu estado"*). Se ninguém de fora escreve `status` e a
única porta são comandos, então **é impossível mudar o status sem passar pelo código que grava o
histórico**. A auditabilidade deixa de depender da disciplina do desenvolvedor.

**3. Testabilidade.** Histórico no domínio é testável em memória, sem banco. Política de RLS ou
*trigger* exige banco real em todo teste.

**4. O mesmo limite resolve as transições ilegais.** Não se vai de `Aberta` direto para `Resolvida`,
nem se cancela o que já está `Resolvida`. A regra vive no mesmo lugar que a auditoria.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Tabelas-sombra no estilo `fhirbase` | Captura diff de linha, não intenção — não produz `observação`. Amarra a auditoria ao esquema físico. |
| Trigger genérico + JSONB | Idem, e paga prêmio de espaço (cerca de 2× ) com consulta histórica pior. |
| Versionamento temporal / Envers | Idem; o PostgreSQL não tem versionamento temporal nativo, depende de extensão. |
| Event sourcing | Entregaria a melhor auditoria possível, mas o estado passa a ser derivado do fluxo de eventos. Custo incompatível com 6,5 semanas e um implementador. |

**Convergência que vale registrar:** o instinto do `fhirbase` é o mesmo nosso — **uma porta única de
escrita, para que a invariante não possa ser burlada**. A diferença é onde a porta fica: ele a coloca
no banco (*stored procedure*), nós na aplicação (comando do agregado).

## Consequências

**Positivas**

- A auditabilidade é invariante de desenho, não convenção de time — a frase que isso habilita na
  defesa é *"a auditabilidade não é uma convenção do time, é uma invariante do agregado"*.
- Transições ilegais são bloqueadas no mesmo ponto.
- Testável sem banco, em milissegundos.
- O registro de transição **já tem o formato de um evento de domínio**, o que mantém o caminho para
  event sourcing aberto por custo praticamente zero.

**Negativas e custos assumidos**

- Toda operação nova que mude status precisa de um comando explícito. **Não existe auditoria "de
  graça"** — é código deliberado a cada vez.
- Escrita que contorne a aplicação (SQL manual, script de migração) **escapa do histórico**. Mitigação
  prevista: permissões de banco restritas e, se necessário, auditoria genérica como defesa em
  profundidade.
- **Histórico de outros recursos não está coberto por esta ADR.** Para esse caso a auditoria genérica
  segue sendo a resposta provável, e os dois mecanismos podem coexistir sem conflito — um responde
  "o que mudou na linha", o outro "o que aconteceu e por quê". Será outra ADR.

## Escopo — o que esta ADR não decide

A **trilha de auditoria** tratada aqui não é a mesma coisa que a **linha do tempo** que o Solicitante
vê ao "acompanhar o andamento". Essa é um **modelo de leitura** derivado, que combina transições com
comentários e atribuições. A distinção entre os três termos — *transição de status*, *trilha de
auditoria* e *linha do tempo* — é tratada no glossário.

## Fontes

- **aula 5, p.9** — agregado com consistência forçada (material da disciplina).
- [FONTE EXTERNA] [FHIRbase — documentação](https://healthsamurai.github.io/fhirbase-site/docs.html)
- [FONTE EXTERNA] [Cybertec — opções de auditoria de linha no PostgreSQL](https://www.cybertec-postgresql.com/en/row-change-auditing-options-for-postgresql/)
- [FONTE EXTERNA] [Supabase — auditoria em 150 linhas de SQL](https://supabase.com/blog/postgres-audit)
- [FONTE EXTERNA] Formato ADR de Michael Nygard, *Documenting Architecture Decisions* (2011).
