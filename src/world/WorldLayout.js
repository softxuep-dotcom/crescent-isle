import * as THREE from '../engine/index.js';

// Shared world layout. Coordinates in meters, y up, sea level y = 0.
// The open ocean lies to the south (+z); the island to the north (-z).
// Sun rises in the east (+x) and sets in the west (-x).
export const WORLD = {
	terrainSize: 2048, // heightmap domain, centered at origin
	terrainRes: 2048,

	// Central sandy beach inside the bay, shoreline near z ≈ -42 at x = 0.
	beach: { xMin: - 150, xMax: 170 },

	pier: {
		x: - 55,
		zStart: - 70, // on dry sand
		zEnd: 22, // end of pier in sheltered shallows
		deckHeight: 2.3, // deck surface above sea level
		width: 2.6,
		headWidth: 14, // T-shaped platform at the end
		headDepth: 7,
	},

	// Where the boat is moored: east side of the pier head, bow pointing south.
	boatDock: { position: new THREE.Vector3( - 45.5, 0, 18.5 ), heading: 0 },

	village: { center: new THREE.Vector3( 0, 0, - 125 ), radius: 100 },

	reef: { center: new THREE.Vector3( 85, 0, 65 ), radius: 58 },

	spawn: { position: new THREE.Vector3( - 54, 0, - 85 ), yaw: Math.PI }, // kept clear of rocks, plants and debris
	// where the player starts: on the boardwalk up from the pier foot, looking down it toward the pier
	start: { position: new THREE.Vector3( - 54, 0, - 85 ), yaw: Math.PI },

	// Incoming swell direction (unit, travel direction)
	swellDir: new THREE.Vector2( - 0.12, - 1 ).normalize(),
};
