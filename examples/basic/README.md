# Vue language tools - Basic example

This is an official example of using the Vue language tools in a VSCode project.

## What's inside?

### Monorepo setup

In this example, we use a monorepo consisting of a component library and a Vue 3 app. We use `pnpm` to manage the dependencies.

### Library bundling and type declarations

[packages/ui](./packages/ui/src/components/generic-select/) A component library that can be imported in other projects. Note how the `package.json` is configured to expose the bundled components as well as the type declarations.

### Generic components

[packages/ui/components/generic-select](./packages/ui/src/components/generic-select/) A select input component that can handle generic model and option values.

## Getting started

1. [Install the `Vue - Official` VScode extension](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
2. Download this example project and open it in VSCode.
3. Run `pnpm install` to install the dependencies.
4. Start exploring
