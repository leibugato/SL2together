import { isCloudConfigured } from '../../config/env';
import { createIdea, getIdea, updateIdea } from '../../services/idea';
import { runEvaluation } from '../../services/evaluation';
import { IDEA_TYPES, TYPE_EXTRA_FIELDS, type IdeaType } from '../../types/domain';
import { validateIdeaForm, type IdeaForm } from '../../utils/validation';

function buildExtra(type: IdeaType, source: Record<string, unknown> = {}) {
  return TYPE_EXTRA_FIELDS[type].reduce(
    (result, field) => {
      const value = source[field.key];
      result[field.key] =
        typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
          ? value
          : value === null || value === undefined
            ? ''
            : String(value);
      return result;
    },
    {} as Record<string, string | number | boolean>,
  );
}

Page({
  data: {
    cloudConfigured: isCloudConfigured(),
    id: '',
    loading: false,
    saving: false,
    evaluationLoading: false,
    currentVersion: 0,
    typeOptions: IDEA_TYPES,
    typeIndex: 0,
    extraFields: TYPE_EXTRA_FIELDS.CARD,
    form: {
      type: 'CARD' as IdeaType,
      name: '',
      designText: '',
      resourceUrl: '',
      extra: buildExtra('CARD'),
    } as IdeaForm,
  },

  onLoad(options: Record<string, string | undefined>) {
    const id = options.id || '';
    const initialType = (options.type as IdeaType) || 'CARD';
    const validType = IDEA_TYPES.some((item) => item.value === initialType) ? initialType : 'CARD';
    this.setData({
      id,
      typeIndex: IDEA_TYPES.findIndex((item) => item.value === validType),
      extraFields: TYPE_EXTRA_FIELDS[validType],
      form: {
        type: validType,
        name: '',
        designText: '',
        resourceUrl: '',
        extra: buildExtra(validType),
      },
    });
    if (id) {
      void this.loadExisting(id);
    }
  },

  async loadExisting(id: string) {
    this.setData({ loading: true });
    try {
      const result = await getIdea(id);
      const type = result.submission.type;
      this.setData({
        loading: false,
        currentVersion: result.submission.contentVersion,
        typeIndex: IDEA_TYPES.findIndex((item) => item.value === type),
        extraFields: TYPE_EXTRA_FIELDS[type],
        form: {
          type,
          name: result.submission.name,
          designText: result.submission.designText,
          resourceUrl: result.submission.resourceUrl || '',
          extra: buildExtra(type, result.submission.extra),
        },
      });
      wx.setNavigationBarTitle({ title: '编辑设计' });
    } catch (error) {
      this.setData({ loading: false });
      wx.showModal({
        title: '无法读取设计',
        content: error instanceof Error ? error.message : '记录不存在或无权访问。',
        showCancel: false,
        success: () => wx.navigateBack(),
      });
    }
  },

  selectType(event: WechatMiniprogram.TouchEvent) {
    const index = Number(event.currentTarget.dataset.index);
    const type = IDEA_TYPES[index]?.value;
    if (!type || type === this.data.form.type) return;
    this.setData({
      typeIndex: index,
      extraFields: TYPE_EXTRA_FIELDS[type],
      'form.type': type,
      'form.extra': buildExtra(type),
    });
  },

  onNameInput(event: WechatMiniprogram.Input) {
    this.setData({ 'form.name': event.detail.value });
  },

  onDesignInput(event: WechatMiniprogram.Input) {
    this.setData({ 'form.designText': event.detail.value });
  },

  onResourceInput(event: WechatMiniprogram.Input) {
    this.setData({ 'form.resourceUrl': event.detail.value });
  },

  onExtraInput(event: WechatMiniprogram.Input) {
    const key = String(event.currentTarget.dataset.key || '');
    if (!key) return;
    this.setData({
      [`form.extra.${key}`]: event.detail.value,
    });
  },

  async persist(mode: 'draft' | 'evaluate' | 'submit') {
    if (!this.data.cloudConfigured) {
      wx.showModal({
        title: '尚未配置云开发',
        content: '请先填写 miniprogram/config/env.ts 中的环境 ID，并部署 api 云函数。',
        showCancel: false,
      });
      return;
    }

    const { form, id, currentVersion } = this.data;
    const validationError = validateIdeaForm(form);
    if (validationError) {
      wx.showToast({ title: validationError, icon: 'none', duration: 2600 });
      return;
    }

    this.setData({ saving: true });
    try {
      const status = mode === 'submit' ? 'SUBMITTED' : 'DRAFT';
      const result = id
        ? await updateIdea(id, form, status, currentVersion)
        : await createIdea(form, status);
      const submissionId = result.submission._id;
      this.setData({ id: submissionId, currentVersion: result.submission.contentVersion });

      if (mode !== 'evaluate') {
        wx.showToast({ title: mode === 'submit' ? '提交成功' : '草稿已保存', icon: 'success' });
        wx.redirectTo({ url: `/pages/idea/detail?id=${submissionId}` });
        return;
      }

      this.setData({ evaluationLoading: true });
      try {
        await runEvaluation(submissionId, 'quick');
        wx.redirectTo({ url: `/pages/evaluation/result?submissionId=${submissionId}` });
      } catch (error) {
        this.setData({ evaluationLoading: false });
        wx.showModal({
          title: '设计已保存，评估未完成',
          content: error instanceof Error ? error.message : '可以稍后在详情页重新评估。',
          showCancel: false,
          success: () => wx.redirectTo({ url: `/pages/idea/detail?id=${submissionId}` }),
        });
      }
    } catch (error) {
      wx.showModal({
        title: '保存失败',
        content: error instanceof Error ? error.message : '请检查网络和云函数部署状态。',
        showCancel: false,
      });
    } finally {
      this.setData({ saving: false, evaluationLoading: false });
    }
  },

  saveDraft() {
    void this.persist('draft');
  },

  submitOnly() {
    void this.persist('submit');
  },

  submitAndEvaluate() {
    void this.persist('evaluate');
  },
});
