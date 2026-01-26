<template>
  <div class="parking-json-page">
    <div class="controls">
      <button @click="$router.push('/')">返回首页</button>
      <div class="zoom-control">
        <label>缩放: {{ zoom.toFixed(1) }}x</label>
        <input type="range" min="0.5" max="5" step="0.1" v-model.number="zoom" />
      </div>
      <div class="data-status">
        {{ parkingSpaces.length }} 个车位已加载
      </div>
    </div>

    <div class="viewport">
      <div class="canvas-container" :style="containerStyle">
        <!-- 底图 -->
        <img :src="carBgUrl" class="bg-image" />
        
        <!-- JSON 数据绘制层 -->
        <div class="parking-layer">
          <svg class="parking-svg-overlay" :width="mapWidth" :height="mapHeight">
             <path 
               v-for="space in parkingSpaces" 
               :key="'path-' + space.id"
               :d="space.path"
               fill="none"
               stroke="red"
               stroke-width="1"
             />
          </svg>


        </div>
      </div>
    </div>
  </div>
</template>

<script>
import parkingGeoJson from '@/assets/const/aaaa停车场.json';
import carBgUrl from '@/assets/images/car-bg.png';

export default {
  name: 'ParkingJson',
  data() {
    return {
      carBgUrl,
      zoom: 1,
      // 使用包含几何信息的 GeoJSON 文件
      // 用户提及的 'aaaa停车场222.json' 仅包含属性无坐标，故自动回退到此文件
      rawGeoJson: parkingGeoJson, 
      parkingSpaces: [],
      mapWidth: 800,
      mapHeight: 528,
      loading: true,
    };
  },
  computed: {
    containerStyle() {
      return {
        width: `${this.mapWidth}px`,
        height: `${this.mapHeight}px`,
        transform: `scale(${this.zoom})`,
        transformOrigin: 'top left',
      };
    },
  },
  mounted() {
    // 延迟一点加载以保证非阻塞
    setTimeout(() => {
      this.parseAndGenerateSpaces();
    }, 100);
  },
  methods: {
    parseAndGenerateSpaces() {
      console.time('GeoJSON Processing');
      const features = this.rawGeoJson.features;
      
      // 1. 过滤出车位数据 (Layer = A-PKNG-TSRP)
      // 如果没有找到特定图层，则使用所有 LineString
      let targetFeatures = features.filter(f => 
        f.properties && f.properties.layer === 'A-PKNG-TSRP'
      );
      
      if (targetFeatures.length === 0) {
        targetFeatures = features;
      }

      console.log(`Found ${targetFeatures.length} features`);

      // 2. 计算包围盒 (Bounding Box) 以便归一化坐标
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      // 预处理坐标并计算最值
      // 注意：GeoJSON 坐标通常是 [x, y]
      // CAD 导出可能 y 轴方向与屏幕相反，需要后续处理
      targetFeatures.forEach(feature => {
        if (!feature.geometry || !feature.geometry.coordinates) return;
        const coords = feature.geometry.coordinates; // LineString: [[x,y],...]
        
        // 扁平化多维数组处理 MultiLineString 或 Polygon
        const flatCoords = feature.geometry.type === 'LineString' ? coords : coords.flat();
        
        flatCoords.forEach(pt => {
          // 容错处理 pt 可能是 [x,y] 或 x (如果递归不对)
          if (Array.isArray(pt)) {
             const [x, y] = pt;
             if (x < minX) minX = x;
             if (x > maxX) maxX = x;
             if (y < minY) minY = y;
             if (y > maxY) maxY = y;
          }
        });
      });

      // 3. 计算缩放比例，适应 mapWidth/mapHeight
      const dataWidth = maxX - minX;
      const dataHeight = maxY - minY;
      
      // 保持长宽比
      const scaleX = this.mapWidth / dataWidth;
      const scaleY = this.mapHeight / dataHeight;
      const scale = Math.min(scaleX, scaleY) * 0.95; // 留白 5%

      // 居中偏移
      const offsetX = (this.mapWidth - dataWidth * scale) / 2;
      const offsetY = (this.mapHeight - dataHeight * scale) / 2;

      // 4. 生成车位对象
      this.parkingSpaces = targetFeatures.map((f, index) => {
        if (!f.geometry || !f.geometry.coordinates) return null;
        
        const coords = f.geometry.coordinates;
        // 构建 SVG Path 命令
        // 注意：SVG 坐标系 y 轴向下，CAD 通常 y 轴向上。
        // 如果发现倒置，需要用 (maxY - y) 或类似 flipping
        // 这里先假设直接映射，如果倒是反的再改
        
        // 转换函数
        const transform = ([x, y]) => {
           // 简单的线性变换: (x - minX) * scale + offsetX
           // 对于 Y 轴，如果 SVG 和 GeoJSON 方向一致 (Y down vs Y up)
           // GeoJSON (GIS/CAD) usually Y is Up (North). SVG Y is Down.
           // So we probably need to flip Y: (maxY - y) * scale ...
           // Let's try standard Y-up to Y-down flip.
           const sx = (x - minX) * scale + offsetX;
           const sy = (maxY - y) * scale + offsetY; // Flip Y
           return `${sx.toFixed(1)} ${sy.toFixed(1)}`;
        };

        const pathData = coords.map((pt, i) => {
           if (!Array.isArray(pt)) return '';
           const prefix = i === 0 ? 'M' : 'L';
           return `${prefix} ${transform(pt)}`;
        }).join(' ');

        // 计算中心点用于显示文字
        // 简单取第一个点
        const firstPt = coords[0];
        const cx = (firstPt[0] - minX) * scale + offsetX;
        const cy = (maxY - firstPt[1]) * scale + offsetY;

        // 随机属性
        const isNewEnergy = Math.random() > 0.7;
        
        return {
          id: f.properties.handle || index,
          number: `P${f.properties.handle || index}`,
          path: pathData, 
          // 存储中心点用于定位绝对定位元素(如车牌)
          cx,
          cy,
          rotation: 0,
          type: isNewEnergy ? 'green-plate' : 'blue-plate',
          properties: f.properties
        };
      }).filter(Boolean);

      this.loading = false;
      console.timeEnd('GeoJSON Processing');
    },

  },
};
</script>

<style scoped>
.parking-json-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f0f2f5;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.controls {
  padding: 12px 24px;
  background: white;
  display: flex;
  gap: 20px;
  align-items: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  z-index: 10;
}

.controls button {
  padding: 8px 16px;
  background: #1890ff;
  border: none;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.3s;
}

.controls button:hover {
  background: #40a9ff;
}

.viewport {
  flex: 1;
  overflow: auto;
  position: relative;
  display: flex;
  justify-content: center;
  padding: 40px;
  background-image: radial-gradient(#e1e1e1 1px, transparent 1px);
  background-size: 20px 20px;
}

.canvas-container {
  position: relative;
  background: white;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  transition: transform 0.1s linear;
}

.bg-image {
  width: 100%;
  height: 100%;
  object-fit: fill;
  opacity: 1; /* 降低底图不透明度，突出车位 */
  pointer-events: none;
}

.parking-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.parking-svg-overlay {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none; /* 让鼠标事件穿透到下面的标签 */
}



.data-status {
  margin-left: auto;
  font-size: 12px;
  color: #666;
}
</style>
