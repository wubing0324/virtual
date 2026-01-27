<template>
  <div class="parking-obb-container">
    <div class="header">
      <h2>OBB Result Visualization</h2>
      <div class="controls">
        <label>
          <input type="checkbox" v-model="showLabels"> Show Labels
        </label>
        <div class="stats">
          Total Boxes: {{ totalBoxes }}
        </div>
      </div>
    </div>
    
    <div class="canvas-wrapper" ref="wrapper">
      <svg 
        v-if="viewBox"
        :viewBox="viewBox" 
        class="obb-svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <!-- Background/Border for context -->
        <!-- Background Image -->
        <image 
          v-if="bgImage"
          :href="bgImage"
          x="0" 
          y="0" 
          :width="canvasWidth" 
          :height="canvasHeight"
        />
        <rect 
          v-else
          :width="canvasWidth" 
          :height="canvasHeight" 
          fill="#f8f9fa" 
          stroke="#ddd" 
          stroke-width="2"
        />

        <g v-for="(box, index) in allBoxes" :key="index" class="box-group">
          <!-- Main Polygon -->
          <polygon
            :points="getPoints(box.xyxyxyxy)"
            class="box-polygon"
            :class="{ 'high-conf': box.confidence > 0.8 }"
            @mouseenter="hoveredBox = box"
            @mouseleave="hoveredBox = null"
          />
          
          <!-- Direction Indicator (First two points usually verify orientation) -->
          <line
            :x1="box.xyxyxyxy[0][0]"
            :y1="box.xyxyxyxy[0][1]"
            :x2="box.xyxyxyxy[1][0]"
            :y2="box.xyxyxyxy[1][1]"
            stroke="red"
            stroke-width="2"
            v-if="hoveredBox === box"
          />

          <!-- Label -->
          <text
            v-if="showLabels || hoveredBox === box"
            :x="box.xywhr.center_x"
            :y="box.xywhr.center_y"
            class="box-label"
            text-anchor="middle"
            dominant-baseline="middle"
            :transform="`rotate(${box.xywhr.angle_deg}, ${box.xywhr.center_x}, ${box.xywhr.center_y})`"
          >
            {{ box.name }}
          </text>
        </g>
      </svg>
      
      <!-- Floating Info Card -->
      <div v-if="hoveredBox" class="info-card" :style="infoCardStyle">
        <h4>{{ hoveredBox.name }}</h4>
        <p><strong>Conf:</strong> {{ (hoveredBox.confidence * 100).toFixed(1) }}%</p>
        <p><strong>Angle:</strong> {{ hoveredBox.angle_deg.toFixed(2) }}°</p>
        <p><strong>Center:</strong> ({{ hoveredBox.xywhr.center_x.toFixed(0) }}, {{ hoveredBox.xywhr.center_y.toFixed(0) }})</p>
        <p><strong>Size:</strong> {{ hoveredBox.xywhr.width.toFixed(0) }} x {{ hoveredBox.xywhr.height.toFixed(0) }}</p>
      </div>
    </div>
  </div>
</template>

<script>
import obbData from '@/assets/const/obb-result-2026-01-26-06-59-28.json';
import bgImage from '@/assets/1.png';

export default {
  name: 'ParkingOBB',
  data() {
    return {
      rawData: obbData,
      bgImage,
      imgWidth: 0,
      imgHeight: 0,
      showLabels: true,
      hoveredBox: null,
      wrapperRect: null,
      mouseX: 0,
      mouseY: 0,
    };
  },
  computed: {
    // Flatten boxes from all items in the array (assuming it might be a batch, or usually just one)
    allBoxes() {
      if (Array.isArray(this.rawData)) {
        return this.rawData.flatMap(item => item.boxes || []);
      }
      return [];
    },
    totalBoxes() {
      return this.allBoxes.length;
    },
    // Calculate bounding box of all polygons to set viewBox
    bounds() {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      this.allBoxes.forEach(box => {
        box.xyxyxyxy.forEach(point => {
          const [x, y] = point;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        });
      });

      // Add some padding
      const padding = 50;
      return {
        minX: Math.max(0, minX - padding),
        minY: Math.max(0, minY - padding),
        maxX: maxX + padding,
        maxY: maxY + padding
      };
    },
    canvasWidth() {
      return this.imgWidth > 0 ? this.imgWidth : this.bounds.maxX;
    },
    canvasHeight() {
      return this.imgHeight > 0 ? this.imgHeight : this.bounds.maxY;
    },
    viewBox() {
      if (this.imgWidth > 0 && this.imgHeight > 0) {
        return `0 0 ${this.imgWidth} ${this.imgHeight}`;
      }
      if (this.totalBoxes === 0) return '0 0 1000 1000';
      const { minX, minY, maxX, maxY } = this.bounds;
      return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
    },
    infoCardStyle() {
      // Position tooltip near mouse
      return {
        top: `${this.mouseY + 20}px`,
        left: `${this.mouseX + 20}px`
      };
    }
  },
  mounted() {
    window.addEventListener('mousemove', this.updateMouse);
    this.loadImage();
  },
  beforeDestroy() {
    window.removeEventListener('mousemove', this.updateMouse);
  },
  methods: {
    loadImage() {
        const img = new Image();
        img.src = this.bgImage;
        img.onload = () => {
            this.imgWidth = img.naturalWidth;
            this.imgHeight = img.naturalHeight;
        };
    },
    getPoints(pointsArray) {
      return pointsArray.map(p => p.join(',')).join(' ');
    },
    updateMouse(e) {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    }
  }
};
</script>

<style scoped>
.parking-obb-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f0f2f5;
  font-family: 'Inter', sans-serif;
}

.header {
  padding: 16px 24px;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 10;
}

.header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a1a1a;
}

.controls {
  display: flex;
  gap: 20px;
  align-items: center;
}

.stats {
  font-size: 0.9rem;
  color: #666;
  background: #f5f5f5;
  padding: 4px 12px;
  border-radius: 12px;
}

.canvas-wrapper {
  flex: 1;
  overflow: auto;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.obb-svg {
  max-width: 100%;
  max-height: 100%;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  background: white;
  border-radius: 8px;
}

.box-polygon {
  fill: rgba(33, 150, 243, 0.15);
  stroke: #2196F3;
  stroke-width: 2;
  transition: all 0.2s ease;
  cursor: pointer;
}

.box-polygon:hover {
  fill: rgba(33, 150, 243, 0.4);
  stroke-width: 3;
}

.box-polygon.high-conf {
  stroke: #00C853; /* Green for high confidence */
  fill: rgba(0, 200, 83, 0.15);
}

.box-polygon.high-conf:hover {
  fill: rgba(0, 200, 83, 0.4);
}

.box-label {
  font-size: 14px;
  fill: #333;
  font-weight: 500;
  pointer-events: none;
  text-shadow: 0 1px 2px white;
}

.info-card {
  position: fixed;
  background: rgba(0, 0, 0, 0.85);
  color: white;
  padding: 12px;
  border-radius: 8px;
  pointer-events: none;
  font-size: 0.85rem;
  z-index: 100;
  backdrop-filter: blur(4px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.info-card h4 {
  margin: 0 0 8px 0;
  color: #4fc3f7;
}

.info-card p {
  margin: 4px 0;
}
</style>
