import { isCloudConfigured } from '../../config/env';
import { importSharedIdea } from '../../services/idea';

Page({
  data: {
    cloudConfigured: isCloudConfigured(),
    code: '',
    importing: false,
    errorMessage: '',
  },

  onLoad(options: Record<string, string | undefined>) {
    if (options.code) {
      this.setData({ code: String(options.code).toUpperCase() });
    }
  },

  onCodeInput(event: WechatMiniprogram.Input) {
    this.setData({
      code: event.detail.value.toUpperCase(),
      errorMessage: '',
    });
  },

  pasteCode() {
    wx.getClipboardData({
      success: (result: { data?: string }) => {
        if (!result.data) return;
        this.setData({
          code: result.data.toUpperCase(),
          errorMessage: '',
        });
      },
    });
  },

  async importCode() {
    if (!this.data.cloudConfigured || this.data.importing) return;
    const code = this.data.code.trim();
    if (!code) {
      this.setData({ errorMessage: '请先输入或粘贴分享标识。' });
      return;
    }

    this.setData({ importing: true, errorMessage: '' });
    try {
      const result = await importSharedIdea(code);
      wx.showModal({
        title: '导入成功',
        content: '设计已保存到你的草稿，可以继续修改并重新评估。',
        showCancel: false,
        success: () => {
          wx.redirectTo({
            url: `/pages/idea/detail?id=${result.submission._id}`,
          });
        },
      });
    } catch (error) {
      this.setData({
        errorMessage: error instanceof Error ? error.message : '导入失败，请检查分享标识。',
      });
    } finally {
      this.setData({ importing: false });
    }
  },
});
