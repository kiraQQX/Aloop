# EasySci Catalogue — Research Notes and Curation Rationale

**Research cut-off:** 2026-10-22  
**Catalogue state:** 432 records across eight task categories. All records are marked `needs-manual-confirmation` until an item-level review is completed.

## 1. What this catalogue is—and is not

EasySci combines research workflow resources, conventional software, online platforms, open-source packages, AI services, Skills, MCP servers and agent-plugin bundles. These are not all the same technical artefact: a desktop package, SaaS product, CLI tool, MCP server and agent skill have different installation, permission, pricing and security implications. The `kind`, `capabilities`, `category` and `accessModels` fields exist to keep those distinctions visible.

The 432-entry count is a catalogue-completeness measure, not proof of quality, popularity, compatibility or current activity. The three user-provided seed files were retained under `docs/research-inputs/` and merged into the existing directory; additional records cover research discovery, statistical analysis, image processing, creative workflows and coding/agent tooling. Representative resources below are recommended starting points rather than an exhaustive endorsement of every entry.

## 2. Coverage audit

| Category | Count | Primary user problem | Representative resources |
|---|---:|---|---|
| Literature search and AI research (`research`) | 52 | Find papers, manage references, inspect claims and organise research | Zotero, Semantic Scholar, OpenAlex, PubMed, OSF, ResearchRabbit, Elicit, Open Knowledge Maps, Unpaywall |
| Statistics and visualisation (`data`) | 50 | Clean, analyse, model and communicate data; conduct synthesis/meta-analysis | R, JASP, jamovi, Python/pandas, Jupyter, metafor, `meta`, RoBMA, robvis, RevMan Web, Meta-Essentials |
| Experiments and surveys (`experiment`) | 57 | Build timed experiments, deploy studies and collect participant responses | jsPsych, PsychoPy, lab.js, OpenSesame, PsyToolkit, JATOS, LimeSurvey, REDCap, oTree, Prolific |
| Design and diagrams (`design`) | 55 | Produce interfaces, diagrams, publication figures and presentations | Penpot, Figma, Inkscape, diagrams.net, Mermaid, Graphviz, D2, Storybook, Rive, Marp |
| Image editing and processing (`image`) | 50 | Retouch, remove backgrounds, upscale, batch convert and compress images | GIMP, Krita, ImageMagick, Real-ESRGAN, Upscayl, Squoosh, ImageOptim, darktable |
| Media and scientific assets (`assets`) | 68 | Source icons, illustrations, fonts, media and 3D/scientific models | Lucide, Iconify, Openverse, Wikimedia Commons, NASA Images, NIH 3D, Poly Haven, ambientCG, Bioicons |
| Generative creative tools (`creative`) | 50 | Generate or edit images, video, audio, voice and creative content | Stable Diffusion, ComfyUI, Krita, Adobe Firefly, Runway, Luma, ElevenLabs, Suno |
| Programming and research workflows (`coding`) | 50 | Build software, use agent workflows and connect tools via MCP | GitHub, VS Code, Playwright, Model Context Protocol, Context7 MCP, Supabase MCP, Claude Code, PyTorch |

Categories intentionally vary above 50 where supplied entries naturally fit. Data-analysis entries explicitly include meta-analysis tools, rather than relegating meta-analysis to a separate external list.

## 3. Sources that informed selection and classification

### 3.1 Homepage brain model

