# 拒绝付费与臃肿！我为NAS党手撸了一个极简且强大的云图库——CloudImgs（云图）

大家好，我是 **云舟实验室**。

今天想和大家分享一个我最近开发的开源项目——**云图 (CloudImgs)**。

这是一个极简风格的自建图床/云图库，支持 **Docker 一键部署**，完美适配 **NAS** 环境，并且拥有超灵活的 **API 接口**。

![云图](https://fastly.jsdelivr.net/gh/bucketio/img12@main/2025/12/28/1766885915244-31e3c67a-ffc5-422f-afa7-98fd55ebb438.png)


## 🛠️ 为什么要造这个轮子？

说实话，起初我并没有打算写个图床。

事情的起因是我在使用 **N8N** 处理自动化工作流时，遇到了大量的图片处理需求。我尝试寻找现有的开源解决方案，但结果并不理想：

* **太老旧**：很多曾经优秀的开源项目已经几年没更新了，UI 停留在十年前，代码维护也停滞了。
* **要付费**：好用一点的现代图床，往往需要购买 PRO 版本才能解锁高级功能（如图片压缩、格式转换等）。
* **功能过剩或不足**：有的太复杂，有的又太简陋，不支持 API 自动化调用。

既然我自己有 **NAS**，又懂一点代码，为什么不自己写一个呢？于是，**云图 (CloudImgs)** 诞生了。它主打**自由、开放、极简**，专为解决实际问题而来。

---

## 🖥️ 在线体验

先别急着看技术细节，大家可以直接上手体验一下 UI 和交互。

* **演示地址**：[https://yt.qazz.site](https://yt.qazz.site)
* **访问密码**：`123456`

> **⚠️ 注**：演示站为纯静态 Mock 模式，上传/删除仅演示 UI 交互，数据不保存。真实部署后，体验会更好（特别是缩略图加载）。

---

## ✨ 核心亮点：不仅仅是存图片

### 1. 颜值即正义：极简瀑布流 & 丝滑交互

我们抛弃了繁杂的后台界面，采用现代化的瀑布流布局。集成 **ThumbHash** 技术，在图片未完全加载时通过算法生成极小的占位哈希图，实现无感加载，告别“白屏”等待，视觉体验极佳。

### 2. 生产力工具：PicGo 插件无缝集成

对于写博客、Markdown 文档的朋友，图床的便捷性至关重要。云图**原生支持 PicGo**，我已经写好了对应的插件，安装即用。截图 -> 自动上传 -> 粘贴链接，一气呵成。

* [PicGo 插件地址](https://github.com/qazzxxx/picgo-plugin-cloudimgs-uploader)

### 3. 开发者福音：强大的实时处理 API

这是我最自豪的功能之一。云图不仅仅是存储，还是一个**即时的图片处理引擎**。你可以通过 URL 参数实时处理图片：

* **格式转换**：`image.jpg?fmt=webp` (自动转 WebP，节省带宽)
* **尺寸调整**：`image.jpg?w=500&h=300` (强制缩放)
* **质量压缩**：`image.jpg?q=80` (80% 质量压缩)

这就意味着，你上传一张 4K 原图，在不同设备上可以通过参数调用不同尺寸的缩略图，极大减轻前端压力。

### 4. 全能管理与安全

* **多级目录**：支持文件夹管理，井井有条。
* **隐私保护**：支持设置访问密钥，保护你的私有图片。
* **全格式支持**：不仅仅是 JPG/PNG，SVG 甚至其他文件格式也能传。
* **SVG 转 PNG**：专为设计师和前端优化的功能。
* **批量操作**：支持圈选批量删除，效率拉满。

---

## 📸 更多界面预览

**登录页面**：简洁大方，支持密码保护。
![登录页面](https://fastly.jsdelivr.net/gh/bucketio/img13@main/2025/12/28/1766885631052-9ca708a9-3416-40fc-b063-fc20a067a73b.jpg)

**瀑布流管理图片**：支持瀑布流展示管理图片。
![瀑布流管理图片](https://fastly.jsdelivr.net/gh/bucketio/img10@main/2025/12/28/1766885826656-a2c26f51-c957-4e83-98e3-da69be485dcb.jpg)


**批量操作**：支持圈选多图一键操作。
![批量操作](https://fastly.jsdelivr.net/gh/bucketio/img4@main/2025/12/28/1766885797912-d3a5031b-764e-443a-b09d-84bb91aca4d3.jpg)


**整页上传**：支持多图拖拽一键上传。
![整页上传](https://fastly.jsdelivr.net/gh/bucketio/img18@main/2025/12/28/1766885649610-3feef228-a3d9-4553-876b-feee12f7396f.jpg)


**相册分享**：一键生成分享链接，发给朋友。
![相册分享](https://fastly.jsdelivr.net/gh/bucketio/img10@main/2025/12/28/1766885659322-a8c942d7-ee00-42df-b16d-7aa3401d519c.jpg)

**开放API**：灵活调用开放API。
![开放API](https://fastly.jsdelivr.net/gh/bucketio/img2@main/2025/12/28/1766885886202-17cc6cc7-0712-4383-a25a-61c30fc33201.jpg)


---

## 🚀 极速部署 (NAS/Docker)

作为 NAS 党，我深知部署难度的痛点。云图完全 Docker 化，只需要一个 `docker-compose.yml` 即可跑起来。

### 1. 创建 docker-compose.yml

```yaml
services:
  cloudimgs:
    image: qazzxxx/cloudimgs:latest
    ports:
      - "3001:3001"
    volumes:
      - ./uploads:/app/uploads:rw # 图片数据存储位置
    restart: unless-stopped
    container_name: cloudimgs-app
    environment:
      - PUID=1000  # 替换为你 NAS 用户的 UID (终端输入 id -u 查看)
      - PGID=1000  # 替换为你 NAS 用户组的 GID (终端输入 id -g 查看)
      - UMASK=002
      - NODE_ENV=production
      - PORT=3001
      - STORAGE_PATH=/app/uploads
      # 👇 如果需要密码访问，请取消下面这行的注释并修改密码
      # - PASSWORD=your_secure_password_here

```

### 2. 启动服务

```bash
docker-compose up -d

```

启动后，访问 `http://ip:3001` 即可开始使用！

### 关于密码保护

如果你是在公网环境或者不想让别人随意查看，强烈建议在环境变量中配置 `PASSWORD`。配置后，访问系统需要输入密码，且状态会保存在本地浏览器中，既安全又不用频繁登录。

---

## 🔗 项目地址

开源不易，如果你觉得「云图」还不错，或者帮到了你的忙，希望能去 GitHub 点个 **Star ⭐️** 支持一下！这也是我持续维护的动力。

* **GitHub 项目地址**: [https://github.com/qazzxxx/cloudimgs](https://github.com/qazzxxx/cloudimgs)
* **PicGo 插件**: [https://github.com/qazzxxx/picgo-plugin-cloudimgs-uploader](https://github.com/qazzxxx/picgo-plugin-cloudimgs-uploader)

如果你在使用过程中遇到任何问题，欢迎在 GitHub 提 Issue 或在评论区留言，我会尽快回复大家！

---

**云舟实验室**
*专注分享好用的开源项目与技术折腾心得*