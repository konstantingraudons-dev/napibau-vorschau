// Verhalten der Seite. Alles hier ist Zugabe: ohne JavaScript bleibt die
// Seite vollstaendig lesbar und bedienbar.
(function () {
  'use strict';

  // Dezentes Einblenden beim Scrollen. Ohne JS ist alles sofort sichtbar.
  var reduziert = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ziele = document.querySelectorAll('.einblenden');
  if (reduziert || !('IntersectionObserver' in window)) {
    ziele.forEach(function (el) { el.classList.add('sichtbar'); });
  } else {
    var beobachter = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('sichtbar'); beobachter.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    ziele.forEach(function (el) { beobachter.observe(el); });

    // Der Beobachter meldet nur, wenn ein Abschnitt die Sichtbereichsgrenze
    // WAEHREND eines gezeichneten Bilds ueberquert. Bei einem Sprung ohne
    // Zwischenbild (Ankerlink, vom Browser wiederhergestellte Scrollposition
    // nach "zurueck", ein Wisch auf dem Telefon, jeder Sprung per Skript)
    // ueberquert ein Abschnitt die Grenze nie in diesem Sinn: er stand vorher
    // unterhalb, danach oberhalb der Falz, ohne dass dazwischen etwas
    // gezeichnet wurde. Deshalb von Hand nachsehen, was JETZT im Sichtbereich
    // steht oder schon darueber liegt, und das sofort zeigen (eine Animation
    // haette bei etwas nie Unsichtbarem ohnehin nichts zu zeigen).
    var nachsehen = function () {
      ziele.forEach(function (el) {
        if (el.classList.contains('sichtbar')) { return; }
        if (el.getBoundingClientRect().top < window.innerHeight) {
          el.classList.add('sichtbar');
          beobachter.unobserve(el);
        }
      });
    };
    nachsehen();
    // load: Nachladen von Bildern kann das Layout noch verschieben, auch
    // eine per Anker angesprungene Stelle. resize/orientationchange: auf
    // schmalen Bildschirmen aendert sich dadurch, was oberhalb der Falz
    // liegt. pageshow mit persisted=true: der Browser liefert eine aus dem
    // Zurueck-Vorwaerts-Cache eingefrorene Seite unveraendert zurueck, kein
    // neuer Skriptlauf, aber oft eine andere Scrollposition als beim
    // Einfrieren.
    window.addEventListener('load', nachsehen);
    window.addEventListener('resize', nachsehen);
    window.addEventListener('orientationchange', nachsehen);
    window.addEventListener('pageshow', function (ereignis) {
      if (ereignis.persisted) { nachsehen(); }
    });
    // Scroll selbst faengt jeden Sprung ab, der keines der obigen Ereignisse
    // ausloest, zum Beispiel einen Skriptsprung lange nach dem Laden. Ein
    // rAF je Bild wie bei der Aktionsleiste unten, damit das Scrollen nicht
    // an uns haengt.
    var nachsehenLaeuft = false;
    window.addEventListener('scroll', function () {
      if (nachsehenLaeuft) { return; }
      nachsehenLaeuft = true;
      window.requestAnimationFrame(function () { nachsehenLaeuft = false; nachsehen(); });
    }, { passive: true });

    // Letztes Netz: faellt der Beobachter aus irgendeinem Grund vollstaendig
    // aus, darf der Inhalt nicht fuer immer verschwinden. Die Animation ist
    // eine Zugabe, der Text ist das Produkt.
    window.setTimeout(function () {
      ziele.forEach(function (el) { el.classList.add('sichtbar'); });
      beobachter.disconnect();
    }, 2500);
  }

  // Klappmenue im Kopf. Sichtbar wird der Knopf erst durch die Klasse "js"
  // am Dokument (siehe basis.css), es gibt ihn also nie ohne diese Zeilen.
  // Der Zustand steht ausschliesslich in aria-expanded: das CSS liest ihn
  // ueber :has(), damit Anzeige und Sprachausgabe nicht auseinanderlaufen
  // koennen.
  var burger = document.querySelector('.burger');
  if (burger) {
    var navi = burger.closest('.navi');
    var umschalten = function (offen) {
      burger.setAttribute('aria-expanded', offen ? 'true' : 'false');
    };
    burger.addEventListener('click', function () {
      umschalten(burger.getAttribute('aria-expanded') !== 'true');
    });
    // Escape schliesst, wie bei jedem aufgeklappten Bedienelement erwartet.
    // Der Fokus geht dabei zurueck auf den Knopf, sonst steht er im Nichts.
    navi.addEventListener('keydown', function (ereignis) {
      if (ereignis.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') {
        umschalten(false);
        burger.focus();
      }
    });
    // Ein Klick neben das aufgeklappte Blatt schliesst es. Ohne das bleibt
    // ein Menue, das sich ueber den Seitenanfang legt, so lange stehen, bis
    // jemand genau den Knopf wieder trifft.
    document.addEventListener('click', function (ereignis) {
      if (burger.getAttribute('aria-expanded') !== 'true') { return; }
      if (!navi.contains(ereignis.target)) { umschalten(false); }
    });

    // Wird das Fenster breit genug fuer die offene Rubrikenzeile, gilt der
    // eingeklappte Zustand nicht mehr. Bliebe aria-expanded auf "true",
    // meldete die Sprachausgabe auf dem Schreibtisch ein aufgeklapptes
    // Menue, das dort gar keinen Knopf hat.
    var breit = window.matchMedia('(min-width: 48rem)');
    var beiBreite = function () { if (breit.matches) { umschalten(false); } };
    if (breit.addEventListener) { breit.addEventListener('change', beiBreite); }
    else if (breit.addListener) { breit.addListener(beiBreite); }
  }

  // Mobile Aktionsleiste: erst ab 25 Prozent Scrolltiefe, wegklickbar.
  // Einmal ausgeblendet bleibt sie die ganze Sitzung fort, damit sie nicht
  // zur Bettelei wird.
  var leiste = document.querySelector('.aktionsleiste');
  if (leiste && sitzung('leiste-aus') === '1') {
    leiste.parentNode.removeChild(leiste);
    leiste = null;
  }
  if (leiste) {
    var laeuft = false;
    var beimScrollen = function () {
      // Ein rAF je Bild reicht: das Scrollen soll nicht an uns haengen.
      if (laeuft) { return; }
      laeuft = true;
      window.requestAnimationFrame(function () {
        laeuft = false;
        // Nach dem Ausblenden gibt es die Leiste nicht mehr. Ohne diese
        // Pruefung liefe der naechste Scrollschritt in einen Fehler.
        if (!leiste) { return; }
        var strecke = document.body.scrollHeight - window.innerHeight;
        var anteil = window.scrollY / (strecke > 0 ? strecke : 1);
        leiste.classList.toggle('aktionsleiste--sichtbar', anteil > 0.25);
      });
    };
    window.addEventListener('scroll', beimScrollen, { passive: true });
    var zu = leiste.querySelector('.aktionsleiste__zu');
    if (zu) {
      zu.addEventListener('click', function () {
        window.removeEventListener('scroll', beimScrollen);
        leiste.parentNode.removeChild(leiste);
        leiste = null;
        sitzung('leiste-aus', '1');
      });
    }
  }

  // Cookiefreie Zaehlung (siehe php/z.php und Konzept Abschnitt 6.4). Ein
  // Fehlschlag (kein sendBeacon, z.php nicht erreichbar) darf nie sichtbar
  // werden, die Zaehlung ist nie wichtiger als der Klick oder Seitenaufruf,
  // den sie begleitet.
  function zaehle(ereignis) {
    if (!navigator.sendBeacon) { return; }
    try {
      navigator.sendBeacon('/z.php?e=' + encodeURIComponent(ereignis) +
        '&s=' + encodeURIComponent(location.pathname));
    } catch (fehler) { /* siehe Kommentar oben */ }
  }

  // Ein Seitenaufruf je Ladevorgang.
  zaehle('seitenaufruf');

  // Klicks auf Telefon- und WhatsApp-Links.
  document.querySelectorAll('[data-zaehle]').forEach(function (el) {
    el.addEventListener('click', function () { zaehle(el.dataset.zaehle); });
  });

  // sessionStorage wirft in manchen Datenschutzeinstellungen beim blossen
  // Zugriff. Lesen und Schreiben deshalb nur ueber diesen Umweg.
  function sitzung(schluessel, wert) {
    try {
      if (arguments.length > 1) { window.sessionStorage.setItem(schluessel, wert); return wert; }
      return window.sessionStorage.getItem(schluessel);
    } catch (fehler) { return null; }
  }
})();
