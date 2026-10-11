# Plane Pomodoro

A pomodoro timer where every focus session is a flight. You board, taxi, take off, climb, cruise, descend and land, timed so you arrive at the gate as the session ends. Breaks happen at the destination, and the next flight departs from there.

- **Two views** (button or `V`): the seat-back screen (countdown, moving map, flight stats, seatbelt sign, tray table with a task list) and the cabin window (procedurally drawn scenery).
- **Airports**, each with its own landmarks, terrain, weather and tower:
  - Big cities: Heathrow, LAX, JFK, Charles de Gaulle, Haneda, Dubai, Sydney, SFO, Hong Kong (ICC, Bank of China, the Big Buddha on Lantau) and Singapore (Marina Bay Sands, Supertrees)
  - Runways by the sea: Rio Santos Dumont (Sugarloaf, Christ the Redeemer), Gibraltar (the Rock, Morocco across the strait) and Malé (turquoise lagoon, island city)
  - Mountains: Cape Town (Table Mountain and its tablecloth), Innsbruck (Alps, Bergisel ski jump), Queenstown (the Remarkables) and Paro (Tiger's Nest, the Himalaya)
- **Real sky**: the sun's position follows the real time at the aircraft's position along the great-circle route.
- **Synthesised sound**: cabin airflow, engine spool, runway rumble, gear clunks, touchdown, cabin chimes and optional spoken announcements, all generated with Web Audio. There are no audio files.

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # timer + flight model unit tests
npm run build    # static site in dist/
```

## Keys

`Space` start/pause · `V` switch view · `S` window shade · `M` mute · `+`/`-` zoom window · `0` reset zoom

In the window view, the scroll wheel or a two-finger pinch also zooms.

## Debug

Append `?debug` to show a scrubber. URL overrides make scenes reproducible, for example:

```
?debug&view=window&from=HND&to=SYD&p=0.075&sun=30
?debug&view=window&mode=longBreak&from=DXB&to=SYD&sun=-10
```

`p` is flight progress (0–1), `sun` is solar elevation in degrees, `mode` is `focus|shortBreak|longBreak`, and `autostart` starts the timer.

## Layout

- `src/state/`: timer state machine (wall-clock based), flight-phase model, persisted settings
- `src/data/`: airports and great-circle route maths
- `src/scenes/`: Canvas renderer (sky, clouds, ground, airports, landmarks, wing, cabin wall)
- `src/audio/`: Web Audio engine and cue sounds
- `src/views/`: seat-back screen and moving map
