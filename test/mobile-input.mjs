import assert from 'node:assert/strict';
import { Input } from '../src/core/Input.js';
import { GPU } from '../src/engine/gpu/GPU.js';

globalThis.window = new EventTarget();
globalThis.document = new EventTarget();
const canvas = new EventTarget();
let lockRequests = 0;
canvas.requestPointerLock = () => { lockRequests++; };
const input = new Input( canvas, { touchMode: true } );
const key = ( type, code ) => {
	const event = new Event( type );
	Object.assign( event, { code } );
	window.dispatchEvent( event );
};

// A joystick release must not release a physical key held on a hybrid device.
key( 'keydown', 'KeyW' );
input.setVirtualKey( 'KeyW', true );
input.clearVirtual();
assert.equal( input.down( 'KeyW' ), true );
key( 'keyup', 'KeyW' );
assert.equal( input.down( 'KeyW' ), false );

// Tap actions survive until the next frame; a held action fires only once.
input.setVirtualKey( 'Space', true );
assert.equal( input.hit( 'Space' ), true );
input.endFrame();
input.setVirtualKey( 'Space', true );
assert.equal( input.hit( 'Space' ), false );
assert.equal( input.down( 'Space' ), true );
input.setVirtualKey( 'Space', false );
input.setVirtualKey( 'KeyE', true );
input.setVirtualKey( 'KeyE', false );
assert.equal( input.hit( 'KeyE' ), true );
input.endFrame();
assert.equal( input.hit( 'KeyE' ), false );

// Menus gate movement and discard look accumulated before they opened.
input.setVirtualKey( 'KeyW', true );
input.addLook( 15, 8 );
input.enabled = false;
input.addLook( 10, 10 );
assert.equal( input.down( 'KeyW' ), false );
assert.deepEqual( input.consumeLook(), { x: 0, y: 0 } );
input.clearVirtual();
input.enabled = true;
assert.equal( input.down( 'KeyW' ), false );
assert.deepEqual( input.consumeLook(), { x: 0, y: 0 } );

input.setVirtualKey( 'KeyD', true );
key( 'keydown', 'KeyA' );
input.addLook( 5, 5 );
window.dispatchEvent( new Event( 'blur' ) );
assert.equal( input.down( 'KeyD' ), false );
assert.equal( input.down( 'KeyA' ), false );
assert.deepEqual( input.consumeLook(), { x: 0, y: 0 } );
input.requestLock();
assert.equal( lockRequests, 0 );
input.touchMode = false;
input.requestLock();
assert.equal( lockRequests, 1 );

// An unsupported shader must reject readiness instead of reaching a blank scene.
const oldDevice = GPU.device, oldConsole = console.error;
let reported;
GPU.device = { createComputePipelineAsync: async () => { throw new Error( 'test adapter binding limit' ); } };
GPU.onError = error => { reported = error; };
console.error = () => {};
try {
	GPU.computePipeline( { label: 'unsupported mobile shader' } );
	await assert.rejects( GPU.pipelinesReady(), /test adapter binding limit/ );
	assert.match( reported.message, /unsupported mobile shader/ );
} finally {
	GPU.device = oldDevice;
	GPU.failure = null;
	GPU.onError = null;
	console.error = oldConsole;
}
console.log( 'Mobile input coexistence, action lifecycle, menu/blur cancellation and GPU failure propagation passed.' );
