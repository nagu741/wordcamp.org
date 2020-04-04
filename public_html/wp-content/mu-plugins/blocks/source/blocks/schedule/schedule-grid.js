/**
 * WordPress dependencies
 */
import { __, _x } from '@wordpress/i18n';
import { useContext } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { Sessions } from './sessions';
import { _tmp_dateI18n } from '../../utils/date';
import { NoContent } from '../../components/';
import { ScheduleGridContext, implicitTrack, sortBySlug } from './edit';

/*
 * todo-grid
 *
 *
 * wait until https://github.com/WordPress/wordcamp.org/pull/356 is merged
 *  incorporate any long-term changes from it
 *
 * diff against other blocks for consistency
 * php/js lint everything
 *      if not going to use prettier, then need to manually review all files in this block, and restore better formatting.
 *
 * when clicking on block after reload, it jumpscrolls to the top of the block, and have to scroll back down to re-click on the lower part of the block you wanted to inspect
 *      maybe a gutenberg thing? see if happens w/ other blocks
 *      https://github.com/WordPress/gutenberg/issues/20111
 *
 * test under ie11 - should just see mobile/fallback schedule
 *
 * test other camps:
 *      2009.newyork - 8 tracks, prob same as 2012.nyc
 *      2012.nyc - 15 tracks, probably don't need to support, just fall back to mobile view
 *      2019.us also has 6 tracks (3 session, 3 workshop)
 *
 *      https://2013.sf.wordcamp.org/wp-admin/post.php?post=1404690&action=edit
 *          mostly done
 *          if want to be exact, can set proper break times, etc, then compare to shortcode, but looks good enough
 *
 *      https://2014.seattle.wordcamp.org/wp-admin/post.php?post=915536&action=edit
 *          content overflows, e.g. opening remakrs. time column is really small, should have a min-width or something there
 *              maybe need some kind of thing where it falls back to mobile view w/ 4+ tracks, or do something where set different media query breakpoints based on # of tracks
 *                  yeah that sounds better
 *          28th 9am "zero hour" in the shortcode it shows in ballroom and 250, but also spans into workshop which it shouldn't
 *              lisa's basics sessions should be there but it's not
 *              seems like that's a bug w/ the shortcode, and the block is doing it correctly
 *              verify
 *
 *      https://2016.kansascity.wordcamp.org/wp-admin/post.php?post=2349&action=edit
 *          front end
 *              11th overflows into sidebar b/c of too many tracks
 *              is there a graceful media query kind of solution to that, so it'll switch to mobile view if there isn't enough room for grid view?
 *
 *          back end mostly done, only minor things left
 *
 *          overlap warnings cover title so can't open link to fix
 *              partially fixed, but interrelated with another issue that's causing the remaining problem?
 *              sessions 771 and 804 are duplicates, both in town square, but 1 also spans into brookside. mistake on their end, 804 should be deleted.
 *
 *           "community support" isn't assigned to any track, so block is creating implicit 5th track for it.
 *               shortcode just doesn't display the session at all (but it does display the track description, which matches the session title)
 *               block behavior is probably "correct"
 *               5 tracks causes horizontal scrolling, but that's just a side-effect of incorrect data-entry in this case.
 *                  still need to handle that when there are 5 legit tracks though
 *
 *          "doors open" on 12th - why notice floated right instead of blocked below?
 *
 *      https://2017.us.wordcamp.org/wp-admin/post.php?post=12186&action=edit
 *          front end
 *              switches to mobile view at 1142px, but still plenty of room for grid view at that width
 *
 *
 *      https://2018.montreal.wordcamp.org/wp-admin/post.php?post=3361&action=edit
 *          lots spanning multiple tracks, would have to change the track slugs to get them working, not worth distorting production data.
 *          lots of tracks showing up, should only be 3?
 *              looks right if you choose the specific tracks that are shown by the shortcode
 *          "more than words" assigned to Business and Canada, but shortcode only shows it in Canada, doesn't show business at all.
 *              block is behaving correctly, but shortcode is (known?) bug?
 *          might be difficult to suss out any potential issues b/c so many superficlous track assignments, probably don't bother
 *
 *      wcus
 *
 *      https://2019.europe.wordcamp.org/wp-admin/post.php?post=14070&action=edit
 *          in shortode matt's session spans some but not all tracks - should be fine b/c alphabetical
 *
 *      boston
 *
 *      https://2017.testing.wordcamp.org/wp-admin/post.php?post=13245&action=edit
 *          data here isn't might be imported from diff camps, and mixed w/ fake, so maybe not worth testing?
 *
 *      miami
 *      tokyo
 *      any others? will still need beta testing
 *      todo delete those once done testing, but first make sure that any conditions found there are added to test/sample-sessions.xml
 *
 *      maybe automate setting duration more intelligently, like look at all sessions in a track, figure out start time of next session, and set duration based on that?
 *          probably still have to manually fix some, but not as much
 *          worth the time to write it?
 *
 * horizontal scrolling when block has align `full` set
 *
 * add support for wc-post-type "favorite" functionality, maybe iterate on it while have the opportunity, but maybe not high priority
 *
 * `git diff production` and check each line to make sure it's clean
 *
 * once this is ready for final review, maybe start a fresh PR b/c #104 is already cluttered and long and outdated
 *      reference the original for historical tracking
 *
 * remove _tmp_dateI18n if https://github.com/WordPress/gutenberg/pull/18982 is merged, but make sure we're running that version before deploy
 *
 * gutenberg's built-in "tablet" and "mobile" doesn't recognize the breakpoints
 */

