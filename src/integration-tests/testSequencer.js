const Sequencer = require('@jest/test-sequencer').default
const path = require('path')
class CustomSequencer extends Sequencer {
	sort(tests) {
		// Define the required test execution order
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
		].map((test) => path.normalize(`integration-tests/${test}`))

		console.log(
			'Tests Found:',
			tests.map((t) => path.relative(process.cwd(), t.path))
		)

		return tests.sort((a, b) => {
			const testA = path.relative(process.cwd(), a.path)
			const testB = path.relative(process.cwd(), b.path)
			const indexA = order.indexOf(testA)
			const indexB = order.indexOf(testB)

			// Handle tests not listed in order by moving them to the end
			const posA = indexA === -1 ? order.length : indexA
			const posB = indexB === -1 ? order.length : indexB

			console.log(`Sorting: ${testA} (${posA}) vs ${testB} (${posB})`)

			return posA - posB
		})
	}
}

module.exports = CustomSequencer
