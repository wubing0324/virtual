<template>
  <div class="data-change-notice" aria-hidden="true">
    <div
      v-for="item in items"
      :key="item.key"
      class="data-change-notice__item"
      :class="[
        `is-${item.type}`,
        `is-phase-${item.phase}`
      ]"
      :style="noticeInlineStyle"
      @transitionend="onTransitionEnd($event, item)"
    >
      {{ item.text }}
    </div>
  </div>
</template>

<script>
export default {
  name: 'DataChangeNotice',
  props: {
    /** 提示停留时长（ms） */
    stayMs: {
      type: Number,
      default: 1000
    },
    /** 进入/离开过渡时长（ms） */
    transitionMs: {
      type: Number,
      default: 320
    }
  },
  data() {
    return {
      items: [],
      seed: 0,
      leaveTimers: {}
    };
  },
  computed: {
    noticeInlineStyle() {
      return {
        transitionDuration: `${this.transitionMs}ms`
      };
    }
  },
  beforeDestroy() {
    Object.keys(this.leaveTimers).forEach((k) => {
      clearTimeout(this.leaveTimers[k]);
      this.$delete(this.leaveTimers, k);
    });
  },
  methods: {
    notifyAdd(text) {
      this.pushNotice('add', text);
    },
    notifyRemove(text) {
      this.pushNotice('remove', text);
    },
    pushNotice(type, text) {
      const key = ++this.seed;
      const item = {
        key,
        type,
        text: this.buildText(type, text),
        phase: 'start'
      };
      this.items.push(item);
      this.$nextTick(() => {
        requestAnimationFrame(() => {
          this.$set(item, 'phase', 'active');
          this.leaveTimers[key] = setTimeout(() => {
            this.$set(item, 'phase', 'leave');
            this.$delete(this.leaveTimers, key);
          }, this.stayMs);
        });
      });
    },
    buildText(type, text) {
      const label = String(text || '未知数据');
      return label;
    },
    onTransitionEnd(ev, item) {
      if (!item || ev.target !== ev.currentTarget) return;
      if (ev.propertyName !== 'opacity') return;
      if (item.phase !== 'leave') return;
      const i = this.items.findIndex((x) => x.key === item.key);
      if (i >= 0) this.items.splice(i, 1);
    }
  }
};
</script>

<style scoped>
.data-change-notice {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  pointer-events: none;
  z-index: 5;
}

.data-change-notice__item {
  position: absolute;
  top: 12px;
  right: 12px;
  max-width: 88%;
  min-width: 260px;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.4;
  font-weight: 500;
  color: #f5f7fa;
  opacity: 0;
  transition-property: opacity, transform;
  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
  box-shadow:
    0 12px 30px rgba(0, 0, 0, 0.22),
    0 2px 10px rgba(0, 0, 0, 0.14);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  will-change: transform, opacity;
  border: 1px solid rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(16px) saturate(145%);
  -webkit-backdrop-filter: blur(16px) saturate(145%);
}

.data-change-notice__item.is-add {
  background: linear-gradient(
    180deg,
    rgba(60, 140, 90, 0.72) 0%,
    rgba(45, 112, 74, 0.66) 100%
  );
}

.data-change-notice__item.is-remove {
  background: linear-gradient(
    180deg,
    rgba(148, 73, 85, 0.75) 0%,
    rgba(123, 55, 67, 0.68) 100%
  );
}

.data-change-notice__item.is-phase-active {
  opacity: 1;
}

.data-change-notice__item.is-phase-leave {
  opacity: 0;
}

/* 固定右上角：从右上角外部滑入，离开时再滑出 */
.data-change-notice__item.is-phase-start {
  transform: translate3d(112%, 0, 0);
}
.data-change-notice__item.is-phase-active {
  transform: translate3d(0, 0, 0);
}
.data-change-notice__item.is-phase-leave {
  transform: translate3d(106%, 0, 0);
}
</style>
