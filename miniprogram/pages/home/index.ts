import { APP_NAME, isCloudConfigured } from '../../config/env';
import { bootstrapUser, getDashboard, listIdeas } from '../../services/idea';
import { IDEA_TYPES } from '../../types/domain';
import { formatDate, statusLabel, truncate, typeLabel } from '../../utils/format';

Page({
  data: {
    appName: APP_NAME,
    cloudConfigured: isCloudConfigured(),
    loading: true,
    errorMessage: '',
    stats: {
      total: 0,
      drafts: 0,
      submitted: 0,
      evaluated: 0,
    },
    typeOptions: IDEA_TYPES,
    recent: [] as Array<Record<string, unknown>>,
  },

  onShow() {
    void this.load();
  },

  onPullDownRefresh() {
    void this.load().finally(() => wx.stopPullDownRefresh());
  },

  async load() {
    if (!this.data.cloudConfigured) {
      this.setData({ loading: false });
      return;
    }

    this.setData({ loading: true, errorMessage: '' });
    try {
      const [, dashboard, recent] = await Promise.all([
        bootstrapUser(),
        getDashboard(),
        listIdeas({ page: 0, pageSize: 4 }),
      ]);
      this.setData({
        stats: dashboard,
        recent: recent.items.map((item) => ({
          ...item,
          typeLabel: typeLabel(item.type),
          statusLabel: statusLabel(item.status),
          evaluationStatusLabel: item.evaluationStatus === 'SUCCEEDED'
            ? '已评估'
            : item.evaluationStatus === 'FAILED'
              ? '评估失败'
              : item.evaluationStatus === 'NOT_EVALUATED'
                ? '未评估'
                : '评估中',
          updatedAtLabel: formatDate(item.updatedAt),
          summary: truncate(item.designText, 62),
        })),
        loading: false,
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error instanceof Error ? error.message : '首页数据加载失败。',
      });
    }
  },

  createWithType(event: WechatMiniprogram.TouchEvent) {
    const type = String(event.currentTarget.dataset.type || 'CARD');
    wx.navigateTo({
      url: `/pages/idea/edit?type=${type}`,
    });
  },

  openDetail(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id || '');
    if (!id) return;
    wx.navigateTo({
      url: `/pages/idea/detail?id=${id}`,
    });
  },

  openList() {
    wx.switchTab({
      url: '/pages/idea/list',
    });
  },

  openImport() {
    wx.navigateTo({
      url: '/pages/idea/import',
    });
  },

  openModSupport() {
    wx.navigateTo({
      url: '/pages/mod-support/index',
    });
  },
});
