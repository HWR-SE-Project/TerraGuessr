# Diagrammbeschreibung: Anwendungsfalldiagramm (TerraGuessr)

![Anwendungsfalldiagramm TerraGuessr](./use-case-diagram-de.png)

## Überblick und Systemgrenze

Das dargestellte UML-Anwendungsfalldiagramm beschreibt die wesentlichen funktionalen Anforderungen der Webanwendung **TerraGuessr** aus Sicht der beteiligten Akteure. Die Rechteck-Umrandung kennzeichnet die Systemgrenze von **TerraGuessr** und trennt die zwölf innerhalb des Systems angebotenen Anwendungsfälle klar von den vier externen Akteuren, die außerhalb der Systemgrenze stehen.

## Akteure und Generalisierungsbeziehungen

Auf der linken Seite der Systemgrenze sind die drei menschlichen Primärakteure modelliert, die über Generalisierungsbeziehungen zueinander in Beziehung stehen:

* **Spieler** bildet den Basisakteur für alle Nutzerinnen und Nutzer, die mit TerraGuessr interagieren (sowohl Gäste als auch angemeldete Personen).
* **Lobby-Host** ist eine Spezialisierung von **Spieler**. Ein Lobby-Host erbt sämtliche Anwendungsfälle eines Spielers und übernimmt darüber hinaus die organisatorische Rolle für Mehrspieler-Lobbys.
* **Registrierter Spieler** ist ebenfalls eine Spezialisierung von **Spieler**. Dieser Akteur erbt alle grundlegenden Spiel- und Einstellungsfunktionen eines Spielers und erhält zusätzlich Zugriff auf kontogebundene Funktionen.

Auf der rechten Seite der Systemgrenze ist mit **Externe Wetter-API** (gekennzeichnet mit den Stereotypen `«actor»` und `«system»`) ein sekundärer Systemakteur dargestellt, der von TerraGuessr zur Bereitstellung aktueller Wetterdaten eingebunden wird.

## Anwendungsfälle der Akteure

Der Basisakteur **Spieler** ist direkt mit fünf Anwendungsfällen assoziiert:

* Über **Einzelspieler-Modus spielen** und **An Mehrspieler-Match teilnehmen** können die beiden zentralen Spielmodi genutzt werden.
* Über **Interaktives Tutorial absolvieren** können die grundlegenden Spielmechaniken erlernt werden.
* Mit **Avatar & Einstellungen anpassen** lassen sich das Aussehen des eigenen Explorer-Avatars sowie persönliche Anwendungseinstellungen konfigurieren.
* Über **Konto authentifizieren** können Nutzerinnen und Nutzer sich anmelden oder ein Benutzerkonto anlegen.

Aufbauend auf dieser Basis stehen den spezialisierten Akteuren zusätzliche Anwendungsfälle zur Verfügung:

* Der **Lobby-Host** kann zusätzlich den Anwendungsfall **Lobby erstellen & verwalten** ausführen, um Mehrspieler-Lobbys anzulegen, Spielbedingungen festzulegen, Matches zu starten oder eine Lobby wieder zu schließen.
* Der **Registrierte Spieler** hat zusätzlich Zugriff auf **Statistiken & Spielverlauf einsehen**, um vergangene Partien und Leistungsauswertungen abzurufen, sowie auf **Konto verwalten**, um das eigene Profil zu bearbeiten, die E-Mail-Adresse zu ändern, sich abzumelden oder das Konto dauerhaft zu löschen.

## `«include»`-Beziehungen

Um wiederkehrende, verpflichtende Kernfunktionalitäten ohne Redundanz abzubilden, nutzt das Diagramm drei `«include»`-Beziehungen:

* Sowohl **Einzelspieler-Modus spielen** als auch **An Mehrspieler-Match teilnehmen** binden verpflichtend den Anwendungsfall **Spielrunde spielen** ein, da die zentrale Spielmechanik (Anzeige der Umweltdaten, Auswahl und Abgabe von Tipps sowie Auswertung und Auflösung des Zielorts) in beiden Modi identisch zum Tragen kommt.
* **Spielrunde spielen** bindet seinerseits verpflichtend den Anwendungsfall **Aktuelle Wetterdaten abrufen** ein. Dieser Anwendungsfall ist mit dem externen Akteur **Externe Wetter-API** assoziiert, da für jede Spielrunde aktuelle Wetterdaten zum ausgewählten Zielort abgerufen werden müssen.

## `«extend»`-Beziehungen

Optionale bzw. an bestimmte Bedingungen geknüpfte Erweiterungen des regulären Rundenablaufs werden über zwei `«extend»`-Beziehungen zum Basis-Anwendungsfall **Spielrunde spielen** modelliert. Die entsprechenden Erweiterungspunkte (*extension points*) sind direkt im Anwendungsfall **Spielrunde spielen** aufgeführt, und die jeweiligen Bedingungen sind über angehängte UML-Notizen festgehalten:

* **Zusatzdaten freischalten** erweitert **Spielrunde spielen** am Extension Point *Zusatzdaten angefordert* unter der Bedingung `[Zusatzdaten sind gesperrt UND Spieler fordert Freischaltung an]`. Die Erweiterung greift somit nur dann, wenn die Zusatzdaten im aktuellen Spielmodus nicht ohnehin bereits freigegeben sind und die spielende Person deren Freischaltung aktiv anfordert.
* **Spielergebnis archivieren** erweitert **Spielrunde spielen** am Extension Point *Runde abgeschlossen* unter der Bedingung `[Spieler ist angemeldet]`. Dadurch wird verdeutlicht, dass abgeschlossene Runden ausschließlich für angemeldete Konten gespeichert werden und anschließend über **Statistiken & Spielverlauf einsehen** verfügbar sind, während Spielrunden von Gästen nicht archiviert werden.
