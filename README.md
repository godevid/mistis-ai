# 👻 Mistis AI

Ngobrol dengan hantu-hantu Nusantara — **Pocong, Kuntilanak, Genderuwo, Tuyul, Kuyang, Sundel Bolong, Wewe Gombel, dan Babi Ngepet** — dalam
pengalaman horor malam yang imersif: kamu tidak memilih hantu atau lokasi, **scanner gacha** yang menentukan siapa yang datang dan di mana.

Static web app (HTML/CSS/vanilla JS, **tanpa build, tanpa dependency, tanpa backend, tanpa file gambar/audio**).

## Alur
1. **📡 Pemindai (gacha)** — radar memindai, sinyal gaib muncul, satu hantu terpilih acak (berbobot rarity Umum → Legendaris) **beserta lokasinya**.
2. **Pertemuan** — hantu muncul di lokasi (kuburan, hutan, bangunan kosong, beringin, rawa, sekolah angker, jembatan tua, joglo & sumur, Bukit Gombel). Tidak ada menu pilih karakter/lokasi. Makin lama, sosok itu makin dekat.
3. **Waktu acak** — setiap pertemuan berlangsung acak **2,5–5,5 menit**. Menjelang habis ada **pertanda** (lampu berkedip, suhu turun, bisikan), lalu **skenario kabur** sesuai karakter (Pocong: ayam berkokok; Kuntilanak: tawa menjauh ke pohon; Genderuwo: senter & kentongan warga; Tuyul: ibu-ibu menabur bawang merah; Kuyang: fajar; Sundel Bolong: lampu mobil; Wewe Gombel: kentongan ronda; Babi Ngepet: warga mengejar). Hantu mengucapkan salam perpisahan (dibuat LLM sesuai karakter, ada cadangan skrip), menghilang, dan kamu **kembali ke menu scanner**.
   Tombol **Akhiri** memutus pertemuan lebih awal. Jawaban yang sedang diketik tidak dipotong oleh timer.

## Tampilan realistis
Semua dirender prosedural (tanpa aset): penampakan hantu dengan kain/kulit/rambut/bulu bertekstur dan cahaya bulan, latar malam dengan bulan bertekstur kawah, awan & kabut fBm, butiran film (grain), debu, vignette, scanlines, kamera bernapas, kilat dan *glitch* saat pertanda. Hantu muncul/berkedip/berpindah tempat acak dan bereaksi saat membalas.

## Suara seram (disintesis WebAudio)
- **Per lokasi**: bed ambience (angin, jangkrik, air, dengung) + kejadian acak — burung hantu, lolongan anjing, derit pintu/ayunan, tetes air, gamelan jauh, kodok, tonggeret, kentongan, bisikan, dll.
- **Per karakter**: Pocong (lompatan & rintihan), Kuntilanak (tawa "hihihi" & tangis), Genderuwo (geraman & tawa berat, langkah berat), Tuyul (cekikikan, kelereng, koin), Kuyang (kepak sayap & nyanyian aneh), Sundel Bolong (hak sepatu, senandung, korek api), Wewe Gombel (nina bobo & tangis bayi), Babi Ngepet (dengusan "grok", derap, koin).
- **Skenario**: pertanda, ayam berkokok, mobil lewat, kentongan, dst. Tombol **Suara** untuk mati/hidup (tersimpan).
> Suara bersifat sintetis (bukan rekaman). Headphone sangat disarankan.

## Bring-your-own LLM & privasi
- Base URL + API key + model apa pun yang kompatibel OpenAI (`/chat/completions`, `/models`) — OpenAI, OpenRouter, Groq, Together, LM Studio, Ollama, vLLM, dll. Streaming didukung.
- Kunci dienkripsi **AES-256-GCM** (WebCrypto) dan hanya tersimpan di browsermu. Mode: **Passphrase** (PBKDF2-SHA256 310k), **Kunci perangkat** (non-extractable di IndexedDB), atau **Sesi saja**.
- Riwayat obrolan secara default hanya di memori. Opsional: simpan **terenkripsi** secara lokal (kunci yang sama). Jika brankas terkunci, riwayat tidak dibaca maupun ditimpa. Hapus kapan saja.
- Tidak ada server Mistis AI; permintaan langsung dari browser ke endpoint-mu. CSP ketat, tanpa CDN/font/analytics. Enkripsi butuh **HTTPS atau localhost**; endpoint LLM harus mengizinkan CORS.

## Jalankan
```bash
python3 -m http.server 8000   # lalu buka http://localhost:8000
```
GitHub Codespaces: *Code → Codespaces → Create codespace* (server otomatis di port 8000). GitHub Pages: Settings → Pages → `main` / root.

### Parameter debug (opsional, lewat URL)
| Parameter | Contoh | Fungsi |
|---|---|---|
| `stay` | `?stay=15-30` | durasi pertemuan dalam detik (default 150–330) |
| `force` | `?force=pocong` | paksa hasil gacha ke satu hantu |
| `scene` | `?scene=graveyard` | paksa lokasi (`forest, building, graveyard, beringin, rawa, school, bridge, joglo, bukit`) |

## Struktur
```
index.html            # dunia + UI pertemuan + scanner + dialog
css/style.css         # tema horor, lapisan dunia, animasi penampakan
js/ghosts.js          # identitas, system prompt, lokasi cocok, skenario kabur
js/apparitions.js     # penampakan realistis (SVG berfilter/prosedural)
js/scenes.js          # latar malam prosedural
js/atmosphere.js      # kabut/awan fBm, grain, debu, flicker, glitch, vanish
js/sound.js           # mesin suara WebAudio (ambience, karakter, skenario)
js/scanner.js         # radar gacha (hantu + lokasi)
js/app.js             # alur pertemuan, timer, perpisahan, chat, vault/riwayat
js/vault.js, llm.js   # enkripsi lokal, klien OpenAI-compatible
```

## Menambah hantu / latar
- Hantu: tambahkan objek di `js/ghosts.js` (`system`, `scenes`, `farewell`, …), penampakan di `js/apparitions.js`, suara di `CH` pada `js/sound.js`, dan bobot di `POOL` pada `js/scanner.js`.
- Latar: builder SVG di `js/scenes.js` + `window.SCENES`, ambience di `LOC` pada `js/sound.js`.

> Konten bersifat hiburan/folklor. Agen diarahkan agar tidak memberi saran berbahaya dan tidak menampilkan gore.
