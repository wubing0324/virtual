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
import { Canvas, loadSVGFromURL, util, Image as FabricImage } from 'fabric';
import parkingSvgUrl from '@/assets/const/aaaa.svg';
import carBgUrl from '@/assets/images/car-bg.png';

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

    async initCanvas() {
      const wrapper = this.$refs.canvasWrapper;
      if (!wrapper) return;

      const width = wrapper.clientWidth;
      const height = wrapper.clientHeight;

      this.canvas = new Canvas(this.$refs.canvas, {
        width,
        height,
        backgroundColor: '#f8f9fa',
        selection: false, // 禁用框选，因为我们只看图
      });
      
      try {
        // 并行加载背景图和SVG
        const [bgImage, parkingGroup] = await Promise.all([
          this.loadBackgroundImage(),
          this.loadSVG()
        ]);

        if (bgImage) {
          bgImage.set({
            left: 0,
            top: 0,
            originX: 'left',
            originY: 'top',
            selectable: false,
            evented: false,
          });
          this.canvas.add(bgImage);
        }

        if (parkingGroup) {
          parkingGroup.set({
            left: 0,
            top: 0,
            originX: 'left',
            originY: 'top',
            selectable: false,
            evented: false,
          });
          this.canvas.add(parkingGroup);
        }

        // 调整视图以适应内容（以背景图为准，如果没有则以SVG为准）
        const targetObj = bgImage || parkingGroup;
        if (targetObj) {
          this.fitContentToScreen(targetObj);
        }
      } catch (e) {
        console.error('Initialization error:', e);
      }

      // 绑定缩放平移事件
      this.bindEvents();
    },

    fitContentToScreen(object) {
      if (!object) return;
      const canvasWidth = this.canvas.width;
      const canvasHeight = this.canvas.height;
      const objectWidth = object.width;
      const objectHeight = object.height;

      // 计算适合的缩放比例
      const scaleX = (canvasWidth * 0.95) / objectWidth;
      const scaleY = (canvasHeight * 0.95) / objectHeight;
      const scale = Math.min(scaleX, scaleY);

      // 计算居中偏移
      const panX = (canvasWidth - objectWidth * scale) / 2;
      const panY = (canvasHeight - objectHeight * scale) / 2;

      // 设置视口变换：[scaleX, skewX, skewY, scaleY, translateX, translateY]
      this.canvas.setViewportTransform([scale, 0, 0, scale, panX, panY]);
      
      this.zoom = scale;
      this.canvas.requestRenderAll();
    },

    async loadBackgroundImage() {
      console.log('Loading background image from:', carBgUrl);
      try {
        const img = new Image();
        img.src = carBgUrl;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        const fabricImage = new FabricImage(img, {
          opacity: 1, 
        });
        
        console.log('Background image loaded');
        return fabricImage;
      } catch (error) {
        console.error('Error loading background image:', error);
        return null;
      }
    },

    async loadSVG() {
      console.log('Loading SVG from:', parkingSvgUrl);
      try {
        const { objects, options } = await loadSVGFromURL(parkingSvgUrl);
        
        if (objects && objects.length > 0) {
            const parkingGroup = util.groupSVGElements(objects, options);
            console.log('SVG loaded successfully');
            return parkingGroup;
        }
        return null;
      } catch (error) {
          console.error('Error loading SVG:', error);
          return null;
      }
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
