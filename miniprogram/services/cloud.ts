export class CloudApiError extends Error {
  code: string;
  retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = 'CloudApiError';
    this.code = code;
    this.retryable = retryable;
  }
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryable?: boolean;
  };
  requestId?: string;
}

export async function callApi<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  try {
    const response = await wx.cloud.callFunction({
      name: 'api',
      data: {
        action,
        ...payload,
      },
    });
    const result = response.result as ApiResponse<T>;
    if (!result?.ok) {
      throw new CloudApiError(
        result?.error?.code || 'INTERNAL_ERROR',
        result?.error?.message || '服务暂时不可用，请稍后重试。',
        Boolean(result?.error?.retryable),
      );
    }
    return result.data as T;
  } catch (error) {
    if (error instanceof CloudApiError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : '云函数调用失败。';
    throw new CloudApiError('NETWORK_ERROR', message, true);
  }
}

export async function callEvaluationRunner<T>(jobId: string): Promise<T> {
  try {
    const response = await wx.cloud.callFunction({
      name: 'evaluationRunner',
      data: { jobId },
    });
    const result = response.result as ApiResponse<T>;
    if (!result?.ok) {
      throw new CloudApiError(
        result?.error?.code || 'INTERNAL_ERROR',
        result?.error?.message || '评估执行失败。',
        Boolean(result?.error?.retryable),
      );
    }
    return result.data as T;
  } catch (error) {
    if (error instanceof CloudApiError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : '评估云函数调用失败。';
    throw new CloudApiError('NETWORK_ERROR', message, true);
  }
}

