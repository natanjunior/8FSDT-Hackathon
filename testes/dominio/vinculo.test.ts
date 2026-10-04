import { describe, expect, it } from "vitest";

import {
  ENVIOS_POR_PARTICIPANTE,
  LOTE_DE_ENVIO,
  MOTIVOS_DE_NAO_ENVIO,
  PERMISSOES_POR_PAPEL,
  Vinculo,
  ehPapel,
  type Papel,
} from "@/dominio/organizacao";

/**
 * ============================================================================
 *  Unitário de DOMÍNIO — sem banco, em milissegundos (arquitetura.md §7)
 * ============================================================================
 *
 * Este arquivo não importa nada além de `@/dominio/organizacao`. Não há porta, não há duplo e não há
 * `async`: se algum dia precisar de um dos três, a regra saiu da camada certa.
 *
 * **O que ele protege:** a autorização por permissão, que é a decisão de que a
 * `PRIMARY KEY (pessoa_id, organizacao_id)` de `vinculos` depende (modelo §6.4). Trocar `vinculo.pode(X)`
 * por checagem de papel **não é refatoração local — é migração de esquema**, e é este teste que faz a
 * troca aparecer.
 */

describe("Vinculo.pode — a única pergunta de autorização do sistema", () => {
  it("o Gestor acumula as capacidades do Solicitante", () => {
    // Contrato §4.5: *"o papel define a visão padrão e o conjunto de permissões; não retira capacidade
    // que o enunciado concede"*. É o que dispensa o segundo vínculo do síndico que mora no prédio — e o
    // segundo vínculo é exatamente o que a PK de `vinculos` proíbe.
    const gestor = Vinculo.de("pessoa-1", "organizacao-1", "gestor");
    const solicitante = Vinculo.de("pessoa-1", "organizacao-1", "solicitante");

    for (const permissao of solicitante.permissoes) {
      expect(gestor.pode(permissao), `Gestor deveria acumular ${permissao}`).toBe(true);
    }

    expect(gestor.pode("ocorrencia.registrar")).toBe(true);
    expect(gestor.pode("ocorrencia.avaliar")).toBe(true);
  });

  it("o Solicitante não resolve, não analisa e não lê tudo", () => {
    const solicitante = Vinculo.de("pessoa-1", "organizacao-1", "solicitante");

    expect(solicitante.pode("ocorrencia.resolver")).toBe(false);
    expect(solicitante.pode("ocorrencia.analisar")).toBe(false);
    expect(solicitante.pode("ocorrencia.ler_todas")).toBe(false);
    expect(solicitante.pode("vinculo.gerir")).toBe(false);
    expect(solicitante.pode("organizacao.configurar")).toBe(false);
    expect(solicitante.pode("dashboard.ler")).toBe(false);
  });

  it("o Encarregado não tem permissão nenhuma — declarado, não esquecido", () => {
    // Contrato §4.5: as cinco capacidades do acesso próprio dele são evolução prevista. Um vínculo
    // `encarregado` autentica, recebe `permissoes: []` e leva `403 PERMISSAO_INSUFICIENTE` em qualquer
    // endpoint de negócio. **O contrato declara esse estado em vez de deixá-lo acontecer por acidente** —
    // e este teste é o que impede que a lista ganhe uma permissão por descuido.
    const encarregado = Vinculo.de("pessoa-1", "organizacao-1", "encarregado");

    expect(encarregado.permissoes).toHaveLength(0);
    expect(encarregado.pode("ocorrencia.registrar")).toBe(false);
    expect(encarregado.pode("ocorrencia.ler_propria")).toBe(false);
  });

  it("a permissão vem do papel, não do identificador da pessoa nem da organização", () => {
    const aqui = Vinculo.de("pessoa-1", "organizacao-1", "gestor");
    const ali = Vinculo.de("pessoa-9", "organizacao-2", "gestor");

    expect([...aqui.permissoes]).toStrictEqual([...ali.permissoes]);
  });
});

describe("ehPapel — a fronteira entre o enum do banco e o do domínio", () => {
  it("aceita os três papéis do tipo `papel_vinculo`", () => {
    for (const papel of ["gestor", "solicitante", "encarregado"]) {
      expect(ehPapel(papel)).toBe(true);
    }
  });

  it("recusa o que não é papel — inclusive vocabulário que o glossário aposentou", () => {
    // Glossário: atores são nomeados por função — `Admin` e `User` não são vocabulário deste projeto. E
    // "responsável" **não** é papel: o papel é Encarregado (D27); "Responsável pela ocorrência" é a
    // atribuição, e o glossário registra a colisão nº 2 exatamente aí.
    for (const impostor of ["admin", "user", "responsavel", "GESTOR", "", null, 42, undefined]) {
      expect(ehPapel(impostor)).toBe(false);
    }
  });

  it("o mapa de permissões cobre exatamente os três papéis, e nada mais", () => {
    // Se um papel novo entrar no enum do banco sem entrar aqui, ele autenticaria e cairia num `undefined`
    // ao pedir permissões. O repositório já falha alto nesse caso; este teste falha antes, na revisão.
    const doMapa = Object.keys(PERMISSOES_POR_PAPEL).sort();
    const doDominio: Papel[] = ["encarregado", "gestor", "solicitante"];

    expect(doMapa).toStrictEqual(doDominio);
  });
});

describe("as regras do convite por e-mail (item 122)", () => {
  it("o lote é de 20, o teto por participante é 10, e os sete motivos vão do revogado à falha", () => {
    expect(LOTE_DE_ENVIO).toBe(20);
    expect(ENVIOS_POR_PARTICIPANTE).toBe(10);
    expect(MOTIVOS_DE_NAO_ENVIO).toHaveLength(7);
    expect(MOTIVOS_DE_NAO_ENVIO[0]).toBe("vinculo-revogado");
    expect(MOTIVOS_DE_NAO_ENVIO.at(-1)).toBe("falha-no-envio");
  });
});
