export function explainCuError(error, adapter) {
  const text = String(error?.message || error || '');
  if (adapter === 'poweredOff')
    return {
      code: 'bluetooth_off',
      title: 'Bluetooth ist ausgeschaltet',
      message: 'Bluetooth am Rechner einschalten. RaceHubOS versucht die Verbindung danach erneut.',
    };
  if (/permission|operation not permitted|access denied|EACCES|EPERM/i.test(text))
    return {
      code: 'permission',
      title: 'Bluetooth-Zugriff nicht erlaubt',
      message:
        'Die Bluetooth-Berechtigung der RaceHubOS-Node-Laufzeit fehlt. Das RaceHubOS-Paket erneut konfigurieren bzw. die lokale Node-Berechtigung prüfen lassen.',
    };
  if (/adapter|unsupported|unauthorized/i.test(text))
    return {
      code: 'adapter',
      title: 'Bluetooth-Adapter nicht bereit',
      message:
        'Bluetooth einschalten und prüfen, ob der USB-Bluetooth-Adapter angeschlossen ist. Die Verbindung wird erneut versucht.',
    };
  if (/service|characteristic|AppConnect|discovery|subscribe/i.test(text))
    return {
      code: 'appconnect',
      title: 'AppConnect liefert keine Datenkanäle',
      message:
        'Andere Carrera-Apps schließen. CU mit AppConnect für etwa fünf Sekunden ausschalten und wieder einschalten. RaceHubOS verbindet anschließend automatisch neu.',
    };
  if (/Statusabfragen|Request timeout|CU status timeout/i.test(text))
    return {
      code: 'data_timeout',
      title: 'CU verbunden, aber keine aktuellen Daten',
      message:
        'Die CU beantwortet die Statusabfragen nicht. RaceHubOS baut die Verbindung neu auf. Falls das nicht hilft, CU mit AppConnect etwa fünf Sekunden aus- und wieder einschalten.',
    };
  if (/waiting for peripheral|not found|scan/i.test(text))
    return {
      code: 'not_found',
      title: 'Control Unit nicht gefunden',
      message:
        'CU und AppConnect einschalten, Bluetooth-Reichweite prüfen und andere Carrera-Apps schließen. Falls die CU bereits läuft: für etwa fünf Sekunden aus- und wieder einschalten.',
    };
  return {
    code: 'connection_failed',
    title: 'CU-Verbindung fehlgeschlagen',
    message:
      'Andere Carrera-Apps schließen und kurz warten. Bleibt die Verbindung getrennt, CU mit AppConnect für etwa fünf Sekunden aus- und wieder einschalten. RaceHubOS versucht es erneut.',
  };
}
