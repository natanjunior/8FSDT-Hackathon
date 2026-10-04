import type { ResumoDoEnvio, SituacaoDoConvitePorEmail } from "@/aplicacao/organizacao";
import type { MotivoDeNaoEnvio } from "@/dominio/organizacao";

/**
 * O resumo do envio por e-mail (item 122). **O e-mail sai aqui, e só para quem tem `vinculo.gerir`**, que
 * já vê os contatos na lista de participantes. `nome` nulo é a pessoa que não participa desta organização:
 * a resposta não revela se ela existe em outra.
 */
export type ResumoDoEnvioProjetado = {
  enviados: Array<{ pessoaId: string; nome: string; email: string }>;
  naoEnviados: Array<{ pessoaId: string; nome: string | null; motivo: MotivoDeNaoEnvio }>;
};

export function projetarResumoDoEnvio(resumo: ResumoDoEnvio): ResumoDoEnvioProjetado {
  return {
    enviados: resumo.enviados.map((e) => ({ pessoaId: e.pessoaId, nome: e.nome, email: e.email })),
    naoEnviados: resumo.naoEnviados.map((n) => ({ pessoaId: n.pessoaId, nome: n.nome, motivo: n.motivo })),
  };
}

/** O que o modal do convite recebe da página sobre o e-mail. Mesma regra de alcance do resumo. */
export type SituacaoDoEmailProjetada = {
  email: string | null;
  ultimoEnvioEm: string | null;
  impedimento: "sem-email" | "limite-do-dia" | "limite-do-participante" | null;
};

export function projetarSituacaoDoEmail(situacao: SituacaoDoConvitePorEmail): SituacaoDoEmailProjetada {
  return { email: situacao.email, ultimoEnvioEm: situacao.ultimoEnvioEm, impedimento: situacao.impedimento };
}
