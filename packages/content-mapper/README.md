# Vue TypeScript content mapper

`@vue/typescript-content-mapper` transforms Vue single-file components into the
same TypeScript service scripts used by `vue-tsc`. It implements the TypeScript
7 content-mapper protocol and keeps transforms parallel with a worker-thread
pool.

## Configuration

Install the mapper beside TypeScript, then add it to `tsconfig.json`:

```jsonc
{
	"contentMappers": [
		{
			"package": "@vue/typescript-content-mapper",
			"extensions": [".vue"]
		}
	]
}
```

Run TypeScript with external plugins enabled:

```sh
tsc --runExternalCode --noEmit
```

Set `VUE_CONTENT_MAPPER_WORKERS` to a positive integer to override the worker
count. The default is the smaller of four and the host's available parallelism.
`VUE_CONTENT_MAPPER_WORKERS=1` runs transforms in the protocol process.

For CLI-only projects, `"options": { "languageFeatures": false }` skips
language-feature flags while preserving source spans used for diagnostics.
Inferred-project registrations can provide `vueCompilerOptions` in the same
options object. The Vue VS Code extension contributes a conditional JSON schema
for these options when the mapper package is
`@vue/typescript-content-mapper`.

The mapper uses dynamic project configuration so `vueCompilerOptions`, extended
tsconfig files, the installed Vue version, and Vue language plugins participate
in cache invalidation.

Each transform selects its virtual extension through the content-mapper
protocol. JSX-bearing service scripts use `.tsx`; other Vue service scripts
currently use `.ts`. Plain JavaScript service scripts are temporarily parsed as
TypeScript because Vue's generated helpers contain TypeScript syntax.

Vue template `@vue-ignore` and `@vue-expect-error` comments are emitted through
TypeScript content-mapper diagnostic directive mappings.

## Full-corpus diagnostic parity

Compare content-mapped tsgo output with `vue-tsc` across every project under
`test-workspace/tsc`:

```sh
pnpm test:content-mapper-parity -- --tsgo /absolute/path/to/tsgo
```

The command generates temporary project sidecars, runs both compilers over the
same 222-project graph, reports matching and implementation-specific output,
then removes the sidecars. Add `--check` to fail on any difference, or
`--output <directory>` to retain normalized outputs and a JSON report.

See [MIGRATION.md](./MIGRATION.md) for current parity and language-server
boundaries.
