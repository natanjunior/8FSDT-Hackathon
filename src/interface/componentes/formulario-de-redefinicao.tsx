"use client";

import Link from "next/link";
import { useActionState } from "react";

import { acaoDePedirRedefinicao, type EstadoDoFormulario } from "@/interface/acoes";
import { chamarAcaoDeCredencial } from "@/interface/componentes/acao-de-credencial";
import { Aviso, Campo, IndicadorDeEnvio, RodapeDoFormulario } from "@/interface/componentes/campo";
import { avisarErro, MENSAGEM_GENERICA } from "@/interface/componentes/retorno-de-acao";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";
import { useFormularioTocado } from "@/interface/ganchos/use-formulario-tocado";
import { errosDoSchema, pedirRedefinicaoSchema } from "@/interface/schemas";

/**
 * **T-12 · Redefinir senha.** Um campo, um botão, e o caminho de volta.
 *
 * **O que carrega informação aqui não é o layout — é a frase do fim**, e ela é condicional de propósito:
 * uma tela que respondesse *"este e-mail não está cadastrado"* seria um verificador de quem tem conta no
 * produto, operável por qualquer um, sem sessão (inventário, T-12).
 *
 * **Dois erros visíveis, e o segundo é achado declarado (A-6b-2).** O critério 5 diz *"o único"*; falha do
 * provedor ganhou frase própria porque a alternativa era a tela afirmar que enviou o que não enviou.
 *
 * **Duas divergências de desenho contra o protótipo, declaradas em vez de escondidas** — as duas nascem de
 * a `MolduraDeTela` ser dona do título e do formulário ser dono do resto:
 *
 * 1. **Quadro 4.** O protótipo troca o título *"Redefinir senha"* por *"Confira o seu e-mail"*; aqui o
 *    título fica e a frase entra como `<h2>` abaixo dele. Trocar o título obrigaria o formulário a mandar
 *    na moldura, que é o contrário da razão de a moldura existir (`moldura-de-tela.tsx`: *"duas cópias
 *    divergem na primeira alteração"*).
 * 2. **Quadro 5.** O protótipo desabilita o botão e some com o parágrafo de apoio no limite de envios; aqui
 *    os dois ficam. O botão desabilitado precisaria saber **quando** o limite passa, e nem o provedor
 *    devolve esse instante — desabilitar sem saber por quanto tempo é pior que deixar tentar.
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

  // A face de sucesso **substitui** o formulário (protótipo, T-12, quadro 4). Deixá-lo na tela convidaria
  // a um segundo pedido, e o teto do provedor é de dois por hora.
  if (estado.enviado === true) {
    return (
      <>
        <h2 className="text-tinta text-base font-semibold">Confira o seu e-mail</h2>
        <p className="text-tinta-suave text-sm leading-relaxed">
          Se existe uma conta com este e-mail, o link foi enviado. Confira também o spam.
        </p>
        <Link href="/entrar" className="text-marca w-fit py-1 text-sm underline underline-offset-4">
          Voltar para entrar
        </Link>
      </>
    );
  }

  return (
    <>
      {estado.recusa !== undefined && <Aviso>{textoDaRecusa(estado.recusa)}</Aviso>}

      <p className="text-tinta-suave text-sm leading-relaxed">
        Informe o e-mail da sua conta. Enviamos um link para você criar uma senha nova.
      </p>

      <form
        action={agir}
        onChange={formulario.aoMudarNoFormulario}
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
              className="h-12 text-base"
            />
          )}
        </Campo>

        <RodapeDoFormulario obrigatorios={1}>
          {/* A-3: alvo de toque de 48 px, como nas outras três telas de credencial. */}
          <Button type="submit" disabled={aguardando} className="h-12 px-6 text-base">
            <IndicadorDeEnvio ativo={aguardando} />
            {aguardando ? "Enviando…" : "Enviar o link"}
          </Button>
        </RodapeDoFormulario>
      </form>

      <Link href="/entrar" className="text-marca w-fit py-1 text-sm underline underline-offset-4">
        Voltar para entrar
      </Link>
    </>
  );
}

function textoDaRecusa(recusa: string): string {
  if (recusa === "LIMITE_DE_ENVIOS") return "Muitos pedidos seguidos. Espere um pouco.";
  return MENSAGEM_GENERICA;
}
