<?php

namespace WordCamp\Blocks\Schedule;

defined( 'WPINC' ) || die();

/*
 * todo-front show a spinner instead of just "loading...".
 */

/**
 * @var array $attributes
 */

?>

<div
	class="wp-block-wordcamp-schedule align<?php echo esc_attr( $attributes['align'] ); ?> is-loading"
	data-attributes="<?php echo wcorg_json_encode_attr_i18n( $attributes ); ?>"
>
	<?php esc_html_e( 'Loading...', 'wordcamporg' ); ?>
</div>
