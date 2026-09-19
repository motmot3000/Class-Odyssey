/* ============================================================
   Class Odyssey — consentement cookies (tarteaucitron.js)
   Pattern repris de lecagibi.ch, adapté à l'identité Class Odyssey.
   Rien ne se charge avant un choix explicite de l'utilisateur.
   ============================================================ */

var tarteaucitronCustomText = {
  alertBigPrivacy:
    "Salut, on est là juste pour rendre votre navigation plus fluide. " +
    "On aimerait mesurer deux ou trois choses — quelles pages aident vraiment " +
    "les profs et où l'on peut faire mieux — jamais votre nom, jamais vos élèves.",
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
   Remplacer G-XXXXXXXXXX par l'identifiant de la propriété
   « Class Odyssey » (Administration → Flux de données → ID de mesure).
   Tant que le placeholder est en place, aucun script Google n'est chargé.
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
