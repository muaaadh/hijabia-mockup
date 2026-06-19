# Hijabia — Abaya & Modest Wear Storefront (Mockup)

A responsive, static storefront mockup for **Hijabia**, a modest-fashion boutique —
**abayas, kaftans and open kimonos**. Built with plain HTML, CSS and vanilla
JavaScript (no framework, no build step).

## Features

- **Filterable shop** — by type, colour, size, fabric and price, plus sort, live search and removable filter chips
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
