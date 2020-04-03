<?php

namespace WordCamp\Blocks\Schedule;

use WP_Post, WP_REST_Request;
use const WordCamp\Blocks\{ PLUGIN_DIR, PLUGIN_URL };

defined( 'WPINC' ) || die();

/**
 * Register block types and enqueue scripts.
 *
 * @return void
 */
function init() {
	$front_end_assets = require PLUGIN_DIR . 'build/schedule-front-end.min.asset.php';

	wp_register_script(
		'wordcamp-schedule-front-end',
		PLUGIN_URL . 'build/schedule-front-end.min.js',
		$front_end_assets['dependencies'],
		$front_end_assets['version'],
		true
	);

	wp_register_style(
		'wordcamp-schedule-front-end',
		PLUGIN_URL . 'build/schedule-front-end.min.css',
		array(),
		filemtime( PLUGIN_DIR . 'build/schedule-front-end.min.css' )
	);

	wp_set_script_translations( 'wordcamp-schedule-front-end', 'wordcamporg' );

	$block_arguments = array(
		'attributes'      => get_attributes_schema(),
		'render_callback' => __NAMESPACE__ . '\render',

		'editor_script' => 'wordcamp-blocks',
		'editor_style'  => 'wordcamp-blocks',

		/*
		 * @todo This gets loaded on all front-end pages unnecessarily, due to
		 * https://github.com/WordPress/gutenberg/issues/15256. There isn't a simple workaround, though, since the
		 * block needs to be registered before the global $post is available. We can probably just wait until that
		 * bug is fixed upstream.
		 *
		 * todo check https://wordpress.stackexchange.com/questions/328536/load-css-javascript-in-frontend-conditionally-if-block-is-used/328553 to see if could help
		 *
		 * It also gets loaded when editing the page. will that mess up style cascades by applying
		 * `front-end.scss` (which only contains some styles) on top of `blocks.scss` ?
		 */
		'script' => 'wordcamp-schedule-front-end',
		'style'  => 'wordcamp-schedule-front-end',
	);

	register_block_type( 'wordcamp/schedule', $block_arguments );
}
add_action( 'init', __NAMESPACE__ . '\init' );

/**
 * Enable registration of the block on the JavaScript side.
 *
 * This only exists to pass the `enabledBlocks` test in `blocks.js`. We don't actually need to populate the
 * `WordCampBlocks.schedule` property with anything on the back end, because all of the necessary data has
 * to be fetched on the fly in `fetchScheduleData`.
 *
 * It shouldn't be pre-fetched, because we won't know if the user is going to add the block to a new page.
 * Adding the data to all pages wouldn't be performant.
 *
 * @todo Evaluate if there's a better way to perform that test, that wouldn't require workarounds ike this.
 *
 * @param array $data
 *
 * @return array
 */
function enable_js_block_registration( $data ) {
	$data['schedule'] = array();

	return $data;
}
add_filter( 'wordcamp_blocks_script_data', __NAMESPACE__ . '\enable_js_block_registration' );

/**
 * Pass data that's shared across all front-end Schedule block instances from PHP to JS.
 *
 * `render()` will output the data that's specific to each block.
 *
 * This has to run on `template_redirect` instead of `init`, because calling `get_sessions_post()` et al would
 * create nested REST API queries. That would remove all `wc-post-types` routes from the API response, which would break block rendering.
 *
 * In the back end, the data is intentionally fetch when the block loads. See `enable_js_block_registration()`.
 */
function pass_global_data_to_front_end() {
	global $post;

	if ( ! $post instanceof WP_Post || ! has_block( 'wordcamp/schedule', $post ) ) {
		return;
	}

	$schedule_data = array(
		'allSessions'   => get_all_sessions(),
		'allTracks'     => get_all_tracks(),
		'allCategories' => get_all_categories(),
		'settings'      => get_settings(),
	);

	wp_add_inline_script(
		'wordcamp-schedule-front-end',
		sprintf(
			'WordCampBlocks.schedule = JSON.parse( decodeURIComponent( \'%s\' ) );',
			rawurlencode( wp_json_encode( $schedule_data ) )
		),
		'before'
	);
}
add_action( 'template_redirect', __NAMESPACE__ . '\pass_global_data_to_front_end' );

