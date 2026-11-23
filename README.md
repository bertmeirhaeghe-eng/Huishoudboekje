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
- **Klusjes** (onder Lijst): zie je iets dat moet gebeuren, typ het of neem er een foto van. Later geef je het een datum; dan komt het vanzelf in jullie Google Agenda, en verschuift het daar mee als je de datum wijzigt. Datum weg of klusje verwijderd? Dan verdwijnt het ook uit de agenda. Afgevinkt? Dan krijgt het in de agenda een ✓.
- **Privé of zaak?**: vuistregels voor aankopen via de vennootschap (onder Meer). Indicatief, geen fiscaal advies.

Met de microfoon kan je zeggen: "melk en eieren op de lijst", "de koffie is op", "vrijdag eten we lasagne", "zaterdag om 10 uur zwemles" of "klusje: lamp vervangen in de gang" (met "zaterdag" erbij is het meteen ingepland).

### Echte rekeningstand

Op het overzicht staat onder het saldo de knop **Echte rekeningstand ingeven**. Geef in wat er op een bepaalde avond op de rekening stond (ook een dag in het verleden mag). De app toont dan *Nu op de rekening*: die stand plus alles wat je daarna boekt. Importeer je een bankbestand van Crelan, dan neemt de app de stand vanzelf over uit de kolom "saldo na verrichting".

Zolang `supabase/schema.sql` niet opnieuw is uitgevoerd, bewaart de app die stand alleen op het toestel.

### Vaste betalingen die nog komen

Gaat er elke maand een vaste betaling van de rekening (bv. de afbetaling van het woningkrediet op het einde van de maand), dan toont het overzicht die al vóór de bank ze boekt: in de groene kaart staat **Komt nog** met wat er op het einde van de maand overblijft, en bij de uitgaven staat een stippellijn-blok **Komt nog deze maand**. De app herkent zo'n betaling vanzelf: dezelfde omschrijving, ongeveer om de maand, met (bijna) hetzelfde bedrag. Voor een krediet, lening, huur, verzekering of domiciliëring volstaat één keer. Zodra de bank de betaling boekt, verdwijnt ze uit "Komt nog" en telt ze maar één keer. Tik op een verwachte betaling en kies **Niet meer verwachten** als iets niet meer terugkomt.

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

### Voorraad van een foto (AI) aanzetten

In de voorraad kan je een foto van de kast nemen. Zonder extra instelling leest de app alleen de etiketten.
Wil je dat de AI echt kijkt wat er staat (ook fruit, potten zonder etiket…), dan gebruikt de functie standaard **Google Gemini** (gratis), met dezelfde sleutel `GEMINI_API_KEY` als *Privé of zaak?* (zie hieronder hoe je die maakt).

1. In Supabase: **Edge Functions › Secrets**: zorg dat `GEMINI_API_KEY` er staat.
2. In Supabase: **Edge Functions**, open de functie `swift-responder` (zo heet de voorraadfunctie bij ons), tab **Code**, vervang alles door de inhoud van `supabase/functions/voorraad-foto/index.ts` en klik op Deploy. (Nog geen functie? **Deploy a new function › Via editor**, en zet de naam dan ook in `PANTRY_FUNCTION` in `src/lib/config.js`.)

Staat er ook een `ANTHROPIC_API_KEY`, dan kijkt Claude als Gemini het niet haalt (bv. de gratis limiet is op). Lukt geen van beide, dan leest de app weer zelf de etiketten.

### Categorieën en tips met AI (Gemini)

Met dezelfde Gemini-sleutel kan de app ook:

- **Bij het importeren van de bank** een categorie kiezen voor verrichtingen die de vaste regels niet herkennen (die in "Andere" zouden vallen). Ze krijgen een ✨, je kijkt ze na voor je importeert.
- **Bij de inzichten** een korte samenvatting en tips op maat schrijven. Dat gebeurt pas als je op *Vraag tips aan Gemini* tikt.
- **Bij een nieuw recept** de foto van het recept inlezen: titel, aantal personen, ingrediënten en bereiding. Lukt dat niet, dan leest de telefoon de tekst zelf, zoals voordien.

Eenmalig: in Supabase **Edge Functions › Deploy a new function › Via editor**, naam precies `ai-hulp` (bestaat ze al: open ze, tab *Code*, alles vervangen), plak de inhoud van `supabase/functions/ai-hulp/index.ts` en klik op Deploy.

