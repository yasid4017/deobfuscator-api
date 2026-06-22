// api/deobfuscator.js
// MAIN API HANDLER - LENGKAP

const DeobfuscatorCore = require('./_lib/deobfuscator-core');

// ============================================
// KONFIGURASI
// ============================================
const CONFIG = {
    MAX_CODE_SIZE: 5 * 1024 * 1024, // 5MB
    RATE_LIMIT: {
        windowMs: 60000, // 1 menit
        maxRequests: 100 // maks 100 request per menit
    }
};

// ============================================
// RATE LIMITER (In-memory)
// ============================================
const rateLimit = new Map();

function checkRateLimit(ip) {
    const now = Date.now();
    const windowMs = CONFIG.RATE_LIMIT.windowMs;
    const maxRequests = CONFIG.RATE_LIMIT.maxRequests;

    if (!rateLimit.has(ip)) {
        rateLimit.set(ip, { count: 1, resetTime: now + windowMs });
        return true;
    }

    const data = rateLimit.get(ip);
    
    if (now > data.resetTime) {
        data.count = 1;
        data.resetTime = now + windowMs;
        return true;
    }

    if (data.count >= maxRequests) {
        return false;
    }

    data.count++;
    return true;
}

// ============================================
// MAIN HANDLER
// ============================================
module.exports = async (req, res) => {
    // === CORS HEADERS ===
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Set headers
    Object.entries(headers).forEach(([key, value]) => {
        res.setHeader(key, value);
    });

    // === HANDLE OPTIONS (CORS Preflight) ===
    if (req.method === 'OPTIONS') {
        return res.status(200).json({ 
            success: true, 
            message: 'CORS OK' 
        });
    }

    // === METHOD VALIDATION ===
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed. Use POST.'
        });
    }

    // === GET CLIENT IP ===
    const clientIP = req.headers['x-forwarded-for'] || 
                     req.connection.remoteAddress || 
                     'unknown';

    // === RATE LIMITING ===
    if (!checkRateLimit(clientIP)) {
        return res.status(429).json({
            success: false,
            error: 'Too many requests. Please wait a moment.'
        });
    }

    try {
        // === PARSE BODY ===
        let body;
        try {
            body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } catch (e) {
            return res.status(400).json({
                success: false,
                error: 'Invalid JSON body'
            });
        }

        const { 
            code, 
            api = 'prometheus', 
            options = {} 
        } = body;

        // === VALIDASI CODE ===
        if (!code) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: "code"'
            });
        }

        if (typeof code !== 'string') {
            return res.status(400).json({
                success: false,
                error: '"code" must be a string'
            });
        }

        if (!code.trim()) {
            return res.status(400).json({
                success: false,
                error: '"code" cannot be empty'
            });
        }

        // === SIZE LIMIT ===
        if (code.length > CONFIG.MAX_CODE_SIZE) {
            return res.status(413).json({
                success: false,
                error: `Code too large. Maximum ${CONFIG.MAX_CODE_SIZE} characters`
            });
        }

        // === VALIDASI API TOOL ===
        const validTools = ['prometheus', 'moonsec', 'generic'];
        if (!validTools.includes(api.toLowerCase())) {
            return res.status(400).json({
                success: false,
                error: `Invalid API tool. Supported: ${validTools.join(', ')}`
            });
        }

        // === PROSES DEOBFUSCATION ===
        const startTime = Date.now();
        
        let result;
        try {
            result = DeobfuscatorCore.process(code, api.toLowerCase(), options);
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: `Deobfuscation failed: ${error.message}`
            });
        }

        const executionTime = Date.now() - startTime;

        // === BUILD RESPONSE ===
        const response = {
            success: true,
            result: result,
            metadata: {
                originalLength: code.length,
                deobfuscatedLength: result.length,
                tool: api.toLowerCase(),
                executionTime: `${executionTime}ms`,
                timestamp: new Date().toISOString(),
                compressionRatio: ((result.length / code.length) * 100).toFixed(2) + '%'
            }
        };

        return res.status(200).json(response);

    } catch (error) {
        console.error('Unhandled error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};