/**
 * Get the schema for the block's attributes.
 *
 * These intentionally use `camelCase` naming, despite some other blocks using `snake_case`. That's because, in
 * this block, the attributes are only referenced in JavaScript. If they were `snake_case`, then it'd be painful
 * to maintain consistency with our JavaScript style guide. We could either rename them on-the-fly whenever
 * they're destructured, or we could always reference the `snake_case` name.
 *
 * The former would be tedious, error prone, and reduce readability/simplicity; the latter would introduce
 * inconsistency when a `snake_case` attribute was passed as an argument to a function, which would need to
 * receive the parameter in `camelCase` format. The latter would also introduce visual inconsistency between
 * attribute naming and all other names.
 *
 * @return array
 */
function get_attributes_schema() {
	$schema = array(
		'align' => array(
			'type'    => 'string',
			'enum'    => array( 'wide', 'full' ),
			'default' => 'wide',
		),

		'chooseSpecificDays' => array(
			'type'    => 'boolean',
			'default' => false,
		),

		'chosenDays' => array(
			'type'    => 'array',
			'default' => array(),

			'items' => array(
				'type' => 'string',
			),
		),

		'chooseSpecificTracks' => array(
			'type'    => 'boolean',
			'default' => false,
		),

		'chosenTrackIds' => array(
			'type'    => 'array',
			'default' => array(),

			'items' => array(
				'type' => 'integer',
			),
		),

		'showCategories' => array(
			'type'    => 'boolean',
			'default' => true,
		),
	);

	return $schema;
}

/**
 * Get the posts to display in the block.
 *
 * @return array
 */
function get_all_sessions() {
	// todo-front make sql query and TTFB faster
		// only get sessions that have been assigned a date/time.
		// if selected chosendays/tracks, then only get the ones on that match.
			// make sure finding union of chosen days/tracks for ALL the blocks on the page, though. only ignore
			// sessions that won't be displayed.

	// todo-front add fields args that match fetchScheduleData - how to make that DRY? not worth it, just leave
	// note in both places saying they should be kept in sync?
	// will need to do the same for tracks, cats, settings though. so maybe good to have some way to pass the
	// args? sessions is the only one w/ a lot though. shrug.
	$session_fields = array(
		'id',
		'link',
		'meta._wcpt_session_time',
		'meta._wcpt_session_duration',
		'meta._wcpt_session_type',
		'session_category',
		'session_speakers',
		'session_track',
		'slug',
		'title',
	);

	$request = new WP_REST_Request( 'GET', '/wp/v2/sessions' );

	$request->set_param( 'per_page', 100 );
		// todo-front need to do -1, but can't do it directly here. are there any helpers to do the heavy lifting?
	$request->set_param( '_fields', $session_fields );

	$response = rest_do_request( $request );

	return $response->get_data();
}

/**
 * Get all of the tracks, including ones that won't be displayed.
 *
 * @return array
 */
function get_all_tracks() {
	$request = new WP_REST_Request( 'GET', '/wp/v2/session_track' );
	$request->set_param( 'per_page', 100 );
		// todo-front need to do -1, but can't do it directly here. are there any helpers to do the heavy lifting?
	$request->set_param( '_fields', array( 'id', 'name', 'slug' ) );
	$request->set_param( 'orderby', 'slug' );
		// none of this is DRY w/ edit.js.

	$response = rest_do_request( $request );

	return $response->get_data();
}

/**
 * Get all of the categories, including ones that won't be displayed.
 *
 * @return array
 */
function get_all_categories() {
	$request = new WP_REST_Request( 'GET', '/wp/v2/session_category' );
	$request->set_param( 'per_page', 100 );
		// todo-front need to do -1, but can't do it directly here. are there any helpers to do the heavy lifting?
	$request->set_param( '_fields', array( 'id', 'name', 'slug' ) );
		// none of this is DRY w/ edit.js.

	$response = rest_do_request( $request );

	return $response->get_data();
}

/**
 * Get the site's settings.
 *
 * @return array
 */
function get_settings() {
	/*
	 * Hardcoding these instead of creating a `WP_REST_Request` because:
	 *
	 * 1) That API endpoint is only intended to be used by authorized users. Right now it doesn't contain anything
	 *    particularly sensitive, but that could change at any point in the future.
	 * 2) The data will need to be accessed by logged-out visitors, and that endpoint requires authentication by
	 *    default.
	 * 3) It makes the page size slightly smaller, and `WordCampBlocks` less cluttered.
	 */
	return array(
		'date_format' => get_option( 'date_format' ),
		'time_format' => get_option( 'time_format' ),
		'timezone'    => get_option( 'timezone' ),
	);
}

