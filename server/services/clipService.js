const config = require('../../config');
const db = require('../db/database');
const path = require('path');
const fs = require('fs-extra');

// 模型缓存放在存储目录（uploads）下，随现有的 ./uploads 卷持久化，
// 用户无需额外配置卷即可保留已下载的模型，避免每次重建容器都重下几百 MB。
// 与数据库位置（<storage>/.cache/cloudimgs.db）保持一致。
const HF_CACHE_DIR = path.resolve(config.storage.path, '.cache', 'huggingface');
fs.ensureDirSync(HF_CACHE_DIR);

let Pipeline = null;

class ClipService {
    static purgeCorruptCache(modelName) {
        const cacheBase = path.join(HF_CACHE_DIR, modelName);
        try {
            fs.removeSync(cacheBase);
            console.warn(`[MagicSearch] Purged corrupt cache for ${modelName} at ${cacheBase}`);
        } catch (e) {
            console.error(`[MagicSearch] Failed to purge cache for ${modelName}:`, e);
        }
    }

    // The error path contains the actual cache location, e.g.
    // /app/uploads/.cache/huggingface/Xenova/opus-mt-zh-en/onnx/encoder_model_quantized.onnx
    // Extract the model id so we purge the corrupt file, not some other model.
    static extractModelFromError(error) {
        const msg = String(error?.message || error);
        const m = msg.match(/huggingface\/([^/]+\/[^/]+)\//);
        return m ? m[1] : null;
    }

    static isCorruptModelError(error) {
        const msg = String(error?.message || error);
        return msg.includes('Protobuf parsing failed') ||
            (msg.includes('Load model') && msg.includes('failed'));
    }

    // 翻译模型连续加载失败多少次后，本会话内熔断（停止重试），避免每次搜索都被拖慢。
    static MAX_TRANSLATOR_FAILURES = 2;

    // 校验单个 ONNX 文件是否完整有效。
    // @huggingface/transformers 导出的 ONNX ModelProto 头部有固定特征：
    //   08 <ir_version> 12 0d 6f6e6e78 ...  →  field1=ir_version, field2=producer_name="onnx.quantiz..."
    // 损坏/截断的下载（Git-LFS 指针、HTML/JSON 错误页、半截二进制）都不会带这个头部，
    // 因此只读前 8 字节即可廉价识别，无需把几十上百 MB 的文件读进内存。
    // （旧的体积校验只挡 <1MB 的文件，NAS 上半截下载/镜像错误页常 >1MB，从而绕过校验）
    static isValidOnnxFile(filePath) {
        try {
            const fd = fs.openSync(filePath, 'r');
            const buf = Buffer.alloc(8);
            const n = fs.readSync(fd, buf, 0, 8, 0);
            fs.closeSync(fd);
            if (n < 8) return false;
            // byte0=0x08(ir_version tag) · byte2=0x12(producer_name tag) · bytes4-7="onnx"
            return buf[0] === 0x08 && buf[2] === 0x12 && buf.toString('ascii', 4, 8) === 'onnx';
        } catch (e) {
            return false;
        }
    }

    // 校验某模型目录下的指定 ONNX 文件，任一损坏则整体清理缓存（让下次重新下载）。
    // 返回 true 表示发现并清理了损坏缓存。
    static purgeCorruptModelFiles(modelName, onnxFiles) {
        const onnxDir = path.join(HF_CACHE_DIR, modelName, 'onnx');
        for (const name of onnxFiles) {
            const fp = path.join(onnxDir, name);
            if (fs.existsSync(fp) && !ClipService.isValidOnnxFile(fp)) {
                console.warn(`[MagicSearch] Corrupt ONNX detected: ${modelName}/onnx/${name}`);
                ClipService.purgeCorruptCache(modelName);
                return true;
            }
        }
        return false;
    }

    constructor() {
        this.modelName = config.magicSearch.modelName || 'Xenova/clip-vit-base-patch32';
        this.tokenizer = null;
        this.processor = null;
        this.model = null;
        this.visionModel = null;
        this.textModel = null;
        this.translator = null;
        this.pipeline = null;

        // 队列状态
        this.queue = [];
        this.processing = false;
        this.queueInterval = 2000; // 每个项目之间延迟 2 秒，为 N100 留出呼吸空间

        // 模型加载串行锁：避免 onnxruntime 并发加载（N100 友好，也避免日志/错误错乱）
        this._lockChain = Promise.resolve();
        // 翻译模型熔断器：损坏文件反复重试只会拖慢每次搜索
        this.translatorFailures = 0;
        this.translatorDisabled = false;
        // 后台预热标志，防止并发预热
        this._preloading = false;
    }

    // 后台预热模型，避免首次搜索在弱 CPU（如 N100）上冷加载 ~260MB 模型耗时过长
    // 导致请求超时（接口 30s 无响应）。在服务启动时调用，不要 await。
    // 模型就绪后自动补全尚未生成向量的历史图片（仅缺失的，已存在则跳过）。
    async preload() {
        if (!config.magicSearch.enabled) return;
        if (this._preloading) return; // 防止并发预热
        this._preloading = true;
        try {
            console.log('[MagicSearch] Background preloading models (N100 warm-up)...');
            // 先加载搜索必需的 CLIP，再加载可选的翻译模型
            await this.getModels();
            console.log('[MagicSearch] CLIP models preloaded.');
            await this.getTranslator();
            console.log('[MagicSearch] All models preloaded. Magic search is ready.');
            // 模型就绪后，后台补全尚未生成向量的历史图片
            this.scanAll().catch(e => console.error('[MagicSearch] Background scan failed:', e));
        } catch (e) {
            console.error('[MagicSearch] Preload failed:', e);
        } finally {
            this._preloading = false;
        }
    }

    static getInstance() {
        if (!ClipService.instance) {
            ClipService.instance = new ClipService();
        }
        return ClipService.instance;
    }

    // 串行执行模型加载类异步任务。用 Promise 链排队，后一个等前一个完成（成功或失败），
    // 避免 onnxruntime 并发加载导致日志/错误错乱，对 N100 也更友好。
    _withLock(fn) {
        const next = this._lockChain.then(() => fn());
        // 吞掉错误，防止某次失败卡断整条链
        this._lockChain = next.catch(() => {});
        return next;
    }

    async getModels() {
        // 快速路径：已加载直接返回（无需加锁）
        if (this.processor && this.tokenizer && this.visionModel && this.textModel) {
            return {
                processor: this.processor,
                tokenizer: this.tokenizer,
                visionModel: this.visionModel,
                textModel: this.textModel
            };
        }

        // 串行加载：避免 onnxruntime 并发加载
        return this._withLock(async () => {
            // 拿到锁后复查，并发调用方可能已经完成加载
            if (this.processor && this.tokenizer && this.visionModel && this.textModel) {
                return {
                    processor: this.processor,
                    tokenizer: this.tokenizer,
                    visionModel: this.visionModel,
                    textModel: this.textModel
                };
            }

            // 加载前校验并清理可能损坏的 CLIP ONNX 文件，防止 Protobuf 解析失败
            ClipService.purgeCorruptModelFiles(this.modelName, [
                'text_model_quantized.onnx',
                'vision_model_quantized.onnx',
                'model_quantized.onnx',
            ]);

            console.log(`[MagicSearch] Loading model components: ${this.modelName}...`);
            try {
                // Dynamic import for ESM module
                const {
                    AutoProcessor,
                    AutoTokenizer,
                    CLIPVisionModelWithProjection,
                    CLIPTextModelWithProjection,
                    RawImage,
                    env
                } = await import('@huggingface/transformers');

                this.RawImage = RawImage;

                // 配置为使用本地缓存
                env.cacheDir = HF_CACHE_DIR;
                env.allowLocalModels = false;
                env.useBrowserCache = false;

                // 允许自定义 HuggingFace 端点 (用于国内镜像，如 https://hf-mirror.com)
                if (process.env.HF_ENDPOINT) {
                    env.remoteHost = process.env.HF_ENDPOINT;
                    console.log(`[MagicSearch] Using custom HF endpoint: ${env.remoteHost}`);
                }

                // 加载组件
                this.processor = await AutoProcessor.from_pretrained(this.modelName);
                this.tokenizer = await AutoTokenizer.from_pretrained(this.modelName);
                this.visionModel = await CLIPVisionModelWithProjection.from_pretrained(this.modelName, {
                    quantized: true,
                    dtype: 'q8', // 显式指定量化类型，消除 N100 上的 fp32 警告
                });
                this.textModel = await CLIPTextModelWithProjection.from_pretrained(this.modelName, {
                    quantized: true,
                    dtype: 'q8', // 显式指定量化类型，消除 N100 上的 fp32 警告
                });

                console.log(`[MagicSearch] Models loaded successfully.`);
                return {
                    processor: this.processor,
                    tokenizer: this.tokenizer,
                    visionModel: this.visionModel,
                    textModel: this.textModel
                };
            } catch (error) {
                console.error(`[MagicSearch] Failed to load models:`, error);
                if (ClipService.isCorruptModelError(error)) {
                    // Purge the actual corrupt model (extracted from the error path),
                    // not necessarily this.modelName — the failure may reference a
                    // different model that poisoned the onnxruntime session.
                    const corruptModel = ClipService.extractModelFromError(error) || this.modelName;
                    ClipService.purgeCorruptCache(corruptModel);
                }
                throw error;
            }
        });
    }

    normalize(vector) {
        const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
        return vector.map(val => val / magnitude);
    }

    // 生成文本嵌入
    async getTextEmbedding(text) {
        const { tokenizer, textModel } = await this.getModels();

        // 分词
        const inputs = await tokenizer([text], { padding: true, truncation: true });

        // 推理
        const { text_embeds } = await textModel(inputs);

        // 输出为 Tensor，需要转换为数组并归一化
        // text_embeds 为 [batch_size, embed_dim] -> [1, 512]
        const rawEmbedding = Array.from(text_embeds.data);
        return this.normalize(rawEmbedding);
    }

    // 生成图片嵌入
    async getImageEmbedding(imagePath) {
        const { processor, visionModel } = await this.getModels();

        try {
            // 读取图片并处理
            const image = await this.RawImage.read(imagePath);
            const image_inputs = await processor(image);

            // 推理
            const { image_embeds } = await visionModel(image_inputs);

            // 转换并归一化
            const rawEmbedding = Array.from(image_embeds.data);
            return this.normalize(rawEmbedding);
        } catch (e) {
            console.error(`[MagicSearch] Image processing failed for ${imagePath}:`, e);
            throw e;
        }
    }

    // 添加图片到处理队列
    // 优先级: 'high' (上传) -> unshift (前), 'low' (历史) -> push (后)
    addToQueue(image, priority = 'low') {
        if (!config.magicSearch.enabled) return;

        // 去重：检查图片是否已在队列中
        if (this.queue.find(item => item.id === image.id)) return;

        if (priority === 'high') {
            this.queue.unshift(image);
            console.log(`[MagicSearch] Added image ${image.id} (High Priority) to queue. Queue size: ${this.queue.length}`);
        } else {
            this.queue.push(image);
            console.log(`[MagicSearch] Added image ${image.id} (Low Priority) to queue. Queue size: ${this.queue.length}`);
        }

        this.processQueue();
    }

    // 处理队列
    async processQueue() {
        if (this.processing || this.queue.length === 0) return;

        this.processing = true;

        while (this.queue.length > 0) {
            const image = this.queue.shift();

            try {
                await this.processImage(image);
            } catch (err) {
                console.error(`[MagicSearch] Error processing image ${image.id}:`, err);
            }

            // 等待片刻让 CPU 喘口气 (N100 优化)
            if (this.queue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, this.queueInterval));
            }
        }

