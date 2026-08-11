import { cookies } from "next/headers"

/**
 * Language, with the plumbing §4.1 says to ship on day one.
 *
 * "Start with English + Hindi, ship the i18n plumbing on day one." With the
 * launch corridor in Madurai the first language after English is Tamil, and
 * the rest of the set is the one this corridor actually meets: Telugu,
 * Malayalam and Kannada for neighbouring states, Hindi for the domestic
 * tourists who fly into Madurai for Kodaikanal and Rameswaram.
 *
 * Hindi is in the list, not at the head of it. A Tamil-speaking driver being
 * handed a Hindi interface is exactly the failure this ordering avoids.
 *
 * No library. A dictionary and a cookie is the whole mechanism, which keeps
 * the blessed-dependency list intact and, more usefully, means a missing
 * translation is a typed error rather than a silent fallback to a key name.
 *
 * Toli's own console and the partner tool stay English-only for now: they are
 * used by staff and by office dispatchers who work in English, and translating
 * a settlement statement badly is worse than not translating it. The customer
 * portal and the driver app — the two surfaces used by people who did not
 * choose to work in English — are translated.
 */

export const LOCALES = ["en", "ta", "hi", "te", "ml", "kn"] as const

export type Locale = (typeof LOCALES)[number]

/**
 * Written in the language itself, always. A reader looking for Malayalam is
 * looking for "മലയാളം", not for the English word for it.
 */
export const LOCALE_LABEL: Record<Locale, string> = {
  en: "English",
  ta: "தமிழ்",
  hi: "हिन्दी",
  te: "తెలుగు",
  ml: "മലയാളം",
  kn: "ಕನ್ನಡ",
}

/**
 * What a driver speaking this language is called on the request form.
 *
 * §4.1 lets a customer ask for a driver who speaks their language. Around
 * Madurai that most often means a Hindi-speaking driver for a North Indian
 * family on the Kodaikanal circuit, or Malayalam for the Munnar run.
 */
export const LANGUAGE_LABEL: Record<Locale, string> = {
  en: "English",
  ta: "Tamil",
  hi: "Hindi",
  te: "Telugu",
  ml: "Malayalam",
  kn: "Kannada",
}

export const LOCALE_COOKIE = "toli_locale"

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (LOCALES as readonly string[]).includes(value)
}

/** The reader's language, from their cookie, defaulting to English. */
export async function currentLocale(): Promise<Locale> {
  const store = await cookies()
  const value = store.get(LOCALE_COOKIE)?.value
  return isLocale(value) ? value : "en"
}

/**
 * Every string both translated surfaces need.
 *
 * One flat record per language, typed so that adding a key to English and
 * forgetting Tamil will not compile. That is the entire point of doing this by
 * hand: the compiler holds the translations to the same standard as the code.
 */
export type Dictionary = {
  // Shared
  signOut: string
  back: string
  language: string

  // Driver app — §4.3, the surface where translation matters most
  driveNoTrip: string
  driveNoTripHint: string
  driveOpen: string
  drivePassengers: string
  driveInterstate: string
  driveTripRunning: string
  driveStartTrip: string
  driveOdometerNow: string
  driveOdometerEnd: string
  driveReachedStop: string
  driveReached: string
  driveMoneyPaid: string
  driveAdd: string
  driveExpenseHint: string
  driveFinishTrip: string
  driveFinished: string
  driveSos: string
  driveSosPlaceholder: string
  driveSosHint: string
  driveFromCustomer: string
  driveCall: string
  driveToll: string
  driveParking: string
  driveFuel: string
  drivePermit: string

  // Customer portal
  portalYourTrips: string
  portalAskForVehicle: string
  portalBookNow: string
  portalComingUp: string
  portalEarlier: string
  portalNothingYet: string
  portalNothingYetHint: string
  portalWaitingQuotes: string
  portalQuotesComing: string
  portalBooked: string
  portalYourBill: string
  portalTollNote: string
}

