"use client";

import Link from "next/link";
import { useActionState } from "react";

import { acaoDeCriarConta } from "@/interface/acoes";
import { Aviso, Campo } from "@/interface/componentes/moldura-de-tela";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";

/**
 * **T-11 · Criar conta.** Três campos, e o primeiro é o que fecha um achado.
 *
 * **Por que `nome` está aqui.** `PessoaReferencia.nome` é `required` e não-nulável, e o ACL *"cria a Pessoa
 * se ainda não existir"* (contrato §4.1). Então o primeiro login **precisa** de um nome, e até a revisão de
 * 21/08/2026 nenhum documento dizia de onde ele vinha — o F6 ficou aberto por isso. Pedindo o nome aqui, o
 * metadado passa a existir porque nós o escrevemos, e não porque torcemos.
 *
 * **O que a tela deliberadamente não pede: contato nenhum.** O e-mail do cadastro é a **credencial**, e só
 * ela. O telefone tem casa, e é a casa certa: o campo opcional de `POST /pedidos-de-entrada`, em T-02.
 */
export function FormularioDeCadastro() {
  const [estado, agir, aguardando] = useActionState(acaoDeCriarConta, {});

  if (estado.aviso === "confirme-o-email") {
    return (
      <>
        {/* A tela **não finge** que a pessoa já entrou (inventário, T-11). */}
        <Aviso tom="nota">
          Enviamos um e-mail de confirmação. Toque no link para confirmar a conta e depois entre.
        </Aviso>
        <Link
          href="/entrar"
          className="text-marca w-fit py-1 text-sm underline underline-offset-4"
        >
          Ir para a tela de entrar
        </Link>
      </>
    );
  }

  return (
    <>
      {estado.recusa !== undefined && <Aviso>{textoDaRecusa(estado.recusa)}</Aviso>}

      <form action={agir} className="flex flex-col gap-5" noValidate>
        <Campo
          id="nome"
          rotulo="Seu nome"
          ajuda="É como você vai aparecer para os Gestores e no histórico das ocorrências."
          erro={estado.erros?.["nome"]}
        >
          <Input
            id="nome"
            name="nome"
            type="text"
            maxLength={120}
            autoComplete="name"
            required
            aria-invalid={estado.erros?.["nome"] !== undefined}
            className="h-12 text-base"
          />
        </Campo>

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

        <Campo
          id="senha"
          rotulo="Senha"
          // A regra de força é do provedor, e é dita **antes** de digitar — não como erro depois (T-11).
          ajuda="No mínimo 6 caracteres."
          erro={estado.erros?.["senha"]}
        >
          <Input
            id="senha"
            name="senha"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={estado.erros?.["senha"] !== undefined}
            className="h-12 text-base"
          />
        </Campo>

        <Button type="submit" disabled={aguardando} className="h-12 w-full text-base">
          {aguardando ? "Criando…" : "Criar conta"}
        </Button>
      </form>

      <Link href="/entrar" className="text-marca w-fit py-1 text-sm underline underline-offset-4">
        Já tenho conta
      </Link>
    </>
  );
}

function textoDaRecusa(recusa: string): string {
  // Aqui a doutrina do não-confirmar **cede**: negá-la produziria alguém preso tentando criar uma conta
  // que já existe (inventário, T-11).
  if (recusa === "CONTA_JA_EXISTE") return "Já existe uma conta com esse e-mail. Entre em vez de criar.";
  if (recusa === "SENHA_RECUSADA_PELO_PROVEDOR") return "Escolha uma senha mais longa.";
  return "Não foi possível criar a conta agora. Tente de novo em instantes.";
}
