/**
 * name : kafka.js.
 * author : Adithya Dinesh
 * Date : 29 - April - 2024
 * Description : kafka health check.
 */

// Dependencies
const { Kafka } = require('kafkajs')

async function health_check() {
	const kafkaIps = process.env.KAFKA_URL.split(',')
	const KafkaClient = new Kafka({
		clientId: 'scp',
		brokers: kafkaIps,
	})

	const producer = KafkaClient.producer()
	await producer.connect()

	producer.on('producer.connect', () => {
		console.log('KafkaProvider: connected')
		return true
	})
	producer.on('producer.disconnect', () => {
		console.log('KafkaProvider: could not connect')
		return false
	})
}

module.exports = {
	health_check: health_check,
}