const en: Dictionary = {
  signOut: "Sign out",
  back: "Back",
  language: "Language",

  driveNoTrip: "No trip today",
  driveNoTripHint: "Your next trip will appear here as soon as it is assigned to you.",
  driveOpen: "Open",
  drivePassengers: "passengers",
  driveInterstate: "interstate",
  driveTripRunning: "Trip running",
  driveStartTrip: "Start trip",
  driveOdometerNow: "Odometer reading now",
  driveOdometerEnd: "Odometer at the end",
  driveReachedStop: "Reached a stop",
  driveReached: "Reached",
  driveMoneyPaid: "Money you paid on the road",
  driveAdd: "Add",
  driveExpenseHint: "Goes back to your operator in the trip settlement.",
  driveFinishTrip: "Finish trip",
  driveFinished: "Trip finished. Thank you.",
  driveSos: "SOS",
  driveSosPlaceholder: "What is happening?",
  driveSosHint:
    "Raises an alert on the trip and in Toli's records. It does not yet ring a phone — for an emergency, call 112 first.",
  driveFromCustomer: "From the customer",
  driveCall: "Call",
  driveToll: "Toll",
  driveParking: "Parking",
  driveFuel: "Fuel",
  drivePermit: "State permit",

  portalYourTrips: "Your trips",
  portalAskForVehicle: "Get a quote",
  portalBookNow: "Book now",
  portalComingUp: "Coming up",
  portalEarlier: "Earlier",
  portalNothingYet: "Nothing booked yet",
  portalNothingYetHint:
    "Book a vehicle that is free right now, or ask operators to quote for a longer trip.",
  portalWaitingQuotes: "Waiting for quotes",
  portalQuotesComing: "Quotes coming in",
  portalBooked: "Booked",
  portalYourBill: "Your bill",
  portalTollNote:
    "Tolls paid on the route are added to this bill, itemised, with the driver's receipts against them.",
}

const ta: Dictionary = {
  signOut: "வெளியேறு",
  back: "பின்செல்",
  language: "மொழி",

  driveNoTrip: "இன்று பயணம் இல்லை",
  driveNoTripHint: "உங்களுக்கு பயணம் ஒதுக்கியவுடன் இங்கே தெரியும்.",
  driveOpen: "திற",
  drivePassengers: "பயணிகள்",
  driveInterstate: "மாநிலம் கடக்கும்",
  driveTripRunning: "பயணம் நடக்கிறது",
  driveStartTrip: "பயணத்தைத் தொடங்கு",
  driveOdometerNow: "இப்போதைய ஓடோமீட்டர் அளவு",
  driveOdometerEnd: "பயண முடிவில் ஓடோமீட்டர்",
  driveReachedStop: "நிறுத்தத்தை அடைந்தேன்",
  driveReached: "அடைந்தேன்",
  driveMoneyPaid: "வழியில் நீங்கள் செலுத்திய பணம்",
  driveAdd: "சேர்",
  driveExpenseHint: "பயணக் கணக்கில் உங்கள் நிறுவனத்திற்குத் திரும்பக் கிடைக்கும்.",
  driveFinishTrip: "பயணத்தை முடி",
  driveFinished: "பயணம் முடிந்தது. நன்றி.",
  driveSos: "அவசர உதவி",
  driveSosPlaceholder: "என்ன நடக்கிறது?",
  driveSosHint:
    "பயணத்திலும் Toli பதிவிலும் எச்சரிக்கை பதிவாகும். இது இன்னும் யாரையும் தொலைபேசியில் அழைக்காது — அவசரநிலையில் முதலில் 112 ஐ அழைக்கவும்.",
  driveFromCustomer: "வாடிக்கையாளரிடமிருந்து",
  driveCall: "அழை",
  driveToll: "சுங்கம்",
  driveParking: "நிறுத்தக் கட்டணம்",
  driveFuel: "எரிபொருள்",
  drivePermit: "மாநில அனுமதி",

  portalYourTrips: "உங்கள் பயணங்கள்",
  portalAskForVehicle: "விலைப்புள்ளி கேளுங்கள்",
  portalBookNow: "இப்போதே பதிவு செய்",
  portalComingUp: "வரவிருக்கும்",
  portalEarlier: "முந்தையவை",
  portalNothingYet: "இதுவரை பதிவு இல்லை",
  portalNothingYetHint:
    "இப்போது காலியாக உள்ள வாகனத்தைப் பதிவு செய்யுங்கள், அல்லது நீண்ட பயணத்திற்கு விலைப்புள்ளி கேளுங்கள்.",
  portalWaitingQuotes: "விலைப்புள்ளிக்காக காத்திருக்கிறது",
  portalQuotesComing: "விலைப்புள்ளிகள் வந்துகொண்டிருக்கின்றன",
  portalBooked: "பதிவு செய்யப்பட்டது",
  portalYourBill: "உங்கள் கட்டணப் பட்டியல்",
  portalTollNote:
    "வழியில் செலுத்திய சுங்கக் கட்டணம் இந்தப் பட்டியலில் தனித்தனியாக, ஓட்டுநரின் ரசீதுகளுடன் சேர்க்கப்படும்.",
}

