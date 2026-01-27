import Vue from 'vue';
import Vuex from 'vuex';

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    uploadedImage: null, // 存储上传的图片数据（Data URL）
    recognitionResults: null, // 存储API返回的识别结果
  },
  mutations: {
    setUploadedImage(state, imageData) {
      state.uploadedImage = imageData;
    },
    setRecognitionResults(state, results) {
      state.recognitionResults = results;
    },
    clearUploadedImage(state) {
      state.uploadedImage = null;
    },
  },
  actions: {
    uploadImage({ commit }, imageData) {
      commit('setUploadedImage', imageData);
    },
    saveRecognitionResults({ commit }, results) {
      commit('setRecognitionResults', results);
    },
    clearImage({ commit }) {
      commit('clearUploadedImage');
    },
  },
});
