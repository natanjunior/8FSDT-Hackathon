---
title: "ADR-0004 · Execução em contêiner no Azure"
description: "Azure Container Apps com registro no GitHub Container Registry, e a credencial federada no lugar do segredo de longa vida."
---

# ADR-0004 — Execução em contêiner no Azure Container Apps, com registro no GitHub Container Registry

**Status:** Parcialmente substituída pela [ADR-0023](0023-uma-replica-sempre-de-pe.md) · 05/10/2026
· Status original: Aceita · 20/08/2026 · Substitui parcialmente a [ADR-0002](0002-stack-e-plataforma.md)

> A [ADR-0023](0023-uma-replica-sempre-de-pe.md) substitui daqui a escala a zero enquanto a avaliação
> durar: uma réplica fica sempre de pé, paga pelo crédito de estudante. Permanecem válidos o Container
> Apps, o registro de imagem, o armazenamento de anexo e a credencial federada.

## Contexto

A [ADR-0002](0002-stack-e-plataforma.md) escolheu uma plataforma que executa funções, e registrou como
consequência negativa que o `Dockerfile` não era o que rodava em produção: o contêiner servia ao
desenvolvimento e à construção, e nada mais. O desafio exige conteinerização e publicação em nuvem como
entregáveis distintos.

Três informações mudaram o cálculo. Executar o próprio contêiner satisfaz os dois requisitos com um
artefato só. O Azure Container Apps é gratuito na escala deste projeto, com franquia mensal de 180.000
vCPU-segundos, 360.000 GiB-segundos e 2 milhões de requisições, e escala a zero sem cobrança enquanto não
há requisição. E o crédito de estudante deixou de ser restrição para virar reserva, porque a franquia
sozinha cobre o uso.

## Decisão

| Camada | Escolha |
|---|---|
| Execução | Azure Container Apps |
| Registro de imagem | GitHub Container Registry, com imagem pública |
| Armazenamento de anexo | Azure Blob Storage |

Permanece da ADR-0002, sem alteração: Next.js com TypeScript, a aplicação instalável, as rotas de API, o
GitHub com GitHub Actions, e o Supabase para PostgreSQL e autenticação.

A esteira passa a construir a imagem, publicá-la no registro e mandar o Container Apps puxá-la e executá-la.
Imagem pública é consumida sem credencial.

**A esteira autentica no Azure por credencial federada, e não por segredo de longa vida.** O emprego de
implantação não guarda senha: o GitHub emite um token curto por execução, e o provedor de identidade o
aceita porque confia naquele repositório e naquele ambiente. No lugar do segredo ficam três
identificadores públicos, guardados como variáveis e não como segredos, porque não são credencial.

O que decidiu a favor: a divergência entre ambientes desaparece, o custo zero é preservado pela franquia
permanente, e a credencial federada se amarra a repositório mais ambiente, de modo que nem outro ramo nem
uma cópia do repositório obtêm o token.

## Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| Manter a plataforma de funções | Continua satisfazendo o requisito de publicação em nuvem ao pé da letra. O que ela não satisfaz é a leitura de que o contêiner construído é o que roda, e resolver isso custou cerca de um dia |
| Registro de imagem gerenciado do Azure | Custaria cerca de sessenta dólares por ano e não compra nada técnico aqui: imagem privada é inútil num trabalho que será público, e a diferença de latência não aparece neste volume. O registro do GitHub ainda autentica com o token que o Actions já tem |
| Outros serviços de contêiner do Azure | O Container Apps foi escolhido pela franquia mensal gratuita documentada com escala a zero, que é o que preserva o custo zero |
| Mover o código e a esteira para o Azure DevOps | O GitHub Actions ficou porque uma entrega anterior do time já o usou com resultado, e havia precedente validado |
| Mover PostgreSQL e autenticação para o Azure | O modelo de dados já entregue se apoia no provedor de contas atual, e autenticação é problema que decidimos comprar. Trocar exigiria refazer parte do modelo perto da entrega |
| Senha de cliente para a esteira | Funcionava e não exigia mudar o workflow. Recusada porque segredo de longa vida guardado no repositório é a mesma classe de risco que a regra da imagem pública existe para eliminar, e porque o comando que a emite está depreciado |

## Consequências

**O que se ganha**

- O `Dockerfile` roda em produção, e conteinerização e publicação em nuvem passam a ser satisfeitas pelo
  mesmo artefato.
- O limite de armazenamento deixa de ser restrição de projeto.
- O crédito de estudante permanece disponível como reserva.
- **Portabilidade.** Enquanto a aplicação era função, trocar de provedor implicava revisar o modelo de
  execução, e esse era o acoplamento mais caro do desenho. Como contêiner, ela roda em qualquer lugar que
  execute contêineres.

**O que custa**

- **Três provedores:** GitHub para código e esteira, Azure para execução e armazenamento, Supabase para
  banco e contas. Cada um com razão própria, e cada um uma superfície a mais de configuração.
- **Não há mais ambiente de pré-visualização por ramo.** A plataforma anterior gerava uma URL por ramo, e
  a revisão funcional a usava. A revisão passa a acontecer num ambiente único.
- **A imagem é pública**, e qualquer pessoa pode baixá-la. Isso impõe uma regra: nenhum segredo pode ser
  assado em tempo de construção. Segredo passado como argumento de build, ou arquivo de ambiente copiado
  para dentro, permanece nas camadas mesmo que um comando de remoção o apague depois. É portão de tarefa,
  conferido por máquina.
- **Partida a frio com escala a zero.** Já estava declarada quando a plataforma era outra: muda a causa, e
  não o fato. Medida em 20,7 segundos.
- **Preparação maior**, de cerca de um dia.
- **Uma dependência a mais do formato de identificador que o GitHub emite** para a credencial federada.
  Ele se descobre lendo o registro de uma execução real, e não escrevendo o que se espera.

## Fontes

- [Azure Container Apps, preços e franquia mensal](https://azure.microsoft.com/en-us/pricing/details/container-apps/)
- [Billing in Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/billing)
- [Deploy to Azure Container Apps with GitHub Actions](https://learn.microsoft.com/en-us/azure/container-apps/github-actions)
- [Azure Container Registry, preços](https://azure.microsoft.com/en-us/pricing/details/container-registry/)
- [Azure for Students](https://azure.microsoft.com/en-us/free/students)
