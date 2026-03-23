/**
 * ScrollEngine — 与 UI 解耦的滚动内核
 * 职责：requestAnimationFrame 驱动、offset 累加与取模、自动滚启停、hover 暂停、平滑 scrollToIndex
 * 不负责：DOM、列配置、虚拟行拼装（由 Vue 组件完成）
 */

/** easeInOut 三次曲线，t ∈ [0,1] */
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * @typedef {Object} ScrollEngineOptions
 * @property {() => number} getTotalLength 轨道总像素长（如 n * itemSize）
 * @property {() => number} getItemSize 单格像素（行高或列宽）
 * @property {() => number} getItemCount 数据条数
 * @property {number} [scrollSpeed] px/s
 * @property {(offset: number) => void} onUpdate 每帧或每次 offset 变更时通知视图
 * @property {() => void} [onSmoothEnd] 平滑滚动结束
 */

export class ScrollEngine {
  /**
   * @param {ScrollEngineOptions} options
   */
  constructor(options) {
    this.getTotalLength = options.getTotalLength;
    this.getItemSize = options.getItemSize;
    this.getItemCount = options.getItemCount;
    this.scrollSpeed = options.scrollSpeed ?? 30;
    this.onUpdate = options.onUpdate || (() => {});
    this.onSmoothEnd = options.onSmoothEnd || (() => {});

    /** 当前像素偏移，逻辑上在 [0, totalLength) 内由取模约束 */
    this._offset = 0;
    this._rafId = null;
    this._lastTime = 0;

    /** 是否允许自动滚动（对应 props.autoScroll） */
    this._autoScroll = true;
    /** 外部 pause（如业务暂停） */
    this._paused = false;
    /** hover 暂停（对应 pauseOnHover） */
    this._hoverPaused = false;

    /** 平滑滚动到某下标 */
    this._smoothing = false;
    this._smoothFrom = 0;
    this._smoothDelta = 0;
    this._smoothStartTime = 0;
    this._smoothDurationMs = 500;
    this._smoothTotalLength = 0;

    this._tick = this._tick.bind(this);
  }

  get offset() {
    return this._offset;
  }

  /** 直接设置偏移（用于数据比例同步等） */
  setOffset(value) {
    const total = this.getTotalLength();
    if (total <= 0) {
      this._offset = 0;
    } else {
      this._offset = ((value % total) + total) % total;
    }
    this.onUpdate(this._offset);
  }

  setAutoScroll(enabled) {
    this._autoScroll = !!enabled;
    if (!this._autoScroll) {
      this._cancelRaf();
    } else if (!this._smoothing && !this._shouldHold()) {
      this._startLoop();
    }
  }

  setScrollSpeed(pxPerSec) {
    this.scrollSpeed = Number(pxPerSec) || 0;
  }

  /** 业务层暂停：停止 rAF，offset 不变 */
  pause() {
    this._paused = true;
    this._cancelRaf();
  }

  resume() {
    this._paused = false;
    if (!this._smoothing && !this._shouldHold()) {
      this._startLoop();
    }
  }

  /** hover 进入：仅标记，由 _shouldHold 决定是否停表 */
  setHoverPaused(flag) {
    this._hoverPaused = !!flag;
    if (this._hoverPaused) {
      this._cancelRaf();
    } else if (!this._smoothing && !this._shouldHold()) {
      this._startLoop();
    }
  }

  /** 停止自动滚动循环（不重置 offset） */
  stop() {
    this._cancelRaf();
    this._lastTime = 0;
  }

  /** 启动自动滚动（满足条件时） */
  start() {
    if (this._smoothing || this._shouldHold()) return;
    this._startLoop();
  }

  destroy() {
    this._cancelRaf();
    this._smoothing = false;
    this.onUpdate = () => {};
    this.onSmoothEnd = () => {};
  }

  _shouldHold() {
    return (
      !this._autoScroll ||
      this._paused ||
      this._hoverPaused ||
      this.getItemCount() <= 0 ||
      this.getTotalLength() <= 0
    );
  }

  _cancelRaf() {
    if (this._rafId != null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._lastTime = 0;
  }

  _startLoop() {
    if (this._rafId != null) return;
    this._lastTime = 0;
    this._rafId = requestAnimationFrame(this._tick);
  }

  /**
   * 平滑滚到指定逻辑下标（对齐到该行起点）
   * 使用 easeInOut；动画期间暂停自动滚，结束后可按状态恢复
   * @param {number} index 逻辑下标 [0, n)
   * @param {number} [durationMs=500]
   */
  scrollToIndex(index, durationMs = 500) {
    const n = this.getItemCount();
    const itemSize = this.getItemSize();
    const total = this.getTotalLength();
    if (n <= 0 || total <= 0 || itemSize <= 0) return;

    const idx = Math.max(0, Math.min(n - 1, Math.floor(index)));
    let target = idx * itemSize;
    target = ((target % total) + total) % total;

    const from = this._offset;
    let delta = target - from;
    // 环形上取最短路径（可选，使动画更短）
    if (Math.abs(delta) > total / 2) {
      delta = delta > 0 ? delta - total : delta + total;
    }

    this._smoothing = true;
    this._smoothFrom = from;
    this._smoothDelta = delta;
    this._smoothStartTime =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    this._smoothDurationMs = Math.max(16, durationMs);
    this._smoothTotalLength = total;

    this._cancelRaf();
    this._lastTime = 0;
    this._rafId = requestAnimationFrame(this._tick);
  }

  _tick(ts) {
    if (this._smoothing) {
      this._tickSmooth();
      return;
    }

    if (this._shouldHold()) {
      this._rafId = null;
      return;
    }

    const total = this.getTotalLength();
    if (total <= 0) {
      this._rafId = null;
      return;
    }

    if (!this._lastTime) {
      this._lastTime = ts;
    }
    const dt = Math.min(0.064, Math.max(0, (ts - this._lastTime) / 1000));
    this._lastTime = ts;

    const next = this._offset + this.scrollSpeed * dt;
    this._offset = ((next % total) + total) % total;
    this.onUpdate(this._offset);

    this._rafId = requestAnimationFrame(this._tick);
  }

  _tickSmooth() {
    const now =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    const elapsed = now - this._smoothStartTime;
    const t = Math.min(1, elapsed / this._smoothDurationMs);
    const e = easeInOutCubic(t);
    const total = this._smoothTotalLength;

    this._offset = this._smoothFrom + this._smoothDelta * e;
    this._offset = ((this._offset % total) + total) % total;
    this.onUpdate(this._offset);

    if (t >= 1) {
      this._smoothing = false;
      this._rafId = null;
      this._lastTime = 0;
      this.onSmoothEnd();
      if (!this._shouldHold()) {
        this._startLoop();
      }
      return;
    }

    this._rafId = requestAnimationFrame(this._tick);
  }
}