/**
 * Render CSS styles that have to be generated on the fly.
 *
 * @param {string} containerId
 * @param {Array}  tracks
 * @param {Array}  startEndTimes
 *
 * @return {string}
 */
function renderDynamicGridStyles( containerId, tracks, startEndTimes ) {
	// todo keep this value DRY w/ breakpoint-grid-layout mixin
		// may need to distinguish b/w editor and front end too
		// or document why it doesn't need to distinguish
	const styles = `
		@supports ( display: grid ) {
			@media screen and ( min-width: 550px ) {
				#${ containerId } {
					${ renderGridTemplateColumns( tracks ) }
					${ renderGridTemplateRows( startEndTimes ) }
				}
			}
		}
	`;

	return styles;
}

/**
 * Render dynamic `grid-template-column` styles.
 *
 * @param {Array} tracks
 *
 * @return {string}
 */
function renderGridTemplateColumns( tracks ) {
	const firstTrackId = tracks[ 0 ].id;
	const lastTrackId = tracks[ tracks.length - 1 ].id;

	let trackGridLines = `[wordcamp-schedule-track-${ firstTrackId }-start] 1fr`;

	tracks.forEach( ( track, index ) => {
		if ( index === tracks.length - 1 ) {
			return;
		}

		const nextTrackId = tracks[ index + 1 ].id;

		const line = `
			[
				wordcamp-schedule-track-${ track.id }-end
				wordcamp-schedule-track-${ nextTrackId }-start
			] 1fr
		`;

		trackGridLines += line;
	} );

	trackGridLines += `[wordcamp-schedule-track-${ lastTrackId }-end]`;

	const templateColumns = `grid-template-columns:
		[times] auto
		${ trackGridLines }
	;`;

	// todo test w/ implicit track, and { 1, 2, 3, 4 } explicit tracks

	return templateColumns;
}

/**
 * Render dynamic `grid-template-row` styles.
 *
 * @param {Array} startEndTimes All of the start and end times that should be present in the grid. They can be
 *                              passed in any format that Moment can parse.
 *
 * @return {string}
 */
function renderGridTemplateRows( startEndTimes ) {
	startEndTimes.sort(); // Put them in chronological order.

	const timeList = startEndTimes.reduce( ( accumulatingTimes, time ) => {
		const formattedTime = _tmp_dateI18n( 'Hi', time );

		return accumulatingTimes += `[time-${ formattedTime }] auto `;
	}, '' );

	const templateRows = `
		/* Organizers: Set these to \`1fr\` to make the row height relative to the time duration of the session. */
		grid-template-rows:
			[tracks] auto
			${ timeList }
		;
	`;
	// todo the organizers note isn't really noticable, since it's not there when you "view source", and the dom
	// inspector doesn't show it in the calculated/parsed areas. you only see it if you inspect the <style> tag,
	// and even there it's not formatted so it's difficult to read. is there a better way to communicate this?

	return templateRows;
}

/**
 * Render the schedule for a specific day.
 *
 * @param {Object} props
 * @param {string} props.date     In a format acceptable by `wp.date.dateI18n()`.
 * @param {Array}  props.sessions
 *
 * @return {Element}
 */
