# Design system
Dark, minimal, modern tech; original typography-led editorial composition. No gradients, neon, glows, glassmorphism, excessive pills or ubiquitous cards. Geist Sans for headings, copy, buttons and nav; Geist Mono selectively for section numbers, dates, tech metadata. Self-host fonts. Weights 400 body, 500 controls, 600 headings, 700 hero emphasis.

| Style | Desktop | Tablet | Mobile |
|---|---:|---:|---:|
| Hero | 80 | 64 | 44 |
| H1 | 56 | 48 | 36 |
| H2 | 40 | 32 | 28 |
| H3 | 28 | 24 | 22 |
| Body large | 18 | 18 | 16 |
| Body | 16 | 16 | 15 |
| Caption | 14 | 14 | 12 |
| Mono | 12 | 12 | 11 |

Pixels. Palette: background #0A0A0A; secondary #111111; surface #171717; hover #1F1F1F; inverse #FAFAFA. Primary text #FAFAFA; secondary #A3A3A3; muted #808080; disabled #525252; inverse #0A0A0A. Borders subtle #262626, default #404040, hover #737373, focus #D4D4D4. Ensure readable contrast; disabled color only for disabled elements. 1px borders, 4–8px radius, minimal shadows. Lucide stroke 1.5; sizes inline 16, button 18, standard 24, featured 32. Brand logos monochrome even on hover. Tech tiles: use the same 22 local monochrome SVGs as the Hero network, with 32px logos, labels Geist Sans 14 (fit responsively), background #111111, hover #171717, border #262626 to #737373, radius 6px; logos #A3A3A3 to #FAFAFA. Use consistent spacing and fluid containers; proposed initial breakpoints 768 and 1024px, verify visually. Touch targets at least 44px. Project imagery can show original colors on mobile; desktop grayscale to color on hover. No other colored UI.

Section identifiers use one Geist Mono line in muted #808080 at 12px on tablet and desktop and 11px on mobile, with consistent weight and no separate display heading: `01 / INTRO`, `02 / ABOUT ME`, `03 / TECHNOLOGY`, `04 / EXPERIENCE`, `05 / SELECTED WORK`, `06 / CONTACT`. Pair each identifier with one primary Geist Sans section heading.

## Technology Stack

Phase 07A.3 adds grouped focus within the active icon grid. The active technology is white, and its peers dim to 40%. The technical tooltip uses Geist Mono with an uppercase name and type, a divider and a concise description. It uses a 190px preferred width, square corners and a white left accent on the monochrome surface.

The primary CTA has a 4px radius and a white border. Its dark fill rolls upward with a curved edge, and the text and icon follow the moving colour boundary.

The Technology Stack uses five evenly distributed categories in one responsive navigation row: Frontend, Backend, Database, Languages and Tools & Others. Frontend is selected initially. The selected category is shown with white text and its own persistent animated underline. The Stack presents 23 technologies from the shared catalog, including SQL, while the Hero network keeps its approved 22 nodes. Only the selected category's borderless icon grid is displayed, with three columns on mobile, four on tablet and eight on wide desktop. Each tile preserves its local SVG geometry in a 36px box and opens an accessible tooltip with the catalog description.

## Ambient particle background
Use monochrome foreground ink over the #0A0A0A base, with small dots and short streaks and the foreground content as the visual priority. Adjustable defaults use an enabled feature, 60% reference density, 0.55 speed multiplier, 70% visibility intensity, 90 desktop particles and 40 mobile particles. Tablet counts interpolate between the two. Particle diameters range from 0.5 to 2 CSS px, and the configured opacity bounds are 0.10 to 0.65. There are three depth layers. Visibility intensity shapes the depth-weighted opacity distribution while the configured opacity bounds remain the actual range. Tune the configuration after manual visual review.
