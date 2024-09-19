/**
 * name : migrateProjects.js
 * author : Priyanka Pradeep
 * created-date : 29-May-2024
 * Description : script to upload the certificate base templates.
 */
require('module-alias/register')
require('dotenv').config({ path: '../.env' })
const _ = require('lodash')

const mongoUrl = process.env.MONGODB_URL
const dbName = mongoUrl.split('/').pop()

const MongoClient = require('mongodb').MongoClient
var ObjectId = require('mongodb').ObjectID

;(async () => {
	try {
		// Connect to the MongoDB server
		const client = new MongoClient(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
		const connection = await client.connect()

		console.log('Connected to MongoDB')
		const db = connection.db(dbName)

		let migratedTemplateIds = []

		// Get all project templates
		const projectTemplates = await db
			.collection('projectTemplates')
			.find({
				// status: 'published',
				// isReusable: true,
				// _id: ObjectId("5fd21654e4d17b4af8aa6f7f")
				_id: ObjectId('66399a3443d18862ed097ff1'),
			})
			.project({ _id: 1 })
			.limit(1)
			.toArray()

		console.log(projectTemplates.length, 'project templates found')

		// Assuming you're processing the projects here
		let chunkedTemplates = _.chunk(projectTemplates, 10)
		let templateIds

		for (let chunkIndex = 0; chunkIndex < chunkedTemplates.length; chunkIndex++) {
			templateIds = await chunkedTemplates[chunkIndex].map((templateDoc) => {
				return templateDoc._id
			})

			let templates = await db
				.collection('projectTemplates')
				.find({
					_id: { $in: templateIds },
				})
				.toArray()

			//loop all projects
			for (let count = 0; count < templates.length; count++) {
				let template = templates[count]
				// console.log(template, 'template')
				if (template.tasks.length > 0) {
					let templateTasks = await db
						.collection('projectTemplateTasks')
						.find({
							_id: { $in: template.tasks },
						})
						.toArray()
					// console.log(templateTasks,'templateTasks')
					if (templateTasks.length > 0) {
						template.taskDetails = templateTasks
					}
				}

				// console.log(template, 'template')
				let formattedTemplate = await convertTemplate(template)

				console.log(formattedTemplate, 'formattedTemplate')
				migratedTemplateIds.push(template._id.toString())
			}
		}

		console.log('Updated Template Count: ', migratedTemplateIds)
		console.log('Migration completed')

		// Close the connection
		await client.close()
		console.log('Connection closed')
	} catch (error) {
		console.error('Error during migration:', error)
	}
})()

async function convertTemplate(template) {
	// console.log(template, 'template')
	return {
		title: template.title,
		objective: template.description,
		categories: template.categories.map((category) => ({
			label: category.name,
			value: category.name.toLowerCase(),
		})),
		recommended_duration: convertDuration(template.duration || template.metaInformation.duration),
		keywords: convertKeywords(template.keywords),
		recommended_for: template.recommendedFor.map((audience) => ({
			label: audience,
			value: audience.toLowerCase(),
		})),
		languages: {
			label: 'English',
			value: 'en',
		},
		learning_resources: template.learningResources.map((resource) => ({
			name: resource.name,
			url: resource.link,
		})),
		licenses: {
			label: 'CC BY 4.0',
			value: 'cc_by_4.0',
		},
		// tasks: template.taskDetails.map((task, index) => ({
		// 	id: task._id,
		// 	name: task.name,
		// 	type: task.type,
		// 	is_mandatory: task.isMandatory,
		// 	allow_evidences: task.allowEvidences,
		// 	evidence_details: {
		// 		file_types: task.evidenceDetails?.fileTypes || ['Images', 'Document', 'Videos', 'Audio'],
		// 		min_no_of_evidences: task.evidenceDetails?.minNoOfEvidences || 1,
		// 	},
		// 	learning_resources: task.learningResources.map((resource) => ({
		// 		name: resource.name,
		// 		url: resource.url,
		// 	})),
		// 	sequence_no: index + 1,
		// })),
		certificate: template.certificate || {},
	}
}

/**
 * Converts a duration object
 * @param {Object} duration - The duration object to convert.
 * @returns {Object} - The converted duration object.
 */
function convertDuration(duration) {
	let durationString

	// Check if duration is an object with a 'value' property or a direct string
	if (typeof duration === 'object' && duration !== null && 'value' in duration) {
		durationString = duration.value
	} else if (typeof duration === 'string') {
		durationString = duration
	} else if (typeof duration === 'object' && duration !== null && 'duration' in duration) {
		durationString = duration.duration
	} else {
		// Return empty if no valid duration is provided
		return {}
	}

	const durationMatch = durationString.match(/(\d+)\s*([A-Za-z]+)/)
	const durationNumber = durationMatch ? parseInt(durationMatch[1], 10) : 0
	const durationUnit = durationMatch ? durationMatch[2].toUpperCase() : ''

	// Map units to types
	const unitMapping = {
		W: 'week',
		D: 'day',
		M: 'month',
		Y: 'year',
		MONTH: 'month',
	}

	const durationType = unitMapping[durationUnit] || ''

	return {
		type: durationType,
		number: durationNumber,
	}
}

function convertKeywords(keywords) {
	if (Array.isArray(keywords) && keywords.length > 0) {
		return keywords.join(',')
	}

	return ''
}