/**
 * Render the block on the front end.
 *
 * The attributes are intentionally passed from PHP to JavaScript here, instead of being saved in `post_content`.
 * That avoids the frustrating and time-consuming problem where even minor changes to `save()` will break existing
 * blocks, unless we write transforms.
 *
 * @param array $attributes
 *
 * @return string
 */
function render( $attributes ) {
	$defaults   = wp_list_pluck( get_attributes_schema(), 'default' );
	$attributes = wp_parse_args( $attributes, $defaults );

	ob_start();
	require __DIR__ . '/view.php';
	return ob_get_clean();
}







// todo-final remove this when finished. keeping for now though, just in case its needed. took good chunk of time to build.
// will probably stick w/ the js version though.

/**
 * Print styles that need to be generated dynamically.
 * /
function print_dynamic_styles() {
	global $post;

	$screen = get_current_screen();

	/*
	 * The block could be added to any new/existing page, so the styles need to be present on all of them.
	 * Otherwise the block would initially look broken, and they'd have to refresh to see it working.
	 * /
	if ( ! $screen instanceof WP_Screen || 'page' !== $screen->id ) {
		return;
	}
	// todo that works, but ALSO need to pass default attributes in here, or something, so that the days are selected.
	// just print all days by default probably
	// might just need something temporary here b/c when inspector stuff finished it should pass the real defaults in,
	// so leave a note to remove any temp code, but test it w/ new pages once removed

	$blocks = parse_blocks( $post->post_content );

	foreach ( $blocks as $block ) :
		if ( 'wordcamp/schedule' !== $block['blockName'] ) {
			continue;
		}

		$chosen_sessions  = get_session_posts( $block['attrs'] ?? array() );
		$sessions_by_date = group_sessions_by_date( $chosen_sessions );

		?>

		<!-- wordcamp/schedule block dynamic styles -->
		<style>
			@supports ( display: grid ) {
				<?php // This media query should be kept in sync with the `breakpoint-grid-layout` mixin in block-content.scss. ?>
				@media screen and ( min-width: 700px ) {
					<?php
					// Each date must be generated individually, because it might have different times and tracks.
					foreach ( $sessions_by_date as $date => $sessions ) :
						$tracks = get_tracks_from_sessions( $sessions );

						/*
						 * Create an implicit "0" track when none formally exist.
						 *
						 * Camps with a single track may neglect to create a formal one, but the Grid still has to
						 * have a track to lay sessions onto.
						 *
						 * todo-data move this higher into get_session_posts() or something, so that it's more canonical and shared across any future usage?
						 * /
						if ( empty( $tracks ) ) {
							$tracks[] = new WP_Term( (object) array( 'term_id' => 0 ) );
						}

						// add track ids / "all-tracks" here if going to keep, similar to js renderer
						echo sprintf(
							'#wordcamp-schedule__day-%s {
								%s
								%s
							} ',
							esc_html( $date ),
							esc_html( render_grid_template_rows( $sessions ) ),
							esc_html( render_grid_template_columns( $tracks ) )
						);

					endforeach; ?>
				}
			}
		</style>

	<?php endforeach;
}
add_action( 'wp_print_styles', __NAMESPACE__ . '\print_dynamic_styles' );
*/

/*
 * @todo-inspector maybe remove this when building inspector controls, because the editor needs the CSS generated on the fly
 * in response to user actions (selecting days, tracks, etc)?
 * 		er, _NO_, should probably keep. it just prints all the styles that _MIGHT_ be needed.
 * 		 turning days/tracks off won't cause a conflict or anything.
 * er, actually it does, b/c non-displayed tracks still take up space in grid even when nothing assigned to them
 */
//add_action( 'admin_print_styles', __NAMESPACE__ . '\print_dynamic_styles' );

/**
 * Render the `grid-template-rows` styles for the given sessions.
 *
 * @param array $chosen_sessions
 *
 * @return string
 * /
function render_grid_template_rows( $chosen_sessions ) {
	ob_start();

	?>

	grid-template-rows:
		[tracks] auto

		/* Organizers: Set these to `1fr` to make the row height relative to the time duration of the session. * /
		<?php foreach ( get_start_end_times( $chosen_sessions ) as $time ) : ?>
			[time-<?php echo esc_html( $time ); ?>] auto
		<?php endforeach; ?>
	;

	<?php

	return ob_get_clean();
}
*/

