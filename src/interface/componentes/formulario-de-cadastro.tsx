"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import { acaoDeCriarConta, type EstadoDoFormulario } from "@/interface/acoes";
import { chamarAcaoDeCredencial, valoresPreservados } from "@/interface/componentes/acao-de-credencial";
import { Aviso, Campo, IndicadorDeEnvio, RodapeDoFormulario } from "@/interface/componentes/campo";
import { EntradaDeSenha } from "@/interface/componentes/campo-de-senha";
import { CLASSE_DO_CAMINHO } from "@/interface/componentes/moldura-de-conta";
import { avisarSucesso, MENSAGEM_GENERICA } from "@/interface/componentes/retorno-de-acao";
import { Button } from "@/interface/componentes/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/interface/componentes/ui/empty";
import { Input } from "@/interface/componentes/ui/input";
import { cn } from "@/interface/componentes/utilitarios";
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
 * `/`; a ação devolve `concluido` em vez de redirecionar, porque o aviso só sai do navegador. A falha fica
 * só na linha acima do formulário (item 116, critério 9).
 */
export function FormularioDeCadastro({
  destino,
  nomeInicial,
  convite,
}: {
  destino?: string;
  /** O nome que o Gestor cadastrou, quando a conta nasce pelo convite pessoal (item 121). Editável. */
  nomeInicial?: string;
  /** O token do convite pessoal, que vai num campo oculto. O e-mail nunca vem preenchido. */
  convite?: string;
} = {}) {
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

  // **O nome e o e-mail sobrevivem à recusa** (item 103, critério 6): eles viram o valor inicial dos campos
  // antes de o React esvaziar o formulário, e o esvaziamento devolve os campos a eles. A senha volta vazia.
  const [preservados, setPreservados] = useState<Readonly<Record<string, string>>>(() =>
    nomeInicial === undefined ? ({} as Readonly<Record<string, string>>) : { nome: nomeInicial },
  );

  const [estado, agir, aguardando] = useActionState(
    async (anterior: EstadoDoFormulario, dados: FormData): Promise<EstadoDoFormulario> => {
      setPreservados(valoresPreservados(dados, ["nome", "email"]));
      const proximo = await chamarAcaoDeCredencial(acaoDeCriarConta, anterior, dados);
      formulario.recomecar();
      if (proximo.concluido === true) {
        avisarSucesso("Conta criada");
        // O destino já chega conferido pela página. Sem ele, o shell resolve: sem vínculo, T-02 face A.
        // **`proximo`, e não `estado`**: a conta criada pelo convite pessoal traz o destino da ação, e o
        // `estado` desta renderização ainda é o anterior (item 121).
        router.replace(proximo.destino ?? destino ?? "/");
      }
      return proximo;
    },
    {},
  );

  // DORMENTE — este bloco é o estado *"olhe seu e-mail"*, e ele **não acontece** nesta entrega: a Q-T9 foi
  // fechada em 22/08/2026 e T-11 termina em sessão válida, direto. Fica pelo dia do interruptor.
  //
  // **A saída daqui é o "Já tenho conta" da moldura**, abaixo do cartão: duas saídas para o mesmo lugar
  // na mesma tela custam mais que um rótulo que ninguém alcança (item 44m, respostas P4).
  if (estado.aviso === "confirme-o-email") {
    return (
      <Empty className="px-2 py-8 md:px-2 md:py-8">
        <EmptyHeader>
          <EmptyMedia
            variant="icon"
            className="border-linha bg-background text-tinta-suave mb-3 size-13 rounded-lg border"
          >
            <MailCheck aria-hidden="true" className="size-5.5" />
          </EmptyMedia>
          <EmptyTitle className="text-titulo-bloco text-tinta">
            Confirme a sua conta
          </EmptyTitle>
          <EmptyDescription className="text-corpo text-tinta-suave">
            Enviamos um e-mail de confirmação. Toque no link para confirmar a conta e depois entre.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
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
            <Link href="/redefinir-senha" className={cn(CLASSE_DO_CAMINHO, "w-fit")}>
              Esqueci a senha
            </Link>
          )}
        </>
      )}

      <form
        action={agir}
        onChange={formulario.aoMudarNoFormulario}
        onBlur={formulario.aoSairNoFormulario}
        onSubmit={formulario.aoEnviarFormulario}
        className="flex flex-col gap-5"
        noValidate
      >
        {convite !== undefined && <input type="hidden" name="convite" value={convite} />}
        <Campo
          id="nome"
          rotulo="Seu nome"
          obrigatorio
          ajuda="É como você vai aparecer nas organizações de que participar."
          erro={formulario.erroDe("nome", estado.erros)}
        >
          {(controle) => (
            <Input
              {...controle}
              defaultValue={preservados.nome}
              name="nome"
              type="text"
              maxLength={120}
              autoComplete="name"
              required
              className="border-linha bg-background min-h-11"
            />
          )}
        </Campo>

        <Campo id="email" rotulo="E-mail" obrigatorio erro={formulario.erroDe("email", estado.erros)}>
          {(controle) => (
            <Input
              {...controle}
              defaultValue={preservados.email}
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              required
              className="border-linha bg-background min-h-11"
            />
          )}
        </Campo>

        <Campo
          id="senha"
          rotulo="Senha"
          obrigatorio
          // **Seis caracteres, comprimento e nada mais** — decidido em 22/08/2026, item 6a. Antes disso o
          // valor era herança do padrão do provedor, sem origem em documento nenhum, e isso era risco
          // registrado. O mesmo número está no `minimum_password_length` de `supabase/config.toml` (hoje
          // `:200`), e os dois têm de continuar batendo. *(Citava `:196`; o item 6c moveu a linha. Citação
          // por nome de chave envelhece menos que por número.)*
          //
          // É dita **antes** de digitar, não como erro depois (T-11). E é por a regra ser de comprimento
          // que o texto da recusa — *"Escolha uma senha mais longa."* — continua verdadeiro: regra de
          // classes de caractere o transformaria em mentira sobre o que consertar.
          ajuda="No mínimo 6 caracteres."
          erro={formulario.erroDe("senha", estado.erros)}
        >
          {(controle) => <EntradaDeSenha controle={controle} name="senha" autoComplete="new-password" />}
        </Campo>

        <RodapeDoFormulario obrigatorios={3} todosObrigatorios larguraCheia>
          <Button type="submit" variant="marca" disabled={aguardando} className="text-interface min-h-11 w-full px-4">
            <IndicadorDeEnvio ativo={aguardando} />
            {aguardando ? "Criando…" : "Criar conta"}
          </Button>
        </RodapeDoFormulario>
      </form>
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
