// api/_lib/deobfuscator-core.js
// CORE DEOBFUSCATOR LIBRARY - LENGKAP

class DeobfuscatorCore {
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    static _decodeHex(text) {
        return text.replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => {
            try {
                return String.fromCharCode(parseInt(hex, 16));
            } catch {
                return `\\x${hex}`;
            }
        });
    }

    static _decodeUnicode(text) {
        return text.replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => {
            try {
                return String.fromCharCode(parseInt(hex, 16));
            } catch {
                return `\\u${hex}`;
            }
        });
    }

    static _decodeOctal(text) {
        return text.replace(/\\([0-7]{3})/g, (_, octal) => {
            try {
                return String.fromCharCode(parseInt(octal, 8));
            } catch {
                return `\\${octal}`;
            }
        });
    }

    static _decodeBase64(text) {
        const patterns = [
            /decode_string\s*\(\s*["']([A-Za-z0-9+/=]+)["']\s*\)/g,
            /loadstring\s*\(\s*decode_string\s*\(\s*["']([A-Za-z0-9+/=]+)["']\s*\)\s*\)/g,
            /_G\["decode_string"\]\s*\(\s*["']([A-Za-z0-9+/=]+)["']\s*\)/g
        ];

        let result = text;
        patterns.forEach(pattern => {
            result = result.replace(pattern, (match, base64) => {
                try {
                    const decoded = Buffer.from(base64, 'base64').toString('utf-8');
                    const escaped = decoded.replace(/["\\]/g, '\\$&');
                    
                    if (match.includes('loadstring')) {
                        return `loadstring("${escaped}")`;
                    }
                    return `"${escaped}"`;
                } catch {
                    return match;
                }
            });
        });
        return result;
    }

    static _decodeStringChar(text) {
        return text.replace(/string\.char\s*\(\s*([\d,\s]+)\s*\)/g, (match, numbers) => {
            try {
                const chars = numbers.split(',').map(n => parseInt(n.trim()));
                const str = String.fromCharCode(...chars);
                return `"${str.replace(/["\\]/g, '\\$&')}"`;
            } catch {
                return match;
            }
        });
    }

    static _removeComments(text) {
        let result = text;
        result = result.replace(/--\[\[[\s\S]*?\]\]/g, '');
        result = result.replace(/--[^\n]*/g, '');
        return result;
    }

    static _cleanWhitespace(text) {
        let result = text;
        result = result.replace(/\s+/g, ' ');
        result = result.replace(/\s*=\s*/g, ' = ');
        result = result.replace(/\s*\+\s*/g, ' + ');
        result = result.replace(/\s*-\s*/g, ' - ');
        result = result.replace(/\s*\*\s*/g, ' * ');
        result = result.replace(/\s*\/\s*/g, ' / ');
        result = result.replace(/\(\s+/g, '(');
        result = result.replace(/\s+\)/g, ')');
        result = result.replace(/\[\s+/g, '[');
        result = result.replace(/\s+\]/g, ']');
        result = result.replace(/;\s*;/g, ';');
        result = result.replace(/\n\s*\n/g, '\n');
        result = result.replace(/^ +/gm, '');
        result = result.replace(/ +$/gm, '');
        return result.trim();
    }

    static _normalizeVariables(text) {
        let result = text;
        result = result.replace(/_0x[0-9A-Fa-f]+/g, '_var');
        result = result.replace(/local\s+[a-zA-Z_]\w*\s*=\s*function/g, 'local function');
        result = result.replace(/_G\[["']([^"']+)["']\]/g, '$1');
        return result;
    }

    static _decodeConcatenation(text) {
        const concatPattern = /(["'])(?:[^\\]|\\.)*?\1\s*\.\.\s*(["'])(?:[^\\]|\\.)*?\2/g;
        return text.replace(concatPattern, (match) => {
            try {
                const evalFunc = new Function(`return ${match}`);
                const value = evalFunc();
                return `"${value.replace(/["\\]/g, '\\$&')}"`;
            } catch {
                return match;
            }
        });
    }

    // ============================================
    // TOOL-SPECIFIC METHODS
    // ============================================

    static _prometheusSpecific(text) {
        let result = text;
        result = result.replace(/local\s+[a-zA-Z_]\d*\s*=\s*\{[^}]*\}/g, '');
        result = result.replace(/\d+\.\d+/g, '');
        result = result.replace(/!!\s*([a-zA-Z_]\w*)/g, '$1');
        return result;
    }

    static _moonsecSpecific(text) {
        let result = text;
        result = result.replace(/--\s*Moonsec\s*V3[\s\S]*?--\s*End\s*Moonsec/g, '');
        result = result.replace(/--\s*\[\[[\s\S]*?\]\]/g, '');
        
        const funcPatterns = [
            /local\s+[a-zA-Z_]\d*\s*=\s*function\s*\([^)]*\)\s*[^{]*\{[^}]*\}/g,
            /function\s+[a-zA-Z_]\d*\s*\([^)]*\)\s*[^{]*\{[^}]*\}/g
        ];
        funcPatterns.forEach(pattern => {
            result = result.replace(pattern, '');
        });
        
        result = result.replace(/local\s+[a-zA-Z_]\d*\s*=\s*\{/g, 'local table = {');
        result = result.replace(/local\s+[a-zA-Z_]\d*\s*=\s*function/g, 'local function');
        result = result.replace(/_G\[["']([^"']+)["']\]/g, '$1');
        
        return result;
    }

    // ============================================
    // MAIN PROCESS METHOD
    // ============================================

    static process(code, tool = 'generic', options = {}) {
        if (!code || typeof code !== 'string') {
            throw new Error('Invalid code input');
        }

        let result = code;

        // STEP 1: Remove Comments
        if (options.removeComments !== false) {
            result = this._removeComments(result);
        }

        // STEP 2: Decode Encodings
        if (options.decodeHex !== false) {
            result = this._decodeHex(result);
        }
        if (options.decodeUnicode !== false) {
            result = this._decodeUnicode(result);
        }
        if (options.decodeOctal !== false) {
            result = this._decodeOctal(result);
        }
        if (options.decodeBase64 !== false) {
            result = this._decodeBase64(result);
        }
        if (options.decodeStringChar !== false) {
            result = this._decodeStringChar(result);
        }

        // STEP 3: Tool-Specific Processing
        switch (tool.toLowerCase()) {
            case 'prometheus':
                result = this._prometheusSpecific(result);
                break;
            case 'moonsec':
                result = this._moonsecSpecific(result);
                break;
            case 'generic':
                break;
            default:
                throw new Error(`Unsupported tool: ${tool}`);
        }

        // STEP 4: Normalize
        if (options.normalizeVariables !== false) {
            result = this._normalizeVariables(result);
        }
        if (options.decodeConcatenation !== false) {
            result = this._decodeConcatenation(result);
        }

        // STEP 5: Clean Whitespace
        if (options.cleanWhitespace !== false) {
            result = this._cleanWhitespace(result);
        }

        // STEP 6: Formatting
        if (options.prettyPrint) {
            let indent = 0;
            const lines = result.split('\n');
            const formatted = lines.map(line => {
                line = line.trim();
                if (line.includes('end') || line.includes('}')) {
                    indent = Math.max(0, indent - 1);
                }
                const indented = '    '.repeat(indent) + line;
                if (line.includes('do') || line.includes('then') || line.includes('{')) {
                    indent++;
                }
                return indented;
            });
            result = formatted.join('\n');
        }

        return result;
    }
}

module.exports = DeobfuscatorCore;
