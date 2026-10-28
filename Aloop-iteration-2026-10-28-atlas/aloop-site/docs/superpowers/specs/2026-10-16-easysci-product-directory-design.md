# Website Build Prompt: Product Navigation, EasySci Directory Expansion, and Yellow Accent System

## Role
Act as a senior full-stack engineer, product designer, and UX architect. Update the existing website in place. Prioritize a reliable implementation, clear information architecture, searchable resource discovery, responsive behavior, and visual consistency. Inspect the current codebase and design before making changes; reuse the existing framework, routing, components, and design tokens wherever possible.

## 1. Information Architecture and Top Navigation

- Add a top-level **Products** navigation item at the same hierarchy level as **Experiments**. Do not nest Products inside Experiments or vice versa.
- Move **EasySci** into **Products** as a child item. The intended hierarchy is:

  - Experiments
  - Products
    - EasySci

- Make the Products item accessible through the existing navigation pattern (dropdown, flyout, or menu panel, depending on the current implementation). EasySci must have a dedicated, functional destination/route.
- Preserve all existing experiment pages, interactions, links, and state. Do not remove or redesign unrelated features as a side effect.
- Ensure keyboard access, visible focus states, sensible mobile navigation, and direct URL access to EasySci.

## 2. Audit the Existing EasySci Directory Before Editing

First inspect the existing EasySci content and implementation. Count the current resource records and valid unique URLs, identify duplicate or broken links, and record the counts by category and access model. Keep useful existing entries; merge duplicates and repair stale URLs instead of deleting content indiscriminately.

Expand the directory with popular and widely used research, data-analysis, design, illustration, image-editing, image-background-removal, and visual-asset websites that have been relevant during **2022–2026**. Use official websites as destination links. Use current traffic or category-ranking evidence when claiming popularity; otherwise describe the list as an editorially curated shortlist, not a definitive ranking. Prefer resources that are useful to students, psychology researchers, educators, and people building research websites or presentations.

As one current popularity signal, Similarweb's September 2026 *Graphics, Multimedia and Web Design* category placed Canva at #1 and remove.bg at #3. This is a category ranking snapshot, not a universal quality ranking. Source: https://www.similarweb.com/top-websites/computers-electronics-and-technology/graphics-multimedia-and-web-design/

### Recommended starting directory

Use this list as a vetted starting point, not as a hard limit. Check every official URL and verify the access label before shipping. Do not fabricate tools, features, pricing, traffic, or popularity claims. If a service's current pricing is unclear, label it **Pricing to verify** rather than guessing.

#### A. Academic Search, Literature Review, and Research Assistance

| Tool | Official URL | Suggested access label | One-sentence purpose |
|---|---|---|---|
| Google Scholar | https://scholar.google.com/ | Free | Search scholarly literature across disciplines and discover citations and related papers. |
| PubMed | https://pubmed.ncbi.nlm.nih.gov/ | Free | Search biomedical and life-science literature using a maintained scholarly index. |
| Semantic Scholar | https://www.semanticscholar.org/ | Free | Discover academic papers with AI-assisted relevance features and citation context. |
| OpenAlex | https://openalex.org/ | Free / Open data | Explore an open catalog of scholarly works, authors, institutions, and research topics. |
| Zotero | https://www.zotero.org/ | Free / Open source; paid storage optional | Collect, organize, annotate, and cite research sources. |
| ResearchRabbit | https://www.researchrabbit.ai/ | Free / verify current terms | Explore related papers and authors through citation-based research maps. |
| Connected Papers | https://www.connectedpapers.com/ | Freemium | Build visual graphs of papers related to a seed publication. |
| Litmaps | https://www.litmaps.com/ | Freemium | Track literature and discover related work through citation maps and alerts. |
| Elicit | https://elicit.com/ | Freemium | Search and synthesize academic literature with AI-assisted evidence extraction. |
| Consensus | https://consensus.app/ | Freemium | Search research literature and review evidence relevant to a question. |
| Scite | https://scite.ai/ | Freemium / paid features | Inspect citation context to see how later papers support, contrast with, or mention a study. |
| OSF | https://osf.io/ | Free | Manage and share research projects, materials, data, and preregistrations. |
| PsyArXiv | https://psyarxiv.com/ | Free | Discover psychology preprints and early-stage research outputs. |

#### B. Statistics, Data Analysis, and Visualization

