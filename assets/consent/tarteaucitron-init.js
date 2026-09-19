/* ============================================================
   Class Odyssey — consentement cookies (tarteaucitron.js)
   Pattern repris de lecagibi.ch, adapté à l'identité Class Odyssey.
   Rien ne se charge avant un choix explicite de l'utilisateur.
   ============================================================ */

// Langue résolue en amont dans index.html (window.tarteaucitronForceLanguage).
var classOdysseyLang = window.tarteaucitronForceLanguage === "en" ? "en" : "fr";

var tarteaucitronCustomText = classOdysseyLang === "en"
  ? {
    alertBigPrivacy:
      "Hi! These cookies keep the app running smoothly and help us improve it " +
      "by showing which pages really help in class. No personal data is shared — " +
      "not yours, not your students'.",
    acceptAll: "Accept all",
    denyAll: "No thanks",
    personalize: "Manage",
    privacyUrl: "Learn more",
    closeBanner: "Hide",
    title: "Cookie settings"
  }
  : {
    alertBigPrivacy:
      "Salut ! Ces cookies gardent l'app fluide et nous aident à l'améliorer, " +
      "en montrant quelles pages servent vraiment en classe. Aucune donnée " +
      "personnelle n'est partagée — ni la vôtre, ni celle de vos élèves.",
    acceptAll: "Tout accepter",
    denyAll: "Non merci",
    personalize: "Gérer",
    privacyUrl: "En savoir plus",
    closeBanner: "Masquer",
    title: "Réglages des cookies"
  };

tarteaucitron.init({
  // Chemin des ressources auto-hébergées : ce fichier vit dans assets/consent/.
  tarteaucitronForceCDN: new URL("tarteaucitron/", document.currentScript.src).href,
  privacyUrl: "https://classodyssey.com/#politique-de-confidentialite",
  bodyPosition: "bottom",
  hashtag: "#tarteaucitron",
  cookieName: "tarteaucitron",
  orientation: "bottom",
  groupServices: false,
  showDetailsOnClick: true,
  // Opt-in strict : les services restent en attente tant que l'utilisateur n'a pas choisi.
  serviceDefaultState: "wait",
  showAlertSmall: false,
  cookieslist: false,
  closePopup: false,
  showIcon: false,
  iconPosition: "BottomRight",
  adblocker: false,
  DenyAllCta: true,
  AcceptAllCta: true,
  highPrivacy: true,
  handleBrowserDNTRequest: false,
  removeCredit: false,
  moreInfoLink: true,
  useExternalCss: false,
  useExternalJs: false,
  readmoreLink: "https://classodyssey.com/#politique-de-confidentialite",
  // Refus aussi simple que l'acceptation : pas de bouton « J'accepte » imposé.
  mandatory: false,
  mandatoryCta: false,
  // Google Consent Mode v2 : les signaux suivent le choix de l'utilisateur.
  // softConsentMode évite tout préchargement de gtag avant consentement :
  // rien ne part vers Google tant que l'utilisateur n'a pas cliqué.
  googleConsentMode: true,
  softConsentMode: true
});

/* ------------------------------------------------------------
   Google Analytics 4
   Identifiant de la propriété « Class Odyssey »
   (Administration → Flux de données → ID de mesure).
   Opt-in strict : aucun script Google n'est chargé tant que
   l'utilisateur n'a pas accepté la mesure d'audience.
   ------------------------------------------------------------ */
tarteaucitron.user.gtagUa = "G-V25NWDELYQ";
tarteaucitron.user.gtagMore = function () {};
(tarteaucitron.job = tarteaucitron.job || []).push("gtag");

/* ------------------------------------------------------------
   Google Ads — préparé pour plus tard.
   Décommenter et renseigner l'ID de conversion (AW-XXXXXXXXX)
   le jour où des campagnes seront lancées.
   ------------------------------------------------------------ */
// tarteaucitron.user.googleadsId = "AW-XXXXXXXXX";
// tarteaucitron.user.googleadsMore = function () {};
// (tarteaucitron.job = tarteaucitron.job || []).push("googleads");
