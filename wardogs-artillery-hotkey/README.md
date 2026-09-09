# 射击播报 F2 助手

用户只需一步：网页点「下载 F2 助手（已含配置）」→ 双击打开 → 游戏内按 F2。

网页会把登录配置写入 exe 末尾，无需再下 json。

重新登录后请重新下载助手。生成的 exe 含令牌，不要发给别人。

## 维护者重新打包模板 exe

```bat
py -3 -m pip install pyinstaller pynput
py -3 -m PyInstaller --noconfirm --clean --onefile --name uss-arty-f2 --console artillery-f2-hotkey.py
copy /Y dist\uss-arty-f2.exe .
```
