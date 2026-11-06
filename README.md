# 👻 Mistis AI

Ngobrol dengan hantu-hantu Nusantara — **Pocong, Kuntilanak, Genderuwo, Tuyul, dan Kuyang** — dalam
suasana horor malam: hutan gelap, bangunan kosong, kuburan, beringin perempatan, dan rawa Borneo.

Static web app (HTML/CSS/vanilla JS, **tanpa build, tanpa dependency, tanpa backend**).

## Fitur
- 📡 **Pemindai hantu (gacha)** saat pertama kali membuka situs: radar menyapu area, sinyal gaib muncul,
  satu hantu dipilih acak (berbobot: Umum → Legendaris) lalu "menghampiri" dan memulai obrolan.
- 👤 **5 agen hantu** dengan kepribadian, logat, folklor, dan keahlian masing-masing + avatar SVG beranimasi.
- 🌲 **5 latar** prosedural beranimasi (kabut, kunang-kunang, mata menyala, kilat, lilin, suara angin opsional).
- 🔌 **Bring-your-own LLM**: Base URL + API key + model apa pun yang kompatibel OpenAI
  (`/v1/chat/completions` & `/v1/models`) — OpenAI, OpenRouter, Groq, Together, LM Studio, Ollama, vLLM, dll. Streaming didukung.
- 🔒 **Privasi**: kunci dienkripsi **AES-256-GCM** (WebCrypto) dan hanya disimpan di browser-mu.

## Privasi & keamanan
- Tidak ada server Mistis AI. Browser mengirim permintaan **langsung** ke Base URL yang kamu isi.
- Base URL/API key/model disimpan terenkripsi di `localStorage` (`mistis.vault.v1`). Tiga mode:
  - **Passphrase** – kunci diturunkan via PBKDF2-SHA256 (310.000 iterasi) dari passphrase-mu; tidak pernah disimpan.
  - **Kunci perangkat** – kunci AES non-extractable di IndexedDB (buka otomatis, kurang kuat terhadap malware lokal).
  - **Sesi saja** – tidak ada yang disimpan.
- Riwayat obrolan hanya di memori tab; hilang saat ditutup/refresh.
- `Content-Security-Policy` membatasi skrip ke origin sendiri; tanpa CDN, font, atau analytics.
- Enkripsi WebCrypto butuh **HTTPS atau localhost**.
- Catatan: endpoint LLM harus mengizinkan CORS dari browser (OpenRouter, Groq, Ollama dengan `OLLAMA_ORIGINS`, LM Studio dengan CORS aktif, dll.).

## Jalankan lokal
```bash
python3 -m http.server 8000   # lalu buka http://localhost:8000
```

## Deploy ke GitHub Pages
Settings → Pages → Deploy from branch → `main` / root.

## Struktur
```
index.html          # shell + dialog
css/style.css       # tema horor, animasi avatar & scanner
js/ghosts.js        # identitas, system prompt, avatar SVG
js/scenes.js        # latar SVG prosedural
js/scanner.js       # radar gacha saat buka situs
js/vault.js         # enkripsi lokal (AES-GCM)
js/llm.js           # klien OpenAI-compatible + streaming
js/sound.js         # ambience WebAudio
js/app.js           # logika aplikasi
```

## Menambah hantu
Tambahkan objek di `js/ghosts.js` (`id`, `name`, `system`, `svg`, `favScene`, …) dan masukkan `id`-nya ke `POOL` di `js/scanner.js`.

> Konten bersifat hiburan/folklor. Agen diarahkan untuk tidak memberi saran berbahaya dan tidak menampilkan gore.
