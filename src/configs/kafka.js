/**
 * name : configs/kafka
 * author : Aman Gupta
 * Date : 07-Dec-2021
 * Description : Kafka connection configurations
 */

const utils = require('@generics/utils')
const { elevateLog } = require('elevate-logger')
const logger = elevateLog.init()
const { Kafka } = require('kafkajs')
const projectService = require('@services/projects')

module.exports = async () => {
	const kafkaIps = process.env.KAFKA_URL.split(',')
	const KafkaClient = new Kafka({
		clientId: 'scp',
		brokers: kafkaIps,
	})

	const producer = KafkaClient.producer()
	const consumer = KafkaClient.consumer({ groupId: process.env.KAFKA_GROUP_ID })

	await producer.connect()
	console.log('Consumer connected')

	producer.on('producer.connect', () => {
		logger.info('KafkaProvider: connected')
	})
	producer.on('producer.disconnect', () => {
		logger.error('KafkaProvider: could not connect', {
			triggerNotification: true,
		})
	})

	await consumer.connect()
	try {
		await consumer.connect()
		logger.info('KafkaConsumer: connected')
	} catch (error) {
		logger.error('KafkaConsumer: failed to connect', { error })
		throw error
	}

	consumer.on('consumer.connect', () => {
		logger.info('KafkaConsumer: connection established')
	})
	consumer.on('consumer.disconnect', () => {
		logger.error('KafkaConsumer: disconnected', { triggerNotification: true })
	})
	consumer.on('consumer.crash', (event) => {
		logger.error('KafkaConsumer: crashed', { event })
	})

	const subscribeToConsumer = async () => {
		try {
			await consumer.subscribe({ topics: [process.env.CLEAR_INTERNAL_CACHE] })
			await consumer.subscribe({ topic: process.env.PROJECT_PUBLISH_KAFKA_TOPIC, fromBeginning: true })
			logger.info(
				`Subscribed to topics: ${process.env.CLEAR_INTERNAL_CACHE} and ${process.env.PROJECT_PUBLISH_KAFKA_TOPIC}`
			)
			await consumer.run({
				eachMessage: async ({ topic, partition, message }) => {
					try {
						if (!message || !message.value || message.value.length === 0) {
							console.error('Received empty message')
							return
						}

						let streamingData
						try {
							streamingData = JSON.parse(message.value.toString('utf-8'))
						} catch (parseError) {
							console.error('Error parsing JSON message:', {
								message: message.value,
								error: parseError,
							})
							throw new Error('Invalid JSON format in Kafka message')
						}

						if (streamingData.type == 'CLEAR_INTERNAL_CACHE') {
							console.log('Processing CLEAR_INTERNAL_CACHE message')
							utils.internalDel(streamingData.value)
						} else if (topic == process.env.PROJECT_PUBLISH_KAFKA_TOPIC) {
							await projectService.publishToConsumption(streamingData)
						}
					} catch (error) {
						logger.error('Error processing Kafka message:', { error })
						throw error
					}
				},
			})
		} catch (error) {
			logger.error('KafkaConsumer: Error in subscribing or running', { error })
			throw error
		}
	}

	subscribeToConsumer()

	global.kafkaProducer = producer
	global.kafkaClient = KafkaClient
}
