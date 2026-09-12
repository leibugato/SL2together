import { isCloudConfigured } from '../../config/env';
import { listIdeas } from '../../services/idea';
import {
  DIFFICULTY_LABELS,
  EVALUATION_STATUSES,
  IDEA_TYPES,
  SUBMISSION_STATUSES,
  type IdeaType,
  type EvaluationStatus,
  type SubmissionStatus,
} from '../../types/domain';
import { formatDate, statusLabel, truncate, typeLabel } from '../../utils/format';

const ALL_TYPES = [{ value: '', label: '全部类型' }, ...IDEA_TYPES];
const STATUS_OPTIONS = [
  { value: '', label: '全部设计状态' },
  ...Object.entries(SUBMISSION_STATUSES).map(([value, label]) => ({ value, label })),
];
const EVALUATION_STATUS_OPTIONS = [
  { value: '', label: '全部评估状态' },
  ...Object.entries(EVALUATION_STATUSES).map(([value, label]) => ({ value, label })),
];
const DIFFICULTY_OPTIONS = [
  { value: '', label: '全部难度' },
  ...Object.entries(DIFFICULTY_LABELS).map(([value, label]) => ({ value, label })),
];

Page({
  data: {
    cloudConfigured: isCloudConfigured(),
    loading: false,
    loadingMore: false,
    errorMessage: '',
    items: [] as Array<Record<string, unknown>>,
    total: 0,
    page: 0,
    pageSize: 10,
    hasMore: true,
    typeOptions: ALL_TYPES,
    statusOptions: STATUS_OPTIONS,
    evaluationStatusOptions: EVALUATION_STATUS_OPTIONS,
    difficultyOptions: DIFFICULTY_OPTIONS,
    typeIndex: 0,
    statusIndex: 0,
    evaluationStatusIndex: 0,
    difficultyIndex: 0,
  },

  onShow() {
    void this.load(true);
  },

  onPullDownRefresh() {
    void this.load(true).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (!this.data.loadingMore && this.data.hasMore) {
      void this.load(false);
    }
  },

  retry() {
    void this.load(true);
  },

  selectType(event: WechatMiniprogram.TouchEvent) {
    const index = Number(event.currentTarget.dataset.index);
    const type = this.data.typeOptions[index]?.value || '';
    this.setData({ typeIndex: index, items: [], page: 0, hasMore: true });
    void this.load(true, { type });
  },

  onStatusChange(event: WechatMiniprogram.PickerChange) {
    const index = Number(event.detail.value);
    this.setData({ statusIndex: index });
    const status = this.data.statusOptions[index]?.value || '';
    void this.load(true, { status: status as SubmissionStatus | '' });
  },

  onDifficultyChange(event: WechatMiniprogram.PickerChange) {
    const index = Number(event.detail.value);
    this.setData({ difficultyIndex: index });
    const difficulty = this.data.difficultyOptions[index]?.value || '';
    void this.load(true, { difficulty });
  },

  onEvaluationStatusChange(event: WechatMiniprogram.PickerChange) {
    const index = Number(event.detail.value);
    this.setData({ evaluationStatusIndex: index });
    const evaluationStatus = this.data.evaluationStatusOptions[index]?.value || '';
    void this.load(true, { evaluationStatus: evaluationStatus as EvaluationStatus | '' });
  },

  async load(
    reset: boolean,
    override: Partial<{
      type: IdeaType | '';
      status: SubmissionStatus | '';
      evaluationStatus: EvaluationStatus | '';
      difficulty: string;
    }> = {},
  ) {
    if (!this.data.cloudConfigured) {
      return;
    }

    const page = reset ? 0 : this.data.page + 1;
    if (reset) {
      this.setData({ loading: true, errorMessage: '' });
    } else {
      this.setData({ loadingMore: true });
    }

    const type = override.type ?? (this.data.typeOptions[this.data.typeIndex]?.value as IdeaType | '') ?? '';
    const status = override.status ?? (this.data.statusOptions[this.data.statusIndex]?.value as SubmissionStatus | '') ?? '';
    const evaluationStatus =
      override.evaluationStatus ??
      (this.data.evaluationStatusOptions[this.data.evaluationStatusIndex]?.value as EvaluationStatus | '') ??
      '';
    const difficulty = override.difficulty ?? this.data.difficultyOptions[this.data.difficultyIndex]?.value ?? '';

    try {
      const result = await listIdeas({
        page,
        pageSize: this.data.pageSize,
        type,
        status,
        evaluationStatus,
        difficulty,
      });
      const nextItems = result.items.map((item) => ({
        ...item,
        typeLabel: typeLabel(item.type),
        statusLabel: statusLabel(item.status),
        evaluationStatusLabel:
          item.evaluationStatus === 'SUCCEEDED'
            ? '已评估'
            : item.evaluationStatus === 'FAILED'
              ? '评估失败'
              : item.evaluationStatus === 'NOT_EVALUATED'
                ? '未评估'
                : '评估中',
        updatedAtLabel: formatDate(item.updatedAt),
        summary: truncate(item.designText, 80),
      }));
      this.setData({
        items: reset ? nextItems : [...this.data.items, ...nextItems],
        total: result.total,
        page,
        hasMore: (page + 1) * result.pageSize < result.total,
        loading: false,
        loadingMore: false,
      });
    } catch (error) {
      this.setData({
        loading: false,
        loadingMore: false,
        errorMessage: error instanceof Error ? error.message : '记录加载失败。',
      });
    }
  },

  createIdea() {
    wx.navigateTo({
      url: '/pages/idea/edit?type=CARD',
    });
  },

  openDetail(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id || '');
    if (!id) return;
    wx.navigateTo({
      url: `/pages/idea/detail?id=${id}`,
    });
  },
});
