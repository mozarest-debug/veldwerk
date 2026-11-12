# Veldwerk

Webapp voor landmeters: werkdag en uren per werkorder (met locatie-pin en reistijd), metingen met status, veldnotities met foto's, takenlijst en een export mogelijkheid van al deze gegevens.

Alle gegevens blijven op je eigen telefoon (in de browseropslag). Maak regelmatig een back-up via Instellingen.


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
