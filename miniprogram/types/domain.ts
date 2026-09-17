export const IDEA_TYPES = [
  { value: 'CARD', label: '卡牌', shortLabel: '卡' },
  { value: 'RELIC', label: '遗物', shortLabel: '遗' },
  { value: 'EVENT', label: '事件', shortLabel: '事' },
  { value: 'CHARACTER', label: '角色', shortLabel: '角' },
  { value: 'ANCIENT', label: '先古之民', shortLabel: '古' },
  { value: 'SKIN', label: '替换皮肤', shortLabel: '皮' },
  { value: 'MONSTER', label: '怪物', shortLabel: '怪' },
  { value: 'BOSS', label: 'Boss', shortLabel: 'B' },
  { value: 'VOICE', label: '语音替换', shortLabel: '声' },
  { value: 'BUFF', label: 'Buff', shortLabel: 'B' },
] as const;

export type IdeaType = (typeof IDEA_TYPES)[number]['value'];

export const SUBMISSION_STATUSES = {
  DRAFT: '草稿',
  SUBMITTED: '已提交',
} as const;

export type SubmissionStatus = keyof typeof SUBMISSION_STATUSES;

export const EVALUATION_STATUSES = {
  NOT_EVALUATED: '未评估',
  QUEUED: '排队中',
  RUNNING: '评估中',
  RETRYING: '重试中',
  SUCCEEDED: '已评估',
  FAILED: '评估失败',
} as const;

export type EvaluationStatus = keyof typeof EVALUATION_STATUSES;

export const DIFFICULTY_LABELS = {
  SIMPLE: '简单',
  MEDIUM: '中等',
  HARD: '困难',
  EXTREME: '极难',
} as const;

export type DifficultyLevel = keyof typeof DIFFICULTY_LABELS;

export interface ExtraField {
  key: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'number';
}

export const TYPE_EXTRA_FIELDS: Record<IdeaType, ExtraField[]> = {
  CARD: [
    { key: 'cost', label: '费用', placeholder: '例如 1', type: 'number' },
    { key: 'cardType', label: '卡牌类型', placeholder: '攻击 / 技能 / 能力' },
    { key: 'targetType', label: '目标', placeholder: '敌人 / 自己 / 全体' },
    { key: 'rarity', label: '稀有度', placeholder: '普通 / 罕见 / 稀有' },
    { key: 'upgrade', label: '升级变化', placeholder: '升级后的数值或效果' },
  ],
  RELIC: [
    { key: 'rarity', label: '稀有度', placeholder: '普通 / 罕见 / 稀有 / Boss' },
    { key: 'acquisition', label: '获得方式', placeholder: '战斗 / 事件 / 商店' },
    { key: 'trigger', label: '触发时机', placeholder: '战斗开始 / 回合结束等' },
  ],
  EVENT: [
    { key: 'chapter', label: '出现章节', placeholder: '第一章 / 第二章 / 任意章节' },
    { key: 'optionCount', label: '选项数量', placeholder: '例如 3', type: 'number' },
    { key: 'reward', label: '奖励或惩罚', placeholder: '主要选项结果' },
  ],
  CHARACTER: [
    { key: 'resource', label: '核心资源', placeholder: '角色专属能量或机制' },
    { key: 'startingDeck', label: '初始牌组', placeholder: '结构和核心牌' },
    { key: 'startingRelic', label: '起始遗物', placeholder: '名称与效果' },
    { key: 'keywords', label: '机制关键词', placeholder: '用顿号分隔' },
  ],
  ANCIENT: [
    { key: 'chapter', label: '所属章节', placeholder: '章节与出现节点' },
    { key: 'relicCount', label: '遗物选项数量', placeholder: '例如 3', type: 'number' },
    { key: 'dialogueScale', label: '对话规模', placeholder: '短对话 / 多轮对话' },
  ],
  SKIN: [
    { key: 'target', label: '替换对象', placeholder: '角色 / 卡面 / 场景 / 动画' },
    { key: 'assetScale', label: '资源规模', placeholder: '贴图数量、分辨率或时长' },
    { key: 'animation', label: '动画改动', placeholder: '无 / 局部 / 完整替换' },
  ],
  MONSTER: [
    { key: 'chapter', label: '出现章节', placeholder: '章节和遭遇类型' },
    { key: 'behavior', label: '行为模式', placeholder: '循环、条件或随机行为' },
    { key: 'intentCount', label: '意图数量', placeholder: '例如 4', type: 'number' },
    { key: 'scene', label: '场景与动画', placeholder: '所需资源范围' },
  ],
  BOSS: [
    { key: 'chapter', label: '所属章节', placeholder: '章节与节点' },
    { key: 'phases', label: '阶段数', placeholder: '例如 2', type: 'number' },
    { key: 'encounter', label: '遭遇配置', placeholder: '血量、小怪、卡池限制' },
    { key: 'music', label: '专属音乐', placeholder: '是否需要新音乐' },
  ],
  VOICE: [
    { key: 'character', label: '替换角色', placeholder: '角色或敌人' },
    { key: 'lines', label: '台词数量', placeholder: '例如 80', type: 'number' },
    { key: 'triggerScope', label: '触发范围', placeholder: '战斗 / 选择 / 事件' },
    { key: 'language', label: '语言', placeholder: '中文 / 英文 / 其他' },
  ],
  BUFF: [
    { key: 'polarity', label: '增益或减益', placeholder: 'Buff / Debuff' },
    { key: 'stackType', label: '叠加方式', placeholder: '层数 / 强度 / 不可叠加' },
    { key: 'duration', label: '持续时间', placeholder: '本回合 / 本场战斗 / 永久' },
    { key: 'trigger', label: '触发时机', placeholder: '受到伤害、打出卡牌等' },
  ],
};

