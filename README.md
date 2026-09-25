# CG Looper

Lokale GUI für aufeinanderfolgende Drucke mit Bambu Lab P1S und kompatibler Ausräummechanik. Version 1.4.

**Web-App:** [gfall94.github.io/CG-Looper](https://gfall94.github.io/CG-Looper/)

## Starten – keine Installation

**`CG-Looper.html` doppelklicken.** Alternativ `Start-CG-Looper.cmd` starten.

Ein aktueller Edge-, Chrome- oder Firefox-Browser genügt. Getestet wurde Microsoft Edge unter Windows. Kein Python, Node, Webserver, Internetzugang oder Benutzerkonto erforderlich. Die HTML-Datei enthält die gesamte Anwendung und kann allein kopiert werden.

1. Eine oder mehrere unveränderte `.gcode` oder `.gcode.3mf` auswählen oder hineinziehen. Weitere Auswahlen werden zur Liste hinzugefügt. Bei mehreren G-Code-Platten die gewünschte Platte der markierten Datei auswählen.
2. **Stückzahl je Datei** einstellen und „Abwechselnd“ oder „Als Paket“ auswählen. 2 bedeutet zwei Drucke der jeweiligen Datei, nicht zwei zusätzliche Wiederholungen.
3. Biege-Basis, Biegetiefe und Ausräumhöhe einstellen. Beim Laden einer Datei oder Wechseln der Platte wird die Ausräumhöhe automatisch vorgeschlagen. Das Feld bleibt frei editierbar; „Vorschlag übernehmen“ setzt es wieder auf den berechneten Wert. Alle Z-Angaben sind absolute Druckerkoordinaten, außer der zusätzlichen Biegetiefe.
4. Kühlung und Ausräummuster wählen. Unter „Ausräum-G-Code ansehen“ die erzeugte Sequenz prüfen.
5. Die gesamte Warteschlange als eine `.gcode` herunterladen. Bei genau einer Quelldatei aus einem 3MF-Paket ist zusätzlich `.gcode.3mf` verfügbar.

Die Ausgangsdateien werden nicht überschrieben. Dateien werden ausschließlich lokal verarbeitet. Die Anwendung überträgt keine Datei an einen Drucker.

## Mehrere Dateien, Reihenfolge und Thumbnails

Jede Datei erscheint als eigene Karte mit Thumbnail, Druckzeit, Materialverbrauch und Stückzahl. Die markierte Karte bestimmt, welche Datei in der Bewegungs- und G-Code-Vorschau gezeigt wird. Die Stückzahl lässt sich auf der Karte oder unter „Anzahl · ausgewählte Datei“ ändern. Die Ausräumhöhe wird ebenfalls **je Datei** vorgeschlagen und gespeichert. Biegeparameter, Kühlung, Lüfter, Schachtspülung und Zwischenpause gelten gemeinsam für alle Dateien.

Bei A × 3 und B × 2 ergeben sich folgende Reihenfolgen:

| Modus | Druckreihenfolge |
|---|---|
| Abwechselnd | A → B → A → B → A |
| Als Paket | A → A → A → B → B |

Abwechselnd wird pro Runde eine Kopie jeder noch offenen Datei gedruckt; Dateien mit erreichter Stückzahl werden übersprungen. Mit dem Pfeil auf einer Karte kann die Listenreihenfolge geändert werden. Die Buchstaben und Reihenfolge unter „Deine Druckserie“ aktualisieren sich entsprechend. „Entfernen“ und „Liste leeren“ entfernen nur Einträge aus der App, keine Dateien vom Rechner.

G-Code-3MF-Dateien zeigen das zum ausgewählten `plate_N.gcode` gehörende PNG. Für Klartext-G-Code oder fehlende PNGs erzeugt die App eine als solche beschriftete **2D-Bahnvorschau der ersten Schicht**. Diese ist kein gerendertes 3D-Modell; Bögen werden vereinfacht über ihre Endpunkte dargestellt.

Die Zeit-, Verbrauchs- und Wartezeitübersicht umfasst alle Dateien und Stückzahlen. „Nach dem letzten Druck ausräumen“ bezieht sich auf das Ende der gesamten Warteschlange. Zwischen zwei aufeinanderfolgenden Drucken wird stets ausgeräumt, auch wenn zur nächsten Datei gewechselt wird. Jeder Druck verwendet seinen eigenen vollständigen Start- und Endcode. Die Dateien müssen zum gleichen physischen P1S-Aufbau passen; abweichende oder fehlende Düsendurchmesser-Konfigurationen werden bei mehreren Dateien abgewiesen.

**Exportgrenze:** Mehrere unterschiedliche Quelldateien werden als zusammenhängender Klartext-G-Code ausgegeben. Ein gemeinsames 3MF-Paket wird nicht angeboten, weil dessen Objekt-, Platten- und Filament-Metadaten nicht mit denen nur einer Quelldatei gleichgesetzt werden dürfen. Bei einer Quelldatei bleibt der bisherige 3MF-Export erhalten.

Version-2-Profile speichern Reihenfolge, Stückzahlen und individuelle Ausräumhöhen. Zum Wiederherstellen zuerst dieselben Dateien und Platten laden, dann das Profil öffnen. Die Zuordnung erfolgt über G-Code-Prüfsumme und Plattenpfad; fehlende oder veränderte Dateien werden gemeldet. Profile enthalten nicht die Druckdateien selbst. Alte Version-1-Profile bleiben lesbar. Geladene Druckdateien werden beim Neuladen des Browsers nicht automatisch wiederhergestellt.

## Einstellungen

| Einstellung | Bedeutung / Standard |
|---|---|
| Stückzahl | 5 für die erste Datei; weitere Dateien beginnen mit 1 |
| Reihenfolge | Abwechselnd oder paketweise, in der Reihenfolge der Dateiliste |
| Biege-Basis | Z185 mm, entlastete Position |
| Biegetiefe | +35 mm; resultierende Endposition Z220 |
| Biegezyklen | 6 × Endposition → Basis |
| Z-Geschwindigkeit | 20 mm/s, begrenzt durch Eingabeprofil |
| Ausräumhöhe | Ausgangswert 10 mm; beim Laden automatischer Vorschlag aus der Bauteilhöhe; manuell änderbar |
| Ausräumgeschwindigkeit | 50 mm/s |
| Mittelfahrten | 2 bei X125 |
| Rechenfahrten | X220, 190, 160, 130, 100, 70, 30; Y250 → Y0 |
| Zweite Rechenfahrt | Optional, 200 mm/s |
| Parkhöhe | Z20,2 nach dem Ausräumen |
| Standard-Kühlmodus | Temperatur + zusätzliche Kühlpause |
| Zeitgesteuert | Bett aus, feste Kühlpause |
| Temperatur + zusätzliche Kühlpause | 60 Temperaturbefehle für 35 °C, anschließend 60 Sekunden feste Kühlpause |
| Temperaturgesteuert | Ein M190-S-Wartebefehl, anschließend optional eine einmalige Zusatzpause pro Ausräumvorgang |
| Zusatzpause nach Temperaturfreigabe | 0–7200 Sekunden, Standard 0 (aus); nur im Temperaturmodus |
| Kühllüfter | 100 %, gemeinsam für Bauteil-, Zusatz- und Gehäuselüfter |
| Schachtspülung | 50 mm Filament bei 200 **mm/min**, ersetzt die Start-Spüllinie |
| Zwischenpause | 2 Sekunden nach Endcode |
| Letzten Druck ausräumen | Ein; ausschaltbar |

Die „Biegetiefe“ ist ein Z-Hub, keine Messung der tatsächlichen Plattenverformung. Die Druck-Z-Korrektur und der Plattentyp bleiben wie in der Ausgangsdatei.

Profile lassen sich als JSON speichern und laden. Der Browser speichert gültige Einstellungen zusätzlich lokal, sofern dessen Einstellungen dies erlauben. Alte Profile mit dem internen Kühlmodus `reference` werden automatisch als „Temperatur + zusätzliche Kühlpause“ geladen.

## Automatischer Höhenvorschlag

Die Bauteilhöhe stammt aus `max_z_height` im G-Code. Der Vorschlag ist **Bauteilhöhe minus 10 mm**, bei Bauteilen unter 20 mm **die halbe Bauteilhöhe**, mindestens 0,2 mm, gerundet auf 0,01 mm. Beispiele: 28,25 mm → 18,25 mm; 12 mm → 6 mm.

Das ist eine einstellbare Kontakt-Höhe unterhalb der Oberkante, keine Kollisions- oder Formanalyse. Bei mehreren unterschiedlich hohen Objekten, filigranen Formen oder besonderen Ausräumwerkzeugen muss der Wert zum Aufbau passen. Ein manueller Wert bleibt beim Ändern anderer Parameter erhalten. Eine neu geladene Datei/Platte oder „Standardwerte“ trägt einen neuen Vorschlag ein. Ein danach geladenes Einstellungsprofil darf ihn wiederum überschreiben.

## Temperaturgesteuertes Warten – nur G-Code

Der dritte Kühlmodus lässt den **Drucker selbst** auf die Zieltemperatur warten:

```gcode
M190 S40 ; wait for bed temperature (P1S)
M400 ; synchronize before plate bending
G4 S90 ; one additional wait after temperature release
M140 S0
; BENDING MOTION
```

Die 40 °C und 90 Sekunden sind Beispiele; exportiert werden die eingestellten Werte. Die Zusatzpause wird **genau einmal pro Ausräumvorgang nach Freigabe des Temperatur-Wartebefehls** eingefügt. Mit 0 Sekunden entfällt sie. Die anderen Kühlmodi verwenden weiterhin ihre eigene feste Kühlpause. Die Zusatzpause ersetzt den Temperaturbefehl nicht. Es gibt keinen LAN-Helfer und keine Netzwerkverbindung.

**Eine strikt garantierte Temperaturgrenze ist damit beim P1S nicht zugesichert.** Der G-Code wartet bis zur Freigabe durch die Firmware, einschließlich ihrer Toleranzen und möglichen Zeitlimits. Ein P1S-Anwender bestätigt den Erfolg von `M190 S45` und Probleme mit `M190 R40` in einem [Bericht vom April 2026](https://forum.bambulab.com/t/p1s-end-gcode-help/246073). Andere Anwender berichten über vorzeitiges Weiterlaufen bzw. Zeitlimits im [Bambu-Forum](https://forum.bambulab.com/t/m190-r-supported/38756). Das sind Praxiserfahrungen, keine verbindliche Firmware-Spezifikation. Deshalb wird der Marlin-Befehl `M190 R…` nicht einfach auf den P1S übertragen und der Modus nicht als garantierte Temperatursperre bezeichnet. Ein Sollwert unter der Raumtemperatur kann außerdem unerreichbar sein.

## Druckzeit und gesamte Wartezeit

Unter „Deine Druckserie“ stehen die Slicer-Zeit eines Drucks, die Zeit aller Druckdurchläufe, zusätzlich eingestellte feste Wartezeiten, eine Bewegungszeitschätzung und die geschätzte Seriendauer. Die Druckzeit wird aus `total estimated time` gelesen. Fehlt eine auswertbare Angabe, erscheint „Unbekannt“ statt eines erfundenen Werts.

Die Zeitrechnung lautet: **Summe aus Stückzahl × Slicer-Zeit jeder Datei + zusätzliche feste Pausen + geschätzte Biege-/Ausräum-/Parkzeit**. Der Materialverbrauch wird ebenfalls je Datei hochgerechnet und summiert. Die Seriendauer ist ein Orientierungswert: Beschleunigung sowie die geänderte Schachtspülung und der ersetzte ursprüngliche Parkablauf werden nicht exakt simuliert. Temperaturabhängige Wartephasen sind nicht vorhersagbar und werden ausdrücklich zusätzlich ausgewiesen.

Direkt in den Kühleinstellungen wird die planbare Wartezeit aufgeschlüsselt. Bei N Drucken gibt es N−1 Zwischenpausen. Gekühlt und ausgeräumt wird N-mal, beziehungsweise N−1-mal, wenn das Ausräumen nach dem letzten Druck deaktiviert ist. Im Temperaturmodus zählt dafür die neue Zusatzpause; bei Zeit- und kombiniertem Modus zählt die feste Kühlpause. Beispiel: 3 Drucke, letzter Druck ohne Ausräumen, 90 Sekunden Zusatzpause und 5 Sekunden Zwischenpause ergeben **2 × 90 + 2 × 5 = 190 Sekunden** planbare Wartezeit plus 2 temperaturabhängige Wartephasen. Vorhandene Wartezeiten im ursprünglichen Druckstart werden nicht nochmals separat hinzugezählt.

## Animierte Ausräumsequenz

Die Vorschau unter „Deine Druckserie“ zeigt links die Draufsicht auf XY und rechts die Z-Bewegung. Sie folgt den tatsächlich erzeugten Fahrbefehlen für Biegen, Anfahren der Ausräumhöhe, Mittel- und Rechenfahrten sowie Parken. Die Startposition wird aus dem unterstützten Original-Endcode gelesen. Änderungen an Positionen, Zyklen und aktivierten Mustern aktualisieren die Darstellung.

„Abspielen“, „Pause“, „Zurücksetzen“ und der Fortschrittsregler erlauben die Prüfung eines Ausräumvorgangs, mit 1×, 4× oder 10× Abspieltempo. Die Geschwindigkeitswahl verändert nur die Vorschau, nicht den exportierten G-Code. Grün zeigt bereits gefahrene Wege, Orange die aktuelle Fahrt und Blau die Z-Position. Die Animation startet nicht automatisch. Bei einer Serie ohne Ausräumen bleibt sie deaktiviert.

Die Vorschau ist eine schematische Darstellung, keine Kollisionssimulation. Die zeitliche Verteilung verwendet Weglänge/Vorschub ohne Beschleunigung; Kühlpausen und firmwareabhängige Wartebefehle werden nicht animiert.

## Kompatibilität und Grenzen

- Unterstützt den erkannten **Bambu Lab P1S / OrcaSlicer-Start- und Endcode** der gelieferten Datei mit 256 × 256 × 250 mm. Unbekannte Strukturen, andere Drucker und bereits geloopte Dateien werden abgewiesen. Kein universeller G-Code-Looper.
- Die festen Park- und Schachtpositionen passen zum P1S-Profil. Sie sind keine automatische Kollisionsprüfung für andere Umbauten.
- Die eigentlichen Druckbahnen bleiben unverändert. Start, Homing, Kalibrierung, AMS-Entladen und Endcode werden je Durchlauf wiederholt. Optional wird die Start-Spüllinie durch Schachtspülung ersetzt.
- Die Offline-App erhält keine tatsächliche Betttemperatur. Die feste Kühlpause ist frei einstellbar und startet standardmäßig bei 60 Sekunden. Bei temperaturbasierten Modi entscheidet die Drucker-Firmware über die Freigabe; deren Verhalten muss am Gerät geprüft werden.
- Der 3MF-Export übernimmt Metadaten, Vorschaubilder und andere Platten unverändert und aktualisiert G-Code plus MD5 der ausgewählten Platte. Das ZIP wird ohne Kompression geschrieben und ist daher größer. **Slicer-Zeiten, Materialangaben und Fortschrittsmeldungen im Paket beziehen sich weiterhin auf einen Einzeldruck.** Die GUI zeigt den hochgerechneten Materialverbrauch ohne zusätzliche Schachtspülung.
- Maximal 20 Quelldateien, je höchstens 100 MB Eingabegröße; zusammen maximal 250 MB entpackte Daten. Geschätzte G-Code-Ausgabe maximal 250 MB und insgesamt höchstens 100 Drucke. ZIP64 und verschlüsselte ZIPs sind nicht unterstützt.
- Automatische Softwareprüfungen und Browserprüfung bestanden. **Keine mechanische Erprobung oder Freigabe am realen Drucker.** Den ersten Ablauf am eigenen Aufbau beaufsichtigt prüfen.

## Qualitätssicherung

Generator, Warteschlange, Zeitberechnung, Bewegungsablauf, ZIP-Verarbeitung und Browseroberfläche wurden automatisiert geprüft. Die statischen Prüfberichte liegen im Ordner `analysis`. Es erfolgte keine mechanische Freigabe am realen Drucker.

## Lizenz

Der Quellcode ist einsehbar, aber **nicht Open Source**. Erlaubt ist ausschließlich die unveränderte private, nichtkommerzielle Nutzung. Kommerzielle Nutzung, Weiterentwicklung, Veränderung und Weiterverteilung benötigen eine vorherige schriftliche Genehmigung. Maßgeblich ist die Datei [`LICENSE`](LICENSE).

## Projektaufbau

Die Bestandteile der Anwendung liegen in `src`. `build.ps1` erzeugt daraus die einzelne `CG-Looper.html`. Zum Ausführen der fertigen App wird der Quellcode nicht benötigt; es gibt keine Laufzeitabhängigkeiten.
