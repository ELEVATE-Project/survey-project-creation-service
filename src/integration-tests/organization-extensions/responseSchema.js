const createSchema = {
	'type': 'object',
	'properties': {
		'responseCode': {
			'type': 'string'
		},
		'message': {
			'type': 'string'
		},
		'result': {
			'type': 'object',
			'properties': {
				'review_required': {
					'type': 'boolean'
				},
				'id': {
					'type': 'integer'
				},
				'show_reviewer_list': {
					'type': 'boolean'
				},
				'min_approval': {
					'type': 'integer'
				},
				'resource_type': {
					'type': 'string'
				},
				'review_type': {
					'type': 'string'
				},
				'organization_id': {
					'type': 'string'
				},
				'updated_at': {
					'type': 'string'
				},
				'created_at': {
					'type': 'string'
				},
				'deleted_at': {
					'type': 'null'
				}
			},
			'required': [
				'review_required',
				'id',
				'show_reviewer_list',
				'min_approval',
				'resource_type',
				'review_type',
				'organization_id',
				'updated_at',
				'created_at',
				'deleted_at'
			]
		},
		'meta': {
			'type': 'object',
			'properties': {
				'formsVersion': {
					'type': 'array',
					'items': {}
				},
				'correlation': {
					'type': 'string'
				}
			},
			'required': [
				'formsVersion'
			]
		}
	},
	'required': [
		'responseCode',
		'message',
		'result',
		'meta'
	]
}

const failSchema = {
	'type': 'object',
	'properties': {
		'responseCode': {
			'type': 'string'
		},
		'error': {
			'type': 'array',
			'items': {}
		},
		'meta': {
			'type': 'object',
			'properties': {
				'correlation': {
					'type': 'string'
				}
			},
			'required': [
				'correlation'
			]
		},
		'message': {
			'type': 'string'
		}
	},
	'required': [
		'responseCode',
		'error',
		'meta',
		'message'
	]
}

module.exports = {
	createSchema,
	failSchema
}
