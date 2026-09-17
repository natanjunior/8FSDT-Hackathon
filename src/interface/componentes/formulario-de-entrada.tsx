"use client";

import Link from "next/link";
import { useActionState } from "react";

import { acaoDeEntrar } from "@/interface/acoes";
import { Campo } from "@/interface/componentes/campo";
import { Aviso } from "@/interface/componentes/moldura-de-tela";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";

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
 * **Dois estados dormentes, e um vivo.** `confirmacao` e o ramo `EMAIL_NAO_CONFIRMADO` de `textoDaRecusa`
 * só acontecem com a confirmação de e-mail ligada, e ela **não** está: a Q-T9 foi fechada em 22/08/2026.
 * `senhaAlterada` é o terceiro, e é o **primeiro aviso vivo desta tela**: quem acabou de trocar a senha em
 * T-13 chega aqui, e sem a linha não saberia por que saiu de lá.
 */
export function FormularioDeEntrada({
  destino,
  confirmacao,
  senhaAlterada = false,
}: {
  destino?: string;
  confirmacao?: "confirmada" | "expirada";
  senhaAlterada?: boolean;
}) {
  const [estado, agir, aguardando] = useActionState(acaoDeEntrar, {});

  return (
    <>
      {senhaAlterada && <Aviso tom="nota">Senha alterada. Entre com ela.</Aviso>}
      {confirmacao === "confirmada" && <Aviso tom="nota">Conta confirmada. Entre para continuar.</Aviso>}
      {confirmacao === "expirada" && (
        <Aviso>Este link expirou. Crie a conta de novo ou peça outro e-mail de confirmação.</Aviso>
      )}
      {estado.recusa !== undefined && <Aviso>{textoDaRecusa(estado.recusa)}</Aviso>}

      <form action={agir} className="flex flex-col gap-5" noValidate>
        {destino !== undefined && <input type="hidden" name="destino" value={destino} />}

        <Campo id="email" rotulo="E-mail" erro={estado.erros?.["email"]}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            required
            aria-invalid={estado.erros?.["email"] !== undefined}
            className="h-12 text-base"
          />
        </Campo>

        <Campo id="senha" rotulo="Senha" erro={estado.erros?.["senha"]}>
          <Input
            id="senha"
            name="senha"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={estado.erros?.["senha"] !== undefined}
            className="h-12 text-base"
          />
        </Campo>

        {/* A-3: alvo de toque de 48 px. É a pessoa com uma mão no corrimão — o cenário literal do RNF6. */}
        <Button type="submit" disabled={aguardando} className="h-12 w-full text-base">
          {aguardando ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <div className="flex flex-col gap-3 pt-1">
        <Link href="/criar-conta" className="text-marca w-fit py-1 text-sm underline underline-offset-4">
          Criar conta
        </Link>
        <Link
          href="/redefinir-senha"
          className="text-marca w-fit py-1 text-sm underline underline-offset-4"
        >
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
  return "Não foi possível entrar agora. Tente de novo em instantes.";
}
