const common = require('@constants/common')

module.exports = (sequelize, DataTypes) => {
	const Rollout = sequelize.define(
		'Rollout',
		{
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: DataTypes.INTEGER,
			},
			resource_type: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			resource_id: {
				allowNull: false,
				type: DataTypes.INTEGER,
			},
			status: {
				allowNull: false,
				type: DataTypes.ENUM('PENDING', 'ROLLED_OUT', 'INACTIVE'),
				defaultValue: 'PENDING',
			},
			rollout_date: {
				allowNull: true,
				type: DataTypes.DATE,
			},
			organization_id: {
				primaryKey: true,
				allowNull: false,
				type: DataTypes.STRING,
			},
			user_id: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			start_date: {
				allowNull: false,
				type: DataTypes.DATE,
			},
			end_date: {
				allowNull: false,
				type: DataTypes.DATE,
			},
			published_id: {
				type: DataTypes.STRING,
			},
			title: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			blob_path: {
				allowNull: true,
				type: DataTypes.STRING,
			},
			parent_id: {
				type: DataTypes.INTEGER,
			},
			type: {
				allowNull: true,
				type: DataTypes.ENUM('program', 'solution'),
			},
			duplicate_template_id: {
				type: DataTypes.STRING,
			},
			created_by: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			updated_by: {
				type: DataTypes.STRING,
			},
		},
		{
			modelName: 'Rollout',
			tableName: 'rollouts',
			freezeTableName: true,
			paranoid: true,
		}
	)
	// Helper function to emit user actions with dynamic action types
	const emitUserAction = async (instance, actionType) => {
		try {
			if (actionType) {
				eventEmitter.emit(common.EVENT_ADD_USER_ACTION, {
					actionCode: common.USER_ACTIONS['rollout_' + instance.type.toLowerCase()][actionType],
					userId: instance.user_id,
					objectId: instance.id,
					objectType: common.MODEL_NAMES.ROLLOUT,
					orgId: instance.organization_id,
				})
			}
		} catch (error) {
			console.error(`Error during ${actionType} hook:`, error)
			throw error
		}
	}

	Rollout.addHook('afterCreate', (instance) => emitUserAction(instance, 'ROLLOUT_CREATE'))

	Rollout.addHook('afterDestroy', (instance) => emitUserAction(instance, 'ROLLOUT_DELETED'))

	Rollout.addHook('afterUpdate', (instance) => {
		if (instance.status == common.ROLLOUT_STATUS_PUBLISHED) {
			emitUserAction(instance, 'ROLLOUT_PUBLISHED')
		}
	})

	return Rollout
}
