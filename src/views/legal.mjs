/* Legal pages: legal notice and privacy policy.
 *
 * Copy is authored in French and English, adapted from the publisher's
 * lecagibi.ch documents for the Class Odyssey application. Content lives here
 * rather than in i18n-extra.mjs because it is long, page-specific prose.
 */

import { getLang, t } from "../i18n.mjs";

const EMAIL = "thomas.walter.wunsche@gmail.com";
const SITE = "https://classodyssey.com/";
const SITE_LABEL = "classodyssey.com";
const MAILTO = `<a href="mailto:${EMAIL}">${EMAIL}</a>`;

const MENTIONS_LEGALES = {
  fr: {
    kicker: "Informations légales",
    title: "Mentions légales",
    lede: "Conformément aux obligations légales applicables en Suisse.",
    sections: [
      {
        heading: "Éditeur de l'application",
        body: `
          <p>L'application <strong>Class Odyssey</strong>, accessible à l'adresse <a href="${SITE}">${SITE_LABEL}</a>, est éditée par :</p>
          <p><strong>Thomas Wünsche</strong>, activité indépendante, Suisse.</p>
          <ul>
            <li><strong>Titulaire :</strong> Thomas Wünsche</li>
            <li><strong>Forme juridique :</strong> entreprise individuelle (activité indépendante)</li>
            <li><strong>Adresse :</strong> 13 chemin des Troènes, 1213 Petit-Lancy, Genève, Suisse</li>
            <li><strong>Email :</strong> ${MAILTO}</li>
            <li><strong>Site :</strong> <a href="${SITE}">${SITE_LABEL}</a></li>
          </ul>
          <p class="legal-note">En tant qu'indépendant, l'éditeur n'est tenu de s'inscrire au registre du commerce et de disposer d'un numéro d'identification des entreprises (IDE) que si son chiffre d'affaires annuel atteint 100'000 CHF.</p>`
      },
      {
        heading: "Responsable de la publication",
        body: `<p>La responsabilité éditoriale du contenu de Class Odyssey incombe à Thomas Wünsche. Pour toute demande relative au contenu de l'application : ${MAILTO}.</p>`
      },
      {
        heading: "Hébergement",
        body: `
          <p>L'application et les données sont hébergées en Suisse par :</p>
          <p><strong>Infomaniak Network SA</strong><br />Rue Eugène-Marziano 25, 1227 Les Acacias (Genève), Suisse</p>
          <p><strong>Site web :</strong> <a href="https://www.infomaniak.com">www.infomaniak.com</a></p>`
      },
      {
        heading: "Propriété intellectuelle",
        body: `
          <p>Class Odyssey — son concept, ses textes, ses images, ses personnages, ses illustrations, ses logos, ses interfaces, sa mise en page et son code source — est la propriété exclusive de Thomas Wünsche, sauf mention contraire explicite. Ces éléments sont protégés par le droit suisse de la propriété intellectuelle, notamment la loi fédérale sur le droit d'auteur (LDA) et la loi fédérale sur la protection des marques (LPM).</p>
          <p>Toute reproduction, représentation, modification, distribution, extraction ou utilisation, totale ou partielle, par quelque procédé que ce soit, est interdite sans l'autorisation écrite préalable de l'auteur.</p>
          <p>Par exception, l'utilisation de Class Odyssey dans un cadre strictement pédagogique (usage en classe par un enseignant et ses élèves) est autorisée gratuitement pour le moment, à des fins non lucratives et sans revente. Cette autorisation est précaire, non transférable et peut être retirée à tout moment. Les marques, logos et noms de produits de tiers demeurent la propriété de leurs détenteurs respectifs.</p>`
      },
      {
        heading: "Statut de l'application et tarification",
        body: `<p>Class Odyssey est actuellement proposé en <strong>version bêta</strong>. L'accès est <strong>gratuit pour le moment</strong> : aucun paiement n'est demandé à ce jour. Des offres payantes (achat ponctuel ou abonnement) pourraient être proposées à l'avenir. Les fonctionnalités, les conditions d'accès et les tarifs peuvent évoluer, sous réserve des règles applicables aux offres payantes décrites dans les <a href="#conditions-utilisation">Conditions d'utilisation</a>. En version bêta, des bugs, des interruptions ou des pertes de données ne peuvent être exclus ; il est recommandé d'exporter régulièrement une sauvegarde de vos classes.</p>
          <p>Le cas échéant, les prix sont indiqués en francs suisses (CHF) et les paiements en ligne sont traités par le prestataire de paiement Stripe (cartes bancaires, TWINT), comme décrit dans les <a href="#conditions-utilisation">Conditions d'utilisation</a> et la <a href="#politique-de-confidentialite">Politique de confidentialité</a>.</p>`
      },
      {
        heading: "Liens hypertextes",
        body: `<p>L'application peut contenir des liens vers des sites tiers. L'éditeur n'exerce aucun contrôle sur ces sites et décline toute responsabilité quant à leur contenu, leur disponibilité ou leurs pratiques en matière de protection des données. L'activation de ces liens relève de la seule responsabilité de l'utilisateur et ne constitue pas une approbation de leur contenu.</p>`
      },
      {
        heading: "Disponibilité et exactitude",
        body: `<p>L'éditeur s'efforce de maintenir l'application accessible et d'en tenir les informations à jour et exactes. Il ne garantit toutefois ni l'exactitude, ni l'exhaustivité, ni l'actualité permanente des informations publiées, et se réserve le droit d'en modifier le contenu à tout moment et sans préavis. L'accès peut être interrompu, notamment pour des raisons de maintenance ou de force majeure.</p>`
      },
      {
        heading: "Limitation de responsabilité",
        body: `<p>Dans les limites permises par le droit suisse, la responsabilité de l'éditeur ne saurait être engagée pour tout dommage direct ou indirect résultant de l'accès à l'application, de son utilisation, de l'impossibilité d'y accéder, ou de l'usage des informations qu'elle contient.</p>`
      },
      {
        heading: "Protection des données personnelles",
        body: `<p>La collecte et le traitement des données personnelles dans le cadre de l'utilisation de Class Odyssey sont décrits dans notre <a href="#politique-de-confidentialite">Politique de confidentialité</a>, conforme à la loi fédérale sur la protection des données (LPD révisée, en vigueur depuis le 1er septembre 2023) et, pour les personnes concernées, au Règlement général sur la protection des données de l'Union européenne (RGPD). Les règles d'utilisation du service sont précisées dans nos <a href="#conditions-utilisation">Conditions d'utilisation</a>.</p>`
      },
      {
        heading: "Cookies",
        body: `<p>Class Odyssey utilise des cookies et un stockage local strictement nécessaires à son fonctionnement, notamment pour maintenir la session d'un compte connecté. La création d'un compte suppose l'acceptation des <a href="#conditions-utilisation">Conditions d'utilisation</a> et de la <a href="#politique-de-confidentialite">Politique de confidentialité</a>. Une mesure d'audience (Google Analytics 4) n'est déposée qu'avec votre consentement, recueilli via le bandeau dédié et révocable à tout moment. Le détail figure dans la section « Cookies et technologies de suivi » de la Politique de confidentialité.</p>`
      },
      {
        heading: "Droit applicable et for juridique",
        body: `<p>La présente application et son contenu sont régis par le droit suisse. Sous réserve des dispositions impératives en matière de for, tout litige relatif à son utilisation ou à son contenu relève de la compétence exclusive des tribunaux ordinaires du canton de Genève, Suisse.</p>`
      }
    ]
  },
  en: {
    kicker: "Legal information",
    title: "Legal notice",
    lede: "In accordance with the legal obligations applicable in Switzerland.",
    sections: [
      {
        heading: "Publisher",
        body: `
          <p>The <strong>Class Odyssey</strong> application, available at <a href="${SITE}">${SITE_LABEL}</a>, is published by:</p>
          <p><strong>Thomas Wünsche</strong>, independent activity, Switzerland.</p>
          <ul>
            <li><strong>Owner:</strong> Thomas Wünsche</li>
            <li><strong>Legal form:</strong> sole proprietorship (independent activity)</li>
            <li><strong>Address:</strong> 13 chemin des Troènes, 1213 Petit-Lancy, Geneva, Switzerland</li>
            <li><strong>Email:</strong> ${MAILTO}</li>
            <li><strong>Website:</strong> <a href="${SITE}">${SITE_LABEL}</a></li>
          </ul>
          <p class="legal-note">As a sole trader, the publisher is only required to register with the commercial register and obtain a business identification number (UID) once annual turnover reaches CHF 100,000.</p>`
      },
      {
        heading: "Publication manager",
        body: `<p>Editorial responsibility for the content of Class Odyssey rests with Thomas Wünsche. For any request concerning the content of the application: ${MAILTO}.</p>`
      },
      {
        heading: "Hosting",
        body: `
          <p>The application and its data are hosted in Switzerland by:</p>
          <p><strong>Infomaniak Network SA</strong><br />Rue Eugène-Marziano 25, 1227 Les Acacias (Geneva), Switzerland</p>
          <p><strong>Website:</strong> <a href="https://www.infomaniak.com">www.infomaniak.com</a></p>`
      },
      {
        heading: "Intellectual property",
        body: `
          <p>Class Odyssey — its concept, text, images, characters, illustrations, logos, interfaces, layout and source code — is the exclusive property of Thomas Wünsche, unless explicitly stated otherwise. These elements are protected by Swiss intellectual property law, in particular the Federal Act on Copyright and Related Rights (Copyright Act, CopA) and the Federal Act on the Protection of Trade Marks and Indications of Source (TMA).</p>
          <p>Any reproduction, representation, modification, distribution, extraction or use, in whole or in part, by any means whatsoever, is prohibited without the prior written authorisation of the author.</p>
          <p>By way of exception, use of Class Odyssey in a strictly educational context (classroom use by a teacher and their pupils) is authorised free of charge for the time being, for non-profit purposes and without resale. This authorisation is revocable, non-transferable and may be withdrawn at any time. Third-party trade marks, logos and product names remain the property of their respective owners.</p>`
      },
      {
        heading: "Application status and pricing",
        body: `<p>Class Odyssey is currently offered as a <strong>beta version</strong>. Access is <strong>free for the time being</strong>: no payment is requested today. Paid offers (a one-off purchase or a subscription) may be offered in the future. Features, access conditions and pricing may change, subject to the rules for paid offers set out in the <a href="#conditions-utilisation">Terms of use</a>. In a beta version, bugs, interruptions or data loss cannot be ruled out; exporting a backup of your classes regularly is recommended.</p>
          <p>Where applicable, prices are shown in Swiss francs (CHF) and online payments are processed by the payment provider Stripe (bank cards, TWINT), as described in the <a href="#conditions-utilisation">Terms of use</a> and the <a href="#politique-de-confidentialite">Privacy policy</a>.</p>`
      },
      {
        heading: "Hyperlinks",
        body: `<p>The application may contain links to third-party sites. The publisher exercises no control over those sites and accepts no liability for their content, availability or data protection practices. Following such links is the sole responsibility of the user and does not constitute endorsement of their content.</p>`
      },
      {
        heading: "Availability and accuracy",
        body: `<p>The publisher strives to keep the application accessible and its information up to date and accurate. It nevertheless does not guarantee the accuracy, completeness or permanent currency of the published information, and reserves the right to change its content at any time without notice. Access may be interrupted, in particular for maintenance or reasons of force majeure.</p>`
      },
      {
        heading: "Limitation of liability",
        body: `<p>To the extent permitted by Swiss law, the publisher cannot be held liable for any direct or indirect damage resulting from access to the application, its use, the inability to access it, or the use of the information it contains.</p>`
      },
      {
        heading: "Personal data protection",
        body: `<p>The collection and processing of personal data in connection with the use of Class Odyssey are described in our <a href="#politique-de-confidentialite">Privacy policy</a>, which complies with the Swiss Federal Act on Data Protection (revised FADP, in force since 1 September 2023) and, where applicable, the European Union General Data Protection Regulation (GDPR). The rules for using the service are set out in our <a href="#conditions-utilisation">Terms of use</a>.</p>`
      },
      {
        heading: "Cookies",
        body: `<p>Class Odyssey uses cookies and local storage that are strictly necessary for its operation, in particular to maintain a signed-in account session. Creating an account requires accepting the <a href="#conditions-utilisation">Terms of use</a> and the <a href="#politique-de-confidentialite">Privacy policy</a>. Audience measurement (Google Analytics 4) is only stored with your consent, collected through the dedicated banner and revocable at any time. Details appear in the “Cookies and tracking technologies” section of the Privacy policy.</p>`
      },
      {
        heading: "Governing law and jurisdiction",
        body: `<p>This application and its content are governed by Swiss law. Subject to mandatory provisions on jurisdiction, any dispute relating to its use or content falls under the exclusive jurisdiction of the ordinary courts of the canton of Geneva, Switzerland.</p>`
      }
    ]
  }
};

