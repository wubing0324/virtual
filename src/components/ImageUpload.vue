<template>
  <div class="image-upload-page">
    <div class="upload-container">
      <h1 class="page-title">车位识别编辑工具</h1>
      <p class="page-description">请上传车位图片，然后进入编辑页面</p>
      
      <div class="upload-area" :class="{ 'drag-over': isDragOver }">
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          @change="handleFileSelect"
          style="display: none"
        />
        
        <div
          class="upload-dropzone"
          @click="$refs.fileInput.click()"
          @dragover.prevent="handleDragOver"
          @dragleave.prevent="handleDragLeave"
          @drop.prevent="handleDrop"
        >
          <div v-if="!previewImage" class="upload-placeholder">
            <div class="upload-icon">📁</div>
            <p class="upload-text">点击选择图片或拖拽图片到此处</p>
            <p class="upload-hint">支持 JPG、PNG 等图片格式</p>
          </div>
          
          <div v-else class="preview-container">
            <img :src="previewImage" alt="预览图片" class="preview-image" />
            <div class="preview-overlay">
              <button class="change-btn" @click.stop="$refs.fileInput.click()">
                更换图片
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="action-buttons">
        <button
          class="btn btn-primary"
          :disabled="!previewImage"
          @click="goToEdit"
        >
          进入编辑页面
        </button>
        <button
          v-if="previewImage"
          class="btn btn-secondary"
          @click="clearImage"
        >
          清除图片
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ImageUpload',
  data() {
    return {
      previewImage: null,
      imageFile: null,
      isDragOver: false,
      isLoading: false,
    };
  },
  methods: {
    handleFileSelect(event) {
      const file = event.target.files[0];
      if (file) {
        this.processFile(file);
      }
    },
    handleDragOver(event) {
      event.preventDefault();
      this.isDragOver = true;
    },
    handleDragLeave(event) {
      event.preventDefault();
      this.isDragOver = false;
    },
    handleDrop(event) {
      event.preventDefault();
      this.isDragOver = false;
      
      const file = event.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        this.processFile(file);
      } else {
        alert('请选择图片文件');
      }
    },
    processFile(file) {
      // 检查文件类型
      if (!file.type.startsWith('image/')) {
        alert('请选择图片文件');
        return;
      }
      
      // 检查文件大小（限制为 10MB）
      if (file.size > 10 * 1024 * 1024) {
        alert('图片文件大小不能超过 10MB');
        return;
      }
      
      this.imageFile = file;
      
      // 使用 FileReader 读取文件并显示预览
      const reader = new FileReader();
      reader.onload = (e) => {
        this.previewImage = e.target.result;
      };
      reader.onerror = () => {
        alert('文件读取失败，请重试');
      };
      reader.readAsDataURL(file);
    },
    goToEdit() {
      if (!this.previewImage) {
        alert('请先上传图片');
        return;
      }
      
      // 将图片数据存储到 Vuex
      this.$store.dispatch('uploadImage', this.previewImage);
      
      // 跳转到编辑页面
      this.$router.push({
        name: 'EditArea',
      });
    },
    clearImage() {
      this.previewImage = null;
      this.imageFile = null;
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = '';
      }
    },
  },
};
</script>

<style scoped>
.image-upload-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.upload-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  padding: 40px;
  max-width: 800px;
  width: 100%;
}

.page-title {
  font-size: 28px;
  font-weight: bold;
  color: #333;
  text-align: center;
  margin-bottom: 10px;
}

.page-description {
  font-size: 16px;
  color: #666;
  text-align: center;
  margin-bottom: 30px;
}

.upload-area {
  margin-bottom: 30px;
}

.upload-area.drag-over {
  opacity: 0.8;
}

.upload-dropzone {
  border: 3px dashed #ddd;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  background: #fafafa;
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-dropzone:hover {
  border-color: #4CAF50;
  background: #f0f8f0;
}

.upload-placeholder {
  width: 100%;
}

.upload-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.upload-text {
  font-size: 18px;
  color: #333;
  margin-bottom: 10px;
  font-weight: 500;
}

.upload-hint {
  font-size: 14px;
  color: #999;
}

.preview-container {
  position: relative;
  width: 100%;
  max-height: 500px;
  overflow: hidden;
  border-radius: 8px;
}

.preview-image {
  width: 100%;
  height: auto;
  max-height: 500px;
  object-fit: contain;
  display: block;
}

.preview-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
}

.preview-container:hover .preview-overlay {
  opacity: 1;
}

.change-btn {
  padding: 12px 24px;
  background: white;
  color: #333;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.2s;
}

.change-btn:hover {
  background: #f0f0f0;
  transform: scale(1.05);
}

.action-buttons {
  display: flex;
  gap: 15px;
  justify-content: center;
}

.btn {
  padding: 12px 32px;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #4CAF50;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #45a049;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.btn-primary:disabled {
  background: #cccccc;
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-secondary {
  background: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
}

.btn-secondary:hover {
  background: #e8e8e8;
}
</style>
