/**
 * name : generics/kafka-communication
 * author : Adithya Dinesh
 * Date : 29 - April - 2024
 * Description : Kafka producer methods
 */
const common = require('@constants/common')

const pushEmailToKafka = async (message) => {
	try {
		const payload = { topic: process.env.NOTIFICATION_KAFKA_TOPIC, messages: [{ value: JSON.stringify(message) }] }
		return await pushPayloadToKafka(payload)
	} catch (error) {
		throw error
	}
}

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
		let response = await kafkaProducer.send(payload)
		return response
	} catch (error) {
		return error
	}
}

const pushResourceToKafka = async (message, resourceType) => {
	try {
		let topic

		if (resourceType === common.PROJECT) {
			topic = process.env.PROJECT_PUBLISH_KAFKA_TOPIC
		} else {
			console.log('Publishing project only implemented')
		}

		const payload = {
			topic,
			messages: [{ value: JSON.stringify(message) }],
		}
		return await pushPayloadToKafka(payload)
	} catch (error) {
		throw error
	}
}

module.exports = {
	pushEmailToKafka,
	clearInternalCache,
	pushResourceToKafka,
}
