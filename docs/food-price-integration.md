# Integrasi Harga Pangan SP2KP

Dokumen ini menjelaskan alur integrasi data harga pangan SP2KP Kemendag ke MBG Transparency System.

## Sumber Data

Data harga pangan dibaca dari file JSON harian SP2KP Kemendag. Format utama yang didukung:

- `date`
- `source`
- `records[]`
- `records[].harga`
- `records[].scope`
- `records[].kode_provinsi`
- `records[].nama_provinsi`
- `records[].kode_kab_kota`
- `records[].nama_kab_kota`
- `records[].variant_id`
- `records[].variant`
- `records[].satuan`
- `records[].kuantitas`

Importer punya normalizer agar variasi nama field seperti `price`, `variantId`, `province`, dan `city` tetap terbaca.

## Import Data

Dari folder `Backend`:

```bash
npm run import:food-prices
npm run import:food-prices -- ./prices --dry-run
npm run import:food-prices -- ./prices
npm run import:food-prices -- ./prices --all
npm run import:food-prices -- ./prices --since=2026-05-01
npm run import:food-prices -- ./prices --latest --force
npm run import:food-prices -- ./prices/2026-05-18.json --limit 100
```

Default folder tanpa flag akan mengimpor file JSON terbaru saja. Script membaca tanggal dari `date`, fallback ke `generated_at`, lalu fallback ke nama file `YYYY-MM-DD.json`. Gunakan `--all` untuk semua file, `--since=YYYY-MM-DD` untuk rentang tanggal, dan `--force` untuk mengimpor ulang latest meskipun tanggal itu sudah ada di DB.

Jika tidak ingin menulis path setiap kali, set di `Backend/.env`:

```env
FOOD_PRICES_PATH=C:\laragon\www\scriptingjson\pangan\data\prices
```

Importer melakukan upsert ke tabel `food_prices` berdasarkan kombinasi:

```text
date + scope + provinceCode + cityCode + variantId
```

Record rusak akan dilewati, dicatat di summary, dan tidak menghentikan import file lain.

## Rumus Estimasi Harga Porsi

Estimasi 1 porsi MBG dihitung dari harga pangan terbaru per provinsi:

```text
beras 0.15 kg
ayam 0.10 kg
telur 0.05 kg
sayur 0.08 kg
minyak 0.02 liter/kg
packaging Rp 1.000
operasional Rp 1.500
distribusi Rp 1.000
```

Komoditas prioritas:

- Beras Medium, fallback Beras Premium
- Daging Ayam Ras
- Telur Ayam Ras
- Minyak Goreng atau Minyakita
- Kangkung, Sawi Hijau, Buncis, atau Bayam

Biaya tambahan dan multiplier threshold bisa diubah lewat `system_configs`:

- `mbg_packaging_cost`
- `mbg_operational_cost`
- `mbg_distribution_cost`
- `mbg_threshold_min_multiplier`, default `0.85`
- `mbg_threshold_max_multiplier`, default `1.25`

## Generate Threshold

Endpoint admin:

```http
POST /api/price-thresholds/generate-from-food-prices
```

Atau lewat service verifikasi:

```bash
npm run verify:food-prices
```

Generator membuat atau memperbarui `price_thresholds` per provinsi:

- `minPrice = estimatedPortionPrice * minMultiplier`
- `maxPrice = estimatedPortionPrice * maxMultiplier`
- `avgReferencePrice = estimatedPortionPrice`
- `source = "SP2KP Kemendag"`
- `generatedFromFoodPrices = true`
- `generatedAt = now`

## Endpoint Baru

```http
GET /api/food-prices
GET /api/food-prices/latest
GET /api/food-prices/estimate?province=Jawa%20Barat
POST /api/food-prices/import
GET /api/price-thresholds
POST /api/price-thresholds/generate-from-food-prices
GET /api/production-batches
POST /api/production-batches
GET /api/production-batches/:id
GET /api/production-batches/:id/cost-summary
GET /api/analytics/budget-summary
GET /api/analytics/price-per-province
GET /api/analytics/price-anomalies
GET /api/analytics/costing
```

Hak akses:

- `pemerintah` dan `admin` bisa membaca food prices, thresholds, dan analytics.
- `admin` bisa import food prices dan generate thresholds.

