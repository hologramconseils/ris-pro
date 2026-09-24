import { Helmet } from 'react-helmet-async'

const SITE_URL = 'https://ris.hologramconseils.com'

export default function SEO({ title, description, path = '/', noIndex = false }) {
  const canonical = `${SITE_URL}${path}`

  return (
    <Helmet>
      {title && <title>{title}</title>}
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={canonical} />
      {title && <meta property="og:title" content={title} />}
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={canonical} />
      {title && <meta property="twitter:title" content={title} />}
      {description && <meta property="twitter:description" content={description} />}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
    </Helmet>
  )
}
