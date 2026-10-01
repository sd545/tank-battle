#!/usr/bin/env bash
# 一键构建坦克大战 Android APK（免 Gradle，纯命令行工具链）
#
# 前置依赖：
#   1. Node.js + npm（构建网页版产物）
#   2. JDK（javac）或 ecj.jar（Eclipse 编译器，单 jar 即可）
#      下载: https://repo1.maven.org/maven2/org/eclipse/jdt/ecj/3.37.0/ecj-3.37.0.jar
#   3. Android SDK 平台与构建工具，通过环境变量指定：
#      export ANDROID_HOME=/path/to/android-sdk
#      需要 platforms/android-34/android.jar 与 build-tools/34.0.0/ 下的
#      aapt2、d8、zipalign、apksigner
#
# 用法: bash android/build_apk.sh
# 产物: release/tank-battle.apk
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
BT="${BT:-$ANDROID_HOME/build-tools/34.0.0}"
AJAR="${AJAR:-$ANDROID_HOME/platforms/android-34/android.jar}"
MIN_SDK=24
TARGET_SDK=34
PKG=com.sd545.tankbattle
BUILD="$ROOT/android/build"
OUT="$ROOT/release"

for tool in "$BT/aapt2" "$BT/d8" "$BT/zipalign" "$BT/apksigner"; do
    [ -x "$tool" ] || { echo "缺少构建工具: $tool（请设置 ANDROID_HOME 或 BT/AJAR 环境变量）"; exit 1; }
done
[ -f "$AJAR" ] || { echo "缺少 android.jar: $AJAR"; exit 1; }

echo "==> [1/8] 构建网页版产物 (npm run build)"
npm install --no-audit --no-fund
npm run build

echo "==> [2/8] 内联成单文件 HTML（WebView file:// 兼容）"
mkdir -p "$BUILD"
python3 scripts/inline_game.py dist "$BUILD/assets/www/index.html"

echo "==> [3/8] 生成启动图标"
python3 scripts/make_icons.py
mkdir -p android/res/drawable
cp public/icons/icon-192.png android/res/drawable/ic_launcher.png

echo "==> [4/8] 编译资源并链接 base.apk"
"$BT/aapt2" compile --dir android/res -o "$BUILD/res.zip"
"$BT/aapt2" link -o "$BUILD/base.apk" \
    --manifest android/AndroidManifest.xml \
    -I "$AJAR" --java "$BUILD/gen" \
    --min-sdk-version $MIN_SDK --target-sdk-version $TARGET_SDK \
    --version-code 1 --version-name 1.0 \
    -A "$BUILD/assets" "$BUILD/res.zip"

echo "==> [5/8] 编译 Java（MainActivity + R）"
mkdir -p "$BUILD/classes"
cd "$ROOT"
if command -v javac >/dev/null 2>&1; then
    javac -source 17 -target 17 -encoding UTF-8 -nowarn -cp "$AJAR" \
        -d "$BUILD/classes" \
        android/src/$PKG/MainActivity.java "$BUILD/gen/$PKG/R.java"
else
    ECJ="${ECJ:-$ROOT/android/ecj.jar}"
    [ -f "$ECJ" ] || ECJ="$BUILD/ecj.jar"
    [ -f "$ECJ" ] || { echo "未找到 javac，也未找到 ecj.jar，请下载后放到 android/ecj.jar"; exit 1; }
    java -jar "$ECJ" -17 -nowarn -encoding UTF-8 -cp "$AJAR" \
        -d "$BUILD/classes" \
        android/src/$PKG/MainActivity.java "$BUILD/gen/$PKG/R.java"
fi
cd "$BUILD/classes" && zip -q -r "$BUILD/classes.jar" . && cd "$ROOT"

echo "==> [6/8] d8 转 dex 并注入 APK"
"$BT/d8" --lib "$AJAR" --min-api $MIN_SDK --output "$BUILD/dex.jar" "$BUILD/classes.jar"
mkdir -p "$BUILD/dex" && (cd "$BUILD/dex" && unzip -o -q "$BUILD/dex.jar")
cp "$BUILD/base.apk" "$BUILD/unsigned.apk"
(cd "$BUILD/dex" && zip -qru "$BUILD/unsigned.apk" classes.dex)

echo "==> [7/8] 生成签名密钥（如不存在）"
KS="$BUILD/tank.keystore"
if [ ! -f "$KS" ]; then
    keytool -genkeypair -v -keystore "$KS" -alias tank \
        -keyalg RSA -keysize 2048 -validity 10000 \
        -storepass tankbattle -keypass tankbattle \
        -dname "CN=Tank Battle, OU=Game, O=sd545, C=CN" >/dev/null
fi

echo "==> [8/8] zipalign + 签名"
mkdir -p "$OUT"
"$BT/zipalign" -f -p 4 "$BUILD/unsigned.apk" "$BUILD/aligned.apk"
"$BT/apksigner" sign --ks "$KS" --ks-pass pass:tankbattle --key-pass pass:tankbattle \
    --out "$OUT/tank-battle.apk" "$BUILD/aligned.apk"
"$BT/apksigner" verify --print-certs "$OUT/tank-battle.apk"

echo ""
echo "完成: $OUT/tank-battle.apk"
