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
    return; // Vorschau: keine Zaehlung
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

  // Hinweisleiste beim ersten Besuch der Sitzung. Kein Zustimmungsdialog:
  // die Seite setzt keine Cookies und laedt nichts von fremden Servern, es
  // gibt also nichts zu bestaetigen, und genau das sagt die Leiste. Sie
  // entsteht nur hier per Skript, damit sie ohne JavaScript niemandem im
  // Weg steht, und merkt sich das Wegklicken je Sitzung. Wirft
  // sessionStorage (sitzung() faengt das ab), erscheint sie schlimmstenfalls
  // je Seite erneut; auch dann bleibt sie ein Griff.
  if (!sitzung('hinweis_gesehen')) {
    var leiste = document.createElement('aside');
    leiste.className = 'hinweisleiste';
    leiste.setAttribute('aria-label', 'Hinweis zum Datenschutz');
    leiste.innerHTML =
      '<p>Diese Website kommt ohne Cookies und ohne Tracking aus. ' +
      'Es gibt deshalb nichts zu bestätigen. Details in der ' +
      '<a href="/datenschutz/">Datenschutzerklärung</a>.</p>' +
      '<button class="knopf knopf--signal knopf--klein" type="button">Alles klar</button>';
    leiste.querySelector('button').addEventListener('click', function () {
      sitzung('hinweis_gesehen', '1');
      leiste.remove();
    });
    document.body.appendChild(leiste);
  }

  // Kartenstapel im Hero der Startseite. Die oberste Karte zeigt sich, zieht
  // nach links ab und legt sich hinten wieder an; Klick oder der Knopf
  // schalten sofort weiter. Der Zeiger auf dem Stapel haelt den Lauf an,
  // eine verdeckte Registerkarte auch. Lage und Uebergaenge stehen im CSS
  // (karte--p0 bis karte--p3, karte--abgang), hier laeuft nur die Uhr und
  // die Vergabe der Klassen. Bei reduzierter Bewegung laeuft nichts von
  // selbst, der Knopf schaltet dann ohne Uebergang um (CSS nimmt die
  // Transitionen heraus).
  var stapel = document.querySelector('[data-kartenstapel]');
  if (stapel) {
    var karten = Array.prototype.slice.call(stapel.querySelectorAll('.karte'));
    var punkteHalter = document.querySelector('[data-kartenpunkte]');
    var weiter = document.querySelector('[data-kartenweiter]');
    var kopf = 0;
    var beschaeftigt = false;
    var TAKT = 4200;

    var punkte = karten.map(function () {
      var p = document.createElement('span');
      if (punkteHalter) { punkteHalter.appendChild(p); }
      return p;
    });

    var legen = function () {
      karten.forEach(function (karte, i) {
        var lage = (i - kopf + karten.length) % karten.length;
        karte.classList.remove('karte--p0', 'karte--p1', 'karte--p2', 'karte--p3', 'karte--abgang');
        karte.classList.add('karte--p' + Math.min(lage, 3));
        karte.style.zIndex = String(karten.length - lage);
      });
      punkte.forEach(function (p, i) {
        if (i === kopf) { p.setAttribute('data-an', ''); } else { p.removeAttribute('data-an'); }
      });
    };

    var schalten = function () {
      if (beschaeftigt || karten.length < 2) { return; }
      beschaeftigt = true;
      var scheidende = karten[kopf];
      scheidende.classList.add('karte--abgang');
      // Der Abgang liegt ueber allem, die Nachruecker duerfen schon liegen.
      scheidende.style.zIndex = String(karten.length + 1);
      kopf = (kopf + 1) % karten.length;
      karten.forEach(function (karte, i) {
        if (karte === scheidende) { return; }
        var lage = (i - kopf + karten.length) % karten.length;
        karte.classList.remove('karte--p0', 'karte--p1', 'karte--p2', 'karte--p3');
        karte.classList.add('karte--p' + Math.min(lage, 3));
        karte.style.zIndex = String(karten.length - lage);
      });
      window.setTimeout(function () { legen(); beschaeftigt = false; }, 660);
    };

    // Eine Karte zurueckholen: sie startet dort, wo der Abgang endet, und
    // faehrt von links wieder auf den Stapel. Der Zwischenzustand wird ohne
    // Uebergang gesetzt (transition none plus erzwungenes Layout), erst der
    // Weg zurueck animiert.
    var zurueckholen = function () {
      if (beschaeftigt || karten.length < 2) { return; }
      beschaeftigt = true;
      kopf = (kopf - 1 + karten.length) % karten.length;
      var kommende = karten[kopf];
      kommende.classList.remove('karte--p0', 'karte--p1', 'karte--p2', 'karte--p3');
      kommende.style.transition = 'none';
      kommende.classList.add('karte--abgang');
      kommende.style.zIndex = String(karten.length + 1);
      void kommende.offsetWidth;
      kommende.style.transition = '';
      kommende.classList.remove('karte--abgang');
      kommende.classList.add('karte--p0');
      karten.forEach(function (karte, i) {
        if (karte === kommende) { return; }
        var lage = (i - kopf + karten.length) % karten.length;
        karte.classList.remove('karte--p0', 'karte--p1', 'karte--p2', 'karte--p3');
        karte.classList.add('karte--p' + Math.min(lage, 3));
        karte.style.zIndex = String(karten.length - lage);
      });
      window.setTimeout(function () { legen(); beschaeftigt = false; }, 660);
    };

    legen();

    // Automatisch blaettern, auch bei reduzierter Bewegung: dann nimmt das
    // CSS die Uebergaenge heraus und der Wechsel ist ein harter Schnitt
    // statt einer Fahrt. Der Zeiger auf dem Stapel und eine verdeckte
    // Registerkarte halten die Uhr an.
    window.setInterval(function () {
      if (document.hidden || stapel.matches(':hover')) { return; }
      schalten();
    }, TAKT);

    // Wischen: die oberste Karte folgt dem Finger, senkrechtes Wischen
    // bleibt beim Scrollen (touch-action: pan-y im CSS). Nach links heisst
    // weiter, nach rechts heisst zurueck. Ein erkannter Zug unterdrueckt
    // den Klick, der auf pointerup folgt.
    var zug = null;
    var gewischt = false;
    stapel.addEventListener('pointerdown', function (e) {
      if (karten.length < 2 || beschaeftigt) { return; }
      zug = { x: e.clientX, y: e.clientY, id: e.pointerId, dx: 0, aktiv: false };
    });
    stapel.addEventListener('pointermove', function (e) {
      if (!zug || e.pointerId !== zug.id) { return; }
      var dx = e.clientX - zug.x;
      var dy = e.clientY - zug.y;
      if (!zug.aktiv) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
          zug.aktiv = true;
          try { stapel.setPointerCapture(e.pointerId); } catch (fehler) { /* egal */ }
        } else if (Math.abs(dy) > 12) { zug = null; return; } else { return; }
      }
      zug.dx = dx;
      var oberste = karten[kopf];
      oberste.style.transition = 'none';
      oberste.style.transform = 'translate(' + dx + 'px, -0.5rem) rotate(' + (dx / 40 - 1.4) + 'deg)';
    });
    var zugEnde = function (e) {
      if (!zug || e.pointerId !== zug.id) { return; }
      var oberste = karten[kopf];
      var dx = zug.dx;
      var aktiv = zug.aktiv;
      zug = null;
      if (!aktiv) { return; }
      gewischt = true;
      oberste.style.transition = '';
      oberste.style.transform = '';
      if (dx < -60) { schalten(); }
      else if (dx > 60) { zurueckholen(); }
    };
    stapel.addEventListener('pointerup', zugEnde);
    stapel.addEventListener('pointercancel', zugEnde);
    stapel.addEventListener('click', function () {
      if (gewischt) { gewischt = false; return; }
      schalten();
    });
    if (weiter) { weiter.addEventListener('click', schalten); }
  }

  // Die Belegzahlen im Hero zaehlen beim ersten Sichtbarwerden hoch. Ohne
  // JavaScript und bei reduzierter Bewegung steht die fertige Zahl im HTML,
  // hier wird sie nur einmalig von null an aufgebaut. Kleine Zahlen, kurze
  // Strecke: 700 Millisekunden, danach steht exakt der Ausgangswert.
  var zaehlwerke = document.querySelectorAll('.kennzeile--statement dd');
  if (zaehlwerke.length && !reduziert && 'IntersectionObserver' in window) {
    var zaehlBeobachter = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (e) {
        if (!e.isIntersecting) { return; }
        zaehlBeobachter.unobserve(e.target);
        var ziel = parseInt(e.target.textContent, 10);
        if (!ziel || ziel < 0) { return; }
        var start = null;
        var schritt = function (jetzt) {
          if (start === null) { start = jetzt; }
          var anteil = Math.min((jetzt - start) / 700, 1);
          e.target.textContent = String(Math.round(ziel * (1 - Math.pow(1 - anteil, 3))));
          if (anteil < 1) { window.requestAnimationFrame(schritt); }
        };
        window.requestAnimationFrame(schritt);
      });
    }, { threshold: .6 });
    zaehlwerke.forEach(function (dd) { zaehlBeobachter.observe(dd); });
  }
})();