export interface Submission {
  _id: string;
  type: IdeaType;
  name: string;
  designText: string;
  resourceUrl: string;
  extra: Record<string, string | number | boolean>;
  status: SubmissionStatus;
  evaluationStatus: EvaluationStatus;
  contentVersion: number;
  contentHash: string;
  latestEvaluationId?: string;
  latestEvaluation?: EvaluationSummary;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string | null;
  deletedAt?: string | null;
}

export interface EvaluationSummary {
  _id?: string;
  difficulty: {
    level: DifficultyLevel;
    label: string;
    score: number;
    confidence: number;
    provisional: boolean;
  };
  summary: string;
  implementationBrief?: string;
  createdAt?: string;
}

export interface Evaluation extends EvaluationSummary {
  _id: string;
  submissionId: string;
  contentVersion: number;
  contentHash: string;
  implementationBrief: string;
  reasons: string[];
  risks: string[];
  suggestions: string[];
  missingInformation: string[];
  technicalAnchors: Array<{
    kind: string;
    name: string;
    usage: string;
    confidence: number;
  }>;
  dimensions: Record<string, number>;
  modGeneration?: {
    version?: string;
    supported: boolean;
    reason: string;
    spec: Record<string, unknown> | null;
  } | null;
  model: {
    provider: string;
    model: string;
    promptVersion: string;
    catalogVersion: string;
  };
}

export interface ModGenerationJob {
  _id: string;
  submissionId: string;
  evaluationId: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  contentVersion: number;
  contentHash: string;
  manifest: {
    id: string;
    name: string;
    version: string;
  } | null;
  testGuide: {
    title: string;
    consoleKey: string;
    modId: string;
    modName: string;
    contentId: string;
    steps: string[];
    commands: Array<{
      label: string;
      command: string;
      description: string;
    }>;
    notes: string[];
  } | null;
  modFileId: string;
  sourceFileId: string;
  modZipSize: number;
  sourceZipSize: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface EvaluationJob {
  _id: string;
  submissionId: string;
  contentHash: string;
  status: 'QUEUED' | 'RUNNING' | 'RETRYING' | 'SUCCEEDED' | 'FAILED';
  attempts: number;
  maxAttempts: number;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface ListResponse {
  items: Submission[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DashboardResponse {
  total: number;
  drafts: number;
  submitted: number;
  evaluating: number;
  evaluated: number;
}
