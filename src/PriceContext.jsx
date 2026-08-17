import { createContext, useContext, useEffect, useRef, useState } from 'react';

const PriceContext = createContext(null);

const ALV = 1.255;
const STORAGE_KEY = 'nordpool-price-alert';

const loadSettings = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        return {
            enabled: saved?.enabled ?? false,
            threshold: typeof saved?.threshold === 'number' ? saved.threshold : 10,
            tomorrowEnabled: saved?.tomorrowEnabled ?? false,
            tomorrowThreshold: typeof saved?.tomorrowThreshold === 'number' ? saved.tomorrowThreshold : 10,
        };
    } catch {
        return { enabled: false, threshold: 10, tomorrowEnabled: false, tomorrowThreshold: 10 };
    }
};

const slotKey = (date) =>
    `${String(date.getHours()).padStart(2, '0')}:${String(Math.floor(date.getMinutes() / 15) * 15).padStart(2, '0')}`;

// ── Hintojen haku API:sta ────────────────────────────────────────────────
// aikaraja-parametri kertoo API:lle minkä päivän hinnat halutaan, joten
// samaa funktiota voi käyttää sekä tämän päivän että huomisen hakuun.

const toPvm = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const buildPricesUrl = (date) => {
    const isLocal = window.location.hostname === 'localhost';
    const proxyPath = isLocal ? '/api' : '/api-proxy';
    return `${proxyPath}/api/vartti/v1/halpa?vartit=96&tulos=sarja&aikaraja=${toPvm(date)}`;
};

const requestDayPrices = async (date) => {
    const response = await fetch(buildPricesUrl(date));
    if (!response.ok) throw new Error(`Virhe: ${response.status}`);
    const data = await response.json();
    if (!data || data.length === 0) throw new Error('Tyhjä vastaus');

    return data
        .map(item => ({
            time: item.aikaleima_suomi.includes('T')
                ? item.aikaleima_suomi.split('T')[1].substring(0, 5)
                : item.aikaleima_suomi.split(' ')[1].substring(0, 5),
            price: parseFloat(item.hinta) * ALV,
        }))
        .sort((a, b) => a.time.localeCompare(b.time));
};

// ── Kalenterihälytysten laskenta ja tallennus ──────────────────────────────
// Käytetään sekä tämän päivän "tästä eteenpäin" -tallennukseen että
// huomisen koko päivän ennakkotallennukseen.

// Etsii raja-arvon ylitys-/alituskohdat vartti-listasta. initialWasOver
// kertoo oliko hinta yli rajan juuri ennen listan ensimmäistä varttia.
const computeThresholdEvents = (priceSlots, threshold, initialWasOver = false) => {
    const events = [];
    let wasOver = initialWasOver;

    for (const slot of priceSlots) {
        const isOver = slot.price > threshold;
        if (isOver && !wasOver) {
            events.push({
                time: slot.time,
                summary: `⚡ Sähkö ${slot.price.toFixed(2)} c/kWh – yli rajan`,
                description: `Hinta ylittää rajan ${threshold.toFixed(1)} c/kWh kello ${slot.time}. Harkitse sähkönsyöppöjen laitteiden sammuttamista.`,
            });
        } else if (!isOver && wasOver) {
            events.push({
                time: slot.time,
                summary: `✅ Sähkö taas alle rajan: ${slot.price.toFixed(2)} c/kWh`,
                description: `Hinta laskee alle rajan ${threshold.toFixed(1)} c/kWh kello ${slot.time}. Voit kytkeä laitteet takaisin päälle.`,
            });
        }
        wasOver = isOver;
    }

    return events;
};

// Luo kalenteritapahtumat annetulle päivälle (dayOffset: 0 = tänään, 1 = huomenna).
const postEventsToCalendar = async (token, events, dayOffset) => {
    let count = 0;
    for (const ev of events) {
        try {
            const [h, m] = ev.time.split(':').map(Number);
            const start = new Date();
            start.setDate(start.getDate() + dayOffset);
            start.setHours(h, m, 0, 0);
            const end = new Date(start.getTime() + 5 * 60_000);

            const body = {
                summary: ev.summary,
                description: ev.description,
                start: { dateTime: start.toISOString() },
                end: { dateTime: end.toISOString() },
                reminders: {
                    useDefault: false,
                    overrides: [{ method: 'popup', minutes: 0 }],
                },
            };

            const res = await fetch(
                'https://www.googleapis.com/calendar/v3/calendars/primary/events',
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body),
                }
            );
            if (res.ok) count++;
            else console.error('Kalenteritapahtuma epäonnistui:', await res.text());
        } catch (e) {
            console.error('Kalenteritapahtuma epäonnistui:', e);
        }
    }
    return count;
};

