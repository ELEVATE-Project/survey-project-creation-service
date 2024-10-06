const common = require('@constants/common')

module.exports = (sequelize, DataTypes) => {
	const Resource = sequelize.define(
		'Resource',
		{
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: DataTypes.INTEGER,
			},
			type: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			title: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			status: {
				allowNull: false,
				type: DataTypes.ENUM(
					'DRAFT',
					'SUBMITTED',
					'IN_REVIEW',
					'APPROVED',
					'REJECTED',
					'PUBLISHED',
					'REJECTED_AND_REPORTED'
				),
				defaultValue: 'DRAFT',
			},
			blob_path: {
				allowNull: true,
				type: DataTypes.STRING,
			},
			user_id: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			organization_id: {
				primaryKey: true,
				allowNull: false,
				type: DataTypes.STRING,
			},
			next_stage: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 1,
			},
			review_type: {
				allowNull: false,
				type: DataTypes.ENUM('SEQUENTIAL', 'PARALLEL'),
				defaultValue: 'SEQUENTIAL',
			},
			reference_id: {
				type: DataTypes.INTEGER,
			},
			meta: {
				allowNull: true,
				type: DataTypes.JSONB,
			},
			published_id: {
				type: DataTypes.STRING,
			},
			created_by: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			updated_by: {
				type: DataTypes.STRING,
			},
			submitted_on: {
				type: DataTypes.DATE,
			},
			published_on: {
				type: DataTypes.DATE,
			},
			last_reviewed_on: {
				type: DataTypes.DATE,
			},
			is_under_edit: {
				type: DataTypes.BOOLEAN,
				defaultValue: false,
			},
		},
		{
			modelName: 'Resource',
			tableName: 'resources',
			freezeTableName: true,
			paranoid: true,
			indexes: [
				{
					name: 'title_index',
					fields: ['title'],
				},
			],
		}
	)
	// Helper function to emit user actions with dynamic action types
	const emitUserAction = async (instance, actionType) => {
		try {
			if (actionType) {
				eventEmitter.emit(common.EVENT_ADD_USER_ACTION, {
					actionCode: common.USER_ACTIONS[instance.type][actionType],
					userId: instance.user_id,
					objectId: instance.id,
					objectType: common.MODEL_NAMES.RESOURCE,
					orgId: instance.organization_id,
				})
			}
		} catch (error) {
			console.error(`Error during ${actionType} hook:`, error)
			throw error
		}
	}

	Resource.addHook('afterCreate', (instance) => emitUserAction(instance, 'RESOURCE_CREATED'))

	Resource.addHook('afterDestroy', (instance) => emitUserAction(instance, 'RESOURCE_DELETED'))
	Resource.addHook('afterUpdate', (instance) => {
		const statusActionMap = {
			[common.RESOURCE_STATUS_PUBLISHED]: 'RESOURCE_PUBLISHED',
			[common.RESOURCE_STATUS_REJECTED_AND_REPORTED]: 'RESOURCE_REPORTED',
			[common.RESOURCE_STATUS_REJECTED]: 'RESOURCE_REJECTED',
		}

		const actionKey = statusActionMap[instance.status]
		if (actionKey) {
			emitUserAction(instance, actionKey)
		}
	})

	return Resource
}
