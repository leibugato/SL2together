# SL2Together Mod Builder

本地 MOD 生成与构建工具。第一版只生成卡牌、遗物和 Buff/Power，并且只允许白名单内的效果与触发方式。

遗物或 Buff 支持在打出卡牌后，使所有敌人直接失去指定生命值；该效果按不可格挡、不受力量等伤害修正影响的直接生命损失实现。

卡牌可以选择无色池或某个角色的角色卡池。遗物可以选择通用遗物池或角色专属遗物池；普通、罕见和稀有的遗物进入随机奖励抓取池，`Shop` 稀有度进入商店遗物槽。

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
├── QUICK_TEST.md
└── <mod-id>/localization/zhs/
```

完整构建后额外生成：

```text
build/<mod-id>.dll
build/<mod-id>.pck
dist/<mod-id>.zip
dist/<mod-id>-source.zip
```

生成名称包含用户短标识和设计名，例如 `用户A1B2C3D4·焚烧打击`。`QUICK_TEST.md` 同时包含在 MOD ZIP 和源码 ZIP 中，并提供游戏控制台测试命令。

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
