"use client"

/**
 * A seleção múltipla do `@designrevision` (`components.json`, `registries`), copiada em 03/10/2026 por
 * ordem do dono (item 120, bloco 4). É `Popover`, `Command` e `Badge` do catálogo, e `lucide-react`.
 *
 * **Cinco ajustes, e só eles**, todos do item 120: os textos em pt-BR; `filtrar` e `podeCriar`, para a
 * busca e a regra de criar serem as do projeto (o filtro de fábrica do `cmdk` é pontuação aproximada, e o
 * item 44l recusou duas buscas no mesmo produto); `avisoDaBusca`, para dizer o limite; **as fichas fora
 * do gatilho, com botão de verdade e 44 px de alvo** — na peça original o X era um `span` com papel de
 * botão e índice de tabulação negativo, dentro do `<button>`, fora do teclado e com 12 px de alvo; e as classes que as guardas
 * do catálogo recusam (variante escura declarada, contorno apagado, anel fracionário, tamanho fora dos
 * oito papéis) trocadas pelas da casa. A guarda da variante escura lê o arquivo cru, comentário inclusive.
 */

import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react"

import { cn } from "@/interface/componentes/utilitarios"
import { Badge } from "@/interface/componentes/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/interface/componentes/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/interface/componentes/ui/popover"

export type MultiSelectOption = {
  value: string
  label: string
  disabled?: boolean
  /** Não sai depois de escolhida. */
  fixed?: boolean
  /** O título do grupo em que a opção aparece. */
  group?: string
  /** Um ícone ou avatar antes do rótulo, na lista. */
  icon?: React.ReactNode
}

export interface MultiSelectProps {
  options: MultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  maxSelected?: number
  /** Oferece criar a partir do texto da busca. */
  creatable?: boolean
  disabled?: boolean
  className?: string
  emptyText?: string
  loadingText?: string
  /** Fonte assíncrona; com ela, as opções vêm por consulta. */
  onSearch?: (query: string) => Promise<MultiSelectOption[]>
  /** Item 120: a busca de quem usa, síncrona. Com ela, a do `cmdk` desliga. */
  filtrar?: (opcoes: MultiSelectOption[], consulta: string) => MultiSelectOption[]
  /** Item 120: a regra de criar de quem usa. Sem ela, vale a da peça. */
  podeCriar?: (consulta: string) => boolean
  /** Item 120: uma frase abaixo da busca, como o limite de caracteres. */
  avisoDaBusca?: (consulta: string) => string | null
  textoDaBusca?: string
  textoDeCriar?: (consulta: string) => string
  rotuloDeTirar?: (rotulo: string) => string
  id?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
  "aria-label"?: string
}

