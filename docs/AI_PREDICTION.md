# AI Prediction Pipeline

Pipeline AI proyek ini dibagi menjadi tiga tahap:

1. `export-ai-dataset.ts`
   - Ambil histori telur dan sensor dari Prisma/PostgreSQL.
   - Bentuk dataset bulanan per sensor.
   - Tulis file `artifacts/ai-dataset.json`.

2. `train-ai-models.py`
   - `XGBoost Regressor` untuk prediksi jumlah telur bulanan.
   - `RandomForestClassifier` untuk klasifikasi `Produktif`, `Perlu Dipantau`, `Afkir`.
   - `IsolationForest` untuk deteksi anomali pola sensor.
   - Tulis file `artifacts/ai-predictions.json`.

3. `import-ai-predictions.ts`
   - Baca hasil prediksi JSON.
   - Simpan ke tabel `SensorAiPrediction`.
   - Hasil muncul di halaman `/prediksi-ai`.

## Fitur dataset

Setiap baris training memakai fitur:

- `prevMonthlyEggs`
- `prevEggs7d`
- `daysWithoutEgg`
- `avgTemp30d`
- `avgHumidity30d`
- `gasAlertCount30d`
- `gasAlertCount7d`
- `rollingEggAvg2m`
- `sensorIndex`

## Jalankan pipeline

### Opsi 1: lokal biasa

```bash
npm run ai:pipeline
```

### Opsi 2: pakai Nix untuk dependency Python

```bash
nix --extra-experimental-features nix-command --extra-experimental-features flakes shell \
  nixpkgs#nodejs \
  nixpkgs#python313 \
  nixpkgs#python313Packages.numpy \
  nixpkgs#python313Packages.scikit-learn \
  nixpkgs#python313Packages.xgboost \
  -c npm run ai:pipeline
```

## Output

Hasil pipeline akan:

- membuat `artifacts/ai-dataset.json`
- membuat `artifacts/ai-predictions.json`
- mengisi tabel `SensorAiPrediction`

## Halaman web

Halaman `/prediksi-ai` menampilkan:

- prediksi total telur 30 hari
- sensor risiko afkir tinggi
- sensor dengan anomali tinggi
- confidence model
- detail prediksi per sensor

## Catatan dummy

Seed dummy saat ini dibuat berpola:

- `A001` produktif stabil
- `A002` produktif sedang
- `B001` menurun
- `B002` afkir

Dengan pola ini, training/testing lebih masuk akal untuk demo dan laporan.
