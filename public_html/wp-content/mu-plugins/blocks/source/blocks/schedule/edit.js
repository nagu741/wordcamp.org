/**
 * WordPress dependencies
 */
import { useSelect } from '@wordpress/data';
import { createContext } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { WC_BLOCKS_STORE } from '../../data';
import { ScheduleGrid } from './schedule-grid';
import InspectorControls from './inspector-controls';
import { NoContent } from '../../components/';
import { _tmp_dateI18n } from '../../utils/date';
import './edit.scss';

export const ScheduleGridContext = createContext();

// An "implicit" track is assigned to sessions that don't have any real tracks assigned.
// See controller.php::print_dynamic_styles().
// if remove that function b/c using js to render front end, then probably move docs from there to
// renderdynamicgridstyles()
export const implicitTrack = { id: 0 };

/**
 * Replace raw session timestamp with local timezone start/end times.
 *
 * @param {Array} sessions
 *
 * @return {Array}
 */
function deriveSessionStartEndTimes( sessions ) {
	return sessions.map( ( session ) => {
		const durationInMs = parseInt( session.meta._wcpt_session_duration ) * 1000; // Convert to milliseconds.

		session.derived = session.derived || {};
		session.derived.startTime = parseInt( session.meta._wcpt_session_time ) * 1000;
		session.derived.endTime = session.derived.startTime + durationInMs;

		return session;
	} );
}

/**
 * Populate full track objects for each session's assigned tracks and categories.
 *
 * This is necessary since they're not _embedded -- see notes in `scheduleSelect()` -- and makes the session
 * objects more convenient to work with, since it always has all the data that will be needed.
 *
 * @param {Array} allSessions
 * @param {Array} allCategories
 * @param {Array} allTracks
 *
 * @return {Array}
 */
function deriveSessionTerms( allSessions, allCategories, allTracks ) {
	return allSessions.map( ( session ) => {
		/*
		 * This is the only place that should reference session.session_track. Everything else should use
		 * derived.assignedTracks as the canonical data, to make sure that any modifications to the raw
		 * data are always used consistently.
		 *
		 * todo delete session.session_track to enforce ^ ?
		 *      if do, will that mess up session objects for other blocks, or future pieces of core/plugins that
		 *      might reference it?
		 */
		session.derived.assignedTracks = allTracks.filter( ( track ) =>
			session.session_track.includes( track.id )
		);

		// document that sorting here b/c it determines display order of the tracks, and that effects contiguous
		// vs non-contig sorting here b/c needs to match displayedTracks so that things like up correctly? grid
		// start/end lines match ? organizers can control display order by renaming slug, but dont have to change
		// display this is also partially documented in ChooseSpecificTracks(). need to clean up the docs in both
		// places
		session.derived.assignedTracks.sort( sortBySlug );
		// prolly dont need to sort cats anymore? important for tracks, but not cats? might be nice to sort by
		// name though so presented in alpha order

		/*
		 * There must always be a track to lay sessions on to, so add the implicit one if there aren't any real ones
		 * assigned.
		 */
		if ( 0 === session.derived.assignedTracks.length ) {
			session.derived.assignedTracks[ 0 ] = implicitTrack;
		}

		//allCategories = allCategories || [];
		/*
			 todo tmp workaround for bug where this is null sometimes - just here so i can work on other things until solve the problem
			 never happens if add embed:true to sessions query in scheduleSelect, but sometimes works fine w/out that and sometimes doesn't
			 it's inconsistent. disable the workaround, then refresh a bunch, sometimes it'll work and sometimes will get typeerror b/c it's null
				 so maybe a race condition or something like that. maybe G bug
			when it happens there's a request to...
			 `wp-json/wp/v2/session_category?per_page=100&_fields%5B0%5D=id&_fields%5B1%5D=name&_fields%5B2%5D=slug&context=edit&_locale=user`
			 ...and the response looks normal
		 maybe happened for same reasons as settings? b/c not returning early while loading. leaving commented out to test
		*/

		session.derived.assignedCategories = allCategories.filter( ( category ) =>
			session.session_category.includes( category.id )
		);

		return session;
	} );
}

/**
 * Determine the sorting order of the given tracks.
 *
 * @param {Object} first
 * @param {Object} second
 *
 * @return {number}
 */
export function sortBySlug( first, second ) {
	if ( first.slug === second.slug ) {
		return 0;
	}

	return first.slug > second.slug ? 1 : -1;
}

/**
 * Remove sessions that aren't on the chosen days.
 *
 * @param {Array} sessions
 * @param {Array} chosenDays
 *
 * @return {Array}
 */
