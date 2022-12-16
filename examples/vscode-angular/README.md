# Angular Language Server (Example)

> An example Angular Language Server implement via [Volar](https://github.com/johnsoncodehk/volar) framework.

⚠️ This is a quick implementation for demonstration purposes only, functionality reliability and correctness are not guaranteed, and there are no plan to maintenance this plugin.

## Features

- Template AST error diagnosis
- Directives, Interpolations Syntax Highlighting
- Intellisense Support for Template Directives and Interpolations
- Typed Prop Support
- Typed Event Support
- Type Narrowing Support for `*ngIf` if else block

## Usage

We have only one performance-optimized available setup due to this is for demonstration purposes only. Please make sure you follow each step.

1. Disable "TypeScript and JavaScript Language Features" to [takeover language support for .ts](https://vuejs.org/guide/typescript/overview.html#volar-takeover-mode)

   1. Search `@builtin typescript-language-features` in Extensions sidebar

   2. Right click and select "Disable (Workspace)"

2. Disable "Angular Language Service" to avoid conflict

   1. Search `Angular.ng-template` in Extensions sidebar

   2. Right click and select "Disable (Workspace)"

3. Disable "Vue Language Features (Volar)" to avoid it's takeover mode active

   1. Search `Vue.volar` in Extensions sidebar

   2. Right click and select "Disable (Workspace)"

4. Reload VSCode
