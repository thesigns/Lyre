# Lyre — dokument designowy

## 1. Koncepcja

Lyre to minimalistyczna aplikacja PWA, wirtualny instrument wzorowany na antycznej greckiej lirze (*chelys*, z pudłem ze skorupy żółwia). Użytkownik gra, dotykając strun palcem albo przeciągając po nich, a aplikacja generuje dźwięk szarpanej struny w czasie rzeczywistym, syntetyzowany fizycznie (bez sampli).

Najważniejsze cechy:
- realistyczny dźwięk szarpanej struny z syntezy fizycznej,
- brzdąknięcie dowolnej liczby sąsiednich strun jednym gestem, od dwóch do wszystkich siedmiu,
- ekspresja: barwa zależy od miejsca szarpnięcia struny, głośność od szybkości gestu,
- historyczne greckie stroje (rodzaje tetrachordów i skale),
- tryb grania melodii ze wskazywaniem miejsca szarpnięcia,
- pełne działanie offline.

## 2. Zasady ogólne

- **Minimalizm.** Ekran główny to sam instrument. Aplikacja startuje od prostego menu (patrz 11.1); z instrumentu wraca się do niego jednym dyskretnym przyciskiem.
- **Instrument, nie gra.** Brak punktów, brak kar za błędy. Każde szarpnięcie struny zawsze gra dźwięk.
- **Stuknięcie i brzdąknięcie.** Dotknięcie struny gra ją od razu (stuknięcie); przeciągnięcie palcem gra każdą przeciętą strunę (brzdąknięcie). Dotknięcie między strunami nic nie gra. Dotyk nigdy nie wycisza strun.
- **Język: angielski.** Cały interfejs (menu, ustawienia, podpowiedzi, komunikaty), tytuły i opisy melodii oraz manifest PWA są po angielsku. Bez wielojęzyczności w MVP, ale teksty trzymane w jednym miejscu, żeby dało się je później przetłumaczyć. Wyjątek: ten dokument designowy jest po polsku.
- **Offline first.** Brak plików dźwiękowych, wszystko generowane w locie. Aplikacja działa w pełni bez sieci po pierwszym uruchomieniu.
- **Stack:** vanilla JavaScript, HTML, CSS, Web Audio API (AudioWorklet), Canvas 2D. Bez frameworków i bez zależności zewnętrznych, chyba że okażą się konieczne.

## 3. Instrument

- Zawsze **7 strun** (standardowa lira okresu klasycznego). Brak wariantów z inną liczbą strun.
- Struny mają tę samą długość. Wysokość dźwięku zależy od stroju; wizualnie struny niższe są grubsze, wyższe cieńsze.
- Kolejność domyślna: najniższa struna po lewej, najwyższa po prawej. Opcja odwrócenia dla leworęcznych.
- Struny **pionowe i równoległe**. Bez ramy, ramion liry i ozdobników po bokach: instrument to same struny rozpięte między dwiema prostymi poprzeczkami — dolnym mostkiem i górnym jarzmem.
- Dolny mostek jest punktem odniesienia dla miejsca szarpnięcia (4.2, 9.4).

## 4. Synteza dźwięku

### 4.1. Model struny
- Algorytm **Karplus-Strong**: linia opóźniająca wypełniona pobudzeniem (szum), zapętlona przez filtr tłumiący. Długość linii wyznacza wysokość dźwięku.
- Implementacja **wyłącznie w AudioWorklet**, przetwarzanie próbka po próbce. Nie budować pętli sprzężenia z węzłów DelayNode: Web Audio wymusza w cyklu minimalne opóźnienie 128 próbek, co ogranicza najwyższy dźwięk i psuje strojenie.
- Każda struna to osobny głos. Wszystkie struny mogą brzmieć jednocześnie.
- Ponowne szarpnięcie brzmiącej struny pobudza ją od nowa (bez urwania dźwięku trzaskiem): nowe pobudzenie jest **dodawane** do zawartości linii opóźniającej, a nie ją nadpisuje.
- Dokładne strojenie wymaga interpolacji ułamkowej długości linii opóźniającej (np. filtr allpass), inaczej wysokie dźwięki będą fałszować.