/**
 * Hindi — for the domestic tourists who fly into Madurai for Kodaikanal and
 * Rameswaram, and for the drivers a customer can ask to speak it.
 */
const hi: Dictionary = {
  signOut: "साइन आउट",
  back: "वापस",
  language: "भाषा",

  driveNoTrip: "आज कोई ट्रिप नहीं",
  driveNoTripHint: "आपको ट्रिप सौंपते ही वह यहाँ दिखाई देगी।",
  driveOpen: "खोलें",
  drivePassengers: "यात्री",
  driveInterstate: "अंतरराज्यीय",
  driveTripRunning: "ट्रिप चल रही है",
  driveStartTrip: "ट्रिप शुरू करें",
  driveOdometerNow: "अभी का ओडोमीटर रीडिंग",
  driveOdometerEnd: "अंत में ओडोमीटर",
  driveReachedStop: "स्टॉप पर पहुँचे",
  driveReached: "पहुँच गए",
  driveMoneyPaid: "रास्ते में आपने जो पैसे दिए",
  driveAdd: "जोड़ें",
  driveExpenseHint: "ट्रिप के हिसाब में आपके ऑपरेटर को वापस मिलेगा।",
  driveFinishTrip: "ट्रिप खत्म करें",
  driveFinished: "ट्रिप पूरी हुई। धन्यवाद।",
  driveSos: "आपात सहायता",
  driveSosPlaceholder: "क्या हो रहा है?",
  driveSosHint:
    "ट्रिप और Toli के रिकॉर्ड में अलर्ट दर्ज होता है। यह अभी किसी को फ़ोन नहीं करता — आपात स्थिति में पहले 112 पर कॉल करें।",
  driveFromCustomer: "ग्राहक की ओर से",
  driveCall: "कॉल करें",
  driveToll: "टोल",
  driveParking: "पार्किंग",
  driveFuel: "ईंधन",
  drivePermit: "राज्य परमिट",

  portalYourTrips: "आपकी ट्रिप",
  portalAskForVehicle: "कोटेशन लें",
  portalBookNow: "अभी बुक करें",
  portalComingUp: "आगामी",
  portalEarlier: "पहले की",
  portalNothingYet: "अभी कोई बुकिंग नहीं",
  portalNothingYetHint: "अभी खाली वाहन बुक करें, या लंबी यात्रा के लिए ऑपरेटरों से कोटेशन माँगें।",
  portalWaitingQuotes: "कोटेशन का इंतज़ार",
  portalQuotesComing: "कोटेशन आ रहे हैं",
  portalBooked: "बुक हो गया",
  portalYourBill: "आपका बिल",
  portalTollNote: "रास्ते में दिया गया टोल इस बिल में अलग से, ड्राइवर की रसीदों के साथ जोड़ा जाता है।",
}

