const config = require('../../config');
const db = require('../db/database');
const path = require('path');
const fs = require('fs-extra');

let Pipeline = null;

class ClipService {
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
    }

    static getInstance() {
        if (!ClipService.instance) {
            ClipService.instance = new ClipService();
        }
        return ClipService.instance;
    }

    async getModels() {
        if (this.processor && this.tokenizer && this.visionModel && this.textModel) {
            return {
                processor: this.processor,
                tokenizer: this.tokenizer,
                visionModel: this.visionModel,
                textModel: this.textModel
            };
        }

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
            env.cacheDir = path.resolve(__dirname, '../../.cache/huggingface');
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
            throw error;
        }
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

    // 加载翻译模型 (懒加载)
    async getTranslator() {
        if (this.translator) return this.translator;

        console.log(`[MagicSearch] Loading translation model (opus-mt-zh-en)...`);
        try {
            const { pipeline, env } = await import('@huggingface/transformers');
            env.cacheDir = path.resolve(__dirname, '../../.cache/huggingface');

            if (process.env.HF_ENDPOINT) {
                env.remoteHost = process.env.HF_ENDPOINT;
            }

            this.translator = await pipeline('translation', 'Xenova/opus-mt-zh-en', {
                // 开启量化，显著降低 N100 的内存压力和 CPU 占用
                quantized: true,
                dtype: 'q8', // 显式指定 q8 类型，消除 fp32 警告
            });
            console.log(`[MagicSearch] Translation model loaded.`);
            return this.translator;
        } catch (e) {
            console.error(`[MagicSearch] Failed to load translator:`, e);
            return null;
        }
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