| Tool | Official URL | Suggested access label | One-sentence purpose |
|---|---|---|---|
| JASP | https://jasp-stats.org/ | Free / Open source | Run common statistical analyses through a graphical interface. |
| jamovi | https://www.jamovi.org/ | Free / Open source | Perform statistical analyses in a spreadsheet-like interface with reproducible output. |
| R Project | https://www.r-project.org/ | Free / Open source | Use a programming language and environment for statistical computing and graphics. |
| Posit | https://posit.co/ | Free and paid products | Access tools and workflows for R, Python, reproducible analysis, and data science. |
| Google Colab | https://colab.research.google.com/ | Freemium | Run Python notebooks in the browser with optional access to additional computing resources. |
| RAWGraphs | https://www.rawgraphs.io/ | Free / Open source | Turn structured data into exportable visualizations, including less-common chart types. |
| Datawrapper | https://www.datawrapper.de/ | Freemium | Create publication-ready charts, maps, and tables with a browser-based workflow. |
| Flourish | https://flourish.studio/ | Freemium | Build interactive charts, maps, stories, and data-driven visual presentations. |
| Tableau Public | https://public.tableau.com/ | Free; published work is public | Create and share public data visualizations and dashboards. |
| Observable | https://observablehq.com/ | Freemium | Build interactive data notebooks and custom data visualizations. |

#### C. Experiment Design, Surveys, and Research Platforms

| Tool | Official URL | Suggested access label | One-sentence purpose |
|---|---|---|---|
| PsychoPy | https://www.psychopy.org/ | Free / Open source | Build behavioral and cognitive experiments with code or a graphical builder. |
| Pavlovia | https://pavlovia.org/ | Freemium / paid study hosting | Host and run online experiments and manage participant-facing study links. |
| Gorilla | https://gorilla.sc/ | Paid / trial availability to verify | Build and run browser-based behavioral experiments and participant studies. |
| Qualtrics | https://www.qualtrics.com/ | Paid / institutional access may apply | Create surveys and research workflows with advanced logic and data collection features. |

#### D. Graphic Design, UI Design, and General Image Editing

| Tool | Official URL | Suggested access label | One-sentence purpose |
|---|---|---|---|
| Canva | https://www.canva.com/ | Freemium | Create posters, slides, infographics, diagrams, social graphics, and other visual materials. |
| Figma | https://www.figma.com/ | Freemium; education eligibility may apply | Design interfaces, prototypes, design systems, and collaborative product flows. |
| Adobe Express | https://www.adobe.com/express/ | Freemium | Create quick graphics, presentations, video assets, and image edits using templates. |
| Photopea | https://www.photopea.com/ | Free with ads / paid ad-free option; verify current terms | Edit layered raster and vector files in a browser-based editor. |
| Excalidraw | https://excalidraw.com/ | Free / open-source core | Draw quick diagrams, concept maps, flowcharts, and hand-drawn-style explanations. |
| PhotoRoom | https://www.photoroom.com/ | Freemium | Create product photos and marketing images, including background removal and replacement. |
| Clipdrop | https://clipdrop.co/ | Freemium | Use AI-assisted image cleanup, relighting, upscaling, and background tools. |
| remove.bg | https://www.remove.bg/ | Freemium; high-resolution output may require payment | Remove image backgrounds and export cutouts for posters, slides, and product visuals. |

#### E. Stock Photography, Icons, Illustrations, and Other Visual Assets

| Tool | Official URL | Suggested access label | One-sentence purpose |
|---|---|---|---|
| Unsplash | https://unsplash.com/ | Free; check the license and restrictions for each use | Find high-quality photographs for web pages, slides, and editorial visuals. |
| Pexels | https://www.pexels.com/ | Free; check license terms | Find free stock photographs and videos for visual projects. |
| Pixabay | https://pixabay.com/ | Free; check license terms | Find stock images, illustrations, vectors, video, and other media assets. |
| Freepik | https://www.freepik.com/ | Freemium; attribution may apply to some free uses | Find editable vectors, illustrations, photos, templates, and design resources. |
| Flaticon | https://www.flaticon.com/ | Freemium; attribution may apply to some free uses | Find icon packs for interfaces, infographics, and presentations. |
| Icons8 | https://icons8.com/ | Freemium; attribution or paid plans may apply | Find icons, illustrations, photos, music, and design assets. |
| SVG Repo | https://www.svgrepo.com/ | Free; verify each asset's license | Find SVG icons and illustrations that can be adapted for web interfaces. |
| unDraw | https://undraw.co/illustrations | Free; verify current license | Download editable, minimalist illustrations for websites and presentations. |
| Storyset | https://storyset.com/ | Free / Freemium; attribution rules may apply | Customize vector illustrations for educational content, product pages, and explainers. |
| LottieFiles | https://lottiefiles.com/ | Freemium; check each asset's license | Find lightweight animations and motion assets for web interfaces. |
| Google Fonts | https://fonts.google.com/ | Free | Browse and use web fonts for readable and consistent interface typography. |
| Font Awesome | https://fontawesome.com/ | Free and paid icon sets | Find icons for interface controls, navigation, and explanatory graphics. |
| Envato Elements | https://elements.envato.com/ | Paid subscription | Download stock graphics, templates, fonts, video, and other creative assets under a subscription license. |
| Adobe Stock | https://stock.adobe.com/ | Paid / limited free assets may vary | License stock photography, vectors, illustrations, templates, and video. |
| Shutterstock | https://www.shutterstock.com/ | Paid / limited free assets may vary | License stock images, illustrations, video, and creative assets. |