### 4.2. Ekspresja
- **Miejsce szarpnięcia:** pozycja palca wzdłuż struny w momencie szarpnięcia steruje barwą (filtr grzebieniowy na pobudzeniu). Blisko dolnego mostka dźwięk jasny i ostry, bliżej środka miękki i okrągły. Zmiana płynna, nie skokowa.
- **Siła:** szybkość gestu w momencie przecięcia struny steruje amplitudą tej struny. Głośność ma dolny próg, żeby nawet wolne, delikatne pociągnięcie było wyraźnie słyszalne, i górny limit. Stuknięcie (7.3) ma stałą, średnią głośność.
### 4.3. Pudło rezonansowe
- Sygnał wszystkich strun przechodzi przez rezonans pudła: ConvolverNode z krótką odpowiedzią impulsową albo zestaw kilku filtrów rezonansowych.
- Odpowiedź impulsowa (jeśli używana) generowana proceduralnie lub dołączona jako mały plik.
- Na końcu łańcucha lekki limiter/kompresor, żeby szybkie brzdąknięcie wszystkich strun nie przesterowało.

## 5. Strojenie

- Stroje oparte na proporcjach pitagorejskich i greckich tetrachordach, nie na stroju równomiernie temperowanym. Wszystkie wysokości liczone jako proporcje względem najniższej struny.

### 5.1. Rodzaje tetrachordu
- Tetrachord obejmuje czystą kwartę (4/3) i składa się z trzech interwałów. Poniżej podane **od góry w dół**, jak w teorii greckiej (iloczyn każdej trójki = 4/3):
  - **diatoniczny pitagorejski** (domyślny): 9/8, 9/8, 256/243,
  - **diatoniczny Archytasa:** 9/8, 8/7, 28/27,
  - **chromatyczny Archytasa:** 32/27, 243/224, 28/27,
  - **enharmoniczny Archytasa:** 5/4, 36/35, 28/27 (z ćwierćtonami).
- Wybrany rodzaj dotyczy obu tetrachordów stroju.

### 5.2. Skale
- **Heptachord** (domyślny): dwa tetrachordy **połączone** wspólnym dźwiękiem (synafe), np. w diatonice E F G A | A B♭ C D. Siedem dźwięków, zakres septymy (16/9). Historyczny strój siedmiostrunowej liry.
- **Harmonie: dorycka, frygijska, lidyjska** jako gatunki oktawy: dwa tetrachordy **rozłączone** całym tonem 9/8. Dorycka to sekwencja interwałów (od dołu) tetrachord–ton–tetrachord; frygijska i lidyjska to jej kolejne rotacje (w diatonice: dorycka ≈ e–e, frygijska ≈ d–d, lidyjska ≈ c–c na białych klawiszach). Konstrukcja działa dla każdego rodzaju tetrachordu. Struny to **7 najniższych dźwięków** gatunku (bez górnej oktawy).
- **Uwaga:** greckie nazwy nie odpowiadają skalom kościelnym ani współczesnym modusom (grecka dorycka ≈ współczesna frygijska). W kodzie i UI używać nazw greckich konsekwentnie, bez mieszania z modusami.
- Konstrukcja skal wymaga jeszcze weryfikacji ze źródłami muzykologicznymi.

### 5.3. Wysokość i zmiana stroju
- Wysokość najniższej struny wybierana nazwą dźwięku, od A2 do C4, domyślnie E3. Tylko ta jedna wysokość korzysta ze współczesnego odniesienia (A4 = 440 Hz, strój równomierny); pozostałe struny wynikają z proporcji stroju.
- **Zmiana stroju działa od kolejnego szarpnięcia.** Struny, które właśnie brzmią, wybrzmiewają w starym stroju (zmiana długości linii opóźniającej w trakcie drgania daje artefakty).

## 6. Layout

