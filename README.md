# Hijabia × Hijabi MV — Modest Wear Storefront (Mockup)

A responsive, static storefront mockup hosting **two brands under one roof**:
**Hijabia** (abayas, kaftans and outerwear) and **Hijabi MV** (hijabs, scarves and
shawls). Built with plain HTML, CSS and vanilla JavaScript (no framework, no build step).

All product imagery is **face-free** (garments on hangers, headless dress-forms,
flatlays, folded stacks and fabric detail).

## Features

- **Two-brand catalogue** — shop both labels together, filter by **brand** (Hijabia / Hijabi MV), and see the brand on every product
- **Filterable shop** — by brand, type, colour, size, fabric and price, plus sort, live search and removable filter chips
- **Quick-view modal** — colour/size selection and quantity before adding to bag
- **Cart** — slide-in drawer, quantity controls, `localStorage` persistence and a free-shipping progress bar
- **Checkout** — 3-step flow (Information → Shipping → Payment) with live validation, order summary, tax/shipping and a confirmation screen
- **Responsive** — tailored desktop and mobile layouts; the filter panel becomes a slide-in drawer on mobile
- **Accessibility-minded** — focus management, focus-trapped dialogs, keyboard (ESC) handling and reduced-motion support
- **Resilient imagery** — every product image gracefully falls back to a tinted tile if a remote image ever fails

## Tech

Plain `HTML` + `CSS` + vanilla `JavaScript`. Zero dependencies.

## Run locally

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Markup / page structure |
| `styles.css` | Design system, layout, responsive rules |
| `app.js` | Shop, filtering, cart and checkout logic |
| `products.js` | Catalogue data + imagery references |
| `hijabia-logo.png` | Brand logo |

---

> Demo storefront — product imagery is placeholder and payments are simulated (no real charge).
