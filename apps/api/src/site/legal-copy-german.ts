import { LegalDocument } from './legal-links';
import type { LegalText } from './legal-copy';

export const GERMAN_LEGAL_COPY: Record<LegalDocument, LegalText> = {
  [LegalDocument.Terms]: {
    title: 'Nutzungsbedingungen',
    description: 'Die Regeln für die Nutzung von zapbip, dem WhatsApp-Kanal für deine KI-Agenten, entwickelt von Logic Bit in Brasilien.',
    summary:
      'Diese Bedingungen sind die Vereinbarung zwischen dir und {tradeName} über die Nutzung von zapbip. Mit dem Beitritt zur Warteliste oder einer Nachricht an zapbip auf WhatsApp akzeptierst du sie.',
    updated: 'Zuletzt aktualisiert: {updatedOn}',
    sections: [
      {
        heading: 'Wer wir sind',
        paragraphs: [
          'zapbip ist ein Dienst von {tradeName}, dem Handelsnamen von {legalName}, CNPJ {cnpj}, {address}. Kontakt: {contactEmail}.',
        ],
        items: [],
      },
      {
        heading: 'Was zapbip macht',
        paragraphs: [
          'zapbip verbindet die KI-Agenten deiner Wahl, etwa {agents} oder jeden MCP-Client, über die offizielle WhatsApp Business Platform von Meta mit deinem eigenen WhatsApp. Deine Agenten können dir Nachrichten senden, dir Fragen stellen und deine Antworten empfangen. zapbip spricht nur mit dir und schreibt niemals deinen Kontakten oder anderen Personen.',
          'zapbip befindet sich im frühen Zugang. Konten werden auf Einladung aus der Warteliste geöffnet, und Funktionen können sich unterwegs ändern.',
        ],
        items: [],
      },
      {
        heading: 'Dein Konto',
        paragraphs: [],
        items: [
          'Dein Konto ist deine WhatsApp-Nummer. Du meldest dich an, indem du zapbip schreibst; es gibt kein Passwort.',
          'Nachrichten erreichen dich von einer zapbip-Nummer. Die eigene Nummer als Absender zu verbinden, ist noch nicht möglich.',
          'Du musst mindestens 18 Jahre alt und geschäftsfähig sein.',
          'Halte den Schlüssel jedes Agenten geheim. Wer einen Schlüssel besitzt, kann dir als dieser Agent schreiben; widerrufe ihn deshalb sofort, wenn er bekannt wird.',
          'Du bist für alles verantwortlich, was über dein Konto und deine Agenten geschieht.',
        ],
      },
      {
        heading: 'Deine Agenten',
        paragraphs: [
          'Deine Agenten sind Software, die du auswählst und betreibst. zapbip liefert ihre Nachrichten und deine Antworten aus, schreibt, prüft oder kontrolliert aber nicht, was sie sagen oder tun. Was du aufgrund einer Agentennachricht entscheidest, etwa mit dem Tipp auf einen Button, ist deine Entscheidung. Die KI-Anbieter hinter deinen Agenten haben eigene Bedingungen.',
        ],
        items: [],
      },
      {
        heading: 'Zulässige Nutzung',
        paragraphs: [
          'Wir können ein Konto sperren oder schließen, das gegen diese Regeln verstößt, und rechtswidriges Verhalten den Behörden melden.',
        ],
        items: [
          'Nutze zapbip nur, um mit deinen eigenen Agenten zu sprechen.',
          'Sende keinen Spam, keine rechtswidrigen Inhalte und keine Inhalte, die gegen die WhatsApp-Business-Richtlinien von Meta verstoßen.',
          'Versuche nicht, über zapbip andere Personen zu erreichen, seine Grenzen zu umgehen oder in den Dienst oder in andere Konten einzudringen.',
          'Verkaufe zapbip nicht weiter und überlaste es nicht.',
        ],
      },
      {
        heading: 'Tarife und Preise',
        paragraphs: [
          'Der kostenlose Tarif enthält {free} Nachrichten, um zapbip kostenlos auszuprobieren. Die kostenpflichtigen Tarife und Preise auf der Website gelten erst, wenn die Abrechnung öffnet, und du siehst und akzeptierst einen Preis, bevor du etwas bezahlst. Über jede Preisänderung, die dich betrifft, informieren wir dich im Voraus.',
        ],
        items: [],
      },
      {
        heading: 'Verfügbarkeit',
        paragraphs: [
          'Wir bemühen uns, zapbip am Laufen zu halten, stellen es aber so bereit, wie es ist, ohne Garantie dafür, dass es immer verfügbar ist oder jede Nachricht zugestellt wird. Es hängt von Meta, von Cloudflare und vom Internet ab. Nutze zapbip nicht für Notfälle oder für Dinge, bei denen eine verspätete oder verlorene Nachricht Schaden anrichten könnte.',
        ],
        items: [],
      },
      {
        heading: 'Haftung',
        paragraphs: [
          'Soweit das brasilianische Recht es erlaubt, haftet {tradeName} nicht für mittelbare Schäden, entgangenen Gewinn oder Verluste, die durch deine Agenten, durch Dienste Dritter oder durch verspätete oder nicht zugestellte Nachrichten entstehen. Nichts in diesen Bedingungen schränkt deine Rechte nach dem brasilianischen Verbraucherschutzgesetz (Gesetz 8.078/1990) oder nach einem anderen Gesetz ein, auf das nicht verzichtet werden kann.',
        ],
        items: [],
      },
      {
        heading: 'Beendigung deines Kontos',
        paragraphs: [
          'Du kannst dein Konto jederzeit löschen, indem du „konto löschen“ auf WhatsApp an zapbip sendest. Wir können ein Konto schließen, das gegen diese Bedingungen verstößt, oder den Dienst mit Vorankündigung einstellen. Die Datenschutzerklärung erklärt, was mit deinen Daten geschieht.',
        ],
        items: [],
      },
      {
        heading: 'Änderungen dieser Bedingungen',
        paragraphs: [
          'Wir können diese Bedingungen aktualisieren; das Datum oben zeigt die aktuelle Fassung. Wir informieren dich auf WhatsApp oder auf dieser Website, bevor eine wesentliche Änderung in Kraft tritt. Wenn du zapbip danach weiter nutzt, akzeptierst du die neuen Bedingungen.',
        ],
        items: [],
      },
      {
        heading: 'Recht und Gerichte',
        paragraphs: [
          'Diese Bedingungen unterliegen brasilianischem Recht. Streitigkeiten gehören vor die Gerichte in Belo Horizonte, Minas Gerais, es sei denn, das Gesetz erlaubt dir als Verbraucher, die Gerichte an deinem Wohnort anzurufen. Diese Bedingungen sind auf Portugiesisch verfasst und ins Deutsche übersetzt; weichen beide Fassungen voneinander ab, gilt die portugiesische Fassung.',
        ],
        items: [],
      },
      { heading: 'Kontakt', paragraphs: ['Fragen zu diesen Bedingungen: {contactEmail}.'], items: [] },
    ],
  },
  [LegalDocument.Privacy]: {
    title: 'Datenschutzerklärung',
    description: 'Was zapbip erhebt, warum, wie lange, und deine Rechte nach dem brasilianischen Datenschutzgesetz (LGPD).',
    summary:
      'zapbip speichert nur, was nötig ist, um Nachrichten zwischen dir und deinen Agenten zuzustellen, und löscht jede Information nach einer festen Frist. Diese Erklärung folgt dem brasilianischen Allgemeinen Datenschutzgesetz (Gesetz 13.709/2018, LGPD).',
    updated: 'Zuletzt aktualisiert: {updatedOn}',
    sections: [
      {
        heading: 'Wer verantwortlich ist',
        paragraphs: [
          '{tradeName} ({legalName}, CNPJ {cnpj}, {address}) ist Verantwortlicher für deine personenbezogenen Daten. Unseren Datenschutzbeauftragten erreichst du unter {contactEmail}.',
        ],
        items: [],
      },
      {
        heading: 'Was wir erheben',
        paragraphs: [],
        items: [
          'Warteliste: deine E-Mail-Adresse, die Sprache der Seite und Einladungsdaten (wer dich eingeladen hat und wie viele Personen du eingeladen hast). Dabei wird keine IP-Adresse gespeichert.',
          'Konto: deine WhatsApp-Nummer, deine Sprache und das Datum deines Beitritts.',
          'Agenten: der Name jedes Agenten, den du verbindest, die App, in der er läuft, wenn die App es uns mitteilt, wann er erstellt wurde und wann er zuletzt aktiv war. Der Schlüssel jedes Agenten wird nur als Prüfsumme gespeichert.',
          'Nachrichten: die Texte, Fragen, Buttons und Antworten zwischen dir und deinen Agenten sowie die Fotos und Dateien, die ihr austauscht.',
          'Web-App: ein Sitzungs-Cookie, wenn du dich auf app.zapbip.com anmeldest.',
          'Technische Daten: Wenn du die Website oder den Dienst nutzt, verarbeitet Cloudflare, unser Hosting-Anbieter, Anfragedaten wie deine IP-Adresse, um ihn auszuliefern und zu schützen.',
        ],
      },
      {
        heading: 'Wofür wir sie nutzen',
        paragraphs: [
          'Wir verkaufen deine Daten nicht, zeigen keine Werbung und verwenden deine Nachrichten nicht, um KI-Modelle zu trainieren.',
        ],
        items: [
          'Um den von dir gewünschten Dienst bereitzustellen: Nachrichten zwischen dir und deinen Agenten zuzustellen und dein Konto zu betreiben (LGPD, Artikel 7, V).',
          'Um die Warteliste zu verwalten und deine Einladung zu senden, mit der Einwilligung, die du beim Beitritt erteilst (Artikel 7, I).',
          'Um zapbip sicher zu halten und Missbrauch zu verhindern, etwa mit dem Captcha im Wartelistenformular und Ratenbegrenzungen (berechtigtes Interesse, Artikel 7, IX).',
          'Um gesetzliche Pflichten zu erfüllen (Artikel 7, II).',
        ],
      },
      {
        heading: 'Wie lange wir sie speichern',
        paragraphs: ['Protokolle enthalten nie den Text deiner Nachrichten.'],
        items: [
          'Nachrichten und Fragen, die auf dich oder einen Agenten warten: {messageDays} Tage.',
          'Fotos und Dateien: {mediaDays} Tage.',
          'Sitzung der Web-App: bis zu {sessionDays} Tage oder bis du dich abmeldest.',
          'Konto und Agenten: bis du dein Konto löschst.',
          'Warteliste: bis du Zugang erhältst oder uns bittest, dich zu entfernen.',
        ],
      },
      {
        heading: 'Mit wem wir sie teilen',
        paragraphs: [
          'Wir teilen Daten nur mit den Anbietern, die zapbip betreiben. Deine Agenten erhalten die Nachrichten, die du ihnen sendest; sie laufen unter deiner Kontrolle und nach den Bedingungen ihrer eigenen Anbieter. Wir können Daten auch offenlegen, wenn das Gesetz oder ein Gericht es verlangt.',
        ],
        items: [
          'Meta Platforms über die offizielle WhatsApp Business Platform, die jede WhatsApp-Nachricht übermittelt.',
          'Cloudflare, das den Dienst und seinen Speicher hostet und das Captcha (Turnstile) im Wartelistenformular betreibt.',
          'Mintlify, das die Dokumentation unter docs.zapbip.com hostet.',
        ],
      },
      {
        heading: 'Internationale Übermittlung',
        paragraphs: [
          'Meta und Cloudflare verarbeiten Daten auf Servern außerhalb Brasiliens, auch in den Vereinigten Staaten. Diese Übermittlungen sind für die Bereitstellung des Dienstes nötig und folgen den Schutzvorkehrungen der LGPD (Artikel 33).',
        ],
        items: [],
      },
      {
        heading: 'Cookies',
        paragraphs: [
          'Die Website setzt nur zwei eigene Cookies, um sich deine Sprache und dein Design zu merken, und die Web-App setzt ein Sitzungs-Cookie, wenn du dich anmeldest. Es gibt keine Werbe- oder Tracking-Cookies.',
        ],
        items: [],
      },
      {
        heading: 'Deine Rechte',
        paragraphs: [
          'Um dein Konto und alles darin zu löschen, sende „konto löschen“ auf WhatsApp an zapbip. Für alles andere schreib an {contactEmail}; wir antworten innerhalb von 15 Tagen.',
        ],
        items: [
          'Bestätigung verlangen, ob wir deine Daten verarbeiten, und Zugang zu ihnen erhalten.',
          'Unvollständige oder falsche Daten berichtigen lassen.',
          'Die Anonymisierung, Sperrung oder Löschung nicht erforderlicher Daten verlangen.',
          'Verlangen, dass deine Daten an einen anderen Anbieter übertragen werden.',
          'Erfahren, mit wem wir sie teilen.',
          'Deine Einwilligung jederzeit widerrufen.',
          'Beschwerde bei der brasilianischen Nationalen Datenschutzbehörde (ANPD) einlegen.',
        ],
      },
      {
        heading: 'Was Meta und Cloudflare speichern',
        paragraphs: [
          'Wenn du dein Konto löschst, behält Meta den WhatsApp-Chat auf seiner Seite und Cloudflare behält Sicherungskopien, jeweils für die eigene Aufbewahrungsfrist. Lösche den Chat in WhatsApp, um ihn von deinem Handy zu entfernen.',
        ],
        items: [],
      },
      {
        heading: 'Sicherheit',
        paragraphs: [
          'Jede Verbindung nutzt HTTPS. Agentenschlüssel und Sitzungen der Web-App werden nur als Prüfsummen gespeichert, und jeder Agent hat seinen eigenen Schlüssel, den du jederzeit widerrufen kannst.',
        ],
        items: [],
      },
      {
        heading: 'Kinder',
        paragraphs: ['zapbip richtet sich nicht an Personen unter 18 Jahren, und wir erheben wissentlich keine Daten von ihnen.'],
        items: [],
      },
      {
        heading: 'Änderungen dieser Erklärung',
        paragraphs: [
          'Wir können diese Erklärung aktualisieren; das Datum oben zeigt die aktuelle Fassung, und wir informieren dich, bevor eine wesentliche Änderung in Kraft tritt. Diese Erklärung ist auf Portugiesisch verfasst und ins Deutsche übersetzt; weichen beide Fassungen voneinander ab, gilt die portugiesische Fassung.',
        ],
        items: [],
      },
    ],
  },
};
