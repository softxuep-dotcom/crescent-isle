// CPU movement regression for the applied Crescent Isle layout.
// Usage: node tools/review/walk-check.mjs [--out /absolute/path/report.json]
// Node 22.15+ is required for registerHooks; no browser or GPU is initialized.
import { registerHooks } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath( new URL( '../../', import.meta.url ) );
const args = process.argv.slice( 2 );
const outIndex = args.indexOf( '--out' );
const output = resolve( outIndex >= 0 ? args[ outIndex + 1 ] : resolve( project, 'artifacts/walk-check.json' ) );
const DT = 1 / 60;
const report = {
	created: new Date().toISOString(), status: 'running', fixedStepSeconds: DT,
	scope: 'Actual TerrainData, Village, Rocks, DebrisPlacer, vegetation placement, Colliders and Player.update().',
	limits: [
		'Ocean query returns a constant sea level of zero; waves, swimming and boat boarding are not tested.',
		'GPU-only detail-texture upload/mipmap generation and decorative-fish upload are skipped; original CPU pixels, geometry and colliders are retained.',
		'No renderer, DOM, pointer lock, audio or animation-loop timing is tested. This is not a FPS or visual-quality measurement.',
		'Every route starts at the configured spawn and moves continuously with W and look input; no position teleport, jump or collision bypass is used.',
	], checks: [], routes: [],
};

function check( name, pass, data = {} ) {

	report.checks.push( { name, pass: !! pass, ...data } );
	return pass;

}

// The placement sampler needs the generated CPU pixels, but its original helper also
// uploads those pixels. Remove only those two GPU operations for this process.
const textureURL = new URL( '../../src/world/terrain/DetailTextures.js', import.meta.url ).href;
registerHooks( {
	load( url, context, nextLoad ) {

		const loaded = nextLoad( url, context );
		if ( url !== textureURL ) return loaded;
		let text = typeof loaded.source === 'string' ? loaded.source : Buffer.from( loaded.source ).toString( 'utf8' );
		for ( const statement of [ 'tex.getGPU();', 'generateMipmaps( tex );' ] ) {

			if ( ! text.includes( statement ) ) throw new Error( 'CPU texture hook no longer matches: ' + statement );
			text = text.replace( statement, '/* CPU regression: GPU upload omitted. */' );

		}
		return { ...loaded, source: text };

	},
} );

