import { BufferGeometry, Color, Euler, Group, Mesh, Vector3 } from '../engine/index.js';
import { mulberry32 } from '../util/Noise.js';
import { Builder, Batch } from './village/GeoBuilder.js';
import { createVillageMaterials } from './village/VillageMaterials.js';
import { VillageTextures } from './village/TextureBaker.js';
import { buildHouse } from './village/Buildings.js';
import { buildBoardwalk } from './village/Boardwalk.js';
import { buildPier } from './Pier.js';
import { G } from '../engine/render/Frame.js';
import { InstancedProps, Rand, lin, bench } from './Props.js';

// Crescent Isle: three quiet timber cabins, a western jetty and a branching boardwalk.
// The Tidewater procedural building, material and collision systems are retained.
const _lanternEuler = new Euler();

export class Village {

	constructor( { scene, terrain, colliders } ) {

		this.scene = scene;
		this.terrain = terrain;
		this.colliders = colliders;
		this.lights = [];
		this.footprints = [];
		this.foundationChecks = [];
		this.buildings = [];
		this.group = new Group();
		this.group.name = 'Crescent cabins';
		this.rand = new Rand( mulberry32( 320929 ) );
		const rand = this.rand;
		this.textures = new VillageTextures();
		this.materials = createVillageMaterials( this.textures );
		this.B = new Builder();
		this.harbor = this.town = this.B;
		this.inst = new InstancedProps( this.B );
		const specs = this._layout();
		this._flattenPads( specs );
		const ctx = { B: this.B, terrain, colliders, rand, lights: this.lights, inst: this.inst, checks: this.foundationChecks };

		this.signB = new Builder();
		this.pierInfo = buildPier( { ...ctx, signB: this.signB, hang: () => new Builder() } );
		const foot = this.pierInfo.stepFoot;
		this.path = buildBoardwalk( ctx, [
			[ foot.x, foot.z + 0.05 ], [ - 55, - 74 ], [ - 54, - 85 ], [ - 49, - 96 ],
			[ - 40, - 106 ], [ - 20, - 113 ], [ 0, - 124 ], [ 14, - 134 ], [ 19, - 137 ],
		], { width: 1.8, lift: 0.18, startY: foot.y + 0.18, lightEvery: 105 } );
		for ( const s of specs.houses ) {

			const res = buildHouse( ctx, s );
			this.buildings.push( { name: s.name, x: s.x, z: s.z, floorY: res.floorY, roofTop: res.roofTop, stilts: false, footprint: res.footprint } );
			this.footprints.push( res.footprint );

		}
		this.sidePaths = [
			buildBoardwalk( ctx, [ [ - 49, - 96 ], [ - 64, - 96 ], [ - 78, - 100 ], [ - 86, - 103 ] ], { width: 1.4, lift: 0.18, lightEvery: 1e9 } ),
			buildBoardwalk( ctx, [ [ - 20, - 113 ], [ - 22, - 115.5 ], [ - 23.5, - 118.5 ] ], { width: 1.4, lift: 0.18, lightEvery: 1e9 } ),
		];
		// A single seat faces the bay; keep the arrival and walking corridor open.
		const bx = - 62, bz = - 86, by = terrain.heightAt( bx, bz );
		bench( this.B, bx, by, bz, 0, 1.8, rand.next(), lin( 0x75928b ) );
		colliders.addBox( new Vector3( bx, by + 0.45, bz ), new Vector3( 0.95, 0.45, 0.3 ), 0, { tag: 'bench' } );
		this.footprints.push( { x: bx, z: bz, r: 1.4, kind: 'prop' } );
		this.foundationChecks.push( { x: bx, y: by, z: bz } );
		this._assemble();
		this._buildSign();
		this._buildLanterns();
		scene.add( this.group );

	}

	_layout() {

		const white = lin( 0xeee7d6 ), teal = lin( 0x326c69 );
		return { houses: [
			{ name: 'Driftwood cabin', x: - 85, z: - 110, yaw: - 0.18, w: 6.4, d: 5.1, foundation: 'posts', roof: 'gable', roofMat: 'metal', roofColor: lin( 0x698986 ), wall: lin( 0xdacbae ), trim: white, accent: teal, siding: 1, porch: { depth: 2.0, rail: 'x' }, paint: 0.48, clearance: 0.45, curtain: lin( 0xe8d6b0 ), shutters: 'board' },
			{ name: 'Palm cabin', x: - 24, z: - 126, yaw: 0.08, w: 6.0, d: 5.0, foundation: 'posts', roof: 'hip', roofMat: 'thatch', wall: lin( 0xe1d8bd ), trim: teal, accent: lin( 0xa97050 ), siding: 2, porch: { depth: 2.0, rail: 'balusters' }, paint: 0.5, clearance: 0.45, thatchAge: 0.4, curtain: lin( 0xdacda9 ), shutters: 'bahama' },
			{ name: 'Ridge cabin', x: 18, z: - 145, yaw: 0.12, w: 6.2, d: 5.2, foundation: 'stone', stoneStyle: 1, roof: 'gable', roofMat: 'metal', roofColor: lin( 0x98705a ), wall: lin( 0xa8b69e ), trim: white, accent: teal, siding: 1, porch: { depth: 2.0, rail: 'x' }, paint: 0.56, clearance: 0.45, curtain: lin( 0xe8d6b0 ), stovepipe: true },
		] };

	}

