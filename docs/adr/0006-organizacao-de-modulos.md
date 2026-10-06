---
title: "ADR-0006 · Organização de módulos"
description: "Camada no primeiro nível e agregado no segundo, com as regras de fronteira vivendo na configuração do lint."
---

# ADR-0006 — Organização de módulos: camada no primeiro nível, agregado no segundo

**Status:** Aceita · 21/08/2026 · Complementa a
[ADR-0005](0005-regra-de-dependencia-por-inversao.md)

## Contexto

Nenhum documento do pacote decidia onde o código mora, e a tarefa seguinte era o esqueleto da aplicação,
que é onde a estrutura nasce. Decidir depois não seria decidir: seria refatorar.

Duas restrições moldam a escolha. O Next.js impõe o anel externo, porque as rotas de API ficam onde ele
manda. E há um implementador, o que muda o cálculo entre uma estrutura que comunica e uma que se mantém.

## Decisão

**Camada no primeiro nível, agregado no segundo.**

```
app/                              ← Interface, metade externa (imposta pelo Next.js)
  api/<recurso>/route.ts            traduz HTTP, valida formato, monta e entrega
  (rotas de tela)/                  as telas

src/
  interface/                      ← Interface, metade adaptadora
    schemas/                        validação do campo, e origem da especificação da API
    projecoes/                      agregado → os formatos que a API devolve

  aplicacao/<agregado>/           ← Aplicação
    <comando>.ts                    uma função por comando de domínio
    consultas.ts                    os modelos de leitura
    portas.ts                       as interfaces que esta camada consome

  dominio/<agregado>/             ← Domínio
    <Agregado>.ts                   a raiz, os comandos, as invariantes

  infraestrutura/
    repositorios/<agregado>/      ← implementam as portas; devolvem agregado, nunca linha
    clientes/                     ← banco, armazenamento e contas: o único lugar que importa SDK
    contexto/                       o ponto único de resolução de escopo

  composicao/                     ← monta o grafo de objetos; não decide regra
```

As duas fusões de nome viram diretórios em vez de prosa: `app/` mais `src/interface/` são a camada
Interface, e repositórios mais clientes são a Infraestrutura.

### As regras de importação

**Só para dentro.** De `app/` e `src/interface/` para `aplicacao/`, e de `aplicacao/` para `dominio/`.
Nunca ao contrário.

**A infraestrutura é importada apenas pelo ponto de composição.** Nem a Aplicação a importa: ela declara a
porta e recebe a implementação. É a regra que torna a inversão mecânica em vez de combinada.

**O ponto de composição é importado apenas pelos caminhos declarados na configuração do lint.** Somado à
regra anterior, o efeito deixa de ser convenção e passa a ser estrutura: uma rota que não passe pelo
ajudante não tem porta, não tem consulta e não tem cliente, logo não tem como falar com o banco. É a
defesa estrutural do risco principal da
[ADR-0003](0003-isolamento-de-tenant-na-camada-de-aplicacao.md).

**Entre módulos da mesma camada, só pela superfície pública.** Cada módulo expõe um `index.ts`, e ninguém
alcança arquivo interno de outro.

Há ainda regras que não falam de camada: o acesso sem organização só é importável nas rotas de uma lista
fechada, e o emissor de credencial de upload e o armazenamento de anexo, apenas nas rotas que os usam. A
primeira é a lista fechada da ADR-0003 virada mecanismo — o que aquela decisão exige de uma exceção nova
passa a ser uma linha de configuração com o caminho escrito nela.

**As regras moram na configuração do lint, e esta decisão não repete a lista nem o total.** O número já
esteve errado duas vezes. Um documento que enuncia o total exige alteração a cada regra nova; um que aponta
para o arquivo, não.

## Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| Colocar tudo de uma funcionalidade junto, ao lado da rota, que é o padrão que o Next.js sugere | Põe o domínio ao lado da rota, que é onde a lógica de transição evapora sob pressão de prazo. O atalho compensa numa aplicação simples, e esta tem uma máquina de estados auditável no meio |
| Agregado no primeiro nível | Comunica melhor o que o sistema faz, e é a escolha certa em base grande com vários times. Aqui multiplica diretórios quase vazios e torna a regra da infraestrutura interna a cada módulo, o que a deixa mais frágil de conferir. É a alternativa boa: se o produto crescer, é para cá que se migra |
| Não declarar estrutura, deixando nascer no esqueleto | Era o estado anterior. O custo de decidir agora é uma tabela; o de decidir depois é mover arquivos com o histórico junto |
| Espelhar os nomes dos anéis da Clean Architecture | Discordaria do vocabulário que o pacote inteiro usa. Um de-para custa uma tabela, em vez de uma refatoração de referências cruzadas |

O que decidiu a favor da camada no topo: a regra de dependência só é verificável se a infraestrutura for
um caminho, e a regra de lint encolhe de uma camada inteira para um diretório, passando a cobrir também
armazenamento e contas.

## Consequências

**O que se ganha**

- A regra de dependência da [ADR-0005](0005-regra-de-dependencia-por-inversao.md) vira caminho de arquivo,
  que é o que uma regra de lint sabe conferir.
- O esqueleto nasce com lugar para cada coisa.
- Um lugar só para os esquemas de validação, servindo o formulário e a especificação da API.

**O que custa**

- **A árvore não grita o domínio.** Quem abre o repositório vê camadas, e não ocorrências. É a perda real
  desta escolha, e está registrada acima como a alternativa que ficou de fora.
- **Uma mudança num agregado toca quatro diretórios**, o que com um implementador é atrito de navegação.
- **A estrutura é uma aposta feita antes do código**, e corrigi-la é outra decisão registrada.

Só os agregados que têm comportamento ganham pasta em domínio e em aplicação. Pasta vazia criada por
simetria não passa no critério de utilidade que esta decisão usa.
