const events = require('events')
const eventEmitter = new events.EventEmitter()
const { addUserAction } = require('@helpers/activityUtils')

eventEmitter.on('error', (err) => {
	console.error('Attention! There was an error:', err)
})

eventEmitter.on('addUserAction', async ({ actionCode, userId, objectId, objectType, orgId }) => {
	try {
		console.log(actionCode, userId, objectId, objectType, orgId, 'jjjjjjjjjjjjjjjjjjj')
		let data = await addUserAction(actionCode, userId, objectId, objectType, orgId)
		// const action = await actionQueries.findOne({ code: actionCode })
		// 	if (!action?.id) {
		// 		throw new Error('ACTION_NOT_FOUND')
		// 	}

		// 	const activityData = {
		// 		action_id: action.id,
		// 		user_id: userId,
		// 		object_id: objectId,
		// 		object_type: objectType,
		// 		organization_id: orgId,
		// 	}

		// 	const createActivity = await activitiesQueries.create(activityData)
		// 	if (!createActivity?.id) {
		// 		throw new Error('ACTIVITY_CREATION_FAILED')
		// 	}
		// console.log(data,"data")
		console.log('User action added successfully')
	} catch (error) {
		console.error('Failed to add user action:', error)
		eventEmitter.emit('error', error)
	}
})

module.exports = eventEmitter
