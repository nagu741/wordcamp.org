<?php

namespace WordCamp\SpeakerFeedback\Tests;

use WP_UnitTestCase, WP_UnitTest_Factory;
use WP_Post, WP_User;
use WP_REST_Request, WP_REST_Response;
use WordCamp\SpeakerFeedback\REST_Feedback_Controller;
use function WordCamp\SpeakerFeedback\Comment\get_feedback;

defined( 'WPINC' ) || die();

/**
 * Class Test_SpeakerFeedback_Comment
 *
 * @group wordcamp-speaker-feedback
 */
class Test_SpeakerFeedback_REST_Feedback_Controller extends WP_UnitTestCase {
	/**
	 * @var REST_Feedback_Controller
	 */
	protected static $controller;

	/**
	 * @var WP_Post
	 */
	protected static $session_post;

	/**
	 * @var WP_User
	 */
	protected static $user;

	/**
	 * @var WP_User
	 */
	protected static $admin;

	/**
	 * @var array
	 */
	protected static $valid_meta;

	/**
	 * @var WP_REST_Request
	 */
	protected $request;

	/**
	 * Set up shared fixtures for these tests.
	 *
	 * @param WP_UnitTest_Factory $factory
	 */
	public static function wpSetUpBeforeClass( $factory ) {
		self::$controller = new REST_Feedback_Controller();

		self::$session_post = $factory->post->create_and_get( array(
			'post_type' => 'wcb_session',
		) );
		update_post_meta( self::$session_post->ID, '_wcpt_session_type', 'session' );
		update_post_meta( self::$session_post->ID, '_wcpt_session_time', strtotime( '- 1 day' ) );

		add_post_type_support( 'wcb_session', 'wordcamp-speaker-feedback' );

		self::$user = $factory->user->create_and_get( array(
			'role' => 'subscriber',
		) );

		self::$admin = $factory->user->create_and_get( array(
			'role' => 'administrator',
		) );

		self::$valid_meta = array(
			'rating' => 1,
			'q1'     => 'asdf 1',
			'q2'     => 'asdf 2',
			'q3'     => 'asdf 3',
		);

		tests_add_filter( 'rest_api_init', array( self::$controller, 'register_routes' ) );
	}

	/**
	 * Set up before each test.
	 */
	public function setUp() {
		parent::setUp();

		$this->request = new WP_REST_Request( 'POST', '/wordcamp-speaker-feedback/v1/feedback' );

		wp_set_current_user( self::$user->ID );
	}

	/**
	 * Reset after each test.
	 */
	public function tearDown() {
		global $wpdb;

		$ids = $wpdb->get_col( "SELECT comment_ID FROM {$wpdb->prefix}comments" );

		// This ensures that only comments created during a given test exist in the database and cache during the test.
		$wpdb->query( "TRUNCATE TABLE {$wpdb->prefix}comments" );
		$wpdb->query( "TRUNCATE TABLE {$wpdb->prefix}commentmeta" );
		clean_comment_cache( $ids );

		$this->request = null;

		parent::tearDown();
	}

	/**
	 * @covers \WordCamp\SpeakerFeedback\REST_Feedback_Controller::create_item()
	 */
	public function test_create_item_user_id() {
		$params = array(
			'post'   => self::$session_post->ID,
			'author' => self::$user->ID,
			'meta'   => self::$valid_meta,
		);

		$this->request->set_body_params( $params );

		$response = self::$controller->create_item( $this->request );

		$this->assertTrue( $response instanceof WP_REST_Response );
		$this->assertEquals( 201, $response->get_status() );
		$this->assertCount( 1, get_feedback() );
	}

	/**
	 * @covers \WordCamp\SpeakerFeedback\REST_Feedback_Controller::create_item()
	 */
	public function test_create_item_user_array() {
		$params = array(
			'post'         => self::$session_post->ID,
			'author_name'  => 'Foo',
			'author_email' => 'bar@example.org',
			'meta'         => self::$valid_meta,
		);

		$this->request->set_body_params( $params );

		$response = self::$controller->create_item( $this->request );

		$this->assertTrue( $response instanceof WP_REST_Response );
		$this->assertEquals( 201, $response->get_status() );
		$this->assertCount( 1, get_feedback() );
	}

	/**
	 * @covers \WordCamp\SpeakerFeedback\REST_Feedback_Controller::create_item()
	 */
	public function test_create_item_no_user() {
		$params = array(
			'post' => self::$session_post->ID,
			'meta' => self::$valid_meta,
		);

		$this->request->set_body_params( $params );

		$response = self::$controller->create_item( $this->request );

		$this->assertWPError( $response );
		$this->assertEquals( 'rest_feedback_author_data_required', $response->get_error_code() );
		$this->assertCount( 0, get_feedback() );
	}

