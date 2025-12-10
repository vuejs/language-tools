<script setup lang="ts">
declare const Comp: (props: {}, ctx: {
    slots: {
        counter: (props: { value: number }) => void;
    }
}) => {};
</script>

<template>
    <Comp>
        <template v-if="false" #counter="{ value: counterValue }">
            {{ counterValue }}
        </template>
        <template v-else-if="true" #counter="{ value: counterValue }">
            {{ counterValue }}
        </template>
    </Comp>
</template>
