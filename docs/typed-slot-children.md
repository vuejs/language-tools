# Typed slot children (RFC 734)

This experiment implements [RFC 734](https://github.com/vuejs/rfcs/pull/734) on the next minor development branch. Enable it explicitly:

```json
{
  "compilerOptions": { "strict": true },
  "vueCompilerOptions": { "strictSlotChildren": true }
}
```

`strictTemplates` does not enable the experiment. The option is shared by the language service and `vue-tsc`.

## Declaring render types

```vue
<script setup lang="ts" generic="T">
import type { Renders } from 'vue-component-type-helpers';
import type Item from './Item.vue';
import type Separator from './Separator.vue';

defineProps<{ value: T }>();
defineSlots<{
  default(): Renders<typeof Item<T> | typeof Separator>[];
  selected?(): Renders<typeof Item<T>, { selected: true }>;
  controls?(): readonly [HTMLInputElement, HTMLButtonElement];
}>();
</script>
<template><slot /></template>
```

Imported interfaces, aliases, re-exports, and component generic arguments are resolved by TypeScript. A `typeof Component` return type is also supported.

The API addresses the same composition-contract use case as [Flow render types](https://flow.org/en/docs/react/render-types/):

| TypeScript slot return | Flow analogy |
| --- | --- |
| `Renders<typeof Item>` | `renders Item` |
| `Renders<typeof Item> \| undefined` | `renders? Item` |
| `Renders<typeof Item>[]` | `renders* Item` |

This does not add a TypeScript keyword or change runtime slot results.

## Unions and control flow

- `Renders<typeof A | typeof B>` and `Renders<typeof A> | Renders<typeof B>` associate each component with its own props.
- `(Renders<typeof A> | Renders<typeof B>)[]` permits mixed children.
- `Renders<typeof A>[] | Renders<typeof B>[]` requires one homogeneous alternative.
- Tuples preserve order, cardinality, and unions of complete alternatives.
- Each `v-if`, `v-else-if`, and `v-else` path must satisfy the return type. Without an `else`, an empty path is included.
- Type narrowing inside a branch is preserved when inferring component props and generic arguments.
- A `v-for` may render zero or many children; it cannot prove a fixed nonzero cardinality.
- Optional slots may be omitted. Provided optional slots must satisfy their return type. Missing required slots are checked against empty content, including conditionally supplied named slots.

Native elements use the appropriate HTML, SVG, or MathML interface. Native descendants do not become siblings of the element. Text and interpolation count as text children; adjacent text/interpolations form one text node. Comments and formatting whitespace are ignored.

`any` and `unknown` return types allow arbitrary children. `VNode[]` accepts native elements, components, and text. `[]` requires empty content, while `never` cannot be satisfied.

## Wrappers and forwarding

SFC root descriptors let a wrapper rendering `Item` satisfy a request for `Item`. Generic wrappers preserve instantiated props; multi-root wrappers preserve cardinality. A wrapper rendering `<div><Item /></div>` has a native root and does not satisfy an `Item` constraint.

Forwarded slots are specialized using the caller's actual children. Missing or empty slot content activates the fallback. The checker preserves lexical slot environments across nested forwarding, so multiple uses of the same wrapper are not mistaken for a component cycle.

Distinct SFC identities prevent unrelated components with identical props from matching. These identities are declaration-only interfaces keyed by private unique symbols. They survive `.d.ts` emission without requiring Volar ambient helpers in consuming projects.

## Implementation and boundaries

Template code generation records logical children separately from VNodes: native nodes, text, components with bound props, and slot outlets. Branches produce unions of tuples; loops produce variadic arrays. Local conditional types normalize slot return types and expand only wrappers needed to establish compatibility.

Each component supplies its identity and inferred roots in generated metadata. Cycle detection tracks identities, not structural component equality or a fixed depth cutoff. A cycle that cannot prove the requested render type produces an unknown child and fails a restricted slot check. TypeScript's own type-instantiation limits still apply.

SFCs must be checked with this option to publish root metadata. Components without metadata and native DOM interfaces retain TypeScript's structural assignability rules. Arbitrary render functions returning `VNode` do not reveal their rendered roots.

The runtime and SFC macro compilation do not change: `defineSlots` already carries the declared function types. The public `Renders` marker belongs to `vue-component-type-helpers`; no runtime import is needed.

## Regression coverage

The `packages/tsc/tests/slotChildren.spec.ts` suite checks valid cases, removes every expected-error directive to assert exact diagnostic codes and source locations, and verifies the option-off behavior. Fixtures cover imported types, generic components, union correlation, branches, loops, named and dynamic slots, forwarding, fallbacks, namespaces, and wrappers.

The declaration test emits the fixtures and checks them in a plain TypeScript project with `skipLibCheck: false` and no Volar ambient helpers. A second Vue project consumes those declarations. A separate fixture chain exercises 24 wrappers to prevent reintroducing an arbitrary depth limit.

The earlier implementation in [#5137](https://github.com/vuejs/language-tools/pull/5137) was reverted in [#5514](https://github.com/vuejs/language-tools/pull/5514). This implementation adds text, wrapper-root inference, imported/generic types, call-site forwarding, and declaration-consumer coverage to address the gaps discussed there.