- Aplikacja działa w **portrecie i w landscape**; orientacja to wybór użytkownika, aplikacja jej nie blokuje.
- Układ liczony z **faktycznych wymiarów dostępnego obszaru**, nie z orientacji. Przeliczany przy każdej zmianie rozmiaru (ResizeObserver), co obejmuje też tablety, okno przeglądarki na komputerze i podzielony ekran.
- Uwzględnienie **safe areas** (wycięcie aparatu, zaokrąglone rogi), zwłaszcza w landscape.
- **Struny wypełniają dostępny obszar:** długość strun wynika z wysokości obszaru (minus marginesy na mostek i jarzmo), odstęp z szerokości. Brak ramy o stałych proporcjach, więc nic nie jest skalowane jak obrazek.
- **Odstęp między strunami:** minimum ok. 44–48 px (rozmiar palca), maksimum do ustalenia (rzędu 90–120 px), żeby na szerokim ekranie (tablet w landscape, komputer) brzdąknięcie przez wszystkie struny nie wymagało zbyt długiego ruchu. Gdy szerokość pozwala na więcej, grupa strun jest wyśrodkowana. Test na telefonie potwierdził, że w portrecie odstęp wystarcza do wygodnej gry.
- Dla bardzo wąskich okien (np. podzielony ekran), gdy minimum się nie mieści, pokazać dyskretną podpowiedź o poszerzeniu okna lub obróceniu urządzenia. Nie obracać strun do poziomu.
- Wokół każdej struny **pasmo stuknięcia** (ok. ±38% odstępu, 7.3) jako pionowy pas. Środek między strunami i marginesy to **strefa ciszy**.
- Między skrajnymi strunami a bokami obszaru zostaje margines (co najmniej pół odstępu), z którego można zacząć gest brzdąknięcia (patrz 7.2). Struny trzymać z dala od krawędzi ekranu, gdzie system przechwytuje gesty (cofanie na iOS, nawigacja gestami na Androidzie).
- Obrót urządzenia w trakcie grania nie przerywa dźwięku i nie resetuje stanu (np. postępu melodii).

## 7. Interakcja

### 7.1. Podstawy
- **Pointer Events** z obsługą multitouch. Na całym ekranie instrumentu wyłączone domyślne gesty przeglądarki (`touch-action: none`), żadnego przewijania, zoomu ani gestów nawigacji tam, gdzie da się je wyłączyć.
- Pointer capture: gest, który zaczął się na instrumencie, jest śledzony do końca, nawet gdy palec wyjdzie poza obszar strun.
- Kilka palców jednocześnie działa niezależnie; każdy palec ma własny stan gestu.
- Opóźnienie dźwięku musi być jak najmniejsze: obsługa zdarzeń bez zbędnej pracy, `latencyHint: "interactive"` przy tworzeniu AudioContext.

