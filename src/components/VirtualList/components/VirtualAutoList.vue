<template>
  <div
    class="virtual-auto-list"
    :style="{ height: height + 'px' }"
  >
    <div class="virtual-auto-list__header">
      <div
        v-for="(col, colIndex) in columns"
        :key="col.prop || colIndex"
        class="virtual-auto-list__cell virtual-auto-list__cell--header"
        :style="columnCellStyles[colIndex]"
      >
        {{ col.label }}
      </div>
    </div>
    <div
      ref="bodyRef"
      class="virtual-auto-list__body"
      @scroll="onScroll"
    >
      <div
        class="virtual-auto-list__phantom"
        :style="{ height: totalHeight + 'px' }"
        aria-hidden="true"
      />
      <div
        class="virtual-auto-list__list"
        :style="viewport.listTransformStyle"
      >
        <div
          v-for="(row, i) in viewport.visibleList"
          :key="getRowKey(row, viewport.startIndex + i)"
          class="virtual-auto-list__row"
          :class="{ 'is-last-row': viewport.startIndex + i === dataList.length - 1 }"
          :style="{ height: rowHeight + 'px' }"
          @click="onRowClick(row, viewport.startIndex + i)"
        >
          <div
            v-for="(col, colIndex) in columns"
            :key="col.prop || colIndex"
            class="virtual-auto-list__cell"
            :style="columnCellStyles[colIndex]"
          >
            <column-cell
              v-if="col.render"
              :column="col"
              :row="row"
              :index="viewport.startIndex + i"
            />
            <span v-else class="virtual-auto-list__cell-text">{{ row[col.prop] }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
const BUFFER = 5;

const ColumnCell = {
  functional: true,
  props: {
    column: { type: Object, required: true },
    row: { type: Object, required: true },
    index: { type: Number, required: true }
  },
  render(h, ctx) {
    return ctx.props.column.render(h, ctx.props.row, ctx.props.index);
  }
};

export default {
  name: 'VirtualAutoList',
  components: {
    ColumnCell
  },
  props: {
    dataList: {
      type: Array,
      default: () => []
    },
    columns: {
      type: Array,
      default: () => []
    },
    height: {
      type: Number,
      default: 300
    },
    rowHeight: {
      type: Number,
      default: 50
    },
    autoScroll: {
      type: Boolean,
      default: false
    },
    scrollSpeed: {
      type: Number,
      default: 30
    },
    rowKey: {
      type: [String, Function],
      default: null
    }
  },
  data() {
    return {
      scrollTop: 0,
      bodyHeight: 0,
      scrollRafId: null,
      resizeObserver: null,
      scrollAdjustQueued: false,
      lastCapturedScrollTop: 0,
      autoScrollRafId: null,
      autoScrollLastTs: 0
    };
  },
  computed: {
    totalHeight() {
      return this.dataList.length * this.rowHeight;
    },
    /**
     * 合并可视区状态，减少多段 computed 链式依赖
     */
    viewport() {
      const len = this.dataList.length;
      const rh = this.rowHeight || 1;
      const bodyH = this.bodyHeight;
      const st = this.scrollTop;
      const startIndex =
        len === 0 ? 0 : Math.min(Math.max(0, Math.floor(st / rh)), len - 1);
      const visibleCount =
        rh <= 0 ? 1 : Math.max(1, Math.ceil(bodyH / rh));
      const endIndex = Math.min(len, startIndex + visibleCount + BUFFER);
      const offsetY = startIndex * this.rowHeight;
      return {
        startIndex,
        endIndex,
        offsetY,
        visibleList: len === 0 ? [] : this.dataList.slice(startIndex, endIndex),
        listTransformStyle: {
          transform: `translate3d(0, ${offsetY}px, 0)`
        }
      };
    },
    /** 列宽只随 columns 变化重算，避免每行调用 cellStyle */
    columnCellStyles() {
      return this.columns.map((col) => {
        if (col.width != null) {
          return {
            flex: `0 0 ${col.width}px`,
            width: `${col.width}px`,
            minWidth: 0
          };
        }
        return {
          flex: '1 1 0',
          minWidth: 0
        };
      });
    }
  },
  watch: {
    dataList: {
      handler: 'onDataListChange',
      deep: false
    },
    'dataList.length': 'onDataListChange',
    autoScroll: {
      handler(enabled) {
        if (enabled) {
          this.startAutoScroll();
        } else {
          this.stopAutoScroll();
        }
      },
      immediate: false
    }
  },
  mounted() {
    this.$nextTick(() => {
      this.measureBody();
      this.resizeObserver =
        typeof ResizeObserver !== 'undefined'
          ? new ResizeObserver(() => {
            this.measureBody();
          })
          : null;
      if (this.resizeObserver && this.$refs.bodyRef) {
        this.resizeObserver.observe(this.$refs.bodyRef);
      }
      if (this.autoScroll) {
        this.startAutoScroll();
      }
    });
  },
  beforeDestroy() {
    if (this.scrollRafId != null) {
      cancelAnimationFrame(this.scrollRafId);
      this.scrollRafId = null;
    }
    this.stopAutoScroll();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  },
  methods: {
    getBodyScrollTop() {
      const el = this.$refs.bodyRef;
      if (el) return el.scrollTop;
      return this.scrollTop;
    },
    onDataListChange() {
      this.lastCapturedScrollTop = this.getBodyScrollTop();
      if (this.scrollAdjustQueued) return;
      this.scrollAdjustQueued = true;
      this.$nextTick(() => {
        this.scrollAdjustQueued = false;
        this.applyClampedScroll(this.lastCapturedScrollTop);
      });
    },
    applyClampedScroll(prevTop) {
      this.measureBody();
      const el = this.$refs.bodyRef;
      if (!el) return;
      if (this.dataList.length === 0) {
        if (el.scrollTop !== 0) el.scrollTop = 0;
        this.scrollTop = 0;
        return;
      }
      const maxTop = Math.max(0, this.totalHeight - el.clientHeight);
      const nextTop = Math.min(Math.max(0, prevTop), maxTop);
      if (el.scrollTop !== nextTop) {
        el.scrollTop = nextTop;
      }
      this.scrollTop = nextTop;
    },
    measureBody() {
      const el = this.$refs.bodyRef;
      if (!el) return;
      const next = el.clientHeight;
      if (next !== this.bodyHeight) {
        this.bodyHeight = next;
      }
    },
    onScroll() {
      if (this.scrollRafId != null) return;
      this.scrollRafId = requestAnimationFrame(() => {
        this.scrollRafId = null;
        const el = this.$refs.bodyRef;
        if (el) {
          this.scrollTop = el.scrollTop;
        }
      });
    },
    startAutoScroll() {
      if (this.autoScrollRafId != null || !this.autoScroll) return;
      this.autoScrollLastTs =
        typeof performance !== 'undefined' ? performance.now() : Date.now();
      const step = (ts) => {
        if (!this.autoScroll) {
          this.autoScrollRafId = null;
          return;
        }
        const el = this.$refs.bodyRef;
        const last = this.autoScrollLastTs;
        this.autoScrollLastTs = ts;
        const dt = Math.min(0.1, Math.max(0, (ts - last) / 1000));
        if (el && this.dataList.length > 0) {
          const maxTop = Math.max(0, this.totalHeight - el.clientHeight);
          let next = el.scrollTop + this.scrollSpeed * dt;
          if (maxTop <= 0) {
            next = 0;
          } else if (next >= maxTop) {
            next = 0;
          } else {
            next = Math.min(next, maxTop);
          }
          el.scrollTop = next;
          this.scrollTop = next;
        }
        this.autoScrollRafId = requestAnimationFrame(step);
      };
      this.autoScrollRafId = requestAnimationFrame(step);
    },
    stopAutoScroll() {
      if (this.autoScrollRafId != null) {
        cancelAnimationFrame(this.autoScrollRafId);
        this.autoScrollRafId = null;
      }
    },
    onRowClick(row, index) {
      this.$emit('row-click', row, index);
    },
    getRowKey(row, index) {
      if (typeof this.rowKey === 'string' && this.rowKey) {
        const k = row[this.rowKey];
        return k != null ? k : `__row_${index}`;
      }
      if (typeof this.rowKey === 'function') {
        return this.rowKey(row, index);
      }
      if (row && row.id != null) return row.id;
      if (row && row.key != null) return row.key;
      return `__row_${index}`;
    }
  }
};
</script>

<style scoped>
.virtual-auto-list {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  background: #fff;
  overflow: hidden;
}

/* 与 body 分离的顶栏；sticky 便于外层页面滚动时表头仍吸附在组件顶部 */
.virtual-auto-list__header {
  display: flex;
  flex-shrink: 0;
  align-items: stretch;
  position: sticky;
  top: 0;
  z-index: 2;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
  font-weight: 600;
  font-size: 13px;
  color: #606266;
}

.virtual-auto-list__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  position: relative;
  -webkit-overflow-scrolling: touch;
}

.virtual-auto-list__phantom {
  width: 100%;
  pointer-events: none;
}

.virtual-auto-list__list {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  will-change: transform;
  contain: layout style paint;
}

.virtual-auto-list__row {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  border-bottom: 1px solid #ebeef5;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.virtual-auto-list__row:hover {
  background-color: #f5f7fa;
}

.virtual-auto-list__row.is-last-row {
  border-bottom: none;
}

.virtual-auto-list__cell {
  display: flex;
  align-items: center;
  padding: 0 12px;
  box-sizing: border-box;
  font-size: 13px;
  color: #303133;
}

.virtual-auto-list__cell--header {
  padding-top: 10px;
  padding-bottom: 10px;
}

.virtual-auto-list__cell-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}
</style>