function filterSessionsByChosenDays( sessions, chosenDays ) {
	// Choosing 0 days is treated the same as choosing all days, because otherwise there'd be nothing to display.
	if ( chosenDays.length === 0 ) {
		return sessions;
	}

	return sessions.filter( ( session ) => {
		const date = _tmp_dateI18n( 'Y-m-d', session.derived.startTime );

		return chosenDays.includes( date );

		/*
		 setup constant for format b/c shared with other function in this file, and also to make it more self-documenting
		 it's the DATE_SLUG_FORMAT or something like that
		 */
	} );

	/*
	 kinda bad UX b/c don't really see the changes happening, below/above fold.
	 and/or it happens so quick that kind of jarring. maybe add some jumpToBlah() and/or smoothed animation
	 iirc G has some animation stuff built in for moving blocks around, might be reusable
	 */
}

/**
 * Remove sessions that aren't assigned to the tracks chosen in `ScheduleInspectorControls()`.
 *
 * @param {Array} sessions
 * @param {Array} chosenTrackIds
 *
 * @return {Array}
 */
function filterSessionsByChosenTracks( sessions, chosenTrackIds ) {
	// Choosing 0 days is treated the same as choosing all days, because otherwise there'd be nothing to display.
	if ( chosenTrackIds.length === 0 ) {
		return sessions;
	}

	return sessions.filter( ( session ) => {
		const assignedTrackIds = session.derived.assignedTracks.map(
			( track ) => track.id
		);

		const intersection = chosenTrackIds.filter(
			( trackID ) => assignedTrackIds.includes( trackID )
		);

		return intersection.length > 0;
	} );
}

/**
 * Generate extra data on each session post.
 *
 * todo-data maybe move all this into a separate file? it's shared by edit and front-end, so should be in some
 * common location maybe even inside fetchScheduleData rather than both callers having to know about it and call
 * it after calling fetchscheduledata()?
 *
 * @param {Array}  allSessions
 * @param {Array}  allCategories
 * @param {Array}  allTracks
 * @param {Object} attributes
 *
 * @return {Object}
 */
export function getDerivedSessions( allSessions, allCategories, allTracks, attributes ) {
	allSessions = deriveSessionStartEndTimes( allSessions );
	allSessions = deriveSessionTerms( allSessions, allCategories, allTracks );

	let chosenSessions = Array.from( allSessions );

	if ( attributes.chooseSpecificDays ) {
		chosenSessions = filterSessionsByChosenDays( chosenSessions, attributes.chosenDays );
	}

	if ( attributes.chooseSpecificTracks ) {
		chosenSessions = filterSessionsByChosenTracks( chosenSessions, attributes.chosenTrackIds );
	}

	return { allSessions, chosenSessions };
}

/**
 * Query for all the data that's needed to build the block.
 *
 * Tracks and categories are being queried for separately here, instead of being embedded into session objects.
 * The primary reason for that is because all tracks need to be displayed in `ScheduleInspectorControls()`, not
 * just the ones that have been assigned to sessions.
 *
 * Another reason to not `_embed` is that Core doesn't support restricting `_embedded` fields yet (see
 * https://core.trac.wordpress.org/ticket/49538), so the response would be slower to generate and download. 5.4
 * will let filter top-level fields -- e.g., `_embed=author`, see
 * https://make.wordpress.org/core/2020/02/29/rest-api-changes-in-5-4/ -- but that only partially solves the
 * problem.
 *
 * If embedded fields could be filtered, then we could embed categories, since we only need the ones that are
 * assigned to the displayed sessions. It's probably simpler to keep their usage consistent with tracks, though.
 *
 * All sessions are being queried for, regardless of `attributes.chosenDays/Tracks`. That takes a little bit
 * longer up front, but allows for instant re-renders when changing attributes, which is a much better UX than
 * having to wait for slow HTTP requests to return new data.
 *
 * @param {Function} select
 *
 * @return {Object}
 */
const fetchScheduleData = ( select ) => {
	const { getEntities, getSiteSettings } = select( WC_BLOCKS_STORE );
	// does this really even need to use ^ ? why not just apiFetch() directly?
	// the custom store abstraction on top of the redux abstraction just makes things more opaque
	// adding `per_page: -1` is useful, but not worth the abstractions
	// live-schedule block is, so should be able to here also
	// maybe open issue proposing that we remove store and simplify blocks that use it, since it's just tech debt?
	//      don't have to implement now, but get it documented while thinking about it

	const sessionArgs = {
		/*
		 * This doesn't include `session_cats_rendered` because we already need the category id/slug in other
		 * places, so it's simpler to have single source of truth.
		 */
		_fields: [
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
		],
	};

	const trackArgs = {
		_fields: [ 'id', 'name', 'slug' ],

		orderby: 'slug',
		/*
			 todo document that it's important that this match displayedTracks order, see note in
			 ChooseSpecificTracks
			 is that the best notes? might need more permenant ones here
		 */
	};

	const categoryArgs = {
		_fields: [ 'id', 'name', 'slug' ],
	};

	// blockData somewhere in here?
		// no, only used on front-end. editor must use fetchScheduleData to get things on the fly, see note in get_session_posts
		// see other notes about it in template_redirect callback

	const allSessions = getEntities( 'postType', 'wcb_session', sessionArgs );
	const allTracks = getEntities( 'taxonomy', 'wcb_track', trackArgs );
		// should be `session_track` and `session_category` instead? those are endpoint names looks like, and those would look nicer here too
	const allCategories = getEntities( 'taxonomy', 'wcb_session_category', categoryArgs );
	const settings = getSiteSettings();
		// todo-beta security error here? shouldn't call on front end, so maybe need to have controller.php output it
		// document security reasons, but just says "see controller.php:get_settings()"

	return { allSessions, allTracks, allCategories, settings };
};

