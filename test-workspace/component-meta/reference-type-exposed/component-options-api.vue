<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  data() {
    return {
      counter: 0
    };
  },
  methods: {
    /** Resets the counter to zero */
    reset() {
      (this as any).counter = 0;
    },
    /** Increments the counter by one */
    increment() {
      (this as any).counter += 1;
    }
  },
  expose: ['reset', 'increment'],
})
</script>