import { IDEA_TYPES, type IdeaType } from '../types/domain';

export interface IdeaForm {
  type: IdeaType;
  name: string;
  designText: string;
  resourceUrl: string;
  extra: Record<string, string | number | boolean>;
}

export function validateIdeaForm(form: IdeaForm): string | null {
  if (!IDEA_TYPES.some((item) => item.value === form.type)) {
    return '请选择有效的内容类型。';
  }
  const name = form.name.trim();
  if (name.length < 1 || name.length > 60) {
    return '名称需要 1 至 60 个字符。';
  }
  const designText = form.designText.trim();
  if (designText.length < 15 || designText.length > 5000) {
    return '描述与设计需要 15 至 5000 个字符。';
  }
  const url = form.resourceUrl.trim();
  if (url && !/^https?:\/\/[^\s]+$/i.test(url)) {
    return '资源链接需要以 http:// 或 https:// 开头。';
  }
  return null;
}

