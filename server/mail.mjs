/* Transactional email for account recovery. The transport is optional and
 * configured through the environment: without an API key the reset endpoint
 * still works locally (the code is logged), so the beta never blocks on mail. */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_SUBJECT = { fr: "Réinitialise ton mot de passe Class Odyssey", en: "Reset your Class Odyssey password" };

export function createMailer({ apiKey = process.env.RESEND_API_KEY, from = process.env.MAIL_FROM, fetchImpl = fetch } = {}) {
  const enabled = Boolean(apiKey && from);
  return {
    enabled,
    async send({ to, subject, text, html }) {
      if (!enabled) return { delivered: false, reason: "not-configured" };
      try {
        const response = await fetchImpl(RESEND_ENDPOINT, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: [to], subject, text, html }),
          signal: AbortSignal.timeout(10_000)
        });
        return { delivered: response.ok, reason: response.ok ? null : `status ${response.status}` };
      } catch (error) {
        return { delivered: false, reason: error.message };
      }
    }
  };
}

export function passwordResetEmail({ code, minutes, lang = "fr" }) {
  const subject = DEFAULT_SUBJECT[lang] || DEFAULT_SUBJECT.fr;
  const text = lang === "en"
    ? `Your Class Odyssey verification code is ${code}. It expires in ${minutes} minutes.\n\nIf you did not ask to reset your password, ignore this email.`
    : `Ton code de vérification Class Odyssey est ${code}. Il expire dans ${minutes} minutes.\n\nSi tu n'as pas demandé à réinitialiser ton mot de passe, ignore cet e-mail.`;
  const html = lang === "en"
    ? `<p>Your Class Odyssey verification code is <strong>${code}</strong>.</p><p>It expires in ${minutes} minutes. If you did not ask to reset your password, ignore this email.</p>`
    : `<p>Ton code de vérification Class Odyssey est <strong>${code}</strong>.</p><p>Il expire dans ${minutes} minutes. Si tu n'as pas demandé à réinitialiser ton mot de passe, ignore cet e-mail.</p>`;
  return { subject, text, html };
}