/**
 * Render the `grid-template-columns` styles for the given tracks.
 *
 * @param array $tracks
 *
 * @return string
 * /
function render_grid_template_columns( $tracks ) {
	if ( is_admin() ){
		// todo tmp, just to test out creating this in js instead
		// remove the `admin_print_styles` callback instead, and have js print rows too
		// maybe have js do entire front end, but can decide that later. for now just need to get dynamic tracks working in editor
		return '';
	}

	$current_track = current( $tracks );
	$next_track    = next( $tracks );

	ob_start();
	?>

	grid-template-columns:
		[times] auto
		[wordcamp-schedule-track-<?php echo esc_html( $current_track->term_id ); ?>-start] 1fr

		<?php

		if ( count( $tracks ) > 1 ) {
			while ( false !== $next_track ) {
				echo esc_html( "[
					wordcamp-schedule-track-{$current_track->term_id}-end
					wordcamp-schedule-track-{$next_track->term_id}-start
				] 1fr " );

				$current_track = current( $tracks );
				$next_track    = next(    $tracks );
			}
		}

		?>

		[wordcamp-schedule-track-<?php echo esc_html( $current_track->term_id ); ?>-end]
	;

	<?php

	return ob_get_clean();
}
*/

/**
 * Group the given sessions by their dates.
 *
 * @param array $ungrouped_sessions
 *
 * @return array
 * /
function group_sessions_by_date( $ungrouped_sessions ) {
	$grouped_sessions = array();

	foreach ( $ungrouped_sessions as $session ) {
		$date = wp_date( 'Y-m-d', $session->_wcpt_session_time );

		$grouped_sessions[ $date ][] = $session;
	}

	return $grouped_sessions;
}

/**
 * Get the start and end times for the given sessions.
 *
 * @param array $sessions
 *
 * @return array
 * /
function get_start_end_times( $sessions ) {
	$start_times = wp_list_pluck( $sessions, '_wcpt_session_time' );
	$start_times = array_map(
		function( $timestamp ) {
			return wp_date( 'Hi', $timestamp );
		},
		$start_times
	);

	$end_times = array_map( __NAMESPACE__ . '\get_session_end_time', $sessions );
	$all_times = array_unique( array_merge( $start_times, $end_times ) );

	sort( $all_times );

	return $all_times;
}

/**
 * Get the end time for the given session.
 *
 * @param WP_Post $session
 *
 * @return string
 * /
function get_session_end_time( $session ) {
	$start_time = $session->_wcpt_session_time;
	$duration   = $session->_wcpt_session_duration;

	/*
	 * Retroactively set session length.
	 *
	 * These fields didn't exist before this block was created. Newer Session posts will set them when the posts
	 * are saved for the first time, but older posts need to have it back-filled. We should only do that for sites
	 * that are actually using this block, though, because otherwise we'd be inserting inaccurate data. It's ok
	 * for users of the block, though, because the length will be obvious when they look at the schedule, so
	 * they'll fix it if the default doesn't match the actual length.
	 * /
	// todo make sure compatible w/ https://github.com/WordPress/wordcamp.org/commit/c3b7d9be1fbda4c4e4b8d6624f8c198c832d464b
	if ( empty( $duration ) ) {
		$duration = WordCamp_Post_Types_Plugin::SESSION_DEFAULT_DURATION;

		update_post_meta( $session->ID, '_wcpt_session_duration', $duration );
	}

	$end_time = $start_time + $duration;

	return wp_date( 'Hi', $end_time );
}

/**
 * Get the tracks that the given sessions are assigned to.
 *
 * @param array $sessions
 *
 * @return array
 * /
function get_tracks_from_sessions( array $sessions ) {
	// can prolly delete this and other print_dynamic_styles functions
        // they were a lot of work, though, so make sure not gonna need before getting rid of

	$tracks = array();

	foreach ( $sessions as $session ) {
		$assigned_tracks = wp_get_object_terms( $session->ID, 'wcb_track' );

		foreach ( $assigned_tracks as $track ) {
			$tracks[ $track->term_id ] = $track;
		}
	}

	/*
	 * Sorting alphabetically by slug.
	 *
	 * This must be consistent so that `print_dynamic_styles()` can predict which grid-column comes next.
	 * /
	uasort(
		$tracks,
		function( $first, $second ) {
			if ( $first->slug === $second->slug ) {
				return 0;
			}

			return $first->slug > $second->slug ? 1 : -1;
		}
	);

	return $tracks;
}
*/
