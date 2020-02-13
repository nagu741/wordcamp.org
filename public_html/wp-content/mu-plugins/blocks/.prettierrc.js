// Import the default config for core compatibility, but enable us to add some overrides as needed.
const defaultConfig = require( '@wordpress/scripts/config/.prettierrc.js' );

module.exports = {
	...defaultConfig,
	printWidth: 115,
};

/*
 * todo can fix?
 *
 * glancing at config options, it doesn't seem like there's much of anything, but keep an eye out
 *
 * why isn't the last { aligned with the first one? maybe a prettier bug?
 * { assignedTracks &&
	   assignedTracks.map( ( track ) => {
	           return <dd key={ track.id }>{ track.name }</dd>;
	   } ) }
 *
 *
 */

/*
 * probably can't fix b/c too prettier is too opinionated and inflexible:
 *
 * should leave args and children on separate line each if there's more than 1 of them
 *     `<ScheduleGrid icon={ ICON } attributes={ attributes } entities={ entities } />`
 *     `<div className="wordcamp-schedule">{ scheduleDays }</div>`
 *          really really hate this type especially. if could fix this, it'd go a long way to accepting.
 *          is there some kind of workaround maybe?
 *     `return <>{ timeGroups }</>;`
 *     but prettier just fits as many as it can without going over `printWidth`
 *     "Prettier [ as opposed to an intelligent human being ] strives to fit the most code into every line. With the print width set to 120, prettier may produce overly compact, or otherwise undesirable code."
 *     could lower print-width, but that'd have unintended side-effects
 *     don't want to artificially restrict though, it's not the 80s anymore
 */

/*
 * note that wrapping a JSX condition+element in parens can sometimes (but not always) save it from being undesirably compacted onto a single line
 */

/*
 * good things
 *
 * if you can learn to love the bomb, then you can stop thinking about all this
 * automatically re-formatting comments to wrap at printWidth is nice, doing that manually is always a pain
 */
