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
// const consumptionService = require('@requests/consumption')
const { consumptionService } = require('@consumption/index')

const topics = [
	process.env.CLEAR_INTERNAL_CACHE,
	process.env.PROJECT_PUBLISH_KAFKA_TOPIC,
	process.env.ROLLOUT_PUBLISH_KAFKA_TOPIC,
	process.env.PROGRAM_PUBLISH_KAFKA_TOPIC,
]
async function ensureTopics(admin) {
	try {
		// Connect to the Kafka admin client
		await admin.connect()

		// Check existing topics
		const existingTopics = await admin.listTopics()
		const topicsToCreate = topics.filter((topic) => !existingTopics.includes(topic))

		if (topicsToCreate.length > 0) {
			// Create missing topics
			await admin.createTopics({
				topics: topicsToCreate.map((topic) => ({
					topic,
					numPartitions: 1, // Adjust as needed
					replicationFactor: 1, // Adjust as needed
				})),
			})
			console.log(`Created topics: ${topicsToCreate.join(', ')}`)
		} else {
			console.log('All topics already exist')
		}

		// Disconnect admin client
		await admin.disconnect()
	} catch (error) {
		console.error('Error ensuring topics:', error)
		throw error
	}
}
module.exports = async () => {
	const kafkaIps = process.env.KAFKA_URL.split(',')
	const KafkaClient = new Kafka({
		clientId: 'scp',
		brokers: kafkaIps,
	})

	const producer = KafkaClient.producer()
	const admin = KafkaClient.admin()
	const consumer = KafkaClient.consumer({ groupId: process.env.KAFKA_GROUP_ID })
	ensureTopics(admin)

	await producer.connect()

	producer.on('producer.connect', () => {
		logger.info('KafkaProvider: connected')
	})
	producer.on('producer.disconnect', () => {
		logger.error('KafkaProvider: could not connect', {
			triggerNotification: true,
		})
	})

	await consumer.connect()

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
			await consumer.subscribe({
				topics,
			})
			logger.info(
				`Subscribed to topics: ${process.env.CLEAR_INTERNAL_CACHE} , ${process.env.PROJECT_PUBLISH_KAFKA_TOPIC}, ${process.env.PROGRAM_PUBLISH_KAFKA_TOPIC} and ${process.env.ROLLOUT_PUBLISH_KAFKA_TOPIC}`
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
							utils.internalDel(streamingData)
						} else if (topic == process.env.PROJECT_PUBLISH_KAFKA_TOPIC) {
							const abc = await consumptionService.publishProjectTemplates(streamingData)
							console.log(abc)
						} else if (topic == process.env.ROLLOUT_PUBLISH_KAFKA_TOPIC) {
							// await consumptionService.publishProgram(streamingData)
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
