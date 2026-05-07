import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { userId, userEmail, filePath } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Pack 4 Analyses RIS Pro',
              description: 'Accès complet pour 4 analyses détaillées de relevés de carrière (RIS / EIG).',
            },
            unit_amount: 2900,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: userEmail,
      client_reference_id: userId,
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://' + req.headers.host}/bilan?success=true&file=${encodeURIComponent(filePath)}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://' + req.headers.host}/diagnostic?file=${encodeURIComponent(filePath)}`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Erreur Stripe Session:', error);
    return res.status(500).json({ error: error.message });
  }
}
