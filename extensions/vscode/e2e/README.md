# E2E Testing Guidelines

## Scope

E2E tests verify **IDE + LSP interaction**, not compiler internals.

### ✅ Test These (LSP Interface Layer)

| Category | Examples |
|----------|----------|
| **Hover Info** | ref/props/computed type display in templates |
| **Diagnostics** | Error messages and positions in IDE |
| **Completions** | Auto-complete lists for props, events, methods |
| **Navigation** | Go to Definition, Find References |
| **Multi-file** | Cross-file type inference via LSP |

### ❌ Don't Test These (Unit Test Responsibility)

- Type inference logic (belongs in `@vue/language-core` tests)
- Props/Emits type constraints
- Ref/Reactive/Computed type systems
- Generic type resolution
- Template expression type narrowing

## Test Structure

```
suite/
├── hover.e2e-test.ts           # Hover information accuracy
├── diagnostics.e2e-test.ts     # Error display & position
├── completions.e2e-test.ts     # Auto-complete lists
└── [scenario].e2e-test.ts      # Other LSP features
```

## Utils API

Use `utils.ts` helpers:

```typescript
await getDiagnostics(fileName?, waitMs?)        // LSP diagnostics
await getHover(getPosition)                     // Hover info
await getCompletions(getPosition)              // Completion items
await goToDefinition(getPosition)              // Definition location
await findReferences(getPosition)               // Reference locations
await modifyFile(fileName, modifyFn)          // File changes + test
```

## Key Principle

**Test the user's IDE experience, not compiler correctness.**

If the question is "Does the IDE show correct information?", it's E2E.  
If the question is "Does the compiler infer the type correctly?", it's unit test.
