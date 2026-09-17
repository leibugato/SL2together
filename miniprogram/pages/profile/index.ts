import { APP_NAME, isCloudConfigured } from '../../config/env';
import { bootstrapUser } from '../../services/idea';
import { getAdminIdentity } from '../../services/admin';
import { maskOpenId } from '../../utils/format';

Page({
  data: {
    appName: APP_NAME,
    cloudConfigured: isCloudConfigured(),
    loading: true,
    openidLabel: '--',
    isAdmin: false,
    errorMessage: '',
  },

  onShow() {
    void this.load();
  },

  async load() {
    if (!this.data.cloudConfigured) {
      this.setData({ loading: false });
      return;
    }
    try {
      const [result, adminIdentity] = await Promise.all([
        bootstrapUser(),
        getAdminIdentity().catch(() => null),
      ]);
      this.setData({
        openidLabel: maskOpenId(result.openid),
        isAdmin: Boolean(adminIdentity?.isAdmin),
        loading: false,
        errorMessage: '',
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error instanceof Error ? error.message : '用户信息读取失败。',
      });
    }
  },

  openRecords() {
    wx.switchTab({
      url: '/pages/idea/list',
    });
  },

  openAdmin() {
    wx.navigateTo({
      url: '/pages/admin/index',
    });
  },

  openModSupport() {
    wx.navigateTo({
      url: '/pages/mod-support/index',
    });
  },

  showPrivacy() {
    wx.showModal({
      title: '数据与隐私',
      content:
        '本工具只保存完成设计归档和评估所需的数据。提交默认仅自己可见，不收集手机号、身份证或精确位置。启用真实 AI 后，提交正文会发送给配置的第三方模型服务进行难度评估。',
      showCancel: false,
      confirmText: '知道了',
    });
  },

  showDeleteGuide() {
    wx.showModal({
      title: '删除提交',
      content: '进入任意提交详情，点击“删除记录”即可软删除。正式上线前还需要根据运营策略补齐账号级数据清理入口。',
      showCancel: false,
      confirmText: '知道了',
    });
  },

  showAbout() {
    wx.showModal({
      title: APP_NAME,
      content:
        '非官方玩家工具，用于记录《杀戮尖塔 2》MOD 设计想法并提供实现难度参考。AI 结果不代表保证可实装，最终仍需要开发者核对游戏版本和实际接口。',
      showCancel: false,
      confirmText: '知道了',
    });
  },
});
