<template>
  <div class="parking-draw-page">
    <div class="header">
      <div class="title-section">
        <h1 class="title">车位信息绘制</h1>
        <p class="subtitle">基于 CAD 导出的 SVG 数据渲染</p>
      </div>
      <div class="actions">
        <button class="btn-back" @click="$router.push('/')">
          返回首页
        </button>
      </div>
    </div>

    <div class="canvas-wrapper" ref="canvasWrapper">
      <canvas ref="canvas"></canvas>
      <div class="controls">
        <div class="control-item">
          <span class="label">缩放:</span>
          <span class="value">{{ (zoom * 100).toFixed(0) }}%</span>
        </div>
        <div class="control-tip">
          提示：滚轮缩放，按住 Alt + 拖拽移动画布
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { Canvas, loadSVGFromURL, util } from 'fabric';
import parkingSvgUrl from '@/assets/const/车位.svg';

export default {
  name: 'ParkingDraw',
  data() {
    return {
      canvas: null,
      zoom: 1,
      isDragging: false,
      lastPosX: 0,
      lastPosY: 0,
    };
  },
  mounted() {
    this.initCanvas();
    window.addEventListener('resize', this.handleResize);
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.handleResize);
    if (this.canvas) {
      this.canvas.dispose();
    }
  },
  methods: {
    handleResize() {
      if (!this.canvas || !this.$refs.canvasWrapper) return;
      this.canvas.setDimensions({
        width: this.$refs.canvasWrapper.clientWidth,
        height: this.$refs.canvasWrapper.clientHeight,
      });
    },

    initCanvas() {
      const wrapper = this.$refs.canvasWrapper;
      if (!wrapper) return;

      const width = wrapper.clientWidth;
      const height = wrapper.clientHeight;

      this.canvas = new Canvas(this.$refs.canvas, {
        width,
        height,
        backgroundColor: '#f8f9fa',
        selection: true,
      });

      // 加载 SVG
      this.loadSVG();

      // 绑定缩放平移事件
      this.bindEvents();
    },

    async loadSVG() {
      // 显示加载提示
      console.log('Loading SVG from:', parkingSvgUrl);
      
      try {
        const { objects, options } = await loadSVGFromURL(parkingSvgUrl);
        
        if (objects && objects.length > 0) {
            // 使用 groupSVGElements 组合所有路径
            const parkingGroup = util.groupSVGElements(objects, options);
            
            // 调整初始位置和缩放以适应屏幕
            this.fitToScreen(parkingGroup);
    
            this.canvas.add(parkingGroup);
            this.canvas.requestRenderAll();
            console.log('SVG loaded successfully');
        } else {
            console.error('No objects found in SVG');
        }
      } catch (error) {
          console.error('Error loading SVG:', error);
      }
    },

    fitToScreen(object) {
      const canvasWidth = this.canvas.width;
      const canvasHeight = this.canvas.height;
      const objectWidth = object.width;
      const objectHeight = object.height;

      // 计算适合的缩放比例
      const scaleX = (canvasWidth * 0.9) / objectWidth;
      const scaleY = (canvasHeight * 0.9) / objectHeight;
      const scale = Math.min(scaleX, scaleY);

      object.set({
        scaleX: scale,
        scaleY: scale,
        left: canvasWidth / 2,
        top: canvasHeight / 2,
        originX: 'center',
        originY: 'center',
      });
      
      this.zoom = this.canvas.getZoom(); // Initial zoom is usually 1, but object scale is what we changed.
      // Actually we changed object scale, not canvas zoom. 
      // strict zoom logic: reset object scale to 1, set canvas zoom. 
      // For simplicity, let's just keep object scaled.
    },

    bindEvents() {
      // 鼠标滚轮缩放
      this.canvas.on('mouse:wheel', (opt) => {
        const delta = opt.e.deltaY;
        let zoom = this.canvas.getZoom();
        zoom *= 0.999 ** delta;
        if (zoom > 20) zoom = 20;
        if (zoom < 0.01) zoom = 0.01;
        
        // 以鼠标为中心缩放
        this.canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
        this.zoom = zoom;
        
        opt.e.preventDefault();
        opt.e.stopPropagation();
      });

      // 拖拽画布 (Alt + Drag)
      this.canvas.on('mouse:down', (opt) => {
        const evt = opt.e;
        if (evt.altKey === true) {
          this.isDragging = true;
          this.canvas.selection = false;
          this.lastPosX = evt.clientX;
          this.lastPosY = evt.clientY;
        }
      });

      this.canvas.on('mouse:move', (opt) => {
        if (this.isDragging) {
          const e = opt.e;
          const vpt = this.canvas.viewportTransform;
          vpt[4] += e.clientX - this.lastPosX;
          vpt[5] += e.clientY - this.lastPosY;
          this.canvas.requestRenderAll();
          this.lastPosX = e.clientX;
          this.lastPosY = e.clientY;
        }
      });

      this.canvas.on('mouse:up', () => {
        // on mouse up we want to recalculate new interaction
        // for all objects, so we call setViewportTransform
        this.canvas.setViewportTransform(this.canvas.viewportTransform);
        this.isDragging = false;
        this.canvas.selection = true;
      });
      
    }
  }
};
</script>

<style scoped>
.parking-draw-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #ffffff;
}

.header {
  padding: 20px 30px;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.title-section h1 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 4px;
  letter-spacing: 0.5px;
}

.title-section .subtitle {
  font-size: 14px;
  opacity: 0.7;
  font-weight: 300;
}

.btn-back {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  backdrop-filter: blur(4px);
}

.btn-back:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.canvas-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
  background-color: #f1f5f9;
}

.controls {
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: white;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 4px;
  pointer-events: none;
}

.control-item {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.control-tip {
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
}
</style>
