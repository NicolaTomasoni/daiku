---
paths:
  - "apps/desktop/src/**/*.{ts,tsx}"
  - "apps/desktop/package.json"
  - "apps/desktop/tsconfig*.json"
  - "apps/desktop/vite.config.ts"
---

# Architettura frontend

## Flusso e confini

```text
ROUTES -> FEATURES -> (API + DOMAIN + COMPONENTS + LIB)
```

- Le route in `src/routes/` definiscono URL, parametri, loader essenziali, redirect e composizione dei container. Non contengono fetch, mock di dominio, DTO mapping o workflow applicativi complessi.
- Le feature in `src/features/{feature}/` gestiscono i casi d'uso UI e collegano route, API, domain, query/mutation, stato e componenti. Espongono una superficie piccola tramite `index.ts`.
- Query, mutation, polling e SSE vivono negli hook della feature e rappresentano loading, success, empty ed error state.
- Tutte le chiamate backend passano da `src/api/` e dal client condiviso `src/lib/api.ts`; componenti, route e hook non usano direttamente `fetch` o `apiFetch` verso il backend.
- DTO backend in `src/api/dto/`, mapping DTO -> domain in `src/api/mappers/`, parser tecnici in `src/api/parsers/`.
- Route, feature e componenti consumano domain model da `src/domain/`, mai DTO raw.
- Primitive generiche in `src/components/ui/`; componenti di prodotto riusabili in `src/components/forge/` o nella feature pertinente. I componenti visuali non chiamano il backend e non orchestrano workflow.
- Configurazione runtime in `src/lib/config.ts`; provider globali in `src/app/providers.tsx`; query client e query key globali in `src/lib/query.ts`.
- Mock solo come fixture o demo adapter esplicito e isolato. Non tornare a mock locali quando esiste un endpoint reale.
- Se un componente acquisisce logica applicativa o accesso ai dati, spostalo nella feature corretta.

## Orientamento

Prima di creare o spostare una feature, consulta il catalogo `frontend-features` in memory. Aggiornalo solo quando aggiungi, rinomini o rimuovi una feature oppure ne sposti la responsabilità.

## Gate

- Parser, mapper e hook critici richiedono test mirati o una motivazione esplicita della loro assenza.
- Quando il frontend è coinvolto, prima di considerare completa la modifica esegui `pnpm check` dalla root.