## Anomaly PRICE_ANOMALY

Saat distribusi dibuat atau di-update:

1. Sistem mengambil provinsi dari SPPG.
2. Sistem mencari `production_batches` pada tanggal dan SPPG yang sama.
3. Jika batch tersedia, `price_per_portion` default memakai `production_batches.cost_per_portion`.
4. Sistem mencari `price_thresholds` provinsi tersebut.
5. Jika belum ada, sistem mencoba generate threshold dari `food_prices` dan costing batch nyata.
6. Distribusi tetap disimpan meskipun threshold belum tersedia.
7. Jika `pricePerPortion > maxPrice`, sistem membuat anomaly `PRICE_ANOMALY`.
8. Jika `pricePerPortion < minPrice`, sistem membuat anomaly `PRICE_ANOMALY`.
9. Anomaly aktif tidak diduplikasi untuk distribution dan type yang sama.
10. Jika harga diedit kembali normal, anomaly harga terbuka ditandai resolved otomatis.

## Production Batch Costing

SPPG mencatat batch produksi harian melalui endpoint:

```http
GET /api/production-batches
GET /api/production-batches/:id
POST /api/production-batches
PATCH /api/production-batches/:id
DELETE /api/production-batches/:id
POST /api/production-batches/:id/items
PATCH /api/production-batch-items/:id
DELETE /api/production-batch-items/:id
GET /api/production-batches/:id/cost-summary
GET /api/production-batches/:id/anomalies
```

Rumus costing:

```text
raw_material_cost = sum(production_batch_items.total_price)
total_cost = raw_material_cost + operational_cost + packaging_cost + distribution_cost
cost_per_portion = total_cost / total_portions
```

`GET /api/production-batches/:id/cost-summary` menjadi sumber utama costing frontend dan mengembalikan:

- `rawMaterialCost` / `rawMaterialTotals` termasuk daftar item bahan baku.
- `operationalCost`, `packagingCost`, `distributionCost`.
- `totalCost`, `totalPortions`, `costPerPortion`.
- `sp2kpComparison` berisi estimasi SP2KP per porsi, variance terhadap cost batch, dan perbandingan per bahan baku.

Jika data SP2KP belum tersedia, `sp2kpComparison.available` bernilai `false`, nilai estimasi dikembalikan `null`, dan field `reason` menjelaskan penyebabnya. Frontend tidak boleh menampilkan angka estimasi palsu.

Setiap item bahan baku otomatis dibandingkan dengan harga pasar terbaru dari `food_prices` berdasarkan provinsi SPPG dan `variant_id`/nama komoditas. Field yang disimpan:

- `market_reference_price`
- `source_price_id`
- `source_price`
- `price_difference_percent`

Jika `unit_price` lebih tinggi dari harga pasar melebihi `raw_material_price_anomaly_percent` di `system_configs` (default `25`), sistem membuat `RAW_MATERIAL_PRICE_ANOMALY` dengan metadata:

- `commodity_name`
- `market_price`
- `input_price`
- `selisih_percent`
- `province`
- `production_batch_id`

## Threshold dari Costing Nyata

`generatePriceThresholdsFromFoodPrices()` sekarang memakai weighted average:

```text
avgReferencePrice =
  weighted average(cost_per_portion production batch wilayah, estimasi food_prices SP2KP)

minPrice = avgReferencePrice * mbg_threshold_min_multiplier
maxPrice = avgReferencePrice * mbg_threshold_max_multiplier
```

Bobot default:

- `mbg_threshold_actual_cost_weight = 0.7`
- `mbg_threshold_food_price_estimate_weight = 0.3`

Jika production batch belum ada, generator tetap bisa memakai estimasi SP2KP. Jika SP2KP belum ada tetapi costing batch sudah ada, threshold tetap bisa dibuat dari costing nyata.

## Verifikasi

```bash
npm run import:food-prices -- ./prices --dry-run
npm run import:food-prices -- ./prices
npm run verify:food-prices
npm run verify:food-prices -- --mutate
```

Mode `--mutate` menjalankan tes create distribusi dalam transaksi yang sengaja di-rollback setelah validasi anomaly selesai.