	// Flatten each complete cabin/porch footprint before derived terrain and shore textures exist.
	_flattenPads( specs ) {

		const t = this.terrain;
		if ( typeof t.flatten !== 'function' ) return;
		for ( const s of specs.houses ) {

			const pd = s.porch ? s.porch.depth : 1;
			const cx = s.x + pd * 0.5 * Math.sin( s.yaw ), cz = s.z + pd * 0.5 * Math.cos( s.yaw );
			let sum = 0;
			for ( let i = - 2; i <= 2; i ++ ) for ( let j = - 2; j <= 2; j ++ ) sum += t.heightAt( cx + i * s.w / 5, cz + j * ( s.d + pd ) / 5 );
			t.flatten( cx, cz, Math.hypot( s.w, s.d + pd ) / 2 + 0.3, sum / 25, 3.5 );

		}
		if ( typeof t.buildMinMax === 'function' ) t.buildMinMax();

	}

	_assemble() {

		const B = this.B;
		const mats = this.materials;
		const take = ( key ) => {

			const b = B.batches[ key ];
			delete B.batches[ key ];
			return b;

		};

		// fold small emitter keys into bigger materials (fewer draw calls):
		//   glass -> wood (pattern 9), rope -> hard (vdata.w = 2 + radius), cloth / net / flag -> fabric
		const wood = B.batch( 'wood' ), hard = B.batch( 'hard' ), fabric = B.batch( 'fabric' );
		const glass = take( 'glass' ), rope = take( 'rope' ), cloth = take( 'cloth' ), net = take( 'net' ), flag = take( 'flag' );
		if ( glass ) wood.append( glass, ( d ) => [ d[ 0 ], d[ 1 ], 9, d[ 2 ] ] );
		if ( rope ) hard.append( rope, ( d ) => [ d[ 0 ], 0, 0, 2 + d[ 1 ] ] );
		if ( cloth ) fabric.append( cloth, ( d ) => [ d[ 0 ], d[ 1 ], 0, 0 ] );
		// nets get their own blended material (see createNetMaterial)
		const nets = new Batch();
		if ( net ) nets.append( net, ( d ) => [ d[ 0 ], d[ 1 ], Math.max( 0.02, d[ 2 ] ), 0 ] );
		if ( flag ) fabric.append( flag, ( d ) => [ d[ 0 ], d[ 1 ], d[ 2 ] + 10000, d[ 3 ] ] );

		// All opaque geometry lives in ONE set of vertex / index buffers. Each opaque material
		// draws its own index range; the wood mesh is the only shadow caster and widens its
		// range to cover everything during the shadow passes (1 shadow draw per cascade).
		const opaque = new Batch();
		const ranges = {};
		for ( const key of [ 'wood', 'hard', 'roofMetal', 'thatch', 'stone' ] ) {

			const b = B.batches[ key ];
			if ( ! b || b.vcount === 0 ) continue;
			const start = opaque.idx.length;
			opaque.append( b );
			ranges[ key ] = { start, count: opaque.idx.length - start };

		}

		const shared = opaque.build();
		const total = shared.index.count;
		this.meshes = [];
		for ( const key in ranges ) {

			const geo = new BufferGeometry();
			for ( const name in shared.attributes ) geo.setAttribute( name, shared.attributes[ name ] );
			geo.setIndex( shared.index );
			geo.boundingBox = shared.boundingBox;
			geo.boundingSphere = shared.boundingSphere;
			const r = ranges[ key ];
			geo.setDrawRange( r.start, r.count );
			const mesh = new Mesh( geo, mats[ key ] );
			mesh.name = 'village_' + key;
			mesh.receiveShadow = true;
			mesh.castShadow = key === 'wood';
			if ( key === 'wood' ) {

				// the engine has no onBeforeShadow / onAfterShadow: onBeforeRender runs per pass
				// (before the draw list is built) with that pass's camera; the sun shadow cascade
				// cameras (render/Shadows.js) are flagged isShadowCamera (and use standard depth)
				const range = geo.drawRange;
				mesh.onBeforeRender = ( renderer, scene, camera ) => {

					this.textures.bake();
					const shadow = !! camera && ( camera.isShadowCamera === true || camera.reversedDepth === false );
					range.start = shadow ? 0 : r.start;
					range.count = shadow ? total : r.count;

				};

			}

			this.meshes.push( mesh );

		}

		this.shadowTriangles = total / 3;

		if ( fabric.vcount > 0 ) {

			const mesh = new Mesh( fabric.build(), mats.fabric );
			mesh.name = 'village_fabric';
			mesh.receiveShadow = true;
			mesh.castShadow = false;
			this.meshes.push( mesh );

		}

		if ( nets.vcount > 0 ) {

			const mesh = new Mesh( nets.build(), mats.net );
			mesh.name = 'village_nets';
			mesh.receiveShadow = true;
			mesh.castShadow = false;
			this.meshes.push( mesh );

		}

		// fish, lobsters, ice and banana leaves (market stall, drying racks, cleaning tables): one
		// instanced mesh with the fish material (fish/FishProps.js)
		if ( B.fishProps ) this.group.add( B.fishProps.build() );

		// the texture bake is recorded by whichever village mesh is drawn first in a frame
		// (the TSL version's VillageBakeNode.updateBefore); bake() is a no-op afterwards
		const bake = () => this.textures.bake();
		for ( const mesh of this.meshes ) if ( ! mesh.onBeforeRender ) mesh.onBeforeRender = bake;

		for ( const mesh of this.meshes ) {

			// never culled: all pipelines compile during the app's loading-screen precompile and
			// the texture bake runs on the first frame
			mesh.frustumCulled = false;
			mesh.matrixAutoUpdate = false;
			mesh.updateMatrix();
			this.group.add( mesh );

		}

		// release the CPU-side builders
		this.B = this.harbor = this.town = null;
		this.inst = null;

	}

