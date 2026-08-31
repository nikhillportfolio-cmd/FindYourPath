/**
 * PRAXiS Speech Recognition Engine
 * Robust Web Speech API wrapper with continuous recognition, interim/final separation,
 * automatic disconnect recovery, single-instance management, and timing tracking.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SpeechRecognitionManager = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    class SpeechRecognitionManager {
        constructor(options = {}) {
            this.lang = options.lang || 'en-US';
            this.onTranscriptUpdate = options.onTranscriptUpdate || null;
            this.onStateChange = options.onStateChange || null;
            this.onError = options.onError || null;

            this.recognition = null;
            this.isRecording = false;
            this.isIntentionalStop = false;
            this.finalTranscript = '';
            this.interimTranscript = '';
            this.startTime = 0;
            this.endTime = 0;
            this.firstSpeechTime = 0;
            this.actualSpeakingDuration = 0;
            this.speechEvents = []; // Array of { timestamp, text, isFinal }
            this.lastEventTime = 0;
            this.detectedPauses = []; // Array of { startTime, duration, type }
            this.restartAttempts = 0;
            this.maxRestartAttempts = 5;
            this.restartTimeout = null;

            this.isSupported = this.checkSupport();
            if (this.isSupported) {
                this.initEngine();
            }
        }

        checkSupport() {
            if (typeof window === 'undefined') return false;
            return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
        }

        initEngine() {
            if (this.recognition) {
                try {
                    this.recognition.abort();
                } catch (e) {}
            }

            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) return;

            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = this.lang;
            this.recognition.maxAlternatives = 1;

            this.recognition.onstart = () => {
                this.restartAttempts = 0;
                if (!this.startTime) {
                    this.startTime = Date.now();
                }
                this.emitState('LISTENING');
            };

            this.recognition.onresult = (event) => {
                const now = Date.now();
                if (!this.firstSpeechTime) {
                    this.firstSpeechTime = now;
                }

                if (this.lastEventTime > 0) {
                    const gapSec = Number(((now - this.lastEventTime) / 1000).toFixed(2));
                    if (gapSec >= 0.7) {
                        const pauseType = gapSec >= 1.5 ? 'long' : 'noticeable';
                        this.detectedPauses.push({
                            timestamp: now,
                            durationSeconds: gapSec,
                            type: pauseType
                        });
                    }
                }
                this.lastEventTime = now;

                let currentInterim = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const result = event.results[i];
                    const transcriptPiece = result[0].transcript;
                    if (result.isFinal) {
                        this.finalTranscript += (this.finalTranscript ? ' ' : '') + transcriptPiece.trim();
                        this.speechEvents.push({
                            timestamp: now,
                            text: transcriptPiece.trim(),
                            isFinal: true
                        });
                    } else {
                        currentInterim += transcriptPiece;
                    }
                }
                this.interimTranscript = currentInterim;

                const fullLiveText = (this.finalTranscript + (this.interimTranscript ? ' ' + this.interimTranscript : '')).trim();
                if (typeof this.onTranscriptUpdate === 'function') {
                    this.onTranscriptUpdate({
                        finalTranscript: this.finalTranscript,
                        interimTranscript: this.interimTranscript,
                        fullTranscript: fullLiveText,
                        timing: this.getTimingMetrics()
                    });
                }
            };

            this.recognition.onerror = (event) => {
                console.warn('SpeechRecognition error:', event.error);
                let friendlyMessage = "Speech recognition encountered an issue.";
                let isCritical = false;

                switch (event.error) {
                    case 'not-allowed':
                    case 'service-not-allowed':
                        friendlyMessage = "Microphone access was denied. Please grant microphone permissions in your browser.";
                        isCritical = true;
                        break;
                    case 'no-speech':
                        friendlyMessage = "No speech was detected. Please check your microphone.";
                        break;
                    case 'audio-capture':
                        friendlyMessage = "No microphone was found. Please ensure an audio input device is connected.";
                        isCritical = true;
                        break;
                    case 'network':
                        friendlyMessage = "Speech recognition network error. Check your internet connection.";
                        break;
                    case 'aborted':
                        // Normal when stopped manually
                        return;
                    default:
                        friendlyMessage = `Recognition error (${event.error}).`;
                        break;
                }

                if (isCritical) {
                    this.isRecording = false;
                    this.isIntentionalStop = true;
                    this.emitState('ERROR', { error: event.error, message: friendlyMessage });
                    if (typeof this.onError === 'function') {
                        this.onError(friendlyMessage, event.error);
                    }
                }
            };

            this.recognition.onend = () => {
                // If user is still recording and did not intentionally stop, auto-reconnect
                if (this.isRecording && !this.isIntentionalStop) {
                    if (this.restartAttempts < this.maxRestartAttempts) {
                        this.restartAttempts++;
                        clearTimeout(this.restartTimeout);
                        this.restartTimeout = setTimeout(() => {
                            if (this.isRecording && !this.isIntentionalStop) {
                                try {
                                    this.recognition.start();
                                } catch (e) {
                                    console.warn('Could not auto-restart recognition:', e);
                                }
                            }
                        }, 250);
                        return;
                    }
                }

                this.isRecording = false;
                this.endTime = Date.now();
                if (this.startTime > 0) {
                    this.actualSpeakingDuration = Math.max(1, Math.round((this.endTime - this.startTime) / 1000));
                }

                // Append any remaining interim transcript to final transcript
                if (this.interimTranscript) {
                    this.finalTranscript = (this.finalTranscript + ' ' + this.interimTranscript).trim();
                    this.interimTranscript = '';
                }

                this.emitState('STOPPED', {
                    finalTranscript: this.finalTranscript,
                    durationSeconds: this.actualSpeakingDuration,
                    timing: this.getTimingMetrics()
                });
            };
        }

        start(initialText = '') {
            if (!this.isSupported) {
                if (typeof this.onError === 'function') {
                    this.onError("Speech recognition is not supported in this browser. Please type or paste your transcript.", "unsupported");
                }
                return false;
            }

            this.finalTranscript = String(initialText || '').trim();
            this.interimTranscript = '';
            this.startTime = Date.now();
            this.endTime = 0;
            this.firstSpeechTime = 0;
            this.lastEventTime = 0;
            this.speechEvents = [];
            this.detectedPauses = [];
            this.actualSpeakingDuration = 0;
            this.isIntentionalStop = false;
            this.isRecording = true;
            this.restartAttempts = 0;

            try {
                this.recognition.start();
                this.emitState('LISTENING');
                return true;
            } catch (err) {
                // If already running, restart cleanly
                if (err.name === 'InvalidStateError') {
                    try {
                        this.recognition.stop();
                        setTimeout(() => {
                            if (this.isRecording) {
                                this.recognition.start();
                            }
                        }, 200);
                        return true;
                    } catch (e) {}
                }
                console.error("Failed to start speech recognition:", err);
                this.isRecording = false;
                if (typeof this.onError === 'function') {
                    this.onError("Could not start speech recognition. Please check microphone permissions.", "start-error");
                }
                return false;
            }
        }

        stop() {
            this.isIntentionalStop = true;
            this.isRecording = false;
            clearTimeout(this.restartTimeout);

            if (this.recognition) {
                try {
                    this.recognition.stop();
                } catch (e) {
                    try {
                        this.recognition.abort();
                    } catch (err) {}
                }
            }

            this.endTime = Date.now();
            if (this.startTime > 0) {
                this.actualSpeakingDuration = Math.max(1, Math.round((this.endTime - this.startTime) / 1000));
            }

            if (this.interimTranscript) {
                this.finalTranscript = (this.finalTranscript + ' ' + this.interimTranscript).trim();
                this.interimTranscript = '';
            }

            return {
                finalTranscript: this.finalTranscript,
                durationSeconds: this.actualSpeakingDuration,
                timing: this.getTimingMetrics()
            };
        }

        reset() {
            this.stop();
            this.finalTranscript = '';
            this.interimTranscript = '';
            this.startTime = 0;
            this.endTime = 0;
            this.firstSpeechTime = 0;
            this.lastEventTime = 0;
            this.speechEvents = [];
            this.detectedPauses = [];
            this.actualSpeakingDuration = 0;
            this.emitState('READY');
        }

        setTranscript(text) {
            this.finalTranscript = String(text || '').trim();
            this.interimTranscript = '';
        }

        getTranscript() {
            return (this.finalTranscript + (this.interimTranscript ? ' ' + this.interimTranscript : '')).trim();
        }

        getDurationSeconds() {
            if (this.isRecording && this.startTime > 0) {
                return Math.max(1, Math.round((Date.now() - this.startTime) / 1000));
            }
            return this.actualSpeakingDuration || 0;
        }

        getTimingMetrics() {
            const now = this.endTime || (this.isRecording ? Date.now() : this.startTime);
            const totalDurationSec = this.startTime > 0 ? Math.max(0.1, (now - this.startTime) / 1000) : 0;
            const firstSpeechDelay = (this.startTime > 0 && this.firstSpeechTime > 0)
                ? Math.max(0, (this.firstSpeechTime - this.startTime) / 1000)
                : 0;

            let totalPauseTime = 0;
            let longPauseCount = 0;
            let pauseCount = this.detectedPauses.length;

            this.detectedPauses.forEach(p => {
                totalPauseTime += p.durationSeconds;
                if (p.type === 'long') {
                    longPauseCount++;
                }
            });

            const avgPauseTime = pauseCount > 0 ? Number((totalPauseTime / pauseCount).toFixed(2)) : 0;
            const activeSpeakingSec = Math.max(0.1, Number((totalDurationSec - totalPauseTime).toFixed(2)));

            return {
                totalDurationSeconds: Number(totalDurationSec.toFixed(2)),
                activeSpeakingSeconds: activeSpeakingSec,
                firstSpeechDelaySeconds: Number(firstSpeechDelay.toFixed(2)),
                pauses: this.detectedPauses,
                pauseCount,
                longPauseCount,
                totalPauseTime: Number(totalPauseTime.toFixed(2)),
                averagePauseTime: avgPauseTime,
                speechEventsCount: this.speechEvents.length,
                hasSpeechEvents: this.speechEvents.length > 0 || !!this.finalTranscript
            };
        }

        emitState(state, payload = {}) {
            if (typeof this.onStateChange === 'function') {
                this.onStateChange(state, payload);
            }
        }
    }

    return SpeechRecognitionManager;
}));
