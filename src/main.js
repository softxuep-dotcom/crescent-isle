import './core/BenchSeed.js';
import { App } from './App.js';
import { ExplorationUI } from './ui/ExplorationUI.js';
import { AppUI } from './ui/AppUI.js';
import { GPU } from './engine/gpu/GPU.js';

// ?bench runs in background tabs too (automation): rAF does not fire in a hidden page
if ( /[?&]bench\b/.test( location.search ) ) {

	const raf = window.requestAnimationFrame.bind( window ), caf = window.cancelAnimationFrame.bind( window );
	window.requestAnimationFrame = ( cb ) => document.visibilityState === 'hidden' ? setTimeout( () => cb( performance.now() ), 16 ) : raf( cb );
	window.cancelAnimationFrame = ( id ) => ( clearTimeout( id ), caf( id ) );

}

const ui = new ExplorationUI();
const app = new App();
ui.bindApp( app );
window.__ui = ui;

function showSceneError( error ) {
	app.engine?.stop();
	app.input?.clearVirtual();
	if ( app.input ) app.input.enabled = false;
	const loader = document.getElementById( 'loader' );
	loader.style.display = '';
	loader.classList.remove( 'tw-hidden' );
	ui.setLoadingError( '暂时无法启动海岛场景' );
	const note = loader.querySelector( '.loader-note' );
	note.id = 'compatibility-message';
	note.setAttribute( 'role', 'alert' );
	note.textContent = ! globalThis.isSecureContext
		? '请通过 HTTPS 打开正式网址。手机访问电脑的普通 HTTP 局域网地址无法使用 WebGPU。'
		: ! navigator.gpu
			? '当前浏览器或系统尚未提供 WebGPU。请更新系统与浏览器，或换用支持 WebGPU 的设备后重试。'
			: /No WebGPU adapter/.test( error.message )
				? '浏览器未取得可用的图形设备。请检查浏览器和系统的图形支持，或换一台设备打开。'
				: '场景加载失败，或当前设备无法完成图形渲染。请检查网络并刷新重试；若仍失败，请换用支持 WebGPU 的设备。';
	if ( ! loader.querySelector( '.compat-retry' ) ) {
		const retry = document.createElement( 'button' );
		retry.className = 'compat-retry';
		retry.textContent = '刷新重试';
		retry.onclick = () => location.reload();
		note.after( retry );
	}
}
GPU.onError = showSceneError;

app.init( ( p, text, until ) => ui.setLoading( p, text, until ) ).then( async () => {
	if ( GPU.failure ) throw GPU.failure;

	app.ui = new AppUI( app, ui );
	ui.setLoading( 1, 'Ready' );
	await ui.hideLoader();
	// frame-time benchmark and reference shots (see core/Bench.js): it drives the frames itself
	if ( app.qs.has( 'bench' ) ) {

		window.__bench = new ( await import( './core/Bench.js' ) ).Bench( app );
		if ( app.qs.has( 'auto' ) ) window.__job = window.__bench.auto( app.qs.get( 'auto' ), { runs: Number( app.qs.get( 'runs' ) ) || 1 } );
		// ?bench&shots=view1,view2[&tag=name][&dt=seconds][&seq=n&every=frames]: reference shots of the named views only (core/DebugViews.js; dt > 0: the clock runs, e.g. for the eased lens flare)
		// &wdbg=N: the water shader's debug view (WaterMaterial debugMode) in the shots
		if ( app.qs.has( 'wdbg' ) && app.waterMaterial ) app.waterMaterial.debugMode.value = Number( app.qs.get( 'wdbg' ) );
		if ( app.qs.has( 'shots' ) ) window.__job = window.__bench.shots( app.qs.get( 'shots' ).split( ',' ), { tag: app.qs.get( 'tag' ) || 'shot', dt: Number( app.qs.get( 'dt' ) ) || 0, seq: Number( app.qs.get( 'seq' ) ) || 1, every: Number( app.qs.get( 'every' ) ) || 1 } );

	} else app.start();
	ui.showStartOverlay( () => {

		app.input.requestLock();
		if ( app.audio ) app.audio.resume();

	} );

} ).catch( ( e ) => {

	console.error( e );
	showSceneError( e );

} );
