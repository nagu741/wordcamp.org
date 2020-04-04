/*
 * This is a temporary alternative to the `wp.date.*` functions, since they're currently buggy.
 *
 * @todo This file can be removed when https://github.com/WordPress/gutenberg/pull/18982 is merged.
 *
 * @todo-front this is causing moment-timezone to get bundled in schedule-front-end build instead of referencing
 * external.
 */

/**
 * External dependencies
 */
import momentLib from 'moment';
import 'moment-timezone/moment-timezone';
import 'moment-timezone/moment-timezone-utils';
// make sure not getting added to bundle

/** @typedef {import('moment').Moment} Moment */

import { __experimentalGetSettings, format } from '@wordpress/date';

const WP_ZONE = 'WP';
const HOUR_IN_MINUTES = 60;

const settings = __experimentalGetSettings();

function setupWPTimezone() {
	// Create WP timezone based off dateSettings.
	momentLib.tz.add(
		momentLib.tz.pack( {
			name: WP_ZONE,
			abbrs: [ WP_ZONE ],
			untils: [ null ],
			offsets: [ -settings.timezone.offset * 60 || 0 ],
		} )
	);
}

/**
 * Formats a date similar to `wp_date()` on the PHP side.
 *
 * @param {string} dateFormat
 * @param {*}      dateValue  Anything parseable by Moment.js.
 *
 * @return {string}
 */
export function _tmp_dateI18n( dateFormat, dateValue ) {
	let dateMoment;

	if ( settings.timezone.string ) {
		dateMoment = momentLib( dateValue ).tz( settings.timezone.string );
	} else {
		const offset = settings.timezone.offset * HOUR_IN_MINUTES;
		dateMoment = momentLib( dateValue ).utcOffset( offset );
	}

	dateMoment.locale( settings.l10n.locale );

	return format( dateFormat, dateMoment );
}

setupWPTimezone();
