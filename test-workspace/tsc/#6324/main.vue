<script setup lang="ts">
import { exactType } from '../shared';
import child from './child.vue';

type Props = InstanceType<typeof child>['$props'];

exactType({} as 'onFoo' extends keyof Props ? true : false, true);
</script>
