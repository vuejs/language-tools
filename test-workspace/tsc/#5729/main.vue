<template>
    <div v-if="true" />
    <!-- @vue-expect-error -->
    <div v-else :class="unknownProp" />
</template>
