# CloudBase Run 部署

`mod-builder` 使用 Linux 自定义容器。镜像中不包含游戏程序集，引用 DLL 必须从私有地址下载。

`--export-pack` 只生成 PCK，不需要安装完整 Godot 导出模板，因此镜像只包含 Godot .NET 编辑器。

## 镜像内环境

```text
GODOT_BIN=/usr/local/bin/godot
PORT=8080
```

## 部署时必须配置

```text
MOD_BUILD_TOKEN=随机长字符串
STS2_REFERENCE_URL=私有ZIP的临时或长期签名地址
MAX_ARTIFACT_BYTES=20971520
```

私有 ZIP 根目录必须包含：

```text
sts2.dll
GodotSharp.dll
0Harmony.dll
```

容器首次收到构建请求时下载并缓存引用包到 `/tmp/sl2-reference-kit`。实例重建后会重新下载。

## 构建镜像

在仓库根目录执行：

```powershell
docker build -t sl2together-mod-builder .
```

CloudBase 的 Git 源码部署选择仓库根目录，Dockerfile 名称填写 `Dockerfile`。

## CloudBase Run 建议配置

| 项目 | 建议 |
| --- | --- |
| 服务名 | `mod-builder` |
| 环境 | `cloud1-d4gz1gjvmac6f5550` |
| 容器 | 自定义容器 |
| CPU | 2 核 |
| 内存 | 4 GB |
| 最小实例 | 0 |
| 最大实例 | 1 |
| 请求超时 | 5 分钟以上 |
| 公网访问 | 仅云函数调用，不对小程序客户端暴露 |

## 接口

健康检查：

```http
GET /health
```

构建：

```http
POST /build
Authorization: Bearer <MOD_BUILD_TOKEN>
Content-Type: application/json

{
  "jobId": "job_xxx",
  "spec": {}
}
```

返回两个 ZIP 的 Base64。微信云函数负责把 Base64 写入云存储，并清理任务记录。不要把 `MOD_BUILD_TOKEN` 放进小程序代码。
