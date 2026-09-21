"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState } from "react";

import { acaoDeCriarConta, type EstadoDoFormulario } from "@/interface/acoes";
import { chamarAcaoDeCredencial } from "@/interface/componentes/acao-de-credencial";
import { Aviso, Campo, IndicadorDeEnvio, RodapeDoFormulario } from "@/interface/componentes/campo";
import {
  avisarErro,
  avisarSucesso,
  MENSAGEM_GENERICA,
} from "@/interface/componentes/retorno-de-acao";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";
import { useFormularioTocado } from "@/interface/ganchos/use-formulario-tocado";
import { criarContaSchema, errosDoSchema } from "@/interface/schemas";

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
 *
 * **O retorno (guia §7, item 44g).** Com a conta criada, sai o aviso *"Conta criada"* e a tela segue para
 * `/`; a ação devolve `concluido` em vez de redirecionar, porque o aviso só sai do navegador. A falha dá o
 * aviso *"Não foi possível criar a conta"*.
 */
export function FormularioDeCadastro() {
  const router = useRouter();
  const formulario = useFormularioTocado({
    campos: { nome: "nome", email: "email", senha: "senha" },
    validar: (dados) =>
      errosDoSchema(criarContaSchema, {
        nome: dados.get("nome"),
        email: dados.get("email"),
        senha: dados.get("senha"),
      }),
  });

  const [estado, agir, aguardando] = useActionState(
    async (anterior: EstadoDoFormulario, dados: FormData): Promise<EstadoDoFormulario> => {
      const proximo = await chamarAcaoDeCredencial(acaoDeCriarConta, anterior, dados);
      formulario.recomecar();
      if (proximo.concluido === true) {
        avisarSucesso("Conta criada");
        // O shell resolve o destino: sem vínculo, T-02 face A (inventário, T-11).
        router.replace("/");
      } else if (proximo.recusa !== undefined || proximo.erros !== undefined) {
        avisarErro("Não foi possível criar a conta");
      }
      return proximo;
    },
    {},
  );

  // DORMENTE — este bloco é o estado *"olhe seu e-mail"*, e ele **não acontece** nesta entrega: a Q-T9 foi
  // fechada em 22/08/2026 e T-11 termina em sessão válida, direto. Fica pelo dia do interruptor.
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
      {estado.recusa !== undefined && (
        <>
          <Aviso>{textoDaRecusa(estado.recusa)}</Aviso>
          {/* O critério 4 do item 6a pede a frase **com os caminhos para T-01 e T-12**. O de T-01 é o link
              "Já tenho conta", abaixo do formulário; este é o de T-12, e é a metade que o 6a declarou como
              dívida do 6b (spec do 6a, §3.6). */}
          {estado.recusa === "CONTA_JA_EXISTE" && (
            <Link
              href="/redefinir-senha"
              className="text-marca w-fit py-1 text-sm underline underline-offset-4"
            >
              Esqueci a senha
            </Link>
          )}
        </>
      )}

      <form
        action={agir}
        onChange={formulario.aoMudarNoFormulario}
        onSubmit={formulario.aoEnviarFormulario}
        className="flex flex-col gap-5"
        noValidate
      >
        <Campo
          id="nome"
          rotulo="Seu nome"
          obrigatorio
          ajuda="É como você vai aparecer para os Gestores e no histórico das ocorrências."
          erro={formulario.erroDe("nome", estado.erros)}
        >
          {(controle) => (
            <Input
              {...controle}
              name="nome"
              type="text"
              maxLength={120}
              autoComplete="name"
              required
              className="h-12 text-base"
            />
          )}
        </Campo>

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

        <Campo
          id="senha"
          rotulo="Senha"
          obrigatorio
          // **Seis caracteres, comprimento e nada mais** — decidido em 22/08/2026, item 6a. Antes disso o
          // valor era herança do padrão do provedor, sem origem em documento nenhum: era o risco **R-21**
          // do `prototipo-low-fi.md`. O mesmo número está no `minimum_password_length` de
          // `supabase/config.toml` (hoje `:200`), e os dois têm de continuar batendo. *(Citava `:196`; o
          // item 6c moveu a linha. Citação por nome de chave envelhece menos que por número.)*
          //
          // É dita **antes** de digitar, não como erro depois (T-11). E é por a regra ser de comprimento
          // que o texto da recusa — *"Escolha uma senha mais longa."* — continua verdadeiro: regra de
          // classes de caractere o transformaria em mentira sobre o que consertar.
          ajuda="No mínimo 6 caracteres."
          erro={formulario.erroDe("senha", estado.erros)}
        >
          {(controle) => (
            <Input
              {...controle}
              name="senha"
              type="password"
              autoComplete="new-password"
              required
              className="h-12 text-base"
            />
          )}
        </Campo>

        <RodapeDoFormulario obrigatorios={3}>
          <Button type="submit" disabled={aguardando} className="h-12 px-6 text-base">
            <IndicadorDeEnvio ativo={aguardando} />
            {aguardando ? "Criando…" : "Criar conta"}
          </Button>
        </RodapeDoFormulario>
      </form>

      <Link href="/entrar" className="text-marca w-fit py-1 text-sm underline underline-offset-4">
        Já tenho conta
      </Link>
    </>
  );
}

function textoDaRecusa(recusa: string): string {
  // A primeira frase é **verbatim** do critério 4 do item 6a e do inventário (T-11). A segunda é o caminho
  // para T-01 dito em palavras — o caminho de fato é o link "Já tenho conta", abaixo do formulário.
  //
  // Aqui a doutrina do não-confirmar **cede**: negá-la produziria alguém preso tentando criar uma conta
  // que já existe (inventário, T-11).
  if (recusa === "CONTA_JA_EXISTE") return "Já existe uma conta com este e-mail. Entre em vez de criar.";
  if (recusa === "SENHA_RECUSADA_PELO_PROVEDOR") return "Escolha uma senha mais longa.";
  return MENSAGEM_GENERICA;
}
