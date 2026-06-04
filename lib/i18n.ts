/**
 * Lightweight i18n (no external deps). Locale lives in a cookie; Server
 * Components read it and pass the relevant dictionary slice down. Pure module
 * (no next/headers) so it is safe to import from client components too.
 */

export type Locale = "pl" | "en";

export const LOCALES: Locale[] = ["pl", "en"];
export const DEFAULT_LOCALE: Locale = "pl";
export const LOCALE_COOKIE = "locale";

export function getLocaleFromCookie(value: string | undefined): Locale {
  return value === "en" || value === "pl" ? value : DEFAULT_LOCALE;
}

export type Dict = {
  common: {
    backToCalendar: string;
    close: string;
    cancel: string;
    logout: string;
    navBack: string;
    navForward: string;
    toClinics: string;
    toCalendar: string;
  };
  home: {
    badge: string;
    title: string;
    intro: string;
    clinicsHeading: string;
    configError: string;
    noTenants: string;
  };
  clinic: {
    bookingHeading: string;
    staffPanelLink: string;
    noDoctors: string;
  };
  booking: {
    freeSlots: string;
    liveUpdate: string;
    slotTaken: string;
    selectedSlot: string;
    patientName: string;
    patientPlaceholder: string;
    bookAndPay: string;
    redirecting: string;
  };
  success: {
    status: string;
    title: string;
    body: string;
    sessionLabel: string;
    back: string;
  };
  cancel: {
    status: string;
    title: string;
    body: string;
    back: string;
  };
  staff: {
    loginHeading: string;
    loginTitle: string;
    email: string;
    password: string;
    signIn: string;
    signingIn: string;
    panelLabel: string; // contains {email}
    upcoming: string;
    colTime: string;
    colDoctor: string;
    colPatient: string;
    colStatus: string;
    noBookings: string;
    readError: string;
    accessDenied: string;
    accessDeniedBody: string; // contains {clinic}
  };
  errors: {
    invalidForm: string;
    nameTooShort: string;
    serverError: string;
    clinicNotFound: string;
    doctorNotFound: string;
    slotStale: string;
    slotTaken: string;
    bookingFailed: string;
    paymentUnavailable: string;
    invalidCredentials: string;
    missingCredentials: string;
  };
  stripe: {
    visit: string; // product name prefix, e.g. "Visit"
  };
};

const pl: Dict = {
  common: {
    backToCalendar: "← Wróć do kalendarza",
    close: "Zamknij",
    cancel: "Anuluj",
    logout: "Wyloguj",
    navBack: "Wstecz",
    navForward: "Dalej",
    toClinics: "Kliniki",
    toCalendar: "Kalendarz",
  },
  home: {
    badge: "Multi-tenant SaaS · demo",
    title: "Dental // Rezerwacje",
    intro:
      "Każda klinika to osobny tenant pod ścieżką /[slug]. Twarda izolacja po RLS, rezerwacje atomowe (partial unique index), dostępność na żywo (Broadcast), płatność przez Stripe Checkout.",
    clinicsHeading: "Kliniki",
    configError:
      "Brak konfiguracji Supabase. Uzupełnij .env.local i wykonaj supabase/schema.sql + seed.sql.",
    noTenants: "Brak tenantów. Uruchom supabase/seed.sql.",
  },
  clinic: {
    bookingHeading: "Rezerwacja wizyty",
    staffPanelLink: "Panel personelu →",
    noDoctors: "Brak lekarzy w tej klinice.",
  },
  booking: {
    freeSlots: "Wolne terminy:",
    liveUpdate: "· aktualizacja na żywo",
    slotTaken: "Ten termin został właśnie zajęty. Wybierz inny.",
    selectedSlot: "Wybrany termin",
    patientName: "Imię i nazwisko",
    patientPlaceholder: "Jan Kowalski",
    bookAndPay: "Zarezerwuj i zapłać",
    redirecting: "Przekierowanie...",
  },
  success: {
    status: "Status",
    title: "Płatność przyjęta",
    body: "Dziękujemy. Twoja rezerwacja jest potwierdzana automatycznie po zaksięgowaniu płatności (webhook Stripe).",
    sessionLabel: "sesja:",
    back: "← Wróć do kalendarza",
  },
  cancel: {
    status: "Status",
    title: "Płatność anulowana",
    body: "Rezerwacja nie została opłacona. Wstępna blokada terminu wygaśnie automatycznie po 15 minutach i wróci do puli.",
    back: "← Wybierz inny termin",
  },
  staff: {
    loginHeading: "Panel personelu",
    loginTitle: "Logowanie",
    email: "Email",
    password: "Hasło",
    signIn: "Zaloguj",
    signingIn: "Logowanie...",
    panelLabel: "Panel personelu · {email}",
    upcoming: "Nadchodzące wizyty",
    colTime: "Termin",
    colDoctor: "Lekarz",
    colPatient: "Pacjent",
    colStatus: "Status",
    noBookings: "Brak nadchodzących wizyt.",
    readError: "Błąd odczytu danych.",
    accessDenied: "Brak dostępu",
    accessDeniedBody: "To konto nie należy do kliniki {clinic}.",
  },
  errors: {
    invalidForm: "Nieprawidłowe dane formularza.",
    nameTooShort: "Podaj imię i nazwisko (min. 2 znaki).",
    serverError: "Błąd serwera. Spróbuj ponownie.",
    clinicNotFound: "Nie znaleziono kliniki.",
    doctorNotFound: "Nie znaleziono lekarza.",
    slotStale: "Termin jest nieaktualny. Odśwież i wybierz ponownie.",
    slotTaken: "Termin właśnie został zajęty. Wybierz inny.",
    bookingFailed: "Nie udało się zarezerwować. Spróbuj ponownie.",
    paymentUnavailable: "Płatność niedostępna. Spróbuj ponownie za chwilę.",
    invalidCredentials: "Nieprawidłowy email lub hasło.",
    missingCredentials: "Podaj email i hasło.",
  },
  stripe: {
    visit: "Wizyta",
  },
};