function ScheduleDay( { date, sessions } ) {
	const { attributes, allTracks, settings } = useContext( ScheduleGridContext );
	const { chooseSpecificTracks, chosenTrackIds } = attributes;

	const displayedTracks = getDisplayedTracks( sessions, allTracks, chooseSpecificTracks, chosenTrackIds );
	const formattedDate = _tmp_dateI18n( 'Y-m-d', date );
	const formattedTrackIds = chooseSpecificTracks ? displayedTracks.map( ( track ) => track.id ).join( '-' ) : 'all';

	/*
	 * The ID must be unique across blocks, because otherwise the corresponding `grid-template-rows` and
	 * `grid-template-columns` could conflict when there are multiple blocks on the same page.
	 *
	 * e.g., one block showing April 21st 2020 with the "designer" track, and another block showing April 21st
	 * 2020 with the "developer" track.
	 *
	 * The ID should only change when the user _explicitly_ makes a change that forces changes to the grid layout. Otherwise their Custom CSS would be disconnected,
	 * and they'd have to update the ID to get it to apply again.
	 *
	 * `useInstanceId` can't be used, because it sometimes changes when `attributes` changes. Another reason it's not ideal is because it's
	 * origin and meaning wouldn't be obvious to organizers. The Block's `clientId` also isn't ideal, for the same reason.
	 *
	 * The combination of the date and tracks is intuitive, and minimizes the scenarios where changes to `attributes` would change the ID. `tracks-all` is used when they
	 * haven't chosen specific tracks, because tracks could still be added/removed when they publish/unpublish sessions, but that shouldn't disconnect their custom styles.
	 */
	const sectionId = `wordcamp-schedule__day-${ formattedDate }-tracks-${ formattedTrackIds }`;

	const startEndTimes = sessions.reduce( ( accumulatingTimes, session ) => {
		accumulatingTimes.push( session.derived.startTime );
		accumulatingTimes.push( session.derived.endTime );

		return accumulatingTimes;
	}, [] );

	return (
		<>
			{ /* Style tags outside of `<body>` are valid since HTML 5.2. */ }
			<style>
				{ renderDynamicGridStyles( sectionId, displayedTracks, startEndTimes ) }
			</style>

			<h2 className="wordcamp-schedule__date">
				{ _tmp_dateI18n( settings.date_format, date ) }
			</h2>
			{ /* todo-misc this needs to be editable, should also be a separate Heading block. so when inserting a schedule
			 block, We can make the text editable, though, with a reasonable default. If they remove the text,
			then we can automatically remove the corresponding h2 tag, to avoid leaving an artifact behind that
			 affects margins/etc.
			 probably make that a v2 iteration b/c there's higher priorities

			 should only be editable when in editor, not on front end
			 */ }

			<section
				id={ sectionId }
				className="wordcamp-schedule__day"
			>
				<GridColumnHeaders displayedTracks={ displayedTracks } />

				<Sessions
					displayedTracks={ displayedTracks }
					sessions={ sessions }
				/>
			</section>
		</>
	);
}

/**
 * Render the column headers for a schedule.
 *
 * When `attributes.chooseSpecificTracks` is `true`, all of the chosen tracks will be displayed, even if they
 * don't have any sessions assigned to them. That's intentional, because not showing them would create a situation
 * where it wouldn't be obvious to the user why the tracks that they selected aren't being shown.
 *
 * @param {Object} props
 * @param {Array} props.displayedTracks
 *
 * @return {Element}
 */
function GridColumnHeaders( { displayedTracks } ) {
	/*
	 * If we're using an implicit track, then there won't be any track names printed, so there's not much point
	 * in printing the "Time" header either. It's obvious enough, and it'd looks odd on its own without the track
	 * names.
	 */
	if ( implicitTrack.id === displayedTracks[ 0 ].id ) {
		return null;
	}

	return (
		<>
			{ /*
			 * Columns headings are hidden from screen readers because the time/track info is already displayed
			 * in each session, and screen readers couldn't make sense of these headers; they're only an extra
			 * visual aid for sighted users.
			 */ }
			<span
				className="wordcamp-schedule__column-header"
				aria-hidden="true"
				style={ { gridColumn: 'times' } }
			>
				{ _x( 'Time', 'table column heading', 'wordcamporg' ) }
			</span>

			{ displayedTracks.map( ( track ) => (
				<span
					key={ track.id }
					className="wordcamp-schedule__column-header"
					aria-hidden="true" // See note above about aria-hidden.
					style={ { gridColumn: `wordcamp-schedule-track-${ track.id }` } }
				>
					{ track.name }
				</span>
			) ) }
		</>
	);
}

