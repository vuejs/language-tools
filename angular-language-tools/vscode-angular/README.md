# Volar language server example for Angular

⚠️⚠️⚠️⚠️⚠️

Don't use it in the projects you work on.

It's not a production-ready tool, this is a quick implementation for demonstration purposes only, functionality reliability and correctness are not guaranteed, and there are no plan to maintenance this plugin.

⚠️⚠️⚠️⚠️⚠️

## Features

- Template AST error diagnosis
- Directives, Interpolations Syntax Highlighting
- Intellisense Support for Template Directives and Interpolations
- Component props and event types Support
- Type Narrowing Support for `*ngIf` if else block
- Only 500 KB and Fast

## Usage

We have only one stubborn way to setup (that has the best performance) because this is for demonstration purposes only. Please make sure you follow each step.

1. Disable "TypeScript and JavaScript Language Features" to [takeover language support for .ts](https://vuejs.org/guide/typescript/overview.html#volar-takeover-mode)

   1. Search `@builtin typescript-language-features` in Extensions sidebar

   2. Right click and select "Disable (Workspace)"

2. Disable "Angular Language Service" to avoid conflict

   1. Search `Angular.ng-template` in Extensions sidebar

   2. Right click and select "Disable (Workspace)"

3. Create / Open `.vscode/settings.json` in workspace and put following setting.

   ```json
	{
		"volar.takeOverMode.extension": "johnsoncodehk.vscode-angular"
	}
   ```

4. Reload VSCode
