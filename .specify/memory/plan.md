# Implementation Plan: Stremio Netflix-Style Web UI

**Branch**: `plan/stremio-ui` | **Date**: 2026-06-01 | **Spec**: `.specify/memory/spec.md`

**Input**: Feature specification from `.specify/memory/spec.md`

## Summary

Build a highly polished, responsive React frontend mimicking the modern Netflix UI with Stremio's branding. The initial release will rely on mock data structured identically to future Stremio APIs, managed by a decoupled data layer using Zustand.

## Technical Context

**Language/Version**: React 18+ (Functional components, Hooks), TypeScript

**Primary Dependencies**: React Router DOM (routing), Zustand (state management), Tailwind CSS (styling), Framer Motion (optional, for advanced animations)

**Storage**: Local state / Zustand stores (mocked library)

**Testing**: Jest, React Testing Library

**Target Platform**: Web (Responsive: Mobile, Tablet, Desktop/TV)

**Project Type**: Web Application

**Performance Goals**: 60fps animations, lazy-loaded images, zero layout shift on initial render

**Constraints**: Purely presentational UI components fully decoupled from data fetching.

**Scale/Scope**: ~10 screens/modals, fully mocked API layer.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Project Core: Follows the modular, scalable React requirement.
- [x] Tech Stack: Uses React, Tailwind CSS, Zustand, React Router DOM.
- [x] UI/UX: Specifies floating nav, immersive hero, animations, and Stremio colors.
- [x] Code Quality: Validated component decoupling and lazy loading.
- [x] Version Control: Branched correctly (`plan/stremio-ui`).

## Project Structure

### Source Code (repository root)

```text
src/
├── components/          # Pure presentational UI components
│   ├── common/          # Buttons, Inputs, Loaders
│   ├── layout/          # FloatingNav, Footer
│   └── media/           # HeroBanner, MediaCarousel, MediaCard
├── layouts/             # Page wrappers (e.g., MainLayout, PlayerLayout)
├── pages/               # Route entry components (containers)
│   ├── Home.tsx         # mapped to /
│   ├── Discover.tsx     # mapped to /discover/:category
│   ├── TitleDetails.tsx # mapped to /title/:id
│   ├── Search.tsx       # mapped to /search
│   └── Player.tsx       # mapped to /player/:id
├── store/               # Zustand global state (User Library, Active Profile)
├── mocks/               # Mock data structures and contracts mirroring Stremio
│   ├── types.ts         # MetaDetail, Stream, Catalog interfaces
│   ├── catalog.ts       # Mock catalog data
│   └── meta.ts          # Mock metadata details
└── hooks/               # Custom hooks for decoupled data fetching
```

**Structure Decision**: A strictly modular React folder structure separating UI presentation (`components`) from data/state orchestration (`pages`, `store`, `hooks`).

## Technical Implementation Details

### State Management (Zustand)
We will use Zustand to manage global states such as:
- **User's Library**: Saved media items.
- **Active Profile**: Current user session.
- **Currently Playing Media**: State for the mock video player.
Zustand is chosen for its minimal boilerplate and easy scalability when we transition to fetching real Stremio add-on data.

### Routing Strategy (React Router DOM)
Routes will be configured to support deep linking and dynamic media consumption:
- `/`: Home page featuring the Hero Banner and main carousels.
- `/discover/:category`: Dedicated view for browsing specific categories.
- `/title/:id`: Route for the Detailed Media Info View.
- `/search`: The advanced search interface.
- `/player/:id`: The mock video player view.

### Styling & Theming (Tailwind CSS)
The `tailwind.config.js` will be extended to support the precise visual identity:
- **Colors**: Add Netflix's dark theme background shades (e.g., `zinc-900`, `black`) and Stremio's primary purple (`#8a5a99` or exact hex) for accents and buttons.
- **Animations**: Define custom keyframes for:
  - Hover scaling effects (`scale-105` with smooth transition durations).
  - Carousel sliding transitions.
  - Modal fade-ins (`fade-in-up`).
- **Typography**: Utilize a modern sans-serif font stack configured via Tailwind.

### Mock Data Strategy
- Create a `src/mocks/types.ts` defining Stremio's Add-on API ecosystem interfaces (e.g., `Catalog`, `MetaPreview`, `MetaDetail`, `Stream`).
- Implement custom hooks (e.g., `useCatalog`, `useMeta`) that currently resolve with data from `src/mocks/*.ts` after a simulated network delay.
- UI components will only consume data passed as props from these hooks, ensuring that switching to real `fetch` calls later will strictly be localized within the custom hooks, leaving the UI components completely untouched.
