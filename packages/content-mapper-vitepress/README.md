# VitePress content mapper

`@vue/content-mapper-vitepress` type-checks VitePress markdown with `tsc` through the TypeScript
content-mapper protocol. It turns a markdown file into the SFC shape that VitePress renders —
frontmatter, fenced code blocks and `<<<` snippet imports blanked, `<script>` / `<style>` blocks
lifted out, the remaining markdown as the template — and reuses `@vue/content-mapper`'s project
handling and Vue codegen, so markdown participates in the same program as `.vue` files.

## Configuration

Install it beside the Vue mapper, then register both in `tsconfig.json`:

```jsonc
{
	"contentMappers": [
		{ "package": "@vue/content-mapper", "extensions": [".vue"] },
		{ "package": "@vue/content-mapper-vitepress", "extensions": [".md"] }
	]
}
```

Run TypeScript with external plugins enabled:

```sh
tsc --runExternalCode --noEmit
```

The mapper claims every file the host sends it, so which extensions count as markdown is decided by
this registration alone. Vue compiler options such as `target` go under the mapper entry's `options`
and are validated the same way as for the `.vue` mapper.

`VUE_CONTENT_MAPPER_WORKERS` overrides the worker count, as it does for `@vue/content-mapper`.
