<template>
  <div class="parking-recognizer">
    <button @click="startRecognition" :disabled="isProcessing" class="recognize-btn">
      {{ isProcessing ? '识别中...' : '开始识别车位' }}
    </button>
    <div v-if="parkingSpaces.length > 0" class="results-info">
      已识别 {{ parkingSpaces.length }} 个车位
    </div>
    <!-- 隐藏的 canvas 用于图像处理 -->
    <canvas ref="imageCanvas" style="display: none;"></canvas>
  </div>
</template>

<script>
import Tesseract from 'tesseract.js';

let cv = null;

export default {
  name: 'ParkingSpaceRecognizer',
  data() {
    return {
      image: null,
      imageCanvas: null,
      imageCtx: null,
      isProcessing: false,
      parkingSpaces: [],
      opencvLoaded: false,
    };
  },
  async mounted() {
    await this.loadImage();
    await this.loadOpenCV();
  },
  methods: {
    async loadOpenCV() {
      // 直接使用 CDN 方式加载，避免 webpack 打包问题
      return new Promise((resolve, reject) => {
        if (window.cv) {
          cv = window.cv;
          if (cv.onRuntimeInitialized) {
            cv.onRuntimeInitialized = () => {
              console.log('OpenCV.js 加载完成');
              this.opencvLoaded = true;
              resolve();
            };
          } else {
            this.opencvLoaded = true;
            resolve();
          }
          return;
        }

        // 检查是否已经加载过脚本
        const existingScript = document.querySelector('script[src*="opencv.js"]');
        if (existingScript) {
          existingScript.addEventListener('load', () => {
            cv = window.cv;
            if (cv.onRuntimeInitialized) {
              cv.onRuntimeInitialized = () => {
                console.log('OpenCV.js 加载完成');
                this.opencvLoaded = true;
                resolve();
              };
            } else {
              this.opencvLoaded = true;
              resolve();
            }
          });
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://docs.opencv.org/4.x/opencv.js';
        script.async = true;
        script.onload = () => {
          cv = window.cv;
          if (cv.onRuntimeInitialized) {
            cv.onRuntimeInitialized = () => {
              console.log('OpenCV.js 加载完成');
              this.opencvLoaded = true;
              resolve();
            };
          } else {
            this.opencvLoaded = true;
            resolve();
          }
        };
        script.onerror = () => {
          console.error('OpenCV.js 加载失败');
          reject(new Error('OpenCV.js 加载失败'));
        };
        document.head.appendChild(script);
      });
    },
    async loadImage() {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = require('@/assets/Group2118723994.png');
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        this.image = img;
        this.imageCanvas = this.$refs.imageCanvas;
        this.imageCtx = this.imageCanvas.getContext('2d');

        // 设置画布尺寸
        this.imageCanvas.width = img.width;
        this.imageCanvas.height = img.height;

        // 绘制图片
        this.imageCtx.drawImage(img, 0, 0);
      } catch (error) {
        console.error('图片加载失败:', error);
      }
    },
    async startRecognition() {
      if (!this.image) {
        alert('图片未加载');
        return;
      }

      if (!this.opencvLoaded || !cv || !cv.imread) {
        alert('OpenCV 未加载，请稍候再试');
        await this.loadOpenCV();
        if (!cv || !cv.imread) {
          alert('OpenCV 加载失败，请刷新页面重试');
          return;
        }
      }

      this.isProcessing = true;
      this.parkingSpaces = [];

      try {
        // 读取图片到 OpenCV Mat
        const src = cv.imread(this.imageCanvas);
        const gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        // 使用 Canny 边缘检测，更好地检测车位框
        const edges = new cv.Mat();
        cv.Canny(gray, edges, 50, 150);

        // 轻微的形态学操作，连接断开的边缘，但不要过度合并
        const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
        const dilated = new cv.Mat();
        cv.dilate(edges, dilated, kernel, new cv.Point(-1, -1), 1);

        // 查找所有轮廓（包括嵌套的）
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.findContours(dilated, contours, hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);

        // 识别矩形框（车位）
        const allSpaces = [];
        const minArea = 1000; // 最小面积阈值
        const maxArea = src.rows * src.cols * 0.2; // 最大面积阈值
        
        for (let i = 0; i < contours.size(); i++) {
          const cnt = contours.get(i);
          const area = cv.contourArea(cnt);
          
          // 过滤面积太小或太大的区域
          if (area < minArea || area > maxArea) {
            cnt.delete();
            continue;
          }

          const rect = cv.boundingRect(cnt);
          
          // 过滤太小的区域（基于宽高）
          if (rect.width < 40 || rect.height < 40) {
            cnt.delete();
            continue;
          }

          // 计算宽高比，车位通常是矩形（宽高比在合理范围内）
          const aspectRatio = rect.width / rect.height;
          if (aspectRatio < 0.5 || aspectRatio > 2.5) {
            cnt.delete();
            continue;
          }

          // 计算轮廓的近似多边形
          const epsilon = 0.02 * cv.arcLength(cnt, true);
          const approx = new cv.Mat();
          cv.approxPolyDP(cnt, approx, epsilon, true);

          // 只接受四边形（矩形、平行四边形、梯形）
          if (approx.rows >= 4 && approx.rows <= 6) {
            // 计算旋转角度
            const angle = this.calculateAngle(approx);
            
            // 计算轮廓的凸包，更精确地判断是否为矩形
            const hull = new cv.Mat();
            cv.convexHull(approx, hull);
            const hullArea = cv.contourArea(hull);
            const extent = area / hullArea; // 轮廓面积与凸包面积的比值
            
            // 如果是矩形，extent 应该接近 1.0
            if (extent > 0.7) {
              allSpaces.push({
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                angle: angle,
                number: null,
                area: area,
                centerX: rect.x + rect.width / 2,
                centerY: rect.y + rect.height / 2,
                contour: cnt,
              });
            }
            
            hull.delete();
          }

          approx.delete();
          cnt.delete();
        }

        // 去重：使用非极大值抑制（NMS）去除重叠的检测框
        const spaces = this.nonMaxSuppression(allSpaces, 0.3);

        // 对识别到的车位进行 OCR 识别（批量处理，提高效率）
        console.log(`找到 ${spaces.length} 个候选车位，开始 OCR 识别...`);
        for (let i = 0; i < spaces.length; i++) {
          const space = spaces[i];
          try {
            const number = await this.extractSpaceNumber(
              src,
              space.x,
              space.y,
              space.width,
              space.height
            );
            space.number = number;
          } catch (e) {
            console.warn(`OCR 识别失败 (${i + 1}/${spaces.length}):`, e);
          }
        }

        this.parkingSpaces = spaces;
        
        // 触发事件，将识别结果传递给父组件
        this.$emit('spaces-recognized', spaces);

        // 清理资源
        src.delete();
        gray.delete();
        edges.delete();
        dilated.delete();
        kernel.delete();
        contours.delete();
        hierarchy.delete();

        console.log('识别完成，找到', spaces.length, '个车位');
      } catch (error) {
        console.error('识别过程出错:', error);
        alert('识别失败: ' + error.message);
      } finally {
        this.isProcessing = false;
      }
    },
    calculateAngle(approx) {
      // 计算矩形的旋转角度
      // 使用最小外接矩形
      const rect = cv.minAreaRect(approx);
      return Math.round(rect.angle);
    },
    // 非极大值抑制（NMS）去除重复检测
    nonMaxSuppression(spaces, overlapThreshold) {
      if (spaces.length === 0) return [];

      // 按面积排序，从大到小（保留面积大的检测框）
      const sortedSpaces = [...spaces].sort((a, b) => b.area - a.area);
      const selected = [];
      const suppressed = new Set();

      for (let i = 0; i < sortedSpaces.length; i++) {
        if (suppressed.has(i)) continue;

        const current = sortedSpaces[i];
        selected.push(current);

        // 检查与当前框重叠的其他框
        for (let j = i + 1; j < sortedSpaces.length; j++) {
          if (suppressed.has(j)) continue;

          const other = sortedSpaces[j];
          
          // 计算 IoU (Intersection over Union)
          const iou = this.calculateIoU(current, other);
          
          // 如果重叠度超过阈值，抑制这个框（移除重叠的检测）
          if (iou > overlapThreshold) {
            suppressed.add(j);
          }
        }
      }

      console.log(`NMS: 从 ${spaces.length} 个检测框中去除了 ${spaces.length - selected.length} 个重复检测`);
      return selected;
    },
    // 计算两个矩形的 IoU（交并比）
    calculateIoU(rect1, rect2) {
      // 计算交集区域
      const x1 = Math.max(rect1.x, rect2.x);
      const y1 = Math.max(rect1.y, rect2.y);
      const x2 = Math.min(rect1.x + rect1.width, rect2.x + rect2.width);
      const y2 = Math.min(rect1.y + rect1.height, rect2.y + rect2.height);

      // 如果没有交集
      if (x2 <= x1 || y2 <= y1) {
        return 0;
      }

      // 计算交集面积
      const intersection = (x2 - x1) * (y2 - y1);
      
      // 计算并集面积
      const area1 = rect1.width * rect1.height;
      const area2 = rect2.width * rect2.height;
      const union = area1 + area2 - intersection;

      // 返回 IoU（交集与并集的比值）
      return intersection / union;
    },
    // 检测图片中的所有文字区域
    async detectTextRegions(srcMat) {
      const textRegions = [];
      try {
        // 使用 Tesseract.js 检测所有文字位置
        const canvas = document.createElement('canvas');
        canvas.width = srcMat.cols;
        canvas.height = srcMat.rows;
        cv.imshow(canvas, srcMat);
        
        const { data } = await Tesseract.recognize(canvas, 'eng', {
          logger: () => {},
        });
        
        // 提取所有文字区域的位置和内容
        if (data.words) {
          for (const word of data.words) {
            if (word.text && word.text.trim().match(/[A-Z]?\d+/)) {
              // 扩展区域，因为车位号通常占据更大的区域
              const expandX = 20;
              const expandY = 20;
              textRegions.push({
                x: Math.max(0, word.bbox.x0 - expandX),
                y: Math.max(0, word.bbox.y0 - expandY),
                width: word.bbox.x1 - word.bbox.x0 + expandX * 2,
                height: word.bbox.y1 - word.bbox.y0 + expandY * 2,
                text: word.text.trim(),
                centerX: (word.bbox.x0 + word.bbox.x1) / 2,
                centerY: (word.bbox.y0 + word.bbox.y1) / 2,
              });
            }
          }
        }
      } catch (error) {
        console.error('文字区域检测失败:', error);
      }
      return textRegions;
    },
    // 在文字周围寻找封闭的边框
    async findBoundingBoxAroundText(srcMat, textRegion) {
      try {
        // 在文字周围扩展更大的搜索区域
        const expandRatio = 5; // 扩展5倍，寻找包含该文字的边框
        const searchX = Math.max(0, textRegion.x - textRegion.width * expandRatio);
        const searchY = Math.max(0, textRegion.y - textRegion.height * expandRatio);
        const searchWidth = Math.min(
          srcMat.cols - searchX,
          textRegion.width * (expandRatio * 2 + 1)
        );
        const searchHeight = Math.min(
          srcMat.rows - searchY,
          textRegion.height * (expandRatio * 2 + 1)
        );
        
        // 提取搜索区域
        const roi = new cv.Rect(searchX, searchY, searchWidth, searchHeight);
        const searchArea = srcMat.roi(roi);
        
        // 转换为灰度图
        const gray = new cv.Mat();
        cv.cvtColor(searchArea, gray, cv.COLOR_RGBA2GRAY);
        
        // 检测浅色背景区域（车位的背景通常是浅色的）
        const binary = new cv.Mat();
        cv.threshold(gray, binary, 200, 255, cv.THRESH_BINARY); // 阈值200，检测浅色区域
        
        // 查找轮廓（封闭边框）
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        // 找到包含文字区域的轮廓
        for (let i = 0; i < contours.size(); i++) {
          const cnt = contours.get(i);
          const rect = cv.boundingRect(cnt);
          
          // 检查文字中心是否在轮廓内
          const textCenterInSearch = {
            x: textRegion.centerX - searchX,
            y: textRegion.centerY - searchY,
          };
          
          if (
            textCenterInSearch.x >= rect.x &&
            textCenterInSearch.x <= rect.x + rect.width &&
            textCenterInSearch.y >= rect.y &&
            textCenterInSearch.y <= rect.y + rect.height
          ) {
            // 找到了包含文字的边框
            const angle = this.calculateAngleFromContour(cnt);
            
            // 清理资源
            cnt.delete();
            searchArea.delete();
            gray.delete();
            binary.delete();
            contours.delete();
            hierarchy.delete();
            
            return {
              x: rect.x + searchX,
              y: rect.y + searchY,
              width: rect.width,
              height: rect.height,
              angle: angle,
            };
          }
          
          cnt.delete();
        }
        
        // 清理资源
        searchArea.delete();
        gray.delete();
        binary.delete();
        contours.delete();
        hierarchy.delete();
      } catch (error) {
        console.error('寻找边框失败:', error);
      }
      return null;
    },
    // 检测浅色背景区域（车位通常有浅色背景）
    async detectLightBackgroundRegions(srcMat) {
      const regions = [];
      try {
        // 转换为灰度图
        const gray = new cv.Mat();
        cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
        
        // 检测浅色区域（背景），阈值200检测浅色
        const binary = new cv.Mat();
        cv.threshold(gray, binary, 200, 255, cv.THRESH_BINARY);
        
        // 形态学操作，连接断开的区域
        const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
        const dilated = new cv.Mat();
        cv.dilate(binary, dilated, kernel);
        
        // 查找轮廓
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.findContours(dilated, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        const minArea = 2000;
        const maxArea = srcMat.rows * srcMat.cols * 0.15;
        
        for (let i = 0; i < contours.size(); i++) {
          const cnt = contours.get(i);
          const area = cv.contourArea(cnt);
          
          if (area < minArea || area > maxArea) {
            cnt.delete();
            continue;
          }
          
          const rect = cv.boundingRect(cnt);
          
          // 过滤太小的区域
          if (rect.width < 50 || rect.height < 50) {
            cnt.delete();
            continue;
          }
          
          // 宽高比检查
          const aspectRatio = rect.width / rect.height;
          if (aspectRatio < 0.4 || aspectRatio > 2.5) {
            cnt.delete();
            continue;
          }
          
          // 计算角度
          const epsilon = 0.02 * cv.arcLength(cnt, true);
          const approx = new cv.Mat();
          cv.approxPolyDP(cnt, approx, epsilon, true);
          
          if (approx.rows >= 4) {
            const angle = this.calculateAngleFromContour(approx);
            regions.push({
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              angle: angle,
              area: area,
            });
          }
          
          approx.delete();
          cnt.delete();
        }
        
        // 清理资源
        gray.delete();
        binary.delete();
        dilated.delete();
        kernel.delete();
        contours.delete();
        hierarchy.delete();
      } catch (error) {
        console.error('浅色背景区域检测失败:', error);
      }
      return regions;
    },
    // 验证区域是否符合车位特征
    async validateParkingSpace(srcMat, boundingBox) {
      try {
        // 检查1：区域大小是否合理
        if (boundingBox.width < 50 || boundingBox.height < 50) return false;
        if (boundingBox.width > srcMat.cols * 0.3 || boundingBox.height > srcMat.rows * 0.3) return false;
        
        // 检查2：背景颜色是否为浅色（提取区域中心点的颜色）
        const centerX = boundingBox.x + boundingBox.width / 2;
        const centerY = boundingBox.y + boundingBox.height / 2;
        
        if (centerX < 0 || centerX >= srcMat.cols || centerY < 0 || centerY >= srcMat.rows) {
          return false;
        }
        
        // 提取中心区域的像素值（简化检查，取平均值）
        const roi = new cv.Rect(
          Math.max(0, boundingBox.x),
          Math.max(0, boundingBox.y),
          Math.min(boundingBox.width, srcMat.cols - boundingBox.x),
          Math.min(boundingBox.height, srcMat.rows - boundingBox.y)
        );
        const region = srcMat.roi(roi);
        
        // 转换为灰度图，计算平均亮度
        const gray = new cv.Mat();
        cv.cvtColor(region, gray, cv.COLOR_RGBA2GRAY);
        
        // 计算平均亮度
        const mean = cv.mean(gray);
        const avgBrightness = mean[0];
        
        // 浅色背景应该平均亮度 > 150
        const isValid = avgBrightness > 150;
        
        // 清理资源
        region.delete();
        gray.delete();
        
        return isValid;
      } catch (error) {
        console.error('验证车位特征失败:', error);
        return false;
      }
    },
    // 检查区域是否有文字
    async hasTextInRegion(srcMat, region) {
      try {
        const text = await this.extractSpaceNumber(
          srcMat,
          region.x,
          region.y,
          region.width,
          region.height
        );
        return { text };
      } catch (error) {
        return { text: null };
      }
    },
    // 从轮廓计算角度
    calculateAngleFromContour(cnt) {
      try {
        const epsilon = 0.02 * cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, epsilon, true);
        const angle = this.calculateAngle(approx);
        approx.delete();
        return angle;
      } catch (error) {
        return 0;
      }
    },
    async extractSpaceNumber(srcMat, x, y, width, height) {
      try {
        // 提取车位号区域
        const roi = new cv.Rect(
          Math.max(0, x),
          Math.max(0, y),
          Math.min(width, srcMat.cols - x),
          Math.min(height, srcMat.rows - y)
        );
        const cropped = srcMat.roi(roi);
        
        // 转换为 Canvas ImageData
        const canvas = document.createElement('canvas');
        canvas.width = cropped.cols;
        canvas.height = cropped.rows;
        // const ctx = canvas.getContext('2d');
        cv.imshow(canvas, cropped);
        
        // 使用 Tesseract.js 进行 OCR 识别
        const { data: { text } } = await Tesseract.recognize(canvas, 'eng', {
          logger: () => {
            // 可以在这里显示识别进度
          }
        });
        
        // 清理
        cropped.delete();
        
        // 提取数字（车位号通常是字母+数字，如 A001, B017）
        const cleanedText = text.trim().replace(/\s+/g, '');
        const match = cleanedText.match(/([A-Z]?\d+)/);
        return match ? match[1] : null;
      } catch (error) {
        console.error('OCR 识别失败:', error);
        return null;
      }
    },
  }
}
</script>

<style scoped>
.parking-recognizer {
  padding: 10px;
}

.recognize-btn {
  width: 100%;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  background: #4CAF50;
  color: white;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.recognize-btn:hover:not(:disabled) {
  background: #45a049;
}

.recognize-btn:disabled {
  background: #cccccc;
  cursor: not-allowed;
}

.results-info {
  margin-top: 10px;
  padding: 8px;
  background: #e8f5e9;
  border-radius: 4px;
  font-size: 12px;
  color: #2e7d32;
  text-align: center;
}
</style>