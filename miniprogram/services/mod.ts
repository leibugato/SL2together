import { callApi } from './cloud';
import type { Evaluation, ModGenerationJob, Submission } from '../types/domain';

export interface GenerateModResponse {
  job: ModGenerationJob;
  evaluation: Evaluation;
}

export interface GetModResponse {
  job: ModGenerationJob;
}

export function generateMod(submissionId: string) {
  return callApi<GenerateModResponse>('mod.generate', { submissionId });
}

export function getModJob(jobId: string) {
  return callApi<GetModResponse>('mod.get', { jobId });
}

export function getLatestModJob(submissionId: string) {
  return callApi<GetModResponse>('mod.get', { submissionId });
}

export async function getCloudFileTempUrl(fileId: string) {
  const result = await wx.cloud.getTempFileURL({
    fileList: [fileId],
  });
  const item = result?.fileList?.[0];
  if (!item?.tempFileURL) {
    throw new Error('下载链接生成失败。');
  }
  return item.tempFileURL as string;
}

export async function shareCloudFile(fileId: string, fileName: string) {
  const downloaded = await wx.cloud.downloadFile({
    fileID: fileId,
  });
  await wx.shareFileMessage({
    filePath: downloaded.tempFilePath,
    fileName,
  });
}
