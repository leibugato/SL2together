import { isCloudConfigured } from '../../config/env';
import {
  exportAdminSubmissions,
  getAdminIdentity,
  listAdminSubmissions,
  type AdminExportResult,
  type AdminIdentity,
  type AdminSubmissionRow,
} from '../../services/admin';
import {
  IDEA_TYPES,
  SUBMISSION_STATUSES,
  type IdeaType,
  type SubmissionStatus,
} from '../../types/domain';
import { evaluationStatusLabel, formatDate, statusLabel, typeLabel } from '../../utils/format';

const TYPE_OPTIONS = [{ value: '', label: '全部类型' }, ...IDEA_TYPES];
const STATUS_OPTIONS = [
  { value: '', label: '全部设计状态' },
  ...Object.entries(SUBMISSION_STATUSES).map(([value, label]) => ({ value, label })),
];

Page({
  data: {
    cloudConfigured: isCloudConfigured(),
    checking: true,
    loading: false,
    exporting: false,
    identity: null as AdminIdentity | null,
    errorMessage: '',
    items: [] as Array<AdminSubmissionRow & Record<string, unknown>>,
    selectedIds: [] as string[],
    exportSelectedLabel: '导出已选',
    typeOptions: TYPE_OPTIONS,
    statusOptions: STATUS_OPTIONS,
    typeIndex: 0,
    statusIndex: 0,
    userRefInput: '',
  },

  onLoad() {
    void this.bootstrap();
  },

  async bootstrap() {
    if (!this.data.cloudConfigured) {
      this.setData({ checking: false });
      return;
    }
    this.setData({ checking: true, errorMessage: '' });
    try {
      const identity = await getAdminIdentity();
      this.setData({ identity, checking: false });
      if (identity.isAdmin) {
        await this.loadList();
      }
    } catch (error) {
      this.setData({
        checking: false,
        errorMessage: error instanceof Error ? error.message : '权限检查失败。',
      });
    }
  },

  async loadList() {
    this.setData({ loading: true, errorMessage: '' });
    try {
      const type = this.data.typeOptions[this.data.typeIndex]?.value || '';
      const status = this.data.statusOptions[this.data.statusIndex]?.value || '';
      const result = await listAdminSubmissions({
        type,
        status,
        userRef: this.data.userRefInput.trim(),
      });
      this.setData({
        loading: false,
        selectedIds: [],
        exportSelectedLabel: '导出已选',
        items: result.items.map((item) => ({
          ...item,
          typeLabel: typeLabel(item.type),
          statusLabel: statusLabel(item.status),
          evaluationStatusLabel: evaluationStatusLabel(item.evaluationStatus),
          updatedAtLabel: formatDate(item.updatedAt),
          selected: false,
        })),
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error instanceof Error ? error.message : '数据加载失败。',
      });
    }
  },

  selectType(event: WechatMiniprogram.TouchEvent) {
    const index = Number(event.currentTarget.dataset.index);
    this.setData({ typeIndex: index });
    void this.loadList();
  },

  onStatusChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ statusIndex: Number(event.detail.value) });
    void this.loadList();
  },

  onUserRefInput(event: WechatMiniprogram.Input) {
    this.setData({ userRefInput: event.detail.value });
  },

  searchUser() {
    void this.loadList();
  },

  onSelectionChange(event: WechatMiniprogram.TouchEvent) {
    const values = Array.isArray(event.detail.value) ? (event.detail.value as string[]) : [];
    this.setData({
      selectedIds: values,
      exportSelectedLabel: values.length ? `导出已选 ${values.length}` : '导出已选',
      items: this.data.items.map((item: AdminSubmissionRow & Record<string, unknown>) => ({
        ...item,
        selected: values.includes(String(item._id)),
      })),
    });
  },

  async exportSelected() {
    if (!this.data.selectedIds.length) {
      wx.showToast({ title: '请先选择记录', icon: 'none' });
      return;
    }
    if (this.data.selectedIds.length > 200) {
      wx.showToast({ title: '一次最多选择 200 条', icon: 'none' });
      return;
    }
    await this.exportData({ submissionIds: this.data.selectedIds });
  },

  async exportFiltered() {
    await this.exportData({
      type: this.data.typeOptions[this.data.typeIndex]?.value || '',
      status: this.data.statusOptions[this.data.statusIndex]?.value || '',
      userRef: this.data.userRefInput.trim(),
      limit: 500,
    });
  },

  async exportData(params: Record<string, unknown>) {
    if (this.data.exporting) return;
    this.setData({ exporting: true });
    try {
      const result = await exportAdminSubmissions(params);
      await this.shareExport(result);
    } catch (error) {
      wx.showModal({
        title: '导出失败',
        content: error instanceof Error ? error.message : '请稍后重试。',
        showCancel: false,
      });
    } finally {
      this.setData({ exporting: false });
    }
  },

  async shareExport(result: AdminExportResult) {
    try {
      const download = await wx.cloud.downloadFile({ fileID: result.fileID });
      await wx.shareFileMessage({
        filePath: download.tempFilePath,
        fileName: result.fileName,
      });
    } catch (error) {
      wx.showModal({
        title: `已生成 ${result.count} 条记录`,
        content: '文件已生成，但当前环境无法直接分享。文件 ID 已复制，可在云开发控制台下载。',
        showCancel: false,
      });
      wx.setClipboardData({ data: result.fileID });
    }
  },
});
