### 0.16.12

- feat: auto rename html tag

### 0.16.11

- feat: support directives syntax `:=`, `@=`, `#=`
- fix: v-slot bind properties missing attribute values
- fix: template validation broke with v-slot bind properties
- fix: slot services disturbed slot element hover info

### 0.16.10

- feat: reference, rename, definition support to js

### 0.16.9

- feat: template validation support to js
- fix: should not error when css class not exist
- fix: inline style hover info wrong mapping

### 0.16.8

- feat: slot name services (find references, goto definition, diagnostic, completion, hover info)

### 0.16.7

- fix: call graph links incomplete

### 0.16.6

- fix: find references crash in node_modules files

### 0.16.5

- feat: restart server command
- fix: auto import not working for .vue files

### 0.16.4

- fix: can't use export default with `<script>` when `<script setup>` exist
- fix: auto import items should not show virtual files
- fix: style attr services broke
- fix: v-for elements types incorrect
- refactor: sensitive semantic tokens update

### 0.16.3

- feat: inline css service within `<template>`

### 0.16.2

- fix: `<script setup>` formatting wrongly replace `ref:` to `ref`

### 0.16.1

- fix: fix some Call Hierarchy failed cases
- pref: faster typescript language service for new `<script setup>`


### 0.16.0

- feat: [Call Hierarchy](https://code.visualstudio.com/updates/v1_33#_call-hierarchy) support
- feat: auto declare `__VLS_GlobalComponents` by `app.component()` calls

### 0.15.x

TODO