// Luo Google Calendar -tapahtuman Bearer-tokenilla.
// Tapahtuma alkaa nyt, kesto 15 min. Popup-muistutus 0 min päässä = heti.
const postCalendarEvent = async (token, summary, description) => {
    const now = new Date();
    const end = new Date(now.getTime() + 15 * 60_000);
    const fmt = (d) => d.toISOString();

    const body = {
        summary,
        description,
        start: { dateTime: fmt(now) },
        end: { dateTime: fmt(end) },
        reminders: {
            useDefault: false,
            overrides: [{ method: 'popup', minutes: 0 }],
        },
    };

    const res = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        }
    );

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Calendar API ${res.status}: ${text}`);
    }
    return res.json();
};

export const PriceProvider = ({ children }) => {
    const [prices, setPrices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    const initial = loadSettings();
    const [alertEnabled, setAlertEnabled] = useState(initial.enabled);
    const [alertThreshold, setAlertThreshold] = useState(initial.threshold);
    // Käytetään refiä, jotta alert-effect näkee aina tuoreimman arvon
    const alertThresholdRef = useRef(initial.threshold);

    // Huomisen ennakkohälytys (raja + kytkin) - erillinen tämän päivän
    // live-hälytyksestä, mutta jakaa saman Google-kirjautumisen.
    const [tomorrowAlertEnabled, setTomorrowAlertEnabled] = useState(initial.tomorrowEnabled);
    const [tomorrowAlertThreshold, setTomorrowAlertThreshold] = useState(initial.tomorrowThreshold);

    // Google-kirjautumistila
    const [googleAuthed, setGoogleAuthed] = useState(false);
    const [googleError, setGoogleError] = useState(null);
    const googleTokenRef = useRef(null);   // { token, expiry }
    const tokenClientRef = useRef(null);
    // Funktio joka ajetaan kun kirjautuminen onnistuu (kertoo kumpi kytkin
    // - tämän päivän vai huomisen - pyysi kirjautumisen)
    const pendingEnableRef = useRef(null);

    const lastFetchedDateRef = useRef(new Date().getDate());
    // true kun olemme jo ilmoittaneet hinnan olevan yli rajan; false kun alle
    const wasOverRef = useRef(false);

    // Onko meillä ylipäätään jotain näytettävää dataa (ref, jotta interval-
    // tikissä ei jäädä kiinni vanhaan closure-arvoon)
    const hasDataRef = useRef(false);
    useEffect(() => { hasDataRef.current = prices.length > 0; }, [prices]);

    // ── Huomisen hintojen ennakkohaku ──────────────────────────────────────
    // Nord Pool julkaisee seuraavan päivän hinnat yleensä n. klo 13-14.
    // Kun ne on kerran haettu, pidetään ne valmiina muistissa, jotta
    // vuorokauden vaihtuessa live-näkymä voidaan päivittää HETI, sen sijaan
    // että odotettaisiin uutta API-kutsua täsmälleen keskiyöllä.
    const [tomorrowPrices, setTomorrowPrices] = useState([]);
    const [tomorrowLoading, setTomorrowLoading] = useState(true);
    const [tomorrowError, setTomorrowError] = useState(null);
    const tomorrowPricesRef = useRef([]);
    const isFetchingTodayRef = useRef(false);
    const isFetchingTomorrowRef = useRef(false);
    const lastTodayAttemptRef = useRef(0);
    const lastTomorrowAttemptRef = useRef(0);
    // true kun 'prices' sisältää vasta alustavasti (huomisen ennakkodatasta)
    // vaihdetun päivän hinnat, joita ei ole vielä varmistettu API:sta
    const provisionalRef = useRef(false);

    // Synkronoi ref ja localStorage kun threshold muuttuu
    useEffect(() => {
        alertThresholdRef.current = alertThreshold;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            enabled: alertEnabled,
            threshold: alertThreshold,
            tomorrowEnabled: tomorrowAlertEnabled,
            tomorrowThreshold: tomorrowAlertThreshold,
        }));
    }, [alertEnabled, alertThreshold, tomorrowAlertEnabled, tomorrowAlertThreshold]);

    // ── Hintojen haku ────────────────────────────────────────────────────────

    const fetchPrices = async (isInitial = false) => {
        if (isFetchingTodayRef.current) return;
        isFetchingTodayRef.current = true;
        lastTodayAttemptRef.current = Date.now();
        if (isInitial) setLoading(true);

        const d = new Date();
        try {
            const formattedData = await requestDayPrices(d);
            setPrices(formattedData);
            setError(null);
            provisionalRef.current = false;
            lastFetchedDateRef.current = d.getDate();
        } catch (err) {
            console.error('Hakuvirhe:', err);
            // Jos meillä on jo (vaikka vain alustavaa) dataa näytettävänä,
            // ei näytetä virheruutua koko näkymän päälle - yritetään
            // taustalla uudelleen, kunnes haku onnistuu.
            if (!hasDataRef.current) setError('Hintoja ei saatu ladattua.');
            lastFetchedDateRef.current = null;
        } finally {
            setLoading(false);
            isFetchingTodayRef.current = false;
        }
    };

    const fetchTomorrow = async (isInitial = false) => {
        if (isFetchingTomorrowRef.current) return;
        isFetchingTomorrowRef.current = true;
        lastTomorrowAttemptRef.current = Date.now();
        if (isInitial) setTomorrowLoading(true);

        const d = new Date();
        d.setDate(d.getDate() + 1);
        try {
            const formattedData = await requestDayPrices(d);
            tomorrowPricesRef.current = formattedData;
            setTomorrowPrices(formattedData);
            setTomorrowError(null);
        } catch {
            // Huomisen hintoja ei ole vielä julkaistu - ei virhe, yritetään
            // myöhemmin uudelleen (ks. checkRollover).
            tomorrowPricesRef.current = [];
            setTomorrowPrices([]);
        } finally {
            setTomorrowLoading(false);
            isFetchingTomorrowRef.current = false;
        }
    };

    useEffect(() => { fetchPrices(true); }, []);
    useEffect(() => { fetchTomorrow(true); }, []);

    // Vuorokauden vaihtumisen tarkistus + huomisen hintojen ennakkohaku.
    // Kutsutaan sekä sekuntikellosta että kun välilehti palaa näkyviin,
    // koska taustalla oleva välilehti voi viivästyttää/harventaa
    // setInterval-kutsuja niin, ettei "sekunti == 0" ehto koskaan osu kohdalleen.
    const checkRollover = () => {
        const now = new Date();
        setCurrentTime(now);
        const nowMs = now.getTime();

        if (now.getDate() !== lastFetchedDateRef.current) {
            // 1) Näytetään heti valmiiksi haetut huomisen hinnat "tämän
            //    päivän" hintoina - ei tarvitse odottaa uutta API-kutsua.
            if (!provisionalRef.current && tomorrowPricesRef.current.length > 0) {
                provisionalRef.current = true;
                setPrices(tomorrowPricesRef.current);
                setError(null);
                tomorrowPricesRef.current = [];
                setTomorrowPrices([]);
                setTomorrowLoading(true);
                // Eiliset huomis-ennakkohälytykset koskivat juuri vaihtunutta
                // päivää - nollataan tila uutta (vielä julkaisematonta) huomista varten.
                setTomorrowSavedCount(null);
            }

            // 2) Varmistetaan data taustalla oikealta API:lta (korjaa
            //    mahdolliset poikkeamat), korkeintaan n. 15s välein ettei
            //    hakata API:a turhaan jos se on juuri nyt pois pelistä.
            if (!isFetchingTodayRef.current && nowMs - lastTodayAttemptRef.current > 15_000) {
                fetchPrices(false).then(() => {
                    if (lastFetchedDateRef.current === new Date().getDate()) fetchTomorrow();
                });
            }
        }

        // Huomisen hintojen ennakkohaku/uudelleenyritys (julkaistaan
        // yleensä n. klo 13-14, joten aamulla ensimmäinen yritys epäonnistuu).
        if (
            tomorrowPricesRef.current.length === 0 &&
            !isFetchingTomorrowRef.current &&
            nowMs - lastTomorrowAttemptRef.current > 10 * 60_000
        ) {
            fetchTomorrow();
        }
    };

    useEffect(() => {
        const interval = setInterval(checkRollover, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const onVisibility = () => {
            if (document.visibilityState === 'visible') checkRollover();
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, []);

    // ── Google Identity Services ─────────────────────────────────────────────

    const initTokenClient = () => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!clientId) {
            setGoogleError('VITE_GOOGLE_CLIENT_ID puuttuu .env-tiedostosta.');
            return null;
        }
        if (!window.google?.accounts?.oauth2) {
            setGoogleError('Google-kirjautumiskirjasto ei latautunut vielä. Yritä hetken kuluttua.');
            return null;
        }

        const client = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/calendar.events',
            callback: (response) => {
                if (response.error) {
                    setGoogleError(`Kirjautuminen epäonnistui: ${response.error}`);
                    pendingEnableRef.current = null;
                    return;
                }
                googleTokenRef.current = {
                    token: response.access_token,
                    expiry: Date.now() + (Number(response.expires_in) - 60) * 1000,
                };
                setGoogleError(null);
                setGoogleAuthed(true);
                pendingEnableRef.current?.();
                pendingEnableRef.current = null;
            },
            error_callback: (err) => {
                setGoogleError(`Kirjautuminen peruutettu: ${err.type}`);
                pendingEnableRef.current = null;
            },
        });
        tokenClientRef.current = client;
        return client;
    };

    const getValidToken = () => {
        const data = googleTokenRef.current;
        if (data && Date.now() < data.expiry) return data.token;
        return null;
    };

    // Yhteinen Google-kirjautumispyyntö: onGranted ajetaan heti jos meillä on
    // jo voimassa oleva token, tai kirjautumisen onnistuttua.
    const requestGoogleAuth = (onGranted) => {
        setGoogleError(null);

        // Pyydetään browser-notifikaatiolupa samalla eleellä
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        const client = tokenClientRef.current ?? initTokenClient();
        if (!client) return;

        const token = getValidToken();
        if (token) {
            setGoogleAuthed(true);
            onGranted();
        } else {
            // prompt: '' → yrittää silent ensin, muuten näyttää popupin
            pendingEnableRef.current = onGranted;
            client.requestAccessToken({ prompt: '' });
        }
    };

    // Kutsutaan kytkintä painettaessa (on käyttäjän ele → molemmat luvat sallittu)
    const enableAlert = () => requestGoogleAuth(() => setAlertEnabled(true));

    const disableAlert = () => {
        setAlertEnabled(false);
        wasOverRef.current = false;
        // Ei kirjauduta ulos Googlesta jos huomisen ennakkohälytys on yhä käytössä
        if (!tomorrowAlertEnabled) {
            setGoogleAuthed(false);
            googleTokenRef.current = null;
        }
    };

    const enableTomorrowAlert = () => requestGoogleAuth(() => setTomorrowAlertEnabled(true));

    const disableTomorrowAlert = () => {
        setTomorrowAlertEnabled(false);
        setTomorrowSavedCount(null);
        if (!alertEnabled) {
            setGoogleAuthed(false);
            googleTokenRef.current = null;
        }
    };

    // ── Hälytysseuranta ──────────────────────────────────────────────────────

    const nowKey = slotKey(currentTime);
    const currentPrice = prices.find(p => p.time === nowKey)?.price ?? null;
    const isOverThreshold = alertEnabled && currentPrice != null && currentPrice > alertThreshold;

    const fireNotifications = (title, body, tag) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification(title, { body, tag, renotify: true });
            } catch (e) {
                console.warn('Browser-ilmoitus epäonnistui:', e);
            }
        }

        const token = getValidToken();
        if (token) {
            postCalendarEvent(token, title, body)
                .catch(err => console.error('Kalenteritapahtuma epäonnistui:', err));
        } else if (googleAuthed) {
            setGoogleError('Google-token vanhentunut. Avaa hälytykset uudelleen.');
            setGoogleAuthed(false);
            setAlertEnabled(false);
        }
    };

    // Ilmoitetaan vain rajan ylitys-/alituskohdissa (kerran per siirtymä),
    // ei enää joka vartilla niin kauan kuin hinta pysyy rajan samalla puolella.
    useEffect(() => {
        if (!alertEnabled || currentPrice == null) return;

        const threshold = alertThresholdRef.current;
        const isOver = currentPrice > threshold;

        if (isOver && !wasOverRef.current) {
            wasOverRef.current = true;
            fireNotifications(
                `⚡ Sähkö kallistui: ${currentPrice.toFixed(2)} c/kWh`,
                `Hinta ylitti rajan ${threshold.toFixed(1)} c/kWh. Harkitse sähkönsyöppöjen laitteiden sammuttamista.`,
                'nordpool-over'
            );
        } else if (!isOver && wasOverRef.current) {
            wasOverRef.current = false;
            fireNotifications(
                `✅ Sähkö taas alle rajan: ${currentPrice.toFixed(2)} c/kWh`,
                `Hinta laski alle rajan ${threshold.toFixed(1)} c/kWh. Voit kytkeä laitteet takaisin päälle.`,
                'nordpool-under'
            );
        }
    }, [alertEnabled, googleAuthed, currentPrice, nowKey]);

    // ── Offline-hälytykset: luo valmiit kalenteritapahtumat kerralla ──────────
    // Tänään: tästä hetkestä eteenpäin. Huomenna: koko päivälle ennakkoon,
    // heti kun huomisen hinnat on julkaistu.

    const [saving, setSaving] = useState(false);
    const [savedCount, setSavedCount] = useState(null); // null = ei vielä painettu
    const [tomorrowSaving, setTomorrowSaving] = useState(false);
    const [tomorrowSavedCount, setTomorrowSavedCount] = useState(null);

    const saveUpcomingAlertsToCalendar = async () => {
        const token = getValidToken();
        if (!token) {
            setGoogleError(googleAuthed
                ? 'Google-token vanhentunut. Ota hälytykset uudelleen käyttöön.'
                : 'Kirjaudu Google-tilille ensin ottamalla hälytykset käyttöön.');
            return;
        }

        const nowSlot = slotKey(new Date());
        const futurePrices = prices.filter(p => p.time >= nowSlot);

        // Alkutila: oliko hinta jo yli rajan juuri ennen nykyistä varttia?
        const lastBefore = [...prices].reverse().find(p => p.time < nowSlot);
        const initialWasOver = lastBefore ? lastBefore.price > alertThreshold : false;
        const events = computeThresholdEvents(futurePrices, alertThreshold, initialWasOver);

        setSaving(true);
        setSavedCount(null);
        const count = await postEventsToCalendar(token, events, 0);
        setSaving(false);
        setSavedCount(count);
    };

    // Huomisen koko päivän ennakkohälytykset - voidaan tallentaa jo tänään,
    // heti kun huomisen hinnat on julkaistu (yleensä n. klo 13-14).
    const saveTomorrowAlertsToCalendar = async () => {
        const token = getValidToken();
        if (!token) {
            setGoogleError(googleAuthed
                ? 'Google-token vanhentunut. Ota ennakkohälytykset uudelleen käyttöön.'
                : 'Kirjaudu Google-tilille ensin ottamalla ennakkohälytykset käyttöön.');
            return;
        }
        if (tomorrowPrices.length === 0) return;

        const events = computeThresholdEvents(tomorrowPrices, tomorrowAlertThreshold, false);

        setTomorrowSaving(true);
        setTomorrowSavedCount(null);
        const count = await postEventsToCalendar(token, events, 1);
        setTomorrowSaving(false);
        setTomorrowSavedCount(count);
    };

    const value = {
        prices,
        loading,
        error,
        currentTime,
        nowKey,
        currentPrice,
        alertEnabled,
        alertThreshold,
        isOverThreshold,
        googleAuthed,
        googleError,
        saving,
        savedCount,
        setAlertThreshold,
        enableAlert,
        disableAlert,
        saveUpcomingAlertsToCalendar,

        tomorrowPrices,
        tomorrowLoading,
        tomorrowError,
        tomorrowAlertEnabled,
        tomorrowAlertThreshold,
        tomorrowSaving,
        tomorrowSavedCount,
        setTomorrowAlertThreshold,
        enableTomorrowAlert,
        disableTomorrowAlert,
        saveTomorrowAlertsToCalendar,
    };

    return <PriceContext.Provider value={value}>{children}</PriceContext.Provider>;
};

export const usePrices = () => {
    const ctx = useContext(PriceContext);
    if (!ctx) throw new Error('usePrices täytyy käyttää PriceProviderin sisällä');
    return ctx;
};