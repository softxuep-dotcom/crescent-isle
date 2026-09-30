// A touch-first layout, with a URL override for repeatable desktop/mobile QA.
export function useTouchControls() {
	const override = new URLSearchParams( globalThis.location?.search || '' ).get( 'touch' );
	if ( override !== null ) return override === '1';
	return globalThis.matchMedia?.( '(pointer: coarse)' ).matches ?? false;
}
