# Spécifications de Conception Frontend (Design System) : RIS Pro

> [!IMPORTANT]
> **Statut du Design :** Validé pour Production
> **Axe Esthétique :** Luxury Minimalist & Editorial
> **Index DFII :** 14/15 (Maturité Excellente - Prêt pour implémentation)

---

## 1. Direction Artistique & Thèse Esthétique

RIS Pro s'éloigne volontairement des codes graphiques surutilisés des applications SaaS grand public (dégradés violet/cyan agressifs, thèmes sombres ultra-contrastés typés "gaming", ou polices système sans personnalité).

Nous adoptons une esthétique **Luxury Minimalist & Editorial**, inspirée des magazines financiers haut de gamme et des cabinets de conseil en gestion de patrimoine privés. Le design doit inspirer la **clarté**, la **confiance** et le **prestige**.

```
DFII = (Impact: 5 + Fit: 5 + Feasibility: 4 + Performance: 5) − Consistency Risk: 1 = 14/15
```

---

## 2. Palette Chromatique & Variables CSS

Le système de couleur s'appuie sur une structure asymétrique dominée par des teintes ardoise et sable doré.

```css
:root {
  /* Dominant Tone (Slate Slate) */
  --color-primary-hsl: 222, 47%, 11%;
  --color-primary: hsl(var(--color-primary-hsl));
  
  /* Restrained Neutral System (Warm Slate) */
  --color-bg-base: #f8fafc;
  --color-bg-card: #ffffff;
  --color-text-main: #0f172a;
  --color-text-muted: #64748b;

  /* Accent Tone (Refined Gold) */
  --color-accent-hsl: 35, 41%, 64%;
  --color-accent: hsl(var(--color-accent-hsl));
  --color-accent-light: hsla(var(--color-accent-hsl), 0.1);

  /* Functional Tones */
  --color-success: #10b981;
  --color-success-bg: #ecfdf5;
  --color-danger: #ef4444;
  --color-danger-bg: #fef2f2;

  /* Typography Scales */
  --font-display: 'Playfair Display', Georgia, serif;
  --font-body: 'Outfit', Inter, system-ui, sans-serif;
}
```

---

## 3. Typographie Structurale

*   **Titres & Affichages Majeurs (Display Font) :** Utilisation de **`Playfair Display`**. Une typographie à empattement (serif) élégante qui apporte de l'autorité académique et de la crédibilité historique à l'audit retraite.
*   **Contenus & Tableaux (Body Font) :** Utilisation de **`Outfit`** (alternative plus moderne à Inter). Ses formes géométriques et épurées garantissent une lisibilité optimale sur les grilles de salaires et les simulations de trimestres.

---

## 4. Ancre de Différenciation (Visuelle & Interactive)

> [!TIP]
> **Ce qui rend l'interface mémorable (Différenciation) :**
> Au lieu d'afficher les alertes de carrière sous forme de listes brutes, nous intégrons un effet de **mise en page éditoriale en bento-grid** asymétrique avec des **chiffres géants en filigrane** (`opacity-5`) en arrière-plan de chaque carte. 
> De plus, le bloqueur d'accès freemium utilise un **flou gaussien immersif (`backdrop-filter: blur(8px)`)** marié à un dégradé de couleur or transparent (`linear-gradient`) qui donne une sensation de vitre dépolie luxueuse ("frosted glassmorphism") masquant les données confidentielles.

---

## 5. Guide d'Implémentation des Composants

### A. Les Cartes de Stratégie (Premium - Bilan.jsx)
Les cartes de stratégie d'optimisation (âge de départ, rachat de trimestres, cumul emploi-retraite) doivent utiliser la classe d'élévation douce et le filigrane numérique :

```html
<div className="card-strategy animate-slide-up">
  <span className="watermark-number">01</span>
  <h3 className="card-title">Optimisation du Taux Plein</h3>
  <p className="card-description">...</p>
  <span className="pill-impact">+250€ / mois</span>
</div>
```

```css
.card-strategy {
  position: relative;
  background: var(--color-bg-card);
  border: 1px solid rgba(var(--color-primary-hsl), 0.08);
  border-radius: 1rem;
  padding: 2rem;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease;
  overflow: hidden;
}

.card-strategy:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px -10px rgba(var(--color-primary-hsl), 0.12);
}

.watermark-number {
  position: absolute;
  right: 1.5rem;
  bottom: 0.5rem;
  font-family: var(--font-display);
  font-size: 5rem;
  font-weight: 900;
  color: var(--color-primary);
  opacity: 0.04;
  user-select: none;
  pointer-events: none;
}
```

### B. Le Paywall de Conversion (Freemium - Diagnostic.jsx)
Le rideau de blocage freemium doit inspirer la curiosité tout en conservant une structure esthétique impeccable :

```css
.paywall-overlay {
  position: absolute;
  inset: 0;
  backdrop-filter: blur(8px) saturate(180%);
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.4) 0%,
    rgba(255, 255, 255, 0.95) 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.paywall-card {
  background: #ffffff;
  border: 1px solid var(--color-accent);
  box-shadow: 0 20px 40px -15px rgba(var(--color-primary-hsl), 0.15);
  padding: 3rem;
  border-radius: 1.5rem;
  text-align: center;
  max-width: 480px;
}
```

---

## 6. Philosophie de Mouvement

*   **Entrées (Transitions) :** Utiliser des durées courtes (300ms) avec une fonction d'amortissement naturelle (`cubic-bezier(0.16, 1, 0.3, 1)` - *easeOutQuad* ou *easeOutExpo*).
*   **Retours Tactiles (Hovers) :** Légère élévation physique (`translateY(-4px)`) couplée à un changement subtil de la bordure (`border-color` passant à `--color-accent`) pour attirer l'attention sans surcharger.