#### F. AI-Assisted Image Generation and Creative Tools

| Tool | Official URL | Suggested access label | One-sentence purpose |
|---|---|---|---|
| Midjourney | https://www.midjourney.com/ | Paid; verify current plans | Generate stylized images and visual concepts from text prompts. |
| Ideogram | https://ideogram.ai/ | Freemium; verify current plans | Generate images and graphic concepts, including text-oriented design experiments. |
| Leonardo AI | https://leonardo.ai/ | Freemium; verify current plans | Generate and refine images and creative assets with configurable workflows. |
| Krea | https://www.krea.ai/ | Freemium; verify current plans | Explore AI-assisted image generation, enhancement, and real-time visual iteration. |

Do not assume that a tool is popular solely because it is listed here. Use the list to seed the directory, then verify availability, access model, official destination, and practical relevance. Add other well-supported tools from 2022–2026 if they materially improve coverage.

## 3. Directory Information Architecture and Interaction

Organize EasySci as a searchable resource directory, not a long, undifferentiated wall of links.

- Provide clear category filters, such as **Literature & AI Research**, **Statistics & Data Visualization**, **Experiment & Survey Tools**, **Graphic Design & UI**, **Image Editing & Background Removal**, **Stock Assets & Icons**, and **AI Creative Tools**.
- Include search by tool name, task, category, and capability. Add filters for **Free**, **Freemium**, **Paid**, and **Open Source**. Allow category and pricing filters to work together.
- Show the total number of resources, the number of filtered results, and the number of results by access model where appropriate. Counts must be derived from the actual data, not hard-coded.
- Every resource must be represented by a consistent, accessible card or row. Each entry should include:
  1. Tool name and official website URL.
  2. Category and concise pricing/access badge.
  3. A one-sentence introduction visible by default.
  4. A detailed explanation directly beneath the one-sentence introduction after the resource is clicked or expanded.
  5. A clear **Visit Official Website** action that opens the verified official URL in a new tab, with safe external-link attributes.
- The detailed explanation should cover what the tool does, typical use cases, notable strengths, important limitations, whether sign-in is needed when known, and what the free tier does or does not include. Keep descriptions factual and specific; do not make unsupported performance claims.
- Use a disclosure/expand interaction or a dedicated detail view consistent with the current site. The selected entry should expand predictably and support keyboard interaction. Do not make the entire card look like an external link if clicking it only reveals details.
- Avoid false promises. A **Free** label must not imply that every feature, download size, commercial use, or asset is free. Distinguish **Free**, **Freemium**, **Paid**, and **Open Source**. Add a short note that users should check each service's current terms and each asset's license before commercial use.
- Display the canonical official URL or a clearly labelled domain so users can recognize where a link leads. Avoid URL shorteners and affiliate redirects.

## 4. Typography and Bright-Yellow Accent Treatment

Use a bright yellow accent in a controlled, repeatable way. Do not turn the entire interface yellow, and do not discard the current visual identity unnecessarily.

- **Resource/tool name:** Apply a bright-yellow highlight or underline-like background fill directly beneath/behind the tool name. It should read as a precise marker, not a large yellow card or a full-width yellow bar. Use a small horizontal inset and balanced padding; keep the name readable when it wraps on mobile.
- **One-sentence summary:** Increase its font size by approximately **two steps** relative to the current summary style (for example, from 14px to 18px, adjusted to the existing type scale), and make it **bold**. Ensure that it remains visually distinct from the longer description beneath it.
- **Detailed description:** Keep a readable line length and comfortable line height. Use clear hierarchy between the tool name, summary, access badge, expanded details, and action button.
- **Visit Official Website button feedback:** Bright yellow must be the hover, pressed/active, and visible keyboard-focus accent. Provide clear transitions and adequate text contrast. Do not rely on color alone to communicate focus or interaction state.
- Define the accent through a reusable design token, for example `--accent-yellow: #FFD84D` or a similarly bright, accessible yellow selected after contrast testing. Use the same token for name highlights and button feedback rather than scattering unrelated yellow values across the stylesheet.
- Check light and dark backgrounds, selected and unselected cards, visited links, error states, and focus rings. If yellow with white text fails contrast, use dark text on yellow.
- Keep hover motion subtle and purposeful. Do not add excessive glow, gradients, bouncy animations, or decorative elements that reduce readability.

