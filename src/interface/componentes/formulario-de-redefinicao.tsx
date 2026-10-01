"use client";

import { Mail } from "lucide-react";
import { useActionState } from "react";

import { acaoDePedirRedefinicao, type EstadoDoFormulario } from "@/interface/acoes";
import { chamarAcaoDeCredencial } from "@/interface/componentes/acao-de-credencial";
import { Aviso, Campo, IndicadorDeEnvio, RodapeDoFormulario } from "@/interface/componentes/campo";
import { avisarErro, MENSAGEM_GENERICA } from "@/interface/componentes/retorno-de-acao";
import { Button } from "@/interface/componentes/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/interface/componentes/ui/empty";
import { Input } from "@/interface/componentes/ui/input";
import { useFormularioTocado } from "@/interface/ganchos/use-formulario-tocado";
import { errosDoSchema, pedirRedefinicaoSchema } from "@/interface/schemas";

/**
 * **T-12 · Redefinir senha.** Um campo, um botão, e o caminho de volta.
 *
 * **O que carrega informação aqui não é o layout — é a frase do fim**, e ela é condicional de propósito:
 * uma tela que respondesse *"este e-mail não está cadastrado"* seria um verificador de quem tem conta no
 * produto, operável por qualquer um, sem sessão.
 *
 * **Dois erros visíveis, e o segundo é achado declarado (A-6b-2).** O critério 5 diz *"o único"*; falha do
 * provedor ganhou frase própria porque a alternativa era a tela afirmar que enviou o que não enviou.
 *
 * **Uma divergência de desenho, declarada em vez de escondida:** no limite de envios o botão continua
 * habilitado e o apoio continua na tela. O botão desabilitado precisaria saber **quando** o limite passa,
 * e nem o provedor devolve esse instante — desabilitar sem saber por quanto tempo é pior que deixar
 * tentar.
 *
 * *(A outra divergência que este cabeçalho declarava deixou de existir no item 44m: a face de sucesso
 * agora é um bloco cuja cabeça diz "Confira o seu e-mail", e o título da tela fica no cartão.)*
 */
export function FormularioDeRedefinicao() {
  const formulario = useFormularioTocado({
    campos: { email: "email" },
    validar: (dados) => errosDoSchema(pedirRedefinicaoSchema, { email: dados.get("email") }),
  });

  const [estado, agir, aguardando] = useActionState(
    async (anterior: EstadoDoFormulario, dados: FormData): Promise<EstadoDoFormulario> => {
      const proximo = await chamarAcaoDeCredencial(acaoDePedirRedefinicao, anterior, dados);
      formulario.recomecar();
      // **Sem aviso de sucesso:** a face "Confira o seu e-mail" é a resposta, e um aviso de "enviado"
      // confirmaria que a conta existe, contra a doutrina da tela (spec do 44g, §4.8).
      if (proximo.enviado !== true) avisarErro("Não foi possível enviar o link");
      return proximo;
    },
    {},
  );

  // A face de sucesso **substitui** o formulário. Deixá-lo na tela convidaria a um segundo pedido, e o
  // teto do provedor é de dois por hora. A saída é o "Voltar para entrar" da moldura, abaixo do cartão.
  if (estado.enviado === true) {
    return (
      <Empty className="px-2 py-8 md:px-2 md:py-8">
        <EmptyHeader>
          <EmptyMedia
            variant="icon"
            className="border-linha bg-background text-tinta-suave mb-3 size-13 rounded-lg border"
          >
            <Mail aria-hidden="true" className="size-5.5" />
          </EmptyMedia>
          <EmptyTitle className="text-titulo-bloco text-tinta">
            Confira o seu e-mail
          </EmptyTitle>
          <EmptyDescription className="text-corpo text-tinta-suave">
            Se existe uma conta com este e-mail, o link foi enviado. Confira também o spam.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      {estado.recusa !== undefined && <Aviso>{textoDaRecusa(estado.recusa)}</Aviso>}

      <form
        action={agir}
        onChange={formulario.aoMudarNoFormulario}
        onBlur={formulario.aoSairNoFormulario}
        onSubmit={formulario.aoEnviarFormulario}
        className="flex flex-col gap-5"
        noValidate
      >
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
              className="border-linha bg-background min-h-11"
            />
          )}
        </Campo>

        <RodapeDoFormulario obrigatorios={1} todosObrigatorios larguraCheia>
          {/* O alvo é o piso do guia §4, 44 px — o mesmo das outras três telas de conta e de T-04. */}
          <Button type="submit" variant="marca" disabled={aguardando} className="text-interface min-h-11 w-full px-4">
            <IndicadorDeEnvio ativo={aguardando} />
            {aguardando ? "Enviando…" : "Enviar o link"}
          </Button>
        </RodapeDoFormulario>
      </form>
    </>
  );
}

function textoDaRecusa(recusa: string): string {
  if (recusa === "LIMITE_DE_ENVIOS") return "Muitos pedidos seguidos. Espere um pouco.";
  return MENSAGEM_GENERICA;
}
