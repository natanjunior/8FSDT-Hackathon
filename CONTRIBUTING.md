# Como contribuir

Este arquivo tem os dois portões do projeto: o que uma tarefa precisa cumprir para **entrar** em
desenvolvimento, e o que ela precisa cumprir para **fechar**.

Eles existem porque a configuração do trabalho os torna mais necessários que o usual. Testes, contêiner,
publicação e documentação são entregáveis exigidos, e são exatamente os itens que ficam por último e não
acontecem. O portão de conclusão converte cada um deles de tarefa futura em condição de pronto.

**Nenhuma caixa depende de outra pessoa para ser marcada.** Portão que quem faz o trabalho não consegue
fechar sozinho não é portão: é espera, e ou fica marcado assim mesmo, ou o item fica aberto. Os dois
desfechos são piores que não ter o portão.

## Para entrar: Definition of Ready

Uma tarefa entra em desenvolvimento quando os cinco forem verdadeiros.

| # | Portão | O defeito que ele previne |
|---|---|---|
| 1 | **Descrição e critérios de aceitação escritos.** O que a tarefa entrega, e como se sabe que entregou | Tarefa que termina quando alguém decide que terminou. Sem critério escrito antes, ele é escrito depois, pelo resultado |
| 2 | **Abordagem técnica clara.** Qual camada muda, qual agregado é afetado, se toca fronteira de contexto. Se a resposta exigir investigação, isso vira tarefa própria, com resultado escrito | Descobrir no meio da implementação que a tarefa era outra, e decidir arquitetura sob pressão de prazo, que é quando a regra de negócio vaza para a rota |
| 3 | **Quebrada em item implementável.** Cabe numa sessão de trabalho; se não cabe, quebra de novo | Item que atravessa semanas sem entregar nada, e cujo progresso ninguém consegue afirmar |
| 4 | **Priorizada e alocada** | Trabalho que existe só na cabeça de quem o faz, e some quando a semana aperta |
| 5 | **Nenhuma ambiguidade em aberto que mude o comportamento desta tarefa.** Se houver, ou ela se resolve, ou a tarefa espera, ou a suposição é assumida por escrito | Implementar sobre ambiguidade não resolvida. Não houve validação de domínio com ninguém de fora do time, então toda decisão de domínio é suposição |

## Para fechar: Definition of Done

### Código

| Portão | O defeito que ele previne | Como se confere |
|---|---|---|
| Lint e verificação de tipos passando, sem exceção adicionada para fazer passar | Código que compila só na máquina de quem escreveu | `npm run lint` e `npm run tipos` |
| **A regra de fronteira respeitada:** nada fora do diretório de clientes importa um SDK, e a infraestrutura só é importada pelo ponto de composição | A camada de domínio conhecendo banco. A regra é o alarme; a garantia é a Aplicação não ter o que importar | `npm run lint`. Não há um único `eslint-disable` no projeto |
| **O repositório devolve agregado ou objeto de leitura declarado**, nunca linha de banco e nunca tipo de ORM | A forma do esquema subindo para dentro da aplicação, o que faz uma mudança de coluna atravessar três camadas | Revisão do tipo de retorno. É o único item desta lista que o lint não confere: a assinatura é legítima, e só devolve a coisa errada |
| **Nenhuma rota toca mais de um agregado** | A rota inchada, que acumula responsabilidade até ninguém saber o que ela faz | Leitura do diff. Uma rota que precise de dois agregados é caso para dividir |
| **Toda consulta nova passa pelo repositório escopado à organização** | O vazamento entre organizações, que é o risco número um do produto | O lint pega a importação; o teste de integração pega o resultado |
| **Consulta que envolva pessoas parte do vínculo, nunca da pessoa** | Uma listagem que devolve o cadastro do sistema inteiro. A tabela de pessoas é global e não tem coluna de organização, então não há filtro que o repositório possa aplicar nela | Teste. A regra de lint não alcança este caso, porque a consulta é legítima e apenas parte da tabela errada |
| **Nenhum segredo assado na imagem.** Sem argumento de build com segredo, sem arquivo de ambiente copiado para dentro | Segredo publicado. A imagem é pública, e o que entra numa camada permanece legível mesmo que um comando de remoção apague o arquivo depois | `npm run verificar:imagem` |
| **As verificações do contrato passam**, se a tarefa toca um endereço da API | Que o estado ganhe uma escrita direta, que a organização volte a ser informada pelo cliente, ou que a especificação prometa um corpo que a rota recusa | `npm run verificar:openapi` |

