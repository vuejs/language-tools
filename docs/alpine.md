# Alpine Language Features (Experimental)

JavaScript intellisense support for Alpine.js.

[Plugin's page on Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.alpine-language-features)

## Usage

1. Create `jsconfig.json` or `tsconfig.json` to your Alpine project, and than adding below content.

```jsonc
{
	"compilerOptions": {
		"allowJs": true,
		"jsx": "preserve"
	},
	"include": [
		"PATH_TO_THE_HTML_FILES/**/*.html"
	]
}
```

2. (Optional) Install `@vue/runtime-dom` to `devDependencies` for support html element types.