### 7.2. Brzdąknięcie (wymaganie kluczowe)
- Przeciągnięcie palcem w poprzek strun gra **każdą strunę, którą palec przetnie** — dowolną liczbę sąsiednich strun, od dwóch do wszystkich siedmiu, w obu kierunkach. Nie ma osobnej logiki dla „pełnego” brzdąknięcia; brzdąknięcie przez 2, 3, 4 czy 7 strun to ten sam mechanizm.
- **Musi być możliwe przejechanie palcem po wszystkich siedmiu strunach jednym gestem**, a także po dowolnym fragmencie (np. tylko struny 3–5). Każda przecięta struna gra dokładnie raz przy każdym przejściu.
- Gest może zacząć się i skończyć w dowolnym miejscu: na strunie, między strunami albo na marginesie poza skrajną struną. Zatrzymanie palca między strunami nie wyzwala żadnego dodatkowego dźwięku.
- Struna gra w momencie, gdy palec **przetnie linię struny** (nie granicę pasma stuknięcia).
- **Gest zaczęty na strunie:** dotknięcie w paśmie stuknięcia gra strunę od razu (7.3). Ta struna nie gra ponownie, dopóki palec nie opuści jej pasma; dopiero potem kolejne przecięcie jej linii (np. przy powrocie) gra ją znowu. Dzięki temu gest od struny 2 do struny 4 gra struny 2, 3 i 4, każdą raz.
- **Gest zaczęty w strefie ciszy** (między strunami, na marginesie) gra tylko przecięte struny.
- **Detekcja przecięć na odcinkach, nie na pozycjach:** przy szybkim ruchu kolejne zdarzenia ruchu dzielą duże odległości i palec może przeskoczyć kilka strun między zdarzeniami. Dla każdej pary kolejnych pozycji palca sprawdzać, które struny przecina odcinek między nimi, i zagrać wszystkie.
- Używać `getCoalescedEvents()` (tam, gdzie dostępne), żeby uzyskać pełną rozdzielczość ruchu palca.
- Struny przecięte w jednym odcinku grają **w kolejności przecięcia**, z drobnymi przesunięciami w czasie proporcjonalnymi do miejsca przecięcia na odcinku. Moment przecięcia interpolowany ze znaczników czasu zdarzeń. W każdej porcji zdarzeń pierwsza struna gra natychmiast, kolejne z zachowaniem odstępów względem niej; czas AudioContext wysyłany do workletu przez `port`, worklet startuje pobudzenie z dokładnością do próbki w `process()`. Brzdąknięcie ma brzmieć jak przeciągnięcie, nie jak jednoczesny akord — także przy krótkim, bardzo szybkim ruchu przez dwie struny.
- Miejsce przecięcia wzdłuż struny wyznacza barwę tej struny (4.2), lokalna szybkość palca — jej głośność.
- **Zmiana kierunku w trakcie gestu** (np. 2→4→2) jest obsługiwana: przy powrocie struny grają ponownie, w nowej kolejności.
- **Szybkie przeciągnięcia tam i z powrotem** między dwiema sąsiednimi strunami (technika zbliżona do trylu) muszą grać każde przejście, bez gubienia dźwięków.
- **Histereza:** drżenie palca tuż przy strunie nie może wyzwalać wielokrotnych szarpnięć. Ponowne zagranie tej samej struny wymaga przejścia na drugą stronę z wyraźnym zapasem odległości. Próg musi być na tyle mały, żeby nie blokował szybkich przejść tam i z powrotem.
- Ruch palca wzdłuż struny (bez jej przecinania) nie wyzwala dźwięku.
- Działa także dla ukośnych gestów.

### 7.3. Stuknięcie
- Wokół każdej struny jest **pasmo stuknięcia** (ok. ±38% odstępu, poszerzone z ±30% po testach na telefonie; do dalszego strojenia). **Dotknięcie w nim gra strunę natychmiast** (w `pointerdown`), w miejscu dotyku — bez czekania, czy to stuknięcie, czy początek brzdąknięcia. Wprowadzone po testach na telefonie: gra pojedynczymi dźwiękami jest szybsza i bardziej naturalna niż szarpanie ruchem.
- Stuknięcie ma stałą, średnią głośność (przy dotknięciu nie ma prędkości ruchu do zmierzenia).
- **Strefa ciszy:** środek między strunami (ok. 24% odstępu) i marginesy. Dotknięcie tam nic nie gra; stąd zaczyna się brzdąknięcie bez przypadkowego dźwięku.
- Ponowne dotknięcie tej samej struny gra ją ponownie.
- Drobny ruch palca po stuknięciu (w obrębie pasma) nie gra struny drugi raz.

### 7.4. Brak tłumienia palcem
- **Dotyk nie wycisza strun.** Struna zawsze wybrzmiewa naturalnie, niezależnie od tego, czy palec na niej leży. Tłumienie przytrzymaniem palca zostało usunięte po testach na telefonie, bo utrudniało granie: palec odruchowo zatrzymywany na strunie przed kolejnym ruchem gasił dźwięk.

## 8. Wizualizacja

### 8.1. Drganie strun
- Szarpnięta struna drga wizualnie: wybrzuszenie (fala stojąca) gasnące w tym samym tempie co dźwięk.
- Amplituda wizualna proporcjonalna do głośności, kształt drgania może zależeć od miejsca szarpnięcia.
- Animacja na Canvas 2D, requestAnimationFrame, rysowanie tylko gdy coś się rusza.
- Obwiednia drgania liczona w wątku głównym z tych samych parametrów co dźwięk (amplituda startowa, czas wybrzmiewania), bez przesyłania amplitudy z workletu i bez `SharedArrayBuffer` (który wymagałby nagłówków COOP/COEP, niedostępnych na GitHub Pages).