/**
 * Get the tracks that will be displayed in the grid UI -- the ones that the given Sessions are assigned to.
 *
 * In general, it's more useful for this block to know which tracks are assigned, rather than which ones exist,
 * because e.g., you don't want to print all tracks in `GridColumnHeaders`, only the ones being used.
 *
 * @param {Array}   sessions
 * @param {Array}   allTracks
 * @param {boolean} chooseSpecificTracks
 * @param {Array}   chosenTrackIds
 *
 * @return {Array}
 */
function getDisplayedTracks( sessions, allTracks, chooseSpecificTracks, chosenTrackIds ) {
	// can probably just return IDs instead of full objects, because we'll have allTracks avail everywhere now.
		// that should be the only place that has slug/title? and everything else can just x-ref against it?
	// er, i dunno, now i'm leaning more towards things lke allTracks, displayedTracks, assignedTracks all having full objects
		// and then only x-referncing when have something like session.session_track where only have ids b/c external factor
		// but then don't have a single source of truth?
			// shouldn't be a problem in practice b/c not going to change the id/name/slug, but maybe still a bad habit

	// maybe change it so that tracks have a countDisplayedSessions field, instead of this
		// but would that work in context of chosenTracks? i guess it guess if you use that to build the count

	let displayedTracksIds;

	if ( chooseSpecificTracks && chosenTrackIds.length ) {
		displayedTracksIds = chosenTrackIds;

	} else {
		// Gather all of the tracks from the given sessions.
		const uniqueTrackIds = new Set();

		for ( const session of sessions ) {
			for ( const track of session.derived.assignedTracks ) {
				uniqueTrackIds.add( track.id );
			}
		}

		displayedTracksIds = Array.from( uniqueTrackIds );
	}

	const displayedTracks = allTracks.filter(
		( track ) => displayedTracksIds.includes( track.id )
	);

	if ( displayedTracksIds.includes( implicitTrack.id ) ) {
		displayedTracks.push( implicitTrack );
	}

	/*
	 * Nothing above should change the sorting, but sort it again just to be safe.
	 *
	 * See `ChooseSpecificTracks()`.
	 */
	displayedTracks.sort( sortBySlug );

	return displayedTracks;
}

/**
 * Create an array of sessions, indexed by their date.
 *
 * @param {Array} sessions
 *
 * @return {Array}
 */
function groupSessionsByDate( sessions ) {
	// todo-data should probably have the API return them already grouped, b/c will need that for front-end, so might
	// as well reuse it here
	//      er, well, no, because then would have to make an extra http request instead of reusing data that's
	//      already fetched
	//      would it be fetched already? probably not unless there's an existing sessions block on the page
	//      don't wanna reuse b/c modifying it messes up the sessions block, they need to have separate copies
	// todo-data doing this same thing on the PHP side, maybe should setup API endpoint for this
	//      b/c want to make sure the data is consistent between 1) php styles loop, 2) php template, 3) js template
	//      probably won't be if end us rendering front-end w/ js, though, so figure that out first

	return sessions.reduce( ( groups, session ) => {
		/*
		 * Ideally this would be done in `scheduleSelect()`, but making meta queries with the REST API requires
		 * jumping through a lot of extra hoops.
		 */
		if ( 0 === session.derived.startTime ) {
			return groups;
		}

		const date = _tmp_dateI18n( 'Ymd', session.derived.startTime );

		if ( date ) {
			groups[ date ] = groups[ date ] || [];
			groups[ date ].push( session );
		}

		return groups;
	}, {} );
}

/**
 * Render the schedule.
 *
 * @param {Object} props
 * @param {Array}  props.sessions
 *
 * @return {Element}
 */
export function ScheduleGrid( { sessions } ) {
	const { attributes } = useContext( ScheduleGridContext );
	const scheduleDays = [];

	if ( sessions.length === 0 ) {
		return (
			<NoContent
				loading={ false }
				message={ __(
					'No published sessions are assigned to the chosen days and tracks.',
					'wordcamporg'
				) }
			/>
		);
	}

	const groupedSessions = groupSessionsByDate( sessions );

	Object.keys( groupedSessions ).forEach( ( date ) => {
		const sessionsGroup = groupedSessions[ date ];

		scheduleDays.push(
			<ScheduleDay
				key={ date }
				date={ date }
				sessions={ sessionsGroup }
			/>
		);
	} );

	return (
		<div className={ `wordcamp-schedule ${ attributes.className || '' }` }>
			{ scheduleDays }
		</div>
	);
}
