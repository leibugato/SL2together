import { isCloudConfigured } from '../../config/env';
import { getEvaluation } from '../../services/evaluation';
import { submitIdea } from '../../services/idea';
import type { Evaluation, Submission } from '../../types/domain';
import { dimensionRows, formatDate } from '../../utils/format';

Page({
  data: {
    cloudConfigured: isCloudConfigured(),
    submissionId: '',
    loading: true,
    errorMessage: '',
    evaluation: null as Evaluation | null,
    submission: null as Submission | null,
    submitting: false,
    createdLabel: '',
    dimensions: [] as Array<{
      key: string;
      label: string;
      value: number;
      max: number;
      percent: number;
      fillColor: string;
    }>,
  },

  onLoad(options: Record<string, string | undefined>) {
    this.setData({ submissionId: options.submissionId || '' });
    void this.load();
  },

  async load() {
    if (!this.data.cloudConfigured) {
      this.setData({ loading: false });
      return;
    }
    if (!this.data.submissionId) {
      this.setData({ loading: false, errorMessage: '缺少评估记录参数。' });
      return;
    }
    this.setData({ loading: true, errorMessage: '' });
    try {
      const result = await getEvaluation({ submissionId: this.data.submissionId });
      if (!result.evaluation) {
        this.setData({ loading: false, errorMessage: '暂时没有可展示的评估结果。' });
        return;
      }
      this.setData({
        loading: false,
        evaluation: result.evaluation,
        submission: result.submission || null,
        createdLabel: formatDate(result.evaluation.createdAt),
        dimensions: dimensionRows(result.evaluation.dimensions),
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error instanceof Error ? error.message : '评估报告加载失败。',
      });
    }
  },

  editIdea() {
    wx.redirectTo({
      url: `/pages/idea/edit?id=${this.data.submissionId}`,
    });
  },

  openDetail() {
    wx.redirectTo({
      url: `/pages/idea/detail?id=${this.data.submissionId}`,
    });
  },

  async confirmSubmit() {
    if (this.data.submitting || this.data.submission?.status === 'SUBMITTED') return;
    this.setData({ submitting: true });
    try {
      await submitIdea(this.data.submissionId);
      wx.showToast({ title: '已提交', icon: 'success' });
      await this.load();
    } catch (error) {
      wx.showModal({
        title: '提交失败',
        content: error instanceof Error ? error.message : '请稍后重试。',
        showCancel: false,
      });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
