import { CloudApiError } from './cloud';

interface AdminResponse<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryable?: boolean;
  };
  requestId?: string;
}

export interface AdminIdentity {
  isAdmin: boolean;
  role: 'SUPER_ADMIN' | 'MODERATOR' | 'VIEWER' | null;
  canExport: boolean;
}

export interface AdminSubmissionRow {
  _id: string;
  ownerRef: string;
  ownerLabel: string;
  type: import('../types/domain').IdeaType;
  name: string;
  status: import('../types/domain').SubmissionStatus;
  evaluationStatus: import('../types/domain').EvaluationStatus;
  contentVersion: number;
  updatedAt: string;
  latestDifficulty: {
    level: import('../types/domain').DifficultyLevel;
    label: string;
    score: number;
  } | null;
}

export interface AdminExportResult {
  fileID: string;
  fileName: string;
  count: number;
}

export async function callAdminApi<T>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  try {
    const response = await wx.cloud.callFunction({
      name: 'adminApi',
      data: {
        action,
        ...payload,
      },
    });
    const result = response.result as AdminResponse<T>;
    if (!result?.ok) {
      throw new CloudApiError(
        result?.error?.code || 'INTERNAL_ERROR',
        result?.error?.message || '管理接口暂时不可用。',
        Boolean(result?.error?.retryable),
      );
    }
    return result.data as T;
  } catch (error) {
    if (error instanceof CloudApiError) throw error;
    const message = error instanceof Error ? error.message : '管理接口调用失败。';
    throw new CloudApiError('NETWORK_ERROR', message, true);
  }
}

export function getAdminIdentity() {
  return callAdminApi<AdminIdentity>('admin.me');
}

export function listAdminSubmissions(params: {
  type?: string;
  status?: string;
  userRef?: string;
}) {
  return callAdminApi<{ items: AdminSubmissionRow[]; total: number }>(
    'admin.listSubmissions',
    params,
  );
}

export function exportAdminSubmissions(params: {
  submissionIds?: string[];
  type?: string;
  status?: string;
  userRef?: string;
  startAt?: string;
  endAt?: string;
  limit?: number;
}) {
  return callAdminApi<AdminExportResult>('admin.exportSubmissions', params);
}