/** Telugu — Andhra and Telangana groups on the Rameswaram circuit. */
const te: Dictionary = {
  signOut: "సైన్ అవుట్",
  back: "వెనుకకు",
  language: "భాష",

  driveNoTrip: "ఈరోజు ప్రయాణం లేదు",
  driveNoTripHint: "మీకు ప్రయాణం కేటాయించగానే ఇక్కడ కనిపిస్తుంది.",
  driveOpen: "తెరవండి",
  drivePassengers: "ప్రయాణికులు",
  driveInterstate: "అంతర్రాష్ట్ర",
  driveTripRunning: "ప్రయాణం జరుగుతోంది",
  driveStartTrip: "ప్రయాణం ప్రారంభించు",
  driveOdometerNow: "ప్రస్తుత ఓడోమీటర్ రీడింగ్",
  driveOdometerEnd: "చివరిలో ఓడోమీటర్",
  driveReachedStop: "స్టాప్‌కు చేరుకున్నాను",
  driveReached: "చేరుకున్నాను",
  driveMoneyPaid: "దారిలో మీరు చెల్లించిన డబ్బు",
  driveAdd: "జోడించు",
  driveExpenseHint: "ప్రయాణ లెక్కలో మీ ఆపరేటర్‌కు తిరిగి వస్తుంది.",
  driveFinishTrip: "ప్రయాణం ముగించు",
  driveFinished: "ప్రయాణం ముగిసింది. ధన్యవాదాలు.",
  driveSos: "అత్యవసర సహాయం",
  driveSosPlaceholder: "ఏమి జరుగుతోంది?",
  driveSosHint:
    "ప్రయాణంలోనూ Toli రికార్డులోనూ హెచ్చరిక నమోదవుతుంది. ఇది ఇంకా ఎవరికీ ఫోన్ చేయదు — అత్యవసరమైతే ముందుగా 112కి కాల్ చేయండి.",
  driveFromCustomer: "కస్టమర్ నుండి",
  driveCall: "కాల్ చేయి",
  driveToll: "టోల్",
  driveParking: "పార్కింగ్",
  driveFuel: "ఇంధనం",
  drivePermit: "రాష్ట్ర అనుమతి",

  portalYourTrips: "మీ ప్రయాణాలు",
  portalAskForVehicle: "కోట్ అడగండి",
  portalBookNow: "ఇప్పుడే బుక్ చేయండి",
  portalComingUp: "రాబోయేవి",
  portalEarlier: "గతంలోనివి",
  portalNothingYet: "ఇంకా బుకింగ్ లేదు",
  portalNothingYetHint: "ఇప్పుడు ఖాళీగా ఉన్న వాహనాన్ని బుక్ చేయండి, లేదా సుదీర్ఘ ప్రయాణానికి కోట్ అడగండి.",
  portalWaitingQuotes: "కోట్ల కోసం ఎదురుచూస్తోంది",
  portalQuotesComing: "కోట్లు వస్తున్నాయి",
  portalBooked: "బుక్ అయ్యింది",
  portalYourBill: "మీ బిల్లు",
  portalTollNote: "దారిలో చెల్లించిన టోల్ ఈ బిల్లులో విడిగా, డ్రైవర్ రసీదులతో కలుపబడుతుంది.",
}