export function MultiSelect({
  options: optionsProp,
  value,
  onChange,
  placeholder = "Escolher…",
  maxSelected,
  creatable = false,
  disabled = false,
  className,
  emptyText = "Nada encontrado.",
  loadingText = "Carregando…",
  onSearch,
  filtrar,
  podeCriar,
  avisoDaBusca,
  textoDaBusca = "Buscar…",
  textoDeCriar = (consulta) => `Criar “${consulta}”`,
  rotuloDeTirar = (rotulo) => `Tirar ${rotulo}`,
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedby,
  "aria-label": ariaLabel,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [asyncOptions, setAsyncOptions] = React.useState<MultiSelectOption[]>([])
  const [loading, setLoading] = React.useState(false)
  const labels = React.useRef(new Map<string, string>())

  const options = onSearch ? asyncOptions : filtrar ? filtrar(optionsProp, query) : optionsProp

  React.useEffect(() => {
    for (const option of [...optionsProp, ...asyncOptions]) {
      labels.current.set(option.value, option.label)
    }
  }, [optionsProp, asyncOptions])

  const labelFor = (val: string) =>
    optionsProp.find((option) => option.value === val)?.label ??
    asyncOptions.find((option) => option.value === val)?.label ??
    labels.current.get(val) ??
    val

  React.useEffect(() => {
    if (!onSearch || !open) return
    let active = true
    setLoading(true)
    const timer = setTimeout(() => {
      void onSearch(query).then((result) => {
        if (!active) return
        setAsyncOptions(result)
        setLoading(false)
      })
    }, 300)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query, onSearch, open])

  const atMax = maxSelected != null && value.length >= maxSelected

  const isFixed = (val: string) => optionsProp.find((option) => option.value === val)?.fixed ?? false

  const toggle = (val: string) => {
    if (value.includes(val)) {
      if (isFixed(val)) return
      onChange(value.filter((item) => item !== val))
    } else if (!atMax) {
      onChange([...value, val])
    }
  }

  const create = () => {
    const next = query.trim()
    if (!next || atMax || value.includes(next)) return
    labels.current.set(next, next)
    onChange([...value, next])
    setQuery("")
  }

  const groups = React.useMemo(() => {
    const map = new Map<string, MultiSelectOption[]>()
    for (const option of options) {
      const key = option.group ?? ""
      if (!map.has(key)) map.set(key, [])
      map.get(key)?.push(option)
    }
    return Array.from(map.entries())
  }, [options])

  const canCreate =
    creatable &&
    query.trim() !== "" &&
    !atMax &&
    !value.includes(query.trim()) &&
    (podeCriar
      ? podeCriar(query)
      : !options.some((option) => option.label.toLowerCase() === query.trim().toLowerCase()))

  const aviso = avisoDaBusca?.(query) ?? null

  return (
    <div
      className={cn(
        "border-input text-interface flex min-h-11 w-full flex-wrap items-center gap-3 rounded-md border bg-transparent px-3 py-0 shadow-xs",
        disabled && "opacity-50",
        className
      )}
    >
      {value.length > 0 && (
        <ul className="flex flex-wrap items-center gap-3">
          {value.map((val) => (
            <li key={val}>
              {/* `overflow-visible`: a base do `Badge` recorta (`ui/badge.tsx:7`), e o `after` de 44 px do X
                  ficaria cortado, e conteúdo recortado não recebe clique. */}
              <Badge variant="secondary" className="gap-1 overflow-visible pr-1">
                {labelFor(val)}
                {!isFixed(val) && (
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={rotuloDeTirar(labelFor(val))}
                    onClick={() => toggle(val)}
                    className="text-muted-foreground hover:text-foreground relative inline-flex size-5 items-center justify-center rounded-full after:absolute after:-inset-3 after:content-['']"
                  >
                    <XIcon aria-hidden="true" className="size-3" />
                  </button>
                )}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-label={ariaLabel}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedby}
            disabled={disabled}
            className="text-muted-foreground flex min-h-11 min-w-32 flex-1 items-center justify-between gap-2 rounded-sm text-left disabled:cursor-not-allowed"
          >
            <span>{placeholder}</span>
            <ChevronsUpDownIcon aria-hidden="true" className="size-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
          <Command shouldFilter={!onSearch && !filtrar}>
            <CommandInput placeholder={textoDaBusca} value={query} onValueChange={setQuery} />
            {aviso !== null && <p className="text-destructive text-meta px-3 pt-2">{aviso}</p>}
            <CommandList>
              {loading ? (
                <div className="text-muted-foreground text-interface py-6 text-center">{loadingText}</div>
              ) : (
                <>
                  {!canCreate && <CommandEmpty>{emptyText}</CommandEmpty>}
                  {groups.map(([group, items]) => (
                    <CommandGroup key={group} heading={group || undefined}>
                      {items.map((option) => {
                        const selected = value.includes(option.value)
                        return (
                          <CommandItem
                            key={option.value}
                            value={option.value}
                            keywords={[option.label]}
                            disabled={option.disabled || (!selected && atMax)}
                            onSelect={() => toggle(option.value)}
                            className="min-h-11"
                          >
                            <CheckIcon
                              aria-hidden="true"
                              className={cn("size-4", selected ? "opacity-100" : "opacity-0")}
                            />
                            {option.icon}
                            {option.label}
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  ))}
                  {canCreate && (
                    <CommandGroup>
                      <CommandItem value={`criar:${query}`} onSelect={create} className="min-h-11">
                        <CheckIcon aria-hidden="true" className="size-4 opacity-0" />
                        {textoDeCriar(query.trim())}
                      </CommandItem>
                    </CommandGroup>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
