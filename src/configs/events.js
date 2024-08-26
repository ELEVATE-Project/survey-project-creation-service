const events = require('events')
const eventEmitter = new events.EventEmitter()

eventEmitter.on('error', (err) => {
	console.error('Attention! There was an error:', err)
})

eventEmitter.on('addUserAction', async ({ actionCode, userId, objectId, objectType, orgId }) => {
	try {
		const Action = require('../database/models/index').Action
		const action = await Action.findOne(
			{
				where: { code: actionCode },
			},
			{ raw: true }
		)
		if (!action?.id) {
			throw new Error('ACTION_NOT_FOUND')
		}

		const activityData = {
			action_id: action.id,
			user_id: userId,
			object_id: objectId,
			object_type: objectType,
			organization_id: orgId,
		}

		const Activity = require('../database/models/index').Activity
		const createActivity = await Activity.create(activityData)
		if (!createActivity?.id) {
			throw new Error('ACTIVITY_CREATION_FAILED')
		}
		console.log('User action added successfully')
	} catch (error) {
		console.error('Failed to add user action:', error)
		eventEmitter.emit('error', error)
	}
})

module.exports = eventEmitter