/** Malayalam — the Munnar and Thekkady runs out of Madurai. */
const ml: Dictionary = {
  signOut: "സൈൻ ഔട്ട്",
  back: "തിരികെ",
  language: "ഭാഷ",

  driveNoTrip: "ഇന്ന് യാത്ര ഇല്ല",
  driveNoTripHint: "നിങ്ങൾക്ക് യാത്ര നൽകിയാലുടൻ ഇവിടെ കാണാം.",
  driveOpen: "തുറക്കുക",
  drivePassengers: "യാത്രക്കാർ",
  driveInterstate: "അന്തർസംസ്ഥാനം",
  driveTripRunning: "യാത്ര നടക്കുന്നു",
  driveStartTrip: "യാത്ര ആരംഭിക്കുക",
  driveOdometerNow: "ഇപ്പോഴത്തെ ഓഡോമീറ്റർ റീഡിംഗ്",
  driveOdometerEnd: "അവസാനത്തെ ഓഡോമീറ്റർ",
  driveReachedStop: "സ്റ്റോപ്പിൽ എത്തി",
  driveReached: "എത്തി",
  driveMoneyPaid: "വഴിയിൽ നിങ്ങൾ നൽകിയ പണം",
  driveAdd: "ചേർക്കുക",
  driveExpenseHint: "യാത്രാ കണക്കിൽ നിങ്ങളുടെ ഓപ്പറേറ്റർക്ക് തിരികെ ലഭിക്കും.",
  driveFinishTrip: "യാത്ര അവസാനിപ്പിക്കുക",
  driveFinished: "യാത്ര പൂർത്തിയായി. നന്ദി.",
  driveSos: "അടിയന്തര സഹായം",
  driveSosPlaceholder: "എന്താണ് സംഭവിക്കുന്നത്?",
  driveSosHint:
    "യാത്രയിലും Toli രേഖകളിലും മുന്നറിയിപ്പ് രേഖപ്പെടുത്തും. ഇത് ഇതുവരെ ആരെയും വിളിക്കില്ല — അടിയന്തരാവസ്ഥയിൽ ആദ്യം 112 വിളിക്കുക.",
  driveFromCustomer: "ഉപഭോക്താവിൽ നിന്ന്",
  driveCall: "വിളിക്കുക",
  driveToll: "ടോൾ",
  driveParking: "പാർക്കിംഗ്",
  driveFuel: "ഇന്ധനം",
  drivePermit: "സംസ്ഥാന പെർമിറ്റ്",

  portalYourTrips: "നിങ്ങളുടെ യാത്രകൾ",
  portalAskForVehicle: "കോട്ട് ചോദിക്കുക",
  portalBookNow: "ഇപ്പോൾ ബുക്ക് ചെയ്യുക",
  portalComingUp: "വരാനിരിക്കുന്നത്",
  portalEarlier: "മുമ്പുള്ളവ",
  portalNothingYet: "ഇതുവരെ ബുക്കിംഗ് ഇല്ല",
  portalNothingYetHint: "ഇപ്പോൾ ഒഴിവുള്ള വാഹനം ബുക്ക് ചെയ്യുക, അല്ലെങ്കിൽ നീണ്ട യാത്രയ്ക്ക് കോട്ട് ചോദിക്കുക.",
  portalWaitingQuotes: "കോട്ടുകൾക്കായി കാത്തിരിക്കുന്നു",
  portalQuotesComing: "കോട്ടുകൾ വന്നുകൊണ്ടിരിക്കുന്നു",
  portalBooked: "ബുക്ക് ചെയ്തു",
  portalYourBill: "നിങ്ങളുടെ ബിൽ",
  portalTollNote: "വഴിയിൽ നൽകിയ ടോൾ ഈ ബില്ലിൽ പ്രത്യേകമായി, ഡ്രൈവറുടെ രസീതുകളോടെ ചേർക്കുന്നു.",
}

