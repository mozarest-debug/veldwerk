# Veldwerk

Webapp voor landmeters: werkdag en uren per werkorder (met locatie-pin en reistijd), metingen met status, veldnotities met foto's, takenlijst en export in het format van het urenportaal.

Alle gegevens blijven op je eigen telefoon (in de browseropslag). Maak regelmatig een back-up via Instellingen.

## Online zetten met GitHub Pages

1. Maak op GitHub een nieuwe **publieke** repository, bijv. `veldwerk`.
2. Upload alle bestanden uit deze map (Add file → Upload files) en klik op Commit.
3. Ga naar Settings → Pages en kies bij Source: *Deploy from a branch*, met branch `main` en map `/ (root)`.
4. Na een minuut staat de app op `https://<gebruikersnaam>.github.io/veldwerk/`.

De code is dan openbaar, maar je gegevens niet: die staan alleen op je telefoon.

## Op je telefoon zetten

- **Android (Chrome):** open de link, menu ⋮ → *App installeren* of *Toevoegen aan startscherm*.
- **iPhone (Safari):** open de link, Deel → *Zet op beginscherm*. Gebruik de app daarna altijd via het icoon op je beginscherm.

Sta locatie toe als daarom gevraagd wordt.

## Bestanden

- `index.html`: de app
- `lib.js`: ZIP, Excel en het schrijven van GPS-gegevens in foto's (zonder externe libraries)
- `sw.js`, `manifest.webmanifest` en de iconen: installeren en offline werken

## Nieuwe versie

Verhoog `VERSION` in `sw.js` bij elke wijziging, zodat telefoons de nieuwe versie ophalen.
