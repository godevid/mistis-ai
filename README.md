# 👻 Mistis AI

Ngobrol dengan hantu-hantu Nusantara — **Pocong, Kuntilanak, Genderuwo, Tuyul, Kuyang, Sundel Bolong, Wewe Gombel, dan Babi Ngepet** — dalam
suasana horor malam: hutan gelap, bangunan kosong, kuburan, beringin perempatan, rawa Borneo, sekolah angker, jembatan tua, joglo & sumur, dan Bukit Gombel.

Static web app (HTML/CSS/vanilla JS, **tanpa build, tanpa dependency, tanpa backend**).

## Fitur
- 📡 **Pemindai hantu (gacha)** saat pertama kali membuka situs: radar menyapu area, sinyal gaib muncul,
  satu hantu dipilih acak (berbobot: Umum → Legendaris) lalu "menghampiri" dan memulai obrolan.
- 👤 **8 agen hantu** dengan kepribadian, logat, folklor, dan keahlian masing-masing + avatar SVG beranimasi.
- 🌲 **9 latar** prosedural beranimasi (kabut, kunang-kunang, mata menyala, kilat, lilin, suara angin opsional).
- 🔌 **Bring-your-own LLM**: Base URL + API key + model apa pun yang kompatibel OpenAI
  (`/v1/chat/completions` & `/v1/models`) — OpenAI, OpenRouter, Groq, Together, LM Studio, Ollama, vLLM, dll. Streaming didukung.
- 🔒 **Privasi**: kunci dienkripsi **AES-256-GCM** (WebCrypto) dan hanya disimpan di browser-mu.
- 💾 **Riwayat obrolan lokal (opsional)**: dienkripsi dengan kunci yang sama, tersimpan hanya di browser ini.

## Privasi & keamanan
- Tidak ada server Mistis AI. Browser mengirim permintaan **langsung** ke Base URL yang kamu isi.
- Base URL/API key/model disimpan terenkripsi di `localStorage` (`mistis.vault.v1`). Tiga mode:
  - **Passphrase** – kunci diturunkan via PBKDF2-SHA256 (310.000 iterasi) dari passphrase-mu; tidak pernah disimpan.
  - **Kunci perangkat** – kunci AES non-extractable di IndexedDB (buka otomatis, kurang kuat terhadap malware lokal).
  - **Sesi saja** – tidak ada yang disimpan.
- Riwayat obrolan **secara default hanya di memori tab**. Jika kamu mengaktifkan *Simpan riwayat obrolan secara lokal* (Pengaturan → LLM), riwayat dienkripsi AES-256-GCM dengan kunci brankas yang sama (IV acak per penyimpanan) di `localStorage` (`mistis.history.v1`) dan dimuat setelah brankas dibuka. Butuh mode Passphrase / Kunci perangkat; mode "Sesi saja" tidak menyimpan apa pun. Bisa dihapus kapan saja lewat tombol *Hapus riwayat tersimpan*.
- Jika brankas terkunci (tombol "Nanti"), riwayat tersimpan tidak dibaca maupun ditimpa.
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
Tambahkan objek di `js/ghosts.js` (`id`, `name`, `system`, `svg`, `favScene`, …) dan masukkan `id` + bobot rarity-nya ke `POOL` di `js/scanner.js`.

## Menambah latar
Buat fungsi builder SVG di `js/scenes.js` lalu daftarkan di `window.SCENES`.

> Konten bersifat hiburan/folklor. Agen diarahkan untuk tidak memberi saran berbahaya dan tidak menampilkan gore.
