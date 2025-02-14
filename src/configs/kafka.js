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
const consumptionService = require('@requests/consumption')
const rolloutService = require('@services/rollouts')
const httpStatusCode = require('@generics/http-status')

module.exports = async () => {
	const kafkaIps = process.env.KAFKA_URL.split(',')
	const KafkaClient = new Kafka({
		clientId: 'scp',
		brokers: kafkaIps,
	})

	const producer = KafkaClient.producer()
	const consumer = KafkaClient.consumer({ groupId: process.env.KAFKA_GROUP_ID })

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
				topics: [
					process.env.CLEAR_INTERNAL_CACHE,
					process.env.PROJECT_PUBLISH_KAFKA_TOPIC,
					process.env.ROLLOUT_PUBLISH_KAFKA_TOPIC,
					process.env.PROGRAM_PUBLISH_KAFKA_TOPIC,
				],
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
							await consumptionService.publishProjectTemplates(streamingData)
						} else if (topic == process.env.ROLLOUT_PUBLISH_KAFKA_TOPIC) {
							await consumptionService.publishProgram(streamingData)
						} else if (topic == process.env.PROGRAM_PUBLISH_KAFKA_TOPIC) {
							await handleProgramPublish(streamingData)
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

	const handleProgramPublish = async (streamingData) => {
		try {
			if (streamingData?.id) {
				const rolloutReqBody = {
					resource_id: streamingData?.id,
					resource_type: streamingData?.type,
					start_date: streamingData?.meta?.start_date,
					end_date: streamingData?.meta?.end_date,
					targeting_criteria: streamingData?.targeting_criteria,
					title: streamingData.title,
				}

				const createRollout = await rolloutService.create(
					rolloutReqBody,
					streamingData.user_id,
					streamingData.organization_id
				)

				if (createRollout.responseCode !== httpStatusCode.ok) {
					throw new Error(`Rollout creation failed: ${createRollout.message || 'Unknown error'}`) // Include error message if available
				}

				const rollouId = createRollout?.result?.id
				if (!rollouId) {
					throw new Error('Rollout creation failed: ID not returned')
				}

				const publishRollout = await rolloutService.publish(
					rollouId,
					streamingData.user_id,
					streamingData.organization_id,
					streamingData.userToken
				)

				if (publishRollout.responseCode !== httpStatusCode.ok) {
					throw new Error(`Rollout publish failed: ${publishRollout.message || 'Unknown error'}`) // Include error message if available
				}
			} else {
				throw new Error('Resource id required')
			}
		} catch (error) {
			logger.error('Error in handleProgramPublish:', error)
			throw error // Re-throw the error to be caught by the outer try-catch
		}
	}

	subscribeToConsumer()

	global.kafkaProducer = producer
	global.kafkaClient = KafkaClient
}