## 5. Functional and Engineering Requirements

- Inspect the existing project structure and identify the actual navigation component, resource data source, styles, routes, and dependencies before editing.
- Use the project's current framework and conventions. Do not introduce a second frontend, duplicate page implementation, or unnecessary dependencies.
- Put resource records in a single structured data source (for example JSON or typed objects) so categories, labels, search, result counts, descriptions, and URLs remain consistent and maintainable.
- Include fields such as `name`, `url`, `category`, `accessModel`, `summary`, `description`, `features`, `limitations`, `licenseNote`, and `lastVerified` where appropriate. Keep the directory extensible.
- Normalize and validate URLs; reject empty or malformed links and prevent unsafe URL schemes. Open external links in a new tab using `target="_blank"` and `rel="noopener noreferrer"` where appropriate.
- Keep search, filters, expansion, navigation, and direct route loading fully functional. Provide sensible empty states when a search has no results.
- Preserve responsive behavior on desktop, tablet, and mobile. On narrow screens, prevent horizontal overflow and ensure filter controls remain usable.
- Use semantic HTML, accessible names, keyboard-operable controls, visible focus styles, sufficient color contrast, and reduced-motion preferences.
- Do not fabricate logos or use unrelated stock images as substitutes for official brand assets. If logos are unavailable or licensing is uncertain, use typographic wordmarks or simple neutral icons.
- Do not hard-code counts or claim that a resource is free without checking. Add a verification date to resource metadata and review ambiguous pricing or licensing before shipping.

## 6. Acceptance Criteria

The task is complete only when all of the following are true:

1. **Products** appears in the top navigation at the same level as **Experiments**.
2. **EasySci** is accessible as a child of **Products** and opens its own functional destination.
3. Existing experiment routes and interactions still work.
4. The current EasySci links have been counted, de-duplicated, and checked; new resources have been added across research, data visualization, design, background removal, and visual-asset categories.
5. The page clearly distinguishes **Free**, **Freemium**, **Paid**, and **Open Source** resources, and does not imply that asset licensing is universally unrestricted.
6. Users can search and filter entries, view accurate dynamic result counts, and expand each entry to read details directly below its one-sentence introduction.
7. The one-sentence summary is approximately two type-scale steps larger than before and bold.
8. The tool name has the requested bright-yellow highlight/fill treatment.
9. The official-site button has a visible bright-yellow hover, pressed, and keyboard-focus state, with readable contrast.
10. All external links use official destinations and open safely.
11. Desktop, tablet, and mobile layouts have been checked, and no horizontal overflow or broken navigation is introduced.
12. Run the project's available checks (build, type check, lint, or tests). Report what was checked and distinguish automated checks from any manual runtime tests that could not be performed.

## 7. Required Handoff

After implementation, provide a concise implementation report containing:

- Files and components changed.
- Final top-navigation structure.
- Number of valid unique resources before and after the update, plus counts by category and access model.
- Resources added, removed, merged, or corrected, with reasons for material changes.
- Any URLs, pricing labels, or licensing terms that still require manual verification.
- Build/test results and any remaining limitations.

Do not stop at a visual mock-up. Implement the actual navigation, directory data, search/filter behavior, expanded descriptions, external links, and responsive styling in the existing project.

## Research References

- Similarweb, *Top Graphics Multimedia and Web Design Websites Ranking*, September 2026: https://www.similarweb.com/top-websites/computers-electronics-and-technology/graphics-multimedia-and-web-design/
- Similarweb, *Google, Reddit Dominate in GenAI Referrals to Tech Platforms*, September 17, 2025: https://www.similarweb.com/blog/insights/ai-news/google-reddit-dominate-in-genai-referrals-to-tech-platforms/
- Canva pricing: https://www.canva.com/pricing/
- Figma pricing: https://www.figma.com/pricing/
- remove.bg pricing: https://www.remove.bg/pricing
- Elicit pricing: https://elicit.com/pricing
- jamovi (free/open-source statistical software): https://www.jamovi.org/
- RAWGraphs (free/open-source visualization): https://www.rawgraphs.io/