### 8.2. Kolorystyka
- Cała aplikacja w **antycznym beżu**: skojarzenia z papirusem, marmurem i wypaloną glinką. Spokojnie, ciepło, minimalistycznie, bez fotorealizmu i bez tekstur na start.
- Paleta wyjściowa (do dopracowania):
  - tło: jasny beż, np. `#E9DFC9`,
  - mostek i jarzmo: ciepły, przygaszony brąz / umbra, np. `#8A6A45`,
  - struny: ciemniejsze od tła, np. `#5C4A36`; struny niższe grubsze, wyższe cieńsze,
  - akcent (wskazanie szarpnięcia): czerwień w duchu greckiej ceramiki, np. `#B3392B`,
  - tekst i ikony: ciemny brąz, np. `#3E3226`.
- Struny muszą mieć wyraźny kontrast z tłem; jasne struny „jelitowe” zginęłyby na beżu.
- Kolory zdefiniowane jako zmienne CSS w jednym miejscu, żeby paletę dało się łatwo stroić.
- Ekran ustawień i interfejs poboczny w tej samej palecie.

## 9. Tryb melodii

### 9.1. Tryby
- **Nauka** (jedyny tryb w MVP): wskazane jest miejsce szarpnięcia; aplikacja czeka, aż użytkownik szarpnie wskazaną strunę, bez presji czasu.
- **Odsłuch („Listen”):** przycisk odtwarza całą melodię w jej tempie, z kółkami przesuwającymi się po kolejnych strunach i drgającymi strunami. Odsłuch można przerwać; po nim nauka zaczyna się od początku.
- Tryb **Gra** (melodia idzie w swoim tempie) — poza MVP (12).

### 9.2. Ekran wyboru melodii
- Przycisk **Melodies** w menu startowym otwiera listę melodii: tytuł i krótki opis.
- Wybór melodii otwiera instrument w trybie nauki, z ustawionym strojem utworu. Na ekranie dyskretnie, w pasku u góry: tytuł, przycisk „Restart” (nauka od początku), przycisk „Listen” (w trakcie odsłuchu „Stop”) i przycisk wyjścia (✕). Przycisk menu jest w tym czasie ukryty. Po ostatniej nucie tytuł zmienia się na „Well played!”, kółka znikają, a „Restart” zaczyna od nowa.
- Wyjście z melodii przywraca strój użytkownika.
- **W trakcie melodii zmiana stroju w ustawieniach jest zablokowana** (pozycje stroju nieaktywne, z krótką informacją). Pozostałe ustawienia działają.

### 9.3. Wskazanie szarpnięcia
- Miejsce do szarpnięcia oznaczone **czerwonym kółkiem** (kolor akcentu) na strunie, dokładnie w punkcie, w którym należy ją szarpnąć.
- Kółko ma cienką **ciemną obwódkę** (kolor tekstu), żeby zachować kontrast na beżowym tle, także dla osób z daltonizmem.
- Średnica kółka co najmniej rozmiaru opuszka palca (ok. 40–48 px).
- Następna nuta pokazana z wyprzedzeniem jako samo czerwone obramowanie (pusty okrąg), żeby ręka mogła się przygotować.
- **Trafienie gdziekolwiek we wskazaną strunę się liczy**, zarówno stuknięciem, jak i przecięciem w trakcie brzdąknięcia. Kółko jest wskazówką miejsca, nie celem do trafienia. Szarpnięcie w miejscu kółka daje po prostu zamierzoną barwę.
- Szarpnięcie złej struny po prostu gra jej dźwięk. Bez dźwięku błędu, bez punktów. W trybie nauki kółko czeka dalej.
- Koniec melodii: subtelne potwierdzenie, możliwość powtórzenia.