**Os compromissos de acessibilidade estão cumpridos**, se a tarefa toca interface. Não há teste de
acessibilidade neste projeto e não haverá; o que existe é compromisso de construção, conferido a olho, e
três deles não precisam de ferramenta:

- todo campo tem rótulo associado ao controle, e clicar no rótulo põe o foco no campo. Texto de dica não é
  rótulo: se ele some ao digitar, está errado;
- nenhum alvo de toque menor que cerca de 44 px na largura de celular;
- nada é comunicado só por cor. Prioridade, status e motivo de pausa sempre carregam a palavra.

### Testes

Os portões de teste estão na página [Testes](docs/testes.md), junto do que cada tipo protege e dos
comandos. São cinco, e o resumo é: caminho feliz, uma transição inválida quando a tarefa toca a máquina de
estados, a transição gerando registro, uma entrada na suíte de isolamento quando a tarefa toca consulta, e
custo de teste de um arquivo curto ou nenhum.

### Documentação

| Portão | O defeito que ele previne | Como se confere |
|---|---|---|
| **Glossário atualizado** se surgiu termo novo | Dois nomes para a mesma coisa, que é o defeito que o glossário existe para impedir | Leitura do diff contra [Glossário](docs/glossario.md) |
| **Registro de decisão escrito** se houve decisão de arquitetura com alternativa rejeitada | Decisão tomada e esquecida, que volta a ser discutida em três semanas sem o contexto que a produziu | Leitura do diff contra [as decisões](docs/adr/README.md) |
| Endereço novo da API documentado | Superfície pública que existe no código e não no contrato | `npm run verificar:openapi` |
| Todo bloco de diagrama com sintaxe válida | Falha silenciosa: o repositório mostra o bloco cru e ninguém percebe | `npm run verificar:mermaid` |
| Toda referência e todo link relativo resolvem | A referência errada é idêntica à certa até alguém clicar | `npm run verificar:referencias` |
| Os documentos já reescritos não recaem nos padrões de tom | O texto voltar a ficar denso, um documento de cada vez | `npm run verificar:tom` |

### Publicação

| Portão | O defeito que ele previne | Como se confere |
|---|---|---|
| **Sobe a pilha do zero, em contêiner** | Estado local escondido: a aplicação que só funciona na máquina de quem a escreveu | A esteira sobe a pilha num servidor limpo e bate na aplicação por HTTP |
| **Publicado e acessível por URL** | Entrega que existe só como código, e cuja publicação vira descoberta de última semana | A URL responde |
| **Conferido contra os critérios escritos na entrada** | Autoavaliação disfarçada | Os critérios foram escritos a partir da documentação, antes de existir código |

## Sobre revisão

Não há revisão de código por pares neste projeto, e isso está declarado em vez de disfarçado. A revisão
que existe é funcional: valida comportamento contra critério de aceitação, e não implementação. Ela corre
em paralelo, levanta achado depois e **não trava a entrega** — o que torna isso aceitável é que o caminho
de volta é redirecionar o tráfego para a revisão anterior, que é imediato.

O que substitui o segundo par de olhos:

| Instrumento | O que ele faz no lugar do revisor |
|---|---|
| Os critérios de aceitação | Escritos a partir da documentação, antes de existir código, por quem não implementava. A independência está no momento em que foram escritos |
| Os verificadores do repositório | Rodam a cada envio, **com controle negativo**. Um verificador que aceita tudo é indistinguível de um que funciona, e o controle é o que os separa |
| As regras de fronteira no lint | Conferem a regra de dependência sem depender de ninguém lembrar |
| A suíte de isolamento | Aplica os mesmos casos a toda consulta escopada, preservando o cenário que detecta o vazamento |
| O portão de contrato | Compara a especificação com as rotas e falha se divergirem |

**O que impede o portão de conclusão de virar autoavaliação são as caixas**, e não um dono separado: a
maioria delas é lint, tipos, testes, verificadores e a pilha subindo na esteira. A caixa que uma máquina
fecha, ninguém marca.

## O comando único

```
npm run verificar
```

Lint, tipos, testes unitários e os verificadores de documentação. É o que roda antes de abrir um pull
request, e é o mesmo conjunto que a esteira roda a cada envio. A página [Testes](docs/testes.md) tem os
demais comandos e o que cada um exige.
