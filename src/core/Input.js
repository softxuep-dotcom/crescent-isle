// Keyboard / mouse input with pointer lock support.
export class Input {

	constructor( dom, { touchMode = false } = {} ) {

		this.dom = dom;
		this.keys = new Set();
		this.pressed = new Set();
		this.virtualKeys = new Set();
		this.virtualPressed = new Set();
		this.touchMode = touchMode;
		this.look = { x: 0, y: 0 };
		this.wheel = 0;
		this.mouseDown = false;
		this.rightDown = false;
		this.locked = false;
		this.enabled = true;

		window.addEventListener( 'keydown', ( e ) => {

			if ( e.target && ( e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA' ) ) return;
			if ( ! this.keys.has( e.code ) ) this.pressed.add( e.code );
			this.keys.add( e.code );
			if ( [ 'Space', 'ArrowUp', 'ArrowDown', 'Tab' ].includes( e.code ) ) e.preventDefault();

		} );
		window.addEventListener( 'keyup', ( e ) => this.keys.delete( e.code ) );
		const release = () => {
			this.keys.clear();
			this.pressed.clear();
			this.mouseDown = this.rightDown = false;
			this.clearVirtual();
		};
		window.addEventListener( 'blur', release );
		document.addEventListener( 'visibilitychange', () => { if ( document.hidden ) release(); } );

		dom.addEventListener( 'mousedown', ( e ) => {
			if ( this.touchMode ) return; // Ignore compatibility mouse events synthesized by touch.

			if ( e.button === 0 ) this.mouseDown = true;
			if ( e.button === 2 ) this.rightDown = true;

		} );
		window.addEventListener( 'mouseup', ( e ) => {

			if ( e.button === 0 ) this.mouseDown = false;
			if ( e.button === 2 ) this.rightDown = false;

		} );
		dom.addEventListener( 'contextmenu', ( e ) => e.preventDefault() );
		window.addEventListener( 'mousemove', ( e ) => {
			if ( this.touchMode || ! this.enabled ) return;

			if ( this.locked || this.mouseDown || this.rightDown ) {

				this.look.x += e.movementX;
				this.look.y += e.movementY;

			}

		} );
		dom.addEventListener( 'wheel', ( e ) => {

			this.wheel += Math.sign( e.deltaY );
			e.preventDefault();

		}, { passive: false } );

		document.addEventListener( 'pointerlockchange', () => {

			this.locked = document.pointerLockElement === dom;

		} );

	}

	requestLock() {

		if ( ! this.touchMode && ! this.locked ) this.dom.requestPointerLock?.()?.catch?.( () => {} );

	}

	down( code ) {

		return this.enabled && ( this.keys.has( code ) || this.virtualKeys.has( code ) );

	}

	// true once per physical key press
	hit( code ) {

		return this.enabled && ( this.pressed.has( code ) || this.virtualPressed.has( code ) );

	}

	consumeLook() {

		const l = this.enabled ? { x: this.look.x, y: this.look.y } : { x: 0, y: 0 };
		this.look.x = 0;
		this.look.y = 0;
		return l;

	}

	consumeWheel() {

		const w = this.wheel;
		this.wheel = 0;
		return w;

	}

	endFrame() {

		this.pressed.clear();
		this.virtualPressed.clear();

	}

	setVirtualKey( code, down ) {
		if ( down && this.enabled ) {
			if ( ! this.virtualKeys.has( code ) ) this.virtualPressed.add( code );
			this.virtualKeys.add( code );
		} else this.virtualKeys.delete( code );
	}

	clearVirtual() {
		this.virtualKeys.clear();
		this.virtualPressed.clear();
		this.look.x = this.look.y = 0;
	}

	addLook( dx, dy ) {
		if ( ! this.enabled || ! Number.isFinite( dx ) || ! Number.isFinite( dy ) ) return;
		this.look.x += dx;
		this.look.y += dy;
	}

}
