import { ENVIOS_POR_PARTICIPANTE, LOTE_DE_ENVIO, type MotivoDeNaoEnvio, type Papel } from "@/dominio/organizacao";

import { LoteDeEnvioInvalido } from "./erros";
import type {
  Carteiro,
  Mensagem,
  RepositorioEscopadoDeEnviosDeConvite,
  RepositorioEscopadoDeVinculos,
  ResumoDosEnvios,
  VinculoLido,
} from "./portas";

/**
 * ============================================================================
 *  O convite por e-mail — item 122
 * ============================================================================
 *
 * **Um caminho só para um e para vinte**: o modal manda uma lista de um, e a regra de limite existe uma vez.
 *
 * **Em série, e não em paralelo.** O lote é pequeno de propósito, e a ordem sequencial deixa o tempo da
 * requisição previsível: não há fila nem trabalho em segundo plano, então o envio acontece dentro da
 * requisição (ADR-0022).
 *
 * **As quatro checagens que não dependem do convite vêm antes dele**: a garantia do convite recusa três
 * desses casos, e o resumo precisa do motivo, não da recusa.
 */

export type ResumoDoEnvio = {
  enviados: ReadonlyArray<{ pessoaId: string; nome: string; email: string }>;
  /** `nome` é nulo quando o vínculo não é desta organização ou foi revogado: a resposta não o revela. */
  naoEnviados: ReadonlyArray<{ pessoaId: string; nome: string | null; motivo: MotivoDeNaoEnvio }>;
};

type EntradaDoEnvio = {
  pessoaIds: readonly string[];
  porPessoa: { pessoaId: string; nome: string };
  organizacao: { nome: string };
  novoToken: () => string;
  /** Síncrono: a rota resolve a origem uma vez, antes do laço. */
  montarLink: (token: string) => string;
};

/** O primeiro contato de e-mail pela `ordem`, ou `null`. A ordem já é a escolha do Gestor. */
export function emailDoConvite(vinculo: VinculoLido): string | null {
  const emails = vinculo.pessoa.contatos.filter((c) => c.tipo === "email");
  if (emails.length === 0) return null;
  return [...emails].sort((a, b) => a.ordem - b.ordem)[0]?.valor ?? null;
}

function conferirLote(pessoaIds: readonly string[]): void {
  if (pessoaIds.length === 0) throw new LoteDeEnvioInvalido("Escolha ao menos uma pessoa.");
  if (new Set(pessoaIds).size !== pessoaIds.length) {
    throw new LoteDeEnvioInvalido("A mesma pessoa apareceu duas vezes na lista.");
  }
  if (pessoaIds.length > LOTE_DE_ENVIO) {
    throw new LoteDeEnvioInvalido(`Envie até ${String(LOTE_DE_ENVIO)} por vez.`);
  }
}

/**
 * O papel **em palavra**, para a frase do e-mail (item 126). Mora aqui, e não vem de `@/interface`, pela
 * regra de dependência (ADR-0005). O Encarregado não recebe convite, mas o tipo pede as três chaves.
 */
const PAPEL_NO_CONVITE: Readonly<Record<Papel, string>> = {
  solicitante: "Solicitante",
  gestor: "Gestor",
  encarregado: "Encarregado",
};

/** O motivo que vem antes do convite, ou `null` quando a pessoa pode receber. */
function motivoAntesDoConvite(vinculo: VinculoLido, email: string | null): MotivoDeNaoEnvio | null {
  if (email === null) return "sem-email";
  if (vinculo.temConta) return "ja-tem-conta";
  if (vinculo.papel === "encarregado") return "encarregado";
  return null;
}

