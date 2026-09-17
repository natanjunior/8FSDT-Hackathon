"use client";

import Link from "next/link";
import { useActionState } from "react";

import { acaoDeEntrar, type EstadoDoFormulario } from "@/interface/acoes";
import { chamarAcaoDeCredencial } from "@/interface/componentes/acao-de-credencial";
import { Campo, IndicadorDeEnvio, RodapeDoFormulario } from "@/interface/componentes/campo";
import { Aviso } from "@/interface/componentes/moldura-de-tela";
import { avisarErro, MENSAGEM_GENERICA } from "@/interface/componentes/retorno-de-acao";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";
import { useFormularioTocado } from "@/interface/ganchos/use-formulario-tocado";
import { entrarSchema, errosDoSchema } from "@/interface/schemas";

/**
 * **T-01 · Entrar.** *"A porta. Dois campos e um botão — e é a única tela que qualquer pessoa alcança sem
 * sessão."*
 *
 * Não chama endpoint do contrato: chama a ação de credencial, que chama o provedor (contrato §4.1).
 *
 * **A doutrina de erro, e ela decide o texto:** credencial inválida **não distingue** *"e-mail não existe"*
 * de *"senha errada"*. Distinguir transformaria a tela de login num verificador de quem tem conta no
 * produto (inventário, T-01).
 *
 * **O retorno (guia §7, item 44g).** Entrar não grava nada, e a chegada à tela seguinte é a resposta: não
 * há aviso de sucesso, e o servidor continua redirecionando. A falha dá o aviso *"Não foi possível
 * entrar"*, e a razão fica na linha acima do formulário. Os campos seguem a regra de formulário tocado,
 * com o mesmo schema que a ação confere.
 *
 * **Um estado dormente:** `confirmacao` e o ramo `EMAIL_NAO_CONFIRMADO` de `textoDaRecusa` só acontecem
 * com a confirmação de e-mail ligada, e ela **não** está (Q-T9, fechada em 22/08/2026).
 */
export function FormularioDeEntrada({
  destino,
  confirmacao,
}: {
  destino?: string;
  confirmacao?: "confirmada" | "expirada";
}) {
  const formulario = useFormularioTocado({
    campos: { email: "email", senha: "senha" },
    validar: (dados) =>
      errosDoSchema(entrarSchema, { email: dados.get("email"), senha: dados.get("senha") }),
  });

  const [estado, agir, aguardando] = useActionState(
    async (anterior: EstadoDoFormulario, dados: FormData): Promise<EstadoDoFormulario> => {
      const proximo = await chamarAcaoDeCredencial(acaoDeEntrar, anterior, dados);
      formulario.recomecar();
      if (proximo.recusa !== undefined || proximo.erros !== undefined) avisarErro("Não foi possível entrar");
      return proximo;
    },
    {},
  );

  return (
    <>
      {confirmacao === "confirmada" && <Aviso tom="nota">Conta confirmada. Entre para continuar.</Aviso>}
      {confirmacao === "expirada" && (
        <Aviso>Este link expirou. Crie a conta de novo ou peça outro e-mail de confirmação.</Aviso>
      )}
      {estado.recusa !== undefined && <Aviso>{textoDaRecusa(estado.recusa)}</Aviso>}

      <form
        action={agir}
        onChange={formulario.aoMudarNoFormulario}
        onSubmit={formulario.aoEnviarFormulario}
        className="flex flex-col gap-5"
        noValidate
      >
        {destino !== undefined && <input type="hidden" name="destino" value={destino} />}

        <Campo id="email" rotulo="E-mail" obrigatorio erro={formulario.erroDe("email", estado.erros)}>
          {(controle) => (
            <Input
              {...controle}
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              required
              className="h-12 text-base"
            />
          )}
        </Campo>

        <Campo id="senha" rotulo="Senha" obrigatorio erro={formulario.erroDe("senha", estado.erros)}>
          {(controle) => (
            <Input
              {...controle}
              name="senha"
              type="password"
              autoComplete="current-password"
              required
              className="h-12 text-base"
            />
          )}
        </Campo>

        <RodapeDoFormulario obrigatorios={2}>
          {/* A-3: alvo de toque de 48 px. É a pessoa com uma mão no corrimão, o cenário literal do RNF6. */}
          <Button type="submit" disabled={aguardando} className="h-12 px-6 text-base">
            <IndicadorDeEnvio ativo={aguardando} />
            {aguardando ? "Entrando…" : "Entrar"}
          </Button>
        </RodapeDoFormulario>
      </form>

      <div className="flex flex-col gap-3 pt-1">
        <Link href="/criar-conta" className="text-marca w-fit py-1 text-sm underline underline-offset-4">
          Criar conta
        </Link>
        <Link href="/redefinir-senha" className="text-marca w-fit py-1 text-sm underline underline-offset-4">
          Esqueci a senha
        </Link>
      </div>
    </>
  );
}

function textoDaRecusa(recusa: string): string {
  // DORMENTE — ver o cabeçalho: sem confirmação de e-mail, o provedor não produz esta recusa.
  if (recusa === "EMAIL_NAO_CONFIRMADO") {
    return "Confirme a conta pelo link que enviamos por e-mail e tente de novo.";
  }
  if (recusa === "CREDENCIAL_INVALIDA") return "E-mail ou senha incorretos.";
  return MENSAGEM_GENERICA;
}
