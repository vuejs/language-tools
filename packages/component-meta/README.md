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

await using checker = await createChecker('/path/to/tsconfig.json', {
  schema: true, // Enable schema parsing
});

const meta = await checker.getComponentMeta('/path/to/MyComponent.vue');
```

The checker runs the TypeScript 7 API (`tsc --api`) in a child process, which is stopped when the checker is disposed (`await using`) or closed (`checker.close()`). Vue files are type-checked through the content mappers configured in the tsconfig (`contentMappers`), and only files matched by its `include` are part of the project.

Every query reads the project from disk into a new snapshot that is released when the query completes, so the results always reflect the files on disk. Virtual files and in-memory content are not supported. Creating a snapshot rebuilds the project, so use `getComponentMetas` to query several components at once.

### Use an existing TypeScript 7 project

```typescript
import * as ts from 'typescript/async';
import * as tsAst from 'typescript/ast';
import { getComponentMeta } from 'vue-component-meta';

const api = new ts.API({ cwd });
const context = { ts: { ...tsAst, ...ts }, printer: api.printer };
const snapshot = await api.createSnapshot({ openProjects: [tsconfig] });
try {
  const project = snapshot.getConfiguredProject(tsconfig)!;
  const meta = await getComponentMeta(context, project, '/path/to/MyComponent.vue');
}
finally {
  await snapshot.dispose();
}
```

`getComponentMeta` and `getExportNames` take a `Project` of the TypeScript 7 API; the caller owns the snapshot of the project. `getComponentMeta` also takes a context of the same TypeScript 7 installation: its modules (`typescript/ast` and `typescript/async`, merged) and the `printer` of the `API` that created the snapshot.

## API

### `getComponentMeta(context, project, filePath, exportName?, options?)`

Get the metadata of a component exported from a file of `project`. `context` is `{ ts, printer }` as above, `exportName` defaults to `'default'`, and `options` are the checker options. Returns a `Promise<ComponentMeta>` and rejects if the file is not part of the project or has no such export.

### `getExportNames(project, filePath)`

Get all export names of a file of `project`. Returns a `Promise<string[]>`.

### `checker.getComponentMeta(filePath, exportName?)`

Same as `getComponentMeta`, in a new snapshot of the checker's project.

### `checker.getComponentMetas(filePaths)`

Get the metadata of the default exports of several files in a single snapshot. Returns a `Promise<ComponentMeta[]>`.

### `checker.getExportNames(filePath)`

Same as `getExportNames`, in a new snapshot of the checker's project.

### `checker.close()` / `checker[Symbol.asyncDispose]()`

Stop the TypeScript 7 API process.

The returned `ComponentMeta` object contains plain data that can be serialized as JSON:

```typescript
interface ComponentMeta {
  name?: string;
  description?: string;
  type: TypeMeta;
  props: PropertyMeta[];
  events: EventMeta[];
  slots: SlotMeta[];
  exposed: ExposeMeta[];
}
```

## Metadata Structures

### PropertyMeta (Props)

```typescript
interface PropertyMeta {
  name: string;
  description: string;      // Read from JSDoc
  type: string;             // Type string
  default?: string;         // Default value, as written in the source
  required: boolean;
  global: boolean;          // Whether it's a global prop
  tags: { name: string; text?: string }[];  // JSDoc tags
  schema: PropertyMetaSchema;
  declarations: Declaration[];
}
```

### EventMeta

```typescript
interface EventMeta {
  name: string;
  description: string;
  type: string;
  signature: string;
  tags: { name: string; text?: string }[];
  schema: PropertyMetaSchema[];
  declarations: Declaration[];
}
```

### SlotMeta

```typescript
interface SlotMeta {
  name: string;
  description: string;
  type: string;
  tags: { name: string; text?: string }[];
  schema: PropertyMetaSchema;
  declarations: Declaration[];
}
```

### ExposeMeta

```typescript
interface ExposeMeta {
  name: string;
  description: string;
  type: string;
  tags: { name: string; text?: string }[];
  schema: PropertyMetaSchema;
  declarations: Declaration[];
}
```

### Declaration

```typescript
interface Declaration {
  file: string;
  start: number; // UTF-16 offset in the file's source text (for a Vue file, its `.vue` text)
  end: number;
}
```

## Options

```typescript
interface MetaCheckerOptions {
  schema?: boolean | {
    ignore?: (string | ((name: string, type: Type, typeChecker: Checker) => boolean | Promise<boolean>))[];
  };
}
```

`Type` and `Checker` are the types of `typescript/async` from TypeScript 7. They are only valid while the query runs.

### `schema`

Controls whether to parse the schema structure of types. Set to `true` to enable, or pass an object to configure types to ignore.

```typescript
await using checker = await createChecker(tsconfig, {
  schema: {
    ignore: ['HTMLElement', (name) => name.startsWith('Internal')],
  },
});
```

## Related Packages

- [`vue-component-type-helpers`](../component-type-helpers) - Type helper utilities

## License

[MIT](https://github.com/vuejs/language-tools/blob/master/LICENSE) License
