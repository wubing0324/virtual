<template>
  <div class="canvas-area">
    <div class="area-header">画布区域 (A区)</div>
    <div ref="canvasContainer" class="canvas-container">
      <canvas ref="fabricCanvas" class="fabric-canvas"></canvas>
    </div>
  </div>
</template>

<script>
import { Canvas, Rect, Circle, Triangle, Line, Text } from 'fabric';

export default {
  name: 'CanvasArea',
  data() {
    return {
      canvas: null,
      backgroundImageLoaded: false,
      imageWidth: 0,
      imageHeight: 0,
      backgroundImage: null,
      containerRef: null,
    };
  },
  computed: {
    imageUrl() {
      return this.$store.state.uploadedImage;
    },
  },
  watch: {
    imageUrl: {
      immediate: false,
      handler(newUrl) {
        if (newUrl && this.canvas) {
          this.loadImageFromUrl(newUrl);
        }
      },
    },
  },
  mounted() {
    this.initCanvas();
  },
  beforeDestroy() {
    // 清理窗口事件监听器
    window.removeEventListener('resize', this.handleResize);
    
    // 清理容器事件监听器
    if (this.containerRef) {
      this.containerRef.removeEventListener('dragover', this.handleDragOver);
      this.containerRef.removeEventListener('drop', this.handleDrop);
    }
    
    // 清理画布事件监听器
    if (this.canvas) {
      this.canvas.off('selection:created', this.handleSelection);
      this.canvas.off('selection:updated', this.handleSelection);
      this.canvas.off('selection:cleared', this.handleSelectionCleared);
      this.canvas.off('object:modified', this.handleObjectModified);
      this.canvas.dispose();
    }
  },
  methods: {
    async initCanvas() {
      await this.$nextTick();
      const canvasEl = this.$refs.fabricCanvas;
      const container = this.$refs.canvasContainer;
      
      if (!canvasEl || !container) return;
      
      // 初始化画布，使用容器尺寸（如果没有图片）
      this.canvas = new Canvas(canvasEl, {
        width: container.clientWidth || 800,
        height: container.clientHeight || 600,
        backgroundColor: '#f5f5f5',
      });
      
      // 如果有传入的图片URL，加载它
      if (this.imageUrl) {
        await this.loadImageFromUrl(this.imageUrl);
      }

      // 监听画布大小变化（仅在背景图片未加载时调整）
      window.addEventListener('resize', this.handleResize);

      // 监听对象选择
      this.canvas.on('selection:created', this.handleSelection);
      this.canvas.on('selection:updated', this.handleSelection);
      this.canvas.on('selection:cleared', this.handleSelectionCleared);

      // 监听对象修改
      this.canvas.on('object:modified', this.handleObjectModified);

      // 监听拖拽放置
      container.addEventListener('dragover', this.handleDragOver);
      container.addEventListener('drop', this.handleDrop);

      // 保存容器引用，用于清理
      this.containerRef = container;

      // 将 canvas 实例传递给父组件
      this.$emit('canvas-ready', this.canvas);
    },
    handleResize() {
      // 如果背景图片已加载，保持图片尺寸，不随容器变化
      if (this.backgroundImageLoaded && this.imageWidth && this.imageHeight) {
        return;
      }
      
      const container = this.$refs.canvasContainer;
      if (this.canvas && container) {
        this.canvas.setDimensions({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      }
    },
    handleDragOver(event) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    },
    handleDrop(event) {
      event.preventDefault();
      event.stopPropagation();
      
      const shapeData = event.dataTransfer.getData('application/json');
      if (!shapeData || !this.canvas) return;

      try {
        const shape = JSON.parse(shapeData);
        const container = this.$refs.canvasContainer;
        const rect = container.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        this.createShape(shape.type, x, y);
      } catch (e) {
        console.error('Failed to parse shape data:', e);
      }
    },
    createShape(type, x, y) {
      let fabricObject;
      const defaultSize = 100;
      const defaultColor = `#${Math.floor(Math.random() * 16777215).toString(16)}`;

      switch (type) {
        case 'rect':
          fabricObject = new Rect({
            left: x - defaultSize / 2,
            top: y - defaultSize / 2,
            width: defaultSize,
            height: defaultSize,
            fill: defaultColor,
            stroke: '#333',
            strokeWidth: 2,
          });
          break;
        case 'circle':
          fabricObject = new Circle({
            left: x - defaultSize / 2,
            top: y - defaultSize / 2,
            radius: defaultSize / 2,
            fill: defaultColor,
            stroke: '#333',
            strokeWidth: 2,
          });
          break;
        case 'triangle':
          fabricObject = new Triangle({
            left: x - defaultSize / 2,
            top: y - defaultSize / 2,
            width: defaultSize,
            height: defaultSize,
            fill: defaultColor,
            stroke: '#333',
            strokeWidth: 2,
          });
          break;
        case 'line':
          fabricObject = new Line([x - defaultSize / 2, y, x + defaultSize / 2, y], {
            stroke: defaultColor,
            strokeWidth: 3,
            selectable: true,
          });
          break;
        case 'text':
          fabricObject = new Text('文本', {
            left: x,
            top: y,
            fontSize: 30,
            fill: defaultColor,
            fontFamily: 'Arial',
          });
          break;
        default:
          return;
      }

      // 添加唯一ID和位置信息
      fabricObject.set({
        id: `shape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        originX: 'center',
        originY: 'center',
      });

      this.canvas.add(fabricObject);
      this.canvas.setActiveObject(fabricObject);
      this.canvas.renderAll();
    },
    handleSelection(e) {
      if (!this.canvas) return;
      const activeObject = e?.selected?.[0] || this.canvas.getActiveObject();
      if (activeObject) {
        const selectedData = {
          id: activeObject.id,
          left: Math.round(activeObject.left),
          top: Math.round(activeObject.top),
          width: Math.round((activeObject.width || 0) * (activeObject.scaleX || 1)),
          height: Math.round((activeObject.height || 0) * (activeObject.scaleY || 1)),
          angle: Math.round(activeObject.angle || 0),
          fill: activeObject.fill || '#000000',
          parkingNumber: activeObject.parkingNumber || null, // 车位号
          fabricObject: activeObject,
        };
        this.$emit('object-selected', selectedData);
      }
    },
    handleSelectionCleared() {
      this.$emit('selection-cleared');
    },
    handleObjectModified(e) {
      const obj = e.target;
      const updatedData = {
        left: Math.round(obj.left),
        top: Math.round(obj.top),
        width: Math.round(obj.width * obj.scaleX),
        height: Math.round(obj.height * obj.scaleY),
        angle: Math.round(obj.angle),
      };
      this.$emit('object-modified', updatedData);
    },
    // 从 URL 加载图片
    async loadImageFromUrl(imageUrl) {
      try {
        // 确保画布已初始化
        if (!this.canvas) {
          console.warn('画布未初始化，等待初始化完成...');
          await this.$nextTick();
          // 如果还是没有，尝试初始化
          if (!this.canvas) {
            await this.initCanvas();
          }
        }

        const img = new Image();
        img.crossOrigin = 'anonymous'; // 允许跨域
        
        await new Promise((resolve, reject) => {
          img.onload = () => {
            console.log('图片加载成功，尺寸:', img.width, 'x', img.height);
            resolve();
          };
          img.onerror = (error) => {
            console.error('图片加载失败:', error);
            reject(error);
          };
          img.src = imageUrl;
        });

        // 确保画布存在后再加载背景
        if (this.canvas) {
          await this.loadBackgroundImage(img);
        } else {
          console.error('画布仍未初始化，无法加载图片');
        }
      } catch (error) {
        console.error('从URL加载图片失败:', error);
        alert('图片加载失败: ' + error.message);
      }
    },
    async loadBackgroundImage(img) {
      try {
        if (!img || !this.canvas) {
          console.error('图片或画布未准备好');
          return;
        }

        console.log('开始设置背景图片，图片尺寸:', img.width, 'x', img.height);

        // 确保画布尺寸完全匹配图片尺寸
        this.canvas.setDimensions({
          width: img.width,
          height: img.height,
        });

        console.log('画布尺寸已设置为:', this.canvas.width, 'x', this.canvas.height);

        // 使用 Fabric.js Image 对象设置背景图片
        const { Image: FabricImage } = require('fabric');
        
        // 创建 Fabric Image 对象，尺寸完全匹配图片
        const fabricImage = new FabricImage(img, {
          left: 0,
          top: 0,
          originX: 'left',
          originY: 'top',
          scaleX: 1,
          scaleY: 1,
          selectable: false,
          evented: false,
          excludeFromExport: false,
        });

        // 确保图片对象尺寸正确，并且原点在左上角
        fabricImage.set({
          width: img.width,
          height: img.height,
          left: 0,
          top: 0,
          originX: 'left',
          originY: 'top',
        });

        // 保存背景图片引用，方便后续操作
        this.backgroundImage = fabricImage;
        
        // 将图片添加为背景（最底层）
        // 先保存现有对象（如果有的话）
        const existingObjects = this.canvas.getObjects().slice();
        
        // 清空画布
        this.canvas.clear();
        
        // 先添加背景图片
        this.canvas.add(fabricImage);
        
        // 再添加其他对象（如果有）
        existingObjects.forEach(obj => {
          if (obj !== fabricImage) {
            this.canvas.add(obj);
          }
        });
        
        // 确保图片位置正确（左上角对齐）
        fabricImage.set({
          left: 0,
          top: 0,
          originX: 'left',
          originY: 'top',
        });
        
        // 保存图片尺寸
        this.imageWidth = img.width;
        this.imageHeight = img.height;
        
        this.canvas.renderAll();
        console.log('背景图片设置完成，画布尺寸:', this.canvas.width, 'x', this.canvas.height);
        console.log('背景图片对象尺寸:', fabricImage.width, 'x', fabricImage.height);
        
        // 标记背景图片已加载
        this.backgroundImageLoaded = true;
      } catch (error) {
        console.error('背景图片加载失败:', error);
      }
    },
  },
};
</script>

<style scoped>
.canvas-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 2px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  background: white;
}

.area-header {
  padding: 15px;
  background: #f8f9fa;
  border-bottom: 1px solid #ddd;
  font-weight: bold;
  font-size: 16px;
}

.canvas-container {
  flex: 1;
  position: relative;
  overflow: auto;
  background: #f5f5f5;
  min-width: 0;
  min-height: 0;
}

.fabric-canvas {
  display: block;
  /* 确保画布不被缩放 */
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
}
</style>