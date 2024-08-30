/**
 * name : configs/events
 * author : Priyanka Pradeep
 * Date : 27-Aug-2024
 * Description : Event configurations
 */

const events = require('events')
const userActionHelper = require('@helpers/userActionHelper')

module.exports = async () => {
	const eventEmitter = new events.EventEmitter()

	eventEmitter.on('error', (err) => {
		console.error('Attention! There was an error:', err)
	})

	eventEmitter.on('addUserAction', async ({ actionCode, userId, objectId, objectType, orgId }) => {
		try {
			await userActionHelper.addUserAction(actionCode, userId, objectId, objectType, orgId)
			console.log('User action added successfully')
		} catch (error) {
			console.error('Failed to add user action:', error)
			eventEmitter.emit('error', error)
		}
	})

	global.eventEmitter = eventEmitter
}