### 9.4. Format melodii
- Melodie zapisane jako dane (JSON), nie w kodzie.
- Każda melodia ma: tytuł, krótki opis historyczny (po angielsku), **przypisany strój** (ustawiany automatycznie na czas grania i przywracany po wyjściu), tempo oraz listę nut.
- **Strój zapisany jawnie:** wysokość najniższej struny oraz 7 proporcji (jako ułamki, np. `"9/8"`) względem niej — a nie odwołanie do nazwanej skali z ustawień. Dzięki temu utwór może mieć dowolny strój dopasowany do swoich dźwięków, także niewystępujący w ustawieniach.
- Każda nuta: numer struny, długość, opcjonalnie **pozycja szarpnięcia** wzdłuż struny (0–1, od mostka). Brak pozycji oznacza wartość domyślną (0,3).
- Plik `melodies/melodies.json`, pola: `id`, `title`, `description`, `tuning: { lowestNote (MIDI), ratios (7 ułamków jako tekst, rosnąco) }`, `tempo` (jednostki długości na minutę), `notes: [{ string (1–7), length, position? }]`. Jednostkę długości wybiera melodia (dla Seikilosa ósemka). Dane są walidowane przy wczytaniu i w testach.
- Numery strun są logiczne (1 = najniższa), niezależne od odwrócenia kolejności dla leworęcznych.
- Melodia zapisana numerami strun ma sens tylko w swoim stroju — stąd przypisanie stroju do utworu.

### 9.5. Repertuar startowy
- **Pieśń Seikilosa** (ok. I w. n.e.), najstarszy zachowany kompletny utwór z zapisem melodii.
- Zasada: liczy się **liczba różnych dźwięków** melodii, nie jej zakres. Strój utworu jest dowolny (9.4), więc melodia z najwyżej 7 różnymi dźwiękami mieści się na 7 strunach bez zmian. Jeśli używa więcej, stosujemy wierną adaptację i opisujemy ją w opisie utworu.
- **Transkrypcja:** według współczesnej transkrypcji z Wikipedii (6/8, osiem taktów, zapis w D-dur z dwoma krzyżykami), opartej na standardowym odczytaniu (Pöhlmann i West, *Documents of Ancient Greek Music*, nr 23). Wysokości w zapisie: E4–E5.
- **Adaptacja:** melodia używa 8 różnych dźwięków (E F♯ G A B C♯ D E). F♯4 pojawia się tylko raz, jako nuta przejściowa w ostatniej melizmie (A–F♯–E), więc jest pominięty, a jego wartość przechodzi na końcowe E. Kontur i kadencja zostają.
- **Strój utworu** (od E3, oktawę niżej niż zapis, w rejestrze liry): E G A B C♯ D E, w proporcjach pitagorejskich 1, 32/27, 4/3, 3/2, 27/16, 16/9, 2. Tempo: 180 ósemek na minutę.
- Docelowo kilka kolejnych krótkich melodii, także prostych, nie-historycznych, do rozgrzewki.

## 10. PWA

### 10.1. Podstawy
- Manifest z ikoną i nazwą „Lyre”, `lang: "en"`. Pole orientacji: `any`, żeby zainstalowana aplikacja obracała się swobodnie między portretem a landscape (6). Systemowa blokada obrotu użytkownika ma pierwszeństwo; iOS ignoruje to pole i i tak obraca zgodnie z urządzeniem. Kolory `theme_color` i `background_color` z palety (beż).
- Service worker cache'ujący wszystkie zasoby; pełne działanie offline.
- **AudioContext uruchamiany kliknięciem przycisku w menu startowym** (11.1). Na urządzeniach dotykowych `pointerdown` nie jest aktywacją użytkownika (jest nią dopiero `pointerup`/`click`), więc dotknięcie struny nie mogłoby niezawodnie uruchomić dźwięku. Kliknięcie w menu robi to, zanim użytkownik dotknie strun.
- AudioContext i AudioWorklet (`addModule`) tworzone wcześniej, przy starcie aplikacji, w stanie wstrzymanym. Kliknięcie w menu tylko wywołuje `resume()`, więc dźwięk jest gotowy od razu.
- Po powrocie aplikacji z tła: próba wznowienia AudioContext. Jeśli się nie uda (np. iOS wymaga ponownej aktywacji), pokazać menu startowe; kliknięcie w nim wznawia dźwięk. Stan instrumentu i melodii się nie resetuje.
- **iOS:** przełącznik wyciszenia w iPhonie potrafi wyciszyć dźwięk z przeglądarki. Ustawić `navigator.audioSession.type = "playback"` (Safari 17+), co w nowszych wersjach to omija. Na starszych, jeśli brak dźwięku jest prawdopodobny, pokazać jednorazową podpowiedź.
- **Wake Lock:** w trakcie melodii (nauka i odsłuch) ekran nie gaśnie (Screen Wake Lock API, z ponownym założeniem blokady po powrocie z tła). Poza melodią zachowanie systemowe.
- **Aktualizacje:** nowa wersja aplikacji pobierana w tle przez service worker i aktywowana przy następnym uruchomieniu, bez komunikatów i bez przeładowania w trakcie gry.
- Ustawienia zapisywane lokalnie (localStorage, z obsługą błędów).

