# WareSim AI Interactive Prototype

## Goal
Build the Vietnamese desktop-first warehouse control room described in the brief, centered on a live interactive 2D warehouse rather than a static dashboard.

## What will be built
- Persistent control-room shell with compact navigation, warehouse selector, search, simulation clock, notifications, AI status, and operator profile.
- Live warehouse page with KPI strip, run/pause/reset and speed controls, operational actions, and a large SVG/HTML warehouse map.
- Warehouse zones, racks, docks, trucks, pallets, pickers, forklifts, routes, labels, status indicators, zoom controls, and clickable entity details.
- Smooth local simulation loop: moving agents, advancing task progress, live clock, changing event stream, and KPI updates.
- Working inbound and outbound workflows through focused dialogs; submitted operations create tasks, change map activity, and update inventory/KPIs.
- Flash Sale workflow that increases orders and workload, escalates Zone B from stable to warning/critical, and triggers AI analysis.
- Persistent AI Copilot with contextual responses, recommendation actions, approval/rejection, and predefined chat responses.
- Dedicated what-if comparison overlay showing current versus AI-optimized outcomes, followed by human approval and visible recovery in the live warehouse.
- Compact live tasks and event log below the simulation.
- Detail panel for zones, workers, forklifts, racks, pallets, and orders.

## Supporting views
Navigation items will switch to useful local-state views for orders, inventory, scenarios, analytics, alerts, and reports without requiring a backend. The simulation remains the default and most detailed screen.

## Technical details
- React 19, TypeScript, Tailwind CSS v4, Lucide icons, and local React state.
- Semantic OKLCH tokens in the global design system; blue-led enterprise palette with green, amber, and red operational states.
- Custom SVG/DOM warehouse visualization with CSS motion and `prefers-reduced-motion` handling.
- All major actions work locally; no authentication, database, or external AI service.
- Route-level metadata for the main page and responsive handling for laptop widths.

## Validation
- Verify the initial simulation is visibly active.
- Exercise play/pause, speed, reset, inbound, outbound, Flash Sale, AI what-if, approval, zoom, and entity details.
- Confirm KPI, inventory, tasks, events, warehouse status, and AI messages change together.
- Check desktop and smaller-laptop layouts for overlap and readability.
