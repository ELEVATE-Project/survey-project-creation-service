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
				'status': {
					'type': 'string'
				},
				'id': {
					'type': 'integer'
				},
				'value': {
					'type': 'string'
				},
				'label': {
					'type': 'string'
				},
				'type': {
					'type': 'string'
				},
				'entity_type_id': {
					'type': 'integer'
				},
				'created_by': {
					'type': 'string'
				},
				'updated_by': {
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
				'status',
				'id',
				'value',
				'label',
				'type',
				'entity_type_id',
				'created_by',
				'updated_by',
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
			'type': 'array',
			'items': [
				{
					'type': 'object',
					'properties': {
						'id': {
							'type': 'integer'
						},
						'entity_type_id': {
							'type': 'integer'
						},
						'value': {
							'type': 'string'
						},
						'label': {
							'type': 'string'
						},
						'status': {
							'type': 'string'
						},
						'type': {
							'type': 'string'
						},
						'created_by': {
							'type': 'string'
						},
						'updated_by': {
							'type': 'string'
						},
						'created_at': {
							'type': 'string'
						},
						'updated_at': {
							'type': 'string'
						},
						'deleted_at': {
							'type': 'null'
						}
					},
					'required': [
						'id',
						'entity_type_id',
						'value',
						'label',
						'status',
						'type',
						'created_by',
						'updated_by',
						'created_at',
						'updated_at',
						'deleted_at'
					]
				}
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

const listSchema = {
	'type': 'object',
	'properties': {
		'responseCode': {
			'type': 'string'
		},
		'message': {
			'type': 'string'
		},
		'result': {
			'type': 'array',
			'items': [
				{
					'type': 'object',
					'properties': {
						'value': {
							'type': 'string'
						},
						'label': {
							'type': 'string'
						},
						'id': {
							'type': 'integer'
						}
					},
					'required': [
						'value',
						'label',
						'id'
					]
				}
			]
		},
		'meta': {
			'type': 'object',
			'properties': {
				'formsVersion': {
					'type': 'array',
					'items': [
						{
							'type': 'object',
							'properties': {
								'id': {
									'type': 'integer'
								},
								'type': {
									'type': 'string'
								},
								'version': {
									'type': 'integer'
								}
							},
							'required': [
								'id',
								'type',
								'version'
							]
						}
					]
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

module.exports = {
	createSchema,
	updateSchema,
	listSchema,
}