	// The painted fish sign hangs from the arch beam on two short chains: a pendulum about the
	// chain tops (info.signPivot), same materials as the rest of the village (no new pipelines).
	_buildSign() {

		const S = this.signB, pivot = this.pierInfo.signPivot;
		this.signB = null;
		if ( ! S || ! pivot ) return;
		this.sign = new Group();
		this.sign.name = 'village_sign';
		this.sign.position.copy( pivot );
		this.sign.rotation.order = 'YXZ';
		for ( const key of [ 'wood', 'hard' ] ) {

			const b = S.batches[ key ];
			if ( ! b || b.vcount === 0 ) continue;
			const geo = b.build();
			geo.translate( - pivot.x, - pivot.y, - pivot.z );
			const mesh = new Mesh( geo, this.materials[ key ] );
			mesh.name = 'village_sign_' + key;
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			this.sign.add( mesh );

		}

		this.group.add( this.sign );
		this._swing = { t: 0, a: 0, av: 0, b: 0, bv: 0 };

	}

	// The pier's lanterns hang from their lamp-post arms (and the arch beam) on short chains: small
	// pendulums about the top of the chain, pushed by the wind with gusts. Same materials as the rest
	// of the village (no new pipelines); the light positions follow the lanterns.
	_buildLanterns() {

		const hung = this.pierInfo.hung || [];
		this.lanterns = [];
		const mats = this.materials;
		for ( const h of hung ) {

			const S = h.B;
			h.B = null;
			const g = new Group();
			g.name = 'village_lantern';
			g.position.copy( h.pivot );
			const glass = S.batches.glass;
			delete S.batches.glass;
			if ( glass ) S.batch( 'wood' ).append( glass, ( d ) => [ d[ 0 ], d[ 1 ], 9, d[ 2 ] ] );
			for ( const key of [ 'wood', 'hard' ] ) {

				const b = S.batches[ key ];
				if ( ! b || b.vcount === 0 ) continue;
				const geo = b.build();
				geo.translate( - h.pivot.x, - h.pivot.y, - h.pivot.z );
				geo.computeBoundingSphere();
				const mesh = new Mesh( geo, mats[ key ] );
				mesh.name = 'village_lantern_' + key;
				mesh.castShadow = false;
				mesh.receiveShadow = true;
				g.add( mesh );

			}

			this.group.add( g );
			this.lanterns.push( { obj: g, pivot: h.pivot, rest: h.rest, live: h.live, t: Math.random() * 50, ph: Math.random() * 6.28, x: 0, z: 0, vx: 0, vz: 0 } );

		}

	}

