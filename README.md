# Metric — MVP

## Rulare locală

```bash
npm install
npm run dev
```

Deschide adresa afișată (de regulă http://localhost:5173).

## Funcționalități

- **Jurnal zilnic** — logare pe mese, cu total calorii + P/C/G față de obiectiv
- **Adăugare rapidă** — modal cu calorii/proteine, fără cont de alimente
- **Scanare coduri de bare** — cameră live (Chrome/Android) sau input manual, cu lookup pe Open Food Facts și cache local (funcționează offline la a doua scanare a aceluiași produs). Necesită HTTPS sau `localhost`.
- **Rețete cu greutate gătită** — introduci ingrediente crude + greutatea finală după gătit, aplicația calculează valorile la 100g gătit și le poți loga pe gramaj
- **Obiective cu istoric** — setezi un target nou cu dată de intrare în vigoare; targetele vechi rămân valabile pentru zilele trecute
- **Greutate + TDEE adaptiv** — filtru EMA pe greutate, calcul TDEE bazat pe corelația calorii consumate / evoluție greutate în ultimele 21 zile (necesită minim 7 zile de date pentru fiabilitate)
- **Backup local** — export/import JSON, pentru schimbarea telefonului sau curățarea cache-ului
- **PWA** — instalabilă pe telefon (Adaugă pe ecranul principal), funcționare offline via service worker

## Note tehnice importante

- Camera și service worker-ul cer **HTTPS** (sau `localhost`, care e exceptat). Pentru deploy: Vercel/Netlify oferă SSL automat și gratuit.
- `BarcodeDetector` (scanare automată) nu e suportat pe Safari/iOS — aplicația detectează asta și arată căutarea manuală.
- Iconițele PWA (`public/pwa-*.png`) sunt placeholder-uri generate simplu — înlocuiește-le cu un logo real înainte de lansare.

## Structură

```
src/
├── types/nutrition.ts       # toate tipurile de date
├── db.ts                    # config Dexie (IndexedDB), 5 tabele
├── db/operations.ts         # toate scrierile (log, target, greutate, rețetă)
├── algorithms/metabolic.ts  # EMA + TDEE adaptiv
├── services/
│   ├── foodApi.ts           # Open Food Facts + cache
│   └── backup.ts            # export/import JSON
├── hooks/                   # citire reactivă (useDailyLogs, useActiveTarget, useWeightData)
├── components/               # toate modalele
└── App.tsx                  # dashboard + orchestrare
```
