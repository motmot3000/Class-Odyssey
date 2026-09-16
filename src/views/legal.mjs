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
        body: `<p>Class Odyssey est actuellement proposé en <strong>version bêta</strong>. L'accès est <strong>gratuit pour le moment</strong> et pourrait devenir payant à l'avenir. Les fonctionnalités, les conditions d'accès et les tarifs peuvent évoluer à tout moment et sans préavis. En version bêta, des bugs, des interruptions ou des pertes de données ne peuvent être exclus ; il est recommandé d'exporter régulièrement une sauvegarde de vos classes.</p>`
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
        body: `<p>La collecte et le traitement des données personnelles dans le cadre de l'utilisation de Class Odyssey sont décrits dans notre <a href="#politique-de-confidentialite">Politique de confidentialité</a>, conforme à la loi fédérale sur la protection des données (LPD révisée, en vigueur depuis le 1er septembre 2023) et, pour les personnes concernées, au Règlement général sur la protection des données de l'Union européenne (RGPD).</p>`
      },
      {
        heading: "Cookies",
        body: `<p>Class Odyssey utilise des cookies et un stockage local strictement nécessaires à son fonctionnement, notamment pour maintenir la session d'un compte connecté. Ces cookies sont obligatoires pour créer un compte et pour se connecter ; leur utilisation est confirmée par une case à cocher lors de la création de compte ou de la connexion. Leurs catégories, leurs finalités et les moyens de les gérer sont détaillés dans la section « Cookies et technologies de suivi » de notre <a href="#politique-de-confidentialite">Politique de confidentialité</a>.</p>`
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
        body: `<p>Class Odyssey is currently offered as a <strong>beta version</strong>. Access is <strong>free for the time being</strong> and may become paid in the future. Features, access conditions and pricing may change at any time without notice. In a beta version, bugs, interruptions or data loss cannot be ruled out; exporting a backup of your classes regularly is recommended.</p>`
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
        body: `<p>The collection and processing of personal data in connection with the use of Class Odyssey are described in our <a href="#politique-de-confidentialite">Privacy policy</a>, which complies with the Swiss Federal Act on Data Protection (revised FADP, in force since 1 September 2023) and, where applicable, the European Union General Data Protection Regulation (GDPR).</p>`
      },
      {
        heading: "Cookies",
        body: `<p>Class Odyssey uses cookies and local storage that are strictly necessary for its operation, in particular to maintain a signed-in account session. These cookies are required to create an account and to sign in; their use is confirmed by a checkbox on account creation or sign-in. Their categories, purposes and the means to manage them are detailed in the “Cookies and tracking technologies” section of our <a href="#politique-de-confidentialite">Privacy policy</a>.</p>`
      },
      {
        heading: "Governing law and jurisdiction",
        body: `<p>This application and its content are governed by Swiss law. Subject to mandatory provisions on jurisdiction, any dispute relating to its use or content falls under the exclusive jurisdiction of the ordinary courts of the canton of Geneva, Switzerland.</p>`
      }
    ]
  }
};