	/**
	 * @covers \WordCamp\SpeakerFeedback\REST_Feedback_Controller::duplicate_check()
	 */
	public function test_create_item_duplicate() {
		// Ensure multiple comments doesn't trigger a "comment flood". Admins get a pass.
		wp_set_current_user( self::$admin->ID );

		$params = array(
			'post'   => self::$session_post->ID,
			'author' => self::$user->ID,
			'meta'   => self::$valid_meta,
		);

		$this->request->set_body_params( $params );

		$response1 = self::$controller->create_item( $this->request );

		$this->assertTrue( $response1 instanceof WP_REST_Response );
		$this->assertEquals( 201, $response1->get_status() );
		$this->assertCount( 1, get_feedback() );

		$response2 = self::$controller->create_item( $this->request );

		$this->assertWPError( $response2 );
		$this->assertEquals( 'comment_duplicate', $response2->get_error_code() );
		$this->assertCount( 1, get_feedback() );
	}

	/**
	 * @covers \WordCamp\SpeakerFeedback\REST_Feedback_Controller::duplicate_check()
	 */
	public function test_create_item_not_duplicate() {
		// Ensure multiple comments doesn't trigger a "comment flood". Admins get a pass.
		wp_set_current_user( self::$admin->ID );

		$params = array(
			'post'   => self::$session_post->ID,
			'author' => self::$user->ID,
			'meta'   => array(
				'rating' => 1,
				'q1'     => 'asdf 1',
				'q2'     => 'asdf 2',
				'q3'     => 'asdf 3',
			),
		);

		$this->request->set_body_params( $params );

		$response1 = self::$controller->create_item( $this->request );

		$this->assertTrue( $response1 instanceof WP_REST_Response );
		$this->assertEquals( 201, $response1->get_status() );
		$this->assertCount( 1, get_feedback() );

		$params = array(
			'post'   => self::$session_post->ID,
			'author' => self::$user->ID,
			'meta'   => array(
				'rating' => 2, // Different value.
				'q1'     => 'asdf 1',
				'q2'     => 'asdf 2',
				'q3'     => 'asdf 3',
			),
		);

		$this->request->set_body_params( $params );

		$response2 = self::$controller->create_item( $this->request );

		$this->assertTrue( $response2 instanceof WP_REST_Response );
		$this->assertEquals( 201, $response2->get_status() );
		$this->assertCount( 2, get_feedback() );

		$params = array(
			'post'   => self::$session_post->ID,
			'author' => self::$user->ID,
			'meta'   => array(
				'rating' => 1,
				'q1'     => 'asdf 1',
				'q2'     => 'asdf 2',
				// Missing value.
			),
		);

		$this->request->set_body_params( $params );

		$response3 = self::$controller->create_item( $this->request );

		$this->assertTrue( $response3 instanceof WP_REST_Response );
		$this->assertEquals( 201, $response3->get_status() );
		$this->assertCount( 3, get_feedback() );
	}

	/**
	 * @covers \WordCamp\SpeakerFeedback\REST_Feedback_Controller::create_item_permissions_check()
	 */
	public function test_create_item_permissions_check_is_valid() {
		$params = array(
			'post'   => self::$session_post->ID,
			'author' => self::$user->ID,
			'meta'   => self::$valid_meta,
		);

		$this->request->set_body_params( $params );

		$response = self::$controller->create_item_permissions_check( $this->request );

		$this->assertTrue( $response );
	}

	/**
	 * @covers \WordCamp\SpeakerFeedback\REST_Feedback_Controller::create_item_permissions_check()
	 */
	public function test_create_item_permissions_check_no_post() {
		$params = array(
			'author' => self::$user->ID,
			'meta'   => self::$valid_meta,
		);

		$this->request->set_body_params( $params );

		$response = self::$controller->create_item_permissions_check( $this->request );

		$this->assertWPError( $response );
		$this->assertEquals( 'rest_feedback_invalid_post_id', $response->get_error_code() );
	}

	/**
	 * @covers \WordCamp\SpeakerFeedback\REST_Feedback_Controller::create_item_permissions_check()
	 */
	public function test_create_item_permissions_check_post_not_accepting() {
		$params = array(
			'post'   => 999999999,
			'author' => self::$user->ID,
			'meta'   => self::$valid_meta,
		);

		$this->request->set_body_params( $params );

		$response = self::$controller->create_item_permissions_check( $this->request );

		$this->assertWPError( $response );
	}
}
