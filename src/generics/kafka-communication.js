/**
 * name : generics/kafka-communication
 * author : Adithya Dinesh
 * Date : 29 - April - 2024
 * Description : Kafka producer methods
 */
const kafkaCommunicationsOnOff =
	!process.env.KAFKA_COMMUNICATIONS_ON_OFF || process.env.KAFKA_COMMUNICATIONS_ON_OFF != 'OFF' ? 'ON' : 'OFF'
const common = require('@constants/common')

const clearInternalCache = async (key) => {
	try {
		const payload = {
			topic: process.env.CLEAR_INTERNAL_CACHE,
			messages: [{ value: JSON.stringify({ value: key, type: 'CLEAR_INTERNAL_CACHE' }) }],
		}

		return await pushPayloadToKafka(payload)
	} catch (error) {
		throw error
	}
}

const pushPayloadToKafka = async (payload) => {
	try {
		if (kafkaCommunicationsOnOff != 'ON') {
			throw 'Kafka configuration is not done'
		}

		if (!payload || !payload.messages || payload.messages.length === 0) {
			throw 'Empty payload or messages'
		}

		let response = await kafkaProducer.send(payload)
		return response
	} catch (error) {
		return error
	}
}

const pushResourceToKafka = async (message, resourceType) => {
	try {
		// optimised for better readability , maintenance and performence. Switched from conditional check to lookup map
		const topicMap = {
			[common.PROJECT]: process.env.PROJECT_PUBLISH_KAFKA_TOPIC,
			[common.PROGRAM]: process.env.PROGRAM_PUBLISH_KAFKA_TOPIC,
		}
		const topic = topicMap[resourceType]
		if (!topic) {
			console.warn(`Publishing for resource type '${resourceType}' is not implemented.`)
			return
		}

		const payload = {
			topic: topic,
			messages: [{ value: JSON.stringify(message) }],
		}

		return await pushPayloadToKafka(payload)
	} catch (error) {
		throw error
	}
}
const pushRolloutToKafka = async (message, resourceType) => {
	try {
		let topic = process.env.ROLLOUT_PUBLISH_KAFKA_TOPIC

		if (!topic) {
			console.log('Publishing rollout topic not fount.')
			return
		}

		const payload = {
			topic: topic,
			messages: [{ value: JSON.stringify(message) }],
		}

		return await pushPayloadToKafka(payload)
	} catch (error) {
		throw error
	}
}

module.exports = {
	clearInternalCache,
	pushResourceToKafka,
	pushRolloutToKafka,
}