const CONFIDENTIALITE = {
  fr: {
    kicker: "Vie privée",
    title: "Politique de confidentialité",
    lede: "Comment nous collectons, utilisons et protégeons vos données personnelles.",
    updated: "16 septembre 2026",
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
          <p>Lors de la création d'un compte, nous traitons : le nom d'affichage de la classe, le nom d'utilisateur, le mot de passe (conservé uniquement sous forme hachée), la date de création et la date de dernière connexion. Le mot de passe n'est jamais conservé en clair.</p>
          <h3>2. Données de classe et des élèves</h3>
          <p>Pour faire fonctionner le jeu, l'enseignant saisit des données concernant ses élèves : prénom, personnage choisi, apparence, niveau, XP, points de vie, pièces et achats. Ces données peuvent concerner des mineurs (élèves d'environ 11 à 13 ans). Elles sont saisies par l'enseignant, qui est responsable de disposer du fondement légal ou de l'accord nécessaire pour ce traitement.</p>
          <h3>3. Données conservées sur votre appareil</h3>
          <p>Le navigateur conserve localement, pour le compte connecté, un jeton de session, vos préférences (thème, langue), l'identifiant de l'élève consulté et une copie de progression hors ligne. Aucun cookie publicitaire ni traceur tiers n'est déposé à ce jour.</p>
          <h3>4. Données techniques</h3>
          <p>L'hébergeur peut traiter votre adresse IP et des journaux de connexion à des fins de sécurité, de diagnostic et de bon fonctionnement de l'application.</p>`
      },
      {
        heading: "Finalités et bases légales",
        body: `
          <p>Au sens du RGPD, nous traitons vos données sur les bases légales suivantes (la LPD ne soumet pas le traitement à une base légale formelle, mais exige qu'il soit licite, proportionné et effectué de bonne foi) :</p>
          <ul>
            <li><strong>Fournir le service</strong> (comptes, classes, progression, boutique) — exécution du contrat ou de mesures précontractuelles (art. 6 §1 lit. b RGPD).</li>
            <li><strong>Assurer la sécurité</strong> et prévenir les abus — intérêt légitime (art. 6 §1 lit. f RGPD).</li>
            <li><strong>Répondre à vos demandes</strong> — votre consentement ou l'exécution de mesures précontractuelles (art. 6 §1 lit. a et b RGPD).</li>
          </ul>`
      },
      {
        heading: "Cookies et technologies de suivi",
        body: `
          <p>Class Odyssey utilise des cookies et technologies similaires <strong>strictement nécessaires</strong> à son fonctionnement. Ces cookies sont <strong>obligatoires</strong> pour créer un compte et pour se connecter : sans eux, aucune session ne peut être maintenue. Leur utilisation est portée à votre connaissance et confirmée par une case à cocher lors de la création de compte ou de la connexion.</p>
          <h3>Cookies strictement nécessaires</h3>
          <p>Session et authentification du compte, sécurité des requêtes, préférences d'affichage (thème, langue). Ils ne servent à aucun suivi publicitaire ni profilage et ne peuvent être désactivés sans empêcher la connexion.</p>
          <h3>Mesure d'audience et publicité</h3>
          <p>Class Odyssey n'utilise à ce jour ni mesure d'audience tierce ni cookie publicitaire. Si de telles technologies étaient ajoutées, votre consentement préalable serait recueilli et la présente politique mise à jour.</p>
          <h3>Gérer ou refuser les cookies</h3>
          <p>Conformément à l'art. 45c de la loi fédérale sur les télécommunications (LTC), vous pouvez à tout moment configurer votre navigateur pour bloquer ou supprimer les cookies. Le blocage des cookies strictement nécessaires empêche toutefois la connexion et l'utilisation du compte.</p>`
      },
      {
        heading: "Hébergement et destinataires des données",
        body: `<p><strong>Infomaniak Network SA</strong> (Rue Eugène-Marziano 25, 1227 Les Acacias, Genève, Suisse) héberge l'application et les données sur des serveurs situés en Suisse. Vos données ne sont ni vendues, ni louées, ni transmises à des tiers à des fins commerciales.</p>`
      },
      {
        heading: "Transferts de données à l'étranger",
        body: `<p>Les données sont hébergées en Suisse et Class Odyssey ne les transfère pas hors de Suisse. Les polices de caractères sont servies localement depuis le site : aucun appel à un service de polices tiers n'est effectué.</p>`
      },
      {
        heading: "Durée de conservation",
        body: `<p>Les données de compte et de classe sont conservées tant que le compte existe ou tant qu'elles sont nécessaires à la fourniture du service. L'enseignant peut supprimer un élève, une classe ou l'ensemble de ses données depuis l'application ; une sauvegarde peut être exportée avant suppression. Les journaux techniques sont conservés pour une durée limitée.</p>`
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
        body: `<p>Class Odyssey est avant tout un outil destiné aux enseignants. Les données des élèves sont saisies par l'enseignant, qui s'engage à respecter le cadre légal applicable à son établissement (information des parents, autorisations éventuelles). Nous ne collectons pas directement de données auprès des élèves, ne leur adressons aucune publicité et ne demandons aucune donnée sensible. Le prénom est la seule donnée d'identification requise pour créer un personnage ; il est recommandé de n'utiliser que les informations nécessaires.</p>`
      },
      {
        heading: "Sécurité des données",
        body: `<p>Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données contre tout accès non autorisé, altération, divulgation ou destruction. Les mots de passe sont hachés, les sessions sont limitées dans le temps et l'accès aux données est restreint.</p>`
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
    updated: "16 September 2026",
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
          <p>When an account is created, we process: the class display name, the username, the password (stored only in hashed form), the creation date and the last sign-in date. The password is never stored in clear text.</p>
          <h3>2. Class and pupil data</h3>
          <p>To run the game, the teacher enters data about their pupils: first name, chosen character, appearance, level, XP, hit points, coins and purchases. This data may concern minors (pupils aged roughly 11 to 13). It is entered by the teacher, who is responsible for having the legal basis or necessary consent for that processing.</p>
          <h3>3. Data stored on your device</h3>
          <p>The browser stores locally, for the signed-in account, a session token, your preferences (theme, language), the selected pupil identifier and an offline progress copy. No advertising cookie or third-party tracker is used to date.</p>
          <h3>4. Technical data</h3>
          <p>The host may process your IP address and connection logs for security, diagnostics and the proper operation of the application.</p>`
      },
      {
        heading: "Purposes and legal bases",
        body: `
          <p>Within the meaning of the GDPR, we process your data on the following legal bases (the FADP does not require a formal legal basis, but requires processing to be lawful, proportionate and in good faith):</p>
          <ul>
            <li><strong>Providing the service</strong> (accounts, classes, progress, shop) — performance of the contract or pre-contractual steps (Art. 6(1)(b) GDPR).</li>
            <li><strong>Ensuring security</strong> and preventing abuse — legitimate interest (Art. 6(1)(f) GDPR).</li>
            <li><strong>Responding to your requests</strong> — your consent or performance of pre-contractual steps (Art. 6(1)(a) and (b) GDPR).</li>
          </ul>`
      },
      {
        heading: "Cookies and tracking technologies",
        body: `
          <p>Class Odyssey uses cookies and similar technologies that are <strong>strictly necessary</strong> for its operation. These cookies are <strong>mandatory</strong> to create an account and to sign in: without them, no session can be maintained. Their use is brought to your attention and confirmed by a checkbox on account creation or sign-in.</p>
          <h3>Strictly necessary cookies</h3>
          <p>Account session and authentication, request security, display preferences (theme, language). They are not used for advertising or profiling and cannot be disabled without preventing sign-in.</p>
          <h3>Analytics and advertising</h3>
          <p>Class Odyssey currently uses no third-party analytics and no advertising cookie. If such technologies were added, your prior consent would be collected and this policy updated.</p>
          <h3>Managing or refusing cookies</h3>
          <p>In accordance with Art. 45c of the Swiss Federal Act on Telecommunications (TCA), you may configure your browser at any time to block or delete cookies. Blocking strictly necessary cookies will, however, prevent sign-in and use of the account.</p>`
      },
      {
        heading: "Hosting and recipients of the data",
        body: `<p><strong>Infomaniak Network SA</strong> (Rue Eugène-Marziano 25, 1227 Les Acacias, Geneva, Switzerland) hosts the application and the data on servers located in Switzerland. Your data is neither sold nor rented, nor passed on to third parties for commercial purposes.</p>`
      },
      {
        heading: "Transfers of data abroad",
        body: `<p>The data is hosted in Switzerland and Class Odyssey does not transfer it outside Switzerland. Fonts are served locally from the site: no third-party font service is called.</p>`
      },
      {
        heading: "Retention period",
        body: `<p>Account and class data is kept for as long as the account exists or as long as it is needed to provide the service. The teacher can delete a pupil, a class or all of their data from the application; a backup can be exported before deletion. Technical logs are kept for a limited period.</p>`
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
        body: `<p>Class Odyssey is primarily a tool for teachers. Pupil data is entered by the teacher, who undertakes to comply with the legal framework applicable to their institution (informing parents, any required authorisations). We do not collect data directly from pupils, send them no advertising and request no sensitive data. The first name is the only identifying data needed to create a character; using only the necessary information is recommended.</p>`
      },
      {
        heading: "Data security",
        body: `<p>We implement appropriate technical and organisational measures to protect your data against unauthorised access, alteration, disclosure or destruction. Passwords are hashed, sessions are time-limited and access to data is restricted.</p>`
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
