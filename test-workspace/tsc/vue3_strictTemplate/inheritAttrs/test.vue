<template>
    <div>
        <!-- the following are equivalent -->
        <p id="hi">Hello, world!</p>

        <A id="hi" />

        <B id="hi" />

        <!-- @vue-expect-error -->
        <C id="hi" />
    </div>
</template>

<script setup lang="ts">
import A from "./a.vue";
import B from "./b.vue";
import C from "./c.vue";
</script>