### 10.2. Hosting
- Kod w repozytorium na **GitHubie**, aplikacja publikowana przez **GitHub Pages** (HTTPS jest wymagany przez AudioWorklet i service worker).
- Strona projektu działa pod podścieżką (`https://<użytkownik>.github.io/<repo>/`), więc wszystkie ścieżki względne: zasoby, rejestracja service workera, `start_url` i `scope` w manifeście (`"./"`).
- Bez kroku budowania: pliki w repozytorium to pliki publikowane.
- **Testy na telefonie w trakcie pracy:** `localhost` działa tylko na komputerze. Telefon otwierający serwer deweloperski przez adres w sieci lokalnej (http) nie dostanie AudioWorklet. Testować przez wersję na GitHub Pages albo przez tunel HTTPS.

### 10.3. Instalacja z ustawień
- W ustawieniach pozycja **„Install app”**. Aplikacja nie pokazuje własnych banerów ani wyskakujących zachęt do instalacji — tylko ta jedna pozycja w ustawieniach.
- **Przeglądarki z obsługą `beforeinstallprompt`** (Chrome, Edge i inne oparte na Chromium, Android i komputer): przechwycić zdarzenie (`preventDefault`), zachować je i wywołać okno instalacji po naciśnięciu przycisku. Zdarzenie można użyć tylko raz; po odrzuceniu przez użytkownika przycisk znika do czasu, aż przeglądarka ponownie wyśle zdarzenie.
- **iOS / iPadOS (Safari i inne przeglądarki na iOS):** brak programowej instalacji. Zamiast przycisku krótka instrukcja: „Tap Share, then Add to Home Screen”, najlepiej z ikoną udostępniania.
- **Pozostałe przeglądarki bez obsługi** (np. Firefox na komputerze): pozycja ukryta albo krótka informacja, że instalacja jest dostępna w innej przeglądarce.
- **Gdy aplikacja jest już zainstalowana** (uruchomiona w trybie `display-mode: standalone`, na iOS `navigator.standalone`): pozycja w ustawieniach ukryta.
- Po zdarzeniu `appinstalled` pozycja znika od razu.

## 11. Menu startowe i ustawienia

### 11.1. Menu startowe
- Pierwszy ekran po uruchomieniu: nazwa „Lyre” i kilka przycisków: **Play**, **Melodies**, **Settings** (Melodies dochodzi razem z trybem melodii).
- Settings otwiera się na tle menu; przycisk **Done** wraca do menu.
- Kliknięcie dowolnego przycisku uruchamia AudioContext (10.1).
- W tej samej beżowej palecie, minimalistyczne, bez animacji wstępnych.
- Dyskretny przycisk na ekranie instrumentu wraca do menu.

### 11.2. Ustawienia

Krótka lista, jeden ekran:
- rodzaj tetrachordu,
- skala,
- wysokość najniższej struny,
- kolejność strun (odwrócenie dla leworęcznych),
- głośność ogólna,
- pokazywanie informacji o opóźnieniu (stan audio, opóźnienia; domyślnie wyłączone, przydatne przy testach na urządzeniach),
- zainstaluj aplikację (tylko gdy dostępne; patrz 10.3; dochodzi razem z PWA).

Zmiany działają od razu i są zapisywane w localStorage; nieprawidłowe lub uszkodzone zapisane wartości są zastępowane domyślnymi.

Rodzaj tetrachordu, skala i wysokość najniższej struny są nieaktywne w trakcie melodii (9.2), bo melodia ma własny strój.

## 12. Poza zakresem MVP