/** Kannada — Bengaluru groups coming south for the temple circuit. */
const kn: Dictionary = {
  signOut: "ಸೈನ್ ಔಟ್",
  back: "ಹಿಂದೆ",
  language: "ಭಾಷೆ",

  driveNoTrip: "ಇಂದು ಪ್ರಯಾಣವಿಲ್ಲ",
  driveNoTripHint: "ನಿಮಗೆ ಪ್ರಯಾಣ ನಿಗದಿಯಾದ ತಕ್ಷಣ ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತದೆ.",
  driveOpen: "ತೆರೆಯಿರಿ",
  drivePassengers: "ಪ್ರಯಾಣಿಕರು",
  driveInterstate: "ಅಂತರರಾಜ್ಯ",
  driveTripRunning: "ಪ್ರಯಾಣ ನಡೆಯುತ್ತಿದೆ",
  driveStartTrip: "ಪ್ರಯಾಣ ಪ್ರಾರಂಭಿಸಿ",
  driveOdometerNow: "ಈಗಿನ ಓಡೋಮೀಟರ್ ಓದು",
  driveOdometerEnd: "ಕೊನೆಯಲ್ಲಿ ಓಡೋಮೀಟರ್",
  driveReachedStop: "ನಿಲುಗಡೆ ತಲುಪಿದೆ",
  driveReached: "ತಲುಪಿದೆ",
  driveMoneyPaid: "ದಾರಿಯಲ್ಲಿ ನೀವು ಪಾವತಿಸಿದ ಹಣ",
  driveAdd: "ಸೇರಿಸಿ",
  driveExpenseHint: "ಪ್ರಯಾಣದ ಲೆಕ್ಕದಲ್ಲಿ ನಿಮ್ಮ ಆಪರೇಟರ್‌ಗೆ ಮರಳಿ ಸಿಗುತ್ತದೆ.",
  driveFinishTrip: "ಪ್ರಯಾಣ ಮುಗಿಸಿ",
  driveFinished: "ಪ್ರಯಾಣ ಮುಗಿಯಿತು. ಧನ್ಯವಾದಗಳು.",
  driveSos: "ತುರ್ತು ಸಹಾಯ",
  driveSosPlaceholder: "ಏನಾಗುತ್ತಿದೆ?",
  driveSosHint:
    "ಪ್ರಯಾಣದಲ್ಲಿ ಮತ್ತು Toli ದಾಖಲೆಯಲ್ಲಿ ಎಚ್ಚರಿಕೆ ದಾಖಲಾಗುತ್ತದೆ. ಇದು ಇನ್ನೂ ಯಾರಿಗೂ ಕರೆ ಮಾಡುವುದಿಲ್ಲ — ತುರ್ತು ಸಂದರ್ಭದಲ್ಲಿ ಮೊದಲು 112 ಕರೆ ಮಾಡಿ.",
  driveFromCustomer: "ಗ್ರಾಹಕರಿಂದ",
  driveCall: "ಕರೆ ಮಾಡಿ",
  driveToll: "ಟೋಲ್",
  driveParking: "ಪಾರ್ಕಿಂಗ್",
  driveFuel: "ಇಂಧನ",
  drivePermit: "ರಾಜ್ಯ ಪರವಾನಗಿ",

  portalYourTrips: "ನಿಮ್ಮ ಪ್ರಯಾಣಗಳು",
  portalAskForVehicle: "ದರಪಟ್ಟಿ ಕೇಳಿ",
  portalBookNow: "ಈಗಲೇ ಬುಕ್ ಮಾಡಿ",
  portalComingUp: "ಮುಂಬರುವ",
  portalEarlier: "ಹಿಂದಿನವು",
  portalNothingYet: "ಇನ್ನೂ ಬುಕಿಂಗ್ ಇಲ್ಲ",
  portalNothingYetHint: "ಈಗ ಖಾಲಿ ಇರುವ ವಾಹನವನ್ನು ಬುಕ್ ಮಾಡಿ, ಅಥವಾ ದೀರ್ಘ ಪ್ರಯಾಣಕ್ಕೆ ದರಪಟ್ಟಿ ಕೇಳಿ.",
  portalWaitingQuotes: "ದರಪಟ್ಟಿಗಾಗಿ ಕಾಯುತ್ತಿದೆ",
  portalQuotesComing: "ದರಪಟ್ಟಿಗಳು ಬರುತ್ತಿವೆ",
  portalBooked: "ಬುಕ್ ಆಗಿದೆ",
  portalYourBill: "ನಿಮ್ಮ ಬಿಲ್",
  portalTollNote: "ದಾರಿಯಲ್ಲಿ ಪಾವತಿಸಿದ ಟೋಲ್ ಈ ಬಿಲ್‌ನಲ್ಲಿ ಪ್ರತ್ಯೇಕವಾಗಿ, ಚಾಲಕರ ರಸೀದಿಗಳೊಂದಿಗೆ ಸೇರಿಸಲಾಗುತ್ತದೆ.",
}

const DICTIONARIES: Record<Locale, Dictionary> = { en, ta, hi, te, ml, kn }

export function dictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale]
}

/** The reader's dictionary, in one call, for a server component. */
export async function translations(): Promise<{ locale: Locale; t: Dictionary }> {
  const locale = await currentLocale()
  return { locale, t: dictionary(locale) }
}
