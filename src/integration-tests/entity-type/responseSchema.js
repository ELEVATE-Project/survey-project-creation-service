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
				'allow_filtering': {
					'type': 'boolean'
				},
				'allow_custom_entities': {
					'type': 'boolean'
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
				'data_type': {
					'type': 'string'
				},
				'has_entities': {
					'type': 'boolean'
				},
				'created_by': {
					'type': 'string'
				},
				'updated_by': {
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
				'parent_id': {
					'type': 'null'
				},
				'validations': {
					'type': 'null'
				},
				'deleted_at': {
					'type': 'null'
				}
			},
			'required': [
				'status',
				'allow_filtering',
				'allow_custom_entities',
				'id',
				'value',
				'label',
				'data_type',
				'has_entities',
				'created_by',
				'updated_by',
				'organization_id',
				'updated_at',
				'created_at',
				'parent_id',
				'validations',
				'deleted_at'
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
				'formsVersion',
				'correlation'
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
						'value': {
							'type': 'string'
						},
						'label': {
							'type': 'string'
						},
						'status': {
							'type': 'string'
						},
						'allow_filtering': {
							'type': 'boolean'
						},
						'data_type': {
							'type': 'string'
						},
						'organization_id': {
							'type': 'string'
						},
						'parent_id': {
							'type': 'null'
						},
						'allow_custom_entities': {
							'type': 'boolean'
						},
						'has_entities': {
							'type': 'boolean'
						},
						'validations': {
							'type': 'object',
							'properties': {
								'regex': {
									'type': 'string'
								},
								'required': {
									'type': 'boolean'
								}
							},
							'required': [
								'regex',
								'required'
							]
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
						'value',
						'label',
						'status',
						'allow_filtering',
						'data_type',
						'organization_id',
						'parent_id',
						'allow_custom_entities',
						'has_entities',
						'validations',
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
