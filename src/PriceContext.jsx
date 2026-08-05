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
        };
    } catch {
        return { enabled: false, threshold: 10 };
    }
};

const slotKey = (date) =>
    `${String(date.getHours()).padStart(2, '0')}:${String(Math.floor(date.getMinutes() / 15) * 15).padStart(2, '0')}`;

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

    // Google-kirjautumistila
    const [googleAuthed, setGoogleAuthed] = useState(false);
    const [googleError, setGoogleError] = useState(null);
    const googleTokenRef = useRef(null);   // { token, expiry }
    const tokenClientRef = useRef(null);

    const lastFetchedDateRef = useRef(new Date().getDate());
    const lastNotifiedSlotRef = useRef(null);
    // true kun olemme jo ilmoittaneet hinnan olevan yli rajan; false kun alle
    const wasOverRef = useRef(false);

    // Synkronoi ref ja localStorage kun threshold muuttuu
    useEffect(() => {
        alertThresholdRef.current = alertThreshold;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: alertEnabled, threshold: alertThreshold }));
    }, [alertEnabled, alertThreshold]);

    // ── Hintojen haku ────────────────────────────────────────────────────────

    const fetchPrices = async (isInitial = false) => {
        if (isInitial) setLoading(true);

        const d = new Date();
        const pvm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const isLocal = window.location.hostname === 'localhost';
        const proxyPath = isLocal ? '/api' : '/api-proxy';
        const url = `${proxyPath}/api/vartti/v1/halpa?vartit=96&tulos=sarja&aikaraja=${pvm}`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Virhe: ${response.status}`);
            const data = await response.json();
            if (!data || data.length === 0) throw new Error('Tyhjä vastaus');

            const formattedData = data.map(item => ({
                time: item.aikaleima_suomi.includes('T')
                    ? item.aikaleima_suomi.split('T')[1].substring(0, 5)
                    : item.aikaleima_suomi.split(' ')[1].substring(0, 5),
                price: parseFloat(item.hinta) * ALV,
            }));

            setPrices(formattedData.sort((a, b) => a.time.localeCompare(b.time)));
            setError(null);
            lastFetchedDateRef.current = d.getDate();
        } catch (err) {
            console.error('Hakuvirhe:', err);
            setError('Hintoja ei saatu ladattua.');
            lastFetchedDateRef.current = null;
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchPrices(true); }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            setCurrentTime(now);
            if (now.getDate() !== lastFetchedDateRef.current && now.getSeconds() === 0) {
                fetchPrices(false);
            }
        }, 1000);
        return () => clearInterval(interval);
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
                    setAlertEnabled(false);
                    return;
                }
                googleTokenRef.current = {
                    token: response.access_token,
                    expiry: Date.now() + (Number(response.expires_in) - 60) * 1000,
                };
                setGoogleError(null);
                setGoogleAuthed(true);
                setAlertEnabled(true);
            },
            error_callback: (err) => {
                setGoogleError(`Kirjautuminen peruutettu: ${err.type}`);
                setAlertEnabled(false);
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

    // Kutsutaan kytkintä painettaessa (on käyttäjän ele → molemmat luvat sallittu)
    const enableAlert = () => {
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
            setAlertEnabled(true);
        } else {
            // prompt: '' → yrittää silent ensin, muuten näyttää popupin
            client.requestAccessToken({ prompt: '' });
        }
    };

    const disableAlert = () => {
        setAlertEnabled(false);
        setGoogleAuthed(false);
        googleTokenRef.current = null;
        lastNotifiedSlotRef.current = null;
        wasOverRef.current = false;
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

    useEffect(() => {
        if (!alertEnabled || currentPrice == null) return;

        const threshold = alertThresholdRef.current;

        if (currentPrice > threshold) {
            // Ilmoitetaan vain kerran per vartti kun mennään yli
            if (lastNotifiedSlotRef.current !== nowKey) {
                lastNotifiedSlotRef.current = nowKey;
                wasOverRef.current = true;
                fireNotifications(
                    `⚡ Sähkö kallistui: ${currentPrice.toFixed(2)} c/kWh`,
                    `Hinta ylitti rajan ${threshold.toFixed(1)} c/kWh. Harkitse sähkönsyöppöjen laitteiden sammuttamista.`,
                    'nordpool-over'
                );
            }
        } else {
            // Ilmoitetaan kerran kun hinta palaa rajan alle
            if (wasOverRef.current) {
                wasOverRef.current = false;
                lastNotifiedSlotRef.current = null;
                fireNotifications(
                    `✅ Sähkö taas alle rajan: ${currentPrice.toFixed(2)} c/kWh`,
                    `Hinta laski alle rajan ${threshold.toFixed(1)} c/kWh. Voit kytkeä laitteet takaisin päälle.`,
                    'nordpool-under'
                );
            }
        }
    }, [alertEnabled, googleAuthed, currentPrice, nowKey]);

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
        setAlertThreshold,
        enableAlert,
        disableAlert,
    };

    return <PriceContext.Provider value={value}>{children}</PriceContext.Provider>;
};

export const usePrices = () => {
    const ctx = useContext(PriceContext);
    if (!ctx) throw new Error('usePrices täytyy käyttää PriceProviderin sisällä');
    return ctx;
};