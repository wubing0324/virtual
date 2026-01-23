<template>
  <div class="parking-dom-page">
    <div class="controls">
      <button @click="$router.push('/')">返回首页</button>
      <div class="zoom-control">
        <label>缩放: {{ zoom.toFixed(1) }}x</label>
        <input type="range" min="0.5" max="5" step="0.1" v-model.number="zoom" />
      </div>
      <div class="anim-control">
        <button @click="playAnimation">播放进场动画</button>
      </div>
    </div>

    <div class="viewport">
      <div class="canvas-container" :style="containerStyle">
        <!-- 底图 -->
        <img :src="carBgUrl" class="bg-image" />
        
        <!-- 车位 DOM 元素 -->
        <div 
          v-for="(space, index) in spaces" 
          :key="space.id"
          class="parking-space"
          :class="{ 'animate-enter': animate }"
          :style="getSpaceStyle(space, index)"
        >
          <svg 
            :viewBox="`0 0 ${space.width} ${space.height}`"
            width="100%" 
            height="100%"
            style="overflow: visible;"
          >
            <path 
              :d="space.d" 
              fill="rgba(34, 197, 94, 0.4)" 
              stroke="#166534" 
              stroke-width="1"
              vector-effect="non-scaling-stroke"
            />
          </svg>
          <div class="space-label" v-if="zoom > 1.5">{{ index + 1 }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// 使用 Fabric 仅作为解析器，不渲染 Canvas
import { loadSVGFromURL } from 'fabric';
import parkingSvgUrl from '@/assets/const/aaaa.svg';
import carBgUrl from '@/assets/images/car-bg.png';

export default {
  name: 'ParkingDom',
  data() {
    return {
      carBgUrl,
      zoom: 1,
      spaces: [],
      containerWidth: 800, // Default from SVG
      containerHeight: 528, // Default from SVG
      animate: false,
    };
  },
  computed: {
    containerStyle() {
      return {
        width: `${this.containerWidth}px`,
        height: `${this.containerHeight}px`,
        transform: `scale(${this.zoom})`,
        transformOrigin: 'top left',
      };
    },
  },
  async mounted() {
    await this.loadAndParseSVG();
    // 自动播放动画
    setTimeout(() => {
      this.playAnimation();
    }, 500);
  },
  methods: {
    async loadAndParseSVG() {
      console.log('Loading SVG from:', parkingSvgUrl);
      try {
        const { objects, options } = await loadSVGFromURL(parkingSvgUrl);
        console.log('SVG loaded with options:', options);
        console.log('SVG loaded with objects:', objects);
        // 更新容器尺寸以匹配 SVG 视口
        if (options.width && options.height) {
          this.containerWidth = options.width;
          this.containerHeight = options.height;
        }

        // 解析对象
        const spaces = [];
        let idCounter = 0;

        // 过滤并处理对象
        objects.forEach(obj => {
          if (!obj.visible) return;
          // 过滤掉太大的背景线框或太小的噪点
          // 这里的阈值需要根据实际情况调整，假设车位是大致矩形
          // 也可以根据 path 闭合属性等判断，但在 Fabric 中 path 通常就是 path array
          // 简单起见，渲染所有非极端的 Path 对象
          
          if (obj.type === 'path' || obj.type === 'polygon' || obj.type === 'polyline') {
             // 简单的尺寸过滤
             if (obj.width < 5 || obj.height < 5) return; // 太小
             if (obj.width > this.containerWidth * 0.9) return; // 基本是背景框

             // Fabric 的 path 属性是绝对坐标数组（如果是 Path 对象）
             // 但是 obj.left / obj.top 已经是 bounding box 的左上角
             // 我们需要生成相对于 bounding box 左上角的 path string
             
             // 如果是 simple shape, use shape properties
             // 如果是 Path, reconstructing 'd' string from obj.path array shifted by (-left, -top)
             
             let relativeD = '';
             
             if (obj.type === 'path') {
                // obj.path 是 [['M', x, y], ['L', x, y], ...]
                // Fabric 解析后 obj.path 里的坐标通常是相对于对象中心的？或者绝对的？
                // 验证发现：Fabric 在对象创建时会计算 bounding box，并将 left/top 设为 bbox 左上角 (default w/o origin settings)
                // 它的 path 数据通常是相对于自身的中心 (0,0 在中心) 或者是绝对坐标但有个 pathOffset
                // 参考 Fabric 源码，path array 保持原始命令，drawing 时应用 transform
                // 最稳妥的方法：利用 bounding box
                
                // Let's manually shift points.
                // Note: Fabric normalizes paths. Let's try to construct a relative path string 
                // assuming obj.path coordinates are "raw" but `left/top` places them on canvas.
                // Actually, fabric stores pathOffset. 
                // Absolute coordinate = Point_in_path - pathOffset + (left + width/2, top + height/2)? NO.
                
                // Simpler specific hack for simple CAD imports:
                // Just use the absolute path coordinates from file directly?
                // obj.path contains the commands.
                // We calculate the bbox of these points ourselves to be sure.
                
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                const points = [];
                
                obj.path.forEach(cmd => {
                   // cmd[0] is command letter
                   // Look for coordinate pairs. Usually they are at indices 1,2 or 1,2,3,4 etc.
                   // CAD mostly M and L.
                   for (let i = 1; i < cmd.length; i+=2) {
                      const x = cmd[i];
                      const y = cmd[i+1];
                      if (typeof x === 'number' && typeof y === 'number') {
                         points.push({x, y});
                         if (x < minX) minX = x;
                         if (y < minY) minY = y;
                         if (x > maxX) maxX = x;
                         if (y > maxY) maxY = y;
                      }
                   }
                });
                
                if (points.length === 0) return; // Z command only?

                const w = maxX - minX;
                const h = maxY - minY;
                
                // Reconstruct d string relative to (minX, minY)
                // 这确保 d 从 (0,0) 开始，适配我们的 absolute div
                relativeD = obj.path.map(cmd => {
                   const newCmd = [cmd[0]];
                   for (let i = 1; i < cmd.length; i+=2) {
                      newCmd.push((cmd[i] - minX).toFixed(2));
                      newCmd.push((cmd[i+1] - minY).toFixed(2));
                   }
                   return newCmd.join(' ');
                }).join(' ');
                
                spaces.push({
                   id: idCounter++,
                   left: minX,
                   top: minY,
                   width: w,
                   height: h,
                   d: relativeD,
                   // animation index for stagger
                   animIndex: idCounter
                });
             }
          }
        });

        this.spaces = Object.freeze(spaces); // 冻结大数据以优化性能
        console.log(`Parsed ${spaces.length} spaces`);

      } catch (error) {
        console.error('Error loading SVG:', error);
      }
    },
    getSpaceStyle(space, index) {
      return {
        left: `${space.left}px`,
        top: `${space.top}px`,
        width: `${space.width}px`,
        height: `${space.height}px`,
        // 动画延迟
        '--delay': `${index * 20}ms`
      };
    },
    playAnimation() {
      this.animate = false;
      // 强制重绘
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.animate = true;
        });
      });
    },
  },
};
</script>

