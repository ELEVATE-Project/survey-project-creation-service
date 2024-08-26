const common = require('@constants/common')
const EventEmitter = require('events')
const eventEmitter = new EventEmitter()
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

	const emitUserAction = async (instance, actionType) => {
		try {
			eventEmitter.emit(common.EVENT_ADD_USER_ACTION, {
				actionCode: common.USER_ACTIONS[instance.type][actionType],
				userId: instance.user_id,
				objectId: instance.id,
				objectType: common.MODEL_NAMES.RESOURCE,
				orgId: instance.organization_id,
			})
		} catch (error) {
			console.error(`Error during ${actionType} hook:`, error)
			throw error
		}
	}

	Resource.addHook('afterCreate', (instance) => emitUserAction(instance, 'RESOURCE_CREATED'))
	Resource.addHook('afterDestroy', (instance) => emitUserAction(instance, 'RESOURCE_DELETED'))
	Resource.addHook('afterUpdate', (instance) => {
		if (instance.status == common.RESOURCE_STATUS_PUBLISHED) {
			emitUserAction(instance, 'RESOURCE_PUBLISHED')
		}
	})

	// Resource.addHook('afterCreate', async (instance, options) => {
	// 	try {
	// 		// After creating an activity, trigger the event
	// 		eventEmitter.emit(common.EVENT_ADD_USER_ACTION, {
	// 			actionCode: common.USER_ACTIONS[instance.type].RESOURCE_CREATED, // Replace with actual action code
	// 			userId: instance.user_id,
	// 			objectId: instance.id,
	// 			objectType: common.MODEL_NAMES.RESOURCE,
	// 			orgId: instance.organization_id,
	// 		})

	// 	} catch (error) {
	// 		console.error('Error during beforeDestroy hook:', error)
	// 		throw error
	// 	}
	// })

	// Resource.addHook('afterDestroy', async (instance, options) => {
	// 	try {
	// 		// After creating an activity, trigger the event
	// 		eventEmitter.emit(common.EVENT_ADD_USER_ACTION, {
	// 			actionCode: common.USER_ACTIONS[instance.type].RESOURCE_DELETED, // Replace with actual action code
	// 			userId: instance.user_id,
	// 			objectId: instance.id,
	// 			objectType: common.MODEL_NAMES.RESOURCE,
	// 			orgId: instance.organization_id,
	// 		})

	// 	} catch (error) {
	// 		console.error('Error during beforeDestroy hook:', error)
	// 		throw error
	// 	}
	// })

	return Resource
}
