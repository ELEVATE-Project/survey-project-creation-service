'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.bulkDelete('modules', null, {})

		const certificatesArray = [
			{
				code: 'one-logo-one-sign',
				name: 'One Logo One Signature',
				url: 'project/207/1/f458b32e-6c3e-42ec-b390-40127799de8c/data.json',
				meta: {
					logos: {
						no_of_logos: 1,
						stateLogo1: null,
					},
					signature: {
						no_of_signature: 1,
						signatureImg1: null,
					},
					signatureTitleName1: 'Name',
					signatureTitleDesignation1: 'Designation',
				},
			},
			{
				code: 'one-logo-two-sign',
				name: 'One Logo Two Signature',
				url: 'project/207/1/f458b32e-6c3e-42ec-b390-40127799de8c/data.json',
				meta: {
					logos: {
						no_of_logos: 1,
						stateLogo1: null,
					},
					signature: {
						no_of_signature: 2,
						signatureImg1: null,
						signatureImg2: null,
					},
					signatureTitleName1: 'Name',
					signatureTitleDesignation1: 'Designation',
					signatureTitleName2: 'Name',
					signatureTitleDesignation2: 'Designation',
				},
			},
			{
				code: 'two-logo-one-sign',
				name: 'Two Logo One Signature',
				url: 'project/207/1/f458b32e-6c3e-42ec-b390-40127799de8c/data.json',
				meta: {
					logos: {
						no_of_logos: 2,
						stateLogo1: null,
						stateLogo2: null,
					},
					signature: {
						no_of_signature: 1,
						signatureImg1: null,
					},
					signatureTitleName1: 'Name',
					signatureTitleDesignation1: 'Designation',
				},
			},
			{
				code: 'two-logo-two-sign',
				name: 'Two Logo Two Signature',
				url: 'project/207/1/f458b32e-6c3e-42ec-b390-40127799de8c/data.json',
				meta: {
					logos: {
						no_of_logos: 2,
						stateLogo1: null,
						stateLogo2: null,
					},
					signature: {
						no_of_signature: 2,
						signatureImg1: null,
						signatureImg2: null,
					},
					signatureTitleName1: 'Name',
					signatureTitleDesignation1: 'Designation',
					signatureTitleName2: 'Name',
					signatureTitleDesignation2: 'Designation',
				},
			},
		]

		const certificateFinalArray = Object.keys(certificatesArray).map((key) => {
			const certificateRow = {
				resource_type: 'project',
				created_at: new Date(),
				updated_at: new Date(),
			}

			return certificateRow
		})

		// Insert the data into the 'modules' table
		await queryInterface.bulkInsert('certificate_base_templates', certificateFinalArray)
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.bulkDelete('certificate_base_templates', null, {})
	},
}