	_updateLanterns( dt ) {

		if ( ! this.lanterns || ! this.lanterns.length ) return;
		const v = G.windSpeed.value, wx = G.windDir.value.x, wz = G.windDir.value.y;
		const n = Math.max( 1, Math.ceil( Math.min( dt, 0.1 ) / ( 1 / 120 ) ) ), h = Math.min( dt, 0.1 ) / n;
		const W = 5.4, Z = 0.05; // rad/s (0.34 m pendulum), damping ratio
		for ( const l of this.lanterns ) {

			for ( let i = 0; i < n; i ++ ) {

				const t = l.t += h, p = l.ph;
				const gust = 1 + 0.4 * Math.sin( t * 0.73 + p ) * Math.sin( t * 0.31 + p * 0.5 ) + 0.25 * Math.sin( t * 2.3 + Math.sin( t * 0.9 + p ) * 1.5 );
				// lean the wind holds (tan ~ drag / weight, ~3 degrees at 7 m/s) plus buffeting
				const px = 0.0011 * v * v * gust * wx + 0.0012 * v * Math.sin( t * 1.9 + p + Math.sin( t * 0.53 ) * 2 );
				const pz = 0.0011 * v * v * gust * wz + 0.0012 * v * Math.sin( t * 1.6 + p * 1.7 + Math.sin( t * 0.41 ) * 2 );
				l.vx += ( W * W * ( px - l.x ) - 2 * Z * W * l.vx ) * h;
				l.x += l.vx * h;
				l.vz += ( W * W * ( pz - l.z ) - 2 * Z * W * l.vz ) * h;
				l.z += l.vz * h;

			}

			// bottom toward +x: +rotation about z; toward +z: -rotation about x
			l.obj.rotation.set( l.z, 0, - l.x );
			_lanternEuler.set( l.z, 0, - l.x );
			l.live.copy( l.rest ).sub( l.pivot ).applyEuler( _lanternEuler ).add( l.pivot );

		}

	}

	update( dt = 1 / 60 ) {

		this._updateLanterns( dt );

		// all other animation (flags, nets, laundry, lantern flicker) runs on the GPU from G.time / G.windDir / G.night
		const s = this._swing;
		if ( ! s ) return;
		// damped pendulum driven by the wind's push on the board (drag ~ v^2 on the face-on part of the
		// wind, with gusts), and a stiffer, smaller twist on the two chains
		const v = G.windSpeed.value, wx = G.windDir.value.x, wz = G.windDir.value.y;
		const n = Math.max( 1, Math.ceil( Math.min( dt, 0.1 ) / ( 1 / 120 ) ) ), h = Math.min( dt, 0.1 ) / n;
		const W = 4.9, WT = 10.5; // rad/s: swing (0.4 m to the board's centre) and twist (bifilar chains)
		for ( let i = 0; i < n; i ++ ) {

			const t = s.t += h;
			const gust = 1 + 0.35 * Math.sin( t * 0.73 + 1.3 ) * Math.sin( t * 0.31 ) + 0.22 * Math.sin( t * 2.1 + Math.sin( t * 0.9 ) ) + 0.1 * Math.sin( t * 5.3 + 2.0 );
			// tan of the lean the wind holds the board at (~9 degrees face-on at 7 m/s), plus turbulence
			// that keeps it moving when the wind is along the board
			const push = - 0.0033 * v * v * gust * wz * Math.abs( wz ) - 0.0009 * v * Math.sin( t * 1.7 + Math.sin( t * 0.43 ) * 2 );
			s.av += ( W * W * ( push * Math.cos( s.a ) - Math.sin( s.a ) ) - 2 * 0.07 * W * s.av ) * h;
			s.a += s.av * h;
			const twist = 0.004 * v * v * wx * wz * gust + 0.0015 * v * Math.sin( t * 2.9 + 1.1 );
			s.bv += ( WT * WT * ( twist - s.b ) - 2 * 0.12 * WT * s.bv ) * h;
			s.b += s.bv * h;

		}

		this.sign.rotation.set( s.a, s.b, 0 );

	}

	getLightSources() {

		return this.lights;

	}

	// circles { x, z, r } covered by buildings / big props (useful to keep vegetation out)
	getFootprints() {

		return this.footprints;

	}

	getStats() {

		let triangles = 0, drawCalls = 0;
		for ( const m of this.meshes ) {

			const total = m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count;
			triangles += Math.min( total, m.geometry.drawRange.count ) / 3;
			drawCalls ++;

		}

		const shadowCasters = this.meshes.filter( ( m ) => m.castShadow ).length;
		return { triangles, drawCalls, shadowCasters, shadowTriangles: this.shadowTriangles, lights: this.lights.length, textureMB: this.textures.bytes / 1048576, bakeMs: this.textures.bakeMs, baked: this.textures.baked };

	}

	dispose() {

		for ( const m of this.meshes ) m.geometry.dispose();
		for ( const k in this.materials ) this.materials[ k ].dispose();
		this.textures.dispose();
		this.scene.remove( this.group );

	}

}

