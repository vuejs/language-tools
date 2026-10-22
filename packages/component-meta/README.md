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

const checker = await createChecker('/path/to/tsconfig.json', {
  schema: true, // Enable schema parsing
});

const meta = await checker.getComponentMeta('/path/to/MyComponent.vue');

await checker.close();
```

The checker runs the TypeScript 7 API (`tsc --api`) in a child process. Vue files are type-checked through the content mappers configured in the tsconfig (`contentMappers`), and only files matched by its `include` are part of the project.

## API

### `checker.getComponentMeta(filePath, exportName?)`

Get the metadata of a component. `exportName` defaults to `'default'`. Returns a `Promise<ComponentMeta>`.

The returned `ComponentMeta` object contains:

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

### `checker.getExportNames(filePath)`

Get all export names of a file. Returns a `Promise<string[]>`.

### `checker.updateFile(filePath, content)`

Update file content (for virtual files or live editing). The file must be matched by the tsconfig's `include`.

### `checker.deleteFile(filePath)`

Remove a file from the project, including files on disk.

### `checker.reload()`

Reload the tsconfig.json configuration.

### `checker.clearCache()`

Clear cached file content.

### `checker.getProgram()`

Get the underlying TypeScript 7 `Program` instance. Returns a `Promise`.

### `checker.close()`

Stop the TypeScript 7 API process.

## Metadata Structures

### PropertyMeta (Props)

```typescript
interface PropertyMeta {
  name: string;
  description: string;      // Read from JSDoc
  type: string;             // Type string
  default?: string;         // Default value
  required: boolean;
  global: boolean;          // Whether it's a global prop
  tags: { name: string; text?: string }[];  // JSDoc tags
  schema: PropertyMetaSchema;
  getDeclarations(): Promise<Declaration[]>;
  getTypeObject(): Type;
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
  getDeclarations(): Promise<Declaration[]>;
  getTypeObject(): Type | undefined;
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
  getDeclarations(): Promise<Declaration[]>;
  getTypeObject(): Type;
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
  getDeclarations(): Promise<Declaration[]>;
  getTypeObject(): Type;
}
```

## Options

```typescript
interface MetaCheckerOptions {
  schema?: boolean | {
    ignore?: (string | ((name: string, type: Type, typeChecker: Checker) => boolean | Promise<boolean>))[];
  };
  printer?: PrintNodeOptions;
}
```

`Type`, `Checker` and `PrintNodeOptions` are the types of `typescript/async` from TypeScript 7.

### `schema`

Controls whether to parse the schema structure of types. Set to `true` to enable, or pass an object to configure types to ignore.

```typescript
const checker = createChecker(tsconfig, {
  schema: {
    ignore: ['HTMLElement', (name) => name.startsWith('Internal')],
  },
});
```

## Related Packages

- [`vue-component-type-helpers`](../component-type-helpers) - Type helper utilities

## License

[MIT](https://github.com/vuejs/language-tools/blob/master/LICENSE) License
