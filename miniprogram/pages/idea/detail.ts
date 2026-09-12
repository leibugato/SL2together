import { isCloudConfigured } from '../../config/env';
import { deleteIdea, getIdea, submitIdea } from '../../services/idea';
import { runEvaluation } from '../../services/evaluation';
import type { Evaluation, Submission } from '../../types/domain';
import { evaluationStatusLabel, formatDate, statusLabel, typeLabel } from '../../utils/format';

Page({
  data: {
    cloudConfigured: isCloudConfigured(),
    id: '',
    loading: true,
    evaluating: false,
    errorMessage: '',
    submission: null as Submission | null,
    evaluation: null as Evaluation | null,
    evaluationStale: false,
    evaluationCreatedAt: '',
    typeLabel: '',
    statusLabel: '',
    evaluationStatusLabel: '',
    createdAtLabel: '',
    updatedAtLabel: '',
    extraRows: [] as Array<{ label: string; value: string }>,
  },

  onLoad(options: Record<string, string | undefined>) {
    this.setData({ id: options.id || '' });
  },

  onShow() {
    if (this.data.id) {
      void this.load();
    }
  },

  async load() {
    if (!this.data.cloudConfigured) {
      this.setData({ loading: false });
      return;
    }
    this.setData({ loading: true, errorMessage: '' });
    try {
      const result = await getIdea(this.data.id);
      const extraRows = Object.entries(result.submission.extra || {})
        .filter(([, value]) => value !== '' && value !== null && value !== undefined)
        .map(([key, value]) => ({
          label: key,
          value: String(value),
        }));
      this.setData({
        loading: false,
        submission: result.submission,
        evaluation: result.evaluation,
        evaluationStale: result.evaluationStale,
        evaluationCreatedAt: formatDate(result.evaluation?.createdAt),
        typeLabel: typeLabel(result.submission.type),
        statusLabel: statusLabel(result.submission.status),
        evaluationStatusLabel: evaluationStatusLabel(result.submission.evaluationStatus),
        createdAtLabel: formatDate(result.submission.createdAt),
        updatedAtLabel: formatDate(result.submission.updatedAt),
        extraRows,
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error instanceof Error ? error.message : '详情加载失败。',
      });
    }
  },

  editIdea() {
    wx.navigateTo({
      url: `/pages/idea/edit?id=${this.data.id}`,
    });
  },

  openEvaluation() {
    if (!this.data.evaluation?._id) return;
    wx.navigateTo({
      url: `/pages/evaluation/result?submissionId=${this.data.id}`,
    });
  },

  async reEvaluate() {
    if (this.data.evaluating) return;
    this.setData({ evaluating: true });
    try {
      await runEvaluation(this.data.id, 'quick');
      wx.showToast({ title: '评估完成', icon: 'success' });
      await this.load();
    } catch (error) {
      wx.showModal({
        title: '评估失败',
        content: error instanceof Error ? error.message : '请稍后重试。',
        showCancel: false,
      });
      await this.load();
    } finally {
      this.setData({ evaluating: false });
    }
  },

  confirmSubmit() {
    wx.showModal({
      title: '确认提交这份设计？',
      content: '提交后仍可继续修改；修改内容会生成新版本，并可再次评估。',
      confirmText: '确认提交',
      success: async (result: WechatMiniprogram.ShowModalSuccessCallbackResult) => {
        if (!result.confirm) return;
        try {
          await submitIdea(this.data.id);
          wx.showToast({ title: '已提交', icon: 'success' });
          await this.load();
        } catch (error) {
          wx.showModal({
            title: '提交失败',
            content: error instanceof Error ? error.message : '请稍后重试。',
            showCancel: false,
          });
        }
      },
    });
  },

  copyDesign() {
    const submission = this.data.submission;
    if (!submission) return;
    wx.setClipboardData({
      data: submission.designText,
    });
  },

  copyResource() {
    const url = this.data.submission?.resourceUrl;
    if (!url) return;
    wx.setClipboardData({
      data: url,
    });
  },

  removeIdea() {
    wx.showModal({
      title: '删除这条记录？',
      content: '删除后普通列表不再显示，但云端会保留软删除标记。',
      confirmText: '删除',
      confirmColor: '#A63D2F',
      success: async (result: WechatMiniprogram.ShowModalSuccessCallbackResult) => {
        if (!result.confirm) return;
        try {
          await deleteIdea(this.data.id);
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 500);
        } catch (error) {
          wx.showModal({
            title: '删除失败',
            content: error instanceof Error ? error.message : '请稍后重试。',
            showCancel: false,
          });
        }
      },
    });
  },
});
