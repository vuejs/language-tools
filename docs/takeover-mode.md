# What is Take Over Mode?

In the past, we have explored a variety of language support modes for TS and Vue, namely:

- Vetur Mode: Vue + TS language support provided by different extensions.
- VueDX Mode: Realized by TS Plugin, Vue + TS language support also provided by VSCode built-in TypeScript extension.
- Volar Mode: Similar to Vetur, but use TS Plugin to patching TS language support additional.

## What's problems with Volar Mode?

For each TS project, VSCode built-in TypeScript extension and Volar create 2 language service instances, and TS Plugin proxy program has also additional language service instances for built-in TS extension, finally we have 6 language service instances for each TS project. In theory, there is 200% ~ 300% the memory usage and CPU usage.
Since VSCode does not support the TS Plugin enable setting, you must re-enable TS Plugin every time Volar is updated.
How Take Over Mode resolve Volar Mode problem?

Take Over Mode don't use VSCode built-in TypeScript extension, only use Vue language server to provided Vue + TS language support. So we only have 2 language service instances.
There is no hacking in this approach, we no longer need to reload vscode for TS plugin after each updated extension.

## How to enable Take Over Mode?

- Update Volar to 0.27.17.
- Disable built-in TypeScript extension:
  - Run Extensions: Show Built-in Extensions command
  - Find TypeScript and JavaScript Language Features, right click and select Disable (Workspace)
- Reload VSCode, and then open any vue file to trigger Volar activation (no longer need in 0.28.4).

## How to disable Take Over Mode?

- Run Extensions: Show Built-in Extensions command
- Find TypeScript and JavaScript Language Features, right click and select Enable (Workspace)
- Reload VSCode


## What are the limitations of Take Over Mode?

Vue language server tries to provide all the built-in TS extension features, but there will always be some features drop behind, missing, or bugs.
For example, Vue language server does not support tsconfig.json properties intellisense (supported 0.30.3), and the experimental feature Inlay hints (supported 0.34.8).
Volar has known performance issues with monorepo support. If your TS project is monorepo, language support in *.ts may be slower than before. (Fully support for monorepo #348)
VSCode user TypeSciprt settings not working, because Volar can't get TS extension settings when TS extension disabled. But worksapce TypeSciprt settings still working.