Wat naar Google gaat: voor categorieën enkel de omschrijving, het soort verrichting en het bedrag (geen rekeningnummers); voor de inzichten enkel totalen per categorie en de grootste uitgaven; voor recepten de foto van het recept. Let op: bij de gratis versie mag Google wat je stuurt gebruiken om zijn AI te verbeteren.
Lukt de AI niet (niet ingesteld, gratis limiet op, geen internet), dan werkt alles gewoon zoals voordien.

### Privé of zaak? met AI (Gemini) aanzetten

Het scherm *Privé of zaak?* gebruikt zonder extra instelling vaste vuistregels. Voor iets dat niet in die regels staat (bv. "buitenkeuken") krijg je dan alleen "Hangt ervan af".
Met een AI-sleutel denkt Google Gemini mee en krijg je een antwoord op maat. Lukt de AI niet (niet ingesteld, even te druk, geen internet), dan toont de app gewoon weer de vaste vuistregels.

Eenmalig instellen (± 5 minuten):

1. Ga naar [aistudio.google.com/apikey](https://aistudio.google.com/apikey), meld je aan met je Google-account en klik op *Create API key*. Kopieer de sleutel.
2. In Supabase: **Edge Functions › Secrets** › nieuw geheim `GEMINI_API_KEY` met die sleutel.
3. In Supabase: **Edge Functions › Deploy a new function › Via editor**, naam precies `prive-of-zaak`, plak de inhoud van `supabase/functions/prive-of-zaak/index.ts` en klik op Deploy.

Optioneel: wil je een bepaald Gemini-model, zet dan een geheim `GEMINI_MODEL` (bv. `gemini-flash-lite-latest`). Standaard gebruikt de functie de nieuwste Gemini Flash.
Heb je geen Gemini-sleutel maar wel `ANTHROPIC_API_KEY` (van de voorraadfoto), dan gebruikt de functie Claude.

Alleen wie aangemeld is in het huishoudboekje kan de functie gebruiken; de sleutel staat nooit in de app zelf. Het blijft een inschatting, geen fiscaal advies.

### Bank automatisch koppelen (Crelan, gratis via Enable Banking)

Dan hoef je geen CSV-bestanden meer te downloaden: de app haalt je verrichtingen met één tik bij Crelan op. De app kan alleen **lezen**, nooit geld overschrijven. Wat al in het boekje staat (ook van een vroegere CSV-import of wat je zelf insprak) slaat de app over, net zoals bij een bestand. De echte rekeningstand wordt meteen mee bijgewerkt.

Enable Banking is gratis zolang je alleen je eigen rekeningen koppelt. Eenmalig instellen (± 15 minuten):

1. **Account maken.** Ga naar [enablebanking.com](https://enablebanking.com), klik op *Get started* en maak een account. Bevestig de mail en open het *Control Panel*.
2. **App aanmaken.** In het Control Panel: *API applications* › *Add a new application*.
   - Environment: **Production** (niet Sandbox).
   - Application name: `Huishoudboekje`.
   - Allowed redirect URLs: `https://bertmeirhaeghe-eng.github.io/Huishoudboekje/` (precies zo, met de schuine streep op het einde).
   - Private key: laat *Generate in the browser* staan. Bij het bewaren downloadt je computer een `.pem`-bestand. Bewaar het goed en deel het met niemand.
   - Vul bij e-mail, privacy en voorwaarden gerust het adres van de app in, dat wordt niet nagekeken.
   - Noteer het **Application ID** dat je daarna ziet.
3. **Je Crelan-rekening toelaten.** Klik in het Control Panel bij je app op *Link accounts*, kies Crelan en bevestig in de Crelan-app. Daarna staat de app op *Restricted* en *Active*: zo is het gratis, alleen voor jouw eigen rekeningen.
4. **De twee geheimen in Supabase zetten.** In Supabase: **Edge Functions › Secrets**:
   - `ENABLE_BANKING_APP_ID` met het Application ID
   - `ENABLE_BANKING_PRIVATE_KEY` met de **volledige inhoud** van het `.pem`-bestand (open het met Kladblok, alles kopiëren, ook de lijnen met BEGIN en END)
5. **Database bijwerken.** Plak `supabase/schema.sql` opnieuw volledig in Supabase › SQL Editor en klik op Run.
6. **De functie plaatsen.** In Supabase: **Edge Functions › Deploy a new function › Via editor**, naam precies `bank-koppeling`, plak de inhoud van `supabase/functions/bank-koppeling/index.ts` en klik op Deploy.
7. **Koppelen in de app.** Open de app › **Meer** › **Bankafschrift importeren** › **Crelan koppelen**. Je gaat even naar Crelan om toestemming te geven en komt dan vanzelf terug in de app, met je verrichtingen klaar om te importeren.

Daarna is het telkens: **Meer › Bankafschrift importeren › Nieuwe verrichtingen ophalen**.

Ongeveer **elke 6 maanden** vraagt de bank om de toestemming te vernieuwen (een Europese regel). De app zegt het twee weken op voorhand; één tik op *Toestemming vernieuwen* en bevestigen in de Crelan-app volstaat.

Alleen de eigenaar van het gezin kan de bank koppelen. Het `.pem`-bestand en de toestemming van de bank staan nooit in de app of in de code, alleen in Supabase.

### Klusjes in Google Agenda (gratis)

Zonder deze stappen werkt de klusjeslijst ook, alleen komen de klusjes dan niet in de agenda. Eenmalig instellen (± 15 minuten, op de computer):

1. **Project maken.** Ga naar [console.cloud.google.com](https://console.cloud.google.com) en meld je aan met het Google-account van jullie agenda. Klik bovenaan op de projectkiezer › *New project*, naam `Huishoudboekje`, *Create*. Kies daarna dat project bovenaan.
2. **Agenda aanzetten.** Typ in de zoekbalk bovenaan `Google Calendar API`, open het en klik op *Enable*.
3. **Toestemmingsscherm.** Zoek `Google Auth Platform` (vroeger *OAuth consent screen*) en klik op *Get started*:
   - App name: `Huishoudboekje`, User support email: je eigen adres › *Next*
   - Audience: **External** › *Next*
   - Contact information: je eigen adres › *Next*, vink de voorwaarden aan › *Create*
4. **Publiceren.** Ga links naar *Audience* en klik op **Publish app** › *Confirm*. De status wordt *In production*. Doe je dit niet, dan vervalt de koppeling na 7 dagen.
5. **Client maken.** Ga links naar *Clients* › *Create client*:
   - Application type: **Web application**, naam `Huishoudboekje`
   - Bij *Authorized redirect URIs* › *Add URI*: `https://bertmeirhaeghe-eng.github.io/Huishoudboekje/` (precies zo, met de schuine streep op het einde)
   - *Create*. Je ziet nu de **Client ID** en het **Client secret**. Kopieer ze allebei meteen (of klik op *Download JSON*): het secret toont Google maar één keer.
6. **De twee geheimen in Supabase zetten.** In Supabase: **Edge Functions › Secrets**:
   - `GOOGLE_CLIENT_ID` met de Client ID
   - `GOOGLE_CLIENT_SECRET` met het Client secret
7. **Database bijwerken.** Plak `supabase/schema.sql` opnieuw volledig in Supabase › SQL Editor en klik op Run.
8. **De functie plaatsen.** In Supabase: **Edge Functions › Deploy a new function › Via editor**, naam precies `klusjes-agenda`, plak de inhoud van `supabase/functions/klusjes-agenda/index.ts` en klik op Deploy.
9. **Koppelen in de app.** Open de app › **Lijst** › **Klusjes** › **Google Agenda koppelen**. Google zegt *"Google heeft deze app niet geverifieerd"*: dat klopt, het is jullie eigen app. Klik op *Geavanceerd* › *Ga naar Huishoudboekje*, vink de vakjes voor Google Agenda aan en klik op *Doorgaan*. Kies daarna in welke agenda de klusjes komen (bv. jullie gedeelde gezinsagenda).

Alleen de eigenaar van het gezin koppelt Google. Daarna kan iedereen van het gezin klusjes inplannen: ze komen in de gekozen agenda. Het Client secret en de toestemming van Google staan nooit in de app of in de code, alleen in Supabase.

## Voor ontwikkelaars

```bash
npm install
cp .env.example .env.local   # vul de Supabase-gegevens in, of laat leeg voor proefmodus
npm run dev
npm test
```

Opbouw: React + Vite, geen server nodig. Bedragen worden als centen bewaard. Toegang wordt geregeld met Row Level Security in `supabase/schema.sql`: gezinsleden zien het gezinsboekje, enkel de eigenaar ziet het zaakboekje.
