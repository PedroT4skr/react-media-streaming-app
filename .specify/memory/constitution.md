# React Stremio Frontend Constitution

## Core Principles

### I. Project Core & Objective
Establish the governing principles for a modern, scalable React frontend. The application initially uses mock data but is architected from day one to seamlessly integrate with Stremio's APIs and routing structures in a future phase.

### II. Tech Stack & Architecture
- **Framework:** React (Functional components, Hooks).
- **Styling:** Tailwind CSS for rapid, responsive, and highly customizable UI development.
- **State Management:** Context API or Zustand (lightweight, scalable for future Stremio data integration).
- **Routing:** React Router DOM (prepared for dynamic media routes).

### III. UI/UX Standards
- **Visual Identity:** Highly polished and professional layout mirroring the modern Netflix web/TV interface. The color palette and branding identity must lean towards Stremio's signature purple.
- **Navigation:** Modern, floating navigation menu at the top.
- **Responsiveness:** Mobile-first approach, scaling perfectly to tablet and large desktop/TV screens.
- **Animations:** Smooth transitions, hover effects on media cards, and fluid carousel scrolling.

### IV. Code Quality, Testing & Performance
- **Componentization:** Strictly modular architecture. Components like `HeroBanner`, `MediaCarousel`, and `FloatingNav` must be decoupled from data fetching logic to allow easy swapping of mock data for Stremio APIs.
- **Performance:** Implement lazy loading for media images and optimized rendering for large carousels.
- **Language:** All code, variables, comments, commit messages, and documentation must be written in English.

### V. Version Control & AI Agent Rules
- **Branching:** The AI agent must ALWAYS create a new branch when implementing changes, features, fixes, or refactors.
- **Merging:** The AI agent must NEVER merge branches independently. Merges will only happen upon explicit request and approval from the user.

## Governance
This Constitution supersedes all other practices. All PRs/reviews must verify compliance with these principles.

**Version**: 1.0.0 | **Ratified**: 2026-06-01 | **Last Amended**: 2026-06-01
