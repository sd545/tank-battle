# Android APK 打包说明

把网页版游戏用 Android WebView 壳打包成可安装的 APK，**完全离线运行**。

## 结构

```
android/
├── AndroidManifest.xml              # 包名 com.sd545.tankbattle，入口 MainActivity
├── src/com/sd545/tankbattle/
│   └── MainActivity.java            # WebView 全屏加载 file:///android_asset/www/index.html
├── res/
│   ├── drawable/ic_launcher.png     # 由 scripts/make_icons.py 生成（勿手动提交）
│   └── values/
│       ├── strings.xml              # 应用名：坦克大战
│       └── styles.xml               # 全屏无标题主题
└── build_apk.sh                     # 一键构建脚本
```

构建时用 `scripts/inline_game.py` 把 Vite 产物（JS/CSS）内联成单个 HTML 放到
`android/assets/www/`（实际路径在 build 目录下生成），因为 **Android WebView 的
file:// 协议会拦截外部 ES module 脚本**，必须单文件内联。

## 一键构建

```bash
# 1. 安装 Android SDK 组件（任一 sdkmanager 均可）
sdkmanager "platforms;android-34" "build-tools;34.0.0"
export ANDROID_HOME=/path/to/android-sdk

# 2. Java 编译：有 JDK 直接用 javac；没有 JDK 就下载 ecj.jar 放到 android/ecj.jar
curl -L -o android/ecj.jar \
  https://repo1.maven.org/maven2/org/eclipse/jdt/ecj/3.37.0/ecj-3.37.0.jar

# 3. 构建（需要 Node.js）
bash android/build_apk.sh
```

产物：`release/tank-battle.apk`（约 120 KB，要求 Android 7.0+）。

## 签名说明

脚本用 `android/build/tank.keystore`（自动生成，调试用途 RSA 2048 / 有效期 10000 天）
签名。自己侧载安装完全没问题；**上架应用商店请换成你自己的正式密钥**，商店会校验
签名一致性，且每个版本必须用同一密钥。

## 已验证的构建环境

- Ubuntu + Android SDK build-tools 34.0.0 + android-34 + OpenJDK 17 / ecj 3.37.0
- minSdk 24 / targetSdk 34 / versionName 1.0
