<template>
    <div v-if="false"></div>
    <template v-else>
        <!-- @vue-expect-error -->
        <div :class="unknownProp"></div>
    </template>
</template>