export async function enviarConvitesPorEmail(
  repos: { vinculos: RepositorioEscopadoDeVinculos; enviosDeConvite: RepositorioEscopadoDeEnviosDeConvite },
  carteiro: Carteiro,
  entrada: EntradaDoEnvio,
): Promise<ResumoDoEnvio> {
  conferirLote(entrada.pessoaIds);
  const enviados: ResumoDoEnvio["enviados"][number][] = [];
  const naoEnviados: ResumoDoEnvio["naoEnviados"][number][] = [];

  for (const pessoaId of entrada.pessoaIds) {
    // `porPessoa` só devolve vínculo ativo desta organização: o revogado e o de outra chegam iguais.
    const vinculo = await repos.vinculos.porPessoa(pessoaId);
    if (vinculo === null) {
      naoEnviados.push({ pessoaId, nome: null, motivo: "vinculo-revogado" });
      continue;
    }
    const nome = vinculo.pessoa.nome;
    const email = emailDoConvite(vinculo);
    const antes = motivoAntesDoConvite(vinculo, email);
    if (antes !== null || email === null) {
      naoEnviados.push({ pessoaId, nome, motivo: antes ?? "sem-email" });
      continue;
    }

    const registro = await repos.enviosDeConvite.registrarEnvio({
      pessoaId,
      email,
      porPessoaId: entrada.porPessoa.pessoaId,
      // Só é usado se não houver convite vivo: o `on conflict` o descarta.
      token: entrada.novoToken(),
      entregar: (vivo) =>
        carteiro.enviar(
          montarMensagemDoConvite({
            para: email,
            pessoa: nome,
            organizacao: entrada.organizacao.nome,
            quemConvidou: entrada.porPessoa.nome,
            papel: PAPEL_NO_CONVITE[vinculo.papel],
            link: entrada.montarLink(vivo.token),
          }),
        ),
    });
    if (registro.desfecho === "enviado") enviados.push({ pessoaId, nome, email });
    else naoEnviados.push({ pessoaId, nome, motivo: registro.desfecho });
  }
  return { enviados, naoEnviados };
}

export type SituacaoDoConvitePorEmail = {
  email: string | null;
  ultimoEnvioEm: string | null;
  impedimento: "sem-email" | "limite-do-dia" | "limite-do-participante" | null;
};

/**
 * O que o bloco de e-mail do modal mostra: o endereço, o último envio, e o impedimento, na ordem dos
 * motivos (o do dia antes do do participante).
 */
export async function situacaoDoConvitePorEmail(
  repos: { enviosDeConvite: RepositorioEscopadoDeEnviosDeConvite },
  vinculo: VinculoLido,
): Promise<SituacaoDoConvitePorEmail> {
  const email = emailDoConvite(vinculo);
  const resumo: ResumoDosEnvios = await repos.enviosDeConvite.resumoDe(vinculo.pessoa.pessoaId, email);
  const impedimento =
    email === null
      ? "sem-email"
      : resumo.enderecoJaRecebeuHoje
        ? "limite-do-dia"
        : resumo.doParticipante >= ENVIOS_POR_PARTICIPANTE
          ? "limite-do-participante"
          : null;
  return { email, ultimoEnvioEm: resumo.ultimoEnvioEm, impedimento };
}

/** Escapa o que foi digitado por gente antes de ir para o HTML de uma caixa de e-mail. */
function escapar(texto: string): string {
  return texto.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/** A mensagem do convite: texto puro, e o HTML mínimo equivalente, sem imagem nem rastreador. */
export function montarMensagemDoConvite(dados: {
  para: string;
  pessoa: string;
  organizacao: string;
  quemConvidou: string;
  /** O papel em palavra: *Solicitante* ou *Gestor*. */
  papel: string;
  link: string;
}): Mensagem {
  const ignorar = "Se você não esperava este convite, pode ignorar esta mensagem.";
  const texto = [
    `Olá, ${dados.pessoa}.`,
    "",
    `${dados.quemConvidou} convida você para usar o Resolve Aí em ${dados.organizacao}, como ${dados.papel}.`,
    "Abra o link para entrar:",
    dados.link,
    "",
    ignorar,
  ].join("\n");
  const html = [
    `<p>Olá, ${escapar(dados.pessoa)}.</p>`,
    `<p>${escapar(dados.quemConvidou)} convida você para usar o Resolve Aí em ${escapar(dados.organizacao)}, como ${escapar(dados.papel)}.</p>`,
    `<p><a href="${escapar(dados.link)}">Abrir o convite</a></p>`,
    `<p>${escapar(dados.link)}</p>`,
    `<p>${ignorar}</p>`,
  ].join("\n");
  return { para: dados.para, assunto: `Convite para ${dados.organizacao}`, texto, html };
}