const en: Dict = {
  common: {
    backToCalendar: "← Back to calendar",
    close: "Close",
    cancel: "Cancel",
    logout: "Sign out",
    navBack: "Back",
    navForward: "Forward",
    toClinics: "Clinics",
    toCalendar: "Calendar",
  },
  home: {
    badge: "Multi-tenant SaaS · demo",
    title: "Dental // Booking",
    intro:
      "Each clinic is a separate tenant under the /[slug] path. Hard isolation via RLS, atomic bookings (partial unique index), live availability (Broadcast), payment via Stripe Checkout.",
    clinicsHeading: "Clinics",
    configError:
      "Supabase is not configured. Fill in .env.local and run supabase/schema.sql + seed.sql.",
    noTenants: "No tenants. Run supabase/seed.sql.",
  },
  clinic: {
    bookingHeading: "Book a visit",
    staffPanelLink: "Staff panel →",
    noDoctors: "No doctors in this clinic.",
  },
  booking: {
    freeSlots: "Free slots:",
    liveUpdate: "· live updates",
    slotTaken: "This slot was just taken. Pick another one.",
    selectedSlot: "Selected slot",
    patientName: "Full name",
    patientPlaceholder: "John Smith",
    bookAndPay: "Book and pay",
    redirecting: "Redirecting...",
  },
  success: {
    status: "Status",
    title: "Payment received",
    body: "Thank you. Your booking is confirmed automatically once the payment settles (Stripe webhook).",
    sessionLabel: "session:",
    back: "← Back to calendar",
  },
  cancel: {
    status: "Status",
    title: "Payment cancelled",
    body: "The booking was not paid. The temporary hold on the slot expires automatically after 15 minutes and returns to the pool.",
    back: "← Pick another slot",
  },
  staff: {
    loginHeading: "Staff panel",
    loginTitle: "Sign in",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    signingIn: "Signing in...",
    panelLabel: "Staff panel · {email}",
    upcoming: "Upcoming appointments",
    colTime: "Time",
    colDoctor: "Doctor",
    colPatient: "Patient",
    colStatus: "Status",
    noBookings: "No upcoming appointments.",
    readError: "Failed to read data.",
    accessDenied: "Access denied",
    accessDeniedBody: "This account does not belong to the {clinic} clinic.",
  },
  errors: {
    invalidForm: "Invalid form data.",
    nameTooShort: "Enter your full name (min. 2 characters).",
    serverError: "Server error. Please try again.",
    clinicNotFound: "Clinic not found.",
    doctorNotFound: "Doctor not found.",
    slotStale: "This slot is out of date. Refresh and pick again.",
    slotTaken: "The slot was just taken. Pick another one.",
    bookingFailed: "Booking failed. Please try again.",
    paymentUnavailable: "Payment unavailable. Please try again shortly.",
    invalidCredentials: "Invalid email or password.",
    missingCredentials: "Enter email and password.",
  },
  stripe: {
    visit: "Visit",
  },
};

const dictionaries: Record<Locale, Dict> = { pl, en };

export function getDictionary(locale: Locale): Dict {
  return dictionaries[locale];
}
