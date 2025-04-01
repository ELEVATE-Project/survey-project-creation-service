const Sequencer = require('@jest/test-sequencer').default
const path = require('path')

class CustomSequencer extends Sequencer {
	sort(tests) {
		// Define exact execution order (must match actual filenames)
		const executionOrder = [
			'modules/module.spec.js',
			'permissions/permissions.spec.js',
			'role-permission-mapping/role-permission-mapping.spec.js',
			'certificates/certificates.spec.js',
			'config/config.spec.js',
			'entity-type/entity_type.spec.js',
			'entities/entities.spec.js',
			'form/form.spec.js',
			'organization-extensions/organization_extensions.spec.js',
			'review-stages/review-stages.spec.js',
			'projects/projects.spec.js',
			'reviews_project/reviews.spec.js',
			'programs/programs.spec.js',
			'reviews_program/reviews.spec.js',
			'rollouts/rollouts.spec.js',
		]

		// Map tests to their relative paths
		const testMap = {}
		tests.forEach((test) => {
			const relPath = path.relative(path.join(process.cwd(), 'integration-tests'), test.path)
			testMap[relPath] = test
		})

		// Create ordered test array
		const orderedTests = []
		executionOrder.forEach((testPath) => {
			if (testMap[testPath]) {
				orderedTests.push(testMap[testPath])
				delete testMap[testPath]
			} else {
				console.warn(`⚠️ Test not found: ${testPath}`)
			}
		})

		// Add any remaining tests at the end
		const remainingTests = Object.values(testMap)
		if (remainingTests.length) {
			console.warn(
				'⚠️ These tests were not in the execution order:',
				remainingTests.map((t) => path.relative(path.join(process.cwd(), 'integration-tests'), t.path))
			)
			orderedTests.push(...remainingTests)
		}

		console.log('✅ Final execution order:')
		orderedTests.forEach((test, index) => {
			console.log(`${index + 1}. ${path.relative(path.join(process.cwd(), 'integration-tests'), test.path)}`)
		})

		return orderedTests
	}
}

module.exports = CustomSequencer
