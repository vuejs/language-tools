# vue-component-meta

<p>
  <a href="https://www.npmjs.com/package/vue-component-meta"><img src="https://img.shields.io/npm/v/vue-component-meta.svg?labelColor=18181B&color=1584FC" alt="NPM version"></a>
  <a href="https://github.com/vuejs/language-tools/blob/master/LICENSE"><img src="https://img.shields.io/github/license/vuejs/language-tools.svg?labelColor=18181B&color=1584FC" alt="License"></a>
</p>

Statically extract metadata such as props, events, slots, and exposed from Vue components. Useful for auto-generating component documentation or displaying component APIs in tools like Storybook.

## Installation

```bash
npm install vue-component-meta
```

## Usage

### Create a Checker from tsconfig.json

```typescript
import { createChecker } from 'vue-component-meta';

await using checker = await createChecker('/path/to/tsconfig.json');

const meta = await checker.getComponentMeta('/path/to/MyComponent.vue');
```

The checker runs the TypeScript 7 API (`tsc --api`) in a child process, which is stopped when the checker is disposed (`await using`) or closed (`checker.close()`). Vue files are type-checked through the content mappers configured in the tsconfig (`contentMappers`), and only files matched by its `include` are part of the project.

Every query reads the project from disk into a new snapshot that is released when the query completes, so the results always reflect the files on disk. Virtual files and in-memory content are not supported. Creating a snapshot rebuilds the project, so use `getComponentMetas` to query several components at once.

### Use an existing TypeScript 7 project

```typescript
import * as tsAsync from 'typescript/async';
import * as tsAst from 'typescript/ast';
import { getComponentMeta } from 'vue-component-meta';

const ts = { ...tsAst, ...tsAsync };
const api = new ts.API({ cwd });
const snapshot = await api.createSnapshot({ openProjects: [tsconfig] });
try {
  const project = snapshot.getConfiguredProject(tsconfig)!;
  const meta = await getComponentMeta(ts, project, '/path/to/MyComponent.vue');
}
finally {
  await snapshot.dispose();
}
```

`getComponentMeta` and `getExportNames` take a `Project` of the TypeScript 7 API; the caller owns the snapshot of the project. `getComponentMeta` also takes the modules of the same TypeScript 7 installation (`typescript/ast` and `typescript/async`, merged), which `vue-component-meta` does not load itself.

## API

### `createChecker(tsconfig)`

Start the TypeScript 7 API for the project of `tsconfig`. Returns a `Promise` of a checker with the methods below.

### `checker.getComponentMeta(filePath, exportName?)`

Get the metadata of a component exported from a file, in a new snapshot of the checker's project. `exportName` defaults to `'default'`. Returns a `Promise<ComponentMeta>` and rejects if the file is not part of the project or has no such export.

### `checker.getComponentMetas(filePaths)`

Get the metadata of the default exports of several files in a single snapshot. Returns a `Promise<ComponentMeta[]>`.

### `checker.getExportNames(filePath)`

Get all export names of a file, in a new snapshot of the checker's project. Returns a `Promise<string[]>`.

### `checker.close()` / `checker[Symbol.asyncDispose]()`

Stop the TypeScript 7 API process.

### `getComponentMeta(ts, project, filePath, exportName?)`

Same as `checker.getComponentMeta`, in a `project` of the caller.

### `getExportNames(project, filePath)`

Same as `checker.getExportNames`, in a `project` of the caller.

## Metadata Structures

A `ComponentMeta` is plain data that can be serialized as JSON. The types of its members are indexes (`TypeId`) into its `types` table, where each type reachable from the members is resolved once: a type used by several members, or by itself, refers to the same entry.

