/**
 * Internal dependencies
 */
import { renderGridTemplateColumns } from '../schedule-grid';

// todo-test setup tests for critical paths and edges cases, espc around grid layout, like mark's test cases

// mock data from api, look at how live-schedule does it

// most important test is the grid w/ mark's test cases, so maybe renderGridTemplateColumns and renderGridTemplateRows?
	// what else though?


describe( 'renderGridTemplateColumns', () => {
	beforeAll( () => {
		// setup window.wordcampblocks.schedule w/ mock data and/or config?
	} );

	test( 'should pass smoke test', () => {
		expect( 'smoke' ).toNotEqual( 'test' );
		// whytf is it failing on trying to import inspector controls?
			// need to mark @wordpress/block-editor as an external/global, or import it directly, or install npm
			// devdependency, or something?
	} );

	// look at live-schedule for examples, ideas, etc
} );
