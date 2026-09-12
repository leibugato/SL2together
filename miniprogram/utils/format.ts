import {
  DIFFICULTY_LABELS,
  EVALUATION_STATUSES,
  IDEA_TYPES,
  SUBMISSION_STATUSES,
  type DifficultyLevel,
  type EvaluationStatus,
  type IdeaType,
  type SubmissionStatus,
} from '../types/domain';

export function typeLabel(type: IdeaType): string {
  return IDEA_TYPES.find((item) => item.value === type)?.label || type;
}

export function statusLabel(status: SubmissionStatus): string {
  return SUBMISSION_STATUSES[status] || status;
}

export function evaluationStatusLabel(status: EvaluationStatus): string {
  return EVALUATION_STATUSES[status] || status;
}

export function difficultyLabel(level?: DifficultyLevel): string {
  return level ? DIFFICULTY_LABELS[level] : '';
}

export function formatDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

export function truncate(value: string, length = 72): string {
  if (!value) return '';
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

export function maskOpenId(openid: string): string {
  if (!openid) return '--';
  if (openid.length <= 8) return openid;
  return `${openid.slice(0, 4)}...${openid.slice(-4)}`;
}

export function dimensionRows(dimensions: Record<string, number>) {
  const definitions = [
    { key: 'apiFit', label: '接口改动量', max: 25 },
    { key: 'logicComplexity', label: '逻辑复杂度', max: 20 },
    { key: 'integrationScope', label: '系统集成范围', max: 15 },
    { key: 'visualAssets', label: '资源制作量', max: 15 },
    { key: 'compatibility', label: '兼容与同步风险', max: 15 },
    { key: 'versionStability', label: '信息不确定度', max: 10 },
  ];
  return definitions.map((item) => {
    const value = Number(dimensions?.[item.key] || 0);
    const percent = Math.min(100, Math.max(0, Math.round((value / item.max) * 100)));
    return {
      ...item,
      value,
      percent,
      fillColor: dimensionFillColor(percent),
    };
  });
}

function dimensionFillColor(percent: number): string {
  const stops = [
    { at: 0, rgb: [222, 237, 226] },
    { at: 25, rgb: [164, 197, 158] },
    { at: 50, rgb: [214, 181, 91] },
    { at: 75, rgb: [190, 104, 61] },
    { at: 100, rgb: [128, 42, 46] },
  ];
  const value = Math.min(100, Math.max(0, percent));
  for (let index = 1; index < stops.length; index += 1) {
    const right = stops[index];
    const left = stops[index - 1];
    if (value > right.at) continue;
    const ratio = (value - left.at) / (right.at - left.at);
    const rgb = left.rgb.map((channel, channelIndex) =>
      Math.round(channel + (right.rgb[channelIndex] - channel) * ratio),
    );
    return `rgb(${rgb.join(', ')})`;
  }
  return `rgb(${stops[stops.length - 1].rgb.join(', ')})`;
}
