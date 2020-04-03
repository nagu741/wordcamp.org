/**
 * WordPress dependencies
 */
import { InspectorControls } from '@wordpress/block-editor';
import { CheckboxControl, PanelBody, ToggleControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/*
 * Internal dependencies
 */
import { _tmp_dateI18n } from '../../utils/date';

/*
 * @todo-inspector
 *
 * test w/ multiple blocks on same page but w/ different settings
 *
 * commit w/ props mark, mel, corey. look for any others as well
 */

/**
 * Render the inspector Controls for the Schedule block.
 *
 * @param {Object}   props
 * @param {Array}    props.attributes
 * @param {Array}    props.allSessions
 * @param {Object}   props.allTracks
 * @param {Function} props.setAttributes
 * @param {Array}    props.settings
 *
 * @return {Element}
 */
export default function ScheduleInspectorControls( { attributes, allSessions, allTracks, setAttributes, settings } ) {
	const { showCategories, chooseSpecificDays, chosenDays, chooseSpecificTracks, chosenTrackIds } = attributes;
	const displayedDays = getDisplayedDays( allSessions );

	return (
		<InspectorControls>
			<PanelBody title={ __( 'Display Settings', 'wordcamporg' ) } initialOpen={ true }>
				<ToggleControl
					label={ __( 'Show categories', 'wordcamporg' ) }
					checked={ showCategories }
					onChange={ ( value ) => setAttributes( { showCategories: value } ) }
				/>

				<ChooseSpecificDays
					chooseSpecificDays={ chooseSpecificDays }
					displayedDays={ displayedDays }
					chosenDays={ chosenDays }
					dateFormat={ settings.date_format }
					setAttributes={ setAttributes }
				/>

				<ChooseSpecificTracks
					chooseSpecificTracks={ chooseSpecificTracks }
					allTracks={ allTracks }
					chosenTrackIds={ chosenTrackIds }
					setAttributes={ setAttributes }
				/>
			</PanelBody>
		</InspectorControls>
	);
}

/**
 * Get all of the dates that the given sessions are assigned to.
 *
 * @param {Array} sessions
 *
 * @return {string[]}
 */
function getDisplayedDays( sessions ) {
	let uniqueDays = sessions.reduce( ( accumulatingDays, session ) => {
		accumulatingDays[ _tmp_dateI18n( 'Y-m-d', session.derived.startTime ) ] = true;
		// maybe make a constant for the format, b/c it's being used in another place too

		return accumulatingDays;
	}, {} );

	uniqueDays = Object.keys( uniqueDays );

	return uniqueDays.sort();
	// todo its doing a string sort so thinks 13 < 5. maybe set to timestamp rather than true, and sort by that?
}

/**
 * Render the UI for choosing specific days.
 *
 * @param {Array}    props
 * @param {boolean}  props.chooseSpecificDays
 * @param {Array}    props.displayedDays
 * @param {Array}    props.chosenDays
 * @param {string}   props.dateFormat
 * @param {Function} props.setAttributes
 *
 * @return {Element}
 */
function ChooseSpecificDays( { chooseSpecificDays, displayedDays, chosenDays, dateFormat, setAttributes } ) {
	// maybe pass in onChange functions for each of these. has some pros and cons.
	// tried it and felt like cons outweighed pros

	return (
		<div className="wordcamp-schedule__control-container">
			<fieldset>
				<legend>
					<ToggleControl
						label={ __( 'Choose specific days', 'wordcamporg' ) }
						checked={ chooseSpecificDays }
						onChange={ ( enabled ) => setAttributes( { chooseSpecificDays: enabled } ) }
					/>
				</legend>

				{ chooseSpecificDays &&
					displayedDays.map( ( day ) => {
						return (
							<CheckboxControl
								key={ day }
								label={ _tmp_dateI18n( dateFormat, day ) }
								checked={ chosenDays.includes( day ) }
								onChange={ ( isChecked ) => {
									const newDays = Array.from( chosenDays ); // setAttributes() needs a new array to determine if it's changed or not.

									if ( isChecked ) {
										newDays.push( day );
									} else {
										newDays.splice( newDays.indexOf( day ), 1 ); // Remove from the array.
									}

									setAttributes( { chosenDays: newDays } );
								} }
							/>
						);
					} ) }
			</fieldset>
		</div>
	);
}

/**
 * Render the UI for choosing specific tracks.
 *
 * All of the tracks that exist are shown, instead of just the ones assigned to the current sessions. That's more
 * consistent and obvious for users, so they don't have to guess why a track they created isn't showing up.
 *
 * @param {Array}    props
 * @param {boolean}  props.chooseSpecificTracks
 * @param {Object}   props.allTracks
 * @param {Array}    props.chosenTrackIds
 * @param {Function} props.setAttributes
 *
 * @return {Element}
 */
function ChooseSpecificTracks( { chooseSpecificTracks, allTracks, chosenTrackIds, setAttributes } ) {
	/* document that
	 * They must be sorted in a predictable order so that track spanning can be reliably detected, and alphabetical
	 * is the simplest way.
	 * but slug rather than name so that they can change slug to change sorting
	 / todo editing slugs to arrange tracks is pretty janky, but best tradeoff for now?
		 v2 should maybe give people a way to change track order w/out dealing w/ slugs etc
		 worth the time, though? shortcode never did, never heard any complaints
		 maybe instead, just don't _tell_ people they can do that, to avoid the whole question
		 but still leave the option for power users, or if anyone ever asks how they can
		 might be more of an issue here, though, b/c CSS grid doesn't support non-contiguous tracks, while shortcode did
	 maybe sort by name here, but probably better to match the order of the displayedtracks
	*/

	return (
		<div className="wordcamp-schedule__control-container">
			<fieldset>
				<legend>
					<ToggleControl
						label={ __( 'Choose specific tracks', 'wordcamporg' ) }
						help="Notes: Tracks will only appear if at least one of the sessions being displayed are assigned to them. Tracks are arranged alphabetically, according to their slug."
							// todo maybe move ^ to just be displayed when you hover over a question-mark icon? is there an existing G pattern for that?
						checked={ chooseSpecificTracks }
						onChange={ ( enabled ) => setAttributes( { chooseSpecificTracks: enabled } ) }
					/>
				</legend>

				{ chooseSpecificTracks &&
					allTracks.map( ( track ) => {
						return (
							<CheckboxControl
								key={ track.id }
								label={ track.name }
								checked={ chosenTrackIds.includes( track.id ) }
								onChange={ ( isChecked ) => {
									const newTracks = Array.from( chosenTrackIds ); // setAttributes() needs a new array to determine if it's changed or not.

									if ( isChecked ) {
										newTracks.push( track.id );
									} else {
										newTracks.splice( newTracks.indexOf( track.id ), 1 ); // Remove from the array.
									}

									setAttributes( { chosenTrackIds: newTracks } );
								} }
							/>
						);
					} ) }
			</fieldset>
		</div>
	);
}
