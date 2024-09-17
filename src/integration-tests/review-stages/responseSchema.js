const updateSchema = {
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
				'id': {
					'type': 'integer'
				},
				'role': {
					'type': 'string'
				},
				'level': {
					'type': 'integer'
				},
				'organization_id': {
					'type': 'string'
				},
				'resource_type': {
					'type': 'string'
				}
			},
			'required': [
				'id',
				'role',
				'level',
				'organization_id',
				'resource_type'
			]
		},
		'meta': {
			'type': 'object',
			'properties': {
				'formsVersion': {
					'type': 'array',
					'items': {}
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

module.exports = {
	updateSchema,
}
