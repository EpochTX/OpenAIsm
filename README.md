最近经常遇到 ChatGPT 节点被风控导致偷偷降智（比如自动切换模型、无痕降级、无法联网或生图等），写了个油猴轻量检测脚本，方便一键自检当前 IP / 账号是否处于降智状态。

### 📦 一键安装

[![一键安装脚本](https://img.shields.io/badge/Tampermonkey-一键安装-black?style=for-the-badge&logo=tampermonkey)](https://raw.githubusercontent.com/EpochTX/OpenAIsm/main/Checker.js)

* 备用安装（国内加速节点）：[点击通过 jsDelivr 安装](https://fastly.jsdelivr.net/gh/EpochTX/OpenAIsm@main/Checker.js)
* 开源项目地址：[EpochTX/OpenAIsm](https://github.com/EpochTX/OpenAIsm)

---

### 💡 使用说明

1. 浏览器需先安装 **Tampermonkey**（油猴）或 **ScriptCat**（脚本猫）插件。
2. 点击上方的【一键安装】按钮，在弹出的窗口中点击 **“安装”** 即可。
3. 打开或刷新 ChatGPT 页面，即可自动/手动检测当前连接状态与权限分配。
4. 如遇误报或失效，欢迎在帖子下方反馈或前往 GitHub 提交 Issue。