        this.processing = false;
    }

    async processImage(image) {
        // 过滤非图片文件 (如视频)
        const ext = path.extname(image.rel_path).toLowerCase();
        const supportedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.avif'];
        if (!supportedExts.includes(ext)) {
            // console.log(`[MagicSearch] Skipping unsupported file type: ${image.filename}`);
            return;
        }

        const imagePath = path.resolve(config.storage.path, image.rel_path);

        if (!fs.existsSync(imagePath)) {
            console.warn(`[MagicSearch] File not found: ${imagePath}`);
            return;
        }

        // 检查嵌入是否已存在
        const existing = db.prepare('SELECT image_id FROM vec_images WHERE image_id = ?').get(image.id);
        if (existing) {
            // console.log(`[MagicSearch] Embedding already exists for ${image.id}, skipping.`);
            return;
        }

        // console.log(`[MagicSearch] Generating embedding for ${image.filename}...`);
        const embedding = await this.getImageEmbedding(imagePath);

        // 保存到向量数据库
        // sqlite-vec 期望原始 float32 字节数组或特定处理 
        // better-sqlite3 with sqlite-vec extension usually handles Float32Array directly if registered,
        // otherwise we might need to serialize. 
        // The `vec0` virtual table accepts JSON array string or binary blob. 
        // Let's try passing Float32Array directly (better-sqlite3 typed array support)
        // or JSON string as fallback.

        // IMPORTANT: sqlite-vec usually requires the embedding to be inserted.
        // Ensure we are using transaction if batching, but here is single.

        try {
            // 准备插入语句
            // 对于 vec0，标准 INSERT INTO 有效
            // 我们使用 JSON.stringify(embedding) 作为首次尝试以确保安全，
            // 因为 better-sqlite3 可能会将数组绑定为其他类型
            // 但 vec0 支持 JSON 文本输入
            // sqlite-vec 期望原始 float32 字节数组或有效的 JSON
            // 我们使用 'image_id'，它是主键
            const stmt = db.prepare("INSERT INTO vec_images(image_id, embedding) VALUES (?, ?)");

            // 调试 ID
            // console.log(`[MagicSearch] Inserting ${image.id} (type: ${typeof image.id})`);

            // 使用 BigInt 作为 ID 以匹配 INTEGER 亲和性，并使用 Float32Array 作为嵌入
            stmt.run(BigInt(image.id), new Float32Array(embedding));

            // console.log(`[MagicSearch] Saved embedding for ${image.id}`);
        } catch (dbErr) {
            console.error(`[MagicSearch] DB Insert Error for ${image.id}:`, dbErr);
        }
    }

    // 清除所有嵌入并重新扫描
    async reindex() {
        if (!config.magicSearch.enabled) return { success: false, message: "Magic Search disabled" };

        console.log("[MagicSearch] Reindexing requested. Clearing vector table...");

        try {
            db.prepare("DELETE FROM vec_images").run();
            console.log("[MagicSearch] Vector table cleared.");
        } catch (e) {
            console.error("[MagicSearch] Failed to clear vector table:", e);
            throw e;
        }

        return this.scanAll();
    }

    // 触发扫描所有没有嵌入的图片
    async scanAll() {
        if (!config.magicSearch.enabled) return { success: false, message: "Magic Search disabled" };

        console.log("[MagicSearch] Starting background scan for missing embeddings...");

        // 在 `images` 表中查找不存在于 `vec_images` 中的所有图片
        const images = db.prepare(`
      SELECT i.id, i.filename, i.rel_path 
      FROM images i 
      LEFT JOIN vec_images v ON i.id = v.image_id 
      WHERE v.image_id IS NULL
    `).all();

        console.log(`[MagicSearch] Found ${images.length} historical images to process.`);

        // 全部添加到队列 (低优先级) - 仅过滤支持的图片
        const supportedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.avif'];
        let queuedCount = 0;

        for (const img of images) {
            const ext = path.extname(img.rel_path).toLowerCase();
            if (supportedExts.includes(ext)) {
                this.addToQueue(img, 'low');
                queuedCount++;
            }
        }

        console.log(`[MagicSearch] Queued ${queuedCount} images for background processing.`);

        return { success: true, count: queuedCount };
    }

    // 加载翻译模型 (懒加载)。翻译是可选增强，失败必须优雅降级，绝不能拖垮 CLIP。
    async getTranslator() {
        if (this.translatorDisabled) {
            // 熔断后直接跳过，避免损坏的翻译模型反复触发慢失败
            return null;
        }
        if (this.translator) return this.translator;

        return this._withLock(async () => {
            if (this.translatorDisabled) return null;
            if (this.translator) return this.translator;

            const opusFiles = [
                'encoder_model_quantized.onnx',
                'decoder_model_merged_quantized.onnx',
                'decoder_model_quantized.onnx',
            ];

            // 加载前用 magic-byte 校验缓存：损坏/截断的 ONNX 会触发 Protobuf 解析失败。
            // 旧的体积校验（<1MB）挡不住 NAS 上常见的半截下载和镜像错误页。
            const purged = ClipService.purgeCorruptModelFiles('Xenova/opus-mt-zh-en', opusFiles);

            // 刚清理过损坏缓存时，本轮先不重新下载（镜像可能再次返回同样的坏文件），
            // 本次搜索直接以原文进行；下次搜索再尝试重新下载。
            if (purged) {
                console.warn(`[MagicSearch] Translator skipped this round after purging corrupt opus-mt-zh-en cache.`);
                return null;
            }

            console.log(`[MagicSearch] Loading translation model (opus-mt-zh-en)...`);
            try {
                const { pipeline, env } = await import('@huggingface/transformers');
                env.cacheDir = HF_CACHE_DIR;

                if (process.env.HF_ENDPOINT) {
                    env.remoteHost = process.env.HF_ENDPOINT;
                }

                this.translator = await pipeline('translation', 'Xenova/opus-mt-zh-en', {
                    // 开启量化，显著降低 N100 的内存压力和 CPU 占用
                    quantized: true,
                    dtype: 'q8', // 显式指定 q8 类型，消除 fp32 警告
                });
                console.log(`[MagicSearch] Translation model loaded.`);
                this.translatorFailures = 0; // 成功后重置熔断计数
                return this.translator;
            } catch (e) {
                console.error(`[MagicSearch] Failed to load translator:`, e);
                // If the cached ONNX is corrupt/truncated, purge it so the next
                // attempt re-downloads instead of reading the bad file forever.
                if (ClipService.isCorruptModelError(e)) {
                    ClipService.purgeCorruptModelFiles('Xenova/opus-mt-zh-en', opusFiles);
                }
                this.translatorFailures += 1;
                if (this.translatorFailures >= ClipService.MAX_TRANSLATOR_FAILURES) {
                    this.translatorDisabled = true;
                    console.warn(`[MagicSearch] Translator disabled for this session after ${this.translatorFailures} failure(s). Semantic search will run without zh→en translation until restart.`);
                }
                return null;
            }
        });
    }

    // 按需翻译
    async translate(text) {
        // 简单检查是否包含中文字符
        if (!/[\u4e00-\u9fa5]/.test(text)) return text;

        try {
            const translator = await this.getTranslator();
            if (!translator) return text;

            const output = await translator(text, {
                max_new_tokens: 40,
                temperature: 0.1 // 降低随机性，让翻译更准确
            });
            // Output format: [{ translation_text: '...' }]
            if (output && output[0] && output[0].translation_text) {
                const translated = output[0].translation_text;
                console.log(`[MagicSearch] Translated: "${text}" -> "${translated}"`);
                return translated;
            }
        } catch (e) {
            console.warn(`[MagicSearch] Translation failed for "${text}":`, e);
        }
        return text;
    }

    // 语义搜索
    async search(queryText, limit = 50) {
        if (!config.magicSearch.enabled) return [];

        try {
            // 自动翻译中文查询
            const finalQuery = await this.translate(queryText);

            const embedding = await this.getTextEmbedding(finalQuery);

            // 查询向量数据库
            // 我们联接回 images 表以获取文件详情
            const results = db.prepare(`
        SELECT 
          i.*, 
          vec_distance_cosine(v.embedding, ?) as distance
        FROM vec_images v
        JOIN images i ON v.image_id = i.id
        ORDER BY distance
        LIMIT ?
      `).all(JSON.stringify(embedding), limit);

            return results;
        } catch (e) {
            console.error("[MagicSearch] Search failed:", e);
            throw e;
        }
    }
}

module.exports = ClipService.getInstance();
