/**
 * dialogue.js - 对话系统（支持固定剧情 + 自由聊天双模式）
 *
 * 两种 NPC 对话模式：
 *   1. scripted（固定剧情）：NPC 按预设台词逐行展示 → 玩家从选项中选择
 *   2. free_chat（自由输入）：玩家自由输入，LLM 生成 NPC 回复
 *
 * 对话历史在自由聊天模式下保留（滑动窗口由后端管理）
 */

class DialogueSystem {
  constructor() {
    this.overlay = null;
    this.box = null;
    this.isOpen = false;
    this.onClose = null;

    // NPC 对话状态
    this.chatNpcId = null;
    this.chatNpcName = null;
    this.chatHistory = [];     // [{role: 'npc'|'player'|'system', text, ...}]
    this.chatSending = false;
    this.chatMode = null;      // 'scripted' | 'free_chat' | null

    // 固定剧情状态
    this.currentScript = null;

    this._init();
  }

  _init() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'dialogue-overlay';
    this.overlay.innerHTML = `<div id="dialogue-box"></div>`;
    document.body.appendChild(this.overlay);
    this.box = document.getElementById('dialogue-box');

    document.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (this.chatMode === 'free_chat' && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._sendChatMessage();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    });
  }

  // ========== NPC 交互入口（自动判断模式） ==========

  async startNPCInteraction(npcId, npcName) {
    this.chatNpcId = npcId;
    this.chatNpcName = npcName;
    this.chatHistory = [];
    this.chatSending = false;
    this.currentScript = null;
    this.chatMode = null;

    // 显示加载状态
    this.box.innerHTML = `
      <div class="dlg-header">${this._escHtml(npcName)}</div>
      <div class="dlg-text" style="text-align:center;color:#6a6a7a;">正在与 ${this._escHtml(npcName)} 接触……</div>
    `;
    this._open();

    try {
      const res = await fetch('/api/npc_interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npc_id: npcId, message: '' }),
      });
      const data = await res.json();

      if (data.error) {
        this.box.innerHTML = `
          <div class="dlg-header">${this._escHtml(npcName)}</div>
          <div class="dlg-text">${data.error}</div>
          <div class="dlg-actions"><button class="dlg-btn" onclick="dialogue.close()">关闭</button></div>
        `;
        return;
      }

      if (data.mode === 'scripted') {
        this._enterScriptedMode(data.script);
      } else {
        this._enterFreeChatMode(data.greeting);
      }
    } catch (e) {
      this._enterFreeChatMode('……（对方看了你一眼）');
    }
  }

  // ========== 固定剧情模式 ==========

  _enterScriptedMode(script) {
    this.chatMode = 'scripted';
    this.currentScript = script;

    // 将剧情台词加入历史
    for (const line of script.lines) {
      this.chatHistory.push({
        role: line.speaker === 'npc' ? 'npc' : 'player',
        text: line.text,
      });
    }

    this._renderScripted();
  }

  _renderScripted() {
    const script = this.currentScript;
    let chatHtml = this._buildChatHtml();

    // 选项按钮
    let choicesHtml = '';
    if (script.choices && script.choices.length > 0) {
      for (const c of script.choices) {
        choicesHtml += `<button class="dlg-choice" onclick="dialogue._handleScriptChoice(${c.index})">${c.text}</button>`;
      }
    }

    this.box.innerHTML = `
      <div class="dlg-header">${this._escHtml(this.chatNpcName)}<span class="chat-mode-tag chat-mode-scripted">剧情</span></div>
      <div class="chat-log" id="chat-log">${chatHtml}</div>
      <div class="dlg-choices">${choicesHtml}</div>
      <div class="chat-hint">选择一个选项 · Esc 离开</div>
    `;

    this._scrollChatToBottom();
  }

  async _handleScriptChoice(choiceIndex) {
    const script = this.currentScript;
    if (!script) return;

    const choiceText = script.choices[choiceIndex]?.text || '……';
    this.chatHistory.push({ role: 'player', text: choiceText });

    // 禁用选项按钮
    const buttons = this.box.querySelectorAll('.dlg-choice');
    buttons.forEach(btn => { btn.disabled = true; btn.style.opacity = '0.5'; });

    try {
      const res = await fetch('/api/npc_script_choice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          npc_id: this.chatNpcId,
          script_id: script.id,
          choice_index: choiceIndex,
        }),
      });
      const data = await res.json();

      if (data.reply) {
        this.chatHistory.push({ role: 'npc', text: data.reply });
      }

      // 处理效果
      if (data.effects) {
        this._pushEffectMessages(data.effects);
      }
      if (data.effect_logs && data.effect_logs.length > 0) {
        this.chatHistory.push({
          role: 'system',
          type: 'effect_logs',
          logs: data.effect_logs,
        });
      }

      // 更新 HUD
      if (data.character && game.hud) {
        game.hud.update(data.character);
      }
    } catch (e) {
      this.chatHistory.push({ role: 'npc', text: '……（对方沉默了）' });
    }

    // 剧情结束后切换到自由聊天模式
    this.currentScript = null;
    this._switchToFreeChat();
  }

  _switchToFreeChat() {
    this.chatMode = 'free_chat';
    this._renderChat();
  }

  // ========== 自由聊天模式 ==========

  _enterFreeChatMode(greeting) {
    this.chatMode = 'free_chat';
    this.chatHistory.push({ role: 'npc', text: greeting });
    this._renderChat();
  }

  _renderChat() {
    let chatHtml = this._buildChatHtml();

    if (this.chatSending) {
      chatHtml += `
        <div class="chat-msg chat-npc">
          <span class="chat-name chat-name-npc">${this._escHtml(this.chatNpcName)}</span>
          <div class="chat-bubble chat-bubble-npc chat-typing">
            <span class="typing-dot">·</span><span class="typing-dot">·</span><span class="typing-dot">·</span>
          </div>
        </div>`;
    }

    this.box.innerHTML = `
      <div class="dlg-header">${this._escHtml(this.chatNpcName)}<span class="chat-mode-tag chat-mode-free">自由对话</span></div>
      <div class="chat-log" id="chat-log">${chatHtml}</div>
      <div class="chat-input-row">
        <input type="text" id="chat-input" class="chat-input" placeholder="说点什么……" autocomplete="off" ${this.chatSending ? 'disabled' : ''}>
        <button class="dlg-btn chat-send-btn" id="chat-send-btn" onclick="dialogue._sendChatMessage()" ${this.chatSending ? 'disabled' : ''}>发送</button>
      </div>
      <div class="chat-hint">Enter 发送 · Esc 离开</div>
    `;

    this._scrollChatToBottom();
  }

  async _sendChatMessage() {
    if (this.chatSending) return;
    const input = document.getElementById('chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    this.chatHistory.push({ role: 'player', text });
    this.chatSending = true;
    this._renderChat();

    try {
      const res = await fetch('/api/npc_chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npc_id: this.chatNpcId, message: text }),
      });
      const data = await res.json();

      if (data.error) {
        this.chatHistory.push({ role: 'npc', text: '……（对方沉默了）' });
      } else {
        this.chatHistory.push({ role: 'npc', text: data.reply });

        if (data.effects) {
          this._pushEffectMessages(data.effects);
        }

        if (data.character && game.hud) {
          game.hud.update(data.character);
        }
      }
    } catch (e) {
      this.chatHistory.push({ role: 'npc', text: '……（对方似乎没听到你说什么）' });
    }

    this.chatSending = false;
    this._renderChat();
  }

  _pushEffectMessages(fx) {
    if (fx.relationship) {
      this.chatHistory.push({
        role: 'system',
        type: 'relationship',
        relationship: fx.relationship,
        sentiment_desc: fx.sentiment_desc || '',
      });
    }
    if (fx.logs && fx.logs.length > 0) {
      this.chatHistory.push({
        role: 'system',
        type: 'effect_logs',
        logs: fx.logs,
        milestone: fx.milestone_triggered || false,
      });
    }
  }

  // ========== 共用：构建聊天记录 HTML ==========

  _buildChatHtml() {
    let html = '';
    for (const msg of this.chatHistory) {
      if (msg.role === 'npc') {
        html += `
          <div class="chat-msg chat-npc">
            <span class="chat-name chat-name-npc">${this._escHtml(this.chatNpcName)}</span>
            <div class="chat-bubble chat-bubble-npc">${this._escHtml(msg.text)}</div>
          </div>`;
      } else if (msg.role === 'player') {
        html += `
          <div class="chat-msg chat-player">
            <span class="chat-name chat-name-player">你</span>
            <div class="chat-bubble chat-bubble-player">${this._escHtml(msg.text)}</div>
          </div>`;
      } else if (msg.role === 'system' && msg.type === 'relationship') {
        const rel = msg.relationship;
        html += `
          <div class="chat-system-msg">
            <div class="chat-rel-bar">
              <span class="chat-rel-icon">${rel.level_icon}</span>
              <span class="chat-rel-level" style="color:${rel.level_color}">${rel.level_name}</span>
              <span class="chat-rel-value">${rel.value}</span>
              <div class="chat-rel-meter">
                <div class="chat-rel-fill" style="width:${Math.max(0, (rel.value + 100) / 2)}%;background:${rel.level_color}"></div>
              </div>
            </div>
            ${msg.sentiment_desc ? `<div class="chat-sentiment">${msg.sentiment_desc}</div>` : ''}
          </div>`;
      } else if (msg.role === 'system' && msg.type === 'effect_logs') {
        let logsHtml = '';
        for (const log of msg.logs) {
          const isMilestone = log.startsWith('★');
          logsHtml += `<div class="chat-effect-line ${isMilestone ? 'chat-milestone' : ''}">${log}</div>`;
        }
        html += `<div class="chat-system-msg chat-effects">${logsHtml}</div>`;
      }
    }
    return html;
  }

  _scrollChatToBottom() {
    setTimeout(() => {
      const log = document.getElementById('chat-log');
      if (log) log.scrollTop = log.scrollHeight;
      const input = document.getElementById('chat-input');
      if (input && !this.chatSending) input.focus();
    }, 50);
  }

  _escHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ========== 事件/选择/结果（保持原有逻辑） ==========

  showEvent(eventData) {
    this.chatNpcId = null;
    this.chatMode = null;
    let choicesHtml = '';
    if (eventData.choices) {
      eventData.choices.forEach((c, i) => {
        choicesHtml += `<button class="dlg-choice" onclick="game.handleChoice(${c.index})">${i + 1}. ${c.text}</button>`;
      });
    }
    this.box.innerHTML = `
      <div class="dlg-header dlg-event-title">— ${eventData.title} —</div>
      <div class="dlg-text">${eventData.description}</div>
      <div class="dlg-choices">${choicesHtml}</div>
    `;
    this._open();
  }

  showResult(data) {
    this.chatNpcId = null;
    this.chatMode = null;
    let effectHtml = '';
    if (data.effect_logs) {
      data.effect_logs.forEach(log => {
        effectHtml += `<div class="dlg-effect">${log}</div>`;
      });
    }
    this.box.innerHTML = `
      <div class="dlg-header">结果</div>
      <div class="dlg-result-text">${data.choice_text}</div>
      <div class="dlg-text">${data.result}</div>
      ${effectHtml}
      <div class="dlg-actions">
        <button class="dlg-btn" onclick="dialogue.close()">继续</button>
      </div>
    `;
    this._open();
  }

  showEnding(data) {
    this.chatNpcId = null;
    this.chatMode = null;
    const isVictory = data.victory;
    this.box.innerHTML = `
      <div class="dlg-header ${isVictory ? 'dlg-victory' : 'dlg-defeat'}">
        ${isVictory ? '—— 你活了下来 ——' : '—— 游戏结束 ——'}
      </div>
      <div class="dlg-text dlg-ending-text">${data.ending}</div>
      <div class="dlg-actions">
        <button class="dlg-btn dlg-btn-restart" onclick="location.reload()">重新开始</button>
      </div>
    `;
    this._open();
  }

  showDailyReport(data) {
    this.chatNpcId = null;
    this.chatMode = null;
    let logsHtml = '';
    if (data.daily_logs) {
      data.daily_logs.forEach(log => {
        logsHtml += `<div class="dlg-log-line">· ${log}</div>`;
      });
    }

    const phaseName = data.phase ? data.phase.name : '';
    const phaseDesc = data.phase ? data.phase.description : '';

    let html = `
      <div class="dlg-header">第 ${data.day} 天${phaseName ? ' · ' + phaseName : ''}</div>
      ${phaseDesc ? `<div class="dlg-phase-desc">${phaseDesc}</div>` : ''}
      <div class="dlg-logs">${logsHtml}</div>
    `;

    if (data.game_over) {
      html += `
        <div class="dlg-text dlg-ending-text">${data.ending}</div>
        <div class="dlg-actions">
          <button class="dlg-btn dlg-btn-restart" onclick="location.reload()">重新开始</button>
        </div>
      `;
      this.box.innerHTML = html;
      this._open();
      return;
    }

    if (data.event) {
      let choicesHtml = '';
      data.event.choices.forEach((c, i) => {
        choicesHtml += `<button class="dlg-choice" onclick="game.handleChoice(${c.index})">${i + 1}. ${c.text}</button>`;
      });
      html += `
        <div class="dlg-event-divider"></div>
        <div class="dlg-header dlg-event-title">— ${data.event.title} —</div>
        <div class="dlg-text">${data.event.description}</div>
        <div class="dlg-choices">${choicesHtml}</div>
      `;
    } else {
      html += `
        <div class="dlg-text" style="color:#6a6a7a;">今天平平无奇，什么也没发生。</div>
        <div class="dlg-actions">
          <button class="dlg-btn" onclick="dialogue.close()">继续</button>
        </div>
      `;
    }

    this.box.innerHTML = html;
    this._open();
  }

  showFreeInput() {
    this.chatNpcId = null;
    this.chatMode = null;
    this.box.innerHTML = `
      <div class="dlg-header" style="color:#6a8aba;">自由输入</div>
      <div class="dlg-text">说出你的感受、遭遇或想法……AI 会将其转化为游戏事件。</div>
      <textarea id="dlg-free-input" class="dlg-textarea" placeholder="在这里输入..." rows="3"></textarea>
      <div class="dlg-actions">
        <button class="dlg-btn" onclick="game.submitFreeInput()">诉说</button>
        <button class="dlg-btn dlg-btn-cancel" onclick="dialogue.close()">取消</button>
      </div>
    `;
    this._open();
    setTimeout(() => {
      const ta = document.getElementById('dlg-free-input');
      if (ta) ta.focus();
    }, 100);
  }

  _open() {
    this.overlay.classList.add('visible');
    this.isOpen = true;
  }

  close() {
    this.overlay.classList.remove('visible');
    this.isOpen = false;
    this.chatNpcId = null;
    this.chatMode = null;
    this.chatSending = false;
    this.currentScript = null;
    if (this.onClose) {
      const cb = this.onClose;
      this.onClose = null;
      cb();
    }
  }
}