The selected [brainproject repository](https://github.com/itayinbarr/brainproject) provides a committed `brain-atlas/models/brain.glb` and per-mesh glTF `extras`, including the `bx_cat` subsystem, `bx_label`, `bx_side` and `bx_region`. That allows a web client to select real cortical meshes programmatically rather than infer cortical anatomy from node names or draw a particle silhouette. The project documentation describes Three.js, GLTFLoader, DRACOLoader and a compressed model pipeline. Its current licence file explicitly says the viewer source code is Apache-2.0 but the 3D anatomy model and derived metadata are CC BY-SA 4.0; those licences are not interchangeable.

Implementation links:

- [Model source and metadata](https://github.com/itayinbarr/brainproject)
- [Separate code/geometry licence terms](https://github.com/itayinbarr/brainproject/blob/main/LICENSE)
- [Public interactive viewer](https://itayinbarr.github.io/brainproject/)
- [Three.js version history](https://www.npmjs.com/package/three?activeTab=versions) — the project pins `0.186.1`, the npm `latest` version observed on 2026-10-22.
- [Alternative repository: NIH 3D](https://3d.nih.gov/) — an open community-driven portal for biomedical 3D visualisation models.
- [Alternative asset source: Poly Haven](https://polyhaven.com/license) — the site states its HDRIs, textures and 3D models are published as CC0. This is a general asset source, not a substitute for an anatomically labelled cortical model.

For a production release, pin the brain GLB URL to a reviewed commit or vendor the exact geometry and its licence/attribution file. A URL that points at `main` is convenient for iteration but can change independently from the application. The visible homepage model is intended for education and interaction only, not clinical use.

### 3.2 Online experiments and participant data

- [jsPsych](https://www.jspsych.org/) defines itself as a JavaScript framework for behavioural experiments running in a browser. It is a practical fit for custom browser-based tasks and timed responses.
- [JATOS](https://www.jatos.org/) states that it is free and open source, can be self-hosted, and can host studies authored in jsPsych, lab.js or OpenSesame. It is a deployment/server option rather than an experiment builder alone.
- [lab.js](https://lab.js.org/) provides browser-based experiment authoring and reusable components for behavioural and cognitive research.
- [PsyToolkit](https://www.psytoolkit.org/) is a convenient entry point for cognitive experiments and questionnaires, but terms may differ by user group and deployment context; check current official terms.
- User-provided `experiment.txt` includes experiment builders, survey/data-capture products, recruitment panels, eye-tracking and EEG hardware/software. Paid commercial systems are retained where they are practical options; their presence does not mean they are free or open source.

### 3.3 Analysis and meta-analysis

- [metafor](https://www.metafor-project.org/doku.php/metafor) documents an open-source R package for effect-size calculation, fixed/random/mixed-effects models, meta-regression and meta-analytic plots. It is a strong option when analytical transparency and reproducibility matter.
- `meta` and RoBMA add complementary synthesis and robust Bayesian approaches within R; users should compare model assumptions with the protocol and data structure rather than choose based on tool popularity.
- JASP, jamovi and their meta-analysis modules lower the code barrier for GUI-oriented workflows. The modules and desktop apps have separate version/licensing considerations, so verify current modules and maintenance before a project depends on them.
- robvis supports visual summaries of risk-of-bias judgements; RevMan Web and Meta-Essentials serve structured review workflows with different licensing and ease-of-use trade-offs.
- Broader review-tool comparison references: [NIH Library's systematic-review resources](https://www.nihlibrary.nih.gov/services/systematic-review-service) and [ASReview](https://asreview.nl/) for active-learning-assisted screening. Tool-assisted screening does not remove the need for a documented protocol, human decisions and a reproducible exclusion log.

### 3.4 Design, image and scientific assets

- [Penpot](https://penpot.app/) is an open-source design and prototyping option, useful where exportability and self-hosting matter.
- [Krita](https://krita.org/) and [GIMP](https://www.gimp.org/) are open-source image editing/painting tools. A subscription product like Photoshop can still be a relevant practical entry, but must not be classified as open source.
- [Photopea](https://www.photopea.com/) is included as a browser-based image editor; do **not** classify it as open source merely because it can be used free of charge or has issue-tracking repositories on GitHub.
- [Openverse](https://openverse.org/) and [Wikimedia Commons](https://commons.wikimedia.org/) aggregate/find reusable media, but rights and attribution must be checked on the individual source record. “Searchable in an open-licence catalogue” is not the same as “every result is public domain.”
- [Poly Haven's rights statement](https://polyhaven.com/license) is comparatively clear for its own asset library (CC0), whereas [NIH 3D](https://3d.nih.gov/) contains community-submitted models whose individual terms should be checked.
- The provided `assets.txt` and `design.txt` lists are preserved as inputs; every site in those lists still needs a per-item rights/pricing check before a production asset pipeline is built around it.

### 3.5 Coding, Skills, MCP and agent plugins

Official starting points include [Model Context Protocol](https://modelcontextprotocol.io/), [GitHub](https://github.com/), [Playwright](https://playwright.dev/), [Context7](https://context7.com/) and relevant vendor documentation. A capability filter is more useful than a vague “AI tool” label: `skill` entries describe reusable instruction/workflow packs; `mcp` entries expose tools/resources through a protocol server; `plugin` entries can package several capabilities; regular software/services remain `resource` records.

MCP servers and agent tools can have broad filesystem, network, shell and authentication access. Catalogue inclusion must not be represented as a security review or as universal interoperability. Check each tool's supported clients, setup instructions, permission model, licence, maintenance status and data retention policies before recommending it for a workflow with research data.

## 4. Pricing, licences and freshness

All 432 entries are marked `needs-manual-confirmation` with `lastVerifiedAt: null`. No claim is made that all live URLs, prices, licences, account requirements, installation commands or features were checked on the research cut-off date. This is required honesty rather than missing data: a syntactically valid URL is not proof that it responds, and a free tier is not an open-source licence.

Recommended ongoing review cadence:

- **Every 90 days:** recheck official destinations and availability for high-priority/featured entries.
- **Every 180 days:** review other active tools, pricing/tier changes and whether alternatives have replaced them.
- **On every application update:** review new permissions or manifest conventions for Skills, MCP servers and agent plugins.
- Record `lastVerifiedAt`, `pricingSource`, official licence source and observed date only after the reviewer has opened and checked the primary source. For asset catalogues, keep the source-item licence URL where possible.

A future catalogue QA script should optionally probe URL availability, but must not treat HTTP 200 as evidence of licence validity, current pricing, product safety or scientific suitability.

## 5. How to use the catalogue responsibly

Select tools by required task, reproducibility, institution policy, available hardware, export path, accessibility and data sensitivity—not only by price or a tool's “AI” label. For participant data, inspect data-processing terms and storage region before uploading anything identifiable. For open-source repositories, review the licence and dependency/security model. For images, 3D models, fonts and icons, distinguish software licensing from content licensing and preserve required attribution.
