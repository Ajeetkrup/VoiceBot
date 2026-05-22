/**
 * EDAS VoiceBot — Aria AI Assistant
 * Frontend Application Script
 * ES6+ | async/await | Web Speech API
 */

'use strict';

const API_BASE = 'http://localhost:8000';

// ─── Session Manager ─────────────────────────────────────────────────────────
const SessionManager = {
  KEY: 'edas_session_id',

  get() {
    return localStorage.getItem(this.KEY);
  },

  set(id) {
    localStorage.setItem(this.KEY, id);
  },

  clear() {
    localStorage.removeItem(this.KEY);
  },
};

// ─── API Client ───────────────────────────────────────────────────────────────
const ChatAPI = {
  async sendMessage(message) {
    const sessionId = SessionManager.get();
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId || undefined,
        message,
      }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    SessionManager.set(data.session_id);
    return data;
  },

  async sendVoice(audioText) {
    const sessionId = SessionManager.get();
    const res = await fetch(`${API_BASE}/voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId || undefined,
        audio_text: audioText,
      }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    SessionManager.set(data.session_id);
    return data;
  },

  async checkHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  },
};

// ─── UI Helpers ───────────────────────────────────────────────────────────────
const UI = {
  // DOM references
  messages: null,
  typingIndicator: null,
  suggestionsBar: null,
  userInput: null,
  sendBtn: null,
  micBtn: null,
  micIcon: null,
  micStopIcon: null,
  escalationModal: null,
  sessionInfo: null,
  charCounter: null,

  // ── Init ────────────────────────────────────────────────────────────────────
  init() {
    this.messages       = document.getElementById('messages');
    this.typingIndicator = document.getElementById('typing-indicator');
    this.suggestionsBar  = document.getElementById('suggestions-bar');
    this.userInput       = document.getElementById('user-input');
    this.sendBtn         = document.getElementById('send-btn');
    this.micBtn          = document.getElementById('mic-btn');
    this.micIcon         = document.getElementById('mic-icon');
    this.micStopIcon     = document.getElementById('mic-stop-icon');
    this.escalationModal = document.getElementById('escalation-modal');
    this.sessionInfo     = document.getElementById('session-info');
    this.charCounter     = document.getElementById('char-counter');

    this.updateSessionDisplay();
    this._stampWelcomeTime();
    this._bindWelcomeChips();
    this._updateSendBtn();
  },

  // ── Stamp welcome time ──────────────────────────────────────────────────────
  _stampWelcomeTime() {
    const el = document.getElementById('welcome-time');
    if (el) {
      el.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  },

  // ── Bind welcome chips to send ──────────────────────────────────────────────
  _bindWelcomeChips() {
    const chips = document.querySelectorAll('#welcome-message .chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const action = chip.dataset.action;
        if (action) {
          this.userInput.value = action;
          this._updateSendBtn();
          this.userInput.focus();
          // Auto-send after short delay
          setTimeout(() => App.handleSend(action, false), 200);
        }
      });
    });
  },

  // ── Update send button disabled state ──────────────────────────────────────
  _updateSendBtn() {
    const isEmpty = !this.userInput.value.trim();
    this.sendBtn.disabled = isEmpty;
  },

  // ── Session display ─────────────────────────────────────────────────────────
  updateSessionDisplay() {
    const sid = SessionManager.get();
    if (this.sessionInfo) {
      this.sessionInfo.textContent = sid
        ? `Session: ${sid.substring(0, 8)}...`
        : 'New session';
    }
  },

  // ── Add message bubble ──────────────────────────────────────────────────────
  addMessage(text, sender = 'bot', animate = true) {
    const msg = document.createElement('div');
    msg.className = `message ${sender}${animate ? '' : ' no-anim'}`;

    const avatarLetter = sender === 'bot' ? 'A' : 'U';
    const avatarClass  = sender === 'bot' ? 'bot-avatar-sm' : 'user-avatar-sm';
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    msg.innerHTML = `
      <div class="message-avatar ${avatarClass}" aria-hidden="true">${avatarLetter}</div>
      <div class="message-content">
        <div class="message-bubble">${this.escapeHtml(text)}</div>
        <div class="message-meta">${time}</div>
      </div>
    `;

    this.messages.appendChild(msg);
    this.scrollToBottom();
    return msg;
  },

  // ── Add message with suggestion chips ──────────────────────────────────────
  addBotMessageWithChips(text, chips = []) {
    const msg = document.createElement('div');
    msg.className = 'message bot';

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const chipsHtml = chips.length
      ? `<div class="suggestion-chips" role="group" aria-label="Quick replies">
           ${chips.map(c => `<button class="chip" data-chip="${this.escapeHtml(c)}">${this.escapeHtml(c)}</button>`).join('')}
         </div>`
      : '';

    msg.innerHTML = `
      <div class="message-avatar bot-avatar-sm" aria-hidden="true">A</div>
      <div class="message-content">
        <div class="message-bubble">${this.escapeHtml(text)}${chipsHtml}</div>
        <div class="message-meta">${time}</div>
      </div>
    `;

    // Bind chips to input
    msg.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const val = chip.dataset.chip;
        this.userInput.value = val;
        this._updateSendBtn();
        this.userInput.focus();
      });
    });

    this.messages.appendChild(msg);
    this.scrollToBottom();
    return msg;
  },

  // ── Typing indicator ────────────────────────────────────────────────────────
  showTyping() {
    this.typingIndicator.classList.remove('hidden');
    this.scrollToBottom();
  },

  hideTyping() {
    this.typingIndicator.classList.add('hidden');
  },

  // ── Suggestions bar (footer) ────────────────────────────────────────────────
  setSuggestions(suggestions) {
    this.suggestionsBar.innerHTML = '';
    if (!suggestions || suggestions.length === 0) return;

    suggestions.forEach((s, i) => {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = s;
      chip.style.animationDelay = `${i * 0.06}s`;
      chip.addEventListener('click', () => {
        this.userInput.value = s;
        this._updateSendBtn();
        this.userInput.focus();
      });
      this.suggestionsBar.appendChild(chip);
    });
  },

  // ── Escalation modal ────────────────────────────────────────────────────────
  showEscalationModal() {
    this.escalationModal.classList.remove('hidden');
    // Trap focus inside modal
    const closeBtn = document.getElementById('modal-close-btn');
    if (closeBtn) setTimeout(() => closeBtn.focus(), 100);
  },

  hideEscalationModal() {
    this.escalationModal.classList.add('hidden');
    this.userInput.focus();
  },

  // ── Input enabled/disabled ──────────────────────────────────────────────────
  setInputDisabled(disabled) {
    this.userInput.disabled = disabled;
    if (disabled) {
      this.sendBtn.disabled = true;
    } else {
      this._updateSendBtn();
    }
  },

  // ── Mic icon toggle ─────────────────────────────────────────────────────────
  setMicRecording(isRecording) {
    if (isRecording) {
      this.micIcon.classList.add('hidden');
      this.micStopIcon.classList.remove('hidden');
      this.micBtn.classList.add('recording');
      this.micBtn.setAttribute('aria-label', 'Stop recording');
      this.micBtn.title = 'Recording… click to stop';
    } else {
      this.micIcon.classList.remove('hidden');
      this.micStopIcon.classList.add('hidden');
      this.micBtn.classList.remove('recording');
      this.micBtn.setAttribute('aria-label', 'Start voice input');
      this.micBtn.title = 'Voice input';
    }
  },

  // ── Char counter ────────────────────────────────────────────────────────────
  updateCharCounter(length, max = 1000) {
    if (!this.charCounter) return;
    if (length > max * 0.8) {
      this.charCounter.textContent = `${length}/${max}`;
      this.charCounter.classList.add('visible');
      this.charCounter.style.color = length >= max ? '#ef4444' : 'var(--text-muted)';
    } else {
      this.charCounter.classList.remove('visible');
    }
  },

  // ── Scroll messages to bottom ───────────────────────────────────────────────
  scrollToBottom() {
    setTimeout(() => {
      this.messages.scrollTop = this.messages.scrollHeight;
    }, 50);
  },

  // ── Show inline error banner ────────────────────────────────────────────────
  showError(text) {
    const err = document.createElement('div');
    err.className = 'message bot';
    err.setAttribute('role', 'alert');
    err.innerHTML = `
      <div class="message-avatar bot-avatar-sm" aria-hidden="true">!</div>
      <div class="message-content">
        <div class="message-bubble" style="border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.08);">
          ⚠️ ${this.escapeHtml(text)}
        </div>
      </div>
    `;
    this.messages.appendChild(err);
    this.scrollToBottom();
  },

  // ── XSS-safe HTML escaping ──────────────────────────────────────────────────
  escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  },
};

// ─── Voice Manager ────────────────────────────────────────────────────────────
const VoiceManager = {
  recognition: null,
  synthesis: window.speechSynthesis,
  isRecording: false,
  _voicesLoaded: false,
  _preferredVoice: null,

  // ── Init ─────────────────────────────────────────────────────────────────────
  init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('[VoiceManager] Speech Recognition not supported in this browser.');
      UI.micBtn.style.opacity = '0.4';
      UI.micBtn.title = 'Voice input not supported in this browser (use Chrome/Edge)';
      UI.micBtn.disabled = true;
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'en-US';
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;
    this.recognition.continuous = false;

    this.recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      UI.userInput.value = transcript;
      UI._updateSendBtn();
      this.stopRecording();
      await App.handleSend(transcript, true);
    };

    this.recognition.onerror = (e) => {
      console.warn('[VoiceManager] Recognition error:', e.error);
      this.stopRecording();
      if (e.error === 'not-allowed') {
        UI.showError('Microphone access was denied. Please allow microphone access in your browser.');
      }
    };

    this.recognition.onend = () => {
      if (this.isRecording) this.stopRecording();
    };

    // Pre-load voices for TTS
    if (this.synthesis) {
      this.synthesis.onvoiceschanged = () => this._loadVoices();
      this._loadVoices();
    }
  },

  // ── Load TTS voices ──────────────────────────────────────────────────────────
  _loadVoices() {
    if (this._voicesLoaded) return;
    const voices = this.synthesis.getVoices();
    if (!voices.length) return;
    this._voicesLoaded = true;

    // Prefer female en-US voice; fall back to any en-US; then first available
    this._preferredVoice =
      voices.find(v => v.lang === 'en-US' && /female|zira|samantha|victoria|karen/i.test(v.name)) ||
      voices.find(v => v.lang.startsWith('en')) ||
      voices[0] ||
      null;
  },

  // ── Start recording ──────────────────────────────────────────────────────────
  startRecording() {
    if (!this.recognition) return;
    this.isRecording = true;
    UI.setMicRecording(true);
    try {
      this.recognition.start();
    } catch (e) {
      console.warn('[VoiceManager] Could not start recognition:', e.message);
      this.stopRecording();
    }
  },

  // ── Stop recording ───────────────────────────────────────────────────────────
  stopRecording() {
    this.isRecording = false;
    UI.setMicRecording(false);
    try {
      this.recognition?.stop();
    } catch (_) { /* ignore */ }
  },

  // ── Text-to-speech ───────────────────────────────────────────────────────────
  speak(text) {
    if (!this.synthesis) return;
    // Cancel any ongoing speech
    this.synthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate  = 1.0;
    utter.pitch = 1.05;
    utter.lang  = 'en-US';

    if (this._preferredVoice) {
      utter.voice = this._preferredVoice;
    }

    utter.onerror = (e) => console.warn('[VoiceManager] TTS error:', e.error);
    this.synthesis.speak(utter);
  },
};

// ─── Health Monitor ───────────────────────────────────────────────────────────
const HealthMonitor = {
  _interval: null,
  _isOnline: true,

  start() {
    // Check immediately
    this._check();
    // Then every 30s
    this._interval = setInterval(() => this._check(), 30_000);
  },

  stop() {
    if (this._interval) clearInterval(this._interval);
  },

  async _check() {
    const ok = await ChatAPI.checkHealth();
    if (ok !== this._isOnline) {
      this._isOnline = ok;
      const dot    = document.querySelector('.status-dot');
      const badge  = document.querySelector('.status-badge');
      const label  = badge?.querySelector(':not(.status-dot)');

      if (dot && badge) {
        if (ok) {
          dot.style.background    = '#10b981';
          badge.style.borderColor = 'rgba(16,185,129,0.3)';
          badge.style.background  = 'rgba(16,185,129,0.12)';
          badge.style.color       = '#10b981';
          if (label) label.textContent = 'Online';
        } else {
          dot.style.background    = '#ef4444';
          badge.style.borderColor = 'rgba(239,68,68,0.3)';
          badge.style.background  = 'rgba(239,68,68,0.12)';
          badge.style.color       = '#ef4444';
          if (label) label.textContent = 'Offline';
        }
      }
    }
  },
};

// ─── Main App ─────────────────────────────────────────────────────────────────
const App = {
  // ── Boot ─────────────────────────────────────────────────────────────────────
  async init() {
    UI.init();
    VoiceManager.init();
    this.bindEvents();
    UI.updateSessionDisplay();
    HealthMonitor.start();
    console.info('[EDAS VoiceBot] Aria initialized 🤖');
  },

  // ── Event bindings ────────────────────────────────────────────────────────────
  bindEvents() {
    // Send on button click
    UI.sendBtn.addEventListener('click', () => {
      const text = UI.userInput.value.trim();
      if (text) App.handleSend(text, false);
    });

    // Send on Enter (not Shift+Enter)
    UI.userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = UI.userInput.value.trim();
        if (text) App.handleSend(text, false);
      }
    });

    // Auto-resize textarea + update send btn + char counter
    UI.userInput.addEventListener('input', () => {
      // Resize
      UI.userInput.style.height = 'auto';
      UI.userInput.style.height = Math.min(UI.userInput.scrollHeight, 120) + 'px';
      // Send btn state
      UI._updateSendBtn();
      // Char counter
      UI.updateCharCounter(UI.userInput.value.length);
    });

    // Mic toggle
    UI.micBtn.addEventListener('click', () => {
      if (VoiceManager.isRecording) {
        VoiceManager.stopRecording();
      } else {
        VoiceManager.startRecording();
      }
    });

    // Close escalation modal
    document.getElementById('modal-close-btn').addEventListener('click', () => {
      UI.hideEscalationModal();
    });

    // Close modal on backdrop click
    document.getElementById('escalation-modal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('escalation-modal')) {
        UI.hideEscalationModal();
      }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !document.getElementById('escalation-modal').classList.contains('hidden')) {
        UI.hideEscalationModal();
      }
    });

    // Paste handler — focus input if user pastes anywhere on the page
    document.addEventListener('paste', () => {
      UI.userInput.focus();
    });
  },

  // ── Core send handler ─────────────────────────────────────────────────────────
  async handleSend(text, isVoice = false) {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Clear input & suggestions
    UI.userInput.value = '';
    UI.userInput.style.height = 'auto';
    UI._updateSendBtn();
    UI.setSuggestions([]);

    // Append user message
    UI.addMessage(trimmed, 'user');
    UI.showTyping();
    UI.setInputDisabled(true);

    try {
      // Call appropriate endpoint
      const data = isVoice
        ? await ChatAPI.sendVoice(trimmed)
        : await ChatAPI.sendMessage(trimmed);

      UI.hideTyping();

      // Add bot response (with inline chips if present)
      if (data.suggestions && data.suggestions.length > 0) {
        UI.addBotMessageWithChips(data.response, data.suggestions);
      } else {
        UI.addMessage(data.response, 'bot');
      }

      // Update footer suggestions bar
      UI.setSuggestions(data.suggestions || []);

      // Update session display
      UI.updateSessionDisplay();

      // TTS for voice-triggered queries
      if (isVoice) {
        VoiceManager.speak(data.response);
      }

      // Handle escalation
      if (data.escalate) {
        setTimeout(() => UI.showEscalationModal(), 800);
      }

    } catch (err) {
      UI.hideTyping();
      UI.showError('Sorry, I couldn\'t reach the server. Please check your connection and try again.');
      console.error('[App] API Error:', err);
    } finally {
      UI.setInputDisabled(false);
      UI.userInput.focus();
    }
  },
};

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