```typescript
interface ComponentMeta {
  name?: string;        // The `name` option
  description?: string; // Read from the JSDoc of the component
  props: PropMeta[];
  events: EventMeta[];
  slots: SlotMeta[];
  exposed: ExposeMeta[];
  types: TypeNode[];
}

type TypeId = number; // An index into `ComponentMeta.types`

interface Tag {
  name: string;
  text?: string;
}

interface PropMeta {
  name: string;
  required: boolean;
  default?: string;     // The default value, as written in the source
  description: string;  // Read from JSDoc
  tags: Tag[];          // JSDoc tags
  global: boolean;      // Declared by Vue or the global component props (e.g. `key`, `class`)
  declarations: Declaration[];
  type: TypeId;
}

interface EventMeta {
  name: string;
  description: string;
  tags: Tag[];
  declarations: Declaration[]; // The event's call signature
  type: TypeId;         // A `function` type of the event's arguments
}

interface SlotMeta {
  name: string;
  description: string;
  tags: Tag[];
  declarations: Declaration[];
  type: TypeId;         // The type of the slot props
}

interface ExposeMeta {
  name: string;
  description: string;
  tags: Tag[];
  declarations: Declaration[];
  type: TypeId;
}

interface Declaration {
  file: string;
  start: number; // UTF-16 offset in the file's source text (for a Vue file, its `.vue` text)
  end: number;
}
```

The `declarations` of a member are the ranges of its declarations in the source text of their files, e.g. `foo?: string;` of a props interface or the name of a `<slot>` element. Declarations generated by Vue without a source range are omitted.

### TypeNode

Every type has its `text`, as written by the type checker, and a `kind` with the structure of that kind:

```typescript
type TypeNode = { text: string } & (
  | { kind: 'primitive' | 'literal' }
  | { kind: 'union'; types: TypeId[] }
  | { kind: 'array'; element: TypeId }
  | { kind: 'tuple'; elements: TypeId[] }
  | { kind: 'object'; properties: PropertyNode[] }
  | { kind: 'function'; parameters: ParameterNode[]; returns: TypeId }
  | { kind: 'external'; declaration?: Declaration }
);

interface PropertyNode {
  name: string;
  optional: boolean;
  description: string;
  type: TypeId;
}

interface ParameterNode {
  name: string;
  optional: boolean;
  rest: boolean;
  type: TypeId;
}
```

- `primitive`: `string`, `number`, `boolean`, `any`, branded primitives such as `string & {}`, and any type without a structure of the kinds below (e.g. type parameters).
- `literal`: string, number, bigint, boolean and enum member literals. An enum is a `union` of its members.
- `function`: the first call signature of a type without properties. A rest parameter of a fixed-length tuple type is read as its elements, e.g. `(...args: [value: number])` as `(value: number)`.
- `object`: objects and intersections, with their properties.

### Expansion boundary

Unions, literals, arrays and tuples always keep their structure. Objects and functions declared outside the project's own source files, i.e. in the default library (`lib.*.d.ts`) or an external library (`node_modules`), are `external` types with their `text` and `declaration` instead of their structure. For example, `size?: 'small' | 'large'` is a union of literals wherever the union is declared, while `Record<string, any>` and `HTMLElement` are external types.

To resolve an external type further, use the TypeScript 7 API at its `declaration`.

## Migrating from 3.x

- `createChecker(tsconfig)` is asynchronous, runs the TypeScript 7 API in a child process, and takes no options. `createCheckerByJson` is removed; write the configuration to a tsconfig file instead.
- `checker.updateFile`, `deleteFile`, `reload`, `clearCache` and `getProgram` are removed. Every query reads the files from disk; use `getComponentMetas` to query several components in one snapshot.
- The `schema`, `printer`, `noDeclarations`, `forceUseTs` and `rawType` options are removed. Types are always resolved into the `types` table, and the expansion boundary replaces `schema.ignore`.
- `ComponentMeta.type` (`TypeMeta`) is removed.
- `type` of a member is a `TypeId` instead of a type string; its text is `meta.types[member.type].text`. `schema` is replaced by the `TypeNode` at that id.
- `EventMeta.signature` is removed. An event's `type` is a `function` type of its arguments, without the event name parameter.
- `Declaration` is `{ file, start, end }` instead of `{ file, range: [start, end] }`.
- `getDeclarations()`, `rawType` and `getTypeObject()` of members are removed; use `declarations`. Results contain no TypeScript objects.
- `PropertyMeta` is renamed to `PropMeta`.

## Related Packages

- [`vue-component-type-helpers`](../component-type-helpers) - Type helper utilities

## License

[MIT](https://github.com/vuejs/language-tools/blob/master/LICENSE) License
