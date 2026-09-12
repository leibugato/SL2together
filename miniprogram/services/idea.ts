import { callApi } from './cloud';
import type {
  DashboardResponse,
  EvaluationStatus,
  IdeaType,
  ListResponse,
  Submission,
  SubmissionStatus,
} from '../types/domain';
import type { IdeaForm } from '../utils/validation';

export interface UserBootstrap {
  user: {
    nickname: string;
    avatarUrl: string;
    createdAt: string;
  };
  openid: string;
}

export interface IdeaSaveResponse {
  submission: Submission;
}

export interface IdeaDetailResponse {
  submission: Submission;
  evaluation: import('../types/domain').Evaluation | null;
  evaluationStale: boolean;
}

export function bootstrapUser() {
  return callApi<UserBootstrap>('user.bootstrap');
}

export function createIdea(form: IdeaForm, status: 'DRAFT' | 'SUBMITTED') {
  return callApi<IdeaSaveResponse>('idea.create', { form, status });
}

export function updateIdea(
  id: string,
  form: IdeaForm,
  status: 'DRAFT' | 'SUBMITTED',
  expectedVersion: number,
) {
  return callApi<IdeaSaveResponse>('idea.update', { id, form, status, expectedVersion });
}

export function listIdeas(params: {
  page?: number;
  pageSize?: number;
  type?: IdeaType | '';
  status?: SubmissionStatus | '';
  evaluationStatus?: EvaluationStatus | '';
  difficulty?: string;
}) {
  return callApi<ListResponse>('idea.listMine', params);
}

export function getIdea(id: string) {
  return callApi<IdeaDetailResponse>('idea.getMine', { id });
}

export function deleteIdea(id: string) {
  return callApi<{ deleted: boolean }>('idea.deleteMine', { id });
}

export function submitIdea(id: string) {
  return callApi<IdeaSaveResponse>('idea.submitMine', { id });
}

export function getDashboard() {
  return callApi<DashboardResponse>('idea.dashboard');
}