const CONDITIONS = {
  fr: {
    kicker: "Cadre d'utilisation",
    title: "Conditions d'utilisation",
    lede: "Les règles qui encadrent la création d'un compte et l'usage de Class Odyssey.",
    updated: "29 septembre 2026",
    sections: [
      {
        heading: "Objet et acceptation",
        body: `<p>Class Odyssey est un service en ligne de gamification des leçons d'anglais destiné aux enseignants. La création d'un compte et l'utilisation du service supposent l'acceptation pleine et entière des présentes conditions ainsi que de la <a href="#politique-de-confidentialite">Politique de confidentialité</a> et des <a href="#mentions-legales">Mentions légales</a>. Lors de l'inscription, cette acceptation est confirmée par une case à cocher ; pour un compte créé via Google, elle est demandée à la première connexion.</p>`
      },
      {
        heading: "Compte enseignant",
        body: `
          <p>L'utilisateur crée un compte personnel avec une adresse e-mail valide. Il s'engage à fournir des informations exactes et à les tenir à jour.</p>
          <p>Il est responsable de la confidentialité de ses identifiants et de toute activité effectuée depuis son compte. En cas d'accès non autorisé, il doit prévenir l'éditeur dans les meilleurs délais à ${MAILTO}.</p>`
      },
      {
        heading: "Usage acceptable",
        body: `
          <p>L'utilisateur s'engage à utiliser Class Odyssey dans un cadre pédagogique licite, sans porter atteinte aux droits de tiers. Il est notamment interdit de :</p>
          <ul>
            <li>tenter d'accéder sans autorisation à des comptes, données ou parties du service ;</li>
            <li>contourner ou perturber les mesures de sécurité, l'authentification ou les limitations d'usage ;</li>
            <li>extraire massivement les données, copier le service ou en faire un usage commercial sans autorisation écrite ;</li>
            <li>publier des contenus illicites, diffamatoires ou portant atteinte à la vie privée d'autrui.</li>
          </ul>`
      },
      {
        heading: "Données des élèves",
        body: `<p>L'enseignant est seul responsable des données de ses élèves qu'il saisit dans le service. Il s'engage à respecter le cadre légal applicable à son établissement, notamment l'information des parents et les autorisations éventuelles. Il lui est recommandé de ne saisir que les informations nécessaires. Le traitement de ces données est décrit dans la <a href="#politique-de-confidentialite">Politique de confidentialité</a>.</p>`
      },
      {
        heading: "Propriété intellectuelle",
        body: `<p>Class Odyssey et l'ensemble de ses éléments sont la propriété exclusive de l'éditeur, dans les conditions détaillées dans les <a href="#mentions-legales">Mentions légales</a>. L'utilisation pédagogique en classe par un enseignant et ses élèves est autorisée gratuitement pour le moment, à des fins non lucratives et sans revente.</p>`
      },
      {
        heading: "Disponibilité et version bêta",
        body: `<p>Le service est proposé en <strong>version bêta</strong>, gratuitement pour le moment. L'éditeur s'efforce de le maintenir disponible et à jour, sans garantir une disponibilité ininterrompue ni l'absence d'erreurs ou de pertes de données. Il est recommandé d'exporter régulièrement une sauvegarde de ses classes. Les fonctionnalités et les conditions d'accès peuvent évoluer à tout moment, sous réserve des règles applicables aux offres payantes ci-dessous.</p>`
      },
      {
        heading: "Offres payantes et prix",
        body: `
          <p>Class Odyssey est <strong>gratuit pour le moment</strong> : aucun paiement n'est demandé à ce jour. Les clauses de cette section et des trois suivantes ne s'appliquent qu'à partir de l'introduction d'offres payantes (achat ponctuel ou abonnement), dont les caractéristiques, la durée et le prix sont alors présentés avant toute commande.</p>
          <p>Les prix sont indiqués en <strong>francs suisses (CHF)</strong>. Si l'éditeur est assujetti à la TVA, celle-ci est mentionnée avant la validation de la commande. Le prix applicable est celui affiché au moment de la commande.</p>
          <p>Un achat ou un abonnement confère à l'utilisateur un droit d'utilisation personnel, non exclusif et non transférable des fonctionnalités concernées, dans les limites des présentes conditions et des <a href="#mentions-legales">Mentions légales</a>.</p>`
      },
      {
        heading: "Commande et paiement",
        body: `
          <p>Avant de payer, l'utilisateur voit le récapitulatif de sa commande (offre, prix en CHF, durée, reconduction éventuelle) et peut corriger ses saisies. Il finalise l'achat en confirmant explicitement sa commande, puis reçoit une confirmation par e-mail. Le contrat est conclu lorsque la commande est confirmée et le paiement accepté.</p>
          <p>Les paiements en ligne sont traités par <strong>Stripe</strong> sur une page de paiement sécurisée. Selon les cas, les moyens de paiement proposés comprennent les cartes bancaires et <strong>TWINT</strong> ; ceux réellement disponibles sont affichés au moment du paiement. L'éditeur n'a pas accès aux numéros de carte ni aux identifiants de paiement, et ne les conserve pas.</p>
          <p>En cas d'échec ou de refus du paiement, la commande n'est pas confirmée. Les données de paiement sont traitées comme décrit dans la <a href="#politique-de-confidentialite">Politique de confidentialité</a>.</p>`
      },
      {
        heading: "Abonnements",
        body: `
          <p>Lorsqu'une offre est proposée sous forme d'abonnement, elle est facturée à intervalle régulier (par exemple mensuel ou annuel, selon l'offre choisie) et <strong>reconduite automatiquement</strong> à chaque échéance jusqu'à résiliation. La périodicité, le prix et la date du prochain prélèvement sont indiqués avant la commande, et le moyen de paiement enregistré est débité à chaque échéance.</p>
          <p>L'utilisateur peut <strong>résilier à tout moment</strong> depuis l'espace de gestion de l'abonnement lorsqu'il est disponible, ou à défaut par e-mail à ${MAILTO}. La résiliation prend effet à la fin de la période de facturation en cours : l'accès aux fonctionnalités payantes est maintenu jusqu'à cette date et aucun nouveau prélèvement n'est effectué ensuite.</p>
          <p>L'éditeur peut modifier le prix ou les caractéristiques d'un abonnement. Il en informe l'utilisateur à l'avance par e-mail, et la modification ne s'applique qu'à partir de la période suivante ; l'utilisateur peut résilier avant son entrée en vigueur.</p>
          <p>En cas d'échec d'un prélèvement, l'éditeur peut réessayer le paiement, en informer l'utilisateur, puis suspendre l'accès aux fonctionnalités payantes tant que la situation n'est pas régularisée.</p>`
      },
      {
        heading: "Rétractation et remboursements",
        body: `
          <p>En l'état du droit suisse, il n'existe pas de droit de rétractation général pour les achats effectués en ligne. Sous réserve des droits impératifs dont l'utilisateur pourrait bénéficier selon son pays de résidence, et sauf engagement contraire indiqué au moment de la commande, les paiements effectués ne sont donc pas remboursables de plein droit.</p>
          <p>Toute demande de remboursement (paiement erroné, prélèvement en double, problème technique empêchant l'usage du service) peut être adressée à ${MAILTO} ; elle est examinée de bonne foi, au cas par cas. Un remboursement accepté est effectué par le même moyen de paiement.</p>`
      },
      {
        heading: "Monnaie et objets virtuels du jeu",
        body: `<p>Les pièces, les objets et les récompenses du jeu (y compris la boutique de la classe) sont des éléments <strong>virtuels</strong> obtenus en jouant en classe. Ils n'ont aucune valeur monétaire, ne sont ni remboursables ni échangeables contre de l'argent et, sauf mention explicite au moment de l'achat, ne peuvent pas être acquis avec de l'argent réel.</p>`
      },
      {
        heading: "Responsabilité",
        body: `<p>Dans les limites permises par le droit suisse, la responsabilité de l'éditeur ne saurait être engagée pour les dommages directs ou indirects résultant de l'utilisation ou de l'impossibilité d'utiliser le service, notamment en cas de perte de données. L'utilisateur demeure responsable de la sauvegarde de ses données et de l'usage qu'il fait du service.</p>`
      },
      {
        heading: "Suspension et suppression",
        body: `<p>L'utilisateur peut cesser d'utiliser le service à tout moment et demander la suppression de son compte. L'éditeur peut suspendre ou supprimer un compte en cas de manquement grave aux présentes conditions, notamment pour un usage illicite, une atteinte à la sécurité du service ou un impayé persistant, après information lorsque cela est possible. Les abonnements sont résiliables à tout moment dans les conditions décrites ci-dessus.</p>`
      },
      {
        heading: "Modification des conditions",
        body: `<p>Les présentes conditions peuvent être mises à jour pour refléter des évolutions légales ou techniques. La date de dernière modification figure en haut de page. En cas de changement substantiel, l'utilisateur est invité à accepter la nouvelle version lors de sa prochaine connexion.</p>`
      },
      {
        heading: "Droit applicable",
        body: `<p>Les présentes conditions sont régies par le droit suisse. Sous réserve des dispositions impératives en matière de for, tout litige relève de la compétence exclusive des tribunaux ordinaires du canton de Genève, Suisse.</p>`
      }
    ]
  },
  en: {
    kicker: "Usage framework",
    title: "Terms of use",
    lede: "The rules that apply when creating an account and using Class Odyssey.",
    updated: "29 September 2026",
    sections: [
      {
        heading: "Purpose and acceptance",
        body: `<p>Class Odyssey is an online service that gamifies English lessons for teachers. Creating an account and using the service require full acceptance of these terms, the <a href="#politique-de-confidentialite">Privacy policy</a> and the <a href="#mentions-legales">Legal notice</a>. At sign-up this acceptance is confirmed by a checkbox; for an account created through Google, it is requested at first sign-in.</p>`
      },
      {
        heading: "Teacher account",
        body: `
          <p>The user creates a personal account with a valid email address and undertakes to provide accurate information and keep it up to date.</p>
          <p>The user is responsible for keeping their credentials confidential and for all activity carried out from their account. In the event of unauthorised access, they must notify the publisher promptly at ${MAILTO}.</p>`
      },
      {
        heading: "Acceptable use",
        body: `
          <p>The user undertakes to use Class Odyssey for lawful educational purposes, without infringing the rights of others. In particular, it is prohibited to:</p>
          <ul>
            <li>attempt to access accounts, data or parts of the service without authorisation;</li>
            <li>circumvent or disrupt security measures, authentication or usage limits;</li>
            <li>mass-extract data, copy the service or use it commercially without written authorisation;</li>
            <li>publish unlawful or defamatory content, or content that breaches the privacy of others.</li>
          </ul>`
      },
      {
        heading: "Pupil data",
        body: `<p>The teacher is solely responsible for the data of their pupils entered into the service. They undertake to comply with the legal framework applicable to their institution, in particular informing parents and obtaining any required authorisations. They should enter only the information that is necessary. The processing of that data is described in the <a href="#politique-de-confidentialite">Privacy policy</a>.</p>`
      },
      {
        heading: "Intellectual property",
        body: `<p>Class Odyssey and all of its components are the exclusive property of the publisher, as detailed in the <a href="#mentions-legales">Legal notice</a>. Classroom use by a teacher and their pupils is authorised free of charge for the time being, for non-profit purposes and without resale.</p>`
      },
      {
        heading: "Availability and beta version",
        body: `<p>The service is offered as a <strong>beta version</strong>, free of charge for the time being. The publisher strives to keep it available and up to date, without guaranteeing uninterrupted availability or the absence of errors or data loss. Exporting a backup of your classes regularly is recommended. Features and access conditions may change at any time, subject to the rules for paid offers below.</p>`
      },
      {
        heading: "Paid offers and prices",
        body: `
          <p>Class Odyssey is <strong>free for the time being</strong>: no payment is requested today. The clauses in this section and the next three apply only once paid offers (a one-off purchase or a subscription) are introduced; their features, duration and price are then presented before any order.</p>
          <p>Prices are shown in <strong>Swiss francs (CHF)</strong>. If the publisher is subject to VAT, it is shown before the order is confirmed. The applicable price is the one displayed at the time of the order.</p>
          <p>A purchase or subscription grants the user a personal, non-exclusive, non-transferable right to use the relevant features, within the limits of these terms and of the <a href="#mentions-legales">Legal notice</a>.</p>`
      },
      {
        heading: "Ordering and payment",
        body: `
          <p>Before paying, the user sees the order summary (offer, price in CHF, duration, any renewal) and can correct their input. The purchase is completed by explicitly confirming the order, after which a confirmation is sent by email. The contract is concluded once the order is confirmed and the payment accepted.</p>
          <p>Online payments are processed by <strong>Stripe</strong> on a secure payment page. Depending on the case, the payment methods offered include bank cards and <strong>TWINT</strong>; those actually available are displayed at the time of payment. The publisher has no access to card numbers or payment credentials and does not store them.</p>
          <p>If a payment fails or is declined, the order is not confirmed. Payment data is processed as described in the <a href="#politique-de-confidentialite">Privacy policy</a>.</p>`
      },
      {
        heading: "Subscriptions",
        body: `
          <p>Where an offer is provided as a subscription, it is billed at regular intervals (for example monthly or yearly, depending on the chosen offer) and <strong>renews automatically</strong> at each due date until cancelled. The billing period, the price and the date of the next charge are shown before the order, and the saved payment method is charged at each due date.</p>
          <p>The user may <strong>cancel at any time</strong> from the subscription management area where available, or otherwise by email at ${MAILTO}. Cancellation takes effect at the end of the current billing period: access to the paid features is kept until then and no further charge is made afterwards.</p>
          <p>The publisher may change the price or features of a subscription. It informs the user in advance by email, and the change applies only from the following period; the user may cancel before it takes effect.</p>
          <p>If a charge fails, the publisher may retry the payment, inform the user and then suspend access to the paid features until the situation is resolved.</p>`
      },
      {
        heading: "Withdrawal and refunds",
        body: `
          <p>As Swiss law currently stands, there is no general right of withdrawal for purchases made online. Subject to mandatory rights the user may enjoy under the law of their country of residence, and unless a different commitment is stated at the time of the order, payments made are therefore not refundable as of right.</p>
          <p>Any refund request (mistaken payment, duplicate charge, technical problem preventing use of the service) can be sent to ${MAILTO} and will be examined in good faith, case by case. An approved refund is made through the same payment method.</p>`
      },
      {
        heading: "Virtual currency and in-game items",
        body: `<p>The coins, items and rewards in the game (including the classroom shop) are <strong>virtual</strong> elements earned by playing in class. They have no monetary value, cannot be refunded or exchanged for money and, unless explicitly stated at the time of purchase, cannot be acquired with real money.</p>`
      },
      {
        heading: "Liability",
        body: `<p>To the extent permitted by Swiss law, the publisher cannot be held liable for direct or indirect damage resulting from the use of, or inability to use, the service, in particular in the event of data loss. The user remains responsible for backing up their data and for their use of the service.</p>`
      },
      {
        heading: "Suspension and deletion",
        body: `<p>The user may stop using the service at any time and request the deletion of their account. The publisher may suspend or delete an account in the event of a serious breach of these terms, in particular for unlawful use, an attack on the security of the service or a persistent non-payment, informing the user where possible. Subscriptions can be cancelled at any time as described above.</p>`
      },
      {
        heading: "Changes to the terms",
        body: `<p>These terms may be updated to reflect legal or technical developments. The last update date appears at the top of the page. In the event of a substantial change, the user is invited to accept the new version at their next sign-in.</p>`
      },
      {
        heading: "Governing law",
        body: `<p>These terms are governed by Swiss law. Subject to mandatory provisions on jurisdiction, any dispute falls under the exclusive jurisdiction of the ordinary courts of the canton of Geneva, Switzerland.</p>`
      }
    ]
  }
};

