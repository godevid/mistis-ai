/* Mistis AI — minimal OpenAI-compatible client (runs directly from your browser to YOUR endpoint). */
(function () {
  function normalizeBase(url) {
    let u = (url || '').trim().replace(/\/+$/, '');
    u = u.replace(/\/chat\/completions$/, '');
    return u;
  }
  function headers(cfg) {
    const h = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) h.Authorization = 'Bearer ' + cfg.apiKey;
    return h;
  }
  async function errorText(res) {
    let t = '';
    try {
      t = await res.text();
      const j = JSON.parse(t);
      t = j.error?.message || j.message || t;
    } catch {}
    return `HTTP ${res.status}${t ? ' — ' + String(t).slice(0, 300) : ''}`;
  }

  const LLM = {
    normalizeBase,
    async listModels(cfg, signal) {
      const res = await fetch(normalizeBase(cfg.baseUrl) + '/models', { headers: headers(cfg), signal });
      if (!res.ok) throw new Error(await errorText(res));
      const j = await res.json();
      return (j.data || j.models || []).map((m) => m.id || m.name).filter(Boolean).sort();
    },
    /** Streams a chat completion. onDelta(text) called per chunk. Returns full text. */
    async stream(cfg, messages, onDelta, signal) {
      const body = { model: cfg.model, messages, stream: true };
      if (cfg.temperature !== undefined && cfg.temperature !== '') body.temperature = Number(cfg.temperature);
      const res = await fetch(normalizeBase(cfg.baseUrl) + '/chat/completions', {
        method: 'POST',
        headers: headers(cfg),
        body: JSON.stringify(body),
        signal,
      });
      if (!res.ok) throw new Error(await errorText(res));
      const ctype = res.headers.get('content-type') || '';
      if (!ctype.includes('text/event-stream') && !res.body) {
        const j = await res.json();
        const t = j.choices?.[0]?.message?.content || '';
        onDelta(t);
        return t;
      }
      if (!ctype.includes('text/event-stream')) {
        const j = await res.json();
        const t = j.choices?.[0]?.message?.content || '';
        onDelta(t);
        return t;
      }
      const reader = res.body.getReader();
      const td = new TextDecoder();
      let buf = '', full = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += td.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') return full;
          try {
            const d = JSON.parse(data).choices?.[0]?.delta?.content;
            if (d) {
              full += d;
              onDelta(d);
            }
          } catch {}
        }
      }
      return full;
    },
  };
  window.LLM = LLM;
})();
