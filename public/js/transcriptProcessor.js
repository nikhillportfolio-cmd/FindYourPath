/**
 * PRAXiS Speech Diagnostics - Transcript Processor
 * Handles text normalization, tokenization, sentence extraction, and annotation.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.TranscriptProcessor = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    const STOP_WORDS = new Set([
        'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
        'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
        'could', 'did', 'do', 'does', 'doing', 'down', 'during',
        'each', 'few', 'for', 'from', 'further',
        'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how',
        'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself',
        'just', 'me', 'more', 'most', 'my', 'myself',
        'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
        'same', 'she', 'should', 'so', 'some', 'such',
        'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too',
        'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would',
        'you', 'your', 'yours', 'yourself', 'yourselves'
    ]);

    function normalizeText(text) {
        if (!text) return '';
        return String(text)
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function tokenizeWords(text) {
        const cleaned = normalizeText(text);
        if (!cleaned) return [];
        // Match word characters with apostrophes in contractions (e.g., "don't", "we'll")
        const matches = cleaned.match(/\b[a-zA-Z0-9]+(?:'[a-zA-Z0-9]+)?\b/g);
        return matches ? matches : [];
    }

    function extractWordCount(text) {
        return tokenizeWords(text).length;
    }

    function tokenizeSentences(text) {
        const cleaned = normalizeText(text);
        if (!cleaned) return [];

        // Split by standard sentence terminators (. ! ?) or strong breaks
        let rawSegments = cleaned.split(/(?<=[.!?])\s+|\n+/);
        let sentences = [];

        for (let seg of rawSegments) {
            seg = seg.trim();
            if (!seg) continue;

            // If user spoke without punctuation, we can also split on major transition markers
            // when the segment is very long (> 25 words)
            const words = seg.split(/\s+/);
            if (words.length > 28 && !/[.!?]$/.test(seg)) {
                const subParts = seg.split(/(?<=\s)(?=(?:Furthermore|Moreover|In addition|However|On the other hand|Therefore|For example|For instance|In conclusion|To sum up)\b)/i);
                for (const sub of subParts) {
                    if (sub.trim()) sentences.push(sub.trim());
                }
            } else {
                sentences.push(seg);
            }
        }

        return sentences.length > 0 ? sentences : [cleaned];
    }

    function getUniqueWords(words, ignoreStopWords = false) {
        const unique = new Set();
        for (const w of words) {
            const lower = w.toLowerCase().replace(/[^a-z0-9']/g, '');
            if (!lower) continue;
            if (ignoreStopWords && STOP_WORDS.has(lower)) continue;
            unique.add(lower);
        }
        return Array.from(unique);
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function generateAnnotatedTranscript(rawTranscript, options = {}) {
        if (!rawTranscript || !rawTranscript.trim()) {
            return '<span class="text-slate-400 italic">No transcript recorded yet.</span>';
        }

        let escaped = escapeHtml(rawTranscript);

        // 1. Highlight Fillers (Red badge)
        // Context-aware patterns for filler words
        const fillerRegex = /\b(um+|uh+|er+|ah+|basically|actually|literally|you know|sort of|kind of|i mean|to be honest|so yeah|stuff like that)\b/gi;
        escaped = escaped.replace(fillerRegex, '<span class="highlight-filler" title="Filler Word">$1</span>');

        // Context-aware pattern for "like" when used as filler (surrounded by commas/pauses or consecutive)
        const fillerLikeRegex = /(?:^|\s)(like)(?=[\s,]+(?:um|uh|you know|basically|i mean|\w+\s+like))/gi;
        escaped = escaped.replace(fillerLikeRegex, ' <span class="highlight-filler" title="Filler Word">$1</span>');

        // 2. Highlight Hedging Phrases (Amber badge)
        const hedgingRegex = /\b((?:i|we|they)\s+feel\s+like|(?:i|we)\s+think\s+maybe|in my humble opinion|sorry if this is wrong|sort of like|i guess|maybe perhaps)\b/gi;
        escaped = escaped.replace(hedgingRegex, '<span class="highlight-hedging" title="Hedging Phrase">$1</span>');

        // 3. Highlight Structural Markers (Blue/Emerald badge)
        const structureRegex = /\b(firstly|secondly|furthermore|moreover|in addition|however|on the other hand|nevertheless|for example|for instance|such as|therefore|consequently|as a result|in conclusion|to summarize|overall)\b/gi;
        escaped = escaped.replace(structureRegex, '<span class="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-semibold border-b-2 border-blue-400" title="Structure Transition">$1</span>');

        return escaped;
    }

    return {
        STOP_WORDS,
        normalizeText,
        tokenizeWords,
        extractWordCount,
        tokenizeSentences,
        getUniqueWords,
        escapeHtml,
        generateAnnotatedTranscript
    };
}));
