<template>
{{
    // @ts-expect-error
    1 as Foo
}}
</template>

<script lang="ts" setup>
type Foo = string;
</script>