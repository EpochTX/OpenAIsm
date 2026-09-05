最近不少节点被风控搞得很烦，ChatGPT 经常无痕偷换模型、降级或者限制功能。随手搓了个油猴脚本，用来抓包对比请求模型和服务端实际回包的模型 tag，看看有没有被偷换路由。

### 安装地址

[![一键安装](https://img.shields.io/badge/Tampermonkey-一键安装-black?style=for-the-badge&logo=tampermonkey)](https://raw.githubusercontent.com/EpochTX/OpenAIsm/main/Checker.user.js)

* 国内镜像：[jsDelivr 安装链接](https://fastly.jsdelivr.net/gh/EpochTX/OpenAIsm@main/Checker.user.js)
* 仓库源码：[EpochTX/OpenAIsm](https://github.com/EpochTX/OpenAIsm)

### 说明

1. 装好 Tampermonkey，点上面的按钮直接装。
2. 刷新 ChatGPT 发消息就能看检测结果。
3. 记得先去仓库把原文件改名为 `Checker.user.js`，不然浏览器识别不到油猴头。

有 bug 随时回帖反馈。
