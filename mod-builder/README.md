# SL2Together Mod Builder

本地 MOD 生成与构建工具。第一版只生成卡牌、遗物和 Buff/Power，并且只允许白名单内的效果与触发方式。

## 生成内容

每个任务输出：

```text
<mod-id>/
├── ModInitializer.cs
├── project.godot
├── sl2mod.csproj
├── export_presets.cfg
├── build/<mod-id>.json
├── src/Core/Models/Cards/
├── images/
└── <mod-id>/localization/zhs/
```

完整构建后额外生成：

```text
build/<mod-id>.dll
build/<mod-id>.pck
dist/<mod-id>.zip
dist/<mod-id>-source.zip
```

## 环境变量

```text
STS2_DLL_DIR=包含 sts2.dll、GodotSharp.dll、0Harmony.dll 的私有目录
GODOT_BIN=Godot 4.5.1 .NET 可执行文件
STS2_MOD_FONT=可选，中文字体文件路径
```

## 示例

```powershell
python -m sl2modgen generate `
  mod-builder/examples/card_burning.json `
  .tmp/generated-burning

python -m sl2modgen build `
  mod-builder/examples/card_burning.json `
  .tmp/generated-burning `
  --game-dir "C:\Users\akaset\Desktop\sl2_mod\sl2dll" `
  --godot "C:\Users\akaset\Desktop\sl2_mod\Godot_v4.5.1-stable_mono_win64\Godot_v4.5.1-stable_mono_win64.exe"
```

“焚烧”不是新增的全局关键词。它表示用户提出类似“卡牌被消耗后自动打出”的需求时，生成器检查 `AUTO_PLAY_FROM_EXHAUST` 白名单行为是否能够表达该设计。
