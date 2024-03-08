<template>
    <div>
        <!-- the following are equivalent -->
        <p id="hi">Hello, world!</p>

        <A id="hi" />

        <!-- @vue-expect-error -->
        <B id="hi" />
    </div>
</template>

<script setup lang="ts">
import A from "./a.vue";
import B from "./b.vue"
</script>