<style scoped>
.parking-dom-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: #1e1e1e;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.controls {
  padding: 10px 20px;
  background: #2d2d2d;
  color: white;
  display: flex;
  gap: 20px;
  align-items: center;
  z-index: 10;
  box-shadow: 0 2px 5px rgba(0,0,0,0.5);
}

.controls button {
  padding: 6px 12px;
  background: #4CAF50;
  border: none;
  color: white;
  border-radius: 4px;
  cursor: pointer;
}

.controls button:hover {
  background: #45a049;
}

.viewport {
  flex: 1;
  overflow: auto;
  position: relative;
  background: #111;
  display: flex;
  justify-content: center; /* Center content initially */
  align-items: center;
}

.canvas-container {
  position: relative;
  /* 确保缩放中心在左上角，配合 viewport 滚动 */
  transform-origin: 0 0;
  margin: 50px; /* Give some breathing room */
  background: white; /* 调试用，实际被图片覆盖 */
  transition: transform 0.1s linear; /* Smooth zoom */
}

.bg-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: fill; /* 强制拉伸以匹配容器（SVG）比例 */
  opacity: 0.5; /* 半透明以便看清上面的车位 */
  pointer-events: none;
}

.parking-space {
  position: absolute;
  /* 初始不可见，等待动画 */
  opacity: 0; 
  transform: scale(0.5);
  transition: opacity 0.5s ease-out, transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

/* 动画触发类 */
.parking-space.animate-enter {
  opacity: 1;
  transform: scale(1);
  transition-delay: var(--delay); /* 使用 CSS 变量实现交错动画 */
}

.parking-space:hover {
  z-index: 100;
  filter: drop-shadow(0 0 5px rgba(34, 197, 94, 0.8));
}

.parking-space path {
  transition: fill 0.3s;
}

.parking-space:hover path {
  fill: rgba(34, 197, 94, 0.8);
}

.space-label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 10px;
  color: white;
  pointer-events: none;
  text-shadow: 0 1px 2px black;
}
</style>
