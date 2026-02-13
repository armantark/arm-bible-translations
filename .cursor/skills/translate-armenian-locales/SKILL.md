---
name: translate-armenian-locales
description: Translate English UI strings into Western Armenian (traditional spelling) and Classical Armenian (Grabar). Use when new keys are added to english.ts or when the user requests translation updates for Armenian locales.
---

# Translate Armenian Locales

## Linguistic Requirements

### 1. Traditional Orthography (Mashtotsian)
ALL Armenian text must use traditional spelling, NOT Soviet/Reformed spelling.
- Use **«ւ»** in diphthongs (e.g., `Աստուածաշունչ`, `բեռնուի`, `եա`, `իւ`).
- Use **«յ»** at the beginning of words where historically appropriate (e.g., `յաջող`, `յուր`, `յընթերցանութեան`).
- Preserve historical spelling of roots (e.g., `թիւ` instead of `թիվ`).

### 2. Western Armenian Dialect (`armenian.ts`)
- **Verb Tense**: Use the `կը` prefix for present and imperfect (e.g., `կը բեռնուի`, `կը պահպանուի`).
- **Passive Voice**: Verbs end in `-ուիլ` (e.g., `բեռնուիլ` instead of Eastern `բեռնվել`).
- **Vocabulary**: Use Western-specific terms (e.g., `գոցել` for close, `փնտռել` for search).
- **Imperatives**: Use polite or standard Western forms (e.g., `Սեղմեցէ՛ք`, `Ընտրեցէ՛ք`).

### 3. Classical Armenian / Grabar (`classical.ts`)
- **Direct Object**: Use the `զ` prefix (e.g., `զգիրք`, `զվերնագիրն`).
- **Plurals**: Use `-ք` and `-ս` endings (e.g., `գիրքք`, `թիւք`, `կարգաւորութիւնք`).
- **Negation**: Use `ոչ`, `չ-`, `չգոյ`.
- **Imperatives**: Use classical aorist imperatives (e.g., `ընտրեա՛`, `փակեա՛`, `սեղմեա՛`).
- **Infinitive constructions**: Use `ի` + infinitive for "to do X" (e.g., `ի խմբագրել`).

## Workflow

1. **Source Check**: Read `src/lib/locales/english.ts` to identify all keys.
2. **Gap Analysis**: Compare with `armenian.ts` and `classical.ts`. Identify missing or mismatched keys.
3. **Translation**:
   - Generate Western Armenian translation with traditional spelling.
   - Generate Classical Armenian translation with traditional spelling.
4. **Validation**: Ensure the `LocaleStrings` type is respected and no Eastern/Soviet forms are used.

## Examples

| English | Western (Traditional) | Classical (Grabar) |
| :--- | :--- | :--- |
| Loading... | Կը բեռնուի... | Ի բեռնիլ... |
| Save | Պահպանել | Պահպանեա՛ |
| Books | Գիրքեր | Գիրքք |
| Failed to load | Չյաջողեցաւ բեռնել | Ոչ կարացաք բեռնուլ |
