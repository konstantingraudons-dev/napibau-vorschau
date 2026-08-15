// Anfragestrecke /anfrage/: blendet die drei Schritte ohne Seitenwechsel um,
// wenn JavaScript verfuegbar ist. Ohne JavaScript bleibt jedes der drei
// <form>-Elemente in vorlagen/anfrage.html ein eigenstaendiges Formular, das
// wirklich zu /anfrage.php postet und dort den naechsten Schritt als neues
// Dokument zurueckbekommt (siehe php/anfrage.php). Auf genau diesen von PHP
// gerenderten Folgeseiten steht immer nur ein Schritt im Dokument; dieses
// Skript erkennt das (weniger als drei .formular-schritt) und tut dann
// nichts, ausser das Formular ganz normal laufen zu lassen.
(function () {
  'use strict';

  var schritt1 = document.querySelector('[data-schritt="1"]');
  var schritt2 = document.querySelector('[data-schritt="2"]');
  var schritt3 = document.querySelector('[data-schritt="3"]');
  if (!schritt1 || !schritt2 || !schritt3) { return; }

  // Cookiefreie Zaehlung der Formularschritte (siehe php/z.php und Konzept
  // Abschnitt 6.4 "Messung"). Ein eigenes Ereignis je Schritt statt eines
  // "Abbruch"-Ereignisses: der Abbruch je Schritt ergibt sich spaeter in der
  // Auswertung aus der Differenz aufeinanderfolgender Start-Zaehler, siehe
  // Kommentar in php/z.php.
  function zaehle(ereignis) {
    return; // Vorschau: keine Zaehlung
    try {
      navigator.sendBeacon('/z.php?e=' + encodeURIComponent(ereignis) +
        '&s=' + encodeURIComponent(location.pathname));
    } catch (fehler) { /* Zaehlung ist nie wichtiger als der Schritt selbst */ }
  }
  zaehle('formular_schritt1_start');

  // Quelle aus ?von= uebernehmen. Ohne JavaScript liest php/anfrage.php beim
  // allerersten Kontakt ersatzweise den Referer aus (dort naeher erklaert);
  // mit JavaScript ist dieser Weg zuverlaessiger und laeuft, bevor irgendein
  // Feld angefasst wurde.
  var von = '';
  try { von = new URLSearchParams(location.search).get('von') || ''; } catch (fehler) { /* alte Browser: kein von */ }
  if (von) { setzeWert(schritt1, 'quelle', von); }

  // Zeitpunkt des Seitenaufrufs: mit JavaScript findet bis zum echten
  // Absenden am Ende von Schritt 3 kein einziger Netzwerkaufruf statt, ein
  // vom Server gesetzter Zeitstempel waere also gar nicht moeglich. Dieser
  // clientseitige Ladezeitpunkt uebernimmt dieselbe Rolle: php/anfrage.php
  // prueft beim Absenden, ob seither mindestens ein paar Sekunden vergangen
  // sind (siehe dort, NB_MIN_AUSFUELLZEIT).
  setzeWert(schritt1, 'zeitstempel', String(Math.floor(Date.now() / 1000)));

  function wert(form, name) {
    var feld = form.querySelector('[name="' + name + '"]');
    if (!feld) { return ''; }
    if (feld.type === 'radio') {
      var gewaehlt = form.querySelector('[name="' + name + '"]:checked');
      return gewaehlt ? gewaehlt.value : '';
    }
    return feld.value;
  }

  function setzeWert(form, name, neuerWert) {
    var feld = form.querySelector('[name="' + name + '"]');
    if (feld && feld.type !== 'radio' && feld.type !== 'file') { feld.value = neuerWert; }
  }

  function uebernehmen(von, nach, namen) {
    namen.forEach(function (name) { setzeWert(nach, name, wert(von, name)); });
  }

  // Traegt ausgewaehlte Fotos zwischen den beiden Formularen weiter, ohne
  // ueber den Server zu gehen (der bekommt sie ohnehin erst beim echten
  // Absenden am Ende von Schritt 3 zu sehen). Ohne DataTransfer bleibt das
  // Feld schlicht leer, das Formular funktioniert trotzdem, die Fotos sind
  // in Schritt 2 ja ausdruecklich optional.
  function dateienUebernehmen(von, nach) {
    var quelle = von.querySelector('input[type="file"][name="fotos[]"]');
    var ziel = nach.querySelector('input[type="file"][name="fotos[]"]');
    if (!quelle || !ziel || !quelle.files || !quelle.files.length || typeof DataTransfer === 'undefined') { return; }
    try {
      var uebertragung = new DataTransfer();
      for (var i = 0; i < quelle.files.length; i++) { uebertragung.items.add(quelle.files[i]); }
      ziel.files = uebertragung.files;
    } catch (fehler) { /* kein Absturz, Fotos bleiben dann leer */ }
  }

  function fokussiere(form) {
    var ueberschrift = form.querySelector('h1, h2');
    if (!ueberschrift) { return; }
    if (!ueberschrift.hasAttribute('tabindex')) { ueberschrift.setAttribute('tabindex', '-1'); }
    ueberschrift.focus();
  }

  function zeige(anzeigen, verbergen) {
    verbergen.hidden = true;
    anzeigen.hidden = false;
    fokussiere(anzeigen);
    if (anzeigen === schritt2) { zaehle('formular_schritt2_start'); }
    if (anzeigen === schritt3) { zaehle('formular_schritt3_start'); }
  }

  schritt1.addEventListener('submit', function (ereignis) {
    ereignis.preventDefault();
    if (!schritt1.reportValidity()) { return; }
    uebernehmen(schritt1, schritt2, ['art', 'quelle', 'honigtopf', 'zeitstempel', 'csrf']);
    zeige(schritt2, schritt1);
  });

  // Klick auf eine Kachel blendet sofort weiter, ohne auf "Weiter" zu warten.
  // Das ist knifflig: eine native Radio-Gruppe loest bei JEDEM Pfeiltastendruck
  // ein change-Ereignis aus, weil Pfeiltasten innerhalb der Gruppe gleichzeitig
  // den Fokus bewegen UND die Auswahl aendern. Mit "change" wuerde eine Person,
  // die die sechs Kacheln per Pfeiltaste nur durchblaettert, beim allerersten
  // ArrowDown ungewollt zu Schritt 2 geschickt, und zwar mit welcher Kachel
  // auch immer der Pfeil gerade zufaellig getroffen hat. "click" allein loest
  // das Problem NICHT: in Chromium synthetisiert der Browser bei Pfeiltasten-
  // Navigation innerhalb einer Radio-Gruppe zusaetzlich zu change/input auch
  // ein click-Ereignis auf der neu ausgewaehlten Kachel (per Probe-Skript
  // nachgewiesen), Klick und Pfeiltaste lassen sich also am Ereignistyp allein
  // nicht unterscheiden.
  //
  // Deshalb wird zusaetzlich mitgefuehrt, ob der jeweils letzte Tastendruck
  // eine Pfeiltaste war: nur wenn NICHT, loest ein click wirklich aus. Das
  // deckt zuverlaessig alle drei gewuenschten Wege ab (Maus-Klick: gar kein
  // vorheriger keydown auf dem Feld; Leertaste: letzter keydown ist " ", nicht
  // Pfeiltaste; Klick auf das umschliessende <label>: ebenfalls kein
  // vorheriger Pfeiltasten-keydown), waehrend reine Pfeiltasten-Navigation
  // (letzter keydown ist eine Pfeiltaste) das Absenden unterdrueckt. Die
  // Markierung wird nach jedem click wieder zurueckgesetzt, damit sie sich
  // nicht auf einen spaeteren, unabhaengigen Klick uebertraegt.
  var pfeiltasteWarLetzterTastendruck = false;
  document.addEventListener('keydown', function (ereignis) {
    pfeiltasteWarLetzterTastendruck = ereignis.key === 'ArrowUp' || ereignis.key === 'ArrowDown'
      || ereignis.key === 'ArrowLeft' || ereignis.key === 'ArrowRight';
  }, true);
  schritt1.querySelectorAll('input[name="art"]').forEach(function (feld) {
    feld.addEventListener('click', function () {
      var durchPfeiltasteAusgeloest = pfeiltasteWarLetzterTastendruck;
      pfeiltasteWarLetzterTastendruck = false;
      if (feld.checked && !durchPfeiltasteAusgeloest) { schritt1.requestSubmit(); }
    });
  });

  schritt2.addEventListener('submit', function (ereignis) {
    ereignis.preventDefault();
    var zurueck = ereignis.submitter && ereignis.submitter.value === '1';
    if (zurueck) { zeige(schritt1, schritt2); return; }
    if (!schritt2.reportValidity()) { return; }
    uebernehmen(schritt2, schritt3, ['art', 'stadtteil', 'flaeche', 'zeitraum', 'quelle', 'honigtopf', 'zeitstempel', 'csrf']);
    dateienUebernehmen(schritt2, schritt3);
    zeige(schritt3, schritt2);
  });

  schritt3.addEventListener('submit', function (ereignis) {
    var zurueck = ereignis.submitter && ereignis.submitter.value === '2';
    if (zurueck) {
      ereignis.preventDefault();
      uebernehmen(schritt3, schritt2, ['stadtteil', 'flaeche', 'zeitraum']);
      dateienUebernehmen(schritt3, schritt2);
      zeige(schritt2, schritt3);
      return;
    }
    // Echtes Absenden: die statische Marke, die das csrf-Feld bis hierher
    // traegt, akzeptiert der Server fuer 'senden' nicht mehr (siehe
    // php/anfrage.php, nb_csrf_gueltig()). Vor dem eigentlichen Absenden wird
    // deshalb genau einmal, jetzt beim Klick, ein echter Token angefordert
    // (tokenHolen()), das ist die einzige zusaetzliche Netzwerkanfrage im
    // gesamten JavaScript-Pfad und passiert bewusst erst hier, nicht beim
    // Laden der Seite: kostet also nichts fuer Besucher, die das Formular nie
    // ausfuellen. form.submit() unten loest anders als requestSubmit() KEIN
    // erneutes 'submit'-Ereignis aus (Browser-Spezifikation), dieser Handler
    // laeuft also kein zweites Mal, keine Rekursionsgefahr.
    ereignis.preventDefault();
    tokenHolen(schritt3).then(function (frischerToken) {
      if (frischerToken) { setzeWert(schritt3, 'csrf', frischerToken); }
      // form.submit() sendet keinen Absende-Knopf mit, das schritt=senden
      // aus dem geklickten Knopf ginge also sonst verloren; deshalb hier
      // explizit als eigenes verstecktes Feld gesetzt.
      schrittFeldSetzen(schritt3, 'senden');
      schritt3.submit();
    });
  });

  // Fordert vor dem echten Absenden einen frischen, serverseitig signierten
  // Token fuer Ziel 'senden' an (siehe php/anfrage.php, case
  // 'token_anfordern'). Traegt den seit dem Laden der Seite unveraendert
  // mitgefuehrten echten Zeitpunkt (Feld 'zeitstempel') mit, damit der
  // Server daraus einen echten Start-Zeitpunkt in den Token einbetten kann,
  // statt die Absendezeit selbst zu verwenden (die wuerde jede Absendung wie
  // eine Sofortabsendung aussehen lassen, siehe php/anfrage.php,
  // nb_csrf_dynamisch_erzeugen()). Schlaegt die Anfrage fehl (z. B.
  // Netzwerkfehler), wird trotzdem ganz normal weiter abgesendet: der Server
  // weist eine Absendung ohne gueltigen Token dann ab und zeigt die
  // vorhandene "Bitte noch einmal von vorn"-Seite, statt das Formular haengen
  // zu lassen.
  function tokenHolen(form) {
    if (typeof fetch === 'undefined') { return Promise.resolve(''); } // sehr alter Browser: einfach mit der Marke weiter versuchen
    var daten = new URLSearchParams();
    daten.set('schritt', 'token_anfordern');
    daten.set('honigtopf', wert(form, 'honigtopf'));
    daten.set('zeitstempel', wert(form, 'zeitstempel'));
    daten.set('csrf', wert(form, 'csrf'));
    try {
      return fetch('/anfrage.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: daten.toString(),
        credentials: 'same-origin'
      }).then(function (antwort) {
        return antwort.ok ? antwort.text() : '';
      }).catch(function () {
        return '';
      });
    } catch (fehler) {
      return Promise.resolve('');
    }
  }

  function schrittFeldSetzen(form, neuerWert) {
    var feld = form.querySelector('input[type="hidden"][name="schritt"]');
    if (!feld) {
      feld = document.createElement('input');
      feld.type = 'hidden';
      feld.name = 'schritt';
      form.appendChild(feld);
    }
    feld.value = neuerWert;
  }
})();
