# Exploration smoke

Success: true.

- PASS: Home during initialization causes no exception
- PASS: Chinese start screen
- PASS: ExplorationUI bound to app
- PASS: Fishing/economy Game not constructed
- PASS: Start click enters exploration
- LIMITED: Native pointer lock
- PASS: W moves the walking player
- PASS: F enters free camera
- PASS: F returns to walking
- PASS: Home restores entrance and heading
- PASS: H toggles settings open
- PASS: H toggles settings closed
- PASS: F1 opens Chinese exploration guide
- PASS: Credits reachable from guide with attribution
- PASS: F1 closes guide
- PASS: State regression: Home leaves helm and clears throttle

Pointer lock: Headless browser did not grant pointer lock; keyboard movement is still tested independently. Mouse-look lock remains unverified in a visible browser.

Error: none
