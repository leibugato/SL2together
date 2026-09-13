// 在微信开发者工具中开通云开发后，把环境 ID 填在这里。
// 例如：sts2-mod-dev-1g2h3i4j5k6l
export const ENV_ID = 'cloud1-d4gz1gjvmac6f5550';

export const APP_NAME = 'SL2Together';
export const APP_ENV = ENV_ID ? 'cloud' : 'local-unconfigured';

export function isCloudConfigured(): boolean {
  return Boolean(ENV_ID);
}
