import { isCloudConfigured } from '../../config/env';
import { getEvaluation } from '../../services/evaluation';
import { submitIdea } from '../../services/idea';
import {
  generateMod,
  getCloudFileTempUrl,
  getLatestModJob,
  shareCloudFile,
} from '../../services/mod';
import type { Evaluation, ModGenerationJob, Submission } from '../../types/domain';
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
    generatingMod: false,
    sharingMod: false,
    modJob: null as ModGenerationJob | null,
    evaluationStale: false,
    modJobStale: false,
    modGenerationCurrent: false,
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
        evaluationStale: Boolean(
          result.submission && result.evaluation.contentHash !== result.submission.contentHash,
        ),
        modGenerationCurrent: result.evaluation.modGeneration?.version === 'modspec-v4',
        createdLabel: formatDate(result.evaluation.createdAt),
        dimensions: dimensionRows(result.evaluation.dimensions),
      });
      if (
        result.evaluation.modGeneration?.supported &&
        result.evaluation.modGeneration?.version === 'modspec-v4'
      ) {
        getLatestModJob(this.data.submissionId)
          .then((modResult) => {
            if (modResult.job) {
              this.setData({
                modJob: modResult.job,
                modJobStale: Boolean(
                  result.submission &&
                    modResult.job.contentHash !== result.submission.contentHash,
                ),
              });
            }
          })
          .catch(() => {});
      }
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

  openModSupport() {
    wx.navigateTo({
      url: '/pages/mod-support/index',
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

  async generateMod() {
    if (this.data.generatingMod) return;
    if (!this.data.modGenerationCurrent) {
      wx.showModal({
        title: '需要重新评估',
        content: '当前评估使用的 MOD 生成规则较旧，请重新评估后再生成。',
        showCancel: false,
      });
      return;
    }
    if (this.data.evaluationStale) {
      wx.showModal({
        title: '设计已修改',
        content: '请先返回编辑页重新评估，再生成新版 MOD。',
        showCancel: false,
      });
      return;
    }
    this.setData({ generatingMod: true });
    try {
      const result = await generateMod(this.data.submissionId);
      this.setData({
        generatingMod: false,
        modJob: result.job,
        modJobStale: false,
      });
      wx.showToast({ title: 'MOD 已生成', icon: 'success' });
    } catch (error) {
      this.setData({ generatingMod: false });
      wx.showModal({
        title: '生成失败',
        content: error instanceof Error ? error.message : '请稍后重试。',
        showCancel: false,
      });
    }
  },

  async copyModDownload() {
    const fileId = this.data.modJob?.modFileId;
    if (!fileId) return;
    try {
      const url = await getCloudFileTempUrl(fileId);
      wx.setClipboardData({ data: url });
    } catch (error) {
      wx.showToast({ title: '链接生成失败', icon: 'none' });
    }
  },

  async copySourceDownload() {
    const fileId = this.data.modJob?.sourceFileId;
    if (!fileId) return;
    try {
      const url = await getCloudFileTempUrl(fileId);
      wx.setClipboardData({ data: url });
    } catch (error) {
      wx.showToast({ title: '链接生成失败', icon: 'none' });
    }
  },

  async shareMod() {
    const job = this.data.modJob;
    if (!job?.modFileId || this.data.sharingMod) return;
    this.setData({ sharingMod: true });
    try {
      await shareCloudFile(job.modFileId, `${job.manifest?.id || 'mod'}.zip`);
    } catch (error) {
      wx.showToast({ title: '分享失败，可先复制链接', icon: 'none' });
    } finally {
      this.setData({ sharingMod: false });
    }
  },

  copyTestCommand(event: WechatMiniprogram.TouchEvent) {
    const command = String(event.currentTarget.dataset.command || '');
    if (!command) return;
    wx.setClipboardData({ data: command });
  },
});
