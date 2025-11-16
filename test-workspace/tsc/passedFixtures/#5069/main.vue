<script lang="ts">
import { defineComponent, ref } from 'vue'

export default defineComponent({
    setup: () => ({
        msg: ref('hello'),
        msg2: ref('world')
    }),
    expose: ['msg']
});
</script>

<template>
    <div>
        {{ msg }}
        {{ msg2 }}
    </div>
</template>
