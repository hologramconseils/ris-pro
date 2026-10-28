// E-mails de compte (activation, mot de passe oublié, compte déjà existant), envoyés par Brevo.
// Les liens sont construits à partir de l'adresse du site configurée, jamais de la requête.

export const AUTH_PAGES = {
  activation: '/activation',
  reset: '/reinitialisation',
  magic: '/connexion-lien',
  login: '/login',
};

function layout(title, intro, buttonLabel, link, outro) {
  return `
<div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 560px;">
  <h1 style="color: #1a56db; font-size: 1.4rem;">${title}</h1>
  <p>${intro}</p>
  <p style="text-align: center; margin: 2rem 0;">
    <a href="${link}" style="background-color: #1a56db; color: white; padding: 0.8rem 1.8rem; border-radius: 6px; font-weight: bold; text-decoration: none; display: inline-block;">${buttonLabel}</a>
  </p>
  <p style="font-size: 0.9rem; color: #666;">Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur :<br>${link}</p>
  <p style="font-size: 0.9rem; color: #666;">${outro}</p>
</div>`;
}

export function activationEmail(origin, token) {
  const link = `${origin}${AUTH_PAGES.activation}?token=${token}`;
  return {
    subject: 'Activez votre compte RIS Pro',
    html: layout(
      'Bienvenue sur RIS Pro',
      'Pour activer votre compte et choisir votre mot de passe, cliquez sur le bouton ci-dessous. Ce lien est valable 24 heures et ne peut servir qu\'une fois.',
      'Activer mon compte',
      link,
      'Si vous n\'êtes pas à l\'origine de cette demande, ignorez simplement cet e-mail : aucun compte ne sera activé.'
    ),
  };
}

export function resetEmail(origin, token) {
  const link = `${origin}${AUTH_PAGES.reset}?token=${token}`;
  return {
    subject: 'Réinitialisez votre mot de passe RIS Pro',
    html: layout(
      'Réinitialisation de votre mot de passe',
      'Vous avez demandé à choisir un nouveau mot de passe. Cliquez sur le bouton ci-dessous : ce lien est valable 1 heure et ne peut servir qu\'une fois.',
      'Choisir un nouveau mot de passe',
      link,
      'Si vous n\'êtes pas à l\'origine de cette demande, ignorez cet e-mail : votre mot de passe actuel reste inchangé.'
    ),
  };
}

export function alreadyRegisteredEmail(origin) {
  const link = `${origin}${AUTH_PAGES.login}`;
  return {
    subject: 'Vous avez déjà un compte RIS Pro',
    html: layout(
      'Vous avez déjà un compte',
      'Une inscription vient d\'être demandée avec cette adresse, mais un compte RIS Pro existe déjà. Vous pouvez vous connecter ; si vous avez oublié votre mot de passe, utilisez « Mot de passe oublié » sur la page de connexion.',
      'Me connecter',
      link,
      'Si vous n\'êtes pas à l\'origine de cette demande, vous pouvez ignorer cet e-mail.'
    ),
  };
}

// Lien de connexion envoyé après un paiement. `redirect` : chemin du site où arriver une fois connecté.
export function magicLoginEmailLink(origin, token, redirect = null) {
  const target = redirect ? `&redirect=${encodeURIComponent(redirect)}` : '';
  return `${origin}${AUTH_PAGES.magic}?token=${token}${target}`;
}

// E-mail de confirmation de paiement. Avec `link` : accès direct au bilan ; sans lien (adresse du site non
// configurée, ou création du lien en échec) : invitation à se connecter.
export function paymentConfirmationEmail({ link, isNewUser, siteUrl }) {
  const header = '<h1 style="color: #1a56db;">Merci pour votre confiance !</h1>';
  const wrap = (inner) => `<div style="font-family: sans-serif; line-height: 1.6; color: #333;">${header}${inner}</div>`;
  if (!link) {
    return {
      subject: 'Confirmation de votre accès RIS Pro',
      html: wrap(`
  <p>Vos 4 analyses détaillées ont été ajoutées à votre compte.</p>
  <p>Pour commencer, ${siteUrl ? `<a href="${siteUrl}/login?forgot=true" style="color: #1a56db; font-weight: bold;">demandez votre lien de connexion</a>` : 'utilisez « Mot de passe oublié » sur la page de connexion'} avec cette adresse e-mail.</p>`),
    };
  }
  return {
    subject: 'Confirmation de votre accès RIS Pro',
    html: wrap(`
  <p>Votre paiement a bien été validé et votre accès <strong>RIS Pro</strong> est actif.</p>
  <p>Vous disposez désormais de :</p>
  <ul style="background: #f3f4f6; padding: 1.5rem 2.5rem; border-radius: 8px; list-style: none;">
    <li>✅ <strong>4 analyses détaillées</strong> de relevés de carrière</li>
  </ul>
  <p>Pour consulter le bilan complet et détaillé de votre analyse immédiatement, sans mot de passe, cliquez sur ce lien sécurisé :</p>
  <p style="text-align: center; margin: 2rem 0;">
    <a href="${link}" style="background-color: #1a56db; color: white; padding: 0.8rem 1.8rem; border-radius: 6px; font-weight: bold; text-decoration: none; display: inline-block;">Consulter mon Bilan Premium</a>
  </p>
  <p style="font-size: 0.9rem; color: #666;">Ce lien est à usage unique et valable 7 jours. ${
    isNewUser
      ? 'Un compte a été créé avec cette adresse : pour vous reconnecter plus tard, utilisez « Mot de passe oublié » sur la page de connexion afin de choisir votre mot de passe.'
      : 'Vous pouvez aussi vous connecter avec votre mot de passe habituel.'
  }</p>`),
  };
}
