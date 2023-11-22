<template>
    <div>
        <svg><path stroke="#efefef" stroke-width="123" /></svg>
        <foo stroke-width="123" />
    </div>
</template>

<script setup lang="ts">
import { defineComponent } from 'vue';

const Foo = defineComponent({
    props: {
        strokeWidth: { type: String, required: true },
    }
});
</script>
