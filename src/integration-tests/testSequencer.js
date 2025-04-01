const Sequencer = require('@jest/test-sequencer').default
const path = require('path')

class CustomSequencer extends Sequencer {
	sort(tests) {
		// Define the required test execution order (relative to integration-tests)
		const order = [
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
			'projects/project.spec.js',
			'reviews_project/reviews.spec.js',
			'programs/program.spec.js',
			'reviews_program/reviews.spec.js',
			'rollouts/rollouts.spec.js',
		]

		// Get absolute paths for all tests
		const testPaths = tests.map((test) => ({
			...test,
			relativePath: path.relative(path.join(process.cwd(), 'integration-tests'), test.path),
		}))

		console.log(
			'All Test Paths:',
			testPaths.map((t) => t.relativePath)
		)

		return testPaths
			.sort((a, b) => {
				const indexA = order.indexOf(a.relativePath)
				const indexB = order.indexOf(b.relativePath)

				// Handle tests not listed in order by moving them to the end
				const posA = indexA === -1 ? Infinity : indexA
				const posB = indexB === -1 ? Infinity : indexB

				if (posA === Infinity && posB === Infinity) {
					// If both tests are not in the order list, sort them alphabetically
					return a.relativePath.localeCompare(b.relativePath)
				}

				return posA - posB
			})
			.map((test) => test)
	}
}

module.exports = CustomSequencer
