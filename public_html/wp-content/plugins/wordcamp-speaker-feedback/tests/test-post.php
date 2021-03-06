<?php

namespace WordCamp\SpeakerFeedback\Tests;

use WP_UnitTestCase, WP_UnitTest_Factory;
use WP_Post;
use function WordCamp\SpeakerFeedback\Post\post_accepts_feedback;

defined( 'WPINC' ) || die();

/**
 * Class Test_SpeakerFeedback_Post
 *
 * @group wordcamp-speaker-feedback
 */
class Test_SpeakerFeedback_Post extends WP_UnitTestCase {
	/**
	 * @var WP_Post[]
	 */
	protected static $posts = array();

	/**
	 * Set up fixtures.
	 *
	 * @param WP_UnitTest_Factory $factory
	 */
	public static function wpSetUpBeforeClass( $factory ) {
		add_post_type_support( 'wcb_session', 'wordcamp-speaker-feedback' );

		self::$posts['yes'] = $factory->post->create_and_get( array(
			'post_type'   => 'wcb_session',
			'post_status' => 'publish',
			'meta_input'  => array(
				'_wcpt_session_type' => 'session',
				'_wcpt_session_time' => strtotime( '- 1 day' ),
			),
		) );

		self::$posts['no-support'] = $factory->post->create_and_get( array(
			'post_type'   => 'wcb_sponsor',
			'post_status' => 'publish',
		) );

		self::$posts['no-status'] = $factory->post->create_and_get( array(
			'post_type'   => 'wcb_session',
			'post_status' => 'draft',
		) );

		self::$posts['no-session-type'] = $factory->post->create_and_get( array(
			'post_type'   => 'wcb_session',
			'post_status' => 'publish',
			'meta_input'  => array(
				'_wcpt_session_type' => 'custom',
				'_wcpt_session_time' => strtotime( '- 1 day' ),
			),
		) );

		self::$posts['no-too-soon'] = $factory->post->create_and_get( array(
			'post_type'   => 'wcb_session',
			'post_status' => 'publish',
			'meta_input'  => array(
				'_wcpt_session_type' => 'session',
				'_wcpt_session_time' => strtotime( '+ 1 day' ),
			),
		) );

		self::$posts['no-too-late'] = $factory->post->create_and_get( array(
			'post_type'   => 'wcb_session',
			'post_status' => 'publish',
			'meta_input'  => array(
				'_wcpt_session_type' => 'session',
				'_wcpt_session_time' => strtotime( '- 15 days' ),
			),
		) );
	}

	/**
	 * Remove fixtures.
	 */
	public static function wpTearDownAfterClass() {
		foreach ( self::$posts as $post ) {
			wp_delete_post( $post->ID, true );
		}
	}

	/**
	 * @covers \WordCamp\SpeakerFeedback\Post\post_accepts_feedback()
	 */
	public function test_post_accepts_feedback() {
		$result = post_accepts_feedback( self::$posts['yes']->ID );

		$this->assertTrue( $result );
	}

	/**
	 * @covers \WordCamp\SpeakerFeedback\Post\post_accepts_feedback()
	 */
	public function test_post_accepts_feedback_no_post() {
		$result = post_accepts_feedback( 999999999 );

		$this->assertWPError( $result );
		$this->assertEquals( 'speaker_feedback_invalid_post_id', $result->get_error_code() );
	}

	/**
	 * @covers \WordCamp\SpeakerFeedback\Post\post_accepts_feedback()
	 */
	public function test_post_accepts_feedback_no_support() {
		$result = post_accepts_feedback( self::$posts['no-support']->ID );

		$this->assertWPError( $result );
		$this->assertEquals( 'speaker_feedback_post_not_supported', $result->get_error_code() );
	}

	/**
	 * @covers \WordCamp\SpeakerFeedback\Post\post_accepts_feedback()
	 */
	public function test_post_accepts_feedback_no_status() {
		$result = post_accepts_feedback( self::$posts['no-status']->ID );

		$this->assertWPError( $result );
		$this->assertEquals( 'speaker_feedback_post_unavailable', $result->get_error_code() );
	}

	/**
	 * @covers \WordCamp\SpeakerFeedback\Post\post_accepts_feedback()
	 */
	public function test_post_accepts_feedback_no_session_type() {
		$result = post_accepts_feedback( self::$posts['no-session-type']->ID );

		$this->assertWPError( $result );
		$this->assertEquals( 'speaker_feedback_invalid_session_type', $result->get_error_code() );
	}

	/**
	 * @covers \WordCamp\SpeakerFeedback\Post\post_accepts_feedback()
	 */
	public function test_post_accepts_feedback_no_too_soon() {
		$result = post_accepts_feedback( self::$posts['no-too-soon']->ID );

		$this->assertWPError( $result );
		$this->assertEquals( 'speaker_feedback_session_too_soon', $result->get_error_code() );
	}

	/**
	 * @covers \WordCamp\SpeakerFeedback\Post\post_accepts_feedback()
	 */
	public function test_post_accepts_feedback_no_too_late() {
		$result = post_accepts_feedback( self::$posts['no-too-late']->ID );

		$this->assertWPError( $result );
		$this->assertEquals( 'speaker_feedback_session_too_late', $result->get_error_code() );
	}
}
