/* Mistis AI — local encrypted vault.
 * Secrets (base URL, API key, model) are encrypted with AES-GCM (WebCrypto) and stored ONLY in this
 * browser (localStorage). Nothing is ever sent to any server except the LLM endpoint YOU configure.
 *
 * Two protection modes:
 *  - "passphrase": key derived with PBKDF2-SHA256 (310k iterations) from a passphrase you type each session.
 *  - "device":     random non-extractable AES key kept in this browser's IndexedDB (auto-unlock, convenience).
 */
(function () {
  const LS_KEY = 'mistis.vault.v1';
  const DB_NAME = 'mistis-keys';
  const AAD = new TextEncoder().encode('mistis-ai:vault:v1');
  const ITER = 310000;
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  // Decrypted-capable key held in memory only for this tab session (non-extractable CryptoKey).
  let activeKey = null;
  const blobKey = (name) => `mistis.${name}.v1`;

  const b64 = (buf) => {
    let s = '';
    new Uint8Array(buf).forEach((b) => (s += String.fromCharCode(b)));
    return btoa(s);
  };
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  function openDb() {
    return new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('keys');
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }
  async function idbGet(k) {
    const db = await openDb();
    return new Promise((res, rej) => {
      const r = db.transaction('keys').objectStore('keys').get(k);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function idbPut(k, v) {
    const db = await openDb();
    return new Promise((res, rej) => {
      const tx = db.transaction('keys', 'readwrite');
      tx.objectStore('keys').put(v, k);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  async function passKey(pass, salt, iter) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }
  async function deviceKey(create) {
    let k = await idbGet('device');
    if (!k && create) {
      k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      await idbPut('device', k);
    }
    return k;
  }

  const Vault = {
    exists() {
      return !!localStorage.getItem(LS_KEY);
    },
    mode() {
      try {
        return JSON.parse(localStorage.getItem(LS_KEY)).mode;
      } catch {
        return null;
      }
    },
    async save(data, mode, passphrase) {
      if (!window.crypto?.subtle) throw new Error('Enkripsi butuh koneksi aman (HTTPS atau localhost). Buka situs lewat https:// atau pilih mode "Sesi saja".');
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const rec = { v: 1, mode, iv: b64(iv) };
      let key;
      if (mode === 'passphrase') {
        if (!passphrase || passphrase.length < 6) throw new Error('Passphrase minimal 6 karakter.');
        const salt = crypto.getRandomValues(new Uint8Array(16));
        rec.salt = b64(salt);
        rec.iter = ITER;
        key = await passKey(passphrase, salt, ITER);
      } else {
        key = await deviceKey(true);
      }
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, enc.encode(JSON.stringify(data)));
      rec.ct = b64(ct);
      localStorage.setItem(LS_KEY, JSON.stringify(rec));
      activeKey = key;
    },
    async load(passphrase) {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const rec = JSON.parse(raw);
      let key;
      if (rec.mode === 'passphrase') {
        if (!passphrase) throw new Error('Passphrase dibutuhkan.');
        key = await passKey(passphrase, unb64(rec.salt), rec.iter || ITER);
      } else {
        key = await deviceKey(false);
        if (!key) throw new Error('Kunci perangkat tidak ditemukan. Simpan ulang konfigurasi.');
      }
      try {
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.iv), additionalData: AAD }, key, unb64(rec.ct));
        const data = JSON.parse(dec.decode(pt));
        activeKey = key;
        return data;
      } catch {
        throw new Error('Gagal membuka: passphrase salah atau data rusak.');
      }
    },
    hasKey() {
      return !!activeKey;
    },
    hasBlob(name) {
      return !!localStorage.getItem(blobKey(name));
    },
    removeBlob(name) {
      localStorage.removeItem(blobKey(name));
    },
    /** Encrypt any JSON-able object with the active vault key and store it locally (AES-GCM, fresh IV). */
    async saveBlob(name, obj) {
      if (!activeKey) throw new Error('Brankas terkunci.');
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const aad = enc.encode('mistis-ai:' + name + ':v1');
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, activeKey, enc.encode(JSON.stringify(obj)));
      localStorage.setItem(blobKey(name), JSON.stringify({ v: 1, iv: b64(iv), ct: b64(ct) }));
    },
    async loadBlob(name) {
      if (!activeKey) throw new Error('Brankas terkunci.');
      const raw = localStorage.getItem(blobKey(name));
      if (!raw) return null;
      const rec = JSON.parse(raw);
      try {
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.iv), additionalData: enc.encode('mistis-ai:' + name + ':v1') }, activeKey, unb64(rec.ct));
        return JSON.parse(dec.decode(pt));
      } catch {
        throw new Error('Riwayat tidak bisa dibuka dengan kunci saat ini.');
      }
    },
    async wipe() {
      activeKey = null;
      localStorage.removeItem(blobKey('history'));
      localStorage.removeItem(LS_KEY);
      await new Promise((res) => {
        const r = indexedDB.deleteDatabase(DB_NAME);
        r.onsuccess = r.onerror = r.onblocked = () => res();
      });
    },
  };
  window.Vault = Vault;
})();