/**
 * Top-level component for the editing UI for the block.
 *
 * @param {Object}   props
 * @param {Object}   props.attributes
 * @param {Function} props.setAttributes
 *
 * @return {Element}
 */
export function ScheduleEdit( { attributes, setAttributes } ) {
	/*
		 need to leave this enabled to debug `TypeError: allCategories is null` in deriveSessionTerms
		 when that happens, it is null here too.
		 this gets called 8x before the error
			 the first 2x, assignedCats is `[]`, after that it's always `null`
			 if i add _embed to session query in scheduleSelect, then that pattern is same, except that last 3x it's filled w/ real data
		 also sometimes happens with settings
	*/

	const rawScheduleData = useSelect( fetchScheduleData );

	for ( const datum of Object.values( rawScheduleData ) ) {
		if ( datum === null ) {
			return <NoContent loading={ true } />;
		}

		// is it possible to use async/await instead? prolly not since datum isn't a promise
		// but could if switch to apiFetch directly instead of store abstraction
	}

	const { allCategories, allTracks, settings } = rawScheduleData;
	const derivedSessions = getDerivedSessions( rawScheduleData.allSessions, allCategories, allTracks, attributes );
	const { allSessions, chosenSessions } = derivedSessions;

	/*
	 maybe add a allTrack[n].derived.countDisplayedSessions that only counts how many of the _currently displayed_ sessions it has assigned to it
		 that might let us remove some clunky code in the grid
			 like what?
	*/

	const contextValues = {
		allTracks: allTracks,
		attributes: attributes,
		settings: settings,
		renderEnvironment: 'editor'
	};

	return (
		<>
			<ScheduleGridContext.Provider value={ contextValues }>
				<ScheduleGrid sessions={ chosenSessions } />
			</ScheduleGridContext.Provider>

			<InspectorControls
				/*
				 * This is intentionally using `allSessions` instead of `chosenSessions`, for the same reason that
				 * `allTracks` is used instead of the assigned tracks. See `ChooseSpecificTracks()`.
				 */
				allSessions={ allSessions }
				allTracks={ allTracks }
				attributes={ attributes }
				setAttributes={ setAttributes }
				settings={ settings }
			/>
		</>
	);
}




/*
need to support child categories/tracks in ScheduleInspectorControls()?

maybe not since don't need to worry about back-compat?
but if so, need to disable them on new sites once the block is launched
will still want to _display_ them using the "hierarchical" list of checkboxes, though,
rather than the search-y list for "tags"
probably simpler to just copy/paste the from from G, but mark it as temporary, and remove it when #17476 is fixed

```
import HierarchicalTermSelector from '@wordpress/editor'; doesn't work

function customizeTaxonomySelector( OriginalComponent ) {
    return function( props ) {

        if ( 'my_taxonomy' !== props.slug ) {
        	return <OriginalComponent { ...props } />;
        }

        return <HierarchicalTermSelector { ...props } />;
    };
}
wp.hooks.addFilter( 'editor.PostTaxonomyType', 'my-custom-plugin', customizeTaxonomySelector );
// might not be necessary after https://github.com/WordPress/gutenberg/issues/13816 fixed, but doesn't run there?
```

another approach would be to just ignore tha parent level directories, and only show the bottom level
or better yet, flatten them all into the same level, and then ignore the ones that don't have any terms
directly assigned to them (which should throw out the parents in most cases)
ugh, probably have to do this, since can't overwrite UI in Gutenberg --
see https://github.com/WordPress/gutenberg/issues/13816#issuecomment-532885577
and https://github.com/WordPress/gutenberg/issues/17476

another would be to trick G into thinking it's hierarchical by overwriting the rest api value but that's not
elegant. could restrict to context=edit but still

once this is done, it should probably live in `inspector-controls.js`, but ran into some issues there that
didn't run into here, so putting that off until it's working here.
*/
