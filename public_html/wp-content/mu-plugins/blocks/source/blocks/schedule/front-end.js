/**
 * Internal dependencies
 */
import { ScheduleGridContext, getDerivedSessions } from './edit';
	// todo move ^ to a common file since they're shared between editor and front end
	// maybe the functions should live in schedule-grid, and just have the data passed in by the caller?
import './front-end.scss';

const rawScheduleData = window.WordCampBlocks.schedule || {};
// rename to blockData for consistency w/ other blocks?
	// not descriptive though. i guess this one isn't either. maybe rename to something more descriptie instead of blockdata
	// if so, rename in edit.js too

// this file is being loading in the editor, but should only load on the front end
	// probably similar problem mentioned in init(), so maybe conditionally register it if on the front end
		// wp_using_themes + ! wcorg_is_rest_api_request? - https://wordpress.stackexchange.com/a/360401/3898

// todo-front build file for full schedule contains a bunch of other stuff, like classnames, memoize, @babel and @emotion, etc. shouldn't those be in gutenberg build files already?
	// maybe just need to explicitly add the @wordpress/* components that we're using to package.json `dependencies`? then the above packages will be registered as externals automatically?

/*
 todo-beta
 maybe send a PR now for the pre-requesite commits, or just all the commits that _arent_ the main commit.
	 that'd split review it into smaller chunks, and get some stuff in now
	 make sure it's behind feature flag
	 todo update core and gutenberg plugin first, b/c __experiementblah changed?
	       if that doesn't fix it, maybe i need to add something to the package.json dependencies manually?
 then clean up any todo-beta problems that are important
 then clean up any quick and easy todo things anywhere in block that would hold up review
 then lint php and js
 once front-end ready for beta, squash this branch down to atomic commits as if you were going to merge to production
 review each commit to make sure doesn't contain stuff that doesn't match the commit msg
 maybe cherry-pick some of the tangiential ones to prod, if they don't need discussion
 then create a new branch from here, and strip out to-do comments and anything other tangential things. includes everything needed for beta test, but avoid unnecessary unfinished things
 submit pr for ^ branch for review of major architectural things, then start beta test
	 can close scaffolding pr
 then come back to this branch finish & polish everything that's remaining, so we can do a full review at the end
 draft p2 post for community blog
    ask for beta testers
    especially want feedback around customizing w/ css
    xpost to meta p2
 *
 */

/*
WARNING in asset size limit: The following asset(s) exceed the recommended size limit (244 KiB).
This can impact web performance.
Assets:
  blocks.min.js (371 KiB)
  schedule-front-end.min.js (327 KiB)

  WARNING in entrypoint size limit: The following entrypoint(s) combined asset size exceeds the recommended limit (244 KiB). This can impact web performance.
Entrypoints:
  blocks (384 KiB)
      blocks.min.css
      blocks.min.js
      blocks.min.asset.php
  schedule-front-end (345 KiB)
      schedule-front-end.min.css
      schedule-front-end.min.js
      schedule-front-end.min.asset.php


WARNING in webpack performance recommendations:
You can limit the size of your bundles by using import() or require.ensure to lazy load some parts of your application.
For more info visit https://webpack.js.org/guides/code-splitting/
 */

import { ScheduleGrid } from './schedule-grid';
	// should export _default_ instead and remove the braces above?
import renderFrontend from '../../utils/render-frontend';

/**
 * todo-beta
 *
 * @param {Object}  props
 * @param {Array}   props.chosenSessions
 * @param {Array}   props.allTracks
 * @param {Object}  props.attributes
 * @param {Object}  props.settings
 *
 * @return {Element}
 */
function ScheduleGridWithContext( props ) {
	const { chosenSessions, allTracks, attributes, settings } = props;

	/*
	 * `attributes.attributes` is an unparsed JSON string. It's an artifact because `renderFrontend()` expects
	 * individual `data-{foo}` HTML attributes, instead of a single one. For this block, though, that would take
	 * extra work to maintain without providing any benefit. Removing it prevents it from causing any confusion.
	 *
	 * @todo-front Maybe look at refactoring that function to avoid workarounds like this.
	 */
	delete attributes.attributes;

	return (
		<ScheduleGridContext.Provider
			value={ { allTracks, attributes, settings, renderEnvironment: 'front-end' } }
		>
			<ScheduleGrid sessions={ chosenSessions } />
		</ScheduleGridContext.Provider>
	);
}

/**
 * todo-beta
 *
 * document that pulling
 *
 * @param {?} element
 *
 * @return {Object}
 */
function getScheduleGrdProps( element ) {
	const { attributes: rawAttributes } = element.dataset;
	const { allCategories, allTracks, settings } = rawScheduleData;
		// document why outting in initial response instead of fetching async - perf/ux. document in controller.php or here or both?
		// see also cotroller.php::populate_global_data_store(), and the other filter callback if that sticks around
	let parsedAttributes = {};
	let derivedSessions = [];

	if ( rawAttributes ) {
		parsedAttributes = JSON.parse( decodeURIComponent( rawAttributes ) );
		derivedSessions = getDerivedSessions( rawScheduleData.allSessions, allCategories, allTracks, parsedAttributes );
	}

	const props = {
		allTracks: allTracks,
		settings: settings,
		attributes: parsedAttributes,
		chosenSessions: derivedSessions.chosenSessions,
	};

	return props;
}

renderFrontend( '.wp-block-wordcamp-schedule', ScheduleGridWithContext, getScheduleGrdProps );
	// can just call ScheduleGrid directly here instead of needing a extra component?
		// maybe move the logic in into getAttributesFromData ?
			// can't b/c it's not the one calling ScheduleGrid, unless there's some way to do it that i'm not aware of
		// or maybe wrap renderFrontend with <Context> ?
			// can't b/c attributes are different? but those could be passed as props?
				// but they're not props in editor, so would have to change there to make it a prop, or maybe can add to context in schedulegrid? but that would be weird
	// maybe modify renderFrontEnd so that it'll set Context, if getAttributesFromData() returns an object named 'context.name' and `context.value` ?
