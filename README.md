# JJ Racing Live

Živý program závodního víkendu: https://k5jhfy8j9p-eng.github.io/jj-racing-life/

## Aktualizace harmonogramu

1. Pro první nový víkend pojmenuj soubory `patek1.pdf` a `sobota1.pdf`.
2. Pro každý další víkend zvyš stejné číslo u obou souborů: `patek2.pdf` + `sobota2.pdf`, potom `patek3.pdf` + `sobota3.pdf` atd.
3. V repozitáři zvol **Add file → Upload files** nebo použij odkaz:
   https://github.com/k5jhfy8j9p-eng/jj-racing-life/upload/main
4. Nahraj oba soubory a potvrď **Commit changes**.
5. Po zveřejnění otevři aplikaci, stiskni **Nový víkend** a **Ověřit a načíst PDF**.

Aplikace automaticky vybere nejvyšší číslo, které existuje současně pro pátek i sobotu. V potvrzení ukáže přesné názvy použitých souborů, počet nalezených položek a časový rozsah. Pokud nové PDF nelze přečíst, ponechá poslední funkční rozpis a zobrazí varování.

Původní soubory `patek.pdf` a `sobota.pdf` slouží jako záloha s číslem 0.

## Data z Alfana

1. V aplikaci stiskni **Nahrát Alfano ZIP**.
2. Vyber jeden nebo více originálních ZIP souborů exportovaných z Alfana.
3. Stiskni **Načíst vybrané ZIPy**.
4. Každý další trénink přidej stejným způsobem. Starší tréninky zůstanou v přehledu.
5. Před novým závodním víkendem použij **Vymazat data víkendu**.

ZIPy se zpracovávají pouze v prohlížeči. Do úložiště zařízení se ukládá jen souhrn kol, časů, rychlosti a otáček; kompletní GPS telemetrie se nezveřejňuje.