- tryb Gra w melodiach (melodia w swoim tempie, 9.1),
- lekka wibracja przy szarpnięciu (Vibration API, tylko Android),
- sterowanie klawiaturą na komputerze (klawisze 1–7),
- nagrywanie i eksport własnej gry,
- edytor melodii,
- tryb dwóch instrumentów / gra sieciowa,
- zaawansowane modele syntezy (falowody, synteza modalna),
- dodatkowe instrumenty (kithara, aulos),
- ciemny wariant kolorystyczny (np. ciemna umbra z beżowymi strunami).

## 13. Kryteria akceptacji MVP

- Siedem strun gra czysto nastrojone dźwięki w domyślnym stroju (heptachord, diatonika pitagorejska); zmiana stroju działa od kolejnego szarpnięcia.
- **Szybkie przeciągnięcie palcem przez wszystkie 7 strun gra wszystkie 7, każdą raz, w kolejności, w obu kierunkach** — także przy bardzo szybkim ruchu i przy geście zaczętym poza skrajną struną.
- **Szybkie przeciągnięcie przez 2, 3 lub 4 sąsiednie struny gra dokładnie te struny**, każdą raz, w kolejności, w obu kierunkach i w dowolnym miejscu instrumentu (np. struny 1–2, 3–5, 4–7) — bez dodatkowych dźwięków z sąsiednich strun.
- Gest zaczęty na strunie (np. od struny 2 do 4) gra także strunę, od której się zaczął.
- Szybkie przeciągnięcia tam i z powrotem między dwiema strunami grają każde przejście; zmiana kierunku w trakcie gestu działa.
- Stuknięcie w strunę gra ją od razu, raz. Dotknięcie między strunami nie gra nic. Brzdąknięcie zaczęte na strunie nie gra jej podwójnie.
- Palec leżący na strunie jej nie wycisza; brzdąknięcie nie gra strun podwójnie.
- Po kliknięciu przycisku w menu startowym pierwsze szarpnięcie struny gra od razu.
- Opóźnienie od szarpnięcia do dźwięku nie przekracza wartości docelowej (do ustalenia po pomiarach na urządzeniach).
- Działa na telefonie z Androidem i na iPhonie.
- Barwa zmienia się słyszalnie z miejscem szarpnięcia.
- Struny drgają wizualnie, zsynchronizowane z wygasaniem dźwięku.
- Układ poprawny w portrecie i landscape na telefonie i tablecie; obrót nie przerywa gry.
- Pieśń Seikilosa da się zagrać w trybie nauki, z czerwonym kółkiem wskazującym kolejne szarpnięcia, i odsłuchać przyciskiem „Listen”.
- W trakcie melodii ekran nie gaśnie.
- Cała aplikacja w beżowej palecie; struny i kółko wyraźnie czytelne na tle.
- Na Androidzie (Chrome) aplikację da się zainstalować przyciskiem w ustawieniach; na iPhonie ustawienia pokazują instrukcję instalacji; po instalacji pozycja znika.
- Aplikacja instaluje się jako PWA i działa w trybie samolotowym.
- Aplikacja działa z GitHub Pages pod podścieżką repozytorium.

## 14. Otwarte kwestie

- Pudło rezonansowe: splot z odpowiedzią impulsową czy filtry rezonansowe — decyzja po odsłuchu.
- Konstrukcja heptachordu i harmonii (5.2) — weryfikacja ze źródłami muzykologicznymi.
- Transkrypcja Pieśni Seikilosa (9.5): porównanie z wydaniem Pöhlmanna i Westa, zwłaszcza rytm i ostatnia fraza.
- Szerokość pasma stuknięcia, głośność stuknięcia i próg histerezy przy brzdąknięciu — strojenie na prawdziwych urządzeniach.
- Dolny próg głośności dla wolnego pociągnięcia (4.2).
- Opóźnienie dźwięku na Androidzie i iOS — pomiar (`baseLatency`, `outputLatency`) w pierwszym prototypie, potem wartość docelowa do kryteriów akceptacji.
- Maksymalny odstęp między strunami na szerokich ekranach.
- Styl graficzny mostka i jarzma oraz dopracowanie palety.