# Tasks: Stremio Netflix-Style Web UI

**Input**: Design documents from `.specify/memory/plan.md`

**Prerequisites**: plan.md, spec.md

## Phase 1: Setup & Global Configurations

**Purpose**: Project initialization, scaffolding, and core structure.

- [x] T001 Initialize React project (Vite) with TypeScript, Tailwind CSS, React Router DOM, and Zustand.
- [x] T002 [P] Configure Tailwind theme variables (extend `tailwind.config.js` with Stremio purple, Netflix dark shades, and custom animation keyframes). [Requires UI Reference]
- [x] T003 Setup exact folder structure (`src/components`, `src/pages`, `src/layouts`, `src/store`, `src/mocks`, `src/hooks`).
- [x] T004 [P] Initialize React Router DOM with foundational route map (`/`, `/discover/:category`, `/title/:id`, `/search`, `/player/:id`).
- [x] T005 [P] Setup Zustand global store for User Library, Active Profile, and Currently Playing Media.

---

## Phase 2: Foundational UI Components ("Dumb" Components)

**Purpose**: Purely presentational components without data fetching logic, completely driven by props.

- [ ] T006 [P] Build common UI primitives (Buttons, Inputs, Loaders) in `src/components/common`. [Requires UI Reference]
- [x] T007 Build `FloatingNav` component with sticky scrolling behavior in `src/components/layout/FloatingNav.tsx`. [Requires UI Reference]
- [x] T008 [P] Build `HeroBanner` component with immersive background, logo overlay, synopsis, and CTA buttons in `src/components/media/HeroBanner.tsx`. [Requires UI Reference]
- [ ] T009 Build `MediaCard` component with hover scaling animations, mini-preview, and basic metadata in `src/components/media/MediaCard.tsx`. [Requires UI Reference]
- [ ] T010 Build `MediaCarousel` component implementing horizontal scrolling and `MediaCard` integration in `src/components/media/MediaCarousel.tsx`. [Requires UI Reference]

---

## Phase 3: Complex Views & Pages

**Purpose**: Assemble foundational components into the main architectural views.

- [ ] T011 Build the `Home` page assembling the `FloatingNav`, `HeroBanner`, and multiple `MediaCarousel` instances in `src/pages/Home.tsx`.
- [ ] T012 Build the `Detailed Media Modal` layout with specific typographic hierarchy, callouts, and episodes grid in `src/components/media/MediaDetailModal.tsx`. [Requires UI Reference]
- [ ] T013 [P] Build the `Search` interface layout with input area and responsive grid results in `src/pages/Search.tsx`. [Requires UI Reference]
- [ ] T014 [P] Build the `Player` mock view with custom Audio/Subtitle overlay and "Skip Intro" UI in `src/pages/Player.tsx`. [Requires UI Reference]
- [ ] T015 Build the `Discover` page to display categorized media dynamically in `src/pages/Discover.tsx`.

---

## Phase 4: Mock Data Integration & State Connections

**Purpose**: Connect "dumb" components and pages to local mock data mirroring Stremio's API.

- [ ] T016 Define Stremio's Add-on API ecosystem interfaces (`MetaDetail`, `Stream`, `Catalog`) in `src/mocks/types.ts`.
- [ ] T017 Create comprehensive mock datasets for catalog, search results, and meta details in `src/mocks/catalog.ts` and `src/mocks/meta.ts`.
- [ ] T018 Implement custom data-fetching hooks (`useCatalog`, `useMeta`, `useSearch`) simulating network latency.
- [ ] T019 Integrate `useCatalog` and `useMeta` into the `Home` and `Discover` pages to feed the `MediaCarousel` and `HeroBanner` with mock data.
- [ ] T020 Connect the `Search` view to the `useSearch` hook for dynamic grid population.
- [ ] T021 Connect the `Detailed Media Modal` to display rich data using the mocked `MetaDetail` interface.
- [ ] T022 Wire up UI actions (e.g., "Add to List") to update the Zustand global store (User Library).

---

## Phase 5: Polish & UX Refinement

**Purpose**: Finalize animations, lazy loading, and edge cases.

- [ ] T023 Implement lazy loading for all media imagery across `MediaCard` and `HeroBanner`.
- [ ] T024 Polish CSS animations ensuring 60fps card hover scaling and modal transitions without layout thrashing. [Requires UI Reference]
- [ ] T025 Add text truncation with "read more" expansion logic for long synopses in Heroes and Modals.
