# Huishoudboekje

Een huishoudboekje voor het gezin, als app op je Android-telefoon of tablet. Gezin en zaak (vennootschap) blijven apart.

**Wat kan het nu (stap 2)?**

- Uitgaven en inkomsten toevoegen met een groot cijferklavier en categorieën met icoontjes
- Twee boekjes: *Gezin* (iedereen) en *Zaak* (alleen de eigenaar)
- Maandoverzicht: wat er nog te besteden is, grafiek van de laatste 6 maanden, waar het geld naartoe ging
- Budget per categorie, met een waarschuwing als je er bijna door bent
- Samen in hetzelfde boekje: gezinsleden uitnodigen met een code, alles ververst live
- Exporteren als CSV (opent in Excel, handig voor de boekhouder)
- **Spraak**: tik op de oranje microfoon en zeg bv. *"25 euro tanken"*, *"gisteren 64,30 bij Delhaize"* of *"houtskool 45 euro op de zaak"*. De app toont eerst wat hij begreep; jij bevestigt. Meerdere in één keer kan ook: *"12 euro bakker en 8 euro apotheek"*. Gratis: de herkenning gebeurt met Chrome op Android en de zinnen worden op het toestel zelf begrepen.
- Installeerbaar op je startscherm, werkt op telefoon (onderbalk) en tablet (zijbalk)

Zonder Supabase-gegevens start de app in **proefmodus**: alles blijft dan op het toestel zelf.

Komt later: boodschappenlijst, weekmenu, recepten, voorraad en agenda (stap 4).

## Eenmalig instellen

### 1. Database in Supabase
1. Open je project op [supabase.com](https://supabase.com/dashboard) en ga naar **SQL Editor** › **New query**.
2. Plak de volledige inhoud van [`supabase/schema.sql`](supabase/schema.sql) en klik op **Run**.
3. Ga naar **Authentication** › **URL Configuration** en zet de **Site URL** op het adres van de app:
   `https://bertmeirhaeghe-eng.github.io/Huishoudboekje/`

### 2. De sleutel in de app zetten
In Supabase: **Project Settings** › **API Keys**, kopieer de **publishable** (of *anon*) sleutel en zet die in `src/lib/config.js` bij `SUPABASE_KEY`. Die sleutel is bedoeld om publiek te zijn; de beveiliging zit in de regels van de database. Gebruik nooit de *secret* of *service_role* sleutel.

### 3. Online zetten
Elke wijziging op `main` wordt automatisch gebouwd en op de branch `gh-pages` gezet. Staat de app niet online op `https://bertmeirhaeghe-eng.github.io/Huishoudboekje/`, kies dan één keer in GitHub **Settings** › **Pages** bij **Source** voor *Deploy from a branch*, branch `gh-pages`, map `/ (root)`.

### 4. Op de telefoon zetten
Open het adres in **Chrome** op Android, tik op de drie puntjes › **App installeren** (of *Toevoegen aan startscherm*). Maak een account, kies **Nieuw boekje**, en nodig je gezin uit via **Meer** › **Iemand uitnodigen**.

## Voor ontwikkelaars

```bash
npm install
cp .env.example .env.local   # vul de Supabase-gegevens in, of laat leeg voor proefmodus
npm run dev
npm test
```

Opbouw: React + Vite, geen server nodig. Bedragen worden als centen bewaard. Toegang wordt geregeld met Row Level Security in `supabase/schema.sql`: gezinsleden zien het gezinsboekje, enkel de eigenaar ziet het zaakboekje.