try {

	const [ E, { TerrainData }, { Village }, { Rocks }, { DebrisPlacer }, { Builder }, { InstancedProps }, { Colliders }, { Player }, { WORLD }, { VegSite, scatterVegetation }, { FishProps }, { mulberry32 } ] = await Promise.all( [
		import( '../../src/engine/index.js' ),
		import( '../../src/world/TerrainData.js' ),
		import( '../../src/world/Village.js' ),
		import( '../../src/world/Rocks.js' ),
		import( '../../src/world/debris/DebrisPlacement.js' ),
		import( '../../src/world/village/GeoBuilder.js' ),
		import( '../../src/world/Props.js' ),
		import( '../../src/world/Colliders.js' ),
		import( '../../src/player/Player.js' ),
		import( '../../src/world/WorldLayout.js' ),
		import( '../../src/world/vegetation/Scatter.js' ),
		import( '../../src/world/fish/FishProps.js' ),
		import( '../../src/util/Noise.js' ),
	] );
	if ( WORLD.pier.x !== - 55 || WORLD.pier.zStart !== - 70 || WORLD.pier.zEnd !== 22 ) {

		throw new Error( 'Apply the Crescent Isle stage 2 layout before running this regression.' );

	}
	Math.random = mulberry32( 930 );
	FishProps.prototype.build = () => new E.Group();
	const scene = new E.Group();
	const terrain = new TerrainData();
	const colliders = new Colliders();
	const village = new Village( { scene, terrain, colliders } );
	const lanes = [ village.path, ...( village.sidePaths || [] ) ].filter( Boolean );
	const paths = lanes.map( p => {

		const points = p.samples.filter( ( _, i ) => i % 5 === 0 ).map( s => [ s.p.x, s.p.z ] );
		const last = p.samples.at( - 1 ).p;
		points.push( [ last.x, last.z ] );
		return { points, width: p.width ?? 1.8 };

	} );
	const site = new VegSite( terrain, { footprints: village.getFootprints(), paths } );
	const records = scatterVegetation( site );
	const vegetation = { records };
	const rocks = new Rocks( { scene, terrain, village, colliders, sunShadow: false } );
	const B = new Builder();
	const debris = new DebrisPlacer( { B, inst: new InstancedProps( B ), terrain, village, vegetation, rocks, colliders } ).run();
	report.layout = {
		spawn: { x: WORLD.start.position.x, z: WORLD.start.position.z },
		pier: WORLD.pier,
		cabins: village.buildings.map( b => ( { name: b.name, x: b.x, z: b.z, floorY: b.floorY } ) ),
		villageGeometry: village.getStats(),
		vegetation: Object.fromEntries( Object.entries( records ).map( ( [ k, v ] ) => [ k, Array.isArray( v ) ? v.length : v ] ) ),
		colliders: { boxes: colliders.boxes.length, cylinders: colliders.cylinders.length, debris: debris.newColliders },
	};
	check( 'Exactly three cabins', village.buildings.length === 3 );
	const floatingFoundations = village.foundationChecks.filter( p => p.y > terrain.heightAt( p.x, p.z ) + 0.02 );
	check( 'All sampled foundations meet the ground', floatingFoundations.length === 0, { floating: floatingFoundations } );
	const plants = Object.values( records ).filter( Array.isArray ).flat();
	const spawnClearance = Math.min( ...plants.map( p => Math.hypot( p.x - WORLD.start.position.x, p.z - WORLD.start.position.z ) ) );
	check( 'Vegetation clears the spawn', spawnClearance >= 5, { nearestMetres: spawnClearance } );
	const landingHeight = terrain.heightAt( WORLD.pier.x, WORLD.pier.zStart );
	check( 'Jetty starts on dry sand near deck height', landingHeight > 0.3 && landingHeight < WORLD.pier.deckHeight + 0.3, { ground: landingHeight, deck: WORLD.pier.deckHeight } );
	const berth = WORLD.boatDock.position;
	check( 'Boat berth has water depth', terrain.heightAt( berth.x, berth.z ) < - 1.5, { seabed: terrain.heightAt( berth.x, berth.z ) } );
	// A moved jetty must not leave benches/crates/barrels floating at its old coordinates.
	const deckTags = new Set( [ 'bench', 'table', 'crate', 'crates', 'trap', 'traps', 'barrel', 'bollard' ] );
	const floatingProps = [];
	for ( const b of colliders.boxes ) {

		if ( ! deckTags.has( b.tag ) || Math.abs( b.bottom - WORLD.pier.deckHeight ) > 0.15 ) continue;
		const ground = terrain.heightAt( b.center.x, b.center.z );
		const support = colliders.groundHeightAt( b.center.x, b.center.z, b.bottom + 0.1 );
		if ( ground < 0 && support < b.bottom - 0.2 ) floatingProps.push( { tag: b.tag, x: b.center.x, z: b.center.z } );

	}
	for ( const c of colliders.cylinders ) {

		if ( ! deckTags.has( c.tag ) || Math.abs( c.yMin - WORLD.pier.deckHeight ) > 0.15 ) continue;
		const support = colliders.groundHeightAt( c.x, c.z, c.yMin + 0.1 );
		if ( terrain.heightAt( c.x, c.z ) < 0 && support < c.yMin - 0.2 ) floatingProps.push( { tag: c.tag, x: c.x, z: c.z } );

	}
	check( 'Jetty props follow the relocated deck', floatingProps.length === 0, { floating: floatingProps } );
	const ladder = village.pierInfo.ladder;
	check( 'Ladder follows the new jetty head', !! ladder && Math.abs( ladder.x - WORLD.pier.x ) < WORLD.pier.headWidth && ladder.z >= WORLD.pier.zEnd - WORLD.pier.headDepth && ladder.z <= WORLD.pier.zEnd, { ladder } );

	const xz = p => [ p.x, p.z ];
	const distance = ( a, b ) => Math.hypot( a[ 0 ] - b[ 0 ], a[ 1 ] - b[ 1 ] );
	const nearest = ( lane, target ) => {

		let best = 0;
		for ( let i = 1; i < lane.samples.length; i ++ ) if ( distance( xz( lane.samples[ i ].p ), target ) < distance( xz( lane.samples[ best ].p ), target ) ) best = i;
		return best;

	};
	const segment = ( lane, first, last ) => {

		const points = [];
		const direction = first <= last ? 1 : - 1;
		for ( let i = first; direction > 0 ? i <= last : i >= last; i += direction * 5 ) points.push( xz( lane.samples[ i ].p ) );
		points.push( xz( lane.samples[ last ].p ) );
		return points;

	};
	const start = xz( WORLD.start.position );
	const spawnIndex = nearest( village.path, start );
	const pierRoute = segment( village.path, spawnIndex, 0 );
	for ( let z = WORLD.pier.zStart; z < WORLD.pier.zEnd - 3.5; z += 1 ) pierRoute.push( [ WORLD.pier.x, z ] );
	pierRoute.push( [ WORLD.pier.x, WORLD.pier.zEnd - 3.5 ] );
	const routes = [ { name: 'Jetty and return', points: pierRoute } ];
	for ( const [ i, lane ] of village.sidePaths.entries() ) {

		const branch = nearest( village.path, xz( lane.samples[ 0 ].p ) );
		routes.push( { name: village.buildings[ i ].name + ' exterior and return', points: [ ...segment( village.path, spawnIndex, branch ), ...segment( lane, 0, lane.samples.length - 1 ) ] } );

	}
	routes.push( { name: village.buildings[ 2 ].name + ' exterior and return', points: segment( village.path, spawnIndex, village.path.samples.length - 1 ) } );

	function runRoute( route ) {

		let looking = 0, walking = false;
		const input = { down: code => walking && code === 'KeyW', hit: () => false, consumeLook: () => {

			const x = looking; looking = 0; return { x, y: 0 };

		} };
		const query = { cpuValid: true, cpu: new Float32Array( 4 ), allocate: () => 0, setPoint: () => {} };
		const player = new Player( { camera: new E.PerspectiveCamera( 60, 16 / 9, 0.1, 2000 ), input, terrain, colliders, query, boat: null, reef: null } );
		const result = { name: route.name, pass: false, frames: 0, travelledMetres: 0, maxSurfaceDeficit: 0, minY: Infinity, maxY: - Infinity };
		const waypoints = [ ...route.points, ...route.points.slice( 0, - 1 ).reverse(), start ];
		let checkpoint = 0;
		function advance() {

			const before = player.position.clone();
			player.update( DT );
			result.frames ++;
			const p = player.position;
			if ( ! [ p.x, p.y, p.z, player.velocity.x, player.velocity.y, player.velocity.z, player.camera.position.y ].every( Number.isFinite ) ) throw new Error( 'Non-finite player/camera state' );
			const support = Math.max( terrain.heightAt( p.x, p.z ), colliders.groundHeightAt( p.x, p.z, Infinity ) );
			result.maxSurfaceDeficit = Math.max( result.maxSurfaceDeficit, support - p.y );
			if ( support - p.y > 0.12 ) throw new Error( 'Fell below the terrain/walkable surface' );
			if ( player.mode !== 'walk' ) throw new Error( 'Left dry walking route: mode=' + player.mode );
			result.travelledMetres += Math.hypot( p.x - before.x, p.z - before.z );
			result.minY = Math.min( result.minY, p.y );
			result.maxY = Math.max( result.maxY, p.y );

		}
		try {

			for ( let i = 0; i < 30; i ++ ) advance();
			for ( const target of waypoints ) {

				walking = true;
				let initialDistance = distance( xz( player.position ), target );
				let previousWindowDistance = initialDistance;
				const budget = Math.ceil( ( initialDistance / 2 + 8 ) / DT );
				let arrived = false;
				for ( let frame = 0; frame < budget; frame ++ ) {

					const p = player.position;
					const d = distance( xz( p ), target );
					if ( d < 0.22 ) { arrived = true; break; }
					if ( frame > 0 && frame % 120 === 0 ) {

						if ( previousWindowDistance - d < 0.12 ) throw new Error( 'Stalled against obstacle while approaching ' + JSON.stringify( target ) );
						previousWindowDistance = d;

					}
					const yaw = Math.atan2( - ( target[ 0 ] - p.x ), - ( target[ 1 ] - p.z ) );
					const delta = Math.atan2( Math.sin( yaw - player.yaw ), Math.cos( yaw - player.yaw ) );
					looking = - delta / 0.0022;
					advance();

				}
				if ( ! arrived ) throw new Error( 'Waypoint timeout at ' + JSON.stringify( target ) );
				checkpoint ++;

			}
			walking = false;
			for ( let i = 0; i < 30; i ++ ) advance();
			result.endDistanceFromSpawn = distance( xz( player.position ), start );
			if ( result.endDistanceFromSpawn > 0.6 ) throw new Error( 'Did not return to the spawn' );
			result.pass = true;

		} catch ( error ) {

			result.error = error.message;
			result.position = { x: player.position.x, y: player.position.y, z: player.position.z };
			result.target = waypoints[ checkpoint ];
			result.mode = player.mode;

		}
		result.checkpointsReached = checkpoint;
		result.checkpointsTotal = waypoints.length;
		result.simulatedSeconds = result.frames * DT;
		return result;

	}
	for ( const route of routes ) report.routes.push( runRoute( route ) );
	report.status = report.checks.every( c => c.pass ) && report.routes.every( r => r.pass ) ? 'passed' : 'failed';

} catch ( error ) {

	report.status = 'failed';
	report.error = error.stack || error.message;

} finally {

	mkdirSync( dirname( output ), { recursive: true } );
	writeFileSync( output, JSON.stringify( report, null, 2 ) );
	console.log( JSON.stringify( { status: report.status, checks: report.checks.map( c => ( { name: c.name, pass: c.pass } ) ), routes: report.routes.map( r => ( { name: r.name, pass: r.pass, simulatedSeconds: r.simulatedSeconds, error: r.error } ) ), error: report.error, output }, null, 2 ) );
	if ( report.status !== 'passed' ) process.exitCode = 1;

}
