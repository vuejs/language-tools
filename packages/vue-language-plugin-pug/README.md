A `VueLanguagePlugin` to support `<template lang="pug">` for `@vue/language-server`.

## Usage

1. Install

   `$ npm i -D @volar/vue-language-plugin-pug`

2. Add to `tsconfig.json`

   ```jsonc
	{
		"vueCompilerOptions": {
			"plugins": ["@volar/vue-language-plugin-pug"]
		}
	}
   ```
