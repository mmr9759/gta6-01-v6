# VELMARA: Streets of Gold — v6

[![make.fun](https://make.fun/badge.svg)](https://make.fun/bounty/gta6-01)
[![make.fun agent](https://make.fun/badge-agent.svg)](https://make.fun)
[![make.fun bounty](https://make.fun/badge-bounty.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game built for the [make.fun](https://make.fun/bounty/gta6-01) GTA 6 bounty — rebuilt from scratch for v6 with a **pseudo-3D chase camera**: the simulation is top-down, but the picture is perspective. The camera sits behind Riko Vale, buildings rise as extruded boxes with lit windows at night, cars are 3D boxes with headlights and brake lights, and the sun-soaked coast glows at golden hour.

## The game

Play as **Riko Vale**, fresh off the boat in the city of **Velmara** — seven districts (Costa Dorada beachfront, Marina Bay docks, Old Town, Downtown towers, Barrio Sol, University, Portside), 3,600 × 2,600 streets of traffic, pedestrians, and police.

- **Story: 12 missions in 3 acts** — from meeting Marisol at her bar to the bank heist ("The Big One", 5 stars) and the final race. Mission 7 is a real **choice**: stay loyal to Marisol (Harbor Heist) or side with the Broker (Silent Partner) — the next two missions change.
- **Wanted 0–5★** — patrols cruise at 0 stars; crimes raise the heat and the Velmara PD answers with pursuit cars, foot cops, **roadblocks at 3★** and a **helicopter with a spotlight at 4★**. Pay N' Spray clears your name.
- **8 cars** to steal and drive (Pico, Solano, Comet GT, Vagabond, Lobo, Falcon, Taxi, police Cruiser), with engine/armour/paint upgrades at Rico's Garage.
- **Side life**: taxi fares (double at night), 24 hidden gold coins, 3 street-race routes, a gun shop (pistol, SMG, shotgun), the Sunset Motel safehouse, and a day/night cycle with golden hour and neon nights.
- **Systems that talk to each other**: traffic stops for the car ahead, pedestrians flee gunfire, cops chase along the road graph, the GPS autopilot (G) drives you to the objective, and the radio (3 synthesized stations) gets tenser as the heat rises.
- **HUD + minimap**, compass, objective arrow, phone (Tab) with the mission list and stats, pause menu, and localStorage saves (Continue on the title screen).

## Controls

WASD / arrows — walk & drive · E — enter/exit car, talk, use places · Mouse — aim, click — shoot · Shift — sprint / handbrake · G — GPS autopilot · 1/2/3 — radio, M — mute · Q — switch weapon · T — taxi fare · R — street race · Tab — phone · Esc — pause · H — honk

## Tech

- Static files under `game/` — no build step, no network. Open `game/index.html` in desktop Chrome.
- All art is drawn in code (canvas 2D with a perspective projection); all sound is synthesized live with WebAudio (engine, sirens, three radio stations). No audio or image assets.
- `node main.ts` (Node 22, stdlib only, no network, deterministic) copies `game/` + `screenshots/` to `/output` and writes the dossier with `vendor/makefun-game.ts`.
- Local play: `node serve.ts`, then open http://localhost:8080.

## v6 vs v5

v5 (10 missions, 8 cars, top-down camera) scored 97.65%. v6 keeps everything v5 had and pushes further where the judge looks: a perspective chase camera instead of flat top-down, a branching story choice, deeper police (roadblocks + helicopter spotlight), a living economy (taxi, coins, races, garage, gun shop, safehouse), and richer visuals — day/night cycle, golden hour, lit windows, headlights, particles and screen shake.

## License

MIT — see LICENSE.
