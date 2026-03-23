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

    <!--
      自动滚动：双倍数据 + 外层 overflow:hidden + 内层 CSS 动画 translateY(0)→(-50%)
      整段位移恰好等于「一份列表」高度，循环时首尾相接无跳变（禁止用 scrollTop 驱动自动滚）
    -->
    <div
      v-if="autoScroll"
      ref="bodyRef"
      class="virtual-auto-list__body virtual-auto-list__body--marquee"
    >
      <div
        class="list-body-inner"
        :style="marqueeInnerStyle"
      >
        <div
          v-for="(row, index) in renderList"
          :key="getRenderRowKey(row, index)"
          class="virtual-auto-list__row"
          :class="{ 'is-last-row': index === renderList.length - 1 }"
          :style="rowStyle"
          @click="onMarqueeRowClick(row, index)"
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
              :index="logicalRowIndex(index)"
            />
            <span v-else class="virtual-auto-list__cell-text">{{ row[col.prop] }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 手动滚动：虚拟列表 + scrollTop，仅渲染可视区（与自动滚模式互斥） -->
    <div
      v-else
      ref="bodyRef"
      class="virtual-auto-list__body"
      @scroll="handleBodyScroll"
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
          :style="rowStyle"
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
      lastCapturedScrollTop: 0
    };
  },
  computed: {
    /** 行高取整，保证总高度为整行倍数，避免 -50% 与像素累计误差导致接缝闪烁 */
    normalizedRowHeight() {
      return Math.max(1, Math.round(Number(this.rowHeight) || 1));
    },
    /** 原始「一份」列表总高度（像素），用于动画时长 = totalHeight / scrollSpeed（秒） */
    totalHeight() {
      return this.dataList.length * this.normalizedRowHeight;
    },
    /** 无缝循环：两份数据首尾相接，动画只滚过「一半」高度（-50%）即是一份列表 */
    renderList() {
      const a = this.dataList;
      if (!a.length) return [];
      return a.concat(a);
    },
    /**
     * 动画时长（秒）= 滚完「一份」内容所需时间 = 一份高度 / 速度
     * 与 keyframes 0→-50% 配合：一个周期内位移 = 半份容器高度 = 一份列表高度
     */
    marqueeDurationSec() {
      const th = this.totalHeight;
      const sp = Math.max(0.0001, Number(this.scrollSpeed) || 30);
      if (th <= 0) return 0;
      return th / sp;
    },
    marqueeInnerStyle() {
      if (!this.autoScroll || !this.dataList.length) return {};
      const d = this.marqueeDurationSec;
      if (d <= 0) return {};
      return {
        animation: `scrollY ${d}s linear infinite`
      };
    },
    rowStyle() {
      return { height: `${this.normalizedRowHeight}px` };
    },
    viewport() {
      const len = this.dataList.length;
      const rh = this.normalizedRowHeight;
      const bodyH = this.bodyHeight;
      const st = this.scrollTop;
      const startIndex =
        len === 0 ? 0 : Math.min(Math.max(0, Math.floor(st / rh)), len - 1);
      const visibleCount =
        rh <= 0 ? 1 : Math.max(1, Math.ceil(bodyH / rh));
      const endIndex = Math.min(len, startIndex + visibleCount + BUFFER);
      const offsetY = startIndex * rh;
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
      handler() {
        this.$nextTick(() => {
          if (!this.autoScroll) {
            this.measureBody();
          }
          this.rebindResizeObserver();
        });
      }
    }
  },
  mounted() {
    this.$nextTick(() => {
      if (!this.autoScroll) {
        this.measureBody();
      }
      this.resizeObserver =
        typeof ResizeObserver !== 'undefined'
          ? new ResizeObserver(() => {
            this.measureBody();
          })
          : null;
      this.rebindResizeObserver();
    });
  },
  beforeDestroy() {
    if (this.scrollRafId != null) {
      cancelAnimationFrame(this.scrollRafId);
      this.scrollRafId = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  },
  methods: {
    rebindResizeObserver() {
      if (!this.resizeObserver || !this.$refs.bodyRef) return;
      this.resizeObserver.disconnect();
      this.resizeObserver.observe(this.$refs.bodyRef);
    },
    getBodyScrollTop() {
      const el = this.$refs.bodyRef;
      if (el) return el.scrollTop;
      return this.scrollTop;
    },
    onDataListChange() {
      if (this.autoScroll) return;
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
      if (this.autoScroll) return;
      const el = this.$refs.bodyRef;
      if (!el) return;
      const next = el.clientHeight;
      if (next !== this.bodyHeight) {
        this.bodyHeight = next;
      }
    },
    handleBodyScroll() {
      if (this.autoScroll) return;
      this.onScroll();
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
    onRowClick(row, index) {
      this.$emit('row-click', row, index);
    },
    logicalRowIndex(renderIndex) {
      const n = this.dataList.length;
      if (!n) return renderIndex;
      return renderIndex % n;
    },
    onMarqueeRowClick(row, renderIndex) {
      this.$emit('row-click', row, this.logicalRowIndex(renderIndex));
    },
    getRenderRowKey(row, renderIndex) {
      const logical = this.logicalRowIndex(renderIndex);
      const base = this.getRowKey(row, logical);
      return `${base}__dup${renderIndex}`;
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

/* 手动：可滚动视口 */
.virtual-auto-list__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  position: relative;
  -webkit-overflow-scrolling: touch;
}

/* 自动无缝滚：裁切溢出，内层整块连续内容做 transform 动画，无 scrollTop */
.virtual-auto-list__body--marquee {
  overflow: hidden;
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

.list-body-inner {
  width: 100%;
  will-change: transform;
}

.list-body-inner:hover {
  animation-play-state: paused;
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
  background-color: #ecf5ff;
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

<!-- 动画名 scrollY 需与内联 animation: scrollY ... 一致；放非 scoped 避免 Vue 改写 keyframes 名 -->
<style>
@keyframes scrollY {
  0% {
    transform: translateY(0);
  }
  100% {
    /* 内容高度为两份列表之和时，-50% 正好等于「一份」高度，循环与第一份起点重合，无跳变 */
    transform: translateY(-50%);
  }
}
</style>
