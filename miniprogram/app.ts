import { ENV_ID, isCloudConfigured } from './config/env';

App({
  globalData: {
    cloudReady: false,
    envId: ENV_ID,
    user: null as unknown,
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('当前基础库不支持云开发，请升级微信开发者工具和基础库。');
      return;
    }

    if (!isCloudConfigured()) {
      console.warn('尚未在 miniprogram/config/env.ts 配置云开发环境 ID。');
      return;
    }

    wx.cloud.init({
      env: ENV_ID,
      traceUser: true,
    });
    this.globalData.cloudReady = true;
  },
});

