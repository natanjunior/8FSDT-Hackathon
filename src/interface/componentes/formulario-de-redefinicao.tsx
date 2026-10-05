"use client";

import { useActionState, useState } from "react";

import { acaoDePedirRedefinicao, type EstadoDoFormulario } from "@/interface/acoes";
import { chamarAcaoDeCredencial } from "@/interface/componentes/acao-de-credencial";
import { Aviso, Campo, IndicadorDeEnvio, RodapeDoFormulario } from "@/interface/componentes/campo";
import { CartaoDaTela } from "@/interface/componentes/moldura-de-conta";
import { MENSAGEM_GENERICA } from "@/interface/componentes/retorno-de-acao";
import { Button } from "@/interface/componentes/ui/button";
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
 * **O formulário desenha o próprio cartão** desde o item 116 (critério 8): a cabeça depende do desfecho, e
 * o desfecho só o cliente conhece. A moldura o recebe pronto, pela prop `cartao`.
 */
export function FormularioDeRedefinicao({ emailInicial = null }: { emailInicial?: string | null }) {
  const formulario = useFormularioTocado({
    campos: { email: "email" },
    validar: (dados) => errosDoSchema(pedirRedefinicaoSchema, { email: dados.get("email") }),
  });

  const [enviadoPara, setEnviadoPara] = useState("");

  const [estado, agir, aguardando] = useActionState(
    async (anterior: EstadoDoFormulario, dados: FormData): Promise<EstadoDoFormulario> => {
      const digitado = dados.get("email");
      setEnviadoPara(typeof digitado === "string" ? digitado.trim() : "");
      const proximo = await chamarAcaoDeCredencial(acaoDePedirRedefinicao, anterior, dados);
      formulario.recomecar();
      // **Nem aviso de sucesso nem de falha:** a face e a linha acima do formulário são a resposta
      // (critério 116.9). Um aviso de "enviado" confirmaria que a conta existe, contra a doutrina da tela
      // (spec do 44g, §4.8).
      return proximo;
    },
    {},
  );

  // A face de sucesso **substitui** o formulário. Deixá-lo na tela convidaria a um segundo pedido, e o
  // teto do provedor é de dois por hora. A saída é a da moldura, abaixo do cartão: *Voltar para entrar*,
  // ou *Voltar para Meus dados* para quem tem sessão (critério 106.12). Desde o item 116 ela troca também a
  // cabeça: o título passa a dizer o que fazer, e o contexto mostra o endereço, para quem errou a
  // digitação conferir. A frase continua neutra, "se existe uma conta", que é a doutrina da tela (spec do
  // 44g, §4.8).
  if (estado.enviado === true) {
    return (
      <CartaoDaTela
        titulo="Confira o seu e-mail"
        contexto={
          <>
            Se existe uma conta com <strong className="text-tinta font-semibold break-all">{enviadoPara}</strong>,
            o link foi para esse endereço. Confira também o spam.
          </>
        }
        temCorpo={false}
      />
    );
  }

  return (
    <CartaoDaTela
      titulo="Redefinir senha"
      contexto="Informe o e-mail da sua conta. Enviamos um link para você criar uma senha nova."
      temCorpo
    >
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
              defaultValue={emailInicial ?? undefined}
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
    </CartaoDaTela>
  );
}

function textoDaRecusa(recusa: string): string {
  if (recusa === "LIMITE_DE_ENVIOS") return "Muitos pedidos seguidos. Espere um pouco.";
  return MENSAGEM_GENERICA;
}
