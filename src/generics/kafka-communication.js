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

		console.log('-------Kafka producer log starts here------------------')
		console.log('Topic Name: ', payload[0].topic)
		console.log('Message: ', JSON.stringify(payload))
		console.log('-------Kafka producer log ends here------------------')

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
		}

		if (!topic) {
			console.log('Publishing for this resource type is not implemented.')
			return
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
	clearInternalCache,
	pushResourceToKafka,
}