const CONFIDENTIALITE = {
  fr: {
    kicker: "Vie privée",
    title: "Politique de confidentialité",
    lede: "Comment nous collectons, utilisons et protégeons vos données personnelles.",
    updated: "29 septembre 2026",
    sections: [
      {
        heading: "Responsable du traitement",
        body: `
          <p><strong>Thomas Wünsche</strong>, activité indépendante, Suisse.</p>
          <p>13 chemin des Troènes, 1213 Petit-Lancy, Genève, Suisse<br />${MAILTO}</p>
          <p>N'atteignant pas les seuils légaux, nous ne sommes pas tenus de désigner un délégué à la protection des données. Pour toute question relative à vos données, vous pouvez nous écrire à l'adresse ci-dessus.</p>`
      },
      {
        heading: "Données que nous traitons",
        body: `
          <h3>1. Données de compte (enseignant)</h3>
          <p>Lors de la création d'un compte, nous traitons : l'adresse e-mail, le nom d'utilisateur qui en dérive, le mot de passe (conservé uniquement sous forme hachée), la date de création et la date de dernière connexion. Le mot de passe n'est jamais conservé en clair. Si vous choisissez Google, nous recevons de Google votre adresse e-mail vérifiée et votre nom. Votre mot de passe Google n'est jamais communiqué à Class Odyssey ; le mot de passe distinct de la console du professeur est conservé uniquement sous forme hachée.</p>
          <h3>2. Données de classe et des élèves</h3>
          <p>Pour faire fonctionner le jeu, l'enseignant saisit des données concernant ses élèves : prénom, personnage choisi, apparence, niveau, XP, points de vie, pièces et achats. Ces données peuvent concerner des mineurs (élèves d'environ 11 à 13 ans). Elles sont saisies par l'enseignant, qui est responsable de disposer du fondement légal ou de l'accord nécessaire pour ce traitement.</p>
          <h3>3. Données conservées sur votre appareil</h3>
          <p>Le navigateur conserve localement, pour le compte connecté, un jeton de session, vos préférences (thème, langue), l'identifiant de l'élève consulté et une copie de progression hors ligne. Ces éléments sont strictement nécessaires au service. La mesure d'audience (Google Analytics 4) n'est activée qu'après votre consentement : aucun cookie de mesure n'est déposé avant ce choix.</p>
          <h3>4. Données techniques</h3>
          <p>L'hébergeur peut traiter votre adresse IP et des journaux de connexion à des fins de sécurité, de diagnostic et de bon fonctionnement de l'application. Lorsque vous y consentez, Google Analytics 4 traite des données de navigation agrégées et une adresse IP anonymisée (voir « Cookies et technologies de suivi »).</p>
          <h3>5. Données de facturation et de paiement (offres payantes)</h3>
          <p>Aucun paiement n'est demandé à ce jour. Lorsque des offres payantes seront proposées, le paiement s'effectuera sur une page sécurisée de <strong>Stripe</strong> et, si vous choisissez ce moyen, par <strong>TWINT</strong>. Stripe et TWINT collectent directement les données nécessaires au paiement : numéro de carte ou identifiants TWINT, nom et, le cas échéant, adresse de facturation. Class Odyssey ne reçoit et ne conserve que le strict nécessaire : identifiant client et d'abonnement Stripe, offre choisie, montant et devise, dates, statut du paiement et de l'abonnement, adresse e-mail de facturation. Aucun numéro de carte n'est enregistré sur nos serveurs.</p>`
      },
      {
        heading: "Finalités et bases légales",
        body: `
          <p>Au sens du RGPD, nous traitons vos données sur les bases légales suivantes (la LPD ne soumet pas le traitement à une base légale formelle, mais exige qu'il soit licite, proportionné et effectué de bonne foi) :</p>
          <ul>
            <li><strong>Fournir le service</strong> (comptes, classes, progression, boutique) — exécution du contrat ou de mesures précontractuelles (art. 6 §1 lit. b RGPD).</li>
            <li><strong>Assurer la sécurité</strong> et prévenir les abus, y compris la fraude au paiement — intérêt légitime (art. 6 §1 lit. f RGPD).</li>
            <li><strong>Gérer les commandes, paiements et abonnements</strong> (offres payantes) — exécution du contrat (art. 6 §1 lit. b RGPD).</li>
            <li><strong>Respecter nos obligations comptables et légales</strong> — obligation légale (art. 6 §1 lit. c RGPD).</li>
            <li><strong>Répondre à vos demandes</strong> — votre consentement ou l'exécution de mesures précontractuelles (art. 6 §1 lit. a et b RGPD).</li>
            <li><strong>Mesurer l'audience</strong> afin d'améliorer le service — votre consentement (art. 6 §1 lit. a RGPD), révocable à tout moment via le bouton « Gérer les cookies ».</li>
          </ul>`
      },
      {
        heading: "Cookies et technologies de suivi",
        body: `
          <p>Class Odyssey utilise des cookies et technologies similaires <strong>strictement nécessaires</strong> à son fonctionnement, ainsi qu'une mesure d'audience soumise à votre <strong>consentement</strong>. Rien n'est déposé pour la mesure d'audience tant que vous n'avez pas fait un choix explicite dans le bandeau de consentement.</p>
          <h3>Cookies strictement nécessaires</h3>
          <p>Session et authentification du compte, sécurité des requêtes, préférences d'affichage (thème, langue). La connexion Google utilise un cookie temporaire strictement nécessaire au retour sécurisé de Google ; il est supprimé après la connexion. Ces éléments ne servent à aucun suivi publicitaire ni profilage. Le cookie <code>tarteaucitron</code> mémorise vos choix de consentement ; il est lui aussi strictement nécessaire.</p>
          <h3>Mesure d'audience (Google Analytics 4)</h3>
          <p>Avec votre accord uniquement, nous utilisons <strong>Google Analytics 4</strong> pour comprendre comment l'application est utilisée : pages consultées, durée de visite, parcours, type d'appareil, source de la visite et interactions (défilement, clics sortants). L'adresse IP est anonymisée avant enregistrement et les données sont exploitées sous forme agrégée, à des fins d'amélioration du service uniquement. Durée de conservation : jusqu'à 14 mois. Vous pouvez retirer votre accord à tout moment sans que cela affecte l'utilisation du service.</p>
          <h3>Publicité (Google Ads)</h3>
          <p>Class Odyssey ne diffuse pas de publicité à ce jour. Si des campagnes Google Ads étaient lancées, leur mesure d'efficacité et le remarketing reposeraient sur votre consentement préalable, recueilli via le même bandeau et révocable à tout moment. Les cookies publicitaires Google ont une durée pouvant aller jusqu'à 13 mois.</p>
          <h3>Paiement (Stripe)</h3>
          <p>Le paiement se déroule sur une page hébergée par Stripe, qui peut déposer ses propres cookies, strictement nécessaires à la sécurité et à la prévention de la fraude, selon sa <a href="https://stripe.com/privacy">politique de confidentialité</a>. À ce jour, Class Odyssey ne charge aucun script Stripe sur ses propres pages.</p>
          <h3>Gérer ou refuser les cookies</h3>
          <p>Vous pouvez modifier ou retirer votre choix à tout moment grâce au bouton <strong>« Gérer les cookies »</strong> présent en pied de page. Conformément à l'art. 45c de la loi fédérale sur les télécommunications (LTC), vous pouvez également configurer votre navigateur pour bloquer ou supprimer les cookies. Le blocage des cookies strictement nécessaires empêche toutefois la connexion et l'utilisation du compte.</p>`
      },
      {
        heading: "Hébergement et destinataires des données",
        body: `<p><strong>Infomaniak Network SA</strong> (Rue Eugène-Marziano 25, 1227 Les Acacias, Genève, Suisse) héberge l'application et les données sur des serveurs situés en Suisse. Vos données ne sont ni vendues, ni louées, ni transmises à des tiers à des fins commerciales.</p><p>Lorsque des offres payantes seront proposées, les données nécessaires au paiement seront communiquées à <strong>Stripe</strong> (<a href="https://stripe.com/privacy">politique de confidentialité de Stripe</a>) et, si vous payez par TWINT, à <strong>TWINT AG</strong> (Suisse), en tant que prestataires de paiement. Ils les traitent selon leurs propres politiques de confidentialité.</p>`
      },
      {
        heading: "Transferts de données à l'étranger",
        body: `<p>Les données des comptes et des classes sont hébergées en Suisse. Si vous choisissez la connexion Google, votre navigateur est redirigé vers Google pour l'authentification ; Google traite les données nécessaires à celle-ci selon sa propre politique, et nous recevons votre adresse e-mail vérifiée et votre nom. Séparément, si vous consentez à la mesure d'audience, les données de navigation agrégées sont traitées par Google (Google Ireland Limited et, le cas échéant, Google LLC) dans le cadre des garanties appropriées prévues par le RGPD. Sans ce consentement, Google Analytics ne reçoit aucune donnée de navigation. Les polices sont servies localement. Lorsque des offres payantes seront proposées, Stripe pourra traiter les données de paiement en dehors de la Suisse et de l'Union européenne, notamment aux États-Unis, dans le cadre des garanties appropriées prévues par la LPD et le RGPD.</p>`
      },
      {
        heading: "Durée de conservation",
        body: `<p>Les données de compte et de classe sont conservées tant que le compte existe ou tant qu'elles sont nécessaires à la fourniture du service. L'enseignant peut supprimer un élève, une classe ou l'ensemble de ses données depuis l'application ; une sauvegarde peut être exportée avant suppression. Les journaux techniques sont conservés pour une durée limitée. Les pièces comptables et justificatifs de paiement (factures, montants, dates) sont conservés dix ans, conformément au droit suisse (art. 958f CO).</p>`
      },
      {
        heading: "Vos droits",
        body: `
          <p>Conformément à la LPD et au RGPD, vous disposez des droits suivants sur vos données personnelles :</p>
          <ul>
            <li><strong>Droit d'accès</strong> — obtenir confirmation et copie des données vous concernant.</li>
            <li><strong>Droit de rectification</strong> — corriger des données inexactes ou incomplètes.</li>
            <li><strong>Droit à l'effacement</strong> — demander la suppression de vos données.</li>
            <li><strong>Droit d'opposition et de limitation</strong> — vous opposer à un traitement ou en demander la limitation.</li>
            <li><strong>Droit à la portabilité</strong> — recevoir vos données dans un format structuré et lisible par machine.</li>
            <li><strong>Droit de retrait du consentement</strong> — retirer à tout moment votre consentement, sans effet sur la licéité du traitement effectué auparavant.</li>
          </ul>
          <p>Pour exercer ces droits, écrivez-nous à ${MAILTO}. Nous répondrons dans les meilleurs délais et au plus tard dans les 30 jours.</p>
          <p>Si vous estimez que vos droits ne sont pas respectés, vous pouvez vous adresser au <a href="https://www.edoeb.admin.ch">Préposé fédéral à la protection des données et à la transparence (PFPDT)</a> en Suisse, ou, si vous résidez dans l'Union européenne, à l'autorité de contrôle de votre pays.</p>`
      },
      {
        heading: "Données des élèves et des mineurs",
        body: `<p>Class Odyssey est avant tout un outil destiné aux enseignants. Les données des élèves sont saisies par l'enseignant, qui s'engage à respecter le cadre légal applicable à son établissement (information des parents, autorisations éventuelles). Nous ne collectons pas directement de données auprès des élèves, ne leur adressons aucune publicité et ne demandons aucune donnée sensible. Le prénom est la seule donnée d'identification requise pour créer un personnage ; il est recommandé de n'utiliser que les informations nécessaires. Les éventuelles offres payantes s'adressent aux enseignants ou à leur établissement : aucun paiement ni aucune donnée de paiement n'est demandé aux élèves.</p>`
      },
      {
        heading: "Sécurité des données",
        body: `<p>Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données contre tout accès non autorisé, altération, divulgation ou destruction. Les mots de passe sont hachés, les sessions sont limitées dans le temps et l'accès aux données est restreint. Les données de carte bancaire sont traitées exclusivement par Stripe et ne transitent pas par nos serveurs.</p>`
      },
      {
        heading: "Modifications",
        body: `<p>Cette politique peut être mise à jour pour refléter des évolutions légales ou techniques. La date de dernière modification figure en haut de page. Nous vous invitons à la consulter régulièrement.</p>`
      },
      {
        heading: "Contact",
        body: `<p><strong>Thomas Wünsche</strong> — ${MAILTO}<br />Genève, Suisse</p>`
      }
    ]
  },
  en: {
    kicker: "Privacy",
    title: "Privacy policy",
    lede: "How we collect, use and protect your personal data.",
    updated: "29 September 2026",
    sections: [
      {
        heading: "Data controller",
        body: `
          <p><strong>Thomas Wünsche</strong>, independent activity, Switzerland.</p>
          <p>13 chemin des Troènes, 1213 Petit-Lancy, Geneva, Switzerland<br />${MAILTO}</p>
          <p>As we do not reach the legal thresholds, we are not required to appoint a data protection officer. For any question about your data, you can write to the address above.</p>`
      },
      {
        heading: "Data we process",
        body: `
          <h3>1. Account data (teacher)</h3>
          <p>When an account is created, we process: the email address, the username derived from it, the password (stored only in hashed form), the creation date and the last sign-in date. The password is never stored in clear text. If you choose Google, we receive your verified email address and name from Google. Your Google password is never shared with Class Odyssey; the separate teacher console password is stored only as a hash.</p>
          <h3>2. Class and pupil data</h3>
          <p>To run the game, the teacher enters data about their pupils: first name, chosen character, appearance, level, XP, hit points, coins and purchases. This data may concern minors (pupils aged roughly 11 to 13). It is entered by the teacher, who is responsible for having the legal basis or necessary consent for that processing.</p>
          <h3>3. Data stored on your device</h3>
          <p>The browser stores locally, for the signed-in account, a session token, your preferences (theme, language), the selected pupil identifier and an offline progress copy. These are strictly necessary for the service. Audience measurement (Google Analytics 4) is only activated after your consent: no measurement cookie is stored before that choice.</p>
          <h3>4. Technical data</h3>
          <p>The host may process your IP address and connection logs for security, diagnostics and the proper operation of the application. When you consent to it, Google Analytics 4 processes aggregated browsing data and an anonymised IP address (see “Cookies and tracking technologies”).</p>
          <h3>5. Billing and payment data (paid offers)</h3>
          <p>No payment is requested today. When paid offers are introduced, payment will be made on a secure <strong>Stripe</strong> page and, if you choose that method, through <strong>TWINT</strong>. Stripe and TWINT collect the data needed for the payment directly: card number or TWINT credentials, name and, where applicable, billing address. Class Odyssey receives and keeps only what is strictly necessary: Stripe customer and subscription identifiers, chosen offer, amount and currency, dates, payment and subscription status, and billing email address. No card number is stored on our servers.</p>`
      },
      {
        heading: "Purposes and legal bases",
        body: `
          <p>Within the meaning of the GDPR, we process your data on the following legal bases (the FADP does not require a formal legal basis, but requires processing to be lawful, proportionate and in good faith):</p>
          <ul>
            <li><strong>Providing the service</strong> (accounts, classes, progress, shop) — performance of the contract or pre-contractual steps (Art. 6(1)(b) GDPR).</li>
            <li><strong>Ensuring security</strong> and preventing abuse, including payment fraud — legitimate interest (Art. 6(1)(f) GDPR).</li>
            <li><strong>Managing orders, payments and subscriptions</strong> (paid offers) — performance of the contract (Art. 6(1)(b) GDPR).</li>
            <li><strong>Complying with our accounting and legal obligations</strong> — legal obligation (Art. 6(1)(c) GDPR).</li>
            <li><strong>Responding to your requests</strong> — your consent or performance of pre-contractual steps (Art. 6(1)(a) and (b) GDPR).</li>
            <li><strong>Measuring audience</strong> in order to improve the service — your consent (Art. 6(1)(a) GDPR), revocable at any time via the “Manage cookies” button.</li>
          </ul>`
      },
      {
        heading: "Cookies and tracking technologies",
        body: `
          <p>Class Odyssey uses cookies and similar technologies that are <strong>strictly necessary</strong> for its operation, as well as audience measurement subject to your <strong>consent</strong>. Nothing is stored for audience measurement until you have made an explicit choice in the consent banner.</p>
          <h3>Strictly necessary cookies</h3>
          <p>Account session and authentication, request security, display preferences (theme, language). Google sign-in uses a temporary cookie strictly necessary for the secure return from Google; it is removed after sign-in. These elements are not used for advertising or profiling. The <code>tarteaucitron</code> cookie remembers your consent choices; it is also strictly necessary.</p>
          <h3>Audience measurement (Google Analytics 4)</h3>
          <p>Only with your agreement do we use <strong>Google Analytics 4</strong> to understand how the application is used: pages viewed, visit duration, navigation paths, device type, traffic source and interactions (scrolling, outbound clicks). The IP address is anonymised before storage and the data is used in aggregate form, solely to improve the service. Retention period: up to 14 months. You may withdraw your agreement at any time without affecting your use of the service.</p>
          <h3>Advertising (Google Ads)</h3>
          <p>Class Odyssey currently displays no advertising. If Google Ads campaigns were launched, their effectiveness measurement and remarketing would rely on your prior consent, collected through the same banner and revocable at any time. Google advertising cookies have a lifetime of up to 13 months.</p>
          <h3>Payment (Stripe)</h3>
          <p>Payment takes place on a page hosted by Stripe, which may set its own cookies, strictly necessary for security and fraud prevention, under its <a href="https://stripe.com/privacy">privacy policy</a>. To date, Class Odyssey loads no Stripe script on its own pages.</p>
          <h3>Managing or refusing cookies</h3>
          <p>You can change or withdraw your choice at any time using the <strong>“Manage cookies”</strong> button in the page footer. In accordance with Art. 45c of the Swiss Federal Act on Telecommunications (TCA), you may also configure your browser to block or delete cookies. Blocking strictly necessary cookies will, however, prevent sign-in and use of the account.</p>`
      },
      {
        heading: "Hosting and recipients of the data",
        body: `<p><strong>Infomaniak Network SA</strong> (Rue Eugène-Marziano 25, 1227 Les Acacias, Geneva, Switzerland) hosts the application and the data on servers located in Switzerland. Your data is neither sold nor rented, nor passed on to third parties for commercial purposes.</p><p>When paid offers are introduced, the data needed for payment will be shared with <strong>Stripe</strong> (<a href="https://stripe.com/privacy">Stripe's privacy policy</a>) and, if you pay with TWINT, with <strong>TWINT AG</strong> (Switzerland), as payment service providers. They process it under their own privacy policies.</p>`
      },
      {
        heading: "Transfers of data abroad",
        body: `<p>Account and class data is hosted in Switzerland. If you choose Google sign-in, your browser is redirected to Google for authentication; Google processes the data necessary for this under its own privacy policy, and we receive your verified email address and name. Separately, if you consent to audience measurement, aggregated browsing data is processed by Google (Google Ireland Limited and, where applicable, Google LLC) under appropriate GDPR safeguards. Without that consent, Google Analytics receives no browsing data. Fonts are served locally. When paid offers are introduced, Stripe may process payment data outside Switzerland and the European Union, in particular in the United States, under the appropriate safeguards provided for by the FADP and the GDPR.</p>`
      },
      {
        heading: "Retention period",
        body: `<p>Account and class data is kept for as long as the account exists or as long as it is needed to provide the service. The teacher can delete a pupil, a class or all of their data from the application; a backup can be exported before deletion. Technical logs are kept for a limited period. Accounting records and payment vouchers (invoices, amounts, dates) are kept for ten years, in accordance with Swiss law (Art. 958f CO).</p>`
      },
      {
        heading: "Your rights",
        body: `
          <p>Under the FADP and the GDPR, you have the following rights over your personal data:</p>
          <ul>
            <li><strong>Right of access</strong> — obtain confirmation and a copy of the data concerning you.</li>
            <li><strong>Right to rectification</strong> — correct inaccurate or incomplete data.</li>
            <li><strong>Right to erasure</strong> — request the deletion of your data.</li>
            <li><strong>Right to object and to restrict</strong> — object to processing or request that it be restricted.</li>
            <li><strong>Right to data portability</strong> — receive your data in a structured, machine-readable format.</li>
            <li><strong>Right to withdraw consent</strong> — withdraw your consent at any time, without affecting the lawfulness of prior processing.</li>
          </ul>
          <p>To exercise these rights, write to us at ${MAILTO}. We will respond as soon as possible and no later than within 30 days.</p>
          <p>If you believe your rights are not being respected, you can contact the <a href="https://www.edoeb.admin.ch">Federal Data Protection and Information Commissioner (FDPIC)</a> in Switzerland, or, if you reside in the European Union, the supervisory authority of your country.</p>`
      },
      {
        heading: "Pupil and minor data",
        body: `<p>Class Odyssey is primarily a tool for teachers. Pupil data is entered by the teacher, who undertakes to comply with the legal framework applicable to their institution (informing parents, any required authorisations). We do not collect data directly from pupils, send them no advertising and request no sensitive data. The first name is the only identifying data needed to create a character; using only the necessary information is recommended. Any paid offers are aimed at teachers or their institution: no payment and no payment data is requested from pupils.</p>`
      },
      {
        heading: "Data security",
        body: `<p>We implement appropriate technical and organisational measures to protect your data against unauthorised access, alteration, disclosure or destruction. Passwords are hashed, sessions are time-limited and access to data is restricted. Bank card data is processed exclusively by Stripe and does not pass through our servers.</p>`
      },
      {
        heading: "Changes",
        body: `<p>This policy may be updated to reflect legal or technical developments. The last update date appears at the top of the page. We invite you to review it regularly.</p>`
      },
      {
        heading: "Contact",
        body: `<p><strong>Thomas Wünsche</strong> — ${MAILTO}<br />Geneva, Switzerland</p>`
      }
    ]
  }
};

function renderSections(sections = []) {
  return sections.map((section) => `
    <section class="legal-section">
      <h2>${section.heading}</h2>
      ${section.body}
    </section>`).join("");
}

function renderDoc(doc) {
  return `
    <article class="legal">
      <header class="legal-head">
        <p class="legal-kicker">${doc.kicker}</p>
        <h1>${doc.title}</h1>
        <p class="lede">${doc.lede}</p>
        ${doc.updated ? `<p class="legal-updated">${t("doc.updated", { date: doc.updated })}</p>` : ""}
      </header>
      ${renderSections(doc.sections)}
    </article>`;
}

function localized(documents) {
  return documents[getLang()] || documents.fr;
}

export function renderMentions() {
  return renderDoc(localized(MENTIONS_LEGALES));
}

export function renderPrivacy() {
  return renderDoc(localized(CONFIDENTIALITE));
}

export function renderTerms() {
  return renderDoc(localized(CONDITIONS));
}
