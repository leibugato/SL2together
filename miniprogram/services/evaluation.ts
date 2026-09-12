import type { Evaluation, EvaluationJob, Submission } from '../types/domain';
import { callApi, callEvaluationRunner } from './cloud';

interface StartEvaluationResponse {
  cached: boolean;
  job: EvaluationJob | null;
  evaluation: Evaluation | null;
  catalogVersion: string;
}

interface GetEvaluationResponse {
  job: EvaluationJob | null;
  evaluation: Evaluation | null;
  submission?: Submission | null;
}

export interface EvaluationRunResult {
  evaluation: Evaluation;
  cached: boolean;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runEvaluation(submissionId: string, mode = 'quick'): Promise<EvaluationRunResult> {
  const started = await callApi<StartEvaluationResponse>('evaluation.start', {
    submissionId,
    mode,
  });

  if (started.cached && started.evaluation) {
    return { evaluation: started.evaluation, cached: true };
  }

  if (!started.job?._id) {
    throw new Error('评估任务创建失败。');
  }

  await callEvaluationRunner<{ evaluation?: Evaluation }>(started.job._id);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const result = await callApi<GetEvaluationResponse>('evaluation.get', {
      submissionId,
    });
    if (result.evaluation) {
      return { evaluation: result.evaluation, cached: false };
    }
    if (result.job?.status === 'FAILED') {
      throw new Error(result.job.errorMessage || '评估失败，请稍后在详情页重试。');
    }
    await wait(700);
  }

  throw new Error('评估任务仍在处理中，请稍后在详情页查看结果。');
}

export function getEvaluation(params: { evaluationId?: string; submissionId?: string }) {
  return callApi<GetEvaluationResponse>('evaluation.get', params);
}
