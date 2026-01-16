import Vue from 'vue';
import Vuex from 'vuex';

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    uploadedImage: null, // 存储上传的图片数据（Data URL）
  },
  mutations: {
    setUploadedImage(state, imageData) {
      state.uploadedImage = imageData;
    },
    clearUploadedImage(state) {
      state.uploadedImage = null;
    },
  },
  actions: {
    uploadImage({ commit }, imageData) {
      commit('setUploadedImage', imageData);
    },
    clearImage({ commit }) {
      commit('clearUploadedImage');
    },
  },
});
