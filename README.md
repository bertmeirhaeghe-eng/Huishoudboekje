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

## Thuis: boodschappen, voorraad, recepten, weekmenu en agenda

- **Boodschappen**: per winkelrayon gesorteerd, afvinken in de winkel. Wat je afvinkt, staat daarna weer op "genoeg" in de voorraad.
- **Voorraadkast**: tik op een product om "bijna op" of "op" aan te duiden. Het komt dan vanzelf op de boodschappenlijst.
- **Recepten**: neem een foto van een recept. De telefoon leest de tekst zelf (gratis, zonder account). Bij elk recept zie je wat je in huis hebt en wat je moet kopen.
- **Weekmenu**: kies per dag een recept of typ een maaltijd. Eén knop zet alles wat ontbreekt voor de week op de lijst.
- **Agenda**: werkt met je Google Agenda.
- **Privé of zaak?**: vuistregels voor aankopen via de vennootschap (onder Meer). Indicatief, geen fiscaal advies.

Met de microfoon kan je zeggen: "melk en eieren op de lijst", "de koffie is op", "vrijdag eten we lasagne" of "zaterdag om 10 uur zwemles".

### Na deze update: database bijwerken

Plak `supabase/schema.sql` opnieuw volledig in Supabase > SQL Editor en klik op Run. Bestaande gegevens blijven staan.

### Google Agenda koppelen

De eenvoudigste manier is het geheime iCal-adres:

1. Open Google Agenda op de computer. Ga naar Instellingen, kies je agenda en dan "Agenda integreren".
2. Kopieer het "Geheime adres in iCal-indeling".
3. Plak het in de app onder Meer > Google Agenda.

Het adres wordt bewaard in de database. Niemand kan het daar uitlezen, ook gezinsleden niet: de app krijgt enkel de afspraken. Zet het adres nooit in de code, want de site en de repo zijn openbaar.

Zo kan de app je afspraken alleen lezen. Nieuwe afspraken opent de app in Google Agenda, met alles al ingevuld.

Wil je dat de app ook zelf afspraken toevoegt? Vul dan een OAuth Client ID in bij `GOOGLE_CLIENT_ID` in `src/lib/config.js`. Het type is Web application, met als origin `https://bertmeirhaeghe-eng.github.io`.

## Voor ontwikkelaars

```bash
npm install
cp .env.example .env.local   # vul de Supabase-gegevens in, of laat leeg voor proefmodus
npm run dev
npm test
```

Opbouw: React + Vite, geen server nodig. Bedragen worden als centen bewaard. Toegang wordt geregeld met Row Level Security in `supabase/schema.sql`: gezinsleden zien het gezinsboekje, enkel de eigenaar ziet het zaakboekje